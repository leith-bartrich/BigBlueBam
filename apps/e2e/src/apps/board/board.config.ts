import type { AppConfig } from '../../registry/types';

export const boardConfig: AppConfig = {
  name: 'board',
  displayName: 'Board',
  basePath: '/board',
  apiBasePath: '/board/api',
  wsPath: '/board/ws',
  authRequired: true,
  hasDragDrop: true,
  hasKeyboardShortcuts: false,
  hasWebSocket: true,
  hasRichText: false,
  pages: [
    { name: 'home', path: '/', requiresAuth: true, interactions: ['table', 'search'] },
    { name: 'new-board', path: '/new', requiresAuth: true, interactions: ['form'] },
    {
      name: 'canvas',
      path: '/:id',
      requiresAuth: true,
      requiresSetup: 'board',
      interactions: ['canvas', 'drag-drop', 'modal', 'form'],
    },
    {
      name: 'versions',
      path: '/:id/versions',
      requiresAuth: true,
      requiresSetup: 'board',
      interactions: ['table'],
    },
    { name: 'templates', path: '/templates', requiresAuth: true, interactions: ['table'] },
    { name: 'starred', path: '/starred', requiresAuth: true, interactions: ['table'] },
  ],
  entities: [
    {
      name: 'board',
      apiPath: '/boards',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Board Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Board Name' },
      ],
      listPath: '/',
      detailPath: '/:id',
      supportsPagination: true,
    },
    {
      name: 'scene',
      apiPath: '/boards/:boardId/scenes',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Scene Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Scene Name' },
      ],
      listPath: '/:boardId',
      detailPath: '/:boardId',
      supportsPagination: false,
    },
    {
      name: 'element',
      apiPath: '/boards/:boardId/elements',
      createFields: [
        { name: 'type', type: 'select', required: true, label: 'Element Type', options: ['rectangle', 'ellipse', 'text', 'line', 'image'] },
      ],
      updateFields: [
        { name: 'x', type: 'number', label: 'X' },
        { name: 'y', type: 'number', label: 'Y' },
      ],
      listPath: '/:boardId',
      detailPath: '/:boardId',
      supportsPagination: false,
    },
  ],
};
