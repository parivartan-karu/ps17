'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ClipboardList, LayoutDashboard, User } from 'lucide-react';

import AuthGuard from '@/components/auth-guard';
import WorkerHeader from '@/components/worker-header';
import { PWAInstallBanner } from '@/components/pwa-install-button';
import { cn } from '@/lib/utils';
import GoogleTranslate from '@/components/GoogleTranslate';

const bottomNavItems = [
  { href: '/worker/dashboard', label: 'Home', icon: <LayoutDashboard className="h-5 w-5" /> },
  { href: '/worker/task', label: 'Tasks', icon: <ClipboardList className="h-5 w-5" /> },
  { href: '/worker/profile', label: 'Profile', icon: <User className="h-5 w-5" /> },
];

export default function WorkerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/worker/login';

  return (
    <AuthGuard loginPath="/worker/login" allowedRoles={['worker']} publicPaths={['/worker/login']}>
      <div className="flex min-h-screen w-full flex-col">
        {!isLoginRoute && <GoogleTranslate />}
        {!isLoginRoute && <WorkerHeader />}
        <main className="flex flex-1 flex-col gap-4 bg-muted/40 p-4 pb-24 md:gap-6 md:p-6 md:pb-6">{children}</main>

        {!isLoginRoute && <PWAInstallBanner variant="worker" />}

        {!isLoginRoute && (
          <div className="fixed bottom-0 left-0 z-[9999] w-full border-t bg-background/95 shadow-lg backdrop-blur-md md:hidden">
            <div className="mx-auto grid h-16 max-w-md grid-cols-3 items-center px-1">
              {bottomNavItems.map((item) => {
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'inline-flex h-full flex-col items-center justify-center rounded-lg px-2 py-1 transition-all duration-200',
                      'hover:bg-muted/80 active:scale-95',
                      isActive ? 'bg-amber-500/10 text-amber-600' : 'text-muted-foreground'
                    )}
                  >
                    <div className={cn('rounded-full p-2 transition-colors', isActive && 'bg-amber-500/10')}>{item.icon}</div>
                    <span className="mt-0.5 text-[11px] font-medium leading-none">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
