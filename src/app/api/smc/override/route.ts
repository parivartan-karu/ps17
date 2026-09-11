import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, requireDepartmentAccess, RequestAuthError } from '@/lib/server-auth';
import { normalizeDepartment, normalizeDepartmentId } from '@/lib/departments';
import { validatePriority } from '@/ai/agents/types';
import type { Report, ReportStatus, User } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export type OverrideActionType =
  | 'reassign_department'
  | 'reassign_worker'
  | 'override_priority'
  | 'override_status'
  | 'force_escalation'
  | 'reset_sla';

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate caller (Must be official, admin, or department_head)
    const identity = await requireRequestIdentity(request, ['official', 'admin', 'department_head']);

    const body = await request.json();
    const {
      reportId,
      actionType,
      reason,
      targetDepartmentId,
      targetWorkerId,
      targetPriority,
      targetStatus,
    } = body as {
      reportId: string;
      actionType: OverrideActionType;
      reason: string;
      targetDepartmentId?: string;
      targetWorkerId?: string;
      targetPriority?: 'Low' | 'Medium' | 'High' | 'Critical';
      targetStatus?: ReportStatus;
    };

    if (!reportId || typeof reportId !== 'string') {
      return NextResponse.json({ error: 'reportId is required.' }, { status: 400 });
    }

    if (!actionType) {
      return NextResponse.json({ error: 'actionType is required.' }, { status: 400 });
    }

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json({ error: 'A valid override reason (minimum 5 characters) is required.' }, { status: 400 });
    }

    const cleanReason = reason.trim();
    const { firestore } = await getFirebaseAdmin();
    const nowIso = new Date().toISOString();

    // 2. Transactional execution
    const result = await firestore.runTransaction(async (transaction: any) => {
      const reportRef = firestore.collection('reports').doc(reportId);
      const reportDoc = await transaction.get(reportRef);

      if (!reportDoc.exists) {
        throw new Error('Report not found.');
      }

      const report = { id: reportDoc.id, ...reportDoc.data() } as Report;

      // Check access permission (Dept Heads can only override within their department; Officials/Admins have global access)
      if (identity.role === 'department_head') {
        requireDepartmentAccess(report, identity);
      }

      const updatePayload: Record<string, any> = {};
      let auditNote = `[CENTRAL OVERRIDE - ${actionType.toUpperCase()}] Reason: ${cleanReason}`;
      let updatedWorkerName: string | undefined;

      const previousState = {
        departmentId: report.departmentId || report.department,
        assignedWorkerId: report.assignedWorkerId,
        priority: report.priority,
        status: report.status,
        escalationLevel: report.escalationLevel,
        slaBreached: report.slaBreached,
      };

      // ── ACTION A: REASSIGN DEPARTMENT ─────────────────────────────────────
      if (actionType === 'reassign_department') {
        if (!targetDepartmentId) {
          throw new Error('targetDepartmentId is required for department reassignment.');
        }
        const normDeptId = normalizeDepartmentId(targetDepartmentId);
        const deptDef = normalizeDepartment(normDeptId);
        if (!deptDef) {
          throw new Error('Invalid target department.');
        }

        updatePayload.departmentId = normDeptId;
        updatePayload.department = deptDef.name;
        updatePayload.workflowStage = 'pending_department';

        // Unassign previous worker if from different department
        if (report.assignedWorkerId) {
          const prevWorkerRef = firestore.collection('users').doc(report.assignedWorkerId);
          transaction.update(prevWorkerRef, { activeTasks: FieldValue.increment(-1) });
          updatePayload.assignedWorkerId = FieldValue.delete();
          updatePayload.assignedContractor = FieldValue.delete();
        }

        auditNote += ` | Reassigned to ${deptDef.name} (${normDeptId}).`;
      }

      // ── ACTION B: REASSIGN WORKER ──────────────────────────────────────────
      else if (actionType === 'reassign_worker') {
        if (!targetWorkerId) {
          throw new Error('targetWorkerId is required for worker reassignment.');
        }

        const newWorkerRef = firestore.collection('users').doc(targetWorkerId);
        const newWorkerDoc = await transaction.get(newWorkerRef);

        if (!newWorkerDoc.exists) {
          throw new Error('Target worker user profile not found.');
        }

        const newWorker = newWorkerDoc.data() as User;
        if (newWorker.role !== 'worker') {
          throw new Error('Target user is not a field worker.');
        }

        // Decrement previous worker if different
        if (report.assignedWorkerId && report.assignedWorkerId !== targetWorkerId) {
          const prevWorkerRef = firestore.collection('users').doc(report.assignedWorkerId);
          transaction.update(prevWorkerRef, { activeTasks: FieldValue.increment(-1) });
        }

        // Increment new worker
        if (report.assignedWorkerId !== targetWorkerId) {
          transaction.update(newWorkerRef, { activeTasks: FieldValue.increment(1) });
        }

        updatedWorkerName = newWorker.name;
        updatePayload.assignedWorkerId = targetWorkerId;
        updatePayload.assignedContractor = newWorker.name;
        updatePayload.status = 'Assigned';
        updatePayload.workflowStage = 'assigned_worker';

        auditNote += ` | Reassigned worker to ${newWorker.name}.`;
      }

      // ── ACTION C: OVERRIDE PRIORITY ─────────────────────────────────────────
      else if (actionType === 'override_priority') {
        if (!targetPriority) {
          throw new Error('targetPriority is required.');
        }
        const validPrio = validatePriority(targetPriority);
        updatePayload.priority = validPrio;
        auditNote += ` | Priority changed to ${validPrio}.`;
      }

      // ── ACTION D: OVERRIDE STATUS ───────────────────────────────────────────
      else if (actionType === 'override_status') {
        if (!targetStatus) {
          throw new Error('targetStatus is required.');
        }
        updatePayload.status = targetStatus;
        auditNote += ` | Status overridden to ${targetStatus}.`;
      }

      // ── ACTION E: FORCE ESCALATION ──────────────────────────────────────────
      else if (actionType === 'force_escalation') {
        const nextLevel = (report.escalationLevel ?? 0) + 1;
        const escalatedToTitle = nextLevel === 1
          ? `${report.department || 'Department'} Head`
          : 'Municipal Commissioner / SMC Central Administration';

        updatePayload.slaBreached = true;
        updatePayload.escalationLevel = nextLevel;
        updatePayload.lastEscalatedAt = nowIso;
        updatePayload.escalatedTo = escalatedToTitle;

        const existingEscalations = (report as any).escalationEvents || [];
        updatePayload.escalationEvents = [
          ...existingEscalations,
          {
            id: `esc_override_${Date.now()}`,
            level: nextLevel,
            escalatedAt: nowIso,
            escalatedTo: escalatedToTitle,
            reason: `Forced central administrative escalation: ${cleanReason}`,
          },
        ];

        auditNote += ` | Force-escalated to Level ${nextLevel} (${escalatedToTitle}).`;
      }

      // ── ACTION F: RESET SLA ────────────────────────────────────────────────
      else if (actionType === 'reset_sla') {
        const newDeadline = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        updatePayload.slaDeadline = newDeadline;
        updatePayload.slaBreached = false;
        updatePayload.escalationLevel = 0;
        auditNote += ` | SLA reset to new 24h deadline (${newDeadline}).`;
      }

      // Record Action Log & Audit History
      const newActionLog = {
        status: updatePayload.status || report.status,
        timestamp: nowIso,
        actor: 'Official' as const,
        actorName: identity.profile?.name || 'Central Command Official',
        notes: auditNote,
      };

      const newOverrideRecord = {
        id: `ovr_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actionType,
        reason: cleanReason,
        actorUid: identity.uid,
        actorName: identity.profile?.name || 'Central Command Official',
        actorRole: identity.role,
        timestamp: nowIso,
        previousState,
        newState: {
          departmentId: updatePayload.departmentId || report.departmentId,
          assignedWorkerId: updatePayload.assignedWorkerId || report.assignedWorkerId,
          priority: updatePayload.priority || report.priority,
          status: updatePayload.status || report.status,
          escalationLevel: updatePayload.escalationLevel ?? report.escalationLevel,
        },
      };

      const existingLogs = report.actionLog || [];
      const existingOverrides = (report as any).overrideHistory || [];

      updatePayload.actionLog = [...existingLogs, newActionLog];
      updatePayload.overrideHistory = [...existingOverrides, newOverrideRecord];

      transaction.update(reportRef, updatePayload);

      return {
        reportId: report.id,
        actionType,
        actorName: identity.profile?.name || 'Central Official',
        timestamp: nowIso,
      };
    });

    return NextResponse.json({
      success: true,
      message: `Override action "${actionType}" successfully executed and audited.`,
      result,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Central Override error:', error);
    return NextResponse.json(
      {
        error: 'Central override execution failed.',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
