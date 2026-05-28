import * as THREE from 'three';
import JSZip from 'jszip';
import { fileToDataURL } from './fileHelpers';
import {
  applyObjectAxisScaleRatios,
  applyTextureToGltfModel,
  fitObjectToDimensions,
  fitObjectToHeight,
  getImportedModelPrepareOptions,
  getThreeModelFileFormat,
  getThreeModelSources,
  hasThreeModelResources,
  loadThreeModelFromSource,
  normalizeThreeModelFile,
  prepareGltfModel,
  rememberObjectBaseTransform,
  snapObjectToGround,
} from './threeGltfUtils';
import {
  DECOR_MODEL_DIMENSION_MAX,
  DECOR_MODEL_DIMENSION_MIN,
  applyModelRotation,
  getAnimationSource,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getDecorMaterialBrightness,
  getDecorModelDimensions,
  getFloorZeroZ,
  getModelImportFileInfo,
  getPreviewAnimationOptions,
  isFloorTileKind,
  isHeavyLocalFbxAnimationAsset,
  isHeavyLocalFbxAsset,
  numberValue,
  shouldInlineModelData,
} from './rpg3dModelImportCore.js';

export * from './rpg3dModelImportCore.js';

export const centerObjectHorizontallyOnOrigin = (object) => {
  if (!object) return false;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x) || !Number.isFinite(box.min.z) || !Number.isFinite(box.max.z)) return false;
  const center = box.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.updateMatrixWorld(true);
  return true;
};

export const alignObjectTopToGround = (object, groundY = 0.018) => {
  if (!object) return false;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  if (!Number.isFinite(box.max.y)) return false;
  object.position.y += groundY - box.max.y;
  object.updateMatrixWorld(true);
  return true;
};

export const fitObjectToLargestDimension = (object, targetSize = 1, options = {}) => {
  if (!object) return false;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(largest) || largest <= 0.0001) return false;
  const target = Number.isFinite(Number(targetSize)) && Number(targetSize) > 0 ? Number(targetSize) : largest;
  object.scale.multiplyScalar(Math.max(0.000001, target / largest));
  object.updateMatrixWorld(true);
  const fittedBox = new THREE.Box3().setFromObject(object, true);
  const center = fittedBox.getCenter(new THREE.Vector3());
  const groundY = Number.isFinite(Number(options.groundY)) ? Number(options.groundY) : 0;
  object.position.x += options.centerX === false ? 0 : -center.x;
  object.position.z += options.centerZ === false ? 0 : -center.z;
  snapObjectToGround(object, groundY);
  return true;
};

const MODEL_RESOURCE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'mtl']);
const MODEL_RESOURCE_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  mtl: 'text/plain',
};

