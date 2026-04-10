import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { timingSafeEqual } from 'node:crypto';
import { randomUUID } from 'node:crypto';
import { eq, and, asc } from 'drizzle-orm';
import { env } from '../env.js';
import { db } from '../db/index.js';
import {
  boltAutomations,
  boltConditions,
  boltExecutions,
} from '../db/schema/index.js';
import { evaluateConditions, type ConditionDef } from '../services/condition-engine.js';
import { Queue } from 'bullmq';
import type Redis from 'ioredis';

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const ingestEventSchema = z.object({
  event_type: z.string().min(1).max(60),
  source: z.enum([
    'bam',
    'banter',
    'beacon',
    'brief',
    'helpdesk',
    'schedule',
    'bond',
    'blast',
    'board',
    'bench',
    'bearing',
    'bill',
    'book',
    'blank',
  ]),
  payload: z.record(z.unknown()),
  org_id: z.string().uuid(),
  project_id: z.string().uuid().optional(),
  actor_id: z.string().uuid().optional(),
  actor_type: z.enum(['user', 'agent', 'system']).optional(),
  chain_depth: z.number().int().min(0).max(100).optional().default(0),
});

// ---------------------------------------------------------------------------
// Internal auth middleware
// ---------------------------------------------------------------------------

async function requireInternalSecret(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const configuredSecret = env.INTERNAL_SERVICE_SECRET;

  if (!configuredSecret) {
    request.log.warn(
      'INTERNAL_SERVICE_SECRET is not configured — event ingestion routes are unprotected. ' +
        'Set INTERNAL_SERVICE_SECRET env var (min 32 chars) to secure service-to-service calls.',
    );
    return;
  }

  const providedSecret = request.headers['x-internal-secret'] as string | undefined;

  const secretsMatch =
    providedSecret &&
    providedSecret.length === configuredSecret.length &&
    timingSafeEqual(Buffer.from(providedSecret), Buffer.from(configuredSecret));

  if (!secretsMatch) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing X-Internal-Secret header',
        details: [],
        request_id: request.id,
      },
    });
  }
}

// ---------------------------------------------------------------------------
// Lazy BullMQ queue
// ---------------------------------------------------------------------------

let _executeQueue: Queue | null = null;

