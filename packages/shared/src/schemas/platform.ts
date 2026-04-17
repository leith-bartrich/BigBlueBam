import { z } from 'zod';

// Platform (OAuth, RLS, API key rotation) schemas.

export const OAuthProviderName = z.enum(['github', 'google', 'microsoft', 'gitlab', 'bitbucket', 'custom']);

export const oauthProviderSchema = z.object({
  provider_name: OAuthProviderName.or(z.string().min(1).max(50)),
  client_id: z.string().min(1),
  client_secret: z.string().min(1),
  authorization_url: z.string().url(),
  token_url: z.string().url(),
  user_info_url: z.string().url(),
  scopes: z.string().min(1),
  enabled: z.boolean().default(true),
});

export const oauthAuthorizeResponseSchema = z.object({
  authorization_url: z.string().url(),
  state: z.string().min(1),
});

export const oauthCallbackSchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
  redirect_uri: z.string().optional(),
});

export const oauthUserLinkSchema = z.object({
  user_id: z.string().uuid(),
  provider_name: z.string().min(1).max(50),
  external_id: z.string().min(1),
  external_email: z.string().email(),
  external_login: z.string().optional(),
});

export const apiKeyRotationResponseSchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(1),
  key_prefix: z.string().min(1),
  predecessor_id: z.string().uuid(),
  predecessor_grace_expires_at: z.string().datetime(),
});

export const rlsContextSchema = z.object({
  org_id: z.string().uuid(),
  enforced: z.boolean(),
});

export type OAuthProviderInput = z.infer<typeof oauthProviderSchema>;
export type OAuthAuthorizeResponse = z.infer<typeof oauthAuthorizeResponseSchema>;
export type OAuthCallbackInput = z.infer<typeof oauthCallbackSchema>;
export type OAuthUserLinkInput = z.infer<typeof oauthUserLinkSchema>;
export type ApiKeyRotationResponse = z.infer<typeof apiKeyRotationResponseSchema>;
export type RlsContext = z.infer<typeof rlsContextSchema>;
