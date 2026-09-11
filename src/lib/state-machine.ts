/**
 * Authoritative Complaint State Machine for Parivartan
 * Enforces valid report status transitions and protects terminal states server-side.
 */

import type { DepartmentTask } from './complaint-context';
import type { ReportStatus } from './types';

export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  'Submitted': ['Under Verification', 'Assigned', 'Rejected'],
  'Under Verification': ['Assigned', 'In Progress', 'Resolved', 'Rejected'],
  'Assigned': ['In Progress', 'Under Verification', 'Rejected'],
  'In Progress': ['Under Verification', 'Resolved', 'Assigned', 'Rejected'],
  'Resolved': [], // Terminal state! Cannot be modified or reopened.
  'Rejected': [], // Terminal state! Cannot be modified or reopened.
};

export type TransitionValidationResult = {
  valid: boolean;
  reason?: string;
  isTerminal?: boolean;
};

/**
 * Validates a proposed status transition for a report.
 * Supports dependency-aware resolution gating when departmentTasks are present.
 */
export function validateStatusTransition(
  currentStatus: ReportStatus | string | undefined | null,
  targetStatus: ReportStatus | string,
  departmentTasks?: DepartmentTask[]
): TransitionValidationResult {
  const current = (currentStatus || 'Submitted') as ReportStatus;
  const target = targetStatus as ReportStatus;

  // No-op transition (status unchanged)
  if (current === target) {
    return { valid: true };
  }

  // Protection for terminal states: Resolved or Rejected cannot be reopened or changed
  if (current === 'Resolved' || current === 'Rejected') {
    return {
      valid: false,
      isTerminal: true,
      reason: `Terminal status "${current}" cannot be modified or reopened.`,
    };
  }

  const allowedNextStates = ALLOWED_STATUS_TRANSITIONS[current] || [];
  if (!allowedNextStates.includes(target)) {
    return {
      valid: false,
      isTerminal: false,
      reason: `Invalid status transition from "${current}" to "${target}". Allowed transitions: ${
        allowedNextStates.length > 0 ? allowedNextStates.join(', ') : 'None (Terminal)'
      }.`,
    };
  }

  // Dependency-aware resolution gating: Cannot resolve if department tasks remain uncompleted
  if (target === 'Resolved' && departmentTasks && departmentTasks.length > 0) {
    const uncompleted = departmentTasks.filter((t) => t.status !== 'Completed');
    if (uncompleted.length > 0) {
      const names = uncompleted.map((t) => `"${t.taskName}" (${t.departmentName})`).join(', ');
      return {
        valid: false,
        isTerminal: false,
        reason: `Cannot resolve incident while multi-department sub-tasks remain uncompleted: ${names}.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Helper assertion that throws an Error if status transition is invalid.
 */
export function assertValidStatusTransition(
  currentStatus: ReportStatus | string | undefined | null,
  targetStatus: ReportStatus | string,
  departmentTasks?: DepartmentTask[]
): void {
  const result = validateStatusTransition(currentStatus, targetStatus, departmentTasks);
  if (!result.valid) {
    throw new Error(result.reason || 'Invalid status transition.');
  }
}
