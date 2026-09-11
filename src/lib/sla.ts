/**
 * SLA (Service Level Agreement) Assignment & Configuration Module
 * Single source of truth for response deadlines, resolution deadlines, and SLA calculations.
 */

import type { CanonicalDepartmentId } from './departments';

export type PriorityLevel = 'Low' | 'Medium' | 'High' | 'Critical';

export type SlaPriorityTarget = {
  priority: PriorityLevel;
  responseHours: number;
  resolutionHours: number;
  reminderBeforeBreachHours: number;
};

export type SlaConfig = {
  global: Record<PriorityLevel, SlaPriorityTarget>;
  departmentOverrides?: Partial<Record<CanonicalDepartmentId | string, Partial<Record<PriorityLevel, SlaPriorityTarget>>>>;
  updatedAt: string;
  updatedBy?: string;
};

export const DEFAULT_SLA_CONFIG: SlaConfig = {
  global: {
    Critical: {
      priority: 'Critical',
      responseHours: 2,
      resolutionHours: 12,
      reminderBeforeBreachHours: 2,
    },
    High: {
      priority: 'High',
      responseHours: 4,
      resolutionHours: 24,
      reminderBeforeBreachHours: 4,
    },
    Medium: {
      priority: 'Medium',
      responseHours: 8,
      resolutionHours: 48,
      reminderBeforeBreachHours: 8,
    },
    Low: {
      priority: 'Low',
      responseHours: 12,
      resolutionHours: 72,
      reminderBeforeBreachHours: 12,
    },
  },
  departmentOverrides: {},
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'system',
};

/**
 * Resolves SLA targets for a given priority and optional departmentId.
 */
export function getSlaTargets(
  priority: PriorityLevel,
  departmentId?: string,
  config: SlaConfig = DEFAULT_SLA_CONFIG
): SlaPriorityTarget {
  const globalTarget = config.global[priority] || DEFAULT_SLA_CONFIG.global[priority];

  if (departmentId && config.departmentOverrides && config.departmentOverrides[departmentId]) {
    const deptOverride = config.departmentOverrides[departmentId]?.[priority];
    if (deptOverride) {
      return {
        ...globalTarget,
        ...deptOverride,
      };
    }
  }

  return globalTarget;
}

export type SlaCalculationResult = {
  slaResponseDeadline: string; // ISO 8601 timestamp string
  slaDeadline: string;         // ISO 8601 timestamp string
  slaBreached: boolean;        // Always starts as false for new reports
  escalationLevel: number;     // Always starts as 0 for new reports
  estimatedResolutionTime: string; // Display string, e.g. "12 hours" or "48 hours"
};

/**
 * Deterministically calculates response and resolution SLA deadlines from the server clock.
 * NEVER accepts client-supplied deadlines.
 */
export function calculateSlaDeadlines(params: {
  priority: PriorityLevel;
  departmentId?: string;
  nowDate?: Date;
  config?: SlaConfig;
}): SlaCalculationResult {
  const serverNow = params.nowDate ? new Date(params.nowDate) : new Date();
  const target = getSlaTargets(params.priority, params.departmentId, params.config || DEFAULT_SLA_CONFIG);

  const responseMs = target.responseHours * 60 * 60 * 1000;
  const resolutionMs = target.resolutionHours * 60 * 60 * 1000;

  const responseDeadlineDate = new Date(serverNow.getTime() + responseMs);
  const resolutionDeadlineDate = new Date(serverNow.getTime() + resolutionMs);

  const estimatedResolutionTime = target.resolutionHours >= 24
    ? `${target.resolutionHours} hours`
    : `${target.resolutionHours} hours`;

  return {
    slaResponseDeadline: responseDeadlineDate.toISOString(),
    slaDeadline: resolutionDeadlineDate.toISOString(),
    slaBreached: false,
    escalationLevel: 0,
    estimatedResolutionTime,
  };
}
