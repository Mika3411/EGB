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
export const DECOR_MODEL_DIMENSION_MIN = 0.001;
export const DECOR_MODEL_DIMENSION_MAX = 120;
export const DECOR_MATERIAL_BRIGHTNESS_MIN = 0.25;
export const DECOR_MATERIAL_BRIGHTNESS_MAX = 1.4;
export const DECOR_FLOOR_MATERIAL_BRIGHTNESS = 0.55;
export const INLINE_MODEL_DATA_MAX_BYTES = 24 * 1024 * 1024;
export const LOCAL_FBX_ANIMATION_PREVIEW_MAX_BYTES = 192 * 1024 * 1024;
export const LOCAL_FBX_AUTO_PREVIEW_MAX_BYTES = INLINE_MODEL_DATA_MAX_BYTES;

export const CHARACTER_ANIMATION_SLOTS = [
  { id: 'idle', label: 'Stand-by', importedLabel: 'Animation stand-by' },
  { id: 'walk', label: 'Marche', importedLabel: 'Animation marche' },
  { id: 'attack', label: 'Attaque', importedLabel: 'Animation attaque' },
];
const CHARACTER_ANIMATION_SLOT_ORDER = CHARACTER_ANIMATION_SLOTS.map(({ id }) => id);
const CHARACTER_ANIMATION_SLOT_IDS = new Set(CHARACTER_ANIMATION_SLOT_ORDER);

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
export const isInventoryDecorKind = (kind = '') => String(getDecorKindId(kind)).startsWith('inventory-');
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

export const isHeavyLocalFbxAnimationAsset = (asset = {}) => (
  String(asset.modelFormat || '').toLowerCase() === 'fbx'
  && isBlobUrl(asset.modelUrl)
  && (Number(asset.modelFileSize) || 0) > LOCAL_FBX_ANIMATION_PREVIEW_MAX_BYTES
);

export const getAnimationSource = (animation = {}) => {
  if (String(animation.modelData || '').startsWith('data:')) return animation.modelData;
  return animation.modelUrl || animation.modelData || '';
};

const getAnimationSlotFromText = (value = '') => {
  const text = String(value || '');
  if (CHARACTER_ANIMATION_SLOT_IDS.has(text)) return text;
  return CHARACTER_ANIMATION_SLOT_ORDER.find((slot) => text.startsWith(`${slot}__`)) || '';
};

export const getAnimationBaseSlotId = (animationKey = '', animation = {}) => {
  const metadataSlot = getAnimationSlotFromText(animation?.animationSlot)
    || getAnimationSlotFromText(animation?.slot)
    || getAnimationSlotFromText(animation?.state);
  if (metadataSlot) return metadataSlot;
  return getAnimationSlotFromText(animationKey);
};

const compareAnimationEntries = (left, right) => {
  const leftBase = getAnimationBaseSlotId(left.key, left.animation);
  const rightBase = getAnimationBaseSlotId(right.key, right.animation);
  const leftSlotIndex = CHARACTER_ANIMATION_SLOT_ORDER.indexOf(leftBase);
  const rightSlotIndex = CHARACTER_ANIMATION_SLOT_ORDER.indexOf(rightBase);
  if (leftSlotIndex !== rightSlotIndex) return leftSlotIndex - rightSlotIndex;
  if (left.key === leftBase && right.key !== rightBase) return -1;
  if (right.key === rightBase && left.key !== leftBase) return 1;
  return left.index - right.index;
};

export const getAnimationEntriesForSlot = (animations = {}, slot = '') => {
  const baseSlot = getAnimationBaseSlotId(slot);
  if (!baseSlot || !animations || typeof animations !== 'object') return [];
  return Object.entries(animations)
    .map(([key, animation], index) => ({ key, animation: animation || {}, index }))
    .filter((entry) => (
      entry.animation
      && typeof entry.animation === 'object'
      && getAnimationBaseSlotId(entry.key, entry.animation) === baseSlot
      && getAnimationSource(entry.animation)
    ))
    .sort(compareAnimationEntries)
    .map(({ key, animation }) => ({ key, animation }));
};

export const getFirstAnimationEntryForSlot = (animations = {}, slot = '') => (
  getAnimationEntriesForSlot(animations, slot)[0] || null
);

