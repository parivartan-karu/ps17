/**
 * Verification test suite for Phase 1 Server Authorization and Access Boundaries
 */

import {
  requireDepartmentAccess,
  requireWorkerOwnTask,
  requireGlobalOfficialOrAdmin,
  RequestAuthError,
  type RequestIdentity,
} from './server-auth';
import type { Report, User as UserProfile } from './types';

// Mock identities for testing
const mockCitizenIdentity: RequestIdentity = {
  uid: 'citizen_123',
  email: 'citizen@example.com',
  role: 'citizen',
  profile: {
    id: 'citizen_123',
    name: 'Citizen User',
    email: 'citizen@example.com',
    role: 'citizen',
    points: 100,
  },
};

const mockWorker1Identity: RequestIdentity = {
  uid: 'worker_111',
  email: 'worker1@example.com',
  role: 'worker',
  profile: {
    id: 'worker_111',
    name: 'Worker One',
    email: 'worker1@example.com',
    role: 'worker',
    points: 0,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
  },
};

const mockWorker2Identity: RequestIdentity = {
  uid: 'worker_222',
  email: 'worker2@example.com',
  role: 'worker',
  profile: {
    id: 'worker_222',
    name: 'Worker Two',
    email: 'worker2@example.com',
    role: 'worker',
    points: 0,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
  },
};

const mockDeptHeadSanitation: RequestIdentity = {
  uid: 'head_sanitation_1',
  email: 'head.sanitation@example.com',
  role: 'department_head',
  profile: {
    id: 'head_sanitation_1',
    name: 'Sanitation Head',
    email: 'head.sanitation@example.com',
    role: 'department_head',
    points: 0,
    departmentId: 'dept_sanitation',
    department: 'Sanitation',
  },
};

const mockDeptHeadTraffic: RequestIdentity = {
  uid: 'head_traffic_1',
  email: 'head.traffic@example.com',
  role: 'department_head',
  profile: {
    id: 'head_traffic_1',
    name: 'Traffic Head',
    email: 'head.traffic@example.com',
    role: 'department_head',
    points: 0,
    departmentId: 'dept_traffic',
    department: 'Traffic & Roads',
  },
};

const mockOfficialIdentity: RequestIdentity = {
  uid: 'official_999',
  email: 'official@city.gov.in',
  role: 'official',
  profile: {
    id: 'official_999',
    name: 'City Official',
    email: 'official@city.gov.in',
    role: 'official',
    points: 0,
  },
};

// Mock Reports
const sanitationReport: Partial<Report> = {
  id: 'rep_sanitation_1',
  departmentId: 'dept_sanitation',
  department: 'Sanitation',
  assignedWorkerId: 'worker_111',
  assignedContractor: 'Worker One',
};

const trafficReport: Partial<Report> = {
  id: 'rep_traffic_1',
  departmentId: 'dept_traffic',
  department: 'Road Maintenance Department', // Legacy string
  assignedWorkerId: 'worker_333',
  assignedContractor: 'Worker Three',
};

export function runAuthVerification(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assertThrows(fn: () => void, testName: string) {
    try {
      fn();
      failed++;
      errors.push(`FAIL: ${testName} - Expected function to throw RequestAuthError, but it succeeded.`);
    } catch (err) {
      if (err instanceof RequestAuthError) {
        passed++;
      } else {
        failed++;
        errors.push(`FAIL: ${testName} - Threw unexpected error: ${(err as Error).message}`);
      }
    }
  }

  function assertDoesNotThrow(fn: () => void, testName: string) {
    try {
      fn();
      passed++;
    } catch (err) {
      failed++;
      errors.push(`FAIL: ${testName} - Threw error: ${(err as Error).message}`);
    }
  }

  // Test 1: Citizen cannot access department data
  assertThrows(
    () => requireDepartmentAccess(sanitationReport, mockCitizenIdentity),
    'Test 1: Citizen accessing department report'
  );

  // Test 2: Worker cannot access another worker\'s task
  assertThrows(
    () => requireWorkerOwnTask(trafficReport, mockWorker1Identity),
    'Test 2: Worker 1 accessing Worker 3 task'
  );
  assertDoesNotThrow(
    () => requireWorkerOwnTask(sanitationReport, mockWorker1Identity),
    'Test 2b: Worker 1 accessing own task'
  );

  // Test 3: Department head cannot access another department\'s report
  assertThrows(
    () => requireDepartmentAccess(trafficReport, mockDeptHeadSanitation),
    'Test 3: Sanitation Head accessing Traffic report'
  );
  assertDoesNotThrow(
    () => requireDepartmentAccess(sanitationReport, mockDeptHeadSanitation),
    'Test 3b: Sanitation Head accessing Sanitation report'
  );
  assertDoesNotThrow(
    () => requireDepartmentAccess(trafficReport, mockDeptHeadTraffic),
    'Test 3c: Traffic Head accessing Traffic report (with legacy alias string)'
  );

  // Test 4: Official / Admin can access cross-department data
  assertDoesNotThrow(
    () => requireDepartmentAccess(sanitationReport, mockOfficialIdentity),
    'Test 4a: Official accessing Sanitation report'
  );
  assertDoesNotThrow(
    () => requireDepartmentAccess(trafficReport, mockOfficialIdentity),
    'Test 4b: Official accessing Traffic report'
  );
  assertDoesNotThrow(
    () => requireGlobalOfficialOrAdmin(mockOfficialIdentity),
    'Test 4c: Official passes global official check'
  );
  assertThrows(
    () => requireGlobalOfficialOrAdmin(mockDeptHeadSanitation),
    'Test 4d: Dept Head fails global official check'
  );

  return { passed, failed, errors };
}

// Runnable entry point
if (typeof require !== 'undefined' && require.main === module) {
  const result = runAuthVerification();
  console.log(`Server authorization verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