const getZipEntryExtension = (name = '') => (
  String(name || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || ''
);

const zipEntryBaseName = (name = '') => String(name || '').replace(/\\/g, '/').split('/').filter(Boolean).pop() || '';

const sortModelArchiveEntries = (a, b) => {
  const aDepth = String(a.name || '').replace(/\\/g, '/').split('/').length;
  const bDepth = String(b.name || '').replace(/\\/g, '/').split('/').length;
  if (aDepth !== bDepth) return aDepth - bDepth;
  return String(a.name || '').localeCompare(String(b.name || ''));
};


export const readModelZipBundle = async (file) => {
  const zip = await JSZip.loadAsync(file);
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  const modelEntries = entries
    .filter((entry) => getThreeModelFileFormat({ name: entry.name }))
    .sort(sortModelArchiveEntries);
  const modelEntry = modelEntries[0];
  if (!modelEntry) throw new Error('Archive sans modele 3D.');
  const modelFormat = getThreeModelFileFormat({ name: modelEntry.name });
  const modelBlob = await modelEntry.async('blob');
  const modelFile = new File([modelBlob], zipEntryBaseName(modelEntry.name), {
    type: modelBlob.type || undefined,
    lastModified: file.lastModified || Date.now(),
  });
  const resourceEntries = entries.filter((entry) => {
    if (entry.name === modelEntry.name) return false;
    return MODEL_RESOURCE_EXTENSIONS.has(getZipEntryExtension(entry.name));
  });
  const modelResources = await Promise.all(resourceEntries.map(async (entry) => {
    const blob = await entry.async('blob');
    const extension = getZipEntryExtension(entry.name);
    return {
      path: entry.name.replace(/\\/g, '/'),
      name: zipEntryBaseName(entry.name),
      data: await fileToDataURL(new File([blob], zipEntryBaseName(entry.name), {
        type: blob.type || MODEL_RESOURCE_MIME_TYPES[extension] || undefined,
        lastModified: file.lastModified || Date.now(),
      })),
    };
  }));
  return {
    modelFile,
    modelFormat,
    modelData: shouldInlineModelData(modelFile) ? await fileToDataURL(modelFile) : '',
    modelResources,
  };
};

const getThreeObjectBoundingDimensions = (object) => {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  if (
    !Number.isFinite(size.x) || size.x <= 0.0001
    || !Number.isFinite(size.y) || size.y <= 0.0001
    || !Number.isFinite(size.z) || size.z <= 0.0001
  ) return null;
  return {
    width: numberValue(size.x, 2.2, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX),
    height: numberValue(size.y, 1.2, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX),
    depth: numberValue(size.z, 2.2, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX),
  };
};

export const measureThreeModelDimensions = (source, model = {}) => new Promise((resolve) => {
  if (!source) {
    resolve(null);
    return;
  }
  loadThreeModelFromSource(
    source,
    model,
    ({ object, format = '' } = {}) => {
      const modelFormat = format || model.modelFormat || '';
      if (!object) {
        resolve(null);
        return;
      }
      try {
        prepareGltfModel(object, getImportedModelPrepareOptions(modelFormat, {
          forceVisibleMeshes: true,
          forceVisibleMaterials: true,
          hasResourceTextures: hasThreeModelResources(model),
        }));
        resolve(getThreeObjectBoundingDimensions(object));
      } catch {
        resolve(null);
      } finally {
        disposeThreeObject(object);
      }
    },
    () => resolve(null),
  );
});

const measureImportedModelFileDimensions = async (file, model = {}) => {
  const inlineSource = shouldInlineModelData(file) ? await fileToDataURL(file) : '';
  if (inlineSource) return measureThreeModelDimensions(inlineSource, model);
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') return null;
  const objectUrl = URL.createObjectURL(file);
  try {
    return await measureThreeModelDimensions(objectUrl, model);
  } finally {
    URL.revokeObjectURL?.(objectUrl);
  }
};

export const readModelImport = async (file, fileInfo = getModelImportFileInfo(file), options = {}) => {
  const zipBundle = fileInfo.isZip ? await readModelZipBundle(file) : null;
  const sourceFile = zipBundle
    ? normalizeThreeModelFile(zipBundle.modelFile, zipBundle.modelFormat)
    : normalizeThreeModelFile(file, fileInfo.modelFormat);
  const sourceFormat = zipBundle?.modelFormat || fileInfo.modelFormat;
  const isGlb = sourceFormat === 'glb';
  const optimization = {
    file: sourceFile,
    optimized: false,
    originalSize: sourceFile?.size || 0,
    optimizedSize: sourceFile?.size || 0,
    imageCount: 0,
    skipped: isGlb,
    skipReason: isGlb ? 'preserve-original' : '',
  };
  const optimizedFile = sourceFile;
  const modelData = !shouldInlineModelData(optimizedFile)
    ? ''
    : zipBundle && optimizedFile === sourceFile
      ? zipBundle.modelData
      : await fileToDataURL(optimizedFile);
  const modelResources = zipBundle?.modelResources || [];
  const modelDimensions = options.measureDimensions
    ? await measureImportedModelFileDimensions(optimizedFile, {
      modelFormat: sourceFormat,
      modelName: optimizedFile?.name || sourceFile?.name || file?.name || '',
      modelResources,
    })
    : null;
  return {
    zipBundle,
    sourceFile,
    sourceFormat,
    isGlb,
    optimization,
    optimizedFile,
    modelData,
    modelDimensions,
    modelFileSize: Number(optimizedFile.size) || Number(sourceFile.size) || Number(file.size) || 0,
  };
};
export const readCharacterModelImport = readModelImport;
export const readDecorModelImport = (file, fileInfo = getModelImportFileInfo(file)) => (
  readModelImport(file, fileInfo, { measureDimensions: true })
);

export const readCharacterAnimationImport = async (file, fileInfo = getModelImportFileInfo(file)) => {
  const zipBundle = fileInfo.isZip ? await readModelZipBundle(file) : null;
  const sourceFile = zipBundle
    ? normalizeThreeModelFile(zipBundle.modelFile, zipBundle.modelFormat)
    : normalizeThreeModelFile(file, fileInfo.modelFormat);
  const sourceFormat = zipBundle?.modelFormat || fileInfo.modelFormat;
  const animationData = !shouldInlineModelData(sourceFile)
    ? ''
    : zipBundle && sourceFile === zipBundle.modelFile
      ? zipBundle.modelData
      : await fileToDataURL(sourceFile);
  return {
    zipBundle,
    sourceFile,
    sourceFormat,
    animationData,
    modelFileSize: Number(sourceFile.size) || Number(file.size) || 0,
  };
};

const disposeMaterial = (material) => {
  if (!material) return;
  if (material.userData?.disposeTextures) {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) value.dispose();
    });
  }
  material.dispose?.();
};

