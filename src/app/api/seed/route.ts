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

    // 3. Seed Demo Complaints for Stories 1, 2, and 3
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    const ago1hIso = new Date(nowMs - 3600 * 1000).toISOString();
    const ago4hIso = new Date(nowMs - 4 * 3600 * 1000).toISOString();
    const deadlineNearIso = new Date(nowMs + 30 * 60 * 1000).toISOString(); // 30m remaining
    const deadlinePastIso = new Date(nowMs - 2 * 3600 * 1000).toISOString(); // Breached 2h ago

    // Demo 1: Garbage Story Report
    const demoGarbageReport = {
      id: 'demo_garbage_001',
      userId: 'citizen_demo_001',
      userName: 'Ananya Sharma',
      location: 'Aundh Market Road near D-Mart, Pune',
      latitude: 18.5580,
      longitude: 73.8070,
      description: 'Massive uncollected garbage accumulation overflowed bins blocking public walkway',
      imageUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop&q=60',
      imageHint: 'waste accumulation',
      timestamp: ago4hIso,
      status: 'Under Verification',
      department: 'Garbage & Waste Management',
      departmentId: 'dept_sanitation',
      category: 'Overflowing Bins',
      priority: 'High',
      workflowStage: 'pending_department',
      queueStatus: 'pending_department',
      assignedWorkerId: 'worker_garbage_001',
      assignedContractor: 'Sunil More',
      beforeWorkMediaUrl: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop&q=60',
      afterWorkMediaUrl: 'https://images.unsplash.com/photo-1532996122724-e3c354a0b15b?w=800&auto=format&fit=crop&q=60',
      afterWorkNotes: 'Cleared 3 bins and disinfected the surrounding walkway area.',
      slaDeadline: new Date(nowMs + 20 * 3600 * 1000).toISOString(),
      routingConfidence: 0.96,
      routingReason: 'Routed to Garbage & Waste Management based on sanitation taxonomy & bin overflow visual signature.',
      aiAnalysis: {
        damageDetected: true,
        damageCategory: 'Overflowing Bin & Waste',
        severity: 'High',
        verificationSuggestion: 'Needs manual verification',
        description: 'Commercial waste accumulation causing pedestrian obstruction',
        suggestedDepartment: 'Sanitation',
        suggestedPriority: 'High',
        duplicateSuggestion: 'None',
      },
      actionLog: [
        { status: 'Submitted', timestamp: ago4hIso, actor: 'Citizen', actorName: 'Ananya Sharma', notes: 'Reported garbage overflow.' },
        { status: 'Assigned', timestamp: ago1hIso, actor: 'Official', actorName: 'Sanitation Officer', notes: 'Assigned to Sunil More.' },
        { status: 'Under Verification', timestamp: nowIso, actor: 'Worker', actorName: 'Sunil More', notes: 'Completed work and uploaded after-work photo.' },
      ],
    };

    // Demo 2: Roads Story Report
    const demoRoadsReport = {
      id: 'demo_roads_001',
      userId: 'citizen_demo_002',
      userName: 'Rahul Deshmukh',
      location: 'Kothrud Bus Stand Main Road, Pune',
      latitude: 18.5074,
      longitude: 73.8077,
      description: 'Dangerous 1.5 ft deep pothole causing severe traffic disruption and safety risk',
      imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60',
      imageHint: 'pothole road crack',
      timestamp: ago1hIso,
      status: 'Assigned',
      department: 'Roads Department',
      departmentId: 'dept_engineering',
      category: 'Potholes',
      priority: 'Critical',
      workflowStage: 'assigned_worker',
      queueStatus: 'assigned',
      assignedWorkerId: 'worker_roads_001',
      assignedContractor: 'Ramesh Shinde',
      relatedReportCount: 3,
      slaDeadline: new Date(nowMs + 11 * 3600 * 1000).toISOString(),
      routingConfidence: 0.98,
      routingReason: 'Routed to Roads Department based on asphalt damage taxons and critical road safety risk.',
      aiAnalysis: {
        damageDetected: true,
        damageCategory: 'Severe Pothole',
        severity: 'High',
        verificationSuggestion: 'Likely genuine',
        description: 'Deep road cavity on bus transit route',
        suggestedDepartment: 'Engineering',
        suggestedPriority: 'Critical',
        duplicateSuggestion: '3 related reports nearby',
      },
      actionLog: [
        { status: 'Submitted', timestamp: ago1hIso, actor: 'Citizen', actorName: 'Rahul Deshmukh', notes: 'Reported deep pothole.' },
        { status: 'Assigned', timestamp: nowIso, actor: 'Official', actorName: 'Roads Officer', notes: 'Assigned to Ramesh Shinde via Smart Worker Selector.' },
      ],
    };

    // Demo 3: SLA Escalation Story Report
    const demoSlaReport = {
      id: 'demo_sla_001',
      userId: 'citizen_demo_003',
      userName: 'Priya Joshi',
      location: 'Swargate Chowk Underpass, Pune',
      latitude: 18.5018,
      longitude: 73.8636,
      description: 'Major road collapse and hazardous open pit near heavy pedestrian crossing',
      imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60',
      imageHint: 'road safety hazard',
      timestamp: ago4hIso,
      status: 'In Progress',
      department: 'Roads Department',
      departmentId: 'dept_engineering',
      category: 'Road Safety Hazards',
      priority: 'Critical',
      workflowStage: 'in_progress',
      queueStatus: 'in_progress',
      slaDeadline: deadlinePastIso,
      slaBreached: true,
      escalationLevel: 1,
      escalatedTo: 'Central SMC Administration',
      lastEscalatedAt: nowIso,
      routingConfidence: 0.99,
      routingReason: 'Critical priority road safety hazard requiring emergency intervention.',
      aiAnalysis: {
        damageDetected: true,
        damageCategory: 'Road Surface Hazard',
        severity: 'High',
        verificationSuggestion: 'Likely genuine',
        description: 'Road cave-in creating immediate transit danger',
        suggestedDepartment: 'Engineering',
        suggestedPriority: 'Critical',
        duplicateSuggestion: 'None',
      },
      actionLog: [
        { status: 'Submitted', timestamp: ago4hIso, actor: 'Citizen', actorName: 'Priya Joshi', notes: 'Emergency road hazard reported.' },
        { status: 'In Progress', timestamp: ago1hIso, actor: 'Official', actorName: 'Roads Officer', notes: 'Dispatched emergency repair crew.' },
        { status: 'In Progress', timestamp: nowIso, actor: 'System', actorName: 'SLA Monitor Engine', notes: 'SLA Deadline Breached. Escalated to Level 1 (Central Administration).' },
      ],
    };

    const reportsToSeed = [demoGarbageReport, demoRoadsReport, demoSlaReport];
    for (const rep of reportsToSeed) {
      await firestore.collection('reports').doc(rep.id).set(rep, { merge: true });
      results.push(`Seeded demo report #${rep.id} (${rep.department})`);
    }

    return NextResponse.json({
      success: true,
      message: 'Production seed data seeded successfully into Firebase Auth and Firestore.',
      accounts: DEMO_ACCOUNTS.map((a) => ({ email: a.email, password: a.password, role: a.role, department: a.department })),
      demoReports: reportsToSeed.map(r => ({ id: r.id, department: r.department, status: r.status, priority: r.priority })),
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
