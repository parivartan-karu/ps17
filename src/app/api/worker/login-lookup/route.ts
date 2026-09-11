import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';


export const dynamic = 'force-dynamic';
function normalizeSegment(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const workerId = normalizeSegment(String(body.workerId || '')).toUpperCase();

    if (!workerId) {
      return NextResponse.json({ error: 'Worker ID is required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();

    const workerSnapshot = await firestore
      .collection('users')
      .where('employeeId', '==', workerId)
      .where('role', '==', 'worker')
      .limit(1)
      .get();

    if (workerSnapshot.empty) {
      return NextResponse.json({ error: 'Worker account not found.' }, { status: 404 });
    }

    const workerData = workerSnapshot.docs[0].data();
    const email = workerData.email;

    if (!email) {
      return NextResponse.json({ error: 'Worker account email is missing. Contact admin.' }, { status: 409 });
    }

    return NextResponse.json({ success: true, email });
  } catch (error) {
    console.error('Worker login lookup failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Lookup failed.' },
      { status: 500 }
    );
  }
}
