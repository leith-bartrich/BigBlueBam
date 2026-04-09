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

/**
 * Resolve all {{ ... }} template variables in a string.
 *
 * Supported variable prefixes:
 *   - {{ event.* }}        -> event payload fields
 *   - {{ actor.* }}        -> actor metadata
 *   - {{ automation.* }}   -> automation metadata
 *   - {{ now }}            -> current ISO timestamp
 *   - {{ step[N].result.* }} -> response from a previous action step
 */
function resolveTemplateString(
  template: string,
  context: {
    event: Record<string, unknown>;
    actor: Record<string, unknown>;
    automation: Record<string, unknown>;
    stepResults: Record<string, unknown>[];
  },
): string {
  return template.replace(/\{\{\s*(.+?)\s*\}\}/g, (_match, expr: string) => {
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
      if (!stepResult) return '';
      const value = resolvePath(stepResult as Record<string, unknown>, fieldPath);
      return value !== undefined ? String(value) : '';
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
        const value = resolvePath(source, fieldPath);
        return value !== undefined ? String(value) : '';
      }
    }

    return '';
  });
}

/**
 * Recursively resolve template variables in parameters (object values, arrays, strings).
 */
function resolveParameters(
  params: Record<string, unknown>,
  context: {
    event: Record<string, unknown>;
    actor: Record<string, unknown>;
    automation: Record<string, unknown>;
    stepResults: Record<string, unknown>[];
  },
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      resolved[key] = resolveTemplateString(value, context);
    } else if (Array.isArray(value)) {
      resolved[key] = value.map((item) => {
        if (typeof item === 'string') return resolveTemplateString(item, context);
        if (item !== null && typeof item === 'object') {
          return resolveParameters(item as Record<string, unknown>, context);
        }
        return item;
      });
    } else if (value !== null && typeof value === 'object') {
      resolved[key] = resolveParameters(value as Record<string, unknown>, context);
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
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
    SELECT id, org_id, name, max_chain_depth, created_by
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

  for (let i = 0; i < actionRows.length; i++) {
    const action = actionRows[i]!;
    const stepStartTime = Date.now();

    // Resolve template variables in parameters
    const rawParams = (action.parameters ?? {}) as Record<string, unknown>;
    const resolvedParams = resolveParameters(rawParams, templateContext);

    logger.info(
      { execution_id, step: i, mcp_tool: action.mcp_tool },
      'Executing action step',
    );

    // Execute with retry logic
    let stepSuccess = false;
    let stepResponse: unknown = null;
    let stepError: string | undefined;
    let stepDurationMs = 0;
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

    const totalStepDuration = Date.now() - stepStartTime;

    // Record the step result
    await db.execute(sql`
      INSERT INTO bolt_execution_steps (execution_id, action_id, step_index, mcp_tool, parameters_resolved, status, response, error_message, duration_ms)
      VALUES (
        ${execution_id},
        ${action.id},
        ${i},
        ${action.mcp_tool},
        ${JSON.stringify(resolvedParams)}::jsonb,
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

      if (action.on_error === 'stop' || action.on_error === 'retry') {
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
