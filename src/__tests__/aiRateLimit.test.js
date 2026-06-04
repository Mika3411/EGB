import { beforeEach, describe, expect, it } from 'vitest';
import {
  assertAiRateLimit,
  getAiRateLimitConfig,
  getClientIpFromHeaders,
  resetAiRateLimitBuckets,
} from '../shared/utils/aiRateLimit';

describe('AI rate limit guards', () => {
  beforeEach(() => {
    resetAiRateLimitBuckets();
  });

  it('reads per-kind limits from environment variables', () => {
    expect(getAiRateLimitConfig({
      AI_RATE_LIMIT_WINDOW_MS: '30000',
      AI_IMAGE_RATE_LIMIT_USER_PER_WINDOW: '2',
      AI_IMAGE_RATE_LIMIT_IP_PER_WINDOW: '8',
    }, 'image')).toMatchObject({
      windowMs: 30000,
      userLimit: 2,
      ipLimit: 8,
    });
  });

  it('limits repeated requests by user', () => {
    const env = {
      AI_RATE_LIMIT_WINDOW_MS: '60000',
      AI_TEXT_RATE_LIMIT_USER_PER_WINDOW: '2',
      AI_TEXT_RATE_LIMIT_IP_PER_WINDOW: '100',
    };

    expect(() => assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.1', env, now: 1000 })).not.toThrow();
    expect(() => assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.1', env, now: 2000 })).not.toThrow();
    expect(() => assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.2', env, now: 3000 }))
      .toThrow(/Trop de requetes IA/);
  });

  it('limits aggregate requests by IP across users', () => {
    const env = {
      AI_RATE_LIMIT_WINDOW_MS: '60000',
      AI_TEXT_RATE_LIMIT_USER_PER_WINDOW: '100',
      AI_TEXT_RATE_LIMIT_IP_PER_WINDOW: '2',
    };

    assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.1', env, now: 1000 });
    assertAiRateLimit({ kind: 'text', userId: 'user-2', ip: '10.0.0.1', env, now: 2000 });

    expect(() => assertAiRateLimit({ kind: 'text', userId: 'user-3', ip: '10.0.0.1', env, now: 3000 }))
      .toThrow(/Trop de requetes IA/);
  });

  it('does not consume the user bucket when the IP bucket rejects the request', () => {
    const env = {
      AI_RATE_LIMIT_WINDOW_MS: '60000',
      AI_TEXT_RATE_LIMIT_USER_PER_WINDOW: '2',
      AI_TEXT_RATE_LIMIT_IP_PER_WINDOW: '1',
    };

    assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.1', env, now: 1000 });
    expect(() => assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.1', env, now: 2000 }))
      .toThrow(/Trop de requetes IA/);

    expect(() => assertAiRateLimit({ kind: 'text', userId: 'user-1', ip: '10.0.0.2', env, now: 3000 })).not.toThrow();
  });

  it('opens a new window after retry delay has passed', () => {
    const env = {
      AI_RATE_LIMIT_WINDOW_MS: '1000',
      AI_IMAGE_RATE_LIMIT_USER_PER_WINDOW: '1',
      AI_IMAGE_RATE_LIMIT_IP_PER_WINDOW: '10',
    };

    assertAiRateLimit({ kind: 'image', userId: 'user-1', ip: '10.0.0.1', env, now: 1000 });
    expect(() => assertAiRateLimit({ kind: 'image', userId: 'user-1', ip: '10.0.0.1', env, now: 1500 }))
      .toThrow(/Trop de requetes IA/);
    expect(() => assertAiRateLimit({ kind: 'image', userId: 'user-1', ip: '10.0.0.1', env, now: 2101 })).not.toThrow();
  });

  it('extracts the first forwarded client IP', () => {
    expect(getClientIpFromHeaders({
      'x-forwarded-for': '203.0.113.7, 10.0.0.2',
    })).toBe('203.0.113.7');
  });
});
