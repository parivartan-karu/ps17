import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import { FieldValue } from 'firebase-admin/firestore';


export const dynamic = 'force-dynamic';
function normalizeSegment(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    await requireRequestIdentity(request, ['official', 'department_head']);

    const params = await context.params;
    const rawId = normalizeSegment(decodeURIComponent(params.id || ''));

    if (!rawId) {
      return NextResponse.json({ error: 'Worker identifier is required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();

    const directDoc = await firestore.collection('users').doc(rawId).get();
    let workerUid: string | null = null;

    if (directDoc.exists && directDoc.data()?.role === 'worker') {
      workerUid = directDoc.id;
    } else {
      const byWorkerId = await firestore
        .collection('users')
        .where('employeeId', '==', rawId)
        .where('role', '==', 'worker')
        .limit(1)
        .get();

      if (!byWorkerId.empty) {
        workerUid = byWorkerId.docs[0].id;
      } else {
        const byEmail = await firestore
          .collection('users')
          .where('email', '==', rawId)
          .where('role', '==', 'worker')
          .limit(1)
          .get();

        if (!byEmail.empty) {
          workerUid = byEmail.docs[0].id;
        }
      }
    }

    if (!workerUid) {
      return NextResponse.json({ error: 'Worker not found.' }, { status: 404 });
    }

    // Use transaction to atomically delete worker and cleanup assigned tasks
    await firestore.runTransaction(async (transaction: any) => {
      const workerRef = firestore.collection('users').doc(workerUid);
      
      // Delete the worker document
      transaction.delete(workerRef);

      // Find all tasks assigned to this worker
      const assignedTasksSnapshot = await firestore
        .collection('reports')
        .where('assignedWorkerId', '==', workerUid)
        .get();

      // Unassign all tasks: reset status to Submitted and clear assignee fields
      assignedTasksSnapshot.docs.forEach((taskDoc: any) => {
        transaction.update(taskDoc.ref, {
          assignedWorkerId: null,
          assignedContractor: null,
          workerAssignmentStatus: null,
          status: 'Submitted',
          workflowStage: 'pending_department',
          // Optionally log the reassignment
          actionLog: FieldValue.arrayUnion({
            status: 'Submitted',
            timestamp: new Date().toISOString(),
            actor: 'System',
            actorName: 'System Admin',
            notes: 'Task unassigned due to worker deletion. Returned for reassignment.',
          }),
        });
      });
    });

    return NextResponse.json({ success: true, deletedWorkerId: workerUid });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to delete worker:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker deletion failed.' },
      { status: 500 }
    );
  }
}