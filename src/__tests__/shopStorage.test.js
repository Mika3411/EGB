import { afterEach, describe, expect, it, vi } from 'vitest';
import { getShopPacks, saveShopPacks } from '../shared/services/shopPacksStorage';
import { readShopPurchases } from '../shared/services/shopPurchases';

const SHOP_PACKS_KEY = 'escapeGameBuilder.shopPacks.v1';
const SHOP_PURCHASES_KEY = 'escapeGameBuilder.shopPurchases.user-1';

afterEach(() => {
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('shop storage helpers migration', () => {
  it('keeps normalizing shop packs after reading local storage', () => {
    window.localStorage.setItem(SHOP_PACKS_KEY, JSON.stringify([
      { id: 'pack-1', title: '  Pack test  ', costCredits: '12', screenshots: [{ src: 'cover.png' }, {}] },
    ]));

    expect(getShopPacks()).toEqual([
      expect.objectContaining({
        id: 'pack-1',
        title: 'Pack test',
        costCredits: 12,
        screenshots: [{ src: 'cover.png' }],
      }),
    ]);
  });

  it('persists shop packs through shared storage helpers', () => {
    const saved = saveShopPacks([{ id: 'pack-1', title: 'Pack test' }]);

    expect(saved).toHaveLength(1);
    expect(JSON.parse(window.localStorage.getItem(SHOP_PACKS_KEY))).toHaveLength(1);
  });

  it('keeps the shop purchases fallback as an empty array', () => {
    window.localStorage.setItem(SHOP_PURCHASES_KEY, '{broken');

    expect(readShopPurchases('user-1')).toEqual([]);
    window.localStorage.setItem(SHOP_PURCHASES_KEY, JSON.stringify({ invalid: true }));
    expect(readShopPurchases('user-1')).toEqual([]);
  });

  it('prepares a local ZIP patch for admin shop packs', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    const { prepareAdminShopPackZip } = await import('../shared/services/adminApi');

    const file = new File([new Uint8Array([1, 2, 3])], 'pack-test.zip', { type: 'application/zip' });
    const patch = await prepareAdminShopPackZip({ file, packId: '', userId: '' });

    expect(patch).toEqual(expect.objectContaining({
      downloadFileName: 'pack-test.zip',
      downloadMode: 'local',
      downloadStoragePath: '',
    }));
    expect(patch.id).toMatch(/^pack_/);
    expect(patch.downloadUrl).toMatch(/^data:application\/zip;base64,/);
  });

  it('rejects non-ZIP files for admin shop packs', async () => {
    vi.resetModules();
    const { prepareAdminShopPackZip } = await import('../shared/services/adminApi');

    await expect(prepareAdminShopPackZip({
      file: new File(['not a zip'], 'pack-test.txt', { type: 'text/plain' }),
      packId: 'pack_1',
      userId: '',
    })).rejects.toThrow('Importe un fichier ZIP pour le pack.');
  });

  it('includes the HTTP status when the remote shop API returns non-JSON', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValue('<html>Not found</html>'),
    }));

    const { saveSharedShopPacks } = await import('../shared/services/shopPacksStorage');

    await expect(saveSharedShopPacks([{ id: 'pack-1', title: 'Pack test' }]))
      .rejects.toThrow('API boutique indisponible. (HTTP 404).');
  });
});
