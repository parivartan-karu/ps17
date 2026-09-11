'use server';

import {
  validatePriority,
  clampConfidence,
  createAgentReceipt,
  type AgentLogEntry,
} from './types';

export type PriorityInput = {
  category: string;
  description: string;
  urgencySignals?: string[];
  isIllegalDumping?: boolean;
  nearbyReportCount?: number;
  mediaSeverity?: 'Low' | 'Medium' | 'High';
};

export type PriorityOutput = {
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  confidence: number;
  reasoning: string;
  receipt: AgentLogEntry;
};

const CRITICAL_KEYWORDS = [
  'fire',
  'live wire',
  'exposed high voltage',
  'sparking',
  'bridge collapse',
  'massive flooding',
  'accident risk',
  'open manhole',
];

const HIGH_KEYWORDS = [
  'pothole on highway',
  'busy intersection',
  'traffic light out',
  'pipe burst',
  'illegal dumping',
  'overflowing drain',
  'hazardous',
];

export async function priorityAgent(input: PriorityInput): Promise<PriorityOutput> {
  const startTime = performance.now();
  let assignedPriority: 'Low' | 'Medium' | 'High' | 'Critical' = 'Medium';
  let confidence = 0.7;
  let reasoning = 'Evaluated priority based on severity signals and category.';
  let status: 'success' | 'fallback' | 'error' = 'success';

  try {
    const textLower = (input.description || '').toLowerCase();
    const signals = input.urgencySignals || [];

    // 1. Critical Priority Checks
    const hasCriticalKeyword = CRITICAL_KEYWORDS.some((kw) => textLower.includes(kw));
    const isManhole = input.category === 'Manhole issue' || textLower.includes('open manhole');
    const isLiveWire = input.category === 'Exposed wire' || textLower.includes('live wire') || textLower.includes('sparking');

    if (hasCriticalKeyword || isManhole || isLiveWire) {
      assignedPriority = 'Critical';
      confidence = 0.95;
      reasoning = `Critical priority assigned due to severe public safety hazard (${isManhole ? 'Open Manhole' : isLiveWire ? 'Exposed Live Wire' : 'Critical Risk Signal'}).`;
    } 
    // 2. High Priority Checks
    else if (
      input.mediaSeverity === 'High' ||
      input.isIllegalDumping ||
      (input.nearbyReportCount && input.nearbyReportCount >= 3) ||
      signals.length >= 2 ||
      HIGH_KEYWORDS.some((kw) => textLower.includes(kw))
    ) {
      assignedPriority = 'High';
      confidence = 0.85;
      reasoning = `High priority assigned based on ${
        input.isIllegalDumping
          ? 'illegal dumping evidence'
          : (input.nearbyReportCount || 0) >= 3
          ? 'high density of nearby reports'
          : 'high urgency signals'
      }.`;
    }
    // 3. Medium Priority Checks (Default Fallback)
    else if (
      input.mediaSeverity === 'Medium' ||
      !input.description ||
      input.category === 'Unknown' ||
      input.category === 'General Infrastructure' ||
      ['Pothole', 'Water leak', 'Traffic signal', 'Streetlight Issue'].includes(input.category)
    ) {
      assignedPriority = 'Medium';
      confidence = 0.8;
      reasoning = `Standard operational category "${input.category}" assigned Medium priority.`;
    }
    // 4. Low Priority
    else {
      assignedPriority = 'Low';
      confidence = 0.75;
      reasoning = `Routine civic maintenance item assigned Low priority.`;
    }
  } catch (err: any) {
    console.warn('[priorityAgent] Priority evaluation failure, safely defaulting to Medium:', err?.message);
    status = 'fallback';
    assignedPriority = 'Medium';
    reasoning = 'Priority calculation error; safely defaulted to Medium priority.';
  }

  // Validate priority to ensure guaranteed type contract
  const validatedPriority = validatePriority(assignedPriority);
  const finalConfidence = clampConfidence(confidence, 0.7);

  const receipt = createAgentReceipt({
    agent: 'priority_agent',
    status,
    startTime,
    model: 'rule_priority',
    inputSummary: `Category: "${input.category}", Urgency signals: ${input.urgencySignals?.length || 0}`,
    outputSummary: `Priority: "${validatedPriority}", Confidence: ${finalConfidence}`,
    confidence: finalConfidence,
    reasoning,
  });

  return {
    priority: validatedPriority,
    confidence: finalConfidence,
    reasoning,
    receipt,
  };
}
