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
  'Road Cracks and Surface Damage',
  'Crack',
  'Surface failure',
  'Damaged Road',
  'Damaged Footpath',
  'Footpath Issue',
  'Road Safety Hazard',
  'Garbage/Debris',
  'Garbage Accumulation',
  'Illegal Dumping',
  'Overflowing Bins',
  'Overflowing Bin',
  'Uncollected Garbage',
  'Waste-related Drainage Blockage',
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
  'Public Property Damage',
  'General Infrastructure',
] as const;

export type CanonicalCategory = (typeof CANONICAL_CATEGORIES)[number];

export const CATEGORY_DEPARTMENT_MAP: Record<string, CanonicalDepartmentId> = {
  // Sanitation (Garbage & Waste Management)
  'Garbage/Debris': 'dept_sanitation',
  'Garbage Accumulation': 'dept_sanitation',
  'Illegal Dumping': 'dept_sanitation',
  'Overflowing Bins': 'dept_sanitation',
  'Overflowing Bin': 'dept_sanitation',
  'Uncollected Garbage': 'dept_sanitation',
  'Waste-related Drainage Blockage': 'dept_sanitation',
  'Uncleaned Street': 'dept_sanitation',
  'Dead Animal': 'dept_sanitation',
  'Garbage in Park': 'dept_sanitation',

  // Engineering & Roads
  'Pothole': 'dept_engineering',
  'Road Cracks and Surface Damage': 'dept_engineering',
  'Crack': 'dept_engineering',
  'Surface failure': 'dept_engineering',
  'Damaged Road': 'dept_engineering',
  'Damaged Footpath': 'dept_engineering',
  'Footpath Issue': 'dept_engineering',
  'Road Safety Hazard': 'dept_engineering',
  'Bridge repair': 'dept_engineering',
  'Structural damage': 'dept_engineering',

  // Electrical (Streetlight & Power)
  'Street light': 'dept_electrical',
  'Streetlight Issue': 'dept_electrical',
  'Power outage': 'dept_electrical',
  'Exposed wire': 'dept_electrical',
  'Transformer issue': 'dept_electrical',

  // Water Supply & Drainage
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

  // Traffic & Signals
  'Traffic signal': 'dept_traffic',
  'Road marking': 'dept_traffic',
  'Damaged Signboard': 'dept_traffic',
  'Traffic Congestion Point': 'dept_traffic',
  'Illegal Barrier': 'dept_traffic',

  // Public Works
  'Public Property Damage': 'dept_public_works',
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
  if (lower.includes('uncollected') && (lower.includes('garbage') || lower.includes('waste') || lower.includes('trash'))) {
    return 'Uncollected Garbage';
  }
  if (lower.includes('waste') && lower.includes('drain')) {
    return 'Waste-related Drainage Blockage';
  }
  if (lower.includes('overflow') && (lower.includes('bin') || lower.includes('dumpster'))) {
    return 'Overflowing Bins';
  }
  if (lower.includes('accumulation') && (lower.includes('garbage') || lower.includes('waste') || lower.includes('rubbish'))) {
    return 'Garbage Accumulation';
  }
  if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || lower.includes('dump') || lower.includes('rubbish') || lower.includes('litter')) {
    return lower.includes('dump') ? 'Illegal Dumping' : 'Garbage/Debris';
  }
  if (lower.includes('footpath') || lower.includes('sidewalk') || lower.includes('pavement')) {
    return 'Damaged Footpath';
  }
  if (lower.includes('hazard') || (lower.includes('safety') && lower.includes('road'))) {
    return 'Road Safety Hazard';
  }
  if (lower.includes('pothole') || lower.includes('hole')) {
    return 'Pothole';
  }
  if (lower.includes('crack') || lower.includes('surface')) {
    return 'Road Cracks and Surface Damage';
  }
  if (lower.includes('damaged road') || lower.includes('road damage') || lower.includes('broken road')) {
    return 'Damaged Road';
  }
  if (lower.includes('light') || lower.includes('lamp') || lower.includes('pole') || lower.includes('wire')) {
    return 'Streetlight Issue';
  }
  if (lower.includes('water') || lower.includes('leak') || lower.includes('flood') || lower.includes('pipe') || lower.includes('manhole')) {
    return lower.includes('flood') || lower.includes('log') ? 'Water-logged damage' : 'Water leak';
  }
  if (lower.includes('tree') || lower.includes('branch') || lower.includes('park') || lower.includes('plant')) {
    return 'Fallen Tree';
  }
  if (lower.includes('signal') || lower.includes('sign') || lower.includes('traffic')) {
    return 'Traffic signal';
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
