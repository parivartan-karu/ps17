import type { ActionLogEntry, Report, ReportStatus, User } from '@/lib/types';
import type { User as FirebaseUser } from 'firebase/auth';

export const workerActiveStatuses: ReportStatus[] = ['Assigned', 'In Progress'];
export const workerCompletedStatuses: ReportStatus[] = ['Resolved', 'Rejected'];

export const workerStatusColors: Record<string, string> = {
  Submitted: 'bg-slate-500',
  'Under Verification': 'bg-yellow-500',
  Assigned: 'bg-orange-500',
  'In Progress': 'bg-amber-500',
  Resolved: 'bg-green-500',
  Rejected: 'bg-red-500',
};

export function getWorkerName(user: FirebaseUser | null, profile: User | null | undefined) {
  return profile?.name?.trim() || user?.displayName?.trim() || user?.email?.split('@')[0] || 'Field Worker';
}

export function isAssignedToWorker(report: Report, workerId: string, workerName: string) {
  if (!workerId && !workerName) return false;
  return report.assignedWorkerId === workerId || (!!workerName && report.assignedContractor === workerName);
}

export function isOpenLowPriorityTask(report: Report) {
  const priority = report.priority || 'Medium';
  return (
    (priority === 'Low' || priority === 'Medium') &&
    !report.assignedWorkerId &&
    !report.assignedContractor &&
    (report.status === 'Submitted' || report.status === 'Assigned')
  );
}

export function buildWorkerLogEntry(
  status: ReportStatus,
  actorName: string,
  notes: string
): ActionLogEntry {
  return {
    status,
    timestamp: new Date().toISOString(),
    actor: 'Worker',
    actorName,
    notes,
  };
}

export function getResolutionDate(report: Report) {
  const resolutionLog = report.actionLog?.find((log) => log.status === 'Resolved' || log.status === 'Rejected');
  const dateValue = report.completedAt || resolutionLog?.timestamp;
  return dateValue ? new Date(dateValue).toLocaleDateString() : 'N/A';
}

export function getCompletionLabel(report: Report) {
  return report.status === 'Resolved' ? 'Completed' : 'Rejected';
}
