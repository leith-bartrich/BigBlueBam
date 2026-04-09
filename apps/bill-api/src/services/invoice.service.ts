import { eq, and, desc, sql, gte, lte } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  billInvoices,
  billLineItems,
  billPayments,
  billInvoiceSequences,
  billSettings,
  billClients,
} from '../db/schema/index.js';
import { notFound, badRequest, formatInvoiceNumber } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InvoiceFilters {
  organization_id: string;
  status?: string;
  client_id?: string;
  project_id?: string;
  date_from?: string;
  date_to?: string;
}

export interface CreateInvoiceInput {
  client_id: string;
  project_id?: string;
  invoice_date?: string;
  due_date?: string;
  tax_rate?: number;
  discount_amount?: number;
  payment_terms_days?: number;
  payment_instructions?: string;
  notes?: string;
  footer_text?: string;
  terms_text?: string;
  bond_deal_id?: string;
}

export interface UpdateInvoiceInput {
  client_id?: string;
  project_id?: string;
  invoice_date?: string;
  due_date?: string;
  tax_rate?: number;
  discount_amount?: number;
  payment_terms_days?: number;
  payment_instructions?: string;
  notes?: string;
  footer_text?: string;
  terms_text?: string;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listInvoices(filters: InvoiceFilters) {
  const conditions: any[] = [eq(billInvoices.organization_id, filters.organization_id)];

  if (filters.status) conditions.push(eq(billInvoices.status, filters.status));
  if (filters.client_id) conditions.push(eq(billInvoices.client_id, filters.client_id));
  if (filters.project_id) conditions.push(eq(billInvoices.project_id, filters.project_id));
  if (filters.date_from) conditions.push(gte(billInvoices.invoice_date, filters.date_from));
  if (filters.date_to) conditions.push(lte(billInvoices.invoice_date, filters.date_to));

  const rows = await db
    .select()
    .from(billInvoices)
    .where(and(...conditions))
    .orderBy(desc(billInvoices.created_at));

  return { data: rows };
}

// ---------------------------------------------------------------------------
// Get with line items and payments
// ---------------------------------------------------------------------------

export async function getInvoice(id: string, orgId: string) {
  const [invoice] = await db
    .select()
    .from(billInvoices)
    .where(and(eq(billInvoices.id, id), eq(billInvoices.organization_id, orgId)))
    .limit(1);

  if (!invoice) throw notFound('Invoice not found');

  const lineItems = await db
    .select()
    .from(billLineItems)
    .where(eq(billLineItems.invoice_id, id))
    .orderBy(billLineItems.sort_order);

  const payments = await db
    .select()
    .from(billPayments)
    .where(eq(billPayments.invoice_id, id))
    .orderBy(desc(billPayments.created_at));

  return { ...invoice, line_items: lineItems, payments };
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createInvoice(input: CreateInvoiceInput, orgId: string, userId: string) {
  // Load settings for defaults
  const [settings] = await db
    .select()
    .from(billSettings)
    .where(eq(billSettings.organization_id, orgId))
    .limit(1);

  // Load client for snapshot
  const [client] = await db
    .select()
    .from(billClients)
    .where(and(eq(billClients.id, input.client_id), eq(billClients.organization_id, orgId)))
    .limit(1);

  if (!client) throw badRequest('Client not found');

  const paymentDays = input.payment_terms_days ?? client.default_payment_terms_days ?? settings?.default_payment_terms_days ?? 30;
  const invoiceDate = input.invoice_date ?? new Date().toISOString().split('T')[0]!;
  const dueDate = input.due_date ?? new Date(Date.now() + paymentDays * 86400000).toISOString().split('T')[0]!;

  // Build client address
  const toAddress = [client.address_line1, client.address_line2, [client.city, client.state_region, client.postal_code].filter(Boolean).join(', '), client.country].filter(Boolean).join('\n');

  const [invoice] = await db
    .insert(billInvoices)
    .values({
      organization_id: orgId,
      client_id: input.client_id,
      project_id: input.project_id,
      invoice_number: 'DRAFT',
      invoice_date: invoiceDate,
      due_date: dueDate,
      status: 'draft',
      tax_rate: String(input.tax_rate ?? settings?.default_tax_rate ?? 0),
      discount_amount: input.discount_amount ?? 0,
      payment_terms_days: paymentDays,
      payment_instructions: input.payment_instructions ?? client.default_payment_instructions ?? settings?.default_payment_instructions,
      notes: input.notes,
      footer_text: input.footer_text ?? settings?.default_footer_text,
      terms_text: input.terms_text ?? settings?.default_terms_text,
      from_name: settings?.company_name,
      from_email: settings?.company_email,
      from_address: settings?.company_address,
      from_logo_url: settings?.company_logo_url,
      from_tax_id: settings?.company_tax_id,
      to_name: client.name,
      to_email: client.email,
      to_address: toAddress || null,
      to_tax_id: client.tax_id,
      bond_deal_id: input.bond_deal_id,
      created_by: userId,
    })
    .returning();

  return invoice!;
}

// ---------------------------------------------------------------------------
// Update (draft only)
// ---------------------------------------------------------------------------

export async function updateInvoice(id: string, orgId: string, input: UpdateInvoiceInput) {
  const existing = await getInvoice(id, orgId);
  if (existing.status !== 'draft') {
    throw badRequest('Can only edit invoices in draft status');
  }

  const updateData: Record<string, unknown> = { updated_at: new Date() };
  if (input.client_id !== undefined) updateData.client_id = input.client_id;
  if (input.project_id !== undefined) updateData.project_id = input.project_id;
  if (input.invoice_date !== undefined) updateData.invoice_date = input.invoice_date;
  if (input.due_date !== undefined) updateData.due_date = input.due_date;
  if (input.tax_rate !== undefined) updateData.tax_rate = String(input.tax_rate);
  if (input.discount_amount !== undefined) updateData.discount_amount = input.discount_amount;
  if (input.payment_terms_days !== undefined) updateData.payment_terms_days = input.payment_terms_days;
  if (input.payment_instructions !== undefined) updateData.payment_instructions = input.payment_instructions;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.footer_text !== undefined) updateData.footer_text = input.footer_text;
  if (input.terms_text !== undefined) updateData.terms_text = input.terms_text;

  const [updated] = await db
    .update(billInvoices)
    .set(updateData)
    .where(and(eq(billInvoices.id, id), eq(billInvoices.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Invoice not found');

  // Recalculate totals
  await recalculateInvoiceTotals(id);

  return getInvoice(id, orgId);
}

// ---------------------------------------------------------------------------
// Delete (draft only)
// ---------------------------------------------------------------------------

export async function deleteInvoice(id: string, orgId: string) {
  const existing = await getInvoice(id, orgId);
  if (existing.status !== 'draft') {
    throw badRequest('Can only delete invoices in draft status');
  }

  const [deleted] = await db
    .delete(billInvoices)
    .where(and(eq(billInvoices.id, id), eq(billInvoices.organization_id, orgId)))
    .returning({ id: billInvoices.id });

  if (!deleted) throw notFound('Invoice not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Finalize (assign number, lock edits)
// ---------------------------------------------------------------------------

export async function finalizeInvoice(id: string, orgId: string) {
  const existing = await getInvoice(id, orgId);
  if (existing.status !== 'draft') {
    throw badRequest('Invoice is already finalized');
  }

  // Get or create sequence
  let [seq] = await db
    .select()
    .from(billInvoiceSequences)
    .where(eq(billInvoiceSequences.organization_id, orgId))
    .limit(1);

  if (!seq) {
    const [settings] = await db
      .select()
      .from(billSettings)
      .where(eq(billSettings.organization_id, orgId))
      .limit(1);

    [seq] = await db
      .insert(billInvoiceSequences)
      .values({
        organization_id: orgId,
        prefix: settings?.invoice_prefix ?? 'INV',
        next_number: 1,
      })
      .returning();
  }

  const invoiceNumber = formatInvoiceNumber(seq!.prefix, seq!.next_number);

  // Increment sequence
  await db
    .update(billInvoiceSequences)
    .set({ next_number: seq!.next_number + 1 })
    .where(eq(billInvoiceSequences.organization_id, orgId));

  // Recalculate totals
  await recalculateInvoiceTotals(id);

  // Update invoice
  const [finalized] = await db
    .update(billInvoices)
    .set({
      invoice_number: invoiceNumber,
      status: 'sent',
      sent_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(billInvoices.id, id))
    .returning();

  return finalized!;
}

// ---------------------------------------------------------------------------
// Void
// ---------------------------------------------------------------------------

export async function voidInvoice(id: string, orgId: string) {
  const existing = await getInvoice(id, orgId);
  if (existing.status === 'void') {
    throw badRequest('Invoice is already voided');
  }
  if (existing.status === 'draft') {
    throw badRequest('Cannot void a draft invoice — delete it instead');
  }

  const [voided] = await db
    .update(billInvoices)
    .set({ status: 'void', updated_at: new Date() })
    .where(and(eq(billInvoices.id, id), eq(billInvoices.organization_id, orgId)))
    .returning();

  if (!voided) throw notFound('Invoice not found');
  return voided;
}

// ---------------------------------------------------------------------------
// Duplicate
// ---------------------------------------------------------------------------

export async function duplicateInvoice(id: string, orgId: string, userId: string) {
  const existing = await getInvoice(id, orgId);

  const [newInvoice] = await db
    .insert(billInvoices)
    .values({
      organization_id: orgId,
      client_id: existing.client_id,
      project_id: existing.project_id,
      invoice_number: 'DRAFT',
      invoice_date: new Date().toISOString().split('T')[0]!,
      due_date: new Date(Date.now() + existing.payment_terms_days * 86400000).toISOString().split('T')[0]!,
      status: 'draft',
      tax_rate: existing.tax_rate,
      discount_amount: existing.discount_amount,
      payment_terms_days: existing.payment_terms_days,
      payment_instructions: existing.payment_instructions,
      notes: existing.notes,
      footer_text: existing.footer_text,
      terms_text: existing.terms_text,
      from_name: existing.from_name,
      from_email: existing.from_email,
      from_address: existing.from_address,
      from_logo_url: existing.from_logo_url,
      from_tax_id: existing.from_tax_id,
      to_name: existing.to_name,
      to_email: existing.to_email,
      to_address: existing.to_address,
      to_tax_id: existing.to_tax_id,
      created_by: userId,
    })
    .returning();

  // Duplicate line items
  if (existing.line_items.length > 0) {
    await db.insert(billLineItems).values(
      existing.line_items.map((li, idx) => ({
        invoice_id: newInvoice!.id,
        sort_order: idx,
        description: li.description,
        quantity: li.quantity,
        unit: li.unit,
        unit_price: li.unit_price,
        amount: li.amount,
      })),
    );
  }

  await recalculateInvoiceTotals(newInvoice!.id);

  return getInvoice(newInvoice!.id, orgId);
}

// ---------------------------------------------------------------------------
// Send (mark as sent)
// ---------------------------------------------------------------------------

export async function sendInvoice(id: string, orgId: string) {
  const existing = await getInvoice(id, orgId);
  if (existing.status === 'draft') {
    throw badRequest('Finalize the invoice before sending');
  }
  if (existing.status === 'void') {
    throw badRequest('Cannot send a voided invoice');
  }

  const [sent] = await db
    .update(billInvoices)
    .set({ status: 'sent', sent_at: new Date(), updated_at: new Date() })
    .where(and(eq(billInvoices.id, id), eq(billInvoices.organization_id, orgId)))
    .returning();

  if (!sent) throw notFound('Invoice not found');
  return sent;
}

// ---------------------------------------------------------------------------
// Public view by token
// ---------------------------------------------------------------------------

export async function getInvoiceByToken(token: string) {
  const [invoice] = await db
    .select()
    .from(billInvoices)
    .where(eq(billInvoices.public_view_token, token))
    .limit(1);

  if (!invoice) throw notFound('Invoice not found');

  // Mark as viewed
  if (!invoice.viewed_at) {
    await db
      .update(billInvoices)
      .set({ viewed_at: new Date(), status: invoice.status === 'sent' ? 'viewed' : invoice.status })
      .where(eq(billInvoices.id, invoice.id));
  }

  const lineItems = await db
    .select()
    .from(billLineItems)
    .where(eq(billLineItems.invoice_id, invoice.id))
    .orderBy(billLineItems.sort_order);

  return { ...invoice, line_items: lineItems };
}

// ---------------------------------------------------------------------------
// Recalculate totals
// ---------------------------------------------------------------------------

export async function recalculateInvoiceTotals(invoiceId: string) {
  // Sum line items
  const [result] = await db
    .select({
      subtotal: sql<number>`COALESCE(SUM(${billLineItems.amount}), 0)::bigint`,
    })
    .from(billLineItems)
    .where(eq(billLineItems.invoice_id, invoiceId));

  const subtotal = Number(result?.subtotal ?? 0);

  // Get current invoice for tax_rate and discount
  const [inv] = await db
    .select()
    .from(billInvoices)
    .where(eq(billInvoices.id, invoiceId))
    .limit(1);

  if (!inv) return;

  const taxRate = Number(inv.tax_rate ?? 0);
  const discountAmount = Number(inv.discount_amount ?? 0);
  const taxAmount = Math.round(subtotal * taxRate / 100);
  const total = subtotal + taxAmount - discountAmount;

  // Sum payments
  const [payResult] = await db
    .select({
      total_paid: sql<number>`COALESCE(SUM(${billPayments.amount}), 0)::bigint`,
    })
    .from(billPayments)
    .where(eq(billPayments.invoice_id, invoiceId));

  const amountPaid = Number(payResult?.total_paid ?? 0);

  await db
    .update(billInvoices)
    .set({
      subtotal,
      tax_amount: taxAmount,
      total,
      amount_paid: amountPaid,
      updated_at: new Date(),
    })
    .where(eq(billInvoices.id, invoiceId));
}
