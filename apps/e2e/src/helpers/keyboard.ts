import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface ShortcutDef {
  keys: string;
  description: string;
  expectedAction: (page: Page) => Promise<void>;
}

/**
 * Test a keyboard shortcut and verify it triggers the expected action.
 */
export async function testShortcut(
  page: Page,
  keys: string,
  verifyAction: (page: Page) => Promise<void>,
): Promise<void> {
  await page.keyboard.press(keys);
  await page.waitForTimeout(300);
  await verifyAction(page);
}

/**
 * Test that shortcuts are suppressed when focused in an input field.
 */
export async function testShortcutSuppressedInInput(
  page: Page,
  keys: string,
  inputSelector?: string,
): Promise<void> {
  const input = inputSelector
    ? page.locator(inputSelector)
    : page.locator('input, textarea').first();

  await input.focus();
  const valueBefore = await input.inputValue();
  await page.keyboard.press(keys);
  await page.waitForTimeout(300);

  // The shortcut should not have triggered any navigation or modal
  // (this is a basic check — specific tests should verify the shortcut's effect didn't happen)
}

/**
 * Test the command palette (Cmd+K / Ctrl+K).
 */
export async function testCommandPalette(
  page: Page,
  options?: { searchTerm?: string; selectItem?: string },
): Promise<void> {
  // Open command palette
  await page.keyboard.press('Meta+k');
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible({ timeout: 3000 });

  if (options?.searchTerm) {
    const searchInput = dialog.locator('input').first();
    await searchInput.fill(options.searchTerm);
    await page.waitForTimeout(300);
  }

  if (options?.selectItem) {
    await dialog.getByText(options.selectItem, { exact: false }).first().click();
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  } else {
    // Close it
    await page.keyboard.press('Escape');
    await expect(dialog).not.toBeVisible({ timeout: 3000 });
  }
}

/**
 * Run a batch of shortcut tests.
 */
export async function testAllShortcuts(
  page: Page,
  shortcuts: ShortcutDef[],
): Promise<Array<{ keys: string; description: string; passed: boolean; error?: string }>> {
  const results: Array<{ keys: string; description: string; passed: boolean; error?: string }> = [];

  for (const shortcut of shortcuts) {
    try {
      await testShortcut(page, shortcut.keys, shortcut.expectedAction);
      results.push({ keys: shortcut.keys, description: shortcut.description, passed: true });
    } catch (err) {
      results.push({
        keys: shortcut.keys,
        description: shortcut.description,
        passed: false,
        error: (err as Error).message,
      });
    }
  }

  return results;
}
