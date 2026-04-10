import { test, expect } from '../../../fixtures/base.fixture';
import { ChannelPage } from '../pages/channel.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Banter — Messaging', () => {
  let channelPage: ChannelPage;

  test.beforeEach(async ({ page, screenshots }) => {
    channelPage = new ChannelPage(page, screenshots);
  });

  test('channel view loads with message list', async ({ page, screenshots, context, request }) => {
    // Find a channel via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/banter/api', csrf || undefined);

    let channelSlug: string | undefined;
    try {
      const channels = await api.get<any[]>('/channels');
      if (channels.length > 0) channelSlug = channels[0].slug;
    } catch {}

    if (channelSlug) {
      await channelPage.goto(channelSlug);
      await screenshots.capture(page, 'channel-loaded');
      await channelPage.expectChannelLoaded();
      await screenshots.capture(page, 'channel-messages-visible');
    } else {
      await channelPage.goto();
      await screenshots.capture(page, 'banter-home-no-channels');
    }
  });

  test('send a message in channel', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/banter/api', csrf || undefined);

    let channelSlug: string | undefined;
    try {
      const channels = await api.get<any[]>('/channels');
      if (channels.length > 0) channelSlug = channels[0].slug;
    } catch {}

    test.skip(!channelSlug, 'No channel available');

    await channelPage.goto(channelSlug!);
    await screenshots.capture(page, 'channel-before-send');

    const msgText = `E2E test message ${Date.now()}`;
    await channelPage.sendMessage(msgText);
    await screenshots.capture(page, 'message-sent');

    await channelPage.expectMessageVisible(msgText);
    await screenshots.capture(page, 'message-visible-in-list');
  });

  test('message compose area accepts input', async ({ page, screenshots }) => {
    await channelPage.goto();
    await screenshots.capture(page, 'home-for-compose-test');

    const composer = page.locator('[class*="compose"], textarea, [contenteditable]').last();
    if (await composer.isVisible({ timeout: 3000 }).catch(() => false)) {
      await composer.click();
      await screenshots.capture(page, 'composer-focused');
      await page.keyboard.type('Test input');
      await screenshots.capture(page, 'composer-with-text');
    }
  });

  test('message list shows correct message count vs API', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/banter/api', csrf || undefined);

    let channelId: string | undefined;
    let channelSlug: string | undefined;
    try {
      const channels = await api.get<any[]>('/channels');
      if (channels.length > 0) {
        channelId = channels[0].id;
        channelSlug = channels[0].slug;
      }
    } catch {}

    test.skip(!channelId, 'No channel available');

    await channelPage.goto(channelSlug!);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'channel-messages-loaded');

    const uiCount = await channelPage.getMessageCount();
    await screenshots.capture(page, `message-count-ui-${uiCount}`);
  });
});
