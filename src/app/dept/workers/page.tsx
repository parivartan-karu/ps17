'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { collection, query, where, doc } from 'firebase/firestore';
import {
  CheckCircle2, Clock3, Flame, Users, HardHat, Star, AlertTriangle,
  Award, ChevronDown, ChevronUp, ExternalLink, ShieldAlert, ArrowRight, Activity, MapPin
} from 'lucide-react';

import { useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { normalizeDepartment, normalizeDepartmentId, isReportInDepartment } from '@/lib/departments';
import { DeptIcon } from '@/components/dept-icon';

function getResolutionHours(report: Report) {
  const resolvedAction = report.actionLog?.find((log) => log.status === 'Resolved');
  if (!resolvedAction) return null;
  const reportTime = new Date(report.timestamp).getTime();
  const resolvedTime = new Date(resolvedAction.timestamp).getTime();
  return (resolvedTime - reportTime) / (1000 * 60 * 60);
}

export default function DeptWorkersPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [expandedWorkerId, setExpandedWorkerId] = useState<string | null>(null);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: profile } = useDoc<UserType>(profileRef);
  const userDeptId = useMemo(() => normalizeDepartmentId(profile?.departmentId || profile?.department), [profile?.departmentId, profile?.department]);
  const deptDef = useMemo(() => normalizeDepartment(userDeptId), [userDeptId]);
  const userRole = profile?.role as string | undefined;
  const isSystemAdmin = userRole === 'admin' || profile?.name === 'System Admin' || (!profile?.department && (userRole === 'official' || userRole === 'admin'));
  const dept = deptDef?.name || profile?.department || (isSystemAdmin ? 'Admin' : 'Department');

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);
  const { data: rawWorkers, isLoading: wLoading } = useCollection<UserType>(workersQuery);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);
  const { data: rawReports, isLoading: rLoading } = useCollection<Report>(reportsQuery);

  const workers = useMemo(() => {
    if (!rawWorkers || !userDeptId) return [];
    return rawWorkers.filter(w => normalizeDepartmentId(w.departmentId || w.department) === userDeptId);
  }, [rawWorkers, userDeptId]);

  const reports = useMemo(() => {
    if (!rawReports) return [];
    if (isSystemAdmin) return rawReports;
    if (!userDeptId) return [];
    return rawReports.filter(r => isReportInDepartment(r, userDeptId));
  }, [rawReports, userDeptId, isSystemAdmin]);

  const enriched = useMemo(() => {
    const now = Date.now();

    return (workers ?? []).map(w => {
      const myReports = (reports ?? []).filter(r => r.assignedWorkerId === w.id || r.assignedContractor === w.name);
      const resolvedList = myReports.filter(r => r.status === 'Resolved');
      const activeList = myReports.filter(r => ['Assigned', 'In Progress'].includes(r.status));
      
      // Identify active overdue/breached tasks
      const overdueReports = activeList.filter(r => {
        if (r.slaBreached) return true;
        if (!r.slaDeadline) return false;
        return new Date(r.slaDeadline).getTime() < now;
      });

      const resolvedCount = resolvedList.length;
      const activeCount = activeList.length;
      const overdueCount = overdueReports.length;

      // On-Time SLA Rate calculation
      const onTimeResolvedCount = resolvedList.filter(r => !r.slaBreached).length;
      const onTimeRatePct = resolvedCount > 0 
        ? Math.round((onTimeResolvedCount / resolvedCount) * 100)
        : (overdueCount > 0 ? 0 : 100);

      // Average resolution duration (hours)
      let totalResolutionHours = 0;
      let validResolvedWithTime = 0;
      resolvedList.forEach(r => {
        const hrs = getResolutionHours(r);
        if (hrs !== null) {
          totalResolutionHours += hrs;
          validResolvedWithTime++;
        }
      });
      const avgResolutionTimeHours = validResolvedWithTime > 0 
        ? (totalResolutionHours / validResolvedWithTime).toFixed(1)
        : null;

      // Rating
      const rated = myReports.filter(r => r.citizenRating);
      const avgRating = rated.length > 0 ? (rated.reduce((s, r) => s + (r.citizenRating ?? 0), 0) / rated.length).toFixed(1) : null;

      return {
        ...w,
        myReports,
        resolvedCount,
        activeCount,
        overdueCount,
        overdueReports,
        onTimeRatePct,
        avgResolutionTimeHours,
        avgRating,
      };
    }).sort((a, b) => {
      // Prioritize workers with overdue tasks so Dept Head spots them immediately
      if (b.overdueCount !== a.overdueCount) return b.overdueCount - a.overdueCount;
      return b.resolvedCount - a.resolvedCount;
    });
  }, [workers, reports]);

  const totalOverdueWorkers = enriched.filter(w => w.overdueCount > 0).length;
  const overallAvgOnTimeRate = enriched.length > 0 
    ? Math.round(enriched.reduce((acc, w) => acc + w.onTimeRatePct, 0) / enriched.length) 
    : 100;

  const isLoading = wLoading || rLoading;

  return (
    <div className="p-4 md:p-6 space-y-6 pb-12 pt-16 md:pt-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <DeptIcon dept={userDeptId} className="h-3.5 w-3.5 text-indigo-600" />
            <span>{dept} Field Operations & SLA Analytics</span>
          </p>
          <h1 className="text-2xl font-black tracking-tight">
            {isSystemAdmin || dept === 'Admin' ? 'All Municipal Field Workers Roster' : `${dept} Worker Performance Roster`}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading worker SLA metrics...' : `${enriched.length} field worker${enriched.length !== 1 ? 's' : ''} registered · ${enriched.filter(w => (w.activeTasks ?? 0) < (w.maxTaskCapacity ?? 5)).length} available for immediate assignment`}
          </p>
        </div>

        {totalOverdueWorkers > 0 && (
          <Badge className="bg-rose-500/10 text-rose-700 border-rose-300 font-bold text-xs px-3 py-1.5 flex items-center gap-2 shrink-0">
            <ShieldAlert className="h-4 w-4 text-rose-600" />
            <span>{totalOverdueWorkers} Worker(s) Have Overdue Tasks</span>
          </Badge>
        )}
      </div>

      {/* 4 Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Field Workers', value: enriched.length, icon: Users, cls: 'border-indigo-200 bg-indigo-50/60' },
          { label: 'Available for Dispatch', value: enriched.filter(w => (w.activeCount ?? 0) < (w.maxTaskCapacity ?? 5)).length, icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50/60' },
          { label: 'SLA Overdue Workers', value: totalOverdueWorkers, icon: AlertTriangle, cls: totalOverdueWorkers > 0 ? 'border-rose-300 bg-rose-50/80 animate-pulse' : 'border-slate-200 bg-slate-50/60' },
          { label: 'Dept Avg On-Time SLA', value: `${overallAvgOnTimeRate}%`, icon: Activity, cls: 'border-teal-200 bg-teal-50/60' },
        ].map(s => (
          <Card key={s.label} className={`${s.cls} shadow-sm hover:shadow-md transition-all`}>
            <CardContent className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-600">{s.label}</p>
                {isLoading ? <Skeleton className="h-7 w-12 mt-1" /> : <p className="text-2xl font-black text-slate-900 mt-1">{s.value}</p>}
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 border shadow-sm">
                <s.icon className="h-5 w-5 text-slate-800" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Workers Roster List */}
      <div className="space-y-4">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border bg-white p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
            </div>
          </div>
        ))}

        {!isLoading && enriched.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center border rounded-2xl bg-white">
            <HardHat className="h-14 w-14 text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">No field workers found in {dept}</p>
            <p className="text-sm text-muted-foreground mt-1">Contact system administration to register workers to this department.</p>
          </div>
        )}

        {!isLoading && enriched.map(w => {
          const active = w.activeCount ?? 0;
          const max = w.maxTaskCapacity ?? 5;
          const pct = Math.min(Math.round((active / max) * 100), 100);
          const isFull = active >= max;
          const hasOverdue = w.overdueCount > 0;
          const isExpanded = expandedWorkerId === w.id;

          return (
            <Card key={w.id} className={`border transition-all shadow-sm ${hasOverdue ? 'border-rose-300 bg-rose-50/20' : 'border-slate-200 bg-white'}`}>
              <CardContent className="p-5 space-y-4">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                  
                  {/* Worker Main Details */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white font-black text-lg shadow-sm">
                      {w.name.charAt(0).toUpperCase()}
                    </div>

                    <div className="space-y-1 min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 text-base">{w.name}</h3>

                        {/* Availability Badge (Icon-based, zero emojis) */}
                        <Badge className={isFull ? 'bg-rose-100 text-rose-800 border-rose-200' : 'bg-emerald-100 text-emerald-800 border-emerald-200'}>
                          {isFull ? (
                            <span className="flex items-center gap-1"><ShieldAlert className="h-3 w-3 text-rose-600" /> Maximum Capacity</span>
                          ) : (
                            <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-600" /> Available for Dispatch</span>
                          )}
                        </Badge>

                        {/* SLA Performance Tag */}
                        {hasOverdue ? (
                          <Badge variant="destructive" className="flex items-center gap-1 font-bold text-xs">
                            <AlertTriangle className="h-3 w-3" /> Overdue Tasks ({w.overdueCount})
                          </Badge>
                        ) : w.onTimeRatePct >= 90 ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 flex items-center gap-1">
                            <Award className="h-3 w-3 text-emerald-600" /> Top Performer
                          </Badge>
                        ) : (
                          <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-indigo-600" /> On Track
                          </Badge>
                        )}
                      </div>

                      <p className="text-xs text-muted-foreground">
                        {w.designation ?? w.skillType ?? 'Field Operations Worker'} · ID: {w.employeeId || w.id.slice(0, 8)} · {w.email || 'No email registered'}
                      </p>

                      {w.wardArea && (
                        <p className="text-xs text-slate-600 flex items-center gap-1 pt-0.5">
                          <MapPin className="h-3.5 w-3.5 text-indigo-500" /> Ward Jurisdiction: <strong>{w.wardArea}</strong>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Task Workload Bar */}
                  <div className="w-full md:w-56 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-600">Active Workload Capacity</span>
                      <span className="font-bold text-slate-900">{active} / {max} tasks</span>
                    </div>
                    <Progress value={pct} className={`h-2 ${isFull ? '[&>div]:bg-rose-500' : '[&>div]:bg-indigo-600'}`} />
                    <p className="text-[11px] text-muted-foreground text-right">
                      {max - active} slot{max - active !== 1 ? 's' : ''} remaining
                    </p>
                  </div>
                </div>

                {/* Overdue Warning Alert Box for Dept Head */}
                {hasOverdue && (
                  <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-300 bg-rose-100/60">
                    <div className="flex items-center gap-2 text-xs text-rose-900 font-medium">
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                      <span>
                        <strong>Action Required:</strong> Worker has <strong>{w.overdueCount} task(s)</strong> that exceeded the SLA resolution deadline.
                      </span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs font-bold border-rose-300 bg-white text-rose-700 hover:bg-rose-50 shrink-0"
                      onClick={() => setExpandedWorkerId(isExpanded ? null : w.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5 mr-1" /> : <ChevronDown className="h-3.5 w-3.5 mr-1" />}
                      {isExpanded ? 'Hide Overdue Tasks' : `Review Overdue (${w.overdueCount})`}
                    </Button>
                  </div>
                )}

                {/* Detailed Performance Metrics Bar */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs pt-1">
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-muted-foreground font-medium block">Total Resolved</span>
                    <span className="text-lg font-bold text-emerald-700 mt-0.5 block">{w.resolvedCount} tasks</span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-muted-foreground font-medium block">On-Time SLA Rate</span>
                    <span className={`text-lg font-bold mt-0.5 block ${w.onTimeRatePct >= 90 ? 'text-emerald-600' : w.onTimeRatePct >= 75 ? 'text-indigo-600' : 'text-rose-600'}`}>
                      {w.onTimeRatePct}%
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-muted-foreground font-medium block">Avg Resolution Time</span>
                    <span className="text-lg font-bold text-slate-800 mt-0.5 block">
                      {w.avgResolutionTimeHours ? `${w.avgResolutionTimeHours}h` : 'N/A'}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <span className="text-muted-foreground font-medium block">Citizen Feedback Rating</span>
                    <span className="text-lg font-bold text-amber-600 mt-0.5 flex items-center gap-1">
                      <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                      {w.avgRating ? `${w.avgRating} / 5` : 'No rating'}
                    </span>
                  </div>
                </div>

                {/* Expanded Overdue Tasks Accordion View */}
                {isExpanded && hasOverdue && (
                  <div className="pt-2 space-y-2 border-t border-rose-200">
                    <p className="text-xs font-bold text-rose-900 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                      Assigned Tasks Missed On-Time Deadline:
                    </p>
                    <div className="space-y-2">
                      {w.overdueReports.map(report => (
                        <div key={report.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-white border border-rose-200 shadow-sm">
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs text-slate-800">#{report.id.slice(0, 8)}</span>
                              <Badge className="bg-rose-100 text-rose-800 border-rose-200 text-[10px] font-bold">
                                OVERDUE SLA BREACH
                              </Badge>
                              <Badge variant="outline" className="text-[10px]">
                                Priority: {report.priority || 'Medium'}
                              </Badge>
                            </div>
                            <p className="text-xs font-semibold text-slate-900 truncate max-w-lg">
                              {report.description}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              Location: {report.location || 'N/A'} · Deadline was: {report.slaDeadline ? new Date(report.slaDeadline).toLocaleString() : 'N/A'}
                            </p>
                          </div>

                          <Button size="sm" variant="default" className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold h-8 rounded-lg shrink-0" asChild>
                            <Link href={`/dept/complaint/${report.id}`}>
                              Inspect & Reassign <ArrowRight className="ml-1 h-3.5 w-3.5" />
                            </Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
