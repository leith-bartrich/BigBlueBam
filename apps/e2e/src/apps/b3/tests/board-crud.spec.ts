import { test, expect } from '../../../fixtures/base.fixture';
import { BoardPage } from '../pages/board.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('B3 — Board Task CRUD', () => {
  let boardPage: BoardPage;
  let projectId: string;

  test.beforeEach(async ({ page, screenshots, request, context }) => {
    boardPage = new BoardPage(page, screenshots);

    if (!projectId) {
      // Lazily look up a test project on first test. Cannot do this in
      // beforeAll because Playwright's `request`/`context` fixtures are
      // per-test and cannot be used there. The 'seed e2e admin project'
      // step in auth.setup.ts guarantees at least one project exists for
      // the admin, so this must succeed — any failure here is a real bug
      // and should surface as a hard failure rather than be swallowed.
      const cookies = await context.cookies();
      const csrf = readCsrfTokenFromCookies(cookies);
      const api = new DirectApiClient(request, '/b3/api', csrf || undefined);

      const projects = await api.get<Array<{ id: string }>>('/projects');
      projectId = projects[0].id;
    }
  });

  test('board page loads with phase columns', async ({ page, screenshots }) => {
    await boardPage.gotoProject(projectId);
    await screenshots.capture(page, 'board-loaded');
    await boardPage.expectBoardLoaded();
    await screenshots.capture(page, 'board-with-columns');
  });

  test('create task via inline input', async ({ page, screenshots, context, request }) => {
    await boardPage.gotoProject(projectId);
    await screenshots.capture(page, 'board-before-create');

    const taskTitle = `E2E Task ${Date.now()}`;
    await boardPage.createTaskInline(taskTitle);
    await screenshots.capture(page, 'task-created-inline');

    await boardPage.expectTaskVisible(taskTitle);
    await screenshots.capture(page, 'task-visible-on-board');

    // Verify via API
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/b3/api', csrf || undefined);
    const tasks = await api.get<any[]>(`/projects/${projectId}/tasks`);
    const found = tasks.find((t: any) => t.title === taskTitle);
    expect(found).toBeTruthy();
    await screenshots.capture(page, 'task-verified-via-api');
  });

  test('open task detail drawer', async ({ page, screenshots }) => {
    await boardPage.gotoProject(projectId);
    await screenshots.capture(page, 'board-before-open-task');

    // Find any visible task
    const taskCard = boardPage.getTaskCards().first();
    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      const taskText = await taskCard.textContent();
      await taskCard.click();
      await screenshots.capture(page, 'task-drawer-opened');

      const drawer = boardPage.getTaskDrawer();
      await expect(drawer).toBeVisible({ timeout: 5000 });
      await screenshots.capture(page, 'task-detail-visible');

      await boardPage.closeTaskDrawer();
      await screenshots.capture(page, 'task-drawer-closed');
    }
  });

  test('edit task title in detail drawer', async ({ page, screenshots }) => {
    await boardPage.gotoProject(projectId);

    const taskCard = boardPage.getTaskCards().first();
    if (await taskCard.isVisible({ timeout: 3000 }).catch(() => false)) {
      await taskCard.click();
      await screenshots.capture(page, 'task-opened-for-edit');

      const newTitle = `Edited E2E Task ${Date.now()}`;
      await boardPage.editTaskTitle(newTitle);
      await screenshots.capture(page, 'task-title-edited');

      await boardPage.closeTaskDrawer();
      await screenshots.capture(page, 'board-after-edit');
    }
  });
});
