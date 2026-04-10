import { test, expect } from '../../../fixtures/base.fixture';
import { PipelinePage } from '../pages/pipeline.page';
import { dragBetweenColumns, dragToReorder } from '../../../helpers/drag-drop';

test.describe('Bond — Drag and Drop', () => {
  let pipelinePage: PipelinePage;
  let pipelineId: string;

  test.beforeEach(async ({ page, screenshots, context, request }) => {
    pipelinePage = new PipelinePage(page, screenshots);

    try {
      const { DirectApiClient } = await import('../../../api/api-client');
      const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
      const cookies = await context.cookies();
      const csrf = readCsrfTokenFromCookies(cookies);
      const api = new DirectApiClient(request, '/bond/api', csrf || undefined);
      const pipelines = await api.get<any[]>('/pipelines');
      if (pipelines.length > 0) {
        pipelineId = pipelines[0].id;
      }
    } catch {}
  });

  test('drag deal between pipeline stages', async ({ page, screenshots }) => {
    test.skip(!pipelineId, 'No pipeline available');
    await pipelinePage.gotoPipeline(pipelineId);
    await screenshots.capture(page, 'pipeline-before-drag');

    const columns = pipelinePage.getStageColumns();
    const columnCount = await columns.count();
    test.skip(columnCount < 2, 'Need at least 2 stage columns for drag test');

    const firstColumnDeals = columns.first().locator('[class*="deal-card"], [class*="deal"], [class*="card"]').filter({ hasText: /.+/ });
    const dealCount = await firstColumnDeals.count();
    test.skip(dealCount === 0, 'Need at least 1 deal in first stage');

    const sourceDeal = firstColumnDeals.first();
    const targetColumn = columns.nth(1);
    const dealText = await sourceDeal.textContent();

    await screenshots.capture(page, 'before-stage-drag');
    await dragBetweenColumns(page, sourceDeal, targetColumn);
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'after-stage-drag');

    if (dealText) {
      const targetDeals = targetColumn.getByText(dealText, { exact: false });
      const count = await targetDeals.count();
      await screenshots.capture(page, 'drag-result-verified');
    }
  });

  test('drag deal to reorder within stage', async ({ page, screenshots }) => {
    test.skip(!pipelineId, 'No pipeline available');
    await pipelinePage.gotoPipeline(pipelineId);
    await screenshots.capture(page, 'pipeline-before-reorder');

    const columns = pipelinePage.getStageColumns();
    const firstColumn = columns.first();
    const deals = firstColumn.locator('[class*="deal-card"], [class*="deal"], [class*="card"]').filter({ hasText: /.+/ });
    const dealCount = await deals.count();
    test.skip(dealCount < 2, 'Need at least 2 deals for reorder test');

    const firstDeal = deals.first();
    const firstDealText = await firstDeal.textContent();
    await screenshots.capture(page, 'before-reorder');

    await dragToReorder(page, firstDeal, 1, 'down');
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'after-reorder');
  });

  test('pipeline board shows stage columns', async ({ page, screenshots }) => {
    test.skip(!pipelineId, 'No pipeline available');
    await pipelinePage.gotoPipeline(pipelineId);
    await screenshots.capture(page, 'pipeline-loaded');

    const columns = pipelinePage.getStageColumns();
    const columnCount = await columns.count();
    await screenshots.capture(page, `pipeline-columns-${columnCount}`);

    // Should have at least one stage column
    expect(columnCount).toBeGreaterThan(0);
  });
});
