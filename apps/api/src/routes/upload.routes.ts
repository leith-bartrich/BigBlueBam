import type { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { randomUUID } from 'node:crypto';
import { env } from '../env.js';
import { uploadFile, getFileUrl, deleteFile } from '../services/upload.service.js';
import { requireAuth } from '../plugins/auth.js';

const MAX_FILE_SIZE = env.UPLOAD_MAX_FILE_SIZE; // 25MB

const ALLOWED_MIME_PREFIXES = ['image/'];
const ALLOWED_MIME_EXACT = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

function isAllowedMimeType(mimeType: string): boolean {
  if (ALLOWED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return true;
  if (ALLOWED_MIME_EXACT.includes(mimeType)) return true;
  return false;
}

export default async function uploadRoutes(fastify: FastifyInstance) {
  await fastify.register(multipart, {
    limits: {
      fileSize: MAX_FILE_SIZE,
    },
  });

  // POST /upload — accept multipart file upload, store in MinIO
  fastify.post(
    '/upload',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const file = await request.file();

      if (!file) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'No file provided',
            details: [],
            request_id: request.id,
          },
        });
      }

      const contentType = file.mimetype;

      if (!isAllowedMimeType(contentType)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: `File type "${contentType}" is not allowed`,
            details: [],
            request_id: request.id,
          },
        });
      }

      const buffer = await file.toBuffer();

      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: `File exceeds maximum size of ${MAX_FILE_SIZE} bytes`,
            details: [],
            request_id: request.id,
          },
        });
      }

      const uuid = randomUUID();
      const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const key = `uploads/${uuid}-${safeFilename}`;

      await uploadFile(env.S3_BUCKET, key, buffer, contentType);

      // Return a proxy URL through our API (not a direct MinIO URL)
      const url = `/api/files/${key}`;

      return reply.status(201).send({
        data: {
          url,
          key,
          filename: file.filename,
          content_type: contentType,
          size_bytes: buffer.length,
        },
      });
    },
  );

  // GET /files/*  — proxy file downloads from MinIO
  fastify.get(
    '/files/*',
    {},
    async (request, reply) => {
      const key = (request.params as Record<string, string>)['*'];

      if (!key) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'File key is required',
            details: [],
            request_id: request.id,
          },
        });
      }

      try {
        const url = await getFileUrl(env.S3_BUCKET, key);
        return reply.redirect(302, url);
      } catch {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'File not found',
            details: [],
            request_id: request.id,
          },
        });
      }
    },
  );
}
