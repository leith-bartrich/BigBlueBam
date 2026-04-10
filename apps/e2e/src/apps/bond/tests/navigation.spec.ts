import { test, expect } from '../../../fixtures/base.fixture';
import { PipelinePage } from '../pages/pipeline.page';
import { bondConfig } from '../bond.config';

test.describe('Bond — Navigation', () => {
  let pipelinePage: PipelinePage;

  test.beforeEach(async ({ page, screenshots }) => {
    pipelinePage = new PipelinePage(page, screenshots);
  });

  test('pipeline page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await screenshots.capture(page, 'bond-pipeline-loaded');
    await pipelinePage.expectPipelineLoaded();
    await screenshots.capture(page, 'bond-content-visible');
  });

  test('contacts page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigateToContacts();
    await screenshots.capture(page, 'contacts-page');
    await pipelinePage.expectPath('/contacts');
    await screenshots.capture(page, 'contacts-verified');
  });

  test('companies page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigateToCompanies();
    await screenshots.capture(page, 'companies-page');
    await pipelinePage.expectPath('/companies');
    await screenshots.capture(page, 'companies-verified');
  });

  test('analytics page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigateToAnalytics();
    await screenshots.capture(page, 'analytics-page');
    await pipelinePage.expectPath('/analytics');
    await screenshots.capture(page, 'analytics-verified');
  });

  test('pipeline settings page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigateToPipelineSettings();
    await screenshots.capture(page, 'pipeline-settings-page');
    await pipelinePage.expectPath('/settings/pipelines');
    await screenshots.capture(page, 'pipeline-settings-verified');
  });

  test('custom fields page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigateToCustomFields();
    await screenshots.capture(page, 'custom-fields-page');
    await pipelinePage.expectPath('/settings/fields');
    await screenshots.capture(page, 'custom-fields-verified');
  });

  test('lead scoring page loads', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigateToLeadScoring();
    await screenshots.capture(page, 'lead-scoring-page');
    await pipelinePage.expectPath('/settings/scoring');
    await screenshots.capture(page, 'lead-scoring-verified');
  });

  test('all configured pages are reachable', async ({ page, screenshots }) => {
    const simplePages = bondConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await pipelinePage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });

  test('browser back/forward works', async ({ page, screenshots }) => {
    await pipelinePage.goto();
    await pipelinePage.navigate('/contacts');
    await pipelinePage.navigate('/companies');
    await screenshots.capture(page, 'at-companies');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'back-to-contacts');
    await pipelinePage.expectPath('/contacts');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'forward-to-companies');
    await pipelinePage.expectPath('/companies');
  });

  test('deep link to deal detail', async ({ page, screenshots, context, request }) => {
    const { DirectApiClient } = await import('../../../api/api-client');
    const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let dealId: string | undefined;
    try {
      const deals = await api.get<any[]>('/deals');
      if (deals.length > 0) dealId = deals[0].id;
    } catch {}

    if (dealId) {
      await page.goto(`/bond/deals/${dealId}`);
      await pipelinePage.waitForAppReady();
      await screenshots.capture(page, 'deep-link-deal-loaded');
      await expect(page.locator('main')).toBeVisible();
      await screenshots.capture(page, 'deal-detail-visible');
    }
  });
});
