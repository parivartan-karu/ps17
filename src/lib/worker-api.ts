/**
 * Shared ComplaintContext Module for Parivartan
 * Unified evolving case context object maintained across multi-agent triage and workflow transitions.
 */

import { Timestamp } from 'firebase-admin/firestore';
import type { Report, ActionLogEntry, ReportStatus, TaskDifficulty, User } from './types';
import type { PriorityLevel } from './sla';
import { z } from 'zod';
import { normalizeDepartmentId } from './departments';

// Worker session contract. Keep these exports in the shared module because both
// the route handler and the server-side session helpers depend on them.
export const SESSION_COOKIE_NAME = 'parivartan_worker_session';

export function cookieOptions(expiresInMs: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.max(0, Math.floor(expiresInMs / 1000)),
  };
}

export const sessionRequestSchema = z.object({
  idToken: z.string().min(1, 'idToken is required'),
});

export type WorkerIdentity = {
  uid: string;
  email: string;
  name: string;
  profile: Partial<User> | null;
};

export const workerMediaTypeSchema = z.enum(['image', 'video']);

export const workerStatusUpdateSchema = z.object({
  status: z.enum(['Assigned', 'In Progress', 'Under Verification', 'Rejected', 'Resolved']),
  remarks: z.string().trim().max(500).optional(),
});

export const workerUploadSchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: workerMediaTypeSchema,
  notes: z.string().trim().max(500).optional(),
});

export const workerProfileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
});

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
  const reportDept = normalizeDepartmentId(report.departmentId || report.department);
  const workerDept = normalizeDepartmentId(workerDepartmentId);
  const deptMatches = !workerDept || !reportDept || workerDept === reportDept || workerDept === 'dept_public_works' || reportDept === 'dept_public_works';

  return (
    deptMatches &&
    (priority === 'Low' || priority === 'Medium') &&
    !report.assignedWorkerId &&
    !report.assignedContractor &&
    (report.status === 'Submitted' || report.status === 'Assigned' || report.status === 'Under Verification') &&
    report.difficulty !== 'Hard'
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

export type DepartmentTaskStatus = 'Pending' | 'In Progress' | 'Completed' | 'Blocked';

export type DepartmentTask = {
  id: string;
  departmentId: string;
  departmentName: string;
  taskName: string;
  assignedWorkerId?: string;
  assignedWorkerName?: string;
  status: DepartmentTaskStatus;
  difficulty?: TaskDifficulty;
  priority?: Report['priority'];
  slaDeadline?: string;
  dependencyTaskId?: string; // ID of task that must complete first
  completedAt?: string;
  notes?: string;
};

export type ComplaintContext = {
  complaint: {
    id: string;
    userId: string;
    userName: string;
    location: string;
    latitude?: number;
    longitude?: number;
    description: string;
    imageUrl: string;
    timestamp: string;
  };
  classification: {
    category: string;
    damageDetected: boolean;
    damageCategory?: string;
    severity?: 'Low' | 'Medium' | 'High';
    confidence: number;
    modelUsed?: string;
  };
  routing: {
    primaryDepartmentId: string;
    primaryDepartmentName: string;
    supportingDepartments?: Array<{ departmentId: string; departmentName: string; role: string }>;
    confidence: number;
    reason: string;
    routingGate: 'automatic' | 'department_verification' | 'manual_review';
  };
  priority: {
    level: PriorityLevel;
    riskScore: number; // 0 - 100 numerical score
    reasons: string[];
    slaResponseDeadline: string;
    slaResolutionDeadline: string;
  };
  dedup: {
    isDuplicate: boolean;
    masterIncidentId?: string;
    similarityScore?: number;
    relatedReportCount: number;
  };
  departmentTasks: DepartmentTask[];
  verification: {
    status: 'Pending' | 'Pass' | 'Fail' | 'Rework';
    score?: number; // 0 - 100
    beforeWorkMediaUrl?: string;
    afterWorkMediaUrl?: string;
    officerNotes?: string;
  };
  sla: {
    responseBreached: boolean;
    resolutionBreached: boolean;
    escalationLevel: number;
    escalatedTo?: string;
  };
  auditLog: ActionLogEntry[];
};

/**
 * Factory function to construct a fresh ComplaintContext from a Report doc.
 */
export function buildComplaintContext(report: Report): ComplaintContext {
  const prio = (report.priority as PriorityLevel) || 'Medium';
  const riskScore = report.riskScore ?? report.autoAssignmentScore ?? (prio === 'Critical' ? 90 : prio === 'High' ? 75 : prio === 'Medium' ? 50 : 25);
  const confidence = report.routingConfidence ?? 0.9;
  const routingGate = confidence >= 0.85 ? 'automatic' : confidence >= 0.65 ? 'department_verification' : 'manual_review';

  return {
    complaint: {
      id: report.id,
      userId: report.userId,
      userName: report.userName,
      location: report.location,
      latitude: report.latitude,
      longitude: report.longitude,
      description: report.description,
      imageUrl: report.imageUrl,
      timestamp: report.timestamp,
    },
    classification: {
      category: report.category || 'General',
      damageDetected: !!report.aiAnalysis?.damageDetected,
      damageCategory: report.aiAnalysis?.damageCategory,
      severity: report.aiAnalysis?.severity,
      confidence: 0.92,
      modelUsed: 'gemini-vision',
    },
    routing: {
      primaryDepartmentId: report.departmentId || 'dept_engineering',
      primaryDepartmentName: report.department || 'Roads Department',
      confidence,
      reason: report.routingReason || 'Routed based on issue taxonomy matching.',
      routingGate,
    },
    priority: {
      level: prio,
      riskScore,
      reasons: [
        `Assigned ${prio} priority based on issue risk score (${riskScore}/100).`,
        report.slaBreached ? 'SLA deadline exceeded' : 'Standard SLA deadline active',
      ],
      slaResponseDeadline: report.slaResponseDeadline || report.timestamp,
      slaResolutionDeadline: report.slaDeadline || report.timestamp,
    },
    dedup: {
      isDuplicate: !!report.linkedIncidentId,
      masterIncidentId: report.linkedIncidentId || undefined,
      similarityScore: report.linkedSimilarityScore || undefined,
      relatedReportCount: report.relatedReportCount ?? 1,
    },
    departmentTasks: (report as any).departmentTasks || [],
    verification: {
      status: report.status === 'Resolved' ? 'Pass' : report.status === 'Under Verification' ? 'Pending' : 'Pending',
      beforeWorkMediaUrl: report.imageUrl,
      afterWorkMediaUrl: report.afterWorkMediaUrl,
      officerNotes: report.afterWorkNotes,
    },
    sla: {
      responseBreached: !!report.responseSlaBreached,
      resolutionBreached: !!report.slaBreached,
      escalationLevel: report.escalationLevel ?? 0,
      escalatedTo: report.escalatedTo,
    },
    auditLog: report.actionLog || [],
  };
}
