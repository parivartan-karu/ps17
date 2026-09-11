'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type NearbyReport = {
  id: string;
  description: string;
  location: string;
  status: string;
  category: string;
  priority?: string;
  distanceKm: number;
  duplicateScore: number;
  timestamp: string;
};

export function useDuplicateDetection({
  lat,
  lng,
  category,
  description,
  enabled,
}: {
  lat?: number | null;
  lng?: number | null;
  category?: string;
  description?: string;
  enabled: boolean;
}) {
  const [nearby, setNearby] = useState<NearbyReport[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    if (!lat || !lng || !enabled) return;
    setIsChecking(true);
    try {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        radius: '0.4',
        ...(category ? { category } : {}),
        ...(description && description.length > 10 ? { description } : {}),
      });
      const res = await fetch(`/api/reports/nearby?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setNearby((data.nearby ?? []).filter((r: NearbyReport) => r.duplicateScore > 30));
    } catch {
      // silent – duplicate detection is non-critical
    } finally {
      setIsChecking(false);
    }
  }, [lat, lng, category, description, enabled]);

  // Debounce: re-check whenever inputs change, with 1.2s delay
  useEffect(() => {
    if (!enabled || !lat || !lng) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(check, 1200);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [check, enabled, lat, lng, category, description]);

  const topDuplicate = nearby.length > 0 ? nearby[0] : null;
  const isDuplicate = (topDuplicate?.duplicateScore ?? 0) >= 70;
  const isProbable = (topDuplicate?.duplicateScore ?? 0) >= 45 && !isDuplicate;

  return { nearby, isChecking, topDuplicate, isDuplicate, isProbable };
}
