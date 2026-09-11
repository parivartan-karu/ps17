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

    // -------------------------------------------------------------------------
    // 4 Deterministic Demo Scenarios
    // -------------------------------------------------------------------------

    // Scenario A: Streetlight (Standard end-to-end flow)
    const demoStreetlight = {
      id: 'demo_streetlight_001',
      userId: 'citizen_demo_001',
      userName: 'Ananya Sharma',
      location: 'FC Road near Goodluck Cafe, Pune',
      latitude: 18.5204,
      longitude: 73.8423,
      description: 'Streetlight pole #42 fixture damaged and flickering continuously at night.',
      imageUrl: 'https://images.unsplash.com/photo-1509114397022-ed747cca3f65?w=800&auto=format&fit=crop&q=60',
      timestamp: ago4hIso,
      status: 'Assigned',
      department: 'Electrical & Streetlight Department',
      departmentId: 'dept_electrical',
      category: 'Streetlight Issue',
      priority: 'Medium',
      riskScore: 45,
      riskScoreReasons: ['Standard category baseline: Streetlight (+15)', 'Nighttime visibility safety signal (+30)'],
      workflowStage: 'assigned_worker',
      queueStatus: 'assigned_worker',
      assignedWorkerId: 'worker_electrical_001',
      assignedContractor: 'Vikas Patil',
      slaResponseDeadline: new Date(nowMs + 4 * 3600 * 1000).toISOString(),
      slaDeadline: new Date(nowMs + 44 * 3600 * 1000).toISOString(),
      routingConfidence: 0.94,
      routingReason: 'Routed to Electrical & Streetlight Department based on category taxonomy matching.',
      routingGate: 'automatic',
      departmentTasks: [
        {
          id: 'TASK-SL-01',
          departmentId: 'dept_electrical',
          departmentName: 'Electrical & Streetlight Department',
          taskName: 'Replace damaged LED luminaire & wire terminal',
          status: 'In Progress',
          notes: 'Technician dispatched with replacement fixture.',
        },
      ],
      actionLog: [
        { status: 'Submitted', timestamp: ago4hIso, actor: 'Citizen', actorName: 'Ananya Sharma', notes: 'Streetlight flicker reported.' },
        { status: 'Assigned', timestamp: ago1hIso, actor: 'Official', actorName: 'Electrical Officer', notes: 'Assigned to Vikas Patil.' },
      ],
    };

    // Scenario B: Pothole Duplicate (Auto incident linking)
    const demoPotholeDedup = {
      id: 'demo_pothole_dedup_002',
      userId: 'citizen_demo_002',
      userName: 'Rahul Deshmukh',
      location: 'Kothrud Bus Stand Main Road near Karve Statue, Pune',
      latitude: 18.5075,
      longitude: 73.8078,
      description: 'Massive dangerous pothole cavity on main road near bus stand.',
      imageUrl: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=60',
      timestamp: ago1hIso,
      status: 'Assigned',
      department: 'Road Maintenance Department',
      departmentId: 'dept_traffic',
      category: 'Pothole',
      priority: 'High',
      riskScore: 78,
      riskScoreReasons: ['Road infrastructure damage (+25)', 'High density of nearby reports (+20)', 'Traffic risk (+33)'],
      workflowStage: 'assigned_worker',
      queueStatus: 'assigned_worker',
      assignedWorkerId: 'worker_roads_001',
      assignedContractor: 'Ramesh Shinde',
      isDuplicate: true,
      linkedIncidentId: 'demo_roads_001',
      linkedMatchType: 'exact_spatial_category',
      linkedSimilarityScore: 0.92,
      relatedReportCount: 4,
      routingGate: 'automatic',
      slaResponseDeadline: new Date(nowMs + 2 * 3600 * 1000).toISOString(),
      slaDeadline: new Date(nowMs + 20 * 3600 * 1000).toISOString(),
      routingConfidence: 0.98,
      routingReason: 'Routed to Road Maintenance Department and linked to master incident demo_roads_001 (Similarity 92%).',
      actionLog: [
        { status: 'Submitted', timestamp: ago1hIso, actor: 'Citizen', actorName: 'Rahul Deshmukh', notes: 'Duplicate report submitted.' },
        { status: 'Assigned', timestamp: nowIso, actor: 'System', actorName: 'Deduplication Agent', notes: 'Auto-linked to master incident demo_roads_001.' },
      ],
    };

    // Scenario C: Overdue SLA (Response & Resolution SLA breach & escalation)
    const demoOverdueSla = {
      id: 'demo_overdue_sla_003',
      userId: 'citizen_demo_003',
      userName: 'Priya Joshi',
      location: 'Swargate Chowk Underpass, Pune',
      latitude: 18.5018,
      longitude: 73.8636,
      description: 'Dangerous open manhole and caved-in road surface near high density pedestrian area.',
      imageUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=60',
      timestamp: ago4hIso,
      status: 'In Progress',
      department: 'Road Maintenance Department',
      departmentId: 'dept_traffic',
      category: 'Manhole issue',
      priority: 'Critical',
      riskScore: 95,
      riskScoreReasons: ['Critical safety hazard: Open manhole (+45)', 'Pedestrian accident risk (+35)', 'Critical keywords (+15)'],
      workflowStage: 'in_progress',
      queueStatus: 'in_progress',
      slaResponseDeadline: deadlinePastIso,
      slaDeadline: deadlinePastIso,
      slaBreached: true,
      responseSlaBreached: true,
      escalationLevel: 2,
      escalatedTo: 'PMC Municipal Commissioner / Central Admin',
      lastEscalatedAt: nowIso,
      routingConfidence: 0.99,
      routingReason: 'Critical priority open manhole hazard requiring immediate executive escalation.',
      actionLog: [
        { status: 'Submitted', timestamp: ago4hIso, actor: 'Citizen', actorName: 'Priya Joshi', notes: 'Open manhole reported.' },
        { status: 'In Progress', timestamp: ago1hIso, actor: 'Official', actorName: 'Roads Officer', notes: 'Barricades placed.' },
        { status: 'In Progress', timestamp: nowIso, actor: 'System', actorName: 'SLA Monitor Engine', notes: 'Response & Resolution SLA Breached. Escalated to Level 2 (PMC Administration).' },
      ],
    };

    // Scenario D: Burst Water Pipe (Multi-department coordination & dependency tasks)
    const demoWaterPipeMultiDept = {
      id: 'demo_water_pipe_004',
      userId: 'citizen_demo_001',
      userName: 'Ananya Sharma',
      location: 'Viman Nagar Main Road near Phoenix Marketcity, Pune',
      latitude: 18.5679,
      longitude: 73.9143,
      description: '12-inch underground main water pipe burst causing severe waterlogging, pavement erosion, and traffic paralysis.',
      imageUrl: 'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=800&auto=format&fit=crop&q=60',
      timestamp: ago1hIso,
      status: 'In Progress',
      department: 'Water Supply Department',
      departmentId: 'dept_water',
      category: 'Water pipe burst',
      priority: 'Critical',
      riskScore: 92,
      riskScoreReasons: ['Major utility failure: Water pipe burst (+35)', 'Multi-department impact (+25)', 'Traffic disruption (+32)'],
      workflowStage: 'in_progress',
      queueStatus: 'in_progress',
      routingGate: 'automatic',
      slaResponseDeadline: new Date(nowMs + 1 * 3600 * 1000).toISOString(),
      slaDeadline: new Date(nowMs + 11 * 3600 * 1000).toISOString(),
      routingConfidence: 0.97,
      routingReason: 'Coordination Agent initialized multi-department tasks across Water Supply, Road Maintenance, and Sanitation.',
      departmentTasks: [
        {
          id: 'TASK-WP-01',
          departmentId: 'dept_water',
          departmentName: 'Water Supply Department',
          taskName: 'Isolate main supply valve and repair fractured feeder line',
          assignedWorkerId: 'worker_water_001',
          assignedWorkerName: 'Suresh Patil',
          status: 'In Progress',
          notes: 'Valve closure in progress.',
        },
        {
          id: 'TASK-WP-02',
          departmentId: 'dept_traffic',
          departmentName: 'Road Maintenance Department',
          taskName: 'Excavate and resurface eroded asphalt pavement',
          status: 'Blocked',
          dependencyTaskId: 'TASK-WP-01',
          notes: 'Blocked until main water leak is completely isolated.',
        },
        {
          id: 'TASK-WP-03',
          departmentId: 'dept_sanitation',
          departmentName: 'Solid Waste Management Department',
          taskName: 'Clear mud sludge and stormwater drain blockages',
          status: 'Pending',
          notes: 'Scheduled following pavement restoration.',
        },
      ],
      actionLog: [
        { status: 'Submitted', timestamp: ago1hIso, actor: 'Citizen', actorName: 'Ananya Sharma', notes: 'Water pipe burst reported.' },
        { status: 'In Progress', timestamp: nowIso, actor: 'System', actorName: 'Coordination Agent', notes: 'Created 3 multi-department sub-tasks with dependency gating.' },
      ],
    };

    const reportsToSeed = [
      demoStreetlight,
      demoPotholeDedup,
      demoOverdueSla,
      demoWaterPipeMultiDept,
    ];
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
