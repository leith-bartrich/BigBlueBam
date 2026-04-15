// ---------------------------------------------------------------------------
// Enriches Brief Bolt-event payloads with canonical names, deep links,
// actor / owner / org / project / folder context so rule templates can resolve
// {{ document.url }}, {{ actor.email }}, {{ project.name }}, etc. without
// re-fetching.
// ---------------------------------------------------------------------------

import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  briefFolders,
  organizations,
  projects,
  users,
} from '../db/schema/index.js';
import { documentUrl } from './urls.js';

export interface BriefDocumentRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  visibility: string;
  word_count: number;
  icon: string | null;
  project_id: string | null;
  folder_id: string | null;
  template_id: string | null;
  org_id: string;
  created_by: string;
  created_at: Date | string;
  updated_at: Date | string;
  // TODO: version_number not yet stored on briefDocuments — requires a
  // `SELECT MAX(version_number) FROM briefVersions WHERE document_id = ...`.
  // TODO: tags column does not yet exist on briefDocuments.
}

type UserLite = { id: string; display_name: string; email: string; avatar_url: string | null };
type OrgLite = { id: string; name: string; slug: string };
type ProjectLite = { id: string; name: string; slug: string };
type FolderLite = { id: string; name: string };

async function fetchUser(id: string | null | undefined): Promise<UserLite | null> {
  if (!id) return null;
  const [row] = await db
    .select({
      id: users.id,
      display_name: users.display_name,
      email: users.email,
      avatar_url: users.avatar_url,
    })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  return row ?? null;
}

async function fetchOrg(id: string): Promise<OrgLite | null> {
  const [row] = await db
    .select({ id: organizations.id, name: organizations.name, slug: organizations.slug })
    .from(organizations)
    .where(eq(organizations.id, id))
    .limit(1);
  return row ?? null;
}

async function fetchProject(id: string | null | undefined): Promise<ProjectLite | null> {
  if (!id) return null;
  const [row] = await db
    .select({ id: projects.id, name: projects.name, slug: projects.slug })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  return row ?? null;
}

async function fetchFolder(id: string | null | undefined): Promise<FolderLite | null> {
  if (!id) return null;
  const [row] = await db
    .select({ id: briefFolders.id, name: briefFolders.name })
    .from(briefFolders)
    .where(eq(briefFolders.id, id))
    .limit(1);
  return row ?? null;
}

function toIso(v: Date | string): string {
  return typeof v === 'string' ? v : v.toISOString();
}

export interface EnrichExtras {
  previous_status?: string;
  changed_fields?: string[];
  beacon_id?: string;
  beacon_slug?: string;
}

/**
 * Build a Bolt-ready, enriched payload for a Brief document event.
 * Every lookup is parallelized. Fields that can't be resolved are omitted
 * rather than set to null so templates can use `{{ field?? }}` defaults.
 */
export async function enrichDocumentEventPayload(
  doc: BriefDocumentRow,
  actorId: string,
  extras: EnrichExtras = {},
): Promise<Record<string, unknown>> {
  const [actor, owner, org, project, folder] = await Promise.all([
    fetchUser(actorId),
    fetchUser(doc.created_by),
    fetchOrg(doc.org_id),
    fetchProject(doc.project_id),
    fetchFolder(doc.folder_id),
  ]);

  const url = documentUrl(doc.slug || doc.id);

  const payload: Record<string, unknown> = {
    document: {
      id: doc.id,
      title: doc.title,
      slug: doc.slug,
      url,
      status: doc.status,
      visibility: doc.visibility,
      word_count: doc.word_count,
      icon: doc.icon ?? null,
      // TODO: populate once briefVersions latest lookup / version_number column exists
      version_number: null,
      // TODO: populate once tags column is added to briefDocuments
      tags: [],
      project_id: doc.project_id,
      folder_id: doc.folder_id,
      template_id: doc.template_id,
      created_at: toIso(doc.created_at),
      updated_at: toIso(doc.updated_at),
    },
  };

  if (project) {
    payload.project = { id: project.id, name: project.name, slug: project.slug };
  } else {
    payload.project = null;
  }

  if (folder) {
    payload.folder = { id: folder.id, name: folder.name };
  } else {
    payload.folder = null;
  }

  if (actor) {
    payload.actor = {
      id: actor.id,
      name: actor.display_name,
      email: actor.email,
      avatar_url: actor.avatar_url,
    };
  } else {
    payload.actor = { id: actorId };
  }

  if (owner) {
    payload.owner = {
      id: owner.id,
      name: owner.display_name,
      email: owner.email,
      avatar_url: owner.avatar_url,
    };
  } else {
    payload.owner = { id: doc.created_by };
  }

  if (org) {
    payload.org = { id: org.id, name: org.name, slug: org.slug };
  } else {
    payload.org = { id: doc.org_id };
  }

  if (extras.previous_status !== undefined) {
    payload.previous_status = extras.previous_status;
  }
  if (extras.beacon_id !== undefined) {
    payload.beacon = {
      id: extras.beacon_id,
      slug: extras.beacon_slug ?? null,
    };
  }
  if (extras.changed_fields !== undefined) {
    payload.changed_fields = extras.changed_fields;
    // Backward-compat alias: older catalog used `changes`
    payload.changes = extras.changed_fields.reduce<Record<string, unknown>>((acc, f) => {
      acc[f] = true;
      return acc;
    }, {});
  }

  return payload;
}
