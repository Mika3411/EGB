import './config.js';
import { getSupabaseAdminClient } from './supabase.js';
import {
  createMissingStorageBucketError,
  getServerStorageBuckets,
  LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE,
  warnLegacyStorageBucketFallback,
} from './storageBuckets.js';

const storageBuckets = getServerStorageBuckets();

export { LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE, warnLegacyStorageBucketFallback };
export const legacyStorageBucket = storageBuckets.legacyStorageBucket;
export const publicAssetsBucket = storageBuckets.publicAssetsBucket;
export const privateDataBucket = storageBuckets.privateDataBucket;
export const usesLegacyStorageBucketFallback = storageBuckets.usesLegacyStorageBucketFallback;
export const resolveServerStorageBucket = (visibility = 'private') => {
  const bucket = visibility === 'public' ? publicAssetsBucket : privateDataBucket;
  if (!bucket) throw createMissingStorageBucketError();
  return bucket;
};

export const sanitizeStorageSegment = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';

export const buildStoragePath = (...segments) => segments
  .filter(Boolean)
  .map((segment) => sanitizeStorageSegment(segment))
  .join('/');

export const validateStoragePath = (path = '') => {
  const storagePath = String(path || '').trim().replace(/^\/+/, '');
  if (!storagePath || storagePath.includes('..') || /[\0\\]/.test(storagePath)) {
    const error = new Error('Chemin Supabase invalide.');
    error.status = 400;
    throw error;
  }
  return storagePath;
};

export const isStorageNotFoundError = (error) => {
  const status = Number(error?.statusCode || error?.status || 0);
  const code = String(error?.code || error?.statusCode || '').toLowerCase();
  return status === 404 || code === '404' || code === 'not_found' || code === 'not-found';
};

export const downloadStorageJson = async (path, fallback, options = {}) => {
  const client = getSupabaseAdminClient();
  if (!client) return fallback;

  const bucket = options.bucket || resolveServerStorageBucket(options.visibility);
  const { data, error } = await client.storage.from(bucket).download(path);
  if (error) {
    if (isStorageNotFoundError(error)) return fallback;
    throw error;
  }

  const text = await data.text();
  try {
    const parsed = JSON.parse(text);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
};

export const uploadStorageJson = async (path, value, options = {}) => {
  const client = getSupabaseAdminClient();
  if (!client) {
    const error = new Error('Configuration Supabase manquante.');
    error.status = 500;
    throw error;
  }

  const buffer = Buffer.from(JSON.stringify(value, null, 2), 'utf8');
  const bucket = options.bucket || resolveServerStorageBucket(options.visibility);
  const { error } = await client.storage.from(bucket).upload(path, buffer, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '0',
  });
  if (error) throw error;
  return value;
};

export const createStorageSignedUrl = async (path, options = {}) => {
  const client = getSupabaseAdminClient();
  if (!client) {
    const error = new Error('Configuration Supabase manquante.');
    error.status = 500;
    throw error;
  }

  const storagePath = validateStoragePath(path);
  const expiresIn = Math.max(60, Math.round(Number(options.expiresIn || 3600)));
  const buckets = [...new Set((options.buckets || [options.bucket || resolveServerStorageBucket(options.visibility)])
    .map((bucket) => String(bucket || '').trim())
    .filter(Boolean))];
  let lastError = null;

  for (const bucket of buckets) {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(storagePath, expiresIn);
    if (!error && data?.signedUrl) return data.signedUrl;
    lastError = error || lastError;
  }

  if (lastError) throw lastError;
  const error = new Error('Fichier telechargeable introuvable.');
  error.status = 404;
  throw error;
};
