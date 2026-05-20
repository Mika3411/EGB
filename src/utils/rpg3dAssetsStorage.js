import {
  buildStoragePath,
  downloadTextFile,
  generateStorageFilename,
  hasSupabaseConfig,
  isStorageNotFoundError,
  uploadToStorage,
} from '../supabaseStorage';
import { getThreeModelFormat, getThreeModelMimeType } from './threeGltfUtils.js';
import {
  DEFAULT_ARCADE_CONFIG,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  cloneConfig,
  clonePlainObjectArray,
  getCharacterModelAxisScale,
  getDecorModelScale,
  getDecorMaterialBrightness,
  getStudioDecorKindId,
  isFloorDecorKind,
  clamp,
} from './rpg3dDomain.js';
import {
  cloneStudioProjectForEdit,
  createConfigFromSavedAssets,
  createDefaultStudioProject,
} from './rpg3dStudioProject.js';

export const ARCADE_ASSETS_STORAGE_KEY = 'escape-game-builder:arcade-assets:v1';
export const ARCADE_ASSETS_REMOTE_VERSION = 2;
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
export const ARCADE_TEXTURE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];
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
export const RPG3D_HISTORY_DATA_URL_MAX_CHARS = 512 * 1024;

const ARCADE_WORLD_SCALE = 0.018;

export const hasRpg3DAssetsSupabaseConfig = hasSupabaseConfig;
export const isRpg3DAssetsNotFoundError = isStorageNotFoundError;

export const readSavedArcadeAssets = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ARCADE_ASSETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

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

export const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
export const isDataUrl = (value = '') => String(value || '').startsWith('data:');

const localBlobFileCache = new Map();
const localModelObjectUrlCache = new Map();
const LOCAL_MODEL_DB_NAME = 'escape-game-builder:rpg3d-local-models';
const LOCAL_MODEL_DB_VERSION = 1;
const LOCAL_MODEL_STORE_NAME = 'modelFiles';

const canUseIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openLocalModelDb = () => new Promise((resolve, reject) => {
  if (!canUseIndexedDb()) {
    resolve(null);
    return;
  }
  const request = window.indexedDB.open(LOCAL_MODEL_DB_NAME, LOCAL_MODEL_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(LOCAL_MODEL_STORE_NAME)) db.createObjectStore(LOCAL_MODEL_STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Stockage local 3D indisponible.'));
});

const runLocalModelStore = async (mode, runner) => {
  const db = await openLocalModelDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_MODEL_STORE_NAME, mode);
    const store = transaction.objectStore(LOCAL_MODEL_STORE_NAME);
    const request = runner(store);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Operation de stockage local impossible.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Transaction de stockage local impossible.'));
    };
  });
};

