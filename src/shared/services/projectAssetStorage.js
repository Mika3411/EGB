import {
  buildStoragePath,
  generateStorageFilename,
  uploadToStorage,
} from '../storage/supabaseStorage';
import { dataUrlToBlob, extensionFromMime } from '../utils/mediaProjectHelpers';
import { hasRemoteStorageConfig } from './remoteSession';

export const canStoreProjectAssetsRemotely = hasRemoteStorageConfig;

export const uploadGeneratedProjectImageAsset = async ({
  imageData = '',
  imageName = '',
  projectId = '',
  slideId = '',
  targetId = '',
  type = '',
  userId = '',
} = {}) => {
  if (
    !projectId
    || !userId
    || !type
    || !targetId
    || !hasRemoteStorageConfig()
    || typeof imageData !== 'string'
    || !imageData.startsWith('data:image/')
  ) {
    return null;
  }

  const blob = dataUrlToBlob(imageData);
  if (!blob) return null;

  const extension = extensionFromMime(blob.type);
  const storageId = type === 'cinematicSlide' && slideId ? `${targetId}-${slideId}` : targetId;
  const filename = generateStorageFilename(`${storageId}.${extension}`);
  const version = filename.replace(/\.[^.]+$/, '');
  const path = buildStoragePath('users', userId, 'projects', projectId, 'ai-images', type, filename);
  const uploaded = await uploadToStorage(path, blob, {
    contentType: blob.type,
    cacheControl: '3600',
    visibility: 'public',
  });

  if (!uploaded.publicUrl) return null;

  return {
    imageName: imageName || `${type}-${targetId}.${extension}`,
    path: uploaded.path,
    publicUrl: `${uploaded.publicUrl}${uploaded.publicUrl.includes('?') ? '&' : '?'}v=${version}`,
    uploadResult: uploaded,
    version,
  };
};
