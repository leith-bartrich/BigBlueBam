import type { Scene } from '../types.js';

export const bookScenes: Scene[] = [
  {
    id: '01-week-view',
    label: 'Calendar week view',
    route: '/book/',
    waitFor: 'main',
  },
  {
    id: '02-month-view',
    label: 'Calendar month view',
    route: '/book/month',
    waitFor: 'main',
  },
  {
    id: '03-day-view',
    label: 'Calendar day view',
    route: '/book/day',
    waitFor: 'main',
  },
  {
    id: '04-timeline',
    label: 'Aggregated timeline',
    route: '/book/timeline',
    waitFor: 'main',
  },
  {
    id: '05-booking-pages',
    label: 'Booking page management',
    route: '/book/booking-pages',
    waitFor: 'main',
  },
  {
    id: '06-working-hours',
    label: 'Working hours settings',
    route: '/book/settings/working-hours',
    waitFor: 'main',
  },
];
