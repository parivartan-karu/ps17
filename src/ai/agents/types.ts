import { normalizeDepartment, normalizeDepartmentId, type CanonicalDepartmentId } from '@/lib/departments';

export type AgentLogEntry = {
  agent: string;
  status: 'success' | 'fallback' | 'error';
  timestamp: string;
  model?: string;
  inputSummary?: string;
  outputSummary?: string;
  latencyMs?: number;
  confidence?: number;
  reasoning?: string;
};

export const CANONICAL_CATEGORIES = [
  'Pothole',
  'Crack',
  'Surface failure',
  'Garbage/Debris',
  'Illegal Dumping',
  'Overflowing Bin',
  'Uncleaned Street',
  'Dead Animal',
  'Streetlight Issue',
  'Exposed wire',
  'Power outage',
  'Water-logged damage',
  'Manhole issue',
  'Water leak',
  'Pipe burst',
  'Fallen Tree',
  'Overgrown Vegetation',
  'Traffic signal',
  'Damaged Signboard',
  'Footpath Issue',
  'Public Property Damage',
  'General Infrastructure',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

export const CATEGORY_DEPARTMENT_MAP: Record<string, CanonicalDepartmentId> = {
  // Sanitation
  'Garbage/Debris': 'dept_sanitation',
  'Illegal Dumping': 'dept_sanitation',
  'Overflowing Bin': 'dept_sanitation',
  'Uncleaned Street': 'dept_sanitation',
  'Dead Animal': 'dept_sanitation',
  'Garbage in Park': 'dept_sanitation',

  // Engineering
  'Pothole': 'dept_engineering',
  'Crack': 'dept_engineering',
  'Surface failure': 'dept_engineering',
  'Bridge repair': 'dept_engineering',
  'Structural damage': 'dept_engineering',

  // Electrical
  'Street light': 'dept_electrical',
  'Streetlight Issue': 'dept_electrical',
  'Power outage': 'dept_electrical',
  'Exposed wire': 'dept_electrical',
  'Transformer issue': 'dept_electrical',

  // Water Supply
  'Water-logged damage': 'dept_water',
  'Manhole issue': 'dept_water',
  'Water leak': 'dept_water',
  'Pipe burst': 'dept_water',
  'Low water pressure': 'dept_water',
  'Contaminated water': 'dept_water',

  // Parks & Environment
  'Fallen Tree': 'dept_parks',
  'Fallen Branch': 'dept_parks',
  'Overgrown Vegetation': 'dept_parks',
  'Park Maintenance': 'dept_parks',

  // Traffic & Roads
  'Traffic signal': 'dept_traffic',
  'Road marking': 'dept_traffic',
  'Damaged Signboard': 'dept_traffic',
  'Traffic Congestion Point': 'dept_traffic',
  'Illegal Barrier': 'dept_traffic',

  // Public Works
  'Public Property Damage': 'dept_public_works',
  'Footpath Issue': 'dept_public_works',
  'Civic Building Maintenance': 'dept_public_works',
  'General Infrastructure': 'dept_public_works',
};

/**
 * Validates and normalizes an input category string against the canonical taxonomy.
 * Safe fallback to 'General Infrastructure' if invalid or empty.
 */
export function validateCategory(categoryInput?: string | null): string {
  if (!categoryInput) return 'General Infrastructure';
  const raw = categoryInput.trim();
  if (!raw) return 'General Infrastructure';

  // Direct case-insensitive match
  const lower = raw.toLowerCase();
  for (const cat of CANONICAL_CATEGORIES) {
    if (cat.toLowerCase() === lower) {
      return cat;
    }
  }

  // Synonym / substring matching
  if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || lower.includes('dump')) {
    return lower.includes('dump') ? 'Illegal Dumping' : 'Garbage/Debris';
  }
  if (lower.includes('pothole') || lower.includes('hole')) {
    return 'Pothole';
  }
  if (lower.includes('light') || lower.includes('lamp') || lower.includes('pole')) {
    return 'Streetlight Issue';
  }
  if (lower.includes('water') || lower.includes('leak') || lower.includes('flood') || lower.includes('drain')) {
    return lower.includes('flood') || lower.includes('log') ? 'Water-logged damage' : 'Water leak';
  }
  if (lower.includes('tree') || lower.includes('branch') || lower.includes('park') || lower.includes('plant')) {
    return 'Fallen Tree';
  }
  if (lower.includes('signal') || lower.includes('sign') || lower.includes('traffic')) {
    return 'Traffic signal';
  }
  if (lower.includes('footpath') || lower.includes('pavement') || lower.includes('sidewalk')) {
    return 'Footpath Issue';
  }

  return 'General Infrastructure';
}

/**
 * Validates department against canonical department IDs.
 * Safe fallback to 'dept_public_works' if invalid.
 */
export function validateDepartmentId(deptInput?: string | null): CanonicalDepartmentId {
  const normalized = normalizeDepartmentId(deptInput);
  if (normalized) return normalized;
  return 'dept_public_works';
}

/**
 * Validates priority string against Low, Medium, High, Critical.
 * Safe fallback to 'Medium'.
 */
export function validatePriority(priorityInput?: string | null): 'Low' | 'Medium' | 'High' | 'Critical' {
  if (!priorityInput) return 'Medium';
  const norm = priorityInput.trim().toLowerCase();
  if (norm === 'critical') return 'Critical';
  if (norm === 'high') return 'High';
  if (norm === 'medium') return 'Medium';
  if (norm === 'low') return 'Low';
  return 'Medium';
}

/**
 * Clamps confidence numerical value strictly to 0..1 range.
 */
export function clampConfidence(confidence?: number | null, defaultVal = 0.7): number {
  if (typeof confidence !== 'number' || isNaN(confidence)) {
    return Math.max(0, Math.min(1, defaultVal));
  }
  return Math.max(0, Math.min(1, confidence));
}

/**
 * Helper to construct an AgentLogEntry receipt.
 */
export function createAgentReceipt(params: {
  agent: string;
  status: 'success' | 'fallback' | 'error';
  startTime: number;
  model?: string;
  inputSummary?: string;
  outputSummary?: string;
  confidence?: number;
  reasoning?: string;
}): AgentLogEntry {
  const latencyMs = Math.max(1, Math.round(performance.now() - params.startTime));
  return {
    agent: params.agent,
    status: params.status,
    timestamp: new Date().toISOString(),
    model: params.model ?? 'rule_engine',
    inputSummary: params.inputSummary,
    outputSummary: params.outputSummary,
    latencyMs,
    confidence: clampConfidence(params.confidence, 0.7),
    reasoning: params.reasoning ?? 'Completed execution.',
  };
}