export const disposeThreeObject = (object) => {
  if (object?.userData) object.userData.disposed = true;
  object?.traverse?.((child) => {
    child.geometry?.dispose?.();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(disposeMaterial);
  });
};
export const disposeObject = disposeThreeObject;

export const clearGroup = (group) => {
  if (!group?.children) return;
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeThreeObject(child);
  });
};

const CHARACTER_PREVIEW_ANIMATION_CACHE_LIMIT = 12;
const characterPreviewAnimationCache = new Map();
const characterPreviewAnimationPending = new Map();

const hashString = (value = '') => [...String(value)].reduce((hash, char) => (
  ((hash << 5) - hash + char.charCodeAt(0)) | 0
), 0);

const hashSourceSample = (source = '') => {
  const value = String(source || '');
  if (value.length <= 4096) return hashString(value);
  const middle = Math.max(0, Math.floor(value.length / 2) - 512);
  return hashString([
    value.slice(0, 1024),
    value.slice(middle, middle + 1024),
    value.slice(-1024),
  ].join('|'));
};

const getPreviewSourceCacheSignature = (source = '') => {
  const value = String(source || '');
  if (!value) return 'empty';
  return `${value.length}:${hashSourceSample(value)}`;
};

const getPreviewResourceCacheSignature = (asset = {}) => (
  [
    ...(Array.isArray(asset.modelResources) ? asset.modelResources : []),
    ...(Array.isArray(asset.characterModelResources) ? asset.characterModelResources : []),
    ...(Array.isArray(asset.decorModelResources) ? asset.decorModelResources : []),
  ]
    .map((resource) => [
      resource?.path || resource?.name || '',
      getPreviewSourceCacheSignature(resource?.data || resource?.url || ''),
    ].join(':'))
    .join(';')
);

const getPreviewAssetCacheKey = (source = '', asset = {}) => [
  String(asset.modelName || asset.characterModelName || asset.decorModelName || asset.name || ''),
  String(asset.modelFormat || asset.characterModelFormat || asset.decorModelFormat || ''),
  Number(asset.modelFileSize || asset.characterModelFileSize || asset.decorModelFileSize) || 0,
  getPreviewSourceCacheSignature(source),
  getPreviewResourceCacheSignature(asset),
].join('|');

const getLimitedCacheEntry = (cache, key) => {
  if (!cache.has(key)) return null;
  const entry = cache.get(key);
  cache.delete(key);
  cache.set(key, entry);
  return entry;
};

const setLimitedCacheEntry = (cache, key, entry, limit, onEvict) => {
  if (cache.has(key)) cache.delete(key);
  cache.set(key, entry);
  while (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    const oldestEntry = cache.get(oldestKey);
    cache.delete(oldestKey);
    onEvict?.(oldestEntry);
  }
};

const getCachedCharacterPreviewAnimation = (source, animation = {}) => (
  getLimitedCacheEntry(characterPreviewAnimationCache, getPreviewAssetCacheKey(source, animation))
);

const setCachedCharacterPreviewAnimation = (source, animation = {}, entry = {}) => {
  setLimitedCacheEntry(
    characterPreviewAnimationCache,
    getPreviewAssetCacheKey(source, animation),
    entry,
    CHARACTER_PREVIEW_ANIMATION_CACHE_LIMIT,
  );
};

