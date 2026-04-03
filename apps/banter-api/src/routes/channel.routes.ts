import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { eq, and, sql, desc, ne, isNull } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  banterChannels,
  banterChannelMemberships,
  banterMessages,
  users,
} from '../db/schema/index.js';
import { requireAuth } from '../plugins/auth.js';
import { broadcastToOrg, broadcastToChannel } from '../services/realtime.js';

const createChannelSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]*$/, 'Must be lowercase alphanumeric with hyphens'),
  type: z.enum(['public', 'private']).default('public'),
  topic: z.string().max(500).optional(),
  description: z.string().optional(),
  channel_group_id: z.string().uuid().optional(),
});

const updateChannelSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  display_name: z.string().max(100).nullable().optional(),
  topic: z.string().max(500).nullable().optional(),
  description: z.string().nullable().optional(),
  icon: z.string().max(10).nullable().optional(),
  channel_group_id: z.string().uuid().nullable().optional(),
  allow_bots: z.boolean().optional(),
  allow_huddles: z.boolean().optional(),
  message_retention_days: z.number().int().min(0).nullable().optional(),
});

const addMembersSchema = z.object({
  user_ids: z.array(z.string().uuid()).min(1).max(100),
});

const markReadSchema = z.object({
  message_id: z.string().uuid(),
});

