import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, requireDepartmentAccess, RequestAuthError } from '@/lib/server-auth';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * API Endpoint to manually link or unlink a report to a master incident.
 * Preserves individual citizen reports while grouping operational workflows.
 */
export async function POST(request: NextRequest) {
  try {
    const identity = await requireRequestIdentity(request, ['department_head', 'official', 'admin']);
    const body = await request.json();
    const { reportId, masterIncidentId, action } = body;

    if (!reportId) {
      return NextResponse.json({ error: 'reportId is required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();
    const reportRef = firestore.collection('reports').doc(reportId);

    await firestore.runTransaction(async (tx: any) => {
      const reportDoc = await tx.get(reportRef);
      if (!reportDoc.exists) throw new Error('Report not found.');

      const reportData = reportDoc.data()!;
      requireDepartmentAccess(reportData, identity);

      const timestampIso = new Date().toISOString();

      if (action === 'unlink') {
        // Unlink from master incident
        const prevMasterId = reportData.linkedIncidentId;

        tx.update(reportRef, {
          linkedIncidentId: null,
          linkedMatchType: null,
          actionLog: FieldValue.arrayUnion({
            status: reportData.status,
            timestamp: timestampIso,
            actor: 'Official',
            actorName: identity.profile.name ?? 'Dept Officer',
            notes: `Unlinked from master incident #${prevMasterId?.slice(0, 8)}`,
          }),
        });

        // Decrement parent report's relatedReportCount if exists
        if (prevMasterId) {
          const prevMasterRef = firestore.collection('reports').doc(prevMasterId);
          const prevMasterDoc = await tx.get(prevMasterRef);
          if (prevMasterDoc.exists) {
            const curCount = prevMasterDoc.data()!.relatedReportCount ?? 1;
            tx.update(prevMasterRef, {
              relatedReportCount: Math.max(1, curCount - 1),
            });
          }
        }
      } else {
        // Link to master incident
        if (!masterIncidentId) throw new Error('masterIncidentId is required to link.');
        if (masterIncidentId === reportId) throw new Error('Cannot link a report to itself.');

        const masterRef = firestore.collection('reports').doc(masterIncidentId);
        const masterDoc = await tx.get(masterRef);
        if (!masterDoc.exists) throw new Error('Master incident not found.');

        const masterData = masterDoc.data()!;
        requireDepartmentAccess(masterData, identity);

        const currentRelatedCount = masterData.relatedReportCount ?? 1;

        // Update target report
        tx.update(reportRef, {
          linkedIncidentId: masterIncidentId,
          linkedMatchType: 'manual_official_override',
          actionLog: FieldValue.arrayUnion({
            status: reportData.status,
            timestamp: timestampIso,
            actor: 'Official',
            actorName: identity.profile.name ?? 'Dept Officer',
            notes: `Linked to master incident #${masterIncidentId.slice(0, 8)}`,
          }),
        });

        // Increment master report's relatedReportCount
        tx.update(masterRef, {
          relatedReportCount: currentRelatedCount + 1,
          lastRelatedAt: timestampIso,
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof RequestAuthError) return NextResponse.json({ error: error.message }, { status: error.status });
    const msg = error instanceof Error ? error.message : 'Incident linking failed.';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
