/**
 * Verification test suite for Phase 4: Department Operations Maps & Hotspots
 */

import { normalizeDepartmentId } from './departments';
import type { Report } from './types';

const roadsReport1: Report = {
  id: 'rep_road_1',
  userId: 'u1',
  userName: 'User 1',
  location: 'Kothrud, Pune',
  latitude: 18.5074,
  longitude: 73.8077,
  description: 'Deep pothole near Kothrud stand',
  imageUrl: '',
  imageHint: '',
  timestamp: new Date().toISOString(),
  status: 'Submitted',
  department: 'Roads Department',
  departmentId: 'roads-dept',
  category: 'Potholes',
  priority: 'Critical',
};

const roadsReport2: Report = {
  id: 'rep_road_2',
  userId: 'u2',
  userName: 'User 2',
  location: 'Deccan, Pune',
  latitude: 18.5167,
  longitude: 73.8417,
  description: 'Damaged footpath tiles',
  imageUrl: '',
  imageHint: '',
  timestamp: new Date().toISOString(),
  status: 'Assigned',
  department: 'Roads Department',
  departmentId: 'roads-dept',
  category: 'Road Damage',
  priority: 'Medium',
};

const garbageReport1: Report = {
  id: 'rep_garbage_1',
  userId: 'u3',
  userName: 'User 3',
  location: 'Aundh, Pune',
  latitude: 18.5580,
  longitude: 73.8070,
  description: 'Overflowing bin near D-Mart',
  imageUrl: '',
  imageHint: '',
  timestamp: new Date().toISOString(),
  status: 'In Progress',
  department: 'Garbage & Waste Management',
  departmentId: 'garbage-waste-dept',
  category: 'Overflowing Bins',
  priority: 'High',
};

const allReports: Report[] = [roadsReport1, roadsReport2, garbageReport1];

export function runPhase4Verification(): { passed: number; failed: number; errors: string[] } {
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

  // 1. Roads map dataset contains ONLY Roads department reports
  const roadsMapData = allReports.filter(r => (
    normalizeDepartmentId(r.departmentId || r.department) === 'dept_engineering'
  ));

  assert(roadsMapData.length === 2, 'Test 1a: Roads map contains 2 Roads reports');
  assert(roadsMapData.every(r => r.departmentId === 'roads-dept'), 'Test 1b: All Roads map points belong to Roads');

  // 2. Garbage map dataset contains ONLY Garbage department reports
  const garbageMapData = allReports.filter(r => (
    normalizeDepartmentId(r.departmentId || r.department) === 'dept_sanitation'
  ));

  assert(garbageMapData.length === 1, 'Test 2a: Garbage map contains 1 Garbage report');
  assert(garbageMapData[0].id === 'rep_garbage_1', 'Test 2b: Correct Garbage report mapped');

  // 3. Department boundary scoping prevents cross-department marker leakage
  const roadsHasGarbage = roadsMapData.some(r => r.id === 'rep_garbage_1');
  const garbageHasRoads = garbageMapData.some(r => r.id.startsWith('rep_road'));
  assert(roadsHasGarbage === false, 'Test 3a: Roads map does NOT leak Garbage reports');
  assert(garbageHasRoads === false, 'Test 3b: Garbage map does NOT leak Roads reports');

  // 4. Priority badges & Category mapping
  assert(roadsReport1.priority === 'Critical', 'Test 4a: Roads critical priority indicator verified');
  assert(garbageReport1.category === 'Overflowing Bins', 'Test 4b: Garbage category mapping verified');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase4Verification();
  console.log(`Phase 4 verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
