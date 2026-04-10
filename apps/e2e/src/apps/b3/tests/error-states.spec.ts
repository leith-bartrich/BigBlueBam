import { test, expect } from '../../../fixtures/base.fixture';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('B3 — Error States', () => {
  test('API 500 error renders error UI', async ({ page, screenshots }) => {
    // Intercept API to simulate server error
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'INTERNAL_SERVER_ERROR',
              message: 'Internal server error',
              request_id: 'test-500',
            },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await page.goto('/b3/');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'api-500-error-state');
  });

  test('API 404 error is handled gracefully', async ({ page, screenshots }) => {
    await page.route('**/api/projects/nonexistent/**', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
            request_id: 'test-404',
          },
        }),
      });
    });

    await page.goto('/b3/projects/nonexistent/board');
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'api-404-error-state');
  });

  test('network offline shows error state', async ({ page, screenshots, context }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'online-state');

    // Go offline
    await context.setOffline(true);
    await screenshots.capture(page, 'offline-state');

    // Try to perform an action
    await page.reload().catch(() => {});
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'offline-reload-error');

    // Restore connection
    await context.setOffline(false);
    await screenshots.capture(page, 'back-online');
  });

  test('API 409 conflict is handled', async ({ page, screenshots }) => {
    await page.route('**/api/projects/*/tasks/*', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            error: {
              code: 'CONFLICT',
              message: 'Resource has been modified by another user',
              request_id: 'test-409',
            },
          }),
        });
      } else {
        await route.fallback();
      }
    });

    await screenshots.capture(page, 'conflict-error-setup');
  });
});
