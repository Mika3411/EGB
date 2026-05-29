import {
  getSupabaseAdminClient,
  json,
  publicAssetsBucket,
  resolveServerStorageBucket,
  verifyUser,
  withErrors,
} from './_shared.js';

const DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES = 220 * 1024 * 1024;
const MB = 1024 * 1024;
const DEFAULT_IMAGE_UPLOAD_LIMIT_BYTES = 15 * MB;
const DEFAULT_AUDIO_UPLOAD_LIMIT_BYTES = 50 * MB;
const DEFAULT_JSON_UPLOAD_LIMIT_BYTES = 80 * MB;
const DEFAULT_MODEL_UPLOAD_LIMIT_BYTES = 200 * MB;
const DEFAULT_TEXT_UPLOAD_LIMIT_BYTES = 5 * MB;
const MAX_STORAGE_SEGMENT_LENGTH = 120;

export const STORAGE_UPLOAD_MIME_EXTENSIONS = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
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
  'model/gltf-binary': ['glb'],
  'model/gltf+json': ['gltf'],
  'model/obj': ['obj'],
  'application/vnd.autodesk.fbx': ['fbx'],
  'model/vnd.fbx': ['fbx'],
  'application/octet-stream': ['glb', 'gltf', 'fbx', 'obj', 'bin'],
  'text/plain': ['txt', 'mtl', 'obj'],
};

const STORAGE_UPLOAD_PROFILE_EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'bmp'],
  audio: ['mp3', 'mpeg', 'wav', 'ogg', 'webm', 'm4a', 'mp4', 'aac', 'flac'],
  json: ['json'],
  model: ['glb', 'gltf', 'fbx', 'obj', 'bin'],
  text: ['txt', 'mtl'],
};

const sanitizeStorageSegment = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'asset';

const buildStoragePath = (...segments) => segments
  .filter(Boolean)
  .map((segment) => sanitizeStorageSegment(segment))
  .join('/');

const makeUploadError = (message, statusCode = 400, code = 'STORAGE_UPLOAD_ERROR') => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = statusCode;
  error.code = code;
  return error;
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

const normalizeVisibility = (value = '') => (value === 'public' ? 'public' : 'private');

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

const getHeader = (headers = {}, name = '') => {
  const target = String(name || '').toLowerCase();
  const match = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  return match?.[1] || '';
};

const getContentLength = (headers = {}) => {
  const rawValue = getHeader(headers, 'content-length');
  const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;
  if (value == null || value === '') return null;
  const contentLength = Number(value);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw makeUploadError('Taille de fichier invalide.', 400, 'CONTENT_LENGTH_INVALID');
  }
  return contentLength;
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
  if (profile === 'text') {
    return getConfiguredUploadLimitBytes(['STORAGE_TEXT_UPLOAD_MAX_BYTES'], DEFAULT_TEXT_UPLOAD_LIMIT_BYTES);
  }
  return getStorageUploadLimitBytes();
};

export const getStorageUploadValidationProfile = ({
  path = '',
  contentType = '',
  contentLength = null,
} = {}) => {
  const storagePath = validateStorageUploadPath(path);
  const normalizedContentType = normalizeStorageUploadContentType(contentType || 'application/octet-stream');
  const extension = getPathExtension(storagePath);
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
    const error = makeUploadError('Fichier trop volumineux.', 413, 'FILE_TOO_LARGE');
    error.maxBytes = maxBytes;
    error.sizeBytes = contentLength;
    throw error;
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
    const error = makeUploadError('Fichier trop volumineux.', 413, 'FILE_TOO_LARGE');
    error.maxBytes = maxBytes;
    error.sizeBytes = sizeBytes;
    throw error;
  }
  return sizeBytes;
};

const readEventBodyBuffer = (event, validationProfile) => {
  const body = event.body || '';
  const buffer = Buffer.from(body, event.isBase64Encoded ? 'base64' : 'utf8');
  validateStorageUploadPayload(buffer, validationProfile);
  return buffer;
};

export const assertUserStoragePath = (userId = '', storagePath = '') => {
  const userPrefix = buildStoragePath('users', userId);
  if (!storagePath.startsWith(`${userPrefix}/`)) {
    throw makeUploadError('Upload refuse: le chemin doit rester dans ton dossier utilisateur.', 403, 'STORAGE_PATH_FORBIDDEN');
  }
};

export const handler = (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' }, event);

  const user = await verifyUser(event);
  const params = event.queryStringParameters || {};
  const storagePath = validateStorageUploadPath(params.path || '');
  assertUserStoragePath(user.id, storagePath);

  const visibility = normalizeVisibility(params.visibility || 'private');
  const bucket = resolveServerStorageBucket(visibility);
  const requestedContentType = params.contentType
    || getHeader(event.headers || {}, 'content-type')
    || 'application/octet-stream';
  const validationProfile = getStorageUploadValidationProfile({
    path: storagePath,
    contentType: requestedContentType,
    contentLength: getContentLength(event.headers || {}),
  });
  const buffer = readEventBodyBuffer(event, validationProfile);

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    upsert: params.upsert === 'true',
    cacheControl: params.cacheControl || '3600',
    contentType: validationProfile.contentType,
  });
  if (error) throw error;

  const publicUrl = visibility === 'public' && bucket === publicAssetsBucket
    ? supabase.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    : null;

  return json(200, {
    bucket,
    path: storagePath,
    visibility,
    publicUrl,
  }, event);
});
