import * as THREE from 'three';

import {
  clone as cloneGltfScene,
} from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  applyObjectAxisScaleRatios,
  fitObjectToHeight,
  getRuntimeModelPrepareOptions,
  prepareGltfModel,
} from '../../utils/threeGltfUtils';

import {
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  clamp,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getCharacterModelScale,
  getEntityZ as getEntityLift,
} from '../../utils/rpg3dDomain.js';

import {
  createActorAnimationController,
  getActorAnimationOptions,
  getActorAnimationState,
  getActorMovementFacingTarget,
  getImageSignature,
  getModelAnimationsSignature,
  getModelResourcesSignature,
  hashString,
  updateActorAnimationState,
} from './rpg3dRuntimeModels.js';

import {
  applyMaterialBrightnessFromBase,
  assignEntity,
  collectDynamicAnimationMixers,
  createImageShadowCasterPlane,
  createSelectionRing,
  degreesToRadians,
  enableObjectShadows,
  ENEMY_RADIUS,
  getEntityLiftHeight,
  getSupportSurfaceHeightAtPoint,
  isSelectionActive,
  normalize,
  removeGroupChild,
  scaleRootFromBase,
  setTransformBase,
  toScenePosition,
  WORLD_SCALE,
} from './rpg3dSceneShared.js';

const CHARACTER_PRESETS = [
  { id: 'runner', body: '#d7b56d', accent: '#67e8f9', weapon: '#e0f7ff' },
  { id: 'knight', body: '#94a3b8', accent: '#f8fafc', weapon: '#cbd5e1' },
  { id: 'mage', body: '#8b5cf6', accent: '#c4b5fd', weapon: '#f5d0fe' },
  { id: 'ranger', body: '#22c55e', accent: '#86efac', weapon: '#bbf7d0' },
  { id: 'guard', body: '#ef4444', accent: '#fca5a5', weapon: '#fecaca' },
  { id: 'sniper', body: '#facc15', accent: '#fde68a', weapon: '#fef3c7' },
  { id: 'brute', body: '#f97316', accent: '#fed7aa', weapon: '#ffedd5' },
  { id: 'shadow', body: '#64748b', accent: '#a78bfa', weapon: '#ddd6fe' },
];

const WEAPON_SOCKET_NAME_KEYS = [
  'weaponsocketr',
  'weaponsocketright',
  'rightweaponsocket',
  'rweaponsocket',
  'righthandsocket',
];

const SHIELD_SOCKET_NAME_KEYS = [
  'shieldsocketl',
  'shieldsocketleft',
  'leftshieldsocket',
  'lshieldsocket',
  'weaponsocketl',
  'weaponsocketleft',
  'leftweaponsocket',
  'lweaponsocket',
  'leftforearmsocket',
  'lforearmsocket',
  'leftlowerarmsocket',
  'llowerarmsocket',
  'forearmsocketl',
  'lowerarmsocketl',
];

const FINGER_NAME_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'];

const normalizeRigObjectName = (name = '') => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const hasRightRigMarker = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  const raw = String(name || '').toLowerCase();
  return normalized.includes('right')
    || normalized.includes('baser')
    || normalized.startsWith('r')
    || /(^|[:_.\-\s])r($|[:_.\-\s])/.test(raw);
};

const hasLeftRigMarker = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  const raw = String(name || '').toLowerCase();
  return normalized.includes('left')
    || normalized.includes('basel')
    || normalized.endsWith('l')
    || (normalized.startsWith('l') && !normalized.startsWith('little') && !normalized.startsWith('lower'))
    || /(^|[:_.\-\s])l($|[:_.\-\s])/.test(raw);
};

const isFingerRigName = (name = '') => FINGER_NAME_KEYS.some((key) => normalizeRigObjectName(name).includes(key));

const findFirstRigObject = (root, predicate) => {
  let match = null;
  root?.traverse?.((child) => {
    if (!match && predicate(child)) match = child;
  });
  return match;
};

const isRightHandRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  return normalized.includes('righthand')
    || normalized.includes('rhand')
    || normalized.includes('handr')
    || normalized.includes('rightpalm')
    || normalized.includes('rpalm')
    || normalized.includes('palmr');
};

const isLeftHandRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  return normalized.includes('lefthand')
    || normalized.includes('lhand')
    || normalized.includes('handl')
    || normalized.includes('leftpalm')
    || normalized.includes('lpalm')
    || normalized.includes('palml');
};

const isLeftForearmRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  const hasForearmMarker = normalized.includes('forearm')
    || normalized.includes('lowerarm')
    || normalized.includes('armtwist');
  return hasForearmMarker && (
    hasLeftRigMarker(name)
    || normalized.includes('leftforearm')
    || normalized.includes('leftlowerarm')
    || normalized.includes('forearml')
    || normalized.includes('lowerarml')
  );
};

const findRightHandFromFingerBones = (root) => {
  const candidates = new Map();
  root?.traverse?.((child) => {
    if (!child?.isBone || !isFingerRigName(child.name) || !hasRightRigMarker(child.name)) return;
    let ancestor = child.parent;
    while (ancestor?.isBone && isFingerRigName(ancestor.name)) ancestor = ancestor.parent;
    if (!ancestor?.isBone) return;
    candidates.set(ancestor, (candidates.get(ancestor) || 0) + 1);
  });
  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 2)?.[0] || null;
};

