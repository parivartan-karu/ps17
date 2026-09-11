import { NextRequest } from 'next/server';

import { getFirebaseAdmin } from '@/firebase/server';
import type { User as UserProfile } from '@/lib/types';

type SupportedRole = UserProfile['role'];

export class RequestAuthError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403,
  ) {
    super(message);
  }
}

export type RequestIdentity = {
  uid: string;
  email: string;
  role: SupportedRole;
  profile: UserProfile;
};

function readBearerToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

export async function requireRequestIdentity(
  request: NextRequest,
  allowedRoles: SupportedRole[] = [],
): Promise<RequestIdentity> {
  const idToken = readBearerToken(request);

  if (!idToken) {
    throw new RequestAuthError('Missing authorization token.', 401);
  }

  const { auth, firestore } = await getFirebaseAdmin();
  const decoded = await auth.verifyIdToken(idToken);

  const userDoc = await firestore.collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) {
    throw new RequestAuthError('User profile not found.', 403);
  }

  const profile = userDoc.data() as UserProfile;
  const role = profile.role;

  if (!role) {
    throw new RequestAuthError('User role is missing.', 403);
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(role)) {
    throw new RequestAuthError('You do not have permission to perform this action.', 403);
  }

  return {
    uid: decoded.uid,
    email: decoded.email || profile.email || '',
    role,
    profile,
  };
}
