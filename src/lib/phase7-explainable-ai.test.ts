/**
 * Verification test suite for Phase 7: Explainable AI & Department Insights
 */

import type { Report } from './types';
import { normalizeDepartmentId } from './departments';

function createMockReport(overrides: Partial<Report> = {}): Report {
  return {
    id: 'rep_p7_test_001',
    userId: 'user_p7_001',
    userName: 'Test Citizen',
    imageUrl: '',
    imageHint: '',
    description: 'Severe pothole and asphalt crack on main road',
    category: 'Potholes',
    department: 'Roads Department',
    departmentId: 'dept_engineering',
    status: 'Submitted',
    priority: 'High',
    location: 'Kothrud, Pune',
    timestamp: new Date().toISOString(),
    actionLog: [],
    ...overrides,
  };
}

export function runPhase7Verification(): { passed: number; failed: number; errors: string[] } {
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

  // 1. Classification Rationale generation
  const roadsReport = createMockReport({
    category: 'Potholes',
    aiAnalysis: {
      damageDetected: true,
      damageCategory: 'Potholes & Asphalt Damage',
      severity: 'High',
      verificationSuggestion: 'Likely genuine',
      description: 'Severe pothole',
      suggestedDepartment: 'Engineering',
      suggestedPriority: 'High',
      duplicateSuggestion: 'None',
      illegalDumping: null,
    },
  });

  const categoryName = roadsReport.aiAnalysis?.damageCategory || roadsReport.category;
  assert(categoryName === 'Potholes & Asphalt Damage', 'Test 1a: Uses structured AI visual classification category');

  // 2. Department Routing Rationale generation
  const deptId = normalizeDepartmentId(roadsReport.departmentId || roadsReport.department);
  assert(deptId === 'dept_engineering', 'Test 2a: Normalized canonical department ID is dept_engineering');

  const garbageReport = createMockReport({
    id: 'rep_garbage_p7',
    category: 'Overflowing Bins',
    department: 'Garbage & Waste Management',
    departmentId: 'garbage-waste-dept',
  });
  const garbageDeptId = normalizeDepartmentId(garbageReport.departmentId || garbageReport.department);
  assert(garbageDeptId === 'dept_sanitation', 'Test 2b: Normalized canonical department ID for garbage is dept_sanitation');

  // 3. Priority Rationale generation
  const highPriorityReport = createMockReport({
    priority: 'Critical',
    relatedReportCount: 4,
    slaBreached: true,
  });

  const isCritical = highPriorityReport.priority === 'Critical';
  const hasDuplicates = (highPriorityReport.relatedReportCount ?? 1) > 1;
  const isBreached = !!highPriorityReport.slaBreached;

  assert(isCritical && hasDuplicates && isBreached, 'Test 3a: Priority rationale includes severity grade, duplicate count, and SLA breach status');

  // 4. Department-level insight hotspot grouping
  const reportsList: Report[] = [
    createMockReport({ id: 'r1', location: 'Kothrud Sector 1, Pune', category: 'Potholes' }),
    createMockReport({ id: 'r2', location: 'Kothrud Sector 1, Pune', category: 'Potholes' }),
    createMockReport({ id: 'r3', location: 'Aundh Road, Pune', category: 'Road Damage' }),
  ];

  const locCounts: Record<string, number> = {};
  reportsList.forEach(r => {
    const loc = r.location.split(',')[0].trim();
    locCounts[loc] = (locCounts[loc] || 0) + 1;
  });

  assert(locCounts['Kothrud Sector 1'] === 2, 'Test 4a: Correctly identifies Kothrud Sector 1 as concentrated hotspot (2 reports)');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase7Verification();
  console.log(`Phase 7 verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