const findLeftForearmFromFingerBones = (root) => {
  const candidates = new Map();
  root?.traverse?.((child) => {
    if (!child?.isBone || !isFingerRigName(child.name) || !hasLeftRigMarker(child.name)) return;
    let ancestor = child.parent;
    while (ancestor?.isBone && isFingerRigName(ancestor.name)) ancestor = ancestor.parent;
    let forearm = null;
    let cursor = ancestor;
    while (cursor?.isBone) {
      if (isLeftForearmRigName(cursor.name)) {
        forearm = cursor;
        break;
      }
      cursor = cursor.parent;
    }
    const candidate = forearm || ancestor;
    if (!candidate?.isBone) return;
    candidates.set(candidate, (candidates.get(candidate) || 0) + 1);
  });
  return [...candidates.entries()]
    .sort((a, b) => b[1] - a[1])
    .find(([, count]) => count >= 2)?.[0] || null;
};

const findRightHandWeaponSocket = (root) => (
  findFirstRigObject(root, (child) => WEAPON_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)))
  || findFirstRigObject(root, (child) => child?.isBone && isRightHandRigName(child.name))
  || findRightHandFromFingerBones(root)
);

const findLeftForearmShieldSocket = (root) => (
  findFirstRigObject(root, (child) => SHIELD_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)))
  || findFirstRigObject(root, (child) => child?.isBone && isLeftForearmRigName(child.name))
  || findLeftForearmFromFingerBones(root)
  || findFirstRigObject(root, (child) => child?.isBone && isLeftHandRigName(child.name))
);

const getEquippedWeaponItem = (actor = {}) => {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  return inventory.find((item) => (
    item?.type === 'weapon'
    && item.equipped
    && (item.weaponModelUrl || item.modelUrl)
  )) || null;
};

const getEquippedShieldItem = (actor = {}) => {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  return inventory.find((item) => (
    item?.type === 'shield'
    && item.equipped
    && (item.weaponModelUrl || item.modelUrl)
  )) || null;
};

const getWeaponModelSource = (item = {}) => item?.weaponModelUrl || item?.modelUrl || '';

const getWeaponModelPayload = (item = {}) => ({
  modelUrl: getWeaponModelSource(item),
  modelName: item?.weaponModelName || item?.modelName || '',
  modelFormat: item?.weaponModelFormat || item?.modelFormat || '',
  modelFileSize: Number(item?.weaponModelFileSize || item?.modelFileSize) || 0,
  modelResources: Array.isArray(item?.weaponModelResources)
    ? item.weaponModelResources
    : (Array.isArray(item?.modelResources) ? item.modelResources : []),
});

const getEquipmentItemModelSignature = (item = null) => {
  if (!item) return '';
  const payload = getWeaponModelPayload(item);
  return [
    item.type || '',
    item.id || '',
    item.weaponModel3dId || item.model3dId || '',
    item.weaponModelName || item.modelName || '',
    getImageSignature(getWeaponModelSource(item)),
    getModelResourcesSignature(payload),
    Number(item.weaponModelScale) || 1,
    Number(item.weaponOffsetX) || 0,
    Number(item.weaponOffsetY) || 0,
    Number(item.weaponOffsetZ) || 0,
    Number(item.weaponRotationX) || 0,
    Number(item.weaponRotationY) || 0,
    Number(item.weaponRotationZ) || 0,
  ].join(':');
};

const getWeaponModelSignature = (actor = {}) => getEquipmentItemModelSignature(getEquippedWeaponItem(actor));

const getEquipmentModelSignature = (actor = {}) => [
  getWeaponModelSignature(actor),
  getEquipmentItemModelSignature(getEquippedShieldItem(actor)),
].join('|');

const DEFAULT_ENEMY_CHARACTER_BY_ROLE = {
  rifle: 'guard',
  sniper: 'sniper',
  brute: 'brute',
};

const applyActorMaterialBrightness = (root, actor = {}) => {
  if (!root) return false;
  const brightness = getCharacterMaterialBrightness(actor);
  if (root.userData?.rpg3dActorMaterialBrightness === brightness) return false;
  let didUpdate = false;
  root.traverse?.((child) => {
    if (!child.isMesh && !child.isSkinnedMesh && !child.isSprite) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (!material.userData?.rpg3dAppearanceManaged && !material.userData?.rpg3dActorAppearanceManaged) return;
      didUpdate = applyMaterialBrightnessFromBase(material, brightness) || didUpdate;
    });
  });
  root.userData.rpg3dActorMaterialBrightness = brightness;
  return didUpdate;
};

const getEnemyCharacterId = (enemy = {}) => enemy.character || DEFAULT_ENEMY_CHARACTER_BY_ROLE[enemy.role] || 'guard';

const getHeroCharacterId = (hero = {}) => hero.character || 'runner';

const getCharacterPreset = (id = 'runner', fallbackId = 'runner') => (
  CHARACTER_PRESETS.find((preset) => preset.id === id)
  || CHARACTER_PRESETS.find((preset) => preset.id === fallbackId)
  || CHARACTER_PRESETS[0]
);

const getCharacterRenderMode = (actor = {}) => actor.characterRenderMode || 'capsule';

