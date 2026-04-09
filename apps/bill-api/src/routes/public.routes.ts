import type { FastifyInstance } from 'fastify';
import * as invoiceService from '../services/invoice.service.js';

export default async function publicRoutes(fastify: FastifyInstance) {
  // GET /invoice/:token — public invoice view (no auth, token-based)
  fastify.get<{ Params: { token: string } }>(
    '/invoice/:token',
    async (request, reply) => {
      const invoice = await invoiceService.getInvoiceByToken(request.params.token);
      return reply.send({ data: invoice });
    },
  );

  // GET /invoice/:token/pdf — public PDF download
  fastify.get<{ Params: { token: string } }>(
    '/invoice/:token/pdf',
    async (request, reply) => {
      const invoice = await invoiceService.getInvoiceByToken(request.params.token);
      if (!invoice.pdf_url) {
        return reply.status(404).send({
          error: { code: 'NOT_FOUND', message: 'PDF not yet generated', details: [] },
        });
      }
      return reply.redirect(invoice.pdf_url);
    },
  );
}
