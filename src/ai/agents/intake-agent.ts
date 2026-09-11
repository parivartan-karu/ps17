'use server';

import { aiDamageAssessment, type AIDamageAssessmentOutput } from '@/ai/flows/ai-damage-assessment';
import { createAgentReceipt, type AgentLogEntry } from './types';

export type IntakeInput = {
  description: string;
  location?: string;
  roadName?: string;
  latitude?: number;
  longitude?: number;
  mediaDataUri?: string;
  citizenCategoryHint?: string;
};

export type IntakeOutput = {
  cleanedDescription: string;
  mentionedLocation?: string;
  urgencySignals: string[];
  extractedIssueHints: string[];
  mediaAnalyzed: boolean;
  rawMediaAnalysis?: AIDamageAssessmentOutput | null;
  receipt: AgentLogEntry;
};

const URGENCY_KEYWORDS = [
  'urgent',
  'danger',
  'dangerous',
  'hazard',
  'blocking',
  'emergency',
  'fire',
  'spark',
  'accident',
  'overflowing',
  'immediate',
  'critical',
  'collapsed',
  'flooding',
  'burst',
];

export async function intakeAgent(input: IntakeInput): Promise<IntakeOutput> {
  const startTime = performance.now();
  const rawText = input.description || '';
  const cleanedDescription = rawText.trim().replace(/\s+/g, ' ');

  // Extract urgency signals
  const lowerText = cleanedDescription.toLowerCase();
  const urgencySignals = URGENCY_KEYWORDS.filter((word) => lowerText.includes(word));

  // Extract issue hints from text
  const extractedIssueHints: string[] = [];
  if (input.citizenCategoryHint) {
    extractedIssueHints.push(input.citizenCategoryHint.trim());
  }

  let mediaAnalyzed = false;
  let rawMediaAnalysis: AIDamageAssessmentOutput | null = null;
  let modelUsed = 'rule_intake';
  let status: 'success' | 'fallback' | 'error' = 'success';

  if (input.mediaDataUri && input.mediaDataUri.startsWith('data:image/')) {
    try {
      rawMediaAnalysis = await aiDamageAssessment({ mediaDataUri: input.mediaDataUri });
      mediaAnalyzed = true;
      modelUsed = 'gemini-2.5-flash+rule_intake';

      if (rawMediaAnalysis.damageCategory && rawMediaAnalysis.damageCategory !== 'None') {
        extractedIssueHints.push(rawMediaAnalysis.damageCategory);
      }
      if (rawMediaAnalysis.illegalDumping?.detected) {
        extractedIssueHints.push('Illegal Dumping');
        urgencySignals.push('illegal_dumping');
      }
      if (rawMediaAnalysis.severity === 'High') {
        urgencySignals.push('high_visual_severity');
      }
    } catch (err: any) {
      console.warn('[intakeAgent] Media analysis fallback:', err?.message);
      status = 'fallback';
    }
  }

  const locationDetails = [input.roadName, input.location]
    .filter(Boolean)
    .join(', ')
    .trim();

  const receipt = createAgentReceipt({
    agent: 'intake_agent',
    status,
    startTime,
    model: modelUsed,
    inputSummary: `Text length: ${cleanedDescription.length}, Has media: ${mediaAnalyzed}`,
    outputSummary: `Cleaned text, Urgency signals: ${urgencySignals.length}, Media analyzed: ${mediaAnalyzed}`,
    confidence: mediaAnalyzed ? 0.9 : 0.75,
    reasoning: `Normalized raw citizen input and extracted ${urgencySignals.length} urgency signal(s).`,
  });

  return {
    cleanedDescription,
    mentionedLocation: locationDetails || undefined,
    urgencySignals: Array.from(new Set(urgencySignals)),
    extractedIssueHints: Array.from(new Set(extractedIssueHints)),
    mediaAnalyzed,
    rawMediaAnalysis,
    receipt,
  };
}
