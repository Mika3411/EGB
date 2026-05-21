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
  model.modelCenterOnOrigin ? 'center' : '',
  model.modelFlushToGround ? 'flush' : '',
  model.baseColor || '',
  model.accentColor || '',
  model.roofColor || '',
  model.collision ? 'collision' : '',
  model.repeatTexture ? 'repeat' : '',
  (model.modelResources || []).map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`).join(';'),
].join('|');

const THREE_MODEL_FORMATS = new Set(['glb', 'fbx', 'obj']);
const THREE_MODEL_ARCHIVE_FORMATS = new Set(['zip']);
const THREE_MODEL_MIME_FORMATS = {
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'glb',
  'model/obj': 'obj',
  'application/vnd.autodesk.fbx': 'fbx',
  'model/vnd.fbx': 'fbx',
};
const THREE_MODEL_ARCHIVE_MIME_FORMATS = {
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

const getDataUrlMimeType = (source = '') => (
  String(source || '').match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || ''
);

const getSourceExtension = (source = '') => {
  const withoutQuery = String(source || '').split(/[?#]/)[0];
  const extension = withoutQuery.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return THREE_MODEL_FORMATS.has(extension) ? extension : '';
};

export const getModelImportFormat = (modelOrSource = {}, source = '') => {
  const candidates = [];
  if (modelOrSource && typeof modelOrSource === 'object') {
    candidates.push(modelOrSource.modelFormat, modelOrSource.modelName, modelOrSource.name);
  } else {
    candidates.push(modelOrSource);
  }
  candidates.push(source);
  for (const candidate of candidates.filter(Boolean).map(String)) {
    const explicitFormat = candidate.toLowerCase();
    if (THREE_MODEL_FORMATS.has(explicitFormat)) return explicitFormat;
    const dataMimeType = getDataUrlMimeType(candidate);
    if (THREE_MODEL_MIME_FORMATS[dataMimeType]) return THREE_MODEL_MIME_FORMATS[dataMimeType];
    const extension = getSourceExtension(candidate);
    if (extension) return extension;
    const mimeFormat = THREE_MODEL_MIME_FORMATS[explicitFormat];
    if (mimeFormat) return mimeFormat;
  }
  return '';
};

export const getModelImportFileFormat = (file = null) => {
  if (!file) return '';
  return getModelImportFormat(file.name || '') || getModelImportFormat(file.type || '');
};

export const getModelImportArchiveFileFormat = (file = null) => {
  if (!file) return '';
  const extension = String(file.name || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  if (THREE_MODEL_ARCHIVE_FORMATS.has(extension)) return extension;
  return THREE_MODEL_ARCHIVE_MIME_FORMATS[String(file.type || '').toLowerCase()] || '';
};

export const getModelImportFileInfo = (file) => {
  const archiveFormat = getModelImportArchiveFileFormat(file);
  const modelFormat = archiveFormat ? '' : getModelImportFileFormat(file);
  return {
    archiveFormat,
    modelFormat,
    isZip: archiveFormat === 'zip',
  };
};
export const getCharacterImportFileInfo = getModelImportFileInfo;
export const getDecorImportFileInfo = getModelImportFileInfo;
