import { broadcast } from '../plugins/websocket.js';

// ── Event types ──────────────────────────────────────────────

export type RealtimeEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.moved'
  | 'task.deleted'
  | 'task.reordered'
  | 'comment.added'
  | 'sprint.status_changed'
  | 'phase.updated'
  | 'user.presence'
  | 'notification';

export interface RealtimeEvent {
  type: RealtimeEventType;
  payload: unknown;
  /** ISO timestamp */
  timestamp: string;
  /** User who triggered the event (omitted for system events) */
  triggeredBy?: string;
}

// ── Broadcast helpers ────────────────────────────────────────

/**
 * Broadcast an event to everyone subscribed to `project:{projectId}`.
 */
export function broadcastToProject(
  projectId: string,
  type: RealtimeEventType,
  payload: unknown,
  triggeredBy?: string,
): void {
  const event: RealtimeEvent = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    triggeredBy,
  };
  broadcast(`project:${projectId}`, event);
}

/**
 * Broadcast an event to a specific user's personal room `user:{userId}`.
 */
export function broadcastToUser(
  userId: string,
  type: RealtimeEventType,
  payload: unknown,
  triggeredBy?: string,
): void {
  const event: RealtimeEvent = {
    type,
    payload,
    timestamp: new Date().toISOString(),
    triggeredBy,
  };
  broadcast(`user:${userId}`, event);
}
