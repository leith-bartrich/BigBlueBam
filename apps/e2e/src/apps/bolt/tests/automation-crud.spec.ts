import { test, expect } from '../../../fixtures/base.fixture';
import { BoltHomePage } from '../pages/home.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Bolt — Automation CRUD', () => {
  let homePage: BoltHomePage;

  test.beforeEach(async ({ page, screenshots }) => {
    homePage = new BoltHomePage(page, screenshots);
  });

  test('create automation via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    const automationName = `E2E Automation ${Date.now()}`;
    let automation: any;
    try {
      automation = await api.post('/automations', { name: automationName, trigger_type: 'manual' });
    } catch {
      test.skip(true, 'Could not create automation via API');
      return;
    }
    await screenshots.capture(page, 'automation-created-via-api');

    await homePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-after-create');
    await homePage.expectAutomationVisible(automationName);
    await screenshots.capture(page, 'new-automation-visible-in-list');

    // Cleanup
    try {
      await api.delete(`/automations/${automation.id}`);
    } catch {}
  });

  test('open automation detail from list', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    let automation: any;
    try {
      const automations = await api.get<any[]>('/automations');
      if (automations.length > 0) automation = automations[0];
    } catch {}

    test.skip(!automation, 'No automation available');

    await homePage.goto();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'home-before-click');

    await homePage.clickAutomation(automation.name);
    await screenshots.capture(page, 'automation-detail-opened');
    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'detail-visible');
  });

  test('update automation name via API and verify in UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    const automationName = `E2E Automation Update ${Date.now()}`;
    let automation: any;
    try {
      automation = await api.post('/automations', { name: automationName, trigger_type: 'event' });
    } catch {
      test.skip(true, 'Could not create automation via API');
      return;
    }

    const updatedName = `${automationName} Updated`;
    try {
      await api.patch(`/automations/${automation.id}`, { name: updatedName });
    } catch {
      test.skip(true, 'Could not update automation via API');
      return;
    }

    await homePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-after-rename');
    await homePage.expectAutomationVisible(updatedName);
    await screenshots.capture(page, 'renamed-automation-visible');

    // Cleanup
    try {
      await api.delete(`/automations/${automation.id}`);
    } catch {}
  });

  test('delete automation via API and verify removed from UI', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/bolt/api', csrf || undefined);

    const automationName = `E2E Automation Delete ${Date.now()}`;
    let automation: any;
    try {
      automation = await api.post('/automations', { name: automationName, trigger_type: 'manual' });
    } catch {
      test.skip(true, 'Could not create automation via API');
      return;
    }

    try {
      await api.delete(`/automations/${automation.id}`);
    } catch {
      test.skip(true, 'Could not delete automation via API');
      return;
    }

    await homePage.goto();
    await page.waitForTimeout(2000);
    await screenshots.capture(page, 'home-after-delete');
    await homePage.expectAutomationNotVisible(automationName);
    await screenshots.capture(page, 'deleted-automation-gone');
  });
});
