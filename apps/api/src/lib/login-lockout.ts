import type Redis from 'ioredis';
import { env } from '../env.js';

/**
 * HB-57: Account lockout after repeated failed login attempts.
 *
 * Tracks failed attempts in Redis keyed by lowercased email (the thing
 * attackers enumerate — IPs are cheap to rotate). Uses TTL-based auto-reset
 * so no schema migration is needed and locks self-heal after the window
 * expires.
 *
 * checkLockout() is intentionally cheap (single GET) and MUST be called
 * BEFORE argon2.verify so a brute-force attacker can't burn CPU.
 */

const KEY_PREFIX = 'login_fail:';

function keyFor(email: string): string {
  return `${KEY_PREFIX}${email.toLowerCase()}`;
}

/**
 * Returns true if the email is currently locked out. Callers should
 * short-circuit with HTTP 429 ACCOUNT_LOCKED when this returns true —
 * do NOT reveal whether the account actually exists.
 */
export async function checkLockout(redis: Redis, email: string): Promise<boolean> {
  const raw = await redis.get(keyFor(email));
  if (!raw) return false;
  const count = Number.parseInt(raw, 10);
  if (!Number.isFinite(count)) return false;
  return count >= env.LOGIN_LOCKOUT_MAX_ATTEMPTS;
}

/**
 * Records a failed login attempt. Sets the window TTL on the first
 * increment so the counter expires automatically. Subsequent failures
 * within the window do NOT extend the TTL — otherwise an active attacker
 * could keep the account locked forever.
 */
export async function recordFailure(redis: Redis, email: string): Promise<void> {
  const key = keyFor(email);
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, env.LOGIN_LOCKOUT_WINDOW_SECONDS);
  }
}

/**
 * Clears the failure counter on successful login so the user's next
 * legitimate failure starts fresh.
 */
export async function clearLockout(redis: Redis, email: string): Promise<void> {
  await redis.del(keyFor(email));
}

export const LOCKOUT_MESSAGE = 'Too many failed login attempts. Try again in 15 minutes.';
