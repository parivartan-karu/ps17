'use client';

import { useDoc, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import type { User as UserProfile } from '@/lib/types';
import { doc } from 'firebase/firestore';

export function useWorkerProfile() {
  const { user, isUserLoading, userError } = useUser();
  const firestore = useFirestore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userProfile, isLoading: isProfileLoading } = useDoc<UserProfile>(userDocRef);

  const workerName =
    userProfile?.name?.trim() ||
    user?.displayName?.trim() ||
    user?.email?.split('@')[0] ||
    'Field Worker';

  return {
    user,
    userProfile,
    workerId: user?.uid ?? '',
    workerName,
    workerEmail: user?.email ?? userProfile?.email ?? '',
    isLoading: isUserLoading || (!!user && isProfileLoading),
    error: userError,
  };
}