function getExecuteQueue(redisInstance: Redis): Queue {
  if (!_executeQueue) {
    _executeQueue = new Queue('bolt-execute', { connection: redisInstance });
  }
  return _executeQueue;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

export default async function eventIngestionRoutes(fastify: FastifyInstance) {
  // POST /events/ingest — accept events from other BigBlueBam services
  fastify.post(
    '/events/ingest',
    {
      config: { rateLimit: { max: 500, timeWindow: '1 minute' } },
      preHandler: [requireInternalSecret],
    },
    async (request, reply) => {
      const event = ingestEventSchema.parse(request.body);
      const eventId = randomUUID();

      request.log.info(
        { eventId, source: event.source, event_type: event.event_type, org_id: event.org_id },
        'Ingesting bolt event',
      );

      // 1. Find matching enabled automations for this trigger
      const matchingAutomations = await db
        .select({
          automation: boltAutomations,
        })
        .from(boltAutomations)
        .where(
          and(
            eq(boltAutomations.org_id, event.org_id),
            eq(boltAutomations.enabled, true),
            eq(boltAutomations.trigger_source, event.source),
            eq(boltAutomations.trigger_event, event.event_type),
          ),
        );

      if (matchingAutomations.length === 0) {
        return reply.send({
          data: {
            event_id: eventId,
            matched: 0,
            executions: [],
          },
        });
      }

      const executionResults: Array<{
        automation_id: string;
        automation_name: string;
        execution_id: string | null;
        status: 'queued' | 'skipped';
        reason?: string;
      }> = [];

      const redisClient = fastify.redis;
      const executeQueue = getExecuteQueue(redisClient);

      for (const { automation } of matchingAutomations) {
        // 2. Check chain depth (loop prevention)
        if (event.chain_depth && event.chain_depth >= automation.max_chain_depth) {
          // Log as skipped execution
          const [skippedExec] = await db
            .insert(boltExecutions)
            .values({
              automation_id: automation.id,
              status: 'skipped',
              trigger_event: { ...event.payload, _event_id: eventId, _source: event.source, _event_type: event.event_type },
              conditions_met: false,
              condition_log: null,
              error_message: `Skipped: max chain depth (${automation.max_chain_depth}) exceeded at depth ${event.chain_depth}`,
              completed_at: new Date(),
              duration_ms: 0,
            })
            .returning();

          executionResults.push({
            automation_id: automation.id,
            automation_name: automation.name,
            execution_id: skippedExec!.id,
            status: 'skipped',
            reason: 'max_chain_depth_exceeded',
          });
          continue;
        }

        // 3. Check rate limiting
        const rateKey = `bolt:rate:${automation.id}:hour`;
        const cooldownKey = `bolt:cooldown:${automation.id}`;

        // Check cooldown
        const cooldownActive = await redisClient.exists(cooldownKey);
        if (cooldownActive) {
          const [skippedExec] = await db
            .insert(boltExecutions)
            .values({
              automation_id: automation.id,
              status: 'skipped',
              trigger_event: { ...event.payload, _event_id: eventId, _source: event.source, _event_type: event.event_type },
              conditions_met: false,
              error_message: 'Skipped: cooldown period active',
              completed_at: new Date(),
              duration_ms: 0,
            })
            .returning();

          executionResults.push({
            automation_id: automation.id,
            automation_name: automation.name,
            execution_id: skippedExec!.id,
            status: 'skipped',
            reason: 'cooldown_active',
          });
          continue;
        }

        // Check hourly rate limit
        const currentCount = await redisClient.incr(rateKey);
        if (currentCount === 1) {
          await redisClient.expire(rateKey, 3600);
        }
        if (currentCount > automation.max_executions_per_hour) {
          const [skippedExec] = await db
            .insert(boltExecutions)
            .values({
              automation_id: automation.id,
              status: 'skipped',
              trigger_event: { ...event.payload, _event_id: eventId, _source: event.source, _event_type: event.event_type },
              conditions_met: false,
              error_message: `Skipped: rate limit exceeded (${automation.max_executions_per_hour}/hour)`,
              completed_at: new Date(),
              duration_ms: 0,
            })
            .returning();

          executionResults.push({
            automation_id: automation.id,
            automation_name: automation.name,
            execution_id: skippedExec!.id,
            status: 'skipped',
            reason: 'rate_limited',
          });
          continue;
        }

        // 4. Load conditions for this automation
        const conditions = await db
          .select()
          .from(boltConditions)
          .where(eq(boltConditions.automation_id, automation.id))
          .orderBy(asc(boltConditions.sort_order));

        // 5. Evaluate conditions against event payload
        const fullPayload: Record<string, unknown> = {
          event: event.payload,
          actor: {
            id: event.actor_id,
            type: event.actor_type ?? 'system',
          },
        };

        let conditionsMet = true;
        let conditionLog: unknown = null;

        if (conditions.length > 0) {
          const conditionDefs: ConditionDef[] = conditions.map((c) => ({
            field: c.field,
            operator: c.operator as ConditionDef['operator'],
            value: c.value,
            logic_group: (c.logic_group ?? 'and') as ConditionDef['logic_group'],
          }));

          const evalResult = evaluateConditions(conditionDefs, fullPayload);
          conditionsMet = evalResult.passed;
          conditionLog = evalResult.log;
        }

        // Also check trigger_filter if present
        if (conditionsMet && automation.trigger_filter) {
          const filter = automation.trigger_filter as Record<string, unknown>;
          for (const [key, expectedValue] of Object.entries(filter)) {
            const parts = key.split('.');
            let actual: unknown = event.payload;
            for (const part of parts) {
              if (actual === null || actual === undefined || typeof actual !== 'object') {
                actual = undefined;
                break;
              }
              actual = (actual as Record<string, unknown>)[part];
            }
            if (String(actual) !== String(expectedValue)) {
              conditionsMet = false;
              break;
            }
          }
        }

        if (!conditionsMet) {
          const [skippedExec] = await db
            .insert(boltExecutions)
            .values({
              automation_id: automation.id,
              status: 'skipped',
              trigger_event: { ...event.payload, _event_id: eventId, _source: event.source, _event_type: event.event_type },
              conditions_met: false,
              condition_log: conditionLog,
              error_message: 'Conditions not met',
              completed_at: new Date(),
              duration_ms: 0,
            })
            .returning();

          executionResults.push({
            automation_id: automation.id,
            automation_name: automation.name,
            execution_id: skippedExec!.id,
            status: 'skipped',
            reason: 'conditions_not_met',
          });
          continue;
        }

        // 6. Create execution record as 'running'
        const [execution] = await db
          .insert(boltExecutions)
          .values({
            automation_id: automation.id,
            status: 'running',
            trigger_event: { ...event.payload, _event_id: eventId, _source: event.source, _event_type: event.event_type },
            conditions_met: true,
            condition_log: conditionLog,
          })
          .returning();

        // 7. Set cooldown if configured
        if (automation.cooldown_seconds > 0) {
          await redisClient.set(cooldownKey, '1', 'EX', automation.cooldown_seconds);
        }

        // 8. Update last_executed_at
        await db
          .update(boltAutomations)
          .set({ last_executed_at: new Date() })
          .where(eq(boltAutomations.id, automation.id));

        // 9. Enqueue BullMQ job for execution
        await executeQueue.add(
          'bolt-execute',
          {
            execution_id: execution!.id,
            automation_id: automation.id,
            event_payload: event.payload,
            event_source: event.source,
            event_type: event.event_type,
            org_id: event.org_id,
            actor_id: event.actor_id,
            actor_type: event.actor_type ?? 'system',
            chain_depth: event.chain_depth ?? 0,
          },
          {
            attempts: 1, // Bolt handles retries at the action step level, not job level
            removeOnComplete: 1000,
            removeOnFail: 5000,
          },
        );

        executionResults.push({
          automation_id: automation.id,
          automation_name: automation.name,
          execution_id: execution!.id,
          status: 'queued',
        });
      }

      return reply.send({
        data: {
          event_id: eventId,
          matched: matchingAutomations.length,
          executions: executionResults,
        },
      });
    },
  );
}
