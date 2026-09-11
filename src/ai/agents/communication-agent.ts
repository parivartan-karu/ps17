'use server';

import { createAgentReceipt, clampConfidence, type AgentLogEntry } from './types';
import { sendBulkSMS } from '@/lib/twilio';
import { getFirebaseAdmin } from '@/firebase/server';

export type CommunicationType = 'reminder' | 'escalation' | 'status_update';

export type CommunicationInput = {
  type: CommunicationType;
  reportId: string;
  reportTitle?: string;
  category?: string;
  departmentId?: string;
  departmentName?: string;
  priority?: string;
  escalationLevel?: number;
  assignedWorkerName?: string;
  targetUserId?: string;
  targetUserRole?: 'citizen' | 'worker' | 'department_head' | 'official' | 'admin';
  targetPhone?: string;
  customDetails?: string;
};

export type CommunicationOutput = {
  title: string;
  body: string;
  smsMessage?: string;
  receipt: AgentLogEntry;
};

/**
 * Deterministic fallback notification copy generator.
 */
export function generateFallbackCopy(input: CommunicationInput): { title: string; body: string; smsMessage: string } {
  const reportTitle = input.reportTitle ? `"${input.reportTitle.slice(0, 40)}"` : `Report #${input.reportId.slice(0, 8)}`;
  const deptName = input.departmentName || 'Department';

  if (input.type === 'reminder') {
    const title = `⏳ SLA Warning: Action Required`;
    const body = `Report ${reportTitle} assigned to ${deptName} is nearing its SLA deadline. Please prioritize resolution.`;
    const smsMessage = `PMC SLA Warning: ${reportTitle} in ${deptName} is nearing deadline. Action required.`;
    return { title, body, smsMessage };
  }

  if (input.type === 'escalation') {
    const level = input.escalationLevel ?? 1;
    const title = `🚨 SLA Escalation Alert (Level ${level})`;
    const body = `Report ${reportTitle} has breached SLA deadline. Escalated to Level ${level} (${deptName} Leadership).`;
    const smsMessage = `PMC URGENT: Report ${reportTitle} has breached SLA. Escalated to Level ${level} authority.`;
    return { title, body, smsMessage };
  }

  // status_update
  const title = `📋 Complaint Status Update`;
  const body = `Report ${reportTitle} in ${deptName} has a status update. Tap to view details.`;
  const smsMessage = `PMC Update: Report ${reportTitle} status updated. Details in app.`;
  return { title, body, smsMessage };
}

/**
 * communicationAgent: Generates concise, professional notification copy.
 * Note: Never lets the LLM decide escalation actions. The escalation level and type are strictly passed as inputs.
 */
