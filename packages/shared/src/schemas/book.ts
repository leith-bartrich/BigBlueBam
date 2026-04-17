import { z } from 'zod';

// Book (scheduling / events) schemas.

export const BookEventVisibility = z.enum(['public', 'org', 'team', 'private']);
export const BookRsvpStatus = z.enum(['yes', 'no', 'maybe', 'pending']);

export const createBookEventSchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  timezone: z.string().max(100).default('UTC'),
  location: z.string().max(500).optional(),
  visibility: BookEventVisibility.default('org'),
  host_user_id: z.string().uuid(),
  invitee_emails: z.array(z.string().email()).optional(),
  allow_guests: z.boolean().default(false),
});

export const updateBookEventSchema = createBookEventSchema.partial();

export const bookRsvpSchema = z.object({
  event_id: z.string().uuid(),
  response: BookRsvpStatus,
  note: z.string().max(2000).optional(),
});

export type CreateBookEventInput = z.infer<typeof createBookEventSchema>;
export type UpdateBookEventInput = z.infer<typeof updateBookEventSchema>;
export type BookRsvpInput = z.infer<typeof bookRsvpSchema>;
