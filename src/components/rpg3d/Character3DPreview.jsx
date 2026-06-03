import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping as ThreeACESFilmicToneMapping,
  AmbientLight as ThreeAmbientLight,
  Box3 as ThreeBox3,
  BufferGeometry as ThreeBufferGeometry,
  CanvasTexture as ThreeCanvasTexture,
  CircleGeometry as ThreeCircleGeometry,
  Color as ThreeColor,
  DirectionalLight as ThreeDirectionalLight,
  Fog as ThreeFog,
  GridHelper as ThreeGridHelper,
  Group as ThreeGroup,
  HemisphereLight as ThreeHemisphereLight,
  Line as ThreeLine,
  LineBasicMaterial as ThreeLineBasicMaterial,
  MathUtils as ThreeMathUtils,
  Mesh as ThreeMesh,
  MeshStandardMaterial as ThreeMeshStandardMaterial,
  PCFShadowMap as ThreePCFShadowMap,
  PMREMGenerator as ThreePMREMGenerator,
  PerspectiveCamera as ThreePerspectiveCamera,
  Raycaster as ThreeRaycaster,
  RepeatWrapping as ThreeRepeatWrapping,
  SRGBColorSpace as ThreeSRGBColorSpace,
  Scene as ThreeScene,
  Sprite as ThreeSprite,
  SpriteMaterial as ThreeSpriteMaterial,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
  WebGLRenderer as ThreeWebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachClickTargetCameraControls } from '../three/clickTargetCameraControls.js';
import { formatBytes } from '../../utils/glbOptimizer';
import {
  clearGroup,
  createPreviewFloorCanvas,
  disposeThreeObject,
  getAnimationBaseSlotId,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getCharacterModelSources,
  getPreviewAnimationOptions,
  getPreviewAnimationSlot,
  getPreviewLightIntensity,
  getPreviewLightOrientation,
  isHeavyLocalFbxAsset,
  loadCharacterAnimationAsset,
  loadThreeCharacter,
  summarizeEmbeddedAnimationClips,
} from '../../utils/rpg3dModelImport';
import {
  applyObjectAxisScaleRatios,
  fitObjectToHeight,
  getRuntimeModelPrepareOptions,
  loadThreeModelFromSource,
  playGltfAnimations,
  prepareGltfModel,
  resetObjectBaseTransform,
  updateGltfModelMaterialAppearance,
} from '../../utils/threeGltfUtils';
import { hasThreeModelResources } from '../../utils/threeModelUtils.js';
import {
  attachPreparedEquipmentToSocket,
  addEquippedArmorToActorModel,
  addEquippedLeggingsToActorModel,
  createFallbackEquipmentSocket,
  findHelmetSocket,
  findShieldSocketForArm,
  findWeaponSocketForHand,
  getEquippedHelmetItem,
  getEquippedLeggingsItem,
  getShieldGripArm,
  getEquippedArmorItem,
  getEquippedShieldItem,
  getEquippedWeaponItem,
  getWeaponModelPayload,
  getWeaponModelSource,
  updateFingerTipsWeaponSockets,
} from '../arcade/rpg3dSceneActors.js';
import { enableObjectShadows } from '../arcade/rpg3dSceneShared.js';
import {
  getCharacterRigSignature,
  normalizeCharacterRigPoint,
  roundCharacterRigPointValue,
} from '../../utils/rpg3dCharacterRig.js';
import {
  getCharacterRigAutoAnchorMap,
  getCharacterRigAutoWorldPosition,
  getCharacterRigBoundsWorldPoint,
} from '../../utils/rpg3dCharacterRigAutoPlacement.js';

const applyPreviewLighting = (model, renderer, lights) => {
  if (!renderer || !lights) return;
  const intensity = getPreviewLightIntensity(model);
  const orientation = ThreeMathUtils.degToRad(getPreviewLightOrientation(model));
  const keyRadius = 6.2;
  const fillRadius = 6.6;
  const rimRadius = 5.4;

  renderer.toneMappingExposure = 0.98 + intensity * 0.18;
  lights.hemi.intensity = 0.72 + intensity * 0.3;
  lights.key.intensity = 1.55 + intensity * 0.86;
  lights.frontFill.intensity = 0.28 + intensity * 0.3;
  lights.rim.intensity = 0.08 + intensity * 0.1;
  lights.ambient.intensity = 0.18 + intensity * 0.18;

  lights.key.position.set(Math.sin(orientation) * keyRadius, 5.8, Math.cos(orientation) * keyRadius);
  lights.frontFill.position.set(Math.sin(orientation + Math.PI * 0.58) * fillRadius, 2.4, Math.cos(orientation + Math.PI * 0.58) * fillRadius);
  lights.rim.position.set(Math.sin(orientation + Math.PI) * rimRadius, 3.8, Math.cos(orientation + Math.PI) * rimRadius);
};

const getCharacterSizeSignature = (model = {}) => {
  const axisScale = getCharacterModelAxisScale(model);
  return `${axisScale.x}:${axisScale.y}:${axisScale.z}`;
};
const getCharacterAppearanceSignature = (model = {}) => `${getCharacterMaterialBrightness(model)}`;

const applyCharacterPreviewSize = (object, model = {}) => {
  if (!object) return;
  resetObjectBaseTransform(object);
  const axisScale = getCharacterModelAxisScale(model);
  fitObjectToHeight(object, 2 * axisScale.y, { groundY: 0 });
  applyObjectAxisScaleRatios(object, axisScale, axisScale.y, { groundY: 0 });
};

const getPreviewAnimationStatusLabel = (slot = '') => {
  const baseSlot = getAnimationBaseSlotId(slot);
  if (baseSlot === 'idle') return 'stand-by';
  if (baseSlot === 'walk') return 'marche';
  if (baseSlot === 'attack') return 'attaque';
  return slot || 'sélectionnée';
};

const PREVIEW_EQUIPMENT_ROLES = ['weapon', 'armor', 'shield', 'helmet', 'leggings'];

const loadPreviewEquipmentObject = (item = {}) => new Promise((resolve) => {
  const source = getWeaponModelSource(item);
  if (!source) {
    resolve(null);
    return;
  }
  const payload = getWeaponModelPayload(item);
  loadThreeModelFromSource(
    source,
    payload,
    ({ object, format = '' } = {}) => {
      if (object) {
        object.userData.modelFormat = format || payload.modelFormat || '';
        object.userData.hasModelResources = hasThreeModelResources(payload);
      }
      resolve(object || null);
    },
    () => resolve(null),
  );
});

const attachEquipmentObjectToCharacter = (characterObject, equipmentObject, item = {}, role = 'weapon', actor = {}) => {
  if (role === 'armor') {
    return addEquippedArmorToActorModel(characterObject, equipmentObject, item, actor);
  }
  if (role === 'leggings') {
    return addEquippedLeggingsToActorModel(characterObject, equipmentObject, item, actor);
  }
  if (role === 'helmet') {
    const socket = findHelmetSocket(characterObject, item, actor) || createFallbackEquipmentSocket(characterObject, 'helmet');
    if (!socket || !equipmentObject) return false;
    const payload = getWeaponModelPayload(item);
    prepareGltfModel(equipmentObject, getRuntimeModelPrepareOptions(equipmentObject.userData?.modelFormat || payload.modelFormat, {
      restoreTextureColor: true,
      forceLitMaterials: true,
      hasResourceTextures: Boolean(equipmentObject.userData?.hasModelResources || hasThreeModelResources(payload)),
      cloneMaterials: true,
      forceDoubleSidedMaterials: true,
      forceVisibleMaterials: true,
      forceVisibleMeshes: true,
    }));
    enableObjectShadows(equipmentObject);
    return Boolean(attachPreparedEquipmentToSocket(socket, equipmentObject, item, role));
  }
  const weaponHand = item.weaponGripHand === 'left' ? 'left' : 'right';
  const socket = (
    role === 'shield'
      ? findShieldSocketForArm(characterObject, item, actor)
      : findWeaponSocketForHand(characterObject, weaponHand, actor)
  ) || createFallbackEquipmentSocket(characterObject, role, role === 'shield' ? getShieldGripArm(item) : weaponHand);
  if (!socket || !equipmentObject) return false;
  const payload = getWeaponModelPayload(item);
  prepareGltfModel(equipmentObject, getRuntimeModelPrepareOptions(equipmentObject.userData?.modelFormat || payload.modelFormat, {
    restoreTextureColor: true,
    forceLitMaterials: true,
    hasResourceTextures: Boolean(equipmentObject.userData?.hasModelResources || hasThreeModelResources(payload)),
    cloneMaterials: true,
    forceDoubleSidedMaterials: true,
    forceVisibleMaterials: true,
    forceVisibleMeshes: true,
  }));
  enableObjectShadows(equipmentObject);
  return Boolean(attachPreparedEquipmentToSocket(socket, equipmentObject, item, role));
};

