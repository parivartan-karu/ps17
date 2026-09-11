'use client';

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Plus, Trash2, ShieldCheck, Hospital, Flame, Toilet, Building2, AlertTriangle,
  type LucideIcon,
} from 'lucide-react';
import { renderToStaticMarkup } from 'react-dom/server';
import { collection, query, where } from 'firebase/firestore';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import type { CivicService, CivicServiceCategory, Report } from '@/lib/types';

// ─── Category config ──────────────────────────────────────────────────────────

type CategoryConfig = {
  label: string;
  Icon: LucideIcon;
  pinBg: string;       // marker pin background (hex)
  chipActive: string;  // tailwind classes when chip is active
  chipInactive: string;
  iconColor: string;   // hex for inline SVG
};

export const CATEGORIES: Record<CivicServiceCategory | 'garbage_problem', CategoryConfig> = {
  garbage:         { label: 'Garbage Bins',      Icon: Trash2,         pinBg: '#16a34a', iconColor: '#fff', chipActive: 'bg-green-600 text-white border-green-600',   chipInactive: 'bg-white text-slate-500 border-slate-200' },
  garbage_problem: { label: 'Garbage Problems',  Icon: AlertTriangle,  pinBg: '#ef4444', iconColor: '#fff', chipActive: 'bg-red-600 text-white border-red-600',       chipInactive: 'bg-white text-slate-500 border-slate-200' },
  police:          { label: 'Police',            Icon: ShieldCheck,    pinBg: '#2563eb', iconColor: '#fff', chipActive: 'bg-blue-600 text-white border-blue-600',     chipInactive: 'bg-white text-slate-500 border-slate-200' },
  hospital:        { label: 'Hospitals',         Icon: Hospital,       pinBg: '#dc2626', iconColor: '#fff', chipActive: 'bg-red-600 text-white border-red-600',       chipInactive: 'bg-white text-slate-500 border-slate-200' },
  fire:            { label: 'Fire Station',      Icon: Flame,          pinBg: '#ea580c', iconColor: '#fff', chipActive: 'bg-orange-500 text-white border-orange-500', chipInactive: 'bg-white text-slate-500 border-slate-200' },
  toilet:          { label: 'Toilets',           Icon: Toilet,         pinBg: '#7c3aed', iconColor: '#fff', chipActive: 'bg-violet-600 text-white border-violet-600', chipInactive: 'bg-white text-slate-500 border-slate-200' },
  municipal:       { label: 'Municipal Office',  Icon: Building2,      pinBg: '#0d9488', iconColor: '#fff', chipActive: 'bg-teal-600 text-white border-teal-600',     chipInactive: 'bg-white text-slate-500 border-slate-200' },
};

const ALL_CATS = Object.keys(CATEGORIES) as (CivicServiceCategory | 'garbage_problem')[];

// ─── Map marker: teardrop pin with inline SVG icon ────────────────────────────

function makeMarkerIcon(category: CivicServiceCategory | 'garbage_problem'): L.DivIcon {
  const { Icon, pinBg, iconColor } = CATEGORIES[category];
  // Render the Lucide icon to an SVG string (16×16, no stroke-width override needed)
  const svgStr = renderToStaticMarkup(
    <Icon size={16} color={iconColor} strokeWidth={2.2} />
  );

  const html = `
    <div style="
      position:relative;
      width:36px;height:44px;
      filter:drop-shadow(0 2px 4px rgba(0,0,0,0.28));
    ">
      <!-- teardrop body -->
      <svg viewBox="0 0 36 44" width="36" height="44" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 2C10.268 2 4 8.268 4 16c0 10 14 26 14 26S32 26 32 16C32 8.268 25.732 2 18 2z"
              fill="${pinBg}" />
        <circle cx="18" cy="16" r="9" fill="rgba(255,255,255,0.18)" />
      </svg>
      <!-- icon centred in the circle -->
      <div style="
        position:absolute;
        top:8px;left:10px;
        width:16px;height:16px;
        display:flex;align-items:center;justify-content:center;
      ">${svgStr}</div>
    </div>`;

  return L.divIcon({
    className: '',
    html,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
    popupAnchor: [0, -46],
  });
}

// ─── Popup HTML ───────────────────────────────────────────────────────────────

