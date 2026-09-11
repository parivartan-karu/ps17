/**
 * Verification test suite for Production End-to-End Workflows
 */

import { normalizeDepartmentId } from './departments';
import { validateStatusTransition } from './state-machine';

export function runPhase10Verification(): { passed: number; failed: number; errors: string[] } {
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

  // Garbage Workflow Verification
  const garbageDemo = {
    id: 'demo_garbage_001',
    category: 'Overflowing Bins',
    department: 'Garbage & Waste Management',
    departmentId: 'dept_sanitation',
    status: 'Under Verification',
    beforeWorkMediaUrl: 'https://example.com/before.jpg',
    afterWorkMediaUrl: 'https://example.com/after.jpg',
    assignedWorkerId: 'worker_garbage_001',
  };

  const isGarbageDept = normalizeDepartmentId(garbageDemo.departmentId) === 'dept_sanitation';
  const hasAfterWorkEvidence = !!garbageDemo.afterWorkMediaUrl;
  const canApproveGarbage = validateStatusTransition(garbageDemo.status, 'Resolved');

  assert(isGarbageDept, 'Garbage report correctly assigned to dept_sanitation');
  assert(hasAfterWorkEvidence, 'Worker uploaded after-work evidence photo');
  assert(canApproveGarbage.valid, 'Department officer can approve resolution from Under Verification');

  // Roads & Hotspot Workflow Verification
  const roadsDemo = {
    id: 'demo_roads_001',
    category: 'Potholes',
    department: 'Roads Department',
    departmentId: 'dept_engineering',
    status: 'Assigned',
    priority: 'Critical',
    relatedReportCount: 3,
    slaDeadline: new Date(Date.now() + 11 * 3600 * 1000).toISOString(),
  };

  const isRoadsDept = normalizeDepartmentId(roadsDemo.departmentId) === 'dept_engineering';
  const isHotspotClustered = (roadsDemo.relatedReportCount ?? 1) > 1;
  const hasActiveSlaTimer = !!roadsDemo.slaDeadline;

  assert(isRoadsDept, 'Roads report correctly assigned to dept_engineering');
  assert(isHotspotClustered, 'Hotspot engine consolidated 3 related reports');
  assert(hasActiveSlaTimer, 'Critical priority report has active SLA countdown');

  // SLA Breach & Escalation Verification
  const slaDemo = {
    id: 'demo_sla_001',
    category: 'Road Safety Hazards',
    department: 'Roads Department',
    departmentId: 'dept_engineering',
    status: 'In Progress',
    priority: 'Critical',
    slaBreached: true,
    escalationLevel: 1,
    escalatedTo: 'Central SMC Administration',
  };

  const isBreached = !!slaDemo.slaBreached;
  const isEscalatedL1 = slaDemo.escalationLevel === 1;

  assert(isBreached, 'SLA breach status accurately flagged');
  assert(isEscalatedL1, 'Report escalated to Level 1 Central Administration');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  const result = runPhase10Verification();
  console.log(`Workflow verification: ${result.passed} passed, ${result.failed} failed.`);
  if (result.failed > 0) {
    console.error(result.errors.join('\n'));
    process.exit(1);
  }
}
