import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({
  createClient: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  download: vi.fn(),
  remove: vi.fn(),
  uploadToSignedUrl: vi.fn(),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: supabaseMock.createClient,
}));

const setupSupabaseStorage = async ({
  useLegacyBucket = false,
  publicBucket = 'public-bucket',
  privateBucket = 'private-bucket',
  authSession = null,
} = {}) => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
  vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
  if (useLegacyBucket) {
    vi.stubEnv('VITE_SUPABASE_PUBLIC_ASSETS_BUCKET', '');
    vi.stubEnv('VITE_SUPABASE_PRIVATE_DATA_BUCKET', '');
    vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', 'legacy-bucket');
  } else {
    vi.stubEnv('VITE_SUPABASE_PUBLIC_ASSETS_BUCKET', publicBucket);
    vi.stubEnv('VITE_SUPABASE_PRIVATE_DATA_BUCKET', privateBucket);
    vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', '');
  }

  supabaseMock.upload.mockResolvedValue({ error: null });
  supabaseMock.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://cdn.test/file.txt' } });
  supabaseMock.download.mockResolvedValue({ data: new Blob(['bonjour'], { type: 'text/plain' }), error: null });
  supabaseMock.remove.mockResolvedValue({ error: null });
  supabaseMock.uploadToSignedUrl.mockResolvedValue({ data: { path: 'users/user-1/file.txt' }, error: null });
  supabaseMock.from.mockReturnValue({
    upload: supabaseMock.upload,
    getPublicUrl: supabaseMock.getPublicUrl,
    download: supabaseMock.download,
    remove: supabaseMock.remove,
    uploadToSignedUrl: supabaseMock.uploadToSignedUrl,
  });
  supabaseMock.createClient.mockReturnValue({
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: authSession } }),
    },
    storage: {
      from: supabaseMock.from,
    },
  });

  return import('../shared/storage/supabaseStorage');
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('supabaseStorage', () => {
  test('buildStoragePath normalise les accents, espaces et caracteres speciaux', async () => {
    const { buildStoragePath } = await setupSupabaseStorage();

    expect(buildStoragePath('Été 2026', 'Mon fichier !.PNG', 'a@@@b')).toBe('ete-2026/mon-fichier-.png/a-b');
  });

  test('generateStorageFilename garde un nom lisible et preserve l extension', async () => {
    const { generateStorageFilename } = await setupSupabaseStorage();

    expect(generateStorageFilename('Mon Image Finale.PNG', {
      timestampValue: 12345,
      uuidValue: 'abc123def456',
    })).toBe('mon-image-finale-9ix-abc123def456.png');
  });

  test('generateStorageFilename permet de choisir timestamp ou UUID court', async () => {
    const { generateStorageFilename } = await setupSupabaseStorage();

    expect(generateStorageFilename('photo.png', {
      suffix: 'timestamp',
      timestampValue: 12345,
    })).toBe('photo-9ix.png');

    expect(generateStorageFilename('photo.png', {
      suffix: 'uuid',
      uuidValue: 'abc123def456',
    })).toBe('photo-abc123def456.png');
  });

  test('buildStoragePath rejette les segments dangereux', async () => {
    const { buildStoragePath } = await setupSupabaseStorage();

    for (const segment of ['.', '..', '/', '\\']) {
      expect(() => buildStoragePath('users', segment, 'file.txt')).toThrow(/Segment de chemin Supabase invalide/);
    }
  });

  test('hasSupabaseConfig garde la session auth meme sans buckets storage', async () => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv('VITE_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('VITE_SUPABASE_PUBLISHABLE_KEY', 'publishable-key');
    vi.stubEnv('VITE_SUPABASE_PUBLIC_ASSETS_BUCKET', '');
    vi.stubEnv('VITE_SUPABASE_PRIVATE_DATA_BUCKET', '');
    vi.stubEnv('VITE_SUPABASE_STORAGE_BUCKET', '');
    supabaseMock.createClient.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      storage: {
        from: supabaseMock.from,
      },
    });

    const {
      getSupabaseClient,
      hasSupabaseAuthConfig,
      hasSupabaseConfig,
      hasSupabaseStorageConfig,
      uploadToStorage,
    } = await import('../shared/storage/supabaseStorage');

    expect(hasSupabaseAuthConfig()).toBe(true);
    expect(hasSupabaseConfig()).toBe(true);
    expect(hasSupabaseStorageConfig()).toBe(false);
    expect(() => getSupabaseClient()).not.toThrow();
    await expect(uploadToStorage('users/user-1/file.txt', new Blob(['data']))).rejects.toThrow(
      /Configuration Supabase Storage manquante/,
    );
  });

  test('hasSupabaseStorageConfig refuse une configuration partielle sans fallback legacy', async () => {
    const {
      getSupabaseClient,
      hasSupabaseConfig,
      hasSupabaseStorageConfig,
      uploadToStorage,
    } = await setupSupabaseStorage({ privateBucket: '' });

    expect(hasSupabaseConfig()).toBe(true);
    expect(hasSupabaseStorageConfig()).toBe(false);
    expect(() => getSupabaseClient()).not.toThrow();
    await expect(uploadToStorage('users/user-1/file.txt', new Blob(['data']))).rejects.toThrow(/VITE_SUPABASE_PUBLIC_ASSETS_BUCKET et VITE_SUPABASE_PRIVATE_DATA_BUCKET/);
  });

  test('uploadToStorage en mode private ne genere pas d URL publique', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();
    const file = new Blob(['private-data'], { type: 'text/plain' });

    const result = await uploadToStorage('users/user-1/private.txt', file);

    expect(supabaseMock.upload).toHaveBeenCalledWith('users/user-1/private.txt', file, {
      upsert: false,
      cacheControl: '3600',
      contentType: 'text/plain',
    });
    expect(supabaseMock.from).toHaveBeenCalledWith('private-bucket');
    expect(supabaseMock.getPublicUrl).not.toHaveBeenCalled();
    expect(result).toEqual({
      bucket: 'private-bucket',
      path: 'users/user-1/private.txt',
      visibility: 'private',
      publicUrl: null,
    });
  });

  test('uploadToStorage en mode public genere une URL publique', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();
    const file = new Blob(['public-data'], { type: 'text/plain' });

    const result = await uploadToStorage('public/file.txt', file, { visibility: 'public' });

    expect(supabaseMock.from).toHaveBeenCalledWith('public-bucket');
    expect(supabaseMock.getPublicUrl).toHaveBeenCalledWith('public/file.txt');
    expect(result.bucket).toBe('public-bucket');
    expect(result.publicUrl).toBe('https://cdn.test/file.txt');
    expect(result.visibility).toBe('public');
  });

  test('uploadToStorage retourne l URL publique existante quand un objet public deduplique existe deja', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();
    const file = new Blob(['public-data'], { type: 'image/png' });
    supabaseMock.upload.mockResolvedValueOnce({
      error: { message: 'The resource already exists', statusCode: 409 },
    });
    supabaseMock.getPublicUrl.mockImplementationOnce((path) => ({
      data: { publicUrl: `https://cdn.test/${path}` },
    }));

    const result = await uploadToStorage('users/user-1/images/deduped/hash.png', file, {
      allowExistingObject: true,
      visibility: 'public',
      retries: 0,
    });

    expect(supabaseMock.upload).toHaveBeenCalledWith('users/user-1/images/deduped/hash.png', file, {
      upsert: false,
      cacheControl: '3600',
      contentType: 'image/png',
    });
    expect(result).toEqual({
      bucket: 'public-bucket',
      path: 'users/user-1/images/deduped/hash.png',
      visibility: 'public',
      publicUrl: 'https://cdn.test/users/user-1/images/deduped/hash.png',
    });
  });

  test('uploadToStorage utilise des buckets differents selon la visibilite', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    const privateResult = await uploadToStorage('users/user-1/private.txt', new Blob(['private'], { type: 'text/plain' }));
    const publicResult = await uploadToStorage('public/public.txt', new Blob(['public'], { type: 'text/plain' }), { visibility: 'public' });

    expect(supabaseMock.from).toHaveBeenCalledWith('private-bucket');
    expect(supabaseMock.from).toHaveBeenCalledWith('public-bucket');
    expect(privateResult.bucket).toBe('private-bucket');
    expect(publicResult.bucket).toBe('public-bucket');
    expect(privateResult.bucket).not.toBe(publicResult.bucket);
  });

  test('helpers haut niveau forcent le bon bucket', async () => {
    const { uploadPrivateUserFile, uploadPublicAsset } = await setupSupabaseStorage();

    await uploadPublicAsset('assets/banner.png', new Blob(['png'], { type: 'image/png' }));
    expect(supabaseMock.from).toHaveBeenLastCalledWith('public-bucket');

    await uploadPrivateUserFile('User 42', 'notes.json', new Blob(['{}'], { type: 'application/json' }));
    expect(supabaseMock.from).toHaveBeenLastCalledWith('private-bucket');
  });

  test('downloadTextFile choisit le bucket selon la visibilite explicite', async () => {
    const { downloadTextFile } = await setupSupabaseStorage();

    await downloadTextFile('projects.json', { visibility: 'public' });
    expect(supabaseMock.from).toHaveBeenLastCalledWith('public-bucket');

    await downloadTextFile('projects.json', { visibility: 'private' });
    expect(supabaseMock.from).toHaveBeenLastCalledWith('private-bucket');
  });

  test('downloadTextFile accepte un bucket explicite', async () => {
    const { downloadTextFile } = await setupSupabaseStorage();

    await downloadTextFile('exports/file.json', { bucket: 'archive-bucket' });

    expect(supabaseMock.from).toHaveBeenLastCalledWith('archive-bucket');
  });

  test('deleteStorageFile supprime dans le bucket prive par defaut', async () => {
    const { deleteStorageFile } = await setupSupabaseStorage();

    await expect(deleteStorageFile('users/user-1/projects/project-1.json')).resolves.toBe(true);

    expect(supabaseMock.from).toHaveBeenCalledWith('private-bucket');
    expect(supabaseMock.remove).toHaveBeenCalledWith(['users/user-1/projects/project-1.json']);
  });

  test('deleteStorageFile transforme les erreurs Supabase en StorageError', async () => {
    const { deleteStorageFile } = await setupSupabaseStorage();
    supabaseMock.remove.mockResolvedValueOnce({ error: { message: 'Forbidden', statusCode: 403 } });

    await expect(deleteStorageFile('users/user-1/projects/project-1.json')).rejects.toMatchObject({
      name: 'StorageError',
      code: 'permission-denied',
      action: 'suppression du fichier',
      bucket: 'private-bucket',
      path: 'users/user-1/projects/project-1.json',
    });
  });

  test('VITE_SUPABASE_STORAGE_BUCKET reste un fallback retrocompatible avec warning unique', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const {
      LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE,
      resolveStorageBucket,
      uploadToStorage,
      usesLegacyStorageBucketFallback,
    } = await setupSupabaseStorage({ useLegacyBucket: true });

    const result = await uploadToStorage('public/file.txt', new Blob(['data'], { type: 'text/plain' }), { visibility: 'public' });
    await uploadToStorage('users/user-1/file.txt', new Blob(['data'], { type: 'text/plain' }), { visibility: 'private' });

    expect(supabaseMock.from).toHaveBeenCalledWith('legacy-bucket');
    expect(result.bucket).toBe('legacy-bucket');
    expect(resolveStorageBucket('public')).toBe('legacy-bucket');
    expect(resolveStorageBucket('private')).toBe('legacy-bucket');
    expect(usesLegacyStorageBucketFallback).toBe(true);
    expect(LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE).toMatch(/deprecated/i);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith('[supabase-storage]', LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE);
    expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('legacy-bucket');
  });

  test('logs Supabase Storage desactives par defaut', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await uploadToStorage('users/user-secret/private.txt', new Blob(['data'], { type: 'text/plain' }));

    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('logs Supabase Storage activables avec chemin expurge et duree', async () => {
    const { setSupabaseStorageDebug, uploadToStorage } = await setupSupabaseStorage();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    setSupabaseStorageDebug(true);

    await uploadToStorage('users/user-secret/projects/project-secret/image.png', new Blob(['png'], { type: 'image/png' }));

    expect(infoSpy).toHaveBeenCalledWith('[supabase-storage]', expect.objectContaining({
      scope: 'supabase-storage',
      event: 'upload:start',
      bucket: 'private-bucket',
      path: 'users/{user}/.../*.png',
    }));
    expect(infoSpy).toHaveBeenCalledWith('[supabase-storage]', expect.objectContaining({
      event: 'upload:success',
      durationMs: expect.any(Number),
    }));
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('user-secret');
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('project-secret');
    expect(JSON.stringify(infoSpy.mock.calls)).not.toContain('image.png');
  });

  test('downloadTextFile loggue start et failure en mode debug', async () => {
    const { downloadTextFile, setSupabaseStorageDebug } = await setupSupabaseStorage();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    setSupabaseStorageDebug(true);
    supabaseMock.download.mockResolvedValue({
      data: null,
      error: { message: 'Object not found', statusCode: 404 },
    });

    await expect(downloadTextFile('users/user-secret/missing.json')).rejects.toMatchObject({ code: 'not-found' });

    expect(infoSpy).toHaveBeenCalledWith('[supabase-storage]', expect.objectContaining({
      event: 'download:start',
      path: 'users/{user}/.../*.json',
    }));
    expect(warnSpy).toHaveBeenCalledWith('[supabase-storage]', expect.objectContaining({
      event: 'download:failure',
      code: 'not-found',
      durationMs: expect.any(Number),
    }));
    expect(JSON.stringify([...infoSpy.mock.calls, ...warnSpy.mock.calls])).not.toContain('user-secret');
  });

  test('uploadToStorage utilise upsert false par defaut', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    await uploadToStorage('users/user-1/file.txt', new Blob(['data']));

    expect(supabaseMock.upload.mock.calls[0][2]).toMatchObject({ upsert: false });
  });

  test('uploadToStorage refuse les fichiers vides avant appel reseau', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    await expect(uploadToStorage('users/user-1/empty.json', new Blob([], { type: 'application/json' }))).rejects.toMatchObject({
      name: 'StorageError',
      code: 'empty-file',
      message: 'Fichier vide refusé pour upload "users/user-1/empty.json".',
    });
    expect(supabaseMock.upload).not.toHaveBeenCalled();
  });

  test('uploadToStorage applique maxFileSize configurable', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    await expect(uploadToStorage('users/user-1/large.json', new Blob(['123456'], { type: 'application/json' }), {
      maxFileSize: 5,
    })).rejects.toMatchObject({
      name: 'StorageError',
      code: 'file-too-large',
    });
    expect(supabaseMock.upload).not.toHaveBeenCalled();
  });

  test('uploadToStorage applique allowMimeTypes configurable', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    await uploadToStorage('users/user-1/photo.png', new Blob(['png'], { type: 'image/png' }), {
      allowMimeTypes: ['image/*'],
    });
    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);

    await expect(uploadToStorage('users/user-1/audio.mp3', new Blob(['mp3'], { type: 'audio/mpeg' }), {
      allowMimeTypes: ['image/*'],
    })).rejects.toMatchObject({
      name: 'StorageError',
      code: 'unsupported-mime-type',
    });
    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
  });

  test('uploadToStorage verifie la coherence extension et MIME type', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    await expect(uploadToStorage('users/user-1/photo.jpg', new Blob(['png'], { type: 'image/png' }))).rejects.toMatchObject({
      name: 'StorageError',
      code: 'invalid-extension',
    });
    expect(supabaseMock.upload).not.toHaveBeenCalled();
  });

  test('uploadToStorage refuse les SVG avant appel reseau', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    await expect(uploadToStorage('users/user-1/logo.svg', new Blob(['<svg />'], { type: 'image/svg+xml' }), {
      allowMimeTypes: ['image/*'],
    })).rejects.toMatchObject({
      name: 'StorageError',
      code: 'unsupported-mime-type',
    });

    await expect(uploadToStorage('users/user-1/logo.svg', new Blob(['data'], { type: 'application/octet-stream' }), {
      allowMimeTypes: null,
    })).rejects.toMatchObject({
      name: 'StorageError',
      code: 'unsupported-mime-type',
    });

    expect(supabaseMock.upload).not.toHaveBeenCalled();
  });

  test('uploadToStorage retente les erreurs reseau temporaires', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();
    supabaseMock.upload
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ error: null });

    await expect(uploadToStorage('users/user-1/file.txt', new Blob(['data']), {
      retries: 1,
      retryDelayMs: 0,
    })).resolves.toMatchObject({ path: 'users/user-1/file.txt' });

    expect(supabaseMock.upload).toHaveBeenCalledTimes(2);
  });

  test('uploadToStorage passe par une URL signee serveur quand le navigateur ne joint pas Supabase', async () => {
    const { uploadToStorage } = await setupSupabaseStorage({
      authSession: { access_token: 'user-access-token', user: { id: 'user-1' } },
    });
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      json: async () => ({
        bucket: 'private-bucket',
        path: 'users/user-1/file.txt',
        visibility: 'private',
        token: 'signed-upload-token',
      }),
    });
    vi.stubGlobal('fetch', fetchSpy);
    supabaseMock.upload.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(uploadToStorage('users/user-1/file.txt', new Blob(['data'], { type: 'text/plain' }), {
      visibility: 'private',
      retries: 0,
    })).resolves.toMatchObject({
      bucket: 'private-bucket',
      path: 'users/user-1/file.txt',
      visibility: 'private',
      publicUrl: null,
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/storage-upload-url?'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-access-token',
        }),
      }),
    );
    expect(String(fetchSpy.mock.calls[0][0])).toContain('path=users%2Fuser-1%2Ffile.txt');
    expect(String(fetchSpy.mock.calls[0][0])).toContain('contentLength=4');
    expect(supabaseMock.uploadToSignedUrl).toHaveBeenCalledWith(
      'users/user-1/file.txt',
      'signed-upload-token',
      expect.any(Blob),
      expect.objectContaining({
        cacheControl: '3600',
        contentType: 'text/plain',
      }),
    );
  });

  test('uploadToStorage garde le proxy binaire en fallback si l URL signee est indisponible', async () => {
    const { uploadToStorage } = await setupSupabaseStorage({
      authSession: { access_token: 'user-access-token', user: { id: 'user-1' } },
    });
    const fetchSpy = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({ error: 'Route API introuvable.' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({
          bucket: 'public-bucket',
          path: 'users/user-1/file.txt',
          visibility: 'public',
          publicUrl: 'https://cdn.test/proxy-file.txt',
        }),
      });
    vi.stubGlobal('fetch', fetchSpy);
    supabaseMock.upload.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    await expect(uploadToStorage('users/user-1/file.txt', new Blob(['data'], { type: 'text/plain' }), {
      visibility: 'public',
      retries: 0,
    })).resolves.toMatchObject({
      bucket: 'public-bucket',
      path: 'users/user-1/file.txt',
      visibility: 'public',
      publicUrl: 'https://cdn.test/proxy-file.txt',
    });

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(String(fetchSpy.mock.calls[0][0])).toContain('/api/storage-upload-url?');
    expect(fetchSpy).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/storage-upload?'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer user-access-token',
          'Content-Type': 'text/plain',
        }),
      }),
    );
  });

  test('uploadToStorage ne retente pas les erreurs Supabase generiques', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();
    supabaseMock.upload.mockResolvedValueOnce({ error: { message: 'Internal server error', statusCode: 500 } });

    await expect(uploadToStorage('users/user-1/server-error.txt', new Blob(['data']), {
      retries: 2,
      retryDelayMs: 0,
    })).rejects.toMatchObject({
      code: 'storage-error',
    });

    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
  });

  test('uploadToStorage distingue timeout et annulation', async () => {
    vi.useFakeTimers();
    const { uploadToStorage } = await setupSupabaseStorage();
    supabaseMock.upload.mockReturnValue(new Promise(() => {}));

    const timedOutUpload = uploadToStorage('users/user-1/slow.txt', new Blob(['data']), {
      retries: 0,
      timeoutMs: 10,
    });
    const timeoutAssertion = expect(timedOutUpload).rejects.toMatchObject({
      name: 'StorageError',
      code: 'timeout',
    });
    await vi.advanceTimersByTimeAsync(10);
    await timeoutAssertion;

    const controller = new AbortController();
    const abortedUpload = uploadToStorage('users/user-1/cancelled.txt', new Blob(['data']), {
      signal: controller.signal,
      timeoutMs: 1000,
    });
    controller.abort();
    await expect(abortedUpload).rejects.toMatchObject({
      name: 'StorageError',
      code: 'aborted',
    });
  });

  test('uploadToStorage ne relance pas un upload apres timeout local', async () => {
    vi.useFakeTimers();
    const { uploadToStorage } = await setupSupabaseStorage();
    let activeUploads = 0;
    let maxConcurrentUploads = 0;
    supabaseMock.upload.mockImplementation(() => {
      activeUploads += 1;
      maxConcurrentUploads = Math.max(maxConcurrentUploads, activeUploads);
      return new Promise(() => {});
    });

    const timedOutUpload = uploadToStorage('users/user-1/slow-retry.txt', new Blob(['data']), {
      retries: 2,
      retryDelayMs: 0,
      timeoutMs: 10,
    });
    const timeoutAssertion = expect(timedOutUpload).rejects.toMatchObject({
      name: 'StorageError',
      code: 'timeout',
    });

    await vi.advanceTimersByTimeAsync(10);
    await timeoutAssertion;
    await vi.advanceTimersByTimeAsync(1000);

    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);
    expect(maxConcurrentUploads).toBe(1);
  });

  test('uploadToStorage ne retente pas permission, quota ou fichier trop gros', async () => {
    const { uploadToStorage } = await setupSupabaseStorage();

    supabaseMock.upload.mockResolvedValueOnce({ error: { message: 'Forbidden', statusCode: 403 } });
    await expect(uploadToStorage('users/user-1/private.txt', new Blob(['data']), { retries: 2 })).rejects.toMatchObject({
      code: 'permission-denied',
    });
    expect(supabaseMock.upload).toHaveBeenCalledTimes(1);

    supabaseMock.upload.mockResolvedValueOnce({ error: { message: 'Storage quota exceeded', statusCode: 429 } });
    await expect(uploadToStorage('users/user-1/quota.txt', new Blob(['data']), { retries: 2 })).rejects.toMatchObject({
      code: 'quota-exceeded',
    });
    expect(supabaseMock.upload).toHaveBeenCalledTimes(2);

    supabaseMock.upload.mockResolvedValueOnce({ error: { message: 'Payload too large', statusCode: 413 } });
    await expect(uploadToStorage('users/user-1/large.txt', new Blob(['data']), { retries: 2 })).rejects.toMatchObject({
      code: 'file-too-large',
    });
    expect(supabaseMock.upload).toHaveBeenCalledTimes(3);
  });

  test('uploadPrivateUserFile force le prefixe users/{userId}', async () => {
    const { uploadPrivateUserFile } = await setupSupabaseStorage();
    const file = new Blob(['data'], { type: 'text/plain' });

    const result = await uploadPrivateUserFile('User 42', 'avatars/photo.png', file);

    expect(supabaseMock.upload).toHaveBeenCalledWith('users/user-42/avatars/photo.png', file, expect.objectContaining({
      upsert: false,
      contentType: 'text/plain',
    }));
    expect(supabaseMock.from).toHaveBeenCalledWith('private-bucket');
    expect(supabaseMock.getPublicUrl).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      bucket: 'private-bucket',
      path: 'users/user-42/avatars/photo.png',
      visibility: 'private',
      publicUrl: null,
    });
  });

  test('uploadPrivateUserFile refuse un userId vide', async () => {
    const { uploadPrivateUserFile } = await setupSupabaseStorage();

    await expect(uploadPrivateUserFile('', 'file.txt', new Blob(['data']))).rejects.toThrow(
      'Upload privé impossible : identifiant utilisateur manquant.',
    );
  });

  test('downloadTextFile valide le chemin avant de telecharger', async () => {
    const { downloadTextFile } = await setupSupabaseStorage();

    await expect(downloadTextFile('../secret.txt')).rejects.toThrow(/segment interdit/);
    expect(supabaseMock.download).not.toHaveBeenCalled();
  });

  test('downloadTextFile transforme les erreurs Supabase en StorageError', async () => {
    const { StorageError, downloadTextFile, isStorageNotFoundError } = await setupSupabaseStorage();
    supabaseMock.download.mockResolvedValue({
      data: null,
      error: { message: 'Object not found', statusCode: 404 },
    });

    await expect(downloadTextFile('users/user-1/missing.txt')).rejects.toMatchObject({
      name: 'StorageError',
      action: 'telechargement du fichier',
      bucket: 'private-bucket',
      path: 'users/user-1/missing.txt',
      message: 'Fichier introuvable pour telechargement du fichier "users/user-1/missing.txt".',
    });

    const error = await downloadTextFile('users/user-1/missing.txt').catch((downloadError) => downloadError);

    expect(error).toBeInstanceOf(StorageError);
    expect(isStorageNotFoundError(error)).toBe(true);
    expect(isStorageNotFoundError(new Error('Fichier introuvable pour telechargement du fichier.'))).toBe(false);
  });
});
