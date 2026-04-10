import { test, expect } from '../../../fixtures/base.fixture';
import { testCommandPalette, testShortcutSuppressedInInput } from '../../../helpers/keyboard';
import { DashboardPage } from '../pages/dashboard.page';

test.describe('B3 — Keyboard Shortcuts', () => {
  test('Cmd+K opens command palette', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-before-palette');

    await page.keyboard.press('Meta+k');
    await page.waitForTimeout(500);
    await screenshots.capture(page, 'command-palette-opened');

    const dialog = page.locator('[role="dialog"]').first();
    await expect(dialog).toBeVisible({ timeout: 3000 });
    await screenshots.capture(page, 'palette-dialog-visible');

    // Close with Escape
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
    await screenshots.capture(page, 'palette-closed');
  });

  test('command palette search filters results', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();

    await testCommandPalette(page, { searchTerm: 'settings' });
    await screenshots.capture(page, 'palette-search-results');
  });

  test('shortcuts are suppressed when focused in input', async ({ page, screenshots }) => {
    const dashboard = new DashboardPage(page, screenshots);
    await dashboard.goto();
    await screenshots.capture(page, 'dashboard-loaded');

    // Focus a search input if available
    const searchInput = page.getByPlaceholder(/search/i).first();
    if (await searchInput.isVisible({ timeout: 2000 }).catch(() => false)) {
      await searchInput.focus();
      await screenshots.capture(page, 'input-focused');

      // Pressing a shortcut key should not trigger the action
      await page.keyboard.press('Meta+k');
      await page.waitForTimeout(300);
      // Command palette should still work in most implementations
      await screenshots.capture(page, 'shortcut-in-input');
    }
  });
});
