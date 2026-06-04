import {
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
  normalizeCharacterRigPoints,
} from './projectData3dRigSchema.js';
import {
  CHARACTER_ANIMATION_SLOTS,
  getAnimationBaseSlotId,
} from './projectData3dAnimationSchema.js';

const clampNumber = (value, fallback, min, max) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(min, Math.min(max, numericValue));
};

const normalizeAllowedValue = (value, allowedValues, fallback) => (
  allowedValues.includes(value) ? value : fallback
);

const DECOR_KIND_VALUE_MAP = {
  billboard: 'decor',
  crate: 'wall',
  rock: 'decor',
  tree: 'decor',
};
const DECOR_KIND_VALUES = [
  'decor',
  'road',
  'water',
  'wall',
  'house',
  'inventory-weapon',
  'inventory-armor',
  'inventory-helmet',
  'inventory-shield',
  'inventory-leggings',
  'inventory-jewelry',
  'inventory-misc',
];
const normalizeDecorKind = (value) => {
  const normalizedValue = normalizeLegacyTechnicalValue(value);
  return normalizeAllowedValue(DECOR_KIND_VALUE_MAP[normalizedValue] || normalizedValue, DECOR_KIND_VALUES, 'decor');
};

const CHARACTER_3D_ANIMATION_SLOTS = CHARACTER_ANIMATION_SLOTS.map(({ id }) => id);
const CHARACTER_3D_EQUIPMENT_TYPES = ['weapon', 'shield', 'armor', 'helmet', 'leggings'];
const EQUIPMENT_HAND_VALUES = ['right', 'left'];
const normalizeEquipmentHand = (value = '') => (
  EQUIPMENT_HAND_VALUES.includes(value) ? value : 'right'
);
const normalizeEquipmentArm = (value = '') => (
  EQUIPMENT_HAND_VALUES.includes(value) ? value : 'left'
);
const ARMOR_SEGMENT_VALUES = ['body', 'left-arm', 'right-arm'];
const normalizeArmorSegment = (value = '') => (
  ARMOR_SEGMENT_VALUES.includes(value) ? value : 'body'
);
const normalizeArmorSegmentAssignments = (assignments = []) => (
  Array.isArray(assignments)
    ? assignments.map((entry) => ({
      path: String(entry?.path || '').slice(0, 260),
      name: String(entry?.name || '').slice(0, 120),
      segment: normalizeArmorSegment(entry?.segment),
    })).filter((entry) => entry.path)
    : []
);
const normalizeArmorCutContourPoint = (point = {}) => ({
  x: clampNumber(point?.x, 0, -2, 2),
  y: clampNumber(point?.y, 0, -2, 2),
  z: clampNumber(point?.z, 0, -2, 2),
  ...normalizeArmorPaintSurfaceNormal(point),
});
const normalizeArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: nx / length,
    ny: ny / length,
    nz: nz / length,
  };
};
const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeArmorSegment(entry?.segment),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 80)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeArmorSegment(entry?.segment),
      radius: clampNumber(entry?.radius, 0.14, 0.04, 0.5),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 240)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const normalizeEquipmentGripFields = (source = {}) => ({
  weaponGripHand: normalizeEquipmentHand(source.weaponGripHand),
  weaponGripReferenceScale: clampNumber(source.weaponGripReferenceScale, 1, 0.001, 120),
  weaponGripRightEnabled: Boolean(source.weaponGripRightEnabled),
  weaponGripRightX: clampNumber(source.weaponGripRightX, 0, -2, 2),
  weaponGripRightY: clampNumber(source.weaponGripRightY, 0, -2, 2),
  weaponGripRightZ: clampNumber(source.weaponGripRightZ, 0, -2, 2),
  weaponGripRightRotationX: clampNumber(source.weaponGripRightRotationX, 0, -180, 180),
  weaponGripRightRotationY: clampNumber(source.weaponGripRightRotationY, 0, -180, 180),
  weaponGripRightRotationZ: clampNumber(source.weaponGripRightRotationZ, 0, -180, 180),
  weaponGripLeftEnabled: Boolean(source.weaponGripLeftEnabled),
  weaponGripLeftX: clampNumber(source.weaponGripLeftX, 0, -2, 2),
  weaponGripLeftY: clampNumber(source.weaponGripLeftY, 0, -2, 2),
  weaponGripLeftZ: clampNumber(source.weaponGripLeftZ, 0, -2, 2),
  weaponGripLeftRotationX: clampNumber(source.weaponGripLeftRotationX, 0, -180, 180),
  weaponGripLeftRotationY: clampNumber(source.weaponGripLeftRotationY, 0, -180, 180),
  weaponGripLeftRotationZ: clampNumber(source.weaponGripLeftRotationZ, 0, -180, 180),
  shieldGripArm: normalizeEquipmentArm(source.shieldGripArm),
  shieldGripReferenceScale: clampNumber(source.shieldGripReferenceScale, 1, 0.001, 120),
  shieldGripHandEnabled: Boolean(source.shieldGripHandEnabled),
  shieldGripHandX: clampNumber(source.shieldGripHandX, 0, -2, 2),
  shieldGripHandY: clampNumber(source.shieldGripHandY, -0.35, -2, 2),
  shieldGripHandZ: clampNumber(source.shieldGripHandZ, 0, -2, 2),
  shieldGripElbowEnabled: Boolean(source.shieldGripElbowEnabled),
  shieldGripElbowX: clampNumber(source.shieldGripElbowX, 0, -2, 2),
  shieldGripElbowY: clampNumber(source.shieldGripElbowY, 0.35, -2, 2),
  shieldGripElbowZ: clampNumber(source.shieldGripElbowZ, 0, -2, 2),
  armorGripReferenceScale: clampNumber(source.armorGripReferenceScale, 1, 0.001, 120),
  armorGripLeftShoulderEnabled: Boolean(source.armorGripLeftShoulderEnabled),
  armorGripLeftShoulderX: clampNumber(source.armorGripLeftShoulderX, -0.45, -2, 2),
  armorGripLeftShoulderY: clampNumber(source.armorGripLeftShoulderY, 0.55, -2, 2),
  armorGripLeftShoulderZ: clampNumber(source.armorGripLeftShoulderZ, 0, -2, 2),
  armorGripRightShoulderEnabled: Boolean(source.armorGripRightShoulderEnabled),
  armorGripRightShoulderX: clampNumber(source.armorGripRightShoulderX, 0.45, -2, 2),
  armorGripRightShoulderY: clampNumber(source.armorGripRightShoulderY, 0.55, -2, 2),
  armorGripRightShoulderZ: clampNumber(source.armorGripRightShoulderZ, 0, -2, 2),
  armorGripLeftElbowEnabled: Boolean(source.armorGripLeftElbowEnabled),
  armorGripLeftElbowX: clampNumber(source.armorGripLeftElbowX, -0.65, -2, 2),
  armorGripLeftElbowY: clampNumber(source.armorGripLeftElbowY, 0.05, -2, 2),
  armorGripLeftElbowZ: clampNumber(source.armorGripLeftElbowZ, 0, -2, 2),
  armorGripRightElbowEnabled: Boolean(source.armorGripRightElbowEnabled),
  armorGripRightElbowX: clampNumber(source.armorGripRightElbowX, 0.65, -2, 2),
  armorGripRightElbowY: clampNumber(source.armorGripRightElbowY, 0.05, -2, 2),
  armorGripRightElbowZ: clampNumber(source.armorGripRightElbowZ, 0, -2, 2),
  armorGripLowerBellyEnabled: Boolean(source.armorGripLowerBellyEnabled),
  armorGripLowerBellyX: clampNumber(source.armorGripLowerBellyX, 0, -2, 2),
  armorGripLowerBellyY: clampNumber(source.armorGripLowerBellyY, -0.55, -2, 2),
  armorGripLowerBellyZ: clampNumber(source.armorGripLowerBellyZ, 0, -2, 2),
  ...CHARACTER_RIG_ARMOR_GRIP_POINTS.reduce((fields, point) => ({
    ...fields,
    [`armorGrip${point.suffix}Enabled`]: Boolean(source[`armorGrip${point.suffix}Enabled`]),
    [`armorGrip${point.suffix}X`]: clampNumber(source[`armorGrip${point.suffix}X`], point.defaultX, -2, 2),
    [`armorGrip${point.suffix}Y`]: clampNumber(source[`armorGrip${point.suffix}Y`], point.defaultY, -2, 2),
    [`armorGrip${point.suffix}Z`]: clampNumber(source[`armorGrip${point.suffix}Z`], point.defaultZ, -2, 2),
  }), {}),
  armorCanvasCutEnabled: Boolean(source.armorCanvasCutEnabled),
  armorSegmentAssignments: normalizeArmorSegmentAssignments(source.armorSegmentAssignments),
  armorCutContours: normalizeArmorCutContours(source.armorCutContours),
  armorCutPaintStrokes: normalizeArmorCutPaintStrokes(source.armorCutPaintStrokes),
});

