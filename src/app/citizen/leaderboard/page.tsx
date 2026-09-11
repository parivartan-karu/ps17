'use client';

import { useMemo } from 'react';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import {
  Trophy, Medal, Star, Flag, CheckCircle2, Crown,
  Flame, ArrowLeft, Award, Shield, Users,
} from 'lucide-react';
import Link from 'next/link';

import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { User as UserType, Report } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ─── Tier config (no emojis) ──────────────────────────────────────────────────

const TIER_CONFIG = [
  { min: 50, label: 'Platinum',  Icon: Trophy, iconColor: 'text-slate-500',  badge: 'bg-slate-100 text-slate-700 border-slate-300'   },
  { min: 30, label: 'Gold',      Icon: Award,  iconColor: 'text-amber-500',  badge: 'bg-amber-50 text-amber-700 border-amber-300'     },
  { min: 15, label: 'Silver',    Icon: Medal,  iconColor: 'text-gray-400',   badge: 'bg-gray-100 text-gray-600 border-gray-300'       },
  { min: 5,  label: 'Bronze',    Icon: Shield, iconColor: 'text-orange-400', badge: 'bg-orange-50 text-orange-700 border-orange-300'  },
  { min: 0,  label: 'Member',    Icon: Users,  iconColor: 'text-emerald-500',badge: 'bg-emerald-50 text-emerald-700 border-emerald-300'},
] as const;

type Tier = typeof TIER_CONFIG[number];

function getTier(points: number): Tier {
  return TIER_CONFIG.find((t) => points >= t.min) ?? TIER_CONFIG[TIER_CONFIG.length - 1];
}

// ─── Rank icon ────────────────────────────────────────────────────────────────

function RankIcon({ rank }: { rank: number }) {
  if (rank === 1) return <Crown className="h-5 w-5 text-amber-400 fill-amber-300" />;
  if (rank === 2) return <Medal className="h-5 w-5 text-slate-400 fill-slate-300" />;
  if (rank === 3) return <Medal className="h-5 w-5 text-orange-400 fill-orange-300" />;
  return <span className="text-sm font-bold text-muted-foreground w-5 text-center">#{rank}</span>;
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'from-emerald-400 to-teal-500',
  'from-blue-400 to-indigo-500',
  'from-purple-400 to-pink-500',
  'from-orange-400 to-red-500',
  'from-cyan-400 to-blue-500',
];

