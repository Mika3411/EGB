import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';
import { STATIC_SECURITY_HEADERS } from '../../server/staticFiles.js';

describe('static security headers', () => {
  test('sets browser security headers for the local static server', () => {
    expect(STATIC_SECURITY_HEADERS['Content-Security-Policy']).toContain("default-src 'self'");
    expect(STATIC_SECURITY_HEADERS['Content-Security-Policy']).toContain("frame-ancestors 'none'");
    expect(STATIC_SECURITY_HEADERS['Content-Security-Policy']).toContain("object-src 'none'");
    expect(STATIC_SECURITY_HEADERS['Strict-Transport-Security']).toContain('max-age=31536000');
    expect(STATIC_SECURITY_HEADERS['X-Frame-Options']).toBe('DENY');
    expect(STATIC_SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(STATIC_SECURITY_HEADERS['Permissions-Policy']).toContain('camera=()');
    expect(STATIC_SECURITY_HEADERS['Permissions-Policy']).toContain('fullscreen=(self)');
  });

  test('keeps equivalent browser security headers in Netlify config', () => {
    const netlifyToml = readFileSync(join(process.cwd(), 'netlify.toml'), 'utf8');

    expect(netlifyToml).toContain('Content-Security-Policy');
    expect(netlifyToml).toContain("frame-ancestors 'none'");
    expect(netlifyToml).toContain('Strict-Transport-Security');
    expect(netlifyToml).toContain('X-Frame-Options = "DENY"');
    expect(netlifyToml).toContain('Referrer-Policy = "strict-origin-when-cross-origin"');
    expect(netlifyToml).toContain('Permissions-Policy');
  });
});
