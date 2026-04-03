import type { FastifyInstance } from 'fastify';
import { eq, asc } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../db/index.js';
import { labels } from '../db/schema/labels.js';
import { requireAuth } from '../plugins/auth.js';

export default async function labelRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { id: string } }>(
    '/projects/:id/labels',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const result = await db
        .select()
        .from(labels)
        .where(eq(labels.project_id, request.params.id))
        .orderBy(asc(labels.position));

      return reply.send({ data: result });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/labels',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().max(100),
        color: z.string().max(7).optional(),
        description: z.string().optional(),
        position: z.number().int().default(0),
      });
      const data = schema.parse(request.body);

      const [label] = await db
        .insert(labels)
        .values({
          project_id: request.params.id,
          name: data.name,
          color: data.color ?? null,
          description: data.description ?? null,
          position: data.position,
        })
        .returning();

      return reply.status(201).send({ data: label });
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    '/labels/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const schema = z.object({
        name: z.string().max(100).optional(),
        color: z.string().max(7).nullable().optional(),
        description: z.string().nullable().optional(),
        position: z.number().int().optional(),
      });
      const data = schema.parse(request.body);

      const updateValues: Record<string, unknown> = { updated_at: new Date() };
      if (data.name !== undefined) updateValues.name = data.name;
      if (data.color !== undefined) updateValues.color = data.color;
      if (data.description !== undefined) updateValues.description = data.description;
      if (data.position !== undefined) updateValues.position = data.position;

      const [label] = await db
        .update(labels)
        .set(updateValues)
        .where(eq(labels.id, request.params.id))
        .returning();

      if (!label) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Label not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: label });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/labels/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const [deleted] = await db
        .delete(labels)
        .where(eq(labels.id, request.params.id))
        .returning();

      if (!deleted) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Label not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: { success: true } });
    },
  );
}
