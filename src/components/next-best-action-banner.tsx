'use client';

import { Lightbulb, AlertTriangle, ArrowRight, ShieldAlert, CheckCircle2, Clock } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Button } from '@/components/ui/button';

interface NextBestActionBannerProps {
  report: Report;
  onActionClick?: (actionType: string) => void;
}

export function NextBestActionBanner({ report, onActionClick }: NextBestActionBannerProps) {
  const prio = report.priority || 'Medium';
  const isBreached = report.slaBreached;
  const isUnassigned = !report.assignedWorkerId && !report.assignedContractor;
  const routingGate = report.routingGate || (report.routingConfidence && report.routingConfidence < 0.65 ? 'manual_review' : 'automatic');
  const isUnderVerification = report.status === 'Under Verification';

  let actionTitle = 'Optimal Workflow Guidance';
  let actionDescription = 'Standard operational sequence in progress.';
  let badgeText = 'RECOMMENDED ACTION';
  let badgeBg = 'bg-indigo-600 text-white';
  let actionType = 'view_details';

  if (isBreached) {
    actionTitle = '🚨 SLA Breached: Executive Escalation Action Required';
    actionDescription = 'This ticket has breached its resolution deadline. Immediately assign priority worker or invoke administrative override.';
    badgeText = 'URGENT ESCALATION';
    badgeBg = 'bg-red-600 text-white';
    actionType = 'escalate_assign';
  } else if (routingGate === 'manual_review' || report.requiresManualReview) {
    actionTitle = '⚠️ Manual Review Required (AI Confidence < 65%)';
    actionDescription = 'Review complaint category and department routing before dispatching field crews.';
    badgeText = 'TRIAGE AUDIT';
    badgeBg = 'bg-amber-600 text-white';
    actionType = 'review_routing';
  } else if (routingGate === 'department_verification') {
    actionTitle = '🔍 Department Verification Recommended';
    actionDescription = 'Moderate AI confidence (65-84%). Department officer verification recommended before worker dispatch.';
    badgeText = 'VERIFY DEPT';
    badgeBg = 'bg-blue-600 text-white';
    actionType = 'verify_dept';
  } else if (isUnassigned) {
    actionTitle = '👤 Dispatch Best Recommended Worker';
    actionDescription = 'Multiple eligible workers available with remaining capacity and ward proximity matching.';
    badgeText = 'WORKER DISPATCH';
    badgeBg = 'bg-emerald-600 text-white';
    actionType = 'assign_worker';
  } else if (isUnderVerification) {
    actionTitle = '📸 Audit Completion Evidence';
    actionDescription = 'Worker submitted resolution media. Execute Evidence Verification Agent to approve or request rework.';
    badgeText = 'EVIDENCE AUDIT';
    badgeBg = 'bg-purple-600 text-white';
    actionType = 'audit_evidence';
  } else {
    actionTitle = '✅ Operations Proceeding Normally';
    actionDescription = `Assigned to ${report.assignedContractor || 'Worker'}. SLA countdown active.`;
    badgeText = 'IN PROGRESS';
    badgeBg = 'bg-slate-700 text-white';
    actionType = 'track_progress';
  }

  return (
    <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-900 via-slate-900 to-indigo-950 p-4 text-white shadow-lg overflow-hidden relative">
      <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5">
            <Lightbulb className="h-5 w-5 text-amber-300 animate-pulse" />
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${badgeBg}`}>
                {badgeText}
              </span>
              <span className="text-xs font-semibold text-indigo-200">Next Best Action</span>
            </div>

            <h4 className="text-sm font-bold text-white">{actionTitle}</h4>
            <p className="text-xs text-slate-300 max-w-2xl">{actionDescription}</p>
          </div>
        </div>

        {onActionClick && (
          <Button
            onClick={() => onActionClick(actionType)}
            size="sm"
            className="shrink-0 bg-white text-indigo-950 hover:bg-indigo-50 font-bold text-xs shadow-md border border-indigo-200 self-center"
          >
            Execute Action <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
