'use client';

import { useState } from 'react';
import {
  collection, query, orderBy, doc, updateDoc, deleteDoc,
} from 'firebase/firestore';
import {
  CheckCircle, XCircle, MapPin, Clock, User, Filter,
  Trash2, Search, ExternalLink, AlertTriangle, ShieldCheck, Layers,
} from 'lucide-react';
import Image from 'next/image';
import { useFirestore, useMemoFirebase, useCollection, useUser } from '@/firebase';
import type { CivicService, CivicServiceStatus } from '@/lib/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { CATEGORIES } from '@/components/maps/nearby-services-map';
import type { CivicServiceCategory } from '@/lib/types';

/* ─── constants ─────────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<CivicServiceStatus, { pill: string; dot: string; label: string }> = {
  pending: { pill: 'bg-amber-50 text-amber-700 border border-amber-200', dot: 'bg-amber-400', label: 'Pending' },
  approved: { pill: 'bg-emerald-50 text-emerald-700 border border-emerald-200', dot: 'bg-emerald-500', label: 'Approved' },
  rejected: { pill: 'bg-red-50 text-red-600 border border-red-200', dot: 'bg-red-400', label: 'Rejected' },
};

type FilterTab = 'pending' | 'approved' | 'rejected' | 'all';

const TABS: { key: FilterTab; label: string; icon: React.ReactNode }[] = [
  { key: 'pending', label: 'Pending', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'approved', label: 'Approved', icon: <ShieldCheck className="h-3.5 w-3.5" /> },
  { key: 'rejected', label: 'Rejected', icon: <XCircle className="h-3.5 w-3.5" /> },
  { key: 'all', label: 'All', icon: <Layers className="h-3.5 w-3.5" /> },
];

/* ─── delete-confirmation modal ─────────────────────────────────────────── */

