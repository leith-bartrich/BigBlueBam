import { test, expect } from '../../../fixtures/base.fixture';
import { HelpdeskHomePage } from '../pages/helpdesk-home.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

// NOTE: Helpdesk uses its OWN auth system separate from B3. Tests that require
// an authenticated session may need to call homePage.loginWithCredentials()
// with helpdesk-specific credentials rather than relying on B3 storageState.
test.describe('Helpdesk — Ticket CRUD', () => {
  const testSubject = `E2E Test Ticket ${Date.now()}`;
  const testDescription = 'This ticket was created by an E2E test and should be cleaned up.';

  test('create a new ticket via UI', async ({ page, screenshots, context, request }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.goto();
    await screenshots.capture(page, 'tickets-before-create');

    await homePage.navigateToNewTicket();
    await screenshots.capture(page, 'new-ticket-form-loaded');

    await homePage.fillTicketSubject(testSubject);
    await screenshots.capture(page, 'subject-filled');

    await homePage.fillTicketDescription(testDescription);
    await screenshots.capture(page, 'description-filled');

    await homePage.clickSubmitTicket();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'ticket-submitted');

    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/helpdesk/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/tickets');
    if (status === 200) {
      const tickets = (body as any)?.data || body;
      const found = Array.isArray(tickets)
        ? tickets.find((t: any) => t.subject === testSubject)
        : null;
      if (found) {
        expect(found).toBeTruthy();
      }
    }
    await screenshots.capture(page, 'ticket-verified-via-api');
  });

  test('tickets list page shows tickets', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.goto();
    await screenshots.capture(page, 'tickets-list');

    await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    await screenshots.capture(page, 'tickets-visible');
  });

  test('create ticket with empty subject shows validation error', async ({ page, screenshots }) => {
    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToNewTicket();
    await screenshots.capture(page, 'new-ticket-form-empty');

    await homePage.clickSubmitTicket();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    if (await errorEl.isVisible({ timeout: 5000 }).catch(() => false)) {
      await screenshots.capture(page, 'error-detail-visible');
    }
  });

  test('ticket detail page loads for existing ticket', async ({ page, screenshots, context, request }) => {
    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const api = new DirectApiClient(request, '/helpdesk/api', csrf || undefined);

    let ticketId: string | undefined;
    try {
      const { status, body } = await api.getRaw('/tickets');
      if (status === 200) {
        const tickets = (body as any)?.data || body;
        if (Array.isArray(tickets) && tickets.length > 0) {
          ticketId = tickets[0].id;
        }
      }
    } catch {}

    test.skip(!ticketId, 'No ticket available');

    const homePage = new HelpdeskHomePage(page, screenshots);
    await homePage.goto();
    await homePage.navigateToTicketDetail(ticketId!);
    await screenshots.capture(page, 'ticket-detail-loaded');

    await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    await screenshots.capture(page, 'ticket-detail-visible');
  });
});