const getPreviewEquipmentItemForRole = (model = {}, role = 'weapon') => {
  if (role === 'armor') return getEquippedArmorItem(model);
  if (role === 'shield') return getEquippedShieldItem(model);
  if (role === 'helmet') return getEquippedHelmetItem(model);
  if (role === 'leggings') return getEquippedLeggingsItem(model);
  return getEquippedWeaponItem(model);
};

const attachPreviewEquipmentRoleModel = async (
  characterObject,
  model = {},
  role = 'weapon',
  isCancelled = () => false,
) => {
  const item = getPreviewEquipmentItemForRole(model, role);
  if (!getWeaponModelSource(item)) return { attached: 0, failed: 0 };
  const object = await loadPreviewEquipmentObject(item);
  if (!object || isCancelled()) {
    if (object) disposeThreeObject(object);
    return { attached: 0, failed: object ? 0 : 1 };
  }
  if (attachEquipmentObjectToCharacter(characterObject, object, item, role, model)) {
    return { attached: 1, failed: 0 };
  }
  disposeThreeObject(object);
  return { attached: 0, failed: 1 };
};

const getResourceSignature = (resources = []) => (
  (Array.isArray(resources) ? resources : [])
    .map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`)
    .join(';')
);

const getPreviewAnimationAssetSignature = (animation = {}) => {
  const modelData = String(animation?.modelData || '');
  const dataSignature = modelData
    ? `${modelData.length}:${modelData.slice(0, 64)}:${modelData.slice(-64)}`
    : '';
  return [
    animation?.modelUrl || '',
    dataSignature,
    animation?.localModelFileId || '',
    animation?.modelName || '',
    animation?.modelFormat || '',
    animation?.modelFileSize || '',
    getResourceSignature(animation?.modelResources),
  ].join('|');
};

const trimPreviewAnimationCache = (cache, maxEntries = 6) => {
  while (cache.size > maxEntries) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

const loadCachedPreviewAnimationAsset = (animation = {}, cache) => {
  const cacheKey = getPreviewAnimationAssetSignature(animation);
  if (!cacheKey.replace(/\|/g, '')) {
    return loadCharacterAnimationAsset(animation).then(({ clips = [], object, format = '' } = {}) => {
      if (object) disposeThreeObject(object);
      return { clips, format };
    });
  }
  const cached = cache.get(cacheKey);
  if (cached?.value) return Promise.resolve(cached.value);
  if (cached?.promise) return cached.promise;
  const promise = loadCharacterAnimationAsset(animation).then(({ clips = [], object, format = '' } = {}) => {
    if (object) disposeThreeObject(object);
    const value = { clips, format };
    cache.delete(cacheKey);
    cache.set(cacheKey, { value });
    trimPreviewAnimationCache(cache);
    return value;
  }).catch((error) => {
    cache.delete(cacheKey);
    throw error;
  });
  cache.set(cacheKey, { promise });
  trimPreviewAnimationCache(cache);
  return promise;
};

const getCharacterPreviewModelSignature = (model = {}) => [
  model?.id || '',
  model?.shape || '',
  model?.modelUrl || '',
  model?.modelData || '',
  model?.localModelFileId || '',
  model?.modelName || '',
  model?.modelFormat || '',
  model?.modelFileSize || '',
  getResourceSignature(model?.modelResources),
].join('|');

const getPreviewEquipmentItemSignature = (item = null) => {
  if (!item) return '';
  return [
    item.type || '',
    item.equipped ? 1 : 0,
    item.weaponModel3dId || item.model3dId || '',
    item.weaponModelUrl || item.modelUrl || '',
    item.weaponModelName || item.modelName || '',
    item.weaponModelFormat || item.modelFormat || '',
    item.weaponModelFileSize || item.modelFileSize || '',
    getResourceSignature(item.weaponModelResources || item.modelResources),
    item.weaponModelScale || '',
    item.weaponModelSourceScale || '',
    item.weaponModelWidth || '',
    item.weaponModelHeight || '',
    item.weaponModelDepth || '',
    item.weaponModelSourceWidth || '',
    item.weaponModelSourceHeight || '',
    item.weaponModelSourceDepth || '',
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
  ].join(':');
};

const getPreviewEquipmentRoleSignature = (model = {}, role = 'weapon') => [
  getCharacterRigSignature(model?.characterRigPoints),
  getPreviewEquipmentItemSignature(getPreviewEquipmentItemForRole(model, role)),
].join('|');

const getPreviewEquipmentRoleSignatures = (model = {}) => (
  PREVIEW_EQUIPMENT_ROLES.reduce((signatures, role) => ({
    ...signatures,
    [role]: getPreviewEquipmentRoleSignature(model, role),
  }), {})
);

const isEquipmentRoleMatch = (equipmentRole = '', targetRole = '') => (
  targetRole === 'armor'
    ? String(equipmentRole).startsWith('armor')
    : equipmentRole === targetRole
);

const removePreviewEquipmentAttachments = (characterObject, role = '') => {
  if (!characterObject?.children) return;
  const attachments = [];
  const visit = (object, insideAttachment = false) => {
    const isAttachment = object !== characterObject && Boolean(object?.userData?.rpg3dEquipmentRole);
    const roleMatches = !role || isEquipmentRoleMatch(object?.userData?.rpg3dEquipmentRole, role);
    if (isAttachment && !insideAttachment && roleMatches) {
      attachments.push(object);
      return;
    }
    object?.children?.forEach((child) => visit(child, insideAttachment || isAttachment));
  };
  visit(characterObject);
  attachments.forEach((attachment) => {
    attachment.parent?.remove(attachment);
    disposeThreeObject(attachment);
  });

  const fallbackSockets = [];
  characterObject.traverse?.((object) => {
    if (object === characterObject || !object?.userData?.rpg3dFallbackEquipmentSocket) return;
    if (role && !isEquipmentRoleMatch(object.userData.rpg3dFallbackEquipmentSocket, role)) return;
    if (object.children?.length) return;
    fallbackSockets.push(object);
  });
  fallbackSockets.forEach((socket) => {
    socket.parent?.remove(socket);
    disposeThreeObject(socket);
  });
};

const CHARACTER_RIG_MARKER_COLORS = {
  weapon: { fill: '#38bdf8', stroke: '#e0f2fe', text: '#061728' },
  shield: { fill: '#fbbf24', stroke: '#fff7ed', text: '#1f1300' },
  armor: { fill: '#34d399', stroke: '#ecfdf5', text: '#052e1b' },
  finger: { fill: '#f8fafc', stroke: '#bae6fd', text: '#061728', line: '#cbd5e1' },
  selected: { fill: '#fb7185', stroke: '#fff1f2', text: '#2a0610', glow: 'rgba(251,113,133,.95)' },
};
const CHARACTER_RIG_MAGNIFIER_CANVAS_SIZE = 320;
const CHARACTER_RIG_MAGNIFIER_SOURCE_SIZE = 84;
const CHARACTER_CAMERA_ZOOM_DRAG_SENSITIVITY = 0.018;
const CHARACTER_CAMERA_ZOOM_MIN_DISTANCE = 0.02;
const CHARACTER_CAMERA_ZOOM_MAX_DISTANCE = 100000;
const CHARACTER_CAMERA_VIEW_DIRECTIONS = {
  north: new ThreeVector3(0, 0, -1),
  east: new ThreeVector3(1, 0, 0),
  south: new ThreeVector3(0, 0, 1),
  west: new ThreeVector3(-1, 0, 0),
};

const createCharacterRigMarkerTexture = (marker = {}) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const colors = marker.selected
    ? CHARACTER_RIG_MARKER_COLORS.selected
    : (CHARACTER_RIG_MARKER_COLORS[marker.socket] || CHARACTER_RIG_MARKER_COLORS.weapon);
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (marker.selected) {
    context.shadowColor = colors.glow;
    context.shadowBlur = 28;
    context.beginPath();
    context.arc(64, 64, 51, 0, Math.PI * 2);
    context.fillStyle = colors.fill;
    context.fill();
  }
  context.shadowColor = 'rgba(0,0,0,.4)';
  context.shadowBlur = marker.selected ? 22 : 16;
  context.beginPath();
  context.arc(64, 64, 46, 0, Math.PI * 2);
  context.fillStyle = colors.fill;
  context.fill();
  context.lineWidth = 8;
  context.strokeStyle = colors.stroke;
  context.stroke();
  context.shadowBlur = 0;
  if (!marker.hideLabel) {
    context.fillStyle = colors.text;
    context.font = '800 34px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(marker.shortLabel || '?', 64, 66);
  }
  const texture = new ThreeCanvasTexture(canvas);
  texture.colorSpace = ThreeSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const getCharacterRigMarkerTextureSignature = (marker = {}) => [
  marker.socket || '',
  marker.shortLabel || '',
  marker.hideLabel ? 1 : 0,
  marker.selected ? 1 : 0,
].join(':');

const updateCharacterRigMarkerTexture = (markerObject = null, markerConfig = {}) => {
  if (!markerObject?.material) return;
  const signature = getCharacterRigMarkerTextureSignature(markerConfig);
  if (markerObject.userData.characterRigMarkerTextureSignature === signature) return;
  markerObject.material.map?.dispose?.();
  markerObject.material.map = createCharacterRigMarkerTexture(markerConfig);
  markerObject.material.needsUpdate = true;
  markerObject.userData.characterRigMarkerTextureSignature = signature;
};

const createCharacterRigMarker = (marker = {}) => {
  const texture = createCharacterRigMarkerTexture(marker);
  const material = new ThreeSpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  material.userData.disposeTextures = true;
  const sprite = new ThreeSprite(material);
  sprite.name = `CharacterRigMarker-${marker.id || 'point'}`;
  sprite.renderOrder = 55;
  sprite.userData.characterRigMarker = true;
  sprite.userData.characterRigPointId = marker.id || '';
  sprite.userData.characterRigMarkerTextureSignature = getCharacterRigMarkerTextureSignature(marker);
  return sprite;
};

const createCharacterRigMarkerLine = (marker = {}) => {
  const colors = CHARACTER_RIG_MARKER_COLORS[marker.socket] || CHARACTER_RIG_MARKER_COLORS.weapon;
  const geometry = new ThreeBufferGeometry().setFromPoints([
    new ThreeVector3(),
    new ThreeVector3(),
  ]);
  const material = new ThreeLineBasicMaterial({
    color: colors.line || colors.fill,
    transparent: true,
    opacity: 0.58,
    depthTest: false,
    depthWrite: false,
  });
  const line = new ThreeLine(geometry, material);
  line.name = `CharacterRigLine-${marker.id || 'point'}`;
  line.renderOrder = 50;
  line.userData.characterRigLine = true;
  return line;
};

const disposeCharacterRigMarkers = (markers) => {
  markers?.forEach?.((marker) => {
    marker.parent?.remove(marker);
    marker.material?.map?.dispose?.();
    marker.material?.dispose?.();
  });
  markers?.clear?.();
};

const disposeCharacterRigMarkerLines = (lines) => {
  lines?.forEach?.((line) => {
    line.parent?.remove(line);
    line.geometry?.dispose?.();
    line.material?.dispose?.();
  });
  lines?.clear?.();
};

const normalizePreviewCharacterRigMarkers = (markers = []) => (
  Array.isArray(markers) && markers.length
    ? markers.map((marker) => {
      const normalized = normalizeCharacterRigPoint(marker);
      return normalized ? { ...normalized, selected: Boolean(marker?.selected) } : null;
    }).filter(Boolean)
    : []
);

const getCharacterPreviewBodyBounds = (characterObject = null) => {
  const bounds = new ThreeBox3();
  const childBounds = new ThreeBox3();
  const skipped = new Set();
  let hasBounds = false;
  characterObject?.updateMatrixWorld?.(true);
  characterObject?.traverse?.((child) => {
    if (child !== characterObject && child.parent && skipped.has(child.parent)) {
      skipped.add(child);
      return;
    }
    if (child.userData?.rpg3dEquipmentRole || child.userData?.rpg3dFallbackEquipmentSocket) {
      skipped.add(child);
      return;
    }
    if (!child.isMesh && !child.isSkinnedMesh && !child.isSprite) return;
    childBounds.setFromObject(child);
    if (!Number.isFinite(childBounds.min.x) || !Number.isFinite(childBounds.max.x)) return;
    if (!hasBounds) bounds.copy(childBounds);
    else bounds.union(childBounds);
    hasBounds = true;
  });
  return hasBounds ? bounds : new ThreeBox3().setFromObject(characterObject);
};

const getCharacterRigMarkerWorldPosition = (
  characterObject = null,
  marker = {},
  bounds = null,
  autoAnchors = null,
) => {
  if (!characterObject) return null;
  const bodyBounds = bounds || getCharacterPreviewBodyBounds(characterObject);
  return getCharacterRigAutoWorldPosition(characterObject, marker, bodyBounds, autoAnchors)
    || getCharacterRigBoundsWorldPoint(bodyBounds, marker);
};

const getCharacterRigPointFromWorld = (characterObject = null, worldPoint = null, boundsOverride = null) => {
  if (!characterObject || !worldPoint) return null;
  const bounds = boundsOverride || getCharacterPreviewBodyBounds(characterObject);
  const size = bounds.getSize(new ThreeVector3());
  if (
    !Number.isFinite(size.x)
    || !Number.isFinite(size.y)
    || !Number.isFinite(size.z)
    || size.x <= 0.0001
    || size.y <= 0.0001
    || size.z <= 0.0001
  ) return null;
  return {
    x: roundCharacterRigPointValue((worldPoint.x - bounds.min.x) / size.x),
    y: roundCharacterRigPointValue((worldPoint.y - bounds.min.y) / size.y),
    z: roundCharacterRigPointValue((worldPoint.z - bounds.min.z) / size.z),
  };
};

const getCharacterCameraZoomPercent = (camera = null, controls = null) => {
  if (!camera || !controls) return 100;
  const baseDistance = Number(camera.userData?.characterPreviewBaseDistance)
    || Math.max(0.001, camera.position.distanceTo(controls.target));
  const currentDistance = Math.max(0.001, camera.position.distanceTo(controls.target));
  return Math.round((baseDistance / currentDistance) * 100);
};

const applyCharacterCameraZoomDelta = (camera = null, controls = null, deltaY = 0) => {
  if (!camera || !controls) return 100;
  const direction = camera.position.clone().sub(controls.target);
  const currentDistance = Math.max(0.001, direction.length());
  if (direction.lengthSq() < 0.000001) direction.set(2.8, 1, 3.5);
  direction.normalize();
  const sensitivity = Math.max(0.008, currentDistance * CHARACTER_CAMERA_ZOOM_DRAG_SENSITIVITY);
  const nextDistance = ThreeMathUtils.clamp(
    currentDistance + (Number(deltaY) || 0) * sensitivity,
    CHARACTER_CAMERA_ZOOM_MIN_DISTANCE,
    CHARACTER_CAMERA_ZOOM_MAX_DISTANCE,
  );
  camera.position.copy(controls.target).addScaledVector(direction, nextDistance);
  controls.update();
  return getCharacterCameraZoomPercent(camera, controls);
};

const applyCharacterCameraView = (camera = null, controls = null, view = 'north', distance = null) => {
  if (!camera || !controls) return;
  const viewDirection = (CHARACTER_CAMERA_VIEW_DIRECTIONS[view] || CHARACTER_CAMERA_VIEW_DIRECTIONS.north).clone().normalize();
  const target = controls.target.clone();
  const currentDistance = Math.max(
    0.001,
    Number(distance) || camera.position.distanceTo(target) || 4.2,
  );
  const verticalOffset = ThreeMathUtils.clamp(currentDistance * 0.15, 0.28, 0.62);
  const planarDistance = Math.sqrt(Math.max(0.001, (currentDistance * currentDistance) - (verticalOffset * verticalOffset)));
  camera.position.copy(target)
    .addScaledVector(viewDirection, planarDistance)
    .add(new ThreeVector3(0, verticalOffset, 0));
  camera.lookAt(target);
  controls.update();
};

const applyInitialCharacterCameraZoom = (camera = null, controls = null, zoom = 1) => {
  if (!camera || !controls) return;
  const normalizedZoom = Math.max(1, Number(zoom) || 1);
  const direction = camera.position.clone().sub(controls.target);
  const baseDistance = Math.max(0.001, direction.length());
  if (direction.lengthSq() < 0.000001 || normalizedZoom <= 1) return;
  camera.userData.characterPreviewBaseDistance = baseDistance;
  direction.normalize();
  const nextDistance = ThreeMathUtils.clamp(
    baseDistance / normalizedZoom,
    CHARACTER_CAMERA_ZOOM_MIN_DISTANCE,
    CHARACTER_CAMERA_ZOOM_MAX_DISTANCE,
  );
  camera.position.copy(controls.target).addScaledVector(direction, nextDistance);
  controls.update();
};

const clampCanvasRectValue = (value, min, max) => Math.min(max, Math.max(min, value));

const drawCharacterRigMagnifierCanvas = ({
  canvas,
  renderer,
  camera,
  marker,
  socket = 'armor',
} = {}) => {
  if (!canvas || !renderer?.domElement || !camera || !marker?.visible) return false;
  const sourceCanvas = renderer.domElement;
  const context = canvas.getContext('2d');
  if (!context) return false;

  const displayWidth = Math.max(1, Math.round(canvas.clientWidth || CHARACTER_RIG_MAGNIFIER_CANVAS_SIZE));
  const displayHeight = Math.max(1, Math.round(canvas.clientHeight || CHARACTER_RIG_MAGNIFIER_CANVAS_SIZE));
  const pixelRatio = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
  const targetWidth = Math.max(1, Math.round(displayWidth * pixelRatio));
  const targetHeight = Math.max(1, Math.round(displayHeight * pixelRatio));
  if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
    canvas.width = targetWidth;
    canvas.height = targetHeight;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#07111e';
  context.fillRect(0, 0, canvas.width, canvas.height);

  const projected = marker.position.clone().project(camera);
  const sourceWidth = sourceCanvas.width;
  const sourceHeight = sourceCanvas.height;
  const sourceCenterX = (projected.x * 0.5 + 0.5) * sourceWidth;
  const sourceCenterY = (-projected.y * 0.5 + 0.5) * sourceHeight;
  const sourceSize = Math.max(
    36,
    Math.min(sourceWidth, sourceHeight, CHARACTER_RIG_MAGNIFIER_SOURCE_SIZE * (renderer.getPixelRatio?.() || 1)),
  );
  const requestedLeft = sourceCenterX - sourceSize / 2;
  const requestedTop = sourceCenterY - sourceSize / 2;
  const sourceLeft = clampCanvasRectValue(requestedLeft, 0, Math.max(0, sourceWidth - 1));
  const sourceTop = clampCanvasRectValue(requestedTop, 0, Math.max(0, sourceHeight - 1));
  const sourceRight = clampCanvasRectValue(requestedLeft + sourceSize, sourceLeft + 1, sourceWidth);
  const sourceBottom = clampCanvasRectValue(requestedTop + sourceSize, sourceTop + 1, sourceHeight);
  const sourceCropWidth = Math.max(1, sourceRight - sourceLeft);
  const sourceCropHeight = Math.max(1, sourceBottom - sourceTop);
  const targetLeft = ((sourceLeft - requestedLeft) / sourceSize) * canvas.width;
  const targetTop = ((sourceTop - requestedTop) / sourceSize) * canvas.height;
  const targetCropWidth = (sourceCropWidth / sourceSize) * canvas.width;
  const targetCropHeight = (sourceCropHeight / sourceSize) * canvas.height;

  let didDrawSource = false;
  context.save();
  try {
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(
      sourceCanvas,
      sourceLeft,
      sourceTop,
      sourceCropWidth,
      sourceCropHeight,
      targetLeft,
      targetTop,
      targetCropWidth,
      targetCropHeight,
    );
    didDrawSource = true;
  } catch {
    didDrawSource = false;
  } finally {
    context.restore();
  }
  if (!didDrawSource) {
    context.fillStyle = '#07111e';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const colors = CHARACTER_RIG_MARKER_COLORS[socket] || CHARACTER_RIG_MARKER_COLORS.armor;
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const markerRadius = Math.max(22, Math.min(canvas.width, canvas.height) * 0.19);
  const centerDotRadius = Math.max(4, markerRadius * 0.11);

  context.save();
  context.lineWidth = Math.max(3, markerRadius * 0.1);
  context.shadowColor = 'rgba(15,23,42,.82)';
  context.shadowBlur = Math.max(9, markerRadius * 0.26);
  context.beginPath();
  context.arc(centerX, centerY, markerRadius, 0, Math.PI * 2);
  context.fillStyle = 'rgba(248,250,252,.055)';
  context.fill();
  context.strokeStyle = colors.fill || '#f8fafc';
  context.stroke();
  context.shadowBlur = 0;
  context.lineWidth = Math.max(1.5, markerRadius * 0.045);
  context.strokeStyle = 'rgba(248,250,252,.92)';
  context.stroke();
  context.beginPath();
  context.arc(centerX, centerY, centerDotRadius, 0, Math.PI * 2);
  context.fillStyle = '#f8fafc';
  context.fill();
  context.restore();
  return true;
};

export default function Character3DPreview({
  children,
  model,
  animationSlot = '',
  autoPreviewAnimation = true,
  playEmbeddedAnimations = true,
  onAnimationClipsLoaded,
  characterRigMarkers = [],
  onCharacterRigMarkerChange,
  onCharacterRigMarkerSelect,
  cameraZoomDragEnabled = false,
  onCameraZoomChange,
  initialCameraZoom = 1,
  cameraView = 'north',
}) {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);
  const characterRootRef = useRef(null);
  const rigMarkerRootRef = useRef(null);
  const rigMarkersRef = useRef(new Map());
  const rigMarkerLinesRef = useRef(new Map());
  const rigDragRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const rendererRef = useRef(null);
  const characterObjectRef = useRef(null);
  const latestModelRef = useRef(model);
  const latestCharacterRigMarkersRef = useRef(normalizePreviewCharacterRigMarkers(characterRigMarkers));
  const latestOnCharacterRigMarkerChangeRef = useRef(onCharacterRigMarkerChange);
  const latestOnCharacterRigMarkerSelectRef = useRef(onCharacterRigMarkerSelect);
  const latestCameraZoomDragEnabledRef = useRef(cameraZoomDragEnabled);
  const latestCameraViewRef = useRef(cameraView);
  const latestOnCameraZoomChangeRef = useRef(onCameraZoomChange);
  const rigMagnifierCanvasRef = useRef(null);
  const rigMagnifierStateRef = useRef({ active: false, pointId: '', socket: 'armor', mode: '' });
  const embeddedAnimationClipsRef = useRef([]);
  const onAnimationClipsLoadedRef = useRef(onAnimationClipsLoaded);
  const syncCharacterRigMarkersRef = useRef(() => {});
  const previewEquipmentSignaturesRef = useRef({});
  const previewEquipmentCharacterVersionRef = useRef(0);
  const previewEquipmentRequestIdsRef = useRef({});
  const previewAnimationCacheRef = useRef(new Map());
  const animationMixersRef = useRef([]);
  const lightsRef = useRef(null);
  const [loadedCharacterVersion, setLoadedCharacterVersion] = useState(0);
  const [webglError, setWebglError] = useState('');
  const [previewStatus, setPreviewStatus] = useState('');
  const [rigMagnifierState, setRigMagnifierState] = useState(rigMagnifierStateRef.current);
  const modelSignature = useMemo(() => getCharacterPreviewModelSignature(model), [model]);
  const equipmentSignatures = useMemo(() => getPreviewEquipmentRoleSignatures(model), [model]);
  const sizeSignature = useMemo(() => getCharacterSizeSignature(model), [model]);
  const appearanceSignature = useMemo(() => getCharacterAppearanceSignature(model), [model]);

  const setRigMagnifierTarget = useCallback((pointId = '', mode = 'hover') => {
    if (!pointId) return;
    const markerConfig = latestCharacterRigMarkersRef.current.find((marker) => marker.id === pointId) || {};
    const nextState = {
      active: true,
      pointId,
      socket: markerConfig.socket || 'armor',
      mode,
    };
    const currentState = rigMagnifierStateRef.current;
    if (
      currentState.active === nextState.active
      && currentState.pointId === nextState.pointId
      && currentState.socket === nextState.socket
      && currentState.mode === nextState.mode
    ) return;
    rigMagnifierStateRef.current = nextState;
    setRigMagnifierState(nextState);
  }, []);

  const clearRigMagnifierTarget = useCallback((force = false) => {
    if (!force && rigDragRef.current) return;
    const currentState = rigMagnifierStateRef.current;
    if (!currentState.active) return;
    const nextState = { active: false, pointId: '', socket: 'armor', mode: '' };
    rigMagnifierStateRef.current = nextState;
    setRigMagnifierState(nextState);
  }, []);

  useEffect(() => {
    latestModelRef.current = model;
  }, [model]);

  useEffect(() => {
    const nextMarkers = normalizePreviewCharacterRigMarkers(characterRigMarkers);
    latestCharacterRigMarkersRef.current = nextMarkers;
    if (
      rigMagnifierStateRef.current.active
      && !nextMarkers.some((marker) => marker.id === rigMagnifierStateRef.current.pointId)
    ) {
      clearRigMagnifierTarget(true);
    }
  }, [characterRigMarkers, clearRigMagnifierTarget]);

  useEffect(() => {
    latestOnCharacterRigMarkerChangeRef.current = onCharacterRigMarkerChange;
  }, [onCharacterRigMarkerChange]);

  useEffect(() => {
    latestOnCharacterRigMarkerSelectRef.current = onCharacterRigMarkerSelect;
  }, [onCharacterRigMarkerSelect]);

  useEffect(() => {
    latestCameraZoomDragEnabledRef.current = cameraZoomDragEnabled;
  }, [cameraZoomDragEnabled]);

  useEffect(() => {
    latestCameraViewRef.current = cameraView;
    if (!cameraRef.current || !controlsRef.current) return;
    applyCharacterCameraView(cameraRef.current, controlsRef.current, cameraView);
    latestOnCameraZoomChangeRef.current?.(getCharacterCameraZoomPercent(cameraRef.current, controlsRef.current));
    syncCharacterRigMarkersRef.current?.(cameraRef.current);
  }, [cameraView]);

  useEffect(() => {
    latestOnCameraZoomChangeRef.current = onCameraZoomChange;
  }, [onCameraZoomChange]);

  useEffect(() => {
    onAnimationClipsLoadedRef.current = onAnimationClipsLoaded;
  }, [onAnimationClipsLoaded]);

  const syncCharacterRigMarkers = useCallback((camera = cameraRef.current) => {
    const markerRoot = rigMarkerRootRef.current;
    const characterObject = characterObjectRef.current;
    const markers = latestCharacterRigMarkersRef.current;
    if (!markerRoot || !characterObject || !Array.isArray(markers) || !markers.length) {
      rigMarkersRef.current.forEach((marker) => { marker.visible = false; });
      rigMarkerLinesRef.current.forEach((line) => { line.visible = false; });
      return;
    }

    const activeMarkers = new Set();
    const activeLines = new Set();
    const bodyBounds = getCharacterPreviewBodyBounds(characterObject);
    const autoAnchors = getCharacterRigAutoAnchorMap(characterObject, bodyBounds);
    markers.forEach((markerConfig) => {
      activeMarkers.add(markerConfig.id);
      let marker = rigMarkersRef.current.get(markerConfig.id);
      if (!marker) {
        marker = createCharacterRigMarker(markerConfig);
        rigMarkersRef.current.set(markerConfig.id, marker);
        markerRoot.add(marker);
      }
      updateCharacterRigMarkerTexture(marker, markerConfig);
      const activeDrag = rigDragRef.current;
      const worldPosition = activeDrag?.pointId === markerConfig.id && activeDrag.currentWorldPosition
        ? activeDrag.currentWorldPosition
        : getCharacterRigMarkerWorldPosition(characterObject, markerConfig, bodyBounds, autoAnchors);
      if (!worldPosition) {
        marker.visible = false;
        return;
      }
      marker.visible = true;
      marker.position.copy(worldPosition);
      marker.material.opacity = markerConfig.selected || markerConfig.enabled ? 1 : 0.46;
      marker.userData.characterRigPointId = markerConfig.id;
      marker.userData.characterRigMarkerSocket = markerConfig.socket || 'armor';
      if (camera) {
        const distance = Math.max(0.1, camera.position.distanceTo(marker.position));
        const markerSize = Number.isFinite(Number(markerConfig.size)) ? Number(markerConfig.size) : 1;
        const selectedScale = markerConfig.selected ? 1.18 : 1;
        marker.scale.setScalar(ThreeMathUtils.clamp(distance * 0.065 * markerSize * selectedScale, 0.045 * markerSize, 0.28 * markerSize));
      }
    });

    markers.forEach((markerConfig) => {
      if (!markerConfig.connectTo) return;
      const marker = rigMarkersRef.current.get(markerConfig.id);
      const connectedMarker = rigMarkersRef.current.get(markerConfig.connectTo);
      if (!marker?.visible || !connectedMarker?.visible) return;
      activeLines.add(markerConfig.id);
      let line = rigMarkerLinesRef.current.get(markerConfig.id);
      if (!line) {
        line = createCharacterRigMarkerLine(markerConfig);
        rigMarkerLinesRef.current.set(markerConfig.id, line);
        markerRoot.add(line);
      }
      const positionAttribute = line.geometry.getAttribute('position');
      positionAttribute.setXYZ(0, connectedMarker.position.x, connectedMarker.position.y, connectedMarker.position.z);
      positionAttribute.setXYZ(1, marker.position.x, marker.position.y, marker.position.z);
      positionAttribute.needsUpdate = true;
      line.visible = true;
    });

    rigMarkersRef.current.forEach((marker, markerKey) => {
      if (!activeMarkers.has(markerKey)) marker.visible = false;
    });
    rigMarkerLinesRef.current.forEach((line, lineKey) => {
      if (!activeLines.has(lineKey)) line.visible = false;
    });
  }, []);

  syncCharacterRigMarkersRef.current = syncCharacterRigMarkers;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new ThreeWebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    } catch {
      setWebglError('Aperçu 3D indisponible.');
      return undefined;
    }

    renderer.outputColorSpace = ThreeSRGBColorSpace;
    renderer.toneMapping = ThreeACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = ThreePCFShadowMap;
    renderer.domElement.className = 'character3d-canvas';
    renderer.domElement.setAttribute('aria-label', 'Aperçu personnage 3D');
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new ThreeScene();
    scene.background = new ThreeColor('#07111e');
    scene.fog = new ThreeFog('#07111e', 7, 16);
    sceneRef.current = scene;
    const pmremGenerator = new ThreePMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;

    const camera = new ThreePerspectiveCamera(48, 1, 0.1, 60);
    camera.position.set(0, 1.72, -4.25);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = CHARACTER_CAMERA_ZOOM_MIN_DISTANCE;
    controls.maxDistance = CHARACTER_CAMERA_ZOOM_MAX_DISTANCE;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 1.05, 0);
    controlsRef.current = controls;
    applyCharacterCameraView(camera, controls, latestCameraViewRef.current, camera.position.distanceTo(controls.target));
    camera.userData.characterPreviewBaseDistance = camera.position.distanceTo(controls.target);
    applyInitialCharacterCameraZoom(camera, controls, initialCameraZoom);
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
    });
    let reportedZoomPercent = null;
    let cameraZoomDrag = null;

    const drawRigMagnifier = () => {
      const magnifier = rigMagnifierStateRef.current;
      if (!magnifier.active || !magnifier.pointId) return;
      const marker = rigMarkersRef.current.get(magnifier.pointId);
      if (!marker?.visible) return;
      const previousRigMarkerRootVisible = rigMarkerRoot.visible;
      rigMarkerRoot.visible = false;
      try {
        renderer.render(scene, camera);
        drawCharacterRigMagnifierCanvas({
          canvas: rigMagnifierCanvasRef.current,
          renderer,
          camera,
          marker,
          socket: magnifier.socket || marker.userData?.characterRigMarkerSocket || 'armor',
        });
      } finally {
        rigMarkerRoot.visible = previousRigMarkerRootVisible;
      }
    };

    const reportCameraZoom = () => {
      const percent = getCharacterCameraZoomPercent(camera, controls);
      if (percent === reportedZoomPercent) return;
      reportedZoomPercent = percent;
      latestOnCameraZoomChangeRef.current?.(percent);
    };

    const handleControlsChange = () => {
      reportCameraZoom();
    };
    controls.addEventListener?.('change', handleControlsChange);
    reportCameraZoom();

    const hemi = new ThreeHemisphereLight('#fff7ea', '#1f1814', 1.02);
    scene.add(hemi);
    const key = new ThreeDirectionalLight('#fff6e6', 2.25);
    key.position.set(-3.8, 5.8, 4.8);
    key.castShadow = true;
    key.shadow.camera.near = 0.5;
    key.shadow.camera.far = 18;
    key.shadow.camera.left = -5;
    key.shadow.camera.right = 5;
    key.shadow.camera.top = 5;
    key.shadow.camera.bottom = -5;
    scene.add(key);
    const frontFill = new ThreeDirectionalLight('#f7f3ec', 0.58);
    frontFill.position.set(3.2, 2.4, 5.4);
    scene.add(frontFill);
    const rim = new ThreeDirectionalLight('#ffe0bd', 0.18);
    rim.position.set(3.4, 3.8, -4.2);
    scene.add(rim);
    const ambient = new ThreeAmbientLight('#fff3e0', 0.28);
    scene.add(ambient);
    lightsRef.current = { hemi, key, frontFill, rim, ambient };
    applyPreviewLighting(model, renderer, lightsRef.current);

    const floorTexture = new ThreeCanvasTexture(createPreviewFloorCanvas({
      backgroundColor: '#0f1b2d',
      oddColor: '#172741',
      evenColor: '#101d31',
      cellLineColor: 'rgba(103, 232, 249, .11)',
      markerColor: 'rgba(245, 158, 11, .2)',
      markerLineWidth: 5,
      markerShape: 'circle',
      markerRadius: 132,
    }));
    floorTexture.wrapS = ThreeRepeatWrapping;
    floorTexture.wrapT = ThreeRepeatWrapping;
    floorTexture.repeat.set(4, 4);
    floorTexture.colorSpace = ThreeSRGBColorSpace;
    const floorMaterial = new ThreeMeshStandardMaterial({ map: floorTexture, roughness: 0.88, metalness: 0 });
    floorMaterial.userData.disposeTextures = true;
    const floor = new ThreeMesh(new ThreeCircleGeometry(2.35, 72), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new ThreeGridHelper(4.8, 16, '#67e8f9', '#263c5c');
    grid.material.transparent = true;
    grid.material.opacity = 0.28;
    grid.position.y = 0.018;
    scene.add(grid);

    const characterRoot = new ThreeGroup();
    characterRootRef.current = characterRoot;
    scene.add(characterRoot);
    const rigMarkerRoot = new ThreeGroup();
    rigMarkerRoot.name = 'CharacterRigMarkers';
    rigMarkerRootRef.current = rigMarkerRoot;
    scene.add(rigMarkerRoot);

    const resize = () => {
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(320, container.clientHeight);
      if (renderer.domElement.width !== Math.floor(width * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    let frameId = 0;
    let previousTime = 0;
    const render = (time = 0) => {
      resize();
      const delta = previousTime ? Math.min(0.05, (time - previousTime) / 1000) : 0;
      previousTime = time;
      animationMixersRef.current.forEach((mixer) => mixer.update(delta));
      updateFingerTipsWeaponSockets(characterObjectRef.current);
      controls.update();
      syncCharacterRigMarkersRef.current?.(camera);
      drawRigMagnifier();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    const raycaster = new ThreeRaycaster();
    const pointer = new ThreeVector2();
    const screenWorldPoint = new ThreeVector3();

    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      raycaster.setFromCamera(pointer, camera);
    };

    const getPointerWorldPositionAtDepth = (event, screenDepth, target = screenWorldPoint) => {
      updatePointer(event);
      if (!Number.isFinite(screenDepth)) return null;
      return target.set(pointer.x, pointer.y, screenDepth).unproject(camera);
    };

    const findRigMarkerHit = (event) => {
      updatePointer(event);
      const markerObjects = Array.from(rigMarkersRef.current.values()).filter((marker) => marker.visible);
      return raycaster.intersectObjects(markerObjects, false)[0] || null;
    };

    const getRigMarkerHitPointId = (hit = null) => (
      hit?.object?.userData?.characterRigMarker
        ? (hit.object.userData.characterRigPointId || '')
        : ''
    );

    const commitRigMarkerWorldPosition = (pointId, worldPosition, boundsOverride = null) => {
      const nextPoint = getCharacterRigPointFromWorld(characterObjectRef.current, worldPosition, boundsOverride);
      if (!nextPoint) return;
      const drag = rigDragRef.current;
      if (
        drag?.lastPosition
        && drag.lastPosition.x === nextPoint.x
        && drag.lastPosition.y === nextPoint.y
        && drag.lastPosition.z === nextPoint.z
      ) return;
      if (drag) drag.lastPosition = nextPoint;
      latestOnCharacterRigMarkerChangeRef.current?.(pointId, {
        ...nextPoint,
        enabled: true,
      });
    };

    const endRigDrag = (event) => {
      const drag = rigDragRef.current;
      if (!drag) return;
      if (drag.currentWorldPosition) {
        commitRigMarkerWorldPosition(drag.pointId, drag.currentWorldPosition, drag.bodyBounds);
      }
      rigDragRef.current = null;
      controls.enabled = true;
      container.classList.remove('is-rig-dragging');
      try {
        renderer.domElement.releasePointerCapture?.(drag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
      const nextHoverPointId = event ? getRigMarkerHitPointId(findRigMarkerHit(event)) : '';
      if (nextHoverPointId) setRigMagnifierTarget(nextHoverPointId, 'hover');
      else clearRigMagnifierTarget(true);
    };

    const handleRigPointerDown = (event) => {
      if (event.button !== 0 || latestCameraZoomDragEnabledRef.current || !latestCharacterRigMarkersRef.current?.length) return;
      syncCharacterRigMarkersRef.current?.(camera);
      const hit = findRigMarkerHit(event);
      if (!hit?.object?.userData?.characterRigMarker) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const marker = hit.object;
      const pointId = marker.userData.characterRigPointId || '';
      if (!pointId) return;
      latestOnCharacterRigMarkerSelectRef.current?.(pointId);
      const screenDepth = marker.position.clone().project(camera).z;
      const startWorldPosition = getPointerWorldPositionAtDepth(event, screenDepth, new ThreeVector3())?.clone() || marker.position.clone();
      marker.position.copy(startWorldPosition);
      rigDragRef.current = {
        pointId,
        pointerId: event.pointerId,
        screenDepth,
        currentWorldPosition: startWorldPosition,
        bodyBounds: getCharacterPreviewBodyBounds(characterObjectRef.current),
        lastPosition: null,
      };
      controls.enabled = false;
      container.classList.add('is-rig-dragging');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
      setRigMagnifierTarget(pointId, 'drag');
    };

    const handleRigPointerMove = (event) => {
      const drag = rigDragRef.current;
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const nextWorldPosition = getPointerWorldPositionAtDepth(event, drag.screenDepth, new ThreeVector3())?.clone();
      if (!nextWorldPosition) return;
      drag.currentWorldPosition = nextWorldPosition;
      const marker = rigMarkersRef.current.get(drag.pointId);
      if (marker) marker.position.copy(nextWorldPosition);
      setRigMagnifierTarget(drag.pointId, 'drag');
      syncCharacterRigMarkersRef.current?.(camera);
    };

    const handleRigHoverPointerMove = (event) => {
      if (rigDragRef.current || cameraZoomDrag || !latestCharacterRigMarkersRef.current?.length) return;
      const pointId = getRigMarkerHitPointId(findRigMarkerHit(event));
      if (pointId) setRigMagnifierTarget(pointId, 'hover');
      else clearRigMagnifierTarget();
    };

    const handleRigPointerLeave = () => {
      clearRigMagnifierTarget();
    };

    const handleCameraZoomPointerDown = (event) => {
      if (event.button !== 0 || !latestCameraZoomDragEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      window.getSelection?.()?.removeAllRanges?.();
      cameraZoomDrag = {
        pointerId: event.pointerId,
        lastY: event.clientY,
      };
      controls.enabled = false;
      container.classList.add('is-camera-zooming');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
    };

    const handleCameraZoomPointerMove = (event) => {
      if (!cameraZoomDrag || cameraZoomDrag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const deltaY = event.clientY - cameraZoomDrag.lastY;
      cameraZoomDrag.lastY = event.clientY;
      applyCharacterCameraZoomDelta(camera, controls, deltaY);
      reportCameraZoom();
    };

    const endCameraZoom = (event) => {
      if (!cameraZoomDrag || (event?.pointerId !== undefined && cameraZoomDrag.pointerId !== event.pointerId)) return;
      try {
        renderer.domElement.releasePointerCapture?.(cameraZoomDrag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
      cameraZoomDrag = null;
      controls.enabled = true;
      container.classList.remove('is-camera-zooming');
      reportCameraZoom();
    };

    renderer.domElement.addEventListener('pointerdown', handleCameraZoomPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleRigPointerDown, true);
    renderer.domElement.addEventListener('pointermove', handleCameraZoomPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleRigPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleRigHoverPointerMove, true);
    renderer.domElement.addEventListener('pointerleave', handleRigPointerLeave, true);
    renderer.domElement.addEventListener('pointerup', endRigDrag, true);
    renderer.domElement.addEventListener('pointerup', endCameraZoom, true);
    renderer.domElement.addEventListener('pointercancel', endRigDrag, true);
    renderer.domElement.addEventListener('pointercancel', endCameraZoom, true);

    return () => {
      cancelAnimationFrame(frameId);
      controls.removeEventListener?.('change', handleControlsChange);
      renderer.domElement.removeEventListener('pointerdown', handleCameraZoomPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleRigPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', handleCameraZoomPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleRigPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleRigHoverPointerMove, true);
      renderer.domElement.removeEventListener('pointerleave', handleRigPointerLeave, true);
      renderer.domElement.removeEventListener('pointerup', endRigDrag, true);
      renderer.domElement.removeEventListener('pointerup', endCameraZoom, true);
      renderer.domElement.removeEventListener('pointercancel', endRigDrag, true);
      renderer.domElement.removeEventListener('pointercancel', endCameraZoom, true);
      detachCameraControls();
      controls.dispose();
      animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
      animationMixersRef.current = [];
      characterObjectRef.current = null;
      rigDragRef.current = null;
      cameraZoomDrag = null;
      disposeCharacterRigMarkers(rigMarkersRef.current);
      disposeCharacterRigMarkerLines(rigMarkerLinesRef.current);
      rigMarkerRootRef.current = null;
      clearGroup(characterRoot);
      disposeThreeObject(floor);
      scene.environment = null;
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      sceneRef.current = null;
      characterRootRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      lightsRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyPreviewLighting(model, rendererRef.current, lightsRef.current);
  }, [model?.previewLightIntensity, model?.previewLightOrientation]);

  useEffect(() => {
    applyCharacterPreviewSize(characterObjectRef.current, latestModelRef.current);
  }, [sizeSignature]);

  useEffect(() => {
    updateGltfModelMaterialAppearance(characterObjectRef.current, {
      materialBrightness: getCharacterMaterialBrightness(latestModelRef.current),
    });
  }, [appearanceSignature]);

  useEffect(() => {
    const characterRoot = characterRootRef.current;
    if (!characterRoot || !model) return undefined;
    let cancelled = false;
    animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
    animationMixersRef.current = [];
    embeddedAnimationClipsRef.current = [];
    characterObjectRef.current = null;
    clearGroup(characterRoot);
    const sources = getCharacterModelSources(model);
    if (sources.length) {
      if (isHeavyLocalFbxAsset(model)) {
        setPreviewStatus(`FBX local lourd (${formatBytes(Number(model.modelFileSize) || 0)}): convertis-le en GLB pour un preview fluide.`);
        setLoadedCharacterVersion((version) => version + 1);
        return undefined;
      }
      setPreviewStatus('Chargement du modèle 3D...');
      const loadingRoot = new ThreeGroup();
      characterRoot.add(loadingRoot);
      loadThreeCharacter(sources, model, (object, animationClips) => {
        if (cancelled || characterRoot.userData?.disposed) {
          disposeThreeObject(object);
          return;
        }
        embeddedAnimationClipsRef.current = animationClips || [];
        onAnimationClipsLoadedRef.current?.(model?.id || '', summarizeEmbeddedAnimationClips(animationClips));
        try {
          applyCharacterPreviewSize(object, latestModelRef.current);
          updateGltfModelMaterialAppearance(object, {
            materialBrightness: getCharacterMaterialBrightness(latestModelRef.current),
          });
          clearGroup(loadingRoot);
          loadingRoot.add(object);
          characterObjectRef.current = object;
          setPreviewStatus('');
          setLoadedCharacterVersion((version) => version + 1);
        } catch (error) {
          clearGroup(loadingRoot);
          disposeThreeObject(object);
          setPreviewStatus(error?.message ? `Modèle 3D non affiché: ${error.message}` : 'Modèle 3D non affiché.');
          setLoadedCharacterVersion((version) => version + 1);
          return;
        }
      }, (error) => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        setPreviewStatus(error?.message ? `Modèle 3D non affiché: ${error.message}` : 'Modèle 3D non affiché.');
        setLoadedCharacterVersion((version) => version + 1);
      });
    } else {
      setPreviewStatus('Aucun modèle 3D importé.');
      setLoadedCharacterVersion((version) => version + 1);
    }
    return () => {
      cancelled = true;
      characterObjectRef.current = null;
      animationMixersRef.current.forEach((mixer) => mixer.stopAllAction());
      animationMixersRef.current = [];
    };
  }, [modelSignature]);

  useEffect(() => {
    const characterRoot = characterRootRef.current;
    const characterObject = characterObjectRef.current;
    if (loadedCharacterVersion <= 0) return undefined;
    if (!characterRoot || !characterObject) return undefined;
    const nextSignatures = {
      weapon: equipmentSignatures.weapon || '',
      armor: equipmentSignatures.armor || '',
      shield: equipmentSignatures.shield || '',
      helmet: equipmentSignatures.helmet || '',
      leggings: equipmentSignatures.leggings || '',
    };
    const isNewCharacter = previewEquipmentCharacterVersionRef.current !== loadedCharacterVersion;
    const previousSignatures = previewEquipmentSignaturesRef.current || {};
    const rolesToUpdate = PREVIEW_EQUIPMENT_ROLES.filter((role) => (
      isNewCharacter || previousSignatures[role] !== nextSignatures[role]
    ));
    previewEquipmentCharacterVersionRef.current = loadedCharacterVersion;
    previewEquipmentSignaturesRef.current = nextSignatures;
    if (!rolesToUpdate.length) return undefined;

    rolesToUpdate.forEach((role) => {
      previewEquipmentRequestIdsRef.current[role] = (previewEquipmentRequestIdsRef.current[role] || 0) + 1;
      removePreviewEquipmentAttachments(characterObject, role);
    });

    Promise.all(rolesToUpdate.map((role) => {
      const requestId = previewEquipmentRequestIdsRef.current[role];
      return attachPreviewEquipmentRoleModel(
        characterObject,
        latestModelRef.current,
        role,
        () => (
          characterRoot.userData?.disposed
          || characterObjectRef.current !== characterObject
          || previewEquipmentRequestIdsRef.current[role] !== requestId
        ),
      );
    })).then((results) => {
      const failed = results.reduce((sum, result) => sum + (Number(result?.failed) || 0), 0);
      if (!characterRoot.userData?.disposed && characterObjectRef.current === characterObject && failed) {
          setPreviewStatus('Équipement 3D non accroché sur ce rig.');
      }
    });
    return undefined;
  }, [
    equipmentSignatures.armor,
    equipmentSignatures.helmet,
    equipmentSignatures.leggings,
    equipmentSignatures.shield,
    equipmentSignatures.weapon,
    loadedCharacterVersion,
  ]);

  useEffect(() => {
    const characterRoot = characterRootRef.current;
    const object = characterObjectRef.current;
    if (loadedCharacterVersion <= 0) return undefined;
    if (!characterRoot || !object) return undefined;
    let cancelled = false;
    const stopCurrentMixers = () => {
      animationMixersRef.current.forEach((currentMixer) => currentMixer.stopAllAction());
      animationMixersRef.current = [];
    };
    stopCurrentMixers();
    const previewSlot = (animationSlot || autoPreviewAnimation)
      ? getPreviewAnimationSlot(model, animationSlot)
      : '';
    if (previewSlot) {
      const previewSlotLabel = getPreviewAnimationStatusLabel(previewSlot);
      setPreviewStatus(`Chargement animation ${previewSlotLabel}...`);
      const previewAnimationOptions = getPreviewAnimationOptions(previewSlot);
      loadCachedPreviewAnimationAsset(model?.modelAnimations?.[previewSlot] || {}, previewAnimationCacheRef.current).then(({ clips: externalClips = [], format = '' } = {}) => {
        if (cancelled || characterRoot.userData?.disposed || characterObjectRef.current !== object) {
          return;
        }
        stopCurrentMixers();
        if (!externalClips.length) {
          setPreviewStatus(`Animation ${previewSlotLabel} non chargée: aucun clip lisible.`);
          return;
        }
        try {
          const externalMixer = playGltfAnimations(object, externalClips, {
            timeOffset: performance.now() * 0.001,
            convertFbxRootQuaternionTracks: String(format || '').toLowerCase() === 'fbx',
            stripObjectPositionScaleTracks: true,
            ...previewAnimationOptions,
          });
          if (!externalMixer) {
            setPreviewStatus(`Animation ${previewSlotLabel} non jouee: aucun clip compatible.`);
            return;
          }
          animationMixersRef.current = [externalMixer];
          setPreviewStatus('');
        } catch (error) {
          animationMixersRef.current = [];
          setPreviewStatus(error?.message ? `Animation ${previewSlotLabel} non jouee: ${error.message}` : `Animation ${previewSlotLabel} non jouee.`);
        }
      }).catch((error) => {
        if (cancelled || characterRoot.userData?.disposed || characterObjectRef.current !== object) return;
        stopCurrentMixers();
        setPreviewStatus(error?.message ? `Animation ${previewSlotLabel} non chargée: ${error.message}` : `Animation ${previewSlotLabel} non chargée.`);
      });
    } else if (playEmbeddedAnimations) {
      try {
        const mixer = playGltfAnimations(object, embeddedAnimationClipsRef.current, {
          timeOffset: performance.now() * 0.001,
          ...getPreviewAnimationOptions(''),
        });
        animationMixersRef.current = mixer ? [mixer] : [];
        setPreviewStatus('');
      } catch (error) {
        animationMixersRef.current = [];
        setPreviewStatus(error?.message ? `Animation incluse non jouee: ${error.message}` : 'Animation incluse non jouee.');
      }
    } else {
      animationMixersRef.current = [];
      setPreviewStatus('');
    }
    return () => {
      cancelled = true;
      stopCurrentMixers();
    };
  }, [animationSlot, autoPreviewAnimation, playEmbeddedAnimations, model?.modelAnimations, loadedCharacterVersion]);

  return (
    <div
      ref={containerRef}
      className={`character3d-canvas-shell ${characterRigMarkers?.length ? 'character3d-canvas-shell-rig' : ''} ${cameraZoomDragEnabled ? 'character3d-canvas-shell-zoom' : ''}`}
    >
      {children}
      {rigMagnifierState.active ? (
        <div className={`character-rigging-marker-zoom ${rigMagnifierState.socket || 'armor'} ${rigMagnifierState.mode === 'drag' ? 'dragging' : ''}`} aria-hidden="true">
          <canvas
            ref={rigMagnifierCanvasRef}
            className="character-rigging-marker-zoom-canvas"
            width={CHARACTER_RIG_MAGNIFIER_CANVAS_SIZE}
            height={CHARACTER_RIG_MAGNIFIER_CANVAS_SIZE}
          />
        </div>
      ) : null}
      {webglError ? <div className="character3d-webgl-error">{webglError}</div> : null}
      {!webglError && previewStatus ? <div className="character3d-preview-status">{previewStatus}</div> : null}
    </div>
  );
}
