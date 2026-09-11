'use client';

import { firebaseConfig } from '@/firebase/config';
import * as firebaseAppModule from 'firebase/app';
import * as firebaseAuthModule from 'firebase/auth';
import * as firebaseFirestoreModule from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

export function initializeFirebase(): {
  firebaseApp: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
} {
  const getAppsFn = firebaseAppModule?.getApps || (firebaseAppModule as any)?.default?.getApps;
  const initializeAppFn = firebaseAppModule?.initializeApp || (firebaseAppModule as any)?.default?.initializeApp;
  const getAppFn = firebaseAppModule?.getApp || (firebaseAppModule as any)?.default?.getApp;

  const apps = typeof getAppsFn === 'function' ? getAppsFn() : [];
  let app: FirebaseApp;
  if (!apps.length) {
    try {
      app = initializeAppFn();
    } catch {
      app = initializeAppFn(firebaseConfig);
    }
  } else {
    app = getAppFn();
  }

  const getAuthFn = firebaseAuthModule?.getAuth || (firebaseAuthModule as any)?.default?.getAuth;
  const getFirestoreFn = firebaseFirestoreModule?.getFirestore || (firebaseFirestoreModule as any)?.default?.getFirestore;

  return {
    firebaseApp: app,
    auth: typeof getAuthFn === 'function' ? getAuthFn(app) : (null as any),
    firestore: typeof getFirestoreFn === 'function' ? getFirestoreFn(app) : (null as any),
  };
}

export function getSdks(firebaseApp: FirebaseApp) {
  const getAuthFn = firebaseAuthModule?.getAuth || (firebaseAuthModule as any)?.default?.getAuth;
  const getFirestoreFn = firebaseFirestoreModule?.getFirestore || (firebaseFirestoreModule as any)?.default?.getFirestore;
  return {
    firebaseApp,
    auth: getAuthFn(firebaseApp),
    firestore: getFirestoreFn(firebaseApp),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
