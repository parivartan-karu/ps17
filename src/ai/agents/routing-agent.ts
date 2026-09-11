'use server';

import {
  normalizeDepartment,
  type CanonicalDepartmentId,
} from '@/lib/departments';
import {
  CATEGORY_DEPARTMENT_MAP,
  validateDepartmentId,
  clampConfidence,
  createAgentReceipt,
  type AgentLogEntry,
} from './types';

export type RoutingInput = {
  category: string;
  description: string;
  citizenDepartmentHint?: string;
  classificationConfidence?: number;
};

export type RoutingOutput = {
  departmentId: CanonicalDepartmentId;
  department: string; // Legacy display name for UI backward compatibility
  confidence: number;
  reasoning: string;
  routingPath: 'deterministic_category' | 'ai_reasoning' | 'fallback_unassigned';
  receipt: AgentLogEntry;
};

export async function routingAgent(input: RoutingInput): Promise<RoutingOutput> {
  const startTime = performance.now();
  let targetDepartmentId: CanonicalDepartmentId = 'dept_public_works';
  let routingPath: RoutingOutput['routingPath'] = 'fallback_unassigned';
  let confidence = 0.5;
  let reasoning = 'Fallback routing to default public works department.';
  let status: 'success' | 'fallback' | 'error' = 'success';
  let modelUsed = 'rule_router';

  try {
    // 1. Deterministic direct lookup by validated category
    const mappedDeptId = CATEGORY_DEPARTMENT_MAP[input.category];
    if (mappedDeptId) {
      targetDepartmentId = mappedDeptId;
      routingPath = 'deterministic_category';
      confidence = clampConfidence((input.classificationConfidence || 0.8) + 0.1, 0.95);
      const deptDef = normalizeDepartment(targetDepartmentId);
      reasoning = `Direct deterministic routing: Category "${input.category}" mapped to "${deptDef?.name || targetDepartmentId}".`;
    }

    // 2. Check citizen hint if direct lookup was unassigned or low confidence
    if (routingPath === 'fallback_unassigned' && input.citizenDepartmentHint) {
      const hintDeptObj = normalizeDepartment(input.citizenDepartmentHint);
      if (hintDeptObj) {
        targetDepartmentId = hintDeptObj.id;
        routingPath = 'ai_reasoning';
        confidence = 0.75;
        reasoning = `Routed to "${hintDeptObj.name}" based on user department hint normalization.`;
      }
    }

    // 3. Fallback AI reasoning if category was unmapped
    if (routingPath === 'fallback_unassigned' && input.description.length > 5) {
      const textLower = input.description.toLowerCase();
      if (
        textLower.includes('garbage') ||
        textLower.includes('dump') ||
        textLower.includes('waste') ||
        textLower.includes('trash') ||
        textLower.includes('debris') ||
        textLower.includes('bin') ||
        textLower.includes('uncollected') ||
        textLower.includes('accumulation')
      ) {
        targetDepartmentId = 'dept_sanitation';
        routingPath = 'ai_reasoning';
        confidence = 0.8;
        reasoning = 'Extracted sanitation/garbage/waste keywords from description.';
      } else if (
        textLower.includes('road') ||
        textLower.includes('pothole') ||
        textLower.includes('asphalt') ||
        textLower.includes('bridge') ||
        textLower.includes('footpath') ||
        textLower.includes('sidewalk') ||
        textLower.includes('pavement') ||
        textLower.includes('crack') ||
        textLower.includes('hazard')
      ) {
        targetDepartmentId = 'dept_engineering';
        routingPath = 'ai_reasoning';
        confidence = 0.8;
        reasoning = 'Extracted civil engineering/roads/footpath keywords from description.';
      } else if (textLower.includes('light') || textLower.includes('wire') || textLower.includes('electric') || textLower.includes('pole')) {
        targetDepartmentId = 'dept_electrical';
        routingPath = 'ai_reasoning';
        confidence = 0.8;
        reasoning = 'Extracted electrical/lighting keywords from description.';
      } else if (textLower.includes('water') || textLower.includes('pipe') || textLower.includes('drain') || textLower.includes('leak')) {
        targetDepartmentId = 'dept_water';
        routingPath = 'ai_reasoning';
        confidence = 0.8;
        reasoning = 'Extracted water supply/drainage keywords from description.';
      } else if (textLower.includes('traffic') || textLower.includes('signal') || textLower.includes('signboard')) {
        targetDepartmentId = 'dept_traffic';
        routingPath = 'ai_reasoning';
        confidence = 0.8;
        reasoning = 'Extracted traffic/roads keywords from description.';
      }
    }
  } catch (err: any) {
    console.warn('[routingAgent] Routing failure, using safe fallback:', err?.message);
    status = 'fallback';
    targetDepartmentId = 'dept_engineering';
    routingPath = 'fallback_unassigned';
    reasoning = 'Routing failure encountered; safely defaulted to Engineering department.';
  }

  // Ensure departmentId is canonical and valid
  const validatedDeptId = validateDepartmentId(targetDepartmentId);
  const deptDefinition = normalizeDepartment(validatedDeptId);
  const legacyDisplayDepartment = deptDefinition?.name || 'Engineering';
  const finalConfidence = clampConfidence(confidence, 0.7);

  const receipt = createAgentReceipt({
    agent: 'routing_agent',
    status: routingPath === 'fallback_unassigned' ? 'fallback' : status,
    startTime,
    model: modelUsed,
    inputSummary: `Category: "${input.category}", Has hint: ${!!input.citizenDepartmentHint}`,
    outputSummary: `DepartmentId: "${validatedDeptId}", Department: "${legacyDisplayDepartment}", Path: ${routingPath}`,
    confidence: finalConfidence,
    reasoning,
  });

  return {
    departmentId: validatedDeptId,
    department: legacyDisplayDepartment,
    confidence: finalConfidence,
    reasoning,
    routingPath,
    receipt,
  };
}
