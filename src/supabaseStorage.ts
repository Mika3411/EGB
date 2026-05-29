/// <reference types="vite/client" />

import { createClient } from '@supabase/supabase-js';

export type StorageVisibility = 'public' | 'private';

export type StorageErrorCode =
  | 'aborted'
  | 'bucket-not-found'
  | 'empty-file'
  | 'file-too-large'
  | 'invalid-extension'
  | 'invalid-file'
  | 'network'
  | 'not-found'
  | 'offline'
  | 'permission-denied'
  | 'quota-exceeded'
  | 'storage-error'
  | 'timeout'
  | 'unsupported-mime-type'
  | 'validation-error';

export interface StorageErrorDetails {
  action?: string;
  bucket?: string;
  path?: string;
  cause?: unknown;
  code?: StorageErrorCode;
}

export interface UploadResult {
  bucket: string;
  path: string;
  visibility: StorageVisibility;
  publicUrl: string | null;
}

export interface UploadOptions {
  upsert?: boolean;
  cacheControl?: string;
  contentType?: string;
  visibility?: StorageVisibility;
  retries?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  maxFileSize?: number;
  allowMimeTypes?: string[] | null;
}

export interface DownloadTextFileOptions {
  visibility?: StorageVisibility;
  bucket?: string;
}

export interface DeleteStorageFileOptions {
  visibility?: StorageVisibility;
  bucket?: string;
}

export interface GenerateStorageFilenameOptions {
  suffix?: 'timestamp' | 'uuid' | 'both' | 'none';
  timestamp?: boolean;
  uuid?: boolean;
  timestampValue?: number | string;
  uuidValue?: string;
  separator?: string;
}

type UploadFile = Blob | File;
type SupabaseClientInstance = ReturnType<typeof createClient>;
type StorageDebugLevel = 'info' | 'warn';
type StorageDebugEvent =
  | 'upload:start'
  | 'upload:success'
  | 'upload:failure'
  | 'upload:proxy-start'
  | 'upload:proxy-success'
  | 'upload:proxy-failure'
  | 'download:start'
  | 'download:success'
  | 'download:failure'
  | 'delete:start'
  | 'delete:success'
  | 'delete:failure';

interface StorageDebugMetadata {
  action?: string;
  bucket?: string;
  path?: string;
  visibility?: StorageVisibility;
  attempt?: number;
  durationMs?: number;
  size?: number;
  code?: StorageErrorCode | 'validation-error';
}

interface StorageErrorMessageInput {
  action?: string;
  bucket?: string;
  path?: string;
  cause?: unknown;
}

interface StorageErrorMessageDetails {
  code: StorageErrorCode;
  message: string;
}

interface UploadValidationProfile {
  maxFileSize: number;
  allowMimeTypes: string[] | null;
}

interface UploadValidationOptions {
  contentType?: string;
  maxFileSize?: number;
  allowMimeTypes?: string[] | null;
}

interface TimeoutOptions {
  timeoutMs: number;
  signal?: AbortSignal;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_BROWSER_KEY = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;

const readClientEnv = (key: string): string => String(import.meta.env[key] || '').trim();
const EXPLICIT_PUBLIC_ASSETS_BUCKET = readClientEnv('VITE_SUPABASE_PUBLIC_ASSETS_BUCKET');
const EXPLICIT_PRIVATE_DATA_BUCKET = readClientEnv('VITE_SUPABASE_PRIVATE_DATA_BUCKET');

// Deprecated fallback kept temporarily for older deployments. Prefer the
// explicit public/private bucket env vars below.
export const STORAGE_BUCKET = readClientEnv('VITE_SUPABASE_STORAGE_BUCKET');
export const PUBLIC_ASSETS_BUCKET = EXPLICIT_PUBLIC_ASSETS_BUCKET || STORAGE_BUCKET;
export const PRIVATE_DATA_BUCKET = EXPLICIT_PRIVATE_DATA_BUCKET || STORAGE_BUCKET;
export const LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE = 'VITE_SUPABASE_STORAGE_BUCKET is deprecated and only kept as a legacy fallback. Configure VITE_SUPABASE_PUBLIC_ASSETS_BUCKET and VITE_SUPABASE_PRIVATE_DATA_BUCKET.';
export const usesLegacyStorageBucketFallback = Boolean(
  STORAGE_BUCKET && (!EXPLICIT_PUBLIC_ASSETS_BUCKET || !EXPLICIT_PRIVATE_DATA_BUCKET),
);

let supabaseClient: SupabaseClientInstance | null = null;
let storageDebugEnabled = /^(1|true|yes|debug)$/i.test(String(import.meta.env.VITE_SUPABASE_STORAGE_DEBUG || ''));
let didWarnLegacyStorageBucketFallback = false;

export function setSupabaseStorageDebug(enabled: boolean): void {
  storageDebugEnabled = Boolean(enabled);
}

export function isSupabaseStorageDebugEnabled(): boolean {
  return storageDebugEnabled;
}

export function warnLegacyStorageBucketFallback(): boolean {
  if (!usesLegacyStorageBucketFallback || didWarnLegacyStorageBucketFallback || typeof console === 'undefined') {
    return false;
  }

  didWarnLegacyStorageBucketFallback = true;
  console.warn('[supabase-storage]', LEGACY_STORAGE_BUCKET_DEPRECATION_MESSAGE);
  return true;
}

export function hasSupabaseAuthConfig(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_BROWSER_KEY);
}

