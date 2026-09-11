import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport, timestampNow, workerLog } from '@/app/api/worker/_utils';
import { workerUploadSchema } from '@/lib/worker-api';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { reportRef, report, worker, isAssigned } = await getWorkerReport(request, id);
    if (!isAssigned) {
      return NextResponse.json({ error: 'Only the assigned worker can upload after-work proof.' }, { status: 403 });
    }

    const body = workerUploadSchema.parse(await request.json());

    await reportRef.update({
      afterWorkMediaUrl: body.mediaUrl,
      afterWorkMediaType: body.mediaType,
      afterWorkUploadedAt: timestampNow(),
      afterWorkNotes: body.notes || null,
      afterImageUrl: body.mediaType === 'image' ? body.mediaUrl : report.afterImageUrl || null,
      actionLog: FieldValue.arrayUnion(
        workerLog(report.status === 'Assigned' ? 'In Progress' : report.status, worker.name, `Uploaded after-work ${body.mediaType}.${body.notes ? ` ${body.notes}` : ''}`)
      ),
    });

    const updated = await reportRef.get();
    return NextResponse.json({ task: serializableReport({ ...(updated.data() as typeof report), id: updated.id }) });
  } catch (error) {
    return handleNotFound(error) || handleApiError(error);
  }
}
