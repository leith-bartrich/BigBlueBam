import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

/**
 * Test cursor-based pagination by clicking "load more" or scrolling.
 */
export async function testLoadMorePagination(
  page: Page,
  options: {
    loadMoreSelector?: string;
    loadMoreText?: string | RegExp;
    apiPathContains: string;
    itemSelector: string;
    maxPages?: number;
  },
): Promise<{ totalItems: number; pagesLoaded: number }> {
  const maxPages = options.maxPages ?? 5;
  let pagesLoaded = 1;

  // Get initial count
  let itemCount = await page.locator(options.itemSelector).count();

  for (let i = 0; i < maxPages - 1; i++) {
    const loadMore = options.loadMoreSelector
      ? page.locator(options.loadMoreSelector)
      : page.getByRole('button', { name: options.loadMoreText || /load more|show more/i });

    if (!(await loadMore.isVisible({ timeout: 2000 }).catch(() => false))) {
      break;
    }

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes(options.apiPathContains) && r.status() === 200,
    );

    await loadMore.click();
    await responsePromise;

    const newCount = await page.locator(options.itemSelector).count();
    expect(newCount).toBeGreaterThan(itemCount);
    itemCount = newCount;
    pagesLoaded++;
  }

  return { totalItems: itemCount, pagesLoaded };
}

/**
 * Test infinite scroll pagination by scrolling to bottom.
 */
export async function testInfiniteScrollPagination(
  page: Page,
  options: {
    scrollContainerSelector?: string;
    apiPathContains: string;
    itemSelector: string;
    maxScrolls?: number;
  },
): Promise<{ totalItems: number; scrollsPerformed: number }> {
  const maxScrolls = options.maxScrolls ?? 5;
  let scrollsPerformed = 0;

  let itemCount = await page.locator(options.itemSelector).count();

  for (let i = 0; i < maxScrolls; i++) {
    const responsePromise = page
      .waitForResponse(
        (r) => r.url().includes(options.apiPathContains) && r.status() === 200,
        { timeout: 3000 },
      )
      .catch(() => null);

    if (options.scrollContainerSelector) {
      await page.locator(options.scrollContainerSelector).evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
    } else {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    }

    const response = await responsePromise;
    if (!response) break;

    await page.waitForTimeout(500);
    const newCount = await page.locator(options.itemSelector).count();
    if (newCount === itemCount) break;

    itemCount = newCount;
    scrollsPerformed++;
  }

  return { totalItems: itemCount, scrollsPerformed };
}

/**
 * Verify no duplicate items in a list by extracting text from each item.
 */
export async function verifyNoDuplicates(
  page: Page,
  itemSelector: string,
  textExtractor?: (el: HTMLElement) => string,
): Promise<void> {
  const texts = await page.locator(itemSelector).evaluateAll(
    (els, extractor) => {
      return els.map((el) => (el as HTMLElement).textContent?.trim() || '');
    },
  );

  const seen = new Set<string>();
  const duplicates: string[] = [];
  for (const text of texts) {
    if (seen.has(text)) {
      duplicates.push(text);
    }
    seen.add(text);
  }

  if (duplicates.length > 0) {
    throw new Error(`Found duplicate items: ${duplicates.join(', ')}`);
  }
}
