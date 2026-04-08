import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../plugins/auth.js';
import * as reportGenerator from '../services/report-generator.js';

const generateReportSchema = z.object({
  type: z.enum(['period', 'at_risk', 'owner']),
  period_id: z.string().uuid().optional(),
  user_id: z.string().uuid().optional(),
});

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function reportRoutes(fastify: FastifyInstance) {
  // GET /reports/period/:periodId — Period report
  fastify.get<{ Params: { periodId: string } }>(
    '/reports/period/:periodId',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!UUID_REGEX.test(request.params.periodId)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Valid period id is required',
            details: [],
            request_id: request.id,
          },
        });
      }
      const report = await reportGenerator.generatePeriodReport(
        request.params.periodId,
        request.user!.org_id,
      );
      return reply.send({ data: report });
    },
  );

  // GET /reports/at-risk — At-risk goals report
  fastify.get(
    '/reports/at-risk',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const report = await reportGenerator.generateAtRiskReport(request.user!.org_id);
      return reply.send({ data: report });
    },
  );

  // GET /reports/owner/:userId — User's goals report
  fastify.get<{ Params: { userId: string } }>(
    '/reports/owner/:userId',
    {
      config: { rateLimit: { max: 20, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!UUID_REGEX.test(request.params.userId)) {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Valid user id is required',
            details: [],
            request_id: request.id,
          },
        });
      }
      const report = await reportGenerator.generateOwnerReport(
        request.params.userId,
        request.user!.org_id,
      );
      return reply.send({ data: report });
    },
  );

  // POST /reports/generate — Generate formatted report
  fastify.post(
    '/reports/generate',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      const { type, period_id, user_id } = generateReportSchema.parse(request.body);

      let report;
      switch (type) {
        case 'period':
          if (!period_id) {
            return reply.status(400).send({
              error: {
                code: 'VALIDATION_ERROR',
                message: 'period_id is required for period reports',
                details: [],
                request_id: request.id,
              },
            });
          }
          report = await reportGenerator.generatePeriodReport(period_id, request.user!.org_id);
          break;
        case 'at_risk':
          report = await reportGenerator.generateAtRiskReport(request.user!.org_id);
          break;
        case 'owner':
          report = await reportGenerator.generateOwnerReport(
            user_id ?? request.user!.id,
            request.user!.org_id,
          );
          break;
      }

      return reply.send({ data: report });
    },
  );
}
