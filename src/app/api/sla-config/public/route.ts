import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';
import { getSlaConfig } from '@/lib/sla-config-server';

export const dynamic = 'force-dynamic';

/** Public read-only SLA policy used by the citizen-facing policy page. */
export async function GET() {
  try {
    const { firestore } = await getFirebaseAdmin();
    const config = await getSlaConfig(firestore);
    return NextResponse.json({
      success: true,
      config: {
        global: config.global,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('[GET /api/sla-config/public] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch SLA policy.' }, { status: 500 });
  }
}
