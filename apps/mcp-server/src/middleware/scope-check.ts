/**
 * Scope-check utilities for MCP tool error handling.
 *
 * The MCP server forwards the user's Bearer token to the B3 API and Banter API.
 * Those APIs enforce API key scopes on their endpoints. This module provides
 * helpers to detect 403 scope errors in API responses and return user-friendly
 * messages that tell the AI client exactly what scope is required.
 */

export type ApiKeyScope = 'read' | 'read_write' | 'admin';

/**
 * Format a user-friendly error message when a tool call is rejected due to
 * insufficient API key scope.
 */
export function formatScopeError(toolName: string, requiredScope: ApiKeyScope, apiError: string): string {
  return (
    `Tool "${toolName}" requires API key scope "${requiredScope}" or higher. ${apiError}. ` +
    `To fix this, create a new API key with "${requiredScope}" scope in Settings > Integrations.`
  );
}

/**
 * Check whether an API error response is a scope-related 403 and return a
 * formatted MCP tool result if so. Returns `null` if the error is not
 * scope-related, letting the caller fall through to its normal error handling.
 */
export function handleScopeError(
  toolName: string,
  requiredScope: ApiKeyScope,
  result: { ok: boolean; status: number; data: unknown },
): { content: [{ type: 'text'; text: string }]; isError: true } | null {
  if (result.status !== 403) return null;

  const errorMsg =
    (result.data as Record<string, unknown>)?.error != null
      ? typeof (result.data as Record<string, unknown>).error === 'string'
        ? ((result.data as Record<string, unknown>).error as string)
        : ((result.data as Record<string, { message?: string }>).error?.message ?? '')
      : '';

  if (!errorMsg.toLowerCase().includes('scope')) return null;

  return {
    content: [{ type: 'text', text: formatScopeError(toolName, requiredScope, errorMsg) }],
    isError: true,
  };
}
