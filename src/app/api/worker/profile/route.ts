import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/app/api/worker/_utils';
import { requireWorkerIdentity } from '@/lib/worker-api-server';
import { toSerializable, workerProfileUpdateSchema } from '@/lib/worker-api';
import { getFirebaseAdmin } from '@/firebase/server';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const worker = await requireWorkerIdentity(request);
    return NextResponse.json({ worker: toSerializable(worker.profile || worker) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const worker = await requireWorkerIdentity(request);
    const body = workerProfileUpdateSchema.parse(await request.json());
    const { firestore } = await getFirebaseAdmin();

    // Explicitly whitelist which fields can be updated (defense-in-depth)
    // Prevent updates to administrative fields like role, departmentId, department, employeeId, capacity
    const allowedUpdates: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };

    if (body.name) {
      allowedUpdates.name = body.name;
    }

    await firestore.collection('users').doc(worker.uid).update(allowedUpdates);

    const updated = await firestore.collection('users').doc(worker.uid).get();
    return NextResponse.json({ worker: toSerializable({ id: updated.id, ...updated.data() }) });
  } catch (error) {
    return handleApiError(error);
  }
}
