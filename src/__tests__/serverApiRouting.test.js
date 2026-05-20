import { describe, expect, test } from 'vitest';
import { resolveApiRoute } from '../../server/apiRouter.js';

describe('server API routing', () => {
  test('route les chemins API connus avec le pathname sans query string', () => {
    const pathname = new URL('/api/generate?mode=repair', 'http://localhost').pathname;

    expect(resolveApiRoute('POST', pathname)).toEqual({ type: 'handler', routeId: 'generate' });
    expect(resolveApiRoute('GET', pathname)).toEqual({ type: 'methodNotAllowed' });
  });

  test('signale les methodes invalides pour les routes API connues', () => {
    expect(resolveApiRoute('DELETE', '/api/shop/packs')).toEqual({ type: 'methodNotAllowed' });
    expect(resolveApiRoute('POST', '/api/ai-job')).toEqual({ type: 'methodNotAllowed' });
    expect(resolveApiRoute('PUT', '/api/model-tools/convert')).toEqual({ type: 'methodNotAllowed' });
  });

  test('distingue les routes API inconnues du fallback statique frontend', () => {
    expect(resolveApiRoute('GET', '/api/unknown')).toEqual({ type: 'apiNotFound' });
    expect(resolveApiRoute('GET', '/builder/project-1')).toEqual({ type: 'static' });
  });

  test('ne confond pas un prefixe de route avec un segment plus long', () => {
    expect(resolveApiRoute('GET', '/api/ai-job-extra')).toEqual({ type: 'apiNotFound' });
    expect(resolveApiRoute('GET', '/api/admin/users-extra')).toEqual({ type: 'apiNotFound' });
    expect(resolveApiRoute('GET', '/api/admin/users/123')).toEqual({ type: 'handler', routeId: 'adminUsersList' });
    expect(resolveApiRoute('POST', '/api/model-tools/convert')).toEqual({ type: 'handler', routeId: 'modelTools' });
    expect(resolveApiRoute('GET', '/api/model-tools/jobs/job-1')).toEqual({ type: 'handler', routeId: 'modelTools' });
  });
});