const normalizeEquipmentModelRotationFields = (source = {}) => ({
  weaponModelRotationX: clampNumber(source.weaponModelRotationX ?? source.modelRotationX, 0, -180, 180),
  weaponModelRotationY: clampNumber(source.weaponModelRotationY ?? source.modelRotationY, 0, -180, 180),
  weaponModelRotationZ: clampNumber(source.weaponModelRotationZ ?? source.modelRotationZ, 0, -180, 180),
});
const normalizeModelResourceEntries = (resources = []) => (
  Array.isArray(resources)
    ? resources.map((resource) => ({
      path: resource?.path || resource?.name || '',
      name: resource?.name || resource?.path || '',
      data: resource?.data || '',
      url: resource?.url || '',
      storageMode: resource?.storageMode || '',
      storagePath: resource?.storagePath || '',
      storageBucket: resource?.storageBucket || '',
    })).filter((resource) => resource.path && (resource.data || resource.url))
    : []
);
const normalizeCharacter3DAnimations = (animations = {}) => (
  Object.entries(animations && typeof animations === 'object' ? animations : {}).reduce((next, [key, animation]) => {
    if (!animation || typeof animation !== 'object') return next;
    const animationSlot = getAnimationBaseSlotId(key, animation);
    if (!CHARACTER_3D_ANIMATION_SLOTS.includes(animationSlot)) return next;
    const modelUrl = animation.modelUrl || animation.url || '';
    const modelData = animation.modelData || animation.data || '';
    if (!modelUrl && !modelData) return next;
    next[key] = {
      animationSlot,
      animationId: animation.animationId || animation.id || key,
      modelUrl,
      modelData,
      localModelFileId: animation.localModelFileId || '',
      modelName: animation.modelName || animation.name || '',
      modelFormat: animation.modelFormat || '',
      modelFileSize: Number(animation.modelFileSize) || 0,
      modelResources: normalizeModelResourceEntries(animation.modelResources || animation.resources || []),
      storageMode: animation.storageMode || '',
      storagePath: animation.storagePath || '',
      storageBucket: animation.storageBucket || '',
    };
    return next;
  }, {})
);

