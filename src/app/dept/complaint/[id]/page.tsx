'use client';

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { doc, collection, query, where } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft, MapPin, Clock, User, CheckCircle2, Bot, Shield,
  Loader2, AlertTriangle, Zap
} from 'lucide-react';

import { useAuth, useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType, ReportStatus } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { buildAuthHeaders } from '@/lib/client-auth';
import { AgentPipelineVisualization } from '@/components/agent-pipeline-visualization';
import { SmartWorkerSelector } from '@/components/smart-worker-selector';
import { IncidentConsolidationBanner } from '@/components/incident-consolidation-banner';
import { DepartmentVerificationPanel } from '@/components/department-verification-panel';
import { ExplainableAiCard } from '@/components/explainable-ai-card';
import { useToast } from '@/hooks/use-toast';

const NEXT_STATUSES: Partial<Record<ReportStatus, ReportStatus[]>> = {
  Submitted: ['Under Verification', 'Rejected'],
  'Under Verification': ['Assigned', 'Rejected'],
  Assigned: ['In Progress', 'Rejected'],
  'In Progress': ['Under Verification', 'Rejected'],
};

const statusColors: Record<string, string> = {
  Submitted: 'bg-blue-100 text-blue-700',
  'Under Verification': 'bg-yellow-100 text-yellow-700',
  Assigned: 'bg-orange-100 text-orange-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Resolved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
};

