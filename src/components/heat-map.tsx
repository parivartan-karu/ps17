'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Category colours — each problem type gets a distinct dot colour
const CATEGORY_COLORS: Record<string, string> = {
  'Garbage':          '#f59e0b',
  'Road Damage':      '#ef4444',
  'Water Supply':     '#3b82f6',
  'Electrical':       '#8b5cf6',
  'Sewage':           '#10b981',
  'Tree / Garden':    '#22c55e',
  'Encroachment':     '#f97316',
  'Noise':            '#ec4899',
  'Other':            '#6b7280',
};

function getCategoryColor(category?: string): string {
  if (!category) return '#6366f1';
  return CATEGORY_COLORS[category] ?? '#6366f1';
}

// Create custom marker icon coloured by category
const createReportIcon = (category?: string) => {
  const color = getCategoryColor(category);
  return L.divIcon({
    className: 'custom-report-marker',
    html: `<div style="
      width: 30px;
      height: 30px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 3px 10px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    ">
      <div style="
        width: 9px;
        height: 9px;
        background: rgba(255,255,255,0.85);
        border-radius: 50%;
      "></div>
      <div style="
        position: absolute;
        bottom: -7px;
        left: 50%;
        transform: translateX(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 7px solid ${color};
      "></div>
    </div>`,
    iconSize: [30, 37],
    iconAnchor: [15, 37],
    popupAnchor: [0, -37],
  });
};

// Cluster marker for multiple reports
const createClusterIcon = (count: number) => L.divIcon({
  className: 'custom-cluster-marker',
  html: `<div style="
    width: ${count > 50 ? 56 : count > 20 ? 48 : count > 10 ? 42 : 36}px;
    height: ${count > 50 ? 56 : count > 20 ? 48 : count > 10 ? 42 : 36}px;
    background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
    border: 4px solid white;
    border-radius: 50%;
    box-shadow: 0 4px 15px rgba(139, 92, 246, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    color: white;
    font-size: ${count > 50 ? 16 : count > 10 ? 14 : 12}px;
    text-shadow: 0 1px 2px rgba(0,0,0,0.3);
  ">${count > 99 ? '99+' : count}</div>`,
  iconSize: [count > 50 ? 56 : count > 20 ? 48 : count > 10 ? 42 : 36, count > 50 ? 56 : count > 20 ? 48 : count > 10 ? 42 : 36],
  iconAnchor: [(count > 50 ? 56 : count > 20 ? 48 : count > 10 ? 42 : 36) / 2, (count > 50 ? 56 : count > 20 ? 48 : count > 10 ? 42 : 36) / 2],
});

interface ReportLocation {
  lat: number;
  lng: number;
  location?: string;
  count?: number;
  status?: string;
  type?: string;
  date?: string;
  category?: string; // Report category for filtering
  department?: string;
  reportId?: string; // Add report ID for linking
  imageUrl?: string; // Add image URL for preview
  description?: string; // Add description
  priority?: string; // Add priority
}

import { PUNE_ADMIN_WARDS, type PuneWard } from '@/lib/pune-wards';

// Outer Pune Municipal Corporation & PMRDA administrative border including Alandi
const PMC_OUTER_BOUNDARY: [number, number][] = [
  [18.578, 73.765],
  [18.630, 73.790],
  [18.705, 73.865], // Alandi North-West / Dighi Road
  [18.720, 73.910], // Alandi Devachi & Indrayani Ghat
  [18.685, 73.945], // Charholi / Markal
  [18.580, 73.975],
  [18.535, 73.995],
  [18.470, 73.990],
  [18.420, 73.945],
  [18.415, 73.875],
  [18.430, 73.795],
  [18.465, 73.770],
  [18.535, 73.760],
  [18.578, 73.765],
];

interface MaharashtraMapProps {
  data: ReportLocation[];
  className?: string;
  selectedCategories?: string[]; // Categories to display
  selectedStatuses?: string[]; // Statuses to display
  focusLocation?: { lat: number; lng: number; reportId?: string } | null;
  onSelectReport?: (reportId: string) => void;
  selectedWard?: string | null;
  onSelectWard?: (wardName: string | null) => void;
}

