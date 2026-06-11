import { verifySupabaseUserRequest } from './auth.js';
import { sendJson } from './http.js';
import { getSupabaseAdminClient } from './supabase.js';
import {
  buildStoragePath,
  publicAssetsBucket,
  resolveServerStorageBucket,
} from './storage.js';

const DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES = 220 * 1024 * 1024;
const MB = 1024 * 1024;
const DEFAULT_IMAGE_UPLOAD_LIMIT_BYTES = 15 * MB;
const DEFAULT_AUDIO_UPLOAD_LIMIT_BYTES = 50 * MB;
const DEFAULT_JSON_UPLOAD_LIMIT_BYTES = 80 * MB;
const DEFAULT_MODEL_UPLOAD_LIMIT_BYTES = 200 * MB;
const DEFAULT_ARCHIVE_UPLOAD_LIMIT_BYTES = DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES;
const DEFAULT_TEXT_UPLOAD_LIMIT_BYTES = 5 * MB;
const MAX_STORAGE_SEGMENT_LENGTH = 120;

export const STORAGE_UPLOAD_MIME_EXTENSIONS = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/bmp': ['bmp'],
  'audio/mpeg': ['mp3', 'mpeg'],
  'audio/mp3': ['mp3'],
  'audio/wav': ['wav'],
  'audio/ogg': ['ogg'],
  'audio/webm': ['webm'],
  'audio/mp4': ['m4a', 'mp4'],
  'audio/aac': ['aac'],
  'audio/flac': ['flac'],
  'application/json': ['json'],
  'text/json': ['json'],
  'application/zip': ['zip'],
  'application/x-zip-compressed': ['zip'],
  'model/gltf-binary': ['glb'],
  'model/gltf+json': ['gltf'],
  'model/obj': ['obj'],
  'application/vnd.autodesk.fbx': ['fbx'],
  'model/vnd.fbx': ['fbx'],
  'application/octet-stream': ['glb', 'gltf', 'fbx', 'obj', 'bin', 'zip'],
  'text/plain': ['txt', 'mtl', 'obj'],
};

const STORAGE_UPLOAD_PROFILE_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'],
  audio: ['mp3', 'mpeg', 'wav', 'ogg', 'webm', 'm4a', 'mp4', 'aac', 'flac'],
  json: ['json'],
  model: ['glb', 'gltf', 'fbx', 'obj', 'bin'],
  archive: ['zip'],
  text: ['txt', 'mtl'],
};

const DISALLOWED_STORAGE_UPLOAD_MIME_TYPES = new Set(['image/svg+xml']);
const DISALLOWED_STORAGE_UPLOAD_EXTENSIONS = new Set(['svg']);

export const makeUploadError = (message, status = 400, code = 'STORAGE_UPLOAD_ERROR', details = {}) => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  Object.assign(error, details);
  return error;
};

