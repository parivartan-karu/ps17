import { FieldValue, type Transaction, type DocumentReference } from 'firebase-admin/firestore';
import type { Report, ReportStatus } from './types';
import { validateStatusTransition } from './state-machine';

export type TransitionActor = {
  uid: string;
  role: string;
  name: string;
};

export type TransitionOptions = {
  notes?: string;
  extraUpdates?: Record<string, unknown>;
  departmentTasks?: Report['departmentTasks'];
};

/**
 * Single server-side entry point for complaint status changes.
 * Callers may add domain-specific fields, but status validation, audit logging,
 * and timestamping are always performed here.
 */
export function applyReportStatusTransition(
  tx: Transaction,
  reportRef: DocumentReference,
  reportData: Report,
  targetStatus: ReportStatus,
  actor: TransitionActor,
  options: TransitionOptions = {},
) {
  const validation = validateStatusTransition(
    reportData.status,
    targetStatus,
    options.departmentTasks ?? reportData.departmentTasks ?? [],
  );

  if (!validation.valid) {
    throw new Error(validation.reason || 'Invalid status transition.');
  }

  const timestamp = new Date().toISOString();
  const actionLog = {
    status: targetStatus,
    timestamp,
    actor: actor.role,
    actorName: actor.name,
    notes: options.notes || `Status changed from ${reportData.status} to ${targetStatus}.`,
  };

  tx.update(reportRef, {
    ...options.extraUpdates,
    status: targetStatus,
    updatedAt: timestamp,
    actionLog: FieldValue.arrayUnion(actionLog),
  });

  return { previousStatus: reportData.status, targetStatus, timestamp, actionLog };
}
