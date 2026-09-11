import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/firebase/server';


export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Haversine distance in km between two GPS points */
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Simple text similarity score 0-1 using word overlap */
function textSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const wordsB = new Set(b.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let common = 0;
  wordsA.forEach(w => { if (wordsB.has(w)) common++; });
  return common / Math.max(wordsA.size, wordsB.size);
}

/**
 * GET /api/reports/nearby?lat=&lng=&radius=0.5&category=
 * Returns reports within radius km with duplicate probability scores.
 * Also returns cluster heatmap points for the full city.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get('lat') ?? '');
  const lng = parseFloat(searchParams.get('lng') ?? '');
  const radiusKm = parseFloat(searchParams.get('radius') ?? '0.5');
  const category = searchParams.get('category') ?? '';
  const description = searchParams.get('description') ?? '';

  try {
    const { firestore } = await getFirebaseAdmin();

    const snap = await firestore
      .collection('reports')
      .where('status', 'in', ['Submitted', 'Under Verification', 'Assigned', 'In Progress'])
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();

    const allReports = snap.docs.map((d: any) => ({ id: d.id, ...d.data() })) as any[];

    // ── Nearby / duplicate detection ──────────────────────────────────────
    let nearby: any[] = [];
    if (!isNaN(lat) && !isNaN(lng)) {
      nearby = allReports
        .filter(r => r.latitude && r.longitude)
        .map(r => {
          const dist = haversine(lat, lng, r.latitude, r.longitude);
          const catMatch = category && r.category
            ? r.category.toLowerCase() === category.toLowerCase() ? 1 : 0.3
            : 0.5;
          const descSim = description ? textSimilarity(description, r.description ?? '') : 0;

          // Duplicate score: closer + same category + similar description = higher
          const distScore = Math.max(0, 1 - dist / radiusKm);
          const duplicateScore = Math.round((distScore * 0.5 + catMatch * 0.3 + descSim * 0.2) * 100);

          return { ...r, distanceKm: Math.round(dist * 1000) / 1000, duplicateScore };
        })
        .filter(r => r.distanceKm <= radiusKm)
        .sort((a, b) => b.duplicateScore - a.duplicateScore)
        .slice(0, 10);
    }

    // ── Heatmap cluster data (for map rendering) ──────────────────────────
    // Group all geo-tagged active reports into clusters by 0.3km grid cells
    const GRID = 0.003; // ~0.3km grid
    const clusters: Record<string, { lat: number; lng: number; count: number; category: string; priority: string }> = {};

    allReports.forEach(r => {
      if (!r.latitude || !r.longitude) return;
      const gridLat = Math.round(r.latitude / GRID) * GRID;
      const gridLng = Math.round(r.longitude / GRID) * GRID;
      const key = `${gridLat.toFixed(4)},${gridLng.toFixed(4)}`;
      if (!clusters[key]) {
        clusters[key] = { lat: gridLat, lng: gridLng, count: 0, category: r.category ?? '', priority: r.priority ?? 'Low' };
      }
      clusters[key].count++;
      // Escalate priority if a more severe report exists in the cluster
      const priorityRank = { Critical: 4, High: 3, Medium: 2, Low: 1 };
      if ((priorityRank[r.priority as keyof typeof priorityRank] ?? 1) >
        (priorityRank[clusters[key].priority as keyof typeof priorityRank] ?? 1)) {
        clusters[key].priority = r.priority ?? 'Low';
      }
    });

    const heatmapPoints = Object.values(clusters).filter(c => c.count > 0);

    return NextResponse.json({
      nearby,
      heatmapPoints,
      totalActive: allReports.length,
    });
  } catch (error) {
    console.error('nearby reports error:', error);
    return NextResponse.json({ error: 'Failed to fetch nearby reports.' }, { status: 500 });
  }
}
