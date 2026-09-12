/**
 * Twilio SMS service for sending notifications
 * Server-side only utility
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;
const TWILIO_MESSAGES_URL = TWILIO_ACCOUNT_SID
  ? `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`
  : '';

export interface SendSMSParams {
  phoneNumber: string;
  message: string;
}

const MAX_SMS_CHUNK_LENGTH = 1400;
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 500;

function normalizeSmsText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function normalizePhoneNumber(input: string): string {
  const compact = input.replace(/[\s()-]/g, '');

  if (compact.startsWith('+')) {
    return compact;
  }

  const digitsOnly = compact.replace(/\D/g, '');

  if (digitsOnly.length === 10) {
    return `+91${digitsOnly}`;
  }

  if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    return `+${digitsOnly}`;
  }

  return compact;
}

function splitSmsMessage(message: string): string[] {
  const normalized = normalizeSmsText(message);
  if (normalized.length <= MAX_SMS_CHUNK_LENGTH) {
    return [normalized];
  }

  const words = normalized.split(' ');
  const chunks: string[] = [];
  let current = '';

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length <= MAX_SMS_CHUNK_LENGTH) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
      current = '';
    }

    if (word.length > MAX_SMS_CHUNK_LENGTH) {
      for (let i = 0; i < word.length; i += MAX_SMS_CHUNK_LENGTH) {
        chunks.push(word.slice(i, i + MAX_SMS_CHUNK_LENGTH));
      }
    } else {
      current = word;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function sendFast2SMS(phoneNumber: string, message: string): Promise<{ success: boolean; messageSid?: string; error?: string } | null> {
  const apiKey = process.env.FAST2SMS_API_KEY;
  if (!apiKey) return null;

  const cleanNumber = phoneNumber.replace(/\D/g, '').slice(-10);
  if (cleanNumber.length !== 10) return null;

  try {
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        authorization: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        route: 'q',
        message: normalizeSmsText(message),
        language: 'english',
        flash: 0,
        numbers: cleanNumber,
      }),
    });

    const json = await res.json();
    if (json?.return || json?.status_code === 200) {
      return { success: true, messageSid: json.request_id || 'fast2sms-success' };
    }
    return { success: false, error: json.message || 'Fast2SMS delivery failed' };
  } catch (err: any) {
    return { success: false, error: err.message || 'Fast2SMS request failed' };
  }
}

async function sendMessagePart({
  auth,
  phoneNumber,
  body,
}: {
  auth: string;
  phoneNumber: string;
  body: string;
}): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);

    const response = await fetch(TWILIO_MESSAGES_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        From: TWILIO_PHONE_NUMBER || '',
        To: normalizedPhoneNumber,
        Body: body,
      }).toString(),
    });

    if (response.ok) {
      const result = await response.json();
      return { success: true, messageSid: result?.sid };
    }

    const error = await response.json();
    const isRetriable = response.status >= 500 || response.status === 429;

    if (attempt < MAX_RETRY_ATTEMPTS && isRetriable) {
      await sleep(RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    // Specific diagnosis for Twilio Trial account unverified number error (21608)
    let errorMessage = error.message || 'Failed to send SMS';
    if (error.code === 21608) {
      errorMessage = `Twilio Trial Account requires ${normalizedPhoneNumber} to be verified at twilio.com/user/account/phone-numbers/verified, or configure FAST2SMS_API_KEY in .env for unverified Indian mobile numbers.`;
    }

    console.error('SMS Gateway Error:', error);
    return {
      success: false,
      error: errorMessage,
    };
  }

  return {
    success: false,
    error: 'Failed to send SMS after retries',
  };
}

/**
 * Send an SMS message via Twilio
 * @param phoneNumber - The recipient's phone number
 * @param message - The message content
 * @returns Promise with the message SID or error
 */
export async function sendSMS({
  phoneNumber,
  message,
}: SendSMSParams): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  try {
    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    if (!/^\+[1-9]\d{9,14}$/.test(normalizedPhoneNumber)) {
      return { success: false, error: 'Invalid recipient phone number.' };
    }

    const cleanMessage = normalizeSmsText(message);
    if (!cleanMessage) {
      return { success: false, error: 'SMS message is empty.' };
    }

    // Prefer Fast2SMS for Indian numbers when configured. Otherwise use Twilio.
    const fastRes = await sendFast2SMS(normalizedPhoneNumber, cleanMessage);
    if (fastRes?.success) return fastRes;
    if (fastRes?.error) console.warn('[SMS] Fast2SMS failed, falling back to Twilio:', fastRes.error);

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      return { success: false, error: 'No SMS provider is configured.' };
    }

    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const messageParts = splitSmsMessage(cleanMessage);
    const messageSids: string[] = [];

    for (let index = 0; index < messageParts.length; index += 1) {
      const rawPart = messageParts[index];
      const partPrefix = messageParts.length > 1 ? `(${index + 1}/${messageParts.length}) ` : '';
      const result = await sendMessagePart({
        auth,
        phoneNumber: normalizedPhoneNumber,
        body: `${partPrefix}${rawPart}`,
      });

      if (!result.success) return result;
      if (result.messageSid) messageSids.push(result.messageSid);
    }

    return { success: true, messageSid: messageSids.join(',') };
  } catch (error) {
    console.error('[SMS] Unexpected error:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown SMS error' };
  }
}

/**
 * Send notification SMS to multiple recipients
 * @param phoneNumbers - Array of recipient phone numbers
 * @param message - The message content
 * @returns Promise with results for each recipient
 */
export async function sendBulkSMS(
  phoneNumbers: string[],
  message: string
): Promise<Array<{ phoneNumber: string; success: boolean; messageSid?: string; error?: string }>> {
  const results: Array<{ phoneNumber: string; success: boolean; messageSid?: string; error?: string }> = [];

  for (const phoneNumber of phoneNumbers) {
    const result = await sendSMS({ phoneNumber, message });
    results.push({
      phoneNumber,
      ...result,
    });

    // Small pacing delay helps avoid provider throttling for bulk sends.
    await sleep(120);
  }

  return results;
}
