'use client';

import { useRef, useState, useCallback } from 'react';
import {
  Camera, MapPin, Loader2, X, CheckCircle, AlertTriangle,
  Trash2, ShieldCheck, Hospital, Flame, Toilet, Building2,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore, useUser } from '@/firebase';
import { collection } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import type { CivicServiceCategory } from '@/lib/types';
import Image from 'next/image';

// ─── Category config ──────────────────────────────────────────────────────────

export const SERVICE_CATEGORIES: Record<
  CivicServiceCategory,
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  garbage:   { label: 'Garbage Bin',     Icon: Trash2,      color: 'text-green-600',  bg: 'bg-green-50'  },
  police:    { label: 'Police Station',  Icon: ShieldCheck, color: 'text-blue-600',   bg: 'bg-blue-50'   },
  hospital:  { label: 'Hospital',        Icon: Hospital,    color: 'text-red-600',    bg: 'bg-red-50'    },
  fire:      { label: 'Fire Station',    Icon: Flame,       color: 'text-orange-500', bg: 'bg-orange-50' },
  toilet:    { label: 'Public Toilet',   Icon: Toilet,      color: 'text-violet-600', bg: 'bg-violet-50' },
  municipal: { label: 'Municipal Office',Icon: Building2,   color: 'text-teal-600',   bg: 'bg-teal-50'   },
};

// ─── Image compression ────────────────────────────────────────────────────────

