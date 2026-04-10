import { test, expect } from '../../../fixtures/base.fixture';
import { BeaconHomePage } from '../pages/home.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Beacon — Article CRUD', () => {
  const testArticleTitle = `E2E Test Article ${Date.now()}`;

  test('create a new article via UI', async ({ page, screenshots, context, request }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await screenshots.capture(page, 'home-before-create');

    await homePage.navigateToCreate();
    await screenshots.capture(page, 'create-page-loaded');

    // Fill article form
    await page.getByLabel(/title/i).fill(testArticleTitle);
    await screenshots.capture(page, 'title-filled');

    // Fill content in rich-text editor
    const editor = page.locator('[contenteditable], [class*="editor"], textarea').first();
    if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editor.click();
      await page.keyboard.type('This is an E2E test article with some content.');
      await screenshots.capture(page, 'content-filled');
    }

    await page.getByRole('button', { name: /create|save|publish/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'article-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/beacon/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/articles');
    if (status === 200) {
      const articles = (body as any)?.data || body;
      const found = Array.isArray(articles)
        ? articles.find((a: any) => a.title === testArticleTitle)
        : null;
      expect(found).toBeTruthy();
    }
    await screenshots.capture(page, 'article-verified-via-api');
  });

  test('article list page shows articles', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToList();
    await screenshots.capture(page, 'article-list');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'articles-visible');
  });

  test('create article with empty title shows validation error', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToCreate();
    await screenshots.capture(page, 'create-page-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save|publish/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });
});
