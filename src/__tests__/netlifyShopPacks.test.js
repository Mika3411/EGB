import { afterEach, describe, expect, test, vi } from 'vitest';

const storageBucketEnvKeys = [
  'SUPABASE_PUBLIC_ASSETS_BUCKET',
  'VITE_SUPABASE_PUBLIC_ASSETS_BUCKET',
  'SUPABASE_PRIVATE_DATA_BUCKET',
  'VITE_SUPABASE_PRIVATE_DATA_BUCKET',
  'SUPABASE_STORAGE_BUCKET',
  'VITE_SUPABASE_STORAGE_BUCKET',
];

const loadNetlifyShopPacks = async () => {
  vi.resetModules();
  storageBucketEnvKeys.forEach((key) => vi.stubEnv(key, ''));
  vi.stubEnv('SUPABASE_PUBLIC_ASSETS_BUCKET', 'public-assets');
  vi.stubEnv('SUPABASE_PRIVATE_DATA_BUCKET', 'private-data');
  return import('../../netlify/functions/shop-packs.js');
};

const createSupabaseStorageMock = (downloadResult) => {
  const download = vi.fn().mockResolvedValue(downloadResult);
  const from = vi.fn(() => ({ download }));
  return {
    storage: { from },
    from,
    download,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('netlify shop packs manifest', () => {
  test('first run treats a missing Supabase Storage manifest as an empty shop', async () => {
    const { loadShopPacks } = await loadNetlifyShopPacks();
    const supabase = createSupabaseStorageMock({
      data: null,
      error: { code: 'NoSuchKey', status: 404, message: 'Object not found' },
    });

    await expect(loadShopPacks(supabase)).resolves.toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('private-data');
    expect(supabase.download).toHaveBeenCalledWith('public/shop-packs.json');
  });

  test('invalid manifest JSON falls back to an empty shop instead of breaking admin saves', async () => {
    const { loadShopPacks } = await loadNetlifyShopPacks();
    const supabase = createSupabaseStorageMock({
      data: new Blob(['{broken']),
      error: null,
    });

    await expect(loadShopPacks(supabase)).resolves.toEqual([]);
  });

  test('valid manifests are normalized after loading', async () => {
    const { loadShopPacks } = await loadNetlifyShopPacks();
    const supabase = createSupabaseStorageMock({
      data: new Blob([JSON.stringify([
        { id: 'pack one', title: '  Pack Pirates  ', costCredits: '12' },
      ])]),
      error: null,
    });

    await expect(loadShopPacks(supabase)).resolves.toEqual([
      expect.objectContaining({
        id: 'pack-one',
        title: 'Pack Pirates',
        costCredits: 12,
      }),
    ]);
  });
});
