import { z } from 'zod';

// Bond (CRM) schemas.

export const BondLifecycleStage = z.enum([
  'lead',
  'marketing_qualified',
  'sales_qualified',
  'opportunity',
  'customer',
  'evangelist',
  'other',
]);

export const BondDealStatus = z.enum(['open', 'won', 'lost']);

export const BondActivityKind = z.enum([
  'call',
  'email',
  'meeting',
  'note',
  'task',
  'sms',
  'other',
]);

export const createBondContactSchema = z.object({
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(255).optional(),
  lifecycle_stage: BondLifecycleStage.default('lead'),
  lead_source: z.string().max(100).optional(),
  owner_id: z.string().uuid(),
});

export const updateBondContactSchema = createBondContactSchema.partial();

export const createBondCompanySchema = z.object({
  name: z.string().min(1).max(255),
  domain: z.string().max(255).optional(),
  industry: z.string().max(100).optional(),
  employee_count: z.number().int().nonnegative().optional(),
  annual_revenue_cents: z.number().int().nonnegative().optional(),
  owner_id: z.string().uuid(),
});

export const updateBondCompanySchema = createBondCompanySchema.partial();

export const createBondDealSchema = z.object({
  name: z.string().min(1).max(255),
  pipeline_id: z.string().uuid(),
  stage_id: z.string().uuid(),
  value: z.number().nonnegative().default(0),
  currency: z.string().length(3).default('USD'),
  owner_id: z.string().uuid(),
  primary_contact_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
  close_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const updateBondDealSchema = createBondDealSchema.partial().extend({
  status: BondDealStatus.optional(),
});

export const createBondActivitySchema = z.object({
  activity_type: BondActivityKind,
  subject: z.string().min(1).max(500),
  body: z.string().max(20_000).optional(),
  performed_at: z.string().datetime(),
  contact_id: z.string().uuid().optional(),
  deal_id: z.string().uuid().optional(),
  company_id: z.string().uuid().optional(),
});

export type CreateBondContactInput = z.infer<typeof createBondContactSchema>;
export type CreateBondCompanyInput = z.infer<typeof createBondCompanySchema>;
export type CreateBondDealInput = z.infer<typeof createBondDealSchema>;
export type CreateBondActivityInput = z.infer<typeof createBondActivitySchema>;
