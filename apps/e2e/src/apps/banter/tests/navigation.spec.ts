import { test, expect } from '../../../fixtures/base.fixture';
import { ChannelPage } from '../pages/channel.page';
import { banterConfig } from '../banter.config';

test.describe('Banter — Navigation', () => {
  let channelPage: ChannelPage;

  test.beforeEach(async ({ page, screenshots }) => {
    channelPage = new ChannelPage(page, screenshots);
  });

  test('home page loads', async ({ page, screenshots }) => {
    await channelPage.goto();
    await screenshots.capture(page, 'banter-home-loaded');
    await channelPage.expectChannelLoaded();
    await screenshots.capture(page, 'banter-content-visible');
  });

  test('browse channels page loads', async ({ page, screenshots }) => {
    await channelPage.goto();
    await channelPage.clickBrowseChannels();
    await screenshots.capture(page, 'browse-channels');
    await channelPage.expectPath('/browse');
    await screenshots.capture(page, 'browse-verified');
  });

  test('search page loads', async ({ page, screenshots }) => {
    await channelPage.goto();
    await channelPage.openSearch();
    await screenshots.capture(page, 'search-page');
    await channelPage.expectPath('/search');
  });

  test('bookmarks page loads', async ({ page, screenshots }) => {
    await channelPage.goto();
    await channelPage.openBookmarks();
    await screenshots.capture(page, 'bookmarks-page');
    await channelPage.expectPath('/bookmarks');
  });

  test('settings page loads', async ({ page, screenshots }) => {
    await channelPage.goto();
    await channelPage.openSettings();
    await screenshots.capture(page, 'settings-page');
    await channelPage.expectPath('/settings');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = banterConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await channelPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await channelPage.goto();
    await channelPage.navigate('/browse');
    await channelPage.navigate('/search');
    await screenshots.capture(page, 'at-search');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-browse');
    await channelPage.expectPath('/browse');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-search');
    await channelPage.expectPath('/search');
  });
});
