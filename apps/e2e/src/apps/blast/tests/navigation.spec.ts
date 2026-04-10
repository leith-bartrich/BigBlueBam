import { test, expect } from '../../../fixtures/base.fixture';
import { CampaignsPage } from '../pages/campaigns.page';
import { blastConfig } from '../blast.config';

test.describe('Blast — Navigation', () => {
  let campaignsPage: CampaignsPage;

  test.beforeEach(async ({ page, screenshots }) => {
    campaignsPage = new CampaignsPage(page, screenshots);
  });

  test('campaigns page loads after login', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await screenshots.capture(page, 'campaigns-loaded');
    await campaignsPage.expectCampaignsLoaded();
    await screenshots.capture(page, 'campaigns-content-visible');
  });

  test('navigate to Templates', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToTemplates();
    await screenshots.capture(page, 'templates-page');
    await campaignsPage.expectPath('/templates');
    await screenshots.capture(page, 'templates-url-verified');
  });

  test('navigate to New Template', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToNewTemplate();
    await screenshots.capture(page, 'new-template-page');
    await campaignsPage.expectPath('/templates/new');
    await screenshots.capture(page, 'new-template-url-verified');
  });

  test('navigate to Segments', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToSegments();
    await screenshots.capture(page, 'segments-page');
    await campaignsPage.expectPath('/segments');
    await screenshots.capture(page, 'segments-url-verified');
  });

  test('navigate to New Segment', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToNewSegment();
    await screenshots.capture(page, 'new-segment-page');
    await campaignsPage.expectPath('/segments/new');
    await screenshots.capture(page, 'new-segment-url-verified');
  });

  test('navigate to Analytics', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToAnalytics();
    await screenshots.capture(page, 'analytics-page');
    await campaignsPage.expectPath('/analytics');
    await screenshots.capture(page, 'analytics-url-verified');
  });

  test('navigate to Domain Settings', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToDomainSettings();
    await screenshots.capture(page, 'domain-settings-page');
    await campaignsPage.expectPath('/settings/domains');
    await screenshots.capture(page, 'domain-settings-url-verified');
  });

  test('navigate to SMTP Settings', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToSmtpSettings();
    await screenshots.capture(page, 'smtp-settings-page');
    await campaignsPage.expectPath('/settings/smtp');
    await screenshots.capture(page, 'smtp-settings-url-verified');
  });

  test('navigate to New Campaign', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await campaignsPage.navigateToNewCampaign();
    await screenshots.capture(page, 'new-campaign-page');
    await campaignsPage.expectPath('/campaigns/new');
    await screenshots.capture(page, 'new-campaign-url-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = blastConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await campaignsPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await campaignsPage.goto();
    await screenshots.capture(page, 'start-at-campaigns');

    await campaignsPage.navigate('/templates');
    await screenshots.capture(page, 'navigated-to-templates');

    await campaignsPage.navigate('/segments');
    await screenshots.capture(page, 'navigated-to-segments');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await campaignsPage.expectPath('/templates');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await campaignsPage.expectPath('/segments');
  });
});