const addGltfActorModel = (actorGroup, template, actor, height, radius3d, selected, modelScale, animationTime = 0, animationOptions = {}) => {
  const instance = cloneGltfScene(template);
  instance.traverse((child) => {
    child.userData.preserveSharedResources = true;
  });
  prepareGltfModel(instance, getRuntimeModelPrepareOptions(template.userData?.modelFormat, {
    restoreTextureColor: true,
    forceLitMaterials: true,
    hasResourceTextures: Boolean(template.userData?.hasModelResources),
    cloneMaterials: true,
    forceDoubleSidedMaterials: true,
    forceVisibleMaterials: true,
    forceVisibleMeshes: true,
    ignoreOpacityTextures: true,
    minimumOpacity: 0.08,
    materialBrightness: getCharacterMaterialBrightness(actor),
  }));
  const targetHeight = height * 1.28;
  const axisScale = getCharacterModelAxisScale(actor);
  enableObjectShadows(instance);
  const animationController = createActorAnimationController(instance, template, animationOptions.state, animationTime);
  const fitted = fitObjectToHeight(instance, targetHeight, { groundY: 0 });
  if (fitted) applyObjectAxisScaleRatios(instance, axisScale, modelScale, { groundY: 0 });
  if (fitted) {
    actorGroup.add(instance);
  } else {
    const fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius3d * modelScale, Math.max(0.2, height - radius3d * 2 * modelScale), 6, 14),
      new THREE.MeshStandardMaterial({
        color: selected ? '#f8fbff' : '#facc15',
        emissive: '#67e8f9',
        emissiveIntensity: 0.12,
        roughness: 0.55,
        metalness: 0.04,
      }),
    );
    fallback.position.y = height / 2;
    fallback.castShadow = true;
    fallback.receiveShadow = true;
    actorGroup.add(fallback);
  }
  if (animationController) actorGroup.userData.animationController = animationController;
  if (fitted && animationOptions.weaponTemplate && animationOptions.weaponItem) {
    addEquippedWeaponToActorModel(instance, animationOptions.weaponTemplate, animationOptions.weaponItem);
  }
  if (fitted && animationOptions.shieldTemplate && animationOptions.shieldItem) {
    addEquippedShieldToActorModel(instance, animationOptions.shieldTemplate, animationOptions.shieldItem);
  }
  if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * Math.max(axisScale.x, axisScale.z), '#f8fbff'));
  return { mixer: animationController?.mixer || null, animationController, axisScaleApplied: Boolean(fitted) };
};

const fitWeaponModelToLargestDimension = (object, targetSize = 1.15) => {
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const largest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(largest) || largest <= 0.0001) return;
  object.scale.multiplyScalar(targetSize / largest);
};

const addEquippedModelToActorSocket = (actorModel, modelTemplate, item = {}, findSocket, role = 'equipment') => {
  const socket = findSocket?.(actorModel);
  if (!socket || !modelTemplate) return false;
  const equipment = cloneGltfScene(modelTemplate);
  equipment.traverse((child) => {
    child.userData.preserveSharedResources = true;
  });
  prepareGltfModel(equipment, getRuntimeModelPrepareOptions(modelTemplate.userData?.modelFormat, {
    restoreTextureColor: true,
    forceLitMaterials: true,
    hasResourceTextures: Boolean(modelTemplate.userData?.hasModelResources),
    cloneMaterials: true,
    forceDoubleSidedMaterials: true,
    forceVisibleMaterials: true,
    forceVisibleMeshes: true,
  }));
  enableObjectShadows(equipment);
  const scale = Math.max(0.02, Number(item.weaponModelScale) || 1);
  fitWeaponModelToLargestDimension(equipment, scale);
  equipment.position.set(
    Number(item.weaponOffsetX) || 0,
    Number(item.weaponOffsetY) || 0,
    Number(item.weaponOffsetZ) || 0,
  );
  equipment.rotation.set(
    degreesToRadians(item.weaponRotationX || 0),
    degreesToRadians(item.weaponRotationY || 0),
    degreesToRadians(item.weaponRotationZ || 0),
  );
  equipment.userData.rpg3dEquipmentRole = role;
  equipment.userData.rpg3dEquipmentSocket = socket.name || '';
  if (role === 'weapon') {
    equipment.userData.rpg3dEquippedWeapon = true;
    equipment.userData.rpg3dWeaponSocket = socket.name || '';
  }
  if (role === 'shield') {
    equipment.userData.rpg3dEquippedShield = true;
    equipment.userData.rpg3dShieldSocket = socket.name || '';
  }
  socket.add(equipment);
  return true;
};

const addEquippedWeaponToActorModel = (actorModel, weaponTemplate, weaponItem = {}) => (
  addEquippedModelToActorSocket(actorModel, weaponTemplate, weaponItem, findRightHandWeaponSocket, 'weapon')
);

const addEquippedShieldToActorModel = (actorModel, shieldTemplate, shieldItem = {}) => (
  addEquippedModelToActorSocket(actorModel, shieldTemplate, shieldItem, findLeftForearmShieldSocket, 'shield')
);

const getActorVisualSignature = (actor = {}) => [
  actor.id || 'player',
  actor.character || '',
  actor.role || '',
  Math.round(getEntityLift(actor)),
  Math.round(Number(actor.rotation) || 0),
  actor.characterRenderMode || '',
  Math.round(getCharacterModelScale(actor) * 100),
  Math.round(getCharacterModelAxisScale(actor).x * 100),
  Math.round(getCharacterModelAxisScale(actor).z * 100),
  Math.round(getCharacterMaterialBrightness(actor) * 100),
  actor.characterImageName || '',
  getImageSignature(actor.characterImageData),
  actor.characterModel3dId || '',
  actor.characterModelName || '',
  getImageSignature(actor.characterModelUrl),
  getModelResourcesSignature(actor),
  getModelAnimationsSignature(actor),
  getEquipmentModelSignature(actor),
].join(':');

const getActorStructureSignature = (actor = {}) => [
  actor.id || 'player',
  actor.character || '',
  actor.role || '',
  actor.characterRenderMode || '',
  actor.characterImageName || '',
  getImageSignature(actor.characterImageData),
  actor.characterModel3dId || '',
  actor.characterModelName || '',
  getImageSignature(actor.characterModelUrl),
  getModelResourcesSignature(actor),
  getModelAnimationsSignature(actor),
  getWeaponModelSignature(actor),
].join(':');

