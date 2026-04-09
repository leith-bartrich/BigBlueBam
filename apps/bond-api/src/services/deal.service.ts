import { eq, and, sql, desc, asc, inArray, gte, lte, isNull, ilike } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  bondDeals,
  bondDealContacts,
  bondDealStageHistory,
  bondPipelineStages,
  bondPipelines,
  bondActivities,
  bondContacts,
  bondCompanies,
} from '../db/schema/index.js';
import { escapeLike, notFound, badRequest } from '../lib/utils.js';
import { publishBoltEvent } from '../lib/bolt-events.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DealFilters {
  organization_id: string;
  pipeline_id?: string;
  stage_id?: string;
  owner_id?: string;
  company_id?: string;
  value_min?: number;
  value_max?: number;
  expected_close_after?: string;
  expected_close_before?: string;
  stale?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
  sort?: string;
  /** When set, only return deals owned by this user (for member/viewer "own only" visibility). */
  visibility_owner_id?: string;
}

export interface CreateDealInput {
  name: string;
  pipeline_id: string;
  stage_id: string;
  description?: string;
  value?: number;
  currency?: string;
  expected_close_date?: string;
  probability_pct?: number;
  owner_id?: string;
  company_id?: string;
  custom_fields?: Record<string, unknown>;
}

export interface UpdateDealInput {
  name?: string;
  description?: string;
  value?: number;
  currency?: string;
  expected_close_date?: string;
  probability_pct?: number;
  owner_id?: string;
  company_id?: string;
  custom_fields?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// List deals
// ---------------------------------------------------------------------------

export async function listDeals(filters: DealFilters) {
  const conditions = [eq(bondDeals.organization_id, filters.organization_id)];

  if (filters.pipeline_id) {
    conditions.push(eq(bondDeals.pipeline_id, filters.pipeline_id));
  }
  if (filters.stage_id) {
    conditions.push(eq(bondDeals.stage_id, filters.stage_id));
  }
  if (filters.owner_id) {
    conditions.push(eq(bondDeals.owner_id, filters.owner_id));
  }
  if (filters.company_id) {
    conditions.push(eq(bondDeals.company_id, filters.company_id));
  }
  if (filters.value_min !== undefined) {
    conditions.push(gte(bondDeals.value, filters.value_min));
  }
  if (filters.value_max !== undefined) {
    conditions.push(lte(bondDeals.value, filters.value_max));
  }
  if (filters.expected_close_after) {
    conditions.push(gte(bondDeals.expected_close_date, filters.expected_close_after));
  }
  if (filters.expected_close_before) {
    conditions.push(lte(bondDeals.expected_close_date, filters.expected_close_before));
  }
  if (filters.visibility_owner_id) {
    conditions.push(eq(bondDeals.owner_id, filters.visibility_owner_id));
  }
  if (filters.search) {
    const pattern = `%${escapeLike(filters.search)}%`;
    conditions.push(ilike(bondDeals.name, pattern));
  }

  const limit = Math.min(filters.limit ?? 50, 100);
  const offset = filters.offset ?? 0;

  let orderBy;
  switch (filters.sort) {
    case 'value':
      orderBy = [asc(bondDeals.value)];
      break;
    case '-value':
      orderBy = [desc(bondDeals.value)];
      break;
    case 'name':
      orderBy = [asc(bondDeals.name)];
      break;
    case '-created_at':
      orderBy = [desc(bondDeals.created_at)];
      break;
    default:
      orderBy = [desc(bondDeals.created_at)];
  }

  const [rows, countResult] = await Promise.all([
    db
      .select()
      .from(bondDeals)
      .where(and(...conditions))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(bondDeals)
      .where(and(...conditions)),
  ]);

  return {
    data: rows,
    total: countResult[0]?.count ?? 0,
    limit,
    offset,
  };
}

// ---------------------------------------------------------------------------
// Get deal by ID
// ---------------------------------------------------------------------------

export async function getDeal(id: string, orgId: string) {
  const [deal] = await db
    .select()
    .from(bondDeals)
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');

  // Fetch contacts
  const contacts = await db
    .select({
      contact_id: bondDealContacts.contact_id,
      role: bondDealContacts.role,
      first_name: bondContacts.first_name,
      last_name: bondContacts.last_name,
      email: bondContacts.email,
    })
    .from(bondDealContacts)
    .innerJoin(bondContacts, eq(bondDealContacts.contact_id, bondContacts.id))
    .where(eq(bondDealContacts.deal_id, id));

  // Fetch stage history
  const stageHistory = await db
    .select()
    .from(bondDealStageHistory)
    .where(eq(bondDealStageHistory.deal_id, id))
    .orderBy(desc(bondDealStageHistory.changed_at));

  // Fetch recent activities
  const activities = await db
    .select()
    .from(bondActivities)
    .where(eq(bondActivities.deal_id, id))
    .orderBy(desc(bondActivities.performed_at))
    .limit(20);

  // Fetch stage details
  const [stage] = await db
    .select()
    .from(bondPipelineStages)
    .where(eq(bondPipelineStages.id, deal.stage_id))
    .limit(1);

  // Fetch company details if linked
  let company = null;
  if (deal.company_id) {
    const [c] = await db
      .select()
      .from(bondCompanies)
      .where(eq(bondCompanies.id, deal.company_id))
      .limit(1);
    company = c ?? null;
  }

  return {
    ...deal,
    stage: stage ?? null,
    company,
    contacts,
    stage_history: stageHistory,
    recent_activities: activities,
  };
}

// ---------------------------------------------------------------------------
// Create deal
// ---------------------------------------------------------------------------

export async function createDeal(
  input: CreateDealInput,
  orgId: string,
  userId: string,
) {
  // Verify pipeline and stage belong to org
  const [pipeline] = await db
    .select()
    .from(bondPipelines)
    .where(and(eq(bondPipelines.id, input.pipeline_id), eq(bondPipelines.organization_id, orgId)))
    .limit(1);

  if (!pipeline) throw notFound('Pipeline not found');

  const [stage] = await db
    .select()
    .from(bondPipelineStages)
    .where(
      and(
        eq(bondPipelineStages.id, input.stage_id),
        eq(bondPipelineStages.pipeline_id, input.pipeline_id),
      ),
    )
    .limit(1);

  if (!stage) throw notFound('Stage not found in this pipeline');

  const [deal] = await db
    .insert(bondDeals)
    .values({
      organization_id: orgId,
      pipeline_id: input.pipeline_id,
      stage_id: input.stage_id,
      name: input.name,
      description: input.description,
      value: input.value,
      currency: input.currency ?? pipeline.currency,
      expected_close_date: input.expected_close_date,
      probability_pct: input.probability_pct ?? stage.probability_pct,
      owner_id: input.owner_id ?? userId,
      company_id: input.company_id,
      custom_fields: input.custom_fields ?? {},
      created_by: userId,
    })
    .returning();

  // Record initial stage history
  await db.insert(bondDealStageHistory).values({
    deal_id: deal!.id,
    from_stage_id: null,
    to_stage_id: input.stage_id,
    changed_by: userId,
  });

  // Log deal_created activity
  await db.insert(bondActivities).values({
    organization_id: orgId,
    deal_id: deal!.id,
    company_id: input.company_id,
    activity_type: 'deal_created',
    subject: `Deal "${input.name}" created`,
    performed_by: userId,
  });

  // Emit Bolt event (fire-and-forget)
  publishBoltEvent('bond.deal.created', {
    deal_id: deal!.id,
    pipeline_id: input.pipeline_id,
    stage_id: input.stage_id,
    value: deal!.value,
    owner_id: deal!.owner_id,
  }, orgId);

  return deal!;
}

// ---------------------------------------------------------------------------
// Update deal
// ---------------------------------------------------------------------------

export async function updateDeal(
  id: string,
  orgId: string,
  input: UpdateDealInput,
) {
  const [updated] = await db
    .update(bondDeals)
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Deal not found');

  // Emit Bolt event (fire-and-forget)
  publishBoltEvent('bond.deal.updated', {
    deal_id: id,
    changes: Object.keys(input),
    value: updated.value,
    owner_id: updated.owner_id,
  }, orgId);

  return updated;
}

// ---------------------------------------------------------------------------
// Delete deal
// ---------------------------------------------------------------------------

export async function deleteDeal(id: string, orgId: string) {
  const [deleted] = await db
    .delete(bondDeals)
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .returning({ id: bondDeals.id });

  if (!deleted) throw notFound('Deal not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Move deal to new stage
// ---------------------------------------------------------------------------

export async function moveDealStage(
  id: string,
  orgId: string,
  newStageId: string,
  userId: string,
) {
  const [deal] = await db
    .select()
    .from(bondDeals)
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');
  if (deal.stage_id === newStageId) return deal;

  // Verify new stage belongs to same pipeline
  const [newStage] = await db
    .select()
    .from(bondPipelineStages)
    .where(
      and(
        eq(bondPipelineStages.id, newStageId),
        eq(bondPipelineStages.pipeline_id, deal.pipeline_id),
      ),
    )
    .limit(1);

  if (!newStage) throw notFound('Stage not found in this pipeline');

  const now = new Date();

  // Calculate duration in previous stage
  const durationMs = now.getTime() - new Date(deal.stage_entered_at).getTime();
  const durationSeconds = Math.floor(durationMs / 1000);

  // Record stage history
  await db.insert(bondDealStageHistory).values({
    deal_id: id,
    from_stage_id: deal.stage_id,
    to_stage_id: newStageId,
    changed_by: userId,
    duration_in_stage: `${durationSeconds} seconds`,
  });

  // Update deal
  const [updated] = await db
    .update(bondDeals)
    .set({
      stage_id: newStageId,
      stage_entered_at: now,
      probability_pct: newStage.probability_pct,
      updated_at: now,
    })
    .where(eq(bondDeals.id, id))
    .returning();

  // Log activity
  await db.insert(bondActivities).values({
    organization_id: orgId,
    deal_id: id,
    activity_type: 'stage_change',
    subject: `Deal moved to "${newStage.name}"`,
    metadata: {
      from_stage_id: deal.stage_id,
      to_stage_id: newStageId,
      duration_seconds: durationSeconds,
    },
    performed_by: userId,
  });

  // Emit Bolt event (fire-and-forget)
  publishBoltEvent('bond.deal.stage_changed', {
    deal_id: id,
    from_stage_id: deal.stage_id,
    to_stage_id: newStageId,
    value: deal.value,
    days_in_previous_stage: Math.floor(durationSeconds / 86400),
  }, orgId);

  return updated!;
}

// ---------------------------------------------------------------------------
// Close deal won
// ---------------------------------------------------------------------------

export async function closeDealWon(
  id: string,
  orgId: string,
  userId: string,
  closeReason?: string,
) {
  const [deal] = await db
    .select()
    .from(bondDeals)
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');
  if (deal.closed_at) throw badRequest('Deal is already closed');

  // Find the "won" stage in this pipeline
  const [wonStage] = await db
    .select()
    .from(bondPipelineStages)
    .where(
      and(
        eq(bondPipelineStages.pipeline_id, deal.pipeline_id),
        eq(bondPipelineStages.stage_type, 'won'),
      ),
    )
    .limit(1);

  const now = new Date();
  const targetStageId = wonStage?.id ?? deal.stage_id;

  // Record stage history if stage changed
  if (targetStageId !== deal.stage_id) {
    const durationMs = now.getTime() - new Date(deal.stage_entered_at).getTime();
    await db.insert(bondDealStageHistory).values({
      deal_id: id,
      from_stage_id: deal.stage_id,
      to_stage_id: targetStageId,
      changed_by: userId,
      duration_in_stage: `${Math.floor(durationMs / 1000)} seconds`,
    });
  }

  const [updated] = await db
    .update(bondDeals)
    .set({
      stage_id: targetStageId,
      stage_entered_at: now,
      closed_at: now,
      close_reason: closeReason,
      probability_pct: 100,
      updated_at: now,
    })
    .where(eq(bondDeals.id, id))
    .returning();

  // Log activity
  await db.insert(bondActivities).values({
    organization_id: orgId,
    deal_id: id,
    activity_type: 'deal_won',
    subject: `Deal "${deal.name}" closed won`,
    metadata: { value: deal.value, close_reason: closeReason },
    performed_by: userId,
  });

  // Emit Bolt event (fire-and-forget)
  const cycleDays = Math.floor(
    (now.getTime() - new Date(deal.created_at).getTime()) / 86400000,
  );
  publishBoltEvent('bond.deal.won', {
    deal_id: id,
    value: deal.value,
    pipeline_id: deal.pipeline_id,
    cycle_days: cycleDays,
  }, orgId);

  return updated!;
}

// ---------------------------------------------------------------------------
// Close deal lost
// ---------------------------------------------------------------------------

export async function closeDealLost(
  id: string,
  orgId: string,
  userId: string,
  closeReason?: string,
  lostToCompetitor?: string,
) {
  const [deal] = await db
    .select()
    .from(bondDeals)
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');
  if (deal.closed_at) throw badRequest('Deal is already closed');

  // Find the "lost" stage in this pipeline
  const [lostStage] = await db
    .select()
    .from(bondPipelineStages)
    .where(
      and(
        eq(bondPipelineStages.pipeline_id, deal.pipeline_id),
        eq(bondPipelineStages.stage_type, 'lost'),
      ),
    )
    .limit(1);

  const now = new Date();
  const targetStageId = lostStage?.id ?? deal.stage_id;

  if (targetStageId !== deal.stage_id) {
    const durationMs = now.getTime() - new Date(deal.stage_entered_at).getTime();
    await db.insert(bondDealStageHistory).values({
      deal_id: id,
      from_stage_id: deal.stage_id,
      to_stage_id: targetStageId,
      changed_by: userId,
      duration_in_stage: `${Math.floor(durationMs / 1000)} seconds`,
    });
  }

  const [updated] = await db
    .update(bondDeals)
    .set({
      stage_id: targetStageId,
      stage_entered_at: now,
      closed_at: now,
      close_reason: closeReason,
      lost_to_competitor: lostToCompetitor,
      probability_pct: 0,
      updated_at: now,
    })
    .where(eq(bondDeals.id, id))
    .returning();

  // Log activity
  await db.insert(bondActivities).values({
    organization_id: orgId,
    deal_id: id,
    activity_type: 'deal_lost',
    subject: `Deal "${deal.name}" closed lost`,
    metadata: { value: deal.value, close_reason: closeReason, lost_to_competitor: lostToCompetitor },
    performed_by: userId,
  });

  // Emit Bolt event (fire-and-forget)
  publishBoltEvent('bond.deal.lost', {
    deal_id: id,
    value: deal.value,
    close_reason: closeReason,
    lost_to_competitor: lostToCompetitor,
  }, orgId);

  return updated!;
}

// ---------------------------------------------------------------------------
// Duplicate deal
// ---------------------------------------------------------------------------

export async function duplicateDeal(id: string, orgId: string, userId: string) {
  const [original] = await db
    .select()
    .from(bondDeals)
    .where(and(eq(bondDeals.id, id), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!original) throw notFound('Deal not found');

  // Find the first active stage of the pipeline
  const [firstStage] = await db
    .select()
    .from(bondPipelineStages)
    .where(
      and(
        eq(bondPipelineStages.pipeline_id, original.pipeline_id),
        eq(bondPipelineStages.stage_type, 'active'),
      ),
    )
    .orderBy(asc(bondPipelineStages.sort_order))
    .limit(1);

  const stageId = firstStage?.id ?? original.stage_id;

  const [duplicate] = await db
    .insert(bondDeals)
    .values({
      organization_id: orgId,
      pipeline_id: original.pipeline_id,
      stage_id: stageId,
      name: `${original.name} (copy)`,
      description: original.description,
      value: original.value,
      currency: original.currency,
      expected_close_date: original.expected_close_date,
      probability_pct: firstStage?.probability_pct ?? original.probability_pct,
      owner_id: userId,
      company_id: original.company_id,
      custom_fields: original.custom_fields,
      created_by: userId,
    })
    .returning();

  // Copy contact associations
  const contacts = await db
    .select()
    .from(bondDealContacts)
    .where(eq(bondDealContacts.deal_id, id));

  if (contacts.length > 0) {
    await db.insert(bondDealContacts).values(
      contacts.map((c) => ({
        deal_id: duplicate!.id,
        contact_id: c.contact_id,
        role: c.role,
      })),
    );
  }

  return duplicate!;
}

// ---------------------------------------------------------------------------
// Deal contacts
// ---------------------------------------------------------------------------

export async function listDealContacts(dealId: string, orgId: string) {
  // Verify deal belongs to org
  const [deal] = await db
    .select({ id: bondDeals.id })
    .from(bondDeals)
    .where(and(eq(bondDeals.id, dealId), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');

  return db
    .select({
      contact_id: bondDealContacts.contact_id,
      role: bondDealContacts.role,
      first_name: bondContacts.first_name,
      last_name: bondContacts.last_name,
      email: bondContacts.email,
      title: bondContacts.title,
    })
    .from(bondDealContacts)
    .innerJoin(bondContacts, eq(bondDealContacts.contact_id, bondContacts.id))
    .where(eq(bondDealContacts.deal_id, dealId));
}

export async function addDealContact(
  dealId: string,
  contactId: string,
  orgId: string,
  role?: string,
) {
  // Verify both deal and contact belong to org
  const [deal] = await db
    .select({ id: bondDeals.id })
    .from(bondDeals)
    .where(and(eq(bondDeals.id, dealId), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');

  const [contact] = await db
    .select({ id: bondContacts.id })
    .from(bondContacts)
    .where(and(eq(bondContacts.id, contactId), eq(bondContacts.organization_id, orgId)))
    .limit(1);

  if (!contact) throw notFound('Contact not found');

  const [link] = await db
    .insert(bondDealContacts)
    .values({
      deal_id: dealId,
      contact_id: contactId,
      role,
    })
    .onConflictDoNothing()
    .returning();

  return link ?? { deal_id: dealId, contact_id: contactId, role };
}

export async function removeDealContact(
  dealId: string,
  contactId: string,
  orgId: string,
) {
  // Verify deal belongs to org
  const [deal] = await db
    .select({ id: bondDeals.id })
    .from(bondDeals)
    .where(and(eq(bondDeals.id, dealId), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');

  const [deleted] = await db
    .delete(bondDealContacts)
    .where(
      and(
        eq(bondDealContacts.deal_id, dealId),
        eq(bondDealContacts.contact_id, contactId),
      ),
    )
    .returning();

  if (!deleted) throw notFound('Contact association not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Stage history
// ---------------------------------------------------------------------------

export async function getDealStageHistory(dealId: string, orgId: string) {
  const [deal] = await db
    .select({ id: bondDeals.id })
    .from(bondDeals)
    .where(and(eq(bondDeals.id, dealId), eq(bondDeals.organization_id, orgId)))
    .limit(1);

  if (!deal) throw notFound('Deal not found');

  return db
    .select()
    .from(bondDealStageHistory)
    .where(eq(bondDealStageHistory.deal_id, dealId))
    .orderBy(desc(bondDealStageHistory.changed_at));
}
