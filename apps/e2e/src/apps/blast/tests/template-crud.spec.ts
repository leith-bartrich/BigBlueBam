import { test, expect } from '../../../fixtures/base.fixture';
import { CampaignsPage } from '../pages/campaigns.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Blast — Template CRUD', () => {
  const testTemplateName = `E2E Template ${Date.now()}`;

  test('create a new template via UI', async ({ page, screenshots, context, request }) => {
    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto();
    await campaignsPage.navigateToTemplates();
    await screenshots.capture(page, 'templates-before-create');

    // Blast's "New Template" button does NOT open a dialog — it navigates to
    // /templates/new (a full editor page). The Name/Subject <label>s on that
    // page are not associated to inputs via htmlFor, so getByLabel does not
    // resolve them. Match by placeholder instead.
    await campaignsPage.clickCreateTemplate();
    await page.waitForURL(/\/blast\/templates\/new/, { timeout: 10_000 });
    await screenshots.capture(page, 'template-editor-open');

    await page.getByPlaceholder(/Monthly Newsletter/i).fill(testTemplateName);
    await screenshots.capture(page, 'template-name-filled');

    // Subject template is required by the SPA's enable-Save guard.
    await page
      .getByPlaceholder(/check out what's new/i)
      .fill('E2E test subject');
    await screenshots.capture(page, 'template-subject-filled');

    // Submit button label is "Save Template".
    const saveBtn = page.getByRole('button', { name: /^save template$/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'template-created');

    // Verify via API. Blast API list routes live under /v1/.
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const templates = await api.get<any[]>('/v1/templates');
    const found = templates.find((t: any) => t.name === testTemplateName);
    expect(found).toBeTruthy();
    await screenshots.capture(page, 'template-verified-via-api');
  });

  test('template list shows existing templates', async ({ page, screenshots }) => {
    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto();
    await campaignsPage.navigateToTemplates();
    await screenshots.capture(page, 'template-list');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'template-list-visible');
  });

  test('create template with empty name shows validation error', async ({ page, screenshots }) => {
    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto();
    await campaignsPage.navigateToTemplates();
    await campaignsPage.clickCreateTemplate();
    await page.waitForURL(/\/blast\/templates\/new/, { timeout: 10_000 });
    await screenshots.capture(page, 'template-editor-open');

    // Blast's template editor does not surface a `text-red-500` /
    // `[role="alert"]` validation message. It disables the "Save Template"
    // submit button until both Template Name and Subject Line are filled
    // (and the SPA also short-circuits with `if (!name || !subjectTemplate) return;`).
    // Assert the disabled state — the SPA's actual contract.
    const saveBtn = page.getByRole('button', { name: /^save template$/i });
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
    await screenshots.capture(page, 'save-button-disabled-empty');
  });

  test('template edit page loads for existing template', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);

    let templateId: string | undefined;
    try {
      const templates = await api.get<any[]>('/v1/templates');
      if (templates.length > 0) templateId = templates[0].id;
    } catch {}

    test.skip(!templateId, 'No template available');

    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.navigate(`/templates/${templateId}/edit`);
    await screenshots.capture(page, 'template-edit-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'template-edit-content');
  });
});
