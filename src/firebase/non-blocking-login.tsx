'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { FirebaseError } from 'firebase/app';

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): void {
  // CRITICAL: Call signInAnonymously directly. Do NOT use 'await signInAnonymously(...)'.
  signInAnonymously(authInstance);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): void {
  // CRITICAL: Call createUserWithEmailAndPassword directly. Do NOT use 'await createUserWithEmailAndPassword(...)'.
  createUserWithEmailAndPassword(authInstance, email, password);
  // Code continues immediately. Auth state change is handled by onAuthStateChanged listener.
}

/** Initiate email/password sign-in (non-blocking). Creates the user if they don't exist. */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): void {
  signInWithEmailAndPassword(authInstance, email, password)
    .catch((error: FirebaseError) => {
      // If user not found or credential is bad (which can mean user doesn't exist), create them.
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        createUserWithEmailAndPassword(authInstance, email, password)
          .catch((creationError: FirebaseError) => {
            // Handle cases where even creation might fail (e.g. invalid email format)
            // This shouldn't happen with the demo emails, but it's good practice.
            console.error("Demo user creation failed: ", creationError);
          });
      } else {
        // Handle other potential login errors
        console.error("Demo user sign-in failed: ", error);
      }
    });
}
