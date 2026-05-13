import { afterEach, describe, expect, test, vi } from 'vitest';

const bucketEnvKeys = [
  'SUPABASE_PUBLIC_ASSETS_BUCKET',
  'VITE_SUPABASE_PUBLIC_ASSETS_BUCKET',
  'SUPABASE_PRIVATE_DATA_BUCKET',
  'VITE_SUPABASE_PRIVATE_DATA_BUCKET',
  'SUPABASE_STORAGE_BUCKET',
  'VITE_SUPABASE_STORAGE_BUCKET',
];

const loadSharedWithEnv = async (env = {}) => {
  vi.resetModules();
  bucketEnvKeys.forEach((key) => vi.stubEnv(key, ''));
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../../netlify/functions/_shared.js');
};

const loadServerStorageWithEnv = async (env = {}) => {
  vi.resetModules();
  bucketEnvKeys.forEach((key) => vi.stubEnv(key, ''));
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../../server/storage.js');
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('server Supabase storage buckets', () => {
  test('prioritise les variables serveur explicites', async () => {
    const shared = await loadSharedWithEnv({
      SUPABASE_PUBLIC_ASSETS_BUCKET: 'server-public',
      VITE_SUPABASE_PUBLIC_ASSETS_BUCKET: 'vite-public',
      SUPABASE_PRIVATE_DATA_BUCKET: 'server-private',
      VITE_SUPABASE_PRIVATE_DATA_BUCKET: 'vite-private',
      SUPABASE_STORAGE_BUCKET: 'legacy',
    });

    expect(shared.publicAssetsBucket).toBe('server-public');
    expect(shared.privateDataBucket).toBe('server-private');
    expect(shared.aiJobBucket).toBe('server-private');
    expect(shared.resolveServerStorageBucket('public')).toBe('server-public');
    expect(shared.resolveServerStorageBucket('private')).toBe('server-private');

    const serverStorage = await loadServerStorageWithEnv({
      SUPABASE_PUBLIC_ASSETS_BUCKET: 'server-public',
      VITE_SUPABASE_PUBLIC_ASSETS_BUCKET: 'vite-public',
      SUPABASE_PRIVATE_DATA_BUCKET: 'server-private',
      VITE_SUPABASE_PRIVATE_DATA_BUCKET: 'vite-private',
      SUPABASE_STORAGE_BUCKET: 'legacy',
    });
    expect(serverStorage.publicAssetsBucket).toBe('server-public');
    expect(serverStorage.privateDataBucket).toBe('server-private');
    expect(serverStorage.resolveServerStorageBucket('public')).toBe('server-public');
  });

  test('utilise les variables VITE quand seules elles sont deployees', async () => {
    const shared = await loadSharedWithEnv({
      VITE_SUPABASE_PUBLIC_ASSETS_BUCKET: 'vite-public',
      VITE_SUPABASE_PRIVATE_DATA_BUCKET: 'vite-private',
      SUPABASE_STORAGE_BUCKET: 'legacy',
    });

    expect(shared.publicAssetsBucket).toBe('vite-public');
    expect(shared.privateDataBucket).toBe('vite-private');
    expect(shared.aiJobBucket).toBe('vite-private');
  });

  test('conserve le fallback legacy pour les anciens environnements', async () => {
    const shared = await loadSharedWithEnv({
      VITE_SUPABASE_STORAGE_BUCKET: 'legacy-vite',
    });

    expect(shared.publicAssetsBucket).toBe('legacy-vite');
    expect(shared.privateDataBucket).toBe('legacy-vite');
    expect(shared.aiJobBucket).toBe('legacy-vite');

    const serverStorage = await loadServerStorageWithEnv({
      VITE_SUPABASE_STORAGE_BUCKET: 'legacy-vite',
    });
    expect(serverStorage.publicAssetsBucket).toBe('legacy-vite');
    expect(serverStorage.privateDataBucket).toBe('legacy-vite');
  });
});