function buildPopupHtml(
  service: {
    id: string;
    category: CivicServiceCategory | 'garbage_problem';
    name: string;
    location: string;
    latitude: number;
    longitude: number;
    imageUrl?: string;
  },
  userLat: number | null,
  userLng: number | null
): string {
  const cat = CATEGORIES[service.category];
  const mapsUrl =
    userLat && userLng
      ? `https://www.google.com/maps/dir/${userLat},${userLng}/${service.latitude},${service.longitude}`
      : `https://www.google.com/maps?q=${service.latitude},${service.longitude}`;

  const imgHtml = service.imageUrl
    ? `<img src="${service.imageUrl}" alt="${service.name}"
         style="width:100%;height:130px;object-fit:cover;display:block;margin-bottom:10px"/>`
    : '';

  // Inline SVG for the category icon inside the popup (no PNG)
  const iconSvg = renderToStaticMarkup(
    <cat.Icon size={14} color={cat.pinBg} strokeWidth={2.2} />
  );

  return `
    <div style="width:220px;font-family:system-ui,sans-serif;padding:0">
      ${imgHtml}
      <div style="padding:0 2px 2px">
        <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px">
          ${iconSvg}
          <span style="font-size:10px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.06em">
            ${cat.label}
          </span>
        </div>
        <p style="margin:0 0 6px;font-size:13px;font-weight:700;color:#111827;line-height:1.3">
          ${service.name || cat.label}
        </p>
        <p style="margin:0 0 10px;font-size:11px;color:#6b7280;line-height:1.4">
          ${service.location.split(',').slice(0, 3).join(', ')}
        </p>
        <a href="${mapsUrl}" target="_blank" rel="noopener"
           style="display:inline-flex;align-items:center;gap:5px;background:#10b981;color:white;
                  font-size:11px;font-weight:600;padding:6px 14px;border-radius:20px;text-decoration:none">
          Get Directions
        </a>
      </div>
    </div>`;
}

// ─── Default center & Pune Bounds ─────────────────────────────────────────────

const DEFAULT_CENTER = { lat: 18.5204, lng: 73.8567 }; // Pune City center
const PUNE_BOUNDS: L.LatLngBoundsExpression = [
  [18.38, 73.70],
  [18.73, 74.05],
];

