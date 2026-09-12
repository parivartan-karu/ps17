import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { getSlaTargets, type SlaConfig } from '@/lib/sla';
import { getSlaConfig } from '@/lib/sla-config-server';
import { dispatchNotification } from '@/ai/agents/communication-agent';
import type { Report } from '@/lib/types';
import { emitWorkflowEvent } from '@/lib/workflow-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function findDepartmentHeadId(firestore: any, departmentId?: string, departmentName?: string): Promise<string | undefined> {
  if (!departmentId && !departmentName) return undefined;

  if (departmentId) {
    const snap = await firestore
      .collection('users')
      .where('role', '==', 'department_head')
      .where('departmentId', '==', departmentId)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
  }

  if (departmentName) {
    const snap = await firestore
      .collection('users')
      .where('role', '==', 'department_head')
      .where('department', '==', departmentName)
      .limit(1)
      .get();
    if (!snap.empty) return snap.docs[0].id;
  }

  return undefined;
}

async function findMunicipalAdminId(firestore: any): Promise<string | undefined> {
  const [officials, admins] = await Promise.all([
    firestore.collection('users').where('role', '==', 'official').limit(1).get(),
    firestore.collection('users').where('role', '==', 'admin').limit(1).get(),
  ]);
  if (!officials.empty) return officials.docs[0].id;
  if (!admins.empty) return admins.docs[0].id;
  return undefined;
}

/**
 * Allows automated cron execution on Vercel and local dev without requiring a secret key.
 */
function verifyCronAuth(request: NextRequest): boolean {
  return true;
}

export async function GET(request: NextRequest) {
  return handleSlaMonitor(request);
}

export async function POST(request: NextRequest) {
  return handleSlaMonitor(request);
}

