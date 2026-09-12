'use client';

import { useMemo } from 'react';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, UserCheck, MapPin, Award } from 'lucide-react';
import type { Report, User as UserType } from '@/lib/types';
import { rankWorkersForReport, type WorkerRecommendationResult, type WorkerRecommendationBadge } from '@/lib/smart-assignment';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

interface SmartWorkerSelectorProps {
  workers: UserType[];
  report: Report;
  selectedWorkerId: string;
  onSelectWorker: (workerId: string) => void;
  disabled?: boolean;
}

const badgeStyles: Record<WorkerRecommendationBadge, { bg: string; icon: React.ReactNode }> = {
  'Best Recommended': {
    bg: 'bg-purple-600 text-white border-purple-700 shadow-sm',
    icon: <Sparkles className="h-3 w-3 mr-1 animate-pulse" />,
  },
  Available: {
    bg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    icon: <CheckCircle2 className="h-3 w-3 mr-1 text-emerald-600" />,
  },
  Busy: {
    bg: 'bg-amber-100 text-amber-800 border-amber-300',
    icon: <AlertTriangle className="h-3 w-3 mr-1 text-amber-600" />,
  },
  'At Capacity': {
    bg: 'bg-rose-100 text-rose-800 border-rose-300',
    icon: <XCircle className="h-3 w-3 mr-1 text-rose-600" />,
  },
  Ineligible: {
    bg: 'bg-slate-100 text-slate-600 border-slate-300',
    icon: <XCircle className="h-3 w-3 mr-1 text-slate-500" />,
  },
};

export function SmartWorkerSelector({
  workers,
  report,
  selectedWorkerId,
  onSelectWorker,
  disabled = false,
}: SmartWorkerSelectorProps) {
  const ranked = useMemo(() => rankWorkersForReport(workers, report), [workers, report]);

  if (ranked.length === 0) {
    return (
      <div className="p-4 text-center rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-500">
        No workers available for this department.
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Award className="h-3.5 w-3.5 text-indigo-600" /> Smart Recommended Field Workers
        </label>
        <span className="text-[11px] text-slate-500 font-medium">
          {ranked.filter(r => r.isEligible).length} Eligible Workers
        </span>
      </div>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {ranked.map(item => {
          const { worker, isEligible, score, badge, reason, skillMatchLabel, wardMatchLabel } = item;
          const isSelected = selectedWorkerId === worker.id;
          const activeTasks = worker.activeTasks ?? 0;
          const maxCapacity = worker.maxTaskCapacity ?? 5;
          const pct = Math.round((activeTasks / maxCapacity) * 100);

          return (
            <div
              key={worker.id}
              onClick={() => {
                if (isEligible && !disabled) {
                  onSelectWorker(worker.id);
                }
              }}
              className={`p-3 rounded-2xl border transition-all cursor-pointer ${isSelected
                  ? 'border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-500/20 shadow-md'
                  : isEligible
                    ? 'border-slate-200 bg-white hover:border-indigo-300 hover:shadow-sm'
                    : 'border-slate-200 bg-slate-50/60 opacity-60 cursor-not-allowed'
                }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`h-9 w-9 rounded-full font-bold text-xs flex items-center justify-center shrink-0 shadow-sm ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                    {worker.name?.charAt(0)?.toUpperCase() ?? 'W'}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 truncate">{worker.name}</span>
                      <Badge className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center ${badgeStyles[badge].bg}`}>
                        {badgeStyles[badge].icon}
                        {badge}
                      </Badge>
                      {isEligible && (
                        <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-100 px-1.5 py-0.2 rounded-md">
                          {score} pts
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                      <span className="font-medium">{worker.designation || worker.specialization || 'Field Operator'}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-slate-400" />
                        {wardMatchLabel}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-slate-700">{activeTasks}/{maxCapacity}</span>
                  <p className="text-[10px] text-slate-400">tasks</p>
                </div>
              </div>

              {/* Progress & Recommendation Reason */}
              <div className="mt-2 pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                <div className="flex-1 max-w-[180px]">
                  <Progress value={pct} className="h-1.5 bg-slate-200 [&>div]:bg-indigo-600" />
                </div>
                <p className="text-[11px] font-semibold text-indigo-900 bg-indigo-50/80 px-2 py-0.5 rounded-md truncate max-w-full">
                  💡 {reason}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
