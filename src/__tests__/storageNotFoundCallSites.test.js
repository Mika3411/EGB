import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const storageMock = vi.hoisted(() => ({
  buildStoragePath: vi.fn((...segments) => segments.filter(Boolean).join('/')),
  downloadTextFile: vi.fn(),
  getSupabaseClient: vi.fn(),
  hasSupabaseConfig: vi.fn(),
  isStorageNotFoundError: vi.fn(),
  uploadToStorage: vi.fn(),
}));

vi.mock('../supabaseStorage', () => storageMock);

const missingStorageError = {
  name: 'StorageError',
  code: 'not-found',
  message: 'Fichier introuvable pour telechargement du fichier.',
};

const setupMissingStorageFile = () => {
  storageMock.hasSupabaseConfig.mockReturnValue(true);
  storageMock.downloadTextFile.mockRejectedValue(missingStorageError);
  storageMock.isStorageNotFoundError.mockImplementation((error) => error?.code === 'not-found');
};

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  window.localStorage.clear();
  setupMissingStorageFile();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: false,
    json: vi.fn().mockResolvedValue([]),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Storage not-found call sites', () => {
  test('first-run: loadPublicProjectIndex retourne un index vide si le manifeste public est absent', async () => {
    const { loadPublicProjectIndex } = await import('../lib/authStorage');

    await expect(loadPublicProjectIndex()).resolves.toEqual([]);

    expect(storageMock.downloadTextFile).toHaveBeenCalledWith('public/projects.json', { visibility: 'public' });
    expect(storageMock.isStorageNotFoundError).toHaveBeenCalledWith(missingStorageError);
  });

  test('fichier utilisateur absent: loadProjectRecordsForUser retourne null', async () => {
    const { loadProjectRecordsForUser } = await import('../lib/authStorage');

    await expect(loadProjectRecordsForUser('user-1')).resolves.toBeNull();

    expect(storageMock.downloadTextFile).toHaveBeenCalledWith('users/user-1/projects.json', { visibility: 'private' });
    expect(storageMock.isStorageNotFoundError).toHaveBeenCalledWith(missingStorageError);
  });

  test('projet utilisateur absent: loadProjectForUser retourne null sans fallback local', async () => {
    const { loadProjectForUser } = await import('../lib/authStorage');

    await expect(loadProjectForUser('user-1')).resolves.toBeNull();

    expect(storageMock.downloadTextFile).toHaveBeenCalledWith('users/user-1/project.json', { visibility: 'private' });
    expect(storageMock.isStorageNotFoundError).toHaveBeenCalledWith(missingStorageError);
  });

  test('manifest boutique absent: loadSharedShopPacks retourne les packs locaux et bundles', async () => {
    const { loadSharedShopPacks } = await import('../lib/shopPacksStorage');

    await expect(loadSharedShopPacks()).resolves.toEqual([]);

    expect(storageMock.downloadTextFile).toHaveBeenCalledWith('public/shop-packs.json', { visibility: 'public' });
    expect(storageMock.isStorageNotFoundError).toHaveBeenCalledWith(missingStorageError);
  });
});
