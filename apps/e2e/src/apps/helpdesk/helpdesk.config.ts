import type { AppConfig } from '../../registry/types';

// NOTE: Helpdesk has its OWN auth system separate from B3.
// It has its own login/register pages at /helpdesk/login and /helpdesk/register.
// authRequired is true, but tests may need to handle its own login flow
// (e.g., via a helpdesk-specific login helper rather than the B3 storageState).
export const helpdeskConfig: AppConfig = {
  name: 'helpdesk',
  displayName: 'Helpdesk',
  basePath: '/helpdesk',
  apiBasePath: '/helpdesk/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: false,
  pages: [
    { name: 'login', path: '/login', requiresAuth: false, interactions: ['form'] },
    { name: 'register', path: '/register', requiresAuth: false, interactions: ['form'] },
    { name: 'verify', path: '/verify', requiresAuth: false, interactions: ['form'] },
    { name: 'tickets', path: '/tickets', requiresAuth: true, interactions: ['table', 'filter', 'sort', 'search'] },
    { name: 'new-ticket', path: '/tickets/new', requiresAuth: true, interactions: ['form', 'file-upload'] },
    {
      name: 'ticket-detail',
      path: '/tickets/:id',
      requiresAuth: true,
      requiresSetup: 'ticket',
      interactions: ['form', 'file-upload'],
    },
  ],
  entities: [
    {
      name: 'ticket',
      apiPath: '/tickets',
      createFields: [
        { name: 'subject', type: 'text', required: true, label: 'Subject' },
        { name: 'description', type: 'textarea', required: true, label: 'Description' },
      ],
      updateFields: [
        { name: 'subject', type: 'text', label: 'Subject' },
        { name: 'description', type: 'textarea', label: 'Description' },
      ],
      listPath: '/tickets',
      detailPath: '/tickets/:id',
      supportsPagination: true,
      deleteRequiresConfirmation: true,
    },
  ],
};
