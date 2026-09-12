import { getFirebaseAdmin } from '@/firebase/server';
import type { SystemEvent, SystemEventType } from './event-bus';

export async function emitWorkflowEvent(
  type: SystemEventType,
  complaintId: string,
  payload: Record<string, any> = {},
  actorUid?: string,
  actorRole?: SystemEvent['actorRole'],
  departmentId?: string,
) {
  const event: SystemEvent = {
    id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    type, complaintId, departmentId, actorUid, actorRole, timestamp: new Date().toISOString(), payload,
  };
  const { firestore } = await getFirebaseAdmin();
  await firestore.collection('workflow_events').doc(event.id).set(event);
  return event;
}
