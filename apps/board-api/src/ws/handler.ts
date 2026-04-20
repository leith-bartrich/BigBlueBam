import type { FastifyInstance } from 'fastify';
import type { WebSocket } from '@fastify/websocket';
import Redis from 'ioredis';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { sessions, users, boards, boardCollaborators, projectMembers } from '../db/schema/index.js';
import { env } from '../env.js';
import { saveScene, type SceneData } from './persistence.js';
import {
  BOARD_ELEMENT_SOFT_LIMIT,
  BOARD_ELEMENT_HARD_LIMIT,
} from '../services/element-snapshot.service.js';
import { nanoid } from 'nanoid';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  orgId: string;
  boardId: string | null;
  displayName: string;
  color: string;
  canEdit: boolean;
  isAdminOrOwner: boolean;
  /** Message count in the current rate-limit window */
  msgCount: number;
  /** Timestamp (ms) when the current rate-limit window started */
  msgWindowStart: number;
}

/** Max WebSocket messages per client per window */
const WS_RATE_LIMIT_MAX = 120;
/** Rate-limit window duration in ms (10 seconds) */
const WS_RATE_LIMIT_WINDOW_MS = 10_000;

const CURSOR_COLORS = [
  '#FF6B6B', // red
  '#4ECDC4', // teal
  '#45B7D1', // sky blue
  '#96CEB4', // sage
  '#FFEAA7', // yellow
  '#DDA0DD', // plum
  '#98D8C8', // mint
  '#F7DC6F', // gold
];

const clients = new Map<WebSocket, ConnectedClient>();
const dirtyBoards = new Map<string, SceneData & { orgId: string }>();
const instanceId = nanoid(12);

let persistenceTimer: ReturnType<typeof setInterval> | null = null;

function broadcastToRoom(boardId: string, message: string, excludeWs?: WebSocket) {
  for (const [ws, client] of clients) {
    if (client.boardId === boardId && ws !== excludeWs && ws.readyState === 1) {
      ws.send(message);
    }
  }
}

function getCollaboratorsInRoom(boardId: string): Array<{ id: string; name: string; color: string }> {
  const collaborators: Array<{ id: string; name: string; color: string }> = [];
  const seen = new Set<string>();
  for (const [, client] of clients) {
    if (client.boardId === boardId && !seen.has(client.userId)) {
      seen.add(client.userId);
      collaborators.push({
        id: client.userId,
        name: client.displayName,
        color: client.color,
      });
    }
  }
  return collaborators;
}

function assignColor(boardId: string): string {
  const usedColors = new Set<string>();
  for (const [, client] of clients) {
    if (client.boardId === boardId) {
      usedColors.add(client.color);
    }
  }
  for (const color of CURSOR_COLORS) {
    if (!usedColors.has(color)) return color;
  }
  // All colors taken, cycle based on count
  return CURSOR_COLORS[usedColors.size % CURSOR_COLORS.length]!;
}

