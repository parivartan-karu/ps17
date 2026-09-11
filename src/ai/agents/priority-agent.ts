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
  riskScore: number; // 0 - 100
  riskScoreReasons: string[];
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
  let riskScore = 40;
  const riskScoreReasons: string[] = [];

  try {
    const textLower = (input.description || '').toLowerCase();
    const signals = input.urgencySignals || [];

    // Base risk calculation by category
    if (input.category === 'Manhole issue' || textLower.includes('open manhole')) {
      riskScore += 45;
      riskScoreReasons.push('Critical safety hazard: Open manhole detected (+45)');
    } else if (input.category === 'Exposed wire' || textLower.includes('live wire')) {
      riskScore += 50;
      riskScoreReasons.push('Critical electrical risk: Exposed live wire (+50)');
    } else if (input.category === 'Water pipe burst' || textLower.includes('pipe burst')) {
      riskScore += 35;
      riskScoreReasons.push('Major utility failure: Water pipe burst (+35)');
    } else if (input.isIllegalDumping || textLower.includes('illegal dumping')) {
      riskScore += 30;
      riskScoreReasons.push('Public health violation: Illegal dumping (+30)');
    } else if (input.category === 'Pothole' || textLower.includes('pothole')) {
      riskScore += 25;
      riskScoreReasons.push('Road infrastructure damage (+25)');
    } else {
      riskScore += 15;
      riskScoreReasons.push(`Standard category baseline: ${input.category} (+15)`);
    }

    // Keyword & urgency signal bonuses
    const criticalMatch = CRITICAL_KEYWORDS.filter((kw) => textLower.includes(kw));
    if (criticalMatch.length > 0) {
      riskScore += Math.min(30, criticalMatch.length * 15);
      riskScoreReasons.push(`Critical keywords matched: ${criticalMatch.join(', ')} (+${Math.min(30, criticalMatch.length * 15)})`);
    }

    const highMatch = HIGH_KEYWORDS.filter((kw) => textLower.includes(kw));
    if (highMatch.length > 0) {
      riskScore += Math.min(20, highMatch.length * 10);
      riskScoreReasons.push(`High priority signals matched: ${highMatch.join(', ')} (+${Math.min(20, highMatch.length * 10)})`);
    }

    if (input.mediaSeverity === 'High') {
      riskScore += 15;
      riskScoreReasons.push('High visual damage severity (+15)');
    } else if (input.mediaSeverity === 'Medium') {
      riskScore += 8;
      riskScoreReasons.push('Moderate visual damage severity (+8)');
    }

    if (input.nearbyReportCount && input.nearbyReportCount > 1) {
      const clusterBonus = Math.min(15, (input.nearbyReportCount - 1) * 5);
      riskScore += clusterBonus;
      riskScoreReasons.push(`Cluster density signal: ${input.nearbyReportCount} nearby reports (+${clusterBonus})`);
    }

    // Clamp risk score strictly 0 - 100
    riskScore = Math.min(100, Math.max(0, riskScore));

    // Map riskScore to Priority level
    if (riskScore >= 85) {
      assignedPriority = 'Critical';
      confidence = 0.95;
      reasoning = `Critical priority assigned (Risk Score: ${riskScore}/100) - severe public safety or utility hazard.`;
    } else if (riskScore >= 65) {
      assignedPriority = 'High';
      confidence = 0.85;
      reasoning = `High priority assigned (Risk Score: ${riskScore}/100) - urgent operational attention required.`;
    } else if (riskScore >= 35) {
      assignedPriority = 'Medium';
      confidence = 0.80;
      reasoning = `Medium priority assigned (Risk Score: ${riskScore}/100) - routine maintenance queue.`;
    } else {
      assignedPriority = 'Low';
      confidence = 0.75;
      reasoning = `Low priority assigned (Risk Score: ${riskScore}/100) - minor cosmetic or scheduled work.`;
    }
  } catch (err: any) {
    console.warn('[priorityAgent] Priority evaluation failure, safely defaulting to Medium:', err?.message);
    status = 'fallback';
    assignedPriority = 'Medium';
    riskScore = 50;
    riskScoreReasons.push('Priority agent error; safe default risk score applied (50)');
    reasoning = 'Priority calculation error; safely defaulted to Medium priority.';
  }

  // Validate priority to ensure guaranteed type contract
  const validatedPriority = validatePriority(assignedPriority);
  const finalConfidence = clampConfidence(confidence, 0.7);

  const receipt = createAgentReceipt({
    agent: 'priority_agent',
    status,
    startTime,
    model: 'risk_scoring_v2',
    inputSummary: `Category: "${input.category}", Signals: ${input.urgencySignals?.length || 0}`,
    outputSummary: `Priority: "${validatedPriority}", RiskScore: ${riskScore}/100, Confidence: ${finalConfidence}`,
    confidence: finalConfidence,
    reasoning,
  });

  return {
    priority: validatedPriority,
    confidence: finalConfidence,
    riskScore,
    riskScoreReasons,
    reasoning,
    receipt,
  };
}
