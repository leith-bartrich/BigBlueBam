import { z } from 'zod';

// Beacon knowledge-base entry, comment, and search schemas.

export const BeaconEntryKind = z.enum(['page', 'doc', 'faq', 'policy', 'runbook']);
export const BeaconVisibility = z.enum(['public', 'org', 'team', 'private']);

export const createBeaconEntrySchema = z.object({
  title: z.string().min(1).max(500),
  body_markdown: z.string().max(200_000),
  kind: BeaconEntryKind.default('doc'),
  visibility: BeaconVisibility.default('org'),
  tags: z.array(z.string().max(64)).max(50).optional(),
  parent_id: z.string().uuid().optional(),
});

export const updateBeaconEntrySchema = z.object({
  title: z.string().min(1).max(500).optional(),
  body_markdown: z.string().max(200_000).optional(),
  kind: BeaconEntryKind.optional(),
  visibility: BeaconVisibility.optional(),
  tags: z.array(z.string().max(64)).max(50).optional(),
  parent_id: z.string().uuid().nullable().optional(),
});

export const beaconSearchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  limit: z.number().int().min(1).max(100).default(20),
  visibility: BeaconVisibility.optional(),
});

export const createBeaconCommentSchema = z.object({
  entry_id: z.string().uuid(),
  body_markdown: z.string().min(1).max(20_000),
  parent_comment_id: z.string().uuid().optional(),
});

export const beaconAttachmentSchema = z.object({
  entry_id: z.string().uuid(),
  filename: z.string().min(1).max(255),
  content_type: z.string().min(1).max(255),
  size_bytes: z.number().int().nonnegative(),
});

export type CreateBeaconEntryInput = z.infer<typeof createBeaconEntrySchema>;
export type UpdateBeaconEntryInput = z.infer<typeof updateBeaconEntrySchema>;
export type BeaconSearchQuery = z.infer<typeof beaconSearchQuerySchema>;
export type CreateBeaconCommentInput = z.infer<typeof createBeaconCommentSchema>;
export type BeaconAttachmentInput = z.infer<typeof beaconAttachmentSchema>;
