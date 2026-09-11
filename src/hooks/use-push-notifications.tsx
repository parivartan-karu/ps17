'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

interface UsePushNotificationsReturn {
  permission: PushPermission;
  isRegistering: boolean;
  requestPermission: () => Promise<boolean>;
  unregister: () => Promise<void>;
  isSupported: boolean;
}

/**
 * Hook for managing FCM push notifications.
 * - Checks current permission state
 * - Registers firebase-messaging-sw.js
 * - Gets FCM token using the VAPID key
 * - Saves token to the backend (/api/notifications/fcm-token)
 */
export function usePushNotifications(authToken?: string | null): UsePushNotificationsReturn {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [isRegistering, setIsRegistering] = useState(false);
  const registeredRef = useRef(false);

  const isSupported =
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

  // Sync current browser permission on mount
  useEffect(() => {
    if (!isSupported) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission as PushPermission);
  }, [isSupported]);

  const saveToken = useCallback(
    async (token: string) => {
      if (!authToken) return;
      try {
        await fetch('/api/notifications/fcm-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token, action: 'register' }),
        });
      } catch (err) {
        console.warn('Could not save FCM token:', err);
      }
    },
    [authToken]
  );

  const removeToken = useCallback(
    async (token: string) => {
      if (!authToken) return;
      try {
        await fetch('/api/notifications/fcm-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${authToken}`,
          },
          body: JSON.stringify({ token, action: 'unregister' }),
        });
      } catch (err) {
        console.warn('Could not remove FCM token:', err);
      }
    },
    [authToken]
  );

  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      // Register the firebase-messaging service worker (served dynamically with env vars)
      const swReg = await navigator.serviceWorker.register('/api/firebase-messaging-sw', {
        scope: '/',
        updateViaCache: 'none',
      });
      await navigator.serviceWorker.ready;

      // Dynamically import firebase/messaging to avoid SSR issues
      const { initializeApp, getApps, getApp } = await import('firebase/app');
      const { getMessaging, getToken } = await import('firebase/messaging');

      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      };

      const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
      const messaging = getMessaging(app);

      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

      const token = await getToken(messaging, {
        vapidKey,
        serviceWorkerRegistration: swReg,
      });

      return token ?? null;
    } catch (err) {
      console.warn('FCM getToken error:', err);
      return null;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false;
    setIsRegistering(true);

    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);

      if (result === 'granted') {
        const token = await getToken();
        if (token) {
          await saveToken(token);
          registeredRef.current = true;
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('requestPermission error:', err);
      return false;
    } finally {
      setIsRegistering(false);
    }
  }, [isSupported, getToken, saveToken]);

  const unregister = useCallback(async () => {
    try {
      const token = await getToken();
      if (token) await removeToken(token);
      registeredRef.current = false;
    } catch (err) {
      console.warn('Unregister error:', err);
    }
  }, [getToken, removeToken]);

  // Auto-register token if permission already granted and user is logged in
  useEffect(() => {
    if (!isSupported || !authToken || registeredRef.current) return;
    if (Notification.permission !== 'granted') return;

    registeredRef.current = true; // prevent double-run
    getToken()
      .then((token) => {
        if (token) return saveToken(token);
      })
      .catch(() => {});
  }, [isSupported, authToken, getToken, saveToken]);

  return { permission, isRegistering, requestPermission, unregister, isSupported };
}
