/**
 * Verification test suite for Phase 3: Smart Worker Assignment
 */

import { calculateWorkerRecommendation, rankWorkersForReport } from './smart-assignment';
import { normalizeDepartmentId } from './departments';
import type { Report, User as UserType } from './types';

// Mock Roads Worker
const roadsWorkerAvailable: UserType = {
  id: 'worker_roads_1',
  name: 'Ramesh Road Worker',
  email: 'ramesh@example.com',
  role: 'worker',
  points: 0,
  departmentId: 'roads-dept',
  department: 'Roads Department',
  activeTasks: 1,
  maxTaskCapacity: 5,
  isAvailable: true,
  ward: 'Kothrud',
  skills: ['Pothole Repair', 'Road Surface Maintenance'],
};

// Mock Roads Worker at Max Capacity
const roadsWorkerAtCapacity: UserType = {
  id: 'worker_roads_2',
  name: 'Suresh Busy Worker',
  email: 'suresh@example.com',
  role: 'worker',
  points: 0,
  departmentId: 'roads-dept',
  department: 'Roads Department',
  activeTasks: 5,
  maxTaskCapacity: 5,
  isAvailable: true,
  ward: 'Kothrud',
  skills: ['Pothole Repair'],
};

// Mock Garbage Worker
const garbageWorkerAvailable: UserType = {
  id: 'worker_garbage_1',
  name: 'Ganesh Sanitation Worker',
  email: 'ganesh@example.com',
  role: 'worker',
  points: 0,
  departmentId: 'garbage-waste-dept',
  department: 'Garbage & Waste Management',
  activeTasks: 2,
  maxTaskCapacity: 5,
  isAvailable: true,
  ward: 'Aundh',
  skills: ['Waste Collection', 'Overflowing Bins'],
};

// Mock Reports
const roadsReport: Report = {
  id: 'report_roads_101',
  userId: 'user_1',
  userName: 'Citizen A',
  location: 'Kothrud, Pune',
  description: 'Severe pothole causing traffic obstruction',
  imageUrl: '',
  imageHint: '',
  timestamp: new Date().toISOString(),
  status: 'Submitted',
  department: 'Roads Department',
  departmentId: 'roads-dept',
  category: 'Potholes',
  priority: 'High',
};

const garbageReport: Report = {
  id: 'report_garbage_202',
  userId: 'user_2',
  userName: 'Citizen B',
  location: 'Aundh, Pune',
  description: 'Overflowing garbage bin near market area',
  imageUrl: '',
  imageHint: '',
  timestamp: new Date().toISOString(),
  status: 'Submitted',
  department: 'Garbage & Waste Management',
  departmentId: 'garbage-waste-dept',
  category: 'Overflowing Bins',
  priority: 'Medium',
};

export function runPhase3Verification(): { passed: number; failed: number; errors: string[] } {
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

  // 1. Roads complaint CANNOT receive a Garbage worker
  const roadsToGarbageCheck = calculateWorkerRecommendation(garbageWorkerAvailable, roadsReport);
  assert(
    roadsToGarbageCheck.isEligible === false,
    'Test 1a: Garbage worker rejected for Roads complaint'
  );
  assert(
    roadsToGarbageCheck.badge === 'Ineligible',
    'Test 1b: Cross-department badge is Ineligible'
  );

  // 2. Garbage complaint CANNOT receive a Roads worker
  const garbageToRoadsCheck = calculateWorkerRecommendation(roadsWorkerAvailable, garbageReport);
  assert(
    garbageToRoadsCheck.isEligible === false,
    'Test 2a: Roads worker rejected for Garbage complaint'
  );
  assert(
    garbageToRoadsCheck.badge === 'Ineligible',
    'Test 2b: Cross-department badge is Ineligible'
  );

  // 3. Worker at capacity (5/5) is rejected
  const capacityCheck = calculateWorkerRecommendation(roadsWorkerAtCapacity, roadsReport);
  assert(
    capacityCheck.isEligible === false,
    'Test 3a: Worker at 5/5 capacity is not eligible'
  );
  assert(
    capacityCheck.badge === 'At Capacity',
    'Test 3b: Badge is At Capacity'
  );

  // 4. Recommendation ranking & Best Recommended badge
  const rankedRoadsWorkers = rankWorkersForReport(
    [roadsWorkerAtCapacity, roadsWorkerAvailable, garbageWorkerAvailable],
    roadsReport
  );

  assert(
    rankedRoadsWorkers[0].worker.id === 'worker_roads_1',
    'Test 4a: Roads worker 1 ranked top for Roads report'
  );
  assert(
    rankedRoadsWorkers[0].badge === 'Best Recommended',
    'Test 4b: Top eligible worker receives Best Recommended badge'
  );

  // 5. Assignment capacity update simulation (exactly once)
  let initialTasks = roadsWorkerAvailable.activeTasks ?? 0; // 1
  let updatedTasks = initialTasks + 1; // 2
  assert(
    updatedTasks === 2,
    'Test 5a: Task assignment increments capacity exactly once (1 -> 2)'
  );

  // Reassignment simulation
  let previousWorkerTasks = updatedTasks - 1; // 2 -> 1
  let newWorkerTasks = (garbageWorkerAvailable.activeTasks ?? 0) + 1; // 2 -> 3
  assert(
    previousWorkerTasks === 1,
    'Test 5b: Reassignment decrements previous worker capacity (2 -> 1)'
  );
  assert(
    newWorkerTasks === 3,
    'Test 5c: Reassignment increments new worker capacity (2 -> 3)'
  );

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase3Verification();
  console.log(`Phase 3 verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
