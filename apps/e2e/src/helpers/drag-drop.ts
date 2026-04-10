import type { Page, Locator } from '@playwright/test';

/**
 * Drag an element to a target using mouse events.
 * This works with dnd-kit which uses pointer events.
 */
export async function dragElement(
  page: Page,
  source: Locator,
  target: Locator,
  options?: { steps?: number; holdMs?: number },
): Promise<void> {
  const steps = options?.steps ?? 10;
  const holdMs = options?.holdMs ?? 100;

  const sourceBounds = await source.boundingBox();
  const targetBounds = await target.boundingBox();
  if (!sourceBounds || !targetBounds) {
    throw new Error('Cannot get bounding box for source or target element');
  }

  const sourceCenter = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  };

  const targetCenter = {
    x: targetBounds.x + targetBounds.width / 2,
    y: targetBounds.y + targetBounds.height / 2,
  };

  // Move to source and press
  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();

  // Small delay to trigger drag start
  await page.waitForTimeout(holdMs);

  // Move incrementally to target
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    const x = sourceCenter.x + (targetCenter.x - sourceCenter.x) * progress;
    const y = sourceCenter.y + (targetCenter.y - sourceCenter.y) * progress;
    await page.mouse.move(x, y);
    await page.waitForTimeout(20);
  }

  // Release
  await page.mouse.up();
}

/**
 * Drag an element to reorder within a list (vertical).
 * direction: 'up' moves the element before the target, 'down' moves it after.
 */
export async function dragToReorder(
  page: Page,
  source: Locator,
  positionsToMove: number,
  direction: 'up' | 'down',
  itemHeight = 60,
): Promise<void> {
  const sourceBounds = await source.boundingBox();
  if (!sourceBounds) throw new Error('Cannot get bounding box for source');

  const sourceCenter = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  };

  const offsetY = positionsToMove * itemHeight * (direction === 'down' ? 1 : -1);

  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();
  await page.waitForTimeout(150);

  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    await page.mouse.move(sourceCenter.x, sourceCenter.y + offsetY * progress);
    await page.waitForTimeout(20);
  }

  await page.mouse.up();
}

/**
 * Drag between columns (horizontal, like Kanban).
 */
export async function dragBetweenColumns(
  page: Page,
  source: Locator,
  targetColumn: Locator,
  dropPosition: 'top' | 'bottom' = 'top',
): Promise<void> {
  const sourceBounds = await source.boundingBox();
  const colBounds = await targetColumn.boundingBox();
  if (!sourceBounds || !colBounds) {
    throw new Error('Cannot get bounding box for source or target column');
  }

  const sourceCenter = {
    x: sourceBounds.x + sourceBounds.width / 2,
    y: sourceBounds.y + sourceBounds.height / 2,
  };

  const targetPoint = {
    x: colBounds.x + colBounds.width / 2,
    y: dropPosition === 'top' ? colBounds.y + 80 : colBounds.y + colBounds.height - 20,
  };

  await page.mouse.move(sourceCenter.x, sourceCenter.y);
  await page.mouse.down();
  await page.waitForTimeout(150);

  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const progress = i / steps;
    await page.mouse.move(
      sourceCenter.x + (targetPoint.x - sourceCenter.x) * progress,
      sourceCenter.y + (targetPoint.y - sourceCenter.y) * progress,
    );
    await page.waitForTimeout(25);
  }

  await page.mouse.up();
}
