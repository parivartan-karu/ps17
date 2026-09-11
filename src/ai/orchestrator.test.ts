/**
 * Phase 4 Verification Test Suite for Multi-Agent Pipeline Orchestrator
 */

import { runTriagePipeline, selectBestEligibleWorker, overrideReportAssignment, type EligibleWorker } from './orchestrator';
import { CANONICAL_DEPARTMENT_IDS, type CanonicalDepartmentId } from '@/lib/departments';
import type { Report } from '@/lib/types';

export async function runOrchestratorVerificationTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: ${msg}`);
    }
  }

  // Test 1: Full Triage Pipeline Execution
  const sampleInput = {
    description: 'Large garbage heap dumped near central market street blocking traffic.',
    location: 'Central Market, Ward 4',
    latitude: 18.5204,
    longitude: 73.8567,
    citizenCategoryHint: 'Garbage/Debris',
  };

  const triage = await runTriagePipeline(sampleInput);

  assert(CANONICAL_DEPARTMENT_IDS.includes(triage.departmentId), `Valid canonical departmentId: ${triage.departmentId}`);
  assert(triage.department === 'Sanitation', `Preserved legacy display name: ${triage.department}`);
  assert(triage.category === 'Garbage/Debris' || triage.category === 'Illegal Dumping', `Derived category: ${triage.category}`);
  assert(['Low', 'Medium', 'High', 'Critical'].includes(triage.priority), `Derived priority: ${triage.priority}`);
  assert(triage.queueStatus === 'pending_department' || triage.queueStatus === 'assigned_worker', `Queue status set: ${triage.queueStatus}`);
  assert(typeof triage.queuedAt === 'string', 'QueuedAt ISO timestamp present');
  assert(typeof triage.queuePosition === 'number', 'Queue position index present');
  assert(Array.isArray(triage.agentLogs) && triage.agentLogs.length === 5, `5 structured agent receipts generated: ${triage.agentLogs.length}`);

  // Test 2: Department-Strict Worker Selection (Requirements 8 & 9)
  const mockWorkers: EligibleWorker[] = [
    {
      id: 'worker-san-1',
      name: 'Ramesh Sanitation Worker',
      departmentId: 'dept_sanitation',
      isAvailable: true,
      activeTasks: 2,
      maxTaskCapacity: 5,
      skillType: 'Garbage',
    },
    {
      id: 'worker-san-2',
      name: 'Suresh Sanitation Worker',
      departmentId: 'dept_sanitation',
      isAvailable: true,
      activeTasks: 0, // Least busy
      maxTaskCapacity: 5,
      skillType: 'Garbage',
    },
    {
      id: 'worker-eng-1',
      name: 'Civil Engineer Worker',
      departmentId: 'dept_engineering',
      isAvailable: true,
      activeTasks: 0,
      maxTaskCapacity: 5,
    },
  ];

  const selectedWorker = selectBestEligibleWorker('dept_sanitation', mockWorkers, { category: 'Garbage/Debris' });

  assert(selectedWorker !== null, 'Worker selected for Sanitation department');
  assert(selectedWorker?.id === 'worker-san-2', `Selected least busy worker strictly from Sanitation: ${selectedWorker?.name}`);
  assert(selectedWorker?.departmentId === 'dept_sanitation', 'Worker belongs strictly to routed departmentId');

  // Test 3: Admin / Department Override Path (Requirement 10)
  const dummyReport: Report = {
    id: 'RPT-101',
    userId: 'user-1',
    userName: 'Test Citizen',
    location: 'MG Road',
    description: 'Broken streetlight pole',
    imageUrl: 'data:image/jpeg;base64,sample',
    imageHint: 'streetlight',
    timestamp: new Date().toISOString(),
    status: 'Submitted',
    department: 'Electrical',
    departmentId: 'dept_electrical',
    category: 'Streetlight Issue',
    priority: 'Medium',
  };

  const overridden = overrideReportAssignment(dummyReport, {
    departmentId: 'dept_public_works',
    priority: 'Critical',
    assignedWorkerId: 'worker-pw-9',
    assignedContractor: 'Public Works Lead',
    overrideByUid: 'admin-uid-1',
    overrideByName: 'Admin Officer',
    notes: 'Reassigned to Public Works due to structural pole damage.',
  });

  assert(overridden.departmentId === 'dept_public_works', 'Override updated departmentId to dept_public_works');
  assert(overridden.department === 'Public Works', 'Override updated display department to Public Works');
  assert(overridden.priority === 'Critical', 'Override updated priority to Critical');
  assert(overridden.assignedWorkerId === 'worker-pw-9', 'Override assigned target worker ID');
  assert(Boolean(overridden.actionLog && overridden.actionLog.length > 0), 'Override recorded audit action log');

  return { passed, failed, errors };
}

// Self-executing if run directly
if (typeof require !== 'undefined' && require.main === module) {
  runOrchestratorVerificationTests().then((res) => {
    console.log(`Orchestrator Verification Tests: ${res.passed} passed, ${res.failed} failed.`);
    if (res.failed > 0) {
      console.error(res.errors.join('\n'));
      process.exit(1);
    }
  });
}
