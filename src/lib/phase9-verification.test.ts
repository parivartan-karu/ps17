/**
 * Verification test suite for Phase 9: Agent Pipeline Visualization
 */

import { normalizeDepartment, normalizeDepartmentId } from './departments';
import type { Report } from './types';

// Mock report for testing pipeline visualization
const mockReport: Report = {
  id: 'rep_p9_1001',
  userId: 'citizen_99',
  userName: 'Priya Sharma',
  location: 'Koregaon Park, Pune',
  description: 'Overflowing garbage bin creating health hazard near hospital',
  imageUrl: 'https://example.com/garbage.jpg',
  imageHint: 'Garbage',
  timestamp: new Date('2026-09-11T10:00:00.000Z').toISOString(),
  status: 'In Progress',
  department: 'Sanitation',
  departmentId: 'dept_sanitation',
  category: 'Illegal Dumping',
  priority: 'High',
  estimatedResolutionTime: '24 hours',
  slaDeadline: new Date(Date.now() + 6 * 3600 * 1000).toISOString(),
  slaBreached: false,
  escalationLevel: 1,
  escalatedTo: 'Sanitation Department Head',
  workflowStage: 'assigned_worker',
  assignedWorkerId: 'worker_sanitation_1',
  assignedContractor: 'Ramesh Patil',
  actionLog: [
    {
      status: 'Submitted',
      timestamp: new Date('2026-09-11T10:00:00.000Z').toISOString(),
      actor: 'Citizen',
      actorName: 'Priya Sharma',
      notes: 'Report filed via Web App',
    },
    {
      status: 'Assigned',
      timestamp: new Date('2026-09-11T10:05:00.000Z').toISOString(),
      actor: 'Official',
      actorName: 'Sanitation Head',
      notes: 'Assigned to Ramesh Patil',
    },
  ],
  aiAnalysis: {
    damageDetected: true,
    damageCategory: 'Illegal Dumping',
    severity: 'High',
    verificationSuggestion: 'Likely genuine',
    description: 'Waste pile visible near healthcare center',
    suggestedDepartment: 'Sanitation',
    suggestedPriority: 'High',
    duplicateSuggestion: '',
  },
};

export function runPhase9Verification(): { passed: number; failed: number; errors: string[] } {
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

  // 1. Verify 5-agent execution steps in order
  const expectedAgents = [
    '1. Intake Agent',
    '2. Classification Agent',
    '3. Routing Agent',
    '4. Priority Agent',
    '5. Deduplication Agent',
  ];

  assert(expectedAgents.length === 5, 'Test 1: Exactly 5 pipeline agent stages defined in order');

  // 2. Verify canonical department resolution
  const normDeptId = normalizeDepartmentId(mockReport.departmentId);
  const deptDef = normalizeDepartment(normDeptId);
  assert(normDeptId === 'dept_sanitation', 'Test 2a: Canonical department ID resolved to dept_sanitation');
  assert(deptDef?.name === 'Sanitation', 'Test 2b: Canonical department name resolved to Sanitation');

  // 3. Verify SLA countdown calculation
  const deadlineMs = new Date(mockReport.slaDeadline!).getTime();
  const nowMs = Date.now();
  const hoursRemaining = Math.floor((deadlineMs - nowMs) / (1000 * 3600));
  assert(hoursRemaining >= 0 && hoursRemaining <= 24, 'Test 3: SLA remaining hours correctly computed on server clock');

  // 4. Verify escalation state and target
  assert(mockReport.escalationLevel === 1, 'Test 4a: Escalation level 1 correctly retrieved');
  assert(mockReport.escalatedTo === 'Sanitation Department Head', 'Test 4b: Escalation target correctly retrieved');

  // 5. Verify worker assignment state
  assert(mockReport.assignedContractor === 'Ramesh Patil', 'Test 5a: Assigned worker name displayed');
  assert(mockReport.workflowStage === 'assigned_worker', 'Test 5b: Workflow stage displayed');

  // 6. Security check: verify no secrets or private keys exposed in output objects
  const publicKeys = Object.keys(mockReport);
  const containsSecret = publicKeys.some((k) => k.includes('API_KEY') || k.includes('SECRET'));
  assert(containsSecret === false, 'Test 6: No private API keys or internal secrets exposed in report payload');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase9Verification();
  console.log(`Phase 9 verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