const getActorSceneDimensions = (actor = {}, options = {}) => {
  const type = options.type || 'hero';
  const radius = Number(options.radius) || (type === 'enemy' ? ENEMY_RADIUS : PLAYER_RADIUS);
  const radius3d = Math.max(0.22, radius * WORLD_SCALE);
  const modelScale = getCharacterModelScale(actor);
  const axisScale = getCharacterModelAxisScale(actor);
  const widthScale = options.includeAxisScale ? axisScale.x : modelScale;
  const depthScale = options.includeAxisScale ? axisScale.z : modelScale;
  return {
    width: Math.max(0.24, radius3d * 2 * widthScale),
    height: Math.max(0.24, (type === 'player' ? 1.32 : 1.18) * modelScale),
    depth: Math.max(0.24, radius3d * 2 * depthScale),
  };
};

const addPickup = (group, config, pickup, selected, time) => {
  const position = toScenePosition(config, pickup.x, pickup.y, 0.42 + Math.sin(time * 4) * 0.04 + getEntityLiftHeight(pickup));
  const color = pickup.type === 'health' ? '#ef4444' : pickup.type === 'mana' ? '#38bdf8' : '#facc15';
  const pickupGroup = new THREE.Group();
  pickupGroup.position.copy(position);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(PICKUP_RADIUS * WORLD_SCALE, 0.055, 10, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.36 }),
  );
  ring.castShadow = true;
  ring.receiveShadow = true;
  pickupGroup.add(ring);
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(PICKUP_RADIUS * WORLD_SCALE * 0.52, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 0.75 }),
  );
  core.castShadow = true;
  core.receiveShadow = true;
  pickupGroup.add(core);
  if (selected) pickupGroup.add(createSelectionRing(PICKUP_RADIUS * WORLD_SCALE * 1.3, '#ffffff'));
  assignEntity(pickupGroup, { type: 'pickup', id: pickup.id });
  group.add(pickupGroup);
};

