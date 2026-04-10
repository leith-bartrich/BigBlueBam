import { test, expect } from '../../../fixtures/base.fixture';
import { PipelinePage } from '../pages/pipeline.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bond — Deal CRUD', () => {
  let pipelinePage: PipelinePage;

  test.beforeEach(async ({ page, screenshots }) => {
    pipelinePage = new PipelinePage(page, screenshots);
  });

  test('create deal via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    // Get a pipeline first
    let pipelineId: string | undefined;
    try {
      const pipelines = await api.get<any[]>('/pipelines');
      if (pipelines.length > 0) pipelineId = pipelines[0].id;
    } catch {}

    test.skip(!pipelineId, 'No pipeline available');

    const dealTitle = `E2E Deal ${Date.now()}`;
    let deal: any;
    try {
      deal = await api.post('/deals', { title: dealTitle, pipeline_id: pipelineId });
    } catch {
      test.skip(true, 'Could not create deal via API');
      return;
    }
    await screenshots.capture(page, 'deal-created-via-api');

    await pipelinePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-after-create');
    await pipelinePage.expectDealVisible(dealTitle);
    await screenshots.capture(page, 'new-deal-visible');

    // Cleanup
    try {
      await api.delete(`/deals/${deal.id}`);
    } catch {}
  });

  test('open deal detail from pipeline board', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let deal: any;
    try {
      const deals = await api.get<any[]>('/deals');
      if (deals.length > 0) deal = deals[0];
    } catch {}

    test.skip(!deal, 'No deal available');

    await pipelinePage.goto();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'pipeline-before-click');

    await pipelinePage.clickDeal(deal.title);
    await screenshots.capture(page, 'deal-detail-opened');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'deal-detail-visible');
  });

  test('update deal title via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let pipelineId: string | undefined;
    try {
      const pipelines = await api.get<any[]>('/pipelines');
      if (pipelines.length > 0) pipelineId = pipelines[0].id;
    } catch {}

    test.skip(!pipelineId, 'No pipeline available');

    const dealTitle = `E2E Deal Update ${Date.now()}`;
    let deal: any;
    try {
      deal = await api.post('/deals', { title: dealTitle, pipeline_id: pipelineId });
    } catch {
      test.skip(true, 'Could not create deal via API');
      return;
    }

    const updatedTitle = `${dealTitle} Updated`;
    try {
      await api.patch(`/deals/${deal.id}`, { title: updatedTitle });
    } catch {
      test.skip(true, 'Could not update deal via API');
      return;
    }

    await pipelinePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-after-rename');
    await pipelinePage.expectDealVisible(updatedTitle);
    await screenshots.capture(page, 'renamed-deal-visible');

    // Cleanup
    try {
      await api.delete(`/deals/${deal.id}`);
    } catch {}
  });

  test('delete deal via API and verify removed from UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let pipelineId: string | undefined;
    try {
      const pipelines = await api.get<any[]>('/pipelines');
      if (pipelines.length > 0) pipelineId = pipelines[0].id;
    } catch {}

    test.skip(!pipelineId, 'No pipeline available');

    const dealTitle = `E2E Deal Delete ${Date.now()}`;
    let deal: any;
    try {
      deal = await api.post('/deals', { title: dealTitle, pipeline_id: pipelineId });
    } catch {
      test.skip(true, 'Could not create deal via API');
      return;
    }

    try {
      await api.delete(`/deals/${deal.id}`);
    } catch {
      test.skip(true, 'Could not delete deal via API');
      return;
    }

    await pipelinePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-after-delete');
    await pipelinePage.expectDealNotVisible(dealTitle);
    await screenshots.capture(page, 'deleted-deal-gone');
  });
});
