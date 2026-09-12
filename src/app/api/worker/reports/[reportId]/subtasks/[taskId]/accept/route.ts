import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireWorkerIdentity } from '@/lib/worker-api-server';
import { normalizeDepartmentId } from '@/lib/departments';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ reportId: string; taskId: string }> }) {
  try {
    const worker = await requireWorkerIdentity(request);
    const { reportId, taskId } = await params;
    const { firestore } = await getFirebaseAdmin();
    const ref = firestore.collection('reports').doc(reportId);
    await firestore.runTransaction(async (tx: any) => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('NOT_FOUND');
      const data = doc.data();
      const workerDept = normalizeDepartmentId(worker.profile?.departmentId || worker.profile?.department);
      const tasks = Array.isArray(data.departmentTasks) ? data.departmentTasks : [];
      const task = tasks.find((t: any) => t.id === taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      const taskDept = normalizeDepartmentId(task.departmentId || task.departmentName);
      if (workerDept && taskDept && workerDept !== taskDept) throw new Error('FORBIDDEN');
      if (task.status !== 'Pending' || task.assignedWorkerId) throw new Error('TASK_UNAVAILABLE');
      const updated = tasks.map((t: any) => t.id === taskId ? { ...t, assignedWorkerId: worker.uid, assignedWorkerName: worker.name, status: 'In Progress' } : t);
      tx.update(ref, { departmentTasks: updated, actionLog: FieldValue.arrayUnion({ status: data.status, timestamp: new Date().toISOString(), actor: 'Worker', actorName: worker.name, notes: `Sub-task ${task.taskName} accepted.` }) });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to accept sub-task.';
    const status = message === 'FORBIDDEN' ? 403 : message === 'TASK_UNAVAILABLE' ? 409 : message === 'NOT_FOUND' || message === 'TASK_NOT_FOUND' ? 404 : 500;
    return NextResponse.json({ error: message === 'TASK_UNAVAILABLE' ? 'Sub-task is no longer available.' : message }, { status });
  }
}