export const clearThreeCharacterPreviewCache = () => {
  characterPreviewAnimationCache.clear();
  characterPreviewAnimationPending.clear();
};

export const createPreviewFloorCanvas = (options = {}) => {
  const size = options.size || 512;
  const cellSize = options.cellSize || 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = options.backgroundColor || '#0f1b2d';
  ctx.fillRect(0, 0, size, size);
  for (let x = 0; x < size; x += cellSize) {
    for (let y = 0; y < size; y += cellSize) {
      ctx.fillStyle = ((x + y) / cellSize) % 2
        ? options.oddColor || '#172741'
        : options.evenColor || '#101d31';
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = options.cellLineColor || 'rgba(103, 232, 249, .11)';
      ctx.strokeRect(x + 0.5, y + 0.5, cellSize - 1, cellSize - 1);
    }
  }
  ctx.strokeStyle = options.markerColor || 'rgba(245, 158, 11, .2)';
  ctx.lineWidth = options.markerLineWidth || 5;
  if (options.markerShape === 'square') {
    const rect = options.markerRect || { x: 96, y: 96, width: 320, height: 320 };
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
  } else {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, options.markerRadius || 132, 0, Math.PI * 2);
    ctx.stroke();
  }
  return canvas;
};

export const createTexture = (src, repeat = false) => {
  if (!src) return null;
  const texture = new THREE.TextureLoader().load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
  }
  return texture;
};

export const makePreviewStandardMaterial = (color, options = {}) => {
  const texture = options.texture || null;
  const created = new THREE.MeshStandardMaterial({
    color: texture ? '#ffffff' : color,
    map: texture,
    roughness: options.roughness ?? 0.68,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive || '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent || false,
    opacity: options.opacity ?? 1,
    side: options.side || THREE.FrontSide,
  });
  if (texture) created.userData.disposeTextures = true;
  return created;
};

export const prepareRpg3DGltfModel = (object, options = {}) => {
  prepareGltfModel(object, options);
};

export const fitDecorModelObjectToDimensions = (object, model = {}, options = {}) => {
  const dimensions = options.dimensions || getDecorModelDimensions(model);
  const orientationObject = options.orientationObject || null;
  if (orientationObject && orientationObject !== object) {
    orientationObject.position.set(0, 0, 0);
    orientationObject.rotation.set(0, 0, 0);
    orientationObject.scale.set(1, 1, 1);
    orientationObject.updateMatrixWorld?.(true);
  }
  return fitObjectToDimensions(object, {
    width: dimensions.x,
    height: dimensions.y,
    depth: dimensions.z,
  }, { groundY: 0 });
};

