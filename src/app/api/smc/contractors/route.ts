import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';

import { departments } from '@/lib/constants';


export const dynamic = 'force-dynamic';
const ACCEPTED_DEPARTMENTS = Array.from(new Set([
  ...departments,
  'Engineering',
  'Sanitation',
  'Electrical',
  'Water Supply',
  'Parks & Environment',
  'Traffic & Roads',
  'Public Works',
  'Road Maintenance Department',
  'Solid Waste Management Department',
  'Water & Drainage Department',
  'Electrical Department',
  'Construction & Public Works Department',
  'Drainage',
  'Electricity',
  'Roads',
]));

function normalizeSegment(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity(request, ['official', 'department_head']);

    const body = await request.json();

    const name = normalizeSegment(String(body.name || ''));
    const phoneNumber = normalizeSegment(String(body.phoneNumber || ''));
    const email = normalizeSegment(String(body.email || ''));
    const department = normalizeSegment(String(body.department || ''));
    const wardArea = normalizeSegment(String(body.wardArea || ''));

    if (!name || !phoneNumber || !department) {
      return NextResponse.json({ error: 'Missing required contractor fields.' }, { status: 400 });
    }

    if (!ACCEPTED_DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: 'Invalid department.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();

    const existing = await firestore
      .collection('contractors')
      .where('name', '==', name)
      .limit(1)
      .get();

    if (!existing.empty) {
      return NextResponse.json({ error: 'Contractor with this name already exists.' }, { status: 409 });
    }

    const created = await firestore.collection('contractors').add({
      name,
      phoneNumber,
      email: email || null,
      department,
      wardArea: wardArea || null,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create contractor:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Contractor creation failed.' },
      { status: 500 }
    );
  }
}