export const getAnimationSignature = (animations = {}) => (
  Object.entries(animations && typeof animations === 'object' ? animations : {})
    .map(([key, animation], index) => ({
      key,
      animation: animation || {},
      baseSlot: getAnimationBaseSlotId(key, animation || {}),
      index,
    }))
    .filter((entry) => entry.baseSlot && getAnimationSource(entry.animation))
    .sort(compareAnimationEntries)
    .map(({ key, baseSlot, animation }) => [
      key,
      baseSlot,
      animation.modelUrl || '',
      animation.modelData || '',
      animation.localModelFileId || '',
      animation.modelName || '',
      animation.modelFormat || '',
      animation.modelFileSize || '',
      (animation.modelResources || []).map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`).join(','),
    ].join(':'))
    .join('|')
);

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
  const animations = model.modelAnimations || {};
  if (requestedSlot) {
    const requestedAnimation = animations?.[requestedSlot] || {};
    if (getAnimationBaseSlotId(requestedSlot, requestedAnimation) && getAnimationSource(requestedAnimation)) return requestedSlot;
    return getFirstAnimationEntryForSlot(animations, requestedSlot)?.key || '';
  }
  for (const slot of CHARACTER_ANIMATION_SLOT_ORDER) {
    const entry = getFirstAnimationEntryForSlot(animations, slot);
    if (entry?.key) return entry.key;
  }
  return '';
};

export const getPreviewAnimationOptions = (slot = '') => {
  const baseSlot = getAnimationBaseSlotId(slot);
  if (baseSlot === 'idle') return { preferredNames: ['idle', 'stand', 'breath', 'wait'], fallbackToFirst: true };
  if (baseSlot === 'walk') return { preferredNames: ['walk', 'run', 'move', 'locomotion'], fallbackToFirst: true };
  if (baseSlot === 'attack') {
    return {
      preferredNames: ['attack', 'atk', 'counter', 'hit', 'slash', 'melee', 'cast', 'spell', 'shoot', 'fire'],
      fallbackToFirst: true,
    };
  }
  return { preferredNames: ['idle', 'stand', 'breath', 'wait', 'walk', 'run', 'attack', 'cast', 'spell'], fallbackToFirst: true };
};

const getEquipmentSignature = (items = []) => (
  (Array.isArray(items) ? items : [])
    .filter((item) => item?.type === 'weapon' || item?.type === 'shield' || item?.type === 'armor')
    .map((item) => [
      item.id || '',
      item.type || '',
      item.equipped ? 1 : 0,
      item.weaponModel3dId || item.model3dId || '',
      item.weaponModelUrl || item.modelUrl || '',
      item.weaponModelName || item.modelName || '',
      item.weaponModelScale || '',
      item.weaponModelSourceScale || '',
      item.weaponModelRotationX || '',
      item.weaponModelRotationY || '',
      item.weaponModelRotationZ || '',
      item.weaponOffsetX || '',
      item.weaponOffsetY || '',
      item.weaponOffsetZ || '',
      item.weaponRotationX || '',
      item.weaponRotationY || '',
      item.weaponRotationZ || '',
      item.weaponGripHand || '',
      item.weaponGripReferenceScale || '',
      item.weaponGripRightEnabled ? 1 : 0,
      item.weaponGripRightX || '',
      item.weaponGripRightY || '',
      item.weaponGripRightZ || '',
      item.weaponGripRightRotationX || '',
      item.weaponGripRightRotationY || '',
      item.weaponGripRightRotationZ || '',
      item.weaponGripLeftEnabled ? 1 : 0,
      item.weaponGripLeftX || '',
      item.weaponGripLeftY || '',
      item.weaponGripLeftZ || '',
      item.weaponGripLeftRotationX || '',
      item.weaponGripLeftRotationY || '',
      item.weaponGripLeftRotationZ || '',
      item.shieldGripArm || '',
      item.shieldGripReferenceScale || '',
      item.shieldGripHandEnabled ? 1 : 0,
      item.shieldGripHandX || '',
      item.shieldGripHandY || '',
      item.shieldGripHandZ || '',
      item.shieldGripElbowEnabled ? 1 : 0,
      item.shieldGripElbowX || '',
      item.shieldGripElbowY || '',
      item.shieldGripElbowZ || '',
      item.armorGripReferenceScale || '',
      item.armorGripLeftShoulderEnabled ? 1 : 0,
      item.armorGripLeftShoulderX || '',
      item.armorGripLeftShoulderY || '',
      item.armorGripLeftShoulderZ || '',
      item.armorGripRightShoulderEnabled ? 1 : 0,
      item.armorGripRightShoulderX || '',
      item.armorGripRightShoulderY || '',
      item.armorGripRightShoulderZ || '',
      item.armorGripLeftElbowEnabled ? 1 : 0,
      item.armorGripLeftElbowX || '',
      item.armorGripLeftElbowY || '',
      item.armorGripLeftElbowZ || '',
      item.armorGripRightElbowEnabled ? 1 : 0,
      item.armorGripRightElbowX || '',
      item.armorGripRightElbowY || '',
      item.armorGripRightElbowZ || '',
      item.armorGripLowerBellyEnabled ? 1 : 0,
      item.armorGripLowerBellyX || '',
      item.armorGripLowerBellyY || '',
      item.armorGripLowerBellyZ || '',
      item.armorCanvasCutEnabled ? 1 : 0,
      JSON.stringify(Array.isArray(item.armorSegmentAssignments) ? item.armorSegmentAssignments : []),
      JSON.stringify(Array.isArray(item.armorCutContours) ? item.armorCutContours : []),
      JSON.stringify(Array.isArray(item.armorCutPaintStrokes) ? item.armorCutPaintStrokes : []),
    ].join(':'))
    .join(';')
);

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
  getEquipmentSignature(model.inventory),
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
