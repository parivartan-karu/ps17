'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaderboardPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/citizen/redeem');
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
      <p className="text-sm text-slate-500 font-medium">Redirecting to Redeem Rewards Portal…</p>
    </div>
  );
}
