import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { getSlaTargets, DEFAULT_SLA_CONFIG, type SlaConfig } from '@/lib/sla';
import { dispatchNotification } from '@/ai/agents/communication-agent';
import type { Report } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Validates CRON_SECRET authorization.
 */
function verifyCronAuth(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  // If CRON_SECRET is defined in environment, strictly enforce it
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const querySecret = request.nextUrl.searchParams.get('secret');

  if (!cronSecret) {
    // If CRON_SECRET is not set in env, allow execution in local dev/testing if auth or secret query is provided
    if (bearerToken || querySecret) return true;
    // In production without secret, deny
    if (process.env.NODE_ENV === 'production') return false;
    return true;
  }

  return bearerToken === cronSecret || querySecret === cronSecret;
}

export async function GET(request: NextRequest) {
  return handleSlaMonitor(request);
}

export async function POST(request: NextRequest) {
  return handleSlaMonitor(request);
}

export async function handleSlaMonitor(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: Invalid or missing CRON_SECRET authorization.' },
      { status: 401 }
    );
  }

  const startTime = performance.now();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  try {
    const { firestore } = await getFirebaseAdmin();

    // 1. Fetch SLA Configuration (with fallback to default)
    let slaConfig: SlaConfig = DEFAULT_SLA_CONFIG;
    try {
      const configDoc = await firestore.collection('settings').doc('sla').get();
      if (configDoc.exists) {
        slaConfig = configDoc.data() as SlaConfig;
      }
    } catch {
      /* fallback to DEFAULT_SLA_CONFIG */
    }

    // 2. Query open reports (not Resolved and not Rejected)
    const openReportsSnap = await firestore
      .collection('reports')
      .where('status', 'in', ['Submitted', 'Under Verification', 'Assigned', 'In Progress'])
      .get();

    if (openReportsSnap.empty) {
      return NextResponse.json({
        success: true,
        message: 'No open reports to monitor.',
        processed: 0,
        remindersSent: 0,
        escalationsProcessed: 0,
        durationMs: Math.round(performance.now() - startTime),
      });
    }

    let remindersSent = 0;
    let escalationsProcessed = 0;
    const reportUpdates: Array<{ id: string; type: 'reminder' | 'escalation'; level?: number }> = [];

    // Process open reports
    for (const doc of openReportsSnap.docs) {
      const report = { id: doc.id, ...doc.data() } as Report;

      // Skip if missing deadline
      if (!report.slaDeadline) {
        continue;
      }

      const deadlineMs = new Date(report.slaDeadline).getTime();
      if (isNaN(deadlineMs)) continue;

      const priority = report.priority || 'Medium';
      const departmentId = report.departmentId || report.department;
      const target = getSlaTargets(priority, departmentId, slaConfig);

      // ── RESPONSE SLA MONITORING (Task 03) ──────────────────────────────────
      if (['Submitted', 'Under Verification'].includes(report.status) && report.slaResponseDeadline) {
        const respDeadlineMs = new Date(report.slaResponseDeadline).getTime();
        if (!isNaN(respDeadlineMs) && nowMs >= respDeadlineMs && !report.responseSlaBreached) {
          const respActionLog = {
            status: report.status,
            timestamp: nowIso,
            actor: 'System' as const,
            actorName: 'SLA Automation Monitor',
            notes: `🚨 Response SLA Breached! Complaint unacknowledged past ${target.responseHours}h limit. Escalated to Department Head.`,
          };

          await firestore.runTransaction(async (transaction: any) => {
            const ref = firestore.collection('reports').doc(report.id);
            const currentDoc = await transaction.get(ref);
            if (!currentDoc.exists) return;

            const data = currentDoc.data() as Report;
            const existingLogs = data.actionLog || [];

            transaction.update(ref, {
              responseSlaBreached: true,
              escalationLevel: Math.max(1, data.escalationLevel ?? 0),
              escalatedTo: `${data.department || 'Department'} Head`,
              lastEscalatedAt: nowIso,
              actionLog: [...existingLogs, respActionLog],
            });
          });

          await dispatchNotification({
            input: {
              type: 'escalation',
              reportId: report.id,
              reportTitle: report.description,
              category: report.category,
              departmentId: report.departmentId,
              departmentName: report.department,
              priority: report.priority,
              escalationLevel: 1,
              targetUserRole: 'department_head',
              customDetails: `Response SLA Breached (${target.responseHours}h acknowledgement limit exceeded)`,
            },
            sendSms: true,
          });

          escalationsProcessed++;
        }
      }

      const reminderHours = target.reminderBeforeBreachHours || 4;
      const reminderMs = reminderHours * 3600 * 1000;
      const reminderThresholdMs = deadlineMs - reminderMs;

      // ── RESOLUTION SLA BREACHED (now >= deadlineMs) ──────────────────────────
      if (nowMs >= deadlineMs) {
        const currentLevel = report.escalationLevel ?? 0;
        const hoursPastDeadline = (nowMs - deadlineMs) / (3600 * 1000);

        // Determine target escalation level: Level 1 immediately on breach, Level 2 if past resolution SLA window
        let targetLevel = 1;
        if (hoursPastDeadline >= target.resolutionHours) {
          targetLevel = 2;
        }

        // IDEMPOTENCY CHECK:
        // Skip if report is already flagged as breached AND is already at or above target escalation level
        if (report.slaBreached && currentLevel >= targetLevel) {
          continue;
        }

        const newEscalationLevel = report.slaBreached ? Math.max(currentLevel + 1, targetLevel) : 1;
        const escalatedToTitle = newEscalationLevel === 1
          ? `${report.department || 'Department'} Head`
          : 'Municipal Commissioner / PMC Administration';

        const newEscalationEvent = {
          id: `esc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          level: newEscalationLevel,
          escalatedAt: nowIso,
          escalatedTo: escalatedToTitle,
          reason: `SLA resolution deadline (${report.slaDeadline}) breached by ${Math.round(hoursPastDeadline)} hours.`,
        };

        const newActionLog = {
          status: report.status,
          timestamp: nowIso,
          actor: 'System' as const,
          actorName: 'SLA Automation Monitor',
          notes: `🚨 SLA Breached! Escalated to Level ${newEscalationLevel} (${escalatedToTitle}).`,
        };

        // Transactional update on report
        await firestore.runTransaction(async (transaction: any) => {
          const ref = firestore.collection('reports').doc(report.id);
          const currentDoc = await transaction.get(ref);
          if (!currentDoc.exists) return;

          const data = currentDoc.data() as Report;
          const existingLogs = data.actionLog || [];
          const existingEscalations = (data as any).escalationEvents || [];

          transaction.update(ref, {
            slaBreached: true,
            escalationLevel: newEscalationLevel,
            lastEscalatedAt: nowIso,
            escalatedTo: escalatedToTitle,
            actionLog: [...existingLogs, newActionLog],
            escalationEvents: [...existingEscalations, newEscalationEvent],
          });
        });

        escalationsProcessed++;
        reportUpdates.push({ id: report.id, type: 'escalation', level: newEscalationLevel });

        // Trigger Communication Layer
        await dispatchNotification({
          input: {
            type: 'escalation',
            reportId: report.id,
            reportTitle: report.description,
            category: report.category,
            departmentId: report.departmentId,
            departmentName: report.department,
            priority: report.priority,
            escalationLevel: newEscalationLevel,
            assignedWorkerName: report.assignedContractor,
            targetUserId: report.userId,
            targetUserRole: 'department_head',
            customDetails: `Escalated to ${escalatedToTitle}`,
          },
          sendSms: true, // Escalations may use SMS where configured
        });

        continue;
      }

      // ── CASE B: NEAR-BREACH REMINDER (reminderThresholdMs <= nowMs < deadlineMs) ─
      if (nowMs >= reminderThresholdMs && nowMs < deadlineMs && !report.slaBreached) {
        // IDEMPOTENCY CHECK:
        // Skip if reminder was already sent for this deadline window
        const lastReminderMs = report.lastReminderSentAt ? new Date(report.lastReminderSentAt).getTime() : 0;
        if (lastReminderMs >= reminderThresholdMs) {
          continue;
        }

        const newActionLog = {
          status: report.status,
          timestamp: nowIso,
          actor: 'System' as const,
          actorName: 'SLA Automation Monitor',
          notes: `⏳ SLA Warning: Deadline approaching in under ${Math.round((deadlineMs - nowMs) / (3600 * 1000))} hours. Reminder dispatched.`,
        };

        await firestore.runTransaction(async (transaction: any) => {
          const ref = firestore.collection('reports').doc(report.id);
          const currentDoc = await transaction.get(ref);
          if (!currentDoc.exists) return;

          const data = currentDoc.data() as Report;
          const existingLogs = data.actionLog || [];

          transaction.update(ref, {
            lastReminderSentAt: nowIso,
            actionLog: [...existingLogs, newActionLog],
          });
        });

        remindersSent++;
        reportUpdates.push({ id: report.id, type: 'reminder' });

        // Trigger Communication Layer (In-App & Push ONLY, no SMS for routine reminders)
        await dispatchNotification({
          input: {
            type: 'reminder',
            reportId: report.id,
            reportTitle: report.description,
            category: report.category,
            departmentId: report.departmentId,
            departmentName: report.department,
            priority: report.priority,
            assignedWorkerName: report.assignedContractor,
            targetUserId: report.assignedWorkerId || report.userId,
            targetUserRole: report.assignedWorkerId ? 'worker' : 'department_head',
          },
          sendSms: false, // Do not send SMS for every reminder
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed: openReportsSnap.size,
      remindersSent,
      escalationsProcessed,
      updates: reportUpdates,
      timestamp: nowIso,
      durationMs: Math.round(performance.now() - startTime),
    });
  } catch (error) {
    console.error('SLA Monitor Cron error:', error);
    return NextResponse.json(
      {
        error: 'SLA Monitor processing failed.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
