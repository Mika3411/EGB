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

  test('missing shop_pack_sales table does not break public shop pack loading', async () => {
    const { loadSoldShopPackIds } = await loadNetlifyShopPacks();
    const inFilter = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.shop_pack_sales' in the schema cache",
      },
    });
    const select = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ select }));

    await expect(loadSoldShopPackIds({ from })).resolves.toEqual(new Set());
  });

  test('admin API payload strips oversized inline screenshots', async () => {
    const { toAdminShopPack } = await loadNetlifyShopPacks();
    const hugeInlineScreenshot = `data:image/png;base64,${'a'.repeat(40 * 1024)}`;
    const compactPack = toAdminShopPack({
      id: 'pack-1',
      title: 'Pack test',
      downloadStoragePath: 'users/user-1/shop-packs/pack.zip',
      screenshots: [
        { id: 'huge', src: hugeInlineScreenshot },
        { id: 'url', src: '/boutique/cover.png' },
      ],
    });

    expect(compactPack.hasDownload).toBe(true);
    expect(compactPack.screenshots).toEqual([{ id: 'url', src: '/boutique/cover.png' }]);
    expect(JSON.stringify(compactPack)).not.toContain('data:image/png;base64');
  });
});
