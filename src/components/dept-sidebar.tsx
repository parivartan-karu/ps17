'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Users, LogOut, Building2, Bell,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserType } from '@/lib/types';
import { departmentConfig } from '@/lib/constants';

const navItems = [
  { href: '/dept/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dept/complaints', label: 'Complaints', icon: ClipboardList },
  { href: '/dept/workers', label: 'Workers', icon: Users },
];

export function DeptSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();

  const userRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: profile } = useDoc<UserType>(userRef);

  const dept = profile?.department ?? 'Department';
  const cfg = departmentConfig[dept];

  if (!user) return null;

  return (
    <>
      {/* Mobile top bar */}
      <div className="fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between bg-indigo-700 px-4 text-white md:hidden">
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          <span className="font-bold text-sm truncate max-w-[180px]">{dept} Dept</span>
        </div>
        <div className="flex gap-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`rounded-lg p-1.5 transition-colors ${pathname.startsWith(item.href) ? 'bg-white/20' : 'hover:bg-white/10'}`}>
              <item.icon className="h-5 w-5" />
            </Link>
          ))}
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden md:flex w-60 shrink-0 flex-col bg-indigo-800 text-white">
        {/* Brand */}
        <div className="p-5 border-b border-indigo-700">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-xl">
              {cfg?.icon ?? '🏛️'}
            </div>
            <div>
              <p className="font-bold text-sm">{dept}</p>
              <p className="text-xs text-indigo-300">Dept Portal</p>
            </div>
          </div>
          {profile?.name && (
            <p className="mt-3 text-xs text-indigo-300">Logged in as <span className="font-medium text-white">{profile.name}</span></p>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all ${
                  active ? 'bg-white/20 text-white' : 'text-indigo-200 hover:bg-white/10 hover:text-white'
                }`}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-3 border-t border-indigo-700">
          <button
            onClick={async () => { await signOut(auth); router.push('/dept/login'); }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-indigo-200 hover:bg-white/10 hover:text-white transition-all"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </div>

      {/* Mobile spacer */}
      <div className="h-14 md:hidden" />
    </>
  );
}