const actorIcons: Record<string, React.ReactNode> = {
  Citizen: <User className="h-4 w-4 text-blue-500" />,
  Official: <Shield className="h-4 w-4 text-purple-500" />,
  System: <Bot className="h-4 w-4 text-gray-400" />,
  Worker: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

export default function DeptComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const auth = useAuth();
  const { user } = useUser();
  const { toast } = useToast();

  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedWorkerId, setSelectedWorkerId] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const reportRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'reports', params.id);
  }, [firestore, params.id]);
  const { data: report, isLoading } = useDoc<Report>(reportRef);

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile } = useDoc<UserType>(profileRef);
  const dept = profile?.department ?? '';

  const workersQuery = useMemoFirebase(() => {
    if (!firestore || !dept) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'), where('department', '==', dept));
  }, [firestore, dept]);
  const { data: workers } = useCollection<UserType>(workersQuery);

  const availableWorkers = useMemo(() => (workers ?? []).filter(w => (w.activeTasks ?? 0) < (w.maxTaskCapacity ?? 5)), [workers]);
  const nextStatuses = NEXT_STATUSES[report?.status as ReportStatus] ?? [];

  async function handleSubmit() {
    if (!selectedStatus && !selectedWorkerId) {
      toast({ title: 'Nothing to update', description: 'Select a status change or assign a worker.', variant: 'destructive' });
      return;
    }
    setIsSubmitting(true);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });

      if (selectedWorkerId) {
        const worker = workers?.find(w => w.id === selectedWorkerId);
        const res = await fetch(`/api/dept/complaints/${params.id}/assign`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ workerId: selectedWorkerId, workerName: worker?.name }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast({ title: '👷 Worker assigned' });
      }

      if (selectedStatus) {
        const res = await fetch(`/api/smc/complaints/${params.id}/resolve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ newStatus: selectedStatus, remarks }),
        });
        if (!res.ok) throw new Error((await res.json()).error);
        toast({ title: '✅ Status updated', description: `Moved to "${selectedStatus}"` });
      }

      setSelectedStatus('');
      setSelectedWorkerId('');
      setRemarks('');
    } catch (e: any) {
      toast({ title: 'Update failed', description: e.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return (
    <div className="p-4 pt-16 md:pt-6 space-y-4">
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-48 w-full rounded-2xl" />
    </div>
  );

  if (!report) return (
    <div className="p-4 pt-16 md:pt-6">
      <Card><CardContent className="pt-6 text-center"><p className="text-muted-foreground">Complaint not found.</p></CardContent></Card>
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-4 pb-8 pt-16 md:pt-6">
      <Button variant="ghost" size="sm" asChild className="-ml-2">
        <Link href="/dept/complaints"><ArrowLeft className="mr-1 h-4 w-4" />Back</Link>
      </Button>

      {/* Status banner */}
      <div className={`rounded-2xl px-5 py-4 ${statusColors[report.status]} border`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium opacity-70">#{report.id.slice(-6).toUpperCase()}</p>
            <h1 className="text-lg font-bold mt-0.5">{report.status}</h1>
          </div>
          <div className="flex flex-wrap gap-2 justify-end"><Badge className={`${statusColors[report.status]} border font-semibold`}>{report.priority ?? 'Low'} Priority</Badge><Badge variant="outline">Difficulty: {report.difficulty ?? 'Moderate'}</Badge>{typeof report.riskScore === 'number' && <Badge variant="outline">Risk {report.riskScore}/100</Badge>}</div>
        </div>
      </div>

      {/* Complaint info */}
      <Card className="border-0 shadow-sm">
        <CardContent className="pt-4 space-y-4">
          <div>
            <p className="font-semibold text-sm">{report.description}</p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{report.location}</span>
              <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDistanceToNow(new Date(report.timestamp), { addSuffix: true })}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline">{report.category}</Badge>
            {report.department && <Badge variant="outline">{report.department}</Badge>}
          </div>
          {report.imageUrl && (
            <div className="relative h-40 w-full rounded-xl overflow-hidden">
              <Image src={report.imageUrl} alt="Evidence" fill className="object-cover" />
            </div>
          )}
          {report.afterWorkMediaUrl && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">After Work</p>
              <div className="relative h-32 w-full rounded-xl overflow-hidden">
                <Image src={report.afterWorkMediaUrl} alt="After" fill className="object-cover" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Incident & Duplicate Consolidation Banner */}
      <IncidentConsolidationBanner report={report} />

      {report.departmentTasks?.length ? (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Coordinated Department Tasks</CardTitle>
            <CardDescription>Each operational task has its own owner, status and dependency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {report.departmentTasks.map((task) => (
              <div key={task.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-sm">{task.taskName}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{task.departmentName}{task.assignedWorkerName ? ` • ${task.assignedWorkerName}` : ' • Unassigned'}</p>
                  </div>
                  <div className="flex gap-2"><Badge variant="outline">{task.status}</Badge>{task.difficulty && <Badge variant="outline">{task.difficulty}</Badge>}</div>
                </div>
                {task.dependencyTaskId && <p className="mt-2 text-xs text-amber-700">Blocked until task {task.dependencyTaskId} is completed.</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Department Verification & Evidence Panel */}
      <DepartmentVerificationPanel report={report} />

      {/* Action panel */}
      {!['Resolved', 'Rejected'].includes(report.status) && (
        <Card className="border-0 shadow-sm border-l-4 border-l-indigo-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4 text-indigo-500" />Take Action</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Smart Worker Assignment */}
            {(workers ?? []).length > 0 && (
              <SmartWorkerSelector
                workers={workers ?? []}
                report={report}
                selectedWorkerId={selectedWorkerId}
                onSelectWorker={setSelectedWorkerId}
                disabled={isSubmitting}
              />
            )}

            {/* Status update */}
            {nextStatuses.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Update Status</p>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger className="rounded-xl">
                    <SelectValue placeholder="Change status to…" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Remarks */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Remarks (optional)</p>
              <Textarea
                placeholder="Add notes for the worker or citizen…"
                className="resize-none rounded-xl"
                rows={3}
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              />
            </div>

            <Button onClick={handleSubmit} disabled={isSubmitting || (!selectedStatus && !selectedWorkerId)}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
              {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Updating…</> : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Timeline */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Activity Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...(report.actionLog ?? [])].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()).map((log, i, arr) => (
              <div key={i} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                    {actorIcons[log.actor] ?? <Bot className="h-4 w-4 text-gray-400" />}
                  </div>
                  {i < arr.length - 1 && <div className="mt-1 w-px flex-1 bg-gray-200" />}
                </div>
                <div className="flex-1 pb-3">
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span>{log.actorName}</span>
                    <span className="font-normal text-muted-foreground">→</span>
                    <Badge variant="outline" className="text-xs">{log.status}</Badge>
                  </div>
                  {log.notes && <p className="text-xs text-muted-foreground italic mt-0.5">"{log.notes}"</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                </div>
              </div>
            ))}
            {(!report.actionLog || report.actionLog.length === 0) && (
              <p className="text-sm text-muted-foreground">No actions yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agent Pipeline Execution Log */}
      <AgentPipelineVisualization report={report} isAdminView={true} />

      {/* Explainable AI & Decision Transparency */}
      <ExplainableAiCard report={report} />

      {/* AI Analysis */}
      {report.aiAnalysis && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Bot className="h-4 w-4" />AI Assessment</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {[
              ['Category', report.aiAnalysis.damageCategory],
              ['Severity', report.aiAnalysis.severity],
              ['Verification', report.aiAnalysis.verificationSuggestion],
              ['Suggested Dept', report.aiAnalysis.suggestedDepartment],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between text-sm border-b pb-1.5 last:border-0">
                <span className="text-muted-foreground">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
