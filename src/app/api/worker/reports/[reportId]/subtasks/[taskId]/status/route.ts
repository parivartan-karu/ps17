import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireWorkerIdentity } from '@/lib/worker-api-server';

export const runtime = 'nodejs';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ reportId: string; taskId: string }> }) {
  try {
    const worker = await requireWorkerIdentity(request);
    const { reportId, taskId } = await params;
    const body = await request.json();
    const target = body.status as string;
    if (!['In Progress', 'Completed'].includes(target)) return NextResponse.json({ error: 'Status must be In Progress or Completed.' }, { status: 400 });
    const { firestore } = await getFirebaseAdmin();
    const ref = firestore.collection('reports').doc(reportId);
    await firestore.runTransaction(async (tx: any) => {
      const doc = await tx.get(ref); if (!doc.exists) throw new Error('NOT_FOUND');
      const data = doc.data(); const tasks = Array.isArray(data.departmentTasks) ? data.departmentTasks : [];
      const task = tasks.find((t: any) => t.id === taskId);
      if (!task) throw new Error('TASK_NOT_FOUND');
      if (task.assignedWorkerId !== worker.uid) throw new Error('FORBIDDEN');
      if (target === 'Completed' && task.status !== 'In Progress') throw new Error('INVALID');
      const updated = tasks.map((t: any) => t.id === taskId ? { ...t, status: target, completedAt: target === 'Completed' ? new Date().toISOString() : t.completedAt } : t);
      const completed = new Set(updated.filter((t: any) => t.status === 'Completed').map((t: any) => t.id));
      const released = updated.map((t: any) => t.status === 'Blocked' && t.dependencyTaskId && completed.has(t.dependencyTaskId) ? { ...t, status: 'Pending' } : t);
      tx.update(ref, { departmentTasks: released, actionLog: FieldValue.arrayUnion({ status: data.status, timestamp: new Date().toISOString(), actor: 'Worker', actorName: worker.name, notes: `Sub-task ${task.taskName} moved to ${target}.` }) });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update sub-task.';
    const status = message === 'FORBIDDEN' ? 403 : message === 'NOT_FOUND' || message === 'TASK_NOT_FOUND' ? 404 : message === 'INVALID' ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
