import { eq } from 'drizzle-orm';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { db } from '../db/index.js';
import { organizations } from '../db/schema/organizations.js';
import { users } from '../db/schema/users.js';
import { sessions } from '../db/schema/sessions.js';
import { env } from '../env.js';
import type { RegisterInput, LoginInput, UpdateProfileInput } from '@bigbluebam/shared';

// Precomputed dummy Argon2id hash used to equalize wall-clock time in login()
// when the supplied email does not correspond to a real user, preventing
// timing-based email enumeration. Lazily initialized once per process.
let dummyHashPromise: Promise<string> | null = null;
function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(nanoid(32));
  }
  return dummyHashPromise;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
}

export async function register(data: RegisterInput) {
  const passwordHash = await argon2.hash(data.password);
  const orgSlug = slugify(data.org_name);

  const result = await db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({
        name: data.org_name,
        slug: orgSlug,
      })
      .returning();

    const [user] = await tx
      .insert(users)
      .values({
        org_id: org!.id,
        email: data.email,
        display_name: data.display_name,
        password_hash: passwordHash,
        role: 'owner',
      })
      .returning();

    const session = await createSessionInTx(tx, user!.id);

    return { org: org!, user: user!, session };
  });

  return result;
}

export async function login(email: string, password: string, _totpCode?: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (!user || !user.password_hash) {
    // Burn the same amount of CPU as a real argon2.verify() would, so that
    // response time cannot be used to distinguish "user does not exist" from
    // "user exists but password is wrong" (email enumeration defense).
    const dummyHash = await getDummyPasswordHash();
    await argon2.verify(dummyHash, password);
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.is_active) {
    throw new AuthError('ACCOUNT_DISABLED', 'Account is disabled');
  }

  const valid = await argon2.verify(user.password_hash, password);
  if (!valid) {
    throw new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const session = await createSession(user.id);

  // Update last_seen_at
  await db
    .update(users)
    .set({ last_seen_at: new Date() })
    .where(eq(users.id, user.id));

  return { user, session };
}

export async function logout(sessionId: string) {
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

/**
 * Persist an `active_org_id` on the given session. Used by /auth/switch-org
 * to record which org the user has asked to operate in — the auth plugin
 * reads this on every subsequent request and scopes the request to that
 * org (subject to membership verification).
 *
 * Pass `null` to clear it (revert to the user's default-membership org).
 */
export async function setSessionActiveOrgId(sessionId: string, orgId: string | null) {
  await db
    .update(sessions)
    .set({ active_org_id: orgId })
    .where(eq(sessions.id, sessionId));
}

export async function createSession(userId: string) {
  const sessionId = nanoid(48);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

  const [session] = await db
    .insert(sessions)
    .values({
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
      data: {},
    })
    .returning();

  return session!;
}

async function createSessionInTx(tx: Parameters<Parameters<typeof db.transaction>[0]>[0], userId: string) {
  const sessionId = nanoid(48);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

  const [session] = await tx
    .insert(sessions)
    .values({
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
      data: {},
    })
    .returning();

  return session!;
}

export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

export async function updateProfile(userId: string, data: UpdateProfileInput) {
  const [user] = await db
    .update(users)
    .set({
      ...data,
      updated_at: new Date(),
    })
    .where(eq(users.id, userId))
    .returning();

  return user ?? null;
}

export class AuthError extends Error {
  code: string;
  statusCode: number;

  constructor(code: string, message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.statusCode = statusCode;
  }
}
