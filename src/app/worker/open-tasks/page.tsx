'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { collection } from 'firebase/firestore';
import { ArrowRight, Loader2, MapPin, Clock, HardHat, Sparkles } from 'lucide-react';

import { useAuth, useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useWorkerProfile } from '@/hooks/use-worker-profile';
import { isOpenLowPriorityTask } from '@/lib/worker';
import type { Report } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { buildAuthHeaders } from '@/lib/client-auth';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDistanceToNow } from 'date-fns';

export default function WorkerOpenTasksPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { workerId, workerName, isLoading: isWorkerLoading } = useWorkerProfile();
  const { toast } = useToast();
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);

  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);

  const openTasks = useMemo(() => {
    return (reports || [])
      .filter(isOpenLowPriorityTask)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reports]);

  const isLoading = isWorkerLoading || areReportsLoading;

  async function handleAcceptTask(taskId: string) {
    if (!auth || !workerId) return;
    setActiveTaskId(taskId);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const res = await fetch(`/api/worker/tasks/${taskId}/accept`, {
        method: 'POST',
        headers,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to accept task');
      }
      toast({ title: '✅ Task accepted!', description: 'Head to My Tasks to upload before-work proof.' });
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Could not accept task', description: error.message || 'Please try again.' });
    } finally {
      setActiveTaskId(null);
    }
  }

  return (
    <div className="space-y-5 pb-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-sky-500 to-cyan-600 p-6 text-white shadow-xl">
         <p className="text-sm font-medium text-white/75">Self-Assignment Queue</p>
        <h1 className="mt-1 text-2xl font-bold">Open Tasks</h1>
        <p className="mt-1 text-sm text-white/80">
          {isLoading ? 'Loading…' : `${openTasks.length} low/medium priority task${openTasks.length !== 1 ? 's' : ''} available`}
        </p>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
        <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" />
        <p className="text-sm text-sky-700">
          These are low and medium priority tasks not yet assigned to anyone. Accept one to make it yours — first come, first served.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <div className="flex gap-2">
                <Skeleton className="h-9 w-28" />
                <Skeleton className="h-9 w-24" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && openTasks.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 text-center">
          <HardHat className="mb-3 h-14 w-14 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">All caught up!</h3>
          <p className="mt-1 text-sm text-muted-foreground">No open low or medium priority tasks right now. Check back later.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/worker/task">View My Tasks</Link>
          </Button>
        </div>
      )}

      {/* Task cards */}
      {!isLoading && openTasks.map((task) => (
        <div key={task.id} className="rounded-2xl border border-sky-100 bg-white shadow-sm transition-all hover:shadow-md">
          <div className="p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <p className="font-semibold leading-snug line-clamp-2">{task.description}</p>
              <Badge variant="outline" className={`shrink-0 ${
                task.priority === 'Medium'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                {task.priority || 'Medium'}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />{task.location.split(',')[0]}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDistanceToNow(new Date(task.timestamp), { addSuffix: true })}
              </span>
              {task.department && <span>📁 {task.department}</span>}
              {task.estimatedResolutionTime && <span>⏱ ETA: {task.estimatedResolutionTime}</span>}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleAcceptTask(task.id)}
                disabled={activeTaskId === task.id}
                size="sm"
                className="bg-sky-500 hover:bg-sky-600 text-white"
              >
                {activeTaskId === task.id ? (
                  <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />Accepting…</>
                ) : (
                  <><Sparkles className="mr-1.5 h-3.5 w-3.5" />Accept Task</>
                )}
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href={`/worker/task/${task.id}`}>
                  Details <ArrowRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
