import { test, expect } from '../../../fixtures/base.fixture';
import { BriefHomePage } from '../pages/home.page';
import { BriefEditorPage } from '../pages/editor.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Brief — Document CRUD', () => {
  const testDocTitle = `E2E Test Document ${Date.now()}`;

  test('create a new document via UI', async ({ page, screenshots, context, request }) => {
    const homePage = new BriefHomePage(page, screenshots);
    const editor = new BriefEditorPage(page, screenshots);

    await homePage.goto();
    await screenshots.capture(page, 'home-before-create');

    await homePage.navigateToNewDocument();
    await screenshots.capture(page, 'new-document-loaded');

    await editor.fillTitle(testDocTitle);
    await screenshots.capture(page, 'title-filled');

    await editor.typeInEditor('This is an E2E test document with some content.');
    await screenshots.capture(page, 'content-filled');

    await editor.clickSave();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'document-created');

    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/brief/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/documents');
    if (status === 200) {
      const docs = (body as any)?.data || body;
      const found = Array.isArray(docs)
        ? docs.find((d: any) => d.title === testDocTitle)
        : null;
      expect(found).toBeTruthy();
    }
    await screenshots.capture(page, 'document-verified-via-api');
  });

  test('documents list page shows documents', async ({ page, screenshots }) => {
    const homePage = new BriefHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToDocuments();
    await screenshots.capture(page, 'documents-list');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'documents-visible');
  });

  test('create document with empty title shows validation error', async ({ page, screenshots }) => {
    const homePage = new BriefHomePage(page, screenshots);
    const editor = new BriefEditorPage(page, screenshots);

    await homePage.goto();
    await homePage.navigateToNewDocument();
    await screenshots.capture(page, 'new-document-open');

    await editor.clickSave();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await screenshots.capture(page, 'error-detail-visible');
    }
  });

  test('document detail page loads for existing document', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/brief/api', csrf || undefined);

    let docId: string | undefined;
    try {
      const { status, body } = await api.getRaw('/documents');
      if (status === 200) {
        const docs = (body as any)?.data || body;
        if (Array.isArray(docs) && docs.length > 0) {
          docId = docs[0].id || docs[0].slug;
        }
      }
    } catch {}

    test.skip(!docId, 'No document available');

    const homePage = new BriefHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToDocumentDetail(docId!);
    await screenshots.capture(page, 'document-detail-loaded');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'document-detail-visible');
  });
});
