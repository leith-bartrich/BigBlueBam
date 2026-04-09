import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireMinRole, requireScope } from '../plugins/auth.js';
import * as expenseService from '../services/expense.service.js';

const createExpenseSchema = z.object({
  project_id: z.string().uuid().optional(),
  description: z.string().min(1).max(1000),
  amount: z.number().int().positive(),
  currency: z.string().length(3).optional(),
  category: z.string().max(60).optional(),
  vendor: z.string().max(255).optional(),
  expense_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  receipt_url: z.string().url().optional(),
  receipt_filename: z.string().max(255).optional(),
  billable: z.boolean().optional(),
});

const updateExpenseSchema = createExpenseSchema.partial();

const listQuerySchema = z.object({
  project_id: z.string().uuid().optional(),
  category: z.string().optional(),
  status: z.string().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

export default async function expenseRoutes(fastify: FastifyInstance) {
  // GET /expenses
  fastify.get(
    '/expenses',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const result = await expenseService.listExpenses({
        organization_id: request.user!.org_id,
        ...query,
      });
      return reply.send(result);
    },
  );

  // POST /expenses
  fastify.post(
    '/expenses',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      const body = createExpenseSchema.parse(request.body);
      const expense = await expenseService.createExpense(body, request.user!.org_id, request.user!.id);
      return reply.status(201).send({ data: expense });
    },
  );

  // PATCH /expenses/:id
  fastify.patch<{ Params: { id: string } }>(
    '/expenses/:id',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      const body = updateExpenseSchema.parse(request.body);
      const expense = await expenseService.updateExpense(request.params.id, request.user!.org_id, body);
      return reply.send({ data: expense });
    },
  );

  // DELETE /expenses/:id
  fastify.delete<{ Params: { id: string } }>(
    '/expenses/:id',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      await expenseService.deleteExpense(request.params.id, request.user!.org_id);
      return reply.send({ data: { deleted: true } });
    },
  );

  // POST /expenses/:id/approve
  fastify.post<{ Params: { id: string } }>(
    '/expenses/:id/approve',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const expense = await expenseService.approveExpense(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.send({ data: expense });
    },
  );

  // POST /expenses/:id/reject
  fastify.post<{ Params: { id: string } }>(
    '/expenses/:id/reject',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const expense = await expenseService.rejectExpense(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.send({ data: expense });
    },
  );
}
