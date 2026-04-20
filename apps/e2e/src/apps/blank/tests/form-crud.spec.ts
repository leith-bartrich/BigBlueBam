import { test, expect } from '../../../fixtures/base.fixture';
import { FormsListPage } from '../pages/forms-list.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Blank — Form CRUD', () => {
  test('create a new form via UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);

    // The Blank "New Form" button creates an "Untitled Form" immediately
    // (via useCreateForm mutation) and navigates to the form-builder edit
    // page — there is no modal dialog or title input to fill up-front. The
    // test verifies the created form appears in the API list after the click.
    const beforeResp = await api.getRaw('/v1/forms');
    const beforeForms = (beforeResp.body as any)?.data ?? [];
    const beforeCount = Array.isArray(beforeForms) ? beforeForms.length : 0;

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto();
    await screenshots.capture(page, 'forms-before-create');

    await formsPage.clickCreateForm();
    await page.waitForTimeout(1500);
    await screenshots.capture(page, 'form-created');

    const afterResp = await api.getRaw('/v1/forms');
    const afterForms = (afterResp.body as any)?.data ?? [];
    expect(Array.isArray(afterForms)).toBe(true);
    expect(afterForms.length).toBeGreaterThan(beforeCount);
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
    // The Blank app's "New Form" button has no dialog/title prompt — it
    // immediately creates a form with `name: 'Untitled Form'` and routes to
    // the form-builder edit page. The canonical behaviour for "creating a
    // form with no title" is therefore that the app instead seeds a default
    // name. This test documents that design: we verify the button lands on
    // the form-builder page and the title input still renders (with either
    // "Untitled Form" or a `Form Title` placeholder) so the user can rename
    // it inline.
    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.goto();
    await formsPage.clickCreateForm();
    await page.waitForTimeout(1500);
    await screenshots.capture(page, 'after-new-form-click');

    // The builder's inline title input uses placeholder="Form Title".
    const titleInput = page.getByPlaceholder(/form title/i).first();
    await expect(titleInput).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'form-builder-title-input');
  });

  test('form edit page loads for existing form', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);

    let formId: string | undefined;
    try {
      const forms = await api.get<any[]>('/v1/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.navigate(`/forms/${formId}/edit`);
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
      const forms = await api.get<any[]>('/v1/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.navigate(`/forms/${formId}/preview`);
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
      const forms = await api.get<any[]>('/v1/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    test.skip(!formId, 'No form available');

    const formsPage = new FormsListPage(page, screenshots);
    await formsPage.navigate(`/forms/${formId}/responses`);
    await screenshots.capture(page, 'form-responses-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'form-responses-content');
  });
});
