import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

import { SESSION_COOKIE_NAME, WorkerIdentity, cookieOptions, sessionRequestSchema } from '@/lib/worker-api';
import { getFirebaseAdmin } from '@/firebase/server';

const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 5;

export async function createWorkerSession(idToken: string) {
  const { auth } = await getFirebaseAdmin();
  const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
  return { sessionCookie, expiresInMs: SESSION_DURATION_MS };
}

export async function clearWorkerSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function setWorkerSession(idToken: string) {
  const cookieStore = await cookies();
  const { sessionCookie, expiresInMs } = await createWorkerSession(idToken);
  cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, cookieOptions(expiresInMs));
}

async function resolveDecodedToken(request: NextRequest) {
  const { auth } = await getFirebaseAdmin();
  const authHeader = request.headers.get('authorization');
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (bearerToken) {
    return auth.verifyIdToken(bearerToken);
  }

  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (sessionCookie) {
    return auth.verifySessionCookie(sessionCookie, true);
  }

  return null;
}

export async function requireWorkerIdentity(request: NextRequest): Promise<WorkerIdentity> {
  const decodedToken = await resolveDecodedToken(request);
  if (!decodedToken) {
    throw new Error('UNAUTHORIZED');
  }

  const { firestore } = await getFirebaseAdmin();
  const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();
  const profile = userDoc.exists ? (userDoc.data() as WorkerIdentity['profile']) : null;

  const role = profile?.role;
  if (role && role !== 'worker') {
    throw new Error('FORBIDDEN');
  }

  return {
    uid: decodedToken.uid,
    email: decodedToken.email || profile?.email || '',
    name: profile?.name || decodedToken.name || decodedToken.email?.split('@')[0] || 'Field Worker',
    profile,
  };
}

export async function parseSessionRequest(request: NextRequest) {
  const body = await request.json();
  return sessionRequestSchema.parse(body);
}
