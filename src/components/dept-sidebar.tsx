'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard, ClipboardList, Users, LogOut, BarChart3, ChevronRight, Menu,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as UserType } from '@/lib/types';
import { DeptIcon } from '@/components/dept-icon';
import { SignOutConfirmDialog } from '@/components/sign-out-confirm-dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';

const navItems = [
  { href: '/dept/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dept/complaints', label: 'Complaints', icon: ClipboardList },
  { href: '/dept/workers', label: 'Workers', icon: Users },
  { href: '/dept/analytics', label: 'Analytics', icon: BarChart3 },
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

  const userRole = profile?.role as string | undefined;
  const isSystemAdmin = userRole === 'admin' || profile?.name === 'System Admin' || (!profile?.department && (userRole === 'official' || userRole === 'admin'));
  const dept = profile?.department ? profile.department : (isSystemAdmin ? 'Admin' : 'Department');

  if (!user) return null;

  const handleLogout = async () => {
    if (!auth) return;
    await signOut(auth);
    router.push('/dept/login');
  };

  const navContent = (
    <nav className="flex flex-col gap-0.5 px-2.5">
      {navItems.map((item) => {
        const isActive = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
              isActive
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            <span
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors',
                isActive ? 'bg-white/20 text-white' : 'bg-muted text-slate-500 group-hover:bg-background group-hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
            </span>
            <span className="flex-1">{item.label}</span>
            {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <div className="hidden w-64 shrink-0 border-r bg-card md:block">
        <div className="flex h-full max-h-screen flex-col">
          {/* Header */}
          <div className="flex h-14 items-center gap-2.5 border-b px-4">
            <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0 text-indigo-600">
              <DeptIcon dept={profile?.department} className="h-5 w-5" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-[13px] font-bold tracking-tight truncate">{dept}</span>
              <span className="text-xs text-muted-foreground truncate">Department Operations</span>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto py-3">
            {navContent}
          </div>

          {/* Footer */}
          <div className="space-y-2.5 border-t p-3">
            {profile?.name && (
              <div className="flex items-center gap-2.5 rounded-lg bg-muted/50 p-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 font-bold text-xs shrink-0">
                  {profile.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{profile.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{profile.email || 'Department Official'}</p>
                </div>
              </div>
            )}
            <SignOutConfirmDialog onConfirm={handleLogout} />
          </div>
        </div>
      </div>

      {/* Mobile Header */}
      <header className="flex h-14 items-center justify-between gap-3 border-b bg-card px-3.5 md:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="shrink-0">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetHeader className="border-b px-4 py-3">
              <SheetTitle className="flex items-center gap-3">
                <div className="relative h-9 w-9 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0 text-indigo-600">
                  <DeptIcon dept={profile?.department} className="h-5 w-5" />
                </div>
                <div className="flex flex-col items-start min-w-0">
                  <span className="text-[13px] font-bold truncate">{dept}</span>
                  <span className="text-xs text-muted-foreground font-normal truncate">Department Operations</span>
                </div>
              </SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto py-3">
              {navContent}
            </div>
            <div className="border-t p-3">
              <SignOutConfirmDialog onConfirm={handleLogout} />
            </div>
          </SheetContent>
        </Sheet>

        <div className="flex items-center gap-2 min-w-0">
          <div className="relative h-8 w-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm flex items-center justify-center shrink-0 text-indigo-600">
            <DeptIcon dept={profile?.department} className="h-4 w-4" />
          </div>
          <span className="text-sm font-semibold truncate max-w-[150px]">{dept}</span>
        </div>

        <SignOutConfirmDialog onConfirm={handleLogout}>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </SignOutConfirmDialog>
      </header>
    </>
  );
}
