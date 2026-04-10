import type { AppConfig } from '../../registry/types';

export const b3Config: AppConfig = {
  name: 'b3',
  displayName: 'BigBlueBam',
  basePath: '/b3',
  apiBasePath: '/b3/api',
  wsPath: '/b3/ws',
  authRequired: true,
  hasDragDrop: true,
  hasKeyboardShortcuts: true,
  hasWebSocket: true,
  hasRichText: true,
  pages: [
    { name: 'login', path: '/login', requiresAuth: false, interactions: ['form'] },
    { name: 'register', path: '/register', requiresAuth: false, interactions: ['form'] },
    { name: 'dashboard', path: '/', requiresAuth: true, interactions: ['table', 'dropdown', 'keyboard-shortcut'] },
    {
      name: 'board',
      path: '/projects/:projectId/board',
      requiresAuth: true,
      requiresSetup: 'project',
      interactions: ['drag-drop', 'modal', 'form', 'dropdown', 'inline-edit', 'keyboard-shortcut', 'filter', 'sort', 'search'],
    },
    {
      name: 'project-dashboard',
      path: '/projects/:projectId/dashboard',
      requiresAuth: true,
      requiresSetup: 'project',
      interactions: ['table', 'dropdown'],
    },
    {
      name: 'audit-log',
      path: '/projects/:projectId/audit-log',
      requiresAuth: true,
      requiresSetup: 'project',
      interactions: ['table', 'filter', 'infinite-scroll'],
    },
    {
      name: 'sprint-report',
      path: '/projects/:projectId/sprints/:sprintId/report',
      requiresAuth: true,
      requiresSetup: 'project',
      interactions: ['table'],
    },
    {
      name: 'project-reports',
      path: '/projects/:projectId/reports',
      requiresAuth: true,
      requiresSetup: 'project',
      interactions: ['table', 'tabs'],
    },
    { name: 'settings', path: '/settings', requiresAuth: true, interactions: ['form', 'tabs'] },
    { name: 'my-work', path: '/my-work', requiresAuth: true, interactions: ['table', 'filter'] },
    { name: 'people', path: '/people', requiresAuth: true, interactions: ['table', 'modal', 'form', 'tabs'] },
    { name: 'person-detail', path: '/people/:userId', requiresAuth: true, interactions: ['form', 'tabs'] },
    { name: 'superuser', path: '/superuser', requiresAuth: true, interactions: ['table'] },
    { name: 'superuser-people', path: '/superuser/people', requiresAuth: true, interactions: ['table', 'modal'] },
  ],
  entities: [
    {
      name: 'project',
      apiPath: '/projects',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Project Name' },
        { name: 'key', type: 'text', required: true, label: 'Key' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Project Name' },
      ],
      listPath: '/',
      detailPath: '/projects/:id/board',
      supportsPagination: true,
    },
    {
      name: 'task',
      apiPath: '/projects/:projectId/tasks',
      createFields: [
        { name: 'title', type: 'text', required: true, label: 'Title' },
      ],
      updateFields: [
        { name: 'title', type: 'text', label: 'Title' },
        { name: 'description', type: 'rich-text', label: 'Description' },
      ],
      listPath: '/projects/:projectId/board',
      detailPath: '/projects/:projectId/board',
      supportsPagination: true,
      deleteRequiresConfirmation: true,
    },
    {
      name: 'sprint',
      apiPath: '/projects/:projectId/sprints',
      createFields: [
        { name: 'name', type: 'text', required: true, label: 'Sprint Name' },
      ],
      updateFields: [
        { name: 'name', type: 'text', label: 'Sprint Name' },
      ],
      listPath: '/projects/:projectId/board',
      detailPath: '/projects/:projectId/sprints/:id/report',
      supportsPagination: false,
    },
  ],
};
