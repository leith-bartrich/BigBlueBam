import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireScope } from '../plugins/auth.js';
import { requireMinOrgRole, requireDocumentAccess, requireDocumentEditAccess } from '../middleware/authorize.js';
import * as documentService from '../services/document.service.js';

const createDocumentSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  project_id: z.string().uuid().nullable().optional(),
  folder_id: z.string().uuid().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  visibility: z.enum(['private', 'project', 'organization']).optional(),
  icon: z.string().max(100).nullable().optional(),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  folder_id: z.string().uuid().nullable().optional(),
  icon: z.string().max(100).nullable().optional(),
  cover_image_url: z.string().max(2000).nullable().optional().refine(
    (val) => {
      if (val === null || val === undefined) return true;
      try {
        const url = new URL(val);
        return url.protocol === 'https:' || url.protocol === 'http:';
      } catch {
        return false;
      }
    },
    { message: 'cover_image_url must be an http or https URL' },
  ),
  status: z.enum(['draft', 'in_review', 'approved', 'archived']).optional(),
  visibility: z.enum(['private', 'project', 'organization']).optional(),
  pinned: z.boolean().optional(),
  plain_text: z.string().max(2_000_000).nullable().optional(),
  html_snapshot: z.string().max(5_000_000).nullable().optional(),
  word_count: z.number().int().min(0).optional(),
  project_id: z.string().uuid().nullable().optional(),
});

const listDocumentsQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
  folder_id: z.string().uuid().optional(),
  status: z.string().optional(),
  created_by: z.string().uuid().optional(),
  search: z.string().max(500).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const searchDocumentsQuerySchema = z.object({
  query: z.string().min(1).max(500),
  project_id: z.string().uuid().optional(),
  status: z.string().optional(),
});

export default async function documentRoutes(fastify: FastifyInstance) {
  // POST /documents — Create a new document
  fastify.post(
    '/documents',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireMinOrgRole('member'), requireScope('read_write')],
    },
    async (request, reply) => {
      const data = createDocumentSchema.parse(request.body);
      const doc = await documentService.createDocument(
        data,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: doc });
    },
  );

  // GET /documents/starred — User's starred documents
  fastify.get(
    '/documents/starred',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const docs = await documentService.getStarredDocuments(
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: docs });
    },
  );

  // GET /documents/recent — Recently updated documents
  fastify.get(
    '/documents/recent',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = z.object({ limit: z.coerce.number().int().min(1).max(50).optional() }).parse(request.query);
      const docs = await documentService.getRecentDocuments(
        request.user!.id,
        request.user!.org_id,
        query.limit ?? 20,
      );
      return reply.send({ data: docs });
    },
  );

  // GET /documents/search — Full-text search
  fastify.get(
    '/documents/search',
    {
      config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const query = searchDocumentsQuerySchema.parse(request.query);
      const docs = await documentService.searchDocuments(
        query.query,
        request.user!.org_id,
        request.user!.id,
        {
          projectId: query.project_id,
          status: query.status,
        },
      );
      return reply.send({ data: docs });
    },
  );

  // GET /documents/stats — Org-wide document statistics
  fastify.get(
    '/documents/stats',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const stats = await documentService.getStats(request.user!.org_id);
      return reply.send({ data: stats });
    },
  );

  // GET /documents — List documents with filters
  fastify.get(
    '/documents',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listDocumentsQuerySchema.parse(request.query);
      const result = await documentService.listDocuments({
        orgId: request.user!.org_id,
        userId: request.user!.id,
        projectId: query.project_id,
        folderId: query.folder_id,
        status: query.status,
        createdBy: query.created_by,
        search: query.search,
        cursor: query.cursor,
        limit: query.limit,
      });
      return reply.send(result);
    },
  );

  // GET /documents/:id — Get a single document
  fastify.get<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [requireAuth, requireDocumentAccess()] },
    async (request, reply) => {
      const doc = (request as any).document;
      // Exclude yjs_state from default response for size; clients fetch it separately
      const { yjs_state, ...rest } = doc;
      return reply.send({ data: rest });
    },
  );

  // PATCH /documents/:id — Update document metadata
  fastify.patch<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [requireAuth, requireDocumentEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const data = updateDocumentSchema.parse(request.body);
      const doc = await documentService.updateDocument(
        (request as any).document.id,
        data,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: doc });
    },
  );

  // DELETE /documents/:id — Archive document
  fastify.delete<{ Params: { id: string } }>(
    '/documents/:id',
    { preHandler: [requireAuth, requireDocumentEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const doc = await documentService.archiveDocument(
        (request as any).document.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: doc });
    },
  );

  // POST /documents/:id/restore — Unarchive
  fastify.post<{ Params: { id: string } }>(
    '/documents/:id/restore',
    { preHandler: [requireAuth, requireDocumentEditAccess(), requireScope('read_write')] },
    async (request, reply) => {
      const doc = await documentService.restoreDocument(
        (request as any).document.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.send({ data: doc });
    },
  );

  // POST /documents/:id/duplicate — Create a copy
  fastify.post<{ Params: { id: string } }>(
    '/documents/:id/duplicate',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth, requireDocumentAccess(), requireScope('read_write')],
    },
    async (request, reply) => {
      const doc = await documentService.duplicateDocument(
        (request as any).document.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: doc });
    },
  );

  // POST /documents/:id/star — Toggle star
  fastify.post<{ Params: { id: string } }>(
    '/documents/:id/star',
    { preHandler: [requireAuth, requireDocumentAccess()] },
    async (request, reply) => {
      const result = await documentService.toggleStar(
        (request as any).document.id,
        request.user!.id,
      );
      return reply.send({ data: result });
    },
  );

  // POST /documents/:id/promote — Graduate to Beacon
  fastify.post<{ Params: { id: string } }>(
    '/documents/:id/promote',
    { preHandler: [requireAuth, requireDocumentEditAccess(), requireMinOrgRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const result = await documentService.promoteToBeacon(
        (request as any).document.id,
        request.user!.id,
        request.user!.org_id,
      );
      return reply.status(201).send({ data: result });
    },
  );
}
