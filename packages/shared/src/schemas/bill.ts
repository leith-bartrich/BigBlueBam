import { z } from 'zod';

// Bill (invoicing / expenses) schemas.

export const BillInvoiceStatus = z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded']);
export const BillPaymentMethod = z.enum(['card', 'bank_transfer', 'cash', 'check', 'other']);
export const BillExpenseCategory = z.enum([
  'travel',
  'meals',
  'supplies',
  'equipment',
  'software',
  'services',
  'other',
]);

export const billLineItemSchema = z.object({
  description: z.string().min(1).max(500),
  quantity: z.number().min(0),
  unit_price_cents: z.number().int(),
  discount_cents: z.number().int().default(0),
  tax_rate: z.number().min(0).max(100).default(0),
});

export const createBillInvoiceSchema = z.object({
  customer_id: z.string().uuid(),
  number: z.string().min(1).max(50),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  currency: z.string().length(3),
  line_items: z.array(billLineItemSchema).min(1),
  notes: z.string().max(5000).optional(),
});

export const updateBillInvoiceSchema = createBillInvoiceSchema.partial().extend({
  status: BillInvoiceStatus.optional(),
});

export const createBillExpenseSchema = z.object({
  category: BillExpenseCategory,
  amount_cents: z.number().int().nonnegative(),
  currency: z.string().length(3),
  incurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().max(1000),
  project_id: z.string().uuid().optional(),
  receipt_url: z.string().url().optional(),
});

export const recordBillPaymentSchema = z.object({
  invoice_id: z.string().uuid(),
  amount_cents: z.number().int().nonnegative(),
  method: BillPaymentMethod,
  received_at: z.string().datetime(),
  reference: z.string().max(255).optional(),
});

export type BillLineItem = z.infer<typeof billLineItemSchema>;
export type CreateBillInvoiceInput = z.infer<typeof createBillInvoiceSchema>;
export type CreateBillExpenseInput = z.infer<typeof createBillExpenseSchema>;
export type RecordBillPaymentInput = z.infer<typeof recordBillPaymentSchema>;