const addActor = (group, config, actor, options) => {
  const {
    type,
    id,
    radius,
    preset,
    selected,
    active,
    imageData,
    aimTarget,
    getTexture,
    getModel,
    renderMode: forcedRenderMode,
    modelScale: forcedModelScale,
    animationTime = 0,
    useStoredRotation = false,
    editMode = false,
    supportHeight = 0,
  } = options;
  const actorGroup = new THREE.Group();
  const lift = getEntityLiftHeight(actor);
  actorGroup.position.copy(toScenePosition(config, actor.x, actor.y, supportHeight + lift));
  const radius3d = Math.max(0.22, radius * WORLD_SCALE);
  const modelScale = forcedModelScale || getCharacterModelScale(actor);
  const actorBrightness = getCharacterMaterialBrightness(actor);
  const height = (type === 'player' ? 1.32 : 1.18) * modelScale;
  const bodyColor = active ? preset.accent : preset.body;
  const texture = getTexture(imageData);
  const renderMode = forcedRenderMode || getCharacterRenderMode(actor);
  const modelTemplate = renderMode === 'glb' ? getModel?.(actor.characterModelUrl, actor) : null;
  const equippedWeapon = renderMode === 'glb' ? getEquippedWeaponItem(actor) : null;
  const equippedWeaponSource = getWeaponModelSource(equippedWeapon);
  const weaponTemplate = equippedWeaponSource ? getModel?.(equippedWeaponSource, getWeaponModelPayload(equippedWeapon)) : null;
  const equippedShield = renderMode === 'glb' ? getEquippedShieldItem(actor) : null;
  const equippedShieldSource = getWeaponModelSource(equippedShield);
  const shieldTemplate = equippedShieldSource ? getModel?.(equippedShieldSource, getWeaponModelPayload(equippedShield)) : null;
  const animationState = getActorAnimationState(actor);
  const skinnedBodyColor = selected ? '#f8fbff' : texture ? '#d8e5f5' : bodyColor;
  const actorAnimationMixers = [];
  if (useStoredRotation) {
    actorGroup.rotation.y = degreesToRadians(actor.rotation || 0);
  } else if (aimTarget) {
    const aim = normalize((Number(aimTarget.x) || actor.x + 1) - actor.x, (Number(aimTarget.y) || actor.y) - actor.y);
    actorGroup.rotation.y = Math.atan2(aim.x, aim.y);
  } else {
    actorGroup.rotation.y = degreesToRadians(actor.rotation || 0);
  }

  const finalizeActorGroup = (axisScaleApplied = false) => {
    actorGroup.userData.rpg3dActorType = type;
    actorGroup.userData.rpg3dActorRadius = radius;
    actorGroup.userData.rpg3dActorRenderMode = renderMode;
    actorGroup.userData.rpg3dActorAxisScaleApplied = Boolean(axisScaleApplied);
    setTransformBase(actorGroup, getActorSceneDimensions(actor, {
      type,
      radius,
      includeAxisScale: Boolean(axisScaleApplied),
    }));
    applyActorMaterialBrightness(actorGroup, actor);
    assignEntity(actorGroup, { type, id });
    group.add(actorGroup);
  };

  const actorMaterial = (color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color: options.skin && texture ? '#ffffff' : color,
      map: options.skin && texture ? texture : null,
      roughness: options.roughness ?? 0.58,
      metalness: options.metalness ?? 0.04,
      emissive: options.emissive || preset.accent,
      emissiveIntensity: options.emissiveIntensity ?? (active ? 0.26 : 0.08),
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    return material;
  };

  const addTexturePanel = (width, panelHeight, y, z, opacity = 0.96) => {
    if (!texture) return;
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      color: '#ffffff',
      transparent: true,
      opacity,
      alphaTest: 0.06,
      side: THREE.DoubleSide,
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, panelHeight),
      material,
    );
    panel.position.set(0, y, z);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.material.shadowSide = THREE.DoubleSide;
    actorGroup.add(panel);
  };

  const addImageSprite = (width, spriteHeight, y, z = 0) => {
    if (!texture || renderMode === 'sprite') return;
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: '#ffffff',
      transparent: true,
      opacity: 0.98,
      alphaTest: 0.05,
      depthTest: false,
      depthWrite: false,
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, spriteHeight, 1);
    sprite.position.set(0, y, z);
    sprite.renderOrder = 12;
    actorGroup.add(sprite);
    const shadowCaster = createImageShadowCasterPlane(texture, width, spriteHeight, y, z);
    if (shadowCaster) actorGroup.add(shadowCaster);
  };

  const addFallbackActorBody = (color = skinnedBodyColor) => {
    const fallback = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius3d * 0.88 * modelScale, height * 0.58, 6, 12),
      actorMaterial(color, { metalness: 0.12, skin: false }),
    );
    fallback.position.y = height * 0.5;
    fallback.castShadow = true;
    fallback.receiveShadow = true;
    actorGroup.add(fallback);
    return fallback;
  };

  const addEditVisibilityRing = () => {
    if (!editMode || selected) return;
    const ring = createSelectionRing(radius3d * 1.95 * modelScale, '#67e8f9');
    ring.material.opacity = 0.48;
    actorGroup.add(ring);
  };

  if (renderMode === 'glb' && actor.characterModelUrl) {
    let actorAxisScaleApplied = false;
    if (!modelTemplate) {
      addFallbackActorBody();
      if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * modelScale, '#f8fbff'));
    } else {
      try {
        const animation = addGltfActorModel(
          actorGroup,
          modelTemplate,
          actor,
          height,
          radius3d,
          selected,
          modelScale,
          animationTime,
          {
            ...getActorAnimationOptions(animationState),
            weaponTemplate,
            weaponItem: equippedWeapon,
            shieldTemplate,
            shieldItem: equippedShield,
          },
        );
        actorAxisScaleApplied = Boolean(animation?.axisScaleApplied);
        if (animation?.mixer) {
          actorAnimationMixers.push(animation.mixer);
          if (!Array.isArray(group.userData.animationMixers)) group.userData.animationMixers = [];
          group.userData.animationMixers.push(animation.mixer);
        }
      } catch {
        addFallbackActorBody('#facc15');
        if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * modelScale, '#f8fbff'));
      }
    }
    addEditVisibilityRing();
    if (actorAnimationMixers.length) actorGroup.userData.animationMixers = actorAnimationMixers;
    finalizeActorGroup(actorAxisScaleApplied);
    return;
  }

  if (renderMode === 'sprite' && texture) {
    const material = new THREE.SpriteMaterial({
      map: texture,
      color: '#ffffff',
      transparent: true,
      alphaTest: 0.08,
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(radius3d * 3.4 * modelScale, height * 1.18, 1);
    sprite.position.y = height * 0.58;
    actorGroup.add(sprite);
    const shadowCaster = createImageShadowCasterPlane(
      texture,
      radius3d * 3.4 * modelScale,
      height * 1.18,
      height * 0.58,
    );
    if (shadowCaster) actorGroup.add(shadowCaster);
  } else if (renderMode === 'block') {
    const bodyGeometry = new THREE.BoxGeometry(radius3d * 1.7 * modelScale, height * 0.62, radius3d * 1.15 * modelScale);
    const body = new THREE.Mesh(bodyGeometry, actorMaterial(skinnedBodyColor, { roughness: 0.5, metalness: 0.12, skin: true }));
    body.position.y = height * 0.42;
    body.castShadow = true;
    body.receiveShadow = true;
    actorGroup.add(body);
    addTexturePanel(radius3d * 1.58 * modelScale, height * 0.5, height * 0.42, radius3d * 0.59 * modelScale + 0.012);
    addImageSprite(radius3d * 2.45 * modelScale, height * 0.82, height * 0.55);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(radius3d * 1.15 * modelScale, radius3d * 1.05 * modelScale, radius3d * 1.05 * modelScale),
      actorMaterial('#f0c9a5', { roughness: 0.64, emissiveIntensity: 0.04 }),
    );
    head.position.y = height * 0.82;
    head.castShadow = true;
    actorGroup.add(head);

    const shoulderGeometry = new THREE.BoxGeometry(radius3d * 2.1 * modelScale, radius3d * 0.3, radius3d * 0.7 * modelScale);
    const shoulders = new THREE.Mesh(shoulderGeometry, actorMaterial(preset.weapon, { roughness: 0.4, metalness: 0.18 }));
    shoulders.position.y = height * 0.61;
    shoulders.castShadow = true;
    actorGroup.add(shoulders);
  } else if (renderMode === 'boss') {
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(radius3d * 1.42 * modelScale, 18, 14),
      actorMaterial(skinnedBodyColor, { roughness: 0.72, metalness: 0.02, emissiveIntensity: active ? 0.34 : 0.12, skin: true }),
    );
    core.scale.y = 1.18;
    core.position.y = height * 0.45;
    core.castShadow = true;
    core.receiveShadow = true;
    actorGroup.add(core);
    addTexturePanel(radius3d * 2.2 * modelScale, height * 0.66, height * 0.48, radius3d * 1.42 * modelScale + 0.016);
    addImageSprite(radius3d * 3.05 * modelScale, height * 0.9, height * 0.58);

    const hornMaterial = actorMaterial(preset.weapon, { roughness: 0.42, metalness: 0.08, emissiveIntensity: 0.12 });
    [-1, 1].forEach((side) => {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(radius3d * 0.32 * modelScale, radius3d * 1.1 * modelScale, 8), hornMaterial);
      horn.position.set(side * radius3d * 0.9 * modelScale, height * 0.98, radius3d * 0.1);
      horn.rotation.z = -side * 0.52;
      horn.castShadow = true;
      actorGroup.add(horn);
    });

    [-1, 1].forEach((side) => {
      const arm = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius3d * 0.3 * modelScale, radius3d * 1.25 * modelScale, 5, 10),
        actorMaterial(preset.accent, { roughness: 0.55, emissiveIntensity: 0.2 }),
      );
      arm.position.set(side * radius3d * 1.42 * modelScale, height * 0.48, radius3d * 0.02);
      arm.rotation.z = side * 0.36;
      arm.castShadow = true;
      actorGroup.add(arm);
    });
  } else {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius3d * modelScale, Math.max(0.2, height - radius3d * 2 * modelScale), 6, 14),
      actorMaterial(skinnedBodyColor, { metalness: type === 'enemy' ? 0.08 : 0.03, skin: true }),
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    actorGroup.add(body);
    addTexturePanel(radius3d * 1.85 * modelScale, height * 0.68, height * 0.48, radius3d * 0.98 * modelScale + 0.012);
    addImageSprite(radius3d * 2.45 * modelScale, height * 0.94, height * 0.58);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(radius3d * 0.74 * modelScale, 16, 12),
      actorMaterial('#f0c9a5', { roughness: 0.68, emissive: '#000000', emissiveIntensity: 0 }),
    );
    head.position.set(radius3d * 0.32 * modelScale, height * 0.9, radius3d * 0.1);
    head.castShadow = true;
    actorGroup.add(head);
  }

  const weapon = new THREE.Mesh(
    new THREE.BoxGeometry(radius3d * 0.36 * modelScale, radius3d * 0.3 * modelScale, radius3d * 2.55 * modelScale),
    actorMaterial(preset.weapon, {
      roughness: 0.28,
      metalness: 0.24,
      emissive: preset.accent,
      emissiveIntensity: 0.16,
    }),
  );
  weapon.position.set(0, height * 0.62, radius3d * 1.55 * modelScale);
  weapon.castShadow = true;
  actorGroup.add(weapon);

  if (selected || editMode) {
    const ring = createSelectionRing(radius3d * (renderMode === 'boss' ? 2.35 : selected ? 2.1 : 1.95) * modelScale, selected ? '#f8fbff' : '#67e8f9');
    if (!selected) ring.material.opacity = 0.48;
    actorGroup.add(ring);
  }
  finalizeActorGroup(false);
};

