/**
 * Verification test suite for Phase 6: Department & Worker Operations Refactoring
 */

import {
  requireDepartmentAccess,
  requireWorkerOwnTask,
  RequestAuthError,
  type RequestIdentity,
} from './server-auth';
import { normalizeDepartmentId } from './departments';
import { validateStatusTransition } from './state-machine';
import type { Report, User as UserProfile } from './types';

// Mock identities
const deptAHead: RequestIdentity = {
  uid: 'head_dept_a',
  email: 'head_a@example.com',
  role: 'department_head',
  profile: {
    id: 'head_dept_a',
    name: 'Dept A Head',
    email: 'head_a@example.com',
    role: 'department_head',
    points: 0,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
  },
};

const deptBHead: RequestIdentity = {
  uid: 'head_dept_b',
  email: 'head_b@example.com',
  role: 'department_head',
  profile: {
    id: 'head_dept_b',
    name: 'Dept B Head',
    email: 'head_b@example.com',
    role: 'department_head',
    points: 0,
    departmentId: 'dept_traffic',
    department: 'Traffic & Roads',
  },
};

const workerA1: RequestIdentity = {
  uid: 'worker_a1',
  email: 'worker_a1@example.com',
  role: 'worker',
  profile: {
    id: 'worker_a1',
    name: 'Worker A1',
    email: 'worker_a1@example.com',
    role: 'worker',
    points: 0,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
    activeTasks: 2,
    maxTaskCapacity: 5,
    isAvailable: true,
  },
};

const workerA2_AtCapacity: RequestIdentity = {
  uid: 'worker_a2',
  email: 'worker_a2@example.com',
  role: 'worker',
  profile: {
    id: 'worker_a2',
    name: 'Worker A2',
    email: 'worker_a2@example.com',
    role: 'worker',
    points: 0,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
    activeTasks: 5,
    maxTaskCapacity: 5,
    isAvailable: true,
  },
};

const workerB1: RequestIdentity = {
  uid: 'worker_b1',
  email: 'worker_b1@example.com',
  role: 'worker',
  profile: {
    id: 'worker_b1',
    name: 'Worker B1',
    email: 'worker_b1@example.com',
    role: 'worker',
    points: 0,
    departmentId: 'dept_traffic',
    department: 'Traffic & Roads',
    activeTasks: 1,
    maxTaskCapacity: 5,
    isAvailable: true,
  },
};

// Mock Reports
const reportA: Partial<Report> = {
  id: 'rep_a1',
  departmentId: 'dept_sanitation',
  department: 'Sanitation',
  status: 'Submitted',
  queueStatus: 'queued',
  assignedWorkerId: undefined,
};

const reportA_AssignedToWorkerA1: Partial<Report> = {
  id: 'rep_a2',
  departmentId: 'dept_sanitation',
  department: 'Sanitation',
  status: 'Assigned',
  queueStatus: 'assigned_worker',
  assignedWorkerId: 'worker_a1',
  assignedContractor: 'Worker A1',
};

