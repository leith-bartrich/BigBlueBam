import type Redis from 'ioredis';

let redisPublisher: Redis | null = null;

export function setRedisPublisher(redis: Redis) {
  redisPublisher = redis;
}

export interface BanterEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: string;
}

function publish(room: string, event: BanterEvent) {
  if (!redisPublisher) {
    throw new Error('Redis publisher not initialized');
  }
  const payload = JSON.stringify({ room, event });
  return redisPublisher.publish('banter:events', payload);
}

export function broadcastToChannel(channelId: string, event: BanterEvent) {
  return publish(`banter:channel:${channelId}`, event);
}

export function broadcastToUser(userId: string, event: BanterEvent) {
  return publish(`banter:user:${userId}`, event);
}

export function broadcastToOrg(orgId: string, event: BanterEvent) {
  return publish(`banter:org:${orgId}`, event);
}
