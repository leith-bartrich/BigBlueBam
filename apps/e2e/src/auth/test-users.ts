export const TEST_USERS = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'e2e-admin@bigbluebam.test',
    password: process.env.E2E_ADMIN_PASSWORD || 'E2eTestP@ss123!',
    displayName: 'E2E Admin',
    orgName: process.env.E2E_ORG_NAME || 'E2E Test Organization',
  },
  member: {
    email: process.env.E2E_MEMBER_EMAIL || 'e2e-member@bigbluebam.test',
    password: process.env.E2E_MEMBER_PASSWORD || 'E2eTestP@ss123!',
    displayName: 'E2E Member',
  },
} as const;

export type TestUserRole = keyof typeof TEST_USERS;
