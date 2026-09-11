import { NextRequest, NextResponse } from 'next/server';
import { sendBulkSMS } from '@/lib/twilio';
import { requireRequestIdentity, RequestAuthError } from '@/lib/server-auth';


export const dynamic = 'force-dynamic';
/**
 * POST /api/notifications/send-sms
 * Sends SMS notifications to all citizens and workers
 */
export async function POST(request: NextRequest) {
  try {
    await requireRequestIdentity(request, ['official', 'department_head']);

    const { title, description, location, phoneNumbers } = await request.json();

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      );
    }

    const recipientNumbers = Array.isArray(phoneNumbers)
      ? [...new Set(phoneNumbers.filter((phone) => typeof phone === 'string' && phone.trim()).map((phone) => phone.trim()))]
      : [];

    if (recipientNumbers.length === 0) {
      return NextResponse.json(
        {
          success: true,
          message: 'Notification stored but no phone numbers found for SMS'
        },
        { status: 200 }
      );
    }

    const message = `PMC Update: ${title ? `[${title}] ` : ''}${description}${
      location ? ` Location: ${location}` : ''
    }`;

    const smsResults = await sendBulkSMS(recipientNumbers, message);

    const successCount = smsResults.filter((r) => r.success).length;
    const failureCount = smsResults.filter((r) => !r.success).length;

    return NextResponse.json(
      {
        success: true,
        message: `SMS sent to ${successCount} recipients, ${failureCount} failed`,
        details: {
          totalRecipients: recipientNumbers.length,
          successCount,
          failureCount,
          results: smsResults,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof RequestAuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error('Error sending SMS notifications:', error);
    return NextResponse.json(
      {
        error: 'Failed to send notifications',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