const addBullet = (group, config, bullet) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 8, 5),
    new THREE.MeshStandardMaterial({
      color: bullet.color,
      emissive: bullet.color,
      emissiveIntensity: 1.2,
      roughness: 0.2,
    }),
  );
  mesh.userData.dynamicKind = 'bullet';
  mesh.userData.dynamicId = bullet.id;
  mesh.position.copy(toScenePosition(config, bullet.x, bullet.y, 0.58));
  group.add(mesh);
};

const addParticle = (group, config, particle, index = 0) => {
  const alpha = clamp(particle.life / particle.maxLife, 0, 1);
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.045 + alpha * 0.035, 6, 4),
    new THREE.MeshBasicMaterial({ color: particle.color, transparent: true, opacity: alpha }),
  );
  mesh.userData.dynamicKind = 'particle';
  mesh.userData.dynamicIndex = index;
  mesh.position.copy(toScenePosition(config, particle.x, particle.y, 0.25 + alpha * 0.6));
  group.add(mesh);
};

const findDynamicEntityRoot = (group, type, id) => (
  group?.children.find((child) => child.userData?.entityType === type && child.userData?.entityId === id) || null
);

const getDynamicEntityRootKey = (type, id) => (type && id ? `${type}:${id}` : '');

const getDynamicRootKey = (root) => getDynamicEntityRootKey(root?.userData?.entityType, root?.userData?.entityId);

const isDynamicEntitySelected = (type, id, selected, multiSelected = []) => (
  isSelectionActive(type, id, selected, multiSelected)
);

