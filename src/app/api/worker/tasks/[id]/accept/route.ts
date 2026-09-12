import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, timestampNow, workerLog } from '@/app/api/worker/_utils';
import { getFirebaseAdmin } from '@/firebase/server';
import { normalizeDepartmentId } from '@/lib/departments';
import { emitWorkflowEvent } from '@/lib/workflow-events';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reportRef, report, worker, isAssigned, isOpenLowPriority } = await getWorkerReport(request, id);

    if (!isAssigned && !isOpenLowPriority) {
      return NextResponse.json({ error: 'Task is not available for this worker.' }, { status: 403 });
    }

    const { firestore } = await getFirebaseAdmin();
    const acceptedAt = report.acceptedAt || timestampNow();

    await firestore.runTransaction(async (transaction: any) => {
      const freshReport = await transaction.get(reportRef);
      if (!freshReport.exists) {
        throw new Error('NOT_FOUND');
      }

      const freshData = freshReport.data();
      
      // Re-check eligibility & department ownership within transaction (Requirements 8 & 9)
      const isStillAssigned = worker.uid === freshData.assignedWorkerId;

      const workerDept = normalizeDepartmentId(worker.profile?.departmentId || worker.profile?.department);
      const reportDept = normalizeDepartmentId(freshData.departmentId || freshData.department);

      const isSameDept = !reportDept || !workerDept || reportDept === workerDept;

      const isStillOpenLowPriority = 
        isSameDept &&
        (freshData.priority === 'Low' || freshData.priority === 'Medium')
        && (freshData.difficulty === 'Easy' || freshData.difficulty === 'Moderate' || !freshData.difficulty) &&
        !freshData.assignedWorkerId &&
        (freshData.status === 'Submitted' || freshData.status === 'Assigned' || freshData.status === 'Under Verification');

      if (!isStillAssigned && !isStillOpenLowPriority) {
        throw new Error('TASK_UNAVAILABLE');
      }

      const workerData = (await transaction.get(firestore.collection('users').doc(worker.uid))).data() || {};
      if (workerData.isAvailable === false || (workerData.activeTasks || 0) >= (workerData.maxTaskCapacity || 5)) {
        throw new Error('WORKER_CAPACITY');
      }

      const isFirstAssignment = freshData.assignedWorkerId !== worker.uid;

      const updatedDepartmentTasks = Array.isArray(freshData.departmentTasks)
        ? freshData.departmentTasks.map((task: any) =>
            task.departmentId === reportDept && task.status !== 'Completed'
              ? { ...task, assignedWorkerId: worker.uid, assignedWorkerName: worker.name, status: 'In Progress' }
              : task
          )
        : freshData.departmentTasks;

      // Atomic update within transaction
      transaction.update(reportRef, {
        assignedWorkerId: worker.uid,
        assignedContractor: worker.name,
        workerAssignmentStatus: 'Accepted',
        acceptedAt,
        selfAssigned: freshData.selfAssigned || isStillOpenLowPriority,
        status: 'Assigned',
        queueStatus: 'assigned_worker',
        workflowStage: 'assigned_worker',
        ...(updatedDepartmentTasks ? { departmentTasks: updatedDepartmentTasks } : {}),
        actionLog: FieldValue.arrayUnion(
          workerLog('Assigned', worker.name, isStillOpenLowPriority ? 'Task self-assigned by worker.' : 'Task accepted by worker.')
        ),
      });

      // Increment activeTasks ONLY if first time accepting this task (prevent double increment)
      if (isFirstAssignment) {
        const workerRef = firestore.collection('users').doc(worker.uid);
        const wDoc = await transaction.get(workerRef);
        const currentActive = wDoc.exists ? (wDoc.data().activeTasks ?? 0) : 0;
        transaction.update(workerRef, { activeTasks: currentActive + 1 });
      }
    });

    try { await emitWorkflowEvent('WORKER_ASSIGNED', id, { workerId: worker.uid, workerName: worker.name, selfAssigned: true }, worker.uid, 'Worker', report.departmentId); } catch (eventError) { console.warn('[worker accept] Event logging failed:', eventError); }
    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    if (error instanceof Error && error.message === 'WORKER_CAPACITY') {
      return NextResponse.json({ error: 'Worker is unavailable or at task capacity.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'TASK_UNAVAILABLE') {
      return NextResponse.json({ error: 'Another worker has claimed this task or department mismatch. Please refresh.' }, { status: 409 });
    }
    return handleNotFound(error) || handleApiError(error);
  }
}
