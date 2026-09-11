/**
 * Verification test suite for Phase 3 Multi-Agent Pipeline & Validation Logic
 */

import {
  validateCategory,
  validateDepartmentId,
  validatePriority,
  clampConfidence,
} from './types';
import { routingAgent } from './routing-agent';
import { priorityAgent } from './priority-agent';
import { dedupAgent, type CandidateReport } from './dedup-agent';
import { classificationAgent } from './classification-agent';
import { intakeAgent } from './intake-agent';

export async function runAgentVerificationTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
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

  // 1. Category Validation Tests
  assert(validateCategory('Pothole') === 'Pothole', 'Exact category "Pothole"');
  assert(validateCategory('garbage on street') === 'Garbage/Debris', 'Synonym category "garbage on street" -> Garbage/Debris');
  assert(validateCategory('illegal dumping waste') === 'Illegal Dumping', 'Synonym "illegal dumping waste" -> Illegal Dumping');
  assert(validateCategory('broken street lamp') === 'Streetlight Issue', 'Synonym "broken street lamp" -> Streetlight Issue');
  assert(validateCategory('water leaking from pipe') === 'Water leak', 'Synonym "water leaking" -> Water leak');
  assert(validateCategory('') === 'General Infrastructure', 'Empty string category fallback');
  assert(validateCategory(null) === 'General Infrastructure', 'Null category fallback');

  // 2. Department Validation Tests
  assert(validateDepartmentId('dept_engineering') === 'dept_engineering', 'Canonical department ID');
  assert(validateDepartmentId('Solid Waste Management Department') === 'dept_sanitation', 'Legacy alias -> dept_sanitation');
  assert(validateDepartmentId('Road Maintenance Department') === 'dept_traffic', 'Legacy alias -> dept_traffic');
  assert(validateDepartmentId('unknown_xyz') === 'dept_public_works', 'Unknown department fallback -> dept_public_works');

  // 3. Priority Validation Tests
  assert(validatePriority('Critical') === 'Critical', 'Exact Priority "Critical"');
  assert(validatePriority('high') === 'High', 'Case insensitive "high" -> High');
  assert(validatePriority('invalid_priority') === 'Medium', 'Invalid priority fallback -> Medium');
  assert(validatePriority(null) === 'Medium', 'Null priority fallback -> Medium');

  // 4. Confidence Clamping Tests
  assert(clampConfidence(1.5) === 1.0, 'Upper bound clamp 1.5 -> 1.0');
  assert(clampConfidence(-0.4) === 0.0, 'Lower bound clamp -0.4 -> 0.0');
  assert(clampConfidence(0.82) === 0.82, 'In-range value 0.82');
  assert(clampConfidence(NaN, 0.7) === 0.7, 'NaN fallback to 0.7');

  // 5. Routing Fallback & Legacy Name Tests
  const routeRes1 = await routingAgent({ category: 'Garbage/Debris', description: 'Trash bin overflow' });
  assert(routeRes1.departmentId === 'dept_sanitation', 'Routing category "Garbage/Debris" -> dept_sanitation');
  assert(routeRes1.department === 'Sanitation', 'Routing preserves display name "Sanitation"');

  const routeResFallback = await routingAgent({ category: 'UnknownCategoryXYZ', description: '' });
  assert(routeResFallback.departmentId === 'dept_public_works', 'Routing fallback department ID');
  assert(routeResFallback.routingPath === 'fallback_unassigned', 'Routing fallback path tag');

  // 6. Priority Fallback Tests
  const prioResCritical = await priorityAgent({ category: 'Exposed wire', description: 'Sparking live wire hanging on road' });
  assert(prioResCritical.priority === 'Critical', 'Critical priority trigger on live wire');

  const prioResFallback = await priorityAgent({ category: 'Unknown', description: '' });
  assert(prioResFallback.priority === 'Medium', 'Priority fallback to Medium');

  // 7. Duplicate Candidate Limits & Dedup Non-deletion Tests
  const mockCandidates: CandidateReport[] = Array.from({ length: 15 }, (_, i) => ({
    id: `RPT-00${i + 1}`,
    description: 'Pothole on Main Road near market',
    category: 'Pothole',
    latitude: 18.5204 + i * 0.00001, // extremely close
    longitude: 73.8567 + i * 0.00001,
    timestamp: new Date().toISOString(),
    status: 'Submitted',
  }));

  const dedupRes = await dedupAgent({
    category: 'Pothole',
    description: 'Pothole on Main Road near market area',
    latitude: 18.5204,
    longitude: 73.8567,
    candidateReports: mockCandidates,
    maxCandidateLimit: 5,
  });

  assert(dedupRes.candidateCountEvaluated <= 5, `Bounded candidate evaluation: ${dedupRes.candidateCountEvaluated} <= 5`);
  assert(dedupRes.isDuplicate === true, 'Dedup identified duplicate');
  assert(dedupRes.linkedIncidentId !== null, 'Dedup linked incident ID set');

  // 8. Intake Agent & Receipts Test
  const intakeRes = await intakeAgent({
    description: 'Urgent danger! Open manhole on main road causing hazard.',
    citizenCategoryHint: 'Manhole issue',
  });
  assert(intakeRes.urgencySignals.length > 0, 'Intake extracted urgency signals');
  assert(intakeRes.receipt.agent === 'intake_agent', 'Intake receipt agent name');
  assert(intakeRes.receipt.status === 'success', 'Intake receipt status');

  return { passed, failed, errors };
}

// Execute tests directly when run via script/node
if (typeof require !== 'undefined' && require.main === module) {
  runAgentVerificationTests().then((res) => {
    console.log(`Phase 3 Agent Verification Tests: ${res.passed} passed, ${res.failed} failed.`);
    if (res.failed > 0) {
      console.error(res.errors.join('\n'));
      process.exit(1);
    }
  });
}
