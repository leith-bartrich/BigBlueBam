import { z } from 'zod';

// Blast (email campaigns) schemas.

export const BlastCampaignStatus = z.enum([
  'draft',
  'scheduled',
  'sending',
  'sent',
  'paused',
  'cancelled',
]);
export const BlastEngagementKind = z.enum(['opened', 'clicked', 'bounced', 'unsubscribed']);
export const BlastBounceType = z.enum(['soft', 'hard']);

export const createBlastCampaignSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(500),
  from_name: z.string().min(1).max(255),
  from_email: z.string().email(),
  reply_to_email: z.string().email().optional(),
  template_id: z.string().uuid().optional(),
  segment_id: z.string().uuid().optional(),
  scheduled_at: z.string().datetime().optional(),
  body_html: z.string().max(1_000_000).optional(),
  body_text: z.string().max(500_000).optional(),
});

export const updateBlastCampaignSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subject: z.string().min(1).max(500).optional(),
  from_name: z.string().min(1).max(255).optional(),
  from_email: z.string().email().optional(),
  reply_to_email: z.string().email().nullable().optional(),
  template_id: z.string().uuid().nullable().optional(),
  segment_id: z.string().uuid().nullable().optional(),
  scheduled_at: z.string().datetime().nullable().optional(),
  status: BlastCampaignStatus.optional(),
});

export const createBlastTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  subject_template: z.string().min(1).max(500),
  body_html: z.string().max(1_000_000),
  body_text: z.string().max(500_000).optional(),
});

export const createBlastSegmentSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  filter_config: z.record(z.string(), z.unknown()),
});

export type CreateBlastCampaignInput = z.infer<typeof createBlastCampaignSchema>;
export type UpdateBlastCampaignInput = z.infer<typeof updateBlastCampaignSchema>;
export type CreateBlastTemplateInput = z.infer<typeof createBlastTemplateSchema>;
export type CreateBlastSegmentInput = z.infer<typeof createBlastSegmentSchema>;
