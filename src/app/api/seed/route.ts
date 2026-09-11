import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';

export const dynamic = 'force-dynamic';

const DEMO_ACCOUNTS = [
  {
    email: 'admin@gmail.com',
    password: '123456',
    name: 'System Admin',
    role: 'official' as const,
  },
  {
    email: 'garbage@gmail.com',
    password: '123456',
    name: 'Garbage Department Head',
    role: 'department_head' as const,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
  },
  {
    email: 'road@gmail.com',
    password: '123456',
    name: 'Roads & Traffic Department Head',
    role: 'department_head' as const,
    departmentId: 'dept_traffic',
    department: 'Traffic & Roads',
  },
];

export async function GET(request: NextRequest) {
  return handleSeed();
}

export async function POST(request: NextRequest) {
  return handleSeed();
}

async function handleSeed() {
  try {
    const { auth, firestore } = await getFirebaseAdmin();
    const results: string[] = [];

    for (const account of DEMO_ACCOUNTS) {
      let uid: string;
      try {
        const existingUser = await auth.getUserByEmail(account.email);
        uid = existingUser.uid;
        await auth.updateUser(uid, {
          password: account.password,
          displayName: account.name,
        });
        results.push(`Updated Auth user for ${account.email}`);
      } catch (error: any) {
        if (error?.code === 'auth/user-not-found') {
          const newUser = await auth.createUser({
            email: account.email,
            password: account.password,
            displayName: account.name,
          });
          uid = newUser.uid;
          results.push(`Created Auth user for ${account.email}`);
        } else {
          throw error;
        }
      }

      // Upsert document in Firestore
      const userRef = firestore.collection('users').doc(uid);
      const docPayload: Record<string, any> = {
        id: uid,
        email: account.email,
        name: account.name,
        role: account.role,
        points: 0,
        updatedAt: new Date().toISOString(),
      };

      if (account.departmentId) {
        docPayload.departmentId = account.departmentId;
      }
      if (account.department) {
        docPayload.department = account.department;
      }

      await userRef.set(docPayload, { merge: true });
      results.push(`Set Firestore user doc for ${account.email} (${uid})`);
    }

    return NextResponse.json({
      success: true,
      message: 'Demo authentication info seeded successfully into Firebase Auth and Firestore.',
      accounts: DEMO_ACCOUNTS.map((a) => ({ email: a.email, password: a.password, role: a.role, department: a.department })),
      results,
    });
  } catch (error) {
    console.error('Seeding failed:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Seeding failed.',
      },
      { status: 500 }
    );
  }
}