export default async function websocketHandler(fastify: FastifyInstance) {
  // Redis subscriber for cross-instance PubSub
  const subscriber = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
  await subscriber.connect();

  await subscriber.subscribe('board:events');

  subscriber.on('message', (_channel: string, message: string) => {
    try {
      const parsed = JSON.parse(message);
      // Skip messages from this instance
      if (parsed._instanceId === instanceId) return;

      const { boardId, event } = parsed;
      if (boardId && event) {
        const payload = JSON.stringify(event);
        broadcastToRoom(boardId, payload);
      }
    } catch {
      fastify.log.error('Failed to parse board PubSub message');
    }
  });

  // Periodic persistence: flush dirty boards every 5 seconds
  persistenceTimer = setInterval(async () => {
    for (const [boardId, scene] of dirtyBoards) {
      dirtyBoards.delete(boardId);
      try {
        await saveScene(boardId, scene.orgId, scene);
      } catch (err) {
        fastify.log.error({ boardId, err }, 'Failed to persist board scene');
        // Re-mark as dirty so next tick retries
        if (!dirtyBoards.has(boardId)) {
          dirtyBoards.set(boardId, scene);
        }
      }
    }
  }, 5000);

  fastify.addHook('onClose', async () => {
    if (persistenceTimer) {
      clearInterval(persistenceTimer);
      persistenceTimer = null;
    }
    // Flush remaining dirty boards on shutdown
    for (const [boardId, scene] of dirtyBoards) {
      try {
        await saveScene(boardId, scene.orgId, scene);
      } catch (err) {
        fastify.log.error({ boardId, err }, 'Failed to persist board scene on shutdown');
      }
    }
    dirtyBoards.clear();
    await subscriber.quit();
  });

  async function publishEvent(boardId: string, event: Record<string, unknown>) {
    try {
      await fastify.redis.publish(
        'board:events',
        JSON.stringify({ _instanceId: instanceId, boardId, event }),
      );
    } catch (err) {
      fastify.log.error({ err }, 'Failed to publish board event');
    }
  }

  interface BoardAccessResult {
    hasAccess: boolean;
    canEdit: boolean;
    locked: boolean;
  }

  /**
   * Check if a user has access to a board and determine edit permissions.
   * Returns access info including whether the user can edit.
   */
  async function checkBoardAccess(
    boardId: string,
    userId: string,
    orgId: string,
    userRole: string,
  ): Promise<BoardAccessResult> {
    const deny: BoardAccessResult = { hasAccess: false, canEdit: false, locked: false };

    const [board] = await db
      .select()
      .from(boards)
      .where(and(eq(boards.id, boardId), eq(boards.organization_id, orgId)))
      .limit(1);

    if (!board) return deny;
    if (board.archived_at) return deny;

    const locked = !!board.locked;
    const ROLE_HIERARCHY = ['viewer', 'member', 'admin', 'owner'] as const;
    const roleIdx = ROLE_HIERARCHY.indexOf(userRole as (typeof ROLE_HIERARCHY)[number]);
    const isOrgAdminOrOwner = roleIdx >= 2; // admin or owner

    // Org admins/owners always have full access
    if (isOrgAdminOrOwner) {
      return { hasAccess: true, canEdit: true, locked };
    }

    // Creator always has full access
    if (board.created_by === userId) {
      return { hasAccess: true, canEdit: true, locked };
    }

    // Organization-wide visibility: any org member can read and edit
    if (board.visibility === 'organization') {
      return { hasAccess: true, canEdit: true, locked };
    }

    // Project visibility: check project membership
    if (board.visibility === 'project' && board.project_id) {
      const [membership] = await db
        .select()
        .from(projectMembers)
        .where(
          and(
            eq(projectMembers.project_id, board.project_id),
            eq(projectMembers.user_id, userId),
          ),
        )
        .limit(1);
      if (membership) {
        return { hasAccess: true, canEdit: true, locked };
      }
    }

    // Check explicit collaborator
    const [collab] = await db
      .select()
      .from(boardCollaborators)
      .where(
        and(
          eq(boardCollaborators.board_id, boardId),
          eq(boardCollaborators.user_id, userId),
        ),
      )
      .limit(1);

    if (collab) {
      return {
        hasAccess: true,
        canEdit: collab.permission === 'edit',
        locked,
      };
    }

    return deny;
  }

  fastify.get('/ws', { websocket: true }, async (socket, request) => {
    // Authenticate via session cookie
    const sessionId = request.cookies?.session;
    if (!sessionId) {
      socket.close(4001, 'Authentication required');
      return;
    }

    const result = await db
      .select({
        session: sessions,
        user: {
          id: users.id,
          org_id: users.org_id,
          email: users.email,
          display_name: users.display_name,
          role: users.role,
          is_active: users.is_active,
          is_superuser: users.is_superuser,
        },
      })
      .from(sessions)
      .innerJoin(users, eq(sessions.user_id, users.id))
      .where(eq(sessions.id, sessionId))
      .limit(1);

    const row = result[0];
    if (!row || new Date(row.session.expires_at) <= new Date() || !row.user.is_active) {
      socket.close(4001, 'Invalid or expired session');
      return;
    }

    const userId = row.user.id;
    const orgId = row.user.org_id;
    const displayName = row.user.display_name;

    const ROLE_HIERARCHY = ['viewer', 'member', 'admin', 'owner'] as const;
    const roleIdx = ROLE_HIERARCHY.indexOf(row.user.role as (typeof ROLE_HIERARCHY)[number]);
    const isAdminOrOwner = row.user.is_superuser || roleIdx >= 2;

    const client: ConnectedClient = {
      ws: socket,
      userId,
      orgId,
      boardId: null,
      displayName,
      color: CURSOR_COLORS[0]!,
      canEdit: false,
      isAdminOrOwner,
      msgCount: 0,
      msgWindowStart: Date.now(),
    };
    clients.set(socket, client);

    // Send connected confirmation
    socket.send(
      JSON.stringify({
        type: 'connected',
        data: { user_id: userId, org_id: orgId },
        timestamp: new Date().toISOString(),
      }),
    );

    socket.on('message', async (raw: Buffer | string) => {
      // Per-client WebSocket rate limiting
      const now = Date.now();
      if (now - client.msgWindowStart > WS_RATE_LIMIT_WINDOW_MS) {
        client.msgCount = 0;
        client.msgWindowStart = now;
      }
      client.msgCount++;
      if (client.msgCount > WS_RATE_LIMIT_MAX) {
        socket.close(4429, 'Rate limit exceeded');
        return;
      }

      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString());

        switch (msg.type) {
          case 'join_board': {
            const boardId = msg.boardId as string;
            if (!boardId) break;

            // Validate access and determine edit permissions
            let canEdit: boolean;
            if (row.user.is_superuser) {
              canEdit = true;
            } else {
              const access = await checkBoardAccess(boardId, userId, orgId, row.user.role);
              if (!access.hasAccess) {
                socket.send(
                  JSON.stringify({
                    type: 'error',
                    data: { code: 'FORBIDDEN', message: 'No access to this board' },
                    timestamp: new Date().toISOString(),
                  }),
                );
                break;
              }
              canEdit = access.canEdit;
            }
            client.canEdit = canEdit;

            // Leave previous board if any
            if (client.boardId && client.boardId !== boardId) {
              const oldBoardId = client.boardId;
              client.boardId = null;
              const leftMsg = JSON.stringify({
                type: 'user_left',
                data: { id: userId },
                timestamp: new Date().toISOString(),
              });
              broadcastToRoom(oldBoardId, leftMsg);
              await publishEvent(oldBoardId, {
                type: 'user_left',
                data: { id: userId },
                timestamp: new Date().toISOString(),
              });
            }

            // Assign color and join room
            client.boardId = boardId;
            client.color = assignColor(boardId);

            // Send room_state to the joining user
            const collaborators = getCollaboratorsInRoom(boardId);
            socket.send(
              JSON.stringify({
                type: 'room_state',
                data: { collaborators },
                timestamp: new Date().toISOString(),
              }),
            );

            // Broadcast user_joined to others
            const joinedMsg = JSON.stringify({
              type: 'user_joined',
              data: { id: userId, name: displayName, color: client.color },
              timestamp: new Date().toISOString(),
            });
            broadcastToRoom(boardId, joinedMsg, socket);
            await publishEvent(boardId, {
              type: 'user_joined',
              data: { id: userId, name: displayName, color: client.color },
              timestamp: new Date().toISOString(),
            });
            break;
          }

          case 'scene_update': {
            if (!client.boardId) break;

            // Reject scene updates from view-only collaborators
            if (!client.canEdit) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  data: { code: 'FORBIDDEN', message: 'You do not have edit permission on this board' },
                  timestamp: new Date().toISOString(),
                }),
              );
              break;
            }

            // Reject scene updates on locked boards unless user is admin/owner
            // We re-check lock status from DB to avoid stale cached state
            {
              const [currentBoard] = await db
                .select({ locked: boards.locked })
                .from(boards)
                .where(eq(boards.id, client.boardId))
                .limit(1);
              if (currentBoard?.locked && !client.isAdminOrOwner) {
                socket.send(
                  JSON.stringify({
                    type: 'error',
                    data: { code: 'FORBIDDEN', message: 'Board is locked. Only the owner or an admin can edit it.' },
                    timestamp: new Date().toISOString(),
                  }),
                );
                break;
              }
            }

            const elements = msg.elements;
            if (!Array.isArray(elements)) break;

            // Reject oversized scene updates to prevent DoS
            if (elements.length > 50000) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  data: { code: 'PAYLOAD_TOO_LARGE', message: 'Scene update exceeds maximum element count (50000)' },
                  timestamp: new Date().toISOString(),
                }),
              );
              break;
            }

            // Element count limit enforcement (design section 10).
            // Count non-deleted elements only.
            const liveCount = elements.filter(
              (e: Record<string, unknown>) => e && e.isDeleted !== true,
            ).length;

            if (liveCount > BOARD_ELEMENT_HARD_LIMIT) {
              socket.send(
                JSON.stringify({
                  type: 'error',
                  data: {
                    code: 'ELEMENT_LIMIT_EXCEEDED',
                    message: `Board has ${liveCount} elements, exceeding the hard limit of ${BOARD_ELEMENT_HARD_LIMIT}. Remove some elements before adding more.`,
                    limit: BOARD_ELEMENT_HARD_LIMIT,
                    current: liveCount,
                  },
                  timestamp: new Date().toISOString(),
                }),
              );
              break;
            }

            if (liveCount > BOARD_ELEMENT_SOFT_LIMIT) {
              // Warn the user but allow the save to proceed.
              socket.send(
                JSON.stringify({
                  type: 'warning',
                  data: {
                    code: 'ELEMENT_SOFT_LIMIT',
                    message: `Board has ${liveCount} elements (soft limit: ${BOARD_ELEMENT_SOFT_LIMIT}). Performance may degrade. Hard limit: ${BOARD_ELEMENT_HARD_LIMIT}.`,
                    limit: BOARD_ELEMENT_SOFT_LIMIT,
                    hard_limit: BOARD_ELEMENT_HARD_LIMIT,
                    current: liveCount,
                  },
                  timestamp: new Date().toISOString(),
                }),
              );
            }

            // Mark board as dirty for periodic persistence
            const existing = dirtyBoards.get(client.boardId);
            dirtyBoards.set(client.boardId, {
              elements,
              appState: existing?.appState ?? {},
              files: existing?.files ?? {},
              orgId: client.orgId,
            });

            // Broadcast to all others in room
            const updateMsg = JSON.stringify({
              type: 'scene_update',
              data: { elements, userId },
              timestamp: new Date().toISOString(),
            });
            broadcastToRoom(client.boardId, updateMsg, socket);
            await publishEvent(client.boardId, {
              type: 'scene_update',
              data: { elements, userId },
              timestamp: new Date().toISOString(),
            });
            break;
          }

          case 'cursor_update': {
            if (!client.boardId) break;
            const { pointer, button, tool } = msg;
            if (!pointer || typeof pointer.x !== 'number' || typeof pointer.y !== 'number') break;

            const cursorMsg = JSON.stringify({
              type: 'cursor_update',
              data: {
                userId,
                pointer,
                button: button ?? 'up',
                tool: tool ?? 'pointer',
                color: client.color,
                username: displayName,
              },
              timestamp: new Date().toISOString(),
            });
            broadcastToRoom(client.boardId, cursorMsg, socket);
            // Cursor updates are high-frequency; skip Redis PubSub to reduce overhead.
            // Cross-instance cursor sharing can be added later if needed.
            break;
          }

          case 'ping': {
            socket.send(
              JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString(),
              }),
            );
            break;
          }

          default:
            break;
        }
      } catch {
        fastify.log.warn('Invalid WebSocket message received');
      }
    });

    socket.on('close', async () => {
      const boardId = client.boardId;
      clients.delete(socket);

      if (boardId) {
        const leftMsg = JSON.stringify({
          type: 'user_left',
          data: { id: userId },
          timestamp: new Date().toISOString(),
        });
        broadcastToRoom(boardId, leftMsg);
        await publishEvent(boardId, {
          type: 'user_left',
          data: { id: userId },
          timestamp: new Date().toISOString(),
        });
      }
    });

    socket.on('error', () => {
      const boardId = client.boardId;
      clients.delete(socket);

      if (boardId) {
        const leftMsg = JSON.stringify({
          type: 'user_left',
          data: { id: userId },
          timestamp: new Date().toISOString(),
        });
        broadcastToRoom(boardId, leftMsg);
      }
    });
  });
}
