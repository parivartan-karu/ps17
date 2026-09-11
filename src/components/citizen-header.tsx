'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell, LogOut, Settings, User, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCollection, useMemoFirebase, useUser } from '@/firebase';
import { useFirestore } from '@/firebase/provider';
import { collection, query, orderBy, limit, doc, writeBatch } from 'firebase/firestore';
import { getAuth, signOut } from 'firebase/auth';
import type { Notification } from '@/lib/types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { isNotificationActive } from '@/lib/notification-utils';

export default function CitizenHeader() {
  const router = useRouter();
  const firestore = useFirestore();
  const { user } = useUser();
  const [isMarkingAllRead, setIsMarkingAllRead] = useState(false);

  const handleLogout = async () => {
    try {
      const auth = getAuth();
      await signOut(auth);
      router.push('/');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const notificationsQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    // Fetch recent notifications (limit 10 to have room for client-side filtering)
    return query(collection(firestore, 'notifications'), orderBy('createdAt', 'desc'), limit(10));
  }, [firestore, user]);

  const { data: allNotifications } = useCollection<Notification>(notificationsQuery);

  // Only show global notifications (no userId) OR ones targeted at THIS citizen.
  // This prevents citizens from seeing worker-specific or other user-specific notifications.
  const notifications = allNotifications?.filter(
    (n) => (!n.userId || n.userId === user?.uid) && isNotificationActive(n)
  ).slice(0, 5);

  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;

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
    <header className="sticky top-0 z-40 w-full bg-white dark:bg-slate-950 border-b border-gray-100 dark:border-slate-800 shadow-sm">
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full hover:bg-gray-100 dark:hover:bg-slate-800">
                <Avatar className="h-9 w-9 border-2 border-emerald-100 dark:border-emerald-900">
                  <AvatarFallback className="bg-gradient-to-br from-emerald-400 to-green-500 text-white text-sm font-semibold">
                    C
                  </AvatarFallback>
                </Avatar>
                <span className="sr-only">Profile menu</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56 rounded-xl shadow-lg border dark:border-slate-800">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold">My Account</p>
                  <p className="text-xs text-muted-foreground">Manage your profile</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                <Link href="/citizen/profile" className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center mr-3">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    Profile
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild className="cursor-pointer rounded-lg">
                <Link href="/citizen/profile" className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-8 w-8 rounded-lg bg-gray-50 dark:bg-slate-900 flex items-center justify-center mr-3">
                      <Settings className="h-4 w-4 text-gray-600 dark:text-slate-300" />
                    </div>
                    Settings
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-400" />
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer rounded-lg text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950">
                <div className="h-8 w-8 rounded-lg bg-red-50 dark:bg-red-950 flex items-center justify-center mr-3">
                  <LogOut className="h-4 w-4" />
                </div>
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex flex-col">
            <span className="font-bold text-gray-900 dark:text-slate-100">Parivartan</span>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Citizen Portal</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full relative hover:bg-gray-100 dark:hover:bg-slate-800">
                <div className="h-9 w-9 rounded-full bg-gray-50 dark:bg-slate-900 flex items-center justify-center">
                  <Bell className="h-5 w-5 text-gray-600 dark:text-slate-300" />
                </div>
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                    {unreadCount}
                  </span>
                )}
                <span className="sr-only">Notifications</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 rounded-xl shadow-lg border dark:border-slate-800">
              <DropdownMenuLabel className="flex justify-between items-center">
                <span className="font-semibold">Notifications</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleReadAll}
                    className="text-xs text-gray-500 dark:text-slate-400 hover:underline font-medium"
                    disabled={isMarkingAllRead || unreadCount === 0}
                  >
                    {isMarkingAllRead ? 'Reading...' : 'Read all'}
                  </button>
                  <Link href="/citizen/notifications" className="text-xs text-emerald-600 hover:underline font-medium">
                    View all
                  </Link>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications && notifications.length > 0 ? (
                notifications.slice(0, 3).map((notification) => (
                  <DropdownMenuItem key={notification.id} asChild className="cursor-pointer">
                    <Link href="/citizen/notifications" className="flex flex-col items-start gap-1 p-3 rounded-lg">
                      <span className="font-medium text-sm">{notification.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2">{notification.description}</span>
                    </Link>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="p-6 text-center">
                  <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-900 flex items-center justify-center mx-auto mb-3">
                    <Bell className="h-6 w-6 text-gray-400 dark:text-slate-500" />
                  </div>
                  <p className="text-sm text-muted-foreground">No notifications yet</p>
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
