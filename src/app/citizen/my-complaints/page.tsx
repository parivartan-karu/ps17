'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import Link from 'next/link';
import { useUser, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { Report } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Bot, FileX, PlusCircle, MapPin, Clock, Star, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDistanceToNow } from 'date-fns';

const statusColors: Record<string, string> = {
  Submitted: 'bg-blue-500',
  'Under Verification': 'bg-yellow-500',
  Assigned: 'bg-orange-500',
  'In Progress': 'bg-amber-600',
  Resolved: 'bg-green-600',
  Rejected: 'bg-red-600',
};

const progressValues: Record<string, number> = {
  Submitted: 10, 'Under Verification': 30, Assigned: 50, 'In Progress': 70, Resolved: 100, Rejected: 100,
};

const filters = ['All', 'Submitted', 'Under Verification', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];

export default function MyComplaintsPage() {
  const [filter, setFilter] = useState('All');
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    const baseQuery = query(collection(firestore, 'reports'), where('userId', '==', user.uid));
    if (filter !== 'All') return query(baseQuery, where('status', '==', filter), orderBy('timestamp', 'desc'));
    return query(baseQuery, orderBy('timestamp', 'desc'));
  }, [firestore, user?.uid, filter]);

  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);
  const isLoading = isUserLoading || areReportsLoading;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Reports</h1>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading…' : `${reports?.length ?? 0} report${reports?.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
          <Link href="/citizen/report">
            <PlusCircle className="mr-1.5 h-4 w-4" /> New Report
          </Link>
        </Button>
      </div>

      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === f
                ? 'bg-orange-500 text-white shadow-md'
                : 'bg-white border text-gray-600 hover:bg-gray-50'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Loading skeletons */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl border bg-white p-4 flex gap-3">
              <Skeleton className="h-24 w-24 rounded-xl shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-2 w-full mt-4" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!reports || reports.length === 0) && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 text-center">
          <FileX className="mb-3 h-14 w-14 text-muted-foreground/40" />
          <h3 className="text-lg font-semibold">No Reports Found</h3>
          <p className="mt-1 max-w-xs text-sm text-muted-foreground">
            {filter === 'All'
              ? "You haven't submitted any reports yet. Help improve Pune!"
              : `No reports with status "${filter}".`}
          </p>
          <Button asChild className="mt-5 bg-orange-500 hover:bg-orange-600 text-white">
            <Link href="/citizen/report"><PlusCircle className="mr-1.5 h-4 w-4" /> Report a Problem</Link>
          </Button>
        </div>
      )}

      {/* Report cards */}
      {!isLoading && reports && (
        <div className="space-y-3">
          {reports.map((report) => {
            const progress = progressValues[report.status] || 0;
            const isResolved = report.status === 'Resolved';
            const isRejected = report.status === 'Rejected';
            return (
              <Link key={report.id} href={`/citizen/complaint/${report.id}`}>
                <div className={`group rounded-2xl border bg-white shadow-sm transition-all hover:shadow-md active:scale-[0.99] overflow-hidden ${
                  isResolved ? 'border-green-200' : isRejected ? 'border-red-200' : 'border-gray-200'
                }`}>
                  <div className="flex gap-0">
                    {/* Image column */}
                    <div className="relative h-auto w-28 shrink-0">
                      <Image
                        src={report.imageUrl}
                        alt={report.description}
                        fill
                        className="object-cover"
                      />
                      <div className={`absolute inset-0 opacity-10 ${statusColors[report.status]}`} />
                    </div>

                    {/* Content */}
                    <div className="flex flex-1 flex-col p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 text-sm font-semibold leading-snug">{report.description}</p>
                        <Badge className={`shrink-0 text-[10px] text-white border-0 ${statusColors[report.status]}`}>
                          {report.status}
                        </Badge>
                      </div>

                      <div className="mt-1.5 flex flex-wrap gap-2">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />{report.location.split(',')[0]}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}
                        </span>
                        {report.citizenRating && (
                          <span className="flex items-center gap-1 text-xs text-amber-600">
                            <Star className="h-3 w-3 fill-amber-400" />{report.citizenRating}
                          </span>
                        )}
                      </div>

                      {/* Progress bar */}
                      <div className="mt-auto pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{progress}%</span>
                          {isResolved && <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />}
                        </div>
                        <Progress value={progress} className={`h-1.5 ${isResolved ? '[&>div]:bg-green-500' : isRejected ? '[&>div]:bg-red-500' : ''}`} />
                      </div>

                      {report.department && (
                        <div className="mt-2 flex items-center gap-1">
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">{report.department}</Badge>
                          {report.priority && <Badge variant="outline" className="text-[10px] px-1.5 py-0">{report.priority}</Badge>}
                          <ArrowRight className="ml-auto h-3.5 w-3.5 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
