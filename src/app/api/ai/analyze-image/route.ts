import { NextRequest, NextResponse } from 'next/server';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';
import { aiDamageAssessment } from '@/ai/flows/ai-damage-assessment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity(request, ['citizen']);

    const body = await request.json();
    const mediaDataUri = typeof body?.mediaDataUri === 'string' ? body.mediaDataUri : '';

    if (!mediaDataUri || !/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(mediaDataUri)) {
      return NextResponse.json({ error: 'A valid image data URI is required.' }, { status: 400 });
    }

    // Keep the endpoint bounded even if a client sends an unexpectedly large payload.
    if (mediaDataUri.length > 2_500_000) {
      return NextResponse.json({ error: 'Image is too large. Please retake the photo.' }, { status: 413 });
    }

    const result = await aiDamageAssessment({ mediaDataUri });
    const analysisAvailable = result.description !== '' && result.damageCategory !== 'None' && result.suggestedDepartment !== 'Unassigned';

    return NextResponse.json({
      success: true,
      analysisAvailable,
      result,
    });
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('[POST /api/ai/analyze-image] Error:', error);
    return NextResponse.json({ error: 'Image analysis service is unavailable.' }, { status: 503 });
  }
}
