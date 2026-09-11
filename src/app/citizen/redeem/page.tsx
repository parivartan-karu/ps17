'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Gift, Star, ArrowLeft, CheckCircle2, Bus, Train, Copy, Check,
  Sparkles, Loader2
} from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { User as UserType } from '@/lib/types';
import { REWARD_CATALOG, type CatalogRewardItem } from '@/lib/reward-utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

type RedeemedVoucher = {
  id: string;
  itemTitle: string;
  provider: string;
  code: string;
  date: string;
};

export default function RedeemPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [selectedReward, setSelectedReward] = useState<CatalogRewardItem | null>(null);
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

  const currentPoints = profile?.points ?? 0;

  const handleRedeem = async () => {
    if (!selectedReward || !firestore || !user?.uid) return;

    if (currentPoints < selectedReward.pointsCost) {
      toast({
        variant: 'destructive',
        title: 'Insufficient Score',
        description: `You need ${selectedReward.pointsCost - currentPoints} more points score to claim this pass.`,
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
      const prefix = selectedReward.iconName === 'Bus' ? 'PMPML-BUS' : 'RAIL-TRAIN';
      const code = `${prefix}-${randomSuffix}`;

      const newClaim: RedeemedVoucher = {
        id: `claim-${Date.now()}`,
        itemTitle: selectedReward.title,
        provider: selectedReward.provider,
        code,
        date: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      };

      setClaimedVouchers((prev) => [newClaim, ...prev]);
      setSuccessClaim(newClaim);
      setSelectedReward(null);

      toast({
        title: '🎉 Pass Claimed Successfully!',
        description: `Your pass code ${code} is ready in your wallet.`,
      });
    } catch (err) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Redemption Failed',
        description: 'Could not process pass claim. Please try again.',
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
    <div className="flex-1 space-y-5 p-4 pb-12 max-w-xl mx-auto">

      {/* ── Header ── */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-700 p-6 text-white shadow-xl">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2 px-2 text-white/80 hover:text-white hover:bg-white/15">
          <Link href="/citizen/dashboard">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Dashboard
          </Link>
        </Button>

        <div className="flex items-center gap-3 mb-4">
          <div className="h-11 w-11 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner">
            <Gift className="h-6 w-6 text-yellow-300" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Redeem Rewards</h1>
            <p className="text-xs text-emerald-100/90">Claim daily bus &amp; train travel passes</p>
          </div>
        </div>

        {/* ── Single Score Card ── */}
        <div className="rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 p-4 flex items-center gap-4 shadow-sm">
          <div className="h-12 w-12 rounded-xl bg-amber-400/30 flex items-center justify-center shrink-0">
            <Star className="h-6 w-6 fill-yellow-300 text-yellow-300" />
          </div>
          <div>
            <p className="text-xs font-bold text-white/80 uppercase tracking-wider">Your Score</p>
            <p className="text-3xl font-black text-white">{currentPoints} <span className="text-sm font-bold">pts</span></p>
          </div>
        </div>
      </div>

      {/* ── Daily Bus / Train Pass Rewards Section ── */}
      <div className="space-y-3 pt-2">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-emerald-600" />
          Daily Travel Pass Rewards (150 Score)
        </h2>

        <div className="grid gap-4">
          {REWARD_CATALOG.map((item) => {
            const IconComp = item.iconName === 'Bus' ? Bus : Train;
            const canClaim = currentPoints >= item.pointsCost;

            return (
              <Card
                key={item.id}
                className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white dark:bg-slate-950 dark:border-slate-800"
              >
                <div className={`h-1.5 w-full bg-gradient-to-r ${item.color}`} />

                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${item.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                      <IconComp className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                        {item.provider}
                      </span>
                      <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                        {item.title}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 dark:text-slate-400">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1 font-extrabold text-amber-600 dark:text-amber-400 text-xs">
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      <span>{item.pointsCost} Score Required</span>
                    </div>

                    <Button
                      onClick={() => setSelectedReward(item)}
                      disabled={!canClaim}
                      className={`h-9 px-4 rounded-xl font-bold text-xs transition-all ${
                        canClaim
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/20'
                          : 'bg-slate-100 text-slate-400 border border-slate-200 dark:bg-slate-900 dark:border-slate-800'
                      }`}
                    >
                      {canClaim ? 'Claim Pass' : `Need ${item.pointsCost - currentPoints} More Score`}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── Active Redeemed Wallet Section ── */}
      {claimedVouchers.length > 0 && (
        <Card className="rounded-2xl border border-slate-200 shadow-sm bg-white dark:bg-slate-950 dark:border-slate-800 mt-4">
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Gift className="h-4 w-4 text-emerald-600" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100">My Claimed Passes</h2>
            </div>
            <span className="text-xs text-slate-400 font-semibold">{claimedVouchers.length} Passes</span>
          </div>

          <CardContent className="p-3 space-y-2">
            {claimedVouchers.map((voucher) => (
              <div
                key={voucher.id}
                className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50 dark:bg-slate-900 dark:border-slate-800 gap-2"
              >
                <div>
                  <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{voucher.itemTitle}</p>
                  <p className="text-[10px] text-slate-400">{voucher.provider} · Claimed {voucher.date}</p>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-xs font-bold bg-white dark:bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                    {voucher.code}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard(voucher.code, voucher.id)}
                    className="h-7 w-7 p-0 rounded-lg"
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

          <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl space-y-4 dark:bg-slate-950 dark:border dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`h-11 w-11 rounded-2xl bg-gradient-to-br ${selectedReward.color} text-white flex items-center justify-center shadow-md shrink-0`}>
                {selectedReward.iconName === 'Bus' ? <Bus className="h-5 w-5" /> : <Train className="h-5 w-5" />}
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-600">
                  {selectedReward.provider}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">{selectedReward.title}</h3>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-2 text-xs dark:bg-slate-900 dark:border-slate-800">
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Pass Score Required:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{selectedReward.pointsCost} Score</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>Your Current Score:</span>
                <span className="font-bold text-emerald-600">{currentPoints} Score</span>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-300 border-t border-slate-200 dark:border-slate-700 pt-2">
                <span>Remaining Score After Claim:</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{Math.max(0, currentPoints - selectedReward.pointsCost)} Score</span>
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                onClick={() => setSelectedReward(null)}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-xl text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                onClick={handleRedeem}
                disabled={isProcessing}
                className="flex-1 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  'Confirm Claim'
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

          <div className="relative w-full max-w-xs rounded-3xl bg-white p-5 shadow-2xl text-center space-y-4 dark:bg-slate-950">
            <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
              <CheckCircle2 className="h-7 w-7" />
            </div>

            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                Pass Claimed!
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">{successClaim.itemTitle}</p>
            </div>

            <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 text-xs space-y-1 dark:bg-slate-900 dark:border-slate-800">
              <p className="text-slate-400 font-bold uppercase text-[9px]">Pass Code</p>
              <p className="font-mono text-base font-extrabold text-slate-900 dark:text-slate-100">{successClaim.code}</p>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1 h-9 rounded-xl text-xs font-semibold"
                onClick={() => copyToClipboard(successClaim.code, successClaim.id)}
              >
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Copy
              </Button>
              <Button
                className="flex-1 h-9 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
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