const normalizeCharacter3DEquipment = (items = []) => (
  Array.isArray(items)
    ? items
      .map((item, index) => {
        const type = CHARACTER_3D_EQUIPMENT_TYPES.includes(item?.type) ? item.type : '';
        if (!type) return null;
        const modelId = item.weaponModel3dId || item.model3dId || '';
        const modelUrl = item.weaponModelUrl || item.modelUrl || '';
        if (!modelId && !modelUrl) return null;
        return {
          id: item.id || `character-equipment-${type}-${index + 1}`,
          name: item.name || (type === 'shield' ? 'Bouclier' : (type === 'armor' ? 'Armure' : (type === 'helmet' ? 'Casque' : (type === 'leggings' ? 'Jambieres' : 'Arme')))),
          type,
          quantity: 1,
          effect: item.effect || '',
          equipped: item.equipped !== false,
          weaponModel3dId: modelId,
          weaponModelUrl: modelUrl,
          weaponModelName: item.weaponModelName || item.modelName || '',
          weaponModelFormat: item.weaponModelFormat || item.modelFormat || '',
          weaponModelFileSize: Number(item.weaponModelFileSize || item.modelFileSize) || 0,
          weaponModelResources: normalizeModelResourceEntries(item.weaponModelResources || item.modelResources || []),
          weaponModelScale: clampNumber(item.weaponModelScale, 1, 0.001, 8),
          weaponModelSourceScale: clampNumber(item.weaponModelSourceScale, 0, 0, 8),
          weaponModelWidth: clampNumber(item.weaponModelWidth, item.weaponModelScale || 1, 0.001, 8),
          weaponModelHeight: clampNumber(item.weaponModelHeight, item.weaponModelScale || 1, 0.001, 8),
          weaponModelDepth: clampNumber(item.weaponModelDepth, item.weaponModelScale || 1, 0.001, 8),
          weaponModelSourceWidth: clampNumber(item.weaponModelSourceWidth, item.weaponModelSourceScale || 0, 0, 8),
          weaponModelSourceHeight: clampNumber(item.weaponModelSourceHeight, item.weaponModelSourceScale || 0, 0, 8),
          weaponModelSourceDepth: clampNumber(item.weaponModelSourceDepth, item.weaponModelSourceScale || 0, 0, 8),
          ...normalizeEquipmentModelRotationFields(item),
          weaponOffsetX: clampNumber(item.weaponOffsetX, 0, -2, 2),
          weaponOffsetY: clampNumber(item.weaponOffsetY, 0, -2, 2),
          weaponOffsetZ: clampNumber(item.weaponOffsetZ, 0, -2, 2),
          weaponRotationX: clampNumber(item.weaponRotationX, 0, -180, 180),
          weaponRotationY: clampNumber(item.weaponRotationY, 0, -180, 180),
          weaponRotationZ: clampNumber(item.weaponRotationZ, 0, -180, 180),
          ...normalizeEquipmentGripFields(item),
        };
      })
      .filter(Boolean)
    : []
);

