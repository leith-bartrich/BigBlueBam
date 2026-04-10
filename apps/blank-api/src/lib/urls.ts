// ---------------------------------------------------------------------------
// URL builders for deep-links into the Blank SPA and public form pages.
//
// Used by Bolt event payloads so downstream actions (Slack messages,
// emails, etc.) can include canonical links without each producer rebuilding
// them. Base URL comes from env.PUBLIC_URL and mirrors the nginx routing
// described in CLAUDE.md (`/blank/` for the SPA, `/blank/api/forms/:slug`
// for public form pages).
// ---------------------------------------------------------------------------

import { env } from '../env.js';

function base(): string {
  return env.PUBLIC_URL.replace(/\/$/, '');
}

/** Public URL where an end-user visits a published form. */
export function formPublicUrl(slug: string): string {
  return `${base()}/blank/api/forms/${slug}`;
}

/** Deep-link to the form editor in the Blank SPA. */
export function formEditorUrl(formId: string): string {
  return `${base()}/blank/forms/${formId}`;
}

/** Deep-link to a specific submission in the Blank SPA. */
export function submissionUrl(formId: string, submissionId: string): string {
  return `${base()}/blank/forms/${formId}/submissions/${submissionId}`;
}
