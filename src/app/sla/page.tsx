'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Clock, ShieldAlert } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { DEFAULT_SLA_CONFIG, type PriorityLevel, type SlaConfig } from '@/lib/sla';
import { useEffect, useState } from 'react';

const priorityOrder: PriorityLevel[] = ['Critical', 'High', 'Medium', 'Low'];

const priorityBadgeColors: Record<PriorityLevel, string> = {
  Critical: 'bg-rose-100 text-rose-800 border-rose-300 font-bold',
  High: 'bg-amber-100 text-amber-800 border-amber-300 font-bold',
  Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300 font-semibold',
  Low: 'bg-emerald-100 text-emerald-800 border-emerald-300 font-medium',
};

export default function SLAPolicyPage() {
  const router = useRouter();
  const [config, setConfig] = useState<SlaConfig>(DEFAULT_SLA_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/sla-config/public', { cache: 'no-store' })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load SLA policy.');
        if (!cancelled && data.config?.global) {
          setConfig((current) => ({ ...current, ...data.config, global: { ...current.global, ...data.config.global } }));
        }
      })
      .catch(() => { /* Keep the safe default policy visible if the public read fails. */ })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-4xl space-y-6">
      <Button variant="outline" onClick={() => router.back()} className="rounded-xl">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back
      </Button>

      <Card className="border-slate-200 shadow-md overflow-hidden bg-white">
        <CardHeader className="bg-slate-900 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Badge className="bg-indigo-500 text-white text-[10px] font-bold px-2.5 py-0.5">
                PMC OFFICIAL POLICY
              </Badge>
              <CardTitle className="text-2xl md:text-3xl font-black text-white">
                Service Level Agreement (SLA) Policy
              </CardTitle>
            </div>
            <Clock className="h-8 w-8 text-indigo-400 opacity-80" />
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6 text-slate-600 text-sm">
          <p className="leading-relaxed">
            The <strong>Pune Municipal Corporation (PMC)</strong> is committed to providing timely, transparent, and authoritative resolution for all civic issues reported through the Parivartan platform. This Service Level Agreement (SLA) defines the mandatory response and resolution deadlines enforced across all municipal departments.
          </p>

          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-indigo-600" /> Key SLA Definitions
            </h3>
            <ul className="list-disc pl-5 space-y-2 text-slate-600">
              <li>
                <strong className="text-slate-800">Response SLA:</strong> Mandatory time window for a department official or worker to acknowledge and accept the complaint into active field queue.
              </li>
              <li>
                <strong className="text-slate-800">Resolution SLA:</strong> Authoritative total time window from initial report submission to work completion, evidence upload, and official resolution verification.
              </li>
              <li>
                <strong className="text-slate-800">Automated Escalation:</strong> If Response or Resolution deadlines are breached, the system automatically triggers Level 1 escalation to the Department Head and Level 2 escalation to PMC Central Administration.
              </li>
            </ul>
          </div>

          {/* Authoritative SLA Table from the live persisted configuration */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Authoritative SLA Targets</h3>
            <p className="text-xs text-slate-500">
              Target response and resolution deadlines from the live PMC SLA Engine configuration{loading ? ' (loading...)' : ''}:
            </p>

            <div className="rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
              <Table>
                <TableHeader className="bg-slate-100/80">
                  <TableRow>
                    <TableHead className="font-bold text-slate-700">Priority Level</TableHead>
                    <TableHead className="font-bold text-slate-700">Mandatory Response Target</TableHead>
                    <TableHead className="font-bold text-slate-700">Mandatory Resolution Target</TableHead>
                    <TableHead className="font-bold text-slate-700">Reminder Threshold</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-100">
                  {priorityOrder.map((prio) => {
                    const target = config.global[prio];
                    return (
                      <TableRow key={prio} className="hover:bg-slate-50/80">
                        <TableCell>
                          <Badge variant="outline" className={priorityBadgeColors[prio]}>
                            {prio} Priority
                          </Badge>
                        </TableCell>
                        <TableCell className="font-semibold text-slate-800">
                          {target.responseHours} Hours
                        </TableCell>
                        <TableCell className="font-bold text-indigo-700">
                          {target.resolutionHours} Hours ({target.resolutionHours / 24 < 1 ? `${target.resolutionHours}h` : `${target.resolutionHours / 24} Days`})
                        </TableCell>
                        <TableCell className="text-slate-500 text-xs">
                          {target.reminderBeforeBreachHours}h before breach
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          <div className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-base font-bold text-slate-900">Escalation Matrix</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a ticket exceeds its target deadline without official status updates, the PMC SLA Monitor triggers automated Level 1 escalation to the <strong>Department Head</strong>, followed by Level 2 escalation to the <strong>Municipal Commissioner & PMC Central Administration</strong>. Citizens receive automated notification at each escalation milestone.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
