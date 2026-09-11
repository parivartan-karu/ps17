'use client';

import AuthGuard from '@/components/auth-guard';
import SmcSidebar from '@/components/smc-sidebar';
import { usePathname } from 'next/navigation';
import GoogleTranslate from '@/components/GoogleTranslate';

export default function SmcLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/smc/login';

  if (isLoginRoute) {
    return (
      <AuthGuard
        loginPath="/smc/login"
        allowedRoles={['official', 'department_head']}
        publicPaths={['/smc/login']}
      >
        <>{children}</>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard
      loginPath="/smc/login"
      allowedRoles={['official', 'department_head']}
      publicPaths={['/smc/login']}
    >
      <div className="flex min-h-screen w-full bg-muted/30">
        <GoogleTranslate />
        <SmcSidebar />
        <main className="flex-1 overflow-y-auto">
          <div className="p-4 md:p-5 lg:p-6">{children}</div>
        </main>
      </div>
    </AuthGuard>
  );
}
