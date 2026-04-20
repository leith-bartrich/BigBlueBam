import { z } from 'zod';

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12),
  display_name: z.string().max(100),
  org_name: z.string().max(255),
});

export const bootstrapSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(12),
  display_name: z.string().max(100),
  org_name: z.string().max(255),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totp_code: z
    .string()
    .regex(/^\d{6}$/)
    .optional(),
});

export const magicLinkSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string(),
  new_password: z.string().min(12),
});

export const updateProfileSchema = z.object({
  display_name: z.string().max(100).optional(),
  avatar_url: z.string().url().optional(),
  timezone: z.string().optional(),
  notification_prefs: z.record(z.unknown()).optional(),
});
