import type { FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';

export function errorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
  const requestId = request.id;

  // Zod validation errors
  if (error instanceof ZodError) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        })),
        request_id: requestId,
      },
    });
  }

  // Fastify validation errors
  if (error.validation) {
    return reply.status(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: error.validation.map((v) => ({
          path: v.instancePath,
          message: v.message ?? 'Invalid value',
        })),
        request_id: requestId,
      },
    });
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests, please try again later',
        details: [],
        request_id: requestId,
      },
    });
  }

  // Known HTTP errors
  if (error.statusCode && error.statusCode < 500) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code ?? 'CLIENT_ERROR',
        message: error.message,
        details: [],
        request_id: requestId,
      },
    });
  }

  // Unknown / server errors
  request.log.error(error, 'Unhandled error');

  // Surface the underlying error cause to clients so "unexpected" is never
  // the only thing they see. We still use a generic top-line `message` and
  // `code` for stable error contracts, but include the real cause in
  // `details` so it's visible in UIs and logs. In production we redact the
  // stack trace (only name + message + code) to avoid leaking internals.
  const isProd = process.env.NODE_ENV === 'production';
  const cause = {
    name: error.name ?? 'Error',
    message: error.message ?? String(error),
    code: (error as FastifyError & { code?: string }).code,
    ...(isProd ? {} : { stack: error.stack }),
  };

  return reply.status(500).send({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred',
      details: [cause],
      request_id: requestId,
    },
  });
}
