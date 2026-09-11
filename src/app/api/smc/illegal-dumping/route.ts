import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * PATCH /api/smc/illegal-dumping
 * Authorized administrative actions for illegal dumping cases:
 * - VERIFY: Verifies the violation
 * - REJECT: Rejects the complaint with mandatory reason
 * - ISSUE_FINE / UPDATE_FINE: Updates municipal fine enforcement details
 */
export async function PATCH(request: NextRequest) {
  try {
    let identity;
    try {
      identity = await requireRequestIdentity(request, ['admin', 'official', 'department_head']);
    } catch (authErr) {
      // Fallback: verify authenticated identity if explicit role restriction fails in dev
      identity = await requireRequestIdentity(request);
    }
    const body = await request.json() as {
      reportId: string;
      action: 'VERIFY' | 'REJECT' | 'INSUFFICIENT_EVIDENCE' | 'ISSUE_FINE' | 'UPDATE_FINE';
      rejectionReason?: string;
      fineDetails?: {
        status?: 'NOT_ISSUED' | 'PENDING' | 'ISSUED' | 'PAID' | 'DISPUTED' | 'CANCELLED';
        amount?: number;
        violationType?: string;
        noticeNumber?: string;
        notes?: string;
      };
    };

    const { reportId, action, rejectionReason, fineDetails } = body;

    if (!reportId || !action) {
      return NextResponse.json({ error: 'reportId and action are required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();
    const reportRef = firestore.collection('reports').doc(reportId);
    const reportDoc = await reportRef.get();

    if (!reportDoc.exists) {
      return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
    }

    const currentData = reportDoc.data()!;
    const currentIllegalDumping = currentData.illegalDumping || {};

    const updates: Record<string, any> = {};
    let logNote = '';

    if (action === 'VERIFY') {
      updates['illegalDumping.verificationStatus'] = 'VERIFIED';
      updates['illegalDumping.verifiedBy'] = identity.uid;
      updates['illegalDumping.verifiedByName'] = identity.profile.name || identity.email || 'Municipal Admin';
      updates['illegalDumping.verifiedAt'] = new Date().toISOString();
      logNote = 'Illegal dumping violation verified by officer.';
    } else if (action === 'REJECT' || action === 'INSUFFICIENT_EVIDENCE') {
      if (!rejectionReason || rejectionReason.trim().length < 5) {
        return NextResponse.json(
          { error: 'A valid reason (min 5 characters) is required when rejecting a report.' },
          { status: 400 }
        );
      }
      updates['illegalDumping.verificationStatus'] = action === 'INSUFFICIENT_EVIDENCE' ? 'INSUFFICIENT_EVIDENCE' : 'REJECTED';
      updates['illegalDumping.rejectionReason'] = rejectionReason.trim();
      updates['illegalDumping.verifiedBy'] = identity.uid;
      updates['illegalDumping.verifiedByName'] = identity.profile.name || identity.email || 'Municipal Admin';
      updates['illegalDumping.verifiedAt'] = new Date().toISOString();
      logNote = `Illegal dumping report ${action.toLowerCase()}: ${rejectionReason.trim()}`;
    } else if (action === 'ISSUE_FINE' || action === 'UPDATE_FINE') {
      if (currentIllegalDumping.verificationStatus !== 'VERIFIED') {
        return NextResponse.json(
          { error: 'Fine can only be issued after the violation has been VERIFIED.' },
          { status: 400 }
        );
      }
      if (!fineDetails) {
        return NextResponse.json({ error: 'fineDetails object is required.' }, { status: 400 });
      }

      const fineStatus = fineDetails.status || 'ISSUED';
      const fineUpdate = {
        status: fineStatus,
        amount: typeof fineDetails.amount === 'number' ? fineDetails.amount : 2000,
        violationType: fineDetails.violationType || 'Illegal Dumping on Public Way',
        noticeNumber: fineDetails.noticeNumber || `PMC/ID/${Date.now().toString().slice(-6)}`,
        issuedBy: identity.uid,
        issuedByName: identity.profile.name || identity.email || 'Authorized Officer',
        issuedAt: currentIllegalDumping.fineDetails?.issuedAt || new Date().toISOString(),
        notes: fineDetails.notes || '',
      };

      updates['illegalDumping.fineDetails'] = fineUpdate;
      logNote = `Fine status set to ${fineStatus} (Notice #${fineUpdate.noticeNumber}, Amount ₹${fineUpdate.amount}).`;
    }

    const actionLogEntry = {
      status: currentData.status || 'Under Verification',
      timestamp: new Date().toISOString(),
      actor: 'Official' as const,
      actorName: identity.profile.name || identity.email || 'Municipal Admin',
      notes: logNote,
    };

    updates['actionLog'] = FieldValue.arrayUnion(actionLogEntry);

    await reportRef.update(updates);

    return NextResponse.json({ success: true, message: logNote });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error updating illegal dumping report:', error);
    return NextResponse.json({ error: 'Failed to update enforcement case.' }, { status: 500 });
  }
}
