'use client';
import React, { type ReactNode } from 'react';
import { FirebaseProvider, initializeFirebase } from '@/firebase';

// This is the single source of truth for initializing Firebase client-side.
const { firebaseApp, firestore, auth } = initializeFirebase();

/**
 * Provides Firebase services to client components.
 * This component ensures that Firebase is initialized only once.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The children to render.
 * @returns {React.ReactElement} The provider component.
 */
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  if (!firebaseApp || !firestore || !auth) {
    // This can happen if initialization fails.
    // You might want to render a more user-friendly error message.
    return (
      <div>
        <h1>Error</h1>
        <p>Could not initialize Firebase. Please check your configuration.</p>
      </div>
    );
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      firestore={firestore}
      auth={auth}
    >
      {children}
    </FirebaseProvider>
  );
}
