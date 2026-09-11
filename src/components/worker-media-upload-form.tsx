'use client';

import { useMemo, useState } from 'react';
import type { DocumentData, DocumentReference } from 'firebase/firestore';
import { arrayUnion, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Video, Image as ImageIcon, ArrowLeft } from 'lucide-react';

import type { Report, WorkerMediaType } from '@/lib/types';
import { buildWorkerLogEntry } from '@/lib/worker';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type UploadMode = 'before' | 'after';

type Props = {
  mode: UploadMode;
  report: Report;
  reportRef: DocumentReference<DocumentData>;
  workerId: string;
  workerName: string;
};

export default function WorkerMediaUploadForm({ mode, report, reportRef, workerId, workerName }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [mediaUrl, setMediaUrl] = useState(
    mode === 'before' ? report.beforeWorkMediaUrl || '' : report.afterWorkMediaUrl || report.afterImageUrl || ''
  );
  const [mediaType, setMediaType] = useState<WorkerMediaType | null>(
    mode === 'before'
      ? report.beforeWorkMediaType || null
      : report.afterWorkMediaType || (report.afterImageUrl ? 'image' : null)
  );
  const [notes, setNotes] = useState(
    mode === 'before' ? report.beforeWorkNotes || '' : report.afterWorkNotes || ''
  );
  const [fileName, setFileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = useMemo(
    () =>
      mode === 'before'
        ? {
            title: 'Before Work Upload',
            description: 'Capture the site condition before the repair starts.',
            buttonLabel: 'Save Before Work Proof',
            backHref: `/worker/task/${report.id}`,
          }
        : {
            title: 'After Work Upload',
            description: 'Upload the final image or video after completing the task.',
            buttonLabel: 'Save After Work Proof',
            backHref: `/worker/task/${report.id}`,
          },
    [mode, report.id]
  );

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const nextMediaType: WorkerMediaType = file.type.startsWith('video') ? 'video' : 'image';
    setMediaType(nextMediaType);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = () => {
      setMediaUrl(typeof reader.result === 'string' ? reader.result : '');
    };
    reader.readAsDataURL(file);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mediaUrl || !mediaType) {
      toast({
        variant: 'destructive',
        title: 'Proof required',
        description: 'Please upload an image or short video before saving.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date().toISOString();
      const proofLabel = `${mode === 'before' ? 'before' : 'after'}-work ${mediaType}`;
      const updatePayload =
        mode === 'before'
          ? {
              beforeWorkMediaUrl: mediaUrl,
              beforeWorkMediaType: mediaType,
              beforeWorkUploadedAt: now,
              beforeWorkNotes: notes || null,
              status: 'In Progress' as const,
              workflowStage: 'in_progress' as const,
              workerAssignmentStatus: 'Accepted' as const,
              assignedWorkerId: report.assignedWorkerId || workerId,
              assignedContractor: report.assignedContractor || workerName,
              acceptedAt: report.acceptedAt || now,
              actionLog: arrayUnion(
                buildWorkerLogEntry('In Progress', workerName, `Uploaded ${proofLabel}.${notes ? ` ${notes}` : ''}`)
              ),
            }
          : {
              afterWorkMediaUrl: mediaUrl,
              afterWorkMediaType: mediaType,
              afterWorkUploadedAt: now,
              afterWorkNotes: notes || null,
              afterImageUrl: mediaType === 'image' ? mediaUrl : report.afterImageUrl || null,
              actionLog: arrayUnion(
                buildWorkerLogEntry(report.status === 'Assigned' ? 'In Progress' : report.status, workerName, `Uploaded ${proofLabel}.${notes ? ` ${notes}` : ''}`)
              ),
            };

      await updateDoc(reportRef, updatePayload);

      toast({
        title: 'Proof saved',
        description: `${mode === 'before' ? 'Before' : 'After'} work evidence has been updated.`,
      });

      router.push(`/worker/task/${report.id}`);
    } catch (error) {
      console.error(error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'The proof could not be saved. Try a smaller image or video.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" className="px-0">
        <Link href={config.backHref}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to task
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{config.title}</CardTitle>
          <CardDescription>{config.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor={`${mode}-proof`}>Upload image or short video</Label>
              <Input
                id={`${mode}-proof`}
                type="file"
                accept="image/*,video/*"
                capture="environment"
                onChange={handleFileChange}
              />
              <p className="text-sm text-muted-foreground">
                Mobile devices can open the camera directly. Short clips work best if you upload video.
              </p>
              {fileName ? <p className="text-sm font-medium">{fileName}</p> : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${mode}-notes`}>Notes</Label>
              <Textarea
                id={`${mode}-notes`}
                placeholder={mode === 'before' ? 'Example: Site reached, materials ready.' : 'Example: Pothole filled and cleaned.'}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>

            {mediaUrl && mediaType ? (
              <div className="rounded-lg border bg-muted/30 p-4">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium">
                  {mediaType === 'image' ? <ImageIcon className="h-4 w-4" /> : <Video className="h-4 w-4" />}
                  Preview
                </div>
                {mediaType === 'image' ? (
                  <Image
                    src={mediaUrl}
                    alt={`${mode} work preview`}
                    width={1200}
                    height={800}
                    className="w-full rounded-md object-cover"
                  />
                ) : (
                  <video src={mediaUrl} controls className="w-full rounded-md" />
                )}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  {config.buttonLabel}
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
