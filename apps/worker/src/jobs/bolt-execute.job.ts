/**
 * Bolt execution worker — processes `bolt:execute` jobs.
 *
 * For each queued execution:
 *   1. Loads the execution record and parent automation (with actions)
 *   2. For each action (in sort_order):
 *      a. Resolves template variables ({{ event.* }}, {{ actor.* }}, {{ step[N].result.* }}, {{ now }})
 *      b. Calls the MCP server's tool endpoint
 *      c. Records the step result in bolt_execution_steps
 *      d. On failure: handles on_error policy (stop/continue/retry)
 *   3. Marks execution as success/failed/partial when done
 */

import type { Job } from 'bullmq';
import type { Logger } from 'pino';
import { sql } from 'drizzle-orm';
import { getDb } from '../utils/db.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BoltExecuteJobData {
  execution_id: string;
  automation_id: string;
  event_payload: Record<string, unknown>;
  event_source: string;
  event_type: string;
  org_id: string;
  actor_id?: string;
  actor_type: string;
  chain_depth: number;
  template_strict?: boolean;
}

export interface TemplateWarning {
  path: string;
  expression: string;
  reason: 'unresolved' | 'coerced_complex_value';
}

interface ActionRow {
  id: string;
  automation_id: string;
  sort_order: number;
  mcp_tool: string;
  parameters: Record<string, unknown> | null;
  on_error: string;
  retry_count: number;
  retry_delay_ms: number;
}

interface AutomationRow {
  id: string;
  org_id: string;
  name: string;
  max_chain_depth: number;
  created_by: string;
  template_strict: boolean;
}

// ---------------------------------------------------------------------------
// Template variable resolution
// ---------------------------------------------------------------------------

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Resolve a dot-delimited path against an object.
 */
function resolvePath(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== 'object') return undefined;
    if (BLOCKED_KEYS.has(part)) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

interface TemplateContext {
  event: Record<string, unknown>;
  actor: Record<string, unknown>;
  automation: Record<string, unknown>;
  stepResults: Record<string, unknown>[];
}

// Matches a string that is EXACTLY one {{ ... }} expression with no surrounding text.
// Uses a non-greedy inner match and anchors at start/end so `foo {{bar}} baz` is NOT a match.
const WHOLE_TEMPLATE_RE = /^\{\{\s*(.+?)\s*\}\}$/;

/**
 * Resolve a single {{ ... }} expression against the template context.
 * Returns the raw value (undefined if unresolved). Does NOT coerce to string.
 */
function resolveExpression(
  expr: string,
  context: TemplateContext,
): unknown {
  // {{ now }}
  if (expr === 'now') {
    return new Date().toISOString();
  }

  // {{ step[N].result.path }}
  const stepMatch = expr.match(/^step\[(\d+)\]\.result\.(.+)$/);
  if (stepMatch) {
    const stepIndex = parseInt(stepMatch[1]!, 10);
    const fieldPath = stepMatch[2]!;
    const stepResult = context.stepResults[stepIndex];
    if (!stepResult) return undefined;
    return resolvePath(stepResult as Record<string, unknown>, fieldPath);
  }

  // {{ event.path }}, {{ actor.path }}, {{ automation.path }}
  const dotIndex = expr.indexOf('.');
  if (dotIndex > 0) {
    const prefix = expr.slice(0, dotIndex);
    const fieldPath = expr.slice(dotIndex + 1);

    let source: Record<string, unknown> | undefined;
    if (prefix === 'event') source = context.event;
    else if (prefix === 'actor') source = context.actor;
    else if (prefix === 'automation') source = context.automation;

    if (source) {
      return resolvePath(source, fieldPath);
    }
  }

  return undefined;
}

/**
 * Resolve all {{ ... }} template variables in a string, emitting a warning
 * for each path that fails to resolve or is coerced from a non-scalar value.
 *
 * Supported variable prefixes:
 *   - {{ event.* }}        -> event payload fields
 *   - {{ actor.* }}        -> actor metadata
 *   - {{ automation.* }}   -> automation metadata
 *   - {{ now }}            -> current ISO timestamp
 *   - {{ step[N].result.* }} -> response from a previous action step
 *
 * NOTE: this function is only called for embedded templates (template mixed
 * with surrounding literal text). The "whole template" case is handled by
 * `resolveStringValue` below and may return a non-string value as-is.
 */
