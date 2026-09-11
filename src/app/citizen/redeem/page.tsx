'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Gift, Star, ArrowLeft, CheckCircle2, ShieldCheck, Bus,
  Building2, ShoppingBag, Zap, IndianRupee, Copy, Check,
  Sparkles, CreditCard, Clock, ChevronRight, AlertCircle, Loader2, ArrowUpRight
} from 'lucide-react';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useCollection, useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { Report, User as UserType } from '@/lib/types';
import { REWARD_CATALOG, type CatalogRewardItem, getQualifiedResolvedReportCount } from '@/lib/reward-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';

type CategoryFilter = 'all' | 'cash' | 'transit' | 'pmc' | 'voucher';

type RedeemedVoucher = {
  id: string;
  itemTitle: string;
  provider: string;
  code: string;
  date: string;
  type: 'cash' | 'voucher';
  amountOrValue: string;
  upiId?: string;
  txId?: string;
};

const CATEGORIES: { key: CategoryFilter; label: string }[] = [
  { key: 'all', label: 'All Rewards' },
  { key: 'cash', label: 'Razorpay UPI Cash' },
  { key: 'transit', label: 'PMPML & Metro' },
  { key: 'pmc', label: 'PMC Tax Rebates' },
  { key: 'voucher', label: 'Shopping & Food' },
];

function getIconComponent(iconName: CatalogRewardItem['iconName']) {
  switch (iconName) {
    case 'IndianRupee': return IndianRupee;
    case 'Bus': return Bus;
    case 'Building2': return Building2;
    case 'ShoppingBag': return ShoppingBag;
    case 'Zap': return Zap;
    default: return Gift;
  }
}

