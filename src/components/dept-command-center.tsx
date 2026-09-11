'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  AlertTriangle, CheckCircle2, Clock3, ArrowRight, Flame,
  ClipboardList, Users, Zap, ShieldAlert, Trash2,
  Construction, MapPin, AlertCircle, RefreshCw, Layers
} from 'lucide-react';
import type { Report, User as UserType } from '@/lib/types';
import { normalizeDepartment, normalizeDepartmentId } from '@/lib/departments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow, isToday } from 'date-fns';
import { DeptOperationsMap } from '@/components/dept-operations-map';
import { DepartmentInsightsCard } from '@/components/department-insights-card';

const statusColor: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  'Under Verification': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Assigned: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'In Progress': 'bg-amber-100 text-amber-800 border-amber-200',
  Resolved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
};

const priorityDot: Record<string, string> = {
  Critical: 'bg-rose-500 ring-rose-200',
  High: 'bg-amber-500 ring-amber-200',
  Medium: 'bg-yellow-500 ring-yellow-200',
  Low: 'bg-emerald-500 ring-emerald-200',
};

interface DeptCommandCenterProps {
  reports: Report[];
  workers: UserType[];
  profile: UserType | null;
  isLoading: boolean;
}

export function DeptCommandCenter({
  reports,
  workers,
  profile,
  isLoading,
}: DeptCommandCenterProps) {
  const [activeTab, setActiveTab] = useState<'all' | 'immediate' | 'unassigned' | 'in_progress' | 'verification' | 'escalated'>('all');

  const userDeptId = useMemo(() => (
    normalizeDepartmentId(profile?.departmentId || profile?.department) || 'roads-dept'
  ), [profile?.departmentId, profile?.department]);

  const deptDef = useMemo(() => normalizeDepartment(userDeptId), [userDeptId]);
  const deptName = deptDef?.name || profile?.department || 'Department';

  const isRoadsDept = userDeptId.includes('road');
  const isGarbageDept = userDeptId.includes('garbage') || userDeptId.includes('waste') || userDeptId.includes('sanitation');

  // Key operational metrics computation
  const metrics = useMemo(() => {
    if (!reports) return null;

    const now = Date.now();
    const activeReports = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status));

    const open = activeReports.length;
    const highCritical = activeReports.filter(r => r.priority && ['High', 'Critical'].includes(r.priority)).length;
    const unassigned = activeReports.filter(r => !r.assignedWorkerId).length;

    const nearSlaBreach = activeReports.filter(r => {
      if (r.slaBreached) return false;
      if (!r.slaDeadline) return false;
      const deadlineMs = new Date(r.slaDeadline).getTime();
      const diffMs = deadlineMs - now;
      return diffMs > 0 && diffMs <= 4 * 3600 * 1000;
    }).length;

    const slaBreached = activeReports.filter(r => {
      if (r.slaBreached) return true;
      if (!r.slaDeadline) return false;
      return new Date(r.slaDeadline).getTime() < now;
    }).length;

    const resolvedToday = reports.filter(r => {
      if (r.status !== 'Resolved') return false;
      const dateToCheck = r.completedAt ? new Date(r.completedAt) : new Date(r.timestamp);
      return isToday(dateToCheck);
    }).length;

    const totalResolved = reports.filter(r => r.status === 'Resolved').length;
    const resolvedWithinSla = reports.filter(r => r.status === 'Resolved' && !r.slaBreached).length;
    const slaCompliancePct = totalResolved > 0 ? Math.round((resolvedWithinSla / totalResolved) * 100) : 100;

    return {
      open,
      highCritical,
      unassigned,
      nearSlaBreach,
      slaBreached,
      resolvedToday,
      slaCompliancePct,
    };
  }, [reports]);

  // Operational Queues
  const queues = useMemo(() => {
    const active = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status));
    const now = Date.now();

    const immediate = active.filter(r => (
      r.priority === 'Critical' ||
      r.slaBreached ||
      (r.slaDeadline && (new Date(r.slaDeadline).getTime() - now) <= 4 * 3600 * 1000) ||
      (r.escalationLevel ?? 0) > 0 ||
      !!r.escalatedTo
    ));

    const unassignedQueue = active.filter(r => !r.assignedWorkerId);
    const assignedInProgress = active.filter(r => ['Assigned', 'In Progress'].includes(r.status));
    const pendingVerification = active.filter(r => ['Submitted', 'Under Verification'].includes(r.status));
    const escalated = active.filter(r => (r.escalationLevel ?? 0) > 0 || !!r.escalatedTo);

    return {
      immediate,
      unassignedQueue,
      assignedInProgress,
      pendingVerification,
      escalated,
    };
  }, [reports]);

  // Department specific breakdown statistics
  const deptBreakdown = useMemo(() => {
    const active = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status));

    if (isRoadsDept) {
      const potholes = active.filter(r => (
        r.category?.toLowerCase().includes('pothole') ||
        r.description?.toLowerCase().includes('pothole') ||
        r.causeTag?.toLowerCase().includes('pothole')
      )).length;

      const hazards = active.filter(r => (
        r.category?.toLowerCase().includes('hazard') ||
        r.category?.toLowerCase().includes('crack') ||
        r.category?.toLowerCase().includes('footpath') ||
        r.description?.toLowerCase().includes('hazard') ||
        r.description?.toLowerCase().includes('crack') ||
        r.causeTag?.toLowerCase().includes('hazard')
      )).length;

      const repeatComplaints = active.filter(r => (
        (r.relatedReportCount ?? 0) > 1 ||
        (r.reportFrequency ?? 0) > 1 ||
        r.priority === 'Critical'
      )).length;

      // Group location hotspots
      const hotspotsMap: Record<string, number> = {};
      active.forEach(r => {
        const loc = r.location?.split(',')[0]?.trim() || 'General Sector';
        hotspotsMap[loc] = (hotspotsMap[loc] || 0) + 1;
      });

      const hotspots = Object.entries(hotspotsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      return { potholes, hazards, repeatComplaints, hotspots };
    }

    if (isGarbageDept) {
      const overflowing = active.filter(r => (
        r.category?.toLowerCase().includes('overflow') ||
        r.description?.toLowerCase().includes('bin') ||
        r.description?.toLowerCase().includes('overflow') ||
        r.causeTag?.toLowerCase().includes('overflow')
      )).length;

      const now = Date.now();
      const backlog = active.filter(r => {
        const ageHours = (now - new Date(r.timestamp).getTime()) / (1000 * 3600);
        return ageHours > 12 && !['Assigned', 'In Progress'].includes(r.status);
      }).length;

      // Group location hotspots
      const hotspotsMap: Record<string, number> = {};
      active.forEach(r => {
        const loc = r.location?.split(',')[0]?.trim() || 'General Sector';
        hotspotsMap[loc] = (hotspotsMap[loc] || 0) + 1;
      });

      const hotspots = Object.entries(hotspotsMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

      return { overflowing, backlog, hotspots };
    }

    return null;
  }, [reports, isRoadsDept, isGarbageDept]);

  const availableWorkersCount = (workers ?? []).filter(w => (w.activeTasks ?? 0) < (w.maxTaskCapacity ?? 5)).length;

  return (
    <div className="p-4 md:p-6 space-y-6 pb-12 pt-16 md:pt-6 max-w-7xl mx-auto">
      {/* Top Command Center Hero Header */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-800 to-purple-900 p-6 md:p-8 text-white shadow-2xl">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md border border-white/20 text-3xl shadow-inner">
              {deptDef?.icon ?? (isRoadsDept ? '🛣️' : isGarbageDept ? '🧹' : '🏛️')}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight">{deptName} Command Center</h1>
                <Badge variant="outline" className="bg-emerald-500/20 text-emerald-200 border-emerald-400/40 text-xs font-semibold px-2 py-0.5">
                  LIVE OPERATIONAL
                </Badge>
              </div>
              <p className="text-sm text-indigo-200 font-medium">
                Official Operations & Field Task Governance Panel · Officer {profile?.name ?? ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button size="sm" className="bg-white text-indigo-900 hover:bg-indigo-50 font-bold shadow-md rounded-xl" asChild>
              <Link href="/dept/complaints">
                <ClipboardList className="mr-2 h-4 w-4" /> Manage Complaints
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="bg-white/10 hover:bg-white/20 border-white/20 text-white font-medium rounded-xl" asChild>
              <Link href="/dept/workers">
                <Users className="mr-2 h-4 w-4" /> Workers ({availableWorkersCount} Ready)
              </Link>
            </Button>
          </div>
        </div>

        {/* SLA Progress Bar Banner */}
        {metrics && (
          <div className="mt-6 pt-4 border-t border-white/15 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
            <div className="col-span-3 space-y-1.5">
              <div className="flex justify-between text-xs font-semibold text-indigo-100">
                <span>Department SLA Compliance Target (Overall)</span>
                <span className="font-bold text-white text-sm">{metrics.slaCompliancePct}%</span>
              </div>
              <Progress value={metrics.slaCompliancePct} className="h-2.5 bg-black/20 [&>div]:bg-gradient-to-r [&>div]:from-emerald-400 [&>div]:to-teal-300 rounded-full" />
            </div>
            <div className="flex items-center justify-between md:justify-end gap-3 text-xs text-indigo-200 font-medium">
              <span>Resolved Today: <strong className="text-white text-sm">{metrics.resolvedToday}</strong></span>
              <span>SLA Breaches: <strong className="text-rose-300 text-sm">{metrics.slaBreached}</strong></span>
            </div>
          </div>
        )}
      </div>

      {/* 7 Key Operational Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: 'Open Complaints', value: metrics?.open, icon: ClipboardList, color: 'bg-indigo-500 text-indigo-500' },
          { label: 'High / Critical', value: metrics?.highCritical, icon: Flame, color: 'bg-rose-500 text-rose-500' },
          { label: 'Unassigned Queue', value: metrics?.unassigned, icon: Clock3, color: 'bg-amber-500 text-amber-500' },
          { label: 'Near SLA Breach', value: metrics?.nearSlaBreach, icon: AlertTriangle, color: 'bg-orange-500 text-orange-500' },
          { label: 'SLA Breached', value: metrics?.slaBreached, icon: AlertCircle, color: 'bg-red-600 text-red-600' },
          { label: 'Resolved Today', value: metrics?.resolvedToday, icon: CheckCircle2, color: 'bg-emerald-500 text-emerald-500' },
          { label: 'SLA Compliance', value: metrics ? `${metrics.slaCompliancePct}%` : '100%', icon: Zap, color: 'bg-teal-500 text-teal-500' },
        ].map((m, idx) => (
          <Card key={idx} className="border-slate-200/80 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="p-3.5 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{m.label}</span>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 my-1" />
              ) : (
                <p className="text-2xl font-black text-slate-900">{m.value ?? 0}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Immediate Attention Warning Callout if needed */}
      {!isLoading && (queues.immediate.length > 0) && (
        <div className="flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm animate-pulse">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500 text-white font-bold">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-rose-900">Requires Immediate Attention</h4>
            <p className="text-xs text-rose-700 font-medium">
              {queues.immediate.length} complaint{queues.immediate.length > 1 ? 's are' : ' is'} flagged for Critical priority, active SLA breach, or high-level escalation.
            </p>
          </div>
          <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shrink-0" onClick={() => setActiveTab('immediate')}>
            View Queue ({queues.immediate.length})
          </Button>
        </div>
      )}

      {/* Department-Specific Breakdown Cards (Roads vs Garbage) */}
      {deptBreakdown && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {isRoadsDept && (
            <>
              <Card className="border-blue-100 bg-blue-50/50 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-blue-500 text-white">
                    <Construction className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-blue-950">{deptBreakdown.potholes}</p>
                    <p className="text-xs font-semibold text-blue-700">Active Potholes</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-100 bg-amber-50/50 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500 text-white">
                    <AlertTriangle className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-amber-950">{deptBreakdown.hazards}</p>
                    <p className="text-xs font-semibold text-amber-700">Road Safety Hazards</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-purple-100 bg-purple-50/50 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-purple-500 text-white">
                    <RefreshCw className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-purple-950">{deptBreakdown.repeatComplaints}</p>
                    <p className="text-xs font-semibold text-purple-700">Repeated Road Issues</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-indigo-600" />
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Road Hotspots</p>
                  </div>
                  <div className="space-y-1">
                    {deptBreakdown.hotspots.length > 0 ? (
                      deptBreakdown.hotspots.map(([loc, count]) => (
                        <div key={loc} className="flex justify-between text-xs font-medium text-slate-600">
                          <span className="truncate max-w-[120px]">{loc}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count} cases</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No hotspot concentrations</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {isGarbageDept && (
            <>
              <Card className="border-emerald-100 bg-emerald-50/50 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-emerald-600 text-white">
                    <Trash2 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-emerald-950">{deptBreakdown.overflowing}</p>
                    <p className="text-xs font-semibold text-emerald-700">Overflowing Bins</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-amber-100 bg-amber-50/50 shadow-sm">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-3 rounded-xl bg-amber-500 text-white">
                    <Clock3 className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-2xl font-extrabold text-amber-950">{deptBreakdown.backlog}</p>
                    <p className="text-xs font-semibold text-amber-700">Collection Backlog (&gt;12h)</p>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <MapPin className="h-4 w-4 text-emerald-600" />
                    <p className="text-xs font-bold text-slate-800 uppercase tracking-wider">Waste Hotspots</p>
                  </div>
                  <div className="space-y-1">
                    {deptBreakdown.hotspots.length > 0 ? (
                      deptBreakdown.hotspots.map(([loc, count]) => (
                        <div key={loc} className="flex justify-between text-xs font-medium text-slate-600">
                          <span className="truncate max-w-[120px]">{loc}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{count} cases</Badge>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400">No hotspot concentrations</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      )}

      {/* Phase 7: Department Operational Insights */}
      <DepartmentInsightsCard reports={reports} departmentId={userDeptId} />

      {/* Phase 4: Department Operations Map & Spatial Hotspots */}
      <DeptOperationsMap
        reports={reports}
        userDeptId={userDeptId}
        className="h-[440px]"
      />

      {/* Main Operational Queues Navigation & List Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: 5 Operational Queue Tabs & List (2 Columns wide on desktop) */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-600" /> Operational Work Queues
                </CardTitle>

                {/* Queue Filter Buttons */}
                <div className="flex flex-wrap gap-1">
                  {[
                    { key: 'all', label: `All (${metrics?.open ?? 0})` },
                    { key: 'immediate', label: `Immediate (${queues.immediate.length})` },
                    { key: 'unassigned', label: `Unassigned (${queues.unassignedQueue.length})` },
                    { key: 'in_progress', label: `In Progress (${queues.assignedInProgress.length})` },
                    { key: 'verification', label: `Verification (${queues.pendingVerification.length})` },
                    { key: 'escalated', label: `Escalated (${queues.escalated.length})` },
                  ].map(tab => (
                    <Button
                      key={tab.key}
                      size="sm"
                      variant={activeTab === tab.key ? 'default' : 'ghost'}
                      className={`h-7 px-2.5 text-xs font-semibold rounded-lg ${
                        activeTab === tab.key
                          ? 'bg-indigo-600 text-white'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      onClick={() => setActiveTab(tab.key as any)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-2.5">
              {isLoading && (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => (
                    <div key={i} className="p-3 border rounded-xl space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  ))}
                </div>
              )}

              {!isLoading && (
                (() => {
                  let list: Report[] = [];
                  if (activeTab === 'all') list = reports.filter(r => !['Resolved', 'Rejected'].includes(r.status));
                  else if (activeTab === 'immediate') list = queues.immediate;
                  else if (activeTab === 'unassigned') list = queues.unassignedQueue;
                  else if (activeTab === 'in_progress') list = queues.assignedInProgress;
                  else if (activeTab === 'verification') list = queues.pendingVerification;
                  else if (activeTab === 'escalated') list = queues.escalated;

                  if (list.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2 opacity-80" />
                        <h4 className="text-sm font-bold text-slate-800">Queue is Clear!</h4>
                        <p className="text-xs text-slate-500 max-w-xs mt-1">
                          No active complaints found in this operational section.
                        </p>
                      </div>
                    );
                  }

                  return list.map(report => (
                    <div
                      key={report.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:border-indigo-300 hover:shadow-md transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`h-2.5 w-2.5 shrink-0 rounded-full mt-1.5 ${priorityDot[report.priority ?? 'Low']}`} />
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-xs text-slate-500">#{report.id.slice(0, 8)}</span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md border ${statusColor[report.status]}`}>
                              {report.status}
                            </span>
                            {report.slaBreached && (
                              <Badge variant="destructive" className="text-[10px] font-bold px-1.5 py-0">
                                SLA BREACHED
                              </Badge>
                            )}
                            {(report.escalationLevel ?? 0) > 0 && (
                              <Badge className="bg-purple-600 text-white text-[10px] font-bold px-1.5 py-0">
                                L{report.escalationLevel} Escalated
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-slate-900 truncate group-hover:text-indigo-600 transition-colors">
                            {report.description}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-slate-400" />
                              {report.location?.split(',')[0]}
                            </span>
                            <span>•</span>
                            <span>{formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button size="sm" variant="outline" className="h-8 text-xs font-semibold rounded-xl hover:bg-indigo-50 hover:text-indigo-600" asChild>
                          <Link href={`/dept/complaint/${report.id}`}>
                            Details <ArrowRight className="ml-1 h-3 w-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ));
                })()
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Section 6 Worker Availability and Workload Roster */}
        <div className="space-y-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="p-4 border-b pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" /> Field Workers Roster
                </CardTitle>
                <CardDescription className="text-xs">Capacity & Task Allocation</CardDescription>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-xs text-indigo-600 hover:text-indigo-700" asChild>
                <Link href="/dept/workers">View All</Link>
              </Button>
            </CardHeader>

            <CardContent className="p-4 space-y-3">
              {isLoading && [1, 2, 3].map(i => (
                <div key={i} className="flex items-center gap-3 p-2 border rounded-xl">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2 w-1/2" />
                  </div>
                </div>
              ))}

              {!isLoading && (workers ?? []).length === 0 && (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No workers registered for this department yet.
                </div>
              )}

              {!isLoading && (workers ?? []).map(worker => {
                const activeTasks = worker.activeTasks ?? 0;
                const maxCapacity = worker.maxTaskCapacity ?? 5;
                const pct = Math.round((activeTasks / maxCapacity) * 100);
                const isAvailable = activeTasks < maxCapacity;

                return (
                  <div key={worker.id} className="p-3 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
                      {worker.name?.charAt(0)?.toUpperCase() ?? 'W'}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="truncate text-slate-900">{worker.name}</span>
                        <span className="text-slate-500">{activeTasks}/{maxCapacity}</span>
                      </div>
                      <Progress value={pct} className="h-1.5 bg-slate-200 [&>div]:bg-indigo-600" />
                    </div>

                    <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                      isAvailable ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'
                    }`}>
                      {isAvailable ? 'Available' : 'Full'}
                    </Badge>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
