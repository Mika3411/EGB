import * as THREE from 'three';

import {
  clamp,
  getDecorModelScale as getPropModelScale,
  getEntityZ as getEntityLift,
  getFloorZeroZ,
  getPropHeight,
  getPropModelHeight,
  getPropRenderMode,
  getPropWidth,
  isFlatTileLikeProp,
  isFloorDecorKind,
} from '../../utils/rpg3dDomain.js';

const WORLD_SCALE = 0.018;

const ENEMY_RADIUS = 16;

const TILE_DUPLICATE_HANDLE_SCALE = 2;

const SHADOW_CAMERA_PADDING = 12;

const SHADOW_CAMERA_MIN_EXTENT = 46;

const SHADOW_MAP_SIZE = 2048;

const SHADOW_CAMERA_FOCUSED_MIN_EXTENT = 10;

const SHADOW_CAMERA_FOCUSED_MAX_EXTENT = 36;

const EDIT_MODEL_ANIMATION_FRAME_MS = 125;

const FLOOR_VISUAL_PADDING_WORLD = 3600;

const DEFAULT_ENGINE = {
  cameraHeight: 20,
  cameraDistance: 30,
  wallHeight: 2.4,
  reliefScale: 1,
  propHeight: 1,
  lightIntensity: 1.15,
  lightOrientation: 320,
};

const CAMERA_HEIGHT_MIN = 2.2;

const CAMERA_HEIGHT_MAX = 60;

const degreesToRadians = (value = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? (numeric * Math.PI) / 180 : 0;
};

const getModelRotationRadians = (object = {}) => ({
  x: degreesToRadians(clamp(Number(object.modelRotationX) || 0, -180, 180)),
  y: degreesToRadians(clamp(Number(object.modelRotationY) || 0, -180, 180)),
  z: degreesToRadians(clamp(Number(object.modelRotationZ) || 0, -180, 180)),
});

const applyModelRotation = (object3d, source = {}) => {
  const rotation = getModelRotationRadians(source);
  object3d.rotation.set(rotation.x, rotation.y, rotation.z);
};

const centerObjectHorizontallyOnOrigin = (object3d) => {
  if (!object3d) return false;
  object3d.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object3d, true);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x) || !Number.isFinite(box.min.z) || !Number.isFinite(box.max.z)) return false;
  const center = box.getCenter(new THREE.Vector3());
  object3d.position.x -= center.x;
  object3d.position.z -= center.z;
  object3d.updateMatrixWorld(true);
  return true;
};

const alignObjectTopToGround = (object3d, groundY = 0.018) => {
  if (!object3d) return false;
  object3d.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object3d, true);
  if (!Number.isFinite(box.max.y)) return false;
  object3d.position.y += groundY - box.max.y;
  object3d.updateMatrixWorld(true);
  return true;
};

const normalize = (x, y) => {
  const length = Math.hypot(x, y);
  return length > 0.001 ? { x: x / length, y: y / length } : { x: 1, y: 0 };
};

const getEngine = (config = {}) => ({ ...DEFAULT_ENGINE, ...(config.engine || {}) });

const getCameraDistance = (engine = {}) => Math.max(0.1, Number(engine.cameraDistance) || DEFAULT_ENGINE.cameraDistance);

const getCameraHeightForDistance = (engine = {}, distance = getCameraDistance(engine)) => {
  const baseHeight = Number(engine.cameraHeight) || DEFAULT_ENGINE.cameraHeight;
  const zoomRatio = distance / DEFAULT_ENGINE.cameraDistance;
  return clamp(baseHeight * zoomRatio, CAMERA_HEIGHT_MIN, CAMERA_HEIGHT_MAX);
};

const getLightIntensity = (engine = {}) => {
  const value = Number(engine.lightIntensity);
  return Number.isFinite(value) ? clamp(value, 0.25, 2.6) : DEFAULT_ENGINE.lightIntensity;
};