function resolveTemplateString(
  template: string,
  context: TemplateContext,
  paramPath: string,
  warnings: TemplateWarning[],
): string {
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, expr: string) => {
    const value = resolveExpression(expr, context);

    if (value === undefined || value === null) {
      warnings.push({ path: paramPath, expression: expr, reason: 'unresolved' });
      return '';
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    // Non-scalar value embedded inside a larger string. JSON-stringify it so
    // the user gets `["a","b"]` rather than `"a,b"` or `"[object Object]"`,
    // and flag it as a probable rule-author bug.
    warnings.push({ path: paramPath, expression: expr, reason: 'coerced_complex_value' });
    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  });
}

/**
 * Resolve a string value that may be either:
 *   - A "whole template" — the entire string is a single {{ ... }} expression,
 *     in which case the raw resolved value is returned (preserving arrays/objects).
 *   - An embedded template — interpolate each {{ ... }} expression into the string.
 */
function resolveStringValue(
  value: string,
  context: TemplateContext,
  paramPath: string,
  warnings: TemplateWarning[],
): unknown {
  const wholeMatch = value.match(WHOLE_TEMPLATE_RE);
  if (wholeMatch) {
    const expr = wholeMatch[1]!;
    const resolved = resolveExpression(expr, context);
    if (resolved === undefined) {
      warnings.push({ path: paramPath, expression: expr, reason: 'unresolved' });
      return undefined;
    }
    return resolved;
  }
  return resolveTemplateString(value, context, paramPath, warnings);
}

/**
 * Recursively resolve template variables in parameters (object values, arrays, strings).
 * Returns the resolved object plus any template warnings encountered.
 */
function resolveParameters(
  params: Record<string, unknown>,
  context: TemplateContext,
  parentPath = '',
  warnings: TemplateWarning[] = [],
): { resolved: Record<string, unknown>; warnings: TemplateWarning[] } {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const currentPath = parentPath ? `${parentPath}.${key}` : key;

    if (typeof value === 'string') {
      resolved[key] = resolveStringValue(value, context, currentPath, warnings);
    } else if (Array.isArray(value)) {
      resolved[key] = value.map((item, idx) => {
        const itemPath = `${currentPath}[${idx}]`;
        if (typeof item === 'string') {
          return resolveStringValue(item, context, itemPath, warnings);
        }
        if (item !== null && typeof item === 'object') {
          const nested = resolveParameters(
            item as Record<string, unknown>,
            context,
            itemPath,
            warnings,
          );
          return nested.resolved;
        }
        return item;
      });
    } else if (value !== null && typeof value === 'object') {
      const nested = resolveParameters(
        value as Record<string, unknown>,
        context,
        currentPath,
        warnings,
      );
      resolved[key] = nested.resolved;
    } else {
      resolved[key] = value;
    }
  }

  return { resolved, warnings };
}

// ---------------------------------------------------------------------------
// MCP tool call
// ---------------------------------------------------------------------------

async function callMcpTool(
  mcpUrl: string,
  toolName: string,
  parameters: Record<string, unknown>,
  orgId: string,
  logger: Logger,
): Promise<{ success: boolean; response: unknown; error?: string; durationMs: number }> {
  const startTime = Date.now();

  try {
    const res = await fetch(`${mcpUrl}/tools/call`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Org-Id': orgId,
        'X-Internal-Secret': process.env.INTERNAL_SERVICE_SECRET ?? '',
      },
      body: JSON.stringify({
        name: toolName,
        arguments: parameters,
      }),
      signal: AbortSignal.timeout(30_000), // 30s timeout per MCP call
    });

    const durationMs = Date.now() - startTime;
    const body = await res.json() as Record<string, unknown>;

    if (!res.ok) {
      const errorMsg =
        typeof body.error === 'object' && body.error !== null
          ? (body.error as Record<string, unknown>).message ?? res.statusText
          : res.statusText;
      return {
        success: false,
        response: body,
        error: `MCP call failed (${res.status}): ${errorMsg}`,
        durationMs,
      };
    }

    // Check for MCP-level errors in the response content
    if (body.isError === true) {
      const errorMsg =
        Array.isArray(body.content) && body.content.length > 0
          ? String((body.content[0] as Record<string, unknown>).text ?? 'MCP tool returned error')
          : 'MCP tool returned error';
      return {
        success: false,
        response: body,
        error: errorMsg,
        durationMs,
      };
    }

    return { success: true, response: body, durationMs };
  } catch (err: unknown) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, toolName }, 'MCP tool call threw');
    return {
      success: false,
      response: null,
      error: `MCP call exception: ${message}`,
      durationMs,
    };
  }
}

