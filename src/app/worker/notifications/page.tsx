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
import { isNotificationActive } from '@/lib/notification-utils';

const typeConfig = {
  road_construction: { icon: Construction, label: 'Road Construction', color: 'bg-orange-500' },
  traffic_update: { icon: AlertTriangle, label: 'Traffic Update', color: 'bg-yellow-500' },
  maintenance: { icon: Wrench, label: 'Maintenance', color: 'bg-blue-500' },
  general: { icon: Info, label: 'General', color: 'bg-gray-500' },
};

export default function WorkerNotificationsPage() {
  const firestore = useFirestore();
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: allNotifications, isLoading } = useCollection<Notification>(notificationsQuery);
  const notifications = allNotifications?.filter((notification) => isNotificationActive(notification));

  const handleReadAll = async () => {
    if (!firestore || !notifications) return;
    setIsMarkingAllRead(true);
    try {
      const unreadNotifications = notifications.filter((notification) => !notification.isRead);
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

  const unreadCount = notifications?.filter((notification) => !notification.isRead).length || 0;

  return (
    <div className="flex-1 space-y-4">
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 text-white p-4 rounded-lg shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6" />
            <div>
              <h1 className="text-lg font-bold">Notifications</h1>
              <p className="text-sm opacity-90">Updates from SMC</p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleReadAll}
            disabled={isMarkingAllRead || unreadCount === 0}
          >
            {isMarkingAllRead ? 'Marking...' : `Read All${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-md" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {!isLoading && notifications && notifications.map((notification) => {
          const config = typeConfig[notification.type] || typeConfig.general;
          const Icon = config.icon;

          return (
            <Card
              key={notification.id}
              className={`hover:shadow-md transition-shadow ${!notification.isRead ? 'border-amber-300 bg-amber-50/70' : ''
                }`}
            >
              <CardContent className="p-4">
                <div className="flex gap-4">
                  {notification.imageUrl ? (
                    <div className="relative h-16 w-16 rounded-md overflow-hidden flex-shrink-0">
                      <Image
                        src={notification.imageUrl}
                        alt={notification.title}
                        fill
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className={`h-16 w-16 rounded-md flex items-center justify-center flex-shrink-0 ${config.color}`}>
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge variant="secondary" className="mb-1 text-xs">
                          {config.label}
                        </Badge>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-sm">{notification.title}</h3>
                          {!notification.isRead && (
                            <div className="h-2 w-2 rounded-full bg-amber-500 flex-shrink-0" />
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(notification.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {notification.description}
                    </p>
                    {notification.location && (
                      <div className="flex items-center gap-2 mt-2">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">{notification.location}</span>
                        {notification.locationLink && (
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                            <Link href={notification.locationLink} target="_blank">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Map
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

        {!isLoading && (!notifications || notifications.length === 0) && (
          <Card>
            <CardContent className="p-8 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="font-semibold mb-2">No Notifications</h3>
              <p className="text-sm text-muted-foreground">
                You'll see updates from SMC here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
