'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

type Coordinates = {
  lat: number;
  lng: number;
};

type AdminLocationPickerProps = {
  selectedPosition: Coordinates | null;
  defaultCenter?: Coordinates;
  onSelect: (coords: Coordinates) => void;
};

const markerIcon = L.icon({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Pune & Alandi area boundary bounds
const PUNE_BOUNDS: L.LatLngBoundsExpression = [
  [18.38, 73.70],
  [18.73, 74.05],
];

export default function AdminLocationPicker({
  selectedPosition,
  defaultCenter = { lat: 18.5204, lng: 73.8567 },
  onSelect,
}: AdminLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomAnimation: false,
      fadeAnimation: false,
      markerZoomAnimation: false,
      inertia: false,
      minZoom: 11,
      maxZoom: 18,
      maxBounds: PUNE_BOUNDS,
      maxBoundsViscosity: 1.0,
    }).setView([defaultCenter.lat, defaultCenter.lng], 13, { animate: false });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    map.on('click', (event: L.LeafletMouseEvent) => {
      onSelect({ lat: event.latlng.lat, lng: event.latlng.lng });
    });

    mapRef.current = map;

    return () => {
      map.off();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;

      // Defensive cleanup for React StrictMode re-mount in development.
      if (containerRef.current) {
        delete (containerRef.current as HTMLDivElement & { _leaflet_id?: number })._leaflet_id;
      }
    };
  }, [defaultCenter.lat, defaultCenter.lng, onSelect]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!selectedPosition) {
      if (markerRef.current) {
        markerRef.current.removeFrom(map);
        markerRef.current = null;
      }
      return;
    }

    const target: L.LatLngExpression = [selectedPosition.lat, selectedPosition.lng];

    if (!markerRef.current) {
      markerRef.current = L.marker(target, { icon: markerIcon }).addTo(map);
    } else {
      markerRef.current.setLatLng(target);
    }

    if (!map.getContainer().isConnected) return;

    const nextZoom = Math.max(map.getZoom(), 14);
    if (map.getZoom() !== nextZoom) {
      map.setZoom(nextZoom, { animate: false });
    }
    map.panTo(target, { animate: false });
  }, [selectedPosition]);

  return <div ref={containerRef} className="h-64 w-full" />;
}