const getEditableDynamicEntityDescriptors = (config = {}, options = {}) => {
  const {
    selected = null,
    multiSelected = [],
    getTexture = () => null,
    getModel = () => null,
    getSupportHeight = (actor) => getSupportSurfaceHeightAtPoint(config, actor),
    animationTime = 0,
  } = options;
  const descriptors = [];

  (config.pickups || []).forEach((pickup) => {
    const selectedPickup = isDynamicEntitySelected('pickup', pickup.id, selected, multiSelected);
    descriptors.push({
      type: 'pickup',
      id: pickup.id,
      signature: [
        pickup.id || '',
        pickup.type || '',
        Math.round(getEntityLift(pickup)),
        selectedPickup ? 1 : 0,
      ].join(':'),
      add: (group) => addPickup(group, config, pickup, selectedPickup, animationTime),
    });
  });

  (config.heroes || []).forEach((hero) => {
    const selectedHero = isDynamicEntitySelected('hero', hero.id, selected, multiSelected);
    const modelStatus = getCharacterRenderMode(hero) === 'glb'
      ? getModel?.getStatus?.(hero.characterModelUrl, hero) || ''
      : '';
    descriptors.push({
      type: 'hero',
      id: hero.id,
      signature: [
        getActorStructureSignature(hero),
        selectedHero ? 1 : 0,
        modelStatus,
      ].join('|'),
      add: (group) => addActor(group, config, hero, {
        type: 'hero',
        id: hero.id,
        radius: PLAYER_RADIUS,
        preset: getCharacterPreset(getHeroCharacterId(hero), 'runner'),
        selected: selectedHero,
        active: false,
        imageData: hero.characterImageData,
        renderMode: getCharacterRenderMode(hero),
        modelScale: getCharacterModelScale(hero),
        animationTime: animationTime + Math.abs(hashString(hero.id || 'hero')) * 0.001,
        aimTarget: config.player,
        getTexture,
        getModel,
        useStoredRotation: true,
        editMode: true,
        supportHeight: getSupportHeight(hero),
      }),
    });
  });

  (config.enemies || []).forEach((enemy) => {
    const selectedEnemy = isDynamicEntitySelected('enemy', enemy.id, selected, multiSelected);
    const modelStatus = getCharacterRenderMode(enemy) === 'glb'
      ? getModel?.getStatus?.(enemy.characterModelUrl, enemy) || ''
      : '';
    descriptors.push({
      type: 'enemy',
      id: enemy.id,
      signature: [
        enemy.id,
        enemy.alert ? 1 : 0,
        getActorStructureSignature(enemy),
        selectedEnemy ? 1 : 0,
        modelStatus,
      ].join('|'),
      add: (group) => addActor(group, config, enemy, {
        type: 'enemy',
        id: enemy.id,
        radius: ENEMY_RADIUS,
        preset: getCharacterPreset(getEnemyCharacterId(enemy), 'guard'),
        selected: selectedEnemy,
        active: Boolean(enemy.alert),
        imageData: enemy.characterImageData,
        renderMode: getCharacterRenderMode(enemy),
        modelScale: getCharacterModelScale(enemy),
        animationTime: animationTime + Math.abs(hashString(enemy.id || 'enemy')) * 0.001,
        aimTarget: config.player,
        getTexture,
        getModel,
        useStoredRotation: true,
        editMode: true,
        supportHeight: getSupportHeight(enemy),
      }),
    });
  });

  return descriptors;
};

const syncEditableDynamicEntities = (group, config = {}, options = {}) => {
  if (!group || !config) return false;
  const descriptors = getEditableDynamicEntityDescriptors(config, options);
  const descriptorByKey = new Map(descriptors.map((descriptor) => [
    getDynamicEntityRootKey(descriptor.type, descriptor.id),
    descriptor,
  ]));
  const existingByKey = new Map();
  let didChange = false;

  [...group.children].forEach((root) => {
    if (root.userData?.dynamicKind) return;
    const key = getDynamicRootKey(root);
    const descriptor = descriptorByKey.get(key);
    if (!descriptor || root.userData?.dynamicStructureSignature !== descriptor.signature) {
      removeGroupChild(group, root);
      didChange = true;
      return;
    }
    existingByKey.set(key, root);
  });

  descriptors.forEach((descriptor) => {
    const key = getDynamicEntityRootKey(descriptor.type, descriptor.id);
    if (existingByKey.has(key)) return;
    const beforeCount = group.children.length;
    descriptor.add(group);
    const root = group.children[beforeCount] || group.children[group.children.length - 1];
    if (root) root.userData.dynamicStructureSignature = descriptor.signature;
    didChange = true;
  });

  group.userData.animationMixers = collectDynamicAnimationMixers(group);
  updateDynamicTransforms(group, config, {
    time: options.animationTime || 0,
    enemies: config.enemies || [],
    pickups: config.pickups || [],
    player: config.player || {},
  }, {
    playMode: false,
    getSupportHeight: options.getSupportHeight,
  });
  return didChange;
};

const updateActorTransform = (root, config, actor, options = {}) => {
  if (!root || !actor) return;
  const {
    aimTarget,
    useStoredRotation = false,
    supportHeight = 0,
  } = options;
  const lift = getEntityLiftHeight(actor);
  root.position.copy(toScenePosition(config, actor.x, actor.y, supportHeight + lift));
  if (useStoredRotation) {
    root.rotation.y = degreesToRadians(actor.rotation || 0);
  } else if (aimTarget) {
    const aim = normalize((Number(aimTarget.x) || actor.x + 1) - actor.x, (Number(aimTarget.y) || actor.y) - actor.y);
    root.rotation.y = Math.atan2(aim.x, aim.y);
  }
  scaleRootFromBase(root, getActorSceneDimensions(actor, {
    type: root.userData?.rpg3dActorType || root.userData?.entityType || 'hero',
    radius: root.userData?.rpg3dActorRadius || (root.userData?.entityType === 'enemy' ? ENEMY_RADIUS : PLAYER_RADIUS),
    includeAxisScale: true,
  }));
  applyActorMaterialBrightness(root, actor);
};

const updatePickupTransform = (root, config, pickup, time = 0) => {
  if (!root || !pickup) return;
  root.position.copy(toScenePosition(
    config,
    pickup.x,
    pickup.y,
    0.42 + Math.sin(time * 4) * 0.04 + getEntityLiftHeight(pickup),
  ));
};

const updateBulletTransform = (root, config, bullet) => {
  if (!root || !bullet) return;
  root.visible = true;
  root.position.copy(toScenePosition(config, bullet.x, bullet.y, 0.58));
};

