'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  Layers, Flame, Clock,
  CheckCircle2, Compass, Landmark
} from 'lucide-react';

import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, DocumentData, Query } from 'firebase/firestore';
import type { Report } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';

// Dynamically import HeatMap to avoid SSR issues with Leaflet
const HeatMap = dynamic(() => import('@/components/heat-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      <p className="text-sm text-slate-500 font-medium">Loading Pune City Geo-Layer & Ward Boundaries…</p>
    </div>
  ),
});

// Non-completed statuses only
const ACTIVE_STATUSES = ['Submitted', 'Under Verification', 'Assigned', 'In Progress'];

export default function SmcDashboard() {
  const firestore = useFirestore();
  const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lng: number; reportId?: string } | null>(null);

  const allReportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'), orderBy('timestamp', 'desc'));
  }, [firestore]) as Query<DocumentData> | null;

  const { data: rawReports, isLoading } = useCollection<Report>(allReportsQuery);

  // Active (non-completed) reports
  const activeReports = useMemo(
    () => (rawReports ?? []).filter(r => ACTIVE_STATUSES.includes(r.status) && r.category && r.category.toLowerCase() !== 'none'),
    [rawReports],
  );

  // Operational metrics
  const metrics = useMemo(() => {
    const total = activeReports.length;
    const criticalOrHigh = activeReports.filter(r => r.priority === 'Critical' || r.priority === 'High').length;
    const pendingVerification = activeReports.filter(r => r.status === 'Submitted' || r.status === 'Under Verification').length;
    const inProgressOrAssigned = activeReports.filter(r => r.status === 'Assigned' || r.status === 'In Progress').length;
    return { total, criticalOrHigh, pendingVerification, inProgressOrAssigned };
  }, [activeReports]);

  // Map Data — all active reports with GPS coordinates
  const heatMapData = useMemo(() =>
    activeReports
      .filter(r => r.latitude && r.longitude)
      .map(r => ({
        lat: r.latitude!,
        lng: r.longitude!,
        location: r.location || 'Pune City',
        status: r.status,
        type: r.category,
        category: r.category,
        department: r.department,
        reportId: r.id,
        imageUrl: r.imageUrl,
        description: r.description,
        priority: r.priority,
        date: new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        count: 1,
      })),
    [activeReports],
  );

  const handleResetMapCenter = () => {
    setFocusedLocation({ lat: 18.5204, lng: 73.8567 });
  };

  return (
    <div className="h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3rem)] lg:h-[calc(100vh-3.5rem)] max-h-[calc(100vh-2.5rem)] overflow-hidden flex flex-col gap-3 p-2">

      {/* ── Top 4 KPI Cards ─────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0 w-full">

        {/* Active Incidents */}
        <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/70 dark:bg-indigo-950/50 px-3.5 py-2 shadow-sm flex flex-col justify-between min-w-[125px]">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-extrabold text-indigo-900 dark:text-indigo-200 uppercase tracking-wider">Active Cases</span>
            <span className="p-1 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300">
              <Layers className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-indigo-950 dark:text-white leading-none">{metrics.total}</p>
        </div>

        {/* Critical / High */}
        <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/70 dark:bg-red-950/50 px-3.5 py-2 shadow-sm flex flex-col justify-between min-w-[125px]">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-extrabold text-red-900 dark:text-red-200 uppercase tracking-wider">Critical / High</span>
            <span className="p-1 rounded-lg bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-300">
              <Flame className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-red-700 dark:text-red-400 leading-none">{metrics.criticalOrHigh}</p>
        </div>

        {/* Awaiting Triage */}
        <div className="rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/70 dark:bg-amber-950/50 px-3.5 py-2 shadow-sm flex flex-col justify-between min-w-[125px]">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-extrabold text-amber-900 dark:text-amber-200 uppercase tracking-wider">Awaiting Triage</span>
            <span className="p-1 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-700 dark:text-amber-300">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-300 leading-none">{metrics.pendingVerification}</p>
        </div>

        {/* Field Teams */}
        <div className="rounded-2xl border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/70 dark:bg-emerald-950/50 px-3.5 py-2 shadow-sm flex flex-col justify-between min-w-[125px]">
          <div className="flex items-center justify-between gap-1 mb-1">
            <span className="text-[10px] font-extrabold text-emerald-900 dark:text-emerald-200 uppercase tracking-wider">Field Teams</span>
            <span className="p-1 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <p className="text-2xl font-black text-emerald-800 dark:text-emerald-400 leading-none">{metrics.inProgressOrAssigned}</p>
        </div>
      </div>

      {/* ── Main: Full-width Map ─────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden relative rounded-3xl border border-slate-200 shadow-xl bg-slate-100 dark:bg-slate-900 dark:border-slate-800">
        {isLoading ? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-900 animate-pulse">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
            <p className="text-sm text-slate-500 font-medium">Loading Pune City Geo-Layer & Ward Boundaries…</p>
          </div>
        ) : (
          <div className="w-full h-full">
            <HeatMap
              data={heatMapData}
              selectedCategories={[]}
              selectedStatuses={[]}
              focusLocation={focusedLocation}
            />
          </div>
        )}

        {/* Floating Incident Counter & Reset */}
        {!isLoading && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-md">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
              {activeReports.length} Active Incident{activeReports.length !== 1 ? 's' : ''} Mapped
            </span>
            <button
              onClick={handleResetMapCenter}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3 py-1 text-xs font-semibold text-slate-600 hover:text-blue-600 dark:text-slate-300 shadow-md transition-colors"
              title="Reset map view to Pune City Center"
            >
              <Compass className="h-3.5 w-3.5 text-blue-600" />
              Reset Center
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
