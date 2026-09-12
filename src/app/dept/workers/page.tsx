'use client';

import { useMemo } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import { CheckCircle2, Clock3, Flame, Users, HardHat, Star } from 'lucide-react';

import { useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';

import { normalizeDepartment, normalizeDepartmentId, isReportInDepartment } from '@/lib/departments';
import { DeptIcon } from '@/components/dept-icon';

export default function DeptWorkersPage() {
  const firestore = useFirestore();
  const { user } = useUser();

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
    return (workers ?? []).map(w => {
      const myReports = (reports ?? []).filter(r => r.assignedWorkerId === w.id || r.assignedContractor === w.name);
      const resolved = myReports.filter(r => r.status === 'Resolved').length;
      const active = myReports.filter(r => ['Assigned', 'In Progress'].includes(r.status)).length;
      const rated = myReports.filter(r => r.citizenRating);
      const avgRating = rated.length > 0 ? (rated.reduce((s, r) => s + (r.citizenRating ?? 0), 0) / rated.length).toFixed(1) : null;
      return { ...w, resolvedCount: resolved, activeCount: active, avgRating };
    }).sort((a, b) => b.resolvedCount - a.resolvedCount);
  }, [workers, reports]);

  const isLoading = wLoading || rLoading;

  return (
    <div className="p-4 md:p-6 space-y-5 pb-8 pt-16 md:pt-6">
      {/* Header Banner (SMC Admin Dashboard Style) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
            <DeptIcon dept={userDeptId} className="h-3.5 w-3.5 text-indigo-600" />
            <span>{dept} Field Operations</span>
          </p>
          <h1 className="text-2xl font-black tracking-tight">{isSystemAdmin || dept === 'Admin' ? 'All Municipal Field Workers' : `${dept} Field Workers Roster`}</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading worker allocations...' : `${enriched.length} worker${enriched.length !== 1 ? 's' : ''} registered · ${enriched.filter(w => (w.activeTasks ?? 0) < (w.maxTaskCapacity ?? 5)).length} available for immediate dispatch`}
          </p>
        </div>
      </div>

      {/* Stats Cards (SMC Admin Card Style) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total Workers', value: enriched.length, icon: Users, cls: 'border-indigo-200 bg-indigo-50/60' },
          { label: 'Available for Dispatch', value: enriched.filter(w => (w.activeCount ?? 0) < (w.maxTaskCapacity ?? 5)).length, icon: CheckCircle2, cls: 'border-emerald-200 bg-emerald-50/60' },
          { label: 'At Maximum Capacity', value: enriched.filter(w => (w.activeCount ?? 0) >= (w.maxTaskCapacity ?? 5)).length, icon: Flame, cls: 'border-rose-200 bg-rose-50/60' },
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

      {/* Workers list */}
      <div className="space-y-3">
        {isLoading && [1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border bg-white p-4 space-y-3">
            <div className="flex items-center gap-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-20" /></div>
            </div>
          </div>
        ))}

        {!isLoading && enriched.length === 0 && (
          <div className="flex flex-col items-center py-16 text-center">
            <HardHat className="h-14 w-14 text-muted-foreground/30 mb-3" />
            <p className="font-semibold text-muted-foreground">No workers in {dept}</p>
            <p className="text-sm text-muted-foreground mt-1">Ask admin to assign workers to this department.</p>
          </div>
        )}

        {!isLoading && enriched.map(w => {
          const active = w.activeCount ?? 0;
          const max = w.maxTaskCapacity ?? 5;
          const pct = Math.min(Math.round((active / max) * 100), 100);
          const isFull = active >= max;

          return (
            <Card key={w.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-white font-bold text-lg shadow">
                    {w.name.charAt(0).toUpperCase()}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold">{w.name}</p>
                      <Badge className={isFull ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}>
                        {isFull ? '🔴 Full' : '🟢 Available'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {w.designation ?? w.skillType ?? 'Worker'} · {w.employeeId ? `ID: ${w.employeeId}` : w.email}
                    </p>

                    {/* Task load bar */}
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Task load</span>
                        <span className="font-medium">{active} / {max}</span>
                      </div>
                      <Progress value={pct} className={`h-2 ${isFull ? '[&>div]:bg-red-500' : '[&>div]:bg-indigo-500'}`} />
                    </div>

                    {/* Stats row */}
                    <div className="mt-3 flex flex-wrap gap-4 text-xs">
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>{w.resolvedCount} resolved</span>
                      </div>
                      <div className="flex items-center gap-1 text-orange-600">
                        <Flame className="h-3.5 w-3.5" />
                        <span>{active} active</span>
                      </div>
                      {w.avgRating && (
                        <div className="flex items-center gap-1 text-amber-600">
                          <Star className="h-3.5 w-3.5 fill-amber-400" />
                          <span>{w.avgRating} rating</span>
                        </div>
                      )}
                    </div>

                    {w.wardArea && (
                      <p className="text-xs text-muted-foreground mt-1">📍 Ward: {w.wardArea}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
