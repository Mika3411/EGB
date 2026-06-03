import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { readJsonBody } from '../../server/http.js';

const makeRequest = (chunks, headers = {}) => {
  const request = Readable.from(chunks);
  request.headers = headers;
  return request;
};

const storageBucketEnvKeys = [
  'SUPABASE_PUBLIC_ASSETS_BUCKET',
  'VITE_SUPABASE_PUBLIC_ASSETS_BUCKET',
  'SUPABASE_PRIVATE_DATA_BUCKET',
  'VITE_SUPABASE_PRIVATE_DATA_BUCKET',
  'SUPABASE_STORAGE_BUCKET',
  'VITE_SUPABASE_STORAGE_BUCKET',
];

const loadStorageUploads = async (env = {}) => {
  vi.resetModules();
  storageBucketEnvKeys.forEach((key) => vi.stubEnv(key, ''));
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../../server/storageUploads.js');
};

const loadNetlifyStorageUpload = async (env = {}) => {
  vi.resetModules();
  storageBucketEnvKeys.forEach((key) => vi.stubEnv(key, ''));
  vi.stubEnv('SUPABASE_PUBLIC_ASSETS_BUCKET', 'public-assets');
  vi.stubEnv('SUPABASE_PRIVATE_DATA_BUCKET', 'private-data');
  Object.entries(env).forEach(([key, value]) => vi.stubEnv(key, value));
  return import('../../netlify/functions/storage-upload.js');
};

const getThrownError = (callback) => {
  try {
    callback();
  } catch (error) {
    return error;
  }
  throw new Error('Expected callback to throw.');
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('server HTTP body parser', () => {
  test('parse un body JSON valide', async () => {
    await expect(readJsonBody(makeRequest(['{"ok":true}'], {
      'content-type': 'application/json',
    }))).resolves.toEqual({ ok: true });
  });

  test('renvoie une erreur 400 stable pour un JSON invalide', async () => {
    await expect(readJsonBody(makeRequest(['{"broken"'], {
      'content-type': 'application/json',
    }))).rejects.toMatchObject({
      status: 400,
      code: 'PAYLOAD_INVALID',
    });
  });

  test('renvoie une erreur 413 sans detruire la requete pour un body trop gros', async () => {
    const request = new EventEmitter();
    request.headers = { 'content-type': 'application/json' };
    request.resume = vi.fn();
    request.destroy = vi.fn();
    const bodyPromise = readJsonBody(request, { maxBytes: 10 });

    request.emit('data', '01234567890');

    await expect(bodyPromise).rejects.toMatchObject({
      status: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });
    expect(request.destroy).not.toHaveBeenCalled();
    expect(request.resume).toHaveBeenCalled();
  });
});

describe('netlify storage upload validation', () => {
  test('reprend le chemin strict et le prefixe utilisateur du proxy Node', async () => {
    const {
      assertUserStoragePath,
      validateStorageUploadPath,
    } = await loadNetlifyStorageUpload();

    expect(getThrownError(() => validateStorageUploadPath('/users/user-1/file.png'))).toMatchObject({
      statusCode: 400,
      code: 'STORAGE_PATH_INVALID',
    });
    expect(getThrownError(() => validateStorageUploadPath('users/user-1//file.png'))).toMatchObject({
      statusCode: 400,
      code: 'STORAGE_PATH_INVALID',
    });
    expect(validateStorageUploadPath('users/user-1/projects/file.json')).toBe('users/user-1/projects/file.json');
    expect(getThrownError(() => assertUserStoragePath('user-1', 'users/user-2/file.png'))).toMatchObject({
      statusCode: 403,
      code: 'STORAGE_PATH_FORBIDDEN',
    });
  });

  test('refuse les MIME larges non autorises et les extensions incompatibles', async () => {
    const {
      getStorageUploadValidationProfile,
      validateStorageUploadPayload,
    } = await loadNetlifyStorageUpload();

    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/malware.exe',
      contentType: 'application/x-msdownload',
      contentLength: 10,
    }))).toMatchObject({
      statusCode: 415,
      code: 'UNSUPPORTED_MIME_TYPE',
    });
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/photo.jpg',
      contentType: 'image/png',
      contentLength: 10,
    }))).toMatchObject({
      statusCode: 400,
      code: 'INVALID_EXTENSION',
    });
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/logo.png',
      contentType: 'image/svg+xml',
      contentLength: 10,
    }))).toMatchObject({
      statusCode: 415,
      code: 'SVG_UPLOAD_UNSUPPORTED',
    });
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/logo.svg',
      contentType: 'application/octet-stream',
      contentLength: 10,
    }))).toMatchObject({
      statusCode: 415,
      code: 'SVG_UPLOAD_UNSUPPORTED',
    });
    expect(getThrownError(() => validateStorageUploadPayload(Buffer.alloc(0), { maxBytes: 10 }))).toMatchObject({
      statusCode: 400,
      code: 'EMPTY_FILE',
    });
  });

  test('limite les tailles par type en gardant les gros modeles RPG3D configurables', async () => {
    const {
      getStorageUploadValidationProfile,
      validateStorageUploadPayload,
    } = await loadNetlifyStorageUpload({
      RPG3D_UPLOAD_MAX_BYTES: '12',
    });

    const modelProfile = getStorageUploadValidationProfile({
      path: 'users/user-1/arcade-assets/characters/hero.glb',
      contentType: 'application/octet-stream',
      contentLength: 12,
    });
    expect(modelProfile).toMatchObject({
      profile: 'model',
      maxBytes: 12,
      contentType: 'application/octet-stream',
    });
    expect(validateStorageUploadPayload(Buffer.alloc(12), modelProfile)).toBe(12);
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/arcade-assets/characters/too-big.glb',
      contentType: 'application/octet-stream',
      contentLength: 13,
    }))).toMatchObject({
      statusCode: 413,
      code: 'FILE_TOO_LARGE',
    });
  });
});

