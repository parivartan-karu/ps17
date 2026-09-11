import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';

import type { Report, ReportStatus, User } from '@/lib/types';

export const workerMediaTypeSchema = z.enum(['image', 'video']);
export const workerStatusUpdateSchema = z.object({
  status: z.enum(['Assigned', 'In Progress', 'Resolved', 'Rejected']),
  remarks: z.string().trim().max(500).optional(),
});

export const workerUploadSchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: workerMediaTypeSchema,
  notes: z.string().trim().max(500).optional(),
});

export const workerProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  employeeId: z.string().trim().min(2).max(60).optional(),
  department: z.string().trim().min(2).max(120).optional(),
});

export function isAssignedToWorker(report: Report, workerId: string, workerName: string) {
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

export function createActionLog(status: ReportStatus, actorName: string, notes: string) {
  return {
    status,
    timestamp: new Date().toISOString(),
    actor: 'Worker' as const,
    actorName,
    notes,
  };
}

export function toSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_, currentValue) => {
      if (currentValue instanceof Timestamp) {
        return currentValue.toDate().toISOString();
      }
      return currentValue;
    })
  );
}

export type WorkerIdentity = {
  uid: string;
  email: string;
  name: string;
  profile: User | null;
};

export function summarizePerformance(reports: Report[]) {
  const resolved = reports.filter((report) => report.status === 'Resolved');
  const closed = reports.filter((report) => report.status === 'Resolved' || report.status === 'Rejected');
  const selfAssigned = reports.filter((report) => report.selfAssigned);

  const averageResolutionHours =
    resolved.length > 0
      ? Number(
          (
            resolved.reduce((total, report) => {
              const completedAt = report.completedAt || report.actionLog?.find((entry) => entry.status === 'Resolved')?.timestamp;
              if (!completedAt) return total;
              return total + (new Date(completedAt).getTime() - new Date(report.timestamp).getTime()) / (1000 * 60 * 60);
            }, 0) / resolved.length
          ).toFixed(1)
        )
      : 0;

  return {
    totalAssigned: reports.length,
    resolved: resolved.length,
    closed: closed.length,
    selfAssigned: selfAssigned.length,
    completionRate: reports.length ? Math.round((closed.length / reports.length) * 100) : 0,
    averageResolutionHours,
  };
}

export function nowTimestamp() {
  return new Date().toISOString();
}

export const SESSION_COOKIE_NAME = 'worker_session';

export const sessionRequestSchema = z.object({
  idToken: z.string().min(1),
});

export function cookieOptions(expiresInMs: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: Math.floor(expiresInMs / 1000),
  };
}