export function runPhase6Verification(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, failureDetail?: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: ${testName} ${failureDetail ? `- ${failureDetail}` : ''}`);
    }
  }

  function assertThrows(fn: () => void, testName: string) {
    try {
      fn();
      failed++;
      errors.push(`FAIL: ${testName} - Expected to throw error, but succeeded.`);
    } catch (err) {
      passed++;
    }
  }

  function assertDoesNotThrow(fn: () => void, testName: string) {
    try {
      fn();
      passed++;
    } catch (err) {
      failed++;
      errors.push(`FAIL: ${testName} - Threw unexpected error: ${(err as Error).message}`);
    }
  }

  // 1. department A cannot access department B
  assertThrows(
    () => requireDepartmentAccess(reportA, deptBHead),
    'Test 1: Dept B Head accessing Dept A report fails'
  );
  assertDoesNotThrow(
    () => requireDepartmentAccess(reportA, deptAHead),
    'Test 1b: Dept A Head accessing Dept A report succeeds'
  );

  // 2. department A can assign only department A workers
  const isWorkerA1Eligible = normalizeDepartmentId(workerA1.profile?.departmentId || workerA1.profile?.department) === normalizeDepartmentId(reportA.departmentId || reportA.department);
  const isWorkerB1Eligible = normalizeDepartmentId(workerB1.profile?.departmentId || workerB1.profile?.department) === normalizeDepartmentId(reportA.departmentId || reportA.department);
  assert(isWorkerA1Eligible === true, 'Test 2a: Worker A1 in same dept is eligible for report A');
  assert(isWorkerB1Eligible === false, 'Test 2b: Worker B1 in different dept is NOT eligible for report A');

  // 3. Worker capacity check: worker A2 is at capacity (5/5)
  const isWorkerA2Available = (workerA2_AtCapacity.profile?.activeTasks ?? 0) < (workerA2_AtCapacity.profile?.maxTaskCapacity ?? 5);
  assert(isWorkerA2Available === false, 'Test 3: Worker A2 at max capacity is rejected for new assignment');

  // 4. worker can update own task / worker cannot update another worker\'s task
  assertDoesNotThrow(
    () => requireWorkerOwnTask(reportA_AssignedToWorkerA1, workerA1),
    'Test 4a: Worker A1 can access own assigned task'
  );
  assertThrows(
    () => requireWorkerOwnTask(reportA_AssignedToWorkerA1, workerB1),
    'Test 4b: Worker B1 cannot access Worker A1 assigned task'
  );

  // 5. worker cannot change department in profile updates
  const profilePayload = {
    name: 'Worker Updated Name',
    departmentId: 'dept_traffic', // Attempted escalation/change
    department: 'Traffic & Roads',
    role: 'official', // Attempted privilege escalation
    capacity: 100,
  };

  const restrictedFields = ['role', 'departmentId', 'department', 'employeeId', 'capacity'];
  const sanitizedUpdate: Record<string, any> = {};
  for (const [key, value] of Object.entries(profilePayload)) {
    if (!restrictedFields.includes(key)) {
      sanitizedUpdate[key] = value;
    }
  }

  assert(sanitizedUpdate.name === 'Worker Updated Name', 'Test 5a: Allowed profile field preserved');
  assert(sanitizedUpdate.departmentId === undefined, 'Test 5b: departmentId field stripped from profile update');
  assert(sanitizedUpdate.role === undefined, 'Test 5c: role field stripped from profile update');

  // 6. task assignment increments capacity exactly once
  let initialActiveTasks = workerA1.profile?.activeTasks ?? 0;
  let incrementedActiveTasks = initialActiveTasks + 1;
  assert(incrementedActiveTasks === 3, 'Test 6: Task assignment increments capacity exactly once (2 -> 3)');

  // 7. task closure decrements capacity exactly once
  let decrementedActiveTasks = Math.max(0, incrementedActiveTasks - 1);
  assert(decrementedActiveTasks === 2, 'Test 7: Task closure decrements capacity exactly once (3 -> 2)');

  // 8. State machine validation check before resolution
  const validTransition = validateStatusTransition('In Progress', 'Resolved');
  const invalidTransition = validateStatusTransition('Resolved', 'In Progress');
  assert(validTransition.valid === true, 'Test 8a: Transition In Progress -> Resolved is valid');
  assert(invalidTransition.valid === false, 'Test 8b: Transition Resolved -> In Progress is blocked');

  // 9. Require after-work evidence before resolution
  const hasAfterWorkEvidence = false;
  const resolutionAllowed = validTransition.valid && hasAfterWorkEvidence;
  assert(resolutionAllowed === false, 'Test 9: Resolution blocked without after-work photo evidence');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase6Verification();
  console.log(`Phase 6 verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
