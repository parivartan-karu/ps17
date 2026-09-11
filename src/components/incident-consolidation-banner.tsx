'use client';

import { useState } from 'react';
import { Layers, Link2, Unlink, Users, ShieldAlert, CheckCircle2, Loader2 } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/firebase';
import { buildAuthHeaders } from '@/lib/client-auth';
import { useToast } from '@/hooks/use-toast';

interface IncidentConsolidationBannerProps {
  report: Report;
  onRefresh?: () => void;
}

export function IncidentConsolidationBanner({
  report,
  onRefresh,
}: IncidentConsolidationBannerProps) {
  const auth = useAuth();
  const { toast } = useToast();

  const [linkInput, setLinkInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInput, setShowInput] = useState(false);

  const isMasterIncident = (report.relatedReportCount ?? 0) > 1 || (!report.linkedIncidentId && (report.relatedReportCount ?? 0) > 0);
  const isLinkedChild = !!report.linkedIncidentId;
  const relatedCount = report.relatedReportCount ?? 1;

  async function handleLinkAction(action: 'link' | 'unlink') {
    setIsSubmitting(true);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const res = await fetch('/api/dept/incidents/link', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reportId: report.id,
          masterIncidentId: action === 'link' ? linkInput.trim() : undefined,
          action,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast({
        title: action === 'link' ? '🔗 Incident Linked' : '🔓 Incident Unlinked',
        description: action === 'link' ? `Linked to master incident #${linkInput.slice(0, 8)}` : 'Report unlinked from master incident.',
      });

      setLinkInput('');
      setShowInput(false);
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({ title: 'Linking action failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-indigo-100 bg-gradient-to-r from-indigo-50/70 via-purple-50/40 to-white shadow-sm overflow-hidden">
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white font-bold shadow-md">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm font-bold text-slate-900">Incident & Duplicate Consolidation</h4>
                {isMasterIncident && (
                  <Badge className="bg-indigo-600 text-white text-[10px] font-bold px-2 py-0.5">
                    MASTER INCIDENT
                  </Badge>
                )}
                {isLinkedChild && (
                  <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-bold px-2 py-0.5">
                    LINKED DUPLICATE
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-600 font-medium mt-0.5">
                {isLinkedChild
                  ? `Linked to Parent Master Incident #${report.linkedIncidentId?.slice(0, 8)}`
                  : `${relatedCount} Citizen Report${relatedCount > 1 ? 's' : ''} Consolidated under single operational workflow`
                }
              </p>
            </div>
          </div>

          {/* Quick Override Actions */}
          <div className="flex items-center gap-2 self-end sm:self-center">
            {isLinkedChild ? (
              <Button
                size="sm"
                variant="outline"
                disabled={isSubmitting}
                className="h-8 text-xs font-semibold rounded-xl border-amber-300 text-amber-800 hover:bg-amber-100"
                onClick={() => handleLinkAction('unlink')}
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Unlink className="h-3.5 w-3.5 mr-1" />}
                Unlink Incident
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold rounded-xl border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                onClick={() => setShowInput(!showInput)}
              >
                <Link2 className="h-3.5 w-3.5 mr-1" />
                {showInput ? 'Cancel' : 'Link to Master Incident'}
              </Button>
            )}
          </div>
        </div>

        {/* Input box for linking */}
        {showInput && !isLinkedChild && (
          <div className="pt-2 border-t border-indigo-100 flex items-center gap-2">
            <Input
              placeholder="Enter Master Report ID (e.g. rep_123456)..."
              value={linkInput}
              onChange={e => setLinkInput(e.target.value)}
              className="h-9 text-xs rounded-xl bg-white"
            />
            <Button
              size="sm"
              disabled={isSubmitting || !linkInput.trim()}
              className="h-9 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              onClick={() => handleLinkAction('link')}
            >
              {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : 'Confirm Link'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
