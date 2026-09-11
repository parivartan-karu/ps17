import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, requireDepartmentAccess, RequestAuthError } from '@/lib/server-auth';
import { validateStatusTransition } from '@/lib/state-machine';
import type { Report } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Authoritative Department Verification API Endpoint (Phase 6)
 * Actions:
 * - 'approve': Approves worker completion (Requires after-work evidence). Moves to 'Resolved'.
 * - 'rework': Returns complaint to worker with rework instructions. Moves back to 'In Progress'.
 * - 'reject': Rejects complaint resolution. Moves to 'Rejected'.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRequestIdentity(request, ['department_head', 'official', 'admin']);
    const params = await context.params;
    const reportId = params.id?.trim();

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const { action, notes } = body as { action: 'approve' | 'rework' | 'reject'; notes?: string };

    if (!action || !['approve', 'rework', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Valid action (approve | rework | reject) is required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();
    let assignedWorkerId: string | undefined;
    let reportUserId: string | undefined;
    let updatedStatus = 'Resolved';

    await firestore.runTransaction(async (tx: any) => {
      const reportRef = firestore.collection('reports').doc(reportId);
      const reportDoc = await tx.get(reportRef);

      if (!reportDoc.exists) {
        throw new Error('Report not found.');
      }

      const reportData = reportDoc.data() as Report;
      requireDepartmentAccess(reportData, identity);
      assignedWorkerId = reportData.assignedWorkerId;
      reportUserId = reportData.userId;

      const timestampIso = new Date().toISOString();

      if (action === 'approve') {
        // Require after-work evidence photo (Requirement 3)
        if (!reportData.afterWorkMediaUrl && !reportData.imageUrl) {
          throw new Error('Verification failed: After-work photo evidence is required before approving resolution.');
        }

        const transition = validateStatusTransition(reportData.status, 'Resolved');
        if (!transition.valid) throw new Error(transition.reason);

        updatedStatus = 'Resolved';

        tx.update(reportRef, {
          status: 'Resolved',
          workflowStage: 'completed',
          queueStatus: 'completed',
          actionLog: FieldValue.arrayUnion({
            status: 'Resolved',
            timestamp: timestampIso,
            actor: 'Official',
            actorName: identity.profile?.name || 'Department Officer',
            notes: notes || 'Resolution verified and approved by department officer.',
          }),
        });

        // Reward citizen (+10 points)
        const userRef = firestore.collection('users').doc(reportData.userId);
        tx.update(userRef, { points: FieldValue.increment(10) });

        // Decrement assigned worker activeTasks on task completion
        if (assignedWorkerId) {
          const workerRef = firestore.collection('users').doc(assignedWorkerId);
          const workerDoc = await tx.get(workerRef);
          if (workerDoc.exists) {
            const currentActive = workerDoc.data().activeTasks ?? 1;
            tx.update(workerRef, { activeTasks: Math.max(0, currentActive - 1) });
          }
        }

        // Batch resolve linked duplicate reports
        const linkedSnap = await firestore.collection('reports').where('linkedIncidentId', '==', reportId).get();
        linkedSnap.docs.forEach((docSnap: any) => {
          if (docSnap.data().status !== 'Resolved' && docSnap.data().status !== 'Rejected') {
            tx.update(firestore.collection('reports').doc(docSnap.id), {
              status: 'Resolved',
              workflowStage: 'completed',
              queueStatus: 'completed',
              actionLog: FieldValue.arrayUnion({
                status: 'Resolved',
                timestamp: timestampIso,
                actor: 'Official',
                actorName: identity.profile?.name || 'Department Officer',
                notes: `Master incident #${reportId.slice(0, 8)} approved and resolved by department.`,
              }),
            });
            tx.update(firestore.collection('users').doc(docSnap.data().userId), { points: FieldValue.increment(10) });
          }
        });
      } else if (action === 'rework') {
        if (!notes?.trim()) {
          throw new Error('Verification notes/instructions are required when requesting rework.');
        }

        const transition = validateStatusTransition(reportData.status, 'In Progress');
        if (!transition.valid) throw new Error(transition.reason);

        updatedStatus = 'In Progress';

        tx.update(reportRef, {
          status: 'In Progress',
          workflowStage: 'in_progress',
          queueStatus: 'in_progress',
          actionLog: FieldValue.arrayUnion({
            status: 'In Progress',
            timestamp: timestampIso,
            actor: 'Official',
            actorName: identity.profile?.name || 'Department Officer',
            notes: `Rework Requested: ${notes}`,
          }),
        });
      } else if (action === 'reject') {
        const transition = validateStatusTransition(reportData.status, 'Rejected');
        if (!transition.valid) throw new Error(transition.reason);

        updatedStatus = 'Rejected';

        tx.update(reportRef, {
          status: 'Rejected',
          workflowStage: 'completed',
          queueStatus: 'completed',
          actionLog: FieldValue.arrayUnion({
            status: 'Rejected',
            timestamp: timestampIso,
            actor: 'Official',
            actorName: identity.profile?.name || 'Department Officer',
            notes: notes || 'Resolution rejected by department officer.',
          }),
        });
      }
    });

    // Send push notification
    ;(async () => {
      try {
        if (action === 'rework' && assignedWorkerId) {
          const workerDoc = await firestore.collection('users').doc(assignedWorkerId).get();
          const tokens: string[] = workerDoc.data()?.fcmTokens ?? [];
          if (tokens.length) {
            const { getMessaging } = await import('firebase-admin/messaging');
            const admin = await getFirebaseAdmin();
            await getMessaging(admin.app).sendEachForMulticast({
              tokens,
              notification: { title: '🔄 Rework Requested', body: `Officer notes: ${notes}` },
              data: { url: `/worker/task`, tag: `task-${reportId}` },
            }).catch(() => {});
          }
        } else if (reportUserId) {
          const userDoc = await firestore.collection('users').doc(reportUserId).get();
          const tokens: string[] = userDoc.data()?.fcmTokens ?? [];
          if (tokens.length) {
            const { getMessaging } = await import('firebase-admin/messaging');
            const admin = await getFirebaseAdmin();
            await getMessaging(admin.app).sendEachForMulticast({
              tokens,
              notification: {
                title: updatedStatus === 'Resolved' ? '✅ Complaint Resolution Verified' : 'ℹ️ Status Update',
                body: updatedStatus === 'Resolved' ? 'Your complaint resolution has been verified and approved!' : `Status updated to ${updatedStatus}`,
              },
              data: { url: `/citizen/complaint/${reportId}`, tag: `complaint-${reportId}` },
            }).catch(() => {});
          }
        }
      } catch {}
    })();

    return NextResponse.json({ success: true, status: updatedStatus });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Verification failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
