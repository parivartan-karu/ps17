'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { collection, query } from 'firebase/firestore';
import {
  Flag, CheckCircle, PlusCircle, Star, Flame,
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import type { Report, User as UserType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { doc } from 'firebase/firestore';

const NearbyServicesMap = dynamic(
  () => import('@/components/maps/nearby-services-map'),
  { ssr: false, loading: () => <Skeleton className="h-80 w-full rounded-2xl" /> }
);

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function CitizenDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: profile } = useDoc<UserType>(profileRef);

  const allReportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'));
  }, [firestore]);

  const { data: allReports, isLoading } = useCollection<Report>(allReportsQuery);

  const cityStats = useMemo(() => {
    if (!allReports) return null;
    const h24 = new Date(Date.now() - 86_400_000);
    const resolvedToday = allReports.filter(r => {
      if (r.status !== 'Resolved') return false;
      const entry = r.actionLog?.find(l => l.status === 'Resolved');
      return entry ? new Date(entry.timestamp) > h24 : false;
    }).length;
    return {
      total: allReports.length,
      inProgress: allReports.filter(r => ['Assigned', 'In Progress'].includes(r.status)).length,
      resolvedToday,
    };
  }, [allReports]);

  const myPoints = profile?.points ?? 0;

  return (
    <div className="flex-1 space-y-3 p-4 pt-3 pb-8">

      {/* ── Hero ── */}
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-teal-700 p-5 text-white shadow-md">
        <p className="text-xs font-medium text-white/70 uppercase tracking-wide">{getGreeting()}</p>
        <h1 className="text-xl font-bold mt-0.5 tracking-tight">
          {profile?.name?.split(' ')[0] ?? 'Citizen'}
        </h1>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1.5 text-sm font-semibold">
            <Star className="h-3.5 w-3.5 fill-yellow-300 text-yellow-300" />
            <span>{myPoints} pts</span>
          </div>
          <Button
            size="sm"
            asChild
            className="ml-auto bg-white text-emerald-700 hover:bg-white/90 rounded-full font-semibold shadow-sm h-8 px-4 text-xs"
          >
            <Link href="/citizen/report">
              <PlusCircle className="mr-1.5 h-3.5 w-3.5" />
              Report Issue
            </Link>
          </Button>
        </div>
      </div>

      {/* ── City stats ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Total Reports', value: cityStats?.total,       icon: Flag,        bg: 'bg-blue-50',   iconColor: 'text-blue-500'   },
          { label: 'In Progress',   value: cityStats?.inProgress,  icon: Flame,       bg: 'bg-orange-50', iconColor: 'text-orange-500' },
          { label: 'Resolved Today',value: cityStats?.resolvedToday,icon: CheckCircle, bg: 'bg-green-50',  iconColor: 'text-green-600'  },
        ].map(s => (
          <Card key={s.label} className="border border-slate-100 shadow-none">
            <CardContent className="p-3 flex flex-col items-center gap-1.5">
              <div className={`h-8 w-8 rounded-xl ${s.bg} flex items-center justify-center`}>
                <s.icon className={`h-4 w-4 ${s.iconColor}`} />
              </div>
              {isLoading
                ? <Skeleton className="h-5 w-8" />
                : <p className="text-base font-bold leading-none">{s.value ?? 0}</p>
              }
              <p className="text-[10px] text-muted-foreground text-center leading-tight">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Nearby services map ── */}
      <NearbyServicesMap />

    </div>
  );
}
