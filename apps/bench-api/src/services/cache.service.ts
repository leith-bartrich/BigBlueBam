import type Redis from 'ioredis';

const CACHE_PREFIX = 'bench:query:';

/**
 * Simple Redis caching for widget query results.
 */
export class CacheService {
  constructor(
    private redis: Redis,
    private defaultTtl: number = 60,
  ) {}

  private key(widgetId: string): string {
    return `${CACHE_PREFIX}${widgetId}`;
  }

  async get(widgetId: string): Promise<unknown | null> {
    const data = await this.redis.get(this.key(widgetId));
    if (!data) return null;
    try {
      return JSON.parse(data);
    } catch {
      return null;
    }
  }

  async set(widgetId: string, data: unknown, ttl?: number): Promise<void> {
    const seconds = ttl ?? this.defaultTtl;
    await this.redis.setex(this.key(widgetId), seconds, JSON.stringify(data));
  }

  async invalidate(widgetId: string): Promise<void> {
    await this.redis.del(this.key(widgetId));
  }

  async invalidateDashboard(dashboardPrefix: string): Promise<void> {
    const keys = await this.redis.keys(`${CACHE_PREFIX}${dashboardPrefix}*`);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
}
