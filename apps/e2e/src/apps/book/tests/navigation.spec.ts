import { test, expect } from '../../../fixtures/base.fixture';
import { CalendarPage } from '../pages/calendar.page';
import { bookConfig } from '../book.config';

test.describe('Book — Navigation', () => {
  let calendarPage: CalendarPage;

  test.beforeEach(async ({ page, screenshots }) => {
    calendarPage = new CalendarPage(page, screenshots);
  });

  test('week view loads', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await screenshots.capture(page, 'week-view-loaded');
    await calendarPage.expectCalendarLoaded();
    await screenshots.capture(page, 'week-view-content-visible');
  });

  test('navigate to day view', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToDayView();
    await screenshots.capture(page, 'day-view-page');
    await calendarPage.expectPath('/day');
    await screenshots.capture(page, 'day-view-url-verified');
  });

  test('navigate to month view', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToMonthView();
    await screenshots.capture(page, 'month-view-page');
    await calendarPage.expectPath('/month');
    await screenshots.capture(page, 'month-view-url-verified');
  });

  test('navigate to timeline', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToTimeline();
    await screenshots.capture(page, 'timeline-page');
    await calendarPage.expectPath('/timeline');
    await screenshots.capture(page, 'timeline-url-verified');
  });

  test('navigate to new event page', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToNewEvent();
    await screenshots.capture(page, 'new-event-page');
    await calendarPage.expectPath('/events/new');
    await screenshots.capture(page, 'new-event-url-verified');
  });

  test('navigate to booking pages', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToBookingPages();
    await screenshots.capture(page, 'booking-pages');
    await calendarPage.expectPath('/booking-pages');
    await screenshots.capture(page, 'booking-pages-url-verified');
  });

  test('navigate to working hours settings', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToWorkingHours();
    await screenshots.capture(page, 'working-hours-page');
    await calendarPage.expectPath('/settings/working-hours');
    await screenshots.capture(page, 'working-hours-url-verified');
  });

  test('navigate to connections settings', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await calendarPage.navigateToConnections();
    await screenshots.capture(page, 'connections-page');
    await calendarPage.expectPath('/settings/connections');
    await screenshots.capture(page, 'connections-url-verified');
  });

  test('browser back/forward works with pushState routing', async ({ page, screenshots }) => {
    await calendarPage.goto();
    await screenshots.capture(page, 'start-at-week');

    await calendarPage.navigateToDayView();
    await screenshots.capture(page, 'navigated-to-day');

    await calendarPage.navigateToMonthView();
    await screenshots.capture(page, 'navigated-to-month');

    await page.goBack();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-back-button');
    await calendarPage.expectPath('/day');

    await page.goForward();
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'after-forward-button');
    await calendarPage.expectPath('/month');
  });

  test('all configured pages without params are reachable', async ({ page, screenshots }) => {
    const simplePages = bookConfig.pages.filter(
      (p) => p.requiresAuth && !p.requiresSetup && !p.path.includes(':'),
    );

    for (const pageDef of simplePages) {
      await calendarPage.navigate(pageDef.path);
      await screenshots.capture(page, `page-${pageDef.name}-loaded`);
      await expect(page.locator('main, [class*="content"]').first()).toBeVisible();
    }
  });
});
