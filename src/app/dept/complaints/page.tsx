'use client';

import { useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { collection, query, where, doc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';
import { Search, MapPin, Clock, AlertTriangle, Filter, ArrowRight, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

import { useAuth, useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { buildAuthHeaders } from '@/lib/client-auth';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-700 border-blue-200',
  'Under Verification': 'bg-yellow-100 text-yellow-700 border-yellow-200',
  Assigned: 'bg-orange-100 text-orange-700 border-orange-200',
  'In Progress': 'bg-amber-100 text-amber-700 border-amber-200',
  Resolved: 'bg-green-100 text-green-700 border-green-200',
  Rejected: 'bg-red-100 text-red-700 border-red-200',
};
const priorityBg: Record<string, string> = {
  Critical: 'bg-red-500', High: 'bg-orange-500', Medium: 'bg-yellow-500', Low: 'bg-green-500'
};

const STATUS_FILTERS = ['All', 'Submitted', 'Under Verification', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const PRIORITY_FILTERS = ['All', 'Critical', 'High', 'Medium', 'Low'];

function DeptComplaintsContent() {
  const searchParams = useSearchParams();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? 'All');
  const [priorityFilter, setPriorityFilter] = useState(searchParams.get('priority') ?? 'All');
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<string | null>(null);

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

  const filtered = useMemo(() => {
    return (reports ?? [])
      .filter(r => statusFilter === 'All' || r.status === statusFilter)
      .filter(r => priorityFilter === 'All' || r.priority === priorityFilter)
      .filter(r => !search || r.description.toLowerCase().includes(search.toLowerCase()) || r.location.toLowerCase().includes(search.toLowerCase()))
      .sort((a, b) => {
        const po = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        const pDiff = (po[a.priority ?? 'Low'] ?? 3) - (po[b.priority ?? 'Low'] ?? 3);
        if (pDiff !== 0) return pDiff;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      });
  }, [reports, statusFilter, priorityFilter, search]);

  async function assignWorker(reportId: string, workerId: string, workerName: string) {
    setAssigningId(reportId);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const res = await fetch(`/api/dept/complaints/${reportId}/assign`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ workerId, workerName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Assignment failed');
      toast({ title: '✅ Worker assigned', description: `${workerName} assigned to complaint.` });
    } catch (e: any) {
      toast({ title: 'Failed to assign', description: e.message, variant: 'destructive' });
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-4 pb-8 pt-16 md:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">{dept} Complaints</h1>
          <p className="text-sm text-muted-foreground">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search complaints…" className="pl-9 h-10 rounded-xl" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* Status filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_FILTERS.map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${statusFilter === f ? 'bg-indigo-600 text-white shadow' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Priority filters */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {PRIORITY_FILTERS.map(f => (
          <button key={f} onClick={() => setPriorityFilter(f)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${priorityFilter === f ? 'bg-purple-600 text-white shadow' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && [1,2,3].map(i => (
        <div key={i} className="rounded-2xl border bg-white p-4 space-y-2">
          <Skeleton className="h-4 w-3/4" /><Skeleton className="h-3 w-1/2" />
        </div>
      ))}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="flex flex-col items-center py-16 text-center">
          <CheckCircle2 className="h-14 w-14 text-green-300 mb-3" />
          <p className="font-semibold text-muted-foreground">No complaints match your filters</p>
        </div>
      )}

      {/* Complaints */}
      {!isLoading && filtered.map(r => {
        const availableW = (workers ?? []).filter(w => (w.activeTasks ?? 0) < (w.maxTaskCapacity ?? 5));
        const isAssigning = assigningId === r.id;
        const isUnassigned = !r.assignedWorkerId && !['Resolved', 'Rejected'].includes(r.status);

        return (
          <div key={r.id} className="rounded-2xl border bg-white shadow-sm overflow-hidden">
            {/* Priority stripe */}
            <div className={`h-1 ${priorityBg[r.priority ?? 'Low']}`} />
            <div className="p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <Link href={`/dept/complaint/${r.id}`} className="flex-1">
                  <p className="text-sm font-semibold line-clamp-2 hover:text-indigo-600 transition-colors">{r.description}</p>
                </Link>
                <span className={`shrink-0 text-xs rounded-full border px-2 py-0.5 font-medium ${statusColors[r.status]}`}>{r.status}</span>
              </div>

              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-3">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{r.location.split(',')[0]}</span>
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(r.timestamp), { addSuffix: true })}</span>
                {r.priority && <span className="flex items-center gap-1 font-medium text-gray-700">⚡ {r.priority}</span>}
                {r.assignedContractor && <span className="text-indigo-600 font-medium">👷 {r.assignedContractor}</span>}
              </div>

              {/* Assign worker inline if unassigned */}
              {isUnassigned && availableW.length > 0 && (
                <div className="mt-2 rounded-xl bg-indigo-50 p-3">
                  <p className="text-xs font-medium text-indigo-700 mb-2">⚡ Assign a worker</p>
                  <div className="flex flex-wrap gap-2">
                    {availableW.slice(0, 4).map(w => (
                      <button
                        key={w.id}
                        onClick={() => assignWorker(r.id, w.id, w.name)}
                        disabled={isAssigning}
                        className="flex items-center gap-1.5 rounded-lg bg-white border border-indigo-200 px-2.5 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                      >
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 text-[10px] font-bold">
                          {w.name.charAt(0)}
                        </span>
                        {w.name.split(' ')[0]}
                        {w.activeTasks !== undefined && <span className="text-indigo-400">({w.activeTasks}/{w.maxTaskCapacity ?? 5})</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {isUnassigned && availableW.length === 0 && (
                <div className="mt-2 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                  <p className="text-xs text-red-600">No available workers — all at capacity</p>
                </div>
              )}

              <div className="mt-3 flex justify-end">
                <Button variant="ghost" size="sm" asChild className="text-xs text-indigo-600 hover:bg-indigo-50">
                  <Link href={`/dept/complaint/${r.id}`}>Details <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function DeptComplaintsPage() {
  return (
    <Suspense fallback={
      <div className="p-4 md:p-6 space-y-4 pb-8 pt-16 md:pt-6">
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="flex gap-2 overflow-x-auto pb-1">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-8 w-20 shrink-0 rounded-full" />)}
        </div>
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-2xl border bg-white p-4 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    }>
      <DeptComplaintsContent />
    </Suspense>
  );
}
