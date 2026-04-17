import type { Scene } from '../types.js';

export const beaconScenes: Scene[] = [
  {
    id: '01-home',
    label: 'Knowledge Home',
    route: '/beacon/',
    waitFor: 'main',
  },
  {
    id: '02-browse',
    label: 'Article list',
    route: '/beacon/',
    waitFor: 'main',
    setup: async (page) => {
      const btn = page.locator('aside button:has-text("Browse")').first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(2500);
      }
    },
  },
  {
    id: '03-detail',
    label: 'Article detail',
    route: '/beacon/',
    waitFor: 'main',
    setup: async (page) => {
      // Navigate to browse first, then click first card
      const browseBtn = page.locator('aside button:has-text("Browse")').first();
      if ((await browseBtn.count()) > 0) {
        await browseBtn.click();
        await page.waitForTimeout(2000);
      }
      for (const sel of ['button.w-full.text-left', 'button:has(h3)', 'main button[class*="rounded-xl"]']) {
        const card = page.locator(sel).first();
        if ((await card.count()) > 0) {
          await card.click();
          await page.waitForTimeout(2500);
          break;
        }
      }
    },
  },
  {
    id: '04-graph',
    label: 'Knowledge graph explorer',
    route: '/beacon/',
    waitFor: 'main',
    setup: async (page) => {
      const btn = page.locator('aside button:has-text("Graph")').first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(3000);
      }
    },
  },
  {
    id: '05-dashboard',
    label: 'Governance dashboard',
    route: '/beacon/',
    waitFor: 'main',
    setup: async (page) => {
      const btn = page.locator('aside button:has-text("Dashboard")').first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '06-search',
    label: 'Search results',
    route: '/beacon/',
    waitFor: 'main',
    setup: async (page) => {
      const btn = page.locator('aside button:has-text("Search")').first();
      if ((await btn.count()) > 0) {
        await btn.click();
        await page.waitForTimeout(1500);
        const input = page.locator('input[placeholder*="earch"], input[placeholder*="query"]').first();
        if ((await input.count()) > 0) {
          await input.fill('deployment');
          await input.press('Enter');
          await page.waitForTimeout(2500);
        }
      }
    },
  },
];
