import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, timestampNow, workerLog } from '@/app/api/worker/_utils';
import { getFirebaseAdmin } from '@/firebase/server';
import { workerStatusUpdateSchema } from '@/lib/worker-api';
import type { ReportStatus } from '@/lib/types';
import { validateStatusTransition } from '@/lib/state-machine';

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
    const transition = validateStatusTransition(currentStatus, body.status);
    if (!transition.valid) {
      return NextResponse.json(
        { error: transition.reason || `Invalid status transition from ${currentStatus} to ${body.status}.` },
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

    // Requirement 11: Require after-work evidence before resolution
    if (body.status === 'Resolved') {
      if (!report.afterWorkMediaUrl && !report.afterImageUrl) {
        return NextResponse.json({ error: 'After-work photo evidence is required before resolving a complaint.' }, { status: 400 });
      }
      updatePayload.completedAt = timestampNow();
      updatePayload.queueStatus = 'completed';
    }

    if (body.status === 'Rejected') {
      updatePayload.assignedWorkerId = null;
      updatePayload.assignedContractor = null;
      updatePayload.selfAssigned = false;
      updatePayload.queueStatus = 'pending_department';
    }

    const { firestore } = await getFirebaseAdmin();
    await reportRef.update(updatePayload);

    // Requirement 7: Keep worker activeTasks consistent and avoid double decrement
    const wasClosed = currentStatus === 'Resolved' || currentStatus === 'Rejected';
    const isNowClosed = body.status === 'Resolved' || body.status === 'Rejected';

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

    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    return handleNotFound(error) || handleApiError(error);
  }
}
