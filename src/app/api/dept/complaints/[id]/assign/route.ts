import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRequestIdentity(request, ['department_head', 'official', 'admin']);
    const { id: reportId } = await context.params;
    const { workerId, workerName } = await request.json() as { workerId: string; workerName: string };

    if (!reportId || !workerId || !workerName) {
      return NextResponse.json({ error: 'reportId, workerId, workerName required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();

    await firestore.runTransaction(async (tx: any) => {
      const reportRef = firestore.collection('reports').doc(reportId);
      const workerRef = firestore.collection('users').doc(workerId);

      const [reportDoc, workerDoc] = await Promise.all([tx.get(reportRef), tx.get(workerRef)]);
      if (!reportDoc.exists) throw new Error('Report not found.');
      if (!workerDoc.exists) throw new Error('Worker not found.');

      const workerData = workerDoc.data()!;
      const active = workerData.activeTasks ?? 0;
      const max = workerData.maxTaskCapacity ?? 5;
      if (active >= max) throw new Error(`${workerName} is already at capacity (${active}/${max} tasks).`);

      const logEntry = {
        status: 'Assigned',
        timestamp: new Date().toISOString(),
        actor: 'Official',
        actorName: identity.profile.name ?? 'Dept Head',
        notes: `Assigned to ${workerName} by department.`,
      };

      tx.update(reportRef, {
        status: 'Assigned',
        assignedWorkerId: workerId,
        assignedContractor: workerName,
        assignedBy: identity.uid,
        assignmentMethod: 'admin_assign',
        actionLog: FieldValue.arrayUnion(logEntry),
      });

      tx.update(workerRef, { activeTasks: FieldValue.increment(1) });
    });

    // Push to citizen (fire-and-forget)
    ;(async () => {
      try {
        const reportDoc = await firestore.collection('reports').doc(reportId).get();
        const userId = reportDoc.data()?.userId;
        if (!userId) return;
        const userDoc = await firestore.collection('users').doc(userId).get();
        const tokens: string[] = userDoc.data()?.fcmTokens ?? [];
        if (!tokens.length) return;
        const { getMessaging } = await import('firebase-admin/messaging');
        const admin = await getFirebaseAdmin();
        await getMessaging(admin.app).sendEachForMulticast({
          tokens,
          notification: { title: '👷 Worker Assigned', body: `${workerName} has been assigned to your complaint.` },
          webpush: {
            notification: { icon: '/icons/icon-192x192.png', tag: `complaint-${reportId}` },
            fcmOptions: { link: `/citizen/complaint/${reportId}` },
          },
          data: { url: `/citizen/complaint/${reportId}`, tag: `complaint-${reportId}` },
        }).catch(() => {});
      } catch {}
    })();

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Assignment failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
