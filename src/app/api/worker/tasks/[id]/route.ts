import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReport, handleApiError, handleNotFound, serializableReport } from '@/app/api/worker/_utils';

export const runtime = 'nodejs';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { report, isAssigned, isOpenLowPriority } = await getWorkerReport(request, id);
    return NextResponse.json({ task: serializableReport(report), isAssigned, isOpenLowPriority });
  } catch (error) {
    return handleNotFound(error) || handleApiError(error);
  }
}