const getLightOrientation = (engine = {}) => {
  const value = Number(engine.lightOrientation);
  if (!Number.isFinite(value)) return DEFAULT_ENGINE.lightOrientation;
  return ((value % 360) + 360) % 360;
};

const getTransformBase = (object) => object?.userData?.rpg3dTransformBase || {};

const setTransformBase = (object, base = {}) => {
  if (!object) return;
  object.userData.rpg3dTransformBase = {
    width: Math.max(0.001, Number(base.width) || 1),
    height: Math.max(0.001, Number(base.height) || 1),
    depth: Math.max(0.001, Number(base.depth) || 1),
  };
};

const rememberMaterialAppearanceBase = (material, { actorManaged = false } = {}) => {
  if (!material) return null;
  const existing = material.userData?.rpg3dAppearanceBase;
  const base = existing?.color?.isColor || existing?.emissive?.isColor
    ? existing
    : {
      color: material.color?.clone?.() || null,
      emissive: material.emissive?.clone?.() || null,
      emissiveIntensity: Number.isFinite(Number(material.emissiveIntensity)) ? Number(material.emissiveIntensity) : null,
      envMapIntensity: Number.isFinite(Number(material.envMapIntensity)) ? Number(material.envMapIntensity) : null,
    };
  material.userData = {
    ...(material.userData || {}),
    rpg3dAppearanceBase: base,
    rpg3dAppearanceManaged: true,
    ...(actorManaged ? { rpg3dActorAppearanceManaged: true } : null),
  };
  return base;
};

const applyMaterialBrightnessFromBase = (material, brightness = 1, options = {}) => {
  if (!material) return false;
  const base = rememberMaterialAppearanceBase(material, options);
  const nextBrightness = clamp(Number(brightness) || 1, 0.15, 1.6);
  if (base?.color?.isColor && material.color?.copy) {
    material.color.copy(base.color);
    if (nextBrightness !== 1) material.color.multiplyScalar(nextBrightness);
  }
  if (base?.emissive?.isColor && material.emissive?.copy) {
    material.emissive.copy(base.emissive);
    if (nextBrightness < 1) material.emissive.multiplyScalar(Math.max(0.2, nextBrightness));
  }
  if (base && 'emissiveIntensity' in material && base.emissiveIntensity !== null) {
    material.emissiveIntensity = base.emissiveIntensity;
    if (nextBrightness < 1) material.emissiveIntensity *= nextBrightness;
  }
  if (base && 'envMapIntensity' in material && base.envMapIntensity !== null) {
    material.envMapIntensity = base.envMapIntensity;
  }
  material.userData = {
    ...(material.userData || {}),
    rpg3dAppearanceBrightness: nextBrightness,
  };
  material.needsUpdate = true;
  return true;
};

