import {
  getSupabaseAdminClient,
  json,
  publicAssetsBucket,
  resolveServerStorageBucket,
  verifyUser,
  withErrors,
} from './_shared.js';

const DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES = 220 * 1024 * 1024;

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
  error.code = code;
  return error;
};

const validateStoragePath = (path = '') => {
  const storagePath = String(path || '').trim().replace(/^\/+/, '');
  if (!storagePath || storagePath.includes('..') || /[\0\\]/.test(storagePath)) {
    throw makeUploadError('Chemin Supabase invalide.', 400, 'STORAGE_PATH_INVALID');
  }
  return storagePath;
};

const normalizeVisibility = (value = '') => (value === 'public' ? 'public' : 'private');

const getStorageUploadLimitBytes = () => {
  const configured = Number(process.env.STORAGE_UPLOAD_MAX_BYTES || process.env.RPG3D_UPLOAD_MAX_BYTES || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES;
};

const readEventBodyBuffer = (event) => {
  const body = event.body || '';
  const buffer = Buffer.from(body, event.isBase64Encoded ? 'base64' : 'utf8');
  if (buffer.byteLength > getStorageUploadLimitBytes()) {
    throw makeUploadError('Payload trop volumineux.', 413, 'PAYLOAD_TOO_LARGE');
  }
  if (!buffer.byteLength) throw makeUploadError('Fichier vide refuse.', 400, 'EMPTY_FILE');
  return buffer;
};

const assertUserStoragePath = (userId = '', storagePath = '') => {
  const userPrefix = buildStoragePath('users', userId);
  if (!storagePath.startsWith(`${userPrefix}/`)) {
    throw makeUploadError('Upload refuse: le chemin doit rester dans ton dossier utilisateur.', 403, 'STORAGE_PATH_FORBIDDEN');
  }
};

export const handler = (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' }, event);

  const user = await verifyUser(event);
  const params = event.queryStringParameters || {};
  const storagePath = validateStoragePath(params.path || '');
  assertUserStoragePath(user.id, storagePath);

  const visibility = normalizeVisibility(params.visibility || 'private');
  const bucket = resolveServerStorageBucket(visibility);
  const buffer = readEventBodyBuffer(event);
  const contentType = params.contentType
    || event.headers['content-type']
    || event.headers['Content-Type']
    || 'application/octet-stream';

  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.storage.from(bucket).upload(storagePath, buffer, {
    upsert: params.upsert === 'true',
    cacheControl: params.cacheControl || '3600',
    contentType,
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
