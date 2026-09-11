import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import type { Report, ReportStatus } from '@/lib/types';
import { isGenuineResolvedReport, getRewardOffer, buildRewardNotificationText } from '@/lib/reward-utils';
import { FieldValue } from 'firebase-admin/firestore';

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
    const identity = await requireRequestIdentity(request, ['official', 'department_head']);

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
      const isBeingResolved = newStatus === 'Resolved' && currentReport.status !== 'Resolved';

      const statusUpdatePayload: Record<string, unknown> = {
        status: newStatus,
        ...updatePayload,
      };

      const newLogEntry = {
        status: newStatus,
        timestamp: new Date().toISOString(),
        actor: 'Official' as const,
        actorName: identity.profile?.name || 'SMC Officer',
        notes: remarks || `Status updated to ${newStatus}.`,
      };

      if (!Array.isArray(statusUpdatePayload.actionLog)) {
        statusUpdatePayload.actionLog = [];
      }
      (statusUpdatePayload.actionLog as typeof newLogEntry[]).push(newLogEntry);

      transaction.update(reportRef, statusUpdatePayload);

      if (isBeingResolved) {
        const userRef = firestore.collection('users').doc(currentReport.userId);
        transaction.update(userRef, { points: FieldValue.increment(10) });
      }

      return {
        isBeingResolved,
        reportUserId: currentReport.userId,
        previousStatus: currentReport.status,
      };
    });

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
