import { webcrypto } from 'node:crypto';
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { useBuilderMediaUpload } from '../domains/media/hooks/useBuilderMediaUpload';
import { MB, getAccountStorageUsageBytes } from '../shared/services/storageQuota';
import { uploadFileToSupabase } from '../shared/utils/fileHelpers';

const storageMock = vi.hoisted(() => {
  const sanitizeSegment = (value = '') => String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';

  return {
    buildStoragePath: vi.fn((...segments) => segments.filter(Boolean).map(sanitizeSegment).join('/')),
    generateStorageFilename: vi.fn((filename) => `generated-${sanitizeSegment(filename)}`),
    getSupabaseClient: vi.fn(() => ({
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    })),
    getPublicStorageUploadResult: vi.fn(),
    hasSupabaseAuthConfig: vi.fn(() => false),
    hasSupabaseConfig: vi.fn(() => false),
    hasSupabaseStorageConfig: vi.fn(),
    isStorageObjectAlreadyExistsError: vi.fn(),
    uploadToStorage: vi.fn(),
  };
});

vi.mock('../shared/storage/supabaseStorage', () => ({
  buildStoragePath: storageMock.buildStoragePath,
  generateStorageFilename: storageMock.generateStorageFilename,
  getSupabaseClient: storageMock.getSupabaseClient,
  getPublicStorageUploadResult: storageMock.getPublicStorageUploadResult,
  hasSupabaseAuthConfig: storageMock.hasSupabaseAuthConfig,
  hasSupabaseConfig: storageMock.hasSupabaseConfig,
  hasSupabaseStorageConfig: storageMock.hasSupabaseStorageConfig,
  isStorageObjectAlreadyExistsError: storageMock.isStorageObjectAlreadyExistsError,
  uploadToStorage: storageMock.uploadToStorage,
}));

const SAME_MEDIA_HASH = '1afed82198aac1a1ba8716a9ce01040768325d1eff96e8c3a5b4c6725f11b0c5';
const SAME_SIZE_MEDIA_A_HASH = '5569339403fbe133398d2b3b38520b6e68c639b7e10d3ed7570395be683dda90';
const SAME_SIZE_MEDIA_B_HASH = '672cda1fd7e2550977b67dc9ef971eabf9cf0086f338f1ad5e9d395d11ae2ec9';
const OPTIMIZED_IMAGE_HASH = 'c36eb9c9a08cb35c612488049df919324d8a0826496337aaf787e3f938ca69eb';

const createUploadResult = (path, file, options = {}) => ({
  bucket: options.visibility === 'public' ? 'public-bucket' : 'private-bucket',
  path,
  visibility: options.visibility || 'private',
  publicUrl: options.visibility === 'public' ? `https://cdn.test/${path}` : null,
  receivedFile: file,
  receivedOptions: options,
});

const restoreProperty = (target, property, descriptor) => {
  if (descriptor) {
    Object.defineProperty(target, property, descriptor);
    return;
  }
  delete target[property];
};

const installOptimizedImageStubs = () => {
  const createObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'createObjectURL');
  const revokeObjectUrlDescriptor = Object.getOwnPropertyDescriptor(URL, 'revokeObjectURL');
  const canvasToBlobDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'toBlob');

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:test-image'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'toBlob', {
    configurable: true,
    value: vi.fn((callback, mimeType) => {
      callback(new Blob(['optimized-image-bytes'], { type: mimeType || 'image/webp' }));
    }),
  });

  vi.stubGlobal('Image', class {
    constructor() {
      this.width = 4000;
      this.height = 2000;
      this.naturalWidth = 4000;
      this.naturalHeight = 2000;
    }

    set src(value) {
      this.currentSrc = value;
      queueMicrotask(() => this.onload?.());
    }

    get src() {
      return this.currentSrc;
    }
  });

  return () => {
    restoreProperty(URL, 'createObjectURL', createObjectUrlDescriptor);
    restoreProperty(URL, 'revokeObjectURL', revokeObjectUrlDescriptor);
    restoreProperty(HTMLCanvasElement.prototype, 'toBlob', canvasToBlobDescriptor);
  };
};

beforeEach(() => {
  if (!globalThis.crypto?.subtle) {
    vi.stubGlobal('crypto', webcrypto);
  }
  storageMock.hasSupabaseStorageConfig.mockReturnValue(true);
  storageMock.uploadToStorage.mockImplementation(async (path, file, options) => createUploadResult(path, file, options));
  storageMock.getPublicStorageUploadResult.mockImplementation((path) => createUploadResult(path, null, { visibility: 'public' }));
  storageMock.isStorageObjectAlreadyExistsError.mockImplementation((error) => (
    error?.code === 'already-exists'
    || Number(error?.status || error?.statusCode || 0) === 409
    || /already exists|resource already exists/i.test(error?.message || '')
  ));
});

