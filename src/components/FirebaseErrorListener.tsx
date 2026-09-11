'use client';

import { useEffect, useRef } from 'react';
import { disableNetwork, enableNetwork } from 'firebase/firestore';
import { useFirestore } from '@/firebase/provider';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * Listens for Firestore errors and auto-recovers instead of crashing the app.
 *
 * Firebase SDK internal assertion errors (ID: ca9 / b815) are a known race
 * condition in the watch stream when React Strict Mode double-invokes effects.
 * Instead of throwing and killing the UI, we cycle the network connection to
 * flush all stale listeners and reconnect cleanly.
 */
export function FirebaseErrorListener() {
  const firestore = useFirestore();
  const recoveryCount = useRef(0);
  const recoveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Firestore watch-stream crash recovery ──────────────────────────────
  useEffect(() => {
    if (!firestore) return;

    function handleUnhandledRejection(event: PromiseRejectionEvent) {
      const msg = String(event?.reason?.message ?? event?.reason ?? '');
      if (
        msg.includes('INTERNAL ASSERTION FAILED') ||
        msg.includes('FIRESTORE') ||
        msg.includes('Unexpected state')
      ) {
        event.preventDefault(); // Don't propagate as unhandled

        // Debounce: only one recovery cycle every 3 seconds
        if (recoveryTimer.current) return;
        recoveryCount.current += 1;

        console.warn(
          `[Parivartan] Firestore internal error detected (attempt ${recoveryCount.current}). Reconnecting...`
        );

        recoveryTimer.current = setTimeout(async () => {
          recoveryTimer.current = null;
          try {
            await disableNetwork(firestore);
            await new Promise((r) => setTimeout(r, 400));
            await enableNetwork(firestore);
          } catch {
            // ignore errors during recovery
          }
        }, 200);
      }
    }

    function handleError(event: ErrorEvent) {
      const msg = String(event?.message ?? '');
      if (msg.includes('INTERNAL ASSERTION FAILED') || msg.includes('Unexpected state')) {
        event.preventDefault();
        if (recoveryTimer.current) return;
        recoveryTimer.current = setTimeout(async () => {
          recoveryTimer.current = null;
          try {
            await disableNetwork(firestore);
            await new Promise((r) => setTimeout(r, 400));
            await enableNetwork(firestore);
          } catch {}
        }, 200);
      }
    }

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('error', handleError);
      if (recoveryTimer.current) clearTimeout(recoveryTimer.current);
    };
  }, [firestore]);

  // ── Permission errors — show toast, don't crash ────────────────────────
  useEffect(() => {
    const handlePermissionError = (error: FirestorePermissionError) => {
      // Log for debugging but do NOT throw — that crashes the whole React tree
      console.warn('[Parivartan] Firestore permission denied:', error.message);
    };
    errorEmitter.on('permission-error', handlePermissionError);
    return () => errorEmitter.off('permission-error', handlePermissionError);
  }, []);

  return null;
}
