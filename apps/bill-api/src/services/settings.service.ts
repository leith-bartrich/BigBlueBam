import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { billSettings } from '../db/schema/index.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpdateSettingsInput {
  company_name?: string;
  company_email?: string;
  company_phone?: string;
  company_address?: string;
  company_logo_url?: string;
  company_tax_id?: string;
  default_currency?: string;
  default_tax_rate?: number;
  default_payment_terms_days?: number;
  default_payment_instructions?: string;
  default_footer_text?: string;
  default_terms_text?: string;
  invoice_prefix?: string;
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getSettings(orgId: string) {
  const [settings] = await db
    .select()
    .from(billSettings)
    .where(eq(billSettings.organization_id, orgId))
    .limit(1);

  if (!settings) {
    // Return defaults
    return {
      organization_id: orgId,
      company_name: null,
      company_email: null,
      company_phone: null,
      company_address: null,
      company_logo_url: null,
      company_tax_id: null,
      default_currency: 'USD',
      default_tax_rate: '0',
      default_payment_terms_days: 30,
      default_payment_instructions: null,
      default_footer_text: null,
      default_terms_text: null,
      invoice_prefix: 'INV',
      updated_at: new Date(),
    };
  }

  return settings;
}

// ---------------------------------------------------------------------------
// Upsert
// ---------------------------------------------------------------------------

export async function updateSettings(orgId: string, input: UpdateSettingsInput) {
  const updateData: Record<string, unknown> = { updated_at: new Date() };

  if (input.company_name !== undefined) updateData.company_name = input.company_name;
  if (input.company_email !== undefined) updateData.company_email = input.company_email;
  if (input.company_phone !== undefined) updateData.company_phone = input.company_phone;
  if (input.company_address !== undefined) updateData.company_address = input.company_address;
  if (input.company_logo_url !== undefined) updateData.company_logo_url = input.company_logo_url;
  if (input.company_tax_id !== undefined) updateData.company_tax_id = input.company_tax_id;
  if (input.default_currency !== undefined) updateData.default_currency = input.default_currency;
  if (input.default_tax_rate !== undefined) updateData.default_tax_rate = String(input.default_tax_rate);
  if (input.default_payment_terms_days !== undefined) updateData.default_payment_terms_days = input.default_payment_terms_days;
  if (input.default_payment_instructions !== undefined) updateData.default_payment_instructions = input.default_payment_instructions;
  if (input.default_footer_text !== undefined) updateData.default_footer_text = input.default_footer_text;
  if (input.default_terms_text !== undefined) updateData.default_terms_text = input.default_terms_text;
  if (input.invoice_prefix !== undefined) updateData.invoice_prefix = input.invoice_prefix;

  // Try update first
  const [existing] = await db
    .select()
    .from(billSettings)
    .where(eq(billSettings.organization_id, orgId))
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(billSettings)
      .set(updateData)
      .where(eq(billSettings.organization_id, orgId))
      .returning();
    return updated!;
  }

  // Insert
  const [created] = await db
    .insert(billSettings)
    .values({
      organization_id: orgId,
      ...updateData,
    })
    .returning();

  return created!;
}
