'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { collection, query, where } from 'firebase/firestore';
import {
  AlertTriangle, CheckCircle2, Clock3, ArrowRight, Flame,
  ClipboardList, Users, TrendingUp, Building2, Zap
} from 'lucide-react';
import { useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { doc } from 'firebase/firestore';
import type { Report, User as UserType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { formatDistanceToNow } from 'date-fns';

const statusColor: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Verification': 'bg-yellow-100 text-yellow-700',
  Assigned: 'bg-orange-100 text-orange-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const priorityDot: Record<string, string> = {
  Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-500', Low: 'bg-green-500'
};

export default function DeptDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile } = useDoc<UserType>(profileRef);
  const dept = profile?.department ?? '';

  const complaintsQuery = useMemoFirebase(() => {
    if (!firestore || !dept) return null;
    return query(collection(firestore, 'reports'), where('department', '==', dept));
  }, [firestore, dept]);
  const { data: reports, isLoading } = useCollection<Report>(complaintsQuery);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore || !dept) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'), where('department', '==', dept));
  }, [firestore, dept]);
  const { data: workers } = useCollection<UserType>(workersQuery);

  const stats = useMemo(() => {
    if (!reports) return null;
    const total = reports.length;
    const pending = reports.filter(r => ['Submitted', 'Under Verification'].includes(r.status)).length;
    const inProgress = reports.filter(r => ['Assigned', 'In Progress'].includes(r.status)).length;
    const resolved = reports.filter(r => r.status === 'Resolved').length;
    const critical = reports.filter(r => r.priority === 'Critical' && r.status !== 'Resolved').length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;
    return { total, pending, inProgress, resolved, critical, resolutionRate };
  }, [reports]);

  const recentPending = useMemo(() => {
    return (reports ?? [])
      .filter(r => !['Resolved', 'Rejected'].includes(r.status))
      .sort((a, b) => {
        const po = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return (po[a.priority ?? 'Low'] ?? 3) - (po[b.priority ?? 'Low'] ?? 3);
      })
      .slice(0, 5);
  }, [reports]);

  const availableWorkers = (workers ?? []).filter(w => (w.activeTasks ?? 0) < (w.maxTaskCapacity ?? 5));

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 space-y-5 pb-8 pt-16 md:pt-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 p-6 text-white shadow-xl">
        <div className="flex items-center gap-3 mb-2">
          <Building2 className="h-7 w-7" />
          <div>
            <h1 className="text-xl font-bold">{dept || 'Department'} Portal</h1>
            <p className="text-sm text-white/70">Welcome, {profile?.name ?? 'Officer'}</p>
          </div>
        </div>
        {stats && (
          <div className="mt-4 rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm space-y-2">
            <div className="flex justify-between text-xs text-white/80">
              <span>Resolution rate</span>
              <span className="font-bold">{stats.resolutionRate}%</span>
            </div>
            <Progress value={stats.resolutionRate} className="h-2 bg-white/20 [&>div]:bg-white" />
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats?.total, icon: ClipboardList, color: 'bg-indigo-500', loading: isLoading },
          { label: 'Pending', value: stats?.pending, icon: Clock3, color: 'bg-yellow-500', loading: isLoading },
          { label: 'In Progress', value: stats?.inProgress, icon: Flame, color: 'bg-orange-500', loading: isLoading },
          { label: 'Resolved', value: stats?.resolved, icon: CheckCircle2, color: 'bg-green-500', loading: isLoading },
        ].map(s => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${s.color} mb-2`}>
                <s.icon className="h-5 w-5 text-white" />
              </div>
              {s.loading ? <Skeleton className="h-8 w-12 mb-1" /> : (
                <p className="text-2xl font-bold">{s.value ?? 0}</p>
              )}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Critical alert */}
      {!isLoading && (stats?.critical ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-700">{stats!.critical} Critical complaint{stats!.critical > 1 ? 's' : ''} unresolved</p>
            <p className="text-xs text-red-600">These need immediate attention.</p>
          </div>
          <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-100" asChild>
            <Link href="/dept/complaints?priority=Critical">View</Link>
          </Button>
        </div>
      )}

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/dept/complaints">
          <Card className="border-0 bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-md hover:shadow-lg transition-all active:scale-95">
            <CardContent className="p-4">
              <ClipboardList className="mb-2 h-6 w-6" />
              <p className="text-sm font-semibold">All Complaints</p>
              <p className="text-xs text-white/75">Assign, update, resolve</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dept/workers">
          <Card className="border-0 bg-gradient-to-br from-purple-500 to-violet-600 text-white shadow-md hover:shadow-lg transition-all active:scale-95">
            <CardContent className="p-4">
              <Users className="mb-2 h-6 w-6" />
              <p className="text-sm font-semibold">Workers</p>
              <p className="text-xs text-white/75">{availableWorkers.length} available now</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Pending complaints */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Priority Queue</CardTitle>
            <CardDescription className="text-xs">Highest priority unresolved complaints</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dept/complaints">All <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && [1,2,3].map(i => (
            <div key={i} className="rounded-xl border p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" />
            </div>
          ))}
          {!isLoading && recentPending.length === 0 && (
            <div className="flex flex-col items-center py-8">
              <CheckCircle2 className="h-10 w-10 text-green-400 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">All caught up!</p>
            </div>
          )}
          {!isLoading && recentPending.map(r => (
            <Link key={r.id} href={`/dept/complaint/${r.id}`}>
              <div className="flex items-center gap-3 rounded-xl border p-3 hover:shadow-sm transition-all active:scale-[0.99]">
                <div className={`h-2 w-2 shrink-0 rounded-full ${priorityDot[r.priority ?? 'Low']}`} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium">{r.description}</p>
                  <p className="text-xs text-muted-foreground">{r.location.split(',')[0]} · {formatDistanceToNow(new Date(r.timestamp), { addSuffix: true })}</p>
                </div>
                <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${statusColor[r.status]}`}>{r.status}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Workers overview */}
      {(workers ?? []).length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Your Workers</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dept/workers">All <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(workers ?? []).slice(0, 4).map(w => {
              const active = w.activeTasks ?? 0;
              const max = w.maxTaskCapacity ?? 5;
              const pct = Math.round((active / max) * 100);
              return (
                <div key={w.id} className="flex items-center gap-3 rounded-xl bg-gray-50 p-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold text-sm shrink-0">
                    {w.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{w.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Progress value={pct} className="h-1.5 flex-1" />
                      <span className="text-xs text-muted-foreground">{active}/{max}</span>
                    </div>
                  </div>
                  <Badge className={active < max ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {active < max ? 'Available' : 'Full'}
                  </Badge>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
