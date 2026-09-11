import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { sendSMS } from '@/lib/twilio';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import type { Firestore } from 'firebase-admin/firestore';

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

const ACCEPTED_SKILLS = [
  'Garbage',
  'Road Repair',
  'Electrical',
  'Asphalt Work',
  'Sanitation',
  'Garbage Truck Operation',
  'Drainage Cleaning',
  'Pipeline Work',
  'Electrical Maintenance',
  'Civil Works',
  'General Maintenance',
];

function normalizeSegment(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function normalizePhoneNumber(value: string) {
  const compact = value.replace(/[\s()-]/g, '');

  if (compact.startsWith('+')) {
    // Already in international format, validate length
    const digitsOnly = compact.replace(/\D/g, '');
    if (digitsOnly.length < 10 || digitsOnly.length > 15) {
      throw new Error('Phone number has invalid length after normalization');
    }
    return compact;
  }

  const digitsOnly = compact.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }

  // Invalid format
  throw new Error(`Phone number must be 10 digits or include country code. Got ${digitsOnly.length} digits.`);
}

function generatePassword(length = 8) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@#';
  let output = '';
  for (let index = 0; index < length; index += 1) {
    output += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return output;
}

async function generateWorkerId(firestore: Firestore) {
  for (let attempt = 0; attempt < 15; attempt += 1) {
    const serial = Math.floor(1000 + Math.random() * 9000);
    const candidate = `WRK-${serial}`;

    const existing = await firestore
      .collection('users')
      .where('employeeId', '==', candidate)
      .limit(1)
      .get();

    if (existing.empty) {
      return candidate;
    }
  }

  throw new Error('Could not generate a unique worker ID. Please retry.');
}

export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity(request, ['official', 'department_head']);

    const body = await request.json();

    const fullName = normalizeSegment(String(body.fullName || ''));
    const phoneNumber = normalizeSegment(String(body.phoneNumber || ''));
    const emailInput = normalizeSegment(String(body.email || ''));
    const department = normalizeSegment(String(body.department || ''));
    const designation = normalizeSegment(String(body.designation || ''));
    const skillType = normalizeSegment(String(body.skillType || ''));
    const assignedContractor = normalizeSegment(String(body.assignedContractor || ''));
    const wardArea = normalizeSegment(String(body.wardArea || ''));
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    if (!fullName || !phoneNumber || !department || !designation || !skillType || !assignedContractor || !wardArea) {
      return NextResponse.json(
        { error: 'Missing required worker fields.' },
        { status: 400 }
      );
    }

    if (!normalizedPhoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must include a country code or be a valid 10-digit Indian mobile number.' },
        { status: 400 }
      );
    }

    if (!ACCEPTED_DEPARTMENTS.includes(department)) {
      return NextResponse.json({ error: 'Invalid department.' }, { status: 400 });
    }

    if (!ACCEPTED_SKILLS.includes(skillType)) {
      return NextResponse.json({ error: 'Invalid skill type.' }, { status: 400 });
    }

    const { auth, firestore } = await getFirebaseAdmin();

    const workerId = await generateWorkerId(firestore);
    const password = generatePassword();
    const loginEmail = emailInput || `${workerId.toLowerCase()}@workers.parivartan.local`;

    let createdAuthUser;
    try {
      createdAuthUser = await auth.createUser({
        email: loginEmail,
        password,
        displayName: fullName,
      });
    } catch (error: any) {
      const code = String(error?.code || '');

      if (code === 'auth/phone-number-already-exists') {
        return NextResponse.json(
          { error: 'A user with this phone number already exists. Use a different phone number.' },
          { status: 409 }
        );
      }

      if (code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'A user with this email already exists. Use a different email address.' },
          { status: 409 }
        );
      }

      throw error;
    }

    await firestore.collection('users').doc(createdAuthUser.uid).set({
      id: createdAuthUser.uid,
      name: fullName,
      phoneNumber,
      email: loginEmail,
      role: 'worker',
      points: 0,
      department,
      designation,
      skillType,
      assignedContractor,
      wardArea,
      organization: assignedContractor,
      employeeId: workerId,
      createdAt: new Date().toISOString(),
    });

    let smsStatus: 'sent' | 'failed' = 'sent';

    try {
      await sendSMS({
        phoneNumber: normalizedPhoneNumber,
        message: `Congrats! Your worker account is ready. ID: ${workerId} Pass: ${password}`,
      });
    } catch (error) {
      console.error('Worker onboarding SMS failed:', error);
      smsStatus = 'failed';
    }

    return NextResponse.json({
      success: true,
      workerId,
      password,
      smsStatus,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Failed to create worker account:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Worker creation failed.' },
      { status: 500 }
    );
  }
}
