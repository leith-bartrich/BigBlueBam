import { expect } from '@playwright/test';

export interface ApiSuccessResponse<T = unknown> {
  data: T;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Array<{ field?: string; issue?: string }>;
    request_id?: string;
  };
}

export function validateSuccessEnvelope<T>(body: unknown): ApiSuccessResponse<T> {
  expect(body).toBeDefined();
  expect(body).toHaveProperty('data');
  return body as ApiSuccessResponse<T>;
}

export function validateErrorEnvelope(body: unknown): ApiErrorResponse {
  expect(body).toBeDefined();
  expect(body).toHaveProperty('error');
  const err = body as ApiErrorResponse;
  expect(err.error).toHaveProperty('code');
  expect(err.error).toHaveProperty('message');
  return err;
}

export function expectErrorCode(body: unknown, code: string): void {
  const err = validateErrorEnvelope(body);
  expect(err.error.code).toBe(code);
}
