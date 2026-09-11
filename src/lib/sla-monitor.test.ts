/**
 * Verification test suite for Phase 7: SLA Monitoring, Reminders, Escalations & Idempotency
 */

import { DEFAULT_SLA_CONFIG, getSlaTargets } from './sla';
import { communicationAgent, generateFallbackCopy } from '@/ai/agents/communication-agent';
import type { Report } from './types';

// Mock report generator helper
function createMockReport(overrides: Partial<Report> = {}): Report {
  const baseTime = new Date('2026-09-11T12:00:00.000Z');
  const deadline = new Date(baseTime.getTime() + 12 * 3600 * 1000).toISOString();

  return {
    id: `rep_${Math.random().toString(36).substring(2, 7)}`,
    userId: 'citizen_101',
    userName: 'Citizen User',
    location: 'Shivajinagar, Pune',
    description: 'Dangerous pothole near busy junction',
    imageUrl: 'https://example.com/pothole.jpg',
    imageHint: 'Pothole',
    timestamp: baseTime.toISOString(),
    status: 'In Progress',
    department: 'Traffic & Roads',
    departmentId: 'dept_traffic',
    category: 'Pothole',
    priority: 'Critical',
    slaDeadline: deadline,
    slaResponseDeadline: new Date(baseTime.getTime() + 2 * 3600 * 1000).toISOString(),
    slaBreached: false,
    escalationLevel: 0,
    actionLog: [],
    ...overrides,
  };
}

/**
 * Pure evaluation function simulating the logic of the SLA monitor cron.
 */
export function evaluateReportSlaState(
  report: Report,
  currentTime: Date
): {
  action: 'none' | 'reminder' | 'escalate_l1' | 'escalate_l2';
  updatedReport: Report;
  notificationTarget?: 'worker' | 'department_head' | 'official';
} {
  const nowMs = currentTime.getTime();
  const deadlineMs = new Date(report.slaDeadline!).getTime();
  const target = getSlaTargets(report.priority || 'Medium', report.departmentId || report.department, DEFAULT_SLA_CONFIG);

  const reminderHours = target.reminderBeforeBreachHours || 2;
  const reminderMs = reminderHours * 3600 * 1000;
  const reminderThresholdMs = deadlineMs - reminderMs;

  // 1. Past deadline -> Escalation
  if (nowMs >= deadlineMs) {
    const currentLevel = report.escalationLevel ?? 0;
    const hoursPastDeadline = (nowMs - deadlineMs) / (3600 * 1000);

    let targetLevel = 1;
    if (hoursPastDeadline >= target.resolutionHours) {
      targetLevel = 2;
    }

    // IDEMPOTENCY: Skip if already breached and at or above target level
    if (report.slaBreached && currentLevel >= targetLevel) {
      return { action: 'none', updatedReport: report };
    }

    const newLevel = report.slaBreached ? Math.max(currentLevel + 1, targetLevel) : 1;
    const actionName = newLevel === 2 ? ('escalate_l2' as const) : ('escalate_l1' as const);

    const updatedReport: Report = {
      ...report,
      slaBreached: true,
      escalationLevel: newLevel,
      lastEscalatedAt: currentTime.toISOString(),
      actionLog: [
        ...(report.actionLog || []),
        {
          status: report.status,
          timestamp: currentTime.toISOString(),
          actor: 'System',
          actorName: 'SLA Monitor',
          notes: `Escalated to Level ${newLevel}`,
        },
      ],
    };

    return {
      action: actionName,
      updatedReport,
      notificationTarget: newLevel === 2 ? 'official' : 'department_head',
    };
  }

  // 2. Near deadline -> Reminder
  if (nowMs >= reminderThresholdMs && nowMs < deadlineMs && !report.slaBreached) {
    const lastReminderMs = report.lastReminderSentAt ? new Date(report.lastReminderSentAt).getTime() : 0;

    // IDEMPOTENCY: Skip if already sent within this window
    if (lastReminderMs >= reminderThresholdMs) {
      return { action: 'none', updatedReport: report };
    }

    const updatedReport: Report = {
      ...report,
      lastReminderSentAt: currentTime.toISOString(),
      actionLog: [
        ...(report.actionLog || []),
        {
          status: report.status,
          timestamp: currentTime.toISOString(),
          actor: 'System',
          actorName: 'SLA Monitor',
          notes: 'SLA reminder sent',
        },
      ],
    };

    return {
      action: 'reminder',
      updatedReport,
      notificationTarget: report.assignedWorkerId ? 'worker' : 'department_head',
    };
  }

  return { action: 'none', updatedReport: report };
}

