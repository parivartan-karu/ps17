'use server';
/**
 * @fileOverview AI agent for assessing municipal issues from images.
 * Primary: Uses Gemini 2.5 Flash vision model with GEMINI_API_KEY.
 * Fallback: Uses Groq API or safe default fallback object.
 */

export type AIDamageAssessmentInput = {
  mediaDataUri: string;
};

export type AIDamageAssessmentOutput = {
  damageDetected: boolean;
  damageCategory: string;
  severity: 'Low' | 'Medium' | 'High';
  verificationSuggestion: 'Likely genuine' | 'Needs manual verification';
  description: string;
  suggestedDepartment:
    | 'Engineering'
    | 'Sanitation'
    | 'Electrical'
    | 'Water Supply'
    | 'Parks & Environment'
    | 'Traffic & Roads'
    | 'Public Works'
    | 'Unassigned';
  suggestedPriority: 'Low' | 'Medium' | 'High' | 'Critical';
  duplicateSuggestion: string;
  illegalDumping?: {
    detected: boolean;
    confidence: number;
    wasteType?: string | null;
    vehicleDetected: boolean;
    vehicleType?: string | null;
    licensePlateVisible: boolean;
    licensePlateNumber?: string | null;
    evidenceQuality: 'good' | 'fair' | 'poor';
    reason?: string;
  } | null;
};

const FALLBACK: AIDamageAssessmentOutput = {
  damageDetected: false,
  damageCategory: 'None',
  severity: 'Low',
  verificationSuggestion: 'Needs manual verification',
  description: 'AI analysis is temporarily unavailable. Please manually select the correct problem category (e.g., Garbage/Debris, Pothole, Crack, Streetlight Issue) and write a description based on your photo.',
  suggestedDepartment: 'Unassigned',
  suggestedPriority: 'Medium',
  duplicateSuggestion: 'Unable to assess — manual verification required.',
  illegalDumping: null,
};

const SYSTEM_PROMPT = `You are an expert AI visual assessment assistant for a municipal corporation.
Look at this image/video frame and identify what civic issue or activity is visible.

CATEGORY RULES — match ONLY to what you actually see:
- Garbage, trash, litter, waste bags, dumped rubbish → "Garbage/Debris"
- Hole or depression in road → "Pothole"
- Cracks or fractures on road → "Crack"
- Crumbling or broken road surface → "Surface failure"
- Standing water or flooding → "Water-logged damage"
- Broken or non-functional streetlight → "Streetlight Issue"
- No issue visible or unclear image → "None"

CRITICAL RULE: If you see garbage or waste material → category MUST be "Garbage/Debris". Never classify it as road damage.

ILLEGAL DUMPING ANALYSIS:
Examine if the image potentially shows ILLEGAL DUMPING (waste being dumped in unauthorized public spaces, roads, drains, or by individuals/vehicles):
- "detected": true if there is visual evidence of garbage dumping in public areas, roadsides, drains, or from a vehicle.
- "confidence": confidence float between 0.0 and 1.0.
- "wasteType": type of waste if visible (e.g., "Construction Debris", "Domestic Waste", "Commercial Trash", "Plastic Waste", "Organic Waste").
- "vehicleDetected": true if a vehicle (truck, car, pickup, auto-rickshaw, two-wheeler) is involved or near the dumping spot.
- "vehicleType": type of vehicle if detected (e.g., "Truck", "Pickup Van", "Auto-rickshaw", "Car", "Two-wheeler") or null.
- "licensePlateVisible": true ONLY if a vehicle registration license plate is clearly visible.
- "licensePlateNumber": extracted Indian registration number using OCR (e.g., "MH12AB1234"). STRICT RULE: If plate is unreadable, partial, blurred, or missing, set to null. NEVER guess or hallucinate a license plate number.
- "evidenceQuality": "good" | "fair" | "poor" based on lighting, clarity, and visibility of the act.
- "reason": concise sentence describing what visual evidence suggests illegal dumping.

Respond ONLY with a valid JSON object matching this schema:
{
  "damageDetected": true or false,
  "damageCategory": "Pothole" | "Crack" | "Surface failure" | "Water-logged damage" | "Garbage/Debris" | "Streetlight Issue" | "None",
  "severity": "Low" | "Medium" | "High",
  "verificationSuggestion": "Likely genuine" | "Needs manual verification",
  "description": "2-5 sentences: what you see, its extent, public impact, and urgency",
  "suggestedDepartment": "Engineering" | "Sanitation" | "Electrical" | "Water Supply" | "Parks & Environment" | "Traffic & Roads" | "Public Works" | "Unassigned",
  "suggestedPriority": "Low" | "Medium" | "High" | "Critical",
  "duplicateSuggestion": "brief note on duplicate likelihood",
  "illegalDumping": {
    "detected": true or false,
    "confidence": 0.91,
    "wasteType": "Construction Debris",
    "vehicleDetected": true or false,
    "vehicleType": "Truck",
    "licensePlateVisible": true or false,
    "licensePlateNumber": "MH12AB1234" or null,
    "evidenceQuality": "good" | "fair" | "poor",
    "reason": "Image appears to show waste being unloaded from a vehicle onto a public road."
  }
}`;

