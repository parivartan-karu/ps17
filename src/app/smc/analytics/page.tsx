
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
import { ArrowUpRight, Building, CalendarRange, CheckCircle2, Clock, FileText, HardHat, MapPin, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

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

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'));
  }, [firestore]);

  const { data: reports, isLoading } = useCollection<Report>(reportsQuery);

  const analyticsData = useMemo(() => {
    if (!reports) return null;

    const timeWindowStart = TIME_RANGES[timeRange] === null ? null : Date.now() - TIME_RANGES[timeRange]! * 24 * 60 * 60 * 1000;
    const rangeReports = reports.filter((report) => {
      if (!timeWindowStart) return true;
      return new Date(report.timestamp).getTime() >= timeWindowStart;
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

    return {
      rangeReports,
      filteredReports,
      timelineData,
      categoryData,
      locationData,
      departmentData,
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
    };
  }, [reports, statusScope, timeRange]);

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
          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[360px]">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Timeline</p>
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
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</p>
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
            <CardTitle className="text-sm font-medium">Reports in Scope</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.totalReports}</div>
            <p className="text-xs text-muted-foreground">Matching the selected time and status filters.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Queue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.activeCount}</div>
            <p className="text-xs text-muted-foreground">Reports that still need action from teams.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolved Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.resolutionRate}%</div>
            <p className="text-xs text-muted-foreground">Resolved complaints in the current scope.</p>
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