const makeCharacter3DModel = (overrides = {}) => {
  const uniformScale = overrides.characterModelScale ?? overrides.modelScale ?? 1;
  return {
    id: overrides.id || uid(),
    name: overrides.name || 'Personnage 3D',
    role: overrides.role || 'hero',
    shape: overrides.shape || 'glb',
    modelUrl: overrides.modelUrl || '',
    modelData: overrides.modelData || '',
    modelName: overrides.modelName || '',
    modelFormat: overrides.modelFormat || '',
    modelFileSize: Number(overrides.modelFileSize) || 0,
    modelResources: Array.isArray(overrides.modelResources) ? overrides.modelResources : [],
    modelAnimations: normalizeCharacter3DAnimations(overrides.modelAnimations),
    characterModelScale: uniformScale,
    characterModelScaleX: overrides.characterModelScaleX ?? overrides.modelScaleX ?? uniformScale,
    characterModelScaleY: overrides.characterModelScaleY ?? overrides.modelScaleY ?? uniformScale,
    characterModelScaleZ: overrides.characterModelScaleZ ?? overrides.modelScaleZ ?? uniformScale,
    characterModelScaleProportional: overrides.characterModelScaleProportional ?? true,
    materialBrightness: overrides.materialBrightness ?? 1,
    previewLightIntensity: overrides.previewLightIntensity ?? 1,
    previewLightOrientation: overrides.previewLightOrientation ?? -35,
    characterRigPoints: normalizeCharacterRigPoints(overrides.characterRigPoints),
    inventory: normalizeCharacter3DEquipment(overrides.inventory),
  };
};
const makeDecor3DModel = (overrides = {}) => ({
  id: uid(),
  name: 'Decor 3D',
  kind: 'decor',
  imageData: '',
  imageName: '',
  modelUrl: '',
  modelData: '',
  modelName: '',
  baseColor: '#64748b',
  accentColor: '#f59e0b',
  roofColor: '#7f1d1d',
  width: 2.2,
  depth: 2.2,
  height: 1.2,
  floorZeroZ: 2.5,
  scale: 1,
  modelSizeProportional: false,
  elevation: 0,
  modelRotationX: 0,
  modelRotationY: 0,
  modelRotationZ: 0,
  modelCenterOnOrigin: false,
  modelFlushToGround: false,
  ...normalizeEquipmentGripFields(overrides),
  materialBrightness: overrides.materialBrightness ?? 1,
  collision: true,
  repeatTexture: false,
  notes: '',
  ...overrides,
  armorCanvasCutEnabled: Boolean(overrides.armorCanvasCutEnabled),
  armorSegmentAssignments: normalizeArmorSegmentAssignments(overrides.armorSegmentAssignments),
  armorCutContours: normalizeArmorCutContours(overrides.armorCutContours),
  armorCutPaintStrokes: normalizeArmorCutPaintStrokes(overrides.armorCutPaintStrokes),
});

