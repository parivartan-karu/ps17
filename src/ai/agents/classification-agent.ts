'use server';

import {
  validateCategory,
  clampConfidence,
  createAgentReceipt,
  type AgentLogEntry,
} from './types';
import type { AIDamageAssessmentOutput } from '@/ai/flows/ai-damage-assessment';

export type ClassificationInput = {
  cleanedDescription: string;
  mediaAnalysis?: AIDamageAssessmentOutput | null;
  citizenCategoryHint?: string;
  extractedIssueHints?: string[];
};

export type ClassificationOutput = {
  category: string;
  confidence: number;
  reasoning: string;
  isIllegalDumping: boolean;
  receipt: AgentLogEntry;
};

export async function classificationAgent(input: ClassificationInput): Promise<ClassificationOutput> {
  const startTime = performance.now();
  let selectedCategory = 'General Infrastructure';
  let confidence = 0.6;
  let reasoning = 'Rule-based evaluation of input text and hints.';
  let isIllegalDumping = false;
  let status: 'success' | 'fallback' | 'error' = 'success';
  let modelUsed = 'rule_classifier';

  // 1. Direct Visual Signal (Highest Confidence for Multimodal)
  if (input.mediaAnalysis) {
    const media = input.mediaAnalysis;
    if (media.illegalDumping?.detected) {
      selectedCategory = 'Illegal Dumping';
      confidence = clampConfidence(media.illegalDumping.confidence || 0.9);
      reasoning = `Visual evidence detected illegal dumping: ${media.illegalDumping.reason || 'Dumped waste visible'}.`;
      isIllegalDumping = true;
      modelUsed = 'gemini-vision+rule_classifier';
    } else if (media.damageCategory && media.damageCategory !== 'None') {
      selectedCategory = validateCategory(media.damageCategory);
      confidence = 0.85;
      reasoning = `Visual classification identified "${selectedCategory}" from uploaded evidence.`;
      modelUsed = 'gemini-vision+rule_classifier';
    }
  }

  // 2. If visual classification is inconclusive, evaluate text and citizen hints
  if (selectedCategory === 'General Infrastructure' || confidence < 0.7) {
    const textLower = input.cleanedDescription.toLowerCase();

    // Check illegal dumping in text
    if (textLower.includes('illegal dump') || textLower.includes('dumping waste') || textLower.includes('dumping garbage')) {
      selectedCategory = 'Illegal Dumping';
      confidence = 0.85;
      isIllegalDumping = true;
      reasoning = 'Text explicitly describes illegal waste dumping.';
    } else {
      // Try classifying from text hints
      const textMatchedCat = validateCategory(input.cleanedDescription);
      if (textMatchedCat !== 'General Infrastructure') {
        selectedCategory = textMatchedCat;
        confidence = 0.8;
        reasoning = `Matched canonical category "${selectedCategory}" from complaint description.`;
      } else if (input.citizenCategoryHint) {
        const hintMatchedCat = validateCategory(input.citizenCategoryHint);
        if (hintMatchedCat !== 'General Infrastructure') {
          selectedCategory = hintMatchedCat;
          confidence = 0.7;
          reasoning = `Using validated citizen category hint "${selectedCategory}".`;
        }
      }
    }
  }

  // 3. Secondary Groq text LLM call if still unclassified and text is non-empty
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  if (selectedCategory === 'General Infrastructure' && input.cleanedDescription.length > 10 && GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.1,
          max_tokens: 150,
          messages: [
            {
              role: 'system',
              content: `Classify citizen complaint into EXACTLY ONE of these categories: Pothole, Crack, Surface failure, Garbage/Debris, Illegal Dumping, Overflowing Bin, Uncleaned Street, Dead Animal, Streetlight Issue, Exposed wire, Power outage, Water-logged damage, Manhole issue, Water leak, Pipe burst, Fallen Tree, Overgrown Vegetation, Traffic signal, Damaged Signboard, Footpath Issue, Public Property Damage. Respond with valid JSON: {"category": string, "confidence": number, "reasoning": string}`,
            },
            {
              role: 'user',
              content: input.cleanedDescription,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || '';
        const cleanJson = rawContent.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.category) {
          selectedCategory = validateCategory(parsed.category);
          confidence = clampConfidence(parsed.confidence, 0.8);
          reasoning = parsed.reasoning || `LLM classified complaint as ${selectedCategory}`;
          modelUsed = 'groq-llama-3.3-70b';
        }
      }
    } catch (err: any) {
      console.warn('[classificationAgent] Groq LLM fallback:', err?.message);
      status = 'fallback';
    }
  }

  // Final validation and clamping
  const finalCategory = validateCategory(selectedCategory);
  const finalConfidence = clampConfidence(confidence, 0.6);

  const receipt = createAgentReceipt({
    agent: 'classification_agent',
    status,
    startTime,
    model: modelUsed,
    inputSummary: `Text len: ${input.cleanedDescription.length}, Media present: ${!!input.mediaAnalysis}`,
    outputSummary: `Category: "${finalCategory}", Confidence: ${finalConfidence}, IllegalDumping: ${isIllegalDumping}`,
    confidence: finalConfidence,
    reasoning,
  });

  return {
    category: finalCategory,
    confidence: finalConfidence,
    reasoning,
    isIllegalDumping,
    receipt,
  };
}
