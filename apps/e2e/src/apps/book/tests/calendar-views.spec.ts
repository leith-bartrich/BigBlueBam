import { test, expect } from '../../../fixtures/base.fixture';
import { CalendarPage } from '../pages/calendar.page';

test.describe('Book — Calendar Views', () => {
  test('week view renders calendar grid', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await screenshots.capture(page, 'week-view-initial');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'week-view-grid');
  });

  test('day view renders for today', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await calendar.navigateToDayView();
    await screenshots.capture(page, 'day-view-initial');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'day-view-content');
  });

  test('day view renders for specific date', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();

    const targetDate = '2026-04-15';
    await calendar.navigateToDaySpecific(targetDate);
    await screenshots.capture(page, 'day-specific-loaded');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'day-specific-content');
  });

  test('month view renders', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await calendar.navigateToMonthView();
    await screenshots.capture(page, 'month-view-initial');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'month-view-content');
  });

  test('timeline view renders', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await calendar.navigateToTimeline();
    await screenshots.capture(page, 'timeline-initial');

    await expect(page.locator('main')).toBeVisible();
    await screenshots.capture(page, 'timeline-content');
  });

  test('can switch between all calendar views', async ({ page, screenshots }) => {
    const calendar = new CalendarPage(page, screenshots);
    await calendar.goto();
    await screenshots.capture(page, 'start-at-week');

    await calendar.navigateToDayView();
    await screenshots.capture(page, 'switched-to-day');

    await calendar.navigateToMonthView();
    await screenshots.capture(page, 'switched-to-month');

    await calendar.navigateToTimeline();
    await screenshots.capture(page, 'switched-to-timeline');

    await calendar.navigateToWeekView();
    await screenshots.capture(page, 'back-to-week');
    await calendar.expectPath('/');
  });
});
