/**
 * Comprehensive Gap Fix Verification Test Suite (Tasks 01 - 23)
 */

import { DEFAULT_SLA_CONFIG, calculateSlaDeadlines } from './sla';
import { validateStatusTransition, assertValidStatusTransition } from './state-machine';
import { buildComplaintContext, type DepartmentTask } from './complaint-context';
import { priorityAgent } from '@/ai/agents/priority-agent';
import { dedupAgent } from '@/ai/agents/dedup-agent';
import { coordinationAgent } from '@/ai/agents/coordination-agent';
import { evidenceVerificationAgent } from '@/ai/agents/evidence-verification-agent';
import { eventBus } from './event-bus';

export async function runGapFixVerificationTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: ${msg}`);
    }
  }

  // 1. Task 02: SLA Single Source of Truth
  const nowStr = new Date().toISOString();
  const slaCalc = calculateSlaDeadlines({ priority: 'Critical' });
  assert(DEFAULT_SLA_CONFIG.global.Critical.responseHours === 2, 'Critical response SLA is 2 hours');
  assert(DEFAULT_SLA_CONFIG.global.Critical.resolutionHours === 12, 'Critical resolution SLA is 12 hours');
  assert(Boolean(slaCalc.slaResponseDeadline), 'Response SLA deadline generated');

  // 2. Task 04 & 13: Authoritative State Machine & Multi-Dept Dependency Gating
  const validTransition = validateStatusTransition('Submitted', 'Assigned');
  assert(validTransition.valid, 'Submitted -> Assigned is valid');

  const invalidTerminal = validateStatusTransition('Resolved', 'In Progress');
  assert(!invalidTerminal.valid && Boolean(invalidTerminal.isTerminal), 'Resolved status is terminal');

  const pendingTask: DepartmentTask = {
    id: 'T-1',
    departmentId: 'dept_water',
    departmentName: 'Water Dept',
    taskName: 'Fix leak',
    status: 'In Progress',
  };

  const gatedTransition = validateStatusTransition('In Progress', 'Resolved', [pendingTask]);
  assert(!gatedTransition.valid && Boolean(gatedTransition.reason?.includes('uncompleted')), 'Dependency-aware resolution gating blocks resolution when sub-tasks are pending');

  // 3. Task 06: ComplaintContext Factory
  const mockReport: any = {
    id: 'RPT-TEST-001',
    userId: 'U-123',
    userName: 'Test Citizen',
    location: 'FC Road, Pune',
    description: 'Water pipe leakage',
    imageUrl: 'https://example.com/test.jpg',
    timestamp: nowStr,
    priority: 'Critical',
    departmentId: 'dept_water',
    department: 'Water Supply Department',
    slaBreached: false,
    responseSlaBreached: false,
  };

  const ctx = buildComplaintContext(mockReport);
  assert(ctx.complaint.id === 'RPT-TEST-001', 'ComplaintContext id matches');
  assert(ctx.priority.riskScore >= 0 && ctx.priority.riskScore <= 100, 'ComplaintContext risk score in range');

  // 4. Task 09: Priority Agent Risk Score (0-100)
  const prioResult = await priorityAgent({
    category: 'Manhole issue',
    description: 'Open manhole live hazard near busy intersection',
    urgencySignals: ['danger', 'accident risk'],
  });
  assert(prioResult.riskScore >= 85, `Critical risk score computed: ${prioResult.riskScore}/100 >= 85`);
  assert(prioResult.riskScoreReasons.length > 0, 'Risk score reasons breakdown provided');

  // 5. Task 07 & 08: Dedup Agent & Auto Incident Linking
  const dedupResult = await dedupAgent({
    category: 'Pothole',
    description: 'Deep pothole on main road',
    latitude: 18.5204,
    longitude: 73.8567,
    candidateReports: [
      {
        id: 'RPT-MASTER-99',
        description: 'Deep pothole on main road near bus stand',
        category: 'Pothole',
        latitude: 18.5204,
        longitude: 73.8567,
        timestamp: nowStr,
        status: 'In Progress',
      },
    ],
  });
  assert(dedupResult.isDuplicate === true, 'Dedup identified duplicate');
  assert(dedupResult.linkedIncidentId === 'RPT-MASTER-99', 'Auto incident linked to master incident ID');

  // 6. Task 11 & 12: Coordination Agent Sub-Tasks
  const coordResult = await coordinationAgent({
    complaintId: 'RPT-TEST-PIPE',
    category: 'Water pipe burst',
    description: 'Main line burst causing road erosion and flooding',
    primaryDepartmentId: 'dept_water',
    primaryDepartmentName: 'Water Supply Department',
  });
  assert(coordResult.requiresMultiDepartment === true, 'Coordination Agent detected multi-department incident');
  assert(coordResult.departmentTasks.length >= 2, 'Multi-department sub-tasks generated');

  // 7. Task 14 & 15: Evidence Verification Agent & Rework
  const evidencePass = await evidenceVerificationAgent({
    complaintId: 'RPT-TEST-EVD',
    category: 'Pothole',
    beforeMediaUrl: 'https://example.com/before.jpg',
    afterMediaUrl: 'https://example.com/after.jpg',
    officerNotes: 'Pothole filled with cold asphalt mix and compacted properly.',
  });
  assert(evidencePass.passed === true, 'Evidence Verification passed for complete submission');

  const evidenceFail = await evidenceVerificationAgent({
    complaintId: 'RPT-TEST-EVD2',
    category: 'Pothole',
    officerNotes: 'Done',
  });
  assert(evidenceFail.passed === false, 'Evidence Verification failed when completion photo missing');
  assert(Boolean(evidenceFail.reworkInstructions), 'Rework instructions generated upon failed verification');

  // 8. Task 16: EventBus Central Event Emitter
  const eventTracker = { received: false };
  const unsubscribe = eventBus.subscribe('SLA_BREACHED', (evt) => {
    if (evt.complaintId === 'RPT-EVT-TEST') {
      eventTracker.received = true;
    }
  });

  await eventBus.emit('SLA_BREACHED', 'RPT-EVT-TEST', { escalationLevel: 1 });
  assert(eventTracker.received === true, 'EventBus emitted and received SLA_BREACHED event');
  unsubscribe();

  return { passed, failed, errors };
}

// Execute tests directly when run via script/node
if (typeof require !== 'undefined' && require.main === module) {
  runGapFixVerificationTests().then((res) => {
    console.log(`Gap Fix Verification Test Results: ${res.passed} passed, ${res.failed} failed.`);
    if (res.failed > 0) {
      console.error(res.errors.join('\n'));
      process.exit(1);
    }
  });
}
