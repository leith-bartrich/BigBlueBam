import type { Scene } from '../types.js';

export const bondScenes: Scene[] = [
  {
    id: '01-pipeline',
    label: 'Pipeline board',
    route: '/bond/',
    waitFor: '[data-deal-id], main',
  },
  {
    id: '02-contacts',
    label: 'Contacts list',
    route: '/bond/contacts',
    waitFor: 'main',
  },
  {
    id: '03-deal-detail',
    label: 'Deal detail',
    route: '/bond/',
    waitFor: '[data-deal-id], main',
    setup: async (page) => {
      const card = page
        .locator(
          'button.w-full.text-left:has(span), [data-deal-id], main a[href*="/bond/deals/"], [role="button"]:has(h3)',
        )
        .first();
      if ((await card.count()) > 0) {
        await card.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '04-analytics',
    label: 'Analytics dashboard',
    route: '/bond/analytics',
    waitFor: 'main',
  },
  {
    id: '05-companies',
    label: 'Companies list',
    route: '/bond/companies',
    waitFor: 'main',
  },
];
