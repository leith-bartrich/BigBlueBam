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
  }

  async expectCalendarLoaded(): Promise<void> {
    await expect(this.page.locator('main')).toBeVisible();
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
    await this.page.getByLabel(/title|name/i).first().fill(title);
  }

  async fillEventStartTime(value: string): Promise<void> {
    const field = this.page.getByLabel(/start/i).first();
    if (await field.isVisible({ timeout: 3000 }).catch(() => false)) {
      await field.fill(value);
    }
  }

  async fillEventEndTime(value: string): Promise<void> {
    const field = this.page.getByLabel(/end/i).first();
    if (await field.isVisible({ timeout: 3000 }).catch(() => false)) {
      await field.fill(value);
    }
  }

  async clickSaveEvent(): Promise<void> {
    await this.page.getByRole('button', { name: /save|create|confirm/i }).first().click();
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
