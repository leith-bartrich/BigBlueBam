import { eq, and, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { bondLeadScoringRules, bondContacts } from '../db/schema/index.js';
import { notFound } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateScoringRuleInput {
  name: string;
  description?: string;
  condition_field: string;
  condition_operator: string;
  condition_value: string;
  score_delta: number;
  enabled?: boolean;
}

export interface UpdateScoringRuleInput extends Partial<CreateScoringRuleInput> {}

// ---------------------------------------------------------------------------
// List scoring rules
// ---------------------------------------------------------------------------

export async function listScoringRules(orgId: string) {
  return db
    .select()
    .from(bondLeadScoringRules)
    .where(eq(bondLeadScoringRules.organization_id, orgId))
    .orderBy(bondLeadScoringRules.created_at);
}

// ---------------------------------------------------------------------------
// Create scoring rule
// ---------------------------------------------------------------------------

export async function createScoringRule(
  input: CreateScoringRuleInput,
  orgId: string,
) {
  const [rule] = await db
    .insert(bondLeadScoringRules)
    .values({
      organization_id: orgId,
      name: input.name,
      description: input.description,
      condition_field: input.condition_field,
      condition_operator: input.condition_operator,
      condition_value: input.condition_value,
      score_delta: input.score_delta,
      enabled: input.enabled ?? true,
    })
    .returning();

  return rule!;
}

// ---------------------------------------------------------------------------
// Update scoring rule
// ---------------------------------------------------------------------------

export async function updateScoringRule(
  id: string,
  orgId: string,
  input: UpdateScoringRuleInput,
) {
  const [updated] = await db
    .update(bondLeadScoringRules)
    .set({
      ...input,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(bondLeadScoringRules.id, id),
        eq(bondLeadScoringRules.organization_id, orgId),
      ),
    )
    .returning();

  if (!updated) throw notFound('Scoring rule not found');
  return updated;
}

// ---------------------------------------------------------------------------
// Delete scoring rule
// ---------------------------------------------------------------------------

export async function deleteScoringRule(id: string, orgId: string) {
  const [deleted] = await db
    .delete(bondLeadScoringRules)
    .where(
      and(
        eq(bondLeadScoringRules.id, id),
        eq(bondLeadScoringRules.organization_id, orgId),
      ),
    )
    .returning({ id: bondLeadScoringRules.id });

  if (!deleted) throw notFound('Scoring rule not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Score a single contact
// ---------------------------------------------------------------------------

export async function scoreContact(contactId: string, orgId: string) {
  const [contact] = await db
    .select()
    .from(bondContacts)
    .where(and(eq(bondContacts.id, contactId), eq(bondContacts.organization_id, orgId)))
    .limit(1);

  if (!contact) throw notFound('Contact not found');

  // Fetch all enabled rules for this org
  const rules = await db
    .select()
    .from(bondLeadScoringRules)
    .where(
      and(
        eq(bondLeadScoringRules.organization_id, orgId),
        eq(bondLeadScoringRules.enabled, true),
      ),
    );

  let score = 0;
  const matchedRules: { rule_id: string; name: string; delta: number }[] = [];

  for (const rule of rules) {
    const fieldValue = resolveFieldValue(contact, rule.condition_field);
    const matches = evaluateCondition(fieldValue, rule.condition_operator, rule.condition_value);

    if (matches) {
      score += rule.score_delta;
      matchedRules.push({
        rule_id: rule.id,
        name: rule.name,
        delta: rule.score_delta,
      });
    }
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  // Update the contact's cached lead_score
  await db
    .update(bondContacts)
    .set({ lead_score: score, updated_at: new Date() })
    .where(eq(bondContacts.id, contactId));

  return {
    contact_id: contactId,
    score,
    matched_rules: matchedRules,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a dotted field path against a contact record.
 * Supports top-level fields and custom_fields.* paths.
 */
function resolveFieldValue(contact: Record<string, unknown>, fieldPath: string): unknown {
  if (fieldPath.startsWith('custom_fields.')) {
    const key = fieldPath.slice('custom_fields.'.length);
    const customFields = (contact.custom_fields ?? {}) as Record<string, unknown>;
    return customFields[key];
  }
  return contact[fieldPath];
}

/**
 * Evaluate a condition against a value using the specified operator.
 */
function evaluateCondition(
  fieldValue: unknown,
  operator: string,
  conditionValue: string,
): boolean {
  const strValue = fieldValue != null ? String(fieldValue) : '';

  switch (operator) {
    case 'equals':
      return strValue === conditionValue;
    case 'not_equals':
      return strValue !== conditionValue;
    case 'contains':
      return strValue.toLowerCase().includes(conditionValue.toLowerCase());
    case 'gt': {
      const numField = Number(fieldValue);
      const numCondition = Number(conditionValue);
      return !isNaN(numField) && !isNaN(numCondition) && numField > numCondition;
    }
    case 'lt': {
      const numField = Number(fieldValue);
      const numCondition = Number(conditionValue);
      return !isNaN(numField) && !isNaN(numCondition) && numField < numCondition;
    }
    case 'gte': {
      const numField = Number(fieldValue);
      const numCondition = Number(conditionValue);
      return !isNaN(numField) && !isNaN(numCondition) && numField >= numCondition;
    }
    case 'lte': {
      const numField = Number(fieldValue);
      const numCondition = Number(conditionValue);
      return !isNaN(numField) && !isNaN(numCondition) && numField <= numCondition;
    }
    case 'exists':
      return fieldValue != null && fieldValue !== '';
    case 'not_exists':
      return fieldValue == null || fieldValue === '';
    default:
      return false;
  }
}
