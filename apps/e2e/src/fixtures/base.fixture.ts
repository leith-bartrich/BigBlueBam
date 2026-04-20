import { test as base, expect } from '@playwright/test';
import type { APIRequestContext } from '@playwright/test';
import { DirectApiClient } from '../api/api-client';
import { ApiInterceptor } from '../interceptors/api-interceptor';
import { UiApiChecker } from '../interceptors/ui-api-checker';
import { ScreenshotCollector } from '../helpers/screenshot';
import { readCsrfTokenFromCookies } from '../auth/auth.helper';
import type { AppConfig } from '../registry/types';

export interface TestFixtures {
  apiClient: DirectApiClient;
  apiInterceptor: ApiInterceptor;
  uiApiChecker: UiApiChecker;
  screenshots: ScreenshotCollector;
}

export const test = base.extend<TestFixtures>({
  apiClient: async ({ request, context }, use) => {
    const cookies = await context.cookies();
    const csrfToken = readCsrfTokenFromCookies(cookies) || undefined;
    const client = new DirectApiClient(request, '/b3/api', csrfToken);
    await use(client);
  },

  apiInterceptor: async ({ page }, use) => {
    const interceptor = new ApiInterceptor();
    await use(interceptor);
  },

  uiApiChecker: async ({ page, apiClient }, use) => {
    const checker = new UiApiChecker(page, apiClient);
    await use(checker);
  },

  screenshots: async ({ page }, use, testInfo) => {
    const collector = new ScreenshotCollector(page, testInfo);
    await use(collector);
  },
});

export { expect };

export function createAppApiClient(
  request: APIRequestContext,
  cookies: Array<{ name: string; value: string }>,
  appConfig: AppConfig,
): DirectApiClient {
  const csrfToken = readCsrfTokenFromCookies(cookies) || undefined;
  return new DirectApiClient(request, appConfig.apiBasePath, csrfToken);
}
