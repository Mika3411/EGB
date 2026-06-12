import { describe, expect, test, vi } from 'vitest';
import {
  resolveShopPackDownload,
  toPublicShopPackDownloadState,
} from '../../server/shopDownloads.js';

describe('server shop downloads', () => {
  test('retourne le downloadUrl existant sans signer de chemin', async () => {
    const createSignedUrl = vi.fn();

    await expect(resolveShopPackDownload({
      downloadUrl: 'https://example.com/pack.zip',
      downloadStoragePath: 'users/admin/shop/pack.zip',
    }, { createSignedUrl })).resolves.toEqual({
      downloadUrl: 'https://example.com/pack.zip',
    });
    expect(createSignedUrl).not.toHaveBeenCalled();
  });

  test('signale clairement un pack sans fichier exploitable', async () => {
    await expect(resolveShopPackDownload({})).resolves.toBeNull();
    expect(toPublicShopPackDownloadState({ id: 'pack-empty' })).toEqual({
      id: 'pack-empty',
      hasDownload: false,
    });
  });

  test('genere une URL signee pour un downloadStoragePath supporte', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue('https://storage.example.com/signed.zip');

    await expect(resolveShopPackDownload({
      downloadStoragePath: 'users/admin/shop/pack.zip',
      downloadMode: 'supabase',
    }, { createSignedUrl })).resolves.toEqual({
      downloadUrl: 'https://storage.example.com/signed.zip',
    });

    expect(createSignedUrl).toHaveBeenCalledWith('users/admin/shop/pack.zip', expect.objectContaining({
      buckets: expect.any(Array),
      expiresIn: 3600,
    }));
  });

  test('n expose pas les champs de stockage prives dans le payload public', () => {
    expect(toPublicShopPackDownloadState({
      id: 'pack-storage',
      title: 'Pack stockage',
      downloadUrl: 'https://example.com/private.zip',
      downloadStoragePath: 'users/admin/shop/private.zip',
      downloadStorageBucket: 'private-bucket',
      downloadBucket: 'legacy-bucket',
    })).toEqual({
      id: 'pack-storage',
      title: 'Pack stockage',
      hasDownload: true,
    });
  });

  test('marque les packs vendus depuis shop_pack_sales sans exposer les chemins prives', async () => {
    const { applySoldShopPackState } = await import('../../server/shop.js');

    const packs = applySoldShopPackState([
      {
        id: 'pack-sold',
        title: 'Pack vendu',
        downloadStoragePath: 'users/admin/shop/sold.zip',
      },
      {
        id: 'pack-open',
        title: 'Pack disponible',
        downloadStoragePath: 'users/admin/shop/open.zip',
      },
    ], new Set(['pack-sold']));

    const publicSoldPack = toPublicShopPackDownloadState(packs[0]);
    expect(publicSoldPack).toEqual(expect.objectContaining({
      id: 'pack-sold',
      title: 'Pack vendu',
      archived: true,
      archivedReason: 'sold',
      hasDownload: true,
    }));
    expect(publicSoldPack).not.toHaveProperty('downloadStoragePath');
    expect(publicSoldPack).not.toHaveProperty('downloadStorageBucket');
    expect(toPublicShopPackDownloadState(packs[1])).toEqual({
      id: 'pack-open',
      title: 'Pack disponible',
      hasDownload: true,
    });
  });

  test('charge les ventes depuis shop_pack_sales comme source des packs vendus', async () => {
    const inFilter = vi.fn().mockResolvedValue({
      data: [
        { pack_id: 'pack-sold' },
        { pack_id: '' },
        { pack_id: 'pack-pending' },
      ],
      error: null,
    });
    const select = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ select }));
    const { loadSoldShopPackIds } = await import('../../server/shop.js');

    await expect(loadSoldShopPackIds({ from })).resolves.toEqual(new Set(['pack-sold', 'pack-pending']));
    expect(from).toHaveBeenCalledWith('shop_pack_sales');
    expect(select).toHaveBeenCalledWith('pack_id');
    expect(inFilter).toHaveBeenCalledWith('status', ['pending', 'paid']);
  });

  test('ignore la table shop_pack_sales quand elle n est pas encore installee', async () => {
    const inFilter = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: 'PGRST205',
        message: "Could not find the table 'public.shop_pack_sales' in the schema cache",
      },
    });
    const select = vi.fn(() => ({ in: inFilter }));
    const from = vi.fn(() => ({ select }));
    const { loadSoldShopPackIds } = await import('../../server/shop.js');

    await expect(loadSoldShopPackIds({ from })).resolves.toEqual(new Set());
  });

  test('achete via la RPC Supabase attendue', async () => {
    const rpc = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: {
          balance: 42,
          purchased_at: '2026-05-29T10:00:00.000Z',
        },
        error: null,
      }),
    }));
    const { purchaseShopPack } = await import('../../server/shop.js');

    await expect(purchaseShopPack({ rpc }, {
      packId: 'pack-1',
      userId: 'user-1',
      title: 'Pack boutique',
      costCredits: 12,
      downloadFileName: 'pack.zip',
    })).resolves.toEqual({
      balance: 42,
      purchased_at: '2026-05-29T10:00:00.000Z',
    });

    expect(rpc).toHaveBeenCalledWith('purchase_shop_pack', {
      p_pack_id: 'pack-1',
      p_user_id: 'user-1',
      p_title: 'Pack boutique',
      p_cost_credits: 12,
      p_download_file_name: 'pack.zip',
    });
  });

  test('mappe les erreurs de vente concurrente et de credits Supabase', async () => {
    const { purchaseShopPack } = await import('../../server/shop.js');
    const soldSupabase = {
      rpc: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint' },
        }),
      })),
    };
    const creditSupabase = {
      rpc: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'P0001', message: 'Credits IA insuffisants (2/12).' },
        }),
      })),
    };

    await expect(purchaseShopPack(soldSupabase, {
      packId: 'pack-sold',
      userId: 'user-1',
      title: 'Pack vendu',
      costCredits: 12,
      downloadFileName: 'sold.zip',
    })).rejects.toMatchObject({
      status: 404,
      message: 'Pack indisponible.',
    });

    await expect(purchaseShopPack(creditSupabase, {
      packId: 'pack-1',
      userId: 'user-1',
      title: 'Pack boutique',
      costCredits: 12,
      downloadFileName: 'pack.zip',
    })).rejects.toMatchObject({
      status: 402,
      message: 'Credits IA insuffisants (2/12).',
    });
  });
});
