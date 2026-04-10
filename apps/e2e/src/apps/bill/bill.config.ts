import type { AppConfig } from '../../registry/types';

export const billConfig: AppConfig = {
  name: 'bill',
  displayName: 'Bill',
  basePath: '/bill',
  apiBasePath: '/bill/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'invoices', path: '/', requiresAuth: true, interactions: ['table', 'filter', 'sort'] },
    { name: 'new-invoice', path: '/invoices/new', requiresAuth: true, interactions: ['form', 'modal'] },
    {
      name: 'invoice-detail',
      path: '/invoices/:id',
      requiresAuth: true,
      requiresSetup: 'invoice',
      interactions: ['tabs', 'modal'],
    },
    {
      name: 'edit-invoice',
      path: '/invoices/:id/edit',
      requiresAuth: true,
      requiresSetup: 'invoice',
      interactions: ['form'],
    },
    { name: 'from-time', path: '/invoices/from-time', requiresAuth: true, interactions: ['form', 'table'] },
    { name: 'clients', path: '/clients', requiresAuth: true, interactions: ['table', 'modal', 'form'] },
    {
      name: 'client-detail',
      path: '/clients/:id',
      requiresAuth: true,
      requiresSetup: 'client',
      interactions: ['tabs', 'table'],
    },
    { name: 'expenses', path: '/expenses', requiresAuth: true, interactions: ['table', 'modal', 'form'] },
    { name: 'new-expense', path: '/expenses/new', requiresAuth: true, interactions: ['form'] },
    { name: 'rates', path: '/rates', requiresAuth: true, interactions: ['table', 'form', 'modal'] },
    { name: 'reports', path: '/reports', requiresAuth: true, interactions: ['table', 'tabs'] },
    { name: 'settings', path: '/settings', requiresAuth: true, interactions: ['form', 'tabs'] },
  ],
  entities: [
    {
      name: 'invoice',
      apiPath: '/invoices',
      createFields: [
        { name: 'client_id', type: 'select', required: true, label: 'Client' },
        { name: 'due_date', type: 'date', required: true, label: 'Due Date' },
      ],
      updateFields: [
        { name: 'due_date', type: 'date', label: 'Due Date' },
      ],
      listPath: '/',
      detailPath: '/invoices/:id',
      supportsPagination: true,
    },
    {
      name: 'client',
      apiPath: '/clients',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Client Name' },
        { name: 'email', type: 'email', required: true, label: 'Email' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Client Name' },
        { name: 'email', type: 'email', label: 'Email' },
      ],
      listPath: '/clients',
      detailPath: '/clients/:id',
      supportsPagination: true,
    },
    {
      name: 'expense',
      apiPath: '/expenses',
      createFields: [
        { name: 'description', type: 'text', required: true, label: 'Description' },
        { name: 'amount', type: 'number', required: true, label: 'Amount' },
      ],
      updateFields: [
        { name: 'description', type: 'text', label: 'Description' },
        { name: 'amount', type: 'number', label: 'Amount' },
      ],
      listPath: '/expenses',
      detailPath: '/expenses',
      supportsPagination: true,
    },
    {
      name: 'rate',
      apiPath: '/rates',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Rate Name' },
        { name: 'amount', type: 'number', required: true, label: 'Amount' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Rate Name' },
        { name: 'amount', type: 'number', label: 'Amount' },
      ],
      listPath: '/rates',
      detailPath: '/rates',
      supportsPagination: false,
    },
  ],
};