function DeleteConfirmModal({
  service,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  service: CivicService;
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onCancel}
      />
      {/* modal */}
      <div className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <p className="font-bold text-slate-800">Remove Approved Service?</p>
            <p className="text-xs text-slate-500 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 text-sm">
          <p className="font-semibold text-slate-700">{service.name}</p>
          <p className="text-xs text-slate-400 mt-0.5">{service.location}</p>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">
          Removing this service will delete it permanently from the database and it will no
          longer appear on the citizen-facing map.
        </p>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            className="flex-1 h-9 rounded-xl text-xs font-semibold"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-9 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {isDeleting ? 'Removing…' : 'Yes, Remove'}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── main page ─────────────────────────────────────────────────────────── */

export default function CivicServicesAdminPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [tab, setTab] = useState<FilterTab>('pending');
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<CivicService | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* firestore query */
  const servicesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'civic_services'), orderBy('submittedAt', 'desc'));
  }, [firestore]);

  const { data: allServices, isLoading } = useCollection<CivicService>(servicesQuery);

  /* derived data */
  const counts = {
    pending: (allServices ?? []).filter(s => s.status === 'pending').length,
    approved: (allServices ?? []).filter(s => s.status === 'approved').length,
    rejected: (allServices ?? []).filter(s => s.status === 'rejected').length,
    all: (allServices ?? []).length,
  };

  const filtered = (allServices ?? [])
    .filter(s => tab === 'all' ? true : s.status === tab)
    .filter(s => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        s.location.toLowerCase().includes(q) ||
        s.submittedByName.toLowerCase().includes(q)
      );
    });

  /* approve / reject */
  const handleDecision = async (service: CivicService, decision: 'approved' | 'rejected') => {
    if (!firestore || !user) return;
    setProcessing(service.id);
    try {
      const updateData: Record<string, string> = {
        status: decision,
        reviewedBy: user.uid,
        reviewedAt: new Date().toISOString(),
      };
      if (decision === 'approved') {
        const adminName = editingName[service.id]?.trim();
        updateData.name = adminName || CATEGORIES[service.category]?.label || service.category;
      }
      await updateDoc(doc(firestore, 'civic_services', service.id), updateData);
      toast({
        title: decision === 'approved' ? '✅ Service approved' : '❌ Service rejected',
        description: `"${service.name}" has been ${decision}.`,
      });
    } catch {
      toast({ variant: 'destructive', title: 'Action failed', description: 'Please try again.' });
    } finally {
      setProcessing(null);
    }
  };

  /* delete approved service */
  const handleDelete = async () => {
    if (!firestore || !deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(firestore, 'civic_services', deleteTarget.id));
      toast({
        title: '🗑️ Service removed',
        description: `"${deleteTarget.name}" has been permanently deleted.`,
      });
      setDeleteTarget(null);
    } catch {
      toast({ variant: 'destructive', title: 'Delete failed', description: 'Please try again.' });
    } finally {
      setDeleting(false);
    }
  };

  /* ── render ──────────────────────────────────────────────────────────── */
  return (
    <>
      {/* Delete modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          service={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => !deleting && setDeleteTarget(null)}
          isDeleting={deleting}
        />
      )}

      <div className="flex-1 space-y-5">

        {/* ── Hero header ─────────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-600 via-emerald-700 to-cyan-800 p-6 text-white shadow-lg">
          {/* decorative blobs */}
          <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-8 left-20 h-32 w-32 rounded-full bg-teal-300/20 blur-xl" />

          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60 mb-1">
            SMC Admin Panel
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight">Civic Service Registry</h1>
          <p className="text-sm text-white/65 mt-1">
            Review, approve and manage citizen-submitted service locations
          </p>

          {/* stat pills */}
          <div className="mt-5 flex flex-wrap gap-3">
            {[
              { label: 'Pending', value: counts.pending, bg: 'bg-amber-400/20  text-amber-100  border-amber-300/30' },
              { label: 'Approved', value: counts.approved, bg: 'bg-emerald-400/20 text-emerald-100 border-emerald-300/30' },
              { label: 'Rejected', value: counts.rejected, bg: 'bg-red-400/20     text-red-100    border-red-300/30' },
              { label: 'Total', value: counts.all, bg: 'bg-white/10       text-white       border-white/20' },
            ].map(s => (
              <div
                key={s.label}
                className={`flex items-center gap-2 rounded-xl border px-3 py-2 ${s.bg}`}
              >
                <span className="text-xl font-black leading-none">{s.value}</span>
                <span className="text-[11px] font-semibold leading-tight opacity-80">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Controls bar ─────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, location, or submitter…"
              className="w-full h-10 pl-9 pr-4 rounded-xl border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
            />
          </div>

          {/* tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${tab === t.key
                    ? 'bg-white shadow text-slate-900'
                    : 'text-slate-500 hover:text-slate-700'
                  }`}
              >
                {t.icon}
                {t.label}
                <span className={`rounded-full px-1.5 text-[10px] font-bold ${tab === t.key ? 'bg-slate-100 text-slate-600' : 'bg-slate-200 text-slate-500'
                  }`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Loading skeletons ────────────────────────────────────────── */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-52 w-full rounded-2xl" />)}
          </div>
        )}

        {/* ── Empty state ──────────────────────────────────────────────── */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="h-16 w-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
              <Filter className="h-8 w-8 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">
              No {tab === 'all' ? '' : tab} submissions{search ? ` matching "${search}"` : ''}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {tab === 'pending' ? 'All caught up — no pending reviews.' : 'Nothing here yet.'}
            </p>
          </div>
        )}

        {/* ── Service cards ────────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map(service => {
            const cat = CATEGORIES[service.category as CivicServiceCategory];
            const isProcessing = processing === service.id;
            const st = STATUS_STYLES[service.status];

            return (
              <Card
                key={service.id}
                className="group relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow duration-200 bg-white"
              >
                {/* Photo / placeholder header */}
                <div className="relative w-full h-40 bg-gradient-to-br from-slate-100 to-slate-50">
                  {service.imageUrl ? (
                    <Image
                      src={service.imageUrl}
                      alt={service.name}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      {cat && <cat.Icon className="h-12 w-12 opacity-15" style={{ color: cat.pinBg }} />}
                    </div>
                  )}

                  {/* status badge */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${st.pill}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${st.dot}`} />
                      {st.label}
                    </span>
                  </div>

                  {/* category chip */}
                  <div className="absolute top-2.5 right-2.5">
                    <span className="inline-flex items-center gap-1 rounded-full bg-black/40 text-white px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm">
                      {cat && <cat.Icon className="h-3 w-3" />}
                      {cat?.label ?? service.category}
                    </span>
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* title row */}
                  <div className="flex items-start gap-2.5">
                    {cat && (
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ background: `${cat.pinBg}18` }}
                      >
                        <cat.Icon className="h-4 w-4" style={{ color: cat.pinBg }} strokeWidth={2} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-slate-800 leading-tight truncate">{service.name}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{cat?.label ?? service.category}</p>
                    </div>
                  </div>

                  {/* meta */}
                  <div className="space-y-1.5 text-xs text-slate-500">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span className="line-clamp-2">{service.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <User className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>Submitted by <span className="font-medium text-slate-600">{service.submittedByName}</span></span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span>{new Date(service.submittedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <a
                        href={`https://www.google.com/maps?q=${service.latitude},${service.longitude}`}
                        target="_blank"
                        rel="noopener"
                        className="text-emerald-600 hover:underline font-medium"
                      >
                        {service.latitude.toFixed(5)}, {service.longitude.toFixed(5)}
                      </a>
                    </div>
                  </div>

                  {/* ── Pending actions ── */}
                  {service.status === 'pending' && (
                    <div className="space-y-2 pt-1 border-t border-slate-100">
                      <label className="text-xs font-medium text-slate-600 block">
                        Service Name <span className="text-slate-400">(required to approve)</span>
                      </label>
                      <input
                        type="text"
                        value={editingName[service.id] ?? ''}
                        onChange={e => setEditingName(prev => ({ ...prev, [service.id]: e.target.value }))}
                        placeholder={`e.g. Dhanori ${cat?.label ?? ''}`}
                        className="w-full h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition"
                      />
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleDecision(service, 'approved')}
                          disabled={isProcessing || !(editingName[service.id]?.trim())}
                          className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                          {isProcessing ? 'Processing…' : 'Approve'}
                        </Button>
                        <Button
                          onClick={() => handleDecision(service, 'rejected')}
                          disabled={isProcessing}
                          variant="outline"
                          className="flex-1 h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold"
                        >
                          <XCircle className="mr-1.5 h-3.5 w-3.5" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* ── Approved: remove button ── */}
                  {service.status === 'approved' && (
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                      {service.reviewedAt && (
                        <p className="text-[11px] text-emerald-600 flex items-center gap-1.5">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          Approved on {new Date(service.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </p>
                      )}
                      <Button
                        variant="outline"
                        onClick={() => setDeleteTarget(service)}
                        className="w-full h-9 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 text-xs font-semibold transition-colors"
                      >
                        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                        Remove Service
                      </Button>
                    </div>
                  )}

                  {/* ── Rejected: reviewed info ── */}
                  {service.status === 'rejected' && service.reviewedAt && (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[11px] text-red-500 flex items-center gap-1.5">
                        <XCircle className="h-3.5 w-3.5" />
                        Rejected on {new Date(service.reviewedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </>
  );
}
