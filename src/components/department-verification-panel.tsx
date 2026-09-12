'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ShieldCheck, CheckCircle2, RotateCcw, XCircle, Camera, FileText, Loader2, AlertCircle } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/firebase';
import { buildAuthHeaders } from '@/lib/client-auth';
import { useToast } from '@/hooks/use-toast';
import { ImageEyeViewer } from '@/components/image-eye-viewer';

interface DepartmentVerificationPanelProps {
  report: Report;
  onRefresh?: () => void;
}

export function DepartmentVerificationPanel({
  report,
  onRefresh,
}: DepartmentVerificationPanelProps) {
  const auth = useAuth();
  const { toast } = useToast();

  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasAfterWorkPhoto = !!report.afterWorkMediaUrl || !!report.imageUrl;
  const isPendingVerification = report.status === 'Under Verification' || report.workflowStage === 'pending_department';

  async function handleVerifyAction(action: 'approve' | 'rework' | 'reject') {
    if (action === 'rework' && !notes.trim()) {
      toast({ title: 'Rework instructions required', description: 'Please enter detailed rework instructions for the worker.', variant: 'destructive' });
      return;
    }

    if (action === 'approve' && !hasAfterWorkPhoto) {
      toast({ title: 'Evidence photo required', description: 'After-work photo evidence is required before approving resolution.', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);
    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const res = await fetch(`/api/dept/complaints/${report.id}/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, notes: notes.trim() }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const actionTitle = action === 'approve' ? '✅ Resolution Approved' : action === 'rework' ? '🔄 Rework Requested' : '❌ Resolution Rejected';
      toast({ title: actionTitle, description: `Status moved to ${data.status}` });

      setNotes('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast({ title: 'Verification action failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Card className="border-emerald-200 bg-white shadow-md overflow-hidden">
      <CardHeader className="p-4 bg-gradient-to-r from-emerald-600 to-teal-700 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-6 w-6 text-emerald-200" />
            <div>
              <CardTitle className="text-base font-bold text-white">Department Verification & Evidence Panel</CardTitle>
              <CardDescription className="text-xs text-emerald-100 font-medium">
                Authoritative verification of worker task completion & photo evidence
              </CardDescription>
            </div>
          </div>
          {isPendingVerification && (
            <Badge className="bg-amber-400 text-amber-950 font-black text-xs px-2.5 py-0.5 animate-pulse">
              PENDING VERIFICATION
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Evidence Photos Comparison (Before vs After) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Before Photo */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-slate-500" /> Before Work Evidence</span>
              <Badge variant="outline" className="text-[10px]">Citizen Upload</Badge>
            </div>
            {report.imageUrl ? (
              <ImageEyeViewer
                src={report.imageUrl}
                alt="Before Work Evidence"
                title="Citizen Upload - Before Work Evidence"
                heightClass="h-44"
              />
            ) : (
              <div className="h-44 w-full rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                No initial photo provided
              </div>
            )}
          </div>

          {/* After Photo */}
          <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span className="flex items-center gap-1.5"><Camera className="h-3.5 w-3.5 text-emerald-600" /> After Work Evidence</span>
              <Badge className={hasAfterWorkPhoto ? 'bg-emerald-600 text-white text-[10px]' : 'bg-rose-100 text-rose-700 text-[10px]'}>
                {hasAfterWorkPhoto ? 'Worker Uploaded' : 'Missing Photo'}
              </Badge>
            </div>
            {report.afterWorkMediaUrl ? (
              <ImageEyeViewer
                src={report.afterWorkMediaUrl}
                alt="After Work Evidence"
                title="Worker Upload - After Work Evidence"
                heightClass="h-44"
                mediaType={report.afterWorkMediaType}
              />
            ) : (
              <div className="h-44 w-full rounded-xl border border-dashed border-amber-300 bg-amber-50/50 flex flex-col items-center justify-center text-xs text-amber-700 p-4 text-center">
                <AlertCircle className="h-6 w-6 text-amber-500 mb-1" />
                <span>After-work photo evidence pending from worker.</span>
              </div>
            )}
            {report.afterWorkNotes && (
              <p className="text-xs text-slate-600 italic bg-white p-2 rounded-lg border text-[11px]">
                "{report.afterWorkNotes}"
              </p>
            )}
          </div>
        </div>

        {/* Verification Action Notes & Buttons */}
        {isPendingVerification && (
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5 text-indigo-600" /> Officer Verification Notes & Instructions
              </label>
              <Textarea
                placeholder="Enter notes (required if requesting rework)..."
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                className="text-xs rounded-xl border-slate-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
              <Button
                disabled={isSubmitting || !hasAfterWorkPhoto}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl h-10 shadow-sm"
                onClick={() => handleVerifyAction('approve')}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1.5" />}
                Approve Resolution
              </Button>

              <Button
                variant="outline"
                disabled={isSubmitting}
                className="border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 font-bold rounded-xl h-10"
                onClick={() => handleVerifyAction('rework')}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RotateCcw className="h-4 w-4 mr-1.5 text-amber-600" />}
                Request Rework
              </Button>

              <Button
                variant="outline"
                disabled={isSubmitting}
                className="border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100 font-bold rounded-xl h-10"
                onClick={() => handleVerifyAction('reject')}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1.5 text-rose-600" />}
                Reject Resolution
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
