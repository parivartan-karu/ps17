/**
 * Shared ComplaintContext Module for Parivartan
 * Unified evolving case context object maintained across multi-agent triage and workflow transitions.
 */

import type { Report, AIAnalysis, ActionLogEntry, TaskDifficulty } from './types';
import type { PriorityLevel } from './sla';

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
  const riskScore = report.autoAssignmentScore ?? (prio === 'Critical' ? 90 : prio === 'High' ? 75 : prio === 'Medium' ? 50 : 25);
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
      reasons: report.riskScoreReasons?.length ? report.riskScoreReasons : [
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
