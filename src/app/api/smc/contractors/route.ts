import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';

import { departments } from '@/lib/constants';


import { normalizeDepartment, toDepartmentDisplayAndId } from '@/lib/departments';

export const dynamic = 'force-dynamic';

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

    const deptInfo = toDepartmentDisplayAndId(department);
    if (!deptInfo.departmentId) {
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
      department: deptInfo.department,
      departmentId: deptInfo.departmentId,
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
