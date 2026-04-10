import { test, expect } from '../../../fixtures/base.fixture';
import { BeaconHomePage } from '../pages/home.page';
import { beaconConfig } from '../beacon.config';

test.describe('Beacon — Navigation', () => {
  let homePage: BeaconHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BeaconHomePage(page, screenshots);
  });

  test('home page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'beacon-home-loaded');
    await homePage.expectHomeLoaded();
    await screenshots.capture(page, 'beacon-content-visible');
  });

  test('navigate to list page', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToList();
    await screenshots.capture(page, 'list-page');
    await homePage.expectPath('/list');
    await screenshots.capture(page, 'list-url-verified');
  });

  test('navigate to search page', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToSearch();
    await screenshots.capture(page, 'search-page');
    await homePage.expectPath('/search');
    await screenshots.capture(page, 'search-url-verified');
  });

  test('navigate to create page', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToCreate();
    await screenshots.capture(page, 'create-page');
    await homePage.expectPath('/create');
    await screenshots.capture(page, 'create-url-verified');
  });

  test('navigate to graph explorer', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToGraph();
    await screenshots.capture(page, 'graph-page');
    await homePage.expectPath('/graph');
    await screenshots.capture(page, 'graph-url-verified');
  });

  test('navigate to dashboard', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToDashboard();
    await screenshots.capture(page, 'dashboard-page');
    await homePage.expectPath('/dashboard');
    await screenshots.capture(page, 'dashboard-url-verified');
  });

  test('navigate to settings', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToSettings();
    await screenshots.capture(page, 'settings-page');
    await homePage.expectPath('/settings');
    await screenshots.capture(page, 'settings-url-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = beaconConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await homePage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigate('/list');
    await homePage.navigate('/search');
    await screenshots.capture(page, 'at-search');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-list');
    await homePage.expectPath('/list');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-search');
    await homePage.expectPath('/search');
  });
});
