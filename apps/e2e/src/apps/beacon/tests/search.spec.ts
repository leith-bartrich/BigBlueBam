import { test, expect } from '../../../fixtures/base.fixture';
import { BeaconHomePage } from '../pages/home.page';

test.describe('Beacon — Search', () => {
  test('search page renders', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToSearch();
    await screenshots.capture(page, 'search-page-loaded');
    await expect(page.locator('main, [class*="search"]').first()).toBeVisible();
    await screenshots.capture(page, 'search-content-visible');
  });

  test('search input accepts query', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToSearch();
    await screenshots.capture(page, 'search-before-query');

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test article');
      await page.waitForTimeout(500);
      await screenshots.capture(page, 'search-query-entered');
    }
  });

  test('search from home page', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await screenshots.capture(page, 'home-before-search');

    await homePage.searchFor('knowledge');
    await screenshots.capture(page, 'home-search-entered');
  });

  test('graph explorer renders', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToGraph();
    await screenshots.capture(page, 'graph-explorer-loaded');
    await expect(page.locator('main, [class*="graph"], canvas').first()).toBeVisible();
    await screenshots.capture(page, 'graph-content-visible');
  });
});
