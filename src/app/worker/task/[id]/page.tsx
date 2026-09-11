'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useMemo, useState } from 'react';
import { arrayUnion, doc, updateDoc } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Calendar,
  Camera,
  CheckCircle2,
  Loader2,
  MapPin,
  ShieldCheck,
  User,
  Video,
  XCircle,
} from 'lucide-react';

import { useAuth, useDoc, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useWorkerProfile } from '@/hooks/use-worker-profile';
import { buildWorkerLogEntry, isAssignedToWorker, isOpenLowPriorityTask, workerStatusColors } from '@/lib/worker';
import type { Report } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { buildAuthHeaders } from '@/lib/client-auth';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

function MediaPreview({
  label,
  url,
  mediaType,
}: {
  label: string;
  url?: string;
  mediaType?: 'image' | 'video';
}) {
  if (!url) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        {label} not uploaded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{label}</p>
      {mediaType === 'video' ? (
        <video src={url} controls className="w-full rounded-xl" />
      ) : (
        <Image src={url} alt={label} width={1200} height={800} className="w-full rounded-xl object-cover" />
      )}
    </div>
  );
}

const getInstructionsForCategory = (category: string = '') => {
  const normalized = category.toLowerCase();
  
  if (normalized.includes('pothole') || normalized.includes('crack') || normalized.includes('surface')) {
    return {
      goal: 'Restore road safety and smooth driving conditions by sealing cracks or filling potholes.',
      steps: [
        'Clean the damaged area of all loose debris, water, and dirt.',
        'Apply high-quality bituminous cold mix or hot mix asphalt to fill the depression.',
        'Compact the mix thoroughly using a roller or hand rammer until it is flush with the surrounding road.',
        'Upload the completed "After Work Photo" showing a flat, smooth, and dry asphalt surface.'
      ]
    };
  }
  
  if (normalized.includes('garbage') || normalized.includes('debris') || normalized.includes('waste') || normalized.includes('sanitation')) {
    return {
      goal: 'Clear the waste dump, restore absolute cleanliness and hygiene to the spot, and ensure proper garbage disposal.',
      steps: [
        'Gather all litter, waste bags, and dumped debris from the area.',
        'Sweep the surrounding space to remove small particles and organic waste.',
        'Load all collected waste into the PMC sanitation vehicle.',
        'Upload the completed "After Work Photo" showing a completely clean, clear, and swept public space.'
      ]
    };
  }
  
  if (normalized.includes('light') || normalized.includes('electric')) {
    return {
      goal: 'Restore streetlight functionality to ensure pedestrian safety and neighborhood security.',
      steps: [
        'Inspect the bulb, fixture, wiring, and circuit connection of the non-functioning pole.',
        'Replace the faulty bulb or LED panel with a certified working replacement.',
        'Fix any disconnected wiring or electrical connection issues securely.',
        'Test the light to verify it works, then upload the "After Work Photo" proving the light is fully turned on and functional.'
      ]
    };
  }
  
  if (normalized.includes('water') || normalized.includes('drainage') || normalized.includes('flood')) {
    return {
      goal: 'Drain all standing water and resolve underlying blockages to prevent breeding ground for mosquitoes and road erosion.',
      steps: [
        'Inspect the nearby drain grates and culverts for leaf piles, plastic debris, or blockages.',
        'Clear any mud or rubbish clogging the water flow.',
        'Ensure smooth runoff through the drainage channel.',
        'Upload the "After Work Photo" showing the road completely free of standing water.'
      ]
    };
  }

  // Default
  return {
    goal: 'Inspect the reported citizen issue and perform complete corrective maintenance.',
    steps: [
      'Arrive at the geocoded GPS location and inspect the issue details.',
      'Execute necessary repairs, replacement, or sanitation cleanup safely.',
      'Upload the completed "After Work Photo" as proof of resolution.'
    ]
  };
};

