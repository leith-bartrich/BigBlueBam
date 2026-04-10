// ---------------------------------------------------------------------------
// Bolt event payload enrichment helpers for Blank
//
// Phase B / Tier 1 of docs/bolt-id-mapping-strategy.md: every Bolt event
// payload Blank emits must include, for every entity referenced:
//   - all relevant IDs (so downstream actions can chain without lookups)
//   - canonical names / emails (form.title, owner info)
//   - deep-link URLs (public form URL + editor URL)
//   - the full `actor` object
//   - the full `org` context
// ---------------------------------------------------------------------------

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  blankForms,
  blankFormFields,
  blankSubmissions,
  users,
  organizations,
} from '../db/schema/index.js';
import { formPublicUrl, formEditorUrl, submissionUrl } from './urls.js';

// ---------------------------------------------------------------------------
// Actor / org
// ---------------------------------------------------------------------------

export interface ActorContext {
  id: string;
  name: string | null;
  display_name: string | null;
  email: string | null;
  avatar_url: string | null;
}

export interface OrgContext {
  id: string;
  name: string | null;
  slug: string | null;
}

export async function loadActor(actorId: string | null | undefined): Promise<ActorContext | null> {
  if (!actorId) return null;
  const [row] = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    name: row.display_name,
    display_name: row.display_name,
    email: row.email,
    avatar_url: row.avatar_url,
  };
}

export async function loadOrg(orgId: string): Promise<OrgContext | null> {
  const [row] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return row ?? null;
}

// ---------------------------------------------------------------------------
// Form enrichment
// ---------------------------------------------------------------------------

export interface EnrichedForm {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  url: string;
  editor_url: string;
  status: string;
  form_type: string;
  visibility: string;
  field_count: number;
  notification_emails: string[];
  notify_on_submit: boolean;
  owner_id: string | null;
  owner_name: string | null;
  owner_email: string | null;
  published_at: string | null;
}

export async function enrichForm(formId: string): Promise<EnrichedForm | null> {
  const [row] = await db
    .select()
    .from(blankForms)
    .where(eq(blankForms.id, formId))
    .limit(1);
  if (!row) return null;

  const [owner] = row.created_by
    ? await db
        .select({
          id: users.id,
          display_name: users.display_name,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, row.created_by))
        .limit(1)
    : [];

  const [fieldCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blankFormFields)
    .where(eq(blankFormFields.form_id, formId));

  const publishedAt =
    row.published_at instanceof Date
      ? row.published_at.toISOString()
      : row.published_at
        ? String(row.published_at)
        : null;

  return {
    id: row.id,
    title: row.name,
    description: row.description ?? null,
    slug: row.slug,
    url: formPublicUrl(row.slug),
    editor_url: formEditorUrl(row.id),
    status: row.status,
    form_type: row.form_type,
    visibility: row.visibility,
    field_count: fieldCount?.count ?? 0,
    notification_emails: (row.notify_emails ?? []) as string[],
    notify_on_submit: row.notify_on_submit,
    owner_id: owner?.id ?? row.created_by ?? null,
    owner_name: owner?.display_name ?? null,
    owner_email: owner?.email ?? null,
    published_at: publishedAt,
  };
}

// ---------------------------------------------------------------------------
// Submission enrichment
// ---------------------------------------------------------------------------

export interface EnrichedSubmission {
  id: string;
  form_id: string;
  submitted_at: string;
  submitter_email: string | null;
  submitter_name: string | null;
  answers: Record<string, unknown>;
  url: string;
}

function extractSubmitter(answers: Record<string, unknown>): {
  email: string | null;
  name: string | null;
} {
  const emailKeys = ['email', 'Email', 'email_address', 'your_email', 'contact_email'];
  const nameKeys = ['name', 'Name', 'full_name', 'your_name', 'first_name'];

  let email: string | null = null;
  let name: string | null = null;

  for (const k of emailKeys) {
    const v = answers[k];
    if (typeof v === 'string' && v.includes('@')) {
      email = v;
      break;
    }
  }
  if (!email) {
    // Fall back to scanning any field that looks like an email.
    for (const v of Object.values(answers)) {
      if (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
        email = v;
        break;
      }
    }
  }

  for (const k of nameKeys) {
    const v = answers[k];
    if (typeof v === 'string' && v.trim().length > 0) {
      name = v;
      break;
    }
  }

  return { email, name };
}

export async function enrichSubmission(
  submissionId: string,
): Promise<{ submission: EnrichedSubmission; form: EnrichedForm | null } | null> {
  const [row] = await db
    .select()
    .from(blankSubmissions)
    .where(eq(blankSubmissions.id, submissionId))
    .limit(1);
  if (!row) return null;

  const form = await enrichForm(row.form_id);

  const answers = (row.response_data ?? {}) as Record<string, unknown>;
  const fallbackSubmitter = extractSubmitter(answers);

  const submittedAt =
    row.submitted_at instanceof Date
      ? row.submitted_at.toISOString()
      : String(row.submitted_at);

  return {
    submission: {
      id: row.id,
      form_id: row.form_id,
      submitted_at: submittedAt,
      submitter_email: row.submitted_by_email ?? fallbackSubmitter.email,
      submitter_name: fallbackSubmitter.name,
      answers,
      url: submissionUrl(row.form_id, row.id),
    },
    form,
  };
}
