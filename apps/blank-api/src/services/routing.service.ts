/**
 * Conditional logic routing service for Blank form submissions.
 *
 * After a submission is persisted, this service checks the form's
 * routing_config and conditionally routes to:
 *   - Bond contact creation (POST /bond/api/v1/contacts)
 *   - Helpdesk ticket creation (POST /helpdesk/api/v1/tickets)
 *
 * Routing is fire-and-forget; failures are logged but do not block the
 * submission response. Each rule has a condition and an action.
 *
 * routing_config structure:
 * {
 *   rules: [
 *     {
 *       condition: { field: "interest", op: "equals", value: "sales" },
 *       action: { type: "bond_contact", field_map: { email: "email", first_name: "name" } }
 *     },
 *     {
 *       condition: { field: "type", op: "equals", value: "support" },
 *       action: { type: "helpdesk_ticket", field_map: { subject: "subject", body: "description" } }
 *     }
 *   ]
 * }
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RoutingCondition {
  field: string;
  op: 'equals' | 'not_equals' | 'contains' | 'is_set' | 'is_not_set' | 'always';
  value?: unknown;
}

interface RoutingAction {
  type: 'bond_contact' | 'helpdesk_ticket';
  field_map: Record<string, string>;
}

interface RoutingRule {
  condition: RoutingCondition;
  action: RoutingAction;
}

interface RoutingConfig {
  rules: RoutingRule[];
}

// ---------------------------------------------------------------------------
// Condition evaluation
// ---------------------------------------------------------------------------

function evaluateCondition(
  condition: RoutingCondition,
  responseData: Record<string, unknown>,
): boolean {
  if (condition.op === 'always') return true;

  const fieldValue = responseData[condition.field];

  switch (condition.op) {
    case 'equals':
      return String(fieldValue) === String(condition.value);
    case 'not_equals':
      return String(fieldValue) !== String(condition.value);
    case 'contains':
      return typeof fieldValue === 'string' &&
        fieldValue.toLowerCase().includes(String(condition.value).toLowerCase());
    case 'is_set':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'is_not_set':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    default:
      return false;
  }
}

// ---------------------------------------------------------------------------
// Field mapping
// ---------------------------------------------------------------------------

function mapFields(
  fieldMap: Record<string, string>,
  responseData: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [targetField, sourceField] of Object.entries(fieldMap)) {
    const value = responseData[sourceField];
    if (value !== undefined && value !== null) {
      result[targetField] = value;
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal HTTP helpers
// ---------------------------------------------------------------------------

const BOND_API_URL = process.env.BOND_API_INTERNAL_URL ?? 'http://bond-api:4009';
const HELPDESK_API_URL = process.env.HELPDESK_API_INTERNAL_URL ?? 'http://helpdesk-api:4001';
const SERVICE_SECRET = process.env.INTERNAL_SERVICE_SECRET;

async function internalPost(
  baseUrl: string,
  path: string,
  body: Record<string, unknown>,
  orgId: string,
): Promise<void> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (SERVICE_SECRET) {
    headers['X-Internal-Service-Secret'] = SERVICE_SECRET;
    headers['X-Organization-ID'] = orgId;
  }

  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Internal API ${path} returned ${response.status}: ${text.slice(0, 200)}`);
  }
}

// ---------------------------------------------------------------------------
// Execute routing actions
// ---------------------------------------------------------------------------

async function executeBondContactAction(
  mapped: Record<string, unknown>,
  orgId: string,
): Promise<void> {
  await internalPost(BOND_API_URL, '/v1/contacts', {
    ...mapped,
    organization_id: orgId,
  }, orgId);
}

async function executeHelpdeskTicketAction(
  mapped: Record<string, unknown>,
  orgId: string,
): Promise<void> {
  await internalPost(HELPDESK_API_URL, '/v1/tickets', {
    ...mapped,
    organization_id: orgId,
  }, orgId);
}

// ---------------------------------------------------------------------------
// Main routing function
// ---------------------------------------------------------------------------

/**
 * Process routing rules for a submission. Call this after the submission
 * is persisted. Errors are caught and logged, never thrown.
 */
export async function processRoutingRules(
  routingConfig: unknown,
  responseData: Record<string, unknown>,
  orgId: string,
  submissionId: string,
  logger: { info: (...args: unknown[]) => void; error: (...args: unknown[]) => void; warn: (...args: unknown[]) => void },
): Promise<void> {
  if (!routingConfig || typeof routingConfig !== 'object') return;

  const config = routingConfig as RoutingConfig;
  if (!Array.isArray(config.rules) || config.rules.length === 0) return;

  for (const rule of config.rules) {
    try {
      if (!rule.condition || !rule.action) continue;

      const match = evaluateCondition(rule.condition, responseData);
      if (!match) continue;

      const mapped = mapFields(rule.action.field_map ?? {}, responseData);

      switch (rule.action.type) {
        case 'bond_contact':
          await executeBondContactAction(mapped, orgId);
          logger.info(
            { submissionId, action: 'bond_contact' },
            'blank-routing: created Bond contact from submission',
          );
          break;

        case 'helpdesk_ticket':
          await executeHelpdeskTicketAction(mapped, orgId);
          logger.info(
            { submissionId, action: 'helpdesk_ticket' },
            'blank-routing: created Helpdesk ticket from submission',
          );
          break;

        default:
          logger.warn(
            { submissionId, actionType: rule.action.type },
            'blank-routing: unknown action type, skipping',
          );
      }
    } catch (err) {
      logger.error(
        {
          submissionId,
          actionType: rule.action?.type,
          err: err instanceof Error ? err.message : String(err),
        },
        'blank-routing: action failed',
      );
    }
  }
}
