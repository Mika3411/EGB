import { describe, expect, test } from 'vitest';
import {
  defaultServerHeadersTimeoutMs,
  defaultServerRequestTimeoutMs,
  getServerHttpTimeouts,
} from '../../server/httpTimeouts.js';

describe('server HTTP timeouts', () => {
  test('utilise des timeouts finis par defaut', () => {
    expect(getServerHttpTimeouts({})).toEqual({
      requestTimeoutMs: defaultServerRequestTimeoutMs,
      headersTimeoutMs: defaultServerHeadersTimeoutMs,
    });
    expect(defaultServerRequestTimeoutMs).toBe(10 * 60 * 1000);
    expect(defaultServerHeadersTimeoutMs).toBe(60 * 1000);
  });

  test('lit les timeouts depuis les variables serveur', () => {
    expect(getServerHttpTimeouts({
      SERVER_REQUEST_TIMEOUT_MS: '900000',
      SERVER_HEADERS_TIMEOUT_MS: '45000',
    })).toEqual({
      requestTimeoutMs: 900000,
      headersTimeoutMs: 45000,
    });
  });

  test('ignore les valeurs invalides et borne le timeout headers au timeout request', () => {
    expect(getServerHttpTimeouts({
      SERVER_REQUEST_TIMEOUT_MS: '30000',
      SERVER_HEADERS_TIMEOUT_MS: '120000',
    })).toEqual({
      requestTimeoutMs: 30000,
      headersTimeoutMs: 30000,
    });

    expect(getServerHttpTimeouts({
      SERVER_REQUEST_TIMEOUT_MS: '0',
      SERVER_HEADERS_TIMEOUT_MS: 'nope',
    })).toEqual({
      requestTimeoutMs: defaultServerRequestTimeoutMs,
      headersTimeoutMs: defaultServerHeadersTimeoutMs,
    });
  });
});
