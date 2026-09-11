import { intakeAgent, type IntakeInput, type IntakeOutput } from './agents/intake-agent';
import { classificationAgent, type ClassificationOutput } from './agents/classification-agent';
import { routingAgent, type RoutingOutput } from './agents/routing-agent';
import { priorityAgent, type PriorityOutput } from './agents/priority-agent';
import { dedupAgent, type DedupOutput, type CandidateReport } from './agents/dedup-agent';
import {
  validateCategory,
  validateDepartmentId,
  validatePriority,
  clampConfidence,
  createAgentReceipt,
  type AgentLogEntry,
} from './agents/types';
import { normalizeDepartment, type CanonicalDepartmentId } from '@/lib/departments';
import type { Report, ActionLogEntry, IllegalDumpingData } from '@/lib/types';

import { coordinationAgent, type CoordinationOutput } from './agents/coordination-agent';
import type { DepartmentTask } from '@/lib/complaint-context';

export type EligibleWorker = {
  id: string;
  name: string;
  departmentId?: string;
  department?: string;
  isAvailable?: boolean;
  activeTasks?: number;
  maxTaskCapacity?: number;
  skillType?: string;
  wardArea?: string;
  currentLocation?: {
    latitude: number;
    longitude: number;
  };
};

export type OrchestratorInput = {
  complaintId?: string;
  description: string;
  location: string;
  roadName?: string;
  latitude?: number;
  longitude?: number;
  photo?: string;
  citizenCategoryHint?: string;
  candidateReports?: CandidateReport[];
  availableWorkers?: EligibleWorker[];
  currentDepartmentQueueCount?: number;
};

export type TriageResult = {
  // Authoritative domain fields
  departmentId: CanonicalDepartmentId;
  department: string;
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  riskScore: number;
  riskScoreReasons: string[];
  departmentTasks: DepartmentTask[];

  // Queue & Workflow metadata
  queueStatus: 'pending_department' | 'accepted_by_department' | 'assigned_worker' | 'in_progress' | 'completed';
  queuedAt: string;
  queuePosition: number;
  workflowStage: 'pending_admin' | 'pending_department' | 'assigned_worker' | 'in_progress' | 'completed';
  routingGate: 'automatic' | 'department_verification' | 'manual_review';

  // Worker assignment
  assignedWorkerId: string | null;
  assignedContractor: string | null;
  autoAssignEligible: boolean;

  // Review & Confidence
  requiresManualReview: boolean;
  routingStatus: 'pending' | 'assigned' | 'needs_review';
  overallConfidence: number;
  routingReason: string;

  // Dedup metadata
  isDuplicate: boolean;
  linkedIncidentId: string | null;
  linkedMatchType: string | null;
  linkedSimilarityScore: number | null;

  // Illegal dumping metadata
  illegalDumping: IllegalDumpingData | null;
  complaintType: 'Standard' | 'Illegal Dumping';

  // Audit receipts from all agents
  agentLogs: AgentLogEntry[];

  // Raw AI analysis for backward compatibility
  aiAnalysis: any;
};

/**
 * Calculates Haversine distance in km between two lat/lng coordinates.
 */
function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Worker Selection Engine (Requirement 8 & 9)
 * Selects best eligible worker strictly from the routed department.
 */
