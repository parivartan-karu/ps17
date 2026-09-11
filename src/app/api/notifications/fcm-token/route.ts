import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/notifications/fcm-token
 * Saves or removes a device FCM token on the authenticated user's Firestore document.
 */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const { token, action } = await request.json() as { token: string; action?: 'register' | 'unregister' };

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Valid FCM token required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();
    const userRef = firestore.collection('users').doc(identity.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    if (action === 'unregister') {
      // Remove this specific token from the array
      const existing = (userDoc.data()?.fcmTokens ?? []) as string[];
      const updated = existing.filter((t: string) => t !== token);
      await userRef.update({ fcmTokens: updated });
      return NextResponse.json({ success: true, message: 'Token removed.' });
    }

    // Register: add token if not already present (keep max 5 tokens per user)
    const existing = (userDoc.data()?.fcmTokens ?? []) as string[];
    if (!existing.includes(token)) {
      const updated = [token, ...existing].slice(0, 5);
      await userRef.update({ fcmTokens: updated, pushNotificationsEnabled: true });
    }

    return NextResponse.json({ success: true, message: 'Token registered.' });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('FCM token save error:', error);
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
