'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Archive, File, MoreHorizontal, Search, Sparkles, UserCheck } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { useAuth, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, doc, updateDoc, arrayUnion, where } from 'firebase/firestore';
import type { Report, ReportStatus, User } from '@/lib/types';
import { useFirestore } from '@/firebase/provider';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { buildAuthHeaders } from '@/lib/client-auth';

const statusColors: Record<ReportStatus, string> = {
  Submitted: 'bg-blue-500',
  'Under Verification': 'bg-yellow-500',
  Assigned: 'bg-orange-500',
  'In Progress': 'bg-amber-500',
  Resolved: 'bg-green-500',
  Rejected: 'bg-red-500',
};

const ACTIVE_STATUSES: ReportStatus[] = ['Submitted', 'Under Verification', 'Assigned', 'In Progress'];
const ARCHIVE_STATUSES: ReportStatus[] = ['Resolved', 'Rejected'];

type ComplaintView = 'active' | ReportStatus;

function matchesSearch(report: Report, value: string) {
  if (!value) return true;

  const haystack = [
    report.description,
    report.location,
    report.userName,
    report.category,
    report.department,
    report.assignedContractor,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(value);
}

export default function SmcComplaintsPage() {
  const [view, setView] = useState<ComplaintView>('active');
  const [search, setSearch] = useState('');
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const reportsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'reports'), orderBy('timestamp', 'desc'));
  }, [firestore]);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);

  const { data: reports, isLoading } = useCollection<Report>(reportsQuery);
  const { data: workers } = useCollection<User>(workersQuery);

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    const searchValue = search.trim().toLowerCase();

    return reports.filter((report) => {
      if (view === 'active') {
        if (!ACTIVE_STATUSES.includes(report.status)) {
          return false;
        }
      } else if (report.status !== view) {
        return false;
      }

      return matchesSearch(report, searchValue);
    });
  }, [reports, search, view]);

  const summary = useMemo(() => {
    if (!reports) {
      return null;
    }

    const activeCount = reports.filter((report) => ACTIVE_STATUSES.includes(report.status)).length;
    const resolvedCount = reports.filter((report) => report.status === 'Resolved').length;
    const archiveCount = reports.filter((report) => ARCHIVE_STATUSES.includes(report.status)).length;
    const attentionCount = reports.filter((report) => report.status === 'Submitted' || report.status === 'Under Verification').length;

    return {
      totalCount: reports.length,
      activeCount,
      resolvedCount,
      archiveCount,
      attentionCount,
    };
  }, [reports]);

  const handleUpdateStatus = async (report: Report, newStatus: ReportStatus, details?: { department?: string }) => {
    if (!auth || !user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
      return;
    }

    const isReassignment = newStatus === 'Assigned' && details?.department;
    if (report.status === newStatus && !isReassignment) return;

    try {
      const updatePayload: Record<string, unknown> = {};
      let remarks = `Status updated to ${newStatus}.`;

      if (newStatus === 'Assigned' && details?.department) {
        updatePayload.department = details.department;
        remarks = `Quick-assigned to ${details.department} department based on AI suggestion.`;
      }

      // Call atomic API endpoint for status changes
      const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
      const response = await fetch(`/api/smc/complaints/${report.id}/resolve`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          newStatus,
          remarks,
          updatePayload,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update report status.');
      }

      toast({
        title: 'Report Updated',
        description: `The report has been updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Update Failed',
        description: error instanceof Error ? error.message : 'Could not update the report status.',
      });
    }
  };

  const handleAssignWorker = async (report: Report, worker: User) => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: 'Authentication Error', description: 'You must be logged in.' });
      return;
    }

    const reportRef = doc(firestore, 'reports', report.id);

    try {
      await updateDoc(reportRef, {
        status: 'Assigned',
        assignedWorkerId: worker.id,
        assignedContractor: worker.name,
        assignedBy: user.displayName || 'SMC Officer',
        workerAssignmentStatus: 'Pending',
        actionLog: arrayUnion({
          status: 'Assigned',
          timestamp: new Date().toISOString(),
          actor: 'Official',
          actorName: user.displayName || 'SMC Officer',
          notes: `Assigned to ${worker.name}.`,
        }),
      });

      if (worker.phoneNumber) {
        const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
        await fetch('/api/auth/send-sms', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            phoneNumber: worker.phoneNumber,
            message: `New task assigned: ${report.description}. Location: ${report.location}.`,
          }),
        });
      }

      toast({ title: 'Worker assigned', description: `${worker.name} has been assigned to this complaint.` });
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Assignment failed', description: 'Could not assign worker.' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Complaints</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Review complaints, assign specific workers, and move finished cases into the resolved archive.
        </p>
      </div>

      <Tabs value={view} onValueChange={(value) => setView(value as ComplaintView)}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
          <div className="overflow-x-auto pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
            <TabsList className="inline-flex w-max lg:w-auto">
              <TabsTrigger value="active">Active queue</TabsTrigger>
              <TabsTrigger value="Submitted">Submitted</TabsTrigger>
              <TabsTrigger value="Under Verification" className="whitespace-nowrap">Under Verification</TabsTrigger>
              <TabsTrigger value="Assigned">Assigned</TabsTrigger>
              <TabsTrigger value="In Progress" className="whitespace-nowrap">In Progress</TabsTrigger>
              <TabsTrigger value="Resolved">Resolved archive</TabsTrigger>
              <TabsTrigger value="Rejected">Rejected</TabsTrigger>
            </TabsList>
          </div>
          <div className="flex flex-1 items-center gap-2 lg:ml-auto lg:max-w-sm">
            <div className="relative w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by citizen, location, category, or department"
                className="pl-9"
              />
            </div>
            <Button size="sm" variant="outline" className="h-10 gap-1 shrink-0">
              <File className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>

        <TabsContent value={view} className="mt-6">
          <Card className="shadow-sm">
            <CardHeader className="space-y-1">
              <CardTitle>{view === 'active' ? 'Active complaints' : `${view} complaints`}</CardTitle>
              <CardDescription>
                {view === 'active'
                  ? 'Resolved items stay in the archive tab so the active queue stays focused.'
                  : 'Manage the selected complaint state and review archived records when needed.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead className="hidden w-[100px] sm:table-cell">
                        <span className="sr-only">Image</span>
                      </TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="hidden md:table-cell">Citizen</TableHead>
                      <TableHead className="hidden lg:table-cell">Responsibility</TableHead>
                      <TableHead className="hidden md:table-cell">Date</TableHead>
                      <TableHead>
                        <span className="sr-only">Actions</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading && Array.from({ length: 8 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell className="hidden sm:table-cell"><Skeleton className="h-16 w-16 rounded-md" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                        <TableCell className="hidden lg:table-cell"><Skeleton className="h-6 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                      </TableRow>
                    ))}

                    {!isLoading && filteredReports.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-14 text-center text-muted-foreground">
                          No complaints match the selected filters.
                        </TableCell>
                      </TableRow>
                    )}

                    {!isLoading && filteredReports.map((report) => {
                      const isArchive = report.status === 'Resolved' || report.status === 'Rejected';
                      const canQuickAssign = !isArchive && report.aiAnalysis?.suggestedDepartment && report.aiAnalysis.suggestedDepartment !== 'Unassigned';
                      const canResolve = !isArchive && report.status !== 'Resolved';

                      return (
                        <TableRow key={report.id} className="hover:bg-slate-50/80">
                          <TableCell className="hidden sm:table-cell">
                            <img
                              alt="Report image"
                              className="aspect-square rounded-md object-cover"
                              height="64"
                              src={report.imageUrl}
                              width="64"
                            />
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <p className="line-clamp-2 text-sm text-slate-900">{report.description}</p>
                              <p className="text-xs text-muted-foreground">{report.location.substring(0, 48)}{report.location.length > 48 ? '...' : ''}</p>
                              <div className="flex flex-wrap gap-2 pt-1 text-xs text-muted-foreground">
                                <span>{report.category}</span>
                                <span>•</span>
                                <span>{report.department || 'Unassigned'}</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[report.status] ?? 'bg-gray-500'}>{report.status}</Badge>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {report.userName}
                          </TableCell>
                          <TableCell className="hidden lg:table-cell">
                            {report.assignedContractor ? (
                              <div className="flex items-center gap-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                {report.assignedContractor}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground italic bg-slate-100 px-2 py-0.5 rounded-full">Unassigned</span>
                            )}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            {new Date(report.timestamp).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button aria-haspopup="true" size="icon" variant="ghost">
                                  <MoreHorizontal className="h-4 w-4" />
                                  <span className="sr-only">Toggle menu</span>
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuItem asChild>
                                  <Link href={`/smc/complaint/${report.id}`}>View Details</Link>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            <CardFooter>
              <div className="text-xs text-muted-foreground">
                Showing <strong>{filteredReports.length}</strong> of <strong>{summary?.totalCount ?? 0}</strong> reports. Resolved reports stay in the archive tab.
              </div>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