// Pune & PMRDA bounds (Strict Pune City & Alandi area boundary)
const PUNE_BOUNDS: L.LatLngBoundsExpression = [
  [18.38, 73.70], // Southwest
  [18.73, 74.05]  // Northeast (Extends to Alandi / Indrayani river)
];

// Pune center (PMC Headquarters / Shivajinagar)
const PUNE_CENTER: L.LatLngExpression = [18.5204, 73.8567];

function isWithinPuneCity(lat: number, lng: number): boolean {
  return lat >= 18.35 && lat <= 18.75 && lng >= 73.65 && lng <= 74.08;
}

// Tile layer options for different map styles
const tileLayers = {
  satellite: {
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  },
  terrain: {
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap'
  },
  streets: {
    url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  },
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }
};

export default function HeatMap({ 
  data, 
  className = '',
  selectedCategories = [],
  selectedStatuses = [],
  focusLocation,
  onSelectReport,
  selectedWard,
  onSelectWard,
}: MaharashtraMapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const wardsLayerRef = useRef<L.LayerGroup | null>(null);
  const markerMapRef = useRef<Map<string, L.Marker>>(new Map());
  const [activeLayer, setActiveLayer] = useState<'satellite' | 'terrain' | 'streets' | 'dark'>('streets');
  const [showWards, setShowWards] = useState(true);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [mapReady, setMapReady] = useState(false);

  // Filter data strictly within Pune City area and by selected categories/statuses
  const filteredData = data.filter(point => {
    if (!point.lat || !point.lng) return false;
    if (!isWithinPuneCity(point.lat, point.lng)) return false;
    const categoryMatch = selectedCategories.length === 0 || !point.category || selectedCategories.includes(point.category);
    const statusMatch = selectedStatuses.length === 0 || !point.status || selectedStatuses.includes(point.status);
    return categoryMatch && statusMatch;
  });

  // Initialize map only once
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Initialize map locked strictly to Pune City
    mapInstanceRef.current = L.map(mapRef.current, {
      center: PUNE_CENTER,
      zoom: 12,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: PUNE_BOUNDS,
      maxBoundsViscosity: 1.0,
      zoomControl: false,
      scrollWheelZoom: true,
    });

    // Add zoom control to top-right
    L.control.zoom({ position: 'topright' }).addTo(mapInstanceRef.current);

    // Use CartoDB Voyager for clean, modern look
    tileLayerRef.current = L.tileLayer(tileLayers.streets.url, {
      attribution: tileLayers.streets.attribution,
      maxZoom: 19,
    }).addTo(mapInstanceRef.current);

    // Initialize ward boundaries layer & markers layer
    wardsLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);
    markersLayerRef.current = L.layerGroup().addTo(mapInstanceRef.current);

    // Legend: coloured by category
    const LEGEND_ITEMS = [
      { label: 'Garbage',       color: '#f59e0b' },
      { label: 'Road Damage',   color: '#ef4444' },
      { label: 'Water Supply',  color: '#3b82f6' },
      { label: 'Electrical',    color: '#8b5cf6' },
      { label: 'Sewage',        color: '#10b981' },
      { label: 'Tree / Garden', color: '#22c55e' },
      { label: 'Encroachment',  color: '#f97316' },
      { label: 'Noise',         color: '#ec4899' },
      { label: 'Other',         color: '#6b7280' },
    ];

    const LegendControl = L.Control.extend({
      options: { position: 'bottomright' as L.ControlPosition },
      onAdd: function() {
        const div = L.DomUtil.create('div', 'map-legend');
        div.innerHTML = `
          <div style="
            background: rgba(255,255,255,0.96);
            backdrop-filter: blur(10px);
            padding: 8px 10px;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            font-size: 10px;
            min-width: 120px;
            border: 1px solid rgba(226, 232, 240, 0.8);
          ">
            <div style="font-weight: 700; margin-bottom: 4px; color: #0f172a; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em;">Incident Legend</div>
            <div style="display: grid; grid-template-columns: 1fr; gap: 3px;">
              ${LEGEND_ITEMS.slice(0, 6).map(item => `
                <div style="display: flex; align-items: center; gap: 5px;">
                  <div style="width: 8px; height: 8px; background: ${item.color}; border-radius: 50%; border: 1.5px solid white; box-shadow: 0 1px 2px rgba(0,0,0,0.2); flex-shrink: 0;"></div>
                  <span style="color: #475569; font-size: 10px; font-weight: 500;">${item.label}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
        return div;
      }
    });
    new LegendControl().addTo(mapInstanceRef.current);

    // Add layer switcher control
    const LayerControl = L.Control.extend({
      options: { position: 'topleft' as L.ControlPosition },
      onAdd: function() {
        const div = L.DomUtil.create('div', 'layer-switcher');
        div.innerHTML = `
          <div style="
            background: rgba(255,255,255,0.95);
            backdrop-filter: blur(8px);
            padding: 4px;
            border-radius: 10px;
            box-shadow: 0 4px 16px rgba(0,0,0,0.12);
            display: flex;
            gap: 3px;
            border: 1px solid rgba(226, 232, 240, 0.8);
          ">
            <button id="btn-streets" style="
              padding: 4px 8px;
              border-radius: 6px;
              border: none;
              background: #2563eb;
              color: white;
              font-size: 10px;
              cursor: pointer;
              font-weight: 600;
            ">Streets</button>
            <button id="btn-satellite" style="
              padding: 4px 8px;
              border-radius: 6px;
              border: none;
              background: transparent;
              color: #475569;
              font-size: 10px;
              cursor: pointer;
              font-weight: 500;
            ">Satellite</button>
            <button id="btn-terrain" style="
              padding: 4px 8px;
              border-radius: 6px;
              border: none;
              background: transparent;
              color: #475569;
              font-size: 10px;
              cursor: pointer;
              font-weight: 500;
            ">Terrain</button>
          </div>
        `;
        
        // Add event listeners
        setTimeout(() => {
          const map = mapInstanceRef.current;
          if (!map) return;
          
          div.querySelectorAll('button').forEach(btn => {
            btn.addEventListener('click', (e) => {
              const target = e.target as HTMLButtonElement;
              const layerType = target.id.replace('btn-', '') as 'streets' | 'satellite' | 'terrain';
              
              div.querySelectorAll('button').forEach(b => {
                (b as HTMLButtonElement).style.background = 'transparent';
                (b as HTMLButtonElement).style.color = '#475569';
                (b as HTMLButtonElement).style.fontWeight = '500';
              });
              target.style.background = '#2563eb';
              target.style.color = 'white';
              target.style.fontWeight = '600';
              
              if (tileLayerRef.current) {
                map.removeLayer(tileLayerRef.current);
              }
              tileLayerRef.current = L.tileLayer(tileLayers[layerType].url, {
                attribution: tileLayers[layerType].attribution,
                maxZoom: 19,
              }).addTo(map);
            });
          });
        }, 100);
        
        return div;
      }
    });
    new LayerControl().addTo(mapInstanceRef.current);

    // Add scale control
    L.control.scale({ position: 'bottomleft', imperial: false }).addTo(mapInstanceRef.current);

    // Fit bounds to Pune
    mapInstanceRef.current.fitBounds(PUNE_BOUNDS, { padding: [15, 15] });
    
    // Invalidate size to ensure perfect fit without gray edges
    setTimeout(() => {
      mapInstanceRef.current?.invalidateSize();
    }, 150);

    const handleResize = () => {
      mapInstanceRef.current?.invalidateSize();
    };
    window.addEventListener('resize', handleResize);
    
    setMapReady(true);

    // Cleanup only on unmount
    return () => {
      window.removeEventListener('resize', handleResize);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        wardsLayerRef.current = null;
        markersLayerRef.current = null;
        markerMapRef.current.clear();
        tileLayerRef.current = null;
        setMapReady(false);
      }
    };
  }, []);

  // Draw PMC Ward Polygons & Boundaries
  useEffect(() => {
    if (!mapReady || !wardsLayerRef.current || !mapInstanceRef.current) return;
    const layer = wardsLayerRef.current;
    layer.clearLayers();

    // 1. Draw outer PMC City boundary outline (Thick Blue Border)
    const outerPolygon = L.polygon(PMC_OUTER_BOUNDARY, {
      color: '#1e3a8a',
      weight: 3.5,
      opacity: 0.95,
      fillColor: '#3b82f6',
      fillOpacity: 0.03,
      dashArray: undefined,
    });
    layer.addLayer(outerPolygon);

    // 2. Draw 15 PMC Ward Boundary Polygons with Labels
    PUNE_ADMIN_WARDS.forEach((ward: PuneWard) => {
      const isSelected = selectedWard === ward.name || selectedWard === ward.code;

      const polygon = L.polygon(ward.coordinates, {
        color: isSelected ? '#1d4ed8' : '#2563eb',
        weight: isSelected ? 3.5 : 2.2,
        opacity: 0.9,
        fillColor: isSelected ? '#3b82f6' : '#60a5fa',
        fillOpacity: isSelected ? 0.32 : 0.12,
        className: 'pune-ward-polygon',
      });

      polygon.bindTooltip(`
        <div style="font-family: system-ui; padding: 2px;">
          <strong style="color: #1e3a8a; font-size: 12px;">${ward.code} - ${ward.name}</strong><br/>
          <span style="font-size: 10px; color: #64748b;">${ward.nameMr}</span><br/>
          <span style="font-size: 9px; color: #2563eb; font-weight: 600;">Key areas: ${ward.keyAreas.slice(0, 3).join(', ')}</span>
        </div>
      `, {
        sticky: true,
        direction: 'top',
        className: 'pune-ward-tooltip',
      });

      polygon.on('mouseover', () => {
        polygon.setStyle({
          fillOpacity: 0.28,
          weight: 3,
          color: '#1d4ed8',
        });
      });

      polygon.on('mouseout', () => {
        if (!isSelected) {
          polygon.setStyle({
            fillOpacity: 0.12,
            weight: 2.2,
            color: '#2563eb',
          });
        }
      });

      polygon.on('click', () => {
        if (onSelectWard) {
          onSelectWard(selectedWard === ward.name ? null : ward.name);
        }
      });

      layer.addLayer(polygon);

      // Add Centered Ward Code Badge (e.g. AB, KB, SG, KV, HM)
      const labelIcon = L.divIcon({
        className: 'pune-ward-label-icon',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: system-ui, -apple-system, sans-serif;
            font-weight: 800;
            font-size: 11px;
            color: #1e40af;
            background: rgba(255, 255, 255, 0.92);
            border: 1.5px solid #2563eb;
            border-radius: 6px;
            padding: 1px 4px;
            box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
            pointer-events: none;
            letter-spacing: 0.05em;
          ">
            ${ward.code}
          </div>
        `,
        iconSize: [28, 18],
        iconAnchor: [14, 9],
      });

      const labelMarker = L.marker(ward.center, {
        icon: labelIcon,
        interactive: false,
      });

      layer.addLayer(labelMarker);
    });
  }, [mapReady, selectedWard, onSelectWard]);

  // Update markers when data changes
  useEffect(() => {
    if (!mapReady || !markersLayerRef.current || !mapInstanceRef.current) return;
    
    markersLayerRef.current.clearLayers();
    markerMapRef.current.clear();

    filteredData.forEach(point => {
      if (point.lat && point.lng) {
        let marker: L.Marker;
        
        if (point.count && point.count > 1) {
          marker = L.marker([point.lat, point.lng], {
            icon: createClusterIcon(point.count)
          });
        } else {
          marker = L.marker([point.lat, point.lng], {
            icon: createReportIcon(point.category)
          });
        }

        const reportUrl = point.reportId ? `/smc/complaint/${encodeURIComponent(point.reportId)}` : '#';
        const priorityColor = point.priority === 'Critical' || point.priority === 'High' 
          ? 'background: #fee2e2; color: #b91c1c;'
          : point.priority === 'Medium'
          ? 'background: #fef3c7; color: #b45309;'
          : 'background: #e0e7ff; color: #4338ca;';

        const popupContent = `
          <div style="min-width: 230px; max-width: 250px; padding: 0; border-radius: 12px; overflow: hidden; font-family: system-ui, -apple-system, sans-serif;">
            ${point.imageUrl ? `
              <div style="width: 100%; height: 130px; overflow: hidden; background: #0f172a; position: relative;">
                <img 
                  src="${point.imageUrl}" 
                  alt="Incident evidence" 
                  style="width: 100%; height: 100%; object-fit: cover;" 
                />
                ${point.priority ? `
                  <span style="position: absolute; top: 8px; right: 8px; font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 9999px; ${priorityColor} box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                    ${point.priority}
                  </span>
                ` : ''}
              </div>
            ` : ''}
            <div style="padding: 12px; background: white;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 6px;">
                <span style="font-size: 11px; font-weight: 700; color: #4f46e5; text-transform: uppercase; letter-spacing: 0.04em;">
                  ${point.category || point.type || 'Civic Issue'}
                </span>
                ${point.status ? `
                  <span style="font-size: 10px; font-weight: 600; color: #64748b; background: #f1f5f9; padding: 2px 6px; border-radius: 6px;">
                    ${point.status}
                  </span>
                ` : ''}
              </div>
              
              <p style="margin: 0 0 6px; font-size: 12px; font-weight: 600; color: #0f172a; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                ${point.description || point.location || 'Pune civic issue'}
              </p>

              <div style="display: flex; flex-direction: column; gap: 3px; font-size: 11px; color: #64748b; margin-bottom: 10px;">
                ${point.location ? `<div>📍 ${point.location.split(',')[0]}</div>` : ''}
                ${point.date ? `<div>🕒 ${point.date}</div>` : ''}
              </div>

              ${point.reportId ? `
                <a href="${reportUrl}" style="
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  gap: 4px;
                  background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%);
                  color: white;
                  font-size: 11px;
                  font-weight: 600;
                  padding: 7px 12px;
                  border-radius: 8px;
                  text-decoration: none;
                  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.3);
                ">
                  Inspect Report Details →
                </a>
              ` : ''}
            </div>
          </div>
        `;
        
        marker.bindPopup(popupContent, {
          className: 'custom-popup',
          closeButton: true,
          autoPan: true,
          autoPanPaddingTopLeft: [16, 16],
          autoPanPaddingBottomRight: [16, 16],
          maxWidth: 260,
          minWidth: 230,
        });

        if (point.reportId) {
          markerMapRef.current.set(point.reportId, marker);
        }

        markersLayerRef.current?.addLayer(marker);
      }
    });
  }, [filteredData, mapReady]);

  // Handle focus on specific report from dashboard list
  useEffect(() => {
    if (!mapReady || !mapInstanceRef.current || !focusLocation) return;
    const map = mapInstanceRef.current;
    
    map.flyTo([focusLocation.lat, focusLocation.lng], 15, {
      duration: 0.8,
    });

    if (focusLocation.reportId && markerMapRef.current.has(focusLocation.reportId)) {
      const marker = markerMapRef.current.get(focusLocation.reportId);
      setTimeout(() => {
        marker?.openPopup();
      }, 400);
    }
  }, [focusLocation, mapReady]);

  return (
    <div className="relative w-full h-full">
      <style jsx global>{`
        .custom-popup .leaflet-popup-content-wrapper {
          border-radius: 12px;
          box-shadow: 0 12px 48px rgba(0,0,0,0.25);
          padding: 0;
          border: 1px solid #e5e7eb;
          background: white;
        }
        .custom-popup .leaflet-popup-tip {
          box-shadow: 0 3px 14px rgba(0,0,0,0.15);
          border: 1px solid #e5e7eb;
        }
        .custom-popup .leaflet-popup-content {
          margin: 0;
          max-height: 280px;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .custom-popup .leaflet-popup-content::-webkit-scrollbar {
          width: 6px;
        }
        .custom-popup .leaflet-popup-content::-webkit-scrollbar-track {
          background: #f1f5f9;
        }
        .custom-popup .leaflet-popup-content::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        .map-popup-image {
          display: block;
          width: 100%;
          height: 100%;
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
      <div 
        ref={mapRef} 
        className={`w-full h-full rounded-xl overflow-hidden ${className}`}
        style={{ zIndex: 1, background: 'linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%)' }}
      />
    </div>
  );
}
