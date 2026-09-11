'use client';
import Link from 'next/link';
import { Bell, HardHat } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCollection, useMemoFirebase } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, limit, doc, writeBatch } from 'firebase/firestore';
import type { Notification } from '@/lib/types';
import UserNav from './user-nav';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { isNotificationActive } from '@/lib/notification-utils';

export default function WorkerHeader() {
  const firestore = useFirestore();
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'), limit(5));
  }, [firestore]);

  const { data: allNotifications } = useCollection<Notification>(notificationsQuery);
  const notifications = allNotifications?.filter((notification) => isNotificationActive(notification)) || [];
  const unreadCount = notifications.filter(n => !n.isRead).length || 0;

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

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between px-4">
        {/* Left side: Worker label */}
        <div className="flex items-center gap-2">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-md">
            <HardHat className="h-4 w-4" />
          </div>
          <span className="font-semibold text-sm">Worker Mobile App</span>
        </div>

        {/* Right side: Notifications and User */}
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    {unreadCount}
                  </Badge>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel className="flex justify-between items-center">
                Notifications
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReadAll}
                    className="text-xs text-muted-foreground hover:underline"
                    disabled={isMarkingAllRead || unreadCount === 0}
                  >
                    {isMarkingAllRead ? 'Reading...' : 'Read all'}
                  </button>
                  <Link href="/worker/notifications" className="text-xs text-primary hover:underline">
                    View all
                  </Link>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications && notifications.length > 0 ? (
                notifications.slice(0, 3).map((notification) => (
                  <DropdownMenuItem key={notification.id} asChild>
                    <Link href="/worker/notifications" className="flex flex-col items-start gap-1 p-3">
                      <span className="font-medium text-sm">{notification.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2">{notification.description}</span>
                    </Link>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No notifications yet
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <UserNav />
        </div>
      </div>
    </header>
  );
}
