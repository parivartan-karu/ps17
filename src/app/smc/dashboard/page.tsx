'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { 
  Filter, MapPin, X, Layers, Flame, Clock, 
  CheckCircle2, Search, Compass, RefreshCw, Landmark
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, DocumentData, Query } from 'firebase/firestore';
import type { Report } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';
import { Skeleton } from '@/components/ui/skeleton';
import { PUNE_ADMIN_WARDS, type PuneWard } from '@/lib/pune-wards';

// Dynamically import HeatMap to avoid SSR issues with Leaflet
const HeatMap = dynamic(() => import('@/components/heat-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[420px] bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
      <p className="text-sm text-slate-500 font-medium">Loading Pune City Geo-Layer &amp; Ward Boundaries…</p>
    </div>
  ),
});

// Non-completed statuses only
const ACTIVE_STATUSES = ['Submitted', 'Under Verification', 'Assigned', 'In Progress'];

// Category colour palette (matches heat-map.tsx CATEGORY_COLORS)
const CATEGORY_COLORS: Record<string, { color: string; border: string; bg: string }> = {
  Garbage:          { color: '#f59e0b', border: 'border-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  'Garbage/Debris': { color: '#f59e0b', border: 'border-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30' },
  'Road Damage':     { color: '#ef4444', border: 'border-red-400',   bg: 'bg-red-50 dark:bg-red-950/30' },
  Pothole:          { color: '#ef4444', border: 'border-red-400',   bg: 'bg-red-50 dark:bg-red-950/30' },
  Crack:            { color: '#f97316', border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  'Surface failure':{ color: '#dc2626', border: 'border-red-500',   bg: 'bg-red-50 dark:bg-red-950/30' },
  'Water Supply':    { color: '#3b82f6', border: 'border-blue-400',  bg: 'bg-blue-50 dark:bg-blue-950/30' },
  Electrical:       { color: '#8b5cf6', border: 'border-purple-400',bg: 'bg-purple-50 dark:bg-purple-950/30' },
  Sewage:           { color: '#10b981', border: 'border-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  'Tree / Garden':  { color: '#22c55e', border: 'border-green-400', bg: 'bg-green-50 dark:bg-green-950/30' },
  Encroachment:     { color: '#f97316', border: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/30' },
  Noise:            { color: '#ec4899', border: 'border-pink-400',  bg: 'bg-pink-50 dark:bg-pink-950/30' },
  Other:            { color: '#6b7280', border: 'border-slate-400', bg: 'bg-slate-50 dark:bg-slate-900' },
};

function getCategoryConfig(cat?: string) {
  if (!cat) return { color: '#6366f1', border: 'border-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' };
  return CATEGORY_COLORS[cat] || { color: '#6366f1', border: 'border-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30' };
}

export default function SmcDashboard() {
  const firestore = useFirestore();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriority, setSelectedPriority] = useState<string>('All');
  const [selectedWard, setSelectedWard] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [focusedLocation, setFocusedLocation] = useState<{ lat: number; lng: number; reportId?: string } | null>(null);

  const allReportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'), orderBy('timestamp', 'desc'));
  }, [firestore]) as Query<DocumentData> | null;

  const { data: rawReports, isLoading } = useCollection<Report>(allReportsQuery);

  // Active (non-completed) reports on the map, excluding the "None" category
  const activeReports = useMemo(
    () => (rawReports ?? []).filter(r => ACTIVE_STATUSES.includes(r.status) && r.category && r.category.toLowerCase() !== 'none'),
    [rawReports],
  );

  // Dynamic category list
  const uniqueCategories = useMemo(() => {
    const cats = new Set(activeReports.map(r => r.category).filter(Boolean) as string[]);
    return Array.from(cats).sort();
  }, [activeReports]);

  // Operational metrics
  const metrics = useMemo(() => {
    const total = activeReports.length;
    const criticalOrHigh = activeReports.filter(r => r.priority === 'Critical' || r.priority === 'High').length;
    const pendingVerification = activeReports.filter(r => r.status === 'Submitted' || r.status === 'Under Verification').length;
    const inProgressOrAssigned = activeReports.filter(r => r.status === 'Assigned' || r.status === 'In Progress').length;
    return { total, criticalOrHigh, pendingVerification, inProgressOrAssigned };
  }, [activeReports]);

  // Filtered reports for map
  const filteredReports = useMemo(() => {
    return activeReports.filter(r => {
      // Category filter
      const catMatch = selectedCategories.length === 0 || selectedCategories.includes(r.category);
      // Priority filter
      const prioMatch = selectedPriority === 'All' || r.priority === selectedPriority;
      // Search query filter
      const q = searchQuery.trim().toLowerCase();
      const searchMatch = !q || 
        (r.description || '').toLowerCase().includes(q) ||
        (r.location || '').toLowerCase().includes(q) ||
        (r.roadName || '').toLowerCase().includes(q) ||
        (r.category || '').toLowerCase().includes(q);

      return catMatch && prioMatch && searchMatch;
    });
  }, [activeReports, selectedCategories, selectedPriority, searchQuery]);

  // Map Data
  const heatMapData = useMemo(() =>
    filteredReports
      .filter(r => r.latitude && r.longitude)
      .map(r => ({
        lat:         r.latitude!,
        lng:         r.longitude!,
        location:    r.location || 'Pune City',
        status:      r.status,
        type:        r.category,
        category:    r.category,
        department:  r.department,
        reportId:    r.id,
        imageUrl:    r.imageUrl,
        description: r.description,
        priority:    r.priority,
        date:        new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        count:       1,
      })),
    [filteredReports],
  );

  const toggleCategory = (cat: string) =>
    setSelectedCategories(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat],
    );

  const clearAllFilters = () => {
    setSelectedCategories([]);
    setSelectedPriority('All');
    setSelectedWard(null);
    setSearchQuery('');
    setFocusedLocation({ lat: 18.5204, lng: 73.8567 });
  };

  const handleSelectWardChip = (ward: PuneWard) => {
    if (selectedWard === ward.name) {
      setSelectedWard(null);
      setFocusedLocation({ lat: 18.5204, lng: 73.8567 });
    } else {
      setSelectedWard(ward.name);
      setFocusedLocation({ lat: ward.center[0], lng: ward.center[1] });
    }
  };

  const handleResetMapCenter = () => {
    setSelectedWard(null);
    setFocusedLocation({ lat: 18.5204, lng: 73.8567 });
  };

  return (
    <div className="h-[calc(100vh-2.5rem)] md:h-[calc(100vh-3rem)] lg:h-[calc(100vh-3.5rem)] max-h-[calc(100vh-2.5rem)] overflow-hidden flex flex-col">
      
      {/* ── Main 2-Side Grid Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-full overflow-hidden">

        {/* ── Left Side: Live Pune Spatial & Ward Map (Full Height) ─────────── */}
        <div className="lg:col-span-7 xl:col-span-8 h-full relative rounded-3xl overflow-hidden border border-slate-200 shadow-xl bg-slate-100 dark:bg-slate-900 dark:border-slate-800">
          {isLoading ? (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-slate-100 dark:bg-slate-900 animate-pulse">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-t-transparent" />
              <p className="text-sm text-slate-500 font-medium">Loading Pune City Geo-Layer &amp; Ward Boundaries…</p>
            </div>
          ) : (
            <div className="w-full h-full">
              <HeatMap
                data={heatMapData}
                selectedCategories={selectedCategories}
                selectedStatuses={[]}
                focusLocation={focusedLocation}
                selectedWard={selectedWard}
                onSelectWard={(w) => setSelectedWard(w)}
              />
            </div>
          )}

          {/* Floating Top Indicator & Reset Button */}
          {!isLoading && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200 dark:border-slate-800 px-3.5 py-1 text-xs font-bold text-slate-800 dark:text-slate-100 shadow-md">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                {filteredReports.length} Active Incident{filteredReports.length !== 1 ? 's' : ''} Mapped
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

        {/* ── Right Side: KPIs, Filters, Search & Ward Selector (Scrollable Panel) ── */}
        <div className="lg:col-span-5 xl:col-span-4 h-full flex flex-col gap-3 overflow-y-auto pr-1 custom-scrollbar">

          {/* ── Executive Header Card ─────────────────────────────────────── */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 p-4 text-white shadow-lg border border-slate-800 shrink-0">
            <div className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rounded-full bg-indigo-600/20 blur-2xl" />

            <div className="relative z-10 flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse ring-2 ring-emerald-400/20" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">PMC Command Operations</span>
            </div>

            <h1 className="text-lg font-extrabold tracking-tight flex items-center gap-2 text-white">
              <Landmark className="h-5 w-5 text-indigo-400" />
              Pune City Spatial Control
            </h1>
            <p className="text-[11px] text-slate-300/80 mt-0.5 leading-snug">
              16 Administrative Wards (including Alandi PMRDA) &amp; Real-time Operations
            </p>
          </div>

          {/* ── Real-time KPI Stats 2x2 Grid ─────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2 shrink-0">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/40 p-2.5 backdrop-blur-md">
              <p className="text-[11px] text-indigo-300 font-medium flex items-center gap-1">
                <Layers className="h-3 w-3 text-indigo-400" />
                Active Cases
              </p>
              <p className="text-xl font-black text-white mt-0.5">{metrics.total}</p>
            </div>

            <div className="rounded-xl border border-red-500/20 bg-red-950/40 p-2.5 backdrop-blur-md">
              <p className="text-[11px] text-red-300 font-medium flex items-center gap-1">
                <Flame className="h-3 w-3 text-red-400" />
                Critical / High
              </p>
              <p className="text-xl font-black text-red-400 mt-0.5">{metrics.criticalOrHigh}</p>
            </div>

            <div className="rounded-xl border border-amber-500/20 bg-amber-950/40 p-2.5 backdrop-blur-md">
              <p className="text-[11px] text-amber-300 font-medium flex items-center gap-1">
                <Clock className="h-3 w-3 text-amber-400" />
                Awaiting Triage
              </p>
              <p className="text-xl font-black text-amber-300 mt-0.5">{metrics.pendingVerification}</p>
            </div>

            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/40 p-2.5 backdrop-blur-md">
              <p className="text-[11px] text-emerald-300 font-medium flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                Field Teams
              </p>
              <p className="text-xl font-black text-emerald-400 mt-0.5">{metrics.inProgressOrAssigned}</p>
            </div>
          </div>

          {/* ── Search Bar Card ───────────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by road, landmark, or description..."
                className="pl-8 h-8 rounded-lg bg-slate-50 border-slate-200 dark:bg-slate-900 dark:border-slate-800 text-xs"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>

          {/* ── Priority Filter Card ──────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Filter by Priority:</span>
              {(selectedCategories.length > 0 || selectedPriority !== 'All' || selectedWard || searchQuery) && (
                <Button
                  onClick={clearAllFilters}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] font-semibold text-slate-500 hover:text-slate-800 gap-1 px-1.5"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  Reset
                </Button>
              )}
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {['All', 'Critical', 'High', 'Medium', 'Low'].map((prio) => {
                const active = selectedPriority === prio;
                return (
                  <button
                    key={prio}
                    onClick={() => setSelectedPriority(prio)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                      active
                        ? prio === 'Critical' || prio === 'High'
                          ? 'bg-red-600 text-white shadow-sm'
                          : 'bg-indigo-600 text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                    }`}
                  >
                    {prio}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Category Filters Card ─────────────────────────────────────── */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Filter className="h-3 w-3 text-indigo-500" />
                Damage Categories:
              </span>
              <span className="text-[10px] text-slate-400">
                <strong>{filteredReports.length}</strong> / {activeReports.length}
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar">
              {isLoading ? (
                [1, 2, 3, 4].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)
              ) : uniqueCategories.length === 0 ? (
                <span className="text-xs text-slate-400 italic">No active categories</span>
              ) : (
                uniqueCategories.map(cat => {
                  const active = selectedCategories.includes(cat);
                  const cfg = getCategoryConfig(cat);
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border transition-all ${
                        active
                          ? 'text-white shadow-sm'
                          : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800'
                      }`}
                      style={active ? { backgroundColor: cfg.color, borderColor: cfg.color } : {}}
                    >
                      <span
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: active ? 'rgba(255,255,255,0.9)' : cfg.color }}
                      />
                      {cat}
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* ── PMC Administrative Wards (16 Prabhag Zones) Card ─────────── */}
          <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950 flex-1">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider flex items-center gap-1">
                <Landmark className="h-3 w-3 text-blue-600" />
                PMC Administrative Wards (16):
              </span>
              {selectedWard && (
                <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 truncate max-w-[140px]">
                  {selectedWard}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => { setSelectedWard(null); setFocusedLocation({ lat: 18.5204, lng: 73.8567 }); }}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold border transition-all ${
                  !selectedWard
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                All 16 Wards
              </button>

              {PUNE_ADMIN_WARDS.map((ward) => {
                const active = selectedWard === ward.name;
                return (
                  <button
                    key={ward.id}
                    onClick={() => handleSelectWardChip(ward)}
                    className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium border transition-all ${
                      active
                        ? 'bg-blue-600 text-white border-blue-600 shadow-md font-semibold'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                    }`}
                  >
                    <span className="text-[9px] font-bold px-1 rounded bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {ward.code}
                    </span>
                    {ward.name}
                  </button>
                );
              })}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}


