import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

import { getFirebaseAdmin } from '@/firebase/server';
import { createActionLog, isAssignedToWorker, isOpenLowPriorityTask, nowTimestamp, summarizePerformance, toSerializable } from '@/lib/worker-api';
import type { Report } from '@/lib/types';
import { requireWorkerIdentity } from '@/lib/worker-api-server';

export const runtime = 'nodejs';

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function handleApiError(error: unknown) {
  if (error instanceof ZodError) {
    return jsonError(error.issues[0]?.message || 'Invalid request body', 400);
  }
  if (error instanceof Error && error.message === 'UNAUTHORIZED') {
    return jsonError('Authentication required', 401);
  }
  if (error instanceof Error && error.message === 'FORBIDDEN') {
    return jsonError('Worker access required', 403);
  }

  console.error(error);
  return jsonError('Internal server error', 500);
}

export async function getWorkerReports(request: NextRequest) {
  const worker = await requireWorkerIdentity(request);
  const { firestore } = await getFirebaseAdmin();
  const snapshot = await firestore.collection('reports').get();
  const reports = snapshot.docs.map((doc: QueryDocumentSnapshot): Report => ({ ...(doc.data() as Report), id: doc.id }));

  const assignedReports = reports.filter((report: Report) => isAssignedToWorker(report, worker.uid, worker.name));
  const openLowPriority = reports.filter((report: Report) => isOpenLowPriorityTask(report));

  return {
    worker,
    firestore,
    reports,
    assignedReports,
    openLowPriority,
  };
}

export async function getWorkerReport(request: NextRequest, reportId: string) {
  const worker = await requireWorkerIdentity(request);
  const { firestore } = await getFirebaseAdmin();
  const reportRef = firestore.collection('reports').doc(reportId);
  const reportDoc = await reportRef.get();

  if (!reportDoc.exists) {
    throw new Error('NOT_FOUND');
  }

  const report = { ...(reportDoc.data() as Report), id: reportDoc.id };

  return {
    worker,
    firestore,
    reportRef,
    report,
    isAssigned: isAssignedToWorker(report, worker.uid, worker.name),
    isOpenLowPriority: isOpenLowPriorityTask(report),
  };
}

export function handleNotFound(error: unknown) {
  if (error instanceof Error && error.message === 'NOT_FOUND') {
    return jsonError('Task not found', 404);
  }
  return null;
}

export function serializableReport(report: Report) {
  return toSerializable(report);
}

export function serializableReports(reports: Report[]) {
  return toSerializable(reports);
}

export function workerSummary(reports: Report[]) {
  return summarizePerformance(reports);
}

export function workerLog(status: Report['status'], actorName: string, notes: string) {
  return createActionLog(status, actorName, notes);
}

export function timestampNow() {
  return nowTimestamp();
}
