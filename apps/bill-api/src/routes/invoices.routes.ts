import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireMinRole, requireScope } from '../plugins/auth.js';
import * as invoiceService from '../services/invoice.service.js';
import * as lineItemService from '../services/line-item.service.js';
import * as pdfService from '../services/pdf.service.js';
import { publishBoltEvent } from '../lib/bolt-events.js';

const createInvoiceSchema = z.object({
  client_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  tax_rate: z.number().min(0).max(100).optional(),
  discount_amount: z.number().int().min(0).optional(),
  payment_terms_days: z.number().int().min(0).max(365).optional(),
  payment_instructions: z.string().max(2000).optional(),
  notes: z.string().max(5000).optional(),
  footer_text: z.string().max(2000).optional(),
  terms_text: z.string().max(5000).optional(),
  bond_deal_id: z.string().uuid().optional(),
});

const updateInvoiceSchema = createInvoiceSchema.partial();

const listQuerySchema = z.object({
  status: z.string().optional(),
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  date_from: z.string().optional(),
  date_to: z.string().optional(),
});

const createLineItemSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  unit_price: z.number().int().min(0),
  sort_order: z.number().int().optional(),
  time_entry_ids: z.array(z.string().uuid()).optional(),
  task_id: z.string().uuid().optional(),
});

const updateLineItemSchema = z.object({
  description: z.string().min(1).max(1000).optional(),
  quantity: z.number().positive().optional(),
  unit: z.string().max(20).optional(),
  unit_price: z.number().int().min(0).optional(),
  sort_order: z.number().int().optional(),
});

export default async function invoiceRoutes(fastify: FastifyInstance) {
  // GET /invoices
  fastify.get(
    '/invoices',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const result = await invoiceService.listInvoices({
        organization_id: request.user!.org_id,
        ...query,
      });
      return reply.send(result);
    },
  );

  // POST /invoices
  fastify.post(
    '/invoices',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = createInvoiceSchema.parse(request.body);
      const invoice = await invoiceService.createInvoice(body, request.user!.org_id, request.user!.id);
      publishBoltEvent('invoice.created', 'bill', {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        status: invoice.status,
        created_by: request.user!.id,
      }, request.user!.org_id);
      return reply.status(201).send({ data: invoice });
    },
  );

  // GET /invoices/:id
  fastify.get<{ Params: { id: string } }>(
    '/invoices/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const invoice = await invoiceService.getInvoice(request.params.id, request.user!.org_id);
      return reply.send({ data: invoice });
    },
  );

  // PATCH /invoices/:id
  fastify.patch<{ Params: { id: string } }>(
    '/invoices/:id',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = updateInvoiceSchema.parse(request.body);
      const invoice = await invoiceService.updateInvoice(request.params.id, request.user!.org_id, body);
      return reply.send({ data: invoice });
    },
  );

  // DELETE /invoices/:id
  fastify.delete<{ Params: { id: string } }>(
    '/invoices/:id',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      await invoiceService.deleteInvoice(request.params.id, request.user!.org_id);
      return reply.send({ data: { deleted: true } });
    },
  );

  // POST /invoices/:id/line-items
  fastify.post<{ Params: { id: string } }>(
    '/invoices/:id/line-items',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = createLineItemSchema.parse(request.body);
      const item = await lineItemService.addLineItem(request.params.id, request.user!.org_id, body);
      return reply.status(201).send({ data: item });
    },
  );

  // PATCH /invoices/:id/line-items/:itemId
  fastify.patch<{ Params: { id: string; itemId: string } }>(
    '/invoices/:id/line-items/:itemId',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = updateLineItemSchema.parse(request.body);
      const item = await lineItemService.updateLineItem(
        request.params.id,
        request.params.itemId,
        request.user!.org_id,
        body,
      );
      return reply.send({ data: item });
    },
  );

  // DELETE /invoices/:id/line-items/:itemId
  fastify.delete<{ Params: { id: string; itemId: string } }>(
    '/invoices/:id/line-items/:itemId',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      await lineItemService.deleteLineItem(request.params.id, request.params.itemId, request.user!.org_id);
      return reply.send({ data: { deleted: true } });
    },
  );

  // POST /invoices/:id/finalize
  fastify.post<{ Params: { id: string } }>(
    '/invoices/:id/finalize',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const invoice = await invoiceService.finalizeInvoice(request.params.id, request.user!.org_id);
      publishBoltEvent('invoice.finalized', 'bill', {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        status: invoice.status,
        finalized_by: request.user!.id,
      }, request.user!.org_id);
      return reply.send({ data: invoice });
    },
  );

  // POST /invoices/:id/send
  fastify.post<{ Params: { id: string } }>(
    '/invoices/:id/send',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const invoice = await invoiceService.sendInvoice(request.params.id, request.user!.org_id);
      return reply.send({ data: invoice });
    },
  );

  // POST /invoices/:id/void
  fastify.post<{ Params: { id: string } }>(
    '/invoices/:id/void',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const invoice = await invoiceService.voidInvoice(request.params.id, request.user!.org_id);
      return reply.send({ data: invoice });
    },
  );

  // POST /invoices/:id/duplicate
  fastify.post<{ Params: { id: string } }>(
    '/invoices/:id/duplicate',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const invoice = await invoiceService.duplicateInvoice(
        request.params.id,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.status(201).send({ data: invoice });
    },
  );

  // GET /invoices/:id/pdf — generate and return invoice PDF
  fastify.get<{ Params: { id: string } }>(
    '/invoices/:id/pdf',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const pdfBytes = await pdfService.generateInvoicePdf(
        request.params.id,
        request.user!.org_id,
      );

      // Fetch invoice for the filename
      const invoice = await invoiceService.getInvoice(request.params.id, request.user!.org_id);
      const filename = `${invoice.invoice_number === 'DRAFT' ? 'DRAFT' : invoice.invoice_number}.pdf`;

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `inline; filename="${filename}"`)
        .header('Content-Length', pdfBytes.length)
        .send(Buffer.from(pdfBytes));
    },
  );

  // POST /invoices/from-time-entries — create invoice from Bam time entries
  const fromTimeEntriesSchema = z.object({
    project_id: z.string().uuid(),
    time_entry_ids: z.array(z.string().uuid()).min(1),
    client_id: z.string().uuid(),
  });

  fastify.post(
    '/invoices/from-time-entries',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = fromTimeEntriesSchema.parse(request.body);
      const invoice = await invoiceService.createInvoiceFromTimeEntries(
        body,
        request.user!.org_id,
        request.user!.id,
      );
      return reply.status(201).send({ data: invoice });
    },
  );

  // POST /invoices/from-deal — create draft invoice from a Bond CRM deal
  const fromDealSchema = z.object({
    deal_id: z.string().uuid(),
    client_id: z.string().uuid(),
  });

  fastify.post(
    '/invoices/from-deal',
    { preHandler: [requireAuth, requireMinRole('admin'), requireScope('read_write')] },
    async (request, reply) => {
      const body = fromDealSchema.parse(request.body);
      const invoice = await invoiceService.createInvoiceFromDeal(
        body,
        request.user!.org_id,
        request.user!.id,
      );
      publishBoltEvent('invoice.created', 'bill', {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_id: invoice.client_id,
        status: invoice.status,
        source: 'deal',
        bond_deal_id: body.deal_id,
        created_by: request.user!.id,
      }, request.user!.org_id);
      return reply.status(201).send({ data: invoice });
    },
  );
}
