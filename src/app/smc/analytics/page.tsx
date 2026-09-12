
'use client';

import Link from 'next/link';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, ReportStatus } from '@/lib/types';
import { collection, query } from 'firebase/firestore';
import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowUpRight, Building, CalendarRange, CheckCircle2, Clock, FileText, HardHat, MapPin, TrendingUp, BarChart3, PieChart as PieChartIcon, Activity, CheckCircle, ShieldAlert, Filter, Sparkles, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { normalizeDepartmentId } from '@/lib/departments';
import { DeptIcon } from '@/components/dept-icon';

const COLORS = ['#0ea5e9', '#22c55e', '#f59e0b', '#f97316', '#8b5cf6', '#ec4899'];
const ACTIVE_STATUSES: ReportStatus[] = ['Submitted', 'Under Verification', 'Assigned', 'In Progress'];
const STATUS_ORDER: ReportStatus[] = ['Submitted', 'Under Verification', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const STATUS_COLORS: Record<ReportStatus, string> = {
  Submitted: '#3b82f6',
  'Under Verification': '#f59e0b',
  Assigned: '#f97316',
  'In Progress': '#facc15',
  Resolved: '#22c55e',
  Rejected: '#ef4444',
};
const TIME_RANGES = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: null,
} as const;

type TimeRange = keyof typeof TIME_RANGES;
type StatusScope = 'all' | ReportStatus;

function getLocationKey(report: Report) {
  const roadName = report.roadName?.trim();
  if (roadName) {
    return roadName;
  }

  const primaryLocation = report.location?.split(',')[0]?.trim();
  return primaryLocation || 'Unknown';
}

function getResolutionHours(report: Report) {
  const resolvedAction = report.actionLog?.find((log) => log.status === 'Resolved');
  if (!resolvedAction) {
    return null;
  }

  const reportTime = new Date(report.timestamp).getTime();
  const resolvedTime = new Date(resolvedAction.timestamp).getTime();
  return (resolvedTime - reportTime) / (1000 * 60 * 60);
}