const getStorageUploadLimitBytes = () => {
  const configured = Number(process.env.STORAGE_UPLOAD_MAX_BYTES || process.env.RPG3D_UPLOAD_MAX_BYTES || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES;
};

const getConfiguredUploadLimitBytes = (keys = [], fallbackBytes = DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES) => {
  for (const key of keys) {
    const value = Number(process.env[key] || 0);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return fallbackBytes;
};

const getPathExtension = (path = '') => {
  const filename = String(path || '').split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return '';
  return filename.slice(dotIndex + 1).toLowerCase();
};

export const normalizeStorageUploadContentType = (value = '') => (
  String(value || '').split(';')[0].trim().toLowerCase()
);

const isKnownProfileExtension = (profile, extension) => (
  STORAGE_UPLOAD_PROFILE_EXTENSIONS[profile]?.includes(extension)
);

const getStorageUploadProfile = (contentType, extension) => {
  if (contentType.startsWith('image/') || isKnownProfileExtension('image', extension)) return 'image';
  if (contentType.startsWith('audio/') || isKnownProfileExtension('audio', extension)) return 'audio';
  if (contentType === 'application/json' || contentType === 'text/json' || isKnownProfileExtension('json', extension)) return 'json';
  if (contentType === 'application/zip' || contentType === 'application/x-zip-compressed' || isKnownProfileExtension('archive', extension)) return 'archive';
  if (contentType.startsWith('model/') || contentType === 'application/vnd.autodesk.fbx' || isKnownProfileExtension('model', extension)) return 'model';
  if (contentType === 'text/plain' || isKnownProfileExtension('text', extension)) return 'text';
  return '';
};

const getStorageUploadMaxBytes = (profile) => {
  if (profile === 'image') {
    return getConfiguredUploadLimitBytes(['STORAGE_IMAGE_UPLOAD_MAX_BYTES'], DEFAULT_IMAGE_UPLOAD_LIMIT_BYTES);
  }
  if (profile === 'audio') {
    return getConfiguredUploadLimitBytes(['STORAGE_AUDIO_UPLOAD_MAX_BYTES'], DEFAULT_AUDIO_UPLOAD_LIMIT_BYTES);
  }
  if (profile === 'json') {
    return getConfiguredUploadLimitBytes(['STORAGE_JSON_UPLOAD_MAX_BYTES'], DEFAULT_JSON_UPLOAD_LIMIT_BYTES);
  }
  if (profile === 'model') {
    return getConfiguredUploadLimitBytes([
      'STORAGE_MODEL_UPLOAD_MAX_BYTES',
      'RPG3D_UPLOAD_MAX_BYTES',
      'STORAGE_UPLOAD_MAX_BYTES',
    ], DEFAULT_MODEL_UPLOAD_LIMIT_BYTES);
  }
  if (profile === 'archive') {
    return getConfiguredUploadLimitBytes([
      'STORAGE_ARCHIVE_UPLOAD_MAX_BYTES',
      'STORAGE_UPLOAD_MAX_BYTES',
    ], DEFAULT_ARCHIVE_UPLOAD_LIMIT_BYTES);
  }
  if (profile === 'text') {
    return getConfiguredUploadLimitBytes(['STORAGE_TEXT_UPLOAD_MAX_BYTES'], DEFAULT_TEXT_UPLOAD_LIMIT_BYTES);
  }
  return getStorageUploadLimitBytes();
};

export const validateStorageUploadPath = (path = '') => {
  if (typeof path !== 'string') {
    throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
  }

  const storagePath = path.trim();
  if (!storagePath || storagePath !== path || storagePath.startsWith('/') || storagePath.endsWith('/')) {
    throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
  }
  if (storagePath.includes('//') || /[\0\\]/.test(storagePath)) {
    throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
  }

  const parts = storagePath.split('/');
  for (const part of parts) {
    if (!part || part === '.' || part === '..') {
      throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
    }
    if (part.length > MAX_STORAGE_SEGMENT_LENGTH) {
      throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(part)) {
      throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
    }
  }

  return storagePath;
};

const getContentLength = (headers = {}) => {
  const rawValue = headers['content-length'];
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value == null || value === '') return null;
  const contentLength = Number(value);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw makeUploadError('Taille de fichier invalide.', 400, 'CONTENT_LENGTH_INVALID');
  }
  return contentLength;
};

export const getStorageUploadValidationProfile = ({
  path = '',
  contentType = '',
  contentLength = null,
} = {}) => {
  const storagePath = validateStorageUploadPath(path);
  const normalizedContentType = normalizeStorageUploadContentType(contentType || 'application/octet-stream');
  const extension = getPathExtension(storagePath);

  if (
    DISALLOWED_STORAGE_UPLOAD_MIME_TYPES.has(normalizedContentType)
    || DISALLOWED_STORAGE_UPLOAD_EXTENSIONS.has(extension)
  ) {
    throw makeUploadError('Upload SVG refuse: utilise PNG, JPEG, WebP ou GIF.', 415, 'SVG_UPLOAD_UNSUPPORTED');
  }

  const profile = getStorageUploadProfile(normalizedContentType, extension);

  if (!profile || !Object.prototype.hasOwnProperty.call(STORAGE_UPLOAD_MIME_EXTENSIONS, normalizedContentType)) {
    throw makeUploadError('Type de fichier non autorise.', 415, 'UNSUPPORTED_MIME_TYPE');
  }

  const allowedExtensions = STORAGE_UPLOAD_MIME_EXTENSIONS[normalizedContentType] || [];
  if (!extension || !allowedExtensions.includes(extension)) {
    throw makeUploadError('Extension de fichier incompatible.', 400, 'INVALID_EXTENSION');
  }

  const maxBytes = getStorageUploadMaxBytes(profile);
  if (contentLength === 0) {
    throw makeUploadError('Fichier vide refuse.', 400, 'EMPTY_FILE');
  }
  if (contentLength != null && contentLength > maxBytes) {
    throw makeUploadError('Fichier trop volumineux.', 413, 'FILE_TOO_LARGE', {
      maxBytes,
      sizeBytes: contentLength,
    });
  }

  return {
    path: storagePath,
    contentType: normalizedContentType,
    extension,
    profile,
    maxBytes,
  };
};

