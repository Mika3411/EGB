import { describe, expect, test } from 'vitest';
import {
  cleanupAiJobs,
  defaultAiJobMaxRuntimeMs,
  defaultAiJobTtlMs,
  getAiJobCleanupIntervalMs,
  getAiJobMaxRuntimeMs,
  getAiJobTtlMs,
} from '../../server/aiJobStore.js';

describe('server AI job store', () => {
  test('utilise AI_JOB_TTL_MS avec un fallback a 30 minutes', () => {
    expect(getAiJobTtlMs({ AI_JOB_TTL_MS: '120000' })).toBe(120000);
    expect(getAiJobTtlMs({ AI_JOB_TTL_MS: '0' })).toBe(defaultAiJobTtlMs);
    expect(getAiJobTtlMs({ AI_JOB_TTL_MS: 'invalid' })).toBe(defaultAiJobTtlMs);
    expect(defaultAiJobTtlMs).toBe(30 * 60 * 1000);
  });

  test('utilise AI_JOB_MAX_RUNTIME_MS avec un fallback a 10 minutes', () => {
    expect(getAiJobMaxRuntimeMs({ AI_JOB_MAX_RUNTIME_MS: '120000' })).toBe(120000);
    expect(getAiJobMaxRuntimeMs({ AI_JOB_MAX_RUNTIME_MS: '0' })).toBe(defaultAiJobMaxRuntimeMs);
    expect(getAiJobMaxRuntimeMs({ AI_JOB_MAX_RUNTIME_MS: 'invalid' })).toBe(defaultAiJobMaxRuntimeMs);
    expect(defaultAiJobMaxRuntimeMs).toBe(10 * 60 * 1000);
  });

  test('nettoie uniquement les jobs termines ou en erreur expires', () => {
    const now = Date.parse('2026-05-13T20:00:00.000Z');
    const expiredUpdatedAt = new Date(now - 60_001).toISOString();
    const freshUpdatedAt = new Date(now - 10_000).toISOString();
    const jobs = new Map([
      ['complete-old', { status: 'complete', updatedAt: expiredUpdatedAt }],
      ['error-old', { status: 'error', updatedAt: expiredUpdatedAt }],
      ['complete-fresh', { status: 'complete', updatedAt: freshUpdatedAt }],
      ['pending-old', { status: 'pending', updatedAt: expiredUpdatedAt }],
      ['running-old', { status: 'running', updatedAt: expiredUpdatedAt }],
    ]);

    expect(cleanupAiJobs(jobs, { now, ttlMs: 60_000 })).toBe(2);
    expect([...jobs.keys()]).toEqual(['complete-fresh', 'pending-old', 'running-old']);
  });

  test('marque les jobs actifs trop vieux en erreur avant leur nettoyage TTL', () => {
    const now = Date.parse('2026-05-13T20:00:00.000Z');
    const expiredUpdatedAt = new Date(now - 60_001).toISOString();
    const jobs = new Map([
      ['pending-old', { id: 'pending-old', status: 'pending', updatedAt: expiredUpdatedAt }],
      ['running-old', { id: 'running-old', status: 'running', updatedAt: expiredUpdatedAt }],
      ['running-fresh', { id: 'running-fresh', status: 'running', updatedAt: new Date(now - 1_000).toISOString() }],
    ]);

    expect(cleanupAiJobs(jobs, { now, ttlMs: 60_000, maxRuntimeMs: 60_000 })).toBe(0);
    expect(jobs.get('pending-old')).toMatchObject({ status: 'error', code: 'AI_JOB_TIMEOUT' });
    expect(jobs.get('running-old')).toMatchObject({ status: 'error', code: 'AI_JOB_TIMEOUT' });
    expect(jobs.get('running-fresh')).toMatchObject({ status: 'running' });
  });

  test('borne la frequence du nettoyage automatique', () => {
    expect(getAiJobCleanupIntervalMs(30 * 60 * 1000)).toBe(60_000);
    expect(getAiJobCleanupIntervalMs(5_000)).toBe(5_000);
    expect(getAiJobCleanupIntervalMs(100)).toBe(1_000);
  });
});
