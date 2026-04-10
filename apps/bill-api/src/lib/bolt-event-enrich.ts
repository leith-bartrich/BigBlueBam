import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  organizations,
  users,
  billClients,
  billInvoices,
  billLineItems,
} from '../db/schema/index.js';
import { env } from '../env.js';

/**
 * Bolt event enrichment helpers for Bill.
 *
 * These helpers expand raw invoice/payment IDs into the "deep" payload shape
 * expected by Bolt rules and templates — canonical names, customer/actor info,
 * org context, currency metadata, and deep-link URLs.
 *
 * All helpers are best-effort: if a lookup fails, the returned object just
 * omits the field rather than throwing — callers use these inside the
 * fire-and-forget `publishBoltEvent` path which must never break the source
 * operation.
 */

function frontendBase(): string {
  return env.PUBLIC_URL.replace(/\/$/, '');
}

/**
 * Deep link to the internal invoice detail view in the Bill SPA.
 */
export function buildInvoiceUrl(invoiceId: string): string {
  return `${frontendBase()}/bill/invoices/${invoiceId}`;
}

/**
 * Public-facing PDF / view URL for a customer — served via the public token
 * page. Returns null if the invoice has no public_view_token yet (e.g., draft).
 */
export function buildInvoicePdfUrl(publicToken: string | null): string | null {
  if (!publicToken) return null;
  return `${frontendBase()}/invoice/${publicToken}`;
}

/**
 * Deep link to the payment within the invoice detail view.
 */
export function buildPaymentUrl(invoiceId: string, paymentId: string): string {
  return `${frontendBase()}/bill/invoices/${invoiceId}?payment=${paymentId}`;
}

export interface EnrichedActor {
  id: string;
  name: string | null;
  email: string | null;
}

export interface EnrichedOrg {
  id: string;
  name: string | null;
  slug: string | null;
}

export interface EnrichedCustomer {
  id: string;
  name: string | null;
  email: string | null;
  /** Linked Bond company id, if the client was synced from Bond. */
  company_id: string | null;
}

export async function loadActor(userId: string): Promise<EnrichedActor> {
  try {
    const [row] = await db
      .select({
        id: users.id,
        display_name: users.display_name,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!row) return { id: userId, name: null, email: null };
    return { id: row.id, name: row.display_name, email: row.email };
  } catch {
    return { id: userId, name: null, email: null };
  }
}

export async function loadOrg(orgId: string): Promise<EnrichedOrg> {
  try {
    const [row] = await db
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
      })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    if (!row) return { id: orgId, name: null, slug: null };
    return { id: row.id, name: row.name, slug: row.slug };
  } catch {
    return { id: orgId, name: null, slug: null };
  }
}

/**
 * Load a Bill customer (bill_clients row). Returns a stub with just { id } if
 * the lookup fails. Customer is the Bill-side rename of "client" used in
 * enriched event payloads for consistency with Bond/Bearing terminology.
 */
export async function loadCustomer(
  clientId: string,
  orgId: string,
): Promise<EnrichedCustomer> {
  try {
    const [row] = await db
      .select({
        id: billClients.id,
        name: billClients.name,
        email: billClients.email,
        bond_company_id: billClients.bond_company_id,
      })
      .from(billClients)
      .where(and(eq(billClients.id, clientId), eq(billClients.organization_id, orgId)))
      .limit(1);
    if (!row) return { id: clientId, name: null, email: null, company_id: null };
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      company_id: row.bond_company_id,
    };
  } catch {
    return { id: clientId, name: null, email: null, company_id: null };
  }
}

/**
 * Load the full invoice row — used when a producer only has an id in hand.
 * Returns null on miss so callers can fall back to partial payloads.
 */
export async function loadInvoiceById(invoiceId: string) {
  try {
    const [row] = await db
      .select()
      .from(billInvoices)
      .where(eq(billInvoices.id, invoiceId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

/**
 * Count line items on an invoice. Returns 0 on any error.
 */
export async function countLineItems(invoiceId: string): Promise<number> {
  try {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(billLineItems)
      .where(eq(billLineItems.invoice_id, invoiceId));
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}
