import { eq, and, sql, asc, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bondPipelines, bondPipelineStages, bondDeals } from '../db/schema/index.js';
import { notFound, conflict } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreatePipelineInput {
  name: string;
  description?: string;
  is_default?: boolean;
  currency?: string;
  stages?: CreateStageInput[];
}

export interface UpdatePipelineInput {
  name?: string;
  description?: string;
  is_default?: boolean;
  currency?: string;
}

export interface CreateStageInput {
  name: string;
  sort_order?: number;
  stage_type?: string;
  probability_pct?: number;
  rotting_days?: number;
  color?: string;
}

export interface UpdateStageInput extends Partial<CreateStageInput> {}

// ---------------------------------------------------------------------------
// List pipelines
// ---------------------------------------------------------------------------

export async function listPipelines(orgId: string) {
  const pipelines = await db
    .select()
    .from(bondPipelines)
    .where(eq(bondPipelines.organization_id, orgId))
    .orderBy(asc(bondPipelines.created_at));

  // Fetch stages for all pipelines
  const pipelineIds = pipelines.map((p) => p.id);
  if (pipelineIds.length === 0) return [];

  const stages = await db
    .select()
    .from(bondPipelineStages)
    .where(inArray(bondPipelineStages.pipeline_id, pipelineIds))
    .orderBy(asc(bondPipelineStages.sort_order));

  const stagesByPipeline = new Map<string, typeof stages>();
  for (const stage of stages) {
    const list = stagesByPipeline.get(stage.pipeline_id) ?? [];
    list.push(stage);
    stagesByPipeline.set(stage.pipeline_id, list);
  }

  return pipelines.map((p) => ({
    ...p,
    stages: stagesByPipeline.get(p.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// Get pipeline by ID
// ---------------------------------------------------------------------------

export async function getPipeline(id: string, orgId: string) {
  const [pipeline] = await db
    .select()
    .from(bondPipelines)
    .where(and(eq(bondPipelines.id, id), eq(bondPipelines.organization_id, orgId)))
    .limit(1);

  if (!pipeline) throw notFound('Pipeline not found');

  const stages = await db
    .select()
    .from(bondPipelineStages)
    .where(eq(bondPipelineStages.pipeline_id, id))
    .orderBy(asc(bondPipelineStages.sort_order));

  return { ...pipeline, stages };
}

// ---------------------------------------------------------------------------
// Create pipeline (with optional stages)
// ---------------------------------------------------------------------------

export async function createPipeline(
  input: CreatePipelineInput,
  orgId: string,
  userId: string,
) {
  // If is_default, clear other defaults
  if (input.is_default) {
    await db
      .update(bondPipelines)
      .set({ is_default: false })
      .where(eq(bondPipelines.organization_id, orgId));
  }

  const [pipeline] = await db
    .insert(bondPipelines)
    .values({
      organization_id: orgId,
      name: input.name,
      description: input.description,
      is_default: input.is_default ?? false,
      currency: input.currency ?? 'USD',
      created_by: userId,
    })
    .returning();

  // Create stages if provided
  if (input.stages && input.stages.length > 0) {
    const stageValues = input.stages.map((s, i) => ({
      pipeline_id: pipeline!.id,
      name: s.name,
      sort_order: s.sort_order ?? i,
      stage_type: s.stage_type ?? 'active',
      probability_pct: s.probability_pct ?? 0,
      rotting_days: s.rotting_days,
      color: s.color,
    }));

    await db.insert(bondPipelineStages).values(stageValues);
  }

  return getPipeline(pipeline!.id, orgId);
}

// ---------------------------------------------------------------------------
// Update pipeline
// ---------------------------------------------------------------------------

export async function updatePipeline(
  id: string,
  orgId: string,
  input: UpdatePipelineInput,
) {
  if (input.is_default) {
    await db
      .update(bondPipelines)
      .set({ is_default: false })
      .where(eq(bondPipelines.organization_id, orgId));
  }

  const [updated] = await db
    .update(bondPipelines)
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where(and(eq(bondPipelines.id, id), eq(bondPipelines.organization_id, orgId)))
    .returning();

  if (!updated) throw notFound('Pipeline not found');
  return getPipeline(id, orgId);
}

// ---------------------------------------------------------------------------
// Delete pipeline
// ---------------------------------------------------------------------------

export async function deletePipeline(id: string, orgId: string) {
  // Check no deals reference this pipeline
  const [dealCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bondDeals)
    .where(eq(bondDeals.pipeline_id, id));

  if ((dealCount?.count ?? 0) > 0) {
    throw conflict('Cannot delete pipeline with existing deals. Move or delete deals first.');
  }

  const [deleted] = await db
    .delete(bondPipelines)
    .where(and(eq(bondPipelines.id, id), eq(bondPipelines.organization_id, orgId)))
    .returning({ id: bondPipelines.id });

  if (!deleted) throw notFound('Pipeline not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Stage management
// ---------------------------------------------------------------------------

export async function listStages(pipelineId: string, orgId: string) {
  // Verify pipeline belongs to org
  await getPipeline(pipelineId, orgId);

  return db
    .select()
    .from(bondPipelineStages)
    .where(eq(bondPipelineStages.pipeline_id, pipelineId))
    .orderBy(asc(bondPipelineStages.sort_order));
}

export async function createStage(
  pipelineId: string,
  orgId: string,
  input: CreateStageInput,
) {
  // Verify pipeline belongs to org
  await getPipeline(pipelineId, orgId);

  // If no sort_order given, append after last stage
  let sortOrder = input.sort_order;
  if (sortOrder === undefined) {
    const [maxOrder] = await db
      .select({ max: sql<number>`COALESCE(MAX(${bondPipelineStages.sort_order}), -1)::int` })
      .from(bondPipelineStages)
      .where(eq(bondPipelineStages.pipeline_id, pipelineId));
    sortOrder = (maxOrder?.max ?? -1) + 1;
  }

  const [stage] = await db
    .insert(bondPipelineStages)
    .values({
      pipeline_id: pipelineId,
      name: input.name,
      sort_order: sortOrder,
      stage_type: input.stage_type ?? 'active',
      probability_pct: input.probability_pct ?? 0,
      rotting_days: input.rotting_days,
      color: input.color,
    })
    .returning();

  return stage!;
}

export async function updateStage(
  pipelineId: string,
  stageId: string,
  orgId: string,
  input: UpdateStageInput,
) {
  // Verify pipeline belongs to org
  await getPipeline(pipelineId, orgId);

  const [updated] = await db
    .update(bondPipelineStages)
    .set(input)
    .where(
      and(
        eq(bondPipelineStages.id, stageId),
        eq(bondPipelineStages.pipeline_id, pipelineId),
      ),
    )
    .returning();

  if (!updated) throw notFound('Stage not found');
  return updated;
}

export async function deleteStage(pipelineId: string, stageId: string, orgId: string) {
  // Verify pipeline belongs to org
  await getPipeline(pipelineId, orgId);

  // Check no deals are in this stage
  const [dealCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bondDeals)
    .where(eq(bondDeals.stage_id, stageId));

  if ((dealCount?.count ?? 0) > 0) {
    throw conflict('Cannot delete stage with existing deals. Move deals to another stage first.');
  }

  const [deleted] = await db
    .delete(bondPipelineStages)
    .where(
      and(
        eq(bondPipelineStages.id, stageId),
        eq(bondPipelineStages.pipeline_id, pipelineId),
      ),
    )
    .returning({ id: bondPipelineStages.id });

  if (!deleted) throw notFound('Stage not found');
  return deleted;
}

export async function reorderStages(
  pipelineId: string,
  orgId: string,
  stageIds: string[],
) {
  // Verify pipeline belongs to org
  await getPipeline(pipelineId, orgId);

  // Update sort_order for each stage
  for (let i = 0; i < stageIds.length; i++) {
    await db
      .update(bondPipelineStages)
      .set({ sort_order: i })
      .where(
        and(
          eq(bondPipelineStages.id, stageIds[i]!),
          eq(bondPipelineStages.pipeline_id, pipelineId),
        ),
      );
  }

  return listStages(pipelineId, orgId);
}
