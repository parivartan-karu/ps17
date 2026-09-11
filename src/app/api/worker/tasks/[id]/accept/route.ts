import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, timestampNow, workerLog } from '@/app/api/worker/_utils';
import { getFirebaseAdmin } from '@/firebase/server';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reportRef, report, worker, isAssigned, isOpenLowPriority } = await getWorkerReport(request, id);

    if (!isAssigned && !isOpenLowPriority) {
      return NextResponse.json({ error: 'Task is not available for this worker.' }, { status: 403 });
    }

    // Use transaction to atomically check and update for open low-priority tasks
    // This prevents race condition where two workers accept the same task
    const { firestore } = await getFirebaseAdmin();
    const acceptedAt = report.acceptedAt || timestampNow();

    const result = await firestore.runTransaction(async (transaction: any) => {
      const freshReport = await transaction.get(reportRef);
      if (!freshReport.exists) {
        throw new Error('NOT_FOUND');
      }

      const freshData = freshReport.data();
      
      // Re-check eligibility within transaction (conditions may have changed)
      const isStillAssigned = worker.uid === freshData.assignedWorkerId;
      const isStillOpenLowPriority = 
        (freshData.priority === 'Low' || freshData.priority === 'Medium') &&
        !freshData.assignedWorkerId &&
        (freshData.status === 'Submitted' || freshData.status === 'Assigned');

      if (!isStillAssigned && !isStillOpenLowPriority) {
        throw new Error('TASK_UNAVAILABLE');
      }

      // Atomic update within transaction
      transaction.update(reportRef, {
        assignedWorkerId: worker.uid,
        assignedContractor: worker.name,
        workerAssignmentStatus: 'Accepted',
        acceptedAt,
        selfAssigned: freshData.selfAssigned || isStillOpenLowPriority,
        status: 'Assigned',
        workflowStage: 'assigned_worker',
        actionLog: FieldValue.arrayUnion(
          workerLog('Assigned', worker.name, isStillOpenLowPriority ? 'Task self-assigned by worker.' : 'Task accepted by worker.')
        ),
      });

      // Track worker capacity
      const workerRef = firestore.collection('users').doc(worker.uid);
      transaction.update(workerRef, { activeTasks: FieldValue.increment(1) });

      return true;
    });

    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    if (error instanceof Error && error.message === 'TASK_UNAVAILABLE') {
      return NextResponse.json({ error: 'Another worker has claimed this task. Please refresh and try again.' }, { status: 409 });
    }
    return handleNotFound(error) || handleApiError(error);
  }
}
