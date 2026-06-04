import {
  buildStoragePath,
  downloadTextFile,
  generateStorageFilename,
  hasSupabaseStorageConfig,
  isStorageNotFoundError,
  uploadToStorage,
} from '../storage/supabaseStorage';
import { getThreeModelFormat, getThreeModelMimeType } from './threeModelUtils.js';
import {
  blobUrlToFile,
  createArcadeAssetsPayload,
  dataUrlToFile,
  getExtensionForMimeType,
  getMimeTypeForFilename,
  isBlobUrl,
  isDataUrl,
  stripVolatileModelData,
  syncConfigModelUrls,
} from './rpg3dAssetsCore.js';
import { createDefaultStudioProject } from './rpg3dStudioProject.js';

export * from './rpg3dAssetsCore.js';

export const ARCADE_MANIFEST_MAX_BYTES = 80 * 1024 * 1024;
export const ARCADE_MODEL_MAX_BYTES = 200 * 1024 * 1024;
export const ARCADE_MODEL_MIME_TYPES = [
  'model/gltf-binary',
  'model/obj',
  'application/vnd.autodesk.fbx',
  'model/vnd.fbx',
  'application/octet-stream',
];
export const ARCADE_TEXTURE_MAX_BYTES = 15 * 1024 * 1024;
export const ARCADE_TEXTURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];
export const ARCADE_MODEL_RESOURCE_MIME_TYPES = [...ARCADE_TEXTURE_MIME_TYPES, 'image/bmp', 'text/plain', 'application/octet-stream'];
export const ARCADE_UPLOAD_MB = 1024 * 1024;
export const ARCADE_MANIFEST_UPLOAD_TIMEOUT_MS = 90000;
export const ARCADE_MODEL_UPLOAD_TIMEOUT = {
  minMs: 240000,
  maxMs: 1800000,
  msPerMb: 15000,
};
export const ARCADE_MEDIA_UPLOAD_TIMEOUT = {
  minMs: 90000,
  maxMs: 240000,
  msPerMb: 6000,
};

export const hasRpg3DAssetsSupabaseConfig = hasSupabaseStorageConfig;
export const isRpg3DAssetsNotFoundError = isStorageNotFoundError;

export const getArcadeAssetsRemotePath = (userId) => buildStoragePath('users', userId, 'arcade-assets', 'assets.json');
export const getArcadeModelRemotePath = (userId, modelType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, filename)
);
export const getArcadeTextureRemotePath = (userId, modelType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, 'textures', filename)
);
export const getArcadeModelResourceRemotePath = (userId, modelType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, 'resources', filename)
);
export const getArcadeModelAnimationRemotePath = (userId, modelType, animationType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, 'animations', animationType, filename)
);
export const getArcadeModelAnimationResourceRemotePath = (userId, modelType, animationType, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', modelType, 'animations', animationType, 'resources', filename)
);
export const getArcadeMediaRemotePath = (userId, filename) => (
  buildStoragePath('users', userId, 'arcade-assets', 'media', filename)
);

export const getSizedUploadTimeoutMs = (file, profile = ARCADE_MEDIA_UPLOAD_TIMEOUT) => {
  const sizeMb = Math.max(0, (Number(file?.size) || 0) / ARCADE_UPLOAD_MB);
  const minMs = Number(profile.minMs) || ARCADE_MEDIA_UPLOAD_TIMEOUT.minMs;
  const maxMs = Number(profile.maxMs) || ARCADE_MEDIA_UPLOAD_TIMEOUT.maxMs;
  const msPerMb = Number(profile.msPerMb) || ARCADE_MEDIA_UPLOAD_TIMEOUT.msPerMb;
  return Math.round(Math.min(maxMs, Math.max(minMs, sizeMb * msPerMb)));
};

const mapArcadeAssetsSequentially = async (items = [], mapper) => {
  const results = [];
  for (let index = 0; index < items.length; index += 1) {
    results.push(await mapper(items[index], index));
  }
  return results;
};

const uploadModelTextureDataToSupabase = async (model, userId, modelType) => {
  const next = { ...model };
  if (!isDataUrl(next.imageData)) return next;
  const file = dataUrlToFile(next.imageData, next.imageName || `${next.name || modelType}-texture`, { mimeType: 'image/png' });
  const filename = generateStorageFilename(file.name || `${modelType}-texture.${getExtensionForMimeType(file.type)}`);
  const uploadResult = await uploadToStorage(getArcadeTextureRemotePath(userId, modelType, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || 'image/png',
    maxFileSize: ARCADE_TEXTURE_MAX_BYTES,
    allowMimeTypes: ARCADE_TEXTURE_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MEDIA_UPLOAD_TIMEOUT),
  });
  return {
    ...next,
    imageData: uploadResult.publicUrl || '',
    imageName: next.imageName || file.name,
    imageStorageMode: 'supabase',
    imageStoragePath: uploadResult.path,
    imageStorageBucket: uploadResult.bucket,
  };
};

