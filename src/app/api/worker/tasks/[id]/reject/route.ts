import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, workerLog } from '@/app/api/worker/_utils';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reportRef, report, worker, isAssigned } = await getWorkerReport(request, id);

    if (!isAssigned) {
      return NextResponse.json({ error: 'Only the assigned worker can reject this task.' }, { status: 403 });
    }

    await reportRef.update({
      assignedWorkerId: null,
      assignedContractor: null,
      workerAssignmentStatus: 'Rejected',
      selfAssigned: false,
      status: 'Submitted',
      workflowStage: 'pending_department',
      actionLog: FieldValue.arrayUnion(workerLog('Submitted', worker.name, 'Task rejected by worker and returned for reassignment.')),
    });

    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    return handleNotFound(error) || handleApiError(error);
  }
}
