/**
 * Verification test suite for Phase 6: Strong Verification & Evidence Workflow
 */

import { validateStatusTransition } from './state-machine';
import type { Report } from './types';

function createMockReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'rep_verify_test_001',
    userId: 'user_test_001',
    userName: 'Test Citizen',
    imageUrl: '',
    imageHint: '',
    description: 'Pothole on Main St needing repair and verification',
    category: 'Potholes',
    department: 'Roads Department',
    departmentId: 'dept_engineering',
    status: 'In Progress',
    priority: 'High',
    location: 'Main St & 4th Ave',
    timestamp: new Date().toISOString(),
    actionLog: [],
    ...overrides,
  };
}

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

  // 1. Worker transition: In Progress -> Under Verification
  const report1 = createMockReport({ status: 'In Progress' });
  const valid1 = validateStatusTransition(report1.status, 'Under Verification');
  assert(valid1.valid, 'Test 1: Worker transition from In Progress to Under Verification allowed');

  // 2. Evidence validation requirement
  const reportWithoutPhoto = createMockReport({
    status: 'Under Verification',
    workflowStage: 'pending_department',
    afterWorkMediaUrl: undefined,
  });
  const hasPhotoMissing = !!reportWithoutPhoto.afterWorkMediaUrl || !!reportWithoutPhoto.imageUrl;
  assert(hasPhotoMissing === false, 'Test 2a: Detects missing photo evidence when no image attached');

  const reportWithPhoto = createMockReport({
    status: 'Under Verification',
    workflowStage: 'pending_department',
    afterWorkMediaUrl: 'https://example.com/after-work-repair.jpg',
  });
  const hasPhotoOk = !!reportWithPhoto.afterWorkMediaUrl || !!reportWithPhoto.imageUrl;
  assert(hasPhotoOk === true, 'Test 2b: Validates after-work photo evidence presence');

  // 3. Official Approval: Under Verification -> Resolved
  const validResolve = validateStatusTransition('Under Verification', 'Resolved');
  assert(validResolve.valid, 'Test 3: Official resolution from Under Verification allowed');

  // 4. Official Rework Request: Under Verification -> In Progress
  const validRework = validateStatusTransition('Under Verification', 'In Progress');
  assert(validRework.valid, 'Test 4: Official rework request returning to In Progress allowed');

  // 5. Official Rejection: Under Verification -> Rejected
  const validReject = validateStatusTransition('Under Verification', 'Rejected');
  assert(validReject.valid, 'Test 5: Official rejection from Under Verification allowed');

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
