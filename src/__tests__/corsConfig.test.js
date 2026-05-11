import { describe, expect, it } from 'vitest';
import {
  assertCorsRequestAllowed,
  getAllowedCorsOrigins,
  makeCorsHeaders,
  normalizeCorsOrigin,
} from '../utils/corsConfig';

describe('CORS configuration', () => {
  it('normalizes origins and removes wildcard defaults', () => {
    expect(normalizeCorsOrigin('https://example.com/path?q=1')).toBe('https://example.com');
    expect(normalizeCorsOrigin('*')).toBe('');
  });

  it('builds an allowlist from explicit and deployment origins', () => {
    expect(getAllowedCorsOrigins({
      NODE_ENV: 'production',
      CORS_ALLOWED_ORIGINS: 'https://app.example.com, https://admin.example.com/',
      URL: 'https://prod.example.com',
      CORS_ORIGIN: '*',
    })).toEqual([
      'https://app.example.com',
      'https://admin.example.com',
      'https://prod.example.com',
    ]);
  });

  it('reflects only allowed request origins', () => {
    const headers = makeCorsHeaders(
      { origin: 'https://app.example.com' },
      { NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://app.example.com' },
      { 'Content-Type': 'application/json' },
    );

    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(headers.Vary).toBe('Origin');
  });

  it('rejects disallowed browser origins', () => {
    expect(() => assertCorsRequestAllowed(
      { origin: 'https://evil.example' },
      { NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://app.example.com' },
    )).toThrow(/Origine CORS refusee/);
  });

  it('allows non-browser requests without Origin', () => {
    expect(() => assertCorsRequestAllowed(
      {},
      { NODE_ENV: 'production', CORS_ALLOWED_ORIGINS: 'https://app.example.com' },
    )).not.toThrow();
  });
});
