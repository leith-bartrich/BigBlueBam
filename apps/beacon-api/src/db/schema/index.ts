// Beacon schema exports
// Re-export shared tables needed for auth (from the main BBB schema)
export {
  organizations,
  users,
  sessions,
  apiKeys,
  projects,
  organizationMemberships,
} from './bbb-refs.js';

// TODO: Add beacon-specific table schemas here
