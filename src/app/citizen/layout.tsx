'use client';

import CitizenHeader from '@/components/citizen-header';
import CitizenBottomNav from '@/components/citizen-bottom-nav';
import AuthGuard from '@/components/auth-guard';
import { PWAInstallBanner } from '@/components/pwa-install-button';
import { usePathname } from 'next/navigation';
import GoogleTranslate from '@/components/GoogleTranslate';

export default function CitizenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/citizen/login';

  return (
    <AuthGuard loginPath="/citizen/login" allowedRoles={['citizen']} publicPaths={['/citizen/login']}>
      <div className="relative flex min-h-screen flex-col bg-gray-50 dark:bg-slate-950">
        {!isLoginRoute && <GoogleTranslate />}
        {!isLoginRoute && <CitizenHeader />}
        <main className={isLoginRoute ? 'flex-1' : 'flex-1 pb-24 md:pb-28'}>{children}</main>

        {!isLoginRoute && (
          <>
            <PWAInstallBanner variant="citizen" />

            <CitizenBottomNav />
          </>
        )}
      </div>
    </AuthGuard>
  );
}