export function hasSupabaseStorageConfig(): boolean {
  return Boolean(hasSupabaseAuthConfig() && PUBLIC_ASSETS_BUCKET && PRIVATE_DATA_BUCKET);
}

export function hasSupabaseConfig(): boolean {
  return hasSupabaseAuthConfig();
}

export function getSupabaseClient(): SupabaseClientInstance {
  if (!hasSupabaseAuthConfig()) {
    throw new Error(
      'Configuration Supabase manquante. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY).',
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_BROWSER_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseClient;
}

export class StorageError extends Error {
  action?: string;
  bucket?: string;
  path?: string;
  code?: StorageErrorCode;

  constructor(message: string, { action, bucket, path, cause, code }: StorageErrorDetails = {}) {
    super(message, { cause });
    this.name = 'StorageError';
    this.action = action;
    this.bucket = bucket;
    this.path = path;
    this.code = code;
  }
}

export function isStorageNotFoundError(error: unknown): boolean {
  return error instanceof StorageError && error.code === 'not-found';
}

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const getCauseValue = (cause: unknown, key: string): unknown => (
  isRecord(cause) ? cause[key] : undefined
);

const getCauseString = (cause: unknown, key: string): string => {
  const value = getCauseValue(cause, key);
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

const getCauseText = (cause: unknown): string => [
  getCauseString(cause, 'message'),
  getCauseString(cause, 'error'),
  getCauseString(cause, 'name'),
  getCauseString(cause, 'statusCode'),
  getCauseString(cause, 'status'),
].filter(Boolean).join(' ');

const getCauseStatus = (cause: unknown): number => Number(
  getCauseString(cause, 'statusCode') || getCauseString(cause, 'status') || 0,
);

const getCauseName = (cause: unknown): string => getCauseString(cause, 'name');

const getStorageErrorCode = (error: unknown, fallback: StorageErrorCode): StorageErrorCode => (
  error instanceof StorageError && error.code ? error.code : fallback
);

const getStorageErrorDetails = ({ action = 'operation', bucket = PRIVATE_DATA_BUCKET, path, cause }: StorageErrorMessageInput): StorageErrorMessageDetails => {
  const causeText = getCauseText(cause);
  const status = getCauseStatus(cause);
  const target = path ? ` "${path}"` : '';

  if (getCauseName(cause) === 'AbortError' || /aborted|abort/i.test(causeText)) {
    return {
      code: 'aborted',
      message: `Operation annulee pendant ${action}${target}.`,
    };
  }

  if (getCauseName(cause) === 'StorageTimeoutError' || /timeout|timed out|delai/i.test(causeText)) {
    return {
      code: 'timeout',
      message: `Délai dépassé pendant ${action}${target}. Réessaie dans un instant.`,
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      code: 'offline',
      message: `Connexion internet indisponible pendant ${action}${target}.`,
    };
  }

  if (/bucket.*not found|bucket not found|no such bucket/i.test(causeText)) {
    return {
      code: 'bucket-not-found',
      message: `Bucket Supabase introuvable pour ${action}${target}. Vérifie le bucket "${bucket}".`,
    };
  }

  if (status === 401 || status === 403 || /permission|forbidden|not authorized|unauthorized|row-level security|policy/i.test(causeText)) {
    return {
      code: 'permission-denied',
      message: `Permission refusée pour ${action}${target}. Vérifie les policies Supabase Storage.`,
    };
  }

  if (status === 413 || /payload too large|file too large|entity too large|maximum file size|taille.*max/i.test(causeText)) {
    return {
      code: 'file-too-large',
      message: `Fichier trop gros pour ${action}${target}. Réduis la taille du fichier.`,
    };
  }

  if (status === 402 || status === 429 || /quota|storage limit|rate limit|too many requests|insufficient storage/i.test(causeText)) {
    return {
      code: 'quota-exceeded',
      message: `Quota Supabase atteint pendant ${action}${target}. Libère de l'espace ou réessaie plus tard.`,
    };
  }

  if (status === 404 || /not found|object not found|resource not found|does not exist/i.test(causeText)) {
    return {
      code: 'not-found',
      message: `Fichier introuvable pour ${action}${target}.`,
    };
  }

  if (/failed to fetch|network|load failed|fetch failed|internet|offline/i.test(causeText)) {
    return {
      code: 'network',
      message: `Réseau indisponible pendant ${action}${target}. Vérifie la connexion internet.`,
    };
  }

  return {
    code: 'storage-error',
    message: `Erreur Supabase Storage pendant ${action}${target}.`,
  };
};

export function createStorageError({ action, bucket = PRIVATE_DATA_BUCKET, path, cause }: StorageErrorDetails): StorageError {
  const details = getStorageErrorDetails({ action, bucket, path, cause });
  return new StorageError(details.message, {
    action,
    bucket,
    path,
    cause,
    code: details.code,
  });
}

export const resolveStorageBucket = (visibility: StorageVisibility): string => {
  warnLegacyStorageBucketFallback();
  return visibility === 'public' ? PUBLIC_ASSETS_BUCKET : PRIVATE_DATA_BUCKET;
};

const assertSupabaseStorageConfig = (): void => {
  if (hasSupabaseStorageConfig()) {
    warnLegacyStorageBucketFallback();
    return;
  }
  throw new Error(
    'Configuration Supabase Storage manquante. Ajoute VITE_SUPABASE_PUBLIC_ASSETS_BUCKET et VITE_SUPABASE_PRIVATE_DATA_BUCKET, ou garde VITE_SUPABASE_STORAGE_BUCKET en fallback.',
  );
};

const normalizeStorageVisibility = (visibility?: StorageVisibility): StorageVisibility => (
  visibility === 'public' ? 'public' : 'private'
);

const RETRYABLE_UPLOAD_ERROR_CODES = new Set<StorageErrorCode>(['network']);
const PROXYABLE_UPLOAD_ERROR_CODES = new Set<StorageErrorCode>(['network', 'permission-denied', 'storage-error']);
const DEFAULT_UPLOAD_TIMEOUT_MS = 45000;
const DEFAULT_UPLOAD_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 700;
const MB = 1024 * 1024;

const getNow = (): number => (
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now()
);

const getRoundedDuration = (startedAt: number): number => Math.round((getNow() - startedAt) * 10) / 10;

const getRedactedPath = (path = ''): string => {
  const parts = String(path || '').split('/').filter(Boolean);
  const filename = parts.at(-1) || '';
  const extension = getPathExtension(filename);
  const fileToken = extension ? `*.${extension}` : '*';

  if (!parts.length) return '';
  if (parts[0] === 'users') return `users/{user}/.../${fileToken}`;
  if (parts.length === 1) return fileToken;
  return `${parts[0]}/.../${fileToken}`;
};

const logStorageDebug = (event: StorageDebugEvent, metadata: StorageDebugMetadata = {}, level: StorageDebugLevel = 'info'): void => {
  if (!storageDebugEnabled || typeof console === 'undefined') return;

  const safeMetadata: Record<string, string | number | undefined> = {
    scope: 'supabase-storage',
    event,
    action: metadata.action,
    bucket: metadata.bucket,
    path: metadata.path ? getRedactedPath(metadata.path) : undefined,
    visibility: metadata.visibility,
    attempt: metadata.attempt,
    durationMs: metadata.durationMs,
    size: metadata.size,
    code: metadata.code,
  };

  const logger = level === 'warn' ? console.warn : console.info;
  logger('[supabase-storage]', safeMetadata);
};

const DEFAULT_UPLOAD_VALIDATION: Record<'image' | 'audio' | 'json' | 'default', UploadValidationProfile> = {
  image: {
    maxFileSize: 10 * MB,
    allowMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'],
  },
  audio: {
    maxFileSize: 50 * MB,
    allowMimeTypes: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/aac', 'audio/flac'],
  },
  json: {
    maxFileSize: 5 * MB,
    allowMimeTypes: ['application/json', 'text/json'],
  },
  default: {
    maxFileSize: 25 * MB,
    allowMimeTypes: null,
  },
};

const MIME_EXTENSION_MAP: Record<string, string[]> = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/png': ['png'],
  'image/webp': ['webp'],
  'image/gif': ['gif'],
  'image/svg+xml': ['svg'],
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
};

const createStorageValidationError = ({ action, bucket = PRIVATE_DATA_BUCKET, path, code, message }: StorageErrorDetails & { message: string }) => (
  new StorageError(message, { action, bucket, path, code })
);

const formatFileSize = (bytes: number): string => {
  if (bytes >= MB) return `${Math.round((bytes / MB) * 10) / 10} Mo`;
  if (bytes >= 1024) return `${Math.round(bytes / 102.4) / 10} Ko`;
  return `${bytes} octets`;
};

const getPathExtension = (path = ''): string => {
  const filename = String(path).split('/').pop() || '';
  const dotIndex = filename.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === filename.length - 1) return '';
  return filename.slice(dotIndex + 1).toLowerCase();
};

const normalizeMimeType = (value = ''): string => String(value || '').split(';')[0].trim().toLowerCase();

const getValidationProfile = (mimeType: string, extension: string): UploadValidationProfile => {
  if (mimeType.startsWith('image/')) return DEFAULT_UPLOAD_VALIDATION.image;
  if (mimeType.startsWith('audio/')) return DEFAULT_UPLOAD_VALIDATION.audio;
  if (mimeType === 'application/json' || mimeType === 'text/json' || extension === 'json') {
    return DEFAULT_UPLOAD_VALIDATION.json;
  }
  return DEFAULT_UPLOAD_VALIDATION.default;
};

const isMimeAllowed = (mimeType: string, allowedMimeTypes: string[] = []): boolean => allowedMimeTypes.some((allowedMimeType) => {
  const normalizedAllowed = normalizeMimeType(allowedMimeType);
  if (normalizedAllowed.endsWith('/*')) {
    return mimeType.startsWith(normalizedAllowed.slice(0, -1));
  }
  return mimeType === normalizedAllowed;
});

const getAllowedExtensionsForMimeTypes = (mimeTypes: string[] = [], mimeType = ''): string[] => {
  const directExtensions = MIME_EXTENSION_MAP[mimeType] || [];
  if (directExtensions.length) return directExtensions;

  return mimeTypes.flatMap((allowedMimeType) => {
    const normalizedAllowed = normalizeMimeType(allowedMimeType);
    if (normalizedAllowed.endsWith('/*')) {
      const prefix = normalizedAllowed.slice(0, -1);
      return Object.entries(MIME_EXTENSION_MAP)
        .filter(([mappedMimeType]) => mappedMimeType.startsWith(prefix))
        .flatMap(([, extensions]) => extensions);
    }
    return MIME_EXTENSION_MAP[normalizedAllowed] || [];
  });
};

const validateUploadFile = (path: string, file: UploadFile, { contentType, maxFileSize, allowMimeTypes }: UploadValidationOptions = {}): void => {
  const action = 'validation du fichier';
  const size = Number(file?.size);
  const mimeType = normalizeMimeType(contentType || file?.type || '');
  const extension = getPathExtension(path);
  const profile = getValidationProfile(mimeType, extension);
  const effectiveMaxFileSize = Number(maxFileSize || profile.maxFileSize);
  const effectiveAllowedMimeTypes = allowMimeTypes ?? profile.allowMimeTypes;

  if (!file || !Number.isFinite(size)) {
    throw createStorageValidationError({
      action,
      path,
      code: 'invalid-file',
      message: `Fichier invalide pour upload "${path}".`,
    });
  }

  if (size <= 0) {
    throw createStorageValidationError({
      action,
      path,
      code: 'empty-file',
      message: `Fichier vide refusé pour upload "${path}".`,
    });
  }

  if (effectiveMaxFileSize > 0 && size > effectiveMaxFileSize) {
    throw createStorageValidationError({
      action,
      path,
      code: 'file-too-large',
      message: `Fichier trop gros pour upload "${path}" : ${formatFileSize(size)}. Taille maximale : ${formatFileSize(effectiveMaxFileSize)}.`,
    });
  }

  if (Array.isArray(effectiveAllowedMimeTypes) && effectiveAllowedMimeTypes.length) {
    if (!mimeType || !isMimeAllowed(mimeType, effectiveAllowedMimeTypes)) {
      throw createStorageValidationError({
        action,
        path,
        code: 'unsupported-mime-type',
      message: `Type de fichier non autorisé pour upload "${path}" : ${mimeType || 'type inconnu'}.`,
      });
    }
  }

  const allowedExtensions = getAllowedExtensionsForMimeTypes(effectiveAllowedMimeTypes || [], mimeType);
  if (allowedExtensions.length && (!extension || !allowedExtensions.includes(extension))) {
    throw createStorageValidationError({
      action,
      path,
      code: 'invalid-extension',
      message: `Extension de fichier incompatible pour upload "${path}". Extension attendue : ${allowedExtensions.join(', ')}.`,
    });
  }
};

const createTimeoutError = (timeoutMs: number): Error => {
    const error = new Error(`Délai dépassé après ${timeoutMs} ms.`);
  error.name = 'StorageTimeoutError';
  return error;
};

const createAbortError = (): Error | DOMException => {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('Operation annulee.', 'AbortError');
  }

  const error = new Error('Operation annulee.');
  error.name = 'AbortError';
  return error;
};

