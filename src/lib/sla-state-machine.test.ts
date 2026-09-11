/**
 * Phase 5 Verification Test Suite for SLA Assignment & State Machine
 */

import { calculateSlaDeadlines, getSlaTargets, DEFAULT_SLA_CONFIG, type SlaConfig } from './sla';
import { validateStatusTransition, ALLOWED_STATUS_TRANSITIONS } from './state-machine';
import type { ReportStatus } from './types';

export async function runSlaStateMachineTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const errors: string[] = [];
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, msg: string) {
    if (condition) {
      passed++;
    } else {
      failed++;
      errors.push(`FAIL: ${msg}`);
    }
  }

  // ---------------------------------------------------------------------------
  // 1. SLA Calculations Tests
  // ---------------------------------------------------------------------------
  const mockServerClock = new Date('2026-06-01T12:00:00.000Z');

  // Critical Priority
  const critSla = calculateSlaDeadlines({ priority: 'Critical', nowDate: mockServerClock });
  assert(critSla.escalationLevel === 0, 'Critical SLA escalationLevel starts at 0');
  assert(critSla.slaBreached === false, 'Critical SLA slaBreached starts as false');
  assert(critSla.slaResponseDeadline === '2026-06-01T14:00:00.000Z', `Critical response deadline (2h): ${critSla.slaResponseDeadline}`);
  assert(critSla.slaDeadline === '2026-06-02T00:00:00.000Z', `Critical resolution deadline (12h): ${critSla.slaDeadline}`);

  // High Priority
  const highSla = calculateSlaDeadlines({ priority: 'High', nowDate: mockServerClock });
  assert(highSla.slaResponseDeadline === '2026-06-01T16:00:00.000Z', `High response deadline (4h): ${highSla.slaResponseDeadline}`);
  assert(highSla.slaDeadline === '2026-06-02T12:00:00.000Z', `High resolution deadline (24h): ${highSla.slaDeadline}`);

  // Medium Priority
  const medSla = calculateSlaDeadlines({ priority: 'Medium', nowDate: mockServerClock });
  assert(medSla.slaDeadline === '2026-06-03T12:00:00.000Z', `Medium resolution deadline (48h): ${medSla.slaDeadline}`);

  // Low Priority
  const lowSla = calculateSlaDeadlines({ priority: 'Low', nowDate: mockServerClock });
  assert(lowSla.slaDeadline === '2026-06-04T12:00:00.000Z', `Low resolution deadline (72h): ${lowSla.slaDeadline}`);

  // ISO Format Validation
  assert(!isNaN(Date.parse(critSla.slaDeadline)), 'SLA deadline is valid ISO string');
  assert(!isNaN(Date.parse(critSla.slaResponseDeadline)), 'SLA response deadline is valid ISO string');

  // Department Overrides Test
  const customConfig: SlaConfig = {
    ...DEFAULT_SLA_CONFIG,
    departmentOverrides: {
      dept_sanitation: {
        Critical: {
          priority: 'Critical',
          responseHours: 1,
          resolutionHours: 6,
          reminderBeforeBreachHours: 1,
        },
      },
    },
  };
  const deptCustomSla = calculateSlaDeadlines({
    priority: 'Critical',
    departmentId: 'dept_sanitation',
    nowDate: mockServerClock,
    config: customConfig,
  });
  assert(deptCustomSla.slaDeadline === '2026-06-01T18:00:00.000Z', `Department override resolution (6h): ${deptCustomSla.slaDeadline}`);

  // ---------------------------------------------------------------------------
  // 2. Authoritative State Machine Tests
  // ---------------------------------------------------------------------------

  // Allowed Transitions
  assert(validateStatusTransition('Submitted', 'Under Verification').valid === true, 'Submitted -> Under Verification allowed');
  assert(validateStatusTransition('Submitted', 'Assigned').valid === true, 'Submitted -> Assigned allowed');
  assert(validateStatusTransition('Submitted', 'Rejected').valid === true, 'Submitted -> Rejected allowed');
  assert(validateStatusTransition('Under Verification', 'Assigned').valid === true, 'Under Verification -> Assigned allowed');
  assert(validateStatusTransition('Assigned', 'In Progress').valid === true, 'Assigned -> In Progress allowed');
  assert(validateStatusTransition('In Progress', 'Resolved').valid === true, 'In Progress -> Resolved allowed');
  assert(validateStatusTransition('In Progress', 'Rejected').valid === true, 'In Progress -> Rejected allowed');

  // Forbidden / Invalid Transitions
  assert(validateStatusTransition('Submitted', 'Resolved').valid === false, 'Submitted -> Resolved forbidden');
  assert(validateStatusTransition('Assigned', 'Submitted').valid === false, 'Assigned -> Submitted forbidden');

  // Terminal State Protection (Resolved & Rejected cannot be modified or reopened)
  const resolvedReopen = validateStatusTransition('Resolved', 'In Progress');
  assert(resolvedReopen.valid === false, 'Resolved -> In Progress rejected');
  assert(resolvedReopen.isTerminal === true, 'Resolved flagged as terminal state');

  const resolvedToSubmitted = validateStatusTransition('Resolved', 'Submitted');
  assert(resolvedToSubmitted.valid === false, 'Resolved -> Submitted rejected');

  const rejectedReopen = validateStatusTransition('Rejected', 'Under Verification');
  assert(rejectedReopen.valid === false, 'Rejected -> Under Verification rejected');
  assert(rejectedReopen.isTerminal === true, 'Rejected flagged as terminal state');

  return { passed, failed, errors };
}

if (typeof require !== 'undefined' && require.main === module) {
  runSlaStateMachineTests().then((res) => {
    console.log(`Phase 5 SLA & State Machine Tests: ${res.passed} passed, ${res.failed} failed.`);
    if (res.failed > 0) {
      console.error(res.errors.join('\n'));
      process.exit(1);
    }
  });
}
