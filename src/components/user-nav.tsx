'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { User } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { signOut, GoogleAuthProvider } from 'firebase/auth';
import { userNavItems } from '@/lib/nav-items';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { doc } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { User as UserType } from '@/lib/types';
import { Skeleton } from './ui/skeleton';


export default function UserNav() {
  const { user, isUserLoading: isAuthLoading } = useUser();
  const auth = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserType>(userDocRef);

  const handleLogout = async () => {
    if (!auth) return;
    if (pathname?.startsWith('/worker')) {
      fetch('/api/worker/session', {
        method: 'DELETE',
        credentials: 'include',
      }).catch((error) => console.error('Failed to clear worker session', error));
    }
    await signOut(auth);
    router.push('/');
    toast({
      title: 'Logged Out',
      description: 'You have been successfully logged out.',
    })
  };

  // Sync profile info for Google sign-in users.
  // IMPORTANT: Only set role:'citizen' for BRAND NEW users — never overwrite
  // an existing role, which would silently downgrade a worker or official.
  useEffect(() => {
    if (user && firestore && !isProfileLoading) {
      const isGoogleUser = user.providerData.some(
        (provider) => provider.providerId === GoogleAuthProvider.PROVIDER_ID
      );

      if (isGoogleUser) {
        const userDocRef = doc(firestore, 'users', user.uid);
        if (userProfile) {
          // Profile exists — only sync mutable display fields, preserve role
          setDocumentNonBlocking(userDocRef, {
            id: user.uid,
            email: user.email,
            name: user.displayName,
          }, { merge: true });
        } else {
          // First-ever login — create full profile with default citizen role
          setDocumentNonBlocking(userDocRef, {
            id: user.uid,
            email: user.email,
            name: user.displayName,
            role: 'citizen',
            points: 0,
          }, { merge: true });
        }
      }
    }
  }, [user, firestore, userProfile, isProfileLoading]);

  const isLoading = isAuthLoading || (user && isProfileLoading);

  if (isLoading) {
    // A simple skeleton for the user nav button while loading.
    return (
        <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-full" />
        </div>
    );
  }

  if (!user) {
    return null;
  }

  const displayName = userProfile?.name ?? user.displayName ?? 'Citizen';
  const displayInitial = displayName?.charAt(0).toUpperCase() || 'U';
  const isWorkerArea = pathname?.startsWith('/worker');
  const navItems = isWorkerArea ? [{ href: '/worker/profile', label: 'Profile', icon: <User /> }] : userNavItems;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-8 w-8">
            <AvatarImage src={user.photoURL ?? ''} alt={displayName} />
            <AvatarFallback>{displayInitial}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{displayName}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email ?? 'No email'}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {navItems.map((item) => (
            <DropdownMenuItem key={item.href} asChild>
              <Link href={item.href}>
                {item.icon}
                <span>{item.label}</span>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
