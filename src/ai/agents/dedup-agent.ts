'use server';

import {
  clampConfidence,
  createAgentReceipt,
  type AgentLogEntry,
} from './types';

export type CandidateReport = {
  id: string;
  description: string;
  category: string;
  departmentId?: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
  status: string;
};

export type DedupInput = {
  category: string;
  description: string;
  latitude?: number;
  longitude?: number;
  candidateReports: CandidateReport[];
  maxCandidateLimit?: number; // Default 5, bounded max 10
};

export type DedupOutput = {
  isDuplicate: boolean;
  linkedIncidentId: string | null;
  linkedMatchType: 'exact_spatial_category' | 'ai_similarity' | 'none';
  linkedSimilarityScore: number | null;
  reasoning: string;
  candidateCountEvaluated: number;
  receipt: AgentLogEntry;
};

/**
 * Calculates Haversine distance between two lat/lng coordinates in meters.
 */

function getHaversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371e3; // Earth radius in meters
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculates word-level Jaccard similarity score between two texts (0.0 to 1.0).
 */
function getTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean));
  const words2 = new Set(text2.toLowerCase().replace(/[^a-z0-9]/g, ' ').split(/\s+/).filter(Boolean));
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }
  const union = new Set([...words1, ...words2]).size;
  return union === 0 ? 0 : intersection / union;
}

export async function dedupAgent(input: DedupInput): Promise<DedupOutput> {
  const startTime = performance.now();
  
  // Bound max candidate limit strictly between 1 and 10 (default 5)
  const maxLimit = Math.min(10, Math.max(1, input.maxCandidateLimit || 5));
  
  // Truncate candidate set strictly to bounded limit
  const candidates = (input.candidateReports || []).slice(0, maxLimit);
  
  let bestMatchId: string | null = null;
  let bestMatchType: DedupOutput['linkedMatchType'] = 'none';
  let bestSimilarityScore = 0;
  let isDuplicate = false;
  let reasoning = `Evaluated ${candidates.length} candidate report(s). No duplicate found.`;
  let status: 'success' | 'fallback' | 'error' = 'success';

  try {
    if (candidates.length > 0) {
      for (const cand of candidates) {
        let isSpatialMatch = false;
        let distanceMeters = Infinity;

        if (
          typeof input.latitude === 'number' &&
          typeof input.longitude === 'number' &&
          typeof cand.latitude === 'number' &&
          typeof cand.longitude === 'number'
        ) {
          distanceMeters = getHaversineDistanceMeters(
            input.latitude,
            input.longitude,
            cand.latitude,
            cand.longitude
          );
          if (distanceMeters <= 250) {
            isSpatialMatch = true;
          }
        }

        const categoryMatch =
          cand.category.toLowerCase().trim() === input.category.toLowerCase().trim();

        const textSim = getTextSimilarity(input.description, cand.description);

        // Calculate weighted overall similarity score
        let score = textSim * 0.5;
        if (isSpatialMatch) {
          score += 0.35 + (1 - Math.min(250, distanceMeters) / 250) * 0.15;
        }
        if (categoryMatch) {
          score += 0.15;
        }

        score = clampConfidence(score, 0);

        if (score > bestSimilarityScore) {
          bestSimilarityScore = score;
          bestMatchId = cand.id;

          if (isSpatialMatch && categoryMatch && score >= 0.65) {
            bestMatchType = 'exact_spatial_category';
          } else if (score >= 0.5) {
            bestMatchType = 'ai_similarity';
          }
        }
      }

      if (bestMatchId && bestSimilarityScore >= 0.6) {
        isDuplicate = true;
        reasoning = `Flagged as duplicate of incident "${bestMatchId}" with similarity score ${bestSimilarityScore.toFixed(
          2
        )} (${bestMatchType}).`;
      }
    }
  } catch (err: any) {
    console.warn('[dedupAgent] Evaluation error, safe fallback without duplicate linking:', err?.message);
    status = 'fallback';
    reasoning = 'Duplicate detection error; proceeded without linking duplicates.';
  }

  const finalConfidence = clampConfidence(bestSimilarityScore, 0.5);

  const receipt = createAgentReceipt({
    agent: 'dedup_agent',
    status,
    startTime,
    model: 'haversine+jaccard_dedup',
    inputSummary: `Candidates provided: ${input.candidateReports?.length || 0}, Evaluated: ${candidates.length}`,
    outputSummary: `IsDuplicate: ${isDuplicate}, LinkedId: ${bestMatchId || 'none'}, MatchType: ${bestMatchType}`,
    confidence: finalConfidence,
    reasoning,
  });

  return {
    isDuplicate,
    linkedIncidentId: isDuplicate ? bestMatchId : null,
    linkedMatchType: isDuplicate ? bestMatchType : 'none',
    linkedSimilarityScore: isDuplicate ? parseFloat(bestSimilarityScore.toFixed(2)) : null,
    reasoning,
    candidateCountEvaluated: candidates.length,
    receipt,
  };
}
