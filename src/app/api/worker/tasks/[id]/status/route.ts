import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, timestampNow, workerLog } from '@/app/api/worker/_utils';
import { getFirebaseAdmin } from '@/firebase/server';
import { workerStatusUpdateSchema } from '@/lib/worker-api';
import type { ReportStatus } from '@/lib/types';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Valid status transitions for worker tasks
const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  'Submitted': ['Assigned', 'Submitted'],
  'Assigned': ['In Progress', 'Rejected', 'Assigned'],
  'In Progress': ['Resolved', 'Assigned', 'In Progress'],
  'Resolved': ['Resolved'], // Cannot transition away from resolved
  'Under Verification': ['Assigned', 'Resolved', 'Rejected'],
  'Rejected': ['Submitted', 'Rejected'],
};

function isValidTransition(fromStatus: ReportStatus, toStatus: ReportStatus): boolean {
  const allowed = VALID_TRANSITIONS[fromStatus] || [];
  return allowed.includes(toStatus);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reportRef, report, worker, isAssigned } = await getWorkerReport(request, id);
    if (!isAssigned) {
      return NextResponse.json({ error: 'Only the assigned worker can update task status.' }, { status: 403 });
    }

    const body = workerStatusUpdateSchema.parse(await request.json());
    const currentStatus = report.status as ReportStatus;

    // Validate status transition
    if (!isValidTransition(currentStatus, body.status)) {
      return NextResponse.json(
        { error: `Invalid status transition from ${currentStatus} to ${body.status}. Allowed transitions: ${VALID_TRANSITIONS[currentStatus]?.join(', ') || 'none'}` },
        { status: 400 }
      );
    }

    const updatePayload: Record<string, unknown> = {
      status: body.status,
      workerAssignmentStatus: body.status === 'Rejected' ? 'Rejected' : 'Accepted',
      workflowStage:
        body.status === 'Assigned'
          ? 'assigned_worker'
          : body.status === 'In Progress'
            ? 'in_progress'
            : body.status === 'Resolved'
              ? 'completed'
              : 'pending_department',
      actionLog: FieldValue.arrayUnion(
        workerLog(body.status, worker.name, body.remarks || `Status updated to ${body.status}.`)
      ),
    };

    if (body.status === 'Resolved') {
      if (!report.afterWorkMediaUrl && !report.afterImageUrl) {
        return NextResponse.json({ error: 'After-work proof is required before resolving a task.' }, { status: 400 });
      }
      updatePayload.completedAt = timestampNow();
    }

    if (body.status === 'Rejected') {
      updatePayload.assignedWorkerId = null;
      updatePayload.assignedContractor = null;
      updatePayload.selfAssigned = false;
    }

    const { firestore } = await getFirebaseAdmin();
    await reportRef.update(updatePayload);

    // Decrement worker capacity when task is closed
    if (body.status === 'Resolved' || body.status === 'Rejected') {
      const workerRef = firestore.collection('users').doc(worker.uid);
      await workerRef.update({ activeTasks: FieldValue.increment(-1) }).catch(() => {});
    }

    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    return handleNotFound(error) || handleApiError(error);
  }
}
