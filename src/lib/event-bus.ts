/**
 * EventBus Module for Parivartan
 * Centralized in-memory event bus emitting and logging standard workflow events.
 */

export type SystemEventType =
  | 'COMPLAINT_CREATED'
  | 'WORKER_ASSIGNED'
  | 'STATUS_CHANGED'
  | 'SLA_WARNING'
  | 'SLA_BREACHED'
  | 'REWORK_REQUESTED'
  | 'EVIDENCE_SUBMITTED'
  | 'COMPLAINT_RESOLVED';

export type SystemEvent = {
  id: string;
  type: SystemEventType;
  complaintId: string;
  departmentId?: string;
  actorUid?: string;
  actorRole?: 'Citizen' | 'Worker' | 'Department_Head' | 'Admin' | 'AI_System';
  timestamp: string;
  payload: Record<string, any>;
};

type EventListener = (event: SystemEvent) => void | Promise<void>;

class EventBusService {
  private listeners: Map<SystemEventType, Set<EventListener>> = new Map();
  private eventHistory: SystemEvent[] = [];

  public subscribe(eventType: SystemEventType, listener: EventListener): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(listener);

    return () => {
      this.listeners.get(eventType)?.delete(listener);
    };
  }

  public async emit(
    type: SystemEventType,
    complaintId: string,
    payload: Record<string, any> = {},
    actorUid?: string,
    actorRole?: SystemEvent['actorRole'],
    departmentId?: string
  ): Promise<SystemEvent> {
    const event: SystemEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      type,
      complaintId,
      departmentId,
      actorUid,
      actorRole: actorRole || 'AI_System',
      timestamp: new Date().toISOString(),
      payload,
    };

    this.eventHistory.push(event);
    if (this.eventHistory.length > 500) {
      this.eventHistory.shift();
    }

    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          await listener(event);
        } catch (err: any) {
          console.error(`[EventBus] Listener error for event ${type}:`, err?.message);
        }
      }
    }

    return event;
  }

  public getHistory(complaintId?: string): SystemEvent[] {
    if (!complaintId) return [...this.eventHistory];
    return this.eventHistory.filter((e) => e.complaintId === complaintId);
  }
}

export const eventBus = new EventBusService();
