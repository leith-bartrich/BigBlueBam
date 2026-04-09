import { z } from 'zod';
import { uuidSchema } from './common.js';

// ── Enums ──────────────────────────────────────────────────────────────
export const BriefDocumentStatus = z.enum(['draft', 'in_review', 'approved', 'archived']);
export type BriefDocumentStatus = z.infer<typeof BriefDocumentStatus>;

export const BriefVisibility = z.enum(['private', 'project', 'organization']);
export type BriefVisibility = z.infer<typeof BriefVisibility>;

export const BriefTaskLinkType = z.enum(['reference', 'spec', 'notes', 'postmortem']);
export type BriefTaskLinkType = z.infer<typeof BriefTaskLinkType>;

export const BriefBeaconLinkType = z.enum(['reference', 'source', 'related']);
export type BriefBeaconLinkType = z.infer<typeof BriefBeaconLinkType>;

export const BriefCollaboratorPermission = z.enum(['view', 'comment', 'edit']);
export type BriefCollaboratorPermission = z.infer<typeof BriefCollaboratorPermission>;

// ── Document schemas ────────────────────────────────────────────────────
export const createBriefDocumentSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  project_id: uuidSchema.nullable().optional(),
  folder_id: uuidSchema.nullable().optional(),
  template_id: uuidSchema.nullable().optional(),
  visibility: BriefVisibility.optional(),
  icon: z.string().max(100).nullable().optional(),
  plain_text: z.string().max(2_000_000).nullable().optional(),
});

export const updateBriefDocumentSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  folder_id: uuidSchema.nullable().optional(),
  icon: z.string().max(100).nullable().optional(),
  cover_image_url: z
    .string()
    .max(2000)
    .nullable()
    .optional()
    .refine(
      (val) => {
        if (val === null || val === undefined) return true;
        try {
          const url = new URL(val);
          return url.protocol === 'https:' || url.protocol === 'http:';
        } catch {
          return false;
        }
      },
      { message: 'cover_image_url must be an http or https URL' },
    ),
  status: BriefDocumentStatus.optional(),
  visibility: BriefVisibility.optional(),
  pinned: z.boolean().optional(),
  plain_text: z.string().max(2_000_000).nullable().optional(),
  html_snapshot: z.string().max(5_000_000).nullable().optional(),
  word_count: z.number().int().min(0).optional(),
  project_id: uuidSchema.nullable().optional(),
});

export const updateBriefContentSchema = z.object({
  html_snapshot: z.string().max(5_000_000).nullable().optional(),
  plain_text: z.string().max(2_000_000).nullable().optional(),
  content: z.string().max(2_000_000).optional(),
});

export const appendBriefContentSchema = z.object({
  html: z.string().max(1_000_000).optional(),
  text: z.string().max(1_000_000).optional(),
  content: z.string().max(1_000_000).optional(),
});

// ── Template schemas ────────────────────────────────────────────────────
export const createBriefTemplateSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).nullable().optional(),
  icon: z.string().max(100).nullable().optional(),
  category: z.string().max(100).nullable().optional(),
  html_preview: z.string().max(5_000_000).nullable().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateBriefTemplateSchema = createBriefTemplateSchema.partial();

// ── Folder schemas ──────────────────────────────────────────────────────
export const createBriefFolderSchema = z.object({
  name: z.string().min(1).max(255),
  parent_id: uuidSchema.nullable().optional(),
  project_id: uuidSchema.nullable().optional(),
});

export const updateBriefFolderSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  parent_id: uuidSchema.nullable().optional(),
});

// ── Link schemas ────────────────────────────────────────────────────────
export const createBriefTaskLinkSchema = z.object({
  task_id: uuidSchema,
  link_type: BriefTaskLinkType.default('reference'),
});

export const createBriefBeaconLinkSchema = z.object({
  beacon_id: uuidSchema,
  link_type: BriefBeaconLinkType.default('reference'),
});

// ── Collaborator schemas ────────────────────────────────────────────────
export const createBriefCollaboratorSchema = z.object({
  user_id: uuidSchema,
  permission: BriefCollaboratorPermission.default('edit'),
});

export const updateBriefCollaboratorSchema = z.object({
  permission: BriefCollaboratorPermission,
});

// ── Comment schemas ─────────────────────────────────────────────────────
export const createBriefCommentSchema = z.object({
  body: z.string().min(1).max(50_000),
  parent_id: uuidSchema.nullable().optional(),
  anchor_text: z.string().max(500).nullable().optional(),
  anchor_offset: z.number().int().min(0).nullable().optional(),
});

export const updateBriefCommentSchema = z.object({
  body: z.string().min(1).max(50_000),
});

// ── Search schema ───────────────────────────────────────────────────────
export const searchBriefDocumentsSchema = z.object({
  query: z.string().min(1).max(500),
  project_id: uuidSchema.optional(),
  status: BriefDocumentStatus.optional(),
});

// ── Inferred types ──────────────────────────────────────────────────────
export type CreateBriefDocumentInput = z.infer<typeof createBriefDocumentSchema>;
export type UpdateBriefDocumentInput = z.infer<typeof updateBriefDocumentSchema>;
export type CreateBriefTemplateInput = z.infer<typeof createBriefTemplateSchema>;
export type UpdateBriefTemplateInput = z.infer<typeof updateBriefTemplateSchema>;
export type CreateBriefFolderInput = z.infer<typeof createBriefFolderSchema>;
export type UpdateBriefFolderInput = z.infer<typeof updateBriefFolderSchema>;
export type CreateBriefTaskLinkInput = z.infer<typeof createBriefTaskLinkSchema>;
export type CreateBriefBeaconLinkInput = z.infer<typeof createBriefBeaconLinkSchema>;
export type CreateBriefCommentInput = z.infer<typeof createBriefCommentSchema>;
export type UpdateBriefCommentInput = z.infer<typeof updateBriefCommentSchema>;