describe('server storage upload validation', () => {
  test('rejette les chemins non stricts et les chemins hors dossier utilisateur', async () => {
    const {
      assertUserStoragePath,
      validateStorageUploadPath,
    } = await loadStorageUploads();

    expect(getThrownError(() => validateStorageUploadPath('/users/user-1/file.png'))).toMatchObject({
      status: 400,
      code: 'STORAGE_PATH_INVALID',
    });
    expect(getThrownError(() => validateStorageUploadPath('users/user-1/../file.png'))).toMatchObject({
      status: 400,
      code: 'STORAGE_PATH_INVALID',
    });
    expect(validateStorageUploadPath('users/user-1/projects/file.json')).toBe('users/user-1/projects/file.json');
    expect(getThrownError(() => assertUserStoragePath('user-1', 'users/user-2/file.png'))).toMatchObject({
      status: 403,
      code: 'STORAGE_PATH_FORBIDDEN',
    });
  });

  test('applique une allowlist MIME extension et refuse les fichiers vides', async () => {
    const {
      getStorageUploadValidationProfile,
      validateStorageUploadPayload,
    } = await loadStorageUploads();

    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/photo.jpg',
      contentType: 'image/png',
      contentLength: 10,
    }))).toMatchObject({
      status: 400,
      code: 'INVALID_EXTENSION',
    });
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/malware.exe',
      contentType: 'application/x-msdownload',
      contentLength: 10,
    }))).toMatchObject({
      status: 415,
      code: 'UNSUPPORTED_MIME_TYPE',
    });
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/logo.png',
      contentType: 'image/svg+xml',
      contentLength: 10,
    }))).toMatchObject({
      status: 415,
      code: 'SVG_UPLOAD_UNSUPPORTED',
    });
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/logo.svg',
      contentType: 'application/octet-stream',
      contentLength: 10,
    }))).toMatchObject({
      status: 415,
      code: 'SVG_UPLOAD_UNSUPPORTED',
    });
    expect(getThrownError(() => validateStorageUploadPayload(Buffer.alloc(0), { maxBytes: 10 }))).toMatchObject({
      status: 400,
      code: 'EMPTY_FILE',
    });
  });

  test('limite la taille par type et conserve les gros modeles RPG3D configurables', async () => {
    const {
      getStorageUploadValidationProfile,
      readRawBody,
      validateStorageUploadPayload,
    } = await loadStorageUploads({
      RPG3D_UPLOAD_MAX_BYTES: '12',
    });

    const modelProfile = getStorageUploadValidationProfile({
      path: 'users/user-1/arcade-assets/characters/hero.fbx',
      contentType: 'application/octet-stream',
      contentLength: 12,
    });
    expect(modelProfile).toMatchObject({
      profile: 'model',
      maxBytes: 12,
      contentType: 'application/octet-stream',
    });
    expect(validateStorageUploadPayload(Buffer.alloc(12), modelProfile)).toBe(12);
    expect(getThrownError(() => getStorageUploadValidationProfile({
      path: 'users/user-1/arcade-assets/characters/too-big.fbx',
      contentType: 'application/octet-stream',
      contentLength: 13,
    }))).toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
    });

    await expect(readRawBody(makeRequest([Buffer.alloc(6), Buffer.alloc(7)]), 12)).rejects.toMatchObject({
      status: 413,
      code: 'FILE_TOO_LARGE',
    });
  });

  test('accepte les familles utilisees par les uploads existants', async () => {
    const { getStorageUploadValidationProfile } = await loadStorageUploads();

    expect(getStorageUploadValidationProfile({
      path: 'users/user-1/images/photo.webp',
      contentType: 'image/webp',
      contentLength: 10,
    })).toMatchObject({ profile: 'image' });
    expect(getStorageUploadValidationProfile({
      path: 'users/user-1/audio/theme.mp3',
      contentType: 'audio/mpeg',
      contentLength: 10,
    })).toMatchObject({ profile: 'audio' });
    expect(getStorageUploadValidationProfile({
      path: 'users/user-1/projects/project.json',
      contentType: 'application/json; charset=utf-8',
      contentLength: 10,
    })).toMatchObject({ profile: 'json', contentType: 'application/json' });
    expect(getStorageUploadValidationProfile({
      path: 'users/user-1/arcade-assets/objects/resources/material.mtl',
      contentType: 'text/plain',
      contentLength: 10,
    })).toMatchObject({ profile: 'text' });
    expect(getStorageUploadValidationProfile({
      path: 'users/user-1/arcade-assets/objects/floor.glb',
      contentType: 'model/gltf-binary',
      contentLength: 10,
    })).toMatchObject({ profile: 'model' });
  });
});
