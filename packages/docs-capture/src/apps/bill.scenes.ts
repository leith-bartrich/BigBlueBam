import type { Scene } from '../types.js';

export const billScenes: Scene[] = [
  {
    id: '01-invoice-list',
    label: 'Invoice list',
    route: '/bill/',
    waitFor: 'main',
  },
  {
    id: '02-invoice-new',
    label: 'New invoice',
    route: '/bill/invoices/new',
    waitFor: 'main',
  },
  {
    id: '03-clients',
    label: 'Clients list',
    route: '/bill/clients',
    waitFor: 'main',
  },
  {
    id: '04-expenses',
    label: 'Expenses list',
    route: '/bill/expenses',
    waitFor: 'main',
  },
  {
    id: '05-rates',
    label: 'Billing rates',
    route: '/bill/rates',
    waitFor: 'main',
  },
  {
    id: '06-reports',
    label: 'Financial reports',
    route: '/bill/reports',
    waitFor: 'main',
  },
  {
    id: '07-settings',
    label: 'Billing settings',
    route: '/bill/settings',
    waitFor: 'main',
  },
];
