export const PRIORITIES = ['critical', 'high', 'medium', 'low', 'none'] as const;

export const SPRINT_STATUSES = ['planned', 'active', 'completed', 'cancelled'] as const;

export const TASK_STATE_CATEGORIES = ['todo', 'active', 'blocked', 'review', 'done', 'cancelled'] as const;

export const ORG_ROLES = ['owner', 'admin', 'member'] as const;

export const PROJECT_ROLES = ['admin', 'member', 'viewer'] as const;

export const PROJECT_TEMPLATES = ['kanban_standard', 'scrum', 'bug_tracking', 'minimal', 'none'] as const;

export const API_KEY_SCOPES = ['read', 'read_write', 'admin'] as const;

export const DEFAULT_SPRINT_DURATION_DAYS = 14;

export const MAX_PAGINATION_LIMIT = 200;

export const DEFAULT_PAGINATION_LIMIT = 50;
