import type { Page, APIRequestContext } from '@playwright/test';

export async function loginViaUI(
  page: Page,
  credentials: { email: string; password: string },
): Promise<void> {
  await page.goto('/b3/login');
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);

  // Wait for the login API response AND the client to navigate away from /login
  const loginResponse = page.waitForResponse(
    (r) => r.url().includes('/b3/api/auth/login') && r.request().method() === 'POST',
    { timeout: 15_000 },
  );
  await page.getByRole('button', { name: /sign in/i }).click();
  const resp = await loginResponse;
  if (!resp.ok()) {
    throw new Error(`Login API returned ${resp.status()}: ${await resp.text()}`);
  }

  // Wait for the client to navigate away from /login (to dashboard or password-change gate)
  await page.waitForFunction(
    () => !window.location.pathname.endsWith('/login'),
    undefined,
    { timeout: 10_000 },
  );

  // Wait for app to finish loading
  await page.locator('.animate-spin').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
  // Give React an extra tick to settle cookies in document.cookie
  await page.waitForTimeout(500);
}

export async function loginViaAPI(
  request: APIRequestContext,
  baseURL: string,
  credentials: { email: string; password: string },
): Promise<void> {
  const response = await request.post(`${baseURL}/b3/api/auth/login`, {
    data: {
      email: credentials.email,
      password: credentials.password,
    },
  });
  if (!response.ok()) {
    throw new Error(`Login failed: ${response.status()} ${await response.text()}`);
  }
}

export async function createUserViaAPI(
  request: APIRequestContext,
  baseURL: string,
  user: { email: string; password: string; displayName: string; orgName?: string },
): Promise<boolean> {
  const response = await request.post(`${baseURL}/b3/api/auth/register`, {
    data: {
      email: user.email,
      password: user.password,
      display_name: user.displayName,
      org_name: user.orgName || 'E2E Test Org',
    },
  });
  // 201 = created, 409 = already exists (both are fine)
  return response.status() === 201;
}

export function readCsrfTokenFromCookies(cookies: Array<{ name: string; value: string }>): string | null {
  const csrf = cookies.find((c) => c.name === 'csrf_token');
  return csrf ? csrf.value : null;
}
