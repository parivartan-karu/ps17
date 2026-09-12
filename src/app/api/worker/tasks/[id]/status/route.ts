import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, timestampNow, workerLog } from '@/app/api/worker/_utils';
import { getFirebaseAdmin } from '@/firebase/server';
import { workerStatusUpdateSchema } from '@/lib/worker-api';
import type { Report, ReportStatus } from '@/lib/types';
import { applyReportStatusTransition } from '@/lib/status-transition-service';
import { emitWorkflowEvent } from '@/lib/workflow-events';
import { normalizeDepartmentId } from '@/lib/departments';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reportRef, report, worker, isAssigned } = await getWorkerReport(request, id);
    if (!isAssigned) {
      return NextResponse.json({ error: 'Access denied: task is not assigned to you.' }, { status: 403 });
    }

    const body = workerStatusUpdateSchema.parse(await request.json());
    const currentStatus = report.status as ReportStatus;

    // Validate status transition using Centralized Authoritative State Machine (Phase 5 & 6)
    if ((body.status as string) === 'Resolved') {
      return NextResponse.json({ error: 'Workers cannot directly resolve complaints. Mark the task completed and submit after-work evidence for department verification.' }, { status: 400 });
    }

    const updatePayload: Record<string, unknown> = {
      status: body.status,
      workerAssignmentStatus: body.status === 'Rejected' ? 'Rejected' : 'Accepted',
      workflowStage:
        body.status === 'Assigned'
          ? 'assigned_worker'
          : body.status === 'In Progress'
            ? 'in_progress'
            : body.status === 'Under Verification'
              ? 'in_progress'
              : 'pending_department',
    };

    if (body.status === 'Rejected') {
      updatePayload.assignedWorkerId = null;
      updatePayload.assignedContractor = null;
      updatePayload.selfAssigned = false;
      updatePayload.queueStatus = 'pending_department';
    }

    const { firestore } = await getFirebaseAdmin();
    if (body.status === 'Under Verification' && report.departmentTasks?.length) {
      const workerDept = normalizeDepartmentId(worker.profile?.departmentId || worker.profile?.department);
      const reportDept = normalizeDepartmentId(report.departmentId || report.department);

      const tasks = report.departmentTasks.map((task) => {
        const taskDept = normalizeDepartmentId(task.departmentId || task.departmentName);
        const isTarget =
          task.assignedWorkerId === worker.uid ||
          (!!worker.name && task.assignedWorkerName === worker.name) ||
          (!task.assignedWorkerId && (taskDept === workerDept || taskDept === reportDept || !taskDept));

        return isTarget
          ? { ...task, assignedWorkerId: worker.uid, assignedWorkerName: worker.name, status: 'Completed' as const, completedAt: timestampNow() }
          : task;
      });

      const completedIds = new Set(tasks.filter((task) => task.status === 'Completed').map((task) => task.id));
      const released = tasks.map((task) => task.status === 'Blocked' && task.dependencyTaskId && completedIds.has(task.dependencyTaskId)
        ? { ...task, status: 'Pending' as const }
        : task);
      updatePayload.departmentTasks = released;
    }
    if (body.status === 'Under Verification') {
      updatePayload.completedAt = timestampNow();
      updatePayload.queueStatus = 'in_progress';
    }
    await firestore.runTransaction(async (tx: any) => {
      const freshRef = firestore.collection('reports').doc(id);
      const freshSnap = await tx.get(freshRef);
      if (!freshSnap.exists) throw new Error('Report not found.');
      const freshReport = { ...(freshSnap.data() as any), id } as Report;
      applyReportStatusTransition(tx, freshRef, freshReport, body.status as ReportStatus, { uid: worker.uid, role: 'Worker', name: worker.name }, {
        notes: body.remarks || `Worker updated status to ${body.status}.`,
        extraUpdates: updatePayload,
      });
    });

    // Requirement 7: Keep worker activeTasks consistent and avoid double decrement
    const wasClosed = currentStatus === 'Resolved' || currentStatus === 'Rejected';
    const isNowClosed = body.status === 'Rejected';

    if (!wasClosed && isNowClosed) {
      const workerRef = firestore.collection('users').doc(worker.uid);
      await firestore.runTransaction(async (tx: any) => {
        const wDoc = await tx.get(workerRef);
        if (wDoc.exists) {
          const currentActive = wDoc.data().activeTasks ?? 1;
          tx.update(workerRef, { activeTasks: Math.max(0, currentActive - 1) });
        }
      }).catch(() => {});
    }

    try { await emitWorkflowEvent('STATUS_CHANGED', id, { from: currentStatus, to: body.status, workerId: worker.uid }, worker.uid, 'Worker', report.departmentId); } catch (eventError) { console.warn('[worker status] Event logging failed:', eventError); }

    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    return handleNotFound(error) || handleApiError(error);
  }
}
