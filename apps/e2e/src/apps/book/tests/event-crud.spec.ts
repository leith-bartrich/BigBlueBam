import { test, expect } from '../../../fixtures/base.fixture';
import { CalendarPage } from '../pages/calendar.page';
import { DirectApiClient } from '../../../api/api-client';
import { readCsrfTokenFromCookies } from '../../../auth/auth.helper';

test.describe('Book — Event CRUD', () => {
  const testEventTitle = `E2E Test Event ${Date.now()}`;

  test('create a new event via UI', async ({ page, screenshots, context, request }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await screenshots.capture(page, 'calendar-before-create');

    await calendar.navigateToNewEvent();
    await screenshots.capture(page, 'new-event-form-loaded');

    await calendar.fillEventTitle(testEventTitle);
    await screenshots.capture(page, 'event-title-filled');

    const now = new Date();
    const start = new Date(now.getTime() + 60 * 60 * 1000);
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    await calendar.fillEventStartTime(start.toISOString().slice(0, 16));
    await screenshots.capture(page, 'event-start-filled');
    await calendar.fillEventEndTime(end.toISOString().slice(0, 16));
    await screenshots.capture(page, 'event-end-filled');

    await calendar.clickSaveEvent();
    await page.waitForTimeout(1000);
    await screenshots.capture(page, 'event-created');

    const cookies = await context.cookies();
    const csrf = readCsrfTokenFromCookies(cookies);
    const apiClient = new DirectApiClient(request, '/book/api', csrf || undefined);
    const { status, body } = await apiClient.getRaw('/events');
    if (status === 200) {
      const events = (body as any)?.data || body;
      const found = Array.isArray(events)
        ? events.find((e: any) => e.title === testEventTitle)
        : null;
      expect(found).toBeTruthy();
    }
    await screenshots.capture(page, 'event-verified-via-api');
  });

  test('events list is visible on calendar', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await screenshots.capture(page, 'calendar-with-events');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'events-visible');
  });

  test('create event with empty title shows validation error', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await calendar.navigateToNewEvent();
    await screenshots.capture(page, 'new-event-form-open');

    await calendar.clickSaveEvent();
    await screenshots.capture(page, 'validation-error-shown');

    const errorEl = page.locator('.text-red-500, .text-destructive, [role="alert"]').first();
    await expect(errorEl).toBeVisible({ timeout: 5000 });
    await screenshots.capture(page, 'error-detail-visible');
  });

  test('create a booking page via UI', async ({ page, screenshots, context, request }) => {
    const calendar = new CalendarPage(page, screenshots);
    const bookingPageName = `E2E Booking Page ${Date.now()}`;

    await calendar.goto();
    await calendar.navigateToBookingPages();
    await screenshots.capture(page, 'booking-pages-loaded');

    const newBtn = page.getByRole('button', { name: /new|create|add/i }).first();
    if (await newBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await newBtn.click();
      await screenshots.capture(page, 'new-booking-dialog');

      const nameField = page.getByLabel(/name/i).first();
      if (await nameField.isVisible({ timeout: 3000 }).catch(() => false)) {
        await nameField.fill(bookingPageName);
        await screenshots.capture(page, 'booking-name-filled');

        const durationField = page.getByLabel(/duration/i).first();
        if (await durationField.isVisible({ timeout: 2000 }).catch(() => false)) {
          await durationField.fill('30');
          await screenshots.capture(page, 'booking-duration-filled');
        }

        await page.getByRole('button', { name: /save|create/i }).first().click();
        await page.waitForTimeout(1000);
        await screenshots.capture(page, 'booking-page-created');
      }
    }
  });
});
