'use client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import type { Report } from '@/lib/types';
import { collection, query, where, orderBy, DocumentData, Query } from 'firebase/firestore';
import { History, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import Image from 'next/image';

const statusColors: { [key: string]: string } = {
    Resolved: 'bg-green-500',
    Rejected: 'bg-red-500',
};

const statusIcons: { [key: string]: React.ReactNode } = {
    Resolved: <CheckCircle className="h-5 w-5 text-green-500" />,
    Rejected: <XCircle className="h-5 w-5 text-red-500" />,
};

export default function WorkerHistoryPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    const historyQuery = useMemoFirebase(() => {
        if (!firestore || !user?.displayName) return null;
        return query(
            collection(firestore, 'reports'), 
            where('assignedContractor', '==', user.displayName),
            where('status', 'in', ['Resolved', 'Rejected']),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, user?.displayName]);

    const { data: tasks, isLoading: areTasksLoading } = useCollection<Report>(historyQuery);
    const isLoading = isUserLoading || areTasksLoading;

    const getResolutionDate = (report: Report) => {
        const resolutionLog = report.actionLog?.find(log => log.status === 'Resolved' || log.status === 'Rejected');
        return resolutionLog ? new Date(resolutionLog.timestamp).toLocaleDateString() : 'N/A';
    }

    return (
        <div className="space-y-4">
             <div className="bg-gradient-to-r from-green-500 to-teal-500 text-white p-6 md:p-8 rounded-lg shadow-lg mb-8">
                <h1 className="text-3xl md:text-4xl font-bold mb-2">Work History</h1>
                <p className="text-base md:text-lg">A log of all your completed and rejected tasks.</p>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Completed Task Log</CardTitle>
                    <CardDescription>A list of all tasks you've marked as Resolved or Rejected.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto -mx-6 px-6">
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[100px] sm:w-[120px]">Status</TableHead>
                                <TableHead className="w-[60px] sm:w-[80px]">Proof</TableHead>
                                <TableHead>Description</TableHead>
                                <TableHead className="hidden md:table-cell">Location</TableHead>
                                <TableHead className="text-right whitespace-nowrap">Completed</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && Array.from({length: 5}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                                    <TableCell><Skeleton className="h-10 w-10 rounded" /></TableCell>
                                    <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                                    <TableCell className="hidden md:table-cell"><Skeleton className="h-5 w-40" /></TableCell>
                                    <TableCell className="text-right"><Skeleton className="h-5 w-24 ml-auto" /></TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && tasks?.map(task => (
                                <TableRow key={task.id}>
                                     <TableCell>
                                        <div className="flex items-center gap-2">
                                            {statusIcons[task.status]}
                                            <span className="hidden sm:inline text-sm">{task.status}</span>
                                        </div>
                                    </TableCell>
                                     <TableCell>
                                        {task.afterImageUrl ? (
                                            <Image src={task.afterImageUrl} alt="Proof" width={40} height={40} className="rounded object-cover" />
                                        ) : (
                                            <div className="w-10 h-10 bg-muted rounded flex items-center justify-center text-muted-foreground text-xs">N/A</div>
                                        )}
                                     </TableCell>
                                    <TableCell className="font-medium">
                                        <Link href={`/worker/task/${task.id}`} className="hover:underline">
                                            <span className="line-clamp-2">{task.description}</span>
                                        </Link>
                                        <div className="text-xs text-muted-foreground md:hidden mt-1 line-clamp-1">
                                            {task.location.substring(0, 30)}...
                                        </div>
                                    </TableCell>
                                    <TableCell className="hidden md:table-cell text-sm">{task.location.substring(0, 40)}...</TableCell>
                                    <TableCell className="text-right text-sm">{getResolutionDate(task)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                    </div>
                    {!isLoading && (!tasks || tasks.length === 0) && (
                        <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed rounded-lg mt-4">
                            <History className="h-12 w-12 text-muted-foreground mb-4" />
                            <h3 className="text-xl font-semibold">No Completed Tasks</h3>
                            <p className="text-muted-foreground">Your work history is empty.</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
