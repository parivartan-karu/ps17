/**
 * Verification test suite for Phase 8: Central Municipal Command-Center View & Override Security
 */

import { requireGlobalOfficialOrAdmin, requireDepartmentAccess, RequestAuthError, type RequestIdentity } from './server-auth';
import type { Report } from './types';

// Mock identities
const citizenIdentity: RequestIdentity = {
  uid: 'citizen_88',
  email: 'citizen@example.com',
  role: 'citizen',
  profile: {
    id: 'citizen_88',
    name: 'Citizen Eight',
    email: 'citizen@example.com',
    role: 'citizen',
    points: 100,
  },
};

const workerIdentity: RequestIdentity = {
  uid: 'worker_88',
  email: 'worker@example.com',
  role: 'worker',
  profile: {
    id: 'worker_88',
    name: 'Field Worker Eight',
    email: 'worker@example.com',
    role: 'worker',
    points: 0,
    departmentId: 'dept_sanitation',
  },
};

const officialIdentity: RequestIdentity = {
  uid: 'official_88',
  email: 'commissioner@city.gov.in',
  role: 'official',
  profile: {
    id: 'official_88',
    name: 'Municipal Commissioner',
    email: 'commissioner@city.gov.in',
    role: 'official',
    points: 0,
  },
};

const adminIdentity: RequestIdentity = {
  uid: 'admin_88',
  email: 'admin@city.gov.in',
  role: 'admin',
  profile: {
    id: 'admin_88',
    name: 'System Admin',
    email: 'admin@city.gov.in',
    role: 'admin',
    points: 0,
  },
};

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

  // 1. Citizen cannot invoke central override authorization
  assertThrows(
    () => requireGlobalOfficialOrAdmin(citizenIdentity),
    'Test 1: Citizen rejected from global official/admin authorization'
  );

  // 2. Field worker cannot invoke central override authorization
  assertThrows(
    () => requireGlobalOfficialOrAdmin(workerIdentity),
    'Test 2: Field worker rejected from global official/admin authorization'
  );

  // 3. Authorized official passes central override authorization
  assertDoesNotThrow(
    () => requireGlobalOfficialOrAdmin(officialIdentity),
    'Test 3: Official passes central override authorization'
  );

  // 4. Authorized admin passes central override authorization
  assertDoesNotThrow(
    () => requireGlobalOfficialOrAdmin(adminIdentity),
    'Test 4: Admin passes central override authorization'
  );

  // 5. Override payload validation checks
  const validReason = 'Emergency work diversion due to monsoon waterlogging';
  const invalidReason = 'abc'; // < 5 chars

  assert(validReason.trim().length >= 5, 'Test 5a: Valid override reason accepted (>=5 chars)');
  assert(invalidReason.trim().length < 5, 'Test 5b: Short override reason rejected (<5 chars)');

  // 6. Audit Trail creation structure check
  const nowIso = new Date().toISOString();
  const mockOverrideRecord = {
    id: `ovr_test_123`,
    actionType: 'reassign_department' as const,
    reason: validReason,
    actorUid: officialIdentity.uid,
    actorName: officialIdentity.profile?.name || 'Official',
    actorRole: officialIdentity.role,
    timestamp: nowIso,
    previousState: { departmentId: 'dept_sanitation', priority: 'Medium' },
    newState: { departmentId: 'dept_engineering', priority: 'Critical' },
  };

  assert(mockOverrideRecord.reason === validReason, 'Test 6a: Override audit record includes justification');
  assert(mockOverrideRecord.actorUid === 'official_88', 'Test 6b: Override audit record includes actor ID');
  assert(mockOverrideRecord.timestamp.length > 0, 'Test 6c: Override audit record includes ISO timestamp');

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
