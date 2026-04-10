import type { APIRequestContext } from '@playwright/test';
import { validateSuccessEnvelope, validateErrorEnvelope } from './response-validator';

export class DirectApiClient {
  constructor(
    private request: APIRequestContext,
    private apiBasePath: string,
    private csrfToken?: string,
  ) {}

  private url(path: string): string {
    return `${this.apiBasePath}${path}`;
  }

  private mutationHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.csrfToken) {
      headers['X-CSRF-Token'] = this.csrfToken;
    }
    return headers;
  }

  async get<T = unknown>(path: string, params?: Record<string, string | number | boolean | undefined>): Promise<T> {
    const url = this.url(path);
    const response = await this.request.get(url, { params: params as Record<string, string> });
    const body = await response.json();
    if (!response.ok()) {
      throw new ApiClientError(response.status(), body);
    }
    return validateSuccessEnvelope<T>(body).data;
  }

  async post<T = unknown>(path: string, data?: unknown): Promise<T> {
    const response = await this.request.post(this.url(path), {
      data,
      headers: this.mutationHeaders(),
    });
    const body = await response.json();
    if (!response.ok()) {
      throw new ApiClientError(response.status(), body);
    }
    return validateSuccessEnvelope<T>(body).data;
  }

  async patch<T = unknown>(path: string, data?: unknown): Promise<T> {
    const response = await this.request.patch(this.url(path), {
      data,
      headers: this.mutationHeaders(),
    });
    const body = await response.json();
    if (!response.ok()) {
      throw new ApiClientError(response.status(), body);
    }
    return validateSuccessEnvelope<T>(body).data;
  }

  async delete(path: string): Promise<void> {
    const response = await this.request.delete(this.url(path), {
      headers: this.mutationHeaders(),
    });
    if (!response.ok()) {
      const body = await response.json().catch(() => null);
      throw new ApiClientError(response.status(), body);
    }
  }

  async getRaw(path: string, params?: Record<string, string>): Promise<{ status: number; body: unknown }> {
    const response = await this.request.get(this.url(path), { params });
    const body = await response.json().catch(() => null);
    return { status: response.status(), body };
  }

  async postRaw(path: string, data?: unknown): Promise<{ status: number; body: unknown }> {
    const response = await this.request.post(this.url(path), {
      data,
      headers: this.mutationHeaders(),
    });
    const body = await response.json().catch(() => null);
    return { status: response.status(), body };
  }
}

export class ApiClientError extends Error {
  constructor(
    public status: number,
    public body: unknown,
  ) {
    const msg = (body as { error?: { message?: string } })?.error?.message || `API error ${status}`;
    super(msg);
    this.name = 'ApiClientError';
  }

  get code(): string {
    return (this.body as { error?: { code?: string } })?.error?.code || 'UNKNOWN';
  }
}
