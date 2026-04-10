import type { AppConfig } from '../../registry/types';

export const banterConfig: AppConfig = {
  name: 'banter',
  displayName: 'Banter',
  basePath: '/banter',
  apiBasePath: '/banter/api',
  wsPath: '/banter/ws',
  authRequired: true,
  hasDragDrop: false,
  hasKeyboardShortcuts: true,
  hasWebSocket: true,
  hasRichText: true,
  pages: [
    { name: 'home', path: '/', requiresAuth: true, interactions: ['search'] },
    { name: 'channel', path: '/channels/:slug', requiresAuth: true, requiresSetup: 'channel', interactions: ['rich-text', 'infinite-scroll', 'file-upload', 'search'] },
    { name: 'dm', path: '/dm/:id', requiresAuth: true, interactions: ['rich-text', 'infinite-scroll', 'file-upload'] },
    { name: 'browse', path: '/browse', requiresAuth: true, interactions: ['table', 'search'] },
    { name: 'bookmarks', path: '/bookmarks', requiresAuth: true, interactions: ['table'] },
    { name: 'search', path: '/search', requiresAuth: true, interactions: ['search', 'filter'] },
    { name: 'settings', path: '/settings', requiresAuth: true, interactions: ['form', 'tabs'] },
    { name: 'admin', path: '/admin', requiresAuth: true, interactions: ['table', 'form', 'modal'] },
  ],
  entities: [
    {
      name: 'channel',
      apiPath: '/channels',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Channel Name' },
        { name: 'description', type: 'textarea', label: 'Description' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Channel Name' },
        { name: 'description', type: 'textarea', label: 'Description' },
      ],
      listPath: '/browse',
      detailPath: '/channels/:slug',
      supportsPagination: false,
    },
    {
      name: 'message',
      apiPath: '/channels/:channelId/messages',
      createFields: [
        { name: 'content', type: 'rich-text', required: true },
      ],
      updateFields: [
        { name: 'content', type: 'rich-text' },
      ],
      listPath: '/channels/:slug',
      detailPath: '/channels/:slug',
      supportsPagination: true,
    },
  ],
};
