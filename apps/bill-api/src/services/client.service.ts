import { eq, and, desc, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { billClients, billInvoices, billSettings } from '../db/schema/index.js';
import { notFound, badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClientFilters {
  organization_id: string;
  search?: string;
}

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_region?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  bond_company_id?: string;
  default_payment_terms_days?: number;
  default_payment_instructions?: string;
  notes?: string;
}

export interface UpdateClientInput {
  name?: string;
  email?: string;
  phone?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state_region?: string;
  postal_code?: string;
  country?: string;
  tax_id?: string;
  default_payment_terms_days?: number;
  default_payment_instructions?: string;
  notes?: string;
}

// ---------------------------------------------------------------------------
// List
// ---------------------------------------------------------------------------

export async function listClients(filters: ClientFilters) {
  // Resolve the org default currency once — bill_clients has no per-row currency,
  // so resolver consumers get the org-wide default alongside each row.
  const [settings] = await db
    .select({ default_currency: billSettings.default_currency })
    .from(billSettings)
    .where(eq(billSettings.organization_id, filters.organization_id))
    .limit(1);
  const defaultCurrency = settings?.default_currency ?? 'USD';

  const conditions: any[] = [eq(billClients.organization_id, filters.organization_id)];

  if (filters.search && filters.search.trim().length > 0) {
    const term = `%${filters.search.trim()}%`;
    // Fuzzy search across client name, email, and the joined bond company name.
    conditions.push(
      or(
        ilike(billClients.name, term),
        ilike(billClients.email, term),
        sql`bond_companies.name ILIKE ${term}`,
      ),
    );
  }

  // LEFT JOIN bond_companies via raw SQL — bond lives in a sibling service but
  // shares the same Postgres database, and bill_clients.bond_company_id has no
  // Drizzle FK declared here.
  const rows = await db
    .select({
      id: billClients.id,
      organization_id: billClients.organization_id,
      name: billClients.name,
      email: billClients.email,
      phone: billClients.phone,
      address_line1: billClients.address_line1,
      address_line2: billClients.address_line2,
      city: billClients.city,
      state_region: billClients.state_region,
      postal_code: billClients.postal_code,
      country: billClients.country,
      tax_id: billClients.tax_id,
      bond_company_id: billClients.bond_company_id,
      default_payment_terms_days: billClients.default_payment_terms_days,
      default_payment_instructions: billClients.default_payment_instructions,
      notes: billClients.notes,
      created_by: billClients.created_by,
      created_at: billClients.created_at,
      updated_at: billClients.updated_at,
      company_name: sql<string | null>`bond_companies.name`,
    })
    .from(billClients)
    .leftJoin(
      sql`bond_companies`,
      sql`bond_companies.id = ${billClients.bond_company_id}`,
    )
    .where(and(...conditions))
    .orderBy(desc(billClients.created_at));

  return {
    data: rows.map((row) => ({
      ...row,
      currency: defaultCurrency,
    })),
  };
}

// ---------------------------------------------------------------------------
// Get
// ---------------------------------------------------------------------------

export async function getClient(id: string, orgId: string) {
  const [client] = await db
    .select()
    .from(billClients)
    .where(and(eq(billClients.id, id), eq(billClients.organization_id, orgId)))
    .limit(1);

  if (!client) throw notFound('Client not found');
  return client;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createClient(input: CreateClientInput, orgId: string, userId: string) {
  const [client] = await db
    .insert(billClients)
    .values({
      organization_id: orgId,
      created_by: userId,
      name: input.name,
      email: input.email,
      phone: input.phone,
      address_line1: input.address_line1,
      address_line2: input.address_line2,
      city: input.city,
      state_region: input.state_region,
      postal_code: input.postal_code,
      country: input.country,
      tax_id: input.tax_id,
      bond_company_id: input.bond_company_id,
      default_payment_terms_days: input.default_payment_terms_days ?? 30,
      default_payment_instructions: input.default_payment_instructions,
      notes: input.notes,
    })
    .returning();

  return client!;
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

export async function updateClient(id: string, orgId: string, input: UpdateClientInput) {
  await getClient(id, orgId);

  const [updated] = await db
    .update(billClients)
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where(and(eq(billClients.id, id), eq(billClients.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Client not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete
// ---------------------------------------------------------------------------

export async function deleteClient(id: string, orgId: string) {
  await getClient(id, orgId);

  // Check if client has any invoices
  const [invoice] = await db
    .select({ id: billInvoices.id })
    .from(billInvoices)
    .where(eq(billInvoices.client_id, id))
    .limit(1);

  if (invoice) {
    throw badRequest('Cannot delete client with existing invoices');
  }

  const [deleted] = await db
    .delete(billClients)
    .where(and(eq(billClients.id, id), eq(billClients.organization_id, orgId)))
    .returning({ id: billClients.id });

  if (!deleted) throw notFound('Client not found');
  return deleted;
}
