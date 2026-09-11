import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';


export const dynamic = 'force-dynamic';
/**
 * PATCH /api/notifications/mark-all-read
 * Marks unread notifications as read.
 */
export async function PATCH(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request);
    const { firestore } = await getFirebaseAdmin();

    let notificationsQuery = firestore.collection('notifications').where('isRead', '==', false);

    if (!['official', 'department_head'].includes(identity.role)) {
      notificationsQuery = notificationsQuery.where('userId', '==', identity.uid);
    }

    const snapshot = await notificationsQuery.get();

    if (snapshot.empty) {
      return NextResponse.json({ success: true, updatedCount: 0 }, { status: 200 });
    }

    const batch = firestore.batch();
    snapshot.docs.forEach((notificationDoc: QueryDocumentSnapshot) => {
      batch.update(notificationDoc.ref, { isRead: true });
    });
    await batch.commit();

    return NextResponse.json(
      { success: true, updatedCount: snapshot.size },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error marking all notifications as read:', error);
    return NextResponse.json(
      {
        error: 'Failed to mark all notifications as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
