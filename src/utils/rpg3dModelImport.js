import * as THREE from 'three';
import JSZip from 'jszip';
import { fileToDataURL } from './fileHelpers';
import { optimizeCharacterGlbFile } from './glbOptimizer';
import {
  applyObjectAxisScaleRatios,
  applyTextureToGltfModel,
  fitObjectToDimensions,
  fitObjectToHeight,
  getImportedModelPrepareOptions,
  getThreeModelArchiveFileFormat,
  getThreeModelFileFormat,
  getThreeModelSources,
  hasThreeModelResources,
  loadThreeModelFromSource,
  normalizeThreeModelFile,
  prepareGltfModel,
  rememberObjectBaseTransform,
  snapObjectToGround,
} from './threeGltfUtils';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
export const numberValue = (value, fallback, min, max) => {
  const normalized = typeof value === 'string' ? value.replace(',', '.') : value;
  return clamp(Number.isFinite(Number(normalized)) ? Number(normalized) : fallback, min, max);
};

export const resizeAxesProportionally = (axes = {}, changedAxis = 'x', nextAxisValue = 1, min = 0.001, max = 1000) => {
  const axisIds = ['x', 'y', 'z'];
  if (!axisIds.includes(changedAxis)) return axes;
  const axisValue = (value, fallback = 1) => Number(numberValue(value, fallback, min, max).toFixed(4));
  const currentAxes = axisIds.reduce((next, axisId) => ({
    ...next,
    [axisId]: axisValue(axes[axisId]),
  }), {});
  const currentAxisValue = currentAxes[changedAxis] || 1;
  const desiredFactor = axisValue(nextAxisValue, currentAxisValue) / currentAxisValue;
  const minFactor = axisIds.reduce((factor, axisId) => Math.max(factor, min / currentAxes[axisId]), 0);
  const maxFactor = axisIds.reduce((factor, axisId) => Math.min(factor, max / currentAxes[axisId]), Infinity);
  const factor = clamp(Number.isFinite(desiredFactor) && desiredFactor > 0 ? desiredFactor : 1, minFactor, maxFactor);
  return axisIds.reduce((next, axisId) => ({
    ...next,
    [axisId]: axisValue(currentAxes[axisId] * factor, currentAxes[axisId]),
  }), {});
};

export const CHARACTER_MATERIAL_BRIGHTNESS_MIN = 0.25;
export const CHARACTER_MATERIAL_BRIGHTNESS_MAX = 1.4;
export const CHARACTER_MODEL_SCALE_MIN = 0.4;
export const CHARACTER_MODEL_SCALE_MAX = 20;
export const DEFAULT_FLOOR_ZERO_Z = 2.5;
export const FLOOR_ZERO_Z_MIN = -120;
export const FLOOR_ZERO_Z_MAX = 120;
export const DECOR_MODEL_SCALE_MIN = 0.5;
export const DECOR_MODEL_SCALE_MAX = 20;
export const DECOR_MODEL_DIMENSION_MIN = 0.05;
export const DECOR_MODEL_DIMENSION_MAX = 120;
export const DECOR_MATERIAL_BRIGHTNESS_MIN = 0.25;
export const DECOR_MATERIAL_BRIGHTNESS_MAX = 1.4;
export const DECOR_FLOOR_MATERIAL_BRIGHTNESS = 0.55;
export const INLINE_MODEL_DATA_MAX_BYTES = 24 * 1024 * 1024;
export const LOCAL_FBX_AUTO_PREVIEW_MAX_BYTES = 24 * 1024 * 1024;

export const CHARACTER_ANIMATION_SLOTS = [
  { id: 'walk', label: 'Marche', importedLabel: 'Animation marche' },
  { id: 'attack', label: 'Attaque', importedLabel: 'Animation attaque' },
];

export const getCharacterMaterialBrightness = (model = {}) => numberValue(
  model.materialBrightness,
  1,
  CHARACTER_MATERIAL_BRIGHTNESS_MIN,
  CHARACTER_MATERIAL_BRIGHTNESS_MAX,
);
export const getCharacterModelScale = (model = {}) => numberValue(
  model.characterModelScaleY ?? model.modelScaleY ?? model.characterModelScale ?? model.modelScale,
  1,
  CHARACTER_MODEL_SCALE_MIN,
  CHARACTER_MODEL_SCALE_MAX,
);
export const getCharacterModelAxisScale = (model = {}) => {
  const uniform = getCharacterModelScale(model);
  return {
    x: numberValue(model.characterModelScaleX ?? model.modelScaleX, uniform, CHARACTER_MODEL_SCALE_MIN, CHARACTER_MODEL_SCALE_MAX),
    y: numberValue(model.characterModelScaleY ?? model.modelScaleY, uniform, CHARACTER_MODEL_SCALE_MIN, CHARACTER_MODEL_SCALE_MAX),
    z: numberValue(model.characterModelScaleZ ?? model.modelScaleZ, uniform, CHARACTER_MODEL_SCALE_MIN, CHARACTER_MODEL_SCALE_MAX),
  };
};
export const isCharacterModelScaleProportional = (model = {}) => model.characterModelScaleProportional !== false;