const updateSceneLighting = (scene, engine = DEFAULT_ENGINE, options = {}) => {
  if (!scene?.userData) return;
  const intensity = getLightIntensity(engine);
  const orientation = degreesToRadians(getLightOrientation(engine));
  const sunRadius = 36;
  const shadowTarget = options.shadowTarget || null;
  const targetX = Number.isFinite(Number(shadowTarget?.x)) ? Number(shadowTarget.x) : 0;
  const targetY = Number.isFinite(Number(shadowTarget?.y)) ? Number(shadowTarget.y) : 0;
  const targetZ = Number.isFinite(Number(shadowTarget?.z)) ? Number(shadowTarget.z) : 0;
  const focusedExtent = Number(options.shadowExtent);
  if (scene.userData.hemi) scene.userData.hemi.intensity = intensity * 0.32;
  if (scene.userData.sun) {
    scene.userData.sun.intensity = intensity * 3.4;
    scene.userData.sun.position.set(
      targetX + Math.sin(orientation) * sunRadius,
      targetY + 32,
      targetZ + Math.cos(orientation) * sunRadius,
    );
    scene.userData.sun.target?.position.set(targetX, targetY, targetZ);
    scene.userData.sun.target?.updateMatrixWorld();
    if (Number.isFinite(focusedExtent) && scene.userData.sun.shadow?.camera) {
      const extent = clamp(
        focusedExtent,
        SHADOW_CAMERA_FOCUSED_MIN_EXTENT,
        SHADOW_CAMERA_FOCUSED_MAX_EXTENT,
      );
      scene.userData.sun.shadow.camera.left = -extent;
      scene.userData.sun.shadow.camera.right = extent;
      scene.userData.sun.shadow.camera.top = extent;
      scene.userData.sun.shadow.camera.bottom = -extent;
      scene.userData.sun.shadow.camera.near = 0.5;
      scene.userData.sun.shadow.camera.far = Math.max(90, sunRadius + 64);
      scene.userData.sun.shadow.camera.updateProjectionMatrix();
    }
    scene.userData.sun.shadow.needsUpdate = true;
  }
  if (scene.userData.frontFill) scene.userData.frontFill.intensity = intensity * 0.1;
  if (scene.userData.rim) scene.userData.rim.intensity = intensity * 0.045;
  if (scene.userData.ambient) scene.userData.ambient.intensity = 0.04 + intensity * 0.04;
};

const configureSunShadowCamera = (sun, config = {}) => {
  if (!sun?.shadow?.camera || !config.world) return;
  const worldWidth = Math.max(1, Number(config.world.width) || 1) * WORLD_SCALE;
  const worldDepth = Math.max(1, Number(config.world.height) || 1) * WORLD_SCALE;
  const extent = Math.max(SHADOW_CAMERA_MIN_EXTENT, worldWidth * 0.5, worldDepth * 0.5) + SHADOW_CAMERA_PADDING;
  sun.shadow.camera.left = -extent;
  sun.shadow.camera.right = extent;
  sun.shadow.camera.top = extent;
  sun.shadow.camera.bottom = -extent;
  sun.shadow.camera.far = Math.max(90, extent * 2.8);
  sun.shadow.camera.updateProjectionMatrix();
};

const enableObjectShadows = (object, { cast = true, receive = true } = {}) => {
  object?.traverse?.((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    child.castShadow = cast;
    child.receiveShadow = receive;
  });
  return object;
};

const getFlatTileWorldFootprint = (prop = {}) => {
  if (getPropRenderMode(prop) === 'glb' && !isFloorDecorKind(prop.decorKind)) {
    const footprint = Math.max(12, Math.round(getPropModelHeight(prop) * getPropModelScale(prop)));
    return { width: footprint, height: footprint };
  }
  return { width: getPropWidth(prop), height: getPropHeight(prop) };
};

const getFlatTileSceneDimensions = (prop = {}, fallbackWidth = 0.24, fallbackDepth = 0.24) => {
  if (getPropRenderMode(prop) === 'glb' && !isFloorDecorKind(prop.decorKind)) {
    const footprint = Math.max(0.24, getPropModelHeight(prop) * getPropModelScale(prop) * WORLD_SCALE);
    return { width: footprint, depth: footprint };
  }
  return { width: fallbackWidth, depth: fallbackDepth };
};

const getEntityLiftHeight = (entity = {}) => getEntityLift(entity) * WORLD_SCALE;

const getFlatTileSurfaceHeight = (tile = {}) => getEntityLiftHeight(tile) + getFloorZeroZ(tile) * WORLD_SCALE;

const getSupportSurfaceHeightAtPoint = (config = {}, point = {}) => {
  let supportHeight = 0;
  (config.props || []).forEach((prop) => {
    if (!prop || !isFlatTileLikeProp(prop)) return;
    const { width, height } = getFlatTileWorldFootprint(prop);
    const x = Number(prop.x) || 0;
    const y = Number(prop.y) || 0;
    const pointX = Number(point.x) || 0;
    const pointY = Number(point.y) || 0;
    if (
      pointX < x - width / 2
      || pointX > x + width / 2
      || pointY < y - height / 2
      || pointY > y + height / 2
    ) return;
    supportHeight = Math.max(supportHeight, getFlatTileSurfaceHeight(prop));
  });
  return supportHeight;
};