export default function RedeemPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [selectedReward, setSelectedReward] = useState<CatalogRewardItem | null>(null);
  const [upiId, setUpiId] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [claimedVouchers, setClaimedVouchers] = useState<RedeemedVoucher[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [successClaim, setSuccessClaim] = useState<RedeemedVoucher | null>(null);

  // Fetch User Profile
  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile } = useDoc<UserType>(profileRef);

  // Fetch Citizen Reports
  const reportsQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(collection(firestore, 'reports'), where('userId', '==', user.uid));
  }, [firestore, user?.uid]);
  const { data: reports, isLoading: reportsLoading } = useCollection<Report>(reportsQuery);

  const currentPoints = profile?.points ?? 0;
  const qualifiedReportsCount = useMemo(() => {
    if (!reports || !user?.uid) return 0;
    return getQualifiedResolvedReportCount(reports, user.uid);
  }, [reports, user?.uid]);

  const filteredCatalog = useMemo(() => {
    if (activeCategory === 'all') return REWARD_CATALOG;
    return REWARD_CATALOG.filter((item) => item.category === activeCategory);
  }, [activeCategory]);

  const handleRedeem = async () => {
    if (!selectedReward || !firestore || !user?.uid) return;

    if (currentPoints < selectedReward.pointsCost) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Points',
        description: `You need ${selectedReward.pointsCost - currentPoints} more points to claim this reward.`,
      });
      return;
    }

    if (selectedReward.minQualifiedReports && qualifiedReportsCount < selectedReward.minQualifiedReports) {
      toast({
        variant: 'destructive',
        title: 'Report Threshold Not Met',
        description: `You need at least ${selectedReward.minQualifiedReports} verified resolved reports to unlock this reward.`,
      });
      return;
    }

    if (selectedReward.category === 'cash' && (!upiId.trim() || !upiId.includes('@'))) {
      toast({
        variant: 'destructive',
        title: 'Invalid UPI ID',
        description: 'Please enter a valid UPI ID (e.g. mobile@upi, name@okicici).',
      });
      return;
    }

    setIsProcessing(true);

    try {
      // Deduct points in Firestore
      const updatedPoints = Math.max(0, currentPoints - selectedReward.pointsCost);
      await updateDoc(doc(firestore, 'users', user.uid), {
        points: updatedPoints,
      });

      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const isCash = selectedReward.category === 'cash';
      const code = isCash
        ? `RZP-PAYOUT-${randomSuffix}`
        : `PUNE-${selectedReward.badge.substring(0, 4).toUpperCase()}-${randomSuffix}`;

      const newClaim: RedeemedVoucher = {
        id: `claim-${Date.now()}`,
        itemTitle: selectedReward.title,
        provider: selectedReward.provider,
        code,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        type: isCash ? 'cash' : 'voucher',
        amountOrValue: selectedReward.title.split(' ')[0],
        upiId: isCash ? upiId : undefined,
        txId: isCash ? `TXN-PMRDA-${Math.floor(100000 + Math.random() * 900000)}` : undefined,
      };

      setClaimedVouchers((prev) => [newClaim, ...prev]);
      setSuccessClaim(newClaim);
      setSelectedReward(null);
      setUpiId('');

      toast({
        title: isCash ? '✅ Cash Payout Processed!' : '🎉 Voucher Claimed Successfully!',
        description: isCash
          ? `₹100 has been initiated to ${upiId} via Razorpay.`
          : `Voucher code ${code} is ready in your wallet.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Redemption Failed',
        description: 'Could not process reward claim. Please try again.',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: 'Copied to Clipboard!', description: text });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex-1 space-y-4 p-4 pb-12 max-w-4xl mx-auto">

      {/* ── Top Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 via-teal-700 to-cyan-800 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-10 h-40 w-40 rounded-full bg-emerald-300/20 blur-xl" />

        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 px-2 text-white/80 hover:text-white hover:bg-white/15">
          <Link href="/citizen/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Dashboard
          </Link>
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <Gift className="h-6 w-6 text-yellow-300" />
          </div>
          <div>
            <h1 className="text-2xl font-black tracking-tight">Rewards &amp; Redeem Portal</h1>
            <p className="text-xs text-emerald-100/90 mt-0.5">
              Turn your verified civic impact points into instant cash, transit passes &amp; PMC tax rebates
            </p>
          </div>
        </div>

        {/* ── Stats Pill Cards ── */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-3 flex items-center gap-3 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-amber-400/25 flex items-center justify-center shrink-0">
              <Star className="h-5 w-5 fill-yellow-300 text-yellow-300" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Available Points</p>
              <p className="text-xl font-black text-white">{currentPoints} <span className="text-xs font-semibold">pts</span></p>
            </div>
          </div>

          <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-3 flex items-center gap-3 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-emerald-400/25 flex items-center justify-center shrink-0">
              <ShieldCheck className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Verified Resolved</p>
              <p className="text-xl font-black text-white">
                {reportsLoading ? <Skeleton className="h-6 w-8 bg-white/20" /> : `${qualifiedReportsCount} reports`}
              </p>
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-3 flex items-center gap-3 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-teal-400/25 flex items-center justify-center shrink-0">
              <Sparkles className="h-5 w-5 text-teal-200" />
            </div>
            <div>
              <p className="text-[10px] uppercase font-bold text-white/70 tracking-wider">Cash Eligible</p>
              <p className="text-sm font-bold text-emerald-200">
                {qualifiedReportsCount >= 3 ? 'Razorpay UPI Unlocked' : '3 Verified Needed'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Category Filters ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-all ${
              activeCategory === cat.key
                ? 'bg-slate-900 text-white shadow-md dark:bg-white dark:text-slate-900'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-400'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* ── Rewards Catalog Grid ── */}
      <div className="grid gap-4 sm:grid-cols-2">
        {filteredCatalog.map((item) => {
          const IconComp = getIconComponent(item.iconName);
          const hasPoints = currentPoints >= item.pointsCost;
          const meetsReports = !item.minQualifiedReports || qualifiedReportsCount >= item.minQualifiedReports;
          const canClaim = hasPoints && meetsReports;

          return (
            <Card
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-200 bg-white dark:bg-slate-950 dark:border-slate-800 flex flex-col justify-between"
            >
              {/* Header Gradient Strip */}
              <div className={`h-2 w-full bg-gradient-to-r ${item.color}`} />

              <CardContent className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                          {item.provider}
                        </span>
                        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                          {item.title}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed dark:text-slate-400">
                    {item.description}
                  </p>
                </div>

                {/* Footer Info & Claim Trigger */}
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1 font-bold text-slate-800 dark:text-slate-200">
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                      <span>{item.pointsCost} points</span>
                    </div>

                    {item.minQualifiedReports && (
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        {item.minQualifiedReports}+ Genuine Reports
                      </span>
                    )}
                  </div>

                  <Button
                    onClick={() => setSelectedReward(item)}
                    disabled={!canClaim}
                    className={`w-full h-10 rounded-xl font-bold text-xs transition-all shadow-sm ${
                      canClaim
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                        : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                    }`}
                  >
                    {canClaim ? (
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-3.5 w-3.5" />
                        Claim Reward
                      </span>
                    ) : !meetsReports ? (
                      `Requires ${item.minQualifiedReports} Verified Reports`
                    ) : (
                      `Need ${item.pointsCost - currentPoints} More Points`
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── Active Redeemed Vouchers / History Section ── */}
      {claimedVouchers.length > 0 && (
        <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white dark:bg-slate-950 dark:border-slate-800 mt-6">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-emerald-600" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">My Claimed Rewards &amp; Wallet</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{claimedVouchers.length} Items</span>
          </div>

          <CardContent className="p-4 space-y-3">
            {claimedVouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 gap-3"
              >
                <div>
                  <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">
                    {voucher.provider}
                  </span>
                  <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{voucher.itemTitle}</p>
                  <p className="text-xs text-slate-400">Claimed on {voucher.date}</p>
                  {voucher.upiId && (
                    <p className="text-xs text-emerald-600 font-medium mt-0.5">
                      Payout sent to {voucher.upiId} (Ref: {voucher.txId})
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs font-bold bg-white dark:bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    {voucher.code}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(voucher.code, voucher.id)}
                    className="h-8 text-xs font-semibold rounded-lg"
                  >
                    {copiedId === voucher.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── Claim Confirmation Modal ── */}
      {selectedReward && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !isProcessing && setSelectedReward(null)} />

          <div className="relative w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-5 dark:bg-slate-950 dark:border dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`h-12 w-12 rounded-2xl bg-gradient-to-br ${selectedReward.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                {(() => {
                  const Icon = getIconComponent(selectedReward.iconName);
                  return <Icon className="h-6 w-6" />;
                })()}
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
                  {selectedReward.provider}
                </span>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{selectedReward.title}</h3>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-2 text-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Reward Cost:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedReward.pointsCost} Points</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Your Current Balance:</span>
                <span className="font-bold text-emerald-600">{currentPoints} Points</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2">
                <span>Balance After Claim:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{Math.max(0, currentPoints - selectedReward.pointsCost)} Points</span>
              </div>
            </div>

            {/* If Razorpay Cash, show UPI input */}
            {selectedReward.category === 'cash' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                  Enter Your UPI ID for Instant Payout
                </label>
                <Input
                  placeholder="e.g. 9876543210@paytm or name@okicici"
                  value={upiId}
                  onChange={(e) => setUpiId(e.target.value)}
                  className="h-11 rounded-xl text-sm"
                />
                <p className="text-[11px] text-slate-400">
                  Instant bank transfer via Razorpay Direct Payout API.
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedReward(null)}
                disabled={isProcessing}
                className="flex-1 h-11 rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={isProcessing}
                className="flex-1 h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm & Claim'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Success Claim Modal ── */}
      {successClaim && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSuccessClaim(null)} />

          <div className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl text-center space-y-4 dark:bg-slate-950">
            <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="h-8 w-8" />
            </div>

            <div>
              <h3 className="text-lg font-extrabold text-slate-900 dark:text-slate-100">
                {successClaim.type === 'cash' ? 'Cash Payout Initiated!' : 'Reward Claimed!'}
              </h3>
              <p className="text-xs text-slate-500 mt-1">{successClaim.itemTitle}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs space-y-2 dark:bg-slate-900 dark:border-slate-800">
              <p className="text-slate-400 font-bold uppercase text-[10px]">Your Code / Reference ID</p>
              <p className="font-mono text-base font-extrabold text-slate-900 dark:text-slate-100">{successClaim.code}</p>
              {successClaim.upiId && (
                <p className="text-emerald-600 font-semibold text-[11px]">
                  UPI: {successClaim.upiId} ({successClaim.txId})
                </p>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-10 rounded-xl text-xs font-semibold"
                onClick={() => copyToClipboard(successClaim.code, successClaim.id)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy Code
              </Button>
              <Button
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                onClick={() => setSuccessClaim(null)}
              >
                Done
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
