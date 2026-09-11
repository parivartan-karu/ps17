import type { Auth } from 'firebase/auth';

export async function buildAuthHeaders(auth: Auth | null, base: HeadersInit = {}) {
  if (!auth?.currentUser) {
    throw new Error('User must be signed in to perform this action.');
  }

  const token = await auth.currentUser.getIdToken();

  return {
    ...base,
    Authorization: `Bearer ${token}`,
  };
}
