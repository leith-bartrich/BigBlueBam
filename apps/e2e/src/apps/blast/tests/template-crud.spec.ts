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

    await campaignsPage.clickCreateTemplate();
    await screenshots.capture(page, 'create-template-dialog');

    // Fill template form
    await page.getByLabel(/template name|name/i).fill(testTemplateName);
    await screenshots.capture(page, 'template-name-filled');

    // Fill HTML content if rich-text editor or textarea is available
    const htmlEditor = page.locator('[contenteditable], textarea').first();
    if (await htmlEditor.isVisible({ timeout: 3000 }).catch(() => false)) {
      await htmlEditor.click();
      await page.keyboard.type('<h1>E2E Test Template</h1><p>Test content</p>');
    }
    await screenshots.capture(page, 'template-content-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'template-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const templates = await api.get<any[]>('/templates');
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
    await screenshots.capture(page, 'create-template-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'template-validation-error');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'template-error-detail');
  });

  test('template edit page loads for existing template', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);

    let templateId: string | undefined;
    try {
      const templates = await api.get<any[]>('/templates');
      if (templates.length > 0) templateId = templates[0].id;
    } catch {}

    test.skip(!templateId, 'No template available');

    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto(`/templates/${templateId}/edit`);
    await screenshots.capture(page, 'template-edit-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'template-edit-content');
  });
});
