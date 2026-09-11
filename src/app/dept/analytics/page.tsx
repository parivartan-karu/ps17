'use client';

import { useMemo, useState } from 'react';
import { collection, query, where } from 'firebase/firestore';
import {
  BarChart3, CheckCircle2, Clock, AlertTriangle, ShieldAlert,
  Users, TrendingUp, Calendar, Zap, Loader2, ArrowUpRight
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

import { useAuth, useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { normalizeDepartmentId, CANONICAL_DEPARTMENTS, isReportInDepartment, type DepartmentDefinition } from '@/lib/departments';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { doc } from 'firebase/firestore';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function DeptAnalyticsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'all'>('30d');

  // Authenticated department profile
  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile } = useDoc<UserType>(profileRef);

  const rawDeptId = profile?.departmentId || profile?.department || '';
  const deptId = normalizeDepartmentId(rawDeptId);
  const deptDef = CANONICAL_DEPARTMENTS.find((d: DepartmentDefinition) => d.id === deptId);
  const deptName = deptDef?.name || profile?.department || 'Department';

  // Department-Scoped Queries
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);
  const { data: rawReports, isLoading: isReportsLoading } = useCollection<Report>(reportsQuery);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);
  const { data: rawWorkers, isLoading: isWorkersLoading } = useCollection<UserType>(workersQuery);

  // Strict Department Scoping Filter
  const deptReports = useMemo(() => {
    if (!rawReports) return [];
    if (!deptId) return rawReports;
    return rawReports.filter(r => isReportInDepartment(r, deptId));
  }, [rawReports, deptId]);

  const deptWorkers = useMemo(() => {
    if (!rawWorkers) return [];
    return rawWorkers.filter(w => {
      const wDeptId = normalizeDepartmentId(w.departmentId || w.department);
      return wDeptId === deptId;
    });
  }, [rawWorkers, deptId]);

  // Analytics Computation Engine
  const metrics = useMemo(() => {
    if (!deptReports) return null;

    const totalReports = deptReports.length;
    const resolvedReports = deptReports.filter(r => r.status === 'Resolved');
    const openReports = deptReports.filter(r => !['Resolved', 'Rejected'].includes(r.status));
    const highCriticalOpen = openReports.filter(r => r.priority === 'High' || r.priority === 'Critical');

    // SLA & Escalation Metrics
    const slaBreached = deptReports.filter(r => r.slaBreached);
    const slaCompliantResolved = resolvedReports.filter(r => !r.slaBreached);
    const slaComplianceRate = resolvedReports.length > 0
      ? Math.round((slaCompliantResolved.length / resolvedReports.length) * 100)
      : null; // Null indicates insufficient data

    const resolutionRate = totalReports > 0
      ? Math.round((resolvedReports.length / totalReports) * 100)
      : null;

    // Average Resolution Time (hours)
    let totalResHours = 0;
    let validResCount = 0;
    resolvedReports.forEach(r => {
      if (r.timestamp && r.completedAt) {
        const start = new Date(r.timestamp).getTime();
        const end = new Date(r.completedAt).getTime();
        if (end > start) {
          totalResHours += (end - start) / (1000 * 60 * 60);
          validResCount++;
        }
      }
    });
    const avgResolutionHours = validResCount > 0
      ? (totalResHours / validResCount).toFixed(1)
      : 'N/A';

    const escalationsCount = deptReports.filter(r => (r.escalationLevel ?? 0) > 0).length;

    // Status breakdown chart data
    const statusCounts: Record<string, number> = {};
    deptReports.forEach(r => {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    });
    const statusChartData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));

    // Category breakdown chart data
    const categoryCounts: Record<string, number> = {};
    deptReports.forEach(r => {
      const cat = r.category || 'General';
      categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
    });
    const categoryChartData = Object.entries(categoryCounts).map(([name, value]) => ({ name, value }));

    // Worker performance metrics
    const workerPerformance = deptWorkers.map(w => {
      const assigned = deptReports.filter(r => r.assignedWorkerId === w.id || r.assignedContractor === w.name);
      const completed = assigned.filter(r => r.status === 'Resolved');
      const slaOk = completed.filter(r => !r.slaBreached);

      let wHours = 0;
      let wCount = 0;
      completed.forEach(r => {
        if (r.timestamp && r.completedAt) {
          const dur = (new Date(r.completedAt).getTime() - new Date(r.timestamp).getTime()) / (1000 * 60 * 60);
          if (dur > 0) {
            wHours += dur;
            wCount++;
          }
        }
      });

      const avgTime = wCount > 0 ? (wHours / wCount).toFixed(1) : 'N/A';
      const slaRate = completed.length > 0 ? Math.round((slaOk.length / completed.length) * 100) : null;
      const activeTasks = w.activeTasks ?? assigned.filter(r => !['Resolved', 'Rejected'].includes(r.status)).length;
      const maxCap = w.maxTaskCapacity ?? 5;

      return {
        id: w.id,
        name: w.name,
        assignedCount: assigned.length,
        completedCount: completed.length,
        avgTime,
        slaRate,
        activeTasks,
        maxCap,
        isAvailable: w.isAvailable !== false && activeTasks < maxCap,
      };
    });

    return {
      totalReports,
      resolvedCount: resolvedReports.length,
      openCount: openReports.length,
      highCriticalCount: highCriticalOpen.length,
      slaBreachedCount: slaBreached.length,
      slaComplianceRate,
      resolutionRate,
      avgResolutionHours,
      escalationsCount,
      statusChartData,
      categoryChartData,
      workerPerformance,
    };
  }, [deptReports, deptWorkers]);

  const isLoading = isReportsLoading || isWorkersLoading;

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-4 pt-16 md:pt-6">
        <Skeleton className="h-28 w-full rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 pb-12 pt-16 md:pt-6">
      {/* Header */}
      <div className="rounded-3xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-purple-900 p-6 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Badge className="bg-white/20 text-white border-white/30 text-xs font-bold px-2.5 py-0.5">
              DEPARTMENT SCOPED ANALYTICS
            </Badge>
            <span className="text-xs text-indigo-300 font-medium">Authoritative Metrics</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">{deptName} Performance Analytics</h1>
          <p className="text-xs text-indigo-200 mt-0.5">
            Production resolution rates, SLA compliance, open backlog, and worker execution metrics
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {(['7d', '30d', 'all'] as const).map(range => (
            <Button
              key={range}
              size="sm"
              variant={timeRange === range ? 'default' : 'outline'}
              className={timeRange === range
                ? 'bg-white text-indigo-900 font-bold rounded-xl'
                : 'bg-white/10 text-white border-white/20 hover:bg-white/20 rounded-xl text-xs'}
              onClick={() => setTimeRange(range)}
            >
              {range.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Resolution Rate */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Resolution Rate</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {metrics?.resolutionRate !== null ? `${metrics?.resolutionRate}%` : 'N/A'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {metrics?.resolvedCount} of {metrics?.totalReports} cases resolved
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 font-bold">
              <CheckCircle2 className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* Avg Resolution Time */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Avg Resolution Time</p>
              <h3 className="text-2xl font-black text-slate-900 mt-1">
                {metrics?.avgResolutionHours !== 'N/A' ? `${metrics?.avgResolutionHours} hrs` : 'N/A'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">From submission to verification</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-50 text-purple-600 font-bold">
              <Clock className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* SLA Compliance */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">SLA Compliance</p>
              <h3 className="text-2xl font-black text-emerald-600 mt-1">
                {metrics?.slaComplianceRate !== null ? `${metrics?.slaComplianceRate}%` : 'N/A'}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {metrics?.slaBreachedCount} deadline breaches
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 font-bold">
              <TrendingUp className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>

        {/* High/Critical Backlog */}
        <Card className="border-0 shadow-sm bg-white">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">High/Critical Backlog</p>
              <h3 className="text-2xl font-black text-rose-600 mt-1">
                {metrics?.highCriticalCount}
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Out of {metrics?.openCount} total open cases
              </p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 font-bold">
              <AlertTriangle className="h-6 w-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <PieChart className="h-4 w-4 text-indigo-600" /> Complaint Status Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {metrics?.statusChartData && metrics.statusChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={metrics.statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    {metrics.statusChartData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No complaint status data available.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Category Breakdown */}
        <Card className="border-0 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-600" /> Category Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="h-64">
            {metrics?.categoryChartData && metrics.categoryChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={metrics.categoryChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#6366f1" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-400">
                No category data available.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Worker Performance Metrics Table */}
      <Card className="border-0 shadow-sm bg-white overflow-hidden">
        <CardHeader className="p-4 bg-slate-50 border-b border-slate-100 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" /> Field Worker Performance & Workload
            </CardTitle>
            <CardDescription className="text-xs text-slate-500">
              Real-time worker task counts, completion rates, and capacity allocation
            </CardDescription>
          </div>
          <Badge variant="outline" className="text-xs font-semibold">
            {metrics?.workerPerformance.length} Workers Registered
          </Badge>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {metrics?.workerPerformance && metrics.workerPerformance.length > 0 ? (
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/70 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Worker Name</th>
                  <th className="p-3">Active / Capacity</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3">Completed</th>
                  <th className="p-3">Avg Resolution</th>
                  <th className="p-3">SLA Rate</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.workerPerformance.map((w) => {
                  const pct = Math.min(100, Math.round((w.activeTasks / w.maxCap) * 100));
                  return (
                    <tr key={w.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3 font-bold text-slate-900">{w.name}</td>
                      <td className="p-3 min-w-[140px]">
                        <div className="flex items-center justify-between text-[11px] font-semibold mb-1">
                          <span>{w.activeTasks} / {w.maxCap} tasks</span>
                          <span className="text-slate-400">{pct}%</span>
                        </div>
                        <Progress value={pct} className="h-1.5" />
                      </td>
                      <td className="p-3 font-semibold">{w.assignedCount}</td>
                      <td className="p-3 font-bold text-emerald-600">{w.completedCount}</td>
                      <td className="p-3 text-slate-600">{w.avgTime !== 'N/A' ? `${w.avgTime} h` : 'N/A'}</td>
                      <td className="p-3 font-bold text-indigo-600">{w.slaRate !== null ? `${w.slaRate}%` : 'N/A'}</td>
                      <td className="p-3">
                        <Badge
                          className={
                            w.activeTasks >= w.maxCap
                              ? 'bg-rose-100 text-rose-800 border-rose-200 text-[10px]'
                              : w.activeTasks >= w.maxCap - 1
                              ? 'bg-amber-100 text-amber-800 border-amber-200 text-[10px]'
                              : 'bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]'
                          }
                        >
                          {w.activeTasks >= w.maxCap ? 'At Capacity' : w.activeTasks >= w.maxCap - 1 ? 'Busy' : 'Available'}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400">
              No workers registered in this department yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function limitToDept(deptId: string) {
  if (deptId === 'dept_engineering') {
    return where('departmentId', 'in', ['dept_engineering', 'roads-dept', 'Roads Department']);
  }
  if (deptId === 'dept_sanitation') {
    return where('departmentId', 'in', ['dept_sanitation', 'garbage-waste-dept', 'Garbage & Waste Management']);
  }
  return where('departmentId', '==', deptId);
}
