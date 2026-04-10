import { test, expect } from '../../../fixtures/base.fixture';
import { CampaignsPage } from '../pages/campaigns.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Blast — Campaign CRUD', () => {
  const testCampaignName = `E2E Campaign ${Date.now()}`;
  const testCampaignSubject = `E2E Subject ${Date.now()}`;

  test('create a new campaign via UI', async ({ page, screenshots, context, request }) => {
    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto();
    await screenshots.capture(page, 'campaigns-before-create');

    await campaignsPage.clickCreateCampaign();
    await screenshots.capture(page, 'create-campaign-dialog');

    // Fill campaign form
    await page.getByLabel(/campaign name|name/i).fill(testCampaignName);
    await screenshots.capture(page, 'campaign-name-filled');

    await page.getByLabel(/subject/i).fill(testCampaignSubject);
    await screenshots.capture(page, 'campaign-subject-filled');

    await page.getByRole('button', { name: /create|save/i }).click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'campaign-created');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const campaigns = await api.get<any[]>('/campaigns');
    const found = campaigns.find((c: any) => c.name === testCampaignName);
    expect(found).toBeTruthy();
    await screenshots.capture(page, 'campaign-verified-via-api');
  });

  test('campaign list shows existing campaigns', async ({ page, screenshots }) => {
    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto();
    await screenshots.capture(page, 'campaign-list');

    await campaignsPage.expectCampaignsLoaded();
    await screenshots.capture(page, 'campaign-list-visible');
  });

  test('create campaign with missing required fields shows validation error', async ({ page, screenshots }) => {
    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto();
    await campaignsPage.clickCreateCampaign();
    await screenshots.capture(page, 'create-dialog-open');

    // Submit without filling required fields
    await page.getByRole('button', { name: /create|save/i }).click();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });

  test('campaign detail page loads for existing campaign', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);

    let campaignId: string | undefined;
    try {
      const campaigns = await api.get<any[]>('/campaigns');
      if (campaigns.length > 0) campaignId = campaigns[0].id;
    } catch {}

    test.skip(!campaignId, 'No campaign available');

    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.goto(`/campaigns/${campaignId}`);
    await screenshots.capture(page, 'campaign-detail-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'campaign-detail-content');
  });
});
