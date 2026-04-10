import { test as setup } from '@playwright/test';
import { loginViaUI } from './auth.helper';
import { TEST_USERS } from './test-users';
import path from 'node:path';

const AUTH_DIR = path.join(__dirname, '..', '..', '.auth');

setup('authenticate as admin', async ({ page }) => {
  await loginViaUI(page, TEST_USERS.admin);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'admin.json') });
});

setup('authenticate as member', async ({ page }) => {
  await loginViaUI(page, TEST_USERS.member);
  await page.context().storageState({ path: path.join(AUTH_DIR, 'member.json') });
});
