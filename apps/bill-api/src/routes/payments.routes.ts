import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireMinRole, requireScope } from '../plugins/auth.js';
import * as paymentService from '../services/payment.service.js';
import { publishBoltEvent } from '../lib/bolt-events.js';

const recordPaymentSchema = z.object({
  amount: z.number().int().positive(),
  payment_method: z
    .enum(['bank_transfer', 'credit_card', 'check', 'cash', 'stripe', 'paypal', 'other'])
    .optional(),
  reference: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
  paid_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export default async function paymentRoutes(fastify: FastifyInstance) {
  // POST /invoices/:id/payments
  fastify.post<{ Params: { id: string } }>(
    '/invoices/:id/payments',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = recordPaymentSchema.parse(request.body);
      const payment = await paymentService.recordPayment(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
        body,
      );
      publishBoltEvent('payment.recorded', 'bill', {
        id: payment.id,
        invoice_id: request.params.id,
        amount: payment.amount,
        payment_method: payment.payment_method,
        recorded_by: request.user!.id,
      }, request.user!.org_id);
      return reply.status(201).send({ data: payment });
    },
  );

  // DELETE /payments/:id
  fastify.delete<{ Params: { id: string } }>(
    '/payments/:id',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      await paymentService.deletePayment(request.params.id, request.user!.org_id);
      return reply.send({ data: { deleted: true } });
    },
  );
}
