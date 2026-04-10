import type { FastifyInstance } from 'fastify';
import * as invoiceService from '../services/invoice.service.js';
import * as pdfService from '../services/pdf.service.js';

export default async function publicRoutes(fastify: FastifyInstance) {
  // GET /invoice/:token — public invoice view (no auth, token-based)
  fastify.get<{ Params: { token: string } }>(
    '/invoice/:token',
    async (request, reply) => {
      const invoice = await invoiceService.getInvoiceByToken(request.params.token);
      return reply.send({ data: invoice });
    },
  );

  // GET /invoice/:token/pdf — public PDF download (generated on-the-fly)
  fastify.get<{ Params: { token: string } }>(
    '/invoice/:token/pdf',
    async (request, reply) => {
      const { pdf, invoiceNumber } = await pdfService.generateInvoicePdfByToken(
        request.params.token,
      );
      const filename = `${invoiceNumber}.pdf`;

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${filename}"`)
        .header('Content-Length', pdf.length)
        .send(Buffer.from(pdf));
    },
  );
}
