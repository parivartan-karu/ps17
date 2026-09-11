'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { MapPin, User, Calendar, Bot, Loader2, Shield, AlertTriangle, Sparkles, UserCheck, ChevronRight } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useAuth, useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, DocumentData, DocumentReference, query, Query, updateDoc, where } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { AIAnalysis, Report, ReportStatus, User as WorkerUser, ActionLogEntry } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useState, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useParams } from 'next/navigation';
import { summarizeReportFlow } from '@/ai/flows/summarize-report-flow';
import ReactMarkdown from 'react-markdown';
import { buildAuthHeaders } from '@/lib/client-auth';
import { departmentConfig, departments } from '@/lib/constants';


const statusColors: { [key: string]: string } = {
  Submitted: 'bg-blue-500',
  'Under Verification': 'bg-yellow-500',
  Assigned: 'bg-orange-500',
  'In Progress': 'bg-amber-500',
  Resolved: 'bg-green-500',
  Rejected: 'bg-red-500',
};

const officerActionableStatuses: ReportStatus[] = ['Under Verification', 'Assigned', 'In Progress', 'Resolved', 'Rejected'];
const severityLevels: (AIAnalysis['severity'])[] = ['Low', 'Medium', 'High'];
const priorityLevels: NonNullable<Report['priority']>[] = ['Low', 'Medium', 'High', 'Critical'];

const causeTags = ['Rain / Flood', 'Construction', 'Utility Work', 'Heavy Load', 'Poor Quality', 'Other'];

const categoryDepartmentMap: Record<string, string> = {
  pothole: 'Engineering',
  crack: 'Engineering',
  road: 'Engineering',
  drainage: 'Water Supply',
  sewage: 'Water Supply',
  water: 'Water Supply',
  garbage: 'Sanitation',
  waste: 'Sanitation',
  sanitation: 'Sanitation',
  light: 'Electrical',
  electric: 'Electrical',
  signal: 'Traffic & Roads',
  traffic: 'Traffic & Roads',
  tree: 'Parks & Environment',
  park: 'Parks & Environment',
};

function inferDepartmentFromCategory(category: string, fallback?: string) {
  const normalized = category.toLowerCase();
  const mapped = Object.entries(categoryDepartmentMap).find(([key]) => normalized.includes(key))?.[1];
  return mapped || fallback || 'Engineering';
}


const officerActionSchema = z.object({
  status: z.string().min(1, 'Please select a status.'),
  severity: z.string().optional(),
  remarks: z.string().optional(),
  department: z.string().optional(),
  causeTag: z.string().optional(),
  assignedContractor: z.string().optional(),
  priority: z.string().optional(),
  estimatedResolutionTime: z.string().optional(),
  afterImageUrl: z.string().url().optional().or(z.literal('')),
});
type OfficerActionForm = z.infer<typeof officerActionSchema>;


