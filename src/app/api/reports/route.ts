import { NextRequest, NextResponse } from 'next/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import { getFirebaseAdmin } from '@/firebase/server';
import { runTriagePipeline, type EligibleWorker } from '@/ai/orchestrator';
import { calculateSlaDeadlines } from '@/lib/sla';
import { getSlaConfig } from '@/lib/sla-config-server';
import type { CandidateReport } from '@/ai/agents/dedup-agent';
import type { Report, ActionLogEntry } from '@/lib/types';
import { emitWorkflowEvent } from '@/lib/workflow-events';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify authenticated user identity via Firebase ID Token
    const identity = await requireRequestIdentity(request);

    // 2. Parse client input payload
    const body = await request.json();
    const {
      description,
      location,
      roadName,
      latitude,
      longitude,
      photo, // mediaDataUri
      citizenCategoryHint,
    } = body;

    if (!description || typeof description !== 'string' || description.trim().length < 10) {
      return NextResponse.json({ error: 'Description must be at least 10 characters long.' }, { status: 400 });
    }
    if (!photo || typeof photo !== 'string') {
      return NextResponse.json({ error: 'Photo evidence is required.' }, { status: 400 });
    }
    if (!location || typeof location !== 'string') {
      return NextResponse.json({ error: 'Location is required.' }, { status: 400 });
    }

    const { firestore } = await getFirebaseAdmin();

    // 3. Fetch candidate reports for server-side deduplication
    let candidateReports: CandidateReport[] = [];
    if (typeof latitude === 'number' && typeof longitude === 'number') {
      try {
        const recentSnap = await firestore
          .collection('reports')
          .orderBy('timestamp', 'desc')
          .limit(100)
          .get();

        candidateReports = recentSnap.docs.map((docSnap) => {
          const d = docSnap.data();
          return {
            id: docSnap.id,
            description: d.description || '',
            category: d.category || '',
            departmentId: d.departmentId,
            latitude: d.latitude,
            longitude: d.longitude,
            timestamp: d.timestamp || '',
            status: d.status || '',
          };
        });
      } catch (err: any) {
        console.warn('[POST /api/reports] Candidate reports query failed:', err?.message);
      }
    }

    // 4. Fetch available workers for potential auto-assignment evaluation
    let availableWorkers: EligibleWorker[] = [];
    try {
      const workersSnap = await firestore
        .collection('users')
        .where('role', '==', 'worker')
        .get();

      availableWorkers = workersSnap.docs.map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          name: d.name || 'Worker',
          departmentId: d.departmentId,
          department: d.department,
          isAvailable: d.isAvailable !== false,
          activeTasks: d.activeTasks || 0,
          maxTaskCapacity: d.maxTaskCapacity || 5,
          skillType: d.skillType,
          wardArea: d.wardArea,
          currentLocation: d.currentLocation,
        };
      });
    } catch (err: any) {
      console.warn('[POST /api/reports] Worker query failed:', err?.message);
    }

    // 5. Run single typed orchestrator (Intake → Classification → Routing → Priority → Dedup)
    const triage = await runTriagePipeline({
      description,
      location,
      roadName,
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      photo,
      citizenCategoryHint: typeof citizenCategoryHint === 'string' ? citizenCategoryHint : undefined,
      candidateReports,
      availableWorkers,
    });

    // 5.5 Calculate SLA deadlines from the same persisted configuration used by the SLA monitor.
    const slaConfig = await getSlaConfig(firestore);
    const slaCalc = calculateSlaDeadlines({
      priority: triage.priority,
      departmentId: triage.departmentId,
      nowDate: new Date(),
      config: slaConfig,
    });

    // 6. Build action log receipts
    const timestampIso = new Date().toISOString();
    const initialStatus: Report['status'] = triage.requiresManualReview
      ? 'Under Verification'
      : (triage.assignedWorkerId ? 'Assigned' : 'Submitted');

    const citizenLogEntry: ActionLogEntry = {
      status: initialStatus,
      timestamp: timestampIso,
      actor: 'Citizen',
      actorName: identity.profile.name || identity.email || 'Anonymous',
      notes: 'Report submitted by citizen via thin client.',
    };

    const systemLogEntry: ActionLogEntry = {
      status: initialStatus,
      timestamp: timestampIso,
      actor: 'System',
      actorName: 'Multi-Agent Triage Orchestrator',
      notes: `Orchestrator classified issue as "${triage.category}", assigned to ${triage.department} (${triage.departmentId}), Priority: ${triage.priority}. ${
        triage.assignedContractor ? `Auto-assigned to worker: ${triage.assignedContractor}.` : `Placed in ${triage.department} queue.`
      }`,
    };

    // 7. Construct Report domain object with queue & SLA metadata
    const newReportData: Partial<Report> & Record<string, any> = {
      userId: identity.uid,
      userName: identity.profile.name || identity.email || 'Anonymous',
      userEmail: identity.email || identity.profile.email || '',
      location: location.trim(),
      roadName: (roadName || '').trim(),
      latitude: typeof latitude === 'number' ? latitude : undefined,
      longitude: typeof longitude === 'number' ? longitude : undefined,
      description: triage.aiAnalysis?.description || description.trim(),
      imageUrl: photo,
      imageHint: triage.category.toLowerCase(),
      timestamp: timestampIso,
      status: initialStatus,
      
      // Authoritative domain fields (Requirements 4 & 5)
      department: triage.department,
      departmentId: triage.departmentId,
      category: triage.category,
      priority: triage.priority,
      difficulty: triage.difficulty,
      riskScore: triage.riskScore,
      riskScoreReasons: triage.riskScoreReasons,
      departmentTasks: triage.departmentTasks,
      relatedReportCount: 1,
      
      // SLA & Escalation fields (Phase 5)
      slaResponseDeadline: slaCalc.slaResponseDeadline,
      responseSlaBreached: false,
      responseSlaWarningSent: false,
      slaDeadline: slaCalc.slaDeadline,
      slaBreached: false,
      escalationLevel: 0,
      estimatedResolutionTime: slaCalc.estimatedResolutionTime,

      // Queue Metadata (Requirement 6)
      queueStatus: triage.queueStatus,
      queuedAt: triage.queuedAt,
      queuePosition: triage.queuePosition,
      workflowStage: triage.workflowStage,
      
      // Worker assignment (Requirements 7, 8, 9)
      assignedWorkerId: triage.assignedWorkerId || undefined,
      assignedContractor: triage.assignedContractor || undefined,
      
      // Review & Confidence
      routingStatus: triage.routingStatus,
      routingConfidence: triage.overallConfidence,
      routingReason: triage.routingReason,
      requiresManualReview: triage.requiresManualReview,
      
      // Action Log & Agent Receipts
      actionLog: [citizenLogEntry, systemLogEntry],
      agentLogs: triage.agentLogs,
      
      // Dedup Metadata
      linkedIncidentId: triage.linkedIncidentId,
      linkedMatchType: triage.linkedMatchType,
      linkedSimilarityScore: triage.linkedSimilarityScore,
      
      // Illegal Dumping Payload
      complaintType: triage.complaintType,
      illegalDumping: triage.illegalDumping,
      
      // Raw AI analysis backup
      aiAnalysis: triage.aiAnalysis,
    };

    // 8. Atomic Write to Firestore
    const docRef = await firestore.collection('reports').add(newReportData);
    try { await emitWorkflowEvent('COMPLAINT_CREATED', docRef.id, { category: triage.category, departmentId: triage.departmentId, priority: triage.priority, difficulty: triage.difficulty }, identity.uid, 'Citizen', triage.departmentId); } catch (eventError) { console.warn('[POST /api/reports] Event logging failed:', eventError); }

    return NextResponse.json({
      success: true,
      reportId: docRef.id,
      report: {
        id: docRef.id,
        ...newReportData,
      },
    });
  } catch (error: any) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[POST /api/reports] Orchestration error:', error);
    return NextResponse.json({ error: 'Failed to process and submit report.' }, { status: 500 });
  }
}