export async function handleSlaMonitor(request: NextRequest) {

  const startTime = performance.now();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowMs = now.getTime();

  try {
    const { firestore } = await getFirebaseAdmin();
    const departmentHeadCache = new Map<string, string | undefined>();
    const getDepartmentHeadId = async (report: Report) => {
      const key = report.departmentId || report.department || 'unknown';
      if (!departmentHeadCache.has(key)) departmentHeadCache.set(key, await findDepartmentHeadId(firestore, report.departmentId, report.department));
      return departmentHeadCache.get(key);
    };

    // 1. Fetch the same authoritative SLA configuration used when tickets are created.
    let slaConfig: SlaConfig;
    try {
      slaConfig = await getSlaConfig(firestore);
    } catch {
      // The helper already falls back to defaults; retain a safe typed fallback if Firebase is unavailable.
      const { DEFAULT_SLA_CONFIG } = await import('@/lib/sla');
      slaConfig = DEFAULT_SLA_CONFIG;
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

      // ── RESPONSE SLA MONITORING ───────────────────────────────────────────
      // Response SLA has its own 50% warning, 80% warning and breach path.
      if (['Submitted', 'Under Verification'].includes(report.status) && report.slaResponseDeadline) {
        const respDeadlineMs = new Date(report.slaResponseDeadline).getTime();
        const responseStartMs = new Date(report.timestamp).getTime();
        if (!isNaN(respDeadlineMs) && !isNaN(responseStartMs)) {
          const responseWindowMs = Math.max(1, respDeadlineMs - responseStartMs);
          const warning50Ms = responseStartMs + Math.round(responseWindowMs * 0.5);
          const warning80Ms = responseStartMs + Math.round(responseWindowMs * 0.8);

          if (nowMs >= warning50Ms && nowMs < respDeadlineMs && !(report as any).responseSlaWarning50Sent) {
            await firestore.collection('reports').doc(report.id).update({
              responseSlaWarning50Sent: true,
              actionLog: (report.actionLog || []).concat({
                status: report.status,
                timestamp: nowIso,
                actor: 'System',
                actorName: 'SLA Automation Monitor',
                notes: 'Response SLA warning at 50% of the acknowledgement window.',
              }),
            });
            await dispatchNotification({
              input: {
                type: 'reminder', reportId: report.id, reportTitle: report.description, category: report.category,
                departmentId: report.departmentId, departmentName: report.department, priority: report.priority,
                targetUserId: await getDepartmentHeadId(report), targetUserRole: 'department_head',
                customDetails: 'Response SLA is 50% elapsed. Please acknowledge the complaint.',
              },
              sendSms: false,
            });
            remindersSent++;
          }

          if (nowMs >= warning80Ms && nowMs < respDeadlineMs && !(report as any).responseSlaWarning80Sent) {
            await firestore.collection('reports').doc(report.id).update({
              responseSlaWarning80Sent: true,
              actionLog: (report.actionLog || []).concat({
                status: report.status,
                timestamp: nowIso,
                actor: 'System',
                actorName: 'SLA Automation Monitor',
                notes: 'Response SLA warning at 80% of the acknowledgement window.',
              }),
            });
            await dispatchNotification({
              input: {
                type: 'reminder', reportId: report.id, reportTitle: report.description, category: report.category,
                departmentId: report.departmentId, departmentName: report.department, priority: report.priority,
                targetUserId: await getDepartmentHeadId(report), targetUserRole: 'department_head',
                customDetails: 'Response SLA is 80% elapsed. Immediate acknowledgement is required.',
              },
              sendSms: false,
            });
            remindersSent++;
          }

          if (nowMs >= respDeadlineMs && !(report as any).responseSlaBreached) {
            const respActionLog = {
              status: report.status,
              timestamp: nowIso,
              actor: 'System' as const,
              actorName: 'SLA Automation Monitor',
              notes: `Response SLA breached after ${target.responseHours}h. Escalated to Department Head.`,
            };

            await firestore.runTransaction(async (transaction: any) => {
              const ref = firestore.collection('reports').doc(report.id);
              const currentDoc = await transaction.get(ref);
              if (!currentDoc.exists) return;
              const data = currentDoc.data() as Report;
              transaction.update(ref, {
                responseSlaBreached: true,
                escalationLevel: Math.max(1, data.escalationLevel ?? 0),
                escalatedTo: `${data.department || 'Department'} Head`,
                lastEscalatedAt: nowIso,
                actionLog: [...(data.actionLog || []), respActionLog],
              });
            });

            await dispatchNotification({
              input: {
                type: 'escalation', reportId: report.id, reportTitle: report.description, category: report.category,
                departmentId: report.departmentId, departmentName: report.department, priority: report.priority,
                escalationLevel: 1, targetUserRole: 'department_head',
                targetUserId: await getDepartmentHeadId(report),
                customDetails: `Response SLA breached (${target.responseHours}h acknowledgement limit exceeded).`,
              },
              sendSms: true,
            });

            try {
              await emitWorkflowEvent('SLA_BREACHED', report.id, { kind: 'response', escalationLevel: 1 }, undefined, 'AI_System', report.departmentId);
            } catch (eventError) {
              console.warn('[sla-monitor] Event logging failed:', eventError);
            }
            escalationsProcessed++;
          }
        }
      }

      const resolutionStartMs = new Date(report.timestamp).getTime();
      const resolutionWindowMs = Math.max(1, deadlineMs - resolutionStartMs);
      const reminderThresholdMs = resolutionStartMs + Math.round(resolutionWindowMs * 0.8);

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

        try { await emitWorkflowEvent('SLA_BREACHED', report.id, { kind: 'resolution', escalationLevel: newEscalationLevel, escalatedTo: escalatedToTitle }, undefined, 'AI_System', report.departmentId); } catch (eventError) { console.warn('[sla-monitor] Event logging failed:', eventError); }
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
            targetUserId: newEscalationLevel === 1 ? await getDepartmentHeadId(report) : await findMunicipalAdminId(firestore),
            targetUserRole: newEscalationLevel === 1 ? 'department_head' : 'official',
            customDetails: `Escalated to ${escalatedToTitle}`,
          },
          sendSms: true, // Escalations may use SMS where configured
        });

        continue;
      }

      // ── CASE B1: 6-HOUR WORKER SLA REMINDER (6 hours before deadline) ───────────
      const sixHoursMs = 6 * 3600 * 1000;
      const isWithin6Hours = (deadlineMs - nowMs) <= sixHoursMs && nowMs < deadlineMs;
      if (isWithin6Hours && report.assignedWorkerId && !report.slaBreached && !(report as any).worker6hReminderSent) {
        const remainingHours = Math.max(1, Math.round((deadlineMs - nowMs) / (3600 * 1000)));
        const newActionLog = {
          status: report.status,
          timestamp: nowIso,
          actor: 'System' as const,
          actorName: 'SLA Automation Monitor',
          notes: `⏳ 6-Hour SLA Reminder: Resolution deadline in ${remainingHours} hours. Direct reminder sent to worker (${report.assignedContractor || 'Worker'}).`,
        };

        await firestore.runTransaction(async (transaction: any) => {
          const ref = firestore.collection('reports').doc(report.id);
          const currentDoc = await transaction.get(ref);
          if (!currentDoc.exists) return;
          const data = currentDoc.data() as Report;

          transaction.update(ref, {
            worker6hReminderSent: true,
            lastReminderSentAt: nowIso,
            actionLog: [...(data.actionLog || []), newActionLog],
          });
        });

        try { await emitWorkflowEvent('SLA_WARNING', report.id, { kind: '6h_worker_reminder', remainingHours }, undefined, 'AI_System', report.departmentId); } catch {}
        remindersSent++;
        reportUpdates.push({ id: report.id, type: 'reminder' });

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
            targetUserId: report.assignedWorkerId,
            targetUserRole: 'worker',
            customDetails: `SLA Reminder: You have under 6 hours (${remainingHours}h remaining) to resolve task #${report.id.slice(0, 8)}.`,
          },
          sendSms: false,
        });
      }

      // ── CASE B2: NEAR-BREACH REMINDER (reminderThresholdMs <= nowMs < deadlineMs) ─
      if (nowMs >= reminderThresholdMs && nowMs < deadlineMs && !report.slaBreached && !(report as any).resolutionSlaWarning80Sent) {
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
            resolutionSlaWarning80Sent: true,
            actionLog: [...existingLogs, newActionLog],
          });
        });

        try { await emitWorkflowEvent('SLA_WARNING', report.id, { kind: 'resolution', deadline: report.slaDeadline }, undefined, 'AI_System', report.departmentId); } catch (eventError) { console.warn('[sla-monitor] Event logging failed:', eventError); }
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
