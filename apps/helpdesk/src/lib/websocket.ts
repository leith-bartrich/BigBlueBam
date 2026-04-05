/**
 * WebSocket manager for Helpdesk realtime events.
 *
 * Connects to the Helpdesk API's /helpdesk/ws endpoint (proxied through nginx).
 * The browser automatically sends the httpOnly helpdesk_session cookie on the
 * upgrade request.
 *
 * Features:
 * - Auto-reconnect with exponential backoff (1s -> 30s max)
 * - Room subscription management (e.g. ticket:{id})
 * - Event dispatching to registered handlers
 * - Internal ping/pong keepalive every 30s
 */

export interface RealtimeEvent {
  type: string;
  payload: unknown;
  room?: string;
  timestamp: string;
  triggeredBy?: string;
}

type EventHandler = (event: RealtimeEvent) => void;

const MIN_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const RECONNECT_MULTIPLIER = 2;

// HB-47: key under which the highest seen event id is persisted. Survives
// page reloads and browser restarts so a customer returning after a long
// gap still gets a clean replay rather than a blind refetch.
const LAST_SEEN_EVENT_ID_KEY = 'helpdesk.lastSeenEventId';

function readLastSeenEventId(): number {
  try {
    const raw = window.localStorage.getItem(LAST_SEEN_EVENT_ID_KEY);
    if (!raw) return 0;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function writeLastSeenEventId(id: number): void {
  try {
    window.localStorage.setItem(LAST_SEEN_EVENT_ID_KEY, String(id));
  } catch {
    // Ignore quota / privacy-mode errors — we just lose replay precision.
  }
}

interface ReplayedEvent {
  id: number;
  ticket_id: string;
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<EventHandler>>();
  private globalHandlers = new Set<EventHandler>();
  private subscribedRooms = new Set<string>();
  private pendingRooms = new Set<string>();
  private reconnectDelay = MIN_RECONNECT_DELAY;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionalClose = false;
  private connected = false;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  // HB-47: high-water mark of the durable event log we have already
  // processed. Persisted to localStorage; updated as live events and
  // replayed events arrive. Compared to the server's welcome.latest_id
  // to decide whether to issue a resume request.
  private lastSeenEventId = readLastSeenEventId();

  get isConnected(): boolean {
    return this.connected;
  }

  /**
   * Open the WebSocket connection.
   */
  connect(): void {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.intentionalClose = false;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}/helpdesk/ws`;

    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.reconnectDelay = MIN_RECONNECT_DELAY;

      // Re-subscribe to all rooms we should be in
      for (const room of this.subscribedRooms) {
        this.sendSubscribe(room);
      }
      // Subscribe to any rooms queued while disconnected
      for (const room of this.pendingRooms) {
        this.subscribedRooms.add(room);
        this.sendSubscribe(room);
      }
      this.pendingRooms.clear();

      // Start ping interval to keep connection alive
      this.pingInterval = setInterval(() => {
        this.send({ type: 'ping' });
      }, 30000);
    };

    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as RealtimeEvent & {
          type: string;
          data?: Record<string, unknown>;
        };

        // Internal protocol messages
        if (data.type === 'connected' || data.type === 'subscribed' || data.type === 'unsubscribed' || data.type === 'pong') {
          return;
        }

        // HB-47: the server sends `welcome` immediately after auth with
        // the current high-water mark of the durable event log. If we're
        // behind, send a `resume` to replay what we missed.
        if (data.type === 'welcome') {
          const latestId = Number((data.data as { latest_id?: number } | undefined)?.latest_id ?? 0);
          if (Number.isFinite(latestId) && latestId > this.lastSeenEventId) {
            this.send({ type: 'resume', last_seen_id: this.lastSeenEventId });
          }
          return;
        }

        // HB-47: server's reply to `resume`. Replay each event through
        // the same dispatch path as live events so handlers (query cache
        // invalidation, message append) only need one code path.
        if (data.type === 'resume_complete' || data.type === 'resume_error') {
          if (data.type === 'resume_complete') {
            const payload = data.data as
              | { events?: ReplayedEvent[]; has_more?: boolean; latest_id?: number }
              | undefined;
            const events = payload?.events ?? [];
            for (const ev of events) {
              this.dispatchReplayedEvent(ev);
            }
            const newLatest = Number(payload?.latest_id ?? this.lastSeenEventId);
            if (Number.isFinite(newLatest) && newLatest > this.lastSeenEventId) {
              this.lastSeenEventId = newLatest;
              writeLastSeenEventId(newLatest);
            }
            // If there's more backlog, ask for the next batch immediately.
            if (payload?.has_more) {
              this.send({ type: 'resume', last_seen_id: this.lastSeenEventId });
            }
          }
          return;
        }

        // HB-47: track the event id on every live event we dispatch so
        // a later disconnect has an accurate high-water mark.
        const eventId = Number(
          (data.data as { event_id?: number } | undefined)?.event_id ?? 0,
        );
        if (Number.isFinite(eventId) && eventId > this.lastSeenEventId) {
          this.lastSeenEventId = eventId;
          writeLastSeenEventId(eventId);
        }

        // Dispatch to type-specific handlers
        const typeHandlers = this.handlers.get(data.type);
        if (typeHandlers) {
          for (const handler of typeHandlers) {
            try {
              handler(data);
            } catch (err) {
              console.error('[helpdesk-ws] Handler error:', err);
            }
          }
        }

        // Dispatch to global handlers
        for (const handler of this.globalHandlers) {
          try {
            handler(data);
          } catch (err) {
            console.error('[helpdesk-ws] Global handler error:', err);
          }
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.clearPingInterval();

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      // The close event will fire after this, which handles reconnection
    };
  }

  /**
   * Close the WebSocket connection intentionally (no reconnect).
   */
  disconnect(): void {
    this.intentionalClose = true;
    this.clearPingInterval();

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.connected = false;
    this.subscribedRooms.clear();
    this.pendingRooms.clear();
  }

  /**
   * Subscribe to a room (e.g., "ticket:{id}").
   */
  joinRoom(room: string): void {
    if (this.subscribedRooms.has(room)) return;

    if (this.connected) {
      this.subscribedRooms.add(room);
      this.sendSubscribe(room);
    } else {
      this.pendingRooms.add(room);
    }
  }

  /**
   * Unsubscribe from a room.
   */
  leaveRoom(room: string): void {
    this.subscribedRooms.delete(room);
    this.pendingRooms.delete(room);

    if (this.connected) {
      this.send({ type: 'unsubscribe', room });
    }
  }

  /**
   * Send a message through the WebSocket.
   */
  sendMessage(msg: object): void {
    this.send(msg);
  }

  /**
   * Register a handler for a specific event type (e.g., "ticket.message.created").
   * Returns an unsubscribe function.
   */
  on(eventType: string, handler: EventHandler): () => void {
    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler);

    return () => {
      set!.delete(handler);
      if (set!.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  /**
   * Register a handler for ALL events.
   * Returns an unsubscribe function.
   */
  onAny(handler: EventHandler): () => void {
    this.globalHandlers.add(handler);
    return () => {
      this.globalHandlers.delete(handler);
    };
  }

  // -- Internal --------------------------------------------

  /**
   * HB-47: translate a persisted event row into the same shape as a live
   * WebSocket event and dispatch it through the same handler chain. The
   * payload sent over the wire already carries `event_id`, so replayed
   * events are indistinguishable from live ones at the handler layer.
   */
  private dispatchReplayedEvent(ev: ReplayedEvent): void {
    const synthetic: RealtimeEvent & { type: string; data: Record<string, unknown> } = {
      type: ev.event_type,
      payload: ev.payload,
      data: { ...ev.payload, event_id: ev.id },
      room: `ticket:${ev.ticket_id}`,
      timestamp: ev.created_at,
    };

    const typeHandlers = this.handlers.get(ev.event_type);
    if (typeHandlers) {
      for (const handler of typeHandlers) {
        try {
          handler(synthetic);
        } catch (err) {
          console.error('[helpdesk-ws] Replay handler error:', err);
        }
      }
    }
    for (const handler of this.globalHandlers) {
      try {
        handler(synthetic);
      } catch (err) {
        console.error('[helpdesk-ws] Replay global handler error:', err);
      }
    }
  }

  private send(msg: object): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendSubscribe(room: string): void {
    this.send({ type: 'subscribe', room });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, this.reconnectDelay);

    this.reconnectDelay = Math.min(
      this.reconnectDelay * RECONNECT_MULTIPLIER,
      MAX_RECONNECT_DELAY,
    );
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

/** Singleton WebSocket manager for Helpdesk. */
export const ws = new WebSocketManager();
