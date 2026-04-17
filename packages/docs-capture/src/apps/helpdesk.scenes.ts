import type { Scene } from '../types.js';

export const helpdeskScenes: Scene[] = [
  {
    id: '01-portal',
    label: 'Support portal',
    route: '/helpdesk/',
    waitFor: 'main',
  },
  {
    id: '02-ticket-list',
    label: 'Ticket list',
    route: '/helpdesk/tickets',
    waitFor: 'main',
  },
  {
    id: '03-new-ticket',
    label: 'New ticket form',
    route: '/helpdesk/tickets/new',
    waitFor: 'main',
  },
  {
    id: '04-ticket-detail',
    label: 'Ticket detail',
    route: '/helpdesk/tickets',
    waitFor: 'main',
    setup: async (page) => {
      const row = page.locator('table tbody tr, main a[href*="tickets/"]').first();
      if ((await row.count()) > 0) {
        await row.click();
        await page.waitForTimeout(2000);
      }
    },
  },
  {
    id: '05-knowledge-base',
    label: 'Knowledge base',
    route: '/helpdesk/kb',
    waitFor: 'main',
  },
];
