'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CalendarCheck2, CheckCircle2, ClipboardList, ArrowRight,
  Flame, Star, Clock, AlertTriangle, TrendingUp, HardHat, MapPin, Bell,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useWorkerProfile } from '@/hooks/use-worker-profile';
import { isAssignedToWorker } from '@/lib/worker';
import type { Report } from '@/lib/types';
import { collection } from 'firebase/firestore';
import { differenceInHours, formatDistanceToNow } from 'date-fns';

type WorkerHomeSummary = {
  completedTasks: number;
  presentDays: number;
  holidaysTaken: number;
};

const priorityConfig: Record<string, { color: string; dot: string }> = {
  Critical: { color: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  High:     { color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  Medium:   { color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  Low:      { color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
};

const statusConfig: Record<string, string> = {
  Assigned:    'bg-orange-100 text-orange-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved:    'bg-green-100 text-green-700',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function WorkerDashboardPage() {
  const [summary, setSummary] = useState<WorkerHomeSummary | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const firestore = useFirestore();
  const { workerId, workerName, isLoading: isWorkerLoading } = useWorkerProfile();

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);

  const { data: reports, isLoading: reportsLoading } = useCollection<Report>(reportsQuery);

  const activeTasks = (reports ?? [])
    .filter((r) => isAssignedToWorker(r, workerId, workerName))
    .filter((r) => r.status === 'Assigned' || r.status === 'In Progress')
    .sort((a, b) => {
      const ord = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return (ord[a.priority ?? 'Low'] ?? 3) - (ord[b.priority ?? 'Low'] ?? 3);
    });

  const recentlyDone = (reports ?? [])
    .filter((r) => isAssignedToWorker(r, workerId, workerName) && r.status === 'Resolved')
    .sort((a, b) => new Date(b.completedAt || b.timestamp).getTime() - new Date(a.completedAt || a.timestamp).getTime())
    .slice(0, 3);

  const pendingUpload = activeTasks.filter((r) => r.status === 'Assigned' && !r.beforeWorkMediaUrl);

  useEffect(() => {
    let mounted = true;
    fetch('/api/worker/dashboard-summary', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => { if (mounted) setSummary({ completedTasks: data.completedTasks ?? 0, presentDays: data.presentDays ?? 0, holidaysTaken: data.holidaysTaken ?? 0 }); })
      .catch(() => { if (mounted) setSummary({ completedTasks: 0, presentDays: 0, holidaysTaken: 0 }); })
      .finally(() => { if (mounted) setIsLoadingSummary(false); });
    return () => { mounted = false; };
  }, []);

  const isLoading = isWorkerLoading || reportsLoading || isLoadingSummary;

  return (
    <div className="space-y-5 pb-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 p-6 text-white shadow-xl">
        <p className="text-sm font-medium text-white/80">{getGreeting()},</p>
        {isWorkerLoading ? <Skeleton className="mt-1 h-8 w-48 bg-white/30" /> : (
          <h1 className="mt-1 text-2xl font-bold">{workerName || 'Worker'} 👷</h1>
        )}
        <p className="mt-1 text-sm text-white/80">
          {isLoading ? 'Loading…' : `${activeTasks.length} active · ${pendingUpload.length} need before-photo`}
        </p>
        {!isLoadingSummary && summary && (
          <div className="mt-4 rounded-xl bg-white/20 px-4 py-3 backdrop-blur-sm">
            <div className="flex justify-between text-xs text-white/80">
              <span>Attendance this month</span>
              <span className="font-semibold">{summary.presentDays} / 30 days</span>
            </div>
            <Progress value={(summary.presentDays / 30) * 100} className="mt-2 h-1.5 bg-white/30 [&>div]:bg-white" />
          </div>
        )}
      </div>

      {/* Upload alert */}
      {!isLoading && pendingUpload.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
          <div className="flex-1 text-sm">
            <p className="font-semibold text-orange-700">{pendingUpload.length} task{pendingUpload.length > 1 ? 's' : ''} need a before-photo</p>
            <p className="text-xs text-orange-600">Upload before starting work to proceed.</p>
          </div>
          <Button size="sm" variant="ghost" className="text-orange-600 hover:bg-orange-100" asChild>
            <Link href="/worker/task">View</Link>
          </Button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Completed', value: summary?.completedTasks, icon: CheckCircle2, iconColor: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Present Days', value: summary?.presentDays, icon: CalendarCheck2, iconColor: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active', value: activeTasks.length, icon: Flame, iconColor: 'text-orange-600', bg: 'bg-orange-50' },
        ].map((s) => (
          <Card key={s.label} className="border-0 shadow-sm">
            <CardContent className="p-3">
              <div className={`inline-flex rounded-lg p-1.5 ${s.bg}`}>
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              {isLoading ? <Skeleton className="mt-2 h-7 w-10" /> : <p className="mt-2 text-2xl font-bold">{s.value ?? 0}</p>}
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { href: '/worker/task', icon: ClipboardList, label: 'My Tasks', sub: 'View & update assigned work', from: 'from-green-500', to: 'to-teal-600' },
          { href: '/worker/open-tasks', icon: HardHat, label: 'Open Tasks', sub: 'Pick up low-priority work', from: 'from-purple-500', to: 'to-indigo-600' },
          { href: '/worker/performance', icon: TrendingUp, label: 'Performance', sub: 'Your stats & ratings', from: 'from-blue-500', to: 'to-blue-600' },
          { href: '/worker/notifications', icon: Bell, label: 'Notifications', sub: 'PMC updates & alerts', from: 'from-amber-500', to: 'to-orange-500' },
        ].map((a) => (
          <Link key={a.href} href={a.href}>
            <Card className={`border-0 bg-gradient-to-br ${a.from} ${a.to} text-white shadow-md hover:shadow-lg transition-all active:scale-95`}>
              <CardContent className="p-4">
                <a.icon className="mb-2 h-6 w-6" />
                <p className="text-sm font-semibold">{a.label}</p>
                <p className="text-xs text-white/75">{a.sub}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Active Tasks */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Active Tasks</CardTitle>
            <CardDescription className="text-xs">Tap to update status or upload proof</CardDescription>
          </div>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/worker/task">All <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLoading && [1, 2].map((i) => (
            <div key={i} className="rounded-xl border p-3 space-y-2">
              <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" />
            </div>
          ))}
          {!isLoading && activeTasks.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 text-center">
              <HardHat className="mb-2 h-10 w-10 text-muted-foreground/50" />
              <p className="text-sm font-medium text-muted-foreground">No active tasks</p>
              <p className="mt-1 text-xs text-muted-foreground">Browse open tasks to pick up work</p>
              <Button size="sm" variant="outline" className="mt-3" asChild>
                <Link href="/worker/open-tasks">Browse Open Tasks <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </div>
          )}
          {!isLoading && activeTasks.slice(0, 4).map((task) => {
            const pCfg = priorityConfig[task.priority ?? 'Low'];
            const sCfg = statusConfig[task.status] ?? 'bg-gray-100 text-gray-700';
            const isOld = differenceInHours(new Date(), new Date(task.timestamp)) > 48;
            return (
              <Link key={task.id} href={`/worker/task/${task.id}`}>
                <div className={`rounded-xl border p-3 transition-all hover:shadow-sm active:scale-[0.99] ${isOld ? 'border-orange-200 bg-orange-50/40' : 'bg-white'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 text-sm font-medium">{task.description}</p>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${pCfg.color}`}>{task.priority ?? 'Low'}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{task.location}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sCfg}`}>{task.status}</span>
                    {isOld && <span className="flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700"><Clock className="h-3 w-3" />Overdue</span>}
                    {task.status === 'Assigned' && !task.beforeWorkMediaUrl && (
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">📸 Before photo needed</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      {/* Recently Completed */}
      {recentlyDone.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div>
              <CardTitle className="text-base">Recently Completed</CardTitle>
              <CardDescription className="text-xs">Your last resolved tasks</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/worker/history">All <ArrowRight className="ml-1 h-3 w-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentlyDone.map((task) => (
              <Link key={task.id} href={`/worker/task/${task.id}`}>
                <div className="flex items-center gap-3 rounded-xl bg-green-50 p-3 hover:bg-green-100 transition-colors">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500">
                    <CheckCircle2 className="h-4 w-4 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">{task.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(task.completedAt || task.timestamp), { addSuffix: true })}
                    </p>
                  </div>
                  {task.citizenRating && (
                    <div className="flex items-center gap-0.5 text-xs text-amber-600">
                      <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />{task.citizenRating}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