export async function communicationAgent(input: CommunicationInput): Promise<CommunicationOutput> {
  const startTime = performance.now();
  let status: 'success' | 'fallback' | 'error' = 'success';
  let modelUsed = 'rule_comm_engine';
  let resultCopy = generateFallbackCopy(input);
  let confidence = 0.9;
  let reasoning = 'Generated notification copy using deterministic fallback template.';

  const GROQ_API_KEY = process.env.GROQ_API_KEY;

  if (GROQ_API_KEY) {
    try {
      const promptText = `Generate concise, professional civic notification copy for PMC (Pune Municipal Corporation).
Type: ${input.type}
Report Title: ${input.reportTitle || 'Civic Issue'}
Category: ${input.category || 'General'}
Department: ${input.departmentName || 'Municipal Dept'}
Priority: ${input.priority || 'Medium'}
Escalation Level: ${input.escalationLevel || 0}
Target Role: ${input.targetUserRole || 'staff'}
Additional Details: ${input.customDetails || 'None'}

Return ONLY valid JSON with keys:
"title": short notification title (max 50 chars),
"body": detailed notification body (max 150 chars),
"smsMessage": compact SMS text (max 120 chars)`;

      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          temperature: 0.2,
          max_tokens: 150,
          messages: [
            {
              role: 'system',
              content: 'You are an AI communication copywriter for Pune Municipal Corporation civic alerts. Respond with JSON only.',
            },
            {
              role: 'user',
              content: promptText,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawContent = data.choices?.[0]?.message?.content || '';
        const cleanJson = rawContent.replace(/```json|```/g, '').trim();
        const parsed = JSON.parse(cleanJson);

        if (parsed.title && parsed.body) {
          resultCopy = {
            title: String(parsed.title).trim(),
            body: String(parsed.body).trim(),
            smsMessage: String(parsed.smsMessage || parsed.body).trim(),
          };
          modelUsed = 'groq-llama-3.3-70b';
          confidence = 0.95;
          reasoning = 'Generated notification copy using Groq Llama 3.3-70B model.';
        }
      }
    } catch (err: any) {
      console.warn('[communicationAgent] Groq LLM copy generation fallback:', err?.message);
      status = 'fallback';
    }
  }

  const receipt = createAgentReceipt({
    agent: 'communication_agent',
    status,
    startTime,
    model: modelUsed,
    inputSummary: `Type: ${input.type}, Report: ${input.reportId}, TargetRole: ${input.targetUserRole || 'any'}`,
    outputSummary: `Title: "${resultCopy.title}"`,
    confidence: clampConfidence(confidence, 0.9),
    reasoning,
  });

  return {
    title: resultCopy.title,
    body: resultCopy.body,
    smsMessage: resultCopy.smsMessage,
    receipt,
  };
}

export type DispatchNotificationParams = {
  input: CommunicationInput;
  sendSms?: boolean;
};

/**
 * Dispatches notifications across stored in-app notifications, FCM push, and optional Twilio SMS.
 * Reuses existing infrastructure.
 */
export async function dispatchNotification(params: DispatchNotificationParams) {
  const { input, sendSms = false } = params;

  // 1. Generate notification copy
  const copy = await communicationAgent(input);

  const { firestore } = await getFirebaseAdmin();

  // 2. Save in-app notification to Firestore `notifications` collection
  const notifDoc = {
    title: copy.title,
    description: copy.body,
    reportId: input.reportId,
    type: input.type,
    userId: input.targetUserId || null,
    targetRole: input.targetUserRole || null,
    departmentId: input.departmentId || null,
    isRead: false,
    createdAt: new Date().toISOString(),
    createdBy: 'System',
  };

  await firestore.collection('notifications').add(notifDoc).catch((err) => {
    console.error('[dispatchNotification] Failed to save in-app notification:', err?.message);
  });

  // 3. FCM WebPush Notification (Fire-and-forget)
  (async () => {
    try {
      let tokenList: string[] = [];

      if (input.targetUserId) {
        const userDoc = await firestore.collection('users').doc(input.targetUserId).get();
        tokenList = (userDoc.data()?.fcmTokens ?? []) as string[];
      } else if (input.targetUserRole === 'department_head' && input.departmentId) {
        const deptHeadSnap = await firestore
          .collection('users')
          .where('role', '==', 'department_head')
          .where('departmentId', '==', input.departmentId)
          .get();
        deptHeadSnap.forEach((doc: any) => {
          const tokens = (doc.data().fcmTokens ?? []) as string[];
          tokenList.push(...tokens);
        });
      } else if (input.targetUserRole === 'official' || input.targetUserRole === 'admin') {
        const adminSnap = await firestore
          .collection('users')
          .where('role', 'in', ['admin', 'official'])
          .get();
        adminSnap.forEach((doc: any) => {
          const tokens = (doc.data().fcmTokens ?? []) as string[];
          tokenList.push(...tokens);
        });
      } else if (input.departmentId) {
        // Find users/staff in department with push enabled
        const deptSnap = await firestore
          .collection('users')
          .where('departmentId', '==', input.departmentId)
          .where('pushNotificationsEnabled', '==', true)
          .get();
        deptSnap.forEach((doc: any) => {
          const tokens = (doc.data().fcmTokens ?? []) as string[];
          tokenList.push(...tokens);
        });
      }

      tokenList = [...new Set(tokenList)];

      if (tokenList.length > 0) {
        const { app } = await getFirebaseAdmin();
        const { getMessaging } = await import('firebase-admin/messaging');
        const messaging = getMessaging(app);

        await messaging.sendEachForMulticast({
          tokens: tokenList,
          notification: {
            title: copy.title,
            body: copy.body,
          },
          webpush: {
            notification: {
              title: copy.title,
              body: copy.body,
              icon: '/icons/icon-192x192.png',
              badge: '/icons/icon-96x96.png',
              tag: `sla-${input.type}-${input.reportId}`,
            },
            fcmOptions: {
              link: input.targetUserRole === 'citizen'
                ? `/citizen/complaint/${input.reportId}`
                : `/dept/complaint/${input.reportId}`,
            },
          },
          data: {
            url: input.targetUserRole === 'citizen'
              ? `/citizen/complaint/${input.reportId}`
              : `/dept/complaint/${input.reportId}`,
            tag: `sla-${input.type}-${input.reportId}`,
          },
        }).catch(() => {});
      }
    } catch {
      /* non-fatal */
    }
  })();

  // 4. Send SMS if requested & phone number available
  if (sendSms && input.targetPhone) {
    const smsMessage = copy.smsMessage || `PMC Alert: ${copy.title} - ${copy.body}`;
    await sendBulkSMS([input.targetPhone], smsMessage).catch((err) => {
      console.warn('[dispatchNotification] SMS send error:', err?.message);
    });
  }

  return copy;
}

/**
 * Register EventBus subscribers to automatically dispatch role-tailored notifications upon workflow events.
 */
export function registerEventBusListeners() {
  const { eventBus } = require('@/lib/event-bus');

  eventBus.subscribe('SLA_BREACHED', async (evt: any) => {
    await dispatchNotification({
      input: {
        type: 'escalation',
        reportId: evt.complaintId,
        departmentId: evt.departmentId,
        escalationLevel: evt.payload.escalationLevel || 1,
        targetUserRole: evt.payload.escalationLevel === 2 ? 'admin' : 'department_head',
        reportTitle: evt.payload.title,
      },
      sendSms: true,
    });
  });

  eventBus.subscribe('WORKER_ASSIGNED', async (evt: any) => {
    await dispatchNotification({
      input: {
        type: 'status_update',
        reportId: evt.complaintId,
        departmentId: evt.departmentId,
        targetUserId: evt.payload.assignedWorkerId,
        targetUserRole: 'worker',
        reportTitle: evt.payload.title,
        customDetails: `Assigned task: ${evt.payload.title}`,
      },
    });
  });

  eventBus.subscribe('REWORK_REQUESTED', async (evt: any) => {
    await dispatchNotification({
      input: {
        type: 'status_update',
        reportId: evt.complaintId,
        departmentId: evt.departmentId,
        targetUserId: evt.payload.assignedWorkerId,
        targetUserRole: 'worker',
        reportTitle: evt.payload.title,
        customDetails: `Evidence rejected. Rework required: ${evt.payload.reworkInstructions || 'Upload valid photo'}`,
      },
    });
  });

  eventBus.subscribe('COMPLAINT_RESOLVED', async (evt: any) => {
    await dispatchNotification({
      input: {
        type: 'status_update',
        reportId: evt.complaintId,
        targetUserId: evt.payload.userId,
        targetUserRole: 'citizen',
        reportTitle: evt.payload.title,
        customDetails: 'Your complaint has been successfully resolved by PMC.',
      },
    });
  });
}
