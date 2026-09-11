'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { Report } from '@/lib/types';
import { normalizeDepartmentId } from '@/lib/departments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Layers, Construction, Trash2, ShieldAlert, CheckCircle2 } from 'lucide-react';

// Dynamic import for Leaflet map component (SSR safe)
const HeatMap = dynamic(() => import('@/components/heat-map'), {
  ssr: false,
  loading: () => (
    <div className="h-[420px] w-full rounded-2xl bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 text-sm font-medium">
      <MapPin className="h-6 w-6 mr-2 animate-bounce text-indigo-500" /> Loading Department Operations Map...
    </div>
  ),
});

interface DeptOperationsMapProps {
  reports: Report[];
  userDeptId: string;
  className?: string;
  onSelectReport?: (reportId: string) => void;
}

// Map Pune Ward Center coordinates fallback
const PUNE_SECTOR_COORDS: Record<string, { lat: number; lng: number }> = {
  kothrud: { lat: 18.5074, lng: 73.8077 },
  aundh: { lat: 18.5580, lng: 73.8070 },
  hadapsar: { lat: 18.5089, lng: 73.9260 },
  viman: { lat: 18.5679, lng: 73.9143 },
  baner: { lat: 18.5590, lng: 73.7868 },
  karve: { lat: 18.4955, lng: 73.8260 },
  swargate: { lat: 18.5018, lng: 73.8636 },
  shivajinagar: { lat: 18.5314, lng: 73.8446 },
  pimpri: { lat: 18.6298, lng: 73.7997 },
  chinchwad: { lat: 18.6278, lng: 73.8131 },
  katraj: { lat: 18.4575, lng: 73.8508 },
  kondhwa: { lat: 18.4682, lng: 73.8890 },
};

function getCoordinatesForLocation(loc?: string, idx: number = 0): { lat: number; lng: number } {
  const text = (loc || '').toLowerCase();
  for (const [key, coords] of Object.entries(PUNE_SECTOR_COORDS)) {
    if (text.includes(key)) {
      // Add slight jitter for multiple markers in same sector
      const latJitter = ((idx % 7) - 3) * 0.0025;
      const lngJitter = (((idx * 3) % 7) - 3) * 0.0025;
      return { lat: coords.lat + latJitter, lng: coords.lng + lngJitter };
    }
  }
  // Default Pune Shivajinagar center with jitter
  const baseLat = 18.5204 + ((idx % 9) - 4) * 0.0035;
  const baseLng = 73.8567 + (((idx * 5) % 9) - 4) * 0.0035;
  return { lat: baseLat, lng: baseLng };
}

export function DeptOperationsMap({
  reports,
  userDeptId,
  className = 'h-[450px]',
  onSelectReport,
}: DeptOperationsMapProps) {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [focusedReport, setFocusedReport] = useState<{ lat: number; lng: number; reportId: string } | null>(null);

  const isRoadsDept = userDeptId.includes('road');
  const isGarbageDept = userDeptId.includes('garbage') || userDeptId.includes('waste') || userDeptId.includes('sanitation');

  // Strictly department-scoped reports
  const deptReports = useMemo(() => {
    return reports.filter(r => normalizeDepartmentId(r.departmentId || r.department) === userDeptId);
  }, [reports, userDeptId]);

  // Convert to Map Location Format
  const mapData = useMemo(() => {
    return deptReports.map((r, idx) => {
      const coords = (r.latitude && r.longitude)
        ? { lat: r.latitude, lng: r.longitude }
        : getCoordinatesForLocation(r.location, idx);

      let mappedCategory = r.category || 'Civic Issue';
      if (isRoadsDept) {
        if (r.description?.toLowerCase().includes('pothole') || r.category?.toLowerCase().includes('pothole')) {
          mappedCategory = 'Road Damage';
        } else if (r.priority === 'Critical' || r.category?.toLowerCase().includes('hazard')) {
          mappedCategory = 'Encroachment';
        } else {
          mappedCategory = 'Road Damage';
        }
      } else if (isGarbageDept) {
        if (r.complaintType === 'Illegal Dumping' || r.description?.toLowerCase().includes('dumping')) {
          mappedCategory = 'Encroachment';
        } else {
          mappedCategory = 'Garbage';
        }
      }

      return {
        lat: coords.lat,
        lng: coords.lng,
        location: r.location,
        status: r.status,
        category: mappedCategory,
        department: r.department,
        reportId: r.id,
        imageUrl: r.imageUrl,
        description: r.description,
        priority: r.priority || 'Medium',
        date: new Date(r.timestamp).toLocaleDateString(),
      };
    });
  }, [deptReports, isRoadsDept, isGarbageDept]);

  // Apply status filter
  const filteredMapData = useMemo(() => {
    return mapData.filter(item => {
      if (selectedStatusFilter !== 'all' && item.status !== selectedStatusFilter) return false;
      return true;
    });
  }, [mapData, selectedStatusFilter]);

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="p-4 border-b bg-slate-50/70">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
              {isRoadsDept ? <Construction className="h-5 w-5 text-indigo-600" /> : <Trash2 className="h-5 w-5 text-emerald-600" />}
              {isRoadsDept ? 'Roads & Infrastructure Operations Map' : 'Garbage & Sanitation Operations Map'}
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Live spatial clusters, ward boundaries, priority indicators, and hotspot tracking
            </CardDescription>
          </div>

          {/* Map Controls & Status Filters */}
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge variant="outline" className="bg-white text-slate-700 text-xs font-semibold px-2 py-1 border-slate-300">
              {filteredMapData.length} Incidents Mapped
            </Badge>

            {/* Status Filter Buttons */}
            {['all', 'Submitted', 'In Progress', 'Resolved'].map(st => (
              <Button
                key={st}
                size="sm"
                variant={selectedStatusFilter === st ? 'default' : 'ghost'}
                className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${
                  selectedStatusFilter === st
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:bg-slate-200/60'
                }`}
                onClick={() => setSelectedStatusFilter(st)}
              >
                {st === 'all' ? 'All Status' : st}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        <HeatMap
          data={filteredMapData}
          className={className}
          focusLocation={focusedReport}
          onSelectReport={onSelectReport}
          showWardBoundaries={false}
        />
      </CardContent>
    </Card>
  );
}
