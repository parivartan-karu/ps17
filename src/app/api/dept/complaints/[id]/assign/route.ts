import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, requireDepartmentAccess, RequestAuthError } from '@/lib/server-auth';
import { normalizeDepartmentId } from '@/lib/departments';
import { applyReportStatusTransition } from '@/lib/status-transition-service';
import type { AssignmentHistory } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';
import { calculateSlaDeadlines, getSlaTargets } from '@/lib/sla';
import { dispatchNotification } from '@/ai/agents/communication-agent';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRequestIdentity(request, ['department_head', 'official', 'admin']);
    const { id: reportId } = await context.params;
    const body = await request.json();
    const workerId = body.workerId;

    if (!reportId || !workerId) {
      return NextResponse.json({ error: 'reportId and workerId are required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();
    let actualWorkerName = 'Worker';
    let assignedSlaDeadline: string | null = null;
    let assignedSlaHours: number = 24;

    await firestore.runTransaction(async (tx: any) => {
      const reportRef = firestore.collection('reports').doc(reportId);
      const workerRef = firestore.collection('users').doc(workerId);

      const [reportDoc, workerDoc] = await Promise.all([tx.get(reportRef), tx.get(workerRef)]);
      if (!reportDoc.exists) throw new Error('Report not found.');
      if (!workerDoc.exists) throw new Error('Worker not found.');

      const reportData = reportDoc.data()!;
      requireDepartmentAccess(reportData, identity);

      // Authoritative State Machine Validation (Phase 5)

      const workerData = workerDoc.data()!;
      if (workerData.role !== 'worker') {
        throw new Error('Assigned user must have the worker role.');
      }

      // Do NOT trust client workerName; load from authoritative worker document (Requirement 5)
      actualWorkerName = workerData.name || workerData.email || 'Worker';

      if (workerData.isAvailable === false) {
        throw new Error(`${actualWorkerName} is currently marked as unavailable.`);
      }

      const reportDeptId = normalizeDepartmentId(reportData.departmentId || reportData.department);
      const workerDeptId = normalizeDepartmentId(workerData.departmentId || workerData.department);
      if (!reportDeptId || !workerDeptId || reportDeptId !== workerDeptId) {
        throw new Error(`Cross-department assignment prohibited: Worker belongs to department "${workerData.department || workerDeptId}", but complaint requires "${reportData.department || reportDeptId}".`);
      }

      const active = workerData.activeTasks ?? 0;
      const max = workerData.maxTaskCapacity ?? 5;
      const isReassignment = reportData.assignedWorkerId && reportData.assignedWorkerId !== workerId;
      const isSameAssignment = reportData.assignedWorkerId === workerId;

      if (!isSameAssignment && active >= max) {
        throw new Error(`${actualWorkerName} is already at maximum capacity (${active}/${max} tasks).`);
      }

      // Calculate SLA deadline based on priority if not set or refresh for assignment
      const priority = reportData.priority || 'Medium';
      const slaCalculated = calculateSlaDeadlines({ priority, departmentId: reportDeptId });
      const slaTargets = getSlaTargets(priority, reportDeptId);
      assignedSlaDeadline = reportData.slaDeadline || slaCalculated.slaDeadline;
      assignedSlaHours = slaTargets.resolutionHours;

      // Handle reassignments: decrement previous worker's activeTasks if needed (Requirements 7 & 8)
      if (isReassignment && reportData.assignedWorkerId) {
        const prevWorkerRef = firestore.collection('users').doc(reportData.assignedWorkerId);
        const prevWorkerDoc = await tx.get(prevWorkerRef);
        if (prevWorkerDoc.exists) {
          const prevActive = prevWorkerDoc.data().activeTasks ?? 1;
          tx.update(prevWorkerRef, { activeTasks: Math.max(0, prevActive - 1) });
        }
      }

      const timestampIso = new Date().toISOString();

      const historyEntry: AssignmentHistory = {
        id: `assign_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        reportId,
        previousWorkerId: reportData.assignedWorkerId || undefined,
        newWorkerId: workerId,
        assignmentMethod: 'admin_assign',
        assignedBy: identity.uid,
        reason: 'Department head assignment',
        timestamp: timestampIso,
      };

      applyReportStatusTransition(tx, reportRef, reportData as any, 'Assigned', { uid: identity.uid, role: identity.profile.role, name: identity.profile.name ?? 'Department Head' }, {
        notes: `Assigned to ${actualWorkerName} by department. SLA target: ${assignedSlaHours} hours.`,
        extraUpdates: {
          queueStatus: 'assigned_worker',
          workflowStage: 'assigned_worker',
          assignedWorkerId: workerId,
          assignedContractor: actualWorkerName,
          assignedBy: identity.uid,
          assignmentMethod: 'admin_assign',
          slaDeadline: assignedSlaDeadline,
          slaResponseDeadline: reportData.slaResponseDeadline || slaCalculated.slaResponseDeadline,
          slaDurationHours: assignedSlaHours,
          slaAssignedAt: timestampIso,
          assignmentHistory: FieldValue.arrayUnion(historyEntry),
        },
      });

      // Increment activeTasks ONLY if assigning to a new worker (avoid double increment)
      if (!isSameAssignment) {
        tx.update(workerRef, { activeTasks: active + 1 });
      }
    });

    // Notify assigned worker about task & SLA deadline
    ;(async () => {
      try {
        await dispatchNotification({
          input: {
            type: 'reminder',
            reportId,
            targetUserId: workerId,
            targetUserRole: 'worker',
            customDetails: `Assigned Task #${reportId.slice(0, 8)} (${assignedSlaHours}h SLA Deadline). Please inspect and resolve promptly.`,
          },
          sendSms: false,
        });
      } catch {}
    })();

    // Push notification to citizen (fire-and-forget)
    ;(async () => {
      try {
        const reportDoc = await firestore.collection('reports').doc(reportId).get();
        const userId = reportDoc.data()?.userId;
        if (!userId) return;
        const userDoc = await firestore.collection('users').doc(userId).get();
        const tokens: string[] = userDoc.data()?.fcmTokens ?? [];
        if (!tokens.length) return;
        const { getMessaging } = await import('firebase-admin/messaging');
        const admin = await getFirebaseAdmin();
        await getMessaging(admin.app).sendEachForMulticast({
          tokens,
          notification: { title: 'Worker Assigned', body: `${actualWorkerName} has been assigned to your complaint.` },
          webpush: {
            notification: { icon: '/icons/icon-192x192.png', tag: `complaint-${reportId}` },
            fcmOptions: { link: `/citizen/complaint/${reportId}` },
          },
          data: { url: `/citizen/complaint/${reportId}`, tag: `complaint-${reportId}` },
        }).catch(() => {});
      } catch {}
    })();

    return NextResponse.json({ success: true, assignedWorkerName: actualWorkerName, slaDeadline: assignedSlaDeadline, slaDurationHours: assignedSlaHours });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Assignment failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
