import type { Firestore } from 'firebase-admin/firestore';
import { DEFAULT_SLA_CONFIG, type SlaConfig } from './sla';

/** The single persisted SLA settings document used by creation, monitoring and admin UI. */
export const SLA_CONFIG_DOC_ID = 'slaConfig';

function isFinitePositive(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function normalizeSlaConfig(raw: unknown): SlaConfig {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Partial<SlaConfig>;
  const global = (source.global && typeof source.global === 'object' ? source.global : {}) as Record<string, any>;

  const normalized: SlaConfig = {
    global: { ...DEFAULT_SLA_CONFIG.global },
    departmentOverrides: source.departmentOverrides || {},
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : DEFAULT_SLA_CONFIG.updatedAt,
    updatedBy: typeof source.updatedBy === 'string' ? source.updatedBy : DEFAULT_SLA_CONFIG.updatedBy,
  };

  (Object.keys(DEFAULT_SLA_CONFIG.global) as Array<keyof typeof DEFAULT_SLA_CONFIG.global>).forEach((priority) => {
    const defaults = DEFAULT_SLA_CONFIG.global[priority];
    const value = global[priority] || {};
    normalized.global[priority] = {
      priority,
      responseHours: isFinitePositive(Number(value.responseHours)) ? Number(value.responseHours) : defaults.responseHours,
      resolutionHours: isFinitePositive(Number(value.resolutionHours)) ? Number(value.resolutionHours) : defaults.resolutionHours,
      reminderBeforeBreachHours: isFinitePositive(Number(value.reminderBeforeBreachHours)) ? Number(value.reminderBeforeBreachHours) : defaults.reminderBeforeBreachHours,
    };
  });

  return normalized;
}

export async function getSlaConfig(firestore: Firestore): Promise<SlaConfig> {
  const snap = await firestore.collection('settings').doc(SLA_CONFIG_DOC_ID).get();
  return snap.exists ? normalizeSlaConfig(snap.data()) : DEFAULT_SLA_CONFIG;
}