export async function runSlaMonitorVerification(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, failureDetail?: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: ${testName} ${failureDetail ? `- ${failureDetail}` : ''}`);
    }
  }

  const baseTime = new Date('2026-09-11T12:00:00.000Z');
  // Critical priority: 12 hour resolution deadline -> 2026-09-12T00:00:00.000Z
  const report = createMockReport();
  const deadline = new Date(report.slaDeadline!);

  // Test 1: Future deadline -> No event
  const timeFuture = new Date(deadline.getTime() - 5 * 3600 * 1000); // 5h before deadline (before 2h reminder threshold)
  const res1 = evaluateReportSlaState(report, timeFuture);
  assert(res1.action === 'none', 'Test 1: Future deadline yields no event');

  // Test 2: Near deadline -> One reminder
  const timeNear = new Date(deadline.getTime() - 1 * 3600 * 1000); // 1h before deadline (within 2h reminder threshold)
  const res2 = evaluateReportSlaState(report, timeNear);
  assert(res2.action === 'reminder', 'Test 2a: Near deadline triggers one reminder');
  assert(res2.updatedReport.lastReminderSentAt === timeNear.toISOString(), 'Test 2b: Reminder timestamp recorded');
  assert(res2.notificationTarget === 'department_head' || res2.notificationTarget === 'worker', 'Test 2c: Department/Worker notification target selected');

  // Test 3: Re-running cron during reminder window -> No duplicate reminder (Idempotency)
  const timeNearSecondRun = new Date(timeNear.getTime() + 10 * 60 * 1000); // 10 mins later, still before deadline
  const res3 = evaluateReportSlaState(res2.updatedReport, timeNearSecondRun);
  assert(res3.action === 'none', 'Test 3: Second cron run in reminder window does NOT send duplicate reminder');

  // Test 4: Past deadline -> One escalation (Level 1)
  const timePast = new Date(deadline.getTime() + 30 * 60 * 1000); // 30 mins after deadline
  const res4 = evaluateReportSlaState(report, timePast);
  assert(res4.action === 'escalate_l1', 'Test 4a: Past deadline triggers Level 1 escalation');
  assert(res4.updatedReport.slaBreached === true, 'Test 4b: Report marked as slaBreached=true');
  assert(res4.updatedReport.escalationLevel === 1, 'Test 4c: Escalation level set to 1');
  assert(res4.notificationTarget === 'department_head', 'Test 4d: Escalation targeted to department head');

  // Test 5: Re-running cron after breach -> No duplicate escalation (Idempotency)
  const timePastSecondRun = new Date(timePast.getTime() + 15 * 60 * 1000); // 15 mins later
  const res5 = evaluateReportSlaState(res4.updatedReport, timePastSecondRun);
  assert(res5.action === 'none', 'Test 5: Second cron run after breach does NOT produce duplicate escalation');

  // Test 6: Second escalation only when policy permits (Level 2 after resolution hours window past deadline)
  const timeMuchLater = new Date(deadline.getTime() + 13 * 3600 * 1000); // 13h after deadline (> 12h resolution window)
  const res6 = evaluateReportSlaState(res4.updatedReport, timeMuchLater);
  assert(res6.action === 'escalate_l2', 'Test 6a: Multi-stage policy allows Level 2 escalation when time window elapses');
  assert(res6.updatedReport.escalationLevel === 2, 'Test 6b: Escalation level incremented to 2');
  assert(res6.notificationTarget === 'official', 'Test 6c: Level 2 escalation targeted to senior official');

  // Test 7: Communication agent text generation (deterministic copy)
  const commAgentResult = await communicationAgent({
    type: 'escalation',
    reportId: report.id,
    reportTitle: report.description,
    departmentName: report.department,
    escalationLevel: 1,
    targetUserRole: 'department_head',
  });

  assert(commAgentResult.title.length > 0, 'Test 7a: Communication agent generated valid title');
  assert(commAgentResult.body.length > 0, 'Test 7b: Communication agent generated valid body');
  assert(commAgentResult.receipt.agent === 'communication_agent', 'Test 7c: Valid communication agent receipt created');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  runSlaMonitorVerification().then((result) => {
    console.log(`Phase 7 verification: ${result.passed} passed, ${result.failed} failed.`);
    if (result.failed > 0) {
      console.error(result.errors.join('\n'));
      process.exit(1);
    }
  });
}
