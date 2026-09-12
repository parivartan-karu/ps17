'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { collection, orderBy, query, where, DocumentData, Query } from 'firebase/firestore';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { AlertTriangle, BellRing, Bot, CheckCircle2, ChevronRight, Clock3, Flame, MapPin, ShieldAlert, Users, Wrench } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const HeatMap = dynamic(() => import('@/components/heat-map'), { ssr: false });
const ACTIVE = ['Submitted', 'Under Verification', 'Assigned', 'In Progress'];

function timeLeft(deadline?: string) {
  if (!deadline) return 'No SLA';
  const diff = new Date(deadline).getTime() - Date.now();
  if (diff <= 0) return 'BREACHED';
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function SmcDashboard() {
  const firestore = useFirestore();
  const [queue, setQueue] = useState<'risk' | 'escalated' | 'unassigned' | 'clusters'>('risk');

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'), orderBy('timestamp', 'desc'));
  }, [firestore]) as Query<DocumentData> | null;
  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]) as Query<DocumentData> | null;

  const { data: rawReports = [], isLoading } = useCollection<Report>(reportsQuery);
  const { data: workers = [] } = useCollection<UserType>(workersQuery);
  const reports = (rawReports ?? []).filter(r => r.category && r.category.toLowerCase() !== 'none');
  const active = reports.filter(r => ACTIVE.includes(r.status));

  const metrics = useMemo(() => ({
    critical: active.filter(r => r.priority === 'Critical').length,
    slaRisk: active.filter(r => r.slaBreached || (r.slaDeadline && new Date(r.slaDeadline).getTime() - Date.now() < 4 * 3600000)).length,
    escalated: active.filter(r => (r.escalationLevel ?? 0) > 0 || !!r.escalatedTo).length,
    unassigned: active.filter(r => !r.assignedWorkerId).length,
  }), [active]);

  const queues = useMemo(() => {
    const risk = active.filter(r => r.priority === 'Critical' || r.slaBreached || (r.slaDeadline && new Date(r.slaDeadline).getTime() - Date.now() < 4 * 3600000)).sort((a,b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    const escalated = active.filter(r => (r.escalationLevel ?? 0) > 0 || !!r.escalatedTo).sort((a,b) => (b.escalationLevel ?? 0) - (a.escalationLevel ?? 0));
    const unassigned = active.filter(r => !r.assignedWorkerId).sort((a,b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));
    const clusters = Object.entries(active.reduce<Record<string, Report[]>>((acc, r) => {
      const key = r.linkedIncidentId || (r.relatedReportCount && r.relatedReportCount > 1 ? `cluster:${r.location?.split(',')[0] || r.id}` : '');
      if (key) (acc[key] ||= []).push(r);
      return acc;
    }, {})).filter(([, rs]) => rs.length > 1).sort((a,b) => b[1].length-a[1].length).slice(0,8);
    return { risk, escalated, unassigned, clusters };
  }, [active]);

  const departmentWorkload = useMemo(() => Object.entries(active.reduce<Record<string, number>>((a,r) => { const d=r.department || 'Unassigned'; a[d]=(a[d]||0)+1; return a; }, {})).sort((a,b)=>b[1]-a[1]).slice(0,8), [active]);
  const workerWorkload = useMemo(() => [...(workers ?? [])].sort((a,b)=>(b.activeTasks??0)-(a.activeTasks??0)).slice(0,8), [workers]);
  const agentActivity = useMemo(() => reports.flatMap(r => (r.agentLogs || []).map(log => ({...log, reportId:r.id, category:r.category}))).sort((a,b)=>new Date(b.timestamp).getTime()-new Date(a.timestamp).getTime()).slice(0,10), [reports]);
  const mapData = active.filter(r => r.latitude && r.longitude).map(r => ({ lat:r.latitude!, lng:r.longitude!, location:r.location, status:r.status, type:r.category, category:r.category, department:r.department, reportId:r.id, imageUrl:r.imageUrl, description:r.description, priority:r.priority, date:new Date(r.timestamp).toLocaleDateString('en-IN'), count:1 }));

  const selected = queue === 'risk' ? queues.risk : queue === 'escalated' ? queues.escalated : queue === 'unassigned' ? queues.unassigned : [];

  return <div className="space-y-4 pb-10">
    <div className="flex items-center justify-between border-b pb-4">
      <div><p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">PMC Central Administration</p><h1 className="text-2xl font-black tracking-tight">Command Center</h1><p className="text-sm text-muted-foreground">City-wide operational picture, exceptions and incident control.</p></div>
      <Badge className="gap-2 px-3 py-1"><span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"/> LIVE</Badge>
    </div>

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {[
        { label: 'Critical', value: metrics.critical, cls: 'border-red-200 bg-red-50', Icon: Flame },
        { label: 'SLA at Risk', value: metrics.slaRisk, cls: 'border-amber-200 bg-amber-50', Icon: Clock3 },
        { label: 'Escalated', value: metrics.escalated, cls: 'border-orange-200 bg-orange-50', Icon: ShieldAlert },
        { label: 'Unassigned', value: metrics.unassigned, cls: 'border-blue-200 bg-blue-50', Icon: Users },
      ].map(({ label, value, cls, Icon }) => <Card key={label} className={cls}><CardContent className="p-4"><div className="flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wider">{label}</span><Icon className="h-4 w-4"/></div><div className="mt-2 text-3xl font-black">{value}</div></CardContent></Card>)}
    </div>

    <div className="grid lg:grid-cols-[1.15fr_.85fr] gap-4">
      <Card className="overflow-hidden"><CardHeader className="pb-2"><div className="flex items-center justify-between"><CardTitle className="text-base">Operational Queues</CardTitle><div className="flex gap-1"><Button size="sm" variant={queue==='risk'?'default':'outline'} onClick={()=>setQueue('risk')}>SLA Risk</Button><Button size="sm" variant={queue==='escalated'?'default':'outline'} onClick={()=>setQueue('escalated')}>Escalations</Button><Button size="sm" variant={queue==='unassigned'?'default':'outline'} onClick={()=>setQueue('unassigned')}>Unassigned</Button><Button size="sm" variant={queue==='clusters'?'default':'outline'} onClick={()=>setQueue('clusters')}>Clusters</Button></div></div></CardHeader><CardContent className="p-0">
        {queue==='clusters' ? queues.clusters.map(([id,rs]) => <Link href={`/smc/incident/${rs[0].id}`} key={id} className="flex items-center justify-between border-t px-4 py-3 hover:bg-muted/50"><div><p className="font-semibold">Incident cluster #{rs[0].id.slice(0,8)}</p><p className="text-xs text-muted-foreground">{rs.length} related reports · {rs[0].category} · {rs[0].location}</p></div><ChevronRight className="h-4 w-4"/></Link>) : selected.slice(0,10).map(r => <Link href={`/smc/incident/${r.id}`} key={r.id} className="flex items-center justify-between border-t px-4 py-3 hover:bg-muted/50"><div className="min-w-0"><div className="flex items-center gap-2"><span className="font-bold truncate">#{r.id.slice(0,8)} · {r.category}</span><Badge variant="outline">{r.priority}</Badge></div><p className="text-xs text-muted-foreground truncate">{r.department} · {r.location}</p></div><div className="text-right ml-3"><p className="text-xs font-bold">{r.slaBreached ? 'BREACHED' : timeLeft(r.slaDeadline)}</p><p className="text-[10px] text-muted-foreground">Risk {r.riskScore ?? '—'}</p></div></Link>)}
        {!isLoading && ((queue==='clusters' ? queues.clusters.length : selected.length)===0) && <div className="p-8 text-center text-sm text-muted-foreground">No active exceptions in this queue.</div>}
      </CardContent></Card>

      <Card><CardHeader className="pb-2"><CardTitle className="text-base">Department Workload</CardTitle></CardHeader><CardContent className="space-y-3">{departmentWorkload.map(([name,count]) => <div key={name}><div className="flex justify-between text-sm mb-1"><span>{name}</span><b>{count}</b></div><div className="h-2 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary" style={{width:`${Math.min(100,count/Math.max(1,active.length)*100)}%`}}/></div></div>)}{departmentWorkload.length===0&&<p className="text-sm text-muted-foreground">No active workload.</p>}</CardContent></Card>
    </div>

    <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
      <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Wrench className="h-4 w-4"/> Worker Workload</CardTitle></CardHeader><CardContent className="space-y-2">{workerWorkload.map(w => <div key={w.id} className="flex justify-between items-center border-b last:border-0 py-2"><div><p className="font-medium">{w.name}</p><p className="text-xs text-muted-foreground">{w.department || 'Unassigned'}</p></div><Badge variant={(w.activeTasks??0)>=(w.maxTaskCapacity??5)?'destructive':'secondary'}>{w.activeTasks??0}/{w.maxTaskCapacity??5}</Badge></div>)}</CardContent></Card>
      <Card><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4"/> Agent Activity</CardTitle></CardHeader><CardContent className="space-y-2">{agentActivity.map((a,i)=><div key={`${a.reportId}-${i}`} className="border-b last:border-0 py-2"><div className="flex justify-between gap-2"><span className="font-medium text-sm">{a.agent}</span><Badge variant="outline">{a.status}</Badge></div><p className="text-xs text-muted-foreground truncate">#{a.reportId.slice(0,8)} · {a.outputSummary || a.reasoning || 'Decision recorded'}</p></div>)}{agentActivity.length===0&&<p className="text-sm text-muted-foreground">Agent decisions will appear here.</p>}</CardContent></Card>
    </div>

    <Card className="overflow-hidden"><CardHeader className="pb-2"><CardTitle className="text-base flex items-center gap-2"><MapPin className="h-4 w-4"/> Live Incident Map</CardTitle></CardHeader><CardContent className="p-0 h-[420px]">{!isLoading&&<HeatMap data={mapData} selectedCategories={[]} selectedStatuses={[]} focusLocation={null}/>}</CardContent></Card>
  </div>;
}
