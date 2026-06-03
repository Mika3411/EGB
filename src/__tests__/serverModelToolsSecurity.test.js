import { afterEach, describe, expect, test, vi } from 'vitest';

const makeResponse = () => ({
  writeHead: vi.fn(),
  end: vi.fn(),
});

describe('server model tools security', () => {
  afterEach(() => {
    vi.doUnmock('../../server/auth.js');
    vi.resetModules();
  });

  test('requires admin auth before reading a model-tools request body', async () => {
    const authError = new Error('Session admin manquante.');
    authError.status = 401;
    const verifySupabaseAdminRequest = vi.fn(async () => {
      throw authError;
    });

    vi.doMock('../../server/auth.js', () => ({ verifySupabaseAdminRequest }));
    const { handleModelTools } = await import('../../server/modelTools.js');
    const req = {
      method: 'POST',
      url: '/api/model-tools/jobs',
      headers: {
        host: 'localhost',
        'content-type': 'multipart/form-data; boundary=x',
        'content-length': '1024',
      },
      on: vi.fn(),
    };

    await expect(handleModelTools(req, makeResponse())).rejects.toMatchObject({
      status: 401,
    });
    expect(verifySupabaseAdminRequest).toHaveBeenCalledWith(req);
    expect(req.on).not.toHaveBeenCalled();
  });
});
