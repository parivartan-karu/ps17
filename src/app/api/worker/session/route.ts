import { NextRequest, NextResponse } from 'next/server';

import { handleApiError } from '@/app/api/worker/_utils';
import { SESSION_COOKIE_NAME, cookieOptions } from '@/lib/worker-api';
import { createWorkerSession, parseSessionRequest, requireWorkerIdentity } from '@/lib/worker-api-server';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await parseSessionRequest(request);
    const { sessionCookie, expiresInMs } = await createWorkerSession(idToken);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, sessionCookie, cookieOptions(expiresInMs));
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Verify worker has a valid session before allowing logout
    await requireWorkerIdentity(request);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE_NAME, '', { path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    return handleApiError(error);
  }
}
