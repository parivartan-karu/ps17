'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff, X, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { useUser } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

const STORAGE_KEY = 'parivartan_push_dismissed';
const DISMISS_DAYS = 7; // re-show after 7 days

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return false;
  const dismissed = Number(raw);
  return Date.now() - dismissed < DISMISS_DAYS * 86_400_000;
}

function markDismissed() {
  localStorage.setItem(STORAGE_KEY, String(Date.now()));
}

export function PushNotificationPrompt() {
  const { user } = useUser();
  const { toast } = useToast();
  const [show, setShow] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { permission, isRegistering, requestPermission, isSupported } = usePushNotifications(authToken);

  // Get auth token
  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(setAuthToken).catch(() => { });
  }, [user]);

  // Show prompt after 3 seconds if permission is default and user is logged in
  useEffect(() => {
    if (!isSupported || !user) return;
    if (permission !== 'default') return;
    if (wasDismissedRecently()) return;

    const timer = setTimeout(() => setShow(true), 3000);
    return () => clearTimeout(timer);
  }, [isSupported, user, permission]);

  if (!show || !isSupported) return null;
  if (permission === 'granted' || permission === 'denied') return null;

  const handleAllow = async () => {
    const granted = await requestPermission();
    setShow(false);
    if (granted) {
      toast({
        title: '🔔 Notifications enabled!',
        description: "You'll get real-time updates on your complaints.",
      });
    } else {
      markDismissed();
      toast({
        title: 'Notifications blocked',
        description: 'You can enable them later from browser settings.',
        variant: 'destructive',
      });
    }
  };

  const handleDismiss = () => {
    markDismissed();
    setShow(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
        onClick={handleDismiss}
      />

      {/* Bottom sheet */}
      <div className="fixed bottom-0 left-0 right-0 z-50 animate-in slide-in-from-bottom-4 duration-300">
        <div className="mx-auto max-w-lg rounded-t-3xl bg-white shadow-2xl">
          {/* Handle */}
          <div className="flex justify-center pt-3">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>

          {/* Dismiss button */}
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-full p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="p-6 pb-8">
            {/* Icon + Header */}
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-lg">
                <Bell className="h-7 w-7 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Stay in the loop</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Get instant updates when your complaints are verified, assigned to a worker, or resolved — right on your device.
                </p>
              </div>
            </div>

            {/* Benefits list */}
            <ul className="mt-5 space-y-2">
              {[
                { icon: '✅', text: 'Know when your complaint is resolved' },
                { icon: '🔧', text: 'See when a worker is assigned' },
                { icon: '📍', text: 'Get road work & traffic alerts near you' },
              ].map((item) => (
                <li key={item.text} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-base">{item.icon}</span>
                  {item.text}
                </li>
              ))}
            </ul>

            {/* CTA Buttons */}
            <div className="mt-6 flex flex-col gap-3">
              <Button
                onClick={handleAllow}
                disabled={isRegistering}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-base font-semibold text-white shadow-md hover:from-orange-600 hover:to-orange-700"
              >
                {isRegistering ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Enabling…
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Bell className="h-4 w-4" />
                    Enable Notifications
                  </span>
                )}
              </Button>
              <button
                onClick={handleDismiss}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Not now
              </button>
            </div>

            {/* Footer note */}
            <p className="mt-4 text-center text-xs text-gray-400">
              <Sparkles className="inline h-3 w-3" /> You can change this anytime in Profile → Notifications
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/** Compact bell icon for profile page notification toggle */
export function NotificationToggleRow({
  onToggleOff,
}: {
  onToggleOff?: () => void;
}) {
  const { user } = useUser();
  const { toast } = useToast();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { permission, isRegistering, requestPermission, unregister, isSupported } =
    usePushNotifications(authToken);

  useEffect(() => {
    if (!user) return;
    user.getIdToken().then(setAuthToken).catch(() => { });
  }, [user]);

  if (!isSupported) {
    return (
      <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <BellOff className="h-5 w-5 text-gray-400" />
          <div>
            <p className="text-sm font-medium text-gray-700">Push Notifications</p>
            <p className="text-xs text-gray-400">Not supported in this browser</p>
          </div>
        </div>
      </div>
    );
  }

  const isEnabled = permission === 'granted';

  const handleToggle = async () => {
    if (isEnabled) {
      await unregister();
      onToggleOff?.();
      toast({ title: 'Notifications disabled', description: 'You can re-enable them anytime.' });
    } else {
      const granted = await requestPermission();
      if (granted) {
        toast({
          title: '🔔 Notifications enabled!',
          description: "You'll receive real-time updates on your complaints.",
        });
      } else {
        toast({
          title: 'Permission denied',
          description: 'Please allow notifications in your browser settings.',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className={`rounded-full p-1.5 ${isEnabled ? 'bg-orange-100' : 'bg-gray-100'}`}>
          {isEnabled ? (
            <Bell className="h-4 w-4 text-orange-600" />
          ) : (
            <BellOff className="h-4 w-4 text-gray-400" />
          )}
        </div>
        <div>
          <p className="text-sm font-medium text-gray-700">Push Notifications</p>
          <p className="text-xs text-gray-400">
            {permission === 'denied'
              ? 'Blocked in browser — change in Settings'
              : isEnabled
                ? 'Enabled — you get real-time updates'
                : 'Off — enable to track your complaints'}
          </p>
        </div>
      </div>
      {permission !== 'denied' && (
        <button
          onClick={handleToggle}
          disabled={isRegistering}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500 ${isEnabled ? 'bg-orange-500' : 'bg-gray-300'
            } ${isRegistering ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${isEnabled ? 'translate-x-6' : 'translate-x-1'
              }`}
          />
        </button>
      )}
    </div>
  );
}
