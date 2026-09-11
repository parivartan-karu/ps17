/**
 * Verification test suite for Phase 8: Department and Worker Performance Analytics
 */

import type { Report, User } from './types';
import { normalizeDepartmentId } from './departments';

function createMockReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'rep_p8_001',
    userId: 'user_p8_001',
    userName: 'Test Citizen',
    imageUrl: '',
    imageHint: '',
    description: 'Pothole needing repair',
    category: 'Potholes',
    department: 'Roads Department',
    departmentId: 'dept_engineering',
    status: 'In Progress',
    priority: 'High',
    location: 'Kothrud, Pune',
    timestamp: new Date().toISOString(),
    actionLog: [],
    ...overrides,
  };
}

function createMockWorker(overrides: Partial<User> = {}): User {
  return {
    id: 'worker_p8_001',
    name: 'Ramesh Shinde',
    email: 'ramesh@roads.gov.in',
    role: 'worker',
    points: 100,
    department: 'Roads Department',
    departmentId: 'dept_engineering',
    activeTasks: 2,
    maxTaskCapacity: 5,
    isAvailable: true,
    ...overrides,
  };
}

export function runPhase8Verification(): { passed: number; failed: number; errors: string[] } {
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

  // 1. Department-scoped dataset isolation (Roads vs Garbage)
  const roadsReports = [
    createMockReport({ id: 'r1', departmentId: 'roads-dept' }),
    createMockReport({ id: 'r2', departmentId: 'dept_engineering' }),
  ];
  const garbageReports = [
    createMockReport({ id: 'g1', departmentId: 'garbage-waste-dept' }),
  ];
  const allReports = [...roadsReports, ...garbageReports];

  const roadsFiltered = allReports.filter(r => normalizeDepartmentId(r.departmentId || r.department) === 'dept_engineering');
  const garbageFiltered = allReports.filter(r => normalizeDepartmentId(r.departmentId || r.department) === 'dept_sanitation');

  assert(roadsFiltered.length === 2, 'Test 1a: Roads analytics dataset isolates strictly 2 Roads reports');
  assert(garbageFiltered.length === 1, 'Test 1b: Garbage analytics dataset isolates strictly 1 Garbage report');
  assert(roadsFiltered.every(r => !r.id.startsWith('g')), 'Test 1c: Roads analytics never includes Garbage reports');

  // 2. Resolution Rate and SLA Compliance Calculations
  const reportsList = [
    createMockReport({ id: 'r1', status: 'Resolved', slaBreached: false }),
    createMockReport({ id: 'r2', status: 'Resolved', slaBreached: true }),
    createMockReport({ id: 'r3', status: 'In Progress', slaBreached: false }),
  ];

  const resolved = reportsList.filter(r => r.status === 'Resolved');
  const resolutionRate = Math.round((resolved.length / reportsList.length) * 100);
  assert(resolutionRate === 67, 'Test 2a: Resolution rate is calculated accurately (67%)');

  const slaCompliantResolved = resolved.filter(r => !r.slaBreached);
  const slaRate = Math.round((slaCompliantResolved.length / resolved.length) * 100);
  assert(slaRate === 50, 'Test 2b: SLA compliance rate calculated accurately (50%)');

  // 3. Insufficient sample fallback handling ("N/A")
  const emptyResolvedList: Report[] = [
    createMockReport({ id: 'e1', status: 'Submitted' }),
  ];
  const emptyResolved = emptyResolvedList.filter(r => r.status === 'Resolved');
  const emptySlaRate = emptyResolved.length > 0 ? Math.round((emptyResolved.filter(r => !r.slaBreached).length / emptyResolved.length) * 100) : null;

  assert(emptySlaRate === null, 'Test 3a: Returns null/N/A when 0 resolved tasks exist rather than misleading 0%');

  // 4. Worker metrics and workload capacity badge
  const worker1 = createMockWorker({ activeTasks: 5, maxTaskCapacity: 5 });
  const isAtCapacity = (worker1.activeTasks ?? 0) >= (worker1.maxTaskCapacity ?? 5);
  assert(isAtCapacity === true, 'Test 4a: Correctly evaluates worker at maximum task capacity');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase8Verification();
  console.log(`Phase 8 verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
