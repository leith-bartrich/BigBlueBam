import { z } from 'zod';

// Board (visual collaboration) schemas.

export const BoardVisibility = z.enum(['public', 'org', 'project', 'private']);
export const BoardElementKind = z.enum([
  'sticky',
  'text',
  'rectangle',
  'ellipse',
  'arrow',
  'line',
  'freehand',
  'image',
  'connector',
  'frame',
]);

export const createBoardSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  project_id: z.string().uuid().optional(),
  template_id: z.string().uuid().optional(),
  icon: z.string().max(50).optional(),
  visibility: BoardVisibility.default('org'),
  background: z.string().max(50).default('grid'),
});

export const updateBoardSchema = createBoardSchema.partial();

export const boardElementSchema = z.object({
  id: z.string(),
  kind: BoardElementKind,
  x: z.number(),
  y: z.number(),
  width: z.number().nonnegative(),
  height: z.number().nonnegative(),
  rotation: z.number().default(0),
  z_index: z.number().int().default(0),
  content: z.record(z.string(), z.unknown()).optional(),
  style: z.record(z.string(), z.unknown()).optional(),
});

export const boardBatchUpdateSchema = z.object({
  additions: z.array(boardElementSchema).optional(),
  updates: z.array(boardElementSchema).optional(),
  deletions: z.array(z.string()).optional(),
});

export const promoteElementsSchema = z.object({
  element_ids: z.array(z.string()).min(1),
  target_project_id: z.string().uuid(),
  target_phase_id: z.string().uuid().optional(),
});

export type CreateBoardInput = z.infer<typeof createBoardSchema>;
export type UpdateBoardInput = z.infer<typeof updateBoardSchema>;
export type BoardElement = z.infer<typeof boardElementSchema>;
export type BoardBatchUpdate = z.infer<typeof boardBatchUpdateSchema>;
export type PromoteElementsInput = z.infer<typeof promoteElementsSchema>;
