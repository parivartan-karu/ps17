/**
 * Authoritative Complaint State Machine for Parivartan
 * Enforces valid report status transitions and protects terminal states server-side.
 */

import type { ReportStatus } from './types';

export const ALLOWED_STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  'Submitted': ['Under Verification', 'Assigned', 'Rejected'],
  'Under Verification': ['Assigned', 'In Progress', 'Rejected'],
  'Assigned': ['In Progress', 'Under Verification', 'Rejected'],
  'In Progress': ['Resolved', 'Assigned', 'Rejected'],
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
 * Returns valid: false with descriptive reason if invalid or terminal state violation.
 */
export function validateStatusTransition(
  currentStatus: ReportStatus | string | undefined | null,
  targetStatus: ReportStatus | string
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

  return { valid: true };
}

/**
 * Helper assertion that throws an Error if status transition is invalid.
 */
export function assertValidStatusTransition(
  currentStatus: ReportStatus | string | undefined | null,
  targetStatus: ReportStatus | string
): void {
  const result = validateStatusTransition(currentStatus, targetStatus);
  if (!result.valid) {
    throw new Error(result.reason || 'Invalid status transition.');
  }
}
