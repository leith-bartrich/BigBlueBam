export interface RateLimitStatus {
  requests_this_minute: number;
  limit_per_minute: number;
  remaining: number;
  resets_at: string;
}

export class RateLimiter {
  private rpm: number;
  private requests: Map<string, number[]> = new Map();

  constructor(rpm: number) {
    this.rpm = rpm;
  }

  /**
   * Check if a request is allowed for the given session.
   * Returns true if allowed, false if rate limited.
   */
  check(sessionId: string): boolean {
    const now = Date.now();
    const windowStart = now - 60_000;

    let timestamps = this.requests.get(sessionId) ?? [];

    // Remove entries outside the 1-minute window
    timestamps = timestamps.filter((t) => t > windowStart);

    if (timestamps.length >= this.rpm) {
      this.requests.set(sessionId, timestamps);
      return false;
    }

    timestamps.push(now);
    this.requests.set(sessionId, timestamps);
    return true;
  }

  /**
   * Get current rate limit status for the most recent session (or overall).
   */
  getStatus(sessionId?: string): RateLimitStatus {
    const now = Date.now();
    const windowStart = now - 60_000;
    const resetTime = new Date(now + 60_000).toISOString();

    if (sessionId) {
      const timestamps = (this.requests.get(sessionId) ?? []).filter((t) => t > windowStart);
      return {
        requests_this_minute: timestamps.length,
        limit_per_minute: this.rpm,
        remaining: Math.max(0, this.rpm - timestamps.length),
        resets_at: resetTime,
      };
    }

    // Aggregate across all sessions
    let total = 0;
    for (const [, timestamps] of this.requests) {
      total += timestamps.filter((t) => t > windowStart).length;
    }

    return {
      requests_this_minute: total,
      limit_per_minute: this.rpm,
      remaining: Math.max(0, this.rpm - total),
      resets_at: resetTime,
    };
  }

  /**
   * Clean up old session data.
   */
  cleanup(): void {
    const windowStart = Date.now() - 60_000;
    for (const [sessionId, timestamps] of this.requests) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.requests.delete(sessionId);
      } else {
        this.requests.set(sessionId, active);
      }
    }
  }
}