function UserAvatar({ name, rank }: { name: string; rank: number }) {
  const initials = name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const color = AVATAR_COLORS[(rank - 1) % AVATAR_COLORS.length];
  return (
    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${color} text-white font-bold text-sm shadow-sm`}>
      {initials}
    </div>
  );
}

// ─── Podium card ──────────────────────────────────────────────────────────────

type LeaderEntry = UserType & { rank: number; resolved: number; submitted: number; tier: Tier };

function PodiumCard({ entry, position, highlight = false }: { entry: LeaderEntry; position: number; highlight?: boolean }) {
  const podiumH = position === 1 ? 'h-16' : position === 2 ? 'h-10' : 'h-6';
  const offsetTop = position === 1 ? '' : position === 2 ? 'mt-6' : 'mt-10';
  const PodiumIcon = position === 1 ? Crown : Medal;
  const podiumIconColor = position === 1 ? 'text-amber-400 fill-amber-300' : position === 2 ? 'text-slate-400 fill-slate-300' : 'text-orange-400 fill-orange-300';

  return (
    <div className={`flex flex-col items-center text-center ${offsetTop}`}>
      <PodiumIcon className={`h-6 w-6 mb-1.5 ${podiumIconColor}`} />
      <UserAvatar name={entry.name} rank={position} />
      <p className="mt-1.5 text-xs font-bold line-clamp-1 max-w-full px-1">{entry.name.split(' ')[0]}</p>
      <p className={`text-sm font-bold mt-0.5 ${highlight ? 'text-amber-600' : 'text-slate-600'}`}>
        {entry.points ?? 0} pts
      </p>
      <div className={`mt-2 w-full rounded-t-lg ${highlight ? 'bg-gradient-to-t from-amber-400 to-yellow-300' : 'bg-gradient-to-t from-slate-200 to-slate-100'} ${podiumH} shadow-inner`} />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), orderBy('points', 'desc'), limit(50));
  }, [firestore]);

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);

  const { data: users, isLoading: usersLoading } = useCollection<UserType>(usersQuery);
  const { data: reports, isLoading: reportsLoading } = useCollection<Report>(reportsQuery);
  const isLoading = usersLoading || reportsLoading;

  const leaderboard = useMemo<LeaderEntry[]>(() => {
    if (!users) return [];
    return users
      .filter((u) => u.role === 'citizen' && (u.points ?? 0) >= 0)
      .map((u, index) => {
        const userReports = reports?.filter((r) => r.userId === u.id) ?? [];
        return {
          ...u,
          rank: index + 1,
          resolved: userReports.filter((r) => r.status === 'Resolved').length,
          submitted: userReports.length,
          tier: getTier(u.points ?? 0),
        };
      });
  }, [users, reports]);

  const myEntry = leaderboard.find((e) => e.id === user?.uid);
  const podium = leaderboard.slice(0, 3) as LeaderEntry[];
  const rest = leaderboard.slice(3);

  return (
    <div className="flex-1 space-y-4 p-4 pb-8">

      {/* ── Header ── */}
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 p-5 text-white shadow-md">
        <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2 px-2 text-white/80 hover:text-white hover:bg-white/15">
          <Link href="/citizen/dashboard"><ArrowLeft className="mr-1 h-4 w-4" />Dashboard</Link>
        </Button>
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-white/15 flex items-center justify-center">
            <Trophy className="h-6 w-6 fill-yellow-200 text-yellow-200" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Civic Leaderboard</h1>
            <p className="text-sm text-white/75">Top contributors making Pune better</p>
          </div>
        </div>

        {myEntry && (
          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white/15 border border-white/20 px-4 py-3">
            <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center">
              <myEntry.tier.Icon className={`h-5 w-5 ${myEntry.tier.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold">Your Rank: #{myEntry.rank}</p>
              <p className="text-xs text-white/75">{myEntry.points ?? 0} pts · {myEntry.tier.label}</p>
            </div>
            <div className="text-right text-xs text-white/75">
              <p>{myEntry.resolved} resolved</p>
              <p>{myEntry.submitted} submitted</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Tier legend ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {TIER_CONFIG.map((t) => (
          <span key={t.label} className={`shrink-0 flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${t.badge}`}>
            <t.Icon className={`h-3.5 w-3.5 ${t.iconColor}`} />
            {t.label}
          </span>
        ))}
      </div>

      {/* ── Podium ── */}
      {!isLoading && podium.length >= 3 && (
        <Card className="border border-slate-100 shadow-none overflow-hidden">
          <CardContent className="pt-4 pb-0">
            <div className="grid grid-cols-3 gap-2">
              <PodiumCard entry={podium[1]} position={2} />
              <PodiumCard entry={podium[0]} position={1} highlight />
              <PodiumCard entry={podium[2]} position={3} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Loading skeleton ── */}
      {isLoading && (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="flex items-center gap-3 rounded-xl border bg-white p-3">
              <Skeleton className="h-10 w-10 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-20" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      )}

      {/* ── Ranks 4+ ── */}
      {!isLoading && rest.length > 0 && (
        <Card className="border border-slate-100 shadow-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Full Rankings</CardTitle>
            <CardDescription className="text-xs">All community contributors ranked by impact points</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 px-3 pb-3">
            {rest.map((entry) => {
              const isMe = entry.id === user?.uid;
              const TierIcon = entry.tier.Icon;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                    isMe ? 'bg-amber-50 border border-amber-200' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center">
                    <RankIcon rank={entry.rank} />
                  </div>
                  <UserAvatar name={entry.name} rank={entry.rank} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {entry.name}
                      {isMe && <span className="text-amber-600 font-normal"> (You)</span>}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><Flag className="h-3 w-3" />{entry.submitted}</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-green-500" />{entry.resolved}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">{entry.points ?? 0}</p>
                    <p className="text-[10px] text-muted-foreground">pts</p>
                  </div>
                  <TierIcon className={`h-4 w-4 shrink-0 ${entry.tier.iconColor}`} />
                </div>
              );
            })}

            {leaderboard.length === 0 && (
              <div className="py-10 text-center">
                <Trophy className="mx-auto h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No contributors yet</p>
                <p className="text-xs text-muted-foreground mb-4">Be the first to submit a report</p>
                <Button asChild size="sm" className="bg-amber-500 hover:bg-amber-600 text-white rounded-xl">
                  <Link href="/citizen/report">Report an Issue</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── How points work ── */}
      <Card className="border border-slate-100 shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <div className="h-7 w-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <Flame className="h-4 w-4 text-orange-500" />
            </div>
            How Points Work
          </CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-2 text-xs">
          {[
            { action: 'Complaint resolved',    pts: '+10 pts'      },
            { action: 'AI-verified genuine',   pts: '+5 pts bonus' },
          ].map((item) => (
            <div key={item.action} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
              <span className="text-muted-foreground">{item.action}</span>
              <span className="font-semibold text-orange-600">{item.pts}</span>
            </div>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