const normalizeCharacter3DModel = (entry = {}, index = 0) => {
  const base = makeCharacter3DModel({
    id: entry?.id || uid(),
    name: entry?.name || `Personnage 3D ${index + 1}`,
    role: entry?.role,
    shape: entry?.shape,
    modelUrl: entry?.modelUrl,
    modelData: entry?.modelData,
    modelName: entry?.modelName,
    modelFormat: entry?.modelFormat,
    modelFileSize: entry?.modelFileSize,
    modelResources: entry?.modelResources,
    modelAnimations: entry?.modelAnimations,
    characterModelScale: entry?.characterModelScale,
    characterModelScaleX: entry?.characterModelScaleX,
    characterModelScaleY: entry?.characterModelScaleY,
    characterModelScaleZ: entry?.characterModelScaleZ,
    characterModelScaleProportional: entry?.characterModelScaleProportional,
    materialBrightness: entry?.materialBrightness,
    previewLightIntensity: entry?.previewLightIntensity,
    previewLightOrientation: entry?.previewLightOrientation,
    characterRigPoints: entry?.characterRigPoints,
    inventory: entry?.inventory,
  });
  const normalizedScale = clampNumber(base.characterModelScale, 1, 0.4, 20);
  return {
    id: base.id,
    name: base.name,
    role: normalizeAllowedValue(base.role, ['hero', 'enemy', 'npc'], 'hero'),
    shape: normalizeAllowedValue(base.shape, ['glb'], 'glb'),
    modelUrl: base.modelUrl || '',
    modelData: base.modelData || '',
    modelName: base.modelName || '',
    modelFormat: base.modelFormat || '',
    modelFileSize: Number(base.modelFileSize) || 0,
    modelResources: normalizeModelResourceEntries(base.modelResources),
    modelAnimations: normalizeCharacter3DAnimations(base.modelAnimations),
    characterModelScale: normalizedScale,
    characterModelScaleX: clampNumber(base.characterModelScaleX, normalizedScale, 0.4, 20),
    characterModelScaleY: clampNumber(base.characterModelScaleY, normalizedScale, 0.4, 20),
    characterModelScaleZ: clampNumber(base.characterModelScaleZ, normalizedScale, 0.4, 20),
    characterModelScaleProportional: base.characterModelScaleProportional !== false,
    materialBrightness: clampNumber(base.materialBrightness, 1, 0.25, 1.4),
    previewLightIntensity: clampNumber(base.previewLightIntensity, 1, 0.2, 2.5),
    previewLightOrientation: clampNumber(base.previewLightOrientation, -35, -180, 180),
    characterRigPoints: normalizeCharacterRigPoints(base.characterRigPoints),
    inventory: normalizeCharacter3DEquipment(base.inventory),
  };
};

const normalizeDecor3DModel = (entry = {}, index = 0) => {
  const base = makeDecor3DModel({
    ...entry,
    id: entry?.id || uid(),
    name: entry?.name || `Decor 3D ${index + 1}`,
  });
  const normalizedKind = normalizeDecorKind(base.kind);
  return {
    ...base,
    kind: normalizedKind,
    imageData: base.imageData || '',
    imageName: base.imageName || '',
    modelUrl: base.modelUrl || '',
    modelData: base.modelData || '',
    modelName: base.modelName || '',
    baseColor: /^#[0-9a-f]{6}$/i.test(base.baseColor) ? base.baseColor : '#64748b',
    accentColor: /^#[0-9a-f]{6}$/i.test(base.accentColor) ? base.accentColor : '#f59e0b',
    roofColor: /^#[0-9a-f]{6}$/i.test(base.roofColor) ? base.roofColor : '#7f1d1d',
    width: clampNumber(base.width, 2.2, 0.001, 120),
    depth: clampNumber(base.depth, 2.2, 0.001, 120),
    height: clampNumber(base.height, 1.2, 0.001, 120),
    floorZeroZ: clampNumber(base.floorZeroZ, 2.5, -120, 120),
    scale: clampNumber(base.scale, 1, 0.5, 20),
    modelSizeProportional: Boolean(base.modelSizeProportional),
    elevation: clampNumber(base.elevation, 0, -1, 3),
    materialBrightness: clampNumber(base.materialBrightness, ['road', 'water'].includes(normalizedKind) ? 0.55 : 1, 0.25, 1.4),
    collision: Boolean(base.collision),
    repeatTexture: Boolean(base.repeatTexture),
    ...normalizeEquipmentGripFields(base),
    notes: base.notes || '',
  };
};

export {
  makeCharacter3DModel,
  makeDecor3DModel,
  normalizeCharacter3DModel,
  normalizeDecor3DModel,
};
