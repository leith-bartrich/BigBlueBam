import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export const VIEWPORTS = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 800 },
  widescreen: { width: 1920, height: 1080 },
} as const;

export type ViewportName = keyof typeof VIEWPORTS;

export async function setViewport(page: Page, viewport: ViewportName | { width: number; height: number }): Promise<void> {
  const size = typeof viewport === 'string' ? VIEWPORTS[viewport] : viewport;
  await page.setViewportSize(size);
  await page.waitForTimeout(300); // Let layout settle
}

/**
 * Test a page at all standard viewports.
 */
export async function testAllViewports(
  page: Page,
  testFn: (page: Page, viewport: ViewportName) => Promise<void>,
): Promise<void> {
  for (const [name, size] of Object.entries(VIEWPORTS)) {
    await page.setViewportSize(size);
    await page.waitForTimeout(300);
    await testFn(page, name as ViewportName);
  }
}

/**
 * Check that the page has no horizontal overflow at the current viewport.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const hasOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });
  expect(hasOverflow).toBe(false);
}

/**
 * Check sidebar collapse on mobile.
 */
export async function expectSidebarCollapsed(page: Page): Promise<void> {
  const sidebar = page.locator('nav, aside, [class*="sidebar"]').first();
  if (await sidebar.count() > 0) {
    const box = await sidebar.boundingBox();
    if (box) {
      // Sidebar should be off-screen or hidden
      expect(box.x + box.width <= 0 || box.width === 0).toBeTruthy();
    }
  }
}

/**
 * Check sidebar visible on desktop.
 */
export async function expectSidebarVisible(page: Page): Promise<void> {
  const sidebar = page.locator('nav, aside, [class*="sidebar"]').first();
  await expect(sidebar).toBeVisible();
}
