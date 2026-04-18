// §1 Wave 5 banter subs - worker consumer tests.
//
// Tests the per-message routing logic in handleIncomingMessage. We feed
// the handler a fake BanterEnvelope and a fake PatternMatchDeps, then
// assert which dependencies were called and with which arguments. The
// real Redis subscriber / visibility preflight / BullMQ wiring is
// covered elsewhere; this file focuses on the match/drop decision tree.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Logger } from 'pino';
import {
  handleIncomingMessage,
  internalCounters,
  type PatternMatchDeps,
} from '../src/jobs/banter-pattern-match.job.js';
import type { BanterPatternSpec } from '@bigbluebam/shared';

const logger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as unknown as Logger;

const MSG = {
  id: 'msg-1',
  channel_id: 'chan-1',
  author_id: 'user-author',
  content_plain: 'What is the deploy status?',
};

const SUB_ID = 'sub-1';
const SUBSCRIBER = 'agent-1';
const ORG = 'org-1';

function makeEnvelope(overrides: Partial<typeof MSG> = {}) {
  return {
    room: 'banter:channel:chan-1',
    event: {
      type: 'message.created',
      data: { message: { ...MSG, ...overrides } },
      timestamp: '2026-04-18T00:00:00Z',
    },
  };
}

function makeDeps(overrides: Partial<PatternMatchDeps> = {}): PatternMatchDeps {
  return {
    listActiveSubscriptions: vi.fn().mockResolvedValue([
      {
        id: SUB_ID,
        org_id: ORG,
        subscriber_user_id: SUBSCRIBER,
        channel_id: 'chan-1',
        pattern_spec: { kind: 'interrogative' } as BanterPatternSpec,
        rate_limit_per_hour: 30,
      },
    ]),
    loadAgentPolicy: vi.fn().mockResolvedValue({ enabled: true, channel_subscriptions: [] }),
    canAccessChannel: vi.fn().mockResolvedValue(true),
    checkRateLimitSub: vi.fn().mockResolvedValue(true),
    checkRateLimitSubscriber: vi.fn().mockResolvedValue(true),
    publishMatched: vi.fn().mockResolvedValue(undefined),
    markMatched: vi.fn().mockResolvedValue(undefined),
    logger,
    ...overrides,
  };
}

function resetCounters() {
  for (const k of Object.keys(internalCounters) as Array<keyof typeof internalCounters>) {
    internalCounters[k] = 0;
  }
}

describe('handleIncomingMessage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetCounters();
  });

  it('emits banter.message.matched when every gate passes', async () => {
    const deps = makeDeps();
    await handleIncomingMessage(makeEnvelope(), deps);

    expect(deps.publishMatched).toHaveBeenCalledTimes(1);
    expect(deps.markMatched).toHaveBeenCalledWith(SUB_ID);
    const call = (deps.publishMatched as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    const payload = call[0];
    expect(payload.message.id).toBe('msg-1');
    expect(payload.match.subscription_id).toBe(SUB_ID);
    expect(payload.match.pattern_kind).toBe('interrogative');
    expect(payload.match.matched_text).toBe('What is the deploy status?');
    expect(internalCounters.emitted).toBe(1);
  });

  it('ignores envelopes whose event.type is not message.created', async () => {
    const deps = makeDeps();
    const env = makeEnvelope();
    env.event.type = 'message.edited';
    await handleIncomingMessage(env, deps);
    expect(deps.listActiveSubscriptions).not.toHaveBeenCalled();
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.events_non_message).toBe(1);
  });

  it('skips when no subscriptions exist for the channel', async () => {
    const deps = makeDeps({ listActiveSubscriptions: vi.fn().mockResolvedValue([]) });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
  });

  it('silently drops when the agent_policy is disabled', async () => {
    const deps = makeDeps({
      loadAgentPolicy: vi.fn().mockResolvedValue({ enabled: false, channel_subscriptions: [] }),
    });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.dropped_policy_disabled).toBe(1);
  });

  it('silently drops when the agent_policy channel_subscriptions excludes the channel', async () => {
    const deps = makeDeps({
      loadAgentPolicy: vi.fn().mockResolvedValue({
        enabled: true,
        channel_subscriptions: ['chan-other'],
      }),
    });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.dropped_policy_channel_not_subscribed).toBe(1);
  });

  it('permissive default when agent_policy row is missing', async () => {
    const deps = makeDeps({ loadAgentPolicy: vi.fn().mockResolvedValue(null) });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).toHaveBeenCalledTimes(1);
  });

  it('silently drops when can_access denies', async () => {
    const deps = makeDeps({ canAccessChannel: vi.fn().mockResolvedValue(false) });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.dropped_can_access_denied).toBe(1);
  });

  it('swallows can_access errors and counts them', async () => {
    const deps = makeDeps({
      canAccessChannel: vi.fn().mockRejectedValue(new Error('network glitch')),
    });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.dropped_can_access_error).toBe(1);
  });

  it('drops when per-subscription rate-limit is exceeded', async () => {
    const deps = makeDeps({ checkRateLimitSub: vi.fn().mockResolvedValue(false) });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.dropped_rate_limit_sub).toBe(1);
  });

  it('drops when per-subscriber hourly ceiling is exceeded', async () => {
    const deps = makeDeps({
      checkRateLimitSubscriber: vi.fn().mockResolvedValue(false),
    });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).not.toHaveBeenCalled();
    expect(internalCounters.dropped_rate_limit_subscriber).toBe(1);
  });

  it('self-match is dropped (author == subscriber)', async () => {
    const deps = makeDeps();
    await handleIncomingMessage(
      makeEnvelope({ author_id: SUBSCRIBER }),
      deps,
    );
    expect(deps.publishMatched).not.toHaveBeenCalled();
  });

  it('evaluates pattern against content_plain', async () => {
    const deps = makeDeps();
    // Plain statement should not match interrogative.
    await handleIncomingMessage(
      makeEnvelope({ content_plain: 'Deployment complete.' }),
      deps,
    );
    expect(deps.publishMatched).not.toHaveBeenCalled();
  });

  it('fires once per matching subscription when multiple subs are active', async () => {
    const deps = makeDeps({
      listActiveSubscriptions: vi.fn().mockResolvedValue([
        {
          id: 'sub-a',
          org_id: ORG,
          subscriber_user_id: 'agent-a',
          channel_id: 'chan-1',
          pattern_spec: { kind: 'interrogative' },
          rate_limit_per_hour: 30,
        },
        {
          id: 'sub-b',
          org_id: ORG,
          subscriber_user_id: 'agent-b',
          channel_id: 'chan-1',
          pattern_spec: { kind: 'keyword', terms: ['deploy'] },
          rate_limit_per_hour: 30,
        },
        {
          id: 'sub-c',
          org_id: ORG,
          subscriber_user_id: 'agent-c',
          channel_id: 'chan-1',
          // Won't match the message content at all.
          pattern_spec: { kind: 'keyword', terms: ['never-present'] },
          rate_limit_per_hour: 30,
        },
      ]),
    });
    await handleIncomingMessage(makeEnvelope(), deps);
    expect(deps.publishMatched).toHaveBeenCalledTimes(2);
    expect(internalCounters.emitted).toBe(2);
  });
});
