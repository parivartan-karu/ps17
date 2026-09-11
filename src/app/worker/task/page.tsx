'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { ArrowRight, ClipboardList, HardHat } from 'lucide-react';
import { collection } from 'firebase/firestore';

import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useWorkerProfile } from '@/hooks/use-worker-profile';
import { isAssignedToWorker, workerStatusColors } from '@/lib/worker';
import type { Report } from '@/lib/types';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function WorkerTaskListPage() {
  const firestore = useFirestore();
  const { workerId, workerName, isLoading: isWorkerLoading } = useWorkerProfile();

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'reports');
  }, [firestore]);

  const { data: reports, isLoading: areReportsLoading } = useCollection<Report>(reportsQuery);

  const tasks = useMemo(() => {
    const allReports = reports || [];
    return allReports
      .filter((report) => isAssignedToWorker(report, workerId, workerName))
      .filter((report) => report.status === 'Assigned' || report.status === 'In Progress')
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [reports, workerId, workerName]);

  const isLoading = isWorkerLoading || areReportsLoading;

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-r from-green-500 to-teal-500 p-6 text-white shadow-lg md:p-8">
        <h1 className="text-3xl font-bold md:text-4xl">Task List</h1>
        <p className="mt-2 text-sm text-white/90 md:text-base">All currently assigned worker tasks, optimized for mobile handling.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assigned Tasks</CardTitle>
          <CardDescription>Open each task to accept, reject, upload proof, and complete the job.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto -mx-6 px-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Priority</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading &&
                  Array.from({ length: 4 }).map((_, index) => (
                    <TableRow key={index}>
                      <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                      <TableCell className="hidden sm:table-cell"><Skeleton className="h-5 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                      <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-16" /></TableCell>
                      <TableCell className="text-right"><Skeleton className="ml-auto h-8 w-20" /></TableCell>
                    </TableRow>
                  ))}
                {!isLoading &&
                  tasks.map((task) => (
                    <TableRow key={task.id}>
                      <TableCell className="font-medium">
                        <div className="max-w-[220px] truncate sm:max-w-none sm:whitespace-normal">{task.description}</div>
                        <div className="mt-1 text-xs text-muted-foreground sm:hidden">{task.location}</div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">{task.location}</TableCell>
                      <TableCell>
                        <Badge className={workerStatusColors[task.status]}>{task.status}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant={task.priority === 'High' || task.priority === 'Critical' ? 'destructive' : 'secondary'}>
                          {task.priority || 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link href={`/worker/task/${task.id}`}>
                            View
                            <ArrowRight className="ml-2 h-4 w-4" />
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>

          {!isLoading && tasks.length === 0 ? (
            <div className="mt-4 flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center">
              <HardHat className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="text-xl font-semibold">No assigned tasks</h3>
              <p className="mt-2 text-muted-foreground">Your queue is clear right now. You can check low-priority open work if you want to pick up extra tasks.</p>
              <Button asChild className="mt-4">
                <Link href="/worker/open-tasks">
                  Browse open tasks
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
