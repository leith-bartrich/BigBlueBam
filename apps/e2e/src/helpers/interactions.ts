import type { Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';

// --- Forms ---

export async function fillFormByLabels(
  page: Page,
  fields: Array<{ label: string; value: string; type?: 'text' | 'select' | 'textarea' }>,
): Promise<void> {
  for (const field of fields) {
    const locator = page.getByLabel(field.label);
    if (field.type === 'select') {
      await locator.selectOption(field.value);
    } else {
      await locator.fill(field.value);
    }
  }
}

export async function submitForm(page: Page, buttonText: string | RegExp = /submit|save|create/i): Promise<void> {
  await page.getByRole('button', { name: buttonText }).click();
}

export async function expectFormValidationError(page: Page, fieldLabel?: string): Promise<void> {
  if (fieldLabel) {
    // Look for an error message near the field
    const field = page.getByLabel(fieldLabel);
    const container = field.locator('..');
    await expect(
      container.locator('.text-red-500, .text-destructive, [role="alert"]').first(),
    ).toBeVisible({ timeout: 5000 });
  } else {
    await expect(
      page.locator('.text-red-500, .text-destructive, [role="alert"]').first(),
    ).toBeVisible({ timeout: 5000 });
  }
}

export async function expectNoFormErrors(page: Page): Promise<void> {
  const errors = page.locator('[role="alert"].text-destructive, .text-red-500');
  await expect(errors).toHaveCount(0);
}

// --- Modals (Radix Dialog) ---

export async function waitForModal(page: Page): Promise<Locator> {
  const dialog = page.locator('[role="dialog"]').first();
  await dialog.waitFor({ state: 'visible', timeout: 5000 });
  return dialog;
}

export async function closeModal(page: Page): Promise<void> {
  // Try the X button first, then Escape
  const closeBtn = page.locator('[role="dialog"] button[aria-label="Close"], [role="dialog"] button:has(svg.lucide-x)').first();
  if (await closeBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
    await closeBtn.click();
  } else {
    await page.keyboard.press('Escape');
  }
  await page.locator('[role="dialog"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
}

export async function expectModalVisible(page: Page, titleText?: string): Promise<void> {
  const dialog = page.locator('[role="dialog"]').first();
  await expect(dialog).toBeVisible();
  if (titleText) {
    await expect(dialog.getByText(titleText)).toBeVisible();
  }
}

export async function expectModalHidden(page: Page): Promise<void> {
  await expect(page.locator('[role="dialog"]')).not.toBeVisible();
}

// --- Dropdowns (Radix Select / DropdownMenu) ---

export async function openDropdown(trigger: Locator): Promise<void> {
  await trigger.click();
  // Wait for the Radix content to appear
  const page = trigger.page();
  await page
    .locator('[data-radix-popper-content-wrapper], [role="listbox"], [role="menu"]')
    .first()
    .waitFor({ state: 'visible', timeout: 3000 });
}

export async function selectDropdownOption(page: Page, optionText: string): Promise<void> {
  await page
    .locator('[data-radix-popper-content-wrapper] [role="option"], [role="menuitem"], [role="menuitemradio"]')
    .filter({ hasText: optionText })
    .first()
    .click();
}

export async function selectFromDropdown(trigger: Locator, optionText: string): Promise<void> {
  await openDropdown(trigger);
  await selectDropdownOption(trigger.page(), optionText);
}

// --- Tables ---

export async function getTableRowCount(page: Page, tableSelector?: string): Promise<number> {
  const table = tableSelector ? page.locator(tableSelector) : page.locator('table').first();
  return table.locator('tbody tr').count();
}

export async function getTableCellText(
  page: Page,
  row: number,
  col: number,
  tableSelector?: string,
): Promise<string | null> {
  const table = tableSelector ? page.locator(tableSelector) : page.locator('table').first();
  return table.locator(`tbody tr:nth-child(${row}) td:nth-child(${col})`).textContent();
}

export async function clickTableRow(page: Page, rowIndex: number, tableSelector?: string): Promise<void> {
  const table = tableSelector ? page.locator(tableSelector) : page.locator('table').first();
  await table.locator(`tbody tr:nth-child(${rowIndex})`).click();
}

// --- Confirmation Dialogs ---

export async function confirmAction(page: Page, confirmText: string | RegExp = /confirm|delete|yes/i): Promise<void> {
  const dialog = await waitForModal(page);
  await dialog.getByRole('button', { name: confirmText }).click();
}

export async function cancelAction(page: Page, cancelText: string | RegExp = /cancel|no/i): Promise<void> {
  const dialog = await waitForModal(page);
  await dialog.getByRole('button', { name: cancelText }).click();
}

// --- Tabs ---

export async function clickTab(page: Page, tabName: string): Promise<void> {
  await page.getByRole('tab', { name: tabName }).click();
}

export async function expectActiveTab(page: Page, tabName: string): Promise<void> {
  await expect(page.getByRole('tab', { name: tabName })).toHaveAttribute('data-state', 'active');
}

// --- Inline Editing ---

export async function inlineEdit(element: Locator, newValue: string): Promise<void> {
  await element.dblclick();
  const page = element.page();
  await page.keyboard.press('Meta+a');
  await page.keyboard.type(newValue);
  await page.keyboard.press('Enter');
}

// --- Search ---

export async function searchFor(page: Page, query: string, inputSelector?: string): Promise<void> {
  const input = inputSelector
    ? page.locator(inputSelector)
    : page.getByPlaceholder(/search/i).first();
  await input.fill(query);
  // Wait for debounced search
  await page.waitForTimeout(500);
}