const createSupportSurfaceHeightResolver = (config = {}) => {
  const supports = (config.props || [])
    .filter((prop) => prop && isFlatTileLikeProp(prop))
    .map((prop) => {
      const { width, height } = getFlatTileWorldFootprint(prop);
      const x = Number(prop.x) || 0;
      const y = Number(prop.y) || 0;
      return {
        minX: x - width / 2,
        maxX: x + width / 2,
        minY: y - height / 2,
        maxY: y + height / 2,
        surfaceHeight: getFlatTileSurfaceHeight(prop),
      };
    });
  if (!supports.length) return () => 0;
  return (point = {}) => {
    const pointX = Number(point.x) || 0;
    const pointY = Number(point.y) || 0;
    let supportHeight = 0;
    supports.forEach((support) => {
      if (
        pointX < support.minX
        || pointX > support.maxX
        || pointY < support.minY
        || pointY > support.maxY
      ) return;
      supportHeight = Math.max(supportHeight, support.surfaceHeight);
    });
    return supportHeight;
  };
};

const toScenePosition = (config, x, y, height = 0) => new THREE.Vector3(
  (x - config.world.width / 2) * WORLD_SCALE,
  height,
  (y - config.world.height / 2) * WORLD_SCALE,
);

const fromScenePosition = (config, position) => ({
  x: clamp(position.x / WORLD_SCALE + config.world.width / 2, 0, config.world.width),
  y: clamp(position.z / WORLD_SCALE + config.world.height / 2, 0, config.world.height),
});

const disposeMaterial = (material) => {
  if (Array.isArray(material.userData?.disposeTextureFields)) {
    material.userData.disposeTextureFields.forEach((field) => {
      if (material[field]?.isTexture) material[field].dispose();
    });
  }
  if (material.userData?.disposeTextures) {
    Object.values(material).forEach((value) => {
      if (value?.isTexture) value.dispose();
    });
  }
  material.dispose?.();
};

const disposeObject = (object) => {
  object.traverse((child) => {
    const preserveSharedResources = Boolean(child.userData?.preserveSharedResources);
    if ((!preserveSharedResources || child.userData?.disposeGeometryWithInstance) && child.geometry) child.geometry.dispose();
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (preserveSharedResources && !material.userData?.disposeWithInstance) return;
      disposeMaterial(material);
    });
  });
};

const clearGroup = (group) => {
  if (Array.isArray(group.userData?.animationMixers)) {
    group.userData.animationMixers.forEach((mixer) => mixer.stopAllAction());
    group.userData.animationMixers = [];
  }
  [...group.children].forEach((child) => {
    group.remove(child);
    disposeObject(child);
  });
};

const removeGroupChild = (group, child) => {
  if (!group || !child) return;
  if (Array.isArray(child.userData?.animationMixers)) {
    child.userData.animationMixers.forEach((mixer) => mixer.stopAllAction?.());
    child.userData.animationMixers = [];
  }
  group.remove(child);
  disposeObject(child);
};

const assignEntity = (object, entity) => {
  object.userData.entityType = entity.type;
  object.userData.entityId = entity.id;
  if (entity.direction) object.userData.entityDirection = entity.direction;
  if (Number.isInteger(entity.vertexIndex)) object.userData.entityVertexIndex = entity.vertexIndex;
  if (entity.vertexLayer) object.userData.entityVertexLayer = entity.vertexLayer;
  if (Number.isInteger(entity.edgeIndex)) object.userData.entityEdgeIndex = entity.edgeIndex;
  object.traverse((child) => {
    child.userData.entityType = entity.type;
    child.userData.entityId = entity.id;
    if (entity.direction) child.userData.entityDirection = entity.direction;
    if (Number.isInteger(entity.vertexIndex)) child.userData.entityVertexIndex = entity.vertexIndex;
    if (entity.vertexLayer) child.userData.entityVertexLayer = entity.vertexLayer;
    if (Number.isInteger(entity.edgeIndex)) child.userData.entityEdgeIndex = entity.edgeIndex;
  });
};

