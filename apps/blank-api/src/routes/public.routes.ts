import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as formService from '../services/form.service.js';
import * as submissionService from '../services/submission.service.js';

// ---------------------------------------------------------------------------
// Public form endpoints (no auth required)
// ---------------------------------------------------------------------------

const submitSchema = z.object({
  response_data: z.record(z.unknown()),
  email: z.string().email().optional(),
  captcha_token: z.string().optional(),
});

export default async function publicRoutes(fastify: FastifyInstance) {
  // GET /forms/:slug/definition — Get form field definitions
  fastify.get<{ Params: { slug: string } }>(
    '/forms/:slug/definition',
    async (request, reply) => {
      const form = await formService.getFormBySlug(request.params.slug);
      return reply.send({
        data: {
          id: form.id,
          name: form.name,
          description: form.description,
          slug: form.slug,
          form_type: form.form_type,
          accept_responses: form.accept_responses,
          show_progress_bar: form.show_progress_bar,
          confirmation_type: form.confirmation_type,
          confirmation_message: form.confirmation_message,
          confirmation_redirect_url: form.confirmation_redirect_url,
          header_image_url: form.header_image_url,
          theme_color: form.theme_color,
          custom_css: form.custom_css,
          fields: form.fields,
        },
      });
    },
  );

  // POST /forms/:slug/submit — Submit a response
  fastify.post<{ Params: { slug: string } }>(
    '/forms/:slug/submit',
    {
      config: { rateLimit: { max: 10, timeWindow: '1 hour' } },
    },
    async (request, reply) => {
      const body = submitSchema.parse(request.body);
      const form = await formService.getFormBySlug(request.params.slug);

      // BLANK-008: Enforce CAPTCHA when enabled on the form
      if (form.captcha_enabled && !body.captcha_token) {
        return reply.status(400).send({
          error: {
            code: 'CAPTCHA_REQUIRED',
            message: 'CAPTCHA verification is required for this form',
            details: [{ field: 'captcha_token', issue: 'required' }],
            request_id: request.id,
          },
        });
      }

      if (!form.accept_responses) {
        return reply.status(400).send({
          error: {
            code: 'FORM_CLOSED',
            message: 'This form is no longer accepting responses',
            details: [],
            request_id: request.id,
          },
        });
      }

      const submission = await submissionService.createSubmission(
        form.id,
        form.organization_id,
        {
          response_data: body.response_data,
          submitted_by_email: body.email ?? (body.response_data.email as string | undefined),
          submitted_by_ip: request.ip,
          user_agent: request.headers['user-agent'] ?? undefined,
        },
      );

      return reply.status(201).send({
        data: {
          id: submission.id,
          confirmation_type: form.confirmation_type,
          confirmation_message: form.confirmation_message,
          confirmation_redirect_url: form.confirmation_redirect_url,
        },
      });
    },
  );
}
