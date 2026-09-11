'use client';

import { useMemo } from 'react';
import { Lightbulb, Wrench, Trash2, AlertCircle, TrendingUp, CheckCircle2 } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeDepartmentId } from '@/lib/departments';

interface DepartmentInsightsCardProps {
  reports: Report[];
  departmentId: string;
}

export function DepartmentInsightsCard({ reports, departmentId }: DepartmentInsightsCardProps) {
  const deptId = normalizeDepartmentId(departmentId);
  const isRoads = deptId === 'dept_engineering';

  const insights = useMemo(() => {
    const active = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status));

    // Grouping by location/ward
    const locMap: Record<string, Report[]> = {};
    active.forEach(r => {
      const key = (r.location || 'Unknown').split(',')[0].trim();
      if (!locMap[key]) locMap[key] = [];
      locMap[key].push(r);
    });

    const hotspots = Object.entries(locMap)
      .map(([loc, list]) => ({ loc, count: list.length, items: list }))
      .sort((a, b) => b.count - a.count);

    if (isRoads) {
      const potholeCount = active.filter(r => (r.category || '').toLowerCase().includes('pothole')).length;
      const roadDamageCount = active.filter(r => (r.category || '').toLowerCase().includes('road') || (r.category || '').toLowerCase().includes('crack')).length;
      const topHotspot = hotspots[0];

      return {
        title: 'Roads Operational Insights & Maintenance Actions',
        accentColor: 'from-amber-600 to-orange-700',
        badgeText: 'ROADS INTELLIGENCE',
        points: [
          {
            label: 'Repeated Potholes & Road Damage',
            text: `${potholeCount} active pothole report${potholeCount !== 1 ? 's' : ''} and ${roadDamageCount} surface damage report${roadDamageCount !== 1 ? 's' : ''} currently logged.`,
            icon: Wrench,
          },
          {
            label: 'Complaint Concentration',
            text: topHotspot && topHotspot.count >= 2
              ? `High complaint density detected in "${topHotspot.loc}" with ${topHotspot.count} active road issues.`
              : 'Road issues are evenly distributed across wards without major localized spikes.',
            icon: TrendingUp,
          },
          {
            label: 'Suggested Combined Action',
            text: topHotspot && topHotspot.count >= 2
              ? `Batch asphalt repair deployment recommended for "${topHotspot.loc}" to resolve ${topHotspot.count} clustered reports simultaneously.`
              : 'Proceed with routine worker dispatch based on individual SLA priority.',
            icon: CheckCircle2,
          },
        ],
      };
    } else {
      const overflowCount = active.filter(r => (r.category || '').toLowerCase().includes('overflow') || (r.category || '').toLowerCase().includes('bin')).length;
      const dumpingCount = active.filter(r => (r.category || '').toLowerCase().includes('dumping') || (r.category || '').toLowerCase().includes('illegal')).length;
      const backlogCount = active.filter(r => {
        const hours = (Date.now() - new Date(r.timestamp).getTime()) / (1000 * 60 * 60);
        return hours > 24;
      }).length;
      const topHotspot = hotspots[0];

      return {
        title: 'Garbage & Waste Operational Insights',
        accentColor: 'from-emerald-600 to-teal-700',
        badgeText: 'SANITATION INTELLIGENCE',
        points: [
          {
            label: 'Recurring Waste Hotspots',
            text: `${overflowCount} overflowing bin report${overflowCount !== 1 ? 's' : ''} and ${dumpingCount} illegal dumping report${dumpingCount !== 1 ? 's' : ''} logged.`,
            icon: Trash2,
          },
          {
            label: 'Collection Backlog Patterns',
            text: backlogCount > 0
              ? `${backlogCount} uncollected waste complaint${backlogCount !== 1 ? 's' : ''} pending > 24 hours requiring clearance.`
              : 'Collection backlog is within acceptable SLA response windows.',
            icon: AlertCircle,
          },
          {
            label: 'Suggested Operational Focus',
            text: topHotspot && topHotspot.count >= 2
              ? `Deploy additional sanitation truck & crew to "${topHotspot.loc}" area (${topHotspot.count} active waste complaints).`
              : 'Maintain standard sanitation collection routes and bin emptying schedules.',
            icon: Lightbulb,
          },
        ],
      };
    }
  }, [reports, isRoads]);

  return (
    <Card className="border-0 shadow-md overflow-hidden bg-white">
      <CardHeader className={`p-4 bg-gradient-to-r ${insights.accentColor} text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Lightbulb className="h-5 w-5 text-amber-200" />
            <div>
              <CardTitle className="text-base font-bold text-white">{insights.title}</CardTitle>
              <CardDescription className="text-xs text-white/80">
                Data-driven operational recommendations based on active department workload
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-white/30 text-[10px] font-extrabold">
            {insights.badgeText}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {insights.points.map((p, idx) => {
          const Icon = p.icon;
          return (
            <div key={idx} className="flex gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white shadow-2xs border border-slate-200">
                <Icon className="h-4 w-4 text-slate-700" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-900">{p.label}</h5>
                <p className="text-xs text-slate-600 font-medium mt-0.5">{p.text}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
