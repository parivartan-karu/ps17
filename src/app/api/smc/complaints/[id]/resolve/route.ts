import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, requireDepartmentAccess, RequestAuthError } from '@/lib/server-auth';
import type { Report, ReportStatus } from '@/lib/types';
import { applyReportStatusTransition } from '@/lib/status-transition-service';
import { isGenuineResolvedReport, getRewardOffer, buildRewardNotificationText } from '@/lib/reward-utils';
import { FieldValue } from 'firebase-admin/firestore';
import { evidenceVerificationAgent } from '@/ai/agents/evidence-verification-agent';
import { emitWorkflowEvent } from '@/lib/workflow-events';

export const dynamic = 'force-dynamic';

const STATUS_PUSH_MESSAGES: Record<string, { title: string; body: string }> = {
  'Under Verification': {
    title: '🔍 Complaint Under Verification',
    body: 'Your complaint is being reviewed by PMC officials.',
  },
  'Assigned': {
    title: '👷 Worker Assigned to Your Complaint',
    body: 'A field worker has been assigned. Work will begin soon.',
  },
  'In Progress': {
    title: '🔧 Work In Progress',
    body: 'Your complaint is actively being worked on right now.',
  },
  'Resolved': {
    title: '✅ Complaint Resolved!',
    body: 'Great news — your issue has been resolved. Thank you for reporting!',
  },
  'Rejected': {
    title: 'ℹ️ Complaint Status Update',
    body: 'Your complaint has been reviewed. Tap to see details.',
  },
};

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const identity = await requireRequestIdentity(request, ['department_head', 'official', 'admin']);

    const params = await context.params;
    const reportId = params.id?.trim();

    if (!reportId) {
      return NextResponse.json({ error: 'Report ID is required.' }, { status: 400 });
    }

    const body = await request.json();
    const { newStatus, remarks, updatePayload } = body as {
      newStatus: ReportStatus;
      remarks?: string;
      updatePayload?: Record<string, unknown>;
    };

    if (!newStatus) {
      return NextResponse.json({ error: 'Status is required.' }, { status: 400 });
    }

    const { firestore, auth: adminAuth } = await getFirebaseAdmin();

    // Execute atomically in a transaction
    const result = await firestore.runTransaction(async (transaction: any) => {
      const reportRef = firestore.collection('reports').doc(reportId);
      const reportDoc = await transaction.get(reportRef);

      if (!reportDoc.exists) {
        throw new Error('Report not found.');
      }

      const currentReport = reportDoc.data() as Report;
      requireDepartmentAccess(currentReport, identity);
      
      const isBeingResolved = newStatus === 'Resolved' && currentReport.status !== 'Resolved';
      const linkedSnap = isBeingResolved
        ? await firestore.collection('reports').where('linkedIncidentId', '==', reportId).get()
        : null;

      // Authoritative State Machine Validation (Phase 5)
      if (newStatus === 'Resolved') {
        if (currentReport.status !== 'Under Verification') throw new Error('Complaint must be submitted for verification before it can be resolved.');
        if (!currentReport.afterWorkMediaUrl && !currentReport.afterImageUrl) throw new Error('After-work evidence is required before resolution.');
        const evidence = await evidenceVerificationAgent({ complaintId: reportId, category: currentReport.category, beforeMediaUrl: currentReport.beforeWorkMediaUrl || currentReport.imageUrl, afterMediaUrl: currentReport.afterWorkMediaUrl || currentReport.afterImageUrl, officerNotes: currentReport.afterWorkNotes });
        if (!evidence.passed) throw new Error(`Evidence verification failed (${evidence.score}/100): ${evidence.reasons.join(' ')}`);
        (updatePayload as any).evidenceVerification = { passed: evidence.passed, score: evidence.score, reasons: evidence.reasons, verifiedAt: new Date().toISOString() };
        (updatePayload as any).agentLogs = FieldValue.arrayUnion(evidence.receipt);
      }

      applyReportStatusTransition(
        transaction,
        reportRef,
        currentReport,
        newStatus,
        { uid: identity.uid, role: identity.profile?.role || 'Official', name: identity.profile?.name || 'PMC Officer' },
        {
          notes: remarks || `Status updated to ${newStatus}.`,
          extraUpdates: updatePayload,
        },
      );

      if (isBeingResolved && linkedSnap) {
        if (currentReport.userId) {
          const userRef = firestore.collection('users').doc(currentReport.userId);
          transaction.update(userRef, { points: FieldValue.increment(10) });
        }

        const timestampIso = new Date().toISOString();
        const batchLogEntry = {
          status: 'Resolved' as const,
          timestamp: timestampIso,
          actor: 'Official' as const,
          actorName: identity.profile?.name || 'PMC Officer',
          notes: `Master incident #${reportId.slice(0, 8)} resolved by department.`,
        };

        linkedSnap.docs.forEach((docSnap: any) => {
          if (docSnap.data().status !== 'Resolved' && docSnap.data().status !== 'Rejected') {
            const childRef = firestore.collection('reports').doc(docSnap.id);
            transaction.update(childRef, {
              status: 'Resolved',
              workflowStage: 'completed',
              queueStatus: 'completed',
              actionLog: FieldValue.arrayUnion(batchLogEntry),
            });
            if (docSnap.data().userId) {
              const childUserRef = firestore.collection('users').doc(docSnap.data().userId);
              transaction.update(childUserRef, { points: FieldValue.increment(10) });
            }
          }
        });
      }

      return {
        isBeingResolved,
        reportUserId: currentReport.userId,
        previousStatus: currentReport.status,
      };
    });

    try { await emitWorkflowEvent(result.isBeingResolved ? 'COMPLAINT_RESOLVED' : 'STATUS_CHANGED', reportId, { from: result.previousStatus, to: newStatus, remarks }, identity.uid, 'Department_Head', undefined); } catch (eventError) { console.warn('[smc resolve] Event logging failed:', eventError); }

    // ── Fire push notification (fire-and-forget) ───────────────────────────
    ; (async () => {
      try {
        const msg = STATUS_PUSH_MESSAGES[newStatus];
        if (!msg || !result.reportUserId) return;

        const userDoc = await firestore.collection('users').doc(result.reportUserId).get();
        const tokens = (userDoc.data()?.fcmTokens ?? []) as string[];
        if (tokens.length === 0) return;

        const { getMessaging } = await import('firebase-admin/messaging');
        const admin = await getFirebaseAdmin();
        const messaging = getMessaging(admin.app);

        await messaging.sendEachForMulticast({
          tokens,
          notification: { title: msg.title, body: msg.body },
          webpush: {
            notification: {
              title: msg.title,
              body: msg.body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-96x96.png',
              tag: `complaint-${reportId}`,
              requireInteraction: false,
            },
            fcmOptions: { link: `/citizen/complaint/${reportId}` },
          },
          data: { url: `/citizen/complaint/${reportId}`, tag: `complaint-${reportId}` },
        }).catch(() => { });
      } catch { /* non-fatal */ }
    })();

    // After transaction: handle reward notifications for resolved reports
    if (result.isBeingResolved) {
      try {
        const resolvedReportsSnap = await firestore
          .collection('reports')
          .where('userId', '==', result.reportUserId)
          .where('status', '==', 'Resolved')
          .get();

        const resolvedReports = resolvedReportsSnap.docs.map((doc: any) => doc.data() as Report);
        const qualifiedCount = resolvedReports.filter((r: Report) => isGenuineResolvedReport(r)).length;
        const rewardOffer = getRewardOffer(qualifiedCount);

        if (rewardOffer) {
          const prizeMessage = buildRewardNotificationText(rewardOffer);

          await firestore.collection('notifications').add({
            title: rewardOffer.title,
            description: `${prizeMessage} Tap the dashboard to claim it.`,
            createdAt: new Date().toISOString(),
            createdBy: identity.profile?.name || 'System',
            type: 'general',
            isRead: false,
            userId: result.reportUserId,
          });
        }
      } catch (rewardError) {
        console.error('Failed to process reward offer:', rewardError);
      }
    }

    return NextResponse.json({ success: true, updated: true });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : 'Report resolution failed.';
    console.error('Failed to resolve report:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