export const buildDecorGltfObject = (object, model) => {
  const root = new THREE.Group();
  const group = new THREE.Group();
  const dimensions = getDecorModelDimensions(model);
  const width = dimensions.x;
  const depth = dimensions.z;
  const elevation = numberValue(model.elevation, 0, -1, 3);
  const texture = createTexture(model.imageData, Boolean(model.repeatTexture));

  applyModelRotation(group, model);

  const materialBrightness = getDecorMaterialBrightness(model);
  const isFloorLikeModel = isFloorTileKind(model.kind);
  prepareRpg3DGltfModel(object, {
    restoreTextureColor: true,
    forceLitMaterials: true,
    cloneMaterials: true,
    materialBrightness,
    maxEnvMapIntensity: isFloorLikeModel ? 0.42 : 1,
    maxEmissiveIntensity: isFloorLikeModel ? 0.03 : 0.18,
  });
  applyTextureToGltfModel(object, texture, { disposeTextureWithMaterial: true });
  rememberObjectBaseTransform(object);
  fitDecorModelObjectToDimensions(object, model, { dimensions });
  group.add(object);
  root.add(group);
  root.userData.decorModelObject = object;
  root.userData.decorOrientationObject = group;
  if (model.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(group);
  snapObjectToGround(group, elevation);
  if (model.modelFlushToGround) alignObjectTopToGround(group, elevation + 0.018);

  if (model.collision) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(Math.max(width, depth) * 0.52, 0.018, 8, 52),
      new THREE.MeshBasicMaterial({ color: '#f8fafc', transparent: true, opacity: 0.42 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.045;
    ring.userData.baseRadius = Math.max(width, depth);
    root.userData.decorCollisionRing = ring;
    root.add(ring);
  }

  return root;
};

export const loadThreeDecor = (sources, model, onLoaded, onError) => {
  const sourceList = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
  const handleLoaded = ({ object } = {}) => {
    if (!object) {
      onError?.(new Error('Objet 3D introuvable.'));
      return;
    }
    onLoaded?.(buildDecorGltfObject(object, model));
  };
  const trySource = (index = 0, lastError = null) => {
    const source = sourceList[index];
    if (!source) {
      onError?.(lastError || new Error('Source 3D introuvable.'));
      return;
    }
    loadThreeModelFromSource(source, model, handleLoaded, (error) => trySource(index + 1, error));
  };
  trySource();
};

export const loadThreeCharacter = (sources, model, onLoaded, onError) => {
  const sourceList = (Array.isArray(sources) ? sources : [sources]).filter(Boolean);
  const handleLoaded = ({ object, animations = [], format = '' } = {}) => {
    if (!object) {
      onError?.();
      return;
    }
    prepareRpg3DGltfModel(object, getImportedModelPrepareOptions(format, {
      restoreTextureColor: true,
      forceLitMaterials: true,
      hasResourceTextures: hasThreeModelResources(model),
      cloneMaterials: true,
      materialBrightness: getCharacterMaterialBrightness(model),
    }));
    const axisScale = getCharacterModelAxisScale(model);
    rememberObjectBaseTransform(object);
    fitObjectToHeight(object, 2 * axisScale.y, { groundY: 0 });
    applyObjectAxisScaleRatios(object, axisScale, axisScale.y, { groundY: 0 });
    onLoaded?.(object, animations);
  };
  const trySource = (index = 0, lastError = null) => {
    const source = sourceList[index];
    if (!source) {
      onError?.(lastError || new Error('Source 3D introuvable.'));
      return;
    }
    loadThreeModelFromSource(source, model, handleLoaded, (error) => trySource(index + 1, error));
  };
  trySource();
};

export const loadCharacterAnimationAsset = (animation = {}, options = {}) => new Promise((resolve) => {
  const source = getAnimationSource(animation);
  if (!source || isHeavyLocalFbxAnimationAsset({ ...animation, modelUrl: source })) {
    resolve({ clips: [], object: null, format: '' });
    return;
  }
  const cached = getCachedCharacterPreviewAnimation(source, animation);
  if (cached) {
    resolve({ clips: cached.clips || [], object: null, format: cached.format || '', cached: true });
    return;
  }
  const cacheKey = getPreviewAssetCacheKey(source, animation);
  const pending = characterPreviewAnimationPending.get(cacheKey);
  if (pending) {
    pending
      .then((entry) => resolve({ clips: entry.clips || [], object: null, format: entry.format || '', cached: true }))
      .catch(() => resolve({ clips: [], object: null, format: '' }));
    return;
  }
  const pendingLoad = new Promise((pendingResolve) => {
    loadThreeModelFromSource(
      source,
      animation,
      ({ object, animations = [], format = '' } = {}) => {
        const clips = Array.isArray(animations)
          ? animations.map((clip) => {
            if (clip) clip.userData = { ...(clip.userData || {}), rpg3dSourceFormat: format };
            return clip;
          })
          : [];
        const entry = { clips, format };
        setCachedCharacterPreviewAnimation(source, animation, entry);
        pendingResolve({ ...entry, object: object || null });
      },
      () => pendingResolve({ clips: [], object: null, format: '' }),
    );
  }).finally(() => {
    characterPreviewAnimationPending.delete(cacheKey);
  });
  characterPreviewAnimationPending.set(cacheKey, pendingLoad.then(({ clips, format }) => ({ clips, format })));
  pendingLoad.then(resolve);
});

export const loadCharacterAnimationClips = (animation = {}, options = {}) => new Promise((resolve) => {
  loadCharacterAnimationAsset(animation, options).then(({ clips, object }) => {
    if (object) disposeThreeObject(object);
    resolve(clips);
  });
});

export const getCharacterModelSources = getThreeModelSources;
export const getDecorModelSources = getThreeModelSources;