function compressDataUrl(src: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const max = 1024;
      const scale = Math.min(max / img.width, max / img.height, 1);
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject(new Error('canvas ctx failed')); return; }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => reject(new Error('image load failed'));
    img.src = src;
  });
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
  onSubmitted: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RegisterServiceModal({ onClose, onSubmitted }: Props) {
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [category, setCategory] = useState<CivicServiceCategory | ''>('');
  const [location, setLocation] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);

  const [showCamera, setShowCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [fetchingLoc, setFetchingLoc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Camera ────────────────────────────────────────────────────────────────

  const openCamera = async () => {
    setShowCamera(true);
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => setCameraReady(true);
      }
    } catch {
      toast({ variant: 'destructive', title: 'Camera denied', description: 'Enable camera permission and try again.' });
      setShowCamera(false);
    }
  };

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setShowCamera(false);
    setCameraReady(false);
  }, []);

  const capturePhoto = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext('2d')?.drawImage(v, 0, 0);
    const raw = c.toDataURL('image/jpeg');
    stopCamera();
    try { setImageDataUrl(await compressDataUrl(raw)); }
    catch { setImageDataUrl(raw); }
    fetchLocation();
  };

  // ── Location ──────────────────────────────────────────────────────────────

  const fetchLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    setFetchingLoc(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}`
          );
          const data = await res.json();
          setLocation(data.display_name ?? `${pos.coords.latitude}, ${pos.coords.longitude}`);
        } catch {
          setLocation(`${pos.coords.latitude}, ${pos.coords.longitude}`);
        } finally { setFetchingLoc(false); }
      },
      () => setFetchingLoc(false),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  // ── Submit ────────────────────────────────────────────────────────────────

  const canSubmit = !!category && !!location && lat !== null && !!imageDataUrl && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !user || !firestore) return;
    setSubmitting(true);
    try {
      await addDocumentNonBlocking(collection(firestore, 'civic_services'), {
        category,
        name: '',
        location,
        latitude: lat,
        longitude: lng,
        imageUrl: imageDataUrl,
        status: 'pending',
        submittedBy: user.uid,
        submittedByName: user.displayName ?? 'Citizen',
        submittedAt: new Date().toISOString(),
      });
      setDone(true);
      setTimeout(() => { onSubmitted(); onClose(); }, 1800);
    } catch {
      toast({ variant: 'destructive', title: 'Submission failed', description: 'Please try again.' });
    } finally { setSubmitting(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-md bg-white dark:bg-slate-950 rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[92dvh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div>
            <p className="text-sm font-semibold">Register a Service</p>
            <p className="text-[11px] text-slate-400">Help map civic services in your area</p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4 text-slate-500" />
          </button>
        </div>

        {/* ── Success ── */}
        {done && (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 p-8">
            <div className="h-14 w-14 rounded-full bg-emerald-50 flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
            <p className="text-base font-semibold text-center">Submitted for Review</p>
            <p className="text-xs text-slate-400 text-center">
              Your submission will appear on the map once approved by the admin.
            </p>
          </div>
        )}

        {/* ── Camera ── */}
        {!done && showCamera && (
          <div className="flex-1 flex flex-col items-center gap-3 p-4 bg-black">
            <video ref={videoRef} autoPlay muted playsInline className="w-full rounded-xl object-cover max-h-64" />
            <canvas ref={canvasRef} className="hidden" />
            <div className="flex gap-3">
              <Button
                onClick={capturePhoto}
                disabled={!cameraReady}
                className="bg-white text-slate-900 hover:bg-slate-100 rounded-full px-6"
              >
                <Camera className="mr-2 h-4 w-4" /> Capture
              </Button>
              <Button variant="ghost" onClick={stopCamera} className="text-white hover:bg-white/10 rounded-full">
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── Form ── */}
        {!done && !showCamera && (
          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* Photo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Photo <span className="text-red-500">*</span>
              </Label>
              {imageDataUrl ? (
                <div className="relative w-full h-40 rounded-xl overflow-hidden border border-slate-200">
                  <Image src={imageDataUrl} alt="Service photo" fill className="object-cover" />
                  <button
                    onClick={() => setImageDataUrl(null)}
                    className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center"
                  >
                    <X className="h-3.5 w-3.5 text-white" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={openCamera}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 hover:border-emerald-400 hover:bg-emerald-50/50 transition-colors"
                >
                  <Camera className="h-6 w-6 text-slate-400" />
                  <span className="text-xs text-slate-400">Tap to take a photo</span>
                </button>
              )}
            </div>

            {/* Service type grid — plain buttons, no Radix portal */}
            <div className="space-y-2">
              <Label className="text-xs font-medium">
                Service Type <span className="text-red-500">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(SERVICE_CATEGORIES) as CivicServiceCategory[]).map((k) => {
                  const { label, Icon, color, bg } = SERVICE_CATEGORIES[k];
                  const selected = category === k;
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setCategory(k)}
                      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all text-center ${
                        selected
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className={`h-9 w-9 rounded-xl ${selected ? 'bg-emerald-100' : bg} flex items-center justify-center`}>
                        <Icon className={`h-5 w-5 ${selected ? 'text-emerald-600' : color}`} strokeWidth={2} />
                      </div>
                      <span className={`text-[10px] font-semibold leading-tight ${selected ? 'text-emerald-700' : 'text-slate-600'}`}>
                        {label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Location */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                Location <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Auto-filled from GPS"
                  className="h-10 rounded-xl text-sm flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 rounded-xl shrink-0"
                  onClick={fetchLocation}
                  disabled={fetchingLoc}
                >
                  {fetchingLoc
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <MapPin className="h-4 w-4" />
                  }
                </Button>
              </div>
              {lat ? (
                <p className="text-[11px] text-slate-400">{lat.toFixed(5)}, {lng?.toFixed(5)}</p>
              ) : !fetchingLoc ? (
                <p className="text-[11px] text-amber-500 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Tap the pin to detect your location
                </p>
              ) : null}
            </div>

            {/* Notice */}
            <div className="rounded-xl bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
              Your submission will be reviewed by the municipal admin before appearing on the map. The admin will add the service name.
            </div>
          </div>
        )}

        {/* Footer */}
        {!done && !showCamera && (
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 shrink-0">
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm disabled:opacity-50"
            >
              {submitting
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting…</>
                : 'Submit for Approval'
              }
            </Button>
          </div>
        )}

      </div>
    </div>
  );
}
