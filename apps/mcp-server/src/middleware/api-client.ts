import type { Logger } from 'pino';

export interface ApiResult<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export class ApiClient {
  private baseUrl: string;
  private token: string;
  private logger: Logger;

  constructor(baseUrl: string, token: string, logger: Logger) {
    // Remove trailing slash
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.token = token;
    this.logger = logger;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResult<T>> {
    const url = `${this.baseUrl}${path}`;

    this.logger.debug({ method, url }, 'API request');

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.token}`,
    };

    const init: RequestInit = { method, headers };

    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }

    try {
      const response = await fetch(url, init);
      const data = (await response.json()) as T;

      this.logger.debug({ method, url, status: response.status }, 'API response');

      return {
        ok: response.ok,
        status: response.status,
        data,
      };
    } catch (error) {
      this.logger.error({ method, url, error }, 'API request failed');
      return {
        ok: false,
        status: 0,
        data: { error: error instanceof Error ? error.message : 'Unknown error' } as T,
      };
    }
  }

  async get<T = unknown>(path: string): Promise<ApiResult<T>> {
    return this.request<T>('GET', path);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.request<T>('POST', path, body);
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.request<T>('PATCH', path, body);
  }

  async put<T = unknown>(path: string, body: unknown): Promise<ApiResult<T>> {
    return this.request<T>('PUT', path, body);
  }

  async delete<T = unknown>(path: string): Promise<ApiResult<T>> {
    return this.request<T>('DELETE', path);
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }
}