export const validateStorageUploadPayload = (buffer, validationProfile = {}) => {
  const sizeBytes = Buffer.isBuffer(buffer) ? buffer.byteLength : Number(buffer?.byteLength || 0);
  if (!sizeBytes) throw makeUploadError('Fichier vide refuse.', 400, 'EMPTY_FILE');
  const maxBytes = Number(validationProfile.maxBytes || getStorageUploadLimitBytes());
  if (sizeBytes > maxBytes) {
    throw makeUploadError('Fichier trop volumineux.', 413, 'FILE_TOO_LARGE', {
      maxBytes,
      sizeBytes,
    });
  }
  return sizeBytes;
};

export const readRawBody = (req, maxBytes = getStorageUploadLimitBytes()) => new Promise((resolve, reject) => {
  const contentLength = getContentLength(req.headers || {});
  if (contentLength != null && contentLength > maxBytes) {
    reject(makeUploadError('Fichier trop volumineux.', 413, 'FILE_TOO_LARGE', {
      maxBytes,
      sizeBytes: contentLength,
    }));
    return;
  }

  const chunks = [];
  let totalBytes = 0;
  let settled = false;

  const rejectOnce = (error) => {
    if (settled) return;
    settled = true;
    reject(error);
  };

  req.on('data', (chunk) => {
    if (settled) return;
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      chunks.length = 0;
      req.resume?.();
      rejectOnce(makeUploadError('Fichier trop volumineux.', 413, 'FILE_TOO_LARGE', {
        maxBytes,
        sizeBytes: totalBytes,
      }));
      return;
    }
    chunks.push(buffer);
  });
  req.on('end', () => {
    if (settled) return;
    settled = true;
    resolve(Buffer.concat(chunks));
  });
  req.on('error', rejectOnce);
});

const normalizeVisibility = (value = '') => (value === 'public' ? 'public' : 'private');

const isStorageObjectAlreadyExistsError = (error = {}) => {
  const status = Number(error?.statusCode || error?.status || 0);
  const details = [
    error?.message,
    error?.error,
    error?.name,
    error?.code,
    error?.statusCode,
    error?.status,
  ].filter(Boolean).join(' ');
  return status === 409 || /already exists|resource already exists|duplicate/i.test(details);
};

const getPublicUploadUrl = (client, bucket, storagePath, visibility) => (
  visibility === 'public' && bucket === publicAssetsBucket
    ? client.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    : null
);

export const assertUserStoragePath = (userId = '', storagePath = '') => {
  const userPrefix = buildStoragePath('users', userId);
  if (!storagePath.startsWith(`${userPrefix}/`)) {
    throw makeUploadError('Upload refuse: le chemin doit rester dans ton dossier utilisateur.', 403, 'STORAGE_PATH_FORBIDDEN');
  }
};

export const handleStorageUpload = async (req, res) => {
  const user = await verifySupabaseUserRequest(req);
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const storagePath = validateStorageUploadPath(requestUrl.searchParams.get('path') || '');
  assertUserStoragePath(user.id, storagePath);

  const visibility = normalizeVisibility(requestUrl.searchParams.get('visibility') || 'private');
  const bucket = resolveServerStorageBucket(visibility);
  const allowExistingObject = requestUrl.searchParams.get('allowExistingObject') === 'true';
  const upsert = requestUrl.searchParams.get('upsert') === 'true';
  const cacheControl = requestUrl.searchParams.get('cacheControl') || '3600';
  const requestedContentType = requestUrl.searchParams.get('contentType')
    || req.headers['content-type']
    || 'application/octet-stream';
  const validationProfile = getStorageUploadValidationProfile({
    path: storagePath,
    contentType: requestedContentType,
    contentLength: getContentLength(req.headers || {}),
  });
  const buffer = await readRawBody(req, validationProfile.maxBytes);
  validateStorageUploadPayload(buffer, validationProfile);

  const client = getSupabaseAdminClient();
  if (!client) throw makeUploadError('Configuration Supabase admin manquante.', 500, 'SUPABASE_ADMIN_MISSING');

  const { error } = await client.storage.from(bucket).upload(storagePath, buffer, {
    upsert,
    cacheControl,
    contentType: validationProfile.contentType,
  });
  if (error) {
    if (allowExistingObject && !upsert && visibility === 'public' && isStorageObjectAlreadyExistsError(error)) {
      sendJson(res, 200, {
        bucket,
        path: storagePath,
        visibility,
        publicUrl: getPublicUploadUrl(client, bucket, storagePath, visibility),
      });
      return;
    }
    throw error;
  }

  const publicUrl = getPublicUploadUrl(client, bucket, storagePath, visibility);

  sendJson(res, 200, {
    bucket,
    path: storagePath,
    visibility,
    publicUrl,
  });
};
