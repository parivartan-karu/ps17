/**
 * Smart Worker Assignment Module (Phase 3)
 * Provides deterministic recommendation scoring, eligibility checks,
 * skill matching, ward proximity scoring, and recommendation badges for worker assignment.
 */

import type { Report, User as UserType } from './types';
import { normalizeDepartmentId } from './departments';

export type WorkerRecommendationBadge = 'Best Recommended' | 'Available' | 'Busy' | 'At Capacity' | 'Ineligible';

export type WorkerRecommendationResult = {
  worker: UserType;
  isEligible: boolean;
  score: number;
  badge: WorkerRecommendationBadge;
  skillMatchLabel: string;
  wardMatchLabel: string;
  reason: string;
  rejectionReason?: string;
};

// Skill keywords by department category / cause
const SKILL_KEYWORDS: Record<string, string[]> = {
  pothole: ['pothole', 'road', 'tarring', 'asphalt', 'pavement', 'civil', 'maintenance'],
  road: ['road', 'surface', 'crack', 'footpath', 'hazard', 'civil', 'infrastructure'],
  garbage: ['garbage', 'waste', 'bin', 'cleanliness', 'sanitation', 'collection', 'sweeping'],
  waste: ['waste', 'garbage', 'bin', 'dumping', 'sanitation', 'collection'],
};

/**
 * Calculates a deterministic recommendation score and metadata for a single worker against a report.
 */
