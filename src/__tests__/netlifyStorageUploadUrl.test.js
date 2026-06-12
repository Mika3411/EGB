import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  from: vi.fn(),
  createSignedUploadUrl: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMock.createClient,
}));

const storageBucketEnvKeys = [
  'SUPABASE_PUBLIC_ASSETS_BUCKET',
  'VITE_SUPABASE_PUBLIC_ASSETS_BUCKET',
  'SUPABASE_PRIVATE_DATA_BUCKET',
  'VITE_SUPABASE_PRIVATE_DATA_BUCKET',
  'SUPABASE_STORAGE_BUCKET',
  'VITE_SUPABASE_STORAGE_BUCKET',
];

const loadStorageUploadUrlHandler = async () => {
  vi.resetModules();
  vi.stubEnv('SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  storageBucketEnvKeys.forEach((key) => vi.stubEnv(key, ''));
  vi.stubEnv('SUPABASE_PUBLIC_ASSETS_BUCKET', 'public-assets');
  vi.stubEnv('SUPABASE_PRIVATE_DATA_BUCKET', 'private-data');
  return import('../../netlify/functions/storage-upload-url.js');
};

beforeEach(() => {
  vi.clearAllMocks();
  supabaseMock.getUser.mockResolvedValue({
    data: { user: { id: 'user-1', email: 'user@example.com' } },
    error: null,
  });
  supabaseMock.createSignedUploadUrl.mockResolvedValue({
    data: {
      path: 'users/user-1/shop-packs/pack.zip',
      token: 'signed-token',
      signedUrl: 'https://project.supabase.co/storage/v1/object/upload/sign/private-data/users/user-1/shop-packs/pack.zip?token=signed-token',
    },
    error: null,
  });
  supabaseMock.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/file.zip' } });
  supabaseMock.from.mockReturnValue({
    createSignedUploadUrl: supabaseMock.createSignedUploadUrl,
    getPublicUrl: supabaseMock.getPublicUrl,
  });
  supabaseMock.createClient.mockReturnValue({
    auth: { getUser: supabaseMock.getUser },
    storage: { from: supabaseMock.from },
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('netlify signed storage upload URL', () => {
  test('creates a signed upload URL for a private ZIP in the authenticated user folder', async () => {
    const { handler } = await loadStorageUploadUrlHandler();

    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer user-token' },
      queryStringParameters: {
        path: 'users/user-1/shop-packs/pack.zip',
        visibility: 'private',
        contentType: 'application/zip',
        contentLength: '9',
      },
    });
    const body = JSON.parse(response.body);

    expect(response.statusCode).toBe(200);
    expect(body).toMatchObject({
      bucket: 'private-data',
      path: 'users/user-1/shop-packs/pack.zip',
      visibility: 'private',
      token: 'signed-token',
      publicUrl: null,
      contentType: 'application/zip',
    });
    expect(supabaseMock.getUser).toHaveBeenCalledWith('user-token');
    expect(supabaseMock.from).toHaveBeenCalledWith('private-data');
    expect(supabaseMock.createSignedUploadUrl).toHaveBeenCalledWith(
      'users/user-1/shop-packs/pack.zip',
      { upsert: false },
    );
  });

  test('rejects signed upload URLs outside the authenticated user folder', async () => {
    const { handler } = await loadStorageUploadUrlHandler();

    const response = await handler({
      httpMethod: 'POST',
      headers: { authorization: 'Bearer user-token' },
      queryStringParameters: {
        path: 'users/user-2/shop-packs/pack.zip',
        visibility: 'private',
        contentType: 'application/zip',
        contentLength: '9',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toMatchObject({
      error: 'Upload refuse: le chemin doit rester dans ton dossier utilisateur.',
    });
    expect(supabaseMock.createSignedUploadUrl).not.toHaveBeenCalled();
  });
});