export const createLocalModelFileId = (modelType = 'model', modelId = '', file = null) => (
  [
    'rpg3d',
    modelType || 'model',
    modelId || 'model',
    file?.name || 'asset',
    Number(file?.size) || 0,
    Number(file?.lastModified) || Date.now(),
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join(':')
);

export const persistLocalModelFile = async (localModelFileId = '', file = null) => {
  if (!localModelFileId || !file) return false;
  try {
    await runLocalModelStore('readwrite', (store) => store.put({
      id: localModelFileId,
      file,
      name: file.name || '',
      type: file.type || '',
      size: Number(file.size) || 0,
      updatedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
};

export const loadLocalModelFile = async (localModelFileId = '') => {
  if (!localModelFileId) return null;
  try {
    const record = await runLocalModelStore('readonly', (store) => store.get(localModelFileId));
    return record?.file || null;
  } catch {
    return null;
  }
};

export const createLocalModelObjectUrl = async (localModelFileId = '') => {
  if (!localModelFileId) return '';
  const cachedUrl = localModelObjectUrlCache.get(localModelFileId);
  if (cachedUrl) return cachedUrl;
  const file = await loadLocalModelFile(localModelFileId);
  if (!file) return '';
  const objectUrl = URL.createObjectURL(file);
  localModelObjectUrlCache.set(localModelFileId, objectUrl);
  localBlobFileCache.set(objectUrl, file);
  return objectUrl;
};

export const rememberRpg3DLocalBlobFile = (blobUrl = '', file = null, localModelFileId = '') => {
  if (!isBlobUrl(blobUrl) || !file) return false;
  localBlobFileCache.set(blobUrl, file);
  if (localModelFileId) {
    localModelObjectUrlCache.set(localModelFileId, blobUrl);
    persistLocalModelFile(localModelFileId, file);
  }
  return true;
};

export const forgetRpg3DLocalBlobFile = (blobUrl = '') => {
  if (!isBlobUrl(blobUrl)) return false;
  return localBlobFileCache.delete(blobUrl);
};

export const createArcadeAssetsPayload = (config, studioProject) => ({
  version: ARCADE_ASSETS_REMOTE_VERSION,
  savedAt: new Date().toISOString(),
  config: {
    ...cloneConfig(config),
  },
  studioProject: cloneStudioProjectForEdit(studioProject),
});

export const getPersistedModelSource = (model = {}) => {
  if (isDataUrl(model.modelData)) return model.modelData;
  if (model.modelData && isBlobUrl(model.modelUrl)) return model.modelData;
  if (isBlobUrl(model.modelUrl)) return '';
  return model.modelUrl || model.modelData || '';
};

export const getLiveModelSource = (model = {}) => {
  if (isBlobUrl(model.modelUrl)) return model.modelUrl;
  return getPersistedModelSource(model);
};

export const getModelSourceForMode = (model = {}, options = {}) => (
  options.preferLocalBlob ? getLiveModelSource(model) : getPersistedModelSource(model)
);

export const getPersistedModelAnimations = (model = {}, options = {}) => (
  Object.entries(model.modelAnimations || {}).reduce((next, [slot, animation]) => {
    const source = getModelSourceForMode(animation || {}, options);
    if (!source) return next;
    next[slot] = {
      ...(animation || {}),
      modelUrl: source,
    };
    return next;
  }, {})
);

const stripVolatileModelSourceData = (model = {}) => {
  const next = { ...(model || {}) };
  if (isDataUrl(next.modelData) && next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) next.modelUrl = '';
  if (isBlobUrl(next.modelUrl) && !next.modelData) next.modelUrl = '';
  if (next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) next.modelData = '';
  return next;
};

export const stripVolatileModelData = (model = {}) => {
  const next = stripVolatileModelSourceData(model);
  if (next.modelAnimations && typeof next.modelAnimations === 'object') {
    next.modelAnimations = Object.entries(next.modelAnimations).reduce((animations, [slot, animation]) => {
      animations[slot] = stripVolatileModelSourceData(animation);
      return animations;
    }, {});
  }
  return next;
};

export const createLocalArcadeAssetsSnapshot = (payload = {}) => {
  const studioProject = {
    ...createDefaultStudioProject(),
    ...(payload.studioProject || {}),
    characterModels3d: (payload.studioProject?.characterModels3d || []).map(stripVolatileModelData),
    decorModels3d: (payload.studioProject?.decorModels3d || []).map(stripVolatileModelData),
    mediaAssets: clonePlainObjectArray(payload.studioProject?.mediaAssets || []),
  };
  const synced = syncConfigModelReferences(payload.config || DEFAULT_ARCADE_CONFIG, studioProject);
  return {
    ...payload,
    config: synced.config,
    studioProject,
  };
};

const rehydrateLocalModelSource = async (model = {}) => {
  if (!model?.localModelFileId) return model;
  const persistedSource = getPersistedModelSource(model);
  if (persistedSource && !isBlobUrl(persistedSource)) return model;
  const objectUrl = await createLocalModelObjectUrl(model.localModelFileId);
  if (!objectUrl) return model;
  return {
    ...model,
    modelUrl: objectUrl,
    modelData: '',
  };
};

const rehydrateLocalModel = async (model = {}) => {
  const nextModel = await rehydrateLocalModelSource(model);
  if (!nextModel?.modelAnimations || typeof nextModel.modelAnimations !== 'object') return nextModel;
  const animationEntries = await Promise.all(Object.entries(nextModel.modelAnimations).map(async ([slot, animation]) => [
    slot,
    await rehydrateLocalModelSource(animation || {}),
  ]));
  const animationsChanged = animationEntries.some(([slot, animation]) => animation !== nextModel.modelAnimations?.[slot]);
  if (!animationsChanged) return nextModel;
  return {
    ...nextModel,
    modelAnimations: Object.fromEntries(animationEntries),
  };
};

export const restoreLocalArcadeAssetsSources = async ({ config, studioProject } = {}) => {
  const baseStudioProject = cloneStudioProjectForEdit(studioProject || createDefaultStudioProject());
  const characterModels3d = await Promise.all((baseStudioProject.characterModels3d || []).map(rehydrateLocalModel));
  const decorModels3d = await Promise.all((baseStudioProject.decorModels3d || []).map(rehydrateLocalModel));
  const nextStudioProject = {
    ...baseStudioProject,
    characterModels3d,
    decorModels3d,
  };
  const synced = syncConfigModelReferences(config || DEFAULT_ARCADE_CONFIG, nextStudioProject, { preferLocalBlob: true });
  const changed = synced.changed
    || characterModels3d.some((model, index) => model !== baseStudioProject.characterModels3d?.[index])
    || decorModels3d.some((model, index) => model !== baseStudioProject.decorModels3d?.[index]);
  return {
    changed,
    config: synced.config,
    studioProject: nextStudioProject,
  };
};

export const rememberArcadeAssetsLocally = (payload) => {
  if (typeof window === 'undefined') return false;
  try {
    window.localStorage.removeItem(ARCADE_ASSETS_STORAGE_KEY);
    window.localStorage.setItem(ARCADE_ASSETS_STORAGE_KEY, JSON.stringify(createLocalArcadeAssetsSnapshot(payload)));
    return true;
  } catch {
    return false;
  }
};

export const getExtensionForMimeType = (mimeType = '') => ({
  'model/gltf-binary': 'glb',
  'model/obj': 'obj',
  'application/vnd.autodesk.fbx': 'fbx',
  'model/vnd.fbx': 'fbx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'text/plain': 'txt',
}[String(mimeType).toLowerCase()] || 'bin');

const MIME_TYPE_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  mtl: 'text/plain',
};

export const getMimeTypeForFilename = (filename = '') => {
  const extension = String(filename || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return MIME_TYPE_BY_EXTENSION[extension] || '';
};

export const dataUrlToFile = (dataUrl, fallbackName = 'asset.bin', options = {}) => {
  const [header = '', encoded = ''] = String(dataUrl || '').split(',');
  const headerMimeType = header.match(/^data:([^;,]+)/i)?.[1] || '';
  const sourceName = fallbackName || options.defaultName || 'asset';
  const nameMimeType = getMimeTypeForFilename(sourceName);
  const mimeType = (
    !headerMimeType
    || headerMimeType === 'application/octet-stream'
    || headerMimeType === 'binary/octet-stream'
  )
    ? (nameMimeType || options.mimeType || 'application/octet-stream')
    : headerMimeType;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const extension = options.extension || getExtensionForMimeType(mimeType);
  const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
  return new File([bytes], fileName, { type: mimeType });
};

export const blobUrlToFile = async (blobUrl, fallbackName = 'asset.bin', options = {}) => {
  const cachedFile = localBlobFileCache.get(blobUrl);
  if (cachedFile) {
    const sourceName = fallbackName || cachedFile.name || options.defaultName || 'asset.bin';
    const mimeType = cachedFile.type || getMimeTypeForFilename(sourceName) || options.mimeType || 'application/octet-stream';
    const extension = options.extension || getExtensionForMimeType(mimeType);
    const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
    return new File([cachedFile], fileName, { type: mimeType });
  }
  const response = await fetch(blobUrl);
  if (!response.ok) throw new Error('Fichier local inaccessible. Reimporte le modele puis relance la sauvegarde.');
  const blob = await response.blob();
  const sourceName = fallbackName || options.defaultName || 'asset.bin';
  const mimeType = blob.type || getMimeTypeForFilename(sourceName) || options.mimeType || 'application/octet-stream';
  const extension = options.extension || getExtensionForMimeType(mimeType);
  const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
  return new File([blob], fileName, { type: mimeType });
};

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

export const getStudioModelSource = (model = {}) => {
  if (isBlobUrl(model.modelUrl)) return model.modelUrl;
  if (isDataUrl(model.modelData)) return model.modelData;
  return model.modelUrl || model.modelData || '';
};

const getStudioMaterialBrightness = (model = {}) => {
  const value = Number(model.materialBrightness);
  return clamp(Number.isFinite(value) ? value : 1, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
};

const getStudioCharacterRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (model.shape === 'robot') return 'block';
  if (model.shape === 'creature') return 'boss';
  return 'capsule';
};

const getDecorImportRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (isFloorDecorKind(model.kind)) return 'floor';
  if (model.kind === 'wall') return 'box';
  if (model.kind === 'house') return 'house';
  if (model.imageData) return 'billboard';
  return 'rock';
};

const getDecorModelWorldSize = (model = {}) => {
  const modelScale = getDecorModelScale(model);
  const width = Math.round(clamp(((Number(model.width) || 2.2) * modelScale) / ARCADE_WORLD_SCALE, 24, 9000));
  const depth = Math.round(clamp(((Number(model.depth) || 2.2) * modelScale) / ARCADE_WORLD_SCALE, 24, 9000));
  const modelHeight = Number(model.height) || 1.2;
  const height = Math.round(clamp((modelHeight * modelScale) / ARCADE_WORLD_SCALE, 12, 9000));
  if (isFloorDecorKind(model.kind) && !getStudioModelSource(model)) {
    const tileSize = Math.max(width, depth);
    return { width: tileSize, depth: tileSize, height: Math.max(12, height) };
  }
  return { width, depth, height };
};

const shouldPropBlockByMode = (mode) => ['box', 'rock', 'house'].includes(mode);

const getModelRotationValue = (item = {}, field = 'modelRotationX') => {
  const numeric = Number(item[field]);
  return clamp(Number.isFinite(numeric) ? numeric : 0, -180, 180);
};

export const syncConfigModelReferences = (config, studioProject, options = {}) => {
  const next = createConfigFromSavedAssets(config);
  let changed = false;
  const characterModels = new Map((studioProject.characterModels3d || []).map((model) => [model.id, model]));
  const decorModels = new Map((studioProject.decorModels3d || []).map((model) => [model.id, model]));
  const setField = (target, field, value) => {
    if (!target || target[field] === value) return;
    target[field] = value;
    changed = true;
  };
  const syncActor = (actor) => {
    if (!actor) return;
    const model = characterModels.get(actor.characterModel3dId);
    if (model) {
      const axisScale = getCharacterModelAxisScale(model);
      setField(actor, 'characterModelScale', axisScale.y);
      setField(actor, 'characterModelScaleX', axisScale.x);
      setField(actor, 'characterModelScaleY', axisScale.y);
      setField(actor, 'characterModelScaleZ', axisScale.z);
      setField(actor, 'characterModelScaleProportional', model.characterModelScaleProportional !== false);
      setField(actor, 'characterMaterialBrightness', getStudioMaterialBrightness(model));
      const source = getModelSourceForMode(model, options);
      if (source) {
        setField(actor, 'characterModelUrl', source);
        setField(actor, 'characterModelName', model.modelName || model.name || actor.characterModelName || '');
        setField(actor, 'characterModelFormat', model.modelFormat || '');
        setField(actor, 'characterModelFileSize', Number(model.modelFileSize) || 0);
        setField(actor, 'characterModelResources', Array.isArray(model.modelResources) ? model.modelResources : []);
        setField(actor, 'characterModelAnimations', getPersistedModelAnimations(model, options));
        setField(actor, 'characterLocalModelFileId', model.localModelFileId || '');
        setField(actor, 'characterRenderMode', 'glb');
        return;
      }
      setField(actor, 'characterModelUrl', '');
      setField(actor, 'characterModelName', '');
      setField(actor, 'characterModelFormat', '');
      setField(actor, 'characterModelFileSize', 0);
      setField(actor, 'characterModelResources', []);
      setField(actor, 'characterModelAnimations', {});
      setField(actor, 'characterLocalModelFileId', model.localModelFileId || '');
      if (actor.characterRenderMode === 'glb') setField(actor, 'characterRenderMode', getStudioCharacterRenderMode(model));
    } else if (actor.characterModel3dId || isBlobUrl(actor.characterModelUrl)) {
      setField(actor, 'characterModel3dId', '');
      setField(actor, 'characterModelUrl', '');
      setField(actor, 'characterModelName', '');
      setField(actor, 'characterModelFormat', '');
      setField(actor, 'characterModelFileSize', 0);
      setField(actor, 'characterModelResources', []);
      setField(actor, 'characterModelAnimations', {});
      setField(actor, 'characterLocalModelFileId', '');
      setField(actor, 'characterModelScale', 1);
      setField(actor, 'characterModelScaleX', 1);
      setField(actor, 'characterModelScaleY', 1);
      setField(actor, 'characterModelScaleZ', 1);
      setField(actor, 'characterModelScaleProportional', true);
      setField(actor, 'characterMaterialBrightness', 1);
      if (actor.characterRenderMode === 'glb') setField(actor, 'characterRenderMode', 'capsule');
    }
  };
  syncActor(next.player);
  (next.heroes || []).forEach(syncActor);
  (next.enemies || []).forEach(syncActor);
  (next.props || []).forEach((prop) => {
    const model = decorModels.get(prop.decorModel3dId);
    if (model) {
      const decorKind = getStudioDecorKindId(model.kind);
      setField(prop, 'materialBrightness', getDecorMaterialBrightness(model));
      setField(prop, 'decorModelScale', 1);
      setField(prop, 'decorKind', decorKind);
      setField(prop, 'modelRotationX', getModelRotationValue(model, 'modelRotationX'));
      setField(prop, 'modelRotationY', getModelRotationValue(model, 'modelRotationY'));
      setField(prop, 'modelRotationZ', getModelRotationValue(model, 'modelRotationZ'));
      setField(prop, 'modelCenterOnOrigin', Boolean(model.modelCenterOnOrigin));
      setField(prop, 'modelFlushToGround', Boolean(model.modelFlushToGround));
      const source = getModelSourceForMode(model, options);
      if (source) {
        setField(prop, 'decorModelUrl', source);
        setField(prop, 'decorModelName', model.modelName || model.name || prop.decorModelName || '');
        setField(prop, 'decorLocalModelFileId', model.localModelFileId || '');
        setField(prop, 'modelFormat', model.modelFormat || '');
        setField(prop, 'modelFileSize', Number(model.modelFileSize) || 0);
        setField(prop, 'modelResources', Array.isArray(model.modelResources) ? model.modelResources : []);
        setField(prop, 'renderMode', 'glb');
        const size = getDecorModelWorldSize(model);
        setField(prop, 'w', size.width);
        setField(prop, 'h', size.depth);
        setField(prop, 'r', Math.round(Math.max(size.width, size.depth) / 2));
        setField(prop, 'modelHeight', size.height);
        setField(prop, 'blocksMovement', model.collision ?? shouldPropBlockByMode('glb'));
        if (!prop.imageData || prop.imageData === model.imageData || prop.imageName === model.imageName) {
          setField(prop, 'imageData', '');
          setField(prop, 'imageName', '');
          setField(prop, 'repeatTexture', false);
        }
        return;
      }
      setField(prop, 'decorModelUrl', '');
      setField(prop, 'decorModelName', '');
      setField(prop, 'decorLocalModelFileId', model.localModelFileId || '');
      setField(prop, 'modelFormat', '');
      setField(prop, 'modelFileSize', 0);
      setField(prop, 'modelResources', []);
      setField(prop, 'materialBrightness', getDecorMaterialBrightness(model));
      const renderMode = getDecorImportRenderMode(model);
      const size = getDecorModelWorldSize(model);
      const tileSize = renderMode === 'floor' ? Math.max(size.width, size.depth) : 0;
      setField(prop, 'renderMode', renderMode);
      setField(prop, 'w', tileSize || size.width);
      setField(prop, 'h', tileSize || size.depth);
      setField(prop, 'r', Math.round((tileSize || Math.max(size.width, size.depth)) / 2));
      setField(prop, 'modelHeight', renderMode === 'floor' ? 12 : size.height);
      setField(prop, 'blocksMovement', model.collision ?? shouldPropBlockByMode(renderMode));
      setField(prop, 'imageData', model.imageData || '');
      setField(prop, 'imageName', model.imageName || '');
      setField(prop, 'repeatTexture', Boolean(model.repeatTexture));
    } else if (isBlobUrl(prop.decorModelUrl)) {
      setField(prop, 'decorModelUrl', '');
      setField(prop, 'decorLocalModelFileId', '');
      setField(prop, 'modelFormat', '');
      setField(prop, 'modelFileSize', 0);
      setField(prop, 'modelResources', []);
    }
  });
  return { config: changed ? next : config, changed };
};

export const syncConfigModelUrls = (config, studioProject) => syncConfigModelReferences(config, studioProject).config;

export const compactHistoryDataUrl = (value = '') => (
  isDataUrl(value) && value.length > RPG3D_HISTORY_DATA_URL_MAX_CHARS ? '' : value
);

export const compactHistoryModel = (model = {}) => stripVolatileModelData({
  ...model,
  modelData: compactHistoryDataUrl(model.modelData || ''),
  modelUrl: isDataUrl(model.modelUrl || '') ? compactHistoryDataUrl(model.modelUrl) : (model.modelUrl || ''),
  imageData: compactHistoryDataUrl(model.imageData || ''),
  modelResources: Array.isArray(model.modelResources)
    ? model.modelResources.map((resource) => ({
      ...(resource || {}),
      data: compactHistoryDataUrl(resource?.data || ''),
    }))
    : [],
  modelAnimations: Object.entries(model.modelAnimations || {}).reduce((animations, [slot, animation]) => {
    animations[slot] = {
      ...(animation || {}),
      modelData: compactHistoryDataUrl(animation?.modelData || ''),
      modelUrl: isDataUrl(animation?.modelUrl || '') ? compactHistoryDataUrl(animation.modelUrl) : (animation?.modelUrl || ''),
      modelResources: Array.isArray(animation?.modelResources)
        ? animation.modelResources.map((resource) => ({
          ...(resource || {}),
          data: compactHistoryDataUrl(resource?.data || ''),
        }))
        : [],
    };
    return animations;
  }, {}),
});

export const createHistoryStudioProjectSnapshot = (studioProject = null) => ({
  ...createDefaultStudioProject(),
  ...(studioProject && typeof studioProject === 'object' ? studioProject : {}),
  characterModels3d: (studioProject?.characterModels3d || []).map(compactHistoryModel),
  decorModels3d: (studioProject?.decorModels3d || []).map(compactHistoryModel),
  mediaAssets: (studioProject?.mediaAssets || []).map((asset) => ({
    ...(asset || {}),
    url: compactHistoryDataUrl(asset?.url || ''),
  })),
});

export const createRpg3DHistorySnapshot = (config, studioProject) => ({
  config: cloneConfig(config),
  studioProject: createHistoryStudioProjectSnapshot(studioProject),
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
