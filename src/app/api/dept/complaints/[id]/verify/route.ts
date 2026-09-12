import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, requireDepartmentAccess, RequestAuthError } from '@/lib/server-auth';
import { applyReportStatusTransition } from '@/lib/status-transition-service';
import type { Report } from '@/lib/types';
import { FieldValue } from 'firebase-admin/firestore';
import { evidenceVerificationAgent } from '@/ai/agents/evidence-verification-agent';
import { emitWorkflowEvent } from '@/lib/workflow-events';

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

      // Execute all transaction reads BEFORE any writes
      const workerRef = assignedWorkerId ? firestore.collection('users').doc(assignedWorkerId) : null;
      const workerDoc = workerRef ? await tx.get(workerRef) : null;
      const linkedSnap = await firestore.collection('reports').where('linkedIncidentId', '==', reportId).get();

      const timestampIso = new Date().toISOString();

      if (action === 'approve') {
        if (reportData.status !== 'Under Verification') throw new Error('Complaint must be submitted for verification before approval.');
        // Require actual after-work evidence. The citizen image is not completion proof.
        if (!reportData.afterWorkMediaUrl && !reportData.afterImageUrl) {
          throw new Error('Verification failed: After-work photo evidence is required before approving resolution.');
        }

        const evidence = await evidenceVerificationAgent({
          complaintId: reportId, category: reportData.category,
          beforeMediaUrl: reportData.beforeWorkMediaUrl || reportData.imageUrl,
          afterMediaUrl: reportData.afterWorkMediaUrl || reportData.afterImageUrl,
          officerNotes: reportData.afterWorkNotes,
        });
        if (!evidence.passed) throw new Error(`Evidence verification failed (${evidence.score}/100): ${evidence.reasons.join(' ')}`);

        updatedStatus = 'Resolved';

        const completedDeptTasks = Array.isArray(reportData.departmentTasks)
          ? reportData.departmentTasks.map((t: any) => ({
              ...t,
              status: 'Completed' as const,
              completedAt: t.completedAt || timestampIso,
            }))
          : reportData.departmentTasks;

        // ALL TRANSACTION WRITES EXECUTE HERE:
        applyReportStatusTransition(
          tx,
          reportRef,
          reportData,
          'Resolved',
          { uid: identity.uid, role: identity.profile?.role || 'Department_Head', name: identity.profile?.name || 'Department Officer' },
          {
            notes: notes || 'Resolution verified and approved by department officer.',
            departmentTasks: completedDeptTasks,
            extraUpdates: {
              workflowStage: 'completed',
              ...(completedDeptTasks ? { departmentTasks: completedDeptTasks } : {}),
              evidenceVerification: { passed: evidence.passed, score: evidence.score, reasons: evidence.reasons, verifiedAt: timestampIso },
              agentLogs: FieldValue.arrayUnion(evidence.receipt),
              queueStatus: 'completed',
            },
          }
        );

        // Reward citizen (+10 points)
        if (reportData.userId) {
          const userRef = firestore.collection('users').doc(reportData.userId);
          tx.update(userRef, { points: FieldValue.increment(10) });
        }

        // Decrement assigned worker activeTasks on task completion
        if (workerRef && workerDoc?.exists) {
          const currentActive = workerDoc.data().activeTasks ?? 1;
          tx.update(workerRef, { activeTasks: Math.max(0, currentActive - 1) });
        }

        // Batch resolve linked duplicate reports
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
            if (docSnap.data().userId) {
              tx.update(firestore.collection('users').doc(docSnap.data().userId), { points: FieldValue.increment(10) });
            }
          }
        });
      } else if (action === 'rework') {
        if (!notes?.trim()) {
          throw new Error('Verification notes/instructions are required when requesting rework.');
        }

        updatedStatus = 'In Progress';

        applyReportStatusTransition(tx, reportRef, reportData, 'In Progress', { uid: identity.uid, role: identity.profile?.role || 'Department_Head', name: identity.profile?.name || 'Department Officer' }, {
          notes: `Rework Requested: ${notes}`,
          extraUpdates: { workflowStage: 'in_progress', queueStatus: 'in_progress' },
        });
      } else if (action === 'reject') {
        updatedStatus = 'Rejected';

        applyReportStatusTransition(tx, reportRef, reportData, 'Rejected', { uid: identity.uid, role: identity.profile?.role || 'Department_Head', name: identity.profile?.name || 'Department Officer' }, {
          notes: notes || 'Resolution rejected by department officer.',
          extraUpdates: { workflowStage: 'completed', queueStatus: 'completed' },
        });
      }
    });

    try { await emitWorkflowEvent(action === 'approve' ? 'COMPLAINT_RESOLVED' : action === 'rework' ? 'REWORK_REQUESTED' : 'STATUS_CHANGED', reportId, { action, status: updatedStatus, notes }, identity.uid, identity.role === 'admin' ? 'Admin' : 'Department_Head'); } catch (eventError) { console.warn('[department verify] Event logging failed:', eventError); }

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
