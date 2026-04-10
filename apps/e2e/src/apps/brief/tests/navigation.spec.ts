import { test, expect } from '../../../fixtures/base.fixture';
import { BriefHomePage } from '../pages/home.page';
import { briefConfig } from '../brief.config';

test.describe('Brief — Navigation', () => {
  let homePage: BriefHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BriefHomePage(page, screenshots);
  });

  test('home page loads', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'home-loaded');
    await homePage.expectHomeLoaded();
    await screenshots.capture(page, 'home-content-visible');
  });

  test('navigate to documents list', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToDocuments();
    await screenshots.capture(page, 'documents-page');
    await homePage.expectPath('/documents');
    await screenshots.capture(page, 'documents-url-verified');
  });

  test('navigate to new document', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToNewDocument();
    await screenshots.capture(page, 'new-document-page');
    await homePage.expectPath('/new');
    await screenshots.capture(page, 'new-document-url-verified');
  });

  test('navigate to templates', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToTemplates();
    await screenshots.capture(page, 'templates-page');
    await homePage.expectPath('/templates');
    await screenshots.capture(page, 'templates-url-verified');
  });

  test('navigate to search', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToSearch();
    await screenshots.capture(page, 'search-page');
    await homePage.expectPath('/search');
    await screenshots.capture(page, 'search-url-verified');
  });

  test('navigate to starred', async ({ page, screenshots }) => {
    await homePage.goto();
    await homePage.navigateToStarred();
    await screenshots.capture(page, 'starred-page');
    await homePage.expectPath('/starred');
    await screenshots.capture(page, 'starred-url-verified');
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await homePage.goto();
    await screenshots.capture(page, 'start-at-home');

    await homePage.navigateToDocuments();
    await screenshots.capture(page, 'navigated-to-documents');

    await homePage.navigateToTemplates();
    await screenshots.capture(page, 'navigated-to-templates');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await homePage.expectPath('/documents');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await homePage.expectPath('/templates');
  });

  test('all configured pages without params are reachable', async ({ page, screenshots }) => {
    const simplePages = briefConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await homePage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });
});
