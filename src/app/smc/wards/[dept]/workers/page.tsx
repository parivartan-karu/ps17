'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, HardHat, Mail, Users } from 'lucide-react';

// Inline spec map — keeps slug → department name mapping without cross-file import issues
const DEPT_MAP: Record<string, { name: string; legacyDepts: string[] }> = {
  'road-maintenance': {
    name: 'Road Maintenance Department',
    legacyDepts: ['Engineering', 'Traffic & Roads', 'Roads', 'Road Maintenance Department'],
  },
  'solid-waste': {
    name: 'Solid Waste Management Department',
    legacyDepts: ['Sanitation', 'Solid Waste Management Department'],
  },
  'water-drainage': {
    name: 'Water & Drainage Department',
    legacyDepts: ['Water Supply', 'Drainage', 'Water & Drainage Department'],
  },
  electrical: {
    name: 'Electrical Department',
    legacyDepts: ['Electrical', 'Electricity', 'Electrical Department'],
  },
  'public-works': {
    name: 'Construction & Public Works Department',
    legacyDepts: ['Public Works', 'Construction & Public Works Department'],
  },
};

export default function DepartmentWorkersPage() {
  const { dept } = useParams<{ dept: string }>();
  const firestore = useFirestore();

  const spec = DEPT_MAP[dept];

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);

  const { data: allWorkers, isLoading } = useCollection<User>(workersQuery);

  const workers = useMemo(() => {
    if (!allWorkers || !spec) return [];
    return allWorkers.filter(worker => {
      const workerDept = worker.department || '';
      return spec.legacyDepts.some(d => workerDept.toLowerCase() === d.toLowerCase());
    });
  }, [allWorkers, spec]);

  if (!spec) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" className="px-0">
          <Link href="/smc/wards"><ArrowLeft className="mr-2 h-4 w-4" />Back to Departments</Link>
        </Button>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Department not found.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" className="px-0">
        <Link href="/smc/wards"><ArrowLeft className="mr-2 h-4 w-4" />Back to Departments</Link>
      </Button>

      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-lg shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold mb-1">{spec.name}</h1>
        <p className="text-sm md:text-base opacity-90">Field workers registered under this department.</p>
      </div>

      {/* Workers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Field Workers
          </CardTitle>
          <CardDescription>
            {isLoading ? 'Loading...' : `${workers.length} worker${workers.length !== 1 ? 's' : ''} registered`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                  <Skeleton className="h-6 w-20" />
                </div>
              ))}
            </div>
          )}

          {!isLoading && workers.length === 0 && (
            <div className="py-16 text-center text-muted-foreground">
              <HardHat className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No workers registered yet</p>
              <p className="text-xs mt-1">Workers added under this department will appear here.</p>
            </div>
          )}

          {!isLoading && workers.length > 0 && (
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Worker</TableHead>
                    <TableHead className="hidden sm:table-cell">Designation</TableHead>
                    <TableHead className="hidden md:table-cell">Skill Type</TableHead>
                    <TableHead className="hidden sm:table-cell">Employee ID</TableHead>
                    <TableHead className="hidden md:table-cell">Contact</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workers.map(worker => (
                    <TableRow key={worker.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9 shrink-0">
                            <AvatarFallback className="text-xs font-bold">
                              {worker.name?.charAt(0).toUpperCase() ?? '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-semibold leading-tight">{worker.name}</p>
                            <p className="text-xs text-muted-foreground">{worker.wardArea || 'Unspecified area'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-sm">
                        {worker.designation || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {worker.skillType ? (
                          <Badge variant="secondary" className="text-xs">{worker.skillType}</Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="hidden sm:table-cell text-xs font-mono text-muted-foreground">
                        {worker.employeeId || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <a href={`mailto:${worker.email}`} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate max-w-[140px]">{worker.email}</span>
                        </a>
                      </TableCell>
                      <TableCell>
                        <Badge variant={worker.isAvailable !== false ? 'default' : 'secondary'} className="text-[10px]">
                          {worker.isAvailable !== false ? 'Available' : 'Busy'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