const updateParticleTransform = (root, config, particle) => {
  if (!root || !particle) return;
  const alpha = clamp(particle.life / particle.maxLife, 0, 1);
  root.visible = true;
  root.position.copy(toScenePosition(config, particle.x, particle.y, 0.25 + alpha * 0.6));
  if (root.material) root.material.opacity = alpha;
  root.scale.setScalar(0.72 + alpha * 0.56);
};

const syncBulletRoots = (group, config, bullets = []) => {
  const bulletRoots = new Map(
    group.children
      .filter((child) => child.userData?.dynamicKind === 'bullet')
      .map((child) => [child.userData.dynamicId, child]),
  );
  const activeBulletIds = new Set();

  bullets.forEach((bullet) => {
    activeBulletIds.add(bullet.id);
    const root = bulletRoots.get(bullet.id);
    if (root) updateBulletTransform(root, config, bullet);
    else addBullet(group, config, bullet);
  });

  bulletRoots.forEach((root, id) => {
    if (!activeBulletIds.has(id)) removeGroupChild(group, root);
  });
};

const syncParticleRoots = (group, config, particles = []) => {
  const particleRoots = group.children
    .filter((child) => child.userData?.dynamicKind === 'particle')
    .sort((a, b) => (a.userData.dynamicIndex || 0) - (b.userData.dynamicIndex || 0));

  particles.forEach((particle, index) => {
    const root = particleRoots[index];
    if (root) {
      root.userData.dynamicIndex = index;
      updateParticleTransform(root, config, particle);
    } else {
      addParticle(group, config, particle, index);
    }
  });

  particleRoots.slice(particles.length).forEach((root) => removeGroupChild(group, root));
};

const updateDynamicTransforms = (group, config, state, options = {}) => {
  if (!group || !config || !state) return;
  const { playMode = false, getSupportHeight = null } = options;
  const time = state.time || 0;
  const getActorSupportHeight = getSupportHeight || ((actor) => getSupportSurfaceHeightAtPoint(config, actor));

  const controlledHeroId = playMode ? state.player?.controlledHeroId : '';
  (config.heroes || [])
    .filter((hero) => hero.id !== controlledHeroId)
    .forEach((hero) => {
      const root = findDynamicEntityRoot(group, 'hero', hero.id);
      updateActorTransform(root, config, hero, {
        aimTarget: playMode ? state.player : config.player,
        useStoredRotation: true,
        supportHeight: getActorSupportHeight(hero),
      });
      updateActorAnimationState(root, hero);
    });

  const enemies = playMode ? state.enemies : config.enemies;
  (enemies || []).forEach((enemy) => {
    const root = findDynamicEntityRoot(group, 'enemy', enemy.id);
    updateActorTransform(root, config, enemy, {
      aimTarget: playMode ? state.player : config.player,
      useStoredRotation: !playMode,
      supportHeight: getActorSupportHeight(enemy),
    });
    updateActorAnimationState(root, enemy);
  });

  const pickups = playMode ? state.pickups : config.pickups;
  (pickups || []).forEach((pickup) => {
    updatePickupTransform(findDynamicEntityRoot(group, 'pickup', pickup.id), config, pickup, time);
  });

  if (playMode) {
    const root = findDynamicEntityRoot(group, controlledHeroId ? 'hero' : 'player', controlledHeroId || 'player');
    updateActorTransform(root, config, state.player, {
      aimTarget: getActorMovementFacingTarget(state.player),
      supportHeight: getActorSupportHeight(state.player),
    });
    updateActorAnimationState(root, state.player);
  }

  if (playMode) {
    syncBulletRoots(group, config, state.bullets || []);
    syncParticleRoots(group, config, state.particles || []);
  }
};

export {
  CHARACTER_PRESETS,
  WEAPON_SOCKET_NAME_KEYS,
  SHIELD_SOCKET_NAME_KEYS,
  FINGER_NAME_KEYS,
  normalizeRigObjectName,
  hasRightRigMarker,
  hasLeftRigMarker,
  isFingerRigName,
  findFirstRigObject,
  isRightHandRigName,
  isLeftHandRigName,
  isLeftForearmRigName,
  findRightHandFromFingerBones,
  findLeftForearmFromFingerBones,
  findRightHandWeaponSocket,
  findLeftForearmShieldSocket,
  getEquippedWeaponItem,
  getEquippedShieldItem,
  getWeaponModelSource,
  getWeaponModelPayload,
  getEquipmentItemModelSignature,
  getWeaponModelSignature,
  getEquipmentModelSignature,
  DEFAULT_ENEMY_CHARACTER_BY_ROLE,
  applyActorMaterialBrightness,
  getEnemyCharacterId,
  getHeroCharacterId,
  getCharacterPreset,
  getCharacterRenderMode,
  addGltfActorModel,
  fitWeaponModelToLargestDimension,
  addEquippedModelToActorSocket,
  addEquippedWeaponToActorModel,
  addEquippedShieldToActorModel,
  getActorVisualSignature,
  getActorStructureSignature,
  getActorSceneDimensions,
  addPickup,
  addActor,
  addBullet,
  addParticle,
  findDynamicEntityRoot,
  getDynamicEntityRootKey,
  getDynamicRootKey,
  isDynamicEntitySelected,
  getEditableDynamicEntityDescriptors,
  syncEditableDynamicEntities,
  updateActorTransform,
  updatePickupTransform,
  updateBulletTransform,
  updateParticleTransform,
  syncBulletRoots,
  syncParticleRoots,
  updateDynamicTransforms,
};
