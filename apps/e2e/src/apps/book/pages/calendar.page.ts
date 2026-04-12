import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { BasePage } from '../../../page-objects/base.page';
import { bookConfig } from '../book.config';
import type { ScreenshotCollector } from '../../../helpers/screenshot';

export class CalendarPage extends BasePage {
  constructor(page: Page, screenshots?: ScreenshotCollector) {
    super(page, bookConfig, screenshots);
  }

  async goto(): Promise<void> {
    await super.goto('/');
    // BookLayout renders <main> only after the Book auth-check finishes. The
    // shared `waitForAppReady` waits for .animate-spin to hide, but there is
    // a short window between the spinner hiding and BookLayout mounting
    // <main>. Wait explicitly so downstream locators are stable.
    await this.page.locator('main').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  }

  async expectCalendarLoaded(): Promise<void> {
    await expect(this.page.locator('main').first()).toBeVisible();
  }

  async navigateToWeekView(): Promise<void> {
    await this.navigate('/');
  }

  async navigateToDayView(): Promise<void> {
    await this.navigate('/day');
  }

  async navigateToDaySpecific(date: string): Promise<void> {
    await this.navigate(`/day/${date}`);
  }

  async navigateToMonthView(): Promise<void> {
    await this.navigate('/month');
  }

  async navigateToTimeline(): Promise<void> {
    await this.navigate('/timeline');
  }

  async navigateToNewEvent(): Promise<void> {
    await this.navigate('/events/new');
    // Wait for the EventFormPage to mount — both the title placeholder and
    // the action button ("Create Event") are reliable signals, the button
    // appears last once calendar auto-provisioning has resolved.
    await this.page
      .getByRole('button', { name: /create event|update event|save event/i })
      .first()
      .waitFor({ state: 'visible', timeout: 15_000 })
      .catch(() => {});
  }

  async navigateToEventDetail(id: string): Promise<void> {
    await this.navigate(`/events/${id}`);
  }

  async navigateToEventEdit(id: string): Promise<void> {
    await this.navigate(`/events/${id}/edit`);
  }

  async navigateToBookingPages(): Promise<void> {
    await this.navigate('/booking-pages');
  }

  async navigateToWorkingHours(): Promise<void> {
    await this.navigate('/settings/working-hours');
  }

  async navigateToConnections(): Promise<void> {
    await this.navigate('/settings/connections');
  }

  async clickCreateEvent(): Promise<void> {
    const btn = this.page.getByRole('button', { name: /new event|create event|add event|new/i }).first();
    if (await btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await btn.click();
    } else {
      await this.navigate('/events/new');
    }
  }

  async fillEventTitle(title: string): Promise<void> {
    // The Book event-form.tsx page renders `<label>Title</label>` as a
    // sibling of the input (no `htmlFor`), so `getByLabel` cannot resolve it.
    // The title input has placeholder="Team standup" and autoFocus.
    await this.page.getByPlaceholder(/team standup/i).first().fill(title);
  }

  async fillEventStartTime(value: string): Promise<void> {
    // Start/End inputs are `datetime-local` siblings of plain `<label>`s.
    // Locate them positionally within the form grid instead.
    const field = this.page.locator('input[type="datetime-local"]').nth(0);
    if (await field.isVisible({ timeout: 3000 }).catch(() => false)) {
      await field.fill(value);
    }
  }

  async fillEventEndTime(value: string): Promise<void> {
    const field = this.page.locator('input[type="datetime-local"]').nth(1);
    if (await field.isVisible({ timeout: 3000 }).catch(() => false)) {
      await field.fill(value);
    }
  }

  async clickSaveEvent(): Promise<void> {
    // Submit the event form via its submit button. The button label is
    // "Create Event" (or "Update Event" when editing).
    await this.page
      .getByRole('button', { name: /create event|update event|save event/i })
      .first()
      .click();
  }

  async expectEventVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false }).first()).toBeVisible();
  }

  async expectEventNotVisible(title: string): Promise<void> {
    await expect(this.page.getByText(title, { exact: false })).not.toBeVisible();
  }

  async getEventCount(): Promise<number> {
    const items = this.page.locator('[class*="event"], [class*="calendar"] [class*="item"]');
    return items.count();
  }

  async expectCalendarGridVisible(): Promise<void> {
    const grid = this.page.locator('[class*="calendar"], [class*="grid"], [role="grid"]').first();
    await expect(grid).toBeVisible();
  }
}