export function selectBestEligibleWorker(
  routedDepartmentId: CanonicalDepartmentId,
  workers: EligibleWorker[],
  options?: {
    category?: string;
    latitude?: number;
    longitude?: number;
  }
): EligibleWorker | null {
  if (!workers || workers.length === 0) return null;

  // 1. Strict Department Filter (Requirement 8)
  const deptWorkers = workers.filter((w) => {
    const wDeptId = validateDepartmentId(w.departmentId || w.department);
    return wDeptId === routedDepartmentId;
  });

  if (deptWorkers.length === 0) return null;

  // 2. Availability & Capacity Filter (Requirement 9)
  const eligible = deptWorkers.filter((w) => {
    const isAvail = w.isAvailable !== false;
    const capacity = w.maxTaskCapacity || 5;
    const active = w.activeTasks || 0;
    return isAvail && active < capacity;
  });

  if (eligible.length === 0) return null;

  // 3. Scoring Strategy: Workload + Skill Match + Proximity
  const scored = eligible.map((w) => {
    let score = 100 - (w.activeTasks || 0) * 15; // lower workload ranks higher

    // Skill match bonus
    if (options?.category && w.skillType && options.category.toLowerCase().includes(w.skillType.toLowerCase())) {
      score += 20;
    }

    // Geographic proximity bonus if location is available
    if (
      typeof options?.latitude === 'number' &&
      typeof options?.longitude === 'number' &&
      w.currentLocation?.latitude &&
      w.currentLocation?.longitude
    ) {
      const distKm = getDistanceKm(
        options.latitude,
        options.longitude,
        w.currentLocation.latitude,
        w.currentLocation.longitude
      );
      if (distKm <= 5) {
        score += 25 - distKm * 3;
      }
    }

    return { worker: w, score };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0]?.worker || null;
}

/**
 * Main Multi-Agent Pipeline Orchestrator (Phase 4)
 * Executes intake → classification → routing → priority → dedup → coordination safely with step-by-step validation.
 */
export async function runTriagePipeline(input: OrchestratorInput): Promise<TriageResult> {
  const pipelineStartTime = performance.now();

  // ---------------------------------------------------------------------------
  // Step 1: Intake Agent
  // ---------------------------------------------------------------------------
  let intakeRes: IntakeOutput;
  try {
    intakeRes = await intakeAgent({
      description: input.description,
      location: input.location,
      roadName: input.roadName,
      latitude: input.latitude,
      longitude: input.longitude,
      mediaDataUri: input.photo,
      citizenCategoryHint: input.citizenCategoryHint,
    });
  } catch (err: any) {
    console.warn('[Orchestrator] Intake Agent failed, applying safe fallback:', err?.message);
    const receipt = createAgentReceipt({
      agent: 'intake_agent',
      status: 'fallback',
      startTime: pipelineStartTime,
      reasoning: 'Intake agent failed; used raw text fallback.',
    });
    intakeRes = {
      cleanedDescription: (input.description || '').trim(),
      mentionedLocation: input.location,
      urgencySignals: [],
      extractedIssueHints: input.citizenCategoryHint ? [input.citizenCategoryHint] : [],
      mediaAnalyzed: false,
      rawMediaAnalysis: null,
      receipt,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 2: Classification Agent
  // ---------------------------------------------------------------------------
  let classRes: ClassificationOutput;
  try {
    classRes = await classificationAgent({
      cleanedDescription: intakeRes.cleanedDescription,
      mediaAnalysis: intakeRes.rawMediaAnalysis,
      citizenCategoryHint: input.citizenCategoryHint,
      extractedIssueHints: intakeRes.extractedIssueHints,
    });
  } catch (err: any) {
    console.warn('[Orchestrator] Classification Agent failed, applying fallback:', err?.message);
    const receipt = createAgentReceipt({
      agent: 'classification_agent',
      status: 'fallback',
      startTime: pipelineStartTime,
      reasoning: 'Classification agent error; safely defaulted to General Infrastructure.',
    });
    classRes = {
      category: validateCategory(input.citizenCategoryHint || 'General Infrastructure'),
      confidence: 0.5,
      reasoning: 'Fallback classification.',
      isIllegalDumping: false,
      receipt,
    };
  }

  // Validate classification output strictly
  const validatedCategory = validateCategory(classRes.category);
  const validatedClassConfidence = clampConfidence(classRes.confidence, 0.6);

  // ---------------------------------------------------------------------------
  // Step 3: Routing Agent (departmentId-first)
  // ---------------------------------------------------------------------------
  let routeRes: RoutingOutput;
  try {
    routeRes = await routingAgent({
      category: validatedCategory,
      description: intakeRes.cleanedDescription,
      citizenDepartmentHint: undefined,
      classificationConfidence: validatedClassConfidence,
    });
  } catch (err: any) {
    console.warn('[Orchestrator] Routing Agent failed, applying safe fallback:', err?.message);
    const receipt = createAgentReceipt({
      agent: 'routing_agent',
      status: 'fallback',
      startTime: pipelineStartTime,
      reasoning: 'Routing agent error; safely defaulted to Public Works department.',
    });
    routeRes = {
      departmentId: 'dept_public_works',
      department: 'Public Works',
      confidence: 0.5,
      reasoning: 'Fallback routing executed.',
      routingPath: 'fallback_unassigned',
      receipt,
    };
  }

  // Validate routing output strictly
  const validatedDepartmentId = validateDepartmentId(routeRes.departmentId);
  const deptDef = normalizeDepartment(validatedDepartmentId);
  const legacyDepartment = deptDef?.name || routeRes.department || 'Public Works';
  const validatedRouteConfidence = clampConfidence(routeRes.confidence, 0.6);

  // ---------------------------------------------------------------------------
  // Step 4: Priority Agent
  // ---------------------------------------------------------------------------
  let prioRes: PriorityOutput;
  try {
    prioRes = await priorityAgent({
      category: validatedCategory,
      description: intakeRes.cleanedDescription,
      urgencySignals: intakeRes.urgencySignals,
      isIllegalDumping: classRes.isIllegalDumping,
      mediaSeverity: intakeRes.rawMediaAnalysis?.severity,
    });
  } catch (err: any) {
    console.warn('[Orchestrator] Priority Agent failed, applying safe fallback:', err?.message);
    const receipt = createAgentReceipt({
      agent: 'priority_agent',
      status: 'fallback',
      startTime: pipelineStartTime,
      reasoning: 'Priority agent error; defaulted to Medium priority.',
    });
    prioRes = {
      priority: 'Medium',
      confidence: 0.5,
      riskScore: 50,
      riskScoreReasons: ['Priority agent error; default applied.'],
      reasoning: 'Fallback priority.',
      receipt,
    };
  }

  // Validate priority output strictly
  const validatedPriority = validatePriority(prioRes.priority);
  const validatedPrioConfidence = clampConfidence(prioRes.confidence, 0.7);

  // ---------------------------------------------------------------------------
  // Step 5: Dedup Agent
  // ---------------------------------------------------------------------------
  let dedupRes: DedupOutput;
  try {
    dedupRes = await dedupAgent({
      category: validatedCategory,
      description: intakeRes.cleanedDescription,
      latitude: input.latitude,
      longitude: input.longitude,
      candidateReports: input.candidateReports || [],
      maxCandidateLimit: 5,
    });
  } catch (err: any) {
    console.warn('[Orchestrator] Dedup Agent failed, proceeding without duplicate link:', err?.message);
    const receipt = createAgentReceipt({
      agent: 'dedup_agent',
      status: 'fallback',
      startTime: pipelineStartTime,
      reasoning: 'Dedup agent error; skipped candidate linking.',
    });
    dedupRes = {
      isDuplicate: false,
      linkedIncidentId: null,
      linkedMatchType: 'none',
      linkedSimilarityScore: null,
      reasoning: 'Fallback dedup execution.',
      candidateCountEvaluated: 0,
      receipt,
    };
  }

  // ---------------------------------------------------------------------------
  // Step 6: Coordination Agent (Multi-Department Sub-Tasks)
  // ---------------------------------------------------------------------------
  let coordRes: CoordinationOutput;
  try {
    coordRes = await coordinationAgent({
      complaintId: input.complaintId || `RPT-${Math.floor(Math.random() * 8999 + 1000)}`,
      category: validatedCategory,
      description: intakeRes.cleanedDescription,
      primaryDepartmentId: validatedDepartmentId,
      primaryDepartmentName: legacyDepartment,
    });
  } catch (err: any) {
    console.warn('[Orchestrator] Coordination Agent failed, applying fallback:', err?.message);
    coordRes = {
      requiresMultiDepartment: false,
      departmentTasks: [
        {
          id: `TASK-01`,
          departmentId: validatedDepartmentId,
          departmentName: legacyDepartment,
          taskName: `Resolve ${validatedCategory} incident`,
          status: 'In Progress',
        },
      ],
      reasoning: 'Single department fallback task initialized.',
      receipt: createAgentReceipt({
        agent: 'coordination_agent',
        status: 'fallback',
        startTime: pipelineStartTime,
        reasoning: 'Coordination agent error.',
      }),
    };
  }

  // ---------------------------------------------------------------------------
  // Step 7: Confidence Evaluation & Routing Gate Decision
  // ---------------------------------------------------------------------------
  const overallConfidence = clampConfidence(
    (validatedClassConfidence + validatedRouteConfidence + validatedPrioConfidence) / 3,
    0.65
  );

  let routingGate: TriageResult['routingGate'] = 'automatic';
  let workflowStage: TriageResult['workflowStage'] = 'pending_department';
  let requiresManualReview = false;

  if (overallConfidence >= 0.85) {
    routingGate = 'automatic';
    workflowStage = 'pending_department';
  } else if (overallConfidence >= 0.65) {
    routingGate = 'department_verification';
    workflowStage = 'pending_department';
  } else {
    routingGate = 'manual_review';
    workflowStage = 'pending_admin';
    requiresManualReview = true;
  }

  const routingStatus: TriageResult['routingStatus'] = requiresManualReview ? 'needs_review' : 'assigned';

  // Auto-assignment policy decision
  const autoAssignEligible =
    routingGate === 'automatic' &&
    (validatedPriority === 'Critical' || (overallConfidence >= 0.75 && validatedPriority !== 'Low'));

  let assignedWorkerId: string | null = null;
  let assignedContractor: string | null = null;
  let queueStatus: TriageResult['queueStatus'] = 'pending_department';

  if (autoAssignEligible && input.availableWorkers && input.availableWorkers.length > 0) {
    const selectedWorker = selectBestEligibleWorker(validatedDepartmentId, input.availableWorkers, {
      category: validatedCategory,
      latitude: input.latitude,
      longitude: input.longitude,
    });

    if (selectedWorker) {
      assignedWorkerId = selectedWorker.id;
      assignedContractor = selectedWorker.name;
      queueStatus = 'assigned_worker';
      workflowStage = 'assigned_worker';
    }
  }

  const queuePosition = (input.currentDepartmentQueueCount || 0) + 1;
  const queuedAt = new Date().toISOString();

  // Illegal dumping metadata
  const mediaDumping = intakeRes.rawMediaAnalysis?.illegalDumping;
  const illegalDumpingPayload: IllegalDumpingData | null = mediaDumping?.detected
    ? {
        detected: true,
        confidence: mediaDumping.confidence ?? 0.85,
        wasteType: mediaDumping.wasteType || validatedCategory || 'General Waste',
        vehicleDetected: Boolean(mediaDumping.vehicleDetected),
        vehicleType: mediaDumping.vehicleType || null,
        licensePlateVisible: Boolean(mediaDumping.licensePlateVisible) && !!mediaDumping.licensePlateNumber,
        licensePlateNumber: mediaDumping.licensePlateNumber || null,
        evidenceQuality: mediaDumping.evidenceQuality || 'fair',
        reason: mediaDumping.reason || 'Visual evidence evaluated by triage pipeline.',
        verificationStatus: 'PENDING',
        fineDetails: {
          status: 'NOT_ISSUED',
        },
      }
    : null;

  const agentLogs: AgentLogEntry[] = [
    intakeRes.receipt,
    classRes.receipt,
    routeRes.receipt,
    prioRes.receipt,
    dedupRes.receipt,
    coordRes.receipt,
  ];

  return {
    departmentId: validatedDepartmentId,
    department: legacyDepartment,
    category: validatedCategory,
    priority: validatedPriority,
    riskScore: prioRes.riskScore,
    riskScoreReasons: prioRes.riskScoreReasons,
    departmentTasks: coordRes.departmentTasks,
    queueStatus,
    queuedAt,
    queuePosition,
    workflowStage,
    routingGate,
    assignedWorkerId,
    assignedContractor,
    autoAssignEligible,
    requiresManualReview,
    routingStatus,
    overallConfidence,
    routingReason: routeRes.reasoning,
    isDuplicate: dedupRes.isDuplicate,
    linkedIncidentId: dedupRes.isDuplicate ? dedupRes.linkedIncidentId : null,
    linkedMatchType: dedupRes.isDuplicate ? dedupRes.linkedMatchType : null,
    linkedSimilarityScore: dedupRes.isDuplicate ? dedupRes.linkedSimilarityScore : null,
    illegalDumping: illegalDumpingPayload,
    complaintType: illegalDumpingPayload ? 'Illegal Dumping' : 'Standard',
    agentLogs,
    aiAnalysis: intakeRes.rawMediaAnalysis ?? null,
  };
}

/**
 * Explicit Admin / Department Override Function (Requirement 10)
 * Allows authorized department heads or admins to override triage results.
 */
export function overrideReportAssignment(
  report: Report,
  overrideData: {
    departmentId?: string;
    priority?: 'Low' | 'Medium' | 'High' | 'Critical';
    assignedWorkerId?: string;
    assignedContractor?: string;
    notes?: string;
    overrideByUid: string;
    overrideByName: string;
  }
): Partial<Report> {
  const timestamp = new Date().toISOString();
  const updates: Partial<Report> & Record<string, any> = {
    updatedAt: timestamp,
  };

  if (overrideData.departmentId) {
    const validatedDeptId = validateDepartmentId(overrideData.departmentId);
    const deptDef = normalizeDepartment(validatedDeptId);
    updates.departmentId = validatedDeptId;
    updates.department = deptDef?.name || 'Department';
  }

  if (overrideData.priority) {
    updates.priority = validatePriority(overrideData.priority);
  }

  if (overrideData.assignedWorkerId !== undefined) {
    updates.assignedWorkerId = overrideData.assignedWorkerId;
    updates.assignedContractor = overrideData.assignedContractor || undefined;
    updates.workflowStage = overrideData.assignedWorkerId ? 'assigned_worker' : 'pending_department';
    updates.queueStatus = overrideData.assignedWorkerId ? 'assigned_worker' : 'pending_department';
    updates.assignmentMethod = 'admin_override';
  }

  const actionLogEntry: ActionLogEntry = {
    status: (report.status || 'Submitted') as Report['status'],
    timestamp,
    actor: 'Official',
    actorName: overrideData.overrideByName,
    notes: overrideData.notes || `Admin override: Updated department/priority/assignment parameters.`,
  };

  updates.actionLog = [...(report.actionLog || []), actionLogEntry];

  return updates;
}
