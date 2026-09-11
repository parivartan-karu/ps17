'use client';

import { useMemo } from 'react';
import { collection, query, where, doc } from 'firebase/firestore';
import { useCollection, useDoc, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report, User as UserType } from '@/lib/types';
import { normalizeDepartmentId } from '@/lib/departments';
import { DeptCommandCenter } from '@/components/dept-command-center';

export default function DeptDashboardPage() {
  const firestore = useFirestore();
  const { user } = useUser();

  const profileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);

  const { data: profile } = useDoc<UserType>(profileRef);

  const userDeptId = useMemo(() => (
    normalizeDepartmentId(profile?.departmentId || profile?.department)
  ), [profile?.departmentId, profile?.department]);

  const complaintsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);

  const { data: rawReports, isLoading: isReportsLoading } = useCollection<Report>(complaintsQuery);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);

  const { data: rawWorkers, isLoading: isWorkersLoading } = useCollection<UserType>(workersQuery);

  // Server-authorized department scoping
  const reports = useMemo(() => {
    if (!rawReports || !userDeptId) return [];
    return rawReports.filter(r => normalizeDepartmentId(r.departmentId || r.department) === userDeptId);
  }, [rawReports, userDeptId]);

  const workers = useMemo(() => {
    if (!rawWorkers || !userDeptId) return [];
    return rawWorkers.filter(w => normalizeDepartmentId(w.departmentId || w.department) === userDeptId);
  }, [rawWorkers, userDeptId]);

  if (!user) return null;

  return (
    <DeptCommandCenter
      reports={reports}
      workers={workers}
      profile={profile ?? null}
      isLoading={isReportsLoading || isWorkersLoading}
    />
  );
}

