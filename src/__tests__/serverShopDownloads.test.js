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
});
