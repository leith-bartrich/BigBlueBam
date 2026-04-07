// Thin client for calling the BigBlueBam API (/b3/api/*) from Brief.
//
// Brief's own `api` client targets /brief/api/v1, but several header widgets
// (org switcher, notifications bell, user menu) need to talk to Bam endpoints
// because the two apps share the same session cookie and notification store.

function readCsrfToken(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]!) : null;
}

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const BBB_BASE = '/b3/api';

export class BbbApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>[],
    public requestId?: string,
  ) {
    super(message);
    this.name = 'BbbApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const url = `${BBB_BASE}${path}`;
  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfToken();
    if (csrfToken) headers['X-CSRF-Token'] = csrfToken;
  }

  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let errorData: {
      error?: {
        code?: string;
        message?: string;
        details?: Record<string, unknown>[];
        request_id?: string;
      };
    } = {};
    try {
      errorData = await response.json();
    } catch {
      // ignore parse errors
    }
    throw new BbbApiError(
      response.status,
      errorData.error?.code ?? 'UNKNOWN',
      errorData.error?.message ?? `Request failed with status ${response.status}`,
      errorData.error?.details,
      errorData.error?.request_id,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function bbbGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function bbbPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('POST', path, body);
}

export function bbbPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>('PATCH', path, body);
}

export function bbbDelete<T = void>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}
