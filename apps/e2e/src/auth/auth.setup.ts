import { test as setup, request as playwrightRequest } from '@playwright/test';
import { loginViaUI, readCsrfTokenFromCookies } from './auth.helper';
import { TEST_USERS } from './test-users';
import { DirectApiClient } from '../api/api-client';
import path from 'node:path';

const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');
const ADMIN_STATE = path.join(AUTH_DIR, 'admin.json');

setup('authenticate as admin', async ({ page }) => {
  await loginViaUI(page, TEST_USERS.admin);
  await page.context().storageState({ path: ADMIN_STATE });
});

setup('authenticate as member', async ({ page }) => {
  await loginViaUI(page, TEST_USERS.member);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'member.json') });
});

// Ensure the e2e admin has at least one project in their org, so that
// tests which need a project to exercise (board-crud, task-detail, etc.)
// have something to target. Idempotent: list first, create only if empty.
// Must run AFTER 'authenticate as admin' so that .auth/admin.json exists.
setup('seed e2e admin project', async ({ baseURL }) => {
  const apiContext = await playwrightRequest.newContext({
    baseURL,
    storageState: ADMIN_STATE,
  });

  try {
    const storage = await apiContext.storageState();
    const csrf = readCsrfTokenFromCookies(storage.cookies);
    const api = new DirectApiClient(apiContext, '/b3/api', csrf || undefined);

    const existing = await api.get<Array<{ id: string; name: string }>>('/projects');
    if (existing.length > 0) {
      console.log(
        `[seed] e2e admin already has ${existing.length} project(s); ` +
          `using existing (${existing[0].name}).`,
      );
      return;
    }

    const created = await api.post<{ id: string; name: string }>('/projects', {
      name: 'E2E Test Project',
      description: 'Created by e2e auth setup — safe to delete if empty.',
      // task_id_prefix regex is ^[A-Z]{2,6}$ — must be uppercase A-Z only,
      // which is why this is 'EEE' and not 'E2E'.
      task_id_prefix: 'EEE',
    });
    console.log(`[seed] Created e2e admin project ${created.name} (${created.id}).`);
  } finally {
    await apiContext.dispose();
  }
});
