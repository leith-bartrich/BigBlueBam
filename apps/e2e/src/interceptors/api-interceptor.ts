import type { Page, Route } from '@playwright/test';

export interface CapturedRequest {
  url: string;
  method: string;
  requestBody: unknown;
  status: number;
  responseBody: unknown;
  timestamp: number;
}

export class ApiInterceptor {
  private captured: CapturedRequest[] = [];

  async attach(page: Page, apiBasePath: string): Promise<void> {
    await page.route(`**${apiBasePath}/**`, async (route: Route) => {
      const response = await route.fetch();
      const body = await response.json().catch(() => null);

      this.captured.push({
        url: route.request().url(),
        method: route.request().method(),
        requestBody: await route.request().postDataJSON().catch(() => null),
        status: response.status(),
        responseBody: body,
        timestamp: Date.now(),
      });

      await route.fulfill({ response });
    });
  }

  getAll(): CapturedRequest[] {
    return [...this.captured];
  }

  getByMethod(method: string): CapturedRequest[] {
    return this.captured.filter((r) => r.method === method.toUpperCase());
  }

  getByPath(pathContains: string): CapturedRequest[] {
    return this.captured.filter((r) => r.url.includes(pathContains));
  }

  getLast(pathContains?: string): CapturedRequest | undefined {
    const filtered = pathContains ? this.getByPath(pathContains) : this.captured;
    return filtered[filtered.length - 1];
  }

  getLastResponse<T = unknown>(pathContains: string): T | undefined {
    const req = this.getLast(pathContains);
    if (!req) return undefined;
    const body = req.responseBody as { data?: T } | null;
    return body?.data as T | undefined;
  }

  clear(): void {
    this.captured = [];
  }

  assertRequestMade(method: string, pathContains: string): CapturedRequest {
    const match = this.captured.find(
      (r) => r.method === method.toUpperCase() && r.url.includes(pathContains),
    );
    if (!match) {
      throw new Error(
        `Expected ${method} request containing "${pathContains}" but none found. ` +
        `Captured: ${this.captured.map((r) => `${r.method} ${r.url}`).join(', ')}`,
      );
    }
    return match;
  }

  assertNoRequest(method: string, pathContains: string): void {
    const match = this.captured.find(
      (r) => r.method === method.toUpperCase() && r.url.includes(pathContains),
    );
    if (match) {
      throw new Error(`Expected no ${method} request containing "${pathContains}" but found one.`);
    }
  }
}
