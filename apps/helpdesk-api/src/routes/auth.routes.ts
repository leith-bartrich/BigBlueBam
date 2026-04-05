import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import argon2 from 'argon2';
import { nanoid } from 'nanoid';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { helpdeskUsers } from '../db/schema/helpdesk-users.js';
import { helpdeskSessions } from '../db/schema/helpdesk-sessions.js';
import { helpdeskSettings } from '../db/schema/helpdesk-settings.js';
import { requireHelpdeskAuth } from '../plugins/auth.js';
import { env } from '../env.js';
import {
  checkLockout,
  recordFailure,
  clearLockout,
  LOCKOUT_MESSAGE,
} from '../lib/login-lockout.js';
import { issueCsrfToken } from '../plugins/csrf.js';

const registerSchema = z.object({
  email: z.string().email().max(320),
  display_name: z.string().min(1).max(100),
  password: z.string().min(12).max(256),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const verifyEmailSchema = z.object({
  token: z.string().min(1),
});

// HB-17: Toggle to enforce email verification at login.
// Default false for dev; production deployments should set
// REQUIRE_EMAIL_VERIFICATION=true so unverified helpdesk users cannot log in
// (only takes effect when helpdesk_settings.require_email_verification is also true).
const REQUIRE_EMAIL_VERIFICATION =
  (process.env.REQUIRE_EMAIL_VERIFICATION ?? 'false').toLowerCase() === 'true';

// Precomputed dummy Argon2id hash used to equalize wall-clock time on login
// when the email does not correspond to a real helpdesk user. Prevents
// timing-based email enumeration. Lazily initialized once per process.
let dummyHashPromise: Promise<string> | null = null;
function getDummyPasswordHash(): Promise<string> {
  if (!dummyHashPromise) {
    dummyHashPromise = argon2.hash(nanoid(32));
  }
  return dummyHashPromise;
}

export default async function authRoutes(fastify: FastifyInstance) {
  const cookieOptions = {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: 'lax' as const,
    path: '/',
    domain: env.COOKIE_DOMAIN,
    maxAge: env.SESSION_TTL_SECONDS,
  };

  async function createSession(userId: string): Promise<string> {
    const sessionId = nanoid(48);
    const expiresAt = new Date(Date.now() + env.SESSION_TTL_SECONDS * 1000);

    await db.insert(helpdeskSessions).values({
      id: sessionId,
      user_id: userId,
      expires_at: expiresAt,
    });

    return sessionId;
  }

  // POST /helpdesk/auth/register
  // HB-33: 3 attempts per 15 minutes per IP to throttle abuse.
  fastify.post('/helpdesk/auth/register', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: 15 * 60 * 1000,
      },
    },
  }, async (request, reply) => {
    const data = registerSchema.parse(request.body);

    // Check if email already taken
    const existing = await db
      .select({ id: helpdeskUsers.id })
      .from(helpdeskUsers)
      .where(eq(helpdeskUsers.email, data.email.toLowerCase()))
      .limit(1);

    if (existing.length > 0) {
      return reply.status(409).send({
        error: {
          code: 'EMAIL_TAKEN',
          message: 'An account with this email already exists',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Check allowed email domains (from first org's helpdesk settings)
    const settings = await db
      .select()
      .from(helpdeskSettings)
      .limit(1);

    const orgSettings = settings[0];
    if (orgSettings && orgSettings.allowed_email_domains.length > 0) {
      const emailDomain = data.email.split('@')[1]?.toLowerCase();
      const allowed = orgSettings.allowed_email_domains.map((d) => d.toLowerCase());
      if (emailDomain && !allowed.includes(emailDomain)) {
        return reply.status(403).send({
          error: {
            code: 'DOMAIN_NOT_ALLOWED',
            message: 'Registration is restricted to approved email domains',
            details: [],
            request_id: request.id,
          },
        });
      }
    }

    const passwordHash = await argon2.hash(data.password);

    let emailVerificationToken: string | null = null;
    let emailVerificationSentAt: Date | null = null;

    if (orgSettings?.require_email_verification) {
      emailVerificationToken = nanoid(64);
      emailVerificationSentAt = new Date();
      // TODO: Queue verification email via BullMQ
    }

    const [user] = await db
      .insert(helpdeskUsers)
      .values({
        email: data.email.toLowerCase(),
        display_name: data.display_name,
        password_hash: passwordHash,
        email_verified: !orgSettings?.require_email_verification,
        email_verification_token: emailVerificationToken,
        email_verification_sent_at: emailVerificationSentAt,
      })
      .returning();

    if (!user) {
      return reply.status(500).send({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Failed to create user',
          details: [],
          request_id: request.id,
        },
      });
    }

    const sessionId = await createSession(user.id);
    reply.setCookie('helpdesk_session', sessionId, cookieOptions);
    issueCsrfToken(reply);

    return reply.status(201).send({
      data: {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          email_verified: user.email_verified,
        },
      },
    });
  });

  // POST /helpdesk/auth/login
  // HB-33: 5 attempts per 15 minutes per IP to slow brute-force guessing.
  // TODO: record helpdesk login attempts to a `helpdesk_login_history` table
  // once that schema exists. The BBB `login_history` table cannot be used
  // here because its user_id FK points at `users`, not `helpdesk_users`.
  fastify.post('/helpdesk/auth/login', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: 15 * 60 * 1000,
      },
    },
  }, async (request, reply) => {
    const data = loginSchema.parse(request.body);

    // HB-57: short-circuit on lockout BEFORE any DB lookup or argon2.verify.
    if (await checkLockout(fastify.redis, data.email)) {
      return reply.status(429).send({
        error: {
          code: 'ACCOUNT_LOCKED',
          message: LOCKOUT_MESSAGE,
          details: [],
          request_id: request.id,
        },
      });
    }

    const [user] = await db
      .select()
      .from(helpdeskUsers)
      .where(eq(helpdeskUsers.email, data.email.toLowerCase()))
      .limit(1);

    if (!user) {
      // Burn the same amount of CPU as a real argon2.verify() would, so that
      // response time cannot be used to distinguish "user does not exist" from
      // "user exists but password is wrong" (email enumeration defense).
      const dummyHash = await getDummyPasswordHash();
      await argon2.verify(dummyHash, data.password);
      await recordFailure(fastify.redis, data.email);
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: [],
          request_id: request.id,
        },
      });
    }

    if (!user.is_active) {
      return reply.status(403).send({
        error: {
          code: 'ACCOUNT_DISABLED',
          message: 'Your account has been disabled',
          details: [],
          request_id: request.id,
        },
      });
    }

    const valid = await argon2.verify(user.password_hash, data.password);
    if (!valid) {
      await recordFailure(fastify.redis, data.email);
      return reply.status(401).send({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Successful credential verification — clear the failure counter.
    await clearLockout(fastify.redis, data.email);

    // HB-17: Enforce email verification at login when both the env-level switch
    // and the org-level setting are enabled. We leave signup/verify-email flows
    // alone; email sending remains a TODO tracked with the notification queue.
    if (REQUIRE_EMAIL_VERIFICATION && !user.email_verified) {
      const [loginSettings] = await db
        .select({ require_email_verification: helpdeskSettings.require_email_verification })
        .from(helpdeskSettings)
        .limit(1);

      if (loginSettings?.require_email_verification) {
        return reply.status(403).send({
          error: {
            code: 'EMAIL_NOT_VERIFIED',
            message: 'Please verify your email before logging in.',
            details: [],
            request_id: request.id,
          },
        });
      }
    }

    const sessionId = await createSession(user.id);
    reply.setCookie('helpdesk_session', sessionId, cookieOptions);
    issueCsrfToken(reply);

    return reply.send({
      data: {
        user: {
          id: user.id,
          email: user.email,
          display_name: user.display_name,
          email_verified: user.email_verified,
        },
      },
    });
  });

  // POST /helpdesk/auth/logout
  fastify.post('/helpdesk/auth/logout', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    if (request.helpdeskSessionId) {
      await db
        .delete(helpdeskSessions)
        .where(eq(helpdeskSessions.id, request.helpdeskSessionId));
    }

    reply.clearCookie('helpdesk_session', { path: '/' });
    reply.clearCookie('csrf_token', { path: '/' });

    return reply.send({ data: { success: true } });
  });

  // GET /helpdesk/auth/me
  fastify.get('/helpdesk/auth/me', { preHandler: [requireHelpdeskAuth] }, async (request, reply) => {
    const user = request.helpdeskUser!;

    return reply.send({
      data: {
        id: user.id,
        email: user.email,
        display_name: user.display_name,
        email_verified: user.email_verified,
      },
    });
  });

  // POST /helpdesk/auth/verify-email
  fastify.post('/helpdesk/auth/verify-email', async (request, reply) => {
    const { token } = verifyEmailSchema.parse(request.body);

    const [user] = await db
      .select()
      .from(helpdeskUsers)
      .where(eq(helpdeskUsers.email_verification_token, token))
      .limit(1);

    if (!user) {
      return reply.status(400).send({
        error: {
          code: 'INVALID_TOKEN',
          message: 'Invalid or expired verification token',
          details: [],
          request_id: request.id,
        },
      });
    }

    // Check if token is expired (24 hours)
    if (user.email_verification_sent_at) {
      const tokenAge = Date.now() - new Date(user.email_verification_sent_at).getTime();
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (tokenAge > maxAge) {
        return reply.status(400).send({
          error: {
            code: 'TOKEN_EXPIRED',
            message: 'Verification token has expired',
            details: [],
            request_id: request.id,
          },
        });
      }
    }

    await db
      .update(helpdeskUsers)
      .set({
        email_verified: true,
        email_verification_token: null,
        email_verification_sent_at: null,
      })
      .where(eq(helpdeskUsers.id, user.id));

    return reply.send({
      data: { success: true },
    });
  });
}
