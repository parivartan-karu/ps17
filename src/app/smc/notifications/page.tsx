'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Bell,
  Plus,
  Send,
  MapPin,
  Trash2,
  Construction,
  AlertTriangle,
  Wrench,
  Info,
  Loader2,
  ExternalLink,
  Archive,
  Clock3,
} from 'lucide-react';
import { useAuth, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, deleteDoc, doc, getDocs, writeBatch } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import type { Notification } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { buildAuthHeaders } from '@/lib/client-auth';
import { durationToMinutes, isNotificationActive, isNotificationExpired } from '@/lib/notification-utils';

const AdminLocationPicker = dynamic(() => import('@/components/maps/admin-location-picker'), {
  ssr: false,
});

const typeConfig = {
  road_construction: { icon: Construction, label: 'Road Construction', color: 'bg-orange-500' },
  traffic_update: { icon: AlertTriangle, label: 'Traffic Update', color: 'bg-yellow-500' },
  maintenance: { icon: Wrench, label: 'Maintenance', color: 'bg-blue-500' },
  general: { icon: Info, label: 'General', color: 'bg-gray-500' },
};

type DurationUnit = 'minutes' | 'hours' | 'days';

type Coordinates = {
  lat: number;
  lng: number;
};

function extractCoordinatesFromGoogleMapsLink(link: string): Coordinates | null {
  const trimmed = link.trim();
  if (!trimmed) return null;

  const atMatch = trimmed.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (atMatch) {
    return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  }

  const queryParamMatch = trimmed.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (queryParamMatch) {
    return { lat: Number(queryParamMatch[1]), lng: Number(queryParamMatch[2]) };
  }

  return null;
}

