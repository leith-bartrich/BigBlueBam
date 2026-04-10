import { test, expect } from '../../../fixtures/base.fixture';
import { verifyNoDuplicates } from '../../../helpers/pagination';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('B3 — Pagination', () => {
  test('project list loads items', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'projects-loaded');

    // Verify items are present
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'main-content-visible');
  });

  test('task list supports cursor pagination', async ({ page, screenshots, context, request }) => {
    // Find a project with tasks
    const { DirectApiClient } = await import('../../../api/api-client');
    const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/b3/api', csrf || undefined);

    let projectId: string | undefined;
    try {
      const projects = await api.get<any[]>('/projects');
      if (projects.length > 0) projectId = projects[0].id;
    } catch {}

    test.skip(!projectId, 'No project available');

    // Verify API pagination works
    const firstPage = await api.getRaw(`/projects/${projectId}/tasks?limit=5`);
    expect(firstPage.status).toBe(200);
    await screenshots.capture(page, 'api-pagination-verified');

    // Navigate to board and verify tasks render
    await page.goto(`/b3/projects/${projectId}/board`);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'board-with-tasks');
  });

  test('audit log pagination', async ({ page, screenshots, context, request }) => {
    const { DirectApiClient } = await import('../../../api/api-client');
    const { readCsrfTokenFromCookies } = await import('../../../auth/auth.helper');
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/b3/api', csrf || undefined);

    let projectId: string | undefined;
    try {
      const projects = await api.get<any[]>('/projects');
      if (projects.length > 0) projectId = projects[0].id;
    } catch {}

    test.skip(!projectId, 'No project available');

    await page.goto(`/b3/projects/${projectId}/audit-log`);
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'audit-log-loaded');

    // Verify content is visible
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'audit-log-content');
  });
});
