import type { Page, WebSocket as PlaywrightWebSocket } from '@playwright/test';

export interface WsMessage {
  type: string;
  data: unknown;
  raw: string;
  timestamp: number;
}

/**
 * Wait for a WebSocket connection to be established.
 */
export async function waitForWsConnection(
  page: Page,
  wsPathContains: string,
  timeout = 10_000,
): Promise<PlaywrightWebSocket> {
  return page.waitForEvent('websocket', {
    predicate: (ws) => ws.url().includes(wsPathContains),
    timeout,
  });
}

/**
 * Wait for a specific WebSocket message.
 */
export async function waitForWsMessage(
  ws: PlaywrightWebSocket,
  messageType: string,
  timeout = 10_000,
): Promise<WsMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Timed out waiting for WS message of type "${messageType}"`));
    }, timeout);

    ws.on('framereceived', (frame) => {
      try {
        const data = JSON.parse(frame.payload.toString());
        if (data.type === messageType || data.event === messageType) {
          clearTimeout(timer);
          resolve({
            type: data.type || data.event,
            data,
            raw: frame.payload.toString(),
            timestamp: Date.now(),
          });
        }
      } catch {
        // Not JSON, skip
      }
    });
  });
}

/**
 * Collect all WebSocket messages for a duration.
 */
export async function collectWsMessages(
  ws: PlaywrightWebSocket,
  durationMs: number,
): Promise<WsMessage[]> {
  const messages: WsMessage[] = [];

  const handler = (frame: { payload: string | Buffer }) => {
    try {
      const data = JSON.parse(frame.payload.toString());
      messages.push({
        type: data.type || data.event || 'unknown',
        data,
        raw: frame.payload.toString(),
        timestamp: Date.now(),
      });
    } catch {
      // Not JSON
    }
  };

  ws.on('framereceived', handler);
  await new Promise((r) => setTimeout(r, durationMs));
  ws.off('framereceived', handler);

  return messages;
}

/**
 * Test real-time updates between two browser contexts.
 * Opens the same URL in both contexts, performs an action in one,
 * and verifies the update appears in the other.
 */
export async function testRealtimeSync(
  page1: Page,
  page2: Page,
  options: {
    wsPathContains: string;
    performAction: (page: Page) => Promise<void>;
    verifyUpdate: (page: Page) => Promise<void>;
    timeout?: number;
  },
): Promise<void> {
  // Wait for WS connections on both pages
  await Promise.all([
    waitForWsConnection(page1, options.wsPathContains).catch(() => null),
    waitForWsConnection(page2, options.wsPathContains).catch(() => null),
  ]);

  // Perform action on page1
  await options.performAction(page1);

  // Verify update appears on page2
  await page2.waitForTimeout(1000);
  await options.verifyUpdate(page2);
}