export async function aiDamageAssessment(input: AIDamageAssessmentInput): Promise<AIDamageAssessmentOutput> {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENAI_API_KEY;
  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  // Parse data URI
  const match = input.mediaDataUri.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) {
    console.error('Invalid mediaDataUri format');
    return FALLBACK;
  }
  const [, mediaType, base64Data] = match;

  // 1. Try Gemini Vision Model (Primary)
  if (GEMINI_API_KEY) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { inline_data: { mime_type: mediaType, data: base64Data } },
                  { text: SYSTEM_PROMPT },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: 'application/json',
              temperature: 0.2,
            },
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const clean = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        return formatResult(parsed);
      } else {
        const errText = await response.text();
        console.warn(`Gemini Vision API returned status ${response.status}:`, errText);
      }
    } catch (err: any) {
      console.warn('Gemini Vision call failed, attempting fallback:', err?.message);
    }
  }

  // 2. Try Groq API as Secondary (if available)
  if (GROQ_API_KEY) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: SYSTEM_PROMPT,
                },
              ],
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawText = data.choices?.[0]?.message?.content || '';
        const clean = rawText.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(clean);
        return formatResult(parsed);
      } else {
        const errText = await response.text();
        console.warn(`Groq API returned status ${response.status}:`, errText);
      }
    } catch (err: any) {
      console.warn('Groq API call failed:', err?.message);
    }
  }

  return FALLBACK;
}

function formatResult(parsed: any): AIDamageAssessmentOutput {
  const validCategories = ['Pothole', 'Crack', 'Surface failure', 'Water-logged damage', 'Garbage/Debris', 'Streetlight Issue', 'None'];
  const validDepts     = ['Engineering', 'Sanitation', 'Electrical', 'Water Supply', 'Parks & Environment', 'Traffic & Roads', 'Public Works', 'Unassigned'];
  const validSeverities = ['Low', 'Medium', 'High'];
  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
  const validQuality    = ['good', 'fair', 'poor'];

  let dumpingData: AIDamageAssessmentOutput['illegalDumping'] = null;

  if (parsed.illegalDumping && typeof parsed.illegalDumping === 'object') {
    const rawDumping = parsed.illegalDumping;
    const isDetected = Boolean(rawDumping.detected);
    const confidence = typeof rawDumping.confidence === 'number' ? Math.max(0, Math.min(1, rawDumping.confidence)) : (isDetected ? 0.85 : 0);
    const plateNum = typeof rawDumping.licensePlateNumber === 'string' && rawDumping.licensePlateNumber.trim().length > 3
      ? rawDumping.licensePlateNumber.trim().toUpperCase()
      : null;

    dumpingData = {
      detected: isDetected,
      confidence,
      wasteType: typeof rawDumping.wasteType === 'string' ? rawDumping.wasteType : (isDetected ? 'General Waste' : null),
      vehicleDetected: Boolean(rawDumping.vehicleDetected),
      vehicleType: typeof rawDumping.vehicleType === 'string' ? rawDumping.vehicleType : null,
      licensePlateVisible: Boolean(rawDumping.licensePlateVisible) && !!plateNum,
      licensePlateNumber: plateNum,
      evidenceQuality: validQuality.includes(rawDumping.evidenceQuality) ? rawDumping.evidenceQuality : 'fair',
      reason: String(rawDumping.reason || 'Visual evidence evaluated.'),
    };
  }

  return {
    damageDetected:        Boolean(parsed.damageDetected),
    damageCategory:        validCategories.includes(parsed.damageCategory) ? parsed.damageCategory : (dumpingData?.detected ? 'Garbage/Debris' : 'None'),
    severity:              validSeverities.includes(parsed.severity) ? parsed.severity : 'Low',
    verificationSuggestion: parsed.verificationSuggestion === 'Likely genuine' ? 'Likely genuine' : 'Needs manual verification',
    description:           String(parsed.description || 'Please verify manually.'),
    suggestedDepartment:   validDepts.includes(parsed.suggestedDepartment) ? parsed.suggestedDepartment : (dumpingData?.detected ? 'Sanitation' : 'Unassigned'),
    suggestedPriority:     validPriorities.includes(parsed.suggestedPriority) ? parsed.suggestedPriority : 'Medium',
    duplicateSuggestion:   String(parsed.duplicateSuggestion || 'Manual verification recommended.'),
    illegalDumping:        dumpingData,
  };
}