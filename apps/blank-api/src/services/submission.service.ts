import { eq, and, desc, sql, asc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { blankSubmissions, blankForms, blankFormFields } from '../db/schema/index.js';
import { notFound, badRequest } from '../lib/utils.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SubmitInput {
  response_data: Record<string, unknown>;
  submitted_by_user_id?: string;
  submitted_by_email?: string;
  submitted_by_ip?: string;
  user_agent?: string;
  attachments?: unknown[];
}

// ---------------------------------------------------------------------------
// List submissions
// ---------------------------------------------------------------------------

export async function listSubmissions(formId: string, orgId: string, params: {
  cursor?: string;
  limit?: number;
}) {
  const limit = params.limit ?? 50;

  const conditions = [
    eq(blankSubmissions.form_id, formId),
    eq(blankSubmissions.organization_id, orgId),
  ];

  if (params.cursor) {
    conditions.push(sql`${blankSubmissions.submitted_at} < (SELECT submitted_at FROM blank_submissions WHERE id = ${params.cursor})`);
  }

  const submissions = await db
    .select()
    .from(blankSubmissions)
    .where(and(...conditions))
    .orderBy(desc(blankSubmissions.submitted_at))
    .limit(limit + 1);

  const hasMore = submissions.length > limit;
  const data = hasMore ? submissions.slice(0, limit) : submissions;
  const nextCursor = hasMore ? data[data.length - 1]?.id : null;

  return { data, next_cursor: nextCursor, has_more: hasMore };
}

// ---------------------------------------------------------------------------
// Get submission
// ---------------------------------------------------------------------------

export async function getSubmission(id: string, orgId: string) {
  const [submission] = await db
    .select()
    .from(blankSubmissions)
    .where(and(eq(blankSubmissions.id, id), eq(blankSubmissions.organization_id, orgId)))
    .limit(1);

  if (!submission) throw notFound('Submission not found');
  return submission;
}

// ---------------------------------------------------------------------------
// Delete submission
// ---------------------------------------------------------------------------

export async function deleteSubmission(id: string, orgId: string) {
  const [deleted] = await db
    .delete(blankSubmissions)
    .where(and(eq(blankSubmissions.id, id), eq(blankSubmissions.organization_id, orgId)))
    .returning({ id: blankSubmissions.id });

  if (!deleted) throw notFound('Submission not found');
  return deleted;
}

// ---------------------------------------------------------------------------
// Create submission (public)
// ---------------------------------------------------------------------------

export async function createSubmission(formId: string, orgId: string, input: SubmitInput) {
  const [submission] = await db
    .insert(blankSubmissions)
    .values({
      form_id: formId,
      organization_id: orgId,
      response_data: input.response_data,
      submitted_by_user_id: input.submitted_by_user_id,
      submitted_by_email: input.submitted_by_email,
      submitted_by_ip: input.submitted_by_ip,
      user_agent: input.user_agent,
      attachments: input.attachments ?? [],
    })
    .returning();

  return submission!;
}

// ---------------------------------------------------------------------------
// Export submissions as CSV
// ---------------------------------------------------------------------------

