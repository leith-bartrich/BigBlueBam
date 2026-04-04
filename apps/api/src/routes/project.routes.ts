import type { FastifyInstance } from 'fastify';
import { createProjectSchema, updateProjectSchema, addProjectMemberSchema } from '@bigbluebam/shared';
import * as projectService from '../services/project.service.js';
import * as orgService from '../services/org.service.js';
import { checkOrgPermission, isOrgPrivileged } from '../services/org-permissions.js';
import { requireAuth, requireScope, requireMinRole } from '../plugins/auth.js';
import { requireProjectRole } from '../middleware/authorize.js';

export default async function projectRoutes(fastify: FastifyInstance) {
  fastify.get('/projects', { preHandler: [requireAuth] }, async (request, reply) => {
    const projects = await projectService.listProjects(
      request.user!.org_id,
      request.user!.id,
    );

    return reply.send({ data: projects });
  });

  fastify.post('/projects', { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] }, async (request, reply) => {
    // Enforce org-level permission: members_can_create_projects
    if (!request.user!.is_superuser && !isOrgPrivileged(request.user!.role)) {
      const org = await orgService.getOrganization(request.user!.org_id);
      if (!checkOrgPermission(org?.settings as Record<string, unknown> | null, 'members_can_create_projects')) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Your organization does not allow members to create projects',
            details: [],
            request_id: request.id,
          },
        });
      }
    }

    const data = createProjectSchema.parse(request.body);
    const project = await projectService.createProject(
      request.user!.org_id,
      data,
      request.user!.id,
    );

    return reply.status(201).send({ data: project });
  });

  fastify.get<{ Params: { id: string } }>(
    '/projects/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const project = await projectService.getProject(request.params.id);
      if (!project) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: project });
    },
  );

  fastify.patch<{ Params: { id: string } }>(
    '/projects/:id',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      // Check admin role
      const membership = await projectService.getProjectMembership(
        request.params.id,
        request.user!.id,
      );
      if (!membership || membership.role !== 'admin') {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Project admin role required',
            details: [],
            request_id: request.id,
          },
        });
      }

      const data = updateProjectSchema.parse(request.body);
      const project = await projectService.updateProject(request.params.id, data);

      if (!project) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: project });
    },
  );

  fastify.delete<{ Params: { id: string } }>(
    '/projects/:id',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write')] },
    async (request, reply) => {
      const membership = await projectService.getProjectMembership(
        request.params.id,
        request.user!.id,
      );
      if (!membership || membership.role !== 'admin') {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Project admin role required',
            details: [],
            request_id: request.id,
          },
        });
      }

      const project = await projectService.archiveProject(request.params.id);
      if (!project) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Project not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      return reply.send({ data: project });
    },
  );

  fastify.get<{ Params: { id: string } }>(
    '/projects/:id/members',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const members = await projectService.getProjectMembers(request.params.id);
      return reply.send({ data: members });
    },
  );

  fastify.post<{ Params: { id: string } }>(
    '/projects/:id/members',
    { preHandler: [requireAuth, requireMinRole('member'), requireScope('read_write'), requireProjectRole('admin')] },
    async (request, reply) => {
      const membership = await projectService.getProjectMembership(
        request.params.id,
        request.user!.id,
      );
      if (!membership || membership.role !== 'admin') {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Project admin role required',
            details: [],
            request_id: request.id,
          },
        });
      }

      const data = addProjectMemberSchema.parse(request.body);
      const newMembership = await projectService.addProjectMember(
        request.params.id,
        data.user_id,
        data.role,
      );

      return reply.status(201).send({ data: newMembership });
    },
  );
}
