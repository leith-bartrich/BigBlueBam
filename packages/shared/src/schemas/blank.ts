import { z } from 'zod';

// Blank (form builder) schemas.

export const BlankFormStatus = z.enum(['draft', 'published', 'closed', 'archived']);
export const BlankFormType = z.enum(['public', 'internal', 'embedded']);
export const BlankFieldType = z.enum([
  'short_text',
  'long_text',
  'email',
  'number',
  'select',
  'multiselect',
  'checkbox',
  'radio',
  'date',
  'file',
  'section_header',
]);

export const blankFieldSchema = z.object({
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(500),
  type: BlankFieldType,
  required: z.boolean().default(false),
  options: z.array(z.string().max(255)).optional(),
  help_text: z.string().max(2000).optional(),
});

export const createBlankFormSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/),
  form_type: BlankFormType.default('public'),
  fields: z.array(blankFieldSchema).min(1).max(200),
  notify_emails: z.array(z.string().email()).optional(),
});

export const updateBlankFormSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: BlankFormStatus.optional(),
  fields: z.array(blankFieldSchema).min(1).max(200).optional(),
  notify_emails: z.array(z.string().email()).optional(),
});

export const createBlankSubmissionSchema = z.object({
  form_slug: z.string().min(1).max(120),
  answers: z.record(z.string(), z.unknown()),
  submitter_email: z.string().email().optional(),
  submitter_name: z.string().max(255).optional(),
});

export type BlankField = z.infer<typeof blankFieldSchema>;
export type CreateBlankFormInput = z.infer<typeof createBlankFormSchema>;
export type UpdateBlankFormInput = z.infer<typeof updateBlankFormSchema>;
export type CreateBlankSubmissionInput = z.infer<typeof createBlankSubmissionSchema>;