const readEntity = (object) => {
  let current = object;
  while (current) {
    if (current.userData?.entityType) {
      return {
        type: current.userData.entityType,
        id: current.userData.entityId,
        direction: current.userData.entityDirection,
        vertexIndex: current.userData.entityVertexIndex,
        vertexLayer: current.userData.entityVertexLayer,
        edgeIndex: current.userData.entityEdgeIndex,
      };
    }
    current = current.parent;
  }
  return null;
};

const createSelectionRing = (radius = 0.55, color = '#67e8f9') => {
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(radius, 0.035, 8, 48),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.92 }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.045;
  return ring;
};

const createImageShadowMaterial = (texture) => {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    colorWrite: false,
    depthWrite: false,
  });
  material.shadowSide = THREE.DoubleSide;
  return material;
};

const createImageShadowCasterPlane = (texture, width, height, y, z = 0) => {
  if (!texture) return null;
  const caster = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    createImageShadowMaterial(texture),
  );
  caster.name = 'image-shadow-caster';
  caster.userData.rpg3dImageShadowCaster = true;
  caster.position.set(0, y, z);
  caster.castShadow = true;
  caster.receiveShadow = false;
  return caster;
};

const createVisibleImagePlaneMaterial = (texture) => {
  const material = new THREE.MeshStandardMaterial({
    map: texture,
    color: '#ffffff',
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    roughness: 0.74,
    metalness: 0.02,
    emissive: '#04070a',
    emissiveIntensity: 0.02,
  });
  material.shadowSide = THREE.DoubleSide;
  return material;
};

const createSelectionEdges = (geometry) => new THREE.LineSegments(
  new THREE.EdgesGeometry(geometry),
  new THREE.LineBasicMaterial({ color: '#67e8f9', transparent: true, opacity: 0.95 }),
);