export default function WorkerTaskPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();
  const { workerId, workerName, isLoading: isWorkerLoading } = useWorkerProfile();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const reportRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'reports', params.id);
  }, [firestore, params.id]);

  const { data: report, isLoading } = useDoc<Report>(reportRef);

  const isMine = useMemo(() => {
    if (!report) return false;
    return isAssignedToWorker(report, workerId, workerName);
  }, [report, workerId, workerName]);

  const isSelfAssignable = report ? isOpenLowPriorityTask(report) : false;
  const canOperate = isMine || isSelfAssignable;
  
  const instructions = useMemo(() => {
    return getInstructionsForCategory(report?.category);
  }, [report?.category]);
  const mapsUrl =
    report?.latitude && report?.longitude
      ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
      : `https://www.google.com/maps?q=${encodeURIComponent(report?.location || '')}`;

  async function runTaskAction(action: 'accept' | 'reject' | 'complete') {
    if (!report || !reportRef || !workerId) return;

    setActiveAction(action);

    try {
      if (action === 'accept') {
        if (!auth) return;
        const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
        const res = await fetch(`/api/worker/tasks/${report.id}/accept`, {
          method: 'POST',
          headers,
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to accept task');
        }

        toast({ title: 'Task accepted', description: 'You can now upload before-work proof and begin the job.' });
        return;
      }

      if (action === 'reject') {
        await updateDoc(reportRef, {
          assignedWorkerId: null,
          assignedContractor: null,
          workerAssignmentStatus: 'Rejected',
          selfAssigned: false,
          status: 'Submitted',
          workflowStage: 'pending_department',
          actionLog: arrayUnion(buildWorkerLogEntry('Submitted', workerName, 'Task rejected by worker and returned for reassignment.')),
        });

        toast({ title: 'Task rejected', description: 'The task has been released back for reassignment.' });
        router.push('/worker/task');
        return;
      }

      if (!report.afterWorkMediaUrl && !report.afterImageUrl) {
        toast({
          variant: 'destructive',
          title: 'After-work proof required',
          description: 'Upload after-work image or video before marking this task completed.',
        });
        return;
      }

      await updateDoc(reportRef, {
        status: 'Resolved',
        completedAt: new Date().toISOString(),
        workflowStage: 'completed',
        workerAssignmentStatus: 'Accepted',
        actionLog: arrayUnion(buildWorkerLogEntry('Resolved', workerName, 'Task marked as completed by worker.')),
      });

      toast({ title: 'Task completed', description: 'The task has been moved to your history.' });
      router.push('/worker/history');
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Action failed',
        description: 'Please try again in a moment.',
      });
    } finally {
      setActiveAction(null);
    }
  }

  if (isLoading || isWorkerLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <Skeleton className="h-[420px] w-full" />
        <Skeleton className="h-[420px] w-full" />
      </div>
    );
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task not found</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" className="px-0">
        <Link href={isMine ? '/worker/task' : '/worker/open-tasks'}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Link>
      </Button>

      <div className="grid gap-6 lg:grid-cols-[1.6fr,1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                    ⚠️ {report.category || 'Municipal Issue'}
                  </CardTitle>
                  <CardDescription className="mt-1 font-mono text-xs">Report ID: {report.id}</CardDescription>
                </div>
                <div className="flex gap-2 self-start">
                  <Badge className={`${workerStatusColors[report.status]} text-white border-0 shadow-sm px-2.5 py-0.5 text-xs font-semibold`}>{report.status}</Badge>
                  <Badge variant="outline" className={`shrink-0 ${
                    report.priority === 'Medium'
                      ? 'bg-amber-50 text-amber-700 border-amber-200'
                      : report.priority === 'High' || report.priority === 'Critical'
                      ? 'bg-red-50 text-red-700 border-red-200'
                      : 'bg-green-50 text-green-700 border-green-200'
                  } shadow-sm px-2.5 py-0.5 text-xs font-semibold`}>
                    {report.priority || 'N/A'}
                  </Badge>
                </div>
              </div>

              {/* Dynamic Action & Goal Box */}
              <div className="mt-4 rounded-xl bg-slate-50 p-4 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 space-y-4">
                {/* Problem Section (1-line) */}
                <div>
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Problem</span>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
                    {report.description.split(/[.!?]/)[0].trim() || report.description}.
                  </p>
                </div>
                
                {/* Goal Section */}
                <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Goal</span>
                  <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400 leading-snug flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>{instructions.goal}</span>
                  </p>
                </div>

                {/* How to Solve Section */}
                <div className="border-t border-slate-200/60 dark:border-slate-800/60 pt-3 space-y-2">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block">How to Solve It (Action Steps)</span>
                  <ul className="space-y-2 pl-0.5">
                    {instructions.steps.map((step, idx) => (
                      <li key={idx} className="text-xs text-slate-600 dark:text-slate-400 flex items-start gap-2.5 leading-relaxed">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-50 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200/40">
                          {idx + 1}
                        </span>
                        <span className="mt-0.5">{step}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-6 md:grid-cols-2">
              <MediaPreview label="Citizen evidence" url={report.imageUrl} mediaType="image" />
              <div className="space-y-6">
                <MediaPreview label="Before work proof" url={report.beforeWorkMediaUrl} mediaType={report.beforeWorkMediaType} />
                <MediaPreview
                  label="After work proof"
                  url={report.afterWorkMediaUrl || report.afterImageUrl}
                  mediaType={report.afterWorkMediaType || (report.afterImageUrl ? 'image' : undefined)}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Workflow Progress</CardTitle>
              <CardDescription>Use these steps to finish the task from the field.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Task accepted', done: report.workerAssignmentStatus === 'Accepted' || isMine },
                { label: 'Before proof uploaded', done: !!report.beforeWorkMediaUrl },
                { label: 'After proof uploaded', done: !!(report.afterWorkMediaUrl || report.afterImageUrl) },
                { label: 'Task completed', done: report.status === 'Resolved' },
              ].map((step) => (
                <div key={step.label} className="rounded-2xl border p-4">
                  <div className="flex items-center gap-2">
                    {step.done ? <CheckCircle2 className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-amber-500" />}
                    <span className="font-medium">{step.label}</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Worker Actions</CardTitle>
              <CardDescription>Accept, reject, upload proof, and close the task.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {!canOperate ? (
                <Alert>
                  <ShieldCheck className="h-4 w-4" />
                  <AlertTitle>Read only</AlertTitle>
                  <AlertDescription>This task is not currently assigned to you and is not available for self-assignment.</AlertDescription>
                </Alert>
              ) : null}

              {canOperate && !isMine ? (
                <Button className="w-full" onClick={() => runTaskAction('accept')} disabled={activeAction === 'accept'}>
                  {activeAction === 'accept' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Accept Task
                </Button>
              ) : null}

              {isMine ? (
                <>
                  {report.workerAssignmentStatus !== 'Accepted' ? (
                    <Button className="w-full" onClick={() => runTaskAction('accept')} disabled={activeAction === 'accept'}>
                      {activeAction === 'accept' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                      Accept Assignment
                    </Button>
                  ) : null}
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/worker/task/${report.id}/before`}>
                      <Camera className="mr-2 h-4 w-4" />
                      Before Upload Page
                    </Link>
                  </Button>
                  <Button asChild className="w-full" variant="outline">
                    <Link href={`/worker/task/${report.id}/after`}>
                      <Video className="mr-2 h-4 w-4" />
                      After Upload Page
                    </Link>
                  </Button>
                  <Button className="w-full" onClick={() => runTaskAction('complete')} disabled={activeAction === 'complete'}>
                    {activeAction === 'complete' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
                    Mark Task Completed
                  </Button>
                  {report.status !== 'Resolved' ? (
                    <Button className="w-full" variant="destructive" onClick={() => runTaskAction('reject')} disabled={activeAction === 'reject'}>
                      {activeAction === 'reject' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <XCircle className="mr-2 h-4 w-4" />}
                      Reject Task
                    </Button>
                  ) : null}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Task Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="mt-1 h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{report.location}</p>
                  <Button variant="link" asChild className="h-auto p-0">
                    <Link href={mapsUrl} target="_blank" rel="noopener noreferrer">
                      Open in Google Maps
                      <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Reported by</p>
                  <p className="text-sm text-muted-foreground">{report.userName}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Reported on</p>
                  <p className="text-sm text-muted-foreground">{new Date(report.timestamp).toLocaleString()}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Department</p>
                  <p className="text-sm text-muted-foreground">{report.department}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
