'use client';

import AuthGuard from '@/components/auth-guard';
import { DeptSidebar } from '@/components/dept-sidebar';
import { usePathname } from 'next/navigation';

export default function DeptLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginRoute = pathname === '/dept/login';

  if (isLoginRoute) {
    return (
      <AuthGuard
        loginPath="/dept/login"
        allowedRoles={['department_head']}
        publicPaths={['/dept/login']}
      >
        <>{children}</>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard
      loginPath="/dept/login"
      allowedRoles={['department_head']}
      publicPaths={['/dept/login']}
    >
      <div className="flex min-h-screen bg-gray-50">
        <DeptSidebar />
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </AuthGuard>
  );
}
