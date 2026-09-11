import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';

export const dynamic = 'force-dynamic';

const DEMO_ACCOUNTS = [
  {
    email: 'admin@gmail.com',
    password: '123456',
    name: 'Central Admin Official',
    role: 'admin' as const,
  },
  {
    email: 'roads@gmail.com',
    password: '123456',
    name: 'Roads Department Head',
    role: 'department_head' as const,
    departmentId: 'dept_engineering',
    department: 'Roads Department',
  },
  {
    email: 'garbage@gmail.com',
    password: '123456',
    name: 'Sanitation Department Head',
    role: 'department_head' as const,
    departmentId: 'dept_sanitation',
    department: 'Garbage & Waste Management',
  },
  {
    email: 'citizen@gmail.com',
    password: '123456',
    name: 'Ananya Sharma',
    role: 'citizen' as const,
  },
];

const DEMO_WORKERS = [
  {
    id: 'worker_roads_001',
    email: 'ramesh.roads@smc.gov.in',
    name: 'Ramesh Shinde',
    role: 'worker' as const,
    departmentId: 'dept_engineering',
    department: 'Roads Department',
    skillType: 'Road Repair & Asphalt',
    skills: ['Potholes', 'Road Cracks', 'Asphalt Patching', 'Footpath Repair'],
    wardArea: 'Kothrud',
    activeTasks: 1,
    maxTaskCapacity: 5,
    isAvailable: true,
  },
  {
    id: 'worker_garbage_001',
    email: 'sunil.garbage@smc.gov.in',
    name: 'Sunil More',
    role: 'worker' as const,
    departmentId: 'dept_sanitation',
    department: 'Garbage & Waste Management',
    skillType: 'Sanitation & Waste Clearance',
    skills: ['Overflowing Bins', 'Illegal Dumping', 'Drainage Clearance'],
    wardArea: 'Aundh',
    activeTasks: 2,
    maxTaskCapacity: 5,
    isAvailable: true,
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

    // 1. Seed Accounts
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

      const userRef = firestore.collection('users').doc(uid);
      const docPayload: Record<string, any> = {
        id: uid,
        email: account.email,
        name: account.name,
        role: account.role,
        points: account.role === 'citizen' ? 120 : 0,
        updatedAt: new Date().toISOString(),
      };

      if (account.departmentId) docPayload.departmentId = account.departmentId;
      if (account.department) docPayload.department = account.department;

      await userRef.set(docPayload, { merge: true });
      results.push(`Set Firestore user doc for ${account.email} (${uid})`);
    }

    // 2. Seed Workers
    for (const worker of DEMO_WORKERS) {
      const workerRef = firestore.collection('users').doc(worker.id);
      await workerRef.set(worker, { merge: true });
      results.push(`Seeded field worker ${worker.name}`);
    }

    // 3. Purge legacy demo reports from Firestore so only real complaints exist
    const demoReportIds = [
      'demo_streetlight_001',
      'demo_pothole_dedup_002',
      'demo_overdue_sla_003',
      'demo_water_pipe_004',
      'demo_garbage_001',
      'demo_roads_001',
      'demo_sla_001'
    ];
    for (const demoId of demoReportIds) {
      await firestore.collection('reports').doc(demoId).delete();
      results.push(`Purged dummy demo report #${demoId}`);
    }

    return NextResponse.json({
      success: true,
      message: 'Cleaned dummy data and seeded accounts into Firebase Auth and Firestore.',
      accounts: DEMO_ACCOUNTS.map((a) => ({ email: a.email, password: a.password, role: a.role, department: a.department })),
      results,
    });
  } catch (error) {
    console.error('Seeding failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Seeding failed.' },
      { status: 500 }
    );
  }
}