function formatRemainingTime(expiresAt?: string | null) {
  if (!expiresAt) return 'No expiry';

  const ms = Date.parse(expiresAt) - Date.now();
  if (ms <= 0) return 'Expired';

  const minutes = Math.floor(ms / (1000 * 60));
  if (minutes < 60) return `${minutes} min left`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr left`;

  const days = Math.floor(hours / 24);
  return `${days} day left`;
}

export default function NotificationsManagementPage() {
  const auth = useAuth();
  const firestore = useFirestore();
  const { user } = useUser();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('general');
  const [location, setLocation] = useState('');
  const [locationLink, setLocationLink] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState('');

  const [durationMode, setDurationMode] = useState<'fixed' | 'unpredictable'>('fixed');
  const [durationValue, setDurationValue] = useState('2');
  const [durationUnit, setDurationUnit] = useState<DurationUnit>('hours');

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);

  const activeNotifications = useMemo(
    () => (notifications || []).filter((notification) => isNotificationActive(notification)),
    [notifications]
  );

  const archivedNotifications = useMemo(
    () => (notifications || []).filter((notification) => !isNotificationActive(notification)),
    [notifications]
  );

  const syncExpiredAlerts = useCallback(async () => {
    if (!firestore || !notifications || notifications.length === 0) return;

    const expiringAlerts = notifications.filter(
      (notification) => !notification.isArchived && isNotificationExpired(notification)
    );

    if (expiringAlerts.length === 0) return;

    const batch = writeBatch(firestore);
    const archivedAt = new Date().toISOString();

    expiringAlerts.forEach((notification) => {
      batch.update(doc(firestore, 'notifications', notification.id), {
        isArchived: true,
        archivedAt,
        archiveReason: 'duration_elapsed',
      });
    });

    await batch.commit();
  }, [firestore, notifications]);

  useEffect(() => {
    syncExpiredAlerts().catch((error) => {
      console.error('Failed to archive expired alerts:', error);
    });
  }, [syncExpiredAlerts]);

  const handleUseMapsLink = () => {
    const parsed = extractCoordinatesFromGoogleMapsLink(locationLink);
    if (!parsed) {
      toast({
        title: 'Link saved',
        description: 'Could not read coordinates from this short link. You can still use map click to pin location.',
      });
      return;
    }

    setLatitude(parsed.lat);
    setLongitude(parsed.lng);

    if (!location.trim()) {
      setLocation(`Lat ${parsed.lat.toFixed(5)}, Lng ${parsed.lng.toFixed(5)}`);
    }

    toast({
      title: 'Location selected',
      description: 'Coordinates extracted successfully from Google Maps link.',
    });
  };

  const handleMapPick = (coords: Coordinates) => {
    const lat = Number(coords.lat.toFixed(6));
    const lng = Number(coords.lng.toFixed(6));

    setLatitude(lat);
    setLongitude(lng);
    setLocationLink(`https://www.google.com/maps?q=${lat},${lng}`);

    if (!location.trim()) {
      setLocation(`Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`);
    }
  };

  const handleSubmit = async () => {
    if (!firestore || !user) return;
    if (!description.trim()) {
      toast({ variant: 'destructive', title: 'Error', description: 'Description is required' });
      return;
    }

    if (durationMode === 'fixed') {
      const parsedDuration = Number(durationValue);
      if (!Number.isFinite(parsedDuration) || parsedDuration <= 0) {
        toast({
          variant: 'destructive',
          title: 'Invalid duration',
          description: 'Enter a valid duration value greater than zero.',
        });
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const durationMinutes =
        durationMode === 'fixed'
          ? durationToMinutes(Number(durationValue), durationUnit)
          : null;

      const expiresAt =
        durationMode === 'fixed' && durationMinutes
          ? new Date(now.getTime() + durationMinutes * 60 * 1000).toISOString()
          : null;

      const notificationData = {
        title: title.trim() || 'SMC Update',
        description: description.trim(),
        type,
        location: location.trim() || null,
        locationLink: locationLink.trim() || null,
        latitude: latitude ?? null,
        longitude: longitude ?? null,
        imageUrl: imageUrl.trim() || null,
        createdAt: now.toISOString(),
        createdBy: user.displayName || user.email || 'Admin',
        durationMode,
        durationMinutes,
        expiresAt,
        isArchived: false,
        archivedAt: null,
        archiveReason: null,
        isRead: false,
      };

      await addDocumentNonBlocking(collection(firestore, 'notifications'), notificationData);

      try {
        const usersSnapshot = await getDocs(collection(firestore, 'users'));
        const phoneNumbers = Array.from(
          new Set(
            usersSnapshot.docs
              .map((userDoc) => userDoc.data())
              .filter((userData) => ['citizen', 'worker', 'official'].includes(userData.role))
              .map((userData) => userData.phoneNumber)
              .filter((phone): phone is string => typeof phone === 'string' && phone.trim().length > 0)
              .map((phone) => phone.trim())
          )
        );

        const headers = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
        await fetch('/api/notifications/send-sms', {
          method: 'POST',
          headers,
          body: JSON.stringify({
            title: notificationData.title,
            description: notificationData.description,
            location: notificationData.location,
            phoneNumbers,
          }),
        });

        // Broadcast push notification to all devices
        try {
          const pushHeaders = await buildAuthHeaders(auth, { 'Content-Type': 'application/json' });
          await fetch('/api/notifications/push', {
            method: 'POST',
            headers: pushHeaders,
            body: JSON.stringify({
              title: notificationData.title,
              body: notificationData.description,
              url: '/citizen/notifications',
              tag: 'parivartan-broadcast',
            }),
          });
        } catch (pushError) {
          console.warn('Push notification broadcast failed (non-fatal):', pushError);
        }
      } catch (smsError) {
        console.error('Error sending SMS notifications:', smsError);
      }

      toast({
        title: 'Alert sent',
        description:
          durationMode === 'fixed'
            ? 'Alert sent successfully and will be auto-archived when duration ends.'
            : 'Alert sent successfully with unpredictable duration.',
      });

      setTitle('');
      setDescription('');
      setType('general');
      setLocation('');
      setLocationLink('');
      setLatitude(null);
      setLongitude(null);
      setImageUrl('');
      setDurationMode('fixed');
      setDurationValue('2');
      setDurationUnit('hours');
      setIsDialogOpen(false);
    } catch (error) {
      console.error('Error sending notification:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to send notification' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'notifications', id));
      toast({ title: 'Deleted', description: 'Alert has been removed permanently.' });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to delete alert' });
    }
  };

  const handleArchiveNow = async (id: string) => {
    if (!firestore) return;

    try {
      await writeBatch(firestore)
        .update(doc(firestore, 'notifications', id), {
          isArchived: true,
          archivedAt: new Date().toISOString(),
          archiveReason: 'manual',
        })
        .commit();

      toast({
        title: 'Alert archived',
        description: 'The alert was moved to archive.',
      });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Failed to archive alert' });
    }
  };

  const openMaps = () => {
    window.open('https://www.google.com/maps', '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Alerts</h1>
          <p className="text-muted-foreground">Create time-bound or unpredictable alerts for citizens and workers</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Send New Alert</DialogTitle>
              <DialogDescription>
                Alerts can be time-bound or unpredictable. Time-bound alerts auto-archive after duration ends.
              </DialogDescription>
            </DialogHeader>

            <Alert>
              <Clock3 className="h-4 w-4" />
              <AlertTitle>Duration policy</AlertTitle>
              <AlertDescription>
                Choose fixed duration for auto-archive, or unpredictable if no end time is known.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  placeholder="e.g., Road Construction Notice"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="road_construction">Road Construction</SelectItem>
                      <SelectItem value="traffic_update">Traffic Update</SelectItem>
                      <SelectItem value="maintenance">Maintenance</SelectItem>
                      <SelectItem value="general">General</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="durationMode">Duration Mode</Label>
                  <Select value={durationMode} onValueChange={(value: 'fixed' | 'unpredictable') => setDurationMode(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed duration</SelectItem>
                      <SelectItem value="unpredictable">Unpredictable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {durationMode === 'fixed' ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="durationValue">Duration Value</Label>
                    <Input
                      id="durationValue"
                      type="number"
                      min={1}
                      value={durationValue}
                      onChange={(e) => setDurationValue(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="durationUnit">Duration Unit</Label>
                    <Select value={durationUnit} onValueChange={(value: DurationUnit) => setDurationUnit(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="minutes">Minutes</SelectItem>
                        <SelectItem value="hours">Hours</SelectItem>
                        <SelectItem value="days">Days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : (
                <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                  This alert will stay active until manually archived or deleted.
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Describe the update or alert..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2 rounded-lg border p-3">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="locationLink">Google Maps Location</Label>
                  <Button type="button" variant="outline" size="sm" onClick={openMaps}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    Open Google Maps
                  </Button>
                </div>

                <div className="overflow-hidden rounded-md border">
                  <AdminLocationPicker
                    selectedPosition={latitude !== null && longitude !== null ? { lat: latitude, lng: longitude } : null}
                    onSelect={handleMapPick}
                  />
                </div>

                <p className="text-xs text-muted-foreground">
                  Click anywhere on the map to pin an exact alert location.
                </p>

                <Input
                  id="locationLink"
                  placeholder="Paste Google Maps URL"
                  value={locationLink}
                  onChange={(e) => setLocationLink(e.target.value)}
                />

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" size="sm" onClick={handleUseMapsLink}>
                    Use this map location
                  </Button>
                  {latitude !== null && longitude !== null ? (
                    <Badge variant="secondary">{`Lat ${latitude.toFixed(5)}, Lng ${longitude.toFixed(5)}`}</Badge>
                  ) : null}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location label</Label>
                <Input
                  id="location"
                  placeholder="e.g., Main Road, near City Center"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageUrl">Image URL (Optional)</Label>
                <Input
                  id="imageUrl"
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="mr-2 h-4 w-4" />
                    Send Alert
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alert Management</CardTitle>
          <CardDescription>Active alerts auto-move to archive when their duration ends</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="active" className="space-y-4">
            <TabsList>
              <TabsTrigger value="active">Active ({activeNotifications.length})</TabsTrigger>
              <TabsTrigger value="archived">Archived ({archivedNotifications.length})</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {isLoading && Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-lg">
                  <Skeleton className="h-12 w-12 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-3 w-full" />
                  </div>
                </div>
              ))}

              {!isLoading && activeNotifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.general;
                const Icon = config.icon;

                return (
                  <div key={notification.id} className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50">
                    {notification.imageUrl ? (
                      <div className="relative h-12 w-12 rounded-md overflow-hidden flex-shrink-0">
                        <Image src={notification.imageUrl} alt={notification.title} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className={`h-12 w-12 rounded-md flex items-center justify-center flex-shrink-0 ${config.color}`}>
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="secondary" className="mb-1 text-xs">{config.label}</Badge>
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{formatRemainingTime(notification.expiresAt)}</Badge>
                          <Button variant="outline" size="sm" onClick={() => handleArchiveNow(notification.id)}>
                            <Archive className="mr-1 h-3.5 w-3.5" />
                            Archive
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>

                      {notification.location && (
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" />
                          {notification.location}
                          {notification.locationLink ? (
                            <Link href={notification.locationLink} target="_blank" className="ml-2 inline-flex items-center gap-1 text-primary hover:underline">
                              <ExternalLink className="h-3 w-3" />
                              Map
                            </Link>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {!isLoading && activeNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No active alerts</p>
                </div>
              ) : null}
            </TabsContent>

            <TabsContent value="archived" className="space-y-4">
              {!isLoading && archivedNotifications.map((notification) => {
                const config = typeConfig[notification.type] || typeConfig.general;
                const Icon = config.icon;

                return (
                  <div key={notification.id} className="flex gap-4 p-4 border rounded-lg bg-muted/20">
                    <div className={`h-12 w-12 rounded-md flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <Badge variant="secondary" className="mb-1 text-xs">{config.label}</Badge>
                          <h4 className="font-medium text-sm">{notification.title}</h4>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">Archived</Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(notification.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      <p className="text-sm text-muted-foreground mt-1">{notification.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {notification.archivedAt
                          ? `Archived on ${new Date(notification.archivedAt).toLocaleString()}`
                          : 'Archived'}
                        {notification.archiveReason === 'duration_elapsed' ? ' - duration completed' : ''}
                      </p>
                    </div>
                  </div>
                );
              })}

              {!isLoading && archivedNotifications.length === 0 ? (
                <div className="text-center py-8">
                  <Archive className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">No archived alerts</p>
                </div>
              ) : null}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