const uploadMediaAssetDataToSupabase = async (asset, userId, index = 0) => {
  const next = { ...(asset || {}) };
  if (!isDataUrl(next.url)) return next;
  const file = dataUrlToFile(next.url, next.name || `media-${index + 1}`, { mimeType: 'image/png' });
  const filename = generateStorageFilename(file.name || `media-${index + 1}.${getExtensionForMimeType(file.type)}`);
  const uploadResult = await uploadToStorage(getArcadeMediaRemotePath(userId, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || 'image/png',
    maxFileSize: ARCADE_TEXTURE_MAX_BYTES,
    allowMimeTypes: ARCADE_TEXTURE_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MEDIA_UPLOAD_TIMEOUT),
  });
  return {
    ...next,
    url: uploadResult.publicUrl || '',
    name: next.name || file.name,
    storageMode: 'supabase',
    storagePath: uploadResult.path,
    storageBucket: uploadResult.bucket,
  };
};

const uploadModelResourcesDataToSupabase = async (model, userId, modelType, getRemotePath = getArcadeModelResourceRemotePath) => {
  const next = { ...model };
  if (!Array.isArray(next.modelResources) || !next.modelResources.length) return next;
  next.modelResources = await mapArcadeAssetsSequentially(next.modelResources, async (resource, index) => {
    const entry = { ...(resource || {}) };
    if (!isDataUrl(entry.data)) return entry;
    const resourceName = entry.name || entry.path || `${modelType}-resource-${index + 1}.png`;
    const file = dataUrlToFile(entry.data, resourceName, {
      mimeType: getMimeTypeForFilename(resourceName) || 'image/png',
    });
    const filename = generateStorageFilename(file.name || `${modelType}-resource-${index + 1}.${getExtensionForMimeType(file.type)}`);
    const uploadResult = await uploadToStorage(getRemotePath(userId, modelType, filename), file, {
      visibility: 'public',
      upsert: false,
      cacheControl: '31536000',
      contentType: file.type || 'image/png',
      maxFileSize: ARCADE_TEXTURE_MAX_BYTES,
      allowMimeTypes: ARCADE_MODEL_RESOURCE_MIME_TYPES,
      timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MEDIA_UPLOAD_TIMEOUT),
    });
    return {
      ...entry,
      data: '',
      url: uploadResult.publicUrl || '',
      name: entry.name || file.name,
      storageMode: 'supabase',
      storagePath: uploadResult.path,
      storageBucket: uploadResult.bucket,
    };
  });
  return next;
};

const uploadModelAnimationDataToSupabase = async (animation, userId, modelType, animationType) => {
  const next = { ...(animation || {}) };
  const modelData = isDataUrl(next.modelData) ? next.modelData : (isDataUrl(next.modelUrl) ? next.modelUrl : '');
  const sourceName = next.modelName || `${animationType}.fbx`;
  const modelFormat = getThreeModelFormat(next, sourceName) || getThreeModelFormat(modelData) || 'fbx';
  const createModelFile = async () => {
    if (modelData) {
      return dataUrlToFile(modelData, sourceName, {
        mimeType: getThreeModelMimeType(modelFormat),
        extension: modelFormat,
      });
    }
    if (isBlobUrl(next.modelUrl)) {
      return blobUrlToFile(next.modelUrl, sourceName, {
        mimeType: getThreeModelMimeType(modelFormat),
        extension: modelFormat,
      });
    }
    return null;
  };
  const uploadAnimationResources = (entry) => uploadModelResourcesDataToSupabase(
    entry,
    userId,
    modelType,
    (currentUserId, currentModelType, filename) => getArcadeModelAnimationResourceRemotePath(currentUserId, currentModelType, animationType, filename),
  );
  if (!modelData && next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) {
    next.modelData = '';
    return uploadAnimationResources(stripVolatileModelData(next));
  }
  const file = await createModelFile();
  if (!file) {
    if (isBlobUrl(next.modelUrl)) next.modelUrl = '';
    return uploadAnimationResources(stripVolatileModelData(next));
  }

  const filename = generateStorageFilename(file.name || `${animationType}.${modelFormat}`);
  const uploadResult = await uploadToStorage(getArcadeModelAnimationRemotePath(userId, modelType, animationType, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || getThreeModelMimeType(modelFormat),
    maxFileSize: ARCADE_MODEL_MAX_BYTES,
    allowMimeTypes: ARCADE_MODEL_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MODEL_UPLOAD_TIMEOUT),
  });

  return uploadAnimationResources({
    ...next,
    modelUrl: uploadResult.publicUrl || '',
    modelData: '',
    modelName: next.modelName || file.name,
    storageMode: 'supabase',
    storagePath: uploadResult.path,
    storageBucket: uploadResult.bucket,
  });
};

