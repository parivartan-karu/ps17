'use client';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { MapPin, User, Calendar, Bot, Shield, Star, CheckCircle2, ThumbsUp, Clock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useDoc, useMemoFirebase, useUser } from '@/firebase';
import { doc, DocumentData, DocumentReference, updateDoc } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import type { Report } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

const statusColors: Record<string, string> = {
  Submitted: 'bg-blue-500',
  'Under Verification': 'bg-yellow-500',
  Assigned: 'bg-orange-500',
  'In Progress': 'bg-amber-500',
  Resolved: 'bg-green-500',
  Rejected: 'bg-red-500',
};

const progressValues: Record<string, number> = {
  Submitted: 10,
  'Under Verification': 30,
  Assigned: 50,
  'In Progress': 70,
  Resolved: 100,
  Rejected: 100,
};

const allStages = ['Submitted', 'Under Verification', 'Assigned', 'In Progress', 'Resolved'];

const actorIcons: Record<string, React.ReactNode> = {
  Citizen: <User className="h-4 w-4 text-blue-500" />,
  Official: <Shield className="h-4 w-4 text-purple-500" />,
  System: <Bot className="h-4 w-4 text-gray-400" />,
  Worker: <CheckCircle2 className="h-4 w-4 text-green-500" />,
};

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((s) => (
        <button
          key={s}
          type="button"
          onMouseEnter={() => setHovered(s)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => onChange(s)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`h-8 w-8 transition-colors ${
              s <= (hovered || value) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'
            }`}
          />
        </button>
      ))}
    </div>
  );
}

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [ratingFeedback, setRatingFeedback] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  const reportRef = useMemoFirebase(() => {
    if (!firestore || !params.id) return null;
    return doc(firestore, 'reports', params.id) as DocumentReference<DocumentData>;
  }, [firestore, params.id]);

  const { data: report, isLoading } = useDoc<Report>(reportRef);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-8">
            <Card><CardHeader><Skeleton className="h-8 w-1/2" /></CardHeader><CardContent><Skeleton className="h-64 w-full" /></CardContent></Card>
          </div>
          <div className="lg:col-span-1 space-y-8">
            <Card><CardHeader><Skeleton className="h-8 w-1/3" /></CardHeader><CardContent><Skeleton className="h-48 w-full" /></CardContent></Card>
          </div>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex-1 p-4 md:p-8 pt-6">
        <Card>
          <CardHeader>
            <CardTitle>Complaint Not Found</CardTitle>
            <CardDescription>The requested report could not be found.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline"><Link href="/citizen/my-complaints">← Back to My Complaints</Link></Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const progress = progressValues[report.status] || 0;
  const mapsUrl = report.latitude && report.longitude
    ? `https://www.google.com/maps?q=${report.latitude},${report.longitude}`
    : `https://www.google.com/maps?q=${encodeURIComponent(report.location)}`;

  const sortedActionLog = [...(report.actionLog ?? [])].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const isResolved = report.status === 'Resolved';
  const isRejected = report.status === 'Rejected';
  const isOwner = user?.uid === report.userId;
  const alreadyRated = !!report.citizenRating;

  async function handleSubmitRating() {
    if (!rating || !reportRef) return;
    setIsSubmittingRating(true);
    try {
      await updateDoc(reportRef, {
        citizenRating: rating,
        citizenFeedback: ratingFeedback.trim() || null,
      });
      setRatingSubmitted(true);
      toast({ title: 'Thank you for your feedback', description: 'Your rating helps us improve.' });
    } catch {
      toast({ title: 'Failed to submit rating', variant: 'destructive' });
    } finally {
      setIsSubmittingRating(false);
    }
  }

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      {/* Status banner */}
      <div className={`flex items-center justify-between rounded-2xl px-5 py-4 text-white shadow-lg ${
        isResolved ? 'bg-gradient-to-r from-green-500 to-emerald-600' :
        isRejected ? 'bg-gradient-to-r from-red-500 to-red-600' :
        'bg-gradient-to-r from-blue-500 to-indigo-600'
      }`}>
        <div>
          <p className="text-xs font-medium text-white/75">Complaint #{report.id.slice(-6).toUpperCase()}</p>
          <h1 className="mt-1 text-lg font-bold">{report.status}</h1>
          <p className="mt-0.5 text-xs text-white/80">
            {isResolved ? 'Your issue has been resolved' :
             isRejected ? 'This complaint was rejected' :
             'We are working on this'}
          </p>
        </div>
        <Badge className={`${statusColors[report.status]} text-sm font-semibold text-white border-0`}>
          {report.status}
        </Badge>
      </div>

      {/* Progress tracker */}
      {!isRejected && (
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-4">
            <div className="mb-3 flex justify-between text-xs text-muted-foreground">
              {allStages.map((stage) => (
                <span key={stage} className={`font-medium ${
                  stage === report.status ? 'text-orange-500' :
                  allStages.indexOf(stage) < allStages.indexOf(report.status) ? 'text-green-600' :
                  'text-gray-400'
                }`}>{stage === 'Under Verification' ? 'Verifying' : stage.replace(' ', '\u00A0')}</span>
              ))}
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {/* Main complaint card */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-lg">{report.description}</CardTitle>
              <div className="flex flex-wrap gap-2 pt-1 text-sm text-muted-foreground">
                <Badge variant="outline">{report.category}</Badge>
                {report.department && <Badge variant="outline">{report.department}</Badge>}
                {report.priority && <Badge variant="outline">{report.priority} Priority</Badge>}
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-semibold text-muted-foreground">Evidence Photo</p>
                <Image src={report.imageUrl} alt="Evidence" width={800} height={600} className="w-full rounded-xl object-cover" />
              </div>
              {(report.afterImageUrl || report.afterWorkMediaUrl) && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-muted-foreground">After Completion</p>
                  {report.afterWorkMediaType === 'video' ? (
                    <video src={report.afterWorkMediaUrl} controls className="w-full rounded-xl" />
                  ) : (
                    <Image src={report.afterImageUrl || report.afterWorkMediaUrl!} alt="Resolved" width={800} height={600} className="w-full rounded-xl object-cover" />
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rating card – only for owner, only when resolved, only once */}
          {isResolved && isOwner && !alreadyRated && !ratingSubmitted && (
            <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Star className="h-5 w-5 text-amber-400" />
                  Rate the Resolution
                </CardTitle>
                <CardDescription>How satisfied are you with how this was handled?</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <StarRating value={rating} onChange={setRating} />
                {rating > 0 && (
                  <Textarea
                    placeholder="Any additional feedback? (optional)"
                    value={ratingFeedback}
                    onChange={(e) => setRatingFeedback(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                )}
                <Button
                  onClick={handleSubmitRating}
                  disabled={!rating || isSubmittingRating}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  {isSubmittingRating ? 'Submitting…' : 'Submit Rating'}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Rating submitted confirmation */}
          {(alreadyRated || ratingSubmitted) && isResolved && (
            <Card className="border-0 shadow-sm bg-amber-50">
              <CardContent className="flex items-center gap-3 pt-4">
                <ThumbsUp className="h-5 w-5 text-amber-500" />
                <div>
                  <p className="text-sm font-semibold text-amber-700">You rated this {report.citizenRating ?? rating} stars</p>
                  <p className="text-xs text-amber-600">Thank you for your feedback!</p>
                </div>
                <div className="ml-auto flex gap-0.5">
                  {[1,2,3,4,5].map((s) => (
                    <Star key={s} className={`h-4 w-4 ${s <= (report.citizenRating ?? rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-300'}`} />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action log */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Activity Timeline</CardTitle>
              <CardDescription>Full history of actions on this complaint</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-4">
                {sortedActionLog.map((log, index) => (
                  <div key={index} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100">
                        {actorIcons[log.actor] ?? <Bot className="h-4 w-4 text-gray-400" />}
                      </div>
                      {index < sortedActionLog.length - 1 && <div className="mt-1 w-px flex-1 bg-gray-200" />}
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <span>{log.actorName}</span>
                        <span className="font-normal text-muted-foreground">→</span>
                        <Badge variant="outline" className="text-xs">{log.status}</Badge>
                      </div>
                      {log.notes && <p className="mt-0.5 text-xs text-muted-foreground italic">"{log.notes}"</p>}
                      <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(log.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {sortedActionLog.length === 0 && (
                  <p className="text-sm text-muted-foreground">No actions logged yet.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* AI Analysis */}
          {report.aiAnalysis && (
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {[
                  { label: 'Damage Detected', value: report.aiAnalysis.damageDetected ? 'Yes' : 'No' },
                  { label: 'Category', value: report.aiAnalysis.damageCategory },
                  { label: 'Severity', value: report.aiAnalysis.severity },
                  { label: 'Verification', value: report.aiAnalysis.verificationSuggestion },
                ].map((row) => (
                  <div key={row.label} className="flex justify-between border-b pb-2 last:border-0">
                    <span className="text-muted-foreground">{row.label}</span>
                    <span className="font-medium">{row.value}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Report Details</CardTitle></CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold">{report.location}</p>
                  {report.roadName && <p className="text-xs text-muted-foreground">{report.roadName}</p>}
                  <Button variant="link" className="h-auto p-0 text-xs text-orange-600" asChild>
                    <Link href={mapsUrl} target="_blank">Open in Maps →</Link>
                  </Button>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Reported By</p>
                  <p className="text-muted-foreground">{report.userName}</p>
                </div>
              </div>
              <Separator />
              <div className="flex items-center gap-3">
                <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-semibold">Submitted</p>
                  <p className="text-muted-foreground">{new Date(report.timestamp).toLocaleDateString()}</p>
                </div>
              </div>
              {report.assignedContractor && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Assigned Worker</p>
                      <p className="text-muted-foreground">{report.assignedContractor}</p>
                    </div>
                  </div>
                </>
              )}
              {report.estimatedResolutionTime && (
                <>
                  <Separator />
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div>
                      <p className="font-semibold">Est. Resolution</p>
                      <p className="text-muted-foreground">{report.estimatedResolutionTime}</p>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Progress</CardTitle></CardHeader>
            <CardContent>
              <Progress value={progress} className="h-3" />
              <p className="mt-2 text-center text-xs text-muted-foreground">{progress}% Complete</p>
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  );
}
