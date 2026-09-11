'use client';

import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { 
  ShieldAlert, Trash2, Truck, AlertTriangle, CheckCircle2, XCircle, 
  Search, Filter, MapPin, Eye, FileText, IndianRupee, ShieldCheck, 
  Sparkles, RefreshCw, AlertCircle, ExternalLink, Scale, Clock, User
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth, useCollection, useMemoFirebase } from '@/firebase';
import { buildAuthHeaders } from '@/lib/client-auth';
import { collection, query, orderBy, DocumentData, Query } from 'firebase/firestore';
import type { Report, IllegalDumpingData } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';

// Dynamically import Leaflet Map to avoid SSR issues
const HeatMap = dynamic(() => import('@/components/heat-map'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[320px] bg-slate-100 dark:bg-slate-900 animate-pulse rounded-2xl flex flex-col items-center justify-center gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-600 border-t-transparent" />
      <p className="text-sm text-slate-500 font-medium">Loading Spatial Illegal Dumping Map…</p>
    </div>
  ),
});

export default function IllegalDumpingAdminPage() {
  const firestore = useFirestore();
  const auth = useAuth();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'VEHICLE_ONLY'>('ALL');
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Rejection modal state
  const [rejectionModalOpen, setRejectionModalOpen] = useState(false);
  const [rejectionReasonInput, setRejectionReasonInput] = useState('');

  // Fine modal / form state
  const [fineFormAmount, setFineFormAmount] = useState<number>(2000);
  const [fineFormStatus, setFineFormStatus] = useState<'ISSUED' | 'PENDING' | 'PAID' | 'DISPUTED' | 'CANCELLED'>('ISSUED');
  const [fineFormViolation, setFineFormViolation] = useState<string>('Unlawful Waste Dumping on Public Roadway');
  const [fineFormNoticeNo, setFineFormNoticeNo] = useState<string>('');
  const [fineFormNotes, setFineFormNotes] = useState<string>('');

  // Query all reports
  const allReportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'), orderBy('timestamp', 'desc'));
  }, [firestore]) as Query<DocumentData> | null;

  const { data: rawReports, isLoading } = useCollection<Report>(allReportsQuery);

  // Filter illegal dumping reports (either complaintType === 'Illegal Dumping' OR category === 'Garbage/Debris' OR illegalDumping field exists)
  const dumpingReports = useMemo(() => {
    return (rawReports ?? []).filter(r => 
      r.complaintType === 'Illegal Dumping' ||
      !!r.illegalDumping?.detected ||
      (r.category === 'Garbage/Debris' && r.aiAnalysis?.illegalDumping?.detected)
    );
  }, [rawReports]);

  // Compute Dashboard Metrics
  const metrics = useMemo(() => {
    const total = dumpingReports.length;
    const pending = dumpingReports.filter(r => (r.illegalDumping?.verificationStatus ?? 'PENDING') === 'PENDING').length;
    const verified = dumpingReports.filter(r => r.illegalDumping?.verificationStatus === 'VERIFIED').length;
    const rejected = dumpingReports.filter(r => r.illegalDumping?.verificationStatus === 'REJECTED' || r.illegalDumping?.verificationStatus === 'INSUFFICIENT_EVIDENCE').length;
    
    const vehicleDetected = dumpingReports.filter(r => r.illegalDumping?.vehicleDetected || r.aiAnalysis?.illegalDumping?.vehicleDetected).length;
    const readablePlates = dumpingReports.filter(r => r.illegalDumping?.licensePlateNumber || r.aiAnalysis?.illegalDumping?.licensePlateNumber).length;
    
    const finedReports = dumpingReports.filter(r => r.illegalDumping?.fineDetails?.status === 'ISSUED' || r.illegalDumping?.fineDetails?.status === 'PAID');
    const finesIssuedCount = finedReports.length;
    const totalFineAmount = finedReports.reduce((sum, r) => sum + (r.illegalDumping?.fineDetails?.amount ?? 0), 0);

    return {
      total,
      pending,
      verified,
      rejected,
      vehicleDetected,
      readablePlates,
      finesIssuedCount,
      totalFineAmount,
    };
  }, [dumpingReports]);

  // Repeat Offender Vehicle Tracking (vehicles with multiple verified violations)
  const repeatOffenders = useMemo(() => {
    const plateCounts: Record<string, { plate: string; count: number; lastDate: string; reports: Report[] }> = {};

    dumpingReports.forEach(r => {
      const plate = r.illegalDumping?.licensePlateNumber || r.aiAnalysis?.illegalDumping?.licensePlateNumber;
      const isVerified = r.illegalDumping?.verificationStatus === 'VERIFIED';
      if (plate && isVerified) {
        if (!plateCounts[plate]) {
          plateCounts[plate] = { plate, count: 0, lastDate: r.timestamp, reports: [] };
        }
        plateCounts[plate].count += 1;
        plateCounts[plate].reports.push(r);
        if (r.timestamp > plateCounts[plate].lastDate) {
          plateCounts[plate].lastDate = r.timestamp;
        }
      }
    });

    return Object.values(plateCounts).filter(v => v.count >= 2).sort((a, b) => b.count - a.count);
  }, [dumpingReports]);

  // Ward Hotspot Analytics
  const wardHotspots = useMemo(() => {
    const wardCounts: Record<string, { ward: string; total: number; verified: number; vehicleLinked: number }> = {};

    dumpingReports.forEach(r => {
      const ward = r.roadName || (r.location?.split(',')[0]) || 'General Ward';
      if (!wardCounts[ward]) {
        wardCounts[ward] = { ward, total: 0, verified: 0, vehicleLinked: 0 };
      }
      wardCounts[ward].total += 1;
      if (r.illegalDumping?.verificationStatus === 'VERIFIED') {
        wardCounts[ward].verified += 1;
      }
      if (r.illegalDumping?.vehicleDetected || r.aiAnalysis?.illegalDumping?.vehicleDetected) {
        wardCounts[ward].vehicleLinked += 1;
      }
    });

    return Object.values(wardCounts).sort((a, b) => b.total - a.total).slice(0, 5);
  }, [dumpingReports]);

  // Filtered Table Data
  const filteredReports = useMemo(() => {
    return dumpingReports.filter(r => {
      // Status filter
      const vStatus = r.illegalDumping?.verificationStatus ?? 'PENDING';
      if (statusFilter === 'PENDING' && vStatus !== 'PENDING') return false;
      if (statusFilter === 'VERIFIED' && vStatus !== 'VERIFIED') return false;
      if (statusFilter === 'REJECTED' && vStatus !== 'REJECTED' && vStatus !== 'INSUFFICIENT_EVIDENCE') return false;
      if (statusFilter === 'VEHICLE_ONLY') {
        const hasVehicle = r.illegalDumping?.vehicleDetected || r.aiAnalysis?.illegalDumping?.vehicleDetected;
        if (!hasVehicle) return false;
      }

      // Search query filter
      const q = searchQuery.trim().toLowerCase();
      if (!q) return true;

      const plate = (r.illegalDumping?.licensePlateNumber || r.aiAnalysis?.illegalDumping?.licensePlateNumber || '').toLowerCase();
      const loc = (r.location || '').toLowerCase();
      const desc = (r.description || '').toLowerCase();
      const id = (r.id || '').toLowerCase();

      return plate.includes(q) || loc.includes(q) || desc.includes(q) || id.includes(q);
    });
  }, [dumpingReports, statusFilter, searchQuery]);

  // Map markers
  const heatMapData = useMemo(() => {
    return filteredReports
      .filter(r => r.latitude && r.longitude)
      .map(r => {
        const vStatus = r.illegalDumping?.verificationStatus ?? 'PENDING';
        const hasFine = r.illegalDumping?.fineDetails?.status === 'ISSUED' || r.illegalDumping?.fineDetails?.status === 'PAID';

        let categoryName = 'Garbage/Debris';
        if (hasFine) categoryName = 'Fine Issued';
        else if (vStatus === 'VERIFIED') categoryName = 'Verified Violation';
        else if (vStatus === 'REJECTED') categoryName = 'Rejected';

        return {
          lat: r.latitude!,
          lng: r.longitude!,
          location: r.location || 'Pune City',
          status: r.status,
          type: categoryName,
          category: categoryName,
          department: r.department || 'Sanitation',
          reportId: r.id,
          imageUrl: r.imageUrl,
          description: `Plate: ${r.illegalDumping?.licensePlateNumber || 'Not Visible'} | Quality: ${r.illegalDumping?.evidenceQuality || 'fair'}`,
          priority: r.priority || 'High',
          date: new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
          count: 1,
        };
      });
  }, [filteredReports]);

  // Perform Manual Verification / Rejection API call
  const handleAction = async (
    action: 'VERIFY' | 'REJECT' | 'INSUFFICIENT_EVIDENCE' | 'ISSUE_FINE',
    rejectionReason?: string,
    fineData?: any
  ) => {
    if (!selectedReport) return;
    setIsUpdating(true);

    try {
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const res = await fetch('/api/smc/illegal-dumping', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({
          reportId: selectedReport.id,
          action,
          rejectionReason,
          fineDetails: fineData,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update case.');

      toast({
        title: action === 'VERIFY' ? 'Violation Verified' : action === 'REJECT' ? 'Report Rejected' : 'Enforcement Updated',
        description: data.message || 'The enforcement record has been updated successfully.',
      });

      setRejectionModalOpen(false);
      setSelectedReport(null);
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Action Failed',
        description: err.message || 'Could not update illegal dumping record.',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
      
      {/* ── Executive Header Banner ────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-purple-950 p-6 text-white shadow-xl border border-slate-800 md:p-8">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-purple-600/20 blur-3xl" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-purple-400 animate-pulse ring-4 ring-purple-400/20" />
              <span className="text-xs font-bold uppercase tracking-widest text-purple-300">PMC Enforcement Portal</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight flex items-center gap-2 text-white">
              <ShieldAlert className="h-7 w-7 text-purple-400 shrink-0" />
              Illegal Dumping Enforcement &amp; Analytics
            </h1>
            <p className="text-sm text-slate-300/80 mt-1 max-w-2xl">
              AI-assisted visual evidence analysis, vehicle registration plate extraction (OCR), manual officer verification, and municipal fine management.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <Badge variant="outline" className="border-purple-500/40 bg-purple-950/50 text-purple-200 px-3 py-1.5 text-xs font-semibold">
              🛡️ Evidence Assistance Active
            </Badge>
          </div>
        </div>
      </div>

      {/* ── Metric KPI Grid (Cards) ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium">Total Cases</p>
            <p className="text-2xl font-bold mt-1">{metrics.total}</p>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Pending</p>
            <p className="text-2xl font-bold text-amber-800 dark:text-amber-200 mt-1">{metrics.pending}</p>
          </CardContent>
        </Card>

        <Card className="border-emerald-200 bg-emerald-50/50 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">Verified</p>
            <p className="text-2xl font-bold text-emerald-800 dark:text-emerald-200 mt-1">{metrics.verified}</p>
          </CardContent>
        </Card>

        <Card className="border-red-200 bg-red-50/50 dark:border-red-900/40 dark:bg-red-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-red-700 dark:text-red-300 font-medium">Rejected</p>
            <p className="text-2xl font-bold text-red-800 dark:text-red-200 mt-1">{metrics.rejected}</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900/40 dark:bg-blue-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Vehicles</p>
            <p className="text-2xl font-bold text-blue-800 dark:text-blue-200 mt-1">{metrics.vehicleDetected}</p>
          </CardContent>
        </Card>

        <Card className="border-purple-200 bg-purple-50/50 dark:border-purple-900/40 dark:bg-purple-950/20">
          <CardContent className="p-4">
            <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">OCR Plates</p>
            <p className="text-2xl font-bold text-purple-800 dark:text-purple-200 mt-1">{metrics.readablePlates}</p>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50/50 dark:border-indigo-900/40 dark:bg-indigo-950/20 col-span-2">
          <CardContent className="p-4">
            <p className="text-xs text-indigo-700 dark:text-indigo-300 font-medium flex items-center gap-1">
              <IndianRupee className="h-3.5 w-3.5" /> Fines Issued &amp; Revenue
            </p>
            <div className="flex items-baseline justify-between mt-1">
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-100">{metrics.finesIssuedCount} <span className="text-xs font-normal text-muted-foreground">notices</span></p>
              <p className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">₹{metrics.totalFineAmount.toLocaleString('en-IN')}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Repeat Offender Vehicle Alert Banner ──────────────────────────── */}
      {repeatOffenders.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50/90 p-4 dark:border-red-900/50 dark:bg-red-950/40 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-red-500/10 p-2.5 text-red-600 dark:text-red-400 shrink-0">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-red-900 dark:text-red-200 uppercase tracking-wide">
                  Repeated Violations Detected (Vehicle History)
                </p>
                <Badge variant="destructive" className="text-[10px]">Municipal Enforcement Alert</Badge>
              </div>
              <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
                The following registration numbers match multiple manually <strong>VERIFIED</strong> illegal dumping incidents:
              </p>

              <div className="mt-3 flex flex-wrap gap-3">
                {repeatOffenders.map(off => (
                  <div key={off.plate} className="flex items-center gap-2 rounded-xl bg-white dark:bg-slate-900 border border-red-200 dark:border-red-900/60 px-3 py-1.5 shadow-sm">
                    <Truck className="h-4 w-4 text-red-500" />
                    <span className="font-mono font-bold text-sm text-red-900 dark:text-red-100">{off.plate}</span>
                    <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300 text-[10px] font-bold">
                      {off.count} Verified Cases
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      (Last: {new Date(off.lastDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-red-600/80 dark:text-red-400/80 mt-2 font-medium">
                Note: Displays verified municipal enforcement records only. Human authorization required before notice dispatch.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Main 2-Column Section: Interactive Map + Ward Analytics ───────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Spatial Illegal Dumping Map (8 cols) */}
        <Card className="lg:col-span-8 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 overflow-hidden shadow-sm">
          <CardHeader className="border-b pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-purple-600" />
                  Illegal Dumping Spatial Map
                </CardTitle>
                <CardDescription className="text-xs">
                  Spatial distribution of reported, verified, and fined dumping incidents across Pune wards.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-500" /> Pending</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Verified</span>
                <span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-blue-500" /> Fine Issued</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 h-[360px]">
            <HeatMap
              data={heatMapData}
              selectedCategories={[]}
              selectedStatuses={[]}
            />
          </CardContent>
        </Card>

        {/* Right Column: Ward Hotspots Analytics (4 cols) */}
        <Card className="lg:col-span-4 border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm flex flex-col">
          <CardHeader className="border-b pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-purple-600" />
              Dumping Hotspots by Ward
            </CardTitle>
            <CardDescription className="text-xs">
              Top administrative areas receiving repeated illegal waste reports.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
            {wardHotspots.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-6 text-center">No ward hotspot data available yet.</p>
            ) : (
              wardHotspots.map((h, idx) => (
                <div key={h.ward} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold text-xs">
                      #{idx + 1}
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{h.ward}</p>
                      <p className="text-[10px] text-muted-foreground">{h.verified} Verified | {h.vehicleLinked} Vehicles</p>
                    </div>
                  </div>
                  <Badge variant="secondary" className="font-bold text-xs">
                    {h.total} Reports
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>

      </div>

      {/* ── Enforcement Case Table Section ────────────────────────────────── */}
      <Card className="border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm">
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-600" />
                Illegal Dumping Case Records
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect visual evidence, check OCR extracted license plates, verify violations, and record municipal enforcement.
              </CardDescription>
            </div>

            {/* Filter Tabs & Search */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search plate, location, ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9 text-xs w-48 lg:w-64"
                />
              </div>

              <div className="flex items-center rounded-lg border bg-slate-50 p-1 dark:bg-slate-900">
                {(['ALL', 'PENDING', 'VERIFIED', 'REJECTED', 'VEHICLE_ONLY'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold transition-colors ${
                      statusFilter === tab
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab === 'ALL' ? 'All' : tab === 'PENDING' ? 'Pending' : tab === 'VERIFIED' ? 'Verified' : tab === 'REJECTED' ? 'Rejected' : 'Vehicles'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground animate-pulse">
              Loading illegal dumping cases...
            </div>
          ) : filteredReports.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ShieldAlert className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-semibold">No matching illegal dumping records found.</p>
              <p className="text-xs text-muted-foreground mt-0.5">Try clearing filters or search query.</p>
            </div>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b bg-slate-50/80 dark:bg-slate-900/80 text-muted-foreground font-semibold">
                  <th className="p-3 pl-4">Case ID</th>
                  <th className="p-3">Date &amp; Time</th>
                  <th className="p-3">Location &amp; Ward</th>
                  <th className="p-3">Waste Type</th>
                  <th className="p-3">Vehicle &amp; License Plate</th>
                  <th className="p-3">AI Confidence</th>
                  <th className="p-3">Evidence Quality</th>
                  <th className="p-3">Verification</th>
                  <th className="p-3">Fine Status</th>
                  <th className="p-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredReports.map(r => {
                  const dumping = r.illegalDumping || r.aiAnalysis?.illegalDumping;
                  const plate = dumping?.licensePlateNumber;
                  const vStatus = r.illegalDumping?.verificationStatus ?? 'PENDING';
                  const fineStatus = r.illegalDumping?.fineDetails?.status ?? 'NOT_ISSUED';
                  const confidencePct = Math.round((dumping?.confidence ?? 0.85) * 100);

                  return (
                    <tr key={r.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/50 transition-colors">
                      <td className="p-3 pl-4 font-mono font-bold text-slate-800 dark:text-slate-200">
                        #{r.id.slice(0, 8)}
                      </td>
                      <td className="p-3 text-muted-foreground whitespace-nowrap">
                        {new Date(r.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 max-w-[200px]">
                        <p className="truncate font-medium text-slate-900 dark:text-slate-100">{r.location}</p>
                        <p className="text-[10px] text-muted-foreground">{r.roadName || 'General Ward'}</p>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline" className="text-[10px] font-semibold">
                          {dumping?.wasteType || r.category || 'General Waste'}
                        </Badge>
                      </td>
                      <td className="p-3">
                        {plate ? (
                          <div className="inline-flex items-center gap-1 rounded bg-purple-100 dark:bg-purple-950 px-2 py-0.5 font-mono font-bold text-purple-900 dark:text-purple-200 text-[11px]">
                            <Truck className="h-3 w-3" />
                            {plate}
                          </div>
                        ) : dumping?.vehicleDetected ? (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <Truck className="h-3 w-3" /> Vehicle (No Plate)
                          </span>
                        ) : (
                          <span className="text-slate-400">Not Visible</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`font-bold ${confidencePct >= 85 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {confidencePct}%
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                          dumping?.evidenceQuality === 'good' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' :
                          dumping?.evidenceQuality === 'fair' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300' :
                          'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        }`}>
                          {dumping?.evidenceQuality || 'fair'}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                          vStatus === 'VERIFIED' ? 'text-emerald-600' :
                          vStatus === 'REJECTED' ? 'text-red-600' :
                          vStatus === 'INSUFFICIENT_EVIDENCE' ? 'text-slate-500' :
                          'text-amber-600'
                        }`}>
                          {vStatus === 'VERIFIED' && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                          {vStatus === 'REJECTED' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
                          {vStatus === 'PENDING' && <Clock className="h-3.5 w-3.5 text-amber-500" />}
                          {vStatus}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-extrabold ${
                          fineStatus === 'ISSUED' || fineStatus === 'PAID' ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' :
                          'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }`}>
                          {fineStatus} {r.illegalDumping?.fineDetails?.amount ? `(₹${r.illegalDumping.fineDetails.amount})` : ''}
                        </span>
                      </td>
                      <td className="p-3 pr-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs gap-1"
                          onClick={() => {
                            setSelectedReport(r);
                            if (r.illegalDumping?.fineDetails) {
                              setFineFormAmount(r.illegalDumping.fineDetails.amount ?? 2000);
                              setFineFormStatus(r.illegalDumping.fineDetails.status as any || 'ISSUED');
                              setFineFormNoticeNo(r.illegalDumping.fineDetails.noticeNumber || '');
                              setFineFormNotes(r.illegalDumping.fineDetails.notes || '');
                            }
                          }}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Inspect Case
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Case Details & Evidence Inspector Modal ───────────────────────── */}
      {selectedReport && (
        <Dialog open={!!selectedReport} onOpenChange={(open) => !open && setSelectedReport(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto custom-scrollbar p-6">
            <DialogHeader className="border-b pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-xl font-bold flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5 text-purple-600" />
                    Enforcement Case Inspector #{selectedReport.id.slice(0, 8)}
                  </DialogTitle>
                  <DialogDescription className="text-xs mt-0.5">
                    Uploaded Media, AI Evidence Assessment, OCR License Plate Extraction, &amp; Administrative Actions
                  </DialogDescription>
                </div>
                <Badge variant={selectedReport.illegalDumping?.verificationStatus === 'VERIFIED' ? 'default' : 'outline'} className="text-xs font-bold">
                  Status: {selectedReport.illegalDumping?.verificationStatus ?? 'PENDING'}
                </Badge>
              </div>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-4">
              
              {/* Left Side: Uploaded Media & Cropped Plate (5 cols) */}
              <div className="md:col-span-5 space-y-4">
                <div className="relative aspect-video w-full overflow-hidden rounded-2xl border bg-black shadow-md">
                  {selectedReport.imageUrl ? (
                    <Image
                      src={selectedReport.imageUrl}
                      alt="Submitted Evidence"
                      fill
                      className="object-contain"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-white/50">No Media Provided</div>
                  )}
                </div>

                {/* License Plate Badge & Crop */}
                {(selectedReport.illegalDumping?.licensePlateNumber || selectedReport.aiAnalysis?.illegalDumping?.licensePlateNumber) ? (
                  <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-900/60 dark:bg-purple-950/40">
                    <p className="text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center gap-1.5">
                      <Truck className="h-4 w-4 text-purple-600" />
                      Extracted License Plate (OCR):
                    </p>
                    <p className="mt-1 font-mono text-2xl font-black tracking-wider text-purple-950 dark:text-purple-100 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-xl border border-purple-300 text-center shadow-inner">
                      {selectedReport.illegalDumping?.licensePlateNumber || selectedReport.aiAnalysis?.illegalDumping?.licensePlateNumber}
                    </p>
                    <p className="text-[10px] text-purple-700/80 dark:text-purple-300/80 mt-1.5 text-center">
                      Verified from image text analysis. Always cross-verify visual image above.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border p-3 bg-slate-50 dark:bg-slate-900 text-xs text-muted-foreground text-center">
                    No license plate clearly visible in the uploaded media.
                  </div>
                )}

                {/* Location Details */}
                <div className="rounded-xl border p-3.5 space-y-1.5 text-xs bg-slate-50 dark:bg-slate-900">
                  <p className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-purple-600" /> Location &amp; Timestamp:
                  </p>
                  <p className="text-muted-foreground">{selectedReport.location}</p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    GPS: {selectedReport.latitude?.toFixed(5)}, {selectedReport.longitude?.toFixed(5)}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Reported: {new Date(selectedReport.timestamp).toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              {/* Right Side: AI Evidence Analysis & Officer Decision Controls (7 cols) */}
              <div className="md:col-span-7 space-y-5">
                
                {/* AI Visual Evidence Box */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-900/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-purple-700 dark:text-purple-300 flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5 text-purple-500" /> AI Visual Assessment Summary
                    </span>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      Confidence: {Math.round(((selectedReport.illegalDumping?.confidence || selectedReport.aiAnalysis?.illegalDumping?.confidence) ?? 0.85) * 100)}%
                    </Badge>
                  </div>

                  <p className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                    {selectedReport.illegalDumping?.reason || selectedReport.aiAnalysis?.illegalDumping?.reason || selectedReport.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-2 border">
                      <span className="text-[10px] text-muted-foreground block">Waste Category</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedReport.illegalDumping?.wasteType || selectedReport.category || 'General Waste'}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white dark:bg-slate-900 p-2 border">
                      <span className="text-[10px] text-muted-foreground block">Vehicle Detected</span>
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        {selectedReport.illegalDumping?.vehicleType || (selectedReport.illegalDumping?.vehicleDetected ? 'Yes' : 'None Visible')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Existing Verification / Rejection Info if already acted upon */}
                {selectedReport.illegalDumping?.verificationStatus !== 'PENDING' && (
                  <div className={`rounded-xl border p-3.5 text-xs ${
                    selectedReport.illegalDumping?.verificationStatus === 'VERIFIED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200'
                      : 'border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200'
                  }`}>
                    <p className="font-bold flex items-center gap-1.5">
                      {selectedReport.illegalDumping?.verificationStatus === 'VERIFIED' ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
                      Verification Decision: {selectedReport.illegalDumping?.verificationStatus}
                    </p>
                    {selectedReport.illegalDumping?.rejectionReason && (
                      <p className="mt-1 text-xs font-medium">Rejection Reason: "{selectedReport.illegalDumping.rejectionReason}"</p>
                    )}
                    {selectedReport.illegalDumping?.verifiedByName && (
                      <p className="mt-1 text-[10px] opacity-80">By {selectedReport.illegalDumping.verifiedByName} on {new Date(selectedReport.illegalDumping.verifiedAt || '').toLocaleString('en-IN')}</p>
                    )}
                  </div>
                )}

                {/* Officer Manual Verification Action Buttons */}
                <div className="space-y-2 border-t pt-4">
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                    <Scale className="h-4 w-4 text-purple-600" />
                    Officer Verification Decisions:
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Human verification is mandatory. Choose whether the evidence establishes an illegal dumping violation.
                  </p>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      type="button"
                      disabled={isUpdating}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 flex-1"
                      onClick={() => handleAction('VERIFY')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Verify Violation
                    </Button>

                    <Button
                      type="button"
                      disabled={isUpdating}
                      variant="destructive"
                      className="text-xs gap-1.5 flex-1"
                      onClick={() => {
                        setRejectionReasonInput('');
                        setRejectionModalOpen(true);
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                      Reject Report
                    </Button>
                  </div>
                </div>

                {/* Fine Management Panel (Available when VERIFIED) */}
                {selectedReport.illegalDumping?.verificationStatus === 'VERIFIED' && (
                  <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 dark:border-indigo-900/60 dark:bg-indigo-950/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                        <IndianRupee className="h-4 w-4 text-indigo-600" />
                        Municipal Fine &amp; Enforcement Notice Manager
                      </span>
                      <Badge className="bg-indigo-600 text-white text-[10px]">Manual Authorized Enforcement</Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Fine Amount (₹)</label>
                        <Input
                          type="number"
                          value={fineFormAmount}
                          onChange={(e) => setFineFormAmount(Number(e.target.value))}
                          className="h-8 text-xs bg-white dark:bg-slate-900 font-bold"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Enforcement Status</label>
                        <Select value={fineFormStatus} onValueChange={(v: any) => setFineFormStatus(v)}>
                          <SelectTrigger className="h-8 text-xs bg-white dark:bg-slate-900">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ISSUED">ISSUED</SelectItem>
                            <SelectItem value="PENDING">PENDING</SelectItem>
                            <SelectItem value="PAID">PAID</SelectItem>
                            <SelectItem value="DISPUTED">DISPUTED</SelectItem>
                            <SelectItem value="CANCELLED">CANCELLED</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="text-xs space-y-2">
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Violation Description</label>
                        <Input
                          value={fineFormViolation}
                          onChange={(e) => setFineFormViolation(e.target.value)}
                          placeholder="e.g. Unlawful dumping of waste on public roadway"
                          className="h-8 text-xs bg-white dark:bg-slate-900"
                        />
                      </div>

                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-300 block mb-1">Notice Reference #</label>
                        <Input
                          value={fineFormNoticeNo}
                          onChange={(e) => setFineFormNoticeNo(e.target.value)}
                          placeholder="e.g. PMC/ID/2026/089"
                          className="h-8 text-xs bg-white dark:bg-slate-900 font-mono"
                        />
                      </div>
                    </div>

                    <Button
                      type="button"
                      disabled={isUpdating}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-xs gap-1.5 mt-2"
                      onClick={() => handleAction('ISSUE_FINE', undefined, {
                        amount: fineFormAmount,
                        status: fineFormStatus,
                        violationType: fineFormViolation,
                        noticeNumber: fineFormNoticeNo,
                        notes: fineFormNotes,
                      })}
                    >
                      <ShieldCheck className="h-4 w-4" />
                      Save &amp; Update Municipal Enforcement Fine
                    </Button>
                  </div>
                )}

              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* ── Rejection Mandated Reason Modal ───────────────────────────────── */}
      {rejectionModalOpen && (
        <Dialog open={rejectionModalOpen} onOpenChange={setRejectionModalOpen}>
          <DialogContent className="max-w-md p-6">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-red-600 flex items-center gap-2">
                <XCircle className="h-5 w-5" />
                Reject Illegal Dumping Report
              </DialogTitle>
              <DialogDescription className="text-xs">
                A mandatory reason is required when rejecting an illegal dumping report (e.g. "Insufficient visual evidence to prove illegal dumping").
              </DialogDescription>
            </DialogHeader>

            <div className="py-3 space-y-3">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">Rejection Reason:</label>
              <Textarea
                placeholder="Specify reason for rejection (min 5 characters)..."
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                className="text-xs min-h-[90px]"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button variant="outline" size="sm" onClick={() => setRejectionModalOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={isUpdating || rejectionReasonInput.trim().length < 5}
                onClick={() => handleAction('REJECT', rejectionReasonInput)}
              >
                Confirm Rejection
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

    </div>
  );
}
