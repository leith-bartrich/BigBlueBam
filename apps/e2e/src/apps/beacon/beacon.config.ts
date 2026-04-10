import type { AppConfig } from '../../registry/types';

export const beaconConfig: AppConfig = {
  name: 'beacon',
  displayName: 'Beacon',
  basePath: '/beacon',
  apiBasePath: '/beacon/api',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: false,
  hasWebSocket: false,
  hasRichText: true,
  pages: [
    { name: 'home', path: '/', requiresAuth: true, interactions: ['search'] },
    { name: 'list', path: '/list', requiresAuth: true, interactions: ['table', 'filter', 'sort', 'search'] },
    { name: 'search', path: '/search', requiresAuth: true, interactions: ['search', 'filter'] },
    { name: 'detail', path: '/:idOrSlug', requiresAuth: true, requiresSetup: 'beacon', interactions: ['rich-text'] },
    { name: 'edit', path: '/:idOrSlug/edit', requiresAuth: true, requiresSetup: 'beacon', interactions: ['form', 'rich-text'] },
    { name: 'create', path: '/create', requiresAuth: true, interactions: ['form', 'rich-text'] },
    { name: 'graph', path: '/graph', requiresAuth: true, interactions: ['canvas'] },
    { name: 'dashboard', path: '/dashboard', requiresAuth: true, interactions: ['table'] },
    { name: 'settings', path: '/settings', requiresAuth: true, interactions: ['form', 'tabs'] },
  ],
  entities: [
    {
      name: 'beacon',
      apiPath: '/articles',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
        { name: 'content', type: 'rich-text', required: true, label: 'Content' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'content', type: 'rich-text', label: 'Content' },
      ],
      listPath: '/list',
      detailPath: '/:idOrSlug',
      supportsPagination: true,
    },
    {
      name: 'tag',
      apiPath: '/tags',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Tag Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Tag Name' },
      ],
      listPath: '/list',
      detailPath: '/list',
      supportsPagination: false,
    },
    {
      name: 'link',
      apiPath: '/links',
      createFields: [
        { name: 'url', type: 'text', required: true, label: 'URL' },
        { name: 'title', type: 'text', label: 'Title' },
      ],
      updateFields: [
        { name: 'url', type: 'text', label: 'URL' },
        { name: 'title', type: 'text', label: 'Title' },
      ],
      listPath: '/list',
      detailPath: '/:idOrSlug',
      supportsPagination: false,
    },
  ],
};
