'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, MapPin, ExternalLink, Construction, AlertTriangle, Wrench, Info } from 'lucide-react';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, doc, writeBatch } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useUser } from '@/firebase';
import { isNotificationActive } from '@/lib/notification-utils';

const typeConfig = {
  road_construction: {
    icon: Construction,
    label: 'Road Construction',
    bgGradient: 'from-orange-400 to-orange-600',
    badgeColor: 'bg-orange-100 text-orange-800',
  },
  traffic_update: {
    icon: AlertTriangle,
    label: 'Traffic Update',
    bgGradient: 'from-yellow-400 to-amber-600',
    badgeColor: 'bg-yellow-100 text-yellow-800',
  },
  maintenance: {
    icon: Wrench,
    label: 'Maintenance',
    bgGradient: 'from-blue-400 to-blue-600',
    badgeColor: 'bg-blue-100 text-blue-800',
  },
  general: {
    icon: Info,
    label: 'General',
    bgGradient: 'from-slate-400 to-slate-600',
    badgeColor: 'bg-slate-100 text-slate-800',
  },
};

export default function NotificationsPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: notifications, isLoading } = useCollection<Notification>(notificationsQuery);
  const visibleNotifications = notifications?.filter(
    (notification) => (!notification.userId || notification.userId === user?.uid) && isNotificationActive(notification)
  );

  const handleReadAll = async () => {
    if (!firestore || !visibleNotifications) return;

    setIsMarkingAllRead(true);
    try {
      const unreadNotifications = visibleNotifications.filter((notification) => !notification.isRead);
      if (unreadNotifications.length === 0) return;

      const batch = writeBatch(firestore);
      unreadNotifications.forEach((notification) => {
        batch.update(doc(firestore, 'notifications', notification.id), { isRead: true });
      });
      await batch.commit();
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    } finally {
      setIsMarkingAllRead(false);
    }
  };

  const unreadCount = visibleNotifications?.filter((notification) => !notification.isRead).length || 0;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6">
      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl dark:border-slate-800 dark:bg-slate-900 md:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
              <Bell className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold md:text-3xl">Notifications</h1>
              <p className="text-sm text-white/75">Stay updated with municipal announcements</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReadAll}
            disabled={isMarkingAllRead || unreadCount === 0}
            className="self-start font-semibold sm:self-auto"
          >
            {isMarkingAllRead ? 'Marking...' : `Read All${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex gap-4">
                  <Skeleton className="h-16 w-16 rounded-md" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

        {!isLoading &&
          visibleNotifications &&
          visibleNotifications.map((notification) => {
            const config = typeConfig[notification.type as keyof typeof typeConfig] || typeConfig.general;
            const Icon = config.icon;
            const unread = !notification.isRead;

            return (
              <Card
                key={notification.id}
                className={`rounded-2xl border transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl ${
                  unread
                    ? `border-transparent bg-gradient-to-r ${config.bgGradient} shadow-lg text-white`
                    : 'border-slate-200 bg-card shadow-md dark:border-slate-800'
                }`}
              >
                <CardContent className="p-4 md:p-5">
                  <div className="flex items-start gap-4">
                    {notification.imageUrl ? (
                      <div className="relative h-20 w-20 rounded-lg overflow-hidden flex-shrink-0">
                        <Image src={notification.imageUrl} alt={notification.title} fill className="object-cover" />
                      </div>
                    ) : (
                      <div className={`h-20 w-20 rounded-lg flex items-center justify-center flex-shrink-0 bg-gradient-to-br ${config.bgGradient}`}>
                        <Icon className="h-10 w-10 text-white" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge className={`mb-2 text-xs font-semibold ${config.badgeColor}`}>
                            {config.label}
                          </Badge>
                          <div className="flex items-center gap-2">
                            <h3 className={`font-bold text-sm ${unread ? 'text-white' : 'text-foreground'}`}>
                              {notification.title}
                            </h3>
                            {unread && <div className="h-3 w-3 rounded-full bg-white animate-pulse" />}
                          </div>
                        </div>
                        <span className={`whitespace-nowrap text-xs font-medium ${unread ? 'text-white/85' : 'text-muted-foreground'}`}>
                          {new Date(notification.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <p className={`text-sm mt-2 line-clamp-2 ${unread ? 'text-white/90' : 'text-muted-foreground'}`}>
                        {notification.description}
                      </p>

                      {notification.location && (
                        <div className={`mt-3 flex items-center gap-2 pt-2 ${unread ? 'border-t border-white/20' : 'border-t border-border'}`}>
                          <MapPin className={`h-4 w-4 ${unread ? 'text-white/80' : 'text-muted-foreground'}`} />
                          <span className={`text-xs ${unread ? 'text-white/85' : 'text-muted-foreground'}`}>
                            {notification.location}
                          </span>

                          {notification.locationLink && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className={`h-auto p-0 text-xs ml-auto ${unread ? 'text-white hover:bg-white/20' : ''}`}
                              asChild
                            >
                              <Link href={notification.locationLink} target="_blank">
                                <ExternalLink className="h-3 w-3 mr-1" />
                                View Map
                              </Link>
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

        {!isLoading && (!visibleNotifications || visibleNotifications.length === 0) && (
          <Card className="border-none shadow-md rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
            <CardContent className="p-12 text-center">
              <div className="bg-gradient-to-br from-slate-400 to-slate-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6">
                <Bell className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-2 text-slate-800 dark:text-slate-100">No Notifications Yet</h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Check back soon for updates on municipal announcements and repairs in your area.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
