'use client';

import { useUser } from '@/firebase';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import type { User as UserProfile } from '@/lib/types';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { doc } from 'firebase/firestore';

interface AuthGuardProps {
  children: React.ReactNode;
  loginPath: string;
  allowedRoles?: UserProfile['role'][];
  publicPaths?: string[];
}

function getDefaultPathForRole(role: UserProfile['role']) {
  if (role === 'worker') return '/worker/dashboard';
  if (role === 'official' || role === 'department_head') return '/smc/dashboard';
  return '/citizen/dashboard';
}

export default function AuthGuard({
  children,
  loginPath,
  allowedRoles,
  publicPaths,
}: AuthGuardProps) {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();

  const isPublicPath = (publicPaths ?? [loginPath]).includes(pathname ?? '');

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const role = userProfile?.role;
  const shouldCheckRole = !!allowedRoles && allowedRoles.length > 0;
  const isRoleAllowed = !shouldCheckRole || (role ? allowedRoles.includes(role) : false);
  const isChecking = isUserLoading || (!!user && shouldCheckRole && isProfileLoading);

  useEffect(() => {
    if (isChecking || isPublicPath) return;

    if (!user) {
      router.replace(loginPath);
      return;
    }

    if (shouldCheckRole) {
      if (!role) {
        router.replace(loginPath);
        return;
      }

      if (!isRoleAllowed) {
        router.replace(getDefaultPathForRole(role));
      }
    }
  }, [isChecking, isPublicPath, user, shouldCheckRole, role, isRoleAllowed, router, loginPath]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (isPublicPath) {
    return <>{children}</>;
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to sign in...</p>
        </div>
      </div>
    );
  }

  if (shouldCheckRole && !isRoleAllowed) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Redirecting to your portal...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
