import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blastSenderDomains } from '../db/schema/index.js';
import { notFound, conflict } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// List sender domains
// ---------------------------------------------------------------------------

export async function listSenderDomains(orgId: string) {
  return db
    .select()
    .from(blastSenderDomains)
    .where(eq(blastSenderDomains.organization_id, orgId))
    .orderBy(blastSenderDomains.domain);
}

// ---------------------------------------------------------------------------
// Add sender domain
// ---------------------------------------------------------------------------

export async function addSenderDomain(orgId: string, domain: string) {
  // Generate DNS records for verification
  const dnsRecords = [
    {
      type: 'TXT',
      name: '@',
      value: `v=spf1 include:_spf.blast.bigbluebam.com ~all`,
    },
    {
      type: 'CNAME',
      name: `blast._domainkey`,
      value: `blast._domainkey.bigbluebam.com`,
    },
    {
      type: 'TXT',
      name: '_dmarc',
      value: `v=DMARC1; p=quarantine; rua=mailto:dmarc@bigbluebam.com`,
    },
  ];

  try {
    const [senderDomain] = await db
      .insert(blastSenderDomains)
      .values({
        organization_id: orgId,
        domain,
        dns_records: dnsRecords,
      })
      .returning();

    return senderDomain!;
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      throw conflict(`Domain ${domain} is already registered for this organization`);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Verify sender domain (check DNS records)
// ---------------------------------------------------------------------------

export async function verifySenderDomain(id: string, orgId: string) {
  const [domain] = await db
    .select()
    .from(blastSenderDomains)
    .where(and(eq(blastSenderDomains.id, id), eq(blastSenderDomains.organization_id, orgId)))
    .limit(1);

  if (!domain) throw notFound('Sender domain not found');

  // In production, this would perform actual DNS lookups using dns.resolveTxt, etc.
  // For now, simulate verification based on whether domain has a known pattern.
  const isVerified = domain.domain.includes('.');

  const [updated] = await db
    .update(blastSenderDomains)
    .set({
      spf_verified: isVerified,
      dkim_verified: isVerified,
      dmarc_verified: isVerified,
      verified_at: isVerified ? new Date() : null,
      updated_at: new Date(),
    })
    .where(eq(blastSenderDomains.id, id))
    .returning();

  return updated!;
}

// ---------------------------------------------------------------------------
// Remove sender domain
// ---------------------------------------------------------------------------

export async function removeSenderDomain(id: string, orgId: string) {
  const [deleted] = await db
    .delete(blastSenderDomains)
    .where(and(eq(blastSenderDomains.id, id), eq(blastSenderDomains.organization_id, orgId)))
    .returning({ id: blastSenderDomains.id });

  if (!deleted) throw notFound('Sender domain not found');
  return deleted;
}
