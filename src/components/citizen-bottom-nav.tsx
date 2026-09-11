'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, FileText, Plus, Trophy, MessageCircle } from 'lucide-react';

const bottomNavItems = [
  { href: '/citizen/dashboard',       label: 'Home',      icon: Home          },
  { href: '/citizen/my-complaints',   label: 'Reports',   icon: FileText      },
  { href: '/citizen/report',          label: 'Report',    icon: Plus,    accent: true },
  { href: '/citizen/leaderboard',     label: 'Ranks',     icon: Trophy        },
  { href: '/citizen/chatbot',         label: 'Chat',      icon: MessageCircle },
];

export default function CitizenBottomNav() {
  const pathname = usePathname();

  return (
    <div className="fixed bottom-0 inset-x-0 z-[9999] pointer-events-none flex justify-center pb-0 md:pb-4 px-0 md:px-4">
      <div className="pointer-events-auto w-full md:max-w-md bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-t md:border border-gray-200/80 dark:border-slate-800/80 shadow-[0_-4px_25px_rgba(0,0,0,0.08)] dark:shadow-slate-950/50 rounded-t-2xl md:rounded-full transition-all duration-300">
        <div className="flex h-16 items-center justify-between px-3 max-w-md mx-auto">
          {bottomNavItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== '/citizen/dashboard' && pathname.startsWith(item.href));
            const Icon = item.icon;

            if (item.accent) {
              return (
                <Link key={item.href} href={item.href} className="group relative flex flex-col items-center -mt-6">
                  <div className={cn(
                    'flex h-13 w-13 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 shadow-lg shadow-emerald-500/30 ring-4 ring-white dark:ring-slate-900 transition-all duration-200 group-hover:scale-110 group-active:scale-95',
                    isActive && 'from-emerald-600 to-teal-700 shadow-emerald-500/50 ring-emerald-100 dark:ring-emerald-950'
                  )}>
                    <Icon className="h-6 w-6 text-white transition-transform duration-200 group-hover:rotate-90" strokeWidth={2.5} />
                  </div>
                  <span className={cn(
                    'text-[10px] font-semibold tracking-tight mt-1 transition-colors',
                    isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-emerald-600/90 dark:text-emerald-400/90'
                  )}>{item.label}</span>
                </Link>
              );
            }

            return (
              <Link key={item.href} href={item.href} className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1 transition-all duration-150 active:scale-95">
                <div className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200',
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-400 scale-105' 
                    : 'text-gray-400 dark:text-slate-400 hover:text-gray-600 dark:hover:text-slate-200 hover:bg-gray-100/50 dark:hover:bg-slate-800/50'
                )}>
                  <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
                </div>
                <span className={cn(
                  'text-[10px] font-semibold tracking-tight leading-none transition-colors',
                  isActive ? 'text-emerald-600 dark:text-emerald-400 font-bold' : 'text-gray-400 dark:text-slate-400'
                )}>{item.label}</span>
              </Link>
            );
          })}
        </div>
        {/* Safe area spacer for mobile notches */}
        <div className="h-safe-area-inset-bottom bg-transparent" />
      </div>
    </div>
  );
}

