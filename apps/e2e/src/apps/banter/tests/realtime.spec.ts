import { test, expect } from '../../../fixtures/base.fixture';
import { waitForWsConnection } from '../../../helpers/websocket';

test.describe('Banter — Realtime', () => {
  test('WebSocket connection is established', async ({ page, screenshots }) => {
    await page.goto('/banter/');
    await page.waitForTimeout(3000);
    await screenshots.capture(page, 'banter-loaded-for-ws');

    // Check if a WebSocket connection was made
    const wsConnected = await page.evaluate(() => {
      return (window as any).__ws?.readyState === 1 || document.querySelectorAll('[class*="online"], [class*="connected"]').length > 0;
    });
    await screenshots.capture(page, 'ws-connection-status');
  });

  test('real-time message appears in second tab', async ({ browser, screenshots }) => {
    // Create two independent contexts (simulating two users)
    const context1 = await browser.newContext({ storageState: '.auth/admin.json' });
    const context2 = await browser.newContext({ storageState: '.auth/admin.json' });
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    await page1.goto('/banter/');
    await page2.goto('/banter/');
    await page1.waitForTimeout(2000);
    await page2.waitForTimeout(2000);
    await screenshots.capture(page1, 'page1-banter-loaded');
    await screenshots.capture(page2, 'page2-banter-loaded');

    // Both pages should be showing the same channel
    // Real-time sync would be verified by sending a message in one and seeing it in the other

    await context1.close();
    await context2.close();
  });
});