export default function SmcComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { user } = useUser();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [isAutoAssigning, setIsAutoAssigning] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [showContractorList, setShowContractorList] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const reportRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'reports', params.id) as DocumentReference<DocumentData>;
  }, [firestore, params.id]);

  const { data: report, isLoading } = useDoc<Report>(reportRef);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]) as Query<DocumentData> | null;

  const { data: workers = [] } = useCollection<WorkerUser>(workersQuery);

  const form = useForm<OfficerActionForm>({
    resolver: zodResolver(officerActionSchema),
    defaultValues: {
      status: '',
      severity: '',
      remarks: '',
      department: '',
      causeTag: '',
      assignedContractor: '',
      priority: '',
      estimatedResolutionTime: '',
      afterImageUrl: '',
    },
  });

  // Effect to sync form with loaded report data
  useEffect(() => {
    if (report) {
      form.reset({
        status: report.status || '',
        severity: report.aiAnalysis?.severity || '',
        remarks: report.remarks || '',
        department: report.department && report.department !== 'Unassigned'
          ? report.department
          : report.aiAnalysis?.suggestedDepartment || 'Unassigned',
        causeTag: report.causeTag || '',
        assignedContractor: report.assignedContractor || '',
        priority: report.priority
          ? report.priority
          : report.aiAnalysis?.suggestedPriority || 'Medium',
        estimatedResolutionTime: report.estimatedResolutionTime || '',
        afterImageUrl: report.afterImageUrl || '',
      });
    }
  }, [report, form]);


  const watchedStatus = form.watch('status');
  const selectedDepartment = form.watch('department');

  const effectiveDepartment = report
    ? (selectedDepartment && selectedDepartment !== 'Unassigned'
      ? selectedDepartment
      : inferDepartmentFromCategory(report.category, report.aiAnalysis?.suggestedDepartment))
    : 'Engineering';

  const definedCategories = ['pothole', 'crack', 'surface failure', 'streetlight issue'];
  const isDefinedCategory = report ? definedCategories.includes((report.category || '').toLowerCase()) : false;

  const effectivePriority = report ? (report.priority || report.aiAnalysis?.suggestedPriority || 'Medium') : 'Medium';
  const isHighOrCritical = effectivePriority === 'High' || effectivePriority === 'Critical';

  const filteredWorkers = (workers || []).filter((worker) => {
    if (!effectiveDepartment) return true;
    return worker.department === effectiveDepartment;
  });

  const categoryWiseWorkers = report
    ? filteredWorkers.filter((worker) => {
      const categoryText = report.category.toLowerCase();
      const workerText = `${worker.designation || ''} ${worker.skillType || ''}`.toLowerCase();
      return categoryText.split(' ').some((token) => token.length > 2 && workerText.includes(token));
    })
    : [];

  const recommendedWorkers = categoryWiseWorkers.length > 0 ? categoryWiseWorkers : filteredWorkers;

  const mapsUrl = report?.latitude && report?.longitude
    ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
    : `https://www.google.com/maps?q=${encodeURIComponent(report?.location || '')}`;

  const handleAutoAssign = useCallback(() => {
    if (!report) return;
    if (recommendedWorkers.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Matching Workers',
        description: `No workers found for ${effectiveDepartment}. Please choose manually after changing department.`,
      });
      return;
    }

    setIsAutoAssigning(true);
    try {
      const locationText = `${report.location} ${report.roadName || ''}`.toLowerCase();
      const scored = [...recommendedWorkers].sort((a, b) => {
        const score = (w: WorkerUser) => {
          let total = 0;
          if (w.isAvailable !== false) total += 50;
          total -= (w.activeTasks || 0) * 6;
          if (w.wardArea && locationText.includes(w.wardArea.toLowerCase())) total += 18;
          const roleText = `${w.designation || ''} ${w.skillType || ''}`.toLowerCase();
          if (roleText.includes(report.category.toLowerCase())) total += 16;
          return total;
        };
        return score(b) - score(a);
      });

      const bestWorker = scored[0];
      form.setValue('department', effectiveDepartment);
      form.setValue('assignedContractor', bestWorker.name);
      if (watchedStatus !== 'Assigned' && watchedStatus !== 'In Progress') {
        form.setValue('status', 'Assigned');
      }

      toast({
        title: 'Worker Auto-Assigned',
        description: `${bestWorker.name} selected for ${report.category}. You can still change manually below.`,
      });
    } finally {
      setIsAutoAssigning(false);
    }
  }, [effectiveDepartment, form, recommendedWorkers, report, toast, watchedStatus]);

  const handleGetSummary = useCallback(async () => {
    if (!report) return;
    setIsSummarizing(true);
    setSummary(null);
    try {
      const result = await summarizeReportFlow({
        id: report.id,
        description: report.description,
        status: report.status,
        category: report.category,
        timestamp: report.timestamp,
        actionLog: report.actionLog || [],
        citizenRating: report.citizenRating,
      });
      setSummary(result.summary);
    } catch (error) {
      console.error("Failed to generate summary", error);
      toast({
        variant: "destructive",
        title: "AI Summary Failed",
        description: "Could not generate the report summary. Please try again."
      });
    } finally {
      setIsSummarizing(false);
    }
  }, [report, toast]);


  async function onSubmit(values: OfficerActionForm) {
    if (!reportRef || !report) return;

    setIsSubmitting(true);
    try {
      const hasStatusChanged = report.status !== values.status;

      const selectedWorker = (workers || []).find(w => w.name === values.assignedContractor);
      const updatePayload: Record<string, unknown> = {
        remarks: values.remarks,
        department: values.department,
        causeTag: values.causeTag,
        assignedContractor: values.assignedContractor,
        assignedWorkerId: selectedWorker?.id ?? report.assignedWorkerId ?? null,
        priority: values.priority,
        estimatedResolutionTime: values.estimatedResolutionTime,
        afterImageUrl: values.afterImageUrl || null,
      };

      if (values.severity && report?.aiAnalysis) {
        updatePayload['aiAnalysis.severity'] = values.severity;
      }

      // Use atomic API endpoint for status changes (especially Resolved)
      if (hasStatusChanged) {
        const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
        const response = await fetch(`/api/smc/complaints/${report.id}/resolve`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            newStatus: values.status as ReportStatus,
            remarks: values.remarks,
            updatePayload,
          }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || 'Failed to update report.');
        }
      } else {
        // For non-status changes, update directly (no atomicity requirement)
        await updateDoc(reportRef, updatePayload);
      }

      toast({
        title: 'Report Updated',
        description: `The report has been successfully updated.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: 'Could not update the report. You may not have the required permissions.',
      });
      console.error('Update failed: ', error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDirectAssign(worker: WorkerUser) {
    if (!reportRef || !report) return;

    setIsSubmitting(true);
    try {
      const updatePayload: Record<string, unknown> = {
        assignedContractor: worker.name,
        assignedWorkerId: worker.id,
        status: 'Assigned',
        workflowStage: 'assigned_worker',
      };

      const newLog: ActionLogEntry = {
        status: 'Assigned',
        timestamp: new Date().toISOString(),
        actor: 'Official',
        actorName: user?.displayName || 'SMC Officer',
        notes: `Assigned task to contractor: ${worker.name}`,
      };
      updatePayload.actionLog = [...(report.actionLog || []), newLog];

      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const response = await fetch(`/api/smc/complaints/${report.id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          newStatus: 'Assigned',
          remarks: `Assigned task to contractor: ${worker.name}`,
          updatePayload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to assign contractor.');
      }

      toast({
        title: 'Contractor Assigned',
        description: `Successfully assigned this task to ${worker.name}.`,
      });
      setShowContractorList(false);
    } catch (e: any) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: 'Assignment Failed',
        description: e.message || 'Something went wrong when trying to assign the contractor.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          <Skeleton className="h-[500px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
        <div className="lg:col-span-1 space-y-8">
          <Skeleton className="h-[300px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    )
  }

  if (!report) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Complaint Not Found</CardTitle>
          <CardDescription>The requested report could not be found.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const sortedActionLog = report.actionLog?.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()) || [];

  return (
    <div className="grid gap-8 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-8">
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle className="text-2xl">{report.category}: {report.description}</CardTitle>
              <Badge className={`${statusColors[report.status]}`}>{report.status}</Badge>
            </div>
            <CardDescription>Report ID: {report.id}</CardDescription>
          </CardHeader>
          <CardContent>
            <Image src={report.imageUrl} alt={report.id} width={800} height={600} className="rounded-lg w-full object-cover" />
          </CardContent>
        </Card>

        {/* Worker Work Proof Section */}
        {(report.beforeWorkMediaUrl || report.afterWorkMediaUrl || report.afterImageUrl) && (
          <Card>
            <CardHeader>
              <CardTitle>Worker Work Proof & Progress</CardTitle>
              <CardDescription>
                Review the visual evidence submitted by the field worker before and after the completion of the work.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Before Work */}
                <div className="space-y-3 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Before Work Proof</span>
                    {report.beforeWorkUploadedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(report.beforeWorkUploadedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {report.beforeWorkMediaUrl ? (
                    report.beforeWorkMediaType === 'video' ? (
                      <video
                        src={report.beforeWorkMediaUrl}
                        controls
                        className="rounded-lg w-full h-48 object-cover border"
                      />
                    ) : (
                      <img
                        src={report.beforeWorkMediaUrl}
                        alt="Before Work Proof"
                        className="rounded-lg w-full h-48 object-cover border"
                      />
                    )
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground italic">
                      No before-work photo uploaded
                    </div>
                  )}
                  {report.beforeWorkNotes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      <strong>Worker Note:</strong> "{report.beforeWorkNotes}"
                    </p>
                  )}
                </div>

                {/* After Work */}
                <div className="space-y-3 rounded-xl border p-4 bg-slate-50/50 dark:bg-slate-900/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">After Work Proof</span>
                    {report.afterWorkUploadedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(report.afterWorkUploadedAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                  {(report.afterWorkMediaUrl || report.afterImageUrl) ? (
                    (report.afterWorkMediaType === 'video') ? (
                      <video
                        src={report.afterWorkMediaUrl}
                        controls
                        className="rounded-lg w-full h-48 object-cover border"
                      />
                    ) : (
                      <img
                        src={report.afterWorkMediaUrl || report.afterImageUrl}
                        alt="After Work Proof"
                        className="rounded-lg w-full h-48 object-cover border"
                      />
                    )
                  ) : (
                    <div className="flex h-48 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground italic">
                      Work in progress
                    </div>
                  )}
                  {report.afterWorkNotes && (
                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">
                      <strong>Worker Note:</strong> "{report.afterWorkNotes}"
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Citizen Feedback Section */}
        {(report.citizenRating !== undefined || report.citizenFeedback) && (
          <Card className="border-emerald-200 bg-emerald-50/20 dark:border-emerald-950 dark:bg-emerald-950/10">
            <CardHeader>
              <CardTitle className="text-emerald-800 dark:text-emerald-300">Citizen Verification & Feedback</CardTitle>
              <CardDescription>
                Feedback and quality rating provided by the reporting citizen after work resolution.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Rating:</span>
                {report.citizenRating ? (
                  <div className="flex items-center gap-1">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <svg
                        key={i}
                        className={`h-5 w-5 ${i < (report.citizenRating ?? 0)
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-300 fill-slate-300'
                          }`}
                        viewBox="0 0 20 20"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                      </svg>
                    ))}
                    <span className="ml-1 text-sm font-bold text-slate-800 dark:text-slate-100">
                      {report.citizenRating} / 5
                    </span>
                  </div>
                ) : (
                  <span className="text-sm italic text-muted-foreground">Not rated yet</span>
                )}
              </div>

              {report.citizenFeedback && (
                <div className="rounded-lg border border-emerald-100 bg-white p-3 dark:border-emerald-900 dark:bg-slate-950">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Citizen Feedback Comment</p>
                  <p className="text-sm text-slate-800 dark:text-slate-200 italic">
                    "{report.citizenFeedback}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Action Log</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {sortedActionLog.map((log, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0 pt-1">
                    {log.actor === 'Citizen' && <User className="h-5 w-5 text-muted-foreground" />}
                    {log.actor === 'Official' && <Shield className="h-5 w-5 text-muted-foreground" />}
                    {log.actor === 'System' && <Bot className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {log.actorName}
                      {log.notes?.toLowerCase().includes('status')
                        ? <><span className="text-muted-foreground font-normal"> changed status to </span>{log.status}</>
                        : <span className="text-muted-foreground font-normal"> performed an action</span>
                      }
                    </p>
                    {log.notes && <p className="text-sm text-muted-foreground italic">"{log.notes}"</p>}
                    <p className="text-xs text-muted-foreground mt-1">{new Date(log.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {sortedActionLog.length === 0 && (
                <p className="text-sm text-muted-foreground">No actions logged yet.</p>
              )}
            </div>
          </CardContent>
        </Card>


        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Bot /> AI Damage Analysis</CardTitle>
          </CardHeader>
          <CardContent>
            {report.aiAnalysis ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Damage Detected:</span>
                      <span className={`font-semibold ${report.aiAnalysis.damageDetected ? 'text-destructive' : 'text-green-600'}`}>{report.aiAnalysis.damageDetected ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Detected Category:</span>
                      <span className="font-semibold">{report.aiAnalysis.damageCategory}</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Estimated Severity:</span>
                      <span className="font-semibold">{report.aiAnalysis.severity}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Verification Suggestion:</span>
                      <span className="font-semibold">{report.aiAnalysis.verificationSuggestion}</span>
                    </div>
                  </div>
                </div>
                <Separator />
                <h4 className="font-semibold text-sm pt-2">AI Triage Suggestions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Suggested Department:</span>
                    <Badge variant="outline">{report.aiAnalysis.suggestedDepartment}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Suggested Priority:</span>
                    <Badge variant="outline">{report.aiAnalysis.suggestedPriority}</Badge>
                  </div>
                </div>
                {report.aiAnalysis.duplicateSuggestion && (
                  <>
                    <Separator />
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Duplicate Check</AlertTitle>
                      <AlertDescription>
                        {report.aiAnalysis.duplicateSuggestion}
                      </AlertDescription>
                    </Alert>
                  </>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">AI analysis is pending or was not performed on this report.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-1 space-y-8">
        <Card>
          <CardHeader>
            <CardTitle>AI Assistant Tools</CardTitle>
            <CardDescription>Use AI to quickly understand and process this report.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button onClick={handleGetSummary} disabled={isSummarizing || isSubmitting} className="w-full">
              {isSummarizing ? <Loader2 className="animate-spin mr-2" /> : <Bot className="mr-2" />}
              Generate AI Summary
            </Button>
            {summary && (
              <Alert>
                <Bot className="h-4 w-4" />
                <AlertTitle>Report Summary</AlertTitle>
                <AlertDescription>
                  <ReactMarkdown
                    className="text-sm"
                    components={{
                      p: ({ node, ...props }) => <p className="whitespace-pre-wrap mb-2 last:mb-0" {...props} />,
                      strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                    }}
                  >
                    {summary}
                  </ReactMarkdown>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>

        {isDefinedCategory && isHighOrCritical ? (
          <Card className="border-red-100 bg-red-50/10 dark:border-red-950 dark:bg-red-950/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-800 dark:text-red-300">
                <Shield className="h-5 w-5 text-red-600 dark:text-red-400 animate-pulse" />
                High Priority Road/Infra Allocation
              </CardTitle>
              <CardDescription>
                This is a High Priority Road/Infrastructure issue that requires explicit administrator assignment.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {report.assignedContractor ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/20 p-4 dark:border-emerald-950 dark:bg-emerald-950/10 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-semibold">
                    <UserCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    Contractor Assigned
                  </div>
                  <div className="text-sm space-y-1">
                    <p className="text-slate-800 dark:text-slate-200">
                      <span className="font-semibold text-muted-foreground mr-1">Name:</span> {report.assignedContractor}
                    </p>
                    <p className="text-slate-600 dark:text-slate-400 text-xs">
                      <span className="font-semibold text-muted-foreground mr-1">Worker ID:</span> {report.assignedWorkerId || 'N/A'}
                    </p>
                  </div>
                  <Button
                    onClick={() => setShowContractorList(!showContractorList)}
                    className="w-full h-10 border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 dark:border-slate-800 dark:text-slate-200 font-medium"
                    variant="outline"
                    disabled={isSubmitting}
                  >
                    Reassign Contractor
                  </Button>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-red-200 bg-white p-4 dark:border-red-900 dark:bg-slate-950 space-y-4 text-center">
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    No contractor has been allocated to this issue yet. Please select an available contractor to execute this work.
                  </p>
                  <Button
                    onClick={() => setShowContractorList(!showContractorList)}
                    className="w-full h-11 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl shadow-sm transition-all"
                    disabled={isSubmitting}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Assign Contractor
                  </Button>
                </div>
              )}

              {/* Contractor Selection Form */}
              {showContractorList && (
                <div className="rounded-xl border bg-white p-4 dark:bg-slate-950 space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Search All Contractors</label>
                    <Input
                      placeholder="Type contractor name..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-10 rounded-lg"
                    />
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                    {(() => {
                      const queryFiltered = (workers || []).filter(w =>
                        (w.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (w.department || '').toLowerCase().includes(searchQuery.toLowerCase())
                      );
                      if (queryFiltered.length === 0) {
                        return <p className="text-xs text-muted-foreground text-center py-6 italic">No matching contractors found.</p>;
                      }
                      return queryFiltered.map((worker) => (
                        <button
                          key={worker.id}
                          onClick={() => handleDirectAssign(worker)}
                          disabled={isSubmitting}
                          className="w-full flex items-center justify-between p-3 rounded-lg border bg-slate-50/50 hover:bg-slate-50 text-left transition-all hover:border-indigo-400 dark:bg-slate-900/50 dark:hover:bg-slate-900"
                        >
                          <div>
                            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{worker.name}</p>
                            <p className="text-xs text-muted-foreground">{worker.designation || worker.department || 'Field Contractor'}</p>
                          </div>
                          <ChevronRight className="h-4 w-4 text-slate-400 animate-pulse" />
                        </button>
                      ));
                    })()}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-100 bg-slate-50/20 dark:border-slate-800 dark:bg-slate-900/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-800 dark:text-slate-300">
                <User className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Worker Managed Dispatch
              </CardTitle>
              <CardDescription>
                Automated direct workflow for Low/Medium priority and standardized issues.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/10 p-4 dark:border-indigo-950 dark:bg-indigo-950/5">
                <Bot className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300 uppercase tracking-wider">AI Workflow System</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                    This is a <strong className="font-semibold text-indigo-700 dark:text-indigo-400">{effectivePriority}</strong> priority task.
                    To ensure maximum operational speed and bypass red tape, the system bypasses manual administrative assignment.
                    It is directly dispatched to and resolved by Pune Municipal Corporation workers on the ground.
                  </p>
                </div>
              </div>
              {report.assignedContractor && (
                <div className="rounded-xl border bg-white p-4 dark:bg-slate-950 text-sm space-y-1.5">
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider mb-1">Assigned Task Owner</p>
                  <p className="text-slate-800 dark:text-slate-200">
                    <span className="font-semibold">Worker in Charge:</span> {report.assignedContractor}
                  </p>
                  <p className="text-slate-600 dark:text-slate-400 text-xs">
                    <span className="font-semibold">Status:</span> {report.status}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle>Report Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <MapPin className="text-muted-foreground mt-1" />
              <div>
                <p className="font-semibold">{report.location}</p>
                <Button variant="link" asChild className="p-0 h-auto text-primary">
                  <Link href={mapsUrl} target="_blank" rel="noopener noreferrer">Open in Google Maps</Link>
                </Button>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <User className="text-muted-foreground" />
              <div>
                <p className="font-semibold">Reported By</p>
                <p className="text-sm text-muted-foreground">{report.userName}</p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center gap-3">
              <Calendar className="text-muted-foreground" />
              <div>
                <p className="font-semibold">Submitted On</p>
                <p className="text-sm text-muted-foreground">{new Date(report.timestamp).toLocaleString()}</p>
              </div>
            </div>
            {report.remarks && (
              <>
                <Separator />
                <div className="space-y-2">
                  <p className="font-semibold">Latest Remark</p>
                  <p className="text-sm text-muted-foreground italic">"{report.remarks}"</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