// ---------------------------------------------------------------------------
// Sleep utility for retries
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Processor
// ---------------------------------------------------------------------------

export async function processBoltExecuteJob(
  job: Job<BoltExecuteJobData>,
  logger: Logger,
): Promise<void> {
  const {
    execution_id,
    automation_id,
    event_payload,
    event_source,
    event_type,
    org_id,
    actor_id,
    actor_type,
    chain_depth,
  } = job.data;

  logger.info(
    { jobId: job.id, execution_id, automation_id, event_type },
    'Processing bolt:execute job',
  );

  const db = getDb();
  const mcpUrl = process.env.MCP_INTERNAL_URL ?? 'http://mcp-server:3001';
  const startTime = Date.now();

  // 1. Load automation
  const automationRows = await db.execute(sql`
    SELECT id, org_id, name, max_chain_depth, created_by, template_strict
    FROM bolt_automations
    WHERE id = ${automation_id}
    LIMIT 1
  `);

  const automation = automationRows[0] as AutomationRow | undefined;
  if (!automation) {
    logger.error({ automation_id }, 'Automation not found, marking execution as failed');
    await db.execute(sql`
      UPDATE bolt_executions
      SET status = 'failed',
          error_message = 'Automation not found',
          completed_at = NOW(),
          duration_ms = ${Date.now() - startTime}
      WHERE id = ${execution_id}
    `);
    return;
  }

  // 2. Load actions sorted by sort_order
  const actionRows = (await db.execute(sql`
    SELECT id, automation_id, sort_order, mcp_tool, parameters, on_error, retry_count, retry_delay_ms
    FROM bolt_actions
    WHERE automation_id = ${automation_id}
    ORDER BY sort_order ASC
  `)) as ActionRow[];

  if (actionRows.length === 0) {
    logger.warn({ automation_id }, 'Automation has no actions, marking execution as success');
    await db.execute(sql`
      UPDATE bolt_executions
      SET status = 'success',
          completed_at = NOW(),
          duration_ms = ${Date.now() - startTime}
      WHERE id = ${execution_id}
    `);
    return;
  }

  // 3. Build template context
  const templateContext = {
    event: event_payload,
    actor: {
      id: actor_id,
      type: actor_type,
    },
    automation: {
      id: automation.id,
      name: automation.name,
      org_id: automation.org_id,
    },
    stepResults: [] as Record<string, unknown>[],
  };

  // 4. Execute actions sequentially
  let hasFailure = false;
  let failedStepIndex: number | null = null;
  let failureMessage: string | null = null;

  // `template_strict` can come either from the job payload (newer bolt-api)
  // or from the automation row itself (older bolt-api versions still in-flight).
  // The row value is authoritative; job payload is a convenience copy.
  const templateStrict = automation.template_strict === true || job.data.template_strict === true;

  for (let i = 0; i < actionRows.length; i++) {
    const action = actionRows[i]!;
    const stepStartTime = Date.now();

    // Resolve template variables in parameters
    const rawParams = (action.parameters ?? {}) as Record<string, unknown>;
    const { resolved: resolvedParams, warnings: templateWarnings } = resolveParameters(
      rawParams,
      templateContext,
    );

    // Log every warning so they show up in container logs.
    for (const w of templateWarnings) {
      logger.warn(
        {
          execution_id,
          step: i,
          mcp_tool: action.mcp_tool,
          param_path: w.path,
          expression: w.expression,
          reason: w.reason,
        },
        w.reason === 'unresolved'
          ? 'Template path did not resolve'
          : 'Template coerced a non-scalar value embedded in a string',
      );
    }

    // Stash warnings alongside the resolved parameters so post-mortem tools can
    // surface them in the execution-step UI. We piggy-back on parameters_resolved
    // rather than adding a new column so no schema migration is needed here.
    const parametersResolvedForStorage: Record<string, unknown> =
      templateWarnings.length > 0
        ? { ...resolvedParams, _template_warnings: templateWarnings }
        : resolvedParams;

    logger.info(
      { execution_id, step: i, mcp_tool: action.mcp_tool, warnings: templateWarnings.length },
      'Executing action step',
    );

    // Execute with retry logic
    let stepSuccess = false;
    let stepResponse: unknown = null;
    let stepError: string | undefined;
    let stepDurationMs = 0;

    // Strict mode: if ANY template warning occurred, abort this step before
    // calling the MCP tool. The step is recorded as failed with a clear error.
    if (templateStrict && templateWarnings.length > 0) {
      const firstUnresolved =
        templateWarnings.find((w) => w.reason === 'unresolved') ?? templateWarnings[0]!;
      stepError = `Template resolution failed: {{ ${firstUnresolved.expression} }} did not resolve (param "${firstUnresolved.path}"). Strict mode is enabled; either disable strict mode or fix the template.`;
      stepDurationMs = 0;
      logger.warn(
        { execution_id, step: i, mcp_tool: action.mcp_tool, warnings: templateWarnings },
        'Aborting step: strict template mode and unresolved template(s)',
      );
    } else {
      const maxAttempts = action.on_error === 'retry' ? Math.max(1, action.retry_count + 1) : 1;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        if (attempt > 0) {
          logger.info(
            { execution_id, step: i, attempt, mcp_tool: action.mcp_tool },
            'Retrying action step',
          );
          await sleep(action.retry_delay_ms);
        }

        const result = await callMcpTool(mcpUrl, action.mcp_tool, resolvedParams, org_id, logger);
        stepDurationMs = result.durationMs;
        stepResponse = result.response;

        if (result.success) {
          stepSuccess = true;
          stepError = undefined;
          break;
        }

        stepError = result.error;
      }
    }

    const totalStepDuration = Date.now() - stepStartTime;

    // Record the step result
    await db.execute(sql`
      INSERT INTO bolt_execution_steps (execution_id, action_id, step_index, mcp_tool, parameters_resolved, status, response, error_message, duration_ms)
      VALUES (
        ${execution_id},
        ${action.id},
        ${i},
        ${action.mcp_tool},
        ${JSON.stringify(parametersResolvedForStorage)}::jsonb,
        ${stepSuccess ? 'success' : 'failed'},
        ${stepResponse ? JSON.stringify(stepResponse) : null}::jsonb,
        ${stepError ?? null},
        ${totalStepDuration}
      )
    `);

    // Store step result for {{ step[N].result.* }} references
    templateContext.stepResults[i] = (stepResponse as Record<string, unknown>) ?? {};

    if (!stepSuccess) {
      logger.warn(
        { execution_id, step: i, mcp_tool: action.mcp_tool, error: stepError },
        'Action step failed',
      );

      // Strict-mode template failures always halt execution regardless of on_error,
      // because the failure is a configuration error rather than a runtime MCP error.
      if (
        (templateStrict && templateWarnings.length > 0) ||
        action.on_error === 'stop' ||
        action.on_error === 'retry'
      ) {
        // stop: halt execution immediately
        // retry: retries already exhausted above, so halt
        hasFailure = true;
        failedStepIndex = i;
        failureMessage = stepError ?? 'Action step failed';
        break;
      }

      // on_error === 'continue': log and proceed to next action
      hasFailure = true;
      if (failedStepIndex === null) failedStepIndex = i;
      if (!failureMessage) failureMessage = stepError ?? 'Action step failed';
    }
  }

  // 5. Determine final execution status
  const totalDuration = Date.now() - startTime;
  let finalStatus: string;

  if (!hasFailure) {
    finalStatus = 'success';
  } else if (failedStepIndex !== null && failedStepIndex < actionRows.length - 1) {
    // Stopped early or some steps failed with continue
    const completedSteps = actionRows.length;
    const executedAll = !failureMessage || failedStepIndex === actionRows.length - 1;
    finalStatus = executedAll ? 'partial' : 'failed';
  } else {
    finalStatus = 'partial';
  }

  // If we stopped early (on_error=stop), mark as failed
  if (hasFailure && failedStepIndex !== null) {
    // Check if execution was halted (not all steps ran)
    // We can check by counting steps recorded
    const stepCountResult = await db.execute(sql`
      SELECT count(*)::int AS cnt FROM bolt_execution_steps WHERE execution_id = ${execution_id}
    `);
    const stepsRan = (stepCountResult[0] as any)?.cnt ?? 0;
    if (stepsRan < actionRows.length) {
      finalStatus = 'failed';
    } else {
      finalStatus = 'partial'; // All steps ran but some failed (continue mode)
    }
  }

  // 6. Update execution record
  await db.execute(sql`
    UPDATE bolt_executions
    SET status = ${finalStatus},
        completed_at = NOW(),
        duration_ms = ${totalDuration},
        error_message = ${failureMessage},
        error_step = ${failedStepIndex}
    WHERE id = ${execution_id}
  `);

  logger.info(
    {
      execution_id,
      automation_id,
      status: finalStatus,
      duration_ms: totalDuration,
      steps_total: actionRows.length,
    },
    'Bolt execution completed',
  );
}