function isWithinPuneCity(lat: number, lng: number): boolean {
  return lat >= 18.35 && lat <= 18.75 && lng >= 73.65 && lng <= 74.08;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NearbyServicesMap() {
  const firestore = useFirestore();

  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'civic_services'),
      where('status', '==', 'approved')
    );
  }, [firestore]);

  const { data: services } = useCollection<CivicService>(servicesQuery);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(
      collection(firestore, 'reports'),
      where('category', '==', 'Garbage/Debris')
    );
  }, [firestore]);

  const { data: rawReports } = useCollection<Report>(reportsQuery);

  const activeReports = useMemo(() => {
    if (!rawReports) return [];
    return rawReports.filter((r: Report) => r.latitude && r.longitude && isWithinPuneCity(r.latitude, r.longitude) && !['Resolved', 'Rejected'].includes(r.status));
  }, [rawReports]);

  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  const [activeFilters, setActiveFilters] = useState<(CivicServiceCategory | 'garbage_problem')[]>([...ALL_CATS]);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(true);
  const [showRegister, setShowRegister] = useState(false);
  const [counts, setCounts] = useState<Partial<Record<CivicServiceCategory | 'garbage_problem', number>>>({});

  // ── Init map ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      zoomAnimation: false,
      attributionControl: false,
      minZoom: 11,
      maxZoom: 19,
      maxBounds: PUNE_BOUNDS,
      maxBoundsViscosity: 1.0,
    }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 13);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '© OpenStreetMap © CARTO',
    }).addTo(map);

    L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (isWithinPuneCity(pos.coords.latitude, pos.coords.longitude)) {
            setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          } else {
            setUserPos(DEFAULT_CENTER);
          }
          setLocating(false);
        },
        () => { setUserPos(DEFAULT_CENTER); setLocating(false); },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    } else {
      setUserPos(DEFAULT_CENTER);
      setLocating(false);
    }

    return () => {
      map.off(); map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      userMarkerRef.current = null;
      if (containerRef.current) {
        delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
      }
    };
  }, []);

  // ── User location dot ─────────────────────────────────────────────────────

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !userPos) return;
    const ll: L.LatLngExpression = [userPos.lat, userPos.lng];

    if (!userMarkerRef.current) {
      const icon = L.divIcon({
        className: '',
        html: `<div style="position:relative;width:20px;height:20px">
          <div style="position:absolute;inset:0;background:rgba(16,185,129,.25);border-radius:50%;animation:pulse-ring 1.8s ease-out infinite"></div>
          <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:12px;height:12px;background:#10b981;border:2.5px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>
        </div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarkerRef.current = L.marker(ll, { icon, zIndexOffset: 2000 })
        .bindPopup('<b style="font-size:13px">You are here</b>')
        .addTo(map);
    } else {
      userMarkerRef.current.setLatLng(ll);
    }
    map.setView(ll, 14, { animate: false });
  }, [userPos]);

  // ── Service markers ───────────────────────────────────────────────────────

  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    // Map approved civic services
    const filteredServices = (services ?? [])
      .filter(s => activeFilters.includes(s.category as any))
      .map(s => ({
        id: s.id,
        category: s.category as CivicServiceCategory | 'garbage_problem',
        name: s.name,
        location: s.location,
        latitude: s.latitude,
        longitude: s.longitude,
        imageUrl: s.imageUrl,
      }));

    // Map active citizen garbage reports
    const filteredReports = activeFilters.includes('garbage_problem')
      ? activeReports.map((r: Report) => ({
          id: r.id,
          category: 'garbage_problem' as const,
          name: `Problem: ${r.description.slice(0, 40)}${r.description.length > 40 ? '...' : ''}`,
          location: r.location,
          latitude: r.latitude!,
          longitude: r.longitude!,
          imageUrl: r.imageUrl,
        }))
      : [];

    const combined = [...filteredServices, ...filteredReports];

    const c: Partial<Record<CivicServiceCategory | 'garbage_problem', number>> = {};
    // Calculate counts for approved services
    (services ?? []).forEach(s => {
      c[s.category] = (c[s.category] ?? 0) + 1;
    });
    // Add count for active garbage reports
    c['garbage_problem'] = activeReports.length;

    setCounts(c);

    combined.forEach(item => {
      L.marker([item.latitude, item.longitude], { icon: makeMarkerIcon(item.category) })
        .bindPopup(
          buildPopupHtml(item, userPos?.lat ?? null, userPos?.lng ?? null),
          { className: 'nearby-popup', maxWidth: 240 }
        )
        .addTo(group);
    });
  }, [services, activeReports, activeFilters, userPos]);

  // ── Filters ───────────────────────────────────────────────────────────────

  const toggleFilter = (cat: CivicServiceCategory | 'garbage_problem') =>
    setActiveFilters(prev =>
      prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]
    );

  const allActive = activeFilters.length === ALL_CATS.length;
  const totalVisible = Object.values(counts).reduce((a, b) => a + (b ?? 0), 0);

  // Lazy-load modal
  const RegisterModal = showRegister
    ? require('./register-service-modal').default
    : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm dark:border-slate-800">

        {/* Header */}
        <div className="flex items-center justify-between bg-white px-4 py-3 dark:bg-slate-950">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Nearby Services</p>
            <p className="text-[11px] text-slate-400 truncate">
              {locating
                ? 'Getting your location…'
                : totalVisible > 0
                  ? `${totalVisible} service${totalVisible !== 1 ? 's' : ''} near you`
                  : 'No services registered yet — be the first!'}
            </p>
          </div>
          <button
            onClick={() => setShowRegister(true)}
            className="flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-semibold px-3 py-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            Register
          </button>
        </div>

        {/* Filter chips */}
        <div className="flex gap-1.5 overflow-x-auto bg-slate-50 px-3 py-2 dark:bg-slate-900 scrollbar-hide border-b border-slate-100 dark:border-slate-800">
          <button
            onClick={() => setActiveFilters(allActive ? [] : [...ALL_CATS])}
            className={`flex shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-semibold transition-all ${
              allActive
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
            }`}
          >
            All
          </button>

          {ALL_CATS.map(cat => {
            const cfg = CATEGORIES[cat];
            const isActive = activeFilters.includes(cat);
            return (
              <button
                key={cat}
                onClick={() => toggleFilter(cat)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all ${
                  isActive
                    ? cfg.chipActive
                    : `${cfg.chipInactive} dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700`
                }`}
              >
                <cfg.Icon className="h-3 w-3" strokeWidth={2.2} />
                {cfg.label}
                {isActive && counts[cat] !== undefined && (
                  <span className="rounded-full bg-black/15 px-1.5 text-[10px] font-bold">
                    {counts[cat]}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Map */}
        <div className="relative">
          <div ref={containerRef} className="h-80 w-full" />
          {locating && (
            <div className="absolute inset-0 z-[400] flex flex-col items-center justify-center bg-white/70 backdrop-blur-sm">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent mb-2" />
              <p className="text-xs font-medium text-slate-500">Getting your location…</p>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 bg-white px-4 py-2 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-1.5">
            <div className="h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-emerald-200" />
            <span className="text-[10px] text-slate-500">You</span>
          </div>
          {ALL_CATS.filter(c => activeFilters.includes(c)).map(cat => {
            const cfg = CATEGORIES[cat];
            return (
              <div key={cat} className="flex items-center gap-1">
                <cfg.Icon className="h-3 w-3" style={{ color: cfg.pinBg }} strokeWidth={2.2} />
                <span className="text-[10px] text-slate-500">{cfg.label}</span>
              </div>
            );
          })}
        </div>

        {/* Styles */}
        <style>{`
          @keyframes pulse-ring {
            0%   { transform: scale(0.6); opacity: 0.8; }
            100% { transform: scale(2.2); opacity: 0; }
          }
          .nearby-popup .leaflet-popup-content-wrapper {
            border-radius: 14px;
            padding: 0;
            box-shadow: 0 8px 32px rgba(0,0,0,0.18);
            border: 1px solid #e5e7eb;
            overflow: hidden;
          }
          .nearby-popup .leaflet-popup-content { margin: 12px; }
          .nearby-popup .leaflet-popup-tip { box-shadow: none; }
          .leaflet-control-attribution a { font-size: 9px; color: #9ca3af; }
        `}</style>
      </div>

      {showRegister && RegisterModal && (
        <RegisterModal
          onClose={() => setShowRegister(false)}
          onSubmitted={() => setShowRegister(false)}
        />
      )}
    </>
  );
}
