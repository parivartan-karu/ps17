import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';


export const dynamic = 'force-dynamic';
/**
 * PATCH /api/notifications/[id]/mark-read
 * Marks a notification as read.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const identity = await requireRequestIdentity(request);
    const { firestore } = await getFirebaseAdmin();
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (!id) {
      return NextResponse.json(
        { error: 'Notification ID is required' },
        { status: 400 }
      );
    }

    const notificationRef = firestore.collection('notifications').doc(id);
    const notificationSnapshot = await notificationRef.get();

    if (!notificationSnapshot.exists) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    const notificationData = notificationSnapshot.data() as { userId?: string } | undefined;
    const isPrivileged = ['official', 'department_head'].includes(identity.role);
    const isOwner = !!notificationData?.userId && notificationData.userId === identity.uid;

    if (!isPrivileged && !isOwner) {
      return NextResponse.json(
        { error: 'You do not have permission to update this notification.' },
        { status: 403 }
      );
    }

    await notificationRef.update({
      isRead: true,
    });

    return NextResponse.json(
      { success: true, message: 'Notification marked as read' },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error marking notification as read:', error);
    return NextResponse.json(
      {
        error: 'Failed to mark notification as read',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
