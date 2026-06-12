import {
  getSupabaseAdminClient,
  json,
  resolveServerStorageBucket,
  verifyUser,
  withErrors,
} from './_shared.js';
import {
  getPublicUploadUrl,
  getStorageUploadValidationProfile,
  isStorageObjectAlreadyExistsError,
  makeUploadError,
  normalizeVisibility,
  assertUserStoragePath,
  validateStorageUploadPath,
} from './storage-upload.js';

const getQueryContentLength = (params = {}) => {
  const rawValue = params.contentLength;
  if (rawValue == null || rawValue === '') return null;
  const contentLength = Number(rawValue);
  if (!Number.isFinite(contentLength) || contentLength < 0) {
    throw makeUploadError('Taille de fichier invalide.', 400, 'CONTENT_LENGTH_INVALID');
  }
  return contentLength;
};

export const handler = (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' }, event);

  const user = await verifyUser(event);
  const params = event.queryStringParameters || {};
  const storagePath = validateStorageUploadPath(params.path || '');
  assertUserStoragePath(user.id, storagePath);

  const visibility = normalizeVisibility(params.visibility || 'private');
  const bucket = resolveServerStorageBucket(visibility);
  const allowExistingObject = params.allowExistingObject === 'true';
  const upsert = params.upsert === 'true';
  const requestedContentType = params.contentType || 'application/octet-stream';
  const validationProfile = getStorageUploadValidationProfile({
    path: storagePath,
    contentType: requestedContentType,
    contentLength: getQueryContentLength(params),
  });

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(storagePath, {
    upsert,
  });
  if (error) {
    if (allowExistingObject && !upsert && visibility === 'public' && isStorageObjectAlreadyExistsError(error)) {
      return json(200, {
        bucket,
        path: storagePath,
        visibility,
        publicUrl: getPublicUploadUrl(supabase, bucket, storagePath, visibility),
        alreadyExists: true,
      }, event);
    }
    throw error;
  }

  return json(200, {
    bucket,
    path: data?.path || storagePath,
    visibility,
    publicUrl: getPublicUploadUrl(supabase, bucket, storagePath, visibility),
    token: data?.token || '',
    signedUrl: data?.signedUrl || '',
    contentType: validationProfile.contentType,
  }, event);
});
