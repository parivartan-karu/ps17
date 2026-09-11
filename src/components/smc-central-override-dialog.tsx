'use client';

import { useState } from 'react';
import { ShieldAlert, AlertTriangle, RefreshCw, UserCheck, Layers, Clock } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/firebase';
import { buildAuthHeaders } from '@/lib/client-auth';
import { useToast } from '@/hooks/use-toast';
import { CANONICAL_DEPARTMENTS } from '@/lib/departments';
import type { Report, ReportStatus, User } from '@/lib/types';
import type { OverrideActionType } from '@/app/api/smc/override/route';

interface SmcCentralOverrideDialogProps {
  report: Report;
  workers?: User[];
  onSuccess?: () => void;
  triggerButton?: React.ReactNode;
}

export function SmcCentralOverrideDialog({
  report,
  workers = [],
  onSuccess,
  triggerButton,
}: SmcCentralOverrideDialogProps) {
  const auth = useAuth();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [actionType, setActionType] = useState<OverrideActionType>('reassign_department');
  const [reason, setReason] = useState('');
  const [targetDepartmentId, setTargetDepartmentId] = useState(report.departmentId || 'dept_public_works');
  const [targetWorkerId, setTargetWorkerId] = useState(report.assignedWorkerId || '');
  const [targetPriority, setTargetPriority] = useState<'Low' | 'Medium' | 'High' | 'Critical'>(report.priority || 'Medium');
  const [targetStatus, setTargetStatus] = useState<ReportStatus>(report.status);

  async function handleExecuteOverride() {
    if (!auth) {
      toast({ title: 'Auth Error', description: 'You must be logged in.', variant: 'destructive' });
      return;
    }

    if (!reason || reason.trim().length < 5) {
      toast({ title: 'Justification Required', description: 'Please provide a valid reason (minimum 5 chars).', variant: 'destructive' });
      return;
    }

    setIsSubmitting(true);

    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const res = await fetch('/api/smc/override', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          reportId: report.id,
          actionType,
          reason: reason.trim(),
          targetDepartmentId,
          targetWorkerId,
          targetPriority,
          targetStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.details || 'Central override failed.');
      }

      toast({
        title: '🛡️ Central Override Recorded',
        description: `Action "${actionType}" executed and audited successfully.`,
      });

      setOpen(false);
      setReason('');
      if (onSuccess) onSuccess();
    } catch (err: any) {
      toast({
        title: 'Override Failed',
        description: err.message || 'Error processing central override.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" size="sm" className="gap-1.5 border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950/30">
            <ShieldAlert className="h-4 w-4 text-red-600" />
            Central Override
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
            <ShieldAlert className="h-5 w-5" />
            Central Administrative Override
          </DialogTitle>
          <DialogDescription>
            Override automated routing, department ownership, or SLA parameters for Report #{report.id.slice(0, 8)}.
            Every action writes an immutable audit record.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Action selection */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Override Type</label>
            <Select value={actionType} onValueChange={(val) => setActionType(val as OverrideActionType)}>
              <SelectTrigger>
                <SelectValue placeholder="Select override action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reassign_department">🏢 Reassign Department</SelectItem>
                <SelectItem value="reassign_worker">👷 Reassign Worker</SelectItem>
                <SelectItem value="override_priority">⚡ Override Priority</SelectItem>
                <SelectItem value="override_status">📋 Override Status</SelectItem>
                <SelectItem value="force_escalation">🚨 Force Escalation</SelectItem>
                <SelectItem value="reset_sla">⏳ Reset SLA Clock</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action-specific fields */}
          {actionType === 'reassign_department' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Target Department</label>
              <Select value={targetDepartmentId} onValueChange={setTargetDepartmentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {CANONICAL_DEPARTMENTS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'reassign_worker' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">Select Worker</label>
              <Select value={targetWorkerId} onValueChange={setTargetWorkerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose worker" />
                </SelectTrigger>
                <SelectContent>
                  {workers.length === 0 ? (
                    <SelectItem value="none" disabled>No workers available</SelectItem>
                  ) : (
                    workers.map((w) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name} ({w.department || 'Field Staff'}) - Tasks: {w.activeTasks ?? 0}/{w.maxTaskCapacity ?? 5}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'override_priority' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">New Priority Level</label>
              <Select value={targetPriority} onValueChange={(val) => setTargetPriority(val as any)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Critical">🔴 Critical (Immediate)</SelectItem>
                  <SelectItem value="High">🟠 High (4h)</SelectItem>
                  <SelectItem value="Medium">🟡 Medium (8h)</SelectItem>
                  <SelectItem value="Low">🟢 Low (12h)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'override_status' && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500">New Status</label>
              <Select value={targetStatus} onValueChange={(val) => setTargetStatus(val as ReportStatus)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Submitted">Submitted</SelectItem>
                  <SelectItem value="Under Verification">Under Verification</SelectItem>
                  <SelectItem value="Assigned">Assigned</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {actionType === 'force_escalation' && (
            <div className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800 border border-amber-200">
              <p className="font-semibold flex items-center gap-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Immediate Escalation Trigger
              </p>
              <p className="mt-1">
                Will advance current escalation level to Level {(report.escalationLevel ?? 0) + 1} and alert PMC leadership.
              </p>
            </div>
          )}

          {actionType === 'reset_sla' && (
            <div className="rounded-lg bg-blue-50 p-3 text-xs text-blue-800 border border-blue-200">
              <p className="font-semibold flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-600" />
                Reset Resolution Deadline
              </p>
              <p className="mt-1">
                Extends resolution deadline by 24 hours and clears active breach warnings.
              </p>
            </div>
          )}

          {/* Mandatory reason */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Mandatory Override Justification <span className="text-red-500">*</span>
            </label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="State clear operational reason for overriding standard workflow rules (required for audit)..."
              rows={3}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleExecuteOverride}
            disabled={isSubmitting || !reason || reason.trim().length < 5}
            className="bg-red-600 hover:bg-red-700 text-white gap-1.5"
          >
            {isSubmitting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldAlert className="h-4 w-4" />
            )}
            Confirm Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
