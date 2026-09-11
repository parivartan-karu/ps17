
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Camera,
  MapPin,
  Send,
  AlertTriangle,
  Loader2,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Image from 'next/image';
import { useUser } from '@/firebase/provider';
import { useFirestore } from '@/firebase/provider';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, doc, updateDoc, arrayUnion, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { aiDamageAssessment } from '@/ai/flows/ai-damage-assessment';
import { analyzeReportForWorkflow, getInitialStatus, createAutomatedActionLog, calculateAutomationConfidence } from '@/lib/workflow-automation';
import type { AIAnalysis } from '@/lib/types';
import { useDuplicateDetection } from '@/hooks/use-duplicate-detection';
import Link from 'next/link';

const problemCategories = [
  'Pothole',
  'Crack',
  'Surface failure',
  'Water-logged damage',
  'Garbage/Debris',
  'Streetlight Issue',
  'None',
];

const reportProblemSchema = z.object({
  category: z.string({ required_error: 'Please select a category.' }),
  description: z.string().min(10, 'Description must be at least 10 characters.'),
  location: z.string().min(5, 'Please provide a location.'),
  roadName: z.string().optional(),
  photo: z.string({ required_error: 'A photo is required.' }).url('Invalid photo data.'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
});

type ReportProblemForm = z.infer<typeof reportProblemSchema>;

export default function ReportProblemPage() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);

  const form = useForm<ReportProblemForm>({
    resolver: zodResolver(reportProblemSchema),
    defaultValues: {
      description: '',
      location: '',
      roadName: '',
      category: '',
    },
  });

  // Watch form values for duplicate detection
  const watchedLat = form.watch('latitude');
  const watchedLng = form.watch('longitude');
  const watchedCategory = form.watch('category');
  const watchedDesc = form.watch('description');

  const { nearby, isChecking, topDuplicate, isDuplicate, isProbable } = useDuplicateDetection({
    lat: watchedLat,
    lng: watchedLng,
    category: watchedCategory,
    description: watchedDesc,
    enabled: !!watchedLat && !!watchedLng,
  });

  const [showCamera, setShowCamera] = useState(false);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cachedAiAnalysis, setCachedAiAnalysis] = useState<AIAnalysis | null>(null);
  const [cachedAiPhoto, setCachedAiPhoto] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { user } = useUser();
  const firestore = useFirestore();
  const router = useRouter();

  const compressImageDataUrl = useCallback((sourceDataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        const maxDimension = 1024;
        const scale = Math.min(maxDimension / img.width, maxDimension / img.height, 1);
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Failed to compress image.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Failed to load image for compression.'));
      img.src = sourceDataUrl;
    });
  }, []);

  const normalizeCategory = useCallback((rawCategory: string): string => {
    const normalized = rawCategory.trim().toLowerCase();

    // Check for direct match first
    const directMatch = problemCategories.find(c => c.toLowerCase() === normalized);
    if (directMatch) return directMatch;

    // Check if any category is contained in the raw string (fuzzy match)
    const fuzzyMatch = problemCategories.find(c =>
      c !== 'None' && (normalized.includes(c.toLowerCase()) || c.toLowerCase().includes(normalized))
    );

    return fuzzyMatch || 'None';
  }, []);

  const runAiAnalysis = useCallback(async (imageDataUrl: string) => {
    setIsAnalyzing(true);
    try {
      const result = (await aiDamageAssessment({ mediaDataUri: imageDataUrl })) as any;
      const normalizedCategory = normalizeCategory(result.damageCategory || 'None');
      form.setValue('category', normalizedCategory);
      if (result.description) {
        form.setValue('description', result.description);
      }
      setCachedAiAnalysis(result);
      setCachedAiPhoto(imageDataUrl);

      // Add suggested location details to description if no custom location is set
      if (result.suggestedLocationDetails && !form.getValues('location')) {
        const currentDescription = form.getValues('description');
        const enhancedDescription = `${currentDescription} (Suggested location: ${result.suggestedLocationDetails})`;
        if (enhancedDescription.length <= 500) {
          form.setValue('description', enhancedDescription);
        }
      }

      // Show different toast messages based on analysis type
      const isServiceFallback =
        result.description.includes('Unable to analyze image at this time due to service limits') ||
        result.description.includes('AI analysis is temporarily unavailable due to key or permission settings');

      if (isServiceFallback) {
        toast({
          title: 'Analysis Complete',
          description: 'Service is currently busy. Please fill in the form details manually.',
          variant: 'default',
        });
      } else {
        toast({
          title: 'AI Analysis Complete',
          description: 'The form has been pre-filled with our analysis.',
        });
      }
    } catch (e) {
      console.error("AI analysis failed during form fill:", e);
      setCachedAiAnalysis(null);
      setCachedAiPhoto(null);
      const errorMessage = (e as any)?.message?.includes('429')
        ? 'AI service is currently at capacity. Please fill the form manually.'
        : 'Could not analyze the image. Please fill the form manually.';

      toast({
        variant: 'destructive',
        title: 'Analysis Unavailable',
        description: errorMessage,
      });
    } finally {
      setIsAnalyzing(false);
    }
  }, [form, normalizeCategory, toast]);


  useEffect(() => {
    if (showCamera) {
      const getCameraPermission = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
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
            description: 'Please enable camera permissions in your browser settings to use this feature.',
          });
        }
      };
      getCameraPermission();

      return () => {
        if (videoRef.current && videoRef.current.srcObject) {
          const stream = videoRef.current.srcObject as MediaStream;
          stream.getTracks().forEach(track => track.stop());
        }
      }
    }
  }, [showCamera, toast]);

  const handleCapture = async () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const dataUrl = canvas.toDataURL('image/jpeg');
        setShowCamera(false);

        try {
          const compressedImage = await compressImageDataUrl(dataUrl);
          setCapturedImage(compressedImage);
          setCachedAiAnalysis(null);
          setCachedAiPhoto(null);
          form.setValue('photo', compressedImage);
          form.clearErrors('photo');
          runAiAnalysis(compressedImage); // Trigger AI analysis with compressed image
        } catch (error) {
          console.error('Image compression failed, using original image:', error);
          setCapturedImage(dataUrl);
          setCachedAiAnalysis(null);
          setCachedAiPhoto(null);
          form.setValue('photo', dataUrl);
          form.clearErrors('photo');
          runAiAnalysis(dataUrl);
        }

        handleGetLocationInternal(); // Auto geo-tag after image capture
      }
    }
  };

  const handleGetLocationInternal = () => {
    if (!navigator.geolocation) {
      toast({ variant: 'destructive', title: 'GPS Not Supported', description: 'Your browser does not support geolocation.' });
      return;
    }
    setIsFetchingLocation(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude, accuracy } = position.coords;

        if (accuracy > 100) { // Warn if accuracy is worse than 100 meters
          toast({
            variant: "destructive",
            title: "Low Location Accuracy",
            description: `Your location accuracy is ${Math.round(accuracy)} meters. Try moving to an open area for a better GPS signal.`,
            duration: 7000,
          });
        }

        form.setValue('latitude', latitude);
        form.setValue('longitude', longitude);

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`);
          const data = await response.json();
          if (data && data.display_name) {
            form.setValue('location', data.display_name);
            if (data.address && data.address.road) {
              form.setValue('roadName', data.address.road);
            }
            form.clearErrors('location');
          } else {
            form.setValue('location', `${latitude}, ${longitude}`);
          }
        } catch (error) {
          console.error("Reverse geocoding failed:", error);
          form.setValue('location', `${latitude}, ${longitude}`);
        } finally {
          setIsFetchingLocation(false);
        }
      },
      (error) => {
        setIsFetchingLocation(false);
        toast({ variant: 'destructive', title: 'GPS Error', description: error.message });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };


  async function onSubmit(values: ReportProblemForm) {
    if (!user || !firestore) {
      toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to submit a report.' });
      return;
    }

    setIsSubmitting(true);

    const reportsCollection = collection(firestore, 'reports');

    try {
      // Step 1: Run AI analysis first
      toast({
        title: 'Analyzing with AI...',
        description: 'Our AI is analyzing the damage and determining the best department.',
      });

      let aiAnalysis: AIAnalysis | null = null;
      const canUseCachedAnalysis = !!cachedAiAnalysis && cachedAiPhoto === values.photo;
      if (canUseCachedAnalysis) {
        aiAnalysis = cachedAiAnalysis;
      } else {
        try {
          aiAnalysis = (await aiDamageAssessment({ mediaDataUri: values.photo })) as any;
        } catch (e) {
          console.error('AI analysis failed, continuing without it:', e);
          aiAnalysis = null; // Use null instead of undefined for Firebase
        }
      }

      // Step 2: Run automated workflow analysis
      const reportData = {
        category: values.category,
        description: values.description,
        location: values.location,
        latitude: values.latitude,
        longitude: values.longitude,
      };

      const workflow = analyzeReportForWorkflow(reportData, aiAnalysis ?? undefined);
      const initialStatus = getInitialStatus(workflow);
      const automationConfidence = calculateAutomationConfidence(
        aiAnalysis ?? undefined,
        !!values.photo,
        !!(values.latitude && values.longitude)
      );

      // Step 3: Create action log with automation info
      const initialLogEntry = {
        status: 'Submitted' as const,
        timestamp: new Date().toISOString(),
        actor: 'Citizen' as const,
        actorName: user.displayName || 'Anonymous',
        notes: 'Report submitted by citizen.',
      };

      // Step 3.5: Auto-select and assign best worker if autoAssign is true
      let assignedWorkerId = '';
      let assignedContractor = '';

      if (workflow.autoAssign) {
        try {
          const usersRef = collection(firestore, 'users');
          const workersQuery = query(
            usersRef,
            where('role', '==', 'worker')
          );
          const querySnapshot = await getDocs(workersQuery);
          const workersList: any[] = [];
          querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            workersList.push({
              id: docSnap.id,
              name: data.name || '',
              department: data.department || '',
              activeTaskCount: data.activeTasks || 0,
            });
          });

          // Filter by department
          const deptWorkers = workersList.filter(
            (w) => w.department && w.department.toLowerCase() === workflow.suggestedDepartment.toLowerCase()
          );

          if (deptWorkers.length > 0) {
            // Select worker with least active tasks
            const bestWorker = deptWorkers.reduce((best, current) => {
              return (current.activeTaskCount || 0) < (best.activeTaskCount || 0) ? current : best;
            });
            assignedWorkerId = bestWorker.id;
            assignedContractor = bestWorker.name;
          }
        } catch (err) {
          console.error('Error auto-selecting worker:', err);
        }
      }

      const automatedLogEntry = createAutomatedActionLog(workflow, assignedContractor || undefined);

      // Construct Illegal Dumping payload if visual evidence was detected by AI
      const illegalDumpingPayload = aiAnalysis?.illegalDumping?.detected ? {
        detected: true,
        confidence: aiAnalysis.illegalDumping.confidence ?? 0.85,
        wasteType: aiAnalysis.illegalDumping.wasteType || values.category || 'General Waste',
        vehicleDetected: Boolean(aiAnalysis.illegalDumping.vehicleDetected),
        vehicleType: aiAnalysis.illegalDumping.vehicleType || null,
        licensePlateVisible: Boolean(aiAnalysis.illegalDumping.licensePlateVisible) && !!aiAnalysis.illegalDumping.licensePlateNumber,
        licensePlateNumber: aiAnalysis.illegalDumping.licensePlateNumber || null,
        evidenceQuality: aiAnalysis.illegalDumping.evidenceQuality || 'fair',
        reason: aiAnalysis.illegalDumping.reason || 'Visual evidence captured.',
        verificationStatus: 'PENDING' as const,
        fineDetails: {
          status: 'NOT_ISSUED' as const,
        },
      } : null;

      // Step 4: Create report with all automation data
      const newReportRef = await addDocumentNonBlocking(reportsCollection, {
        userId: user.uid,
        userName: user.displayName || 'Anonymous',
        userEmail: user.email || '',
        location: values.location,
        roadName: values.roadName || '',
        latitude: values.latitude,
        longitude: values.longitude,
        description: values.description,
        imageUrl: values.photo,
        imageHint: 'road damage',
        timestamp: new Date().toISOString(),
        status: initialStatus,
        department: workflow.suggestedDepartment,
        category: values.category,
        priority: workflow.suggestedPriority,
        estimatedResolutionTime: workflow.estimatedResolutionTime,
        workflowStage: workflow.autoAssign ? 'assigned_worker' : 'pending_admin',
        assignedWorkerId: assignedWorkerId || null,
        assignedContractor: assignedContractor || null,
        aiAnalysis: aiAnalysis,
        automationConfidence: automationConfidence,
        actionLog: [initialLogEntry, automatedLogEntry],
        complaintType: illegalDumpingPayload ? 'Illegal Dumping' : 'Standard',
        illegalDumping: illegalDumpingPayload,
      });

      // Success messages based on automation level
      if (workflow.autoAssign) {
        toast({
          title: 'Report Auto-Assigned',
          description: `Automatically assigned to ${workflow.suggestedDepartment} department. Priority: ${workflow.suggestedPriority}`,
          duration: 5000,
        });
      } else if (workflow.requiresVerification) {
        toast({
          title: 'Report Under Review',
          description: "Your report is being verified by our team. You'll be notified of updates.",
          duration: 5000,
        });
      } else {
        toast({
          title: 'Report Submitted',
          description: 'Thank you for helping improve our roads!',
        });
      }

      form.reset();
      setCapturedImage(null);
      router.push('/citizen/my-complaints');

    } catch (error) {
      console.error("Error submitting report: ", error);
      toast({
        variant: 'destructive',
        title: 'Submission Failed',
        description: 'There was an error submitting your report. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 pt-6 md:p-8">
      <div className="mb-8 rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-lg dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <h1 className="mb-2 text-3xl font-bold md:text-4xl">Report a Problem</h1>
        <p className="text-base text-slate-200 md:text-lg">Empower your voice with visual evidence</p>
      </div>

      <Card className="border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <CardHeader className="border-b border-slate-100 dark:border-slate-800">
          <CardTitle>Submit a New Report</CardTitle>
        </CardHeader>
        <CardContent className="pt-6">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="photo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Photo Evidence</FormLabel>
                    <FormControl>
                      <div className="space-y-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowCamera(true)}
                        >
                          <Camera className="mr-2 h-4 w-4" />
                          Open Camera
                        </Button>
                        {capturedImage && (
                          <div className="relative w-48 h-48 border rounded-md p-2">
                            <Image
                              src={capturedImage}
                              alt="Captured evidence"
                              fill
                              className="rounded-md object-cover"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="sm"
                              className="absolute top-1 right-1"
                              onClick={() => {
                                setCapturedImage(null);
                                setCachedAiAnalysis(null);
                                setCachedAiPhoto(null);
                                form.setValue('photo', '');
                              }}
                            >
                              X
                            </Button>
                          </div>
                        )}
                      </div>
                    </FormControl>
                    <FormDescription>
                      A real-time photo of the issue is required. Our AI will analyze it to pre-fill the form.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {showCamera && (
                <div className="fixed inset-0 z-50 flex flex-col bg-black">
                  {/* ── Top bar ─────────────────────────────────── */}
                  <div className="relative z-10 flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
                      <span className="text-xs font-semibold tracking-wider text-white/80 uppercase">Live Camera</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 rounded-full bg-white/10 text-white hover:bg-white/20 backdrop-blur-sm"
                      onClick={() => setShowCamera(false)}
                    >
                      <span className="text-lg font-bold">✕</span>
                      <span className="sr-only">Close Camera</span>
                    </Button>
                  </div>

                  {/* ── Viewfinder ──────────────────────────────── */}
                  <div className="relative flex flex-1 items-center justify-center overflow-hidden">
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                    {/* Viewfinder corner guides */}
                    <div className="pointer-events-none absolute inset-6 md:inset-16">
                      {/* Top-left */}
                      <div className="absolute left-0 top-0 h-8 w-8 border-l-2 border-t-2 border-white/60 rounded-tl-md" />
                      {/* Top-right */}
                      <div className="absolute right-0 top-0 h-8 w-8 border-r-2 border-t-2 border-white/60 rounded-tr-md" />
                      {/* Bottom-left */}
                      <div className="absolute bottom-0 left-0 h-8 w-8 border-b-2 border-l-2 border-white/60 rounded-bl-md" />
                      {/* Bottom-right */}
                      <div className="absolute bottom-0 right-0 h-8 w-8 border-b-2 border-r-2 border-white/60 rounded-br-md" />
                    </div>

                    {/* Camera denied overlay */}
                    {hasCameraPermission === false && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/90 px-8 text-center">
                        <div className="rounded-full bg-red-500/20 p-4">
                          <AlertTriangle className="h-10 w-10 text-red-400" />
                        </div>
                        <p className="text-lg font-semibold text-white">Camera Access Denied</p>
                        <p className="text-sm text-white/60 max-w-sm">
                          Please enable camera permissions in your browser settings to capture a photo of the civic issue.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* ── Bottom controls ─────────────────────────── */}
                  <div className="relative z-10 flex items-center justify-center gap-8 px-6 py-6 pb-8">
                    {/* Capture button — large circle */}
                    <button
                      type="button"
                      onClick={handleCapture}
                      disabled={!hasCameraPermission}
                      className="group relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-[3px] border-white transition-all hover:scale-105 active:scale-95 disabled:opacity-30 disabled:hover:scale-100"
                    >
                      <div className="h-[58px] w-[58px] rounded-full bg-white transition-colors group-hover:bg-white/90 group-active:bg-red-400" />
                      <span className="sr-only">Capture Photo</span>
                    </button>
                  </div>

                  {/* Hint text */}
                  <p className="pb-4 text-center text-xs text-white/40">
                    Point at the issue and tap the button to capture
                  </p>

                  <canvas ref={canvasRef} className="hidden" />
                </div>
              )}

              <div className='relative'>
                {isAnalyzing && (
                  <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-md bg-background/85 backdrop-blur-sm">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">AI is analyzing your image...</p>
                  </div>
                )}
                <div className='space-y-8'>
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Problem Category (AI Suggested)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a road-related problem" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {problemCategories.map((category) => (
                              <SelectItem key={category} value={category}>
                                {category}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (AI Suggested)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Provide details about the problem, like size, depth, or impact."
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>


              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        <Textarea placeholder="e.g. Near City Park, Main Street" {...field} />
                        <Button type="button" variant="outline" size="icon" onClick={handleGetLocationInternal} disabled={isFetchingLocation}>
                          {isFetchingLocation ? <Loader2 className="animate-spin" /> : <MapPin className="h-4 w-4" />}
                          <span className="sr-only">Get Location</span>
                        </Button>
                      </div>
                    </FormControl>
                    <FormDescription>
                      Click the pin to auto-detect your location or enter it manually.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* ── Duplicate Detection Banner ────────────────────── */}
              {(isDuplicate || isProbable) && topDuplicate && (
                <div className={`rounded-xl border p-4 ${isDuplicate ? 'border-red-200 bg-red-50' : 'border-yellow-200 bg-yellow-50'
                  }`}>
                  <div className="flex items-start gap-3">
                    <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${isDuplicate ? 'text-red-500' : 'text-yellow-500'}`} />
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${isDuplicate ? 'text-red-700' : 'text-yellow-700'}`}>
                        {isDuplicate ? 'Likely duplicate report detected' : 'Similar complaint nearby'}
                      </p>
                      <p className={`text-xs mt-0.5 ${isDuplicate ? 'text-red-600' : 'text-yellow-600'}`}>
                        A {topDuplicate.category} complaint was filed{' '}
                        {topDuplicate.distanceKm < 0.1 ? 'less than 100m away' : `${Math.round(topDuplicate.distanceKm * 1000)}m away`}{' '}
                        — currently <strong>{topDuplicate.status}</strong>.
                      </p>
                      <Link href={`/citizen/complaint/${topDuplicate.id}`} target="_blank"
                        className={`mt-1.5 inline-flex items-center gap-1 text-xs underline ${isDuplicate ? 'text-red-600' : 'text-yellow-700'}`}>
                        View existing complaint <ExternalLink className="h-3 w-3" />
                      </Link>
                      {nearby.length > 1 && (
                        <p className={`text-xs mt-1 ${isDuplicate ? 'text-red-500' : 'text-yellow-500'}`}>
                          +{nearby.length - 1} other similar report{nearby.length > 2 ? 's' : ''} in this area.
                        </p>
                      )}
                      <p className={`text-xs mt-1 font-medium ${isDuplicate ? 'text-red-500' : 'text-yellow-600'}`}>
                        You can still submit — it adds to the frequency count and raises priority.
                      </p>
                    </div>
                    {isChecking && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground shrink-0" />}
                  </div>
                </div>
              )}

              {/* ── Potential Illegal Dumping Evidence Alert ────────────── */}
              {cachedAiAnalysis?.illegalDumping?.detected && (
                <div className="rounded-xl border border-purple-200 bg-purple-50/80 p-4 dark:border-purple-900/50 dark:bg-purple-950/40">
                  <div className="flex items-start gap-3">
                    <div className="rounded-lg bg-purple-500/10 p-2 text-purple-600 dark:text-purple-400">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-bold text-purple-900 dark:text-purple-200">
                        Potential Illegal Dumping Detected
                      </p>
                      <p className="text-xs text-purple-700 dark:text-purple-300">
                        Your report may contain visual evidence of illegal dumping. The submitted evidence will be reviewed by the municipal authority.
                      </p>

                      {cachedAiAnalysis.illegalDumping.licensePlateNumber && (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-purple-100 px-2.5 py-1 text-xs font-mono font-bold text-purple-900 dark:bg-purple-900/80 dark:text-purple-100">
                          <span>🚘 Vehicle Registration Detected:</span>
                          <span className="underline">{cachedAiAnalysis.illegalDumping.licensePlateNumber}</span>
                        </div>
                      )}

                      <p className="text-[11px] text-purple-600/80 dark:text-purple-400/80 pt-1">
                        Note: All visual evidence is reviewed manually by municipal officers before taking any administrative action.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <Button type="submit" disabled={isSubmitting || isAnalyzing} className="w-full md:w-auto">
                {isSubmitting ? (
                  <>
                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                    {isAnalyzing ? 'Analyzing with AI...' : 'Submitting Report...'}
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Submit Report with AI Analysis
                  </>
                )}
              </Button>

              {/* Automation Info */}
              <Alert className="bg-primary/5 border-primary/20">
                <Sparkles className="h-4 w-4 text-primary" />
                <AlertTitle>Smart Auto-Assignment Enabled</AlertTitle>
                <AlertDescription>
                  Our AI will analyze your report and automatically assign it to the right department with priority level.
                  High-confidence reports are instantly assigned to workers!
                </AlertDescription>
              </Alert>
            </form>
          </Form>
        </CardContent>
      </Card>

    </div>
  );
}