afterEach(() => {
  document.body.innerHTML = '';
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Supabase media upload deduplication', () => {
  test('deux imports du meme fichier produisent le meme chemin Supabase', async () => {
    const file = new File(['same-media-bytes'], 'Mon Image.png', { type: 'image/png' });
    const options = {
      userId: 'User 42',
      folder: 'Images',
      optimizeImage: false,
      dedupePublicMedia: true,
    };

    const first = await uploadFileToSupabase(file, options);
    const second = await uploadFileToSupabase(file, options);

    expect(first.path).toBe(`users/user-42/images/deduped/${SAME_MEDIA_HASH}.png`);
    expect(second.path).toBe(first.path);
    expect(first.publicUrl).toBe(`https://cdn.test/${first.path}`);
    expect(storageMock.uploadToStorage).toHaveBeenCalledTimes(2);
    expect(storageMock.uploadToStorage.mock.calls[0][2]).toMatchObject({
      allowExistingObject: true,
      upsert: false,
      visibility: 'public',
    });
  });

  test('garde l extension zip quand le navigateur envoie application/x-zip-compressed', async () => {
    const file = new File(['zip-bytes'], 'pirates-realistic-cinematics.zip', { type: 'application/x-zip-compressed' });

    const uploaded = await uploadFileToSupabase(file, {
      userId: 'ff12a4b4b-31e6-43e8-bdcd-e2e31345ca63',
      folder: 'shop-packs-pack_mqa2lg4r_rz4lpe',
      optimizeImage: false,
      visibility: 'private',
      allowMimeTypes: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
    });

    expect(uploaded.filename).toBe('generated-pirates-realistic-cinematics.zip');
    expect(uploaded.path).toBe(
      'users/ff12a4b4b-31e6-43e8-bdcd-e2e31345ca63/shop-packs-pack_mqa2lg4r_rz4lpe/generated-pirates-realistic-cinematics.zip',
    );
    expect(storageMock.uploadToStorage.mock.calls[0][0]).toBe(uploaded.path);
    expect(storageMock.uploadToStorage.mock.calls[0][1].name).toBe('pirates-realistic-cinematics.zip');
    expect(storageMock.uploadToStorage.mock.calls[0][2]).toMatchObject({
      contentType: 'application/x-zip-compressed',
      visibility: 'private',
    });
  });

  test('deux fichiers differents avec meme nom et meme taille produisent des chemins differents', async () => {
    const firstFile = new File(['same-size-a'], 'Même Nom.png', { type: 'image/png' });
    const secondFile = new File(['same-size-b'], 'Même Nom.png', { type: 'image/png' });

    expect(firstFile.name).toBe(secondFile.name);
    expect(firstFile.size).toBe(secondFile.size);

    const uploadOptions = {
      userId: 'User 42',
      folder: 'Images',
      optimizeImage: false,
      dedupePublicMedia: true,
    };
    const first = await uploadFileToSupabase(firstFile, uploadOptions);
    const second = await uploadFileToSupabase(secondFile, uploadOptions);

    expect(first.sha256).toBe(SAME_SIZE_MEDIA_A_HASH);
    expect(second.sha256).toBe(SAME_SIZE_MEDIA_B_HASH);
    expect(first.path).toBe(`users/user-42/images/deduped/${SAME_SIZE_MEDIA_A_HASH}.png`);
    expect(second.path).toBe(`users/user-42/images/deduped/${SAME_SIZE_MEDIA_B_HASH}.png`);
    expect(second.path).not.toBe(first.path);
    expect(second.publicUrl).not.toBe(first.publicUrl);
  });

  test('calcule le hash sur le fichier image optimise, pas sur le fichier source', async () => {
    const restoreImageStubs = installOptimizedImageStubs();
    const sourceFile = new File(['source-image-bytes'], 'Photo Originale.png', { type: 'image/png' });

    try {
      const uploaded = await uploadFileToSupabase(sourceFile, {
        userId: 'User 42',
        folder: 'Images',
        optimizeImage: true,
        dedupePublicMedia: true,
      });

      expect(uploaded.path).toBe(`users/user-42/images/deduped/${OPTIMIZED_IMAGE_HASH}.webp`);
      expect(uploaded.sha256).toBe(OPTIMIZED_IMAGE_HASH);
      expect(uploaded.optimized).toBe(true);
      expect(uploaded.originalSize).toBe(sourceFile.size);
      expect(uploaded.optimizedSize).toBe('optimized-image-bytes'.length);
      expect(await storageMock.uploadToStorage.mock.calls[0][1].text()).toBe('optimized-image-bytes');
    } finally {
      restoreImageStubs();
    }
  });

  test('retourne l URL publique existante quand Supabase signale que l objet existe deja', async () => {
    storageMock.uploadToStorage.mockRejectedValueOnce(Object.assign(
      new Error('The resource already exists'),
      { code: 'already-exists', status: 409 },
    ));
    const file = new File(['same-media-bytes'], 'Mon Image.png', { type: 'image/png' });

    const uploaded = await uploadFileToSupabase(file, {
      userId: 'User 42',
      folder: 'Images',
      optimizeImage: false,
      dedupePublicMedia: true,
    });

    const expectedPath = `users/user-42/images/deduped/${SAME_MEDIA_HASH}.png`;
    expect(storageMock.getPublicStorageUploadResult).toHaveBeenCalledWith(expectedPath);
    expect(uploaded.path).toBe(expectedPath);
    expect(uploaded.publicUrl).toBe(`https://cdn.test/${expectedPath}`);
  });

  test('garde le nom original du media dans la mediatheque apres optimisation', async () => {
    const restoreImageStubs = installOptimizedImageStubs();
    let storedAsset = null;
    const editor = {
      loadProject: vi.fn(),
      patchProject: vi.fn((updater) => {
        const draft = { assets: [] };
        updater(draft);
        storedAsset = draft.assets[0];
      }),
      project: { assets: [] },
      selectedSceneId: 'scene-1',
      tab: 'media',
    };
    const { result } = renderHook(() => useBuilderMediaUpload({
      accountStorageQuotaBytes: 10 * MB,
      activeProjectId: 'project-1',
      alertDialog: vi.fn(async () => true),
      editor,
      getCurrentStorageUsageBytes: vi.fn(async () => 0),
      invalidateStorageUsage: vi.fn(),
      preview: { syncWithProject: vi.fn() },
      saveProjectAndAcknowledge: vi.fn(),
      setSaveStatus: vi.fn(),
      userId: 'User 42',
    }));

    try {
      await act(async () => {
        await result.current.importMediaAsset(
          new File(['source-image-bytes'], 'Photo Originale.png', { type: 'image/png' }),
        );
      });

      expect(storedAsset).toMatchObject({
        name: 'Photo Originale.png',
        type: 'image',
        url: `https://cdn.test/users/user-42/images/deduped/${OPTIMIZED_IMAGE_HASH}.webp`,
        size: 'optimized-image-bytes'.length,
      });
    } finally {
      restoreImageStubs();
    }
  });

  test('importe localement si Supabase Storage refuse le media', async () => {
    const restoreImageStubs = installOptimizedImageStubs();
    storageMock.uploadToStorage.mockRejectedValueOnce(Object.assign(
      new Error('Permission refusée pour upload du fichier. Vérifie les policies Supabase Storage.'),
      { name: 'StorageError', code: 'permission-denied' },
    ));
    let storedAsset = null;
    const setSaveStatus = vi.fn();
    const alertDialog = vi.fn(async () => true);
    const editor = {
      loadProject: vi.fn(),
      patchProject: vi.fn((updater) => {
        const draft = { assets: [] };
        updater(draft);
        storedAsset = draft.assets[0];
      }),
      project: { assets: [] },
      selectedSceneId: 'scene-1',
      tab: 'media',
    };
    const { result } = renderHook(() => useBuilderMediaUpload({
      accountStorageQuotaBytes: 10 * MB,
      activeProjectId: 'project-1',
      alertDialog,
      editor,
      getCurrentStorageUsageBytes: vi.fn(async () => 0),
      invalidateStorageUsage: vi.fn(),
      preview: { syncWithProject: vi.fn() },
      saveProjectAndAcknowledge: vi.fn(),
      setSaveStatus,
      userId: 'User 42',
    }));

    try {
      await act(async () => {
        await result.current.importMediaAsset(
          new File(['source-image-bytes'], 'Scene 5.png', { type: 'image/png' }),
        );
      });

      expect(storedAsset).toMatchObject({
        name: 'Scene 5.png',
        type: 'image',
        size: 'optimized-image-bytes'.length,
      });
      expect(storedAsset.url).toMatch(/^data:image\/webp;base64,/);
      expect(alertDialog).not.toHaveBeenCalled();
      expect(setSaveStatus).toHaveBeenLastCalledWith(expect.stringContaining('Supabase non synchronisé'));
    } finally {
      restoreImageStubs();
    }
  });

  test('le stockage estime compte une seule fois une URL dedupliquee reutilisee', () => {
    const url = `https://cdn.test/users/user-42/images/deduped/${SAME_MEDIA_HASH}.png`;

    expect(getAccountStorageUsageBytes([
      { assets: [{ id: 'first', url, type: 'image', size: 5 * MB }] },
      { data: { assets: [{ id: 'second', url, type: 'image', size: 5 * MB }] } },
    ])).toBe(5 * MB);
  });
});
