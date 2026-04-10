import { test, expect } from '../../../fixtures/base.fixture';
import { FormsListPage } from '../pages/forms-list.page';
import { blankConfig } from '../blank.config';

test.describe('Blank — Navigation', () => {
  let formsPage: FormsListPage;

  test.beforeEach(async ({ page, screenshots }) => {
    formsPage = new FormsListPage(page, screenshots);
  });

  test('forms list page loads after login', async ({ page, screenshots }) => {
    await formsPage.goto();
    await screenshots.capture(page, 'forms-list-loaded');
    await formsPage.expectFormsListLoaded();
    await screenshots.capture(page, 'forms-list-content-visible');
  });

  test('navigate to New Form', async ({ page, screenshots }) => {
    await formsPage.goto();
    await formsPage.navigateToNewForm();
    await screenshots.capture(page, 'new-form-page');
    await formsPage.expectPath('/forms/new');
    await screenshots.capture(page, 'new-form-url-verified');
  });

  test('navigate to Settings', async ({ page, screenshots }) => {
    await formsPage.goto();
    await formsPage.navigateToSettings();
    await screenshots.capture(page, 'settings-page');
    await formsPage.expectPath('/settings');
    await screenshots.capture(page, 'settings-url-verified');
  });

  test('deep link to form edit page', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = (await import('../../../auth/auth.helper')).readCsrfTokenFromCookies(cookies);
    const { DirectApiClient } = await import('../../../api/api-client');
    const api = new DirectApiClient(request, '/blank/api', csrf || undefined);

    let formId: string | undefined;
    try {
      const forms = await api.get<any[]>('/forms');
      if (forms.length > 0) formId = forms[0].id;
    } catch {}

    if (formId) {
      await page.goto(`/blank/forms/${formId}/edit`);
      await formsPage.waitForAppReady();
      await screenshots.capture(page, 'deep-link-form-edit');
      await expect(page.locator('main')).toBeVisible();
      await screenshots.capture(page, 'form-edit-content-visible');
    }
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = blankConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await formsPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await formsPage.goto();
    await screenshots.capture(page, 'start-at-forms-list');

    await formsPage.navigate('/forms/new');
    await screenshots.capture(page, 'navigated-to-new-form');

    await formsPage.navigate('/settings');
    await screenshots.capture(page, 'navigated-to-settings');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await formsPage.expectPath('/forms/new');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await formsPage.expectPath('/settings');
  });
});
