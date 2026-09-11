import { NextRequest, NextResponse } from 'next/server';

import { getWorkerReports, handleApiError, workerSummary } from '@/app/api/worker/_utils';
import type { Report } from '@/lib/types';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const { assignedReports, openLowPriority, worker } = await getWorkerReports(request);
    const summary = workerSummary(assignedReports);

    const now = new Date();
    const last30 = new Date(now);
    last30.setDate(now.getDate() - 29);

    const presentDaysSet = new Set<string>();
    assignedReports.forEach((report: Report) => {
      const relevantLogs = report.actionLog?.filter(
        (entry) =>
          entry.actor === 'Worker' &&
          entry.actorName === worker.name &&
          new Date(entry.timestamp) >= last30
      ) || [];

      relevantLogs.forEach((entry) => {
        presentDaysSet.add(new Date(entry.timestamp).toISOString().slice(0, 10));
      });
    });

    const presentDays = presentDaysSet.size;
    const holidaysTaken = Math.max(0, 30 - presentDays);

    return NextResponse.json({
      assignedActive: assignedReports.filter((report: Report) => report.status === 'Assigned' || report.status === 'In Progress').length,
      openLowPriority: openLowPriority.length,
      pendingBeforeUpload: assignedReports.filter((report: Report) => report.status === 'Assigned' && !report.beforeWorkMediaUrl).length,
      completedTasks: assignedReports.filter((report: Report) => report.status === 'Resolved').length,
      presentDays,
      holidaysTaken,
      ...summary,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
