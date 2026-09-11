'use client';

import { useMemo } from 'react';
import { differenceInHours } from 'date-fns';
import { collection } from 'firebase/firestore';
import { Award, BarChart3, CheckCircle2, Clock3, Star, TrendingUp, ThumbsUp, Zap, Target } from 'lucide-react';

import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useWorkerProfile } from '@/hooks/use-worker-profile';
import { getResolutionDate, isAssignedToWorker } from '@/lib/worker';
import type { Report } from '@/lib/types';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
  isLoading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  isLoading: boolean;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4">
        <div className={`mb-3 inline-flex rounded-xl p-2.5 ${color}`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {isLoading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <p className="text-3xl font-bold tracking-tight">{value}</p>
        )}
        <p className="mt-0.5 text-sm font-medium text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-4 w-4 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
        />
      ))}
    </div>
  );
}

function RatingBadge({ score }: { score: number }) {
  if (score >= 4.5) return <Badge className="bg-green-100 text-green-700">Excellent</Badge>;
  if (score >= 3.5) return <Badge className="bg-blue-100 text-blue-700">Good</Badge>;
  if (score >= 2.5) return <Badge className="bg-yellow-100 text-yellow-700">Average</Badge>;
  return <Badge className="bg-red-100 text-red-700">Needs Improvement</Badge>;
}

export default function WorkerPerformancePage() {
  const firestore = useFirestore();
  const { workerId, workerName, isLoading: isWorkerLoading } = useWorkerProfile();

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);

  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);

  const performance = useMemo(() => {
    const assigned = (reports || []).filter((r) => isAssignedToWorker(r, workerId, workerName));
    const resolved = assigned.filter((r) => r.status === 'Resolved');
    const closed = assigned.filter((r) => r.status === 'Resolved' || r.status === 'Rejected');
    const selfAssigned = assigned.filter((r) => r.selfAssigned);
    const rated = resolved.filter((r) => !!r.citizenRating);

    const avgHours =
      resolved.length > 0
        ? (
            resolved.reduce((total, r) => {
              const completedAt =
                r.completedAt || r.actionLog?.find((l) => l.status === 'Resolved')?.timestamp;
              if (!completedAt) return total;
              return total + differenceInHours(new Date(completedAt), new Date(r.timestamp));
            }, 0) / resolved.length
          ).toFixed(1)
        : '0.0';

    const avgRating =
      rated.length > 0
        ? (rated.reduce((sum, r) => sum + (r.citizenRating || 0), 0) / rated.length).toFixed(1)
        : null;

    // Rating distribution
    const ratingDist = [1, 2, 3, 4, 5].map((star) => ({
      star,
      count: rated.filter((r) => r.citizenRating === star).length,
    }));

    // Recent resolved tasks (with ratings)
    const recent = closed
      .sort(
        (a, b) =>
          new Date(b.completedAt || b.timestamp).getTime() -
          new Date(a.completedAt || a.timestamp).getTime()
      )
      .slice(0, 8);

    return {
      totalAssigned: assigned.length,
      resolved: resolved.length,
      selfAssigned: selfAssigned.length,
      acceptanceRate: assigned.length
        ? Math.round((closed.length / assigned.length) * 100)
        : 0,
      avgHours,
      avgRating,
      ratingCount: rated.length,
      ratingDist,
      recent,
    };
  }, [reports, workerId, workerName]);

  const isLoading = isWorkerLoading || areReportsLoading;

  return (
    <div className="space-y-5 pb-6">
      {/* Hero */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-6 text-white shadow-xl">
        <p className="text-sm font-medium text-white/70">Performance Report</p>
        <h1 className="mt-1 text-2xl font-bold">{isLoading ? '…' : workerName || 'Your'} Stats</h1>
        <p className="mt-1 text-sm text-white/70">Updated in real-time from your task history</p>
        {!isLoading && performance.avgRating && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/15 px-4 py-3 backdrop-blur-sm">
            <Star className="h-6 w-6 fill-amber-300 text-amber-300" />
            <div>
              <p className="text-lg font-bold">{performance.avgRating} / 5</p>
              <p className="text-xs text-white/75">Average citizen rating ({performance.ratingCount} reviews)</p>
            </div>
            <div className="ml-auto">
              <RatingBadge score={Number(performance.avgRating)} />
            </div>
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={CheckCircle2} label="Resolved" value={performance.resolved} color="bg-green-500" isLoading={isLoading} />
        <StatCard icon={Clock3} label="Avg Hours" value={performance.avgHours + 'h'} sub="per task" color="bg-blue-500" isLoading={isLoading} />
        <StatCard icon={Target} label="Acceptance Rate" value={performance.acceptanceRate + '%'} color="bg-purple-500" isLoading={isLoading} />
        <StatCard icon={Zap} label="Self-Assigned" value={performance.selfAssigned} sub="picked up voluntarily" color="bg-amber-500" isLoading={isLoading} />
      </div>

      {/* Rating breakdown */}
      {!isLoading && performance.ratingCount > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Star className="h-4 w-4 text-amber-400" /> Citizen Ratings
            </CardTitle>
            <CardDescription>
              {performance.ratingCount} rating{performance.ratingCount !== 1 ? 's' : ''} · Average {performance.avgRating} ★
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {[...performance.ratingDist].reverse().map(({ star, count }) => {
              const pct = performance.ratingCount > 0 ? Math.round((count / performance.ratingCount) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-3">
                  <span className="w-6 text-xs text-muted-foreground">{star}★</span>
                  <Progress value={pct} className="flex-1 h-2" />
                  <span className="w-6 text-xs text-right text-muted-foreground">{count}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recent history */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent History</CardTitle>
          <CardDescription>Your last 8 closed tasks</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading &&
            [1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border p-3 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            ))}
          {!isLoading && performance.recent.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">No completed tasks yet</p>
          )}
          {!isLoading &&
            performance.recent.map((task) => {
              const isResolved = task.status === 'Resolved';
              const resDate = getResolutionDate(task);
              return (
                <div
                  key={task.id}
                  className={`rounded-xl border p-3 ${isResolved ? 'bg-green-50' : 'bg-red-50'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-medium">{task.description}</p>
                    <Badge
                      className={isResolved ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                    >
                      {task.status}
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">{resDate}</p>
                    {task.citizenRating ? (
                      <div className="flex items-center gap-1">
                        <StarDisplay rating={task.citizenRating} />
                        {task.citizenFeedback && (
                          <span className="text-xs text-muted-foreground italic">
                            "{task.citizenFeedback.slice(0, 30)}{task.citizenFeedback.length > 30 ? '…' : ''}"
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Not rated</span>
                    )}
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>
    </div>
  );
}
