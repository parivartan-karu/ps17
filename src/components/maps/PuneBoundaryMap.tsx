'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import 'leaflet/dist/leaflet.css';
import { PUNE_ADMIN_WARDS } from '@/lib/pune-wards';
import { MapPin, Navigation, Shield } from 'lucide-react';

// Outer convex/perimeter coordinates outlining Pune Municipal Corporation border
const PUNE_OUTER_BOUNDARY: [number, number][] = [
  [18.585, 73.775], // Baner / Mahalunge North-West
  [18.602, 73.858], // Dhanori / Airport North
  [18.580, 73.908], // Vishrantwadi / Vadgaon Sheri North
  [18.575, 73.970], // Kharadi / Wagholi East
  [18.545, 73.990], // Hadapsar / Manjri East
  [18.475, 73.990], // Fursungi / Sadesataranali South-East
  [18.425, 73.945], // Undri / Pisoli South-East
  [18.420, 73.875], // Kondhwa / Yewalewadi South
  [18.435, 73.800], // Dhayari / Vadgaon Khurd South-West
  [18.465, 73.775], // Warje South-West
  [18.490, 73.770], // Bavdhan / Chandani Chowk West
  [18.545, 73.765], // Balewadi / Pashan West
  [18.585, 73.775], // Close loop
];

function PuneMapInner() {
  const [LState, setLState] = useState<any>(null);
  const [mapInstance, setMapInstance] = useState<any>(null);

  useEffect(() => {
    import('leaflet').then((L) => {
      setLState(L);
    });
  }, []);

  useEffect(() => {
    if (!LState) return;

    // Check if map container already initialized
    const container = document.getElementById('pune-leaflet-container');
    if (!container) return;

    // Fix leaflet default icons
    delete (LState.Icon.Default.prototype as any)._getIconUrl;
    LState.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });

    const map = LState.map('pune-leaflet-container', {
      center: [18.5204, 73.8567],
      zoom: 11.5,
      minZoom: 9,
      maxZoom: 17,
      zoomControl: false, // Only floating buttons can zoom in/out
      scrollWheelZoom: false, // Disables scroll wheel zoom
      doubleClickZoom: false, // Disables double-click zoom
      touchZoom: false, // Disables touch gesture zoom
      boxZoom: false, // Disables shift-drag box zoom
      keyboard: false,
      dragging: true,
    });

    setMapInstance(map);

    // Clean OpenStreetMap Tile Layer
    LState.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    // 1. Draw Dotted Line on Pune Municipal Corporation Outer Border
    const outerBorder = LState.polygon(PUNE_OUTER_BOUNDARY, {
      color: '#e11d48', // Rose / Red accent
      weight: 3.5,
      opacity: 0.95,
      dashArray: '8, 8', // DOTTED BORDER
      fillColor: '#f43f5e',
      fillOpacity: 0.06,
    }).addTo(map);

    outerBorder.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="color: #be123c; font-size: 13px;">Pune Municipal Corporation</strong>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #475569;">Official Civic Jurisdiction Boundary</p>
      </div>
    `);

    // 2. Draw Individual Ward Boundaries with fine dotted lines
    PUNE_ADMIN_WARDS.forEach((ward) => {
      const polygon = LState.polygon(ward.coordinates, {
        color: '#2563eb',
        weight: 1.5,
        opacity: 0.7,
        dashArray: '4, 6', // Subtle dotted ward dividers
        fillColor: '#3b82f6',
        fillOpacity: 0.05,
      }).addTo(map);

      polygon.bindPopup(`
        <div style="font-family: sans-serif; padding: 4px;">
          <strong style="font-size: 12px; color: #1e293b;">${ward.name}</strong>
          <span style="display: block; font-size: 10px; color: #64748b; margin-top: 1px;">${ward.nameMr}</span>
          <span style="display: block; font-size: 10px; color: #e11d48; margin-top: 2px; font-weight: bold;">Ward Code: ${ward.code}</span>
        </div>
      `);
    });

    // 3. Pinpoint Pune Municipal Corporation HQ at Shivajinagar
    const pmcIcon = LState.divIcon({
      className: 'pmc-hq-marker',
      html: `
        <div style="
          background: #e11d48;
          color: white;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(225,29,72,0.5);
          border: 2px solid white;
          cursor: pointer;
        ">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
            <circle cx="12" cy="10" r="3"/>
          </svg>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    });

    const marker = LState.marker([18.5308, 73.8475], { icon: pmcIcon }).addTo(map);
    marker.bindPopup(`
      <div style="font-family: sans-serif; padding: 4px;">
        <strong style="color: #be123c; font-size: 13px;">PMC Headquarters</strong>
        <p style="margin: 2px 0 0 0; font-size: 11px; color: #334155;">Shivajinagar, Pune 411005</p>
      </div>
    `);

    return () => {
      map.remove();
    };
  }, [LState]);

  const handleZoomIn = () => {
    if (mapInstance) mapInstance.zoomIn();
  };

  const handleZoomOut = () => {
    if (mapInstance) mapInstance.zoomOut();
  };

  const handleResetView = () => {
    if (mapInstance) mapInstance.setView([18.5204, 73.8567], 11.5);
  };

  return (
    <div className="relative w-full h-full min-h-[380px] sm:min-h-[430px] rounded-2xl overflow-hidden bg-slate-100">
      <div id="pune-leaflet-container" className="w-full h-full min-h-[380px] sm:min-h-[430px] z-0" />

      {/* Floating Interactive Zoom & Control Buttons */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5 bg-white/95 backdrop-blur-md p-1 rounded-xl shadow-lg border border-slate-200">
        <button
          onClick={handleZoomIn}
          type="button"
          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-black text-base flex items-center justify-center transition-colors shadow-xs border border-slate-100"
          title="Zoom In (+)"
          aria-label="Zoom In"
        >
          +
        </button>
        <button
          onClick={handleZoomOut}
          type="button"
          className="w-8 h-8 rounded-lg bg-white hover:bg-slate-100 text-slate-800 font-black text-base flex items-center justify-center transition-colors shadow-xs border border-slate-100"
          title="Zoom Out (-)"
          aria-label="Zoom Out"
        >
          &minus;
        </button>
        <button
          onClick={handleResetView}
          type="button"
          className="w-8 h-8 rounded-lg bg-white hover:bg-rose-50 text-rose-600 font-bold text-xs flex items-center justify-center transition-colors shadow-xs border border-slate-100"
          title="Reset Center"
          aria-label="Reset View"
        >
          <Navigation className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 15 Wards Badge */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 text-white backdrop-blur-md px-3 py-1.5 rounded-lg shadow-md border border-slate-700 text-[11px] font-semibold flex items-center gap-1.5">
        <Shield className="w-3.5 h-3.5 text-amber-400" />
        <span>15 Ward Administrative Divisions</span>
      </div>
    </div>
  );
}

export default function PuneBoundaryMap() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-full h-full min-h-[360px] sm:min-h-[420px] rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-xs font-semibold">
        Loading Pune Municipal Corporation Map...
      </div>
    );
  }

  return <PuneMapInner />;
}