export default async function channelRoutes(fastify: FastifyInstance) {
  // GET /v1/channels — list user's channels with unread counts
  fastify.get(
    '/v1/channels',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      // Auto-create #general if no channels exist for this org
      try {
        const [existing] = await db
          .select({ id: banterChannels.id })
          .from(banterChannels)
          .where(and(eq(banterChannels.org_id, user.org_id), eq(banterChannels.type, 'public')))
          .limit(1);

        if (!existing) {
          const [general] = await db
            .insert(banterChannels)
            .values({
              org_id: user.org_id,
              name: 'general',
              slug: 'general',
              type: 'public',
              topic: 'General discussion',
              description: 'The default channel for team communication',
              is_default: true,
              created_by: user.id,
            })
            .returning();

          if (general) {
            // Add current user as owner
            await db.insert(banterChannelMemberships).values({
              channel_id: general.id,
              user_id: user.id,
              role: 'owner',
            });

            // Add all other active org members
            const orgMembers = await db.execute(
              sql`SELECT id FROM users WHERE org_id = ${user.org_id} AND is_active = true AND id != ${user.id}`
            );
            const memberRows = Array.isArray(orgMembers) ? orgMembers : (orgMembers as any).rows ?? [];
            for (const m of memberRows) {
              await db.insert(banterChannelMemberships).values({
                channel_id: general.id,
                user_id: (m as any).id,
                role: 'member',
              }).onConflictDoNothing();
            }
          }
        }
      } catch {
        // Don't fail the channel list if auto-creation fails
      }

      const rows = await db
        .select({
          channel: banterChannels,
          membership: banterChannelMemberships,
        })
        .from(banterChannelMemberships)
        .innerJoin(
          banterChannels,
          eq(banterChannelMemberships.channel_id, banterChannels.id),
        )
        .where(
          and(
            eq(banterChannelMemberships.user_id, user.id),
            eq(banterChannels.is_archived, false),
          ),
        )
        .orderBy(desc(banterChannels.last_message_at));

      // Compute unread counts
      const channels = await Promise.all(
        rows.map(async (row) => {
          let unread_count = 0;
          if (row.membership.last_read_message_id) {
            const unreadResult = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(banterMessages)
              .where(
                and(
                  eq(banterMessages.channel_id, row.channel.id),
                  eq(banterMessages.is_deleted, false),
                  isNull(banterMessages.thread_parent_id),
                  sql`${banterMessages.created_at} > (SELECT created_at FROM banter_messages WHERE id = ${row.membership.last_read_message_id})`,
                ),
              );
            unread_count = unreadResult[0]?.count ?? 0;
          } else {
            // No read cursor — everything is unread
            const countResult = await db
              .select({ count: sql<number>`count(*)::int` })
              .from(banterMessages)
              .where(
                and(
                  eq(banterMessages.channel_id, row.channel.id),
                  eq(banterMessages.is_deleted, false),
                  isNull(banterMessages.thread_parent_id),
                ),
              );
            unread_count = countResult[0]?.count ?? 0;
          }

          return {
            ...row.channel,
            role: row.membership.role,
            is_muted: row.membership.is_muted,
            notifications: row.membership.notifications,
            last_read_message_id: row.membership.last_read_message_id,
            unread_count,
          };
        }),
      );

      return reply.send({ data: channels });
    },
  );

  // POST /v1/channels — create channel
  fastify.post(
    '/v1/channels',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;
      const body = createChannelSchema.parse(request.body);

      // Check if this is the first channel for the org (auto-create #general)
      const existingChannels = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(banterChannels)
        .where(
          and(
            eq(banterChannels.org_id, user.org_id),
            ne(banterChannels.type, 'dm'),
            ne(banterChannels.type, 'group_dm'),
          ),
        );

      const isFirstChannel = (existingChannels[0]?.count ?? 0) === 0;
      const channelName = isFirstChannel ? 'general' : body.name;
      const slug = channelName.toLowerCase().replace(/\s+/g, '-');

      const [channel] = await db
        .insert(banterChannels)
        .values({
          org_id: user.org_id,
          name: channelName,
          slug,
          type: body.type,
          topic: body.topic ?? null,
          description: body.description ?? null,
          channel_group_id: body.channel_group_id ?? null,
          created_by: user.id,
          is_default: isFirstChannel,
          member_count: 1,
        })
        .returning();

      // Auto-add creator as owner
      await db.insert(banterChannelMemberships).values({
        channel_id: channel.id,
        user_id: user.id,
        role: 'owner',
      });

      // If first channel, add all org members
      if (isFirstChannel) {
        const orgUsers = await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.org_id, user.org_id), eq(users.is_active, true), ne(users.id, user.id)));

        if (orgUsers.length > 0) {
          await db.insert(banterChannelMemberships).values(
            orgUsers.map((u) => ({
              channel_id: channel.id,
              user_id: u.id,
              role: 'member' as const,
            })),
          );

          // Update member count
          await db
            .update(banterChannels)
            .set({ member_count: orgUsers.length + 1 })
            .where(eq(banterChannels.id, channel.id));
        }
      }

      broadcastToOrg(user.org_id, {
        type: 'channel.created',
        data: { channel },
        timestamp: new Date().toISOString(),
      });

      return reply.status(201).send({ data: channel });
    },
  );

  // GET /v1/channels/browse — list all public channels
  fastify.get(
    '/v1/channels/browse',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const user = request.user!;

      const channels = await db
        .select()
        .from(banterChannels)
        .where(
          and(
            eq(banterChannels.org_id, user.org_id),
            eq(banterChannels.type, 'public'),
            eq(banterChannels.is_archived, false),
          ),
        )
        .orderBy(banterChannels.name);

      return reply.send({ data: channels });
    },
  );

  // GET /v1/channels/:id — channel detail (accepts UUID id or slug)
  fastify.get(
    '/v1/channels/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      // Support lookup by UUID or slug
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
      const condition = isUuid
        ? and(eq(banterChannels.id, id), eq(banterChannels.org_id, user.org_id))
        : and(eq(banterChannels.slug, id), eq(banterChannels.org_id, user.org_id));

      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(condition)
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Private channel isolation: verify the requesting user is a member.
      // Return 404 (not 403) to avoid leaking that the channel exists.
      if (channel.type === 'private') {
        const [membership] = await db
          .select({ id: banterChannelMemberships.id })
          .from(banterChannelMemberships)
          .where(
            and(
              eq(banterChannelMemberships.channel_id, channel.id),
              eq(banterChannelMemberships.user_id, user.id),
            ),
          )
          .limit(1);

        if (!membership) {
          return reply.status(404).send({
            error: {
              code: 'NOT_FOUND',
              message: 'Channel not found',
              details: [],
              request_id: request.id,
            },
          });
        }
      }

      return reply.send({ data: channel });
    },
  );

  // PATCH /v1/channels/:id — update settings
  fastify.patch(
    '/v1/channels/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const body = updateChannelSchema.parse(request.body);

      // Verify channel exists and user has permission
      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(and(eq(banterChannels.id, id), eq(banterChannels.org_id, user.org_id)))
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Check membership role
      const [membership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (
        !membership ||
        (membership.role === 'member' && !['owner', 'admin'].includes(user.role))
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to update this channel',
            details: [],
            request_id: request.id,
          },
        });
      }

      const updateData: Record<string, unknown> = {};
      if (body.name !== undefined) {
        updateData.name = body.name;
        updateData.slug = body.name.toLowerCase().replace(/\s+/g, '-');
      }
      if (body.display_name !== undefined) updateData.display_name = body.display_name;
      if (body.topic !== undefined) updateData.topic = body.topic;
      if (body.description !== undefined) updateData.description = body.description;
      if (body.icon !== undefined) updateData.icon = body.icon;
      if (body.channel_group_id !== undefined) updateData.channel_group_id = body.channel_group_id;
      if (body.allow_bots !== undefined) updateData.allow_bots = body.allow_bots;
      if (body.allow_huddles !== undefined) updateData.allow_huddles = body.allow_huddles;
      if (body.message_retention_days !== undefined)
        updateData.message_retention_days = body.message_retention_days;

      const [updated] = await db
        .update(banterChannels)
        .set(updateData)
        .where(eq(banterChannels.id, id))
        .returning();

      broadcastToChannel(id, {
        type: 'channel.updated',
        data: { channel: updated },
        timestamp: new Date().toISOString(),
      });

      return reply.send({ data: updated });
    },
  );

  // DELETE /v1/channels/:id — soft delete (archive)
  fastify.delete(
    '/v1/channels/:id',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(and(eq(banterChannels.id, id), eq(banterChannels.org_id, user.org_id)))
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Only org admin/owner or channel owner can archive
      const [membership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (
        !['owner', 'admin'].includes(user.role) &&
        (!membership || membership.role !== 'owner')
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to archive this channel',
            details: [],
            request_id: request.id,
          },
        });
      }

      const [archived] = await db
        .update(banterChannels)
        .set({ is_archived: true })
        .where(eq(banterChannels.id, id))
        .returning();

      broadcastToOrg(user.org_id, {
        type: 'channel.archived',
        data: { channel: archived },
        timestamp: new Date().toISOString(),
      });

      return reply.send({ data: archived });
    },
  );

  // POST /v1/channels/:id/join — join public channel
  fastify.post(
    '/v1/channels/:id/join',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(
          and(
            eq(banterChannels.id, id),
            eq(banterChannels.org_id, user.org_id),
            eq(banterChannels.is_archived, false),
          ),
        )
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      if (channel.type !== 'public') {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Can only join public channels',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Check if already a member
      const [existing] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (existing) {
        return reply.send({ data: { channel_id: id, user_id: user.id, already_member: true } });
      }

      await db.insert(banterChannelMemberships).values({
        channel_id: id,
        user_id: user.id,
        role: 'member',
      });

      await db
        .update(banterChannels)
        .set({ member_count: sql`${banterChannels.member_count} + 1` })
        .where(eq(banterChannels.id, id));

      broadcastToChannel(id, {
        type: 'member.joined',
        data: { channel_id: id, user_id: user.id, display_name: user.display_name },
        timestamp: new Date().toISOString(),
      });

      return reply.send({
        data: { channel_id: id, user_id: user.id, already_member: false },
      });
    },
  );

  // POST /v1/channels/:id/leave — leave channel
  fastify.post(
    '/v1/channels/:id/leave',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;

      const deleted = await db
        .delete(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .returning();

      if (deleted.length > 0) {
        await db
          .update(banterChannels)
          .set({ member_count: sql`GREATEST(${banterChannels.member_count} - 1, 0)` })
          .where(eq(banterChannels.id, id));

        broadcastToChannel(id, {
          type: 'member.left',
          data: { channel_id: id, user_id: user.id },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ data: { success: true } });
    },
  );

  // GET /v1/channels/:id/members — list members
  fastify.get(
    '/v1/channels/:id/members',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const members = await db
        .select({
          id: banterChannelMemberships.id,
          user_id: users.id,
          display_name: users.display_name,
          email: users.email,
          avatar_url: users.avatar_url,
          role: banterChannelMemberships.role,
          joined_at: banterChannelMemberships.joined_at,
          is_muted: banterChannelMemberships.is_muted,
        })
        .from(banterChannelMemberships)
        .innerJoin(users, eq(banterChannelMemberships.user_id, users.id))
        .where(eq(banterChannelMemberships.channel_id, id))
        .orderBy(banterChannelMemberships.joined_at);

      return reply.send({ data: members });
    },
  );

  // POST /v1/channels/:id/members — add members
  fastify.post(
    '/v1/channels/:id/members',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const body = addMembersSchema.parse(request.body);

      // Verify channel exists
      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(and(eq(banterChannels.id, id), eq(banterChannels.org_id, user.org_id)))
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Check requester has permission
      const [membership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (
        !membership ||
        (membership.role === 'member' && !['owner', 'admin'].includes(user.role))
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to add members',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Insert memberships (ignore conflicts)
      let addedCount = 0;
      for (const userId of body.user_ids) {
        try {
          await db
            .insert(banterChannelMemberships)
            .values({
              channel_id: id,
              user_id: userId,
              role: 'member',
            })
            .onConflictDoNothing();
          addedCount++;
        } catch {
          // Skip users that don't exist
        }
      }

      if (addedCount > 0) {
        await db
          .update(banterChannels)
          .set({ member_count: sql`${banterChannels.member_count} + ${addedCount}` })
          .where(eq(banterChannels.id, id));
      }

      return reply.send({ data: { added: addedCount } });
    },
  );

  // DELETE /v1/channels/:id/members/:userId — remove member
  fastify.delete(
    '/v1/channels/:id/members/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const user = request.user!;

      // Check requester has permission
      const [membership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (
        !membership ||
        (membership.role === 'member' && !['owner', 'admin'].includes(user.role))
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Insufficient permissions to remove members',
            details: [],
            request_id: request.id,
          },
        });
      }

      const deleted = await db
        .delete(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, userId),
          ),
        )
        .returning();

      if (deleted.length > 0) {
        await db
          .update(banterChannels)
          .set({ member_count: sql`GREATEST(${banterChannels.member_count} - 1, 0)` })
          .where(eq(banterChannels.id, id));

        broadcastToChannel(id, {
          type: 'member.left',
          data: { channel_id: id, user_id: userId },
          timestamp: new Date().toISOString(),
        });
      }

      return reply.send({ data: { success: true } });
    },
  );

  // PATCH /v1/channels/:id/members/:userId — update member role
  fastify.patch(
    '/v1/channels/:id/members/:userId',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      const user = request.user!;
      const body = z.object({ role: z.enum(['admin', 'member']) }).parse(request.body);

      // Verify channel exists and belongs to org
      const [channel] = await db
        .select()
        .from(banterChannels)
        .where(and(eq(banterChannels.id, id), eq(banterChannels.org_id, user.org_id)))
        .limit(1);

      if (!channel) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Channel not found',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Only channel owner or org admin can change member roles
      const [requesterMembership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        )
        .limit(1);

      if (
        !['owner', 'admin'].includes(user.role) &&
        (!requesterMembership || requesterMembership.role !== 'owner')
      ) {
        return reply.status(403).send({
          error: {
            code: 'FORBIDDEN',
            message: 'Only the channel owner or org admin can update member roles',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Verify target membership exists
      const [targetMembership] = await db
        .select()
        .from(banterChannelMemberships)
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, userId),
          ),
        )
        .limit(1);

      if (!targetMembership) {
        return reply.status(404).send({
          error: {
            code: 'NOT_FOUND',
            message: 'Member not found in this channel',
            details: [],
            request_id: request.id,
          },
        });
      }

      // Cannot change the owner's role
      if (targetMembership.role === 'owner') {
        return reply.status(400).send({
          error: {
            code: 'BAD_REQUEST',
            message: 'Cannot change the channel owner role',
            details: [],
            request_id: request.id,
          },
        });
      }

      const [updated] = await db
        .update(banterChannelMemberships)
        .set({ role: body.role })
        .where(eq(banterChannelMemberships.id, targetMembership.id))
        .returning();

      broadcastToChannel(id, {
        type: 'member.role_updated',
        data: { channel_id: id, user_id: userId, role: body.role },
        timestamp: new Date().toISOString(),
      });

      return reply.send({ data: updated });
    },
  );

  // POST /v1/channels/:id/mark-read — update last_read_message_id
  fastify.post(
    '/v1/channels/:id/mark-read',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const user = request.user!;
      const body = markReadSchema.parse(request.body);

      await db
        .update(banterChannelMemberships)
        .set({
          last_read_message_id: body.message_id,
          last_read_at: new Date(),
        })
        .where(
          and(
            eq(banterChannelMemberships.channel_id, id),
            eq(banterChannelMemberships.user_id, user.id),
          ),
        );

      return reply.send({ data: { success: true } });
    },
  );
}
