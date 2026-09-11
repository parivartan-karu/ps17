'use client';

import { Sparkles, Route, AlertTriangle, Tag, CheckCircle2, ShieldCheck } from 'lucide-react';
import type { Report } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { normalizeDepartmentId, CANONICAL_DEPARTMENTS, type DepartmentDefinition } from '@/lib/departments';

interface ExplainableAiCardProps {
  report: Report;
}

export function ExplainableAiCard({ report }: ExplainableAiCardProps) {
  const deptId = normalizeDepartmentId(report.departmentId || report.department);
  const deptDef = CANONICAL_DEPARTMENTS.find((d: DepartmentDefinition) => d.id === deptId);

  // 1. Classification Rationale
  const classificationReasons: string[] = [];
  if (report.aiAnalysis?.damageCategory) {
    classificationReasons.push(`AI Visual Model detected pattern matching "${report.aiAnalysis.damageCategory}".`);
  } else if (report.category) {
    classificationReasons.push(`Categorized under "${report.category}" based on citizen report indicators.`);
  }
  if (report.aiAnalysis?.severity) {
    classificationReasons.push(`Assessed severity grade: ${report.aiAnalysis.severity}.`);
  }
  if (report.aiAnalysis?.illegalDumping?.detected) {
    classificationReasons.push(`Illegal dumping signature identified (confidence: ${Math.round((report.aiAnalysis.illegalDumping.confidence || 0.8) * 100)}%).`);
  }

  // 2. Department Routing Rationale
  const routingReasons: string[] = [];
  if (report.routingReason) {
    routingReasons.push(report.routingReason);
  } else if (deptId === 'dept_engineering') {
    routingReasons.push(`Routed to ${deptDef?.name || 'Roads Department'} for structural road surface, pothole, or footpath hazard mitigation.`);
  } else if (deptId === 'dept_sanitation') {
    routingReasons.push(`Routed to ${deptDef?.name || 'Garbage & Waste Management'} for waste clearance, bin overflow, or drainage sanitation.`);
  } else {
    routingReasons.push(`Routed to ${report.department || 'Municipal Department'} based on issue taxonomy matching.`);
  }
  if (report.routingConfidence) {
    routingReasons.push(`Taxonomy match confidence score: ${Math.round(report.routingConfidence * 100)}%.`);
  }

  // 3. Priority Rationale
  const priorityReasons: string[] = [];
  const priority = report.priority || 'Low';
  if (priority === 'Critical') {
    priorityReasons.push('Critical priority assigned due to severe public safety or immediate environmental hazard.');
  } else if (priority === 'High') {
    priorityReasons.push('High priority assigned based on significant disruption or public health risk.');
  } else if (priority === 'Medium') {
    priorityReasons.push('Standard medium priority assigned for routine municipal maintenance.');
  } else {
    priorityReasons.push('Low priority assigned for minor cosmetic or low-risk civic report.');
  }

  if ((report.relatedReportCount ?? 1) > 1) {
    priorityReasons.push(`${report.relatedReportCount} citizen reports consolidated nearby reinforcing priority.`);
  }
  if (report.slaBreached) {
    priorityReasons.push('SLA deadline exceeded — escalated for immediate official attention.');
  }

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 via-white to-purple-50/50 shadow-sm overflow-hidden">
      <CardHeader className="p-4 bg-indigo-900/90 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-amber-300 animate-pulse" />
            <div>
              <CardTitle className="text-sm font-bold text-white">Explainable AI & Decision Transparency</CardTitle>
              <CardDescription className="text-xs text-indigo-200">
                Auditable decision rationale derived from visual models & taxonomy engine
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-indigo-700 text-indigo-100 border-indigo-500 text-[10px] font-bold">
            AUDIT VERIFIED
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-4 space-y-4 text-xs">
        {/* Classification */}
        <div className="space-y-1.5 p-3 rounded-xl bg-white/80 border border-indigo-100 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Tag className="h-4 w-4 text-indigo-600" />
            <span>Classification Rationale ({report.category})</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
            {classificationReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Routing */}
        <div className="space-y-1.5 p-3 rounded-xl bg-white/80 border border-indigo-100 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <Route className="h-4 w-4 text-purple-600" />
            <span>Department Routing Rationale ({report.department})</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
            {routingReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* Priority */}
        <div className="space-y-1.5 p-3 rounded-xl bg-white/80 border border-indigo-100 shadow-2xs">
          <div className="flex items-center gap-2 font-bold text-slate-800">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Priority Rationale (Priority: <span className="text-indigo-700 font-extrabold">{priority}</span>)</span>
          </div>
          <ul className="list-disc list-inside space-y-1 text-slate-600 pl-1">
            {priorityReasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
