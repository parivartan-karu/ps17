import {
  normalizeDepartment,
  normalizeDepartmentId,
  CANONICAL_DEPARTMENTS,
  type CanonicalDepartmentId,
} from './departments';

const TEST_CASES: Array<{ input: string; expectedId: CanonicalDepartmentId }> = [
  { input: 'dept_engineering', expectedId: 'dept_engineering' },
  { input: 'dept_sanitation', expectedId: 'dept_sanitation' },
  { input: 'dept_electrical', expectedId: 'dept_electrical' },
  { input: 'dept_water', expectedId: 'dept_water' },
  { input: 'dept_parks', expectedId: 'dept_parks' },
  { input: 'dept_traffic', expectedId: 'dept_traffic' },
  { input: 'dept_public_works', expectedId: 'dept_public_works' },
  { input: 'Engineering', expectedId: 'dept_engineering' },
  { input: 'Sanitation', expectedId: 'dept_sanitation' },
  { input: 'Electrical', expectedId: 'dept_electrical' },
  { input: 'Water Supply', expectedId: 'dept_water' },
  { input: 'Parks & Environment', expectedId: 'dept_parks' },
  { input: 'Traffic & Roads', expectedId: 'dept_traffic' },
  { input: 'Public Works', expectedId: 'dept_public_works' },
  { input: 'Road Maintenance Department', expectedId: 'dept_traffic' },
  { input: 'Solid Waste Management Department', expectedId: 'dept_sanitation' },
  { input: 'Water & Drainage Department', expectedId: 'dept_water' },
  { input: 'Electrical Department', expectedId: 'dept_electrical' },
  { input: 'Construction & Public Works Department', expectedId: 'dept_public_works' },
  { input: 'Garbage Dept', expectedId: 'dept_sanitation' },
  { input: 'Cleanliness', expectedId: 'dept_sanitation' },
  { input: 'Solid Waste Management', expectedId: 'dept_sanitation' },
  { input: 'Parks and Environment', expectedId: 'dept_parks' },
  { input: 'PWD', expectedId: 'dept_public_works' },
  { input: 'Civil Engineering', expectedId: 'dept_engineering' },
];

export function runDepartmentVerification(): { passed: number; failed: number; errors: string[] } {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  if (CANONICAL_DEPARTMENTS.length !== 7) {
    failed++;
    errors.push(`Expected 7 canonical departments, found ${CANONICAL_DEPARTMENTS.length}`);
  } else {
    passed++;
  }

  for (const { input, expectedId } of TEST_CASES) {
    const actualId = normalizeDepartmentId(input);
    const deptObj = normalizeDepartment(input);

    if (actualId === expectedId && deptObj?.id === expectedId) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: "${input}" -> expected "${expectedId}", got "${actualId}"`);
    }
  }

  if (normalizeDepartment(undefined) === null && normalizeDepartment(null) === null && normalizeDepartment('') === null) {
    passed++;
  } else {
    failed++;
    errors.push('FAIL: Edge case empty inputs did not return null');
  }

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const res = runDepartmentVerification();
  console.log(`Department normalization verification: ${res.passed} passed, ${res.failed} failed.`);
  if (res.failed > 0) {
    console.error(res.errors.join('\n'));
    process.exit(1);
  }
}
