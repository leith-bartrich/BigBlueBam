import { z } from 'zod';

// Banter channel, message, and reaction shared schemas.

export const BanterChannelKind = z.enum(['public', 'private', 'direct', 'thread']);
export const BanterChannelRole = z.enum(['owner', 'admin', 'member', 'viewer']);

export const createBanterChannelSchema = z.object({
  name: z.string().min(1).max(100),
  kind: BanterChannelKind.default('public'),
  description: z.string().max(1000).optional(),
  member_ids: z.array(z.string().uuid()).optional(),
});

export const updateBanterChannelSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(1000).nullable().optional(),
  kind: BanterChannelKind.optional(),
});

export const createBanterMessageSchema = z.object({
  body: z.string().min(1).max(50_000),
  parent_message_id: z.string().uuid().optional(),
  mentions: z.array(z.string().uuid()).optional(),
});

export const updateBanterMessageSchema = z.object({
  body: z.string().min(1).max(50_000),
});

export const banterReactionSchema = z.object({
  emoji: z.string().min(1).max(50),
});

export type CreateBanterChannelInput = z.infer<typeof createBanterChannelSchema>;
export type UpdateBanterChannelInput = z.infer<typeof updateBanterChannelSchema>;
export type CreateBanterMessageInput = z.infer<typeof createBanterMessageSchema>;
export type UpdateBanterMessageInput = z.infer<typeof updateBanterMessageSchema>;
export type BanterReactionInput = z.infer<typeof banterReactionSchema>;
