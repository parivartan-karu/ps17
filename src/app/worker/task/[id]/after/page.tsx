'use client';

import { doc } from 'firebase/firestore';
import { useParams } from 'next/navigation';

import { useDoc, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { useWorkerProfile } from '@/hooks/use-worker-profile';
import type { Report } from '@/lib/types';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import WorkerMediaUploadForm from '@/components/worker-media-upload-form';

export default function WorkerAfterUploadPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { workerId, workerName, isLoading: isWorkerLoading } = useWorkerProfile();

  const reportRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'reports', params.id);
  }, [firestore, params.id]);

  const { data: report, isLoading } = useDoc<Report>(reportRef);

  if (isLoading || isWorkerLoading) {
    return <Skeleton className="h-[420px] w-full" />;
  }

  if (!report || !reportRef) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Task not found</CardTitle>
        </CardHeader>
      </Card>
    );
  }

  return <WorkerMediaUploadForm mode="after" report={report} reportRef={reportRef} workerId={workerId} workerName={workerName} />;
}
