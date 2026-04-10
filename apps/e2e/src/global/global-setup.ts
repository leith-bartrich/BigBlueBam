import { request } from '@playwright/test';
import { TEST_USERS } from '../auth/test-users';
import { createUserViaAPI } from '../auth/auth.helper';
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const MAX_RETRIES = 30;
const RETRY_INTERVAL_MS = 2000;

async function waitForStack(baseURL: string): Promise<void> {
  const ctx = await request.newContext();
  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await ctx.get(`${baseURL}/b3/api/health/ready`);
      if (response.ok()) {
        console.log('Stack is healthy and ready.');
        await ctx.dispose();
        return;
      }
    } catch {
      // Connection refused or timeout — keep retrying
    }
    console.log(`Waiting for stack... (${i + 1}/${MAX_RETRIES})`);
    await new Promise((r) => setTimeout(r, RETRY_INTERVAL_MS));
  }
  await ctx.dispose();
  throw new Error(`Stack did not become healthy after ${MAX_RETRIES * RETRY_INTERVAL_MS / 1000}s`);
}

async function createAdminViaCLI(user: {
  email: string; password: string; displayName: string; orgName: string;
}): Promise<boolean> {
  try {
    const cmd = `docker compose exec -T api node dist/cli.js create-admin --email "${user.email}" --password "${user.password}" --name "${user.displayName}" --org "${user.orgName}"`;
    execSync(cmd, { stdio: 'pipe', cwd: path.join(__dirname, '..', '..', '..', '..') });
    return true;
  } catch (err) {
    // Already exists or CLI failed — check login via API to see if user is usable
    return false;
  }
}

async function canLogin(baseURL: string, email: string, password: string): Promise<boolean> {
  const ctx = await request.newContext();
  try {
    const response = await ctx.post(`${baseURL}/b3/api/auth/login`, {
      data: { email, password },
    });
    return response.ok();
  } catch {
    return false;
  } finally {
    await ctx.dispose();
  }
}

async function ensureTestUsers(baseURL: string): Promise<void> {
  // Admin
  let adminOk = await canLogin(baseURL, TEST_USERS.admin.email, TEST_USERS.admin.password);
  if (!adminOk) {
    console.log('Creating admin test user via CLI...');
    await createAdminViaCLI({
      email: TEST_USERS.admin.email,
      password: TEST_USERS.admin.password,
      displayName: TEST_USERS.admin.displayName,
      orgName: TEST_USERS.admin.orgName,
    });
    adminOk = await canLogin(baseURL, TEST_USERS.admin.email, TEST_USERS.admin.password);
  }
  console.log(adminOk ? 'Admin test user ready.' : 'WARNING: Admin user cannot log in');

  // Member
  let memberOk = await canLogin(baseURL, TEST_USERS.member.email, TEST_USERS.member.password);
  if (!memberOk) {
    console.log('Creating member test user via CLI...');
    await createAdminViaCLI({
      email: TEST_USERS.member.email,
      password: TEST_USERS.member.password,
      displayName: TEST_USERS.member.displayName,
      orgName: 'E2E Member Org',
    });
    memberOk = await canLogin(baseURL, TEST_USERS.member.email, TEST_USERS.member.password);
  }
  console.log(memberOk ? 'Member test user ready.' : 'WARNING: Member user cannot log in');
}

function ensureAuthDir(): void {
  const authDir = path.join(__dirname, '..', '..', '.auth');
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
}

function ensureReportsDir(): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const reportsDir = path.join(__dirname, '..', '..', 'reports', timestamp);
  fs.mkdirSync(reportsDir, { recursive: true });
  // Write the current run timestamp so the reporter can find it
  const metaPath = path.join(__dirname, '..', '..', 'reports', '.current-run');
  fs.writeFileSync(metaPath, timestamp);
  return reportsDir;
}

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost';

  console.log(`\n=== E2E Global Setup ===`);
  console.log(`Base URL: ${baseURL}`);

  ensureAuthDir();
  ensureReportsDir();
  await waitForStack(baseURL);
  await ensureTestUsers(baseURL);

  console.log('=== Global Setup Complete ===\n');
}