function buildCountData(reports: Report[], selector: (report: Report) => string, limit = 6) {
  const counts: Record<string, number> = {};

  reports.forEach((report) => {
    const key = selector(report);
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function buildTimelineData(reports: Report[], range: TimeRange) {
  const buckets = new Map<string, { label: string; submitted: number; resolved: number; sortValue: number }>();

  reports.forEach((report) => {
    const date = new Date(report.timestamp);
    const useMonthlyBuckets = range === 'all';
    const label = useMonthlyBuckets
      ? date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const bucketDate = useMonthlyBuckets
      ? new Date(date.getFullYear(), date.getMonth(), 1)
      : new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = bucketDate.toISOString();
    const existing = buckets.get(key) ?? {
      label,
      submitted: 0,
      resolved: 0,
      sortValue: bucketDate.getTime(),
    };

    existing.submitted += 1;
    if (report.status === 'Resolved') {
      existing.resolved += 1;
    }

    buckets.set(key, existing);
  });

  return Array.from(buckets.values()).sort((a, b) => a.sortValue - b.sortValue);
}

function formatHours(hours: number) {
  if (Number.isNaN(hours)) {
    return '0.0h';
  }

  if (hours >= 24) {
    return `${(hours / 24).toFixed(1)}d`;
  }

  return `${hours.toFixed(1)}h`;
}

export default function SmcAnalyticsPage() {
  const firestore = useFirestore();
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [statusScope, setStatusScope] = useState<StatusScope>('all');
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>('all');

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'));
  }, [firestore]);

  const { data: reports, isLoading } = useCollection<Report>(reportsQuery);

  const analyticsData = useMemo(() => {
    if (!reports) return null;

    const timeWindowStart = TIME_RANGES[timeRange] === null ? null : Date.now() - TIME_RANGES[timeRange]! * 24 * 60 * 60 * 1000;
    const allRangeReports = reports.filter((report) => {
      if (!timeWindowStart) return true;
      return new Date(report.timestamp).getTime() >= timeWindowStart;
    });

    const rangeReports = allRangeReports.filter((report) => {
      if (selectedDeptFilter === 'all') return true;
      const deptId = normalizeDepartmentId(report.departmentId || report.department) || 'unassigned';
      return deptId === selectedDeptFilter;
    });

    const filteredReports = rangeReports.filter((report) => {
      if (statusScope === 'all') return true;
      return report.status === statusScope;
    });

    const activeReports = rangeReports.filter((report) => ACTIVE_STATUSES.includes(report.status));
    const resolvedReports = filteredReports.filter((report) => report.status === 'Resolved');
    const resolvedInRange = rangeReports.filter((report) => report.status === 'Resolved');

    const timelineData = buildTimelineData(filteredReports, timeRange);
    const categoryData = buildCountData(filteredReports, (report) => report.category || 'Uncategorized', 7);
    const locationData = buildCountData(rangeReports, getLocationKey, 8);
    const departmentData = buildCountData(activeReports, (report) => report.department || 'Unassigned', 6);
    const statusData = STATUS_ORDER.map((status) => ({
      name: status,
      value: filteredReports.filter((report) => report.status === status).length,
    })).filter((entry) => entry.value > 0);

    let totalResolutionTime = 0;
    let resolvedCount = 0;
    resolvedInRange.forEach((report) => {
      const resolutionHours = getResolutionHours(report);
      if (resolutionHours !== null) {
        totalResolutionTime += resolutionHours;
        resolvedCount += 1;
      }
    });

    const avgResolutionHours = resolvedCount > 0 ? (totalResolutionTime / resolvedCount).toFixed(1) : 'N/A';
    const resolutionRate = filteredReports.length > 0 ? Math.round((resolvedReports.length / filteredReports.length) * 100) : 0;
    const topCategory = categoryData[0];
    const topLocation = locationData[0];
    const topDepartment = departmentData[0];

    const contractorPerformanceMap: Record<string, { resolvedCount: number; totalHours: number }> = {};
    resolvedInRange.forEach((report) => {
      const contractorName = report.assignedContractor || report.assignedWorkerId || 'Unassigned';
      const resolutionHours = getResolutionHours(report);
      if (resolutionHours === null) return;

      if (!contractorPerformanceMap[contractorName]) {
        contractorPerformanceMap[contractorName] = { resolvedCount: 0, totalHours: 0 };
      }

      contractorPerformanceMap[contractorName].resolvedCount += 1;
      contractorPerformanceMap[contractorName].totalHours += resolutionHours;
    });

    const contractorPerformanceData = Object.entries(contractorPerformanceMap)
      .map(([name, data]) => ({
        name,
        resolvedCount: data.resolvedCount,
        avgResolutionTime: Number((data.totalHours / data.resolvedCount).toFixed(1)),
      }))
      .sort((a, b) => b.resolvedCount - a.resolvedCount)
      .slice(0, 8);

    // Aggregate Department SLA Performance Scorecard across allRangeReports
    const deptPerformanceMap: Record<string, {
      deptName: string;
      deptId: string;
      totalCount: number;
      activeCount: number;
      resolvedCount: number;
      resolvedOnTimeCount: number;
      overdueCount: number;
      totalResolutionHours: number;
      validResolutionCount: number;
    }> = {};

    const nowMs = Date.now();
    allRangeReports.forEach((report) => {
      const deptName = report.department || 'Unassigned';
      const deptId = normalizeDepartmentId(report.departmentId || report.department) || 'unassigned';

      if (!deptPerformanceMap[deptId]) {
        deptPerformanceMap[deptId] = {
          deptName,
          deptId,
          totalCount: 0,
          activeCount: 0,
          resolvedCount: 0,
          resolvedOnTimeCount: 0,
          overdueCount: 0,
          totalResolutionHours: 0,
          validResolutionCount: 0,
        };
      }

      const entry = deptPerformanceMap[deptId];
      entry.totalCount += 1;

      const isActive = ACTIVE_STATUSES.includes(report.status);
      if (isActive) {
        entry.activeCount += 1;
        const isOverdue = report.slaBreached || (report.slaDeadline && new Date(report.slaDeadline).getTime() < nowMs);
        if (isOverdue) entry.overdueCount += 1;
      }

      if (report.status === 'Resolved') {
        entry.resolvedCount += 1;
        if (!report.slaBreached) entry.resolvedOnTimeCount += 1;
        const resHours = getResolutionHours(report);
        if (resHours !== null) {
          entry.totalResolutionHours += resHours;
          entry.validResolutionCount += 1;
        }
      }
    });

    const departmentPerformanceList = Object.values(deptPerformanceMap).map((d) => {
      const resolutionRatePct = d.totalCount > 0 ? Math.round((d.resolvedCount / d.totalCount) * 100) : 0;
      const slaCompliancePct = d.resolvedCount > 0 ? Math.round((d.resolvedOnTimeCount / d.resolvedCount) * 100) : (d.overdueCount > 0 ? 0 : 100);
      const avgResHours = d.validResolutionCount > 0 ? Number((d.totalResolutionHours / d.validResolutionCount).toFixed(1)) : null;

      let healthStatus: 'Optimal' | 'At Risk' | 'Critical SLA Breach' = 'Optimal';
      if (d.overdueCount > 2 || slaCompliancePct < 70) healthStatus = 'Critical SLA Breach';
      else if (d.overdueCount > 0 || slaCompliancePct < 85) healthStatus = 'At Risk';

      return {
        ...d,
        resolutionRatePct,
        slaCompliancePct,
        avgResHours,
        healthStatus,
      };
    }).sort((a, b) => b.totalCount - a.totalCount);

    const deptChartData = departmentPerformanceList.map((dept) => ({
      name: dept.deptName.replace(' Department', '').replace(' & Drainage', ''),
      fullName: dept.deptName,
      deptId: dept.deptId,
      slaCompliancePct: dept.slaCompliancePct,
      resolutionRatePct: dept.resolutionRatePct,
      activeCount: dept.activeCount,
      overdueCount: dept.overdueCount,
      resolvedCount: dept.resolvedCount,
      totalCount: dept.totalCount,
      avgResHours: dept.avgResHours ?? 0,
    }));

    const sortedBySla = [...departmentPerformanceList].sort((a, b) => b.slaCompliancePct - a.slaCompliancePct);
    const sortedByOverdue = [...departmentPerformanceList].sort((a, b) => b.overdueCount - a.overdueCount);
    const sortedBySpeed = [...departmentPerformanceList].filter(d => d.avgResHours !== null).sort((a, b) => a.avgResHours! - b.avgResHours!);

    const bestDept = sortedBySla[0] || null;
    const mostOverdueDept = sortedByOverdue[0] && sortedByOverdue[0].overdueCount > 0 ? sortedByOverdue[0] : null;
    const fastestDept = sortedBySpeed[0] || null;

    const slaBreachedCount = rangeReports.filter(r => r.slaBreached).length;
    const escalationLevel1Count = rangeReports.filter(r => r.escalationLevel === 1).length;
    const escalationLevel2Count = rangeReports.filter(r => (r.escalationLevel ?? 0) >= 2).length;
    const totalBreachedOrEscalated = rangeReports.filter(r => r.slaBreached || (r.escalationLevel ?? 0) > 0).length;
    const slaComplianceRate = rangeReports.length > 0 ? Math.round(((rangeReports.length - slaBreachedCount) / rangeReports.length) * 100) : 100;

    return {
      rangeReports,
      filteredReports,
      timelineData,
      categoryData,
      locationData,
      departmentData,
      departmentPerformanceList,
      deptChartData,
      bestDept,
      mostOverdueDept,
      fastestDept,
      statusData,
      avgResolutionHours,
      resolutionRate,
      topCategory,
      topLocation,
      topDepartment,
      contractorPerformanceData,
      totalReports: filteredReports.length,
      activeCount: activeReports.length,
      resolvedCount: resolvedReports.length,
      slaBreachedCount,
      escalationLevel1Count,
      escalationLevel2Count,
      totalBreachedOrEscalated,
      slaComplianceRate,
    };
  }, [reports, statusScope, timeRange, selectedDeptFilter]);

  if (isLoading || !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-20" />
                <Skeleton className="mt-2 h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-96 w-full" />
          </CardContent>
        </Card>
        <div className="grid gap-6 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-56" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-80 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-6">
      <Card className="border-sky-100 bg-gradient-to-br from-sky-50 via-white to-emerald-50 shadow-sm">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
              <TrendingUp className="h-3.5 w-3.5 text-sky-500" />
              Admin analytics
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Analytics & Insights</h1>
              <p className="max-w-2xl text-sm text-slate-600">
                Track issue trends, worker performance, locations, and resolution speed across the city.
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[540px]">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 font-semibold">Department</p>
              <Select value={selectedDeptFilter} onValueChange={(value) => setSelectedDeptFilter(value)}>
                <SelectTrigger className="bg-white/80">
                  <SelectValue placeholder="All Departments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {analyticsData.departmentPerformanceList.map((dept) => (
                    <SelectItem key={dept.deptId} value={dept.deptId}>
                      {dept.deptName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 font-semibold">Timeline</p>
              <Select value={timeRange} onValueChange={(value) => setTimeRange(value as TimeRange)}>
                <SelectTrigger className="bg-white/80">
                  <SelectValue placeholder="Select range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 font-semibold">Status</p>
              <Select value={statusScope} onValueChange={(value) => setStatusScope(value as StatusScope)}>
                <SelectTrigger className="bg-white/80">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All complaints</SelectItem>
                  {STATUS_ORDER.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">{analyticsData.slaComplianceRate}%</div>
            <p className="text-xs text-muted-foreground">{analyticsData.slaBreachedCount} total deadline breaches.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Escalations</CardTitle>
            <Clock className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analyticsData.totalBreachedOrEscalated}</div>
            <p className="text-xs text-muted-foreground">L1: {analyticsData.escalationLevel1Count} | L2+: {analyticsData.escalationLevel2Count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.activeCount}</div>
            <p className="text-xs text-muted-foreground">Reports requiring action from field teams.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg. Resolution</CardTitle>
            <CalendarRange className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.avgResolutionHours} hours</div>
            <p className="text-xs text-muted-foreground">Average time from report to completion.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle>Complaint Timeline</CardTitle>
            <CardDescription>Submitted and resolved issues in the selected scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={analyticsData.timelineData}>
                <defs>
                  <linearGradient id="timelineSubmitted" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="timelineResolved" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#22c55e" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="#22c55e" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                  }}
                />
                <Legend />
                <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#0ea5e9" fill="url(#timelineSubmitted)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="resolved" name="Resolved" stroke="#22c55e" fill="url(#timelineResolved)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Current Status Mix</CardTitle>
            <CardDescription>How the current filtered set is distributed.</CardDescription>
          </CardHeader>
          <CardContent>
            {analyticsData.statusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <PieChart>
                  <Pie
                    data={analyticsData.statusData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={72}
                    outerRadius={118}
                    paddingAngle={4}
                  >
                    {analyticsData.statusData.map((entry) => (
                      <Cell key={entry.name} fill={STATUS_COLORS[entry.name as ReportStatus] ?? '#94a3b8'} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                    }}
                  />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-muted-foreground">
                No reports match the current filters.
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department-Wise Insights Chart Dashboard */}
      <Card className="border-indigo-100 bg-gradient-to-br from-indigo-50/40 via-white to-sky-50/40 shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-bold text-indigo-800 mb-1">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                Department Comparative Insights
              </div>
              <CardTitle className="text-xl font-bold flex items-center gap-2 text-slate-900">
                <BarChart3 className="h-5 w-5 text-indigo-600" />
                Department-Wise SLA & Workload Chart Dashboard
              </CardTitle>
              <CardDescription className="text-xs text-slate-600">
                Interactive charts comparing SLA compliance rates, resolution efficiency, and active vs overdue workload across all municipal departments.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="bg-white border-indigo-200 text-indigo-700 font-bold text-xs px-3 py-1.5 shadow-xs">
                <Building className="h-3.5 w-3.5 mr-1" />
                {analyticsData.deptChartData.length} Departments Tracked
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          <div className="grid gap-6 xl:grid-cols-2">
            {/* Chart 1: SLA Compliance % vs Resolution Rate % */}
            <div className="bg-white rounded-xl border p-4 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Activity className="h-4 w-4 text-emerald-500" />
                    SLA Compliance % vs Resolution Rate %
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Department efficiency & on-time SLA fulfillment benchmark</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={analyticsData.deptChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis domain={[0, 100]} unit="%" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [`${value}%`, name === 'slaCompliancePct' ? 'SLA Compliance' : 'Resolution Rate']}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="slaCompliancePct" name="SLA Compliance %" fill="#10b981" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="resolutionRatePct" name="Resolution Rate %" fill="#0ea5e9" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Chart 2: Active Backlog vs SLA Overdue Breaches */}
            <div className="bg-white rounded-xl border p-4 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <ShieldAlert className="h-4 w-4 text-rose-500" />
                    Active Workload vs SLA Overdue Breaches
                  </h4>
                  <p className="text-[11px] text-muted-foreground">Volume of active field complaints compared to overdue SLA breaches</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={290}>
                <BarChart data={analyticsData.deptChartData} margin={{ top: 10, right: 10, left: -15, bottom: 25 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: '#64748b' }}
                    interval={0}
                    angle={-20}
                    textAnchor="end"
                  />
                  <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '12px',
                      boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                      fontSize: '12px',
                    }}
                    formatter={(value: any, name: any) => [value, name === 'activeCount' ? 'Active Queue' : 'SLA Overdue']}
                  />
                  <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px' }} />
                  <Bar dataKey="activeCount" name="Active Queue" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={16} />
                  <Bar dataKey="overdueCount" name="Overdue Breaches" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Key Insights Highlights Row */}
          <div className="grid gap-4 sm:grid-cols-3">
            {analyticsData.bestDept && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3.5 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold shrink-0">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Highest SLA Compliance</p>
                  <p className="font-bold text-sm text-emerald-950 mt-0.5">{analyticsData.bestDept.deptName}</p>
                  <p className="text-xs text-emerald-700 font-medium">
                    {analyticsData.bestDept.slaCompliancePct}% on-time resolution ({analyticsData.bestDept.resolvedCount} resolved cases)
                  </p>
                </div>
              </div>
            )}

            {analyticsData.mostOverdueDept && (
              <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-rose-600 text-white flex items-center justify-center font-bold shrink-0">
                  <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wide">Requires SLA Attention</p>
                  <p className="font-bold text-sm text-rose-950 mt-0.5">{analyticsData.mostOverdueDept.deptName}</p>
                  <p className="text-xs text-rose-700 font-medium">
                    {analyticsData.mostOverdueDept.overdueCount} overdue breaches | {analyticsData.mostOverdueDept.activeCount} active in queue
                  </p>
                </div>
              </div>
            )}

            {analyticsData.fastestDept && (
              <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 flex items-start gap-3">
                <div className="h-9 w-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-indigo-800 uppercase tracking-wide">Fastest Resolution Speed</p>
                  <p className="font-bold text-sm text-indigo-950 mt-0.5">{analyticsData.fastestDept.deptName}</p>
                  <p className="text-xs text-indigo-700 font-medium">
                    Avg. {analyticsData.fastestDept.avgResHours}h per complaint resolution
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-sky-500" />
              Department Load
            </CardTitle>
            <CardDescription>Open cases grouped by department.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analyticsData.departmentData} layout="vertical" margin={{ left: 16, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="value" fill="#0ea5e9" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
            {analyticsData.topDepartment && (
              <p className="mt-3 text-xs text-muted-foreground">
                Busiest: <span className="font-medium text-slate-700">{analyticsData.topDepartment.name}</span> with {analyticsData.topDepartment.value} open cases.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>Problem Types</CardTitle>
            <CardDescription>Most common complaint categories in the current scope.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analyticsData.categoryData} layout="vertical" margin={{ left: 16, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
                  {analyticsData.categoryData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {analyticsData.topCategory && (
              <p className="mt-3 text-xs text-muted-foreground">
                Top issue: <span className="font-medium text-slate-700">{analyticsData.topCategory.name}</span> with {analyticsData.topCategory.value} reports.
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-rose-500" />
              Location Hotspots
            </CardTitle>
            <CardDescription>Areas with the highest concentration of reports.</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={analyticsData.locationData} layout="vertical" margin={{ left: 16, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={true} vertical={false} />
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} />
                <YAxis dataKey="name" type="category" width={100} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                  }}
                />
                <Bar dataKey="value" fill="#f97316" radius={[0, 8, 8, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
            {analyticsData.topLocation && (
              <p className="mt-3 text-xs text-muted-foreground">
                Hotspot: <span className="font-medium text-slate-700">{analyticsData.topLocation.name}</span> with {analyticsData.topLocation.value} reports.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Department SLA Performance Scorecard Panel for Admin */}
      <Card className="shadow-sm border-indigo-100 bg-white">
        <CardHeader className="p-5 border-b pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <Building className="h-5 w-5 text-indigo-600" />
                Department SLA Performance Scorecard
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                City-wide department efficiency, active workload, SLA compliance %, and overdue task breaches.
              </CardDescription>
            </div>
            <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold text-xs self-start sm:self-center px-3 py-1">
              {analyticsData.departmentPerformanceList.length} Municipal Departments Monitored
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/90 hover:bg-slate-50/90 text-xs font-bold uppercase tracking-wider text-slate-600">
                  <TableHead className="py-3 font-bold">Department</TableHead>
                  <TableHead className="text-center font-bold">Total Cases</TableHead>
                  <TableHead className="text-center font-bold">Active Queue</TableHead>
                  <TableHead className="text-center font-bold">Resolved</TableHead>
                  <TableHead className="text-center font-bold">SLA Compliance</TableHead>
                  <TableHead className="text-center font-bold">Overdue / Breached</TableHead>
                  <TableHead className="text-right font-bold">Avg. Resolution</TableHead>
                  <TableHead className="text-right font-bold">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analyticsData.departmentPerformanceList.length > 0 ? (
                  analyticsData.departmentPerformanceList.map((dept) => (
                    <TableRow key={dept.deptId} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <DeptIcon dept={dept.deptId} className="h-4 w-4 text-indigo-600 shrink-0" />
                          <span>{dept.deptName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-bold">{dept.totalCount}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="bg-blue-50/80 text-blue-700 border-blue-200 font-bold">
                          {dept.activeCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-semibold text-emerald-700">{dept.resolvedCount}</TableCell>
                      <TableCell className="text-center font-bold">
                        <span className={dept.slaCompliancePct >= 85 ? 'text-emerald-600' : dept.slaCompliancePct >= 70 ? 'text-amber-600' : 'text-rose-600'}>
                          {dept.slaCompliancePct}%
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        {dept.overdueCount > 0 ? (
                          <Badge variant="destructive" className="font-extrabold text-xs px-2 py-0.5">
                            {dept.overdueCount} Overdue
                          </Badge>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">0</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium text-slate-700">
                        {dept.avgResHours !== null ? `${dept.avgResHours}h` : 'N/A'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge className={`text-[10px] font-bold px-2 py-0.5 ${
                          dept.healthStatus === 'Optimal'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                            : dept.healthStatus === 'At Risk'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-rose-100 text-rose-800 border-rose-200'
                        }`}>
                          {dept.healthStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                      No department data available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="xl:col-span-2 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HardHat className="h-5 w-5 text-slate-700" />
              Worker Performance
            </CardTitle>
            <CardDescription>Resolved workload and average resolution time for workers and contractors.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow className="bg-slate-50/80">
                    <TableHead>Worker / Contractor</TableHead>
                    <TableHead className="text-center">Resolved</TableHead>
                    <TableHead className="text-right hidden sm:table-cell">Avg. Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {analyticsData.contractorPerformanceData.length > 0 ? (
                    analyticsData.contractorPerformanceData.map((entry) => (
                      <TableRow key={entry.name} className="hover:bg-slate-50/70">
                        <TableCell className="font-medium">
                          <div>{entry.name}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{formatHours(entry.avgResolutionTime)} avg</div>
                        </TableCell>
                        <TableCell className="text-center">{entry.resolvedCount}</TableCell>
                        <TableCell className="text-right hidden sm:table-cell">{formatHours(entry.avgResolutionTime)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-10 text-center text-muted-foreground">
                        No worker performance data available yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
          <CardFooter className="flex items-center justify-between border-t pt-4">
            <p className="text-xs text-muted-foreground">
              {analyticsData.contractorPerformanceData.length} workers with resolved cases
            </p>
            <Button asChild variant="ghost" size="sm">
              <Link href="/smc/complaints?view=active" className="text-xs gap-1">
                View all complaints
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardFooter>
        </Card>

        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
            <CardDescription>Quick stats for the current scope</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Reports analyzed</span>
              <span className="text-lg font-bold text-slate-900">{analyticsData.totalReports}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Active queue</span>
              <span className="text-lg font-bold text-slate-900">{analyticsData.activeCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Resolved</span>
              <span className="text-lg font-bold text-emerald-600">{analyticsData.resolvedCount}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3">
              <span className="text-sm text-slate-600">Resolution rate</span>
              <span className="text-lg font-bold text-slate-900">{analyticsData.resolutionRate}%</span>
            </div>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href="/smc/complaints">Go to active queue</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
