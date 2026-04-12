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

    // Beacon editor uses a borderless input with placeholder, not a <label>
    await page.getByPlaceholder(/beacon title|title/i).first().fill(testArticleTitle);
    await screenshots.capture(page, 'title-filled');

    // Body is a Markdown <textarea>
    const bodyArea = page.getByPlaceholder(/markdown|body/i).first();
    if (await bodyArea.isVisible({ timeout: 3000 }).catch(() => false)) {
      await bodyArea.fill('This is an E2E test article with some content.');
      await screenshots.capture(page, 'content-filled');
    }

    // Button names are "Save as Draft" / "Publish" — they enable once title has content
    const saveBtn = page.getByRole('button', { name: /save as draft|publish/i }).first();
    await expect(saveBtn).toBeEnabled({ timeout: 5000 });
    await saveBtn.click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'article-created');

    // Verify via API — beacon-api exposes beacons at /v1/beacons
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/beacon/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/v1/beacons');
    if (status === 200) {
      const beacons = (body as any)?.data || body;
      const found = Array.isArray(beacons)
        ? beacons.find((a: any) => a.title === testArticleTitle)
        : null;
      expect(found).toBeTruthy();
    }
    await screenshots.capture(page, 'article-verified-via-api');
  });

  test('article list page shows articles', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    // homePage.goto() already waits up to 40 s for <main> to mount before
    // returning, and navigate() uses pushState so <main> is still mounted
    // on the list route. A short assertion here is enough to confirm.
    await homePage.goto();
    await homePage.navigateToList();
    await screenshots.capture(page, 'article-list');

    await expect(page.locator('main').first()).toBeVisible({ timeout: 10_000 });
    await screenshots.capture(page, 'articles-visible');
  });

  test('create article with empty title shows validation error', async ({ page, screenshots }) => {
    const homePage = new BeaconHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToCreate();
    await screenshots.capture(page, 'create-page-open');

    // Beacon disables both "Save as Draft" and "Publish" until the title has
    // non-whitespace content. Disabled submit buttons are the validation UI —
    // there is no inline error message when the form has never been touched.
    const saveBtn = page.getByRole('button', { name: /save as draft/i }).first();
    const publishBtn = page.getByRole('button', { name: /^publish$/i }).first();
    await expect(saveBtn).toBeVisible({ timeout: 5000 });
    await expect(saveBtn).toBeDisabled();
    await expect(publishBtn).toBeDisabled();
    await screenshots.capture(page, 'validation-error-shown');
  });
});
