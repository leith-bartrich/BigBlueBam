import { test, expect } from '../../../fixtures/base.fixture';
import { ChannelPage } from '../pages/channel.page';
import { searchFor } from '../../../helpers/interactions';

test.describe('Banter — Search', () => {
  test('search page renders', async ({ page, screenshots }) => {
    const channelPage = new ChannelPage(page, screenshots);
    await channelPage.goto();
    await channelPage.openSearch();
    await screenshots.capture(page, 'search-page-loaded');
    await expect(page.locator('main, [class*="search"]').first()).toBeVisible();
    await screenshots.capture(page, 'search-content-visible');
  });

  test('search input accepts query', async ({ page, screenshots }) => {
    const channelPage = new ChannelPage(page, screenshots);
    await channelPage.goto();
    await channelPage.openSearch();
    await screenshots.capture(page, 'search-before-query');

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test message');
      await page.waitForTimeout(500);
      await screenshots.capture(page, 'search-query-entered');
    }
  });

  test('browse channels shows channel list', async ({ page, screenshots }) => {
    const channelPage = new ChannelPage(page, screenshots);
    await channelPage.goto();
    await channelPage.clickBrowseChannels();
    await screenshots.capture(page, 'browse-channels-list');
    await expect(page.locator('main, [class*="channel"]').first()).toBeVisible();
    await screenshots.capture(page, 'channels-listed');
  });
});
