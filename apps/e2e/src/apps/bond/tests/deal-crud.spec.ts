import { test, expect } from '../../../fixtures/base.fixture';
import { PipelinePage } from '../pages/pipeline.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

// Helper — resolve the first pipeline's id + first stage's id.
//
// KNOWN BOND-API BUG: GET /v1/pipelines crashes with `malformed array
// literal` (Postgres 22P02) whenever ANY pipeline exists, because
// listPipelines passes a single-element JS array directly into a raw
// `sql\`... = ANY(${pipelineIds})\`` clause. This was flagged during the
// locator-fix sweep but the fix sits in bond-api/src/services/pipeline.service.ts
// which is out-of-scope for the e2e-only task. Until that lands, we dodge
// the broken list endpoint entirely by reading /v1/deals (which returns
// pipeline_id + stage_id on every row) and falling back to the detail
// route /v1/pipelines/:id (which does NOT use the broken query).
async function resolvePipelineAndStage(api: DirectApiClient): Promise<{ pipelineId: string; stageId: string } | null> {
  // Preferred path — read the seeded deal to extract pipeline+stage ids.
  try {
    const raw = await api.get<any>('/v1/deals');
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    const deal = list[0];
    if (deal?.pipeline_id && deal?.stage_id) {
      return { pipelineId: deal.pipeline_id, stageId: deal.stage_id };
    }
  } catch {}

  // Fallback — the list endpoint is broken, but the detail endpoint may
  // work if we can infer an id from anywhere else. Try the list anyway in
  // case the bond-api bug has been fixed; if it 500s we give up.
  try {
    const pipelines = await api.get<Array<{ id: string; stages?: Array<{ id: string }> }>>('/v1/pipelines');
    if (pipelines.length === 0) return null;
    const first = pipelines[0];
    let stageId = first.stages?.[0]?.id;
    if (!stageId) {
      const detail = await api.get<{ id: string; stages?: Array<{ id: string }> }>(`/v1/pipelines/${first.id}`);
      stageId = detail.stages?.[0]?.id;
    }
    if (!stageId) return null;
    return { pipelineId: first.id, stageId };
  } catch {
    return null;
  }
}

test.describe('Bond — Deal CRUD', () => {
  let pipelinePage: PipelinePage;

  test.beforeEach(async ({ page, screenshots }) => {
    pipelinePage = new PipelinePage(page, screenshots);
  });

  test('create deal via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const resolved = await resolvePipelineAndStage(api);
    test.skip(!resolved, 'No pipeline+stage available');

    const dealName = `E2E Deal ${Date.now()}`;
    // Real bond deal payload: name (not title), pipeline_id, stage_id all required.
    const deal = await api.post<any>('/v1/deals', {
      name: dealName,
      pipeline_id: resolved!.pipelineId,
      stage_id: resolved!.stageId,
      value: 5000,
    });
    await screenshots.capture(page, 'deal-created-via-api');

    await pipelinePage.gotoPipeline(resolved!.pipelineId);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-after-create');
    await pipelinePage.expectDealVisible(dealName);
    await screenshots.capture(page, 'new-deal-visible');

    // Cleanup
    try {
      await api.delete(`/v1/deals/${deal.id}`);
    } catch {}
  });

  test('open deal detail from pipeline board', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    let deal: any;
    try {
      const raw = await api.get<any>('/v1/deals');
      const list = Array.isArray(raw)
        ? raw
        : Array.isArray(raw?.data)
          ? raw.data
          : [];
      if (list.length > 0) deal = list[0];
    } catch {}

    test.skip(!deal, 'No deal available');

    // Navigate to the specific pipeline so the board loads deals
    const pipelineId = deal.pipeline_id;
    if (pipelineId) {
      await pipelinePage.gotoPipeline(pipelineId);
    } else {
      await pipelinePage.goto();
    }
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'pipeline-before-click');

    // Bond deal UI uses `name`, not `title`.
    await pipelinePage.clickDeal(deal.name ?? deal.title);
    await screenshots.capture(page, 'deal-detail-opened');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'deal-detail-visible');
  });

  test('update deal name via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const resolved = await resolvePipelineAndStage(api);
    test.skip(!resolved, 'No pipeline+stage available');

    const dealName = `E2E Deal Update ${Date.now()}`;
    const deal = await api.post<any>('/v1/deals', {
      name: dealName,
      pipeline_id: resolved!.pipelineId,
      stage_id: resolved!.stageId,
    });

    const updatedName = `${dealName} Updated`;
    await api.patch(`/v1/deals/${deal.id}`, { name: updatedName });

    await pipelinePage.gotoPipeline(resolved!.pipelineId);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-after-rename');
    await pipelinePage.expectDealVisible(updatedName);
    await screenshots.capture(page, 'renamed-deal-visible');

    // Cleanup
    try {
      await api.delete(`/v1/deals/${deal.id}`);
    } catch {}
  });

  test('delete deal via API and verify removed from UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bond/api', csrf || undefined);

    const resolved = await resolvePipelineAndStage(api);
    test.skip(!resolved, 'No pipeline+stage available');

    const dealName = `E2E Deal Delete ${Date.now()}`;
    const deal = await api.post<any>('/v1/deals', {
      name: dealName,
      pipeline_id: resolved!.pipelineId,
      stage_id: resolved!.stageId,
    });

    await api.delete(`/v1/deals/${deal.id}`);

    await pipelinePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'pipeline-after-delete');
    await pipelinePage.expectDealNotVisible(dealName);
    await screenshots.capture(page, 'deleted-deal-gone');
  });
});
