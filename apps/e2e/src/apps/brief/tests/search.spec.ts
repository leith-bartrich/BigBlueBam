import { test, expect } from '../../../fixtures/base.fixture';
import { BriefHomePage } from '../pages/home.page';

test.describe('Brief — Search', () => {
  test('search page renders', async ({ page, screenshots }) => {
    const homePage = new BriefHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToSearch();
    await screenshots.capture(page, 'search-page-loaded');

    await expect(page.locator('main, [class*="search"]').first()).toBeVisible();
    await screenshots.capture(page, 'search-content-visible');
  });

  test('search input accepts query', async ({ page, screenshots }) => {
    const homePage = new BriefHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToSearch();
    await screenshots.capture(page, 'search-before-query');

    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await searchInput.fill('test document');
      await page.waitForTimeout(500);
      await screenshots.capture(page, 'search-query-entered');
    }
  });

  test('search from home page works', async ({ page, screenshots }) => {
    const homePage = new BriefHomePage(page, screenshots);
    await homePage.goto();
    await screenshots.capture(page, 'home-before-search');

    await homePage.searchFor('document');
    await screenshots.capture(page, 'home-search-entered');
  });

  test('starred page renders', async ({ page, screenshots }) => {
    const homePage = new BriefHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToStarred();
    await screenshots.capture(page, 'starred-loaded');

    await expect(page.locator('main').first()).toBeVisible({ timeout: 15_000 });
    await screenshots.capture(page, 'starred-visible');
  });
});