const createTileDuplicateHandle = (direction, width, depth, propId) => {
  const gap = 0.42 * TILE_DUPLICATE_HANDLE_SCALE;
  const radius = 0.28 * TILE_DUPLICATE_HANDLE_SCALE;
  const positions = {
    left: { x: -width / 2 - gap, z: 0, rotation: Math.PI / 2 },
    right: { x: width / 2 + gap, z: 0, rotation: -Math.PI / 2 },
    up: { x: 0, z: -depth / 2 - gap, rotation: 0 },
    down: { x: 0, z: depth / 2 + gap, rotation: Math.PI },
  };
  const placement = positions[direction] || positions.right;
  const handle = new THREE.Group();
  handle.position.set(placement.x, 0.34, placement.z);

  const haloMaterial = new THREE.MeshBasicMaterial({
    color: '#0f172a',
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
    depthTest: false,
  });
  const halo = new THREE.Mesh(new THREE.CircleGeometry(radius * 1.18, 24), haloMaterial);
  halo.rotation.x = -Math.PI / 2;
  halo.renderOrder = 80;
  handle.add(halo);

  const triangle = new THREE.Mesh(
    new THREE.CircleGeometry(radius, 3),
    new THREE.MeshBasicMaterial({
      color: '#fbbf24',
      transparent: true,
      opacity: 1,
      side: THREE.DoubleSide,
      depthTest: false,
    }),
  );
  triangle.rotation.set(-Math.PI / 2, 0, placement.rotation);
  triangle.position.y = 0.012;
  triangle.renderOrder = 82;
  handle.add(triangle);

  const hitArea = new THREE.Mesh(
    new THREE.BoxGeometry(radius * 3.4, 0.18, radius * 3.4),
    new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  hitArea.position.y = 0.01;
  handle.add(hitArea);
  assignEntity(handle, { type: 'tileDuplicate', id: propId, direction });
  return handle;
};

const addTileDuplicateHandles = (propGroup, prop, width, depth) => {
  ['up', 'right', 'down', 'left'].forEach((direction) => {
    propGroup.add(createTileDuplicateHandle(direction, width, depth, prop.id));
  });
};

const createSelectionOverlayGroup = (entity) => {
  const group = new THREE.Group();
  assignEntity(group, entity);
  return group;
};

const getEntityKey = (entity = {}) => (entity?.type && entity?.id ? `${entity.type}:${entity.id}` : '');

const isSelectionActive = (type, id, selected, multiSelected = []) => (
  (selected?.type === type && selected.id === id)
  || multiSelected.some((entry) => entry.type === type && entry.id === id)
);

const scaleRootFromBase = (root, dimensions = {}) => {
  if (!root) return false;
  const base = getTransformBase(root);
  const nextWidth = Math.max(0.001, Number(dimensions.width) || 1);
  const nextHeight = Math.max(0.001, Number(dimensions.height) || 1);
  const nextDepth = Math.max(0.001, Number(dimensions.depth) || 1);
  root.scale.set(
    nextWidth / Math.max(0.001, Number(base.width) || nextWidth),
    nextHeight / Math.max(0.001, Number(base.height) || nextHeight),
    nextDepth / Math.max(0.001, Number(base.depth) || nextDepth),
  );
  return true;
};

const collectStaticAnimationMixers = (group) => (
  (group?.children || []).flatMap((child) => (
    Array.isArray(child.userData?.animationMixers) ? child.userData.animationMixers : []
  ))
);

const collectDynamicAnimationMixers = collectStaticAnimationMixers;

export {
  WORLD_SCALE,
  ENEMY_RADIUS,
  TILE_DUPLICATE_HANDLE_SCALE,
  SHADOW_CAMERA_PADDING,
  SHADOW_CAMERA_MIN_EXTENT,
  SHADOW_MAP_SIZE,
  SHADOW_CAMERA_FOCUSED_MIN_EXTENT,
  SHADOW_CAMERA_FOCUSED_MAX_EXTENT,
  EDIT_MODEL_ANIMATION_FRAME_MS,
  FLOOR_VISUAL_PADDING_WORLD,
  DEFAULT_ENGINE,
  CAMERA_HEIGHT_MIN,
  CAMERA_HEIGHT_MAX,
  degreesToRadians,
  getModelRotationRadians,
  applyModelRotation,
  centerObjectHorizontallyOnOrigin,
  alignObjectTopToGround,
  normalize,
  getEngine,
  getCameraDistance,
  getCameraHeightForDistance,
  getLightIntensity,
  getLightOrientation,
  getTransformBase,
  setTransformBase,
  rememberMaterialAppearanceBase,
  applyMaterialBrightnessFromBase,
  updateSceneLighting,
  configureSunShadowCamera,
  enableObjectShadows,
  getFlatTileWorldFootprint,
  getFlatTileSceneDimensions,
  getEntityLiftHeight,
  getFlatTileSurfaceHeight,
  getSupportSurfaceHeightAtPoint,
  createSupportSurfaceHeightResolver,
  toScenePosition,
  fromScenePosition,
  disposeMaterial,
  disposeObject,
  clearGroup,
  removeGroupChild,
  assignEntity,
  readEntity,
  createSelectionRing,
  createImageShadowMaterial,
  createImageShadowCasterPlane,
  createVisibleImagePlaneMaterial,
  createSelectionEdges,
  getEntityKey,
  isSelectionActive,
  scaleRootFromBase,
  collectStaticAnimationMixers,
  collectDynamicAnimationMixers,
  createTileDuplicateHandle,
  addTileDuplicateHandles,
  createSelectionOverlayGroup,
};
