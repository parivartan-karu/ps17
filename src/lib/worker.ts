import type { ActionLogEntry, Report, ReportStatus, User } from '@/lib/types';
import { normalizeDepartmentId } from './departments';
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

export function isAssignedToWorker(report: Report, workerId: string, workerName: string, employeeId?: string) {
  if (!workerId && !workerName && !employeeId) return false;
  return (
    report.assignedWorkerId === workerId ||
    (!!workerName && report.assignedContractor === workerName) ||
    (!!employeeId && report.assignedWorkerId === employeeId)
  );
}

export function isOpenLowPriorityTask(report: Report, workerDepartmentId?: string) {
  const priority = report.priority || 'Medium';
  const difficulty = report.difficulty || 'Moderate';
  const reportDept = normalizeDepartmentId(report.departmentId || report.department);
  const workerDept = normalizeDepartmentId(workerDepartmentId);
  const deptMatches = !workerDept || !reportDept || workerDept === reportDept || workerDept === 'dept_public_works' || reportDept === 'dept_public_works';
  return (
    deptMatches &&
    (priority === 'Low' || priority === 'Medium') &&
    difficulty !== 'Hard' &&
    !report.assignedWorkerId &&
    !report.assignedContractor &&
    (report.status === 'Submitted' || report.status === 'Assigned' || report.status === 'Under Verification')
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
