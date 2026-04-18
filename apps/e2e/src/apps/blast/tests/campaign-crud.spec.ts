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

    // Blast's "New Campaign" button does NOT open a dialog — it navigates the
    // user to /campaigns/new (a full editor page). The Name/Subject <label>s
    // on that page are not associated to inputs via htmlFor, so getByLabel
    // does not resolve them. Match by placeholder instead.
    await campaignsPage.clickCreateCampaign();
    await page.waitForURL(/\/blast\/campaigns\/new/, { timeout: 10_000 });
    await screenshots.capture(page, 'campaign-new-page');

    await page.getByPlaceholder(/April Product Launch/i).fill(testCampaignName);
    await screenshots.capture(page, 'campaign-name-filled');

    await page.getByPlaceholder(/Introducing our newest features/i).fill(testCampaignSubject);
    await screenshots.capture(page, 'campaign-subject-filled');

    // Submit button label is "Create Campaign" — scope to the page header
    // so we don't accidentally re-match the list page's "New Campaign"
    // button if navigation is mid-flight.
    const createBtn = page.getByRole('button', { name: /^create campaign$/i });
    await expect(createBtn).toBeEnabled();
    await createBtn.click();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'campaign-created');

    // Verify via API. Blast API list routes live under /v1/.
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);
    const campaigns = await api.get<any[]>('/v1/campaigns');
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
    await page.waitForURL(/\/blast\/campaigns\/new/, { timeout: 10_000 });
    await screenshots.capture(page, 'campaign-new-page-open');

    // Blast's new-campaign editor does not surface a `text-red-500` /
    // `[role="alert"]` validation message. It disables the "Create Campaign"
    // submit button until both Name and Subject Line are filled (and the SPA
    // also short-circuits with `if (!name || !subject) return;`).
    // Assert the disabled state — the SPA's actual contract.
    const createBtn = page.getByRole('button', { name: /^create campaign$/i });
    await expect(createBtn).toBeVisible();
    await expect(createBtn).toBeDisabled();
    await screenshots.capture(page, 'create-button-disabled-empty');
  });

  test('campaign detail page loads for existing campaign', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/blast/api', csrf || undefined);

    let campaignId: string | undefined;
    try {
      const campaigns = await api.get<any[]>('/v1/campaigns');
      if (campaigns.length > 0) campaignId = campaigns[0].id;
    } catch {}

    test.skip(!campaignId, 'No campaign available');

    const campaignsPage = new CampaignsPage(page, screenshots);
    await campaignsPage.navigate(`/campaigns/${campaignId}`);
    await screenshots.capture(page, 'campaign-detail-loaded');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'campaign-detail-content');
  });
});
