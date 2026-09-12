import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireWorkerIdentity } from '@/lib/worker-api-server';
import { normalizeDepartmentId } from '@/lib/departments';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const worker = await requireWorkerIdentity(request);
    const { firestore } = await getFirebaseAdmin();
    const snap = await firestore.collection('reports').get();
    const workerDept = normalizeDepartmentId(worker.profile?.departmentId || worker.profile?.department);
    const tasks: any[] = [];
    snap.docs.forEach((doc) => {
      const report = doc.data();
      for (const task of report.departmentTasks || []) {
        const taskDept = normalizeDepartmentId(task.departmentId || task.departmentName);
        if (task.status !== 'Pending' || task.assignedWorkerId || (workerDept && taskDept && workerDept !== taskDept)) continue;
        if (report.status === 'Resolved' || report.status === 'Rejected') continue;
        tasks.push({ ...task, reportId: doc.id, reportCategory: report.category, reportDescription: report.description, reportPriority: report.priority, reportDifficulty: task.difficulty || report.difficulty });
      }
    });
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to load subtasks.' }, { status: 500 });
  }
}
