import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReports, handleApiError, serializableReports } from '@/app/api/worker/_utils';
import type { Report } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { assignedReports } = await getWorkerReports(request);
    const tasks = assignedReports
      .filter((report: Report) => report.status === 'Assigned' || report.status === 'In Progress')
      .sort((a: Report, b: Report) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ tasks: serializableReports(tasks) });
  } catch (error) {
    return handleApiError(error);
  }
}