const waitForRetry = (delayMs: number, signal?: AbortSignal): Promise<void> => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason || createAbortError());
    return;
  }

  const timer = setTimeout(resolve, delayMs);
  const abortRetry = () => {
    clearTimeout(timer);
    reject(signal?.reason || createAbortError());
  };

  signal?.addEventListener('abort', abortRetry, { once: true });
});

const withTimeout = <T>(promise: PromiseLike<T>, { timeoutMs, signal }: TimeoutOptions): Promise<T> => new Promise((resolve, reject) => {
  if (signal?.aborted) {
    reject(signal.reason || createAbortError());
    return;
  }

  let timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  const cleanup = () => {
    if (timeoutTimer) clearTimeout(timeoutTimer);
    signal?.removeEventListener('abort', abortUpload);
  };
  const abortUpload = () => {
    cleanup();
    reject(signal?.reason || createAbortError());
  };

  if (timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      cleanup();
      reject(createTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  signal?.addEventListener('abort', abortUpload, { once: true });

  promise.then(
    (value) => {
      cleanup();
      resolve(value);
    },
    (error) => {
      cleanup();
      reject(error);
    },
  );
});

const shouldRetryUploadError = (error: unknown): boolean => (
  error instanceof StorageError
  && error.code !== undefined
  && RETRYABLE_UPLOAD_ERROR_CODES.has(error.code)
  && !(typeof navigator !== 'undefined' && navigator.onLine === false)
);

const shouldProxyUploadError = (error: unknown): boolean => (
  error instanceof StorageError
  && error.code !== undefined
  && PROXYABLE_UPLOAD_ERROR_CODES.has(error.code)
);

const getCurrentSupabaseAccessToken = async (): Promise<string> => {
  try {
    const client = getSupabaseClient();
    const { data } = await client.auth.getSession();
    return data.session?.access_token || '';
  } catch {
    return '';
  }
};

const parseJsonResponse = async (response: Response): Promise<Record<string, unknown>> => {
  try {
    const payload = await response.json();
    return payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  } catch {
    return {};
  }
};

const uploadToStorageViaServer = async (
  path: string,
  file: UploadFile,
  {
    upsert,
    cacheControl,
    contentType,
    visibility,
    signal,
  }: Required<Pick<UploadOptions, 'upsert' | 'cacheControl' | 'visibility'>> & Pick<UploadOptions, 'contentType' | 'signal'>,
): Promise<UploadResult | null> => {
  if (typeof window === 'undefined' || typeof fetch !== 'function') return null;
  if (!path.startsWith('users/')) return null;

  const accessToken = await getCurrentSupabaseAccessToken();
  if (!accessToken) return null;

  const params = new URLSearchParams({
    path,
    visibility,
    upsert: String(Boolean(upsert)),
    cacheControl,
    contentType: contentType || file?.type || 'application/octet-stream',
  });
  const response = await fetch(`/api/storage-upload?${params.toString()}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': contentType || file?.type || 'application/octet-stream',
    },
    body: file,
    signal,
  });

  const payload = await parseJsonResponse(response);
  if (!response.ok) {
    throw createStorageError({
      action: 'upload proxy du fichier',
      bucket: typeof payload.bucket === 'string' ? payload.bucket : resolveStorageBucket(visibility),
      path,
      cause: {
        message: typeof payload.error === 'string' ? payload.error : response.statusText,
        code: payload.code,
        status: response.status,
      },
    });
  }

  return {
    bucket: String(payload.bucket || resolveStorageBucket(visibility)),
    path: String(payload.path || path),
    visibility,
    publicUrl: typeof payload.publicUrl === 'string' ? payload.publicUrl : null,
  };
};

const FORBIDDEN_STORAGE_SEGMENTS = new Set(['.', '..', '/', '\\']);
const MAX_STORAGE_SEGMENT_LENGTH = 120;

const createShortUuid = (): string => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  return Math.random().toString(36).slice(2, 14);
};

const sanitizeSegment = (value: unknown = ''): string => {
  const rawSegment = String(value).trim();

  if (!rawSegment || FORBIDDEN_STORAGE_SEGMENTS.has(rawSegment)) {
    throw new Error(`Segment de chemin Supabase invalide : "${rawSegment || '(vide)'}".`);
  }

  const sanitizedSegment = rawSegment
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, MAX_STORAGE_SEGMENT_LENGTH)
    .replace(/^-+|-+$/g, '');

  if (!sanitizedSegment || FORBIDDEN_STORAGE_SEGMENTS.has(sanitizedSegment)) {
    throw new Error(`Segment de chemin Supabase invalide après nettoyage : "${rawSegment}".`);
  }

  return sanitizedSegment;
};

export function generateStorageFilename(filename = 'asset', options: GenerateStorageFilenameOptions = {}): string {
  const suffixMode = options.suffix ?? 'both';
  const useTimestamp = options.timestamp ?? (suffixMode === 'timestamp' || suffixMode === 'both');
  const useUuid = options.uuid ?? (suffixMode === 'uuid' || suffixMode === 'both');
  const separator = options.separator || '-';
  const rawFilename = String(filename || 'asset').trim() || 'asset';
  const dotIndex = rawFilename.lastIndexOf('.');
  const hasExtension = dotIndex > 0 && dotIndex < rawFilename.length - 1;
  const rawBaseName = hasExtension ? rawFilename.slice(0, dotIndex) : rawFilename;
  const rawExtension = hasExtension ? rawFilename.slice(dotIndex + 1) : '';
  const suffixParts: string[] = [];

  if (useTimestamp) {
    const timestamp = options.timestampValue ?? Date.now();
    suffixParts.push(typeof timestamp === 'number' ? timestamp.toString(36) : String(timestamp));
  }

  if (useUuid) {
    suffixParts.push(options.uuidValue || createShortUuid());
  }

  const sanitizedSuffix = suffixParts.map((part) => sanitizeSegment(part)).join(separator);
  const suffix = sanitizedSuffix ? `${separator}${sanitizedSuffix}` : '';
  const extension = rawExtension ? `.${sanitizeSegment(rawExtension).replace(/\./g, '')}` : '';
  const maxBaseLength = MAX_STORAGE_SEGMENT_LENGTH - suffix.length - extension.length;

  if (maxBaseLength < 1) {
    throw new Error('Nom de fichier Supabase invalide : suffixe ou extension trop long.');
  }

  const baseName = sanitizeSegment(rawBaseName)
    .slice(0, maxBaseLength)
    .replace(/^-+|-+$/g, '') || 'asset';

  return validateStoragePath(`${baseName}${suffix}${extension}`);
}

export function buildStoragePath(...segments: unknown[]): string {
  const path = segments
    .filter(Boolean)
    .map((segment) => sanitizeSegment(segment))
    .join('/');

  return validateStoragePath(path);
}

export function validateStoragePath(path: string): string {
  if (typeof path !== 'string') {
    throw new Error('Chemin Supabase invalide : une chaîne de caractères est attendue.');
  }

  const trimmedPath = path.trim();
  if (!trimmedPath) {
    throw new Error('Chemin Supabase invalide : le chemin final ne peut pas être vide.');
  }

  const parts = trimmedPath.split('/');
  for (const part of parts) {
    if (!part || FORBIDDEN_STORAGE_SEGMENTS.has(part)) {
      throw new Error(`Chemin Supabase invalide : segment interdit "${part || '(vide)'}".`);
    }

    if (part.length > MAX_STORAGE_SEGMENT_LENGTH) {
    throw new Error(`Chemin Supabase invalide : le segment "${part}" dépasse ${MAX_STORAGE_SEGMENT_LENGTH} caractères.`);
    }

    if (!/^[a-zA-Z0-9._-]+$/.test(part)) {
    throw new Error(`Chemin Supabase invalide : le segment "${part}" contient des caractères non autorisés.`);
    }
  }

  return trimmedPath;
}

export async function uploadPublicAsset(path: string, file: UploadFile, options: UploadOptions = {}): Promise<UploadResult> {
  return uploadToStorage(path, file, {
    ...options,
    visibility: 'public',
    upsert: options.upsert ?? false,
  });
}

export async function uploadPrivateUserFile(userId: string, path: string, file: UploadFile, options: UploadOptions = {}): Promise<UploadResult> {
  if (!String(userId || '').trim()) {
  throw new Error('Upload privé impossible : identifiant utilisateur manquant.');
  }

  const userPrefix = buildStoragePath('users', userId);
  const relativePath = validateStoragePath(path);
  const storagePath = validateStoragePath(`${userPrefix}/${relativePath}`);

  if (!storagePath.startsWith(`${userPrefix}/`)) {
  throw new Error('Upload privé impossible : le chemin doit rester dans le dossier de l\'utilisateur.');
  }

  return uploadToStorage(storagePath, file, {
    ...options,
    visibility: 'private',
    upsert: options.upsert ?? false,
  });
}

export async function uploadToStorage(path: string, file: UploadFile, options: UploadOptions = {}): Promise<UploadResult> {
  assertSupabaseStorageConfig();
  const client = getSupabaseClient();
  const storagePath = validateStoragePath(path);
  const action = 'upload du fichier';
  const startedAt = getNow();
  // upsert: true can silently overwrite user assets; enable it only for
  // deliberate replacements such as JSON manifests or saved state files.
  const {
    upsert = false,
    cacheControl = '3600',
    contentType,
    visibility = 'private',
    retries = DEFAULT_UPLOAD_RETRIES,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS,
    signal,
    maxFileSize,
    allowMimeTypes,
  } = options;
  const normalizedVisibility = normalizeStorageVisibility(visibility);
  const bucket = resolveStorageBucket(normalizedVisibility);
  const maxAttempts = Math.max(1, Number(retries) + 1 || 1);
  let lastError = null;

  logStorageDebug('upload:start', {
    action,
    bucket,
    path: storagePath,
    visibility: normalizedVisibility,
    size: file?.size,
  });

  try {
    validateUploadFile(storagePath, file, {
      contentType,
      maxFileSize,
      allowMimeTypes,
    });
  } catch (error) {
    logStorageDebug('upload:failure', {
      action,
      bucket,
      path: storagePath,
      visibility: normalizedVisibility,
      durationMs: getRoundedDuration(startedAt),
      code: getStorageErrorCode(error, 'validation-error'),
    }, 'warn');
    throw error;
  }

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const { error } = await withTimeout(
        // Supabase Storage upload options in the installed client do not carry
        // AbortSignal to fetch, so a local timeout must not be retried.
        client.storage
          .from(bucket)
          .upload(storagePath, file, {
            upsert,
            cacheControl,
            contentType: contentType || file?.type || 'application/octet-stream',
          }),
        { timeoutMs, signal },
      );

      if (error) {
        throw createStorageError({
          action,
          bucket,
          path: storagePath,
          cause: error,
        });
      }

      lastError = null;
      break;
    } catch (error) {
      const storageError = error instanceof StorageError ? error : createStorageError({
        action,
        bucket,
        path: storagePath,
        cause: error,
      });

      lastError = storageError;
      if (attempt >= maxAttempts || !shouldRetryUploadError(storageError)) {
        if (shouldProxyUploadError(storageError)) {
          logStorageDebug('upload:proxy-start', {
            action,
            bucket,
            path: storagePath,
            visibility: normalizedVisibility,
            attempt,
            size: file?.size,
          });
          try {
            const proxyResult = await uploadToStorageViaServer(storagePath, file, {
              upsert,
              cacheControl,
              contentType,
              visibility: normalizedVisibility,
              signal,
            });
            if (proxyResult) {
              logStorageDebug('upload:proxy-success', {
                action,
                bucket: proxyResult.bucket,
                path: storagePath,
                visibility: normalizedVisibility,
                durationMs: getRoundedDuration(startedAt),
                size: file?.size,
              });
              return proxyResult;
            }
          } catch (proxyError) {
            const storageProxyError = proxyError instanceof StorageError ? proxyError : createStorageError({
              action: 'upload proxy du fichier',
              bucket,
              path: storagePath,
              cause: proxyError,
            });
            logStorageDebug('upload:proxy-failure', {
              action,
              bucket,
              path: storagePath,
              visibility: normalizedVisibility,
              attempt,
              durationMs: getRoundedDuration(startedAt),
              code: storageProxyError.code,
            }, 'warn');
            throw storageProxyError;
          }
        }
        logStorageDebug('upload:failure', {
          action,
          bucket,
          path: storagePath,
          visibility: normalizedVisibility,
          attempt,
          durationMs: getRoundedDuration(startedAt),
          code: storageError.code,
        }, 'warn');
        throw storageError;
      }

      await waitForRetry(retryDelayMs * attempt, signal);
    }
  }

  if (lastError) throw lastError;

  // Public URLs expose the object directly; private files must stay behind
  // Supabase storage policies or signed URLs generated elsewhere.
  const publicUrl = normalizedVisibility === 'public' && bucket === PUBLIC_ASSETS_BUCKET ?
    client.storage.from(bucket).getPublicUrl(storagePath).data.publicUrl
    : null;

  logStorageDebug('upload:success', {
    action,
    bucket,
    path: storagePath,
    visibility: normalizedVisibility,
    durationMs: getRoundedDuration(startedAt),
    size: file?.size,
  });

  return {
    bucket,
    path: storagePath,
    visibility: normalizedVisibility,
    publicUrl,
  };
}

export async function downloadTextFile(path: string, options: DownloadTextFileOptions = {}): Promise<string> {
  assertSupabaseStorageConfig();
  const client = getSupabaseClient();
  const storagePath = validateStoragePath(path);
  const visibility = normalizeStorageVisibility(options.visibility);
  const bucket = options.bucket || resolveStorageBucket(visibility);
  const action = 'telechargement du fichier';
  const startedAt = getNow();

  logStorageDebug('download:start', {
    action,
    bucket,
    path: storagePath,
    visibility,
  });

  try {
    const { data, error } = await client.storage.from(bucket).download(storagePath);
    if (error) {
      throw createStorageError({
        action,
        bucket,
        path: storagePath,
        cause: error,
      });
    }

    const text = await data.text();
    logStorageDebug('download:success', {
      action,
      bucket,
      path: storagePath,
      visibility,
      durationMs: getRoundedDuration(startedAt),
      size: text.length,
    });
    return text;
  } catch (error) {
    const storageError = error instanceof StorageError ? error : createStorageError({
      action,
      bucket,
      path: storagePath,
      cause: error,
    });

    logStorageDebug('download:failure', {
      action,
      bucket,
      path: storagePath,
      visibility,
      durationMs: getRoundedDuration(startedAt),
      code: storageError.code,
    }, 'warn');
    throw storageError;
  }
}

export async function deleteStorageFile(path: string, options: DeleteStorageFileOptions = {}): Promise<boolean> {
  assertSupabaseStorageConfig();
  const client = getSupabaseClient();
  const storagePath = validateStoragePath(path);
  const visibility = normalizeStorageVisibility(options.visibility);
  const bucket = options.bucket || resolveStorageBucket(visibility);
  const action = 'suppression du fichier';
  const startedAt = getNow();

  logStorageDebug('delete:start', {
    action,
    bucket,
    path: storagePath,
    visibility,
  });

  try {
    const { error } = await client.storage.from(bucket).remove([storagePath]);
    if (error) {
      throw createStorageError({
        action,
        bucket,
        path: storagePath,
        cause: error,
      });
    }

    logStorageDebug('delete:success', {
      action,
      bucket,
      path: storagePath,
      visibility,
      durationMs: getRoundedDuration(startedAt),
    });
    return true;
  } catch (error) {
    const storageError = error instanceof StorageError ? error : createStorageError({
      action,
      bucket,
      path: storagePath,
      cause: error,
    });

    logStorageDebug('delete:failure', {
      action,
      bucket,
      path: storagePath,
      visibility,
      durationMs: getRoundedDuration(startedAt),
      code: storageError.code,
    }, 'warn');
    throw storageError;
  }
}