export function calculateWorkerRecommendation(
  worker: UserType,
  report: Report
): WorkerRecommendationResult {
  const activeTasks = worker.activeTasks ?? 0;
  const maxCapacity = worker.maxTaskCapacity ?? 5;

  const reportDeptId = normalizeDepartmentId(report.departmentId || report.department) || (report.departmentId || report.department || '').toLowerCase().trim();
  const workerDeptId = normalizeDepartmentId(worker.departmentId || worker.department) || (worker.departmentId || worker.department || '').toLowerCase().trim();

  // 1. Hard Eligibility Checks
  if (worker.role !== 'worker') {
    return {
      worker,
      isEligible: false,
      score: 0,
      badge: 'Ineligible',
      skillMatchLabel: 'None',
      wardMatchLabel: 'N/A',
      reason: 'User does not have worker role',
      rejectionReason: 'User is not registered as a field worker.',
    };
  }

  if (reportDeptId && workerDeptId && reportDeptId !== workerDeptId) {
    return {
      worker,
      isEligible: false,
      score: 0,
      badge: 'Ineligible',
      skillMatchLabel: 'Mismatch',
      wardMatchLabel: 'N/A',
      reason: `Department mismatch (${worker.department || workerDeptId} vs ${report.department || reportDeptId})`,
      rejectionReason: `Worker belongs to ${worker.department || workerDeptId}, but complaint requires ${report.department || reportDeptId}.`,
    };
  }

  if (worker.isAvailable === false || worker.status === 'inactive') {
    return {
      worker,
      isEligible: false,
      score: 0,
      badge: 'Ineligible',
      skillMatchLabel: 'N/A',
      wardMatchLabel: 'N/A',
      reason: 'Worker marked as unavailable',
      rejectionReason: `${worker.name} is currently marked as unavailable or inactive.`,
    };
  }

  if (activeTasks >= maxCapacity) {
    return {
      worker,
      isEligible: false,
      score: 0,
      badge: 'At Capacity',
      skillMatchLabel: 'Capacity Full',
      wardMatchLabel: 'N/A',
      reason: `At maximum task capacity (${activeTasks}/${maxCapacity})`,
      rejectionReason: `${worker.name} is at maximum capacity (${activeTasks}/${maxCapacity} tasks).`,
    };
  }

  // 2. Deterministic Recommendation Scoring (0 - 100 points)

  // A. Department Match Base Qualification (+30 pts)
  let score = 30;

  // B. Workload / Remaining Capacity Score (Up to 30 pts)
  const remainingCapacity = maxCapacity - activeTasks;
  const capacityRatio = remainingCapacity / maxCapacity;
  const workloadScore = Math.round(capacityRatio * 30);
  score += workloadScore;

  // C. Skill Match Score (Up to 20 pts)
  let skillScore = 0;
  const matchedSkills: string[] = [];

  const categoryText = (report.category || '').toLowerCase();
  const descriptionText = (report.description || '').toLowerCase();
  const causeTagText = (report.causeTag || '').toLowerCase();
  const workerSkills = (worker.skills || []).map((s: string) => s.toLowerCase());

  if (worker.skillType) workerSkills.push(worker.skillType.toLowerCase());
  if (worker.specialization) workerSkills.push(worker.specialization.toLowerCase());
  if (worker.designation) workerSkills.push(worker.designation.toLowerCase());

  // Search keyword matches
  for (const [key, keywords] of Object.entries(SKILL_KEYWORDS)) {
    if (categoryText.includes(key) || descriptionText.includes(key) || causeTagText.includes(key)) {
      const hasSkill = workerSkills.some((skill: string) => (
        keywords.some((kw: string) => skill.includes(kw))
      ));
      if (hasSkill) {
        skillScore = 20;
        matchedSkills.push(key.charAt(0).toUpperCase() + key.slice(1));
        break;
      }
    }
  }

  if (skillScore === 0 && workerSkills.length > 0) {
    skillScore = 10; // Partial default credit if worker has recorded skills
    matchedSkills.push('General Ops');
  }

  score += skillScore;
  const skillMatchLabel = matchedSkills.length > 0 ? matchedSkills.join(', ') : 'Standard';

  // D. Ward or Location Proximity Score (Up to 20 pts)
  let proximityScore = 0;
  let wardMatchLabel = 'General Area';

  const reportLoc = (report.location || '').toLowerCase();
  const workerWard = (worker.ward || worker.wardArea || worker.serviceArea || '').toLowerCase();
  const displayWard = worker.ward || worker.wardArea || worker.serviceArea || '';

  if (workerWard && reportLoc.includes(workerWard)) {
    proximityScore = 20;
    wardMatchLabel = `Same Ward (${displayWard})`;
  } else if (workerWard) {
    proximityScore = 10;
    wardMatchLabel = `Servicing ${displayWard}`;
  }

  score += proximityScore;

  // 3. Determine Badge & Reason
  let badge: WorkerRecommendationBadge = 'Available';
  if (activeTasks >= 3) {
    badge = 'Busy';
  }

  const reasonParts: string[] = [];
  reasonParts.push(`${remainingCapacity}/${maxCapacity} tasks open`);

  if (proximityScore === 20) {
    reasonParts.push(wardMatchLabel);
  }
  if (skillScore >= 20) {
    reasonParts.push(`Skill match (${skillMatchLabel})`);
  }

  const reason = reasonParts.join(' • ');

  return {
    worker,
    isEligible: true,
    score,
    badge,
    skillMatchLabel,
    wardMatchLabel,
    reason,
  };
}

/**
 * Deterministically ranks all workers for a given report.
 * Highest recommendation score first. Marks the top eligible worker as 'Best Recommended'.
 */
export function rankWorkersForReport(
  workers: UserType[],
  report: Report
): WorkerRecommendationResult[] {
  const scored = workers.map(w => calculateWorkerRecommendation(w, report));

  // Sort: Eligible first, then highest score descending, then lowest activeTasks
  scored.sort((a, b) => {
    if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return (a.worker.activeTasks ?? 0) - (b.worker.activeTasks ?? 0);
  });

  // Assign 'Best Recommended' to top eligible worker if score >= 60
  if (scored.length > 0 && scored[0].isEligible && scored[0].score >= 60) {
    scored[0].badge = 'Best Recommended';
  }

  return scored;
}
