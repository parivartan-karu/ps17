'use client';

import { useMemo, useState, useRef, useEffect } from 'react';
import type { DocumentData, DocumentReference } from 'firebase/firestore';
import { arrayUnion, updateDoc } from 'firebase/firestore';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Loader2, Upload, Video, Image as ImageIcon, ArrowLeft, Camera, AlertTriangle, X } from 'lucide-react';

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

  // Live Camera states
  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (showCamera) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
          });
          setHasCameraPermission(true);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (error) {
          console.error('Error accessing camera:', error);
          setHasCameraPermission(false);
          toast({
            variant: 'destructive',
            title: 'Camera Access Denied',
            description: 'Please grant camera permissions in your browser settings or select a file.',
          });
        }
      };
      getCameraPermission();

      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach((track) => track.stop());
        }
      };
    }
  }, [showCamera, toast]);

  const handleCapturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setMediaUrl(dataUrl);
        setMediaType('image');
        setFileName(`Camera_Capture_${Date.now()}.jpg`);
        setShowCamera(false);
        toast({ title: '📸 Photo captured!', description: 'Proof captured via camera.' });
      }
    }
  };

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
        description: 'Please capture a photo with the live camera or choose a file before saving.',
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
            <div className="space-y-3">
              <Label>Capture or Upload Proof (Photo / Video)</Label>
              
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  onClick={() => setShowCamera(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  <Camera className="mr-2 h-4 w-4" />
                  Open Live Camera
                </Button>

                <div className="relative">
                  <Input
                    id={`${mode}-proof`}
                    type="file"
                    accept="image/*,video/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById(`${mode}-proof`)?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File from Device
                  </Button>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Tap <strong>Open Live Camera</strong> to capture live photo with webcam/device camera, or select a file from disk.
              </p>
              {fileName ? <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">Attached: {fileName}</p> : null}
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
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    {mediaType === 'image' ? <ImageIcon className="h-4 w-4 text-emerald-500" /> : <Video className="h-4 w-4 text-indigo-500" />}
                    Preview Evidence
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs text-red-500 hover:text-red-700"
                    onClick={() => { setMediaUrl(''); setMediaType(null); setFileName(''); }}
                  >
                    Remove / Retake
                  </Button>
                </div>
                {mediaType === 'image' ? (
                  <Image
                    src={mediaUrl}
                    alt={`${mode} work preview`}
                    width={1200}
                    height={800}
                    className="w-full rounded-md object-cover max-h-[400px]"
                  />
                ) : (
                  <video src={mediaUrl} controls className="w-full rounded-md max-h-[400px]" />
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

      {/* ── Live Camera Modal Viewfinder ──────────────── */}
      {showCamera && (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="relative z-10 flex items-center justify-between px-4 py-3 bg-black/70 backdrop-blur-md">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-semibold tracking-wider text-white uppercase">Live Field Camera</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20"
              onClick={() => setShowCamera(false)}
            >
              <X className="h-5 w-5" />
              <span className="sr-only">Close Camera</span>
            </Button>
          </div>

          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            <video
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              muted
              playsInline
            />
            
            {/* Viewfinder corner guides */}
            <div className="pointer-events-none absolute inset-8 md:inset-20">
              <div className="absolute left-0 top-0 h-10 w-10 border-l-4 border-t-4 border-white/80 rounded-tl-lg" />
              <div className="absolute right-0 top-0 h-10 w-10 border-r-4 border-t-4 border-white/80 rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 h-10 w-10 border-b-4 border-l-4 border-white/80 rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 h-10 w-10 border-b-4 border-r-4 border-white/80 rounded-br-lg" />
            </div>

            {hasCameraPermission === false && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
                <div className="rounded-full bg-red-500/20 p-4">
                  <AlertTriangle className="h-10 w-10 text-red-400" />
                </div>
                <p className="text-lg font-semibold text-white">Camera Access Denied</p>
                <p className="text-sm text-white/70 max-w-sm">
                  Please enable camera permissions in your browser or select a file using &quot;Choose File from Device&quot;.
                </p>
                <Button type="button" variant="secondary" onClick={() => setShowCamera(false)}>
                  Use File Upload Instead
                </Button>
              </div>
            )}
          </div>

          <div className="relative z-10 flex flex-col items-center justify-center gap-2 px-6 py-6 bg-black/80">
            <button
              type="button"
              onClick={handleCapturePhoto}
              disabled={!hasCameraPermission}
              className="group relative flex h-20 w-20 items-center justify-center rounded-full border-4 border-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30"
            >
              <div className="h-16 w-16 rounded-full bg-white transition-colors group-hover:bg-white/90 group-active:bg-red-500" />
              <span className="sr-only">Capture Photo</span>
            </button>
            <p className="text-xs text-white/60">Tap to capture live proof photo</p>
          </div>

          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}
    </div>
  );
}
