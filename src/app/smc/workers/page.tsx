'use client';

import { useMemo, useState } from 'react';
import { useAuth, useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { User } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { HardHat, Mail, Search, Trash2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { buildAuthHeaders } from '@/lib/client-auth';

export default function SmcWorkersPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [organizationFilter, setOrganizationFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [deletingWorkerId, setDeletingWorkerId] = useState<string | null>(null);

  const workersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'), where('role', '==', 'worker'));
  }, [firestore]);

  const { data: workers, isLoading } = useCollection<User>(workersQuery);

  const workerData = useMemo(() => {
    if (!workers) return [];

    const searchTerm = search.trim().toLowerCase();

    return workers
      .filter((worker) => organizationFilter === 'all' || (worker.organization || 'Unspecified') === organizationFilter)
      .filter((worker) => {
        if (!searchTerm) return true;
        const haystack = [worker.name, worker.email, worker.organization, worker.employeeId, worker.department]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchTerm);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [workers, organizationFilter, search]);

  const availableOrganizations = useMemo(() => {
    const orgSet = new Set((workers || []).map((worker) => worker.organization || 'Unspecified'));
    return ['all', ...Array.from(orgSet).sort()];
  }, [workers]);

  const handleDeleteWorker = async (worker: User) => {
    const confirmDelete = window.confirm(
      `Delete ${worker.name}${worker.employeeId ? ` (${worker.employeeId})` : ''} from workers?`
    );

    if (!confirmDelete) {
      return;
    }

    setDeletingWorkerId(worker.id);

    try {
      const headers = await buildAuthHeaders(auth);
      const response = await fetch(`/api/smc/workers/${encodeURIComponent(worker.id)}`, {
        method: 'DELETE',
        headers,
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || 'Worker deletion failed.');
      }

      toast({
        title: 'Worker deleted',
        description: `${worker.name} was removed from the roster.`,
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Delete failed',
        description: error instanceof Error ? error.message : 'Could not delete worker.',
      });
    } finally {
      setDeletingWorkerId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-6 md:p-8 rounded-lg shadow-lg">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">Field Worker Management</h1>
        <p className="text-base md:text-lg">Monitor and manage all field personnel.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HardHat /> Worker Roster</CardTitle>
          <CardDescription>
            A list of all registered field workers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-6 grid gap-3 md:grid-cols-3">
            <Select value={organizationFilter} onValueChange={setOrganizationFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filter by organization" />
              </SelectTrigger>
              <SelectContent>
                {availableOrganizations.map((org) => (
                  <SelectItem key={org} value={org}>
                    {org === 'all' ? 'All Organizations' : org}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search workers"
              />
            <div className="flex h-10 items-center rounded-md border px-3 text-xs text-muted-foreground">
              <Search className="mr-2 h-3.5 w-3.5" /> Showing {workerData.length} workers
            </div>
          </div>

          <div className="overflow-x-auto -mx-6 px-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Worker</TableHead>
                <TableHead>Organization</TableHead>
                <TableHead className="hidden sm:table-cell">Department</TableHead>
                <TableHead className="hidden sm:table-cell">Worker ID</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-full" /><Skeleton className="h-6 w-32" /></div></TableCell>
                  <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-20" /></TableCell>
                  <TableCell className="hidden sm:table-cell"><Skeleton className="h-6 w-28" /></TableCell>
                  <TableCell className="hidden md:table-cell"><Skeleton className="h-6 w-40" /></TableCell>
                  <TableCell><Skeleton className="h-9 w-24 ml-auto" /></TableCell>
                </TableRow>
              ))}
              {!isLoading && workerData?.map(worker => (
                <TableRow key={worker.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                        <AvatarFallback>{worker.name.charAt(0).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div>
                        <span className="font-medium text-sm sm:text-base">{worker.name}</span>
                        {worker.designation && <div className="text-xs text-muted-foreground">{worker.designation}</div>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{worker.organization || 'Unspecified'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{worker.department || 'Unassigned'}</TableCell>
                  <TableCell className="hidden sm:table-cell">{worker.employeeId || '-'}</TableCell>
                  <TableCell className="hidden md:table-cell">
                    <a href={`mailto:${worker.email}`} className="text-muted-foreground hover:text-primary flex items-center gap-2">
                        <Mail className="h-4 w-4" /> <span className="truncate max-w-[150px]">{worker.email}</span>
                    </a>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteWorker(worker)}
                      disabled={deletingWorkerId === worker.id}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      {deletingWorkerId === worker.id ? 'Deleting...' : 'Delete'}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
          {!isLoading && workerData.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              No users with the 'worker' role found in the database.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
