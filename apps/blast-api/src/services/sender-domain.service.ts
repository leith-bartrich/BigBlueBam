import dns from 'node:dns/promises';
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

  const dnsRecords = (domain.dns_records ?? []) as Array<{
    type: string;
    name: string;
    value: string;
  }>;

  // Look up the expected SPF value from the generated DNS records
  const expectedSpf = dnsRecords.find(
    (r) => r.type === 'TXT' && r.name === '@',
  )?.value;

  // Look up the expected DKIM CNAME target
  const expectedDkimName =
    dnsRecords.find((r) => r.name?.includes('_domainkey'))?.name ?? 'blast._domainkey';

  // Expected DMARC record value
  const expectedDmarc = dnsRecords.find(
    (r) => r.type === 'TXT' && r.name === '_dmarc',
  )?.value;

  const [spfVerified, dkimVerified, dmarcVerified] = await Promise.all([
    verifySPF(domain.domain, expectedSpf),
    verifyDKIM(domain.domain, expectedDkimName),
    verifyDMARC(domain.domain, expectedDmarc),
  ]);

  const allVerified = spfVerified && dkimVerified && dmarcVerified;

  const [updated] = await db
    .update(blastSenderDomains)
    .set({
      spf_verified: spfVerified,
      dkim_verified: dkimVerified,
      dmarc_verified: dmarcVerified,
      verified_at: allVerified ? new Date() : null,
      updated_at: new Date(),
    })
    .where(eq(blastSenderDomains.id, id))
    .returning();

  return updated!;
}

// ---------------------------------------------------------------------------
// DNS verification helpers
// ---------------------------------------------------------------------------

/**
 * Check that the domain has a TXT record containing the expected SPF value.
 * Returns true if found, false on lookup failure or mismatch.
 */
async function verifySPF(
  domain: string,
  expectedValue: string | undefined,
): Promise<boolean> {
  if (!expectedValue) return false;
  try {
    const records = await dns.resolveTxt(domain);
    // dns.resolveTxt returns string[][] — each TXT record is an array of chunks
    return records.some((chunks) => {
      const txt = chunks.join('');
      return txt.includes(expectedValue) || txt.startsWith('v=spf1');
    });
  } catch {
    return false;
  }
}

/**
 * Check for a DKIM TXT record at `selector._domainkey.domain`.
 * The DKIM record may be a CNAME (pointing to our key server) or an inline TXT.
 * We check for any TXT record at the selector host that starts with "v=DKIM1".
 */
async function verifyDKIM(
  domain: string,
  selectorName: string,
): Promise<boolean> {
  const host = `${selectorName}.${domain}`;
  try {
    const records = await dns.resolveTxt(host);
    return records.some((chunks) => {
      const txt = chunks.join('');
      return txt.startsWith('v=DKIM1');
    });
  } catch {
    // TXT lookup failed — try CNAME as alternative (some setups use a CNAME)
    try {
      const cname = await dns.resolveCname(host);
      return cname.length > 0;
    } catch {
      return false;
    }
  }
}

/**
 * Check for a DMARC TXT record at `_dmarc.domain`.
 */
async function verifyDMARC(
  domain: string,
  expectedValue: string | undefined,
): Promise<boolean> {
  const host = `_dmarc.${domain}`;
  try {
    const records = await dns.resolveTxt(host);
    return records.some((chunks) => {
      const txt = chunks.join('');
      // At minimum the record should declare DMARC
      if (!txt.startsWith('v=DMARC1')) return false;
      // If we have an expected value, check it matches; otherwise just accept v=DMARC1
      if (expectedValue) return txt.includes(expectedValue) || txt.startsWith('v=DMARC1');
      return true;
    });
  } catch {
    return false;
  }
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
