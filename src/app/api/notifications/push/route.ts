import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface PushPayload {
  /** Target a specific user by UID. If omitted, broadcasts to all users with tokens. */
  targetUserId?: string;
  title: string;
  body: string;
  /** Deep-link URL opened when the notification is tapped */
  url?: string;
  /** Notification type tag – prevents duplicate toasts */
  tag?: string;
  /** Skip auth check – for internal server-to-server calls */
  _internal?: boolean;
}

/**
 * POST /api/notifications/push
 * Sends FCM push notification to a specific user or all users.
 * Requires official / department_head role (or internal flag).
 */
export async function POST(request: NextRequest) {
  let identity: Awaited<ReturnType<typeof requireRequestIdentity>> | null = null;

  const body = (await request.json()) as PushPayload;

  // Internal server-to-server calls skip auth (used by resolve route)
  if (!body._internal) {
    try {
      identity = await requireRequestIdentity(request, ['official', 'department_head', 'admin']);
    } catch (error) {
      if (error instanceof RequestAuthError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }
  }

  const { targetUserId, title, body: messageBody, url, tag } = body;

  if (!title || !messageBody) {
    return NextResponse.json({ error: 'title and body are required.' }, { status: 400 });
  }

  try {
    const { firestore } = await getFirebaseAdmin();

    let tokenList: string[] = [];

    if (targetUserId) {
      // Send to specific user
      const userDoc = await firestore.collection('users').doc(targetUserId).get();
      const tokens = (userDoc.data()?.fcmTokens ?? []) as string[];
      tokenList = tokens;
    } else {
      // Broadcast: collect tokens from all users who opted in
      const usersSnap = await firestore
        .collection('users')
        .where('pushNotificationsEnabled', '==', true)
        .get();
      usersSnap.forEach((doc: any) => {
        const tokens = (doc.data().fcmTokens ?? []) as string[];
        tokenList.push(...tokens);
      });
      // Deduplicate
      tokenList = [...new Set(tokenList)];
    }

    if (tokenList.length === 0) {
      return NextResponse.json({ success: true, sent: 0, message: 'No registered devices found.' });
    }

    // Use Firebase Admin Messaging
    const { app } = await getFirebaseAdmin();
    // Dynamically import to avoid issues if messaging isn't initialised
    const { getMessaging } = await import('firebase-admin/messaging');
    const messaging = getMessaging(app);

    const notification = {
      title,
      body: messageBody,
    };

    const webpushConfig = {
      notification: {
        title,
        body: messageBody,
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-96x96.png',
        tag: tag ?? 'parivartan',
        requireInteraction: false,
      },
      fcmOptions: {
        link: url ?? '/citizen/notifications',
      },
    };

    const dataPayload: Record<string, string> = {
      url: url ?? '/citizen/notifications',
      tag: tag ?? 'parivartan',
    };

    // Batch in chunks of 500 (FCM limit)
    const CHUNK = 500;
    let successCount = 0;
    let failureCount = 0;
    const staleTokens: string[] = [];

    for (let i = 0; i < tokenList.length; i += CHUNK) {
      const chunk = tokenList.slice(i, i + CHUNK);
      const response = await messaging.sendEachForMulticast({
        tokens: chunk,
        notification,
        webpush: webpushConfig,
        data: dataPayload,
      });

      successCount += response.successCount;
      failureCount += response.failureCount;

      // Collect stale / invalid tokens to remove
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const code = resp.error?.code;
          if (
            code === 'messaging/registration-token-not-registered' ||
            code === 'messaging/invalid-registration-token'
          ) {
            staleTokens.push(chunk[idx]);
          }
        }
      });
    }

    // Clean up stale tokens asynchronously
    if (staleTokens.length > 0) {
      const staleSet = new Set(staleTokens);
      const usersWithStale = await firestore
        .collection('users')
        .where('fcmTokens', 'array-contains-any', staleTokens.slice(0, 10))
        .get();

      const batch = firestore.batch();
      usersWithStale.forEach((doc: any) => {
        const existing = (doc.data().fcmTokens ?? []) as string[];
        const cleaned = existing.filter((t) => !staleSet.has(t));
        batch.update(doc.ref, { fcmTokens: cleaned });
      });
      await batch.commit().catch(() => {});
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failureCount,
      total: tokenList.length,
    });
  } catch (error) {
    console.error('Push notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send push notification.', details: String(error) },
      { status: 500 }
    );
  }
}
