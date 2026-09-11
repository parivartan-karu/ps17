'use client';

import React, { type ReactNode } from 'react';
import { FirebaseProvider, initializeFirebase } from '@/firebase';

let cachedServices: ReturnType<typeof initializeFirebase> | null = null;

function getServices() {
  if (!cachedServices || !cachedServices.firebaseApp) {
    cachedServices = initializeFirebase();
  }
  return cachedServices;
}

/**
 * Provides Firebase services to client components.
 * This component ensures that Firebase is initialized only once.
 * @param {object} props - The component props.
 * @param {React.ReactNode} props.children - The children to render.
 * @returns {React.ReactElement} The provider component.
 */
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const { firebaseApp, firestore, auth } = getServices();

  if (!firebaseApp || !firestore || !auth) {
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