const LEGACY_DECOR_KIND_MAP = {
  billboard: 'decor',
  crate: 'wall',
  rock: 'decor',
  tree: 'decor',
};

export const getDecorKindId = (kind = '') => LEGACY_DECOR_KIND_MAP[kind] || kind || 'decor';
export const isFloorTileKind = (kind = '') => ['road', 'water'].includes(getDecorKindId(kind));
export const getFloorTileSize = (model = {}) => numberValue(Math.max(Number(model.width) || 0, Number(model.depth) || 0), 2.2, 0.4, 8);
export const getDefaultDecorMaterialBrightness = (model = {}) => (isFloorTileKind(model.kind) ? DECOR_FLOOR_MATERIAL_BRIGHTNESS : 1);
export const getDecorMaterialBrightness = (model = {}) => numberValue(
  model.materialBrightness,
  getDefaultDecorMaterialBrightness(model),
  DECOR_MATERIAL_BRIGHTNESS_MIN,
  DECOR_MATERIAL_BRIGHTNESS_MAX,
);
export const getDecorModelScale = (model = {}) => numberValue(
  model.scale,
  1,
  DECOR_MODEL_SCALE_MIN,
  DECOR_MODEL_SCALE_MAX,
);
export const hasImportedDecorModel = (model = {}) => Boolean(model.modelUrl || model.modelData);
export const getDecorModelFitHeight = (model = {}) => {
  return numberValue(model.height, 1.2, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX);
};
export const getDecorModelDimensions = (model = {}) => {
  const legacyScale = getDecorModelScale(model);
  return {
    x: numberValue(model.width, 2.2, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX) * legacyScale,
    y: getDecorModelFitHeight(model) * legacyScale,
    z: numberValue(model.depth, 2.2, DECOR_MODEL_DIMENSION_MIN, DECOR_MODEL_DIMENSION_MAX) * legacyScale,
  };
};
export const isDecorModelSizeProportional = (model = {}) => Boolean(model.modelSizeProportional);
export const getFloorZeroZ = (model = {}) => numberValue(model.floorZeroZ, DEFAULT_FLOOR_ZERO_Z, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
export const getModelRotationValue = (model = {}, field = 'modelRotationX') => numberValue(model[field], 0, -180, 180);
export const getModelRotationX = (model = {}) => getModelRotationValue(model, 'modelRotationX');
export const getModelRotationY = (model = {}) => getModelRotationValue(model, 'modelRotationY');
export const getModelRotationZ = (model = {}) => getModelRotationValue(model, 'modelRotationZ');
export const degreesToRadians = (degrees = 0) => (Number(degrees) || 0) * (Math.PI / 180);
export const applyModelRotation = (object, model = {}) => {
  object?.rotation?.set(
    degreesToRadians(getModelRotationX(model)),
    degreesToRadians(getModelRotationY(model)),
    degreesToRadians(getModelRotationZ(model)),
  );
};

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

export const getPreviewLightIntensity = (model = {}) => numberValue(model.previewLightIntensity, 1, 0.2, 2.5);
export const getPreviewLightOrientation = (model = {}) => numberValue(model.previewLightOrientation, -35, -180, 180);

export const shouldInlineModelData = (file) => (Number(file?.size) || 0) <= INLINE_MODEL_DATA_MAX_BYTES;

export const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');

export const isHeavyLocalFbxAsset = (asset = {}) => (
  String(asset.modelFormat || '').toLowerCase() === 'fbx'
  && isBlobUrl(asset.modelUrl)
  && (Number(asset.modelFileSize) || 0) > LOCAL_FBX_AUTO_PREVIEW_MAX_BYTES
);

export const getAnimationSource = (animation = {}) => {
  if (String(animation.modelData || '').startsWith('data:')) return animation.modelData;
  return animation.modelUrl || animation.modelData || '';
};

export const getAnimationSignature = (animations = {}) => CHARACTER_ANIMATION_SLOTS.map(({ id }) => {
  const animation = animations?.[id] || {};
  return [
    id,
    animation.modelUrl || '',
    animation.modelData || '',
    animation.modelName || '',
    animation.modelFormat || '',
    animation.modelFileSize || '',
    (animation.modelResources || []).map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`).join(','),
  ].join(':');
}).join('|');

export const getEmbeddedAnimationSignature = (clips = []) => (
  clips.map((clip) => `${clip.name || ''}:${Number(clip.duration || 0).toFixed(3)}:${clip.trackCount || 0}`).join('|')
);

export const summarizeEmbeddedAnimationClips = (clips = []) => (
  clips
    .filter((clip) => clip && Number(clip.duration) > 0)
    .map((clip) => ({
      name: clip.name || 'Animation',
      duration: Number(clip.duration) || 0,
      trackCount: Array.isArray(clip.tracks) ? clip.tracks.length : Number(clip.trackCount) || 0,
    }))
);

export const getPreviewAnimationSlot = (model = {}, requestedSlot = '') => {
  if (requestedSlot && getAnimationSource(model.modelAnimations?.[requestedSlot] || {})) return requestedSlot;
  if (getAnimationSource(model.modelAnimations?.walk || {})) return 'walk';
  if (getAnimationSource(model.modelAnimations?.attack || {})) return 'attack';
  return '';
};

export const getPreviewAnimationOptions = (slot = '') => {
  if (slot === 'walk') return { preferredNames: ['walk', 'run', 'move', 'locomotion'], fallbackToFirst: true };
  if (slot === 'attack') return { preferredNames: ['attack', 'cast', 'spell', 'shoot', 'fire'], fallbackToFirst: true };
  return { preferredNames: ['idle', 'stand', 'breath', 'wait', 'walk', 'run', 'attack', 'cast', 'spell'], fallbackToFirst: true };
};

export const getCharacterBuildSignature = (model = {}) => [
  model.id || '',
  model.shape || '',
  model.modelUrl || '',
  model.modelData || '',
  model.modelName || '',
  model.modelFormat || '',
  model.modelFileSize || '',
  (model.modelResources || []).map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`).join(';'),
  getCharacterMaterialBrightness(model),
  getAnimationSignature(model.modelAnimations),
].join('|');

export const getDecorBuildSignature = (model = {}) => [
  model.id || '',
  model.kind || '',
  model.modelUrl || '',
  model.modelData || '',
  model.modelName || '',
  model.imageData || '',
  model.imageName || '',
  model.elevation || '',
  model.modelRotationX || '',
  model.modelRotationY || '',
  model.modelRotationZ || '',
  model.modelCenterOnOrigin ? 'center' : '',
  model.modelFlushToGround ? 'flush' : '',
  getDecorMaterialBrightness(model),
  model.baseColor || '',
  model.accentColor || '',
  model.roofColor || '',
  model.collision ? 'collision' : '',
  model.repeatTexture ? 'repeat' : '',
  (model.modelResources || []).map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`).join(';'),
].join('|');

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

export const getModelImportFileInfo = (file) => {
  const archiveFormat = getThreeModelArchiveFileFormat(file);
  const modelFormat = archiveFormat ? '' : getThreeModelFileFormat(file);
  return {
    archiveFormat,
    modelFormat,
    isZip: archiveFormat === 'zip',
  };
};
export const getCharacterImportFileInfo = getModelImportFileInfo;
export const getDecorImportFileInfo = getModelImportFileInfo;

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
  const optimization = isGlb
    ? await optimizeCharacterGlbFile(sourceFile)
    : {
      file: sourceFile,
      optimized: false,
      originalSize: sourceFile?.size || 0,
      optimizedSize: sourceFile?.size || 0,
      imageCount: 0,
    };
  const optimizedFile = optimization.file || sourceFile;
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
  fitObjectToDimensions(object, {
    width: dimensions.x,
    height: dimensions.y,
    depth: dimensions.z,
  }, { groundY: 0 });
  group.add(object);
  root.add(group);
  root.userData.decorModelObject = object;
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
      onError?.();
      return;
    }
    onLoaded?.(buildDecorGltfObject(object, model));
  };
  const trySource = (index = 0) => {
    const source = sourceList[index];
    if (!source) {
      onError?.();
      return;
    }
    loadThreeModelFromSource(source, model, handleLoaded, () => trySource(index + 1));
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

export const loadCharacterAnimationClips = (animation = {}) => new Promise((resolve) => {
  const source = getAnimationSource(animation);
  if (!source || isHeavyLocalFbxAsset({ ...animation, modelUrl: source })) {
    resolve([]);
    return;
  }
  loadThreeModelFromSource(
    source,
    animation,
    ({ object, animations = [] } = {}) => {
      if (object) disposeThreeObject(object);
      resolve(Array.isArray(animations) ? animations : []);
    },
    () => resolve([]),
  );
});

export const getCharacterModelSources = getThreeModelSources;
export const getDecorModelSources = getThreeModelSources;
