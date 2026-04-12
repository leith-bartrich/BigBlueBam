// ---------------------------------------------------------------------------
// Bolt event enrichment helpers.
//
// Phase B / Tier 1 of the Bolt event payload audit: producers emit event
// payloads with enough context that rule authors can chain actions without
// additional lookups. Every entity ID gets a name companion, every primary
// entity gets a *.url deep-link, every event carries a fully-populated actor
// object and org context.
//
// Fetchers are defensive — any missing row returns null and the call site
// omits the corresponding fields. These helpers are called from fire-and-
// forget publish paths, so they also swallow their own failures to avoid
// ever breaking the source operation.
// ---------------------------------------------------------------------------

import { eq, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bondDeals,
  bondContacts,
  bondCompanies,
  bondPipelines,
  bondPipelineStages,
  bondDealContacts,
  organizations,
  users,
} from '../db/schema/index.js';
import { env } from '../env.js';

// ---------------------------------------------------------------------------
// URL builders — deep links into the Bond SPA.
// Matches bond/src/app.tsx routes: /bond/deals/:id, /bond/contacts/:id,
// /bond/companies/:id.
// ---------------------------------------------------------------------------

function base(): string {
  return env.PUBLIC_URL.replace(/\/$/, '');
}

export function dealUrl(dealId: string): string {
  return `${base()}/bond/deals/${dealId}`;
}

export function contactUrl(contactId: string): string {
  return `${base()}/bond/contacts/${contactId}`;
}

export function companyUrl(companyId: string): string {
  return `${base()}/bond/companies/${companyId}`;
}

// ---------------------------------------------------------------------------
// Primitive row fetchers
// ---------------------------------------------------------------------------

export interface ActorRow {
  id: string;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export async function loadActor(userId: string | undefined | null): Promise<ActorRow | null> {
  if (!userId) return null;
  try {
    const [row] = await db
      .select({
        id: users.id,
        name: users.display_name,
        email: users.email,
        avatar_url: users.avatar_url,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export interface OrgRow {
  id: string;
  name: string | null;
  slug: string | null;
}

export async function loadOrg(orgId: string): Promise<OrgRow | null> {
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
    return row ?? null;
  } catch {
    return null;
  }
}

export interface DealEnrichment {
  deal: typeof bondDeals.$inferSelect;
  pipeline: typeof bondPipelines.$inferSelect | null;
  stage: typeof bondPipelineStages.$inferSelect | null;
  owner: ActorRow | null;
  company: typeof bondCompanies.$inferSelect | null;
  primaryContact: typeof bondContacts.$inferSelect | null;
}

/**
 * Fetch a deal plus the related rows event payloads need: pipeline, current
 * stage, owner, associated company, and the first-linked contact (which we
 * treat as the primary contact for the purposes of event payloads since the
 * schema has no explicit is_primary flag).
 */
export async function loadDealEnrichment(
  dealId: string,
): Promise<DealEnrichment | null> {
  try {
    const [deal] = await db
      .select()
      .from(bondDeals)
      .where(eq(bondDeals.id, dealId))
      .limit(1);
    if (!deal) return null;

    const [pipeline] = await db
      .select()
      .from(bondPipelines)
      .where(eq(bondPipelines.id, deal.pipeline_id))
      .limit(1);

    const [stage] = await db
      .select()
      .from(bondPipelineStages)
      .where(eq(bondPipelineStages.id, deal.stage_id))
      .limit(1);

    const owner = await loadActor(deal.owner_id);

    let company: typeof bondCompanies.$inferSelect | null = null;
    if (deal.company_id) {
      const [c] = await db
        .select()
        .from(bondCompanies)
        .where(eq(bondCompanies.id, deal.company_id))
        .limit(1);
      company = c ?? null;
    }

    // Primary contact = first linked via bond_deal_contacts, ordered by
    // creation. The schema has no is_primary flag so this is best-effort.
    const [primaryLink] = await db
      .select({ contact_id: bondDealContacts.contact_id })
      .from(bondDealContacts)
      .where(eq(bondDealContacts.deal_id, dealId))
      .orderBy(asc(bondDealContacts.created_at))
      .limit(1);

    let primaryContact: typeof bondContacts.$inferSelect | null = null;
    if (primaryLink) {
      const [contactRow] = await db
        .select()
        .from(bondContacts)
        .where(eq(bondContacts.id, primaryLink.contact_id))
        .limit(1);
      primaryContact = contactRow ?? null;
    }

    return {
      deal,
      pipeline: pipeline ?? null,
      stage: stage ?? null,
      owner,
      company,
      primaryContact,
    };
  } catch {
    return null;
  }
}

/**
 * Given a (possibly null) contact row, return its canonical display name.
 */
export function contactDisplayName(
  contact: { first_name: string | null; last_name: string | null; email: string | null } | null,
): string | null {
  if (!contact) return null;
  const parts = [contact.first_name, contact.last_name].filter(Boolean) as string[];
  if (parts.length > 0) return parts.join(' ');
  return contact.email ?? null;
}

export async function loadStageById(
  stageId: string,
): Promise<typeof bondPipelineStages.$inferSelect | null> {
  try {
    const [row] = await db
      .select()
      .from(bondPipelineStages)
      .where(eq(bondPipelineStages.id, stageId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function loadContactById(
  contactId: string,
): Promise<typeof bondContacts.$inferSelect | null> {
  try {
    const [row] = await db
      .select()
      .from(bondContacts)
      .where(eq(bondContacts.id, contactId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}

export async function loadCompanyById(
  companyId: string,
): Promise<typeof bondCompanies.$inferSelect | null> {
  try {
    const [row] = await db
      .select()
      .from(bondCompanies)
      .where(eq(bondCompanies.id, companyId))
      .limit(1);
    return row ?? null;
  } catch {
    return null;
  }
}
