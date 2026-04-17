import type { Scene } from '../types.js';

export const bearingScenes: Scene[] = [
  {
    id: '01-dashboard',
    label: 'Goal dashboard',
    route: '/bearing/',
    waitFor: 'main',
  },
  {
    id: '02-goal-detail',
    label: 'Goal detail',
    route: '/bearing/',
    waitFor: 'main',
    setup: async (page) => {
      const card = page.locator('a[href*="/bearing/goals/"], button:has(h3)').first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '03-timeline',
    label: 'Timeline view',
    route: '/bearing/timeline',
    waitFor: 'main',
  },
  {
    id: '04-reports',
    label: 'Progress reports',
    route: '/bearing/reports',
    waitFor: 'main',
  },
];