export async function exportSubmissions(formId: string, orgId: string) {
  // Get form with fields
  const [form] = await db
    .select()
    .from(blankForms)
    .where(and(eq(blankForms.id, formId), eq(blankForms.organization_id, orgId)))
    .limit(1);

  if (!form) throw notFound('Form not found');

  const fields = await db
    .select()
    .from(blankFormFields)
    .where(eq(blankFormFields.form_id, formId))
    .orderBy(asc(blankFormFields.sort_order));

  const submissions = await db
    .select()
    .from(blankSubmissions)
    .where(eq(blankSubmissions.form_id, formId))
    .orderBy(desc(blankSubmissions.submitted_at));

  // Build CSV
  const fieldKeys = fields
    .filter((f) => !['section_header', 'paragraph'].includes(f.field_type))
    .map((f) => f.field_key);

  const headers = ['Submission ID', 'Submitted At', 'Email', ...fieldKeys.map((k) => {
    const field = fields.find((f) => f.field_key === k);
    return field?.label ?? k;
  })];

  const rows = submissions.map((sub) => {
    const data = sub.response_data as Record<string, unknown>;
    return [
      sub.id,
      sub.submitted_at?.toISOString() ?? '',
      sub.submitted_by_email ?? '',
      ...fieldKeys.map((k) => {
        const val = data[k];
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return val.join('; ');
        return String(val);
      }),
    ];
  });

  const csvLines = [
    headers.map((h) => `"${h.replace(/"/g, '""')}"`).join(','),
    ...rows.map((row) =>
      row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','),
    ),
  ];

  return csvLines.join('\n');
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export async function getFormAnalytics(formId: string, orgId: string) {
  const [form] = await db
    .select()
    .from(blankForms)
    .where(and(eq(blankForms.id, formId), eq(blankForms.organization_id, orgId)))
    .limit(1);

  if (!form) throw notFound('Form not found');

  const fields = await db
    .select()
    .from(blankFormFields)
    .where(eq(blankFormFields.form_id, formId))
    .orderBy(asc(blankFormFields.sort_order));

  // Total submissions
  const [totalResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(blankSubmissions)
    .where(eq(blankSubmissions.form_id, formId));

  const totalSubmissions = totalResult?.count ?? 0;

  // Submissions over time (last 30 days, grouped by day)
  const dailyCounts = await db.execute(sql`
    SELECT DATE_TRUNC('day', submitted_at)::date AS day, COUNT(*)::int AS count
    FROM blank_submissions
    WHERE form_id = ${formId}
      AND submitted_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE_TRUNC('day', submitted_at)
    ORDER BY day
  `);

  // Per-field analytics
  const SAFE_IDENTIFIER = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  const fieldAnalytics: Record<string, unknown> = {};

  for (const field of fields) {
    if (['section_header', 'paragraph', 'hidden'].includes(field.field_type)) continue;

    // Defense-in-depth: skip fields with unsafe keys to prevent SQL injection via sql.raw()
    if (!SAFE_IDENTIFIER.test(field.field_key)) continue;

    if (['single_select', 'multi_select', 'dropdown'].includes(field.field_type)) {
      // Count per option
      const optionCounts = await db.execute(sql`
        SELECT value, COUNT(*)::int AS count
        FROM blank_submissions,
             LATERAL (SELECT jsonb_array_elements_text(
               CASE jsonb_typeof(response_data->${sql.raw(`'${field.field_key}'`)})
                 WHEN 'array' THEN response_data->${sql.raw(`'${field.field_key}'`)}
                 ELSE jsonb_build_array(response_data->>${sql.raw(`'${field.field_key}'`)})
               END
             ) AS value) AS expanded
        WHERE form_id = ${formId}
          AND response_data ? ${field.field_key}
        GROUP BY value
        ORDER BY count DESC
      `);
      fieldAnalytics[field.field_key] = { type: 'option_counts', data: optionCounts };
    } else if (['rating', 'scale', 'nps', 'number'].includes(field.field_type)) {
      // Average and distribution
      const stats = await db.execute(sql`
        SELECT
          AVG((response_data->>${sql.raw(`'${field.field_key}'`)})::numeric) AS average,
          MIN((response_data->>${sql.raw(`'${field.field_key}'`)})::numeric) AS min_val,
          MAX((response_data->>${sql.raw(`'${field.field_key}'`)})::numeric) AS max_val,
          COUNT(*)::int AS response_count
        FROM blank_submissions
        WHERE form_id = ${formId}
          AND response_data ? ${field.field_key}
          AND response_data->>${sql.raw(`'${field.field_key}'`)} ~ '^-?[0-9]+(\\.[0-9]+)?$'
      `);
      fieldAnalytics[field.field_key] = { type: 'numeric_stats', data: stats[0] ?? {} };
    } else {
      // Text: just count responses
      const [count] = await db.execute(sql`
        SELECT COUNT(*)::int AS response_count
        FROM blank_submissions
        WHERE form_id = ${formId}
          AND response_data ? ${field.field_key}
          AND response_data->>${sql.raw(`'${field.field_key}'`)} != ''
      `);
      fieldAnalytics[field.field_key] = { type: 'text_count', data: count ?? {} };
    }
  }

  return {
    form_id: formId,
    total_submissions: totalSubmissions,
    daily_trend: dailyCounts,
    field_analytics: fieldAnalytics,
  };
}
