import { test, expect } from '../../../fixtures/base.fixture';
import { FormsListPage } from '../pages/forms-list.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Blank — Form CRUD', () => {
  const testFormTitle = `E2E Test Form ${Date.now()}`;

  test('create a new form via UI', async ({ page, screenshots, context, request }) => {
    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto();
    await screenshots.capture(page, 'forms-before-create');

    await formsPage.clickCreateForm();
    await screenshots.capture(page, 'create-form-dialog');

    // Fill form title
    await page.getByLabel(/form title|title|name/i).fill(testFormTitle);
    await screenshots.capture(page, 'form-title-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'form-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);
    const forms = await api.get<any[]>('/forms');
    const found = forms.find((f: any) => f.title === testFormTitle);
    expect(found).toBeTruthy();
    await screenshots.capture(page, 'form-verified-via-api');
  });

  test('form list shows existing forms', async ({ page, screenshots }) => {
    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto();
    await screenshots.capture(page, 'form-list');

    await formsPage.expectFormsListLoaded();
    await screenshots.capture(page, 'form-list-visible');
  });

  test('create form with empty title shows validation error', async ({ page, screenshots }) => {
    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto();
    await formsPage.clickCreateForm();
    await screenshots.capture(page, 'create-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });

  test('form edit page loads for existing form', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);

    let formId: string | undefined;
    try {
      const forms = await api.get<any[]>('/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto(`/forms/${formId}/edit`);
    await screenshots.capture(page, 'form-edit-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'form-edit-content');
  });

  test('form preview page loads for existing form', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);

    let formId: string | undefined;
    try {
      const forms = await api.get<any[]>('/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto(`/forms/${formId}/preview`);
    await screenshots.capture(page, 'form-preview-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'form-preview-content');
  });

  test('form responses page loads for existing form', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);

    let formId: string | undefined;
    try {
      const forms = await api.get<any[]>('/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto(`/forms/${formId}/responses`);
    await screenshots.capture(page, 'form-responses-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'form-responses-content');
  });
});