const uploadModelAnimationsDataToSupabase = async (model, userId, modelType) => {
  const next = { ...model };
  if (!next.modelAnimations || typeof next.modelAnimations !== 'object') return next;
  const entries = Object.entries(next.modelAnimations);
  if (!entries.length) return next;
  const uploadedAnimations = {};
  for (const [animationType, animation] of entries) {
    uploadedAnimations[animationType] = await uploadModelAnimationDataToSupabase(animation, userId, modelType, animationType);
  }
  return {
    ...next,
    modelAnimations: uploadedAnimations,
  };
};

const uploadModelDataToSupabase = async (model, userId, modelType) => {
  const next = { ...model };
  const modelData = isDataUrl(model.modelData) ? model.modelData : (isDataUrl(model.modelUrl) ? model.modelUrl : '');
  const sourceName = next.modelName || next.name || `${modelType}.glb`;
  const modelFormat = getThreeModelFormat(next, sourceName) || getThreeModelFormat(modelData) || 'glb';
  const createModelFile = async () => {
    if (modelData) {
      return dataUrlToFile(modelData, sourceName, {
        mimeType: getThreeModelMimeType(modelFormat),
        extension: modelFormat,
      });
    }
    if (isBlobUrl(next.modelUrl)) {
      return blobUrlToFile(next.modelUrl, sourceName, {
        mimeType: getThreeModelMimeType(modelFormat),
        extension: modelFormat,
      });
    }
    return null;
  };
  if (!modelData && next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) {
    next.modelData = '';
    return uploadModelTextureDataToSupabase(
      await uploadModelAnimationsDataToSupabase(await uploadModelResourcesDataToSupabase(next, userId, modelType), userId, modelType),
      userId,
      modelType,
    );
  }

  const file = await createModelFile();
  if (!file) {
    if (isBlobUrl(next.modelUrl)) next.modelUrl = '';
    return uploadModelTextureDataToSupabase(
      await uploadModelAnimationsDataToSupabase(
        await uploadModelResourcesDataToSupabase(stripVolatileModelData(next), userId, modelType),
        userId,
        modelType,
      ),
      userId,
      modelType,
    );
  }

  const filename = generateStorageFilename(file.name || `${modelType}.${modelFormat}`);
  const uploadResult = await uploadToStorage(getArcadeModelRemotePath(userId, modelType, filename), file, {
    visibility: 'public',
    upsert: false,
    cacheControl: '31536000',
    contentType: file.type || getThreeModelMimeType(modelFormat),
    maxFileSize: ARCADE_MODEL_MAX_BYTES,
    allowMimeTypes: ARCADE_MODEL_MIME_TYPES,
    timeoutMs: getSizedUploadTimeoutMs(file, ARCADE_MODEL_UPLOAD_TIMEOUT),
  });

  return uploadModelTextureDataToSupabase(await uploadModelAnimationsDataToSupabase(await uploadModelResourcesDataToSupabase({
    ...next,
    modelUrl: uploadResult.publicUrl || '',
    modelData: '',
    modelName: next.modelName || file.name,
    modelStorageMode: 'supabase',
    modelStoragePath: uploadResult.path,
    modelStorageBucket: uploadResult.bucket,
  }, userId, modelType), userId, modelType), userId, modelType);
};

export const persistStudioModelsToSupabase = async (studioProject, userId) => ({
  ...createDefaultStudioProject(),
  ...(studioProject || {}),
  characterModels3d: await mapArcadeAssetsSequentially(studioProject?.characterModels3d || [], (model) => (
    uploadModelDataToSupabase(model, userId, 'characters')
  )),
  decorModels3d: await mapArcadeAssetsSequentially(studioProject?.decorModels3d || [], (model) => (
    uploadModelDataToSupabase(model, userId, 'objects')
  )),
  mediaAssets: await mapArcadeAssetsSequentially(studioProject?.mediaAssets || [], (asset, index) => (
    uploadMediaAssetDataToSupabase(asset, userId, index)
  )),
});

export const createSupabaseArcadeAssetsPayload = async (config, studioProject, userId) => {
  const persistedStudioProject = await persistStudioModelsToSupabase(studioProject, userId);
  const persistedConfig = syncConfigModelUrls(config, persistedStudioProject);
  return createArcadeAssetsPayload(persistedConfig, persistedStudioProject);
};

export const uploadArcadeAssetsManifest = async (payload, userId) => {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  await uploadToStorage(getArcadeAssetsRemotePath(userId), blob, {
    visibility: 'private',
    upsert: true,
    cacheControl: '0',
    contentType: 'application/json',
    maxFileSize: ARCADE_MANIFEST_MAX_BYTES,
    timeoutMs: ARCADE_MANIFEST_UPLOAD_TIMEOUT_MS,
  });
};

export const loadArcadeAssetsFromSupabase = async (userId) => {
  const text = await downloadTextFile(getArcadeAssetsRemotePath(userId), { visibility: 'private' });
  const parsed = JSON.parse(text);
  return parsed && typeof parsed === 'object' ? parsed : null;
};
