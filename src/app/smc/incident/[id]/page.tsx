'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { collection, doc, query, where, DocumentData, Query } from 'firebase/firestore';
import { useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { AlertTriangle, ArrowLeft, Bot, CheckCircle2, Clock3, FileCheck2, MapPin, ShieldAlert, UserRound, Users, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const steps = ['Submitted','Under Verification','Assigned','In Progress','Resolved'];
const fmt = (value?: string) => value ? new Date(value).toLocaleString('en-IN') : '—';

export default function IncidentCommandView() {
  const { id } = useParams<{ id: string }>();
  const firestore = useFirestore();
  const reportRef = useMemoFirebase(() => firestore && id ? doc(firestore,'reports',id) : null, [firestore,id]);
  const { data: report, isLoading } = useDoc<Report>(reportRef);
  const workerQuery = useMemoFirebase(() => firestore && report?.assignedWorkerId ? query(collection(firestore,'users'),where('__name__','==',report.assignedWorkerId)) : null, [firestore,report?.assignedWorkerId]) as Query<DocumentData> | null;
  const { data: workerRows=[] } = useCollection<UserType>(workerQuery);
  const worker = workerRows[0];

  if (isLoading) return <div className="p-8 text-sm text-muted-foreground">Loading incident command view…</div>;
  if (!report) return <div className="p-8"><Link href="/smc/dashboard" className="underline">Back to Command Center</Link><p className="mt-4">Incident not found.</p></div>;

  const statusIndex = Math.max(0, steps.indexOf(report.status));
  const activeTasks = report.departmentTasks || [];
  const completedTasks = activeTasks.filter(t=>t.status==='Completed').length;
  const logs = [...(report.agentLogs||[])].sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime());

  return <div className="space-y-4 pb-10">
    <div className="flex items-center gap-3"><Link href="/smc/dashboard" className="inline-flex h-9 w-9 items-center justify-center rounded-md border"><ArrowLeft className="h-4 w-4"/></Link><div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Incident Command View</p><h1 className="text-2xl font-black">INCIDENT #{report.id.slice(0,8).toUpperCase()}</h1></div><Badge className="ml-auto">{report.priority || 'Medium'}</Badge></div>

    <div className="grid md:grid-cols-4 gap-3">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Risk Score</p><p className="text-3xl font-black">{report.riskScore ?? '—'}</p><p className="text-xs mt-1">{report.riskScoreReasons?.[0] || 'AI risk assessment'}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">SLA</p><p className="text-xl font-black">{report.slaBreached?'BREACHED':report.slaDeadline?fmt(report.slaDeadline):'Not set'}</p><p className="text-xs mt-1">Response: {report.responseSlaBreached?'BREACHED':report.slaResponseDeadline?fmt(report.slaResponseDeadline):'—'}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Escalation</p><p className="text-xl font-black">L{report.escalationLevel ?? 0}</p><p className="text-xs mt-1">{report.escalatedTo || 'No escalation'}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Field Progress</p><p className="text-3xl font-black">{completedTasks}/{activeTasks.length || 0}</p><p className="text-xs mt-1">department tasks completed</p></CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="text-base">Lifecycle</CardTitle></CardHeader><CardContent><div className="grid grid-cols-5 gap-2">{steps.map((step,i)=><div key={step} className="text-center"><div className={`mx-auto mb-2 h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${i<=statusIndex?'bg-primary text-primary-foreground':'bg-muted text-muted-foreground'}`}>{i<statusIndex?<CheckCircle2 className="h-4 w-4"/>:i+1}</div><p className="text-xs font-semibold">{step}</p></div>)}</div></CardContent></Card>

    <div className="grid lg:grid-cols-2 gap-4">
      <Card><CardHeader><CardTitle className="text-base flex gap-2"><ShieldAlert className="h-4 w-4"/> Classification & Risk</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-3 text-sm"><div><span className="text-muted-foreground">Category</span><p className="font-semibold">{report.category}</p></div><div><span className="text-muted-foreground">Department</span><p className="font-semibold">{report.department}</p></div><div><span className="text-muted-foreground">Difficulty</span><p className="font-semibold">{report.difficulty || '—'}</p></div><div><span className="text-muted-foreground">Routing confidence</span><p className="font-semibold">{report.routingConfidence != null ? `${Math.round(report.routingConfidence*100)}%` : '—'}</p></div></div><div><p className="text-xs font-bold uppercase text-muted-foreground">Risk reasons</p><ul className="mt-2 list-disc pl-5 text-sm space-y-1">{(report.riskScoreReasons||[]).map((x,i)=><li key={i}>{x}</li>)}</ul></div></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base flex gap-2"><MapPin className="h-4 w-4"/> Citizen Report</CardTitle></CardHeader><CardContent className="space-y-3"><p className="text-sm leading-6">{report.description}</p><p className="text-sm"><b>Location:</b> {report.location}</p><p className="text-xs text-muted-foreground">Submitted {fmt(report.timestamp)}</p>{report.imageUrl&&<img src={report.imageUrl} alt="Citizen evidence" className="h-44 w-full object-cover rounded-lg border"/>}</CardContent></Card>
    </div>

    <Card><CardHeader><CardTitle className="text-base flex gap-2"><Users className="h-4 w-4"/> Departments, Tasks & Workers</CardTitle></CardHeader><CardContent className="space-y-2">{activeTasks.length ? activeTasks.map(task=><div key={task.id} className="border rounded-lg p-3 flex items-center justify-between"><div><p className="font-semibold">{task.taskName}</p><p className="text-xs text-muted-foreground">{task.departmentName} · {task.difficulty || '—'} · {task.assignedWorkerName || 'Unassigned'}</p></div><Badge variant={task.status==='Completed'?'default':'outline'}>{task.status}</Badge></div>) : <p className="text-sm text-muted-foreground">No coordinated department tasks.</p>}{worker&&<div className="mt-3 rounded-lg bg-muted/40 p-3 flex items-center gap-3"><UserRound className="h-5 w-5"/><div><p className="font-semibold">{worker.name}</p><p className="text-xs text-muted-foreground">{worker.department} · active tasks {worker.activeTasks??0}/{worker.maxTaskCapacity??5}</p></div></div>}</CardContent></Card>

    <div className="grid lg:grid-cols-2 gap-4">
      <Card><CardHeader><CardTitle className="text-base flex gap-2"><Bot className="h-4 w-4"/> Agent Decisions</CardTitle></CardHeader><CardContent className="space-y-2">{logs.map((log,i)=><div key={i} className="border-b last:border-0 py-2"><div className="flex justify-between"><span className="font-semibold text-sm">{log.agent}</span><Badge variant="outline">{log.status}</Badge></div><p className="text-xs text-muted-foreground mt-1">{log.outputSummary || log.reasoning || 'Decision recorded'} · {log.confidence!=null?`${Math.round(log.confidence*100)}% confidence`:''}</p><p className="text-[10px] text-muted-foreground mt-1">{fmt(log.timestamp)}</p></div>)}{!logs.length&&<p className="text-sm text-muted-foreground">No agent decisions recorded.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base flex gap-2"><FileCheck2 className="h-4 w-4"/> Evidence & Escalation</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span>Evidence verification</span><Badge variant="outline">{report.evidenceVerification?.passed?'PASSED':report.evidenceVerification?'FAILED':'PENDING'}</Badge></div><div><span className="text-muted-foreground">Evidence score</span><p className="font-semibold">{report.evidenceVerification?.score ?? '—'}/100</p></div><div><span className="text-muted-foreground">Escalated to</span><p className="font-semibold">{report.escalatedTo || 'None'}</p></div><div><span className="text-muted-foreground">Current status</span><p className="font-semibold">{report.status}</p></div></CardContent></Card>
    </div>
  </div>;
}
