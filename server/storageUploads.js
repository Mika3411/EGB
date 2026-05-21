import { verifySupabaseUserRequest } from './auth.js';
import { sendJson } from './http.js';
import { getSupabaseAdminClient } from './supabase.js';
import {
  buildStoragePath,
  publicAssetsBucket,
  resolveServerStorageBucket,
  validateStoragePath,
} from './storage.js';

const DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES = 220 * 1024 * 1024;

const makeUploadError = (message, status = 400, code = 'STORAGE_UPLOAD_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

const getStorageUploadLimitBytes = () => {
  const configured = Number(process.env.STORAGE_UPLOAD_MAX_BYTES || process.env.RPG3D_UPLOAD_MAX_BYTES || 0);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_STORAGE_UPLOAD_LIMIT_BYTES;
};

const readRawBody = (req, maxBytes = getStorageUploadLimitBytes()) => new Promise((resolve, reject) => {
  const contentLength = Number(req.headers['content-length'] || 0);
  if (contentLength > maxBytes) {
    reject(makeUploadError('Payload trop volumineux.', 413, 'PAYLOAD_TOO_LARGE'));
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
      rejectOnce(makeUploadError('Payload trop volumineux.', 413, 'PAYLOAD_TOO_LARGE'));
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

const assertUserStoragePath = (userId = '', storagePath = '') => {
  const userPrefix = buildStoragePath('users', userId);
  if (!storagePath.startsWith(`${userPrefix}/`)) {
    throw makeUploadError('Upload refuse: le chemin doit rester dans ton dossier utilisateur.', 403, 'STORAGE_PATH_FORBIDDEN');
  }
};

export const handleStorageUpload = async (req, res) => {
  const user = await verifySupabaseUserRequest(req);
  const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const storagePath = validateStoragePath(requestUrl.searchParams.get('path') || '');
  assertUserStoragePath(user.id, storagePath);

  const visibility = normalizeVisibility(requestUrl.searchParams.get('visibility') || 'private');
  const bucket = resolveServerStorageBucket(visibility);
  const upsert = requestUrl.searchParams.get('upsert') === 'true';
  const cacheControl = requestUrl.searchParams.get('cacheControl') || '3600';
  const contentType = requestUrl.searchParams.get('contentType')
    || req.headers['content-type']
    || 'application/octet-stream';
  const buffer = await readRawBody(req);
  if (!buffer.byteLength) throw makeUploadError('Fichier vide refuse.', 400, 'EMPTY_FILE');

  const client = getSupabaseAdminClient();
  if (!client) throw makeUploadError('Configuration Supabase admin manquante.', 500, 'SUPABASE_ADMIN_MISSING');

  const { error } = await client.storage.from(bucket).upload(storagePath, buffer, {
    upsert,
    cacheControl,
    contentType,
  });
  if (error) throw error;

  const publicUrl = visibility === 'public' && bucket === publicAssetsBucket
    ? client.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    : null;

  sendJson(res, 200, {
    bucket,
    path: storagePath,
    visibility,
    publicUrl,
  });
};
