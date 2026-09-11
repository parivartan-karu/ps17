import { NextRequest, NextResponse } from 'next/server';
import { sendSMS } from '@/lib/twilio';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/auth/send-sms
 * Server-side endpoint to send SMS (credentials are secure on server)
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity(request);

    const { phoneNumber, message } = await request.json();

    if (!phoneNumber || !message) {
      return NextResponse.json(
        { error: 'Phone number and message are required' },
        { status: 400 }
      );
    }

    const result = await sendSMS({
      phoneNumber,
      message,
    });

    if (!result.success) {
      console.warn('SMS sending warning:', result.error);
      return NextResponse.json(
        {
          success: true,
          warning: 'Account created but SMS could not be sent',
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        messageSid: result.messageSid,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error sending SMS:', error);
    return NextResponse.json(
      {
        success: true,
        warning: 'Account created but SMS could not be sent',
      },
      { status: 200 }
    );
  }
}
