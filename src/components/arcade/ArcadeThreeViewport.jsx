import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { attachClickTargetCameraControls } from '../three/clickTargetCameraControls.js';
import {
  applyTextureToGltfModel,
  fitObjectToHeight,
  getGltfAnimationClips,
  loadGltfFromSource,
  playGltfAnimations,
  prepareGltfModel,
  snapObjectToGround,
} from '../../utils/threeGltfUtils';

const WORLD_SCALE = 0.018;
const PLAYER_RADIUS = 18;
const ENEMY_RADIUS = 16;
const PICKUP_RADIUS = 15;
const ENTITY_Z_MIN = -900;
const ENTITY_Z_MAX = 900;
const DEFAULT_FLOOR_ZERO_Z = 2.5;
const FLOOR_ZERO_Z_MIN = -120;
const FLOOR_ZERO_Z_MAX = 120;
const MODEL_SCALE_MIN = 0.4;
const MODEL_SCALE_MAX = 5;
const ACTION_ZONE_MIN_SIZE = 40;
const ACTION_ZONE_DEFAULT_WIDTH = 260;
const ACTION_ZONE_DEFAULT_HEIGHT = 180;
const ACTION_ZONE_DEFAULT_MODEL_HEIGHT = 240;
const ACTION_ZONE_DEFAULT_OPACITY = 0.32;
const TILE_DUPLICATE_HANDLE_SCALE = 2;
const DYNAMIC_SELECTION_TYPES = new Set(['spawn', 'hero', 'enemy', 'pickup']);

const DEFAULT_ENGINE = {
  cameraHeight: 20,
  cameraDistance: 30,
  wallHeight: 2.4,
  reliefScale: 1,
  propHeight: 1,
  lightIntensity: 1.15,
};

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

const DEFAULT_ENEMY_CHARACTER_BY_ROLE = {
  rifle: 'guard',
  sniper: 'sniper',
  brute: 'brute',
};

const RELIEF_STYLE_COLORS = {
  plateau: { top: '#7c5939', side: '#372217', emissive: '#20110a' },
  ridge: { top: '#766a56', side: '#2e2921', emissive: '#1a1712' },
  basin: { top: '#2f2119', side: '#17100c', emissive: '#0f0907' },
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
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
const getPropWidth = (prop = {}) => Math.max(12, Number(prop.w) || (Number(prop.r) || 34) * 2);
const getPropHeight = (prop = {}) => Math.max(12, Number(prop.h) || (Number(prop.r) || 34) * 2);
const getPropModelHeight = (prop = {}) => Math.max(12, Number(prop.modelHeight) || getPropHeight(prop));
const getPropRenderMode = (prop = {}) => prop.renderMode || (prop.imageData ? 'billboard' : 'rock');
const normalizeModelRotationDegrees = (value = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const normalized = ((numeric % 360) + 360) % 360;
  return normalized > 180 ? normalized - 360 : normalized;
};
const isFlatTileLikeProp = (prop = {}) => {
  if (getPropRenderMode(prop) === 'floor') return true;
  if (getPropRenderMode(prop) !== 'glb') return false;
  const rotationX = Math.abs(normalizeModelRotationDegrees(prop.modelRotationX || 0));
  return rotationX >= 30 && rotationX <= 150;
};
const getPropModelSource = (prop = {}) => prop.decorModelUrl || prop.modelUrl || prop.modelData || '';
const getPropModelScale = (prop = {}) => clamp(Number(prop.decorModelScale) || Number(prop.modelScale) || 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
const getFlatTileWorldFootprint = (prop = {}) => {
  if (getPropRenderMode(prop) === 'glb') {
    const footprint = Math.max(12, Math.round(getPropModelHeight(prop) * getPropModelScale(prop)));
    return { width: footprint, height: footprint };
  }
  return { width: getPropWidth(prop), height: getPropHeight(prop) };
};
const getFlatTileSceneDimensions = (prop = {}, fallbackWidth = 0.24, fallbackDepth = 0.24) => {
  if (getPropRenderMode(prop) === 'glb') {
    const footprint = Math.max(0.24, getPropModelHeight(prop) * getPropModelScale(prop) * WORLD_SCALE);
    return { width: footprint, depth: footprint };
  }
  return { width: fallbackWidth, depth: fallbackDepth };
};
const getEntityLift = (entity = {}) => clamp(Number(entity.z) || 0, ENTITY_Z_MIN, ENTITY_Z_MAX);
const getEntityLiftHeight = (entity = {}) => getEntityLift(entity) * WORLD_SCALE;
const getFloorZeroZ = (tile = {}) => {
  const value = Number(tile.floorZeroZ);
  return clamp(Number.isFinite(value) ? value : DEFAULT_FLOOR_ZERO_Z, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
};
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
const getReliefWidth = (relief = {}) => Math.max(40, Number(relief.w) || 300);
const getReliefHeight = (relief = {}) => Math.max(40, Number(relief.h) || 180);
const getReliefElevation = (relief = {}) => {
  const elevation = Number(relief.elevation);
  return clamp(Number.isFinite(elevation) ? elevation : 24, -80, 120);
};
const getActionZoneWidth = (zone = {}) => Math.max(ACTION_ZONE_MIN_SIZE, Number(zone.w) || ACTION_ZONE_DEFAULT_WIDTH);
const getActionZoneHeight = (zone = {}) => Math.max(ACTION_ZONE_MIN_SIZE, Number(zone.h) || ACTION_ZONE_DEFAULT_HEIGHT);
const getActionZoneModelHeight = (zone = {}) => Math.max(60, Number(zone.modelHeight) || ACTION_ZONE_DEFAULT_MODEL_HEIGHT);
const getActionZoneOpacity = (zone = {}) => clamp(Number(zone.opacity) || ACTION_ZONE_DEFAULT_OPACITY, 0.05, 0.95);
const getActionZoneColor = (zone = {}) => {
  const value = String(zone.color || '').trim();
  return /^#[0-9a-f]{6}$/i.test(value) ? value : (getActionZoneType(zone) === 'portal' ? '#38bdf8' : '#facc15');
};
const getActionZoneRenderMode = (zone = {}) => zone.renderMode || 'volume';
const getActionZoneType = (zone = {}) => zone.actionType || 'portal';
const getEnemyCharacterId = (enemy = {}) => enemy.character || DEFAULT_ENEMY_CHARACTER_BY_ROLE[enemy.role] || 'guard';
const getHeroCharacterId = (hero = {}) => hero.character || 'runner';
const getCharacterPreset = (id = 'runner', fallbackId = 'runner') => (
  CHARACTER_PRESETS.find((preset) => preset.id === id)
  || CHARACTER_PRESETS.find((preset) => preset.id === fallbackId)
  || CHARACTER_PRESETS[0]
);
const getCharacterRenderMode = (actor = {}) => actor.characterRenderMode || 'capsule';
const getCharacterModelScale = (actor = {}) => clamp(Number(actor.characterModelScale) || 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);

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
    if (!preserveSharedResources && child.geometry) child.geometry.dispose();
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

const assignEntity = (object, entity) => {
  object.userData.entityType = entity.type;
  object.userData.entityId = entity.id;
  if (entity.direction) object.userData.entityDirection = entity.direction;
  object.traverse((child) => {
    child.userData.entityType = entity.type;
    child.userData.entityId = entity.id;
    if (entity.direction) child.userData.entityDirection = entity.direction;
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
      };
    }
    current = current.parent;
  }
  return null;
};

const createFloorTexture = () => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#172033';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let x = 0; x < canvas.width; x += 64) {
    for (let y = 0; y < canvas.height; y += 64) {
      ctx.fillStyle = ((x + y) / 64) % 2 ? '#223149' : '#182538';
      ctx.fillRect(x, y, 64, 64);
      ctx.strokeStyle = 'rgba(103, 232, 249, .12)';
      ctx.strokeRect(x + 0.5, y + 0.5, 63, 63);
    }
  }
  ctx.strokeStyle = 'rgba(245, 158, 11, .18)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(0, 410);
  ctx.bezierCurveTo(145, 340, 260, 520, 512, 390);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
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

const getSelectedFlatTileProps = (config = {}, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  const selectedIds = new Set(selection.filter((entry) => entry?.type === 'prop').map((entry) => entry.id));
  if (!selectedIds.size) return [];
  return (config.props || []).filter((prop) => selectedIds.has(prop.id) && isFlatTileLikeProp(prop));
};

const getFlatTileSelectionBounds = (config = {}, props = []) => {
  let bounds = null;
  props.forEach((prop) => {
    const fallbackWidth = Math.max(0.24, getPropWidth(prop) * WORLD_SCALE);
    const fallbackDepth = Math.max(0.24, getPropHeight(prop) * WORLD_SCALE);
    const size = getFlatTileSceneDimensions(prop, fallbackWidth, fallbackDepth);
    const center = toScenePosition(config, prop.x, prop.y, 0);
    const tileBounds = {
      minX: center.x - size.width / 2,
      maxX: center.x + size.width / 2,
      minZ: center.z - size.depth / 2,
      maxZ: center.z + size.depth / 2,
    };
    bounds = bounds
      ? {
        minX: Math.min(bounds.minX, tileBounds.minX),
        maxX: Math.max(bounds.maxX, tileBounds.maxX),
        minZ: Math.min(bounds.minZ, tileBounds.minZ),
        maxZ: Math.max(bounds.maxZ, tileBounds.maxZ),
      }
      : tileBounds;
  });
  return bounds;
};

const addTileSelectionDuplicateHandles = (group, config, props = []) => {
  const bounds = getFlatTileSelectionBounds(config, props);
  if (!bounds) return;
  const handleGroup = new THREE.Group();
  handleGroup.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  const width = Math.max(0.24, bounds.maxX - bounds.minX);
  const depth = Math.max(0.24, bounds.maxZ - bounds.minZ);
  ['up', 'right', 'down', 'left'].forEach((direction) => {
    handleGroup.add(createTileDuplicateHandle(direction, width, depth, 'selection'));
  });
  group.add(handleGroup);
};

const createSelectionOverlayGroup = (entity) => {
  const group = new THREE.Group();
  assignEntity(group, entity);
  return group;
};

const addBoxSelectionOverlay = (group, config, entity, centerX, centerY, width, depth, height, lift = 0) => {
  const overlay = createSelectionOverlayGroup(entity);
  const geometry = new THREE.BoxGeometry(
    Math.max(0.2, width * WORLD_SCALE),
    Math.max(0.05, height),
    Math.max(0.2, depth * WORLD_SCALE),
  );
  const edges = createSelectionEdges(geometry);
  edges.position.copy(toScenePosition(config, centerX, centerY, lift + Math.max(0.05, height) / 2));
  overlay.add(edges);
  group.add(overlay);
};

const addPropSelectionOverlay = (group, config, prop, options = {}) => {
  const width = Math.max(0.24, getPropWidth(prop) * WORLD_SCALE);
  const depth = Math.max(0.24, getPropHeight(prop) * WORLD_SCALE);
  const propHeight = Math.max(0.08, getPropModelHeight(prop) * WORLD_SCALE);
  const lift = getEntityLiftHeight(prop);
  const overlay = createSelectionOverlayGroup({ type: 'prop', id: prop.id });
  overlay.position.copy(toScenePosition(config, prop.x, prop.y, lift));
  overlay.rotation.y = degreesToRadians(prop.rotation || 0);

  if (isFlatTileLikeProp(prop)) {
    const tileSize = getFlatTileSceneDimensions(prop, width, depth);
    const outline = createSelectionEdges(new THREE.BoxGeometry(tileSize.width, 0.05, tileSize.depth));
    outline.position.y = 0.08;
    overlay.add(outline);
    if (options.showTileDuplicateHandles !== false) {
      addTileDuplicateHandles(overlay, prop, tileSize.width, tileSize.depth);
    }
  } else if (['box', 'house', 'glb'].includes(getPropRenderMode(prop))) {
    const edges = createSelectionEdges(new THREE.BoxGeometry(width, propHeight, depth));
    edges.position.y = propHeight / 2;
    overlay.add(edges);
  } else {
    overlay.add(createSelectionRing(Math.max(width, depth) * 0.58, '#67e8f9'));
  }

  group.add(overlay);
};

const addActionZoneSelectionOverlay = (group, config, zone) => {
  const width = Math.max(0.24, getActionZoneWidth(zone) * WORLD_SCALE);
  const depth = Math.max(0.24, getActionZoneHeight(zone) * WORLD_SCALE);
  const height = Math.max(0.24, getActionZoneModelHeight(zone) * WORLD_SCALE);
  const overlay = createSelectionOverlayGroup({ type: 'actionZone', id: zone.id });
  overlay.position.copy(toScenePosition(config, zone.x, zone.y, 0));
  overlay.rotation.y = degreesToRadians(zone.rotation || 0);
  const edges = createSelectionEdges(new THREE.BoxGeometry(width, height, depth));
  edges.position.y = height / 2;
  overlay.add(edges);
  group.add(overlay);
};

const addStaticSelectionOverlays = (group, config, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  if (!selection.length) return;
  const selectedFlatTiles = getSelectedFlatTileProps(config, selected, multiSelected);
  const selectedFlatTileIds = new Set(selectedFlatTiles.map((prop) => prop.id));
  const showGroupedTileHandles = selectedFlatTiles.length > 1;

  selection.forEach((entity) => {
    if (!entity?.type || !entity.id) return;
    if (entity.type === 'obstacle') {
      const obstacle = (config.obstacles || []).find((item) => item.id === entity.id);
      if (!obstacle) return;
      const height = Math.max(0.4, Number(config.engine?.wallHeight) || DEFAULT_ENGINE.wallHeight);
      addBoxSelectionOverlay(
        group,
        config,
        entity,
        (Number(obstacle.x) || 0) + getPropWidth(obstacle) / 2,
        (Number(obstacle.y) || 0) + getPropHeight(obstacle) / 2,
        getPropWidth(obstacle),
        getPropHeight(obstacle),
        height,
        getEntityLiftHeight(obstacle),
      );
      return;
    }
    if (entity.type === 'relief') {
      const relief = (config.reliefs || []).find((item) => item.id === entity.id);
      if (!relief) return;
      const elevation = getReliefElevation(relief);
      const height = Math.max(0.08, Math.abs(elevation) * WORLD_SCALE * (Number(config.engine?.reliefScale) || 1));
      addBoxSelectionOverlay(
        group,
        config,
        entity,
        Number(relief.x) || 0,
        Number(relief.y) || 0,
        getReliefWidth(relief),
        getReliefHeight(relief),
        height,
        elevation >= 0 ? 0 : -height * 0.4,
      );
      return;
    }
    if (entity.type === 'actionZone') {
      const zone = (config.actionZones || []).find((item) => item.id === entity.id);
      if (!zone) return;
      addActionZoneSelectionOverlay(group, config, zone);
      return;
    }
    if (entity.type === 'prop') {
      const prop = (config.props || []).find((item) => item.id === entity.id);
      if (!prop) return;
      addPropSelectionOverlay(group, config, prop, {
        showTileDuplicateHandles: !(showGroupedTileHandles && selectedFlatTileIds.has(prop.id)),
      });
    }
  });

  if (showGroupedTileHandles) addTileSelectionDuplicateHandles(group, config, selectedFlatTiles);
};

const createCachedTextureGetter = (cache) => (src, repeat = false) => {
  if (!src) return null;
  const cacheKey = `${repeat ? 'repeat' : 'single'}:${src}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
  }
  cache.set(cacheKey, texture);
  return texture;
};

const createCachedModelGetter = (cache, pending, onLoaded) => {
  const loader = new GLTFLoader();
  return (src) => {
    if (!src) return null;
    const cached = cache.get(src);
    if (cached) return cached;
    if (pending.has(src)) return null;
    pending.add(src);
    loadGltfFromSource(
      loader,
      src,
      (gltf) => {
        const object = gltf.scene || gltf.scenes?.[0];
        if (object) {
          prepareGltfModel(object, { restoreTextureColor: true });
          object.userData.gltfAnimationClips = getGltfAnimationClips(gltf);
          cache.set(src, object);
        }
        pending.delete(src);
        onLoaded?.();
      },
      () => {
        pending.delete(src);
        onLoaded?.();
      },
    );
    return null;
  };
};

const addGltfActorModel = (actorGroup, template, actor, height, radius3d, selected, modelScale, animationTime = 0) => {
  const instance = cloneGltfScene(template);
  instance.traverse((child) => {
    child.userData.preserveSharedResources = true;
  });
  prepareGltfModel(instance, { restoreTextureColor: true });
  const targetHeight = height * 1.28 * modelScale;
  fitObjectToHeight(instance, targetHeight, { groundY: 0 });
  actorGroup.add(instance);
  const mixer = playGltfAnimations(instance, template.userData?.gltfAnimationClips || [], { timeOffset: animationTime });
  if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * modelScale, '#f8fbff'));
  return { mixer };
};

const addGltfPropModel = (propGroup, template, prop, propHeight, radius, selected, texture = null) => {
  const instance = cloneGltfScene(template);
  instance.traverse((child) => {
    child.userData.preserveSharedResources = true;
  });
  prepareGltfModel(instance, { restoreTextureColor: true });
  applyTextureToGltfModel(instance, texture);
  fitObjectToHeight(instance, propHeight * getPropModelScale(prop), { groundY: 0 });
  const orientedGroup = new THREE.Group();
  orientedGroup.add(instance);
  applyModelRotation(orientedGroup, prop);
  if (prop.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(orientedGroup);
  snapObjectToGround(orientedGroup, 0);
  if (prop.modelFlushToGround) alignObjectTopToGround(orientedGroup);
  propGroup.add(orientedGroup);
  const clips = template.userData?.gltfAnimationClips || [];
  const mixer = playGltfAnimations(instance, clips, { timeOffset: Math.abs(hashString(prop.id || prop.name || 'prop')) * 0.001 });
  if (selected) propGroup.add(createSelectionRing(radius, '#67e8f9'));
  return { mixer };
};

const IMAGE_SIGNATURE_CACHE_LIMIT = 128;
const imageSignatureCache = new Map();

const hashString = (value = '') => [...String(value)].reduce((hash, char) => (
  ((hash << 5) - hash + char.charCodeAt(0)) | 0
), 0);

const getImageSignature = (src = '') => {
  if (!src) return '0';
  const cached = imageSignatureCache.get(src);
  if (cached) return cached;
  const signature = `${src.length}:${hashString(src)}`;
  imageSignatureCache.set(src, signature);
  if (imageSignatureCache.size > IMAGE_SIGNATURE_CACHE_LIMIT) {
    imageSignatureCache.delete(imageSignatureCache.keys().next().value);
  }
  return signature;
};

const getActorVisualSignature = (actor = {}) => [
  actor.id || 'player',
  actor.character || '',
  actor.role || '',
  Math.round(getEntityLift(actor)),
  Math.round(Number(actor.rotation) || 0),
  actor.characterRenderMode || '',
  Math.round(getCharacterModelScale(actor) * 100),
  actor.characterImageName || '',
  getImageSignature(actor.characterImageData),
  actor.characterModel3dId || '',
  actor.characterModelName || '',
  actor.characterModelUrl || '',
].join(':');

const getStaticEngineSignature = (engine = {}) => [
  Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight,
  Number(engine.reliefScale) || DEFAULT_ENGINE.reliefScale,
  Number(engine.propHeight) || DEFAULT_ENGINE.propHeight,
].join(':');

const getObstacleVisualSignature = (obstacle = {}) => [
  obstacle.id || '',
  Number(obstacle.x) || 0,
  Number(obstacle.y) || 0,
  Math.round(getEntityLift(obstacle)),
  Number(obstacle.w) || 0,
  Number(obstacle.h) || 0,
].join(':');

const getReliefVisualSignature = (relief = {}) => [
  relief.id || '',
  Number(relief.x) || 0,
  Number(relief.y) || 0,
  Math.round(getEntityLift(relief)),
  getReliefWidth(relief),
  getReliefHeight(relief),
  getReliefElevation(relief),
  relief.style || 'plateau',
  relief.blocksMovement ? 1 : 0,
].join(':');

const getActionZoneVisualSignature = (zone = {}) => [
  zone.id || '',
  Number(zone.x) || 0,
  Number(zone.y) || 0,
  getActionZoneWidth(zone),
  getActionZoneHeight(zone),
  getActionZoneModelHeight(zone),
  getActionZoneRenderMode(zone),
  getActionZoneType(zone),
  getActionZoneColor(zone),
  Math.round(getActionZoneOpacity(zone) * 100),
  Math.round(Number(zone.rotation) || 0),
  zone.visibleInPlay ? 1 : 0,
].join(':');

const getPropVisualSignature = (prop = {}) => [
  prop.id || '',
  prop.name || '',
  Number(prop.x) || 0,
  Number(prop.y) || 0,
  Math.round(getEntityLift(prop)),
  Math.round(Number(prop.rotation) || 0),
  getPropWidth(prop),
  getPropHeight(prop),
  getPropModelHeight(prop),
  getPropRenderMode(prop),
  getPropModelScale(prop),
  prop.decorModel3dId || '',
  prop.decorModelName || '',
  getImageSignature(getPropModelSource(prop)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationX || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationY || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationZ || 0)),
  prop.modelCenterOnOrigin ? 1 : 0,
  prop.modelFlushToGround ? 1 : 0,
  prop.imageName || '',
  getImageSignature(prop.imageData),
  prop.repeatTexture ? 1 : 0,
  getFloorZeroZ(prop),
].join(':');

const getStaticSceneSignature = (config = {}) => {
  const world = config.world || {};
  const engine = getEngine(config);
  return [
    Number(world.width) || 0,
    Number(world.height) || 0,
    Number(world.grid) || 0,
    getStaticEngineSignature(engine),
    (config.obstacles || []).map(getObstacleVisualSignature).join(';'),
    (config.reliefs || []).map(getReliefVisualSignature).join(';'),
    (config.actionZones || []).map(getActionZoneVisualSignature).join(';'),
    (config.props || []).map(getPropVisualSignature).join(';'),
  ].join('|');
};

const getSelectionOverlayEntitySignature = (config = {}, entity = {}) => {
  if (!entity?.type || !entity.id) return '';
  const engine = getEngine(config);
  if (entity.type === 'obstacle') {
    const obstacle = (config.obstacles || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      obstacle ? getObstacleVisualSignature(obstacle) : 'missing',
      Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight,
    ].join(':');
  }
  if (entity.type === 'relief') {
    const relief = (config.reliefs || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      relief ? getReliefVisualSignature(relief) : 'missing',
      Number(engine.reliefScale) || DEFAULT_ENGINE.reliefScale,
    ].join(':');
  }
  if (entity.type === 'prop') {
    const prop = (config.props || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      prop ? getPropVisualSignature(prop) : 'missing',
      Number(engine.propHeight) || DEFAULT_ENGINE.propHeight,
    ].join(':');
  }
  if (entity.type === 'actionZone') {
    const zone = (config.actionZones || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      zone ? getActionZoneVisualSignature(zone) : 'missing',
    ].join(':');
  }
  return '';
};

const getSelectionOverlaySignature = (config = {}, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  return selection
    .map((entity) => getSelectionOverlayEntitySignature(config, entity))
    .filter(Boolean)
    .sort()
    .join('|');
};

const createRockGeometry = (seedValue) => {
  const geometry = new THREE.DodecahedronGeometry(1, 1);
  const seed = Math.abs(hashString(seedValue)) + 1;
  const positions = geometry.attributes.position;
  const vertex = new THREE.Vector3();
  for (let i = 0; i < positions.count; i += 1) {
    vertex.fromBufferAttribute(positions, i);
    const jitter = 0.78 + (((Math.sin(seed * (i + 3) * 12.9898) * 43758.5453) % 1 + 1) % 1) * 0.34;
    vertex.multiplyScalar(jitter);
    positions.setXYZ(i, vertex.x, vertex.y, vertex.z);
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
};

const addWall = (group, config, obstacle, engine, selected) => {
  const width = Math.max(0.2, obstacle.w * WORLD_SCALE);
  const depth = Math.max(0.2, obstacle.h * WORLD_SCALE);
  const height = Math.max(0.4, Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight);
  const lift = getEntityLiftHeight(obstacle);
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: selected ? '#3b5268' : '#263241',
    roughness: 0.74,
    metalness: 0.08,
    emissive: selected ? '#123449' : '#070b10',
    emissiveIntensity: selected ? 0.32 : 0.1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.copy(toScenePosition(config, obstacle.x + obstacle.w / 2, obstacle.y + obstacle.h / 2, height / 2 + lift));

  const wallGroup = new THREE.Group();
  wallGroup.add(mesh);
  if (selected) wallGroup.add(createSelectionEdges(geometry));
  assignEntity(wallGroup, { type: 'obstacle', id: obstacle.id });
  if (selected) wallGroup.children[1].position.copy(mesh.position);
  group.add(wallGroup);
};

const addRelief = (group, config, relief, engine, selected) => {
  const width = Math.max(0.2, getReliefWidth(relief) * WORLD_SCALE);
  const depth = Math.max(0.2, getReliefHeight(relief) * WORLD_SCALE);
  const elevation = getReliefElevation(relief);
  const height = Math.max(0.08, Math.abs(elevation) * WORLD_SCALE * (Number(engine.reliefScale) || 1));
  const colors = RELIEF_STYLE_COLORS[relief.style] || RELIEF_STYLE_COLORS.plateau;
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const material = new THREE.MeshStandardMaterial({
    color: selected ? '#94f2ff' : colors.top,
    roughness: relief.style === 'ridge' ? 0.86 : 0.7,
    metalness: 0.02,
    emissive: colors.emissive,
    emissiveIntensity: selected ? 0.18 : 0.05,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = elevation > 0;
  mesh.receiveShadow = true;
  mesh.position.copy(toScenePosition(config, relief.x, relief.y, elevation >= 0 ? height / 2 : height * 0.1));

  const reliefGroup = new THREE.Group();
  reliefGroup.add(mesh);
  if (selected) {
    const edges = createSelectionEdges(geometry);
    edges.position.copy(mesh.position);
    reliefGroup.add(edges);
  }
  if (relief.blocksMovement) {
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(Math.min(width * 0.5, 1.4), 0.05, Math.min(depth * 0.14, 0.22)),
      new THREE.MeshBasicMaterial({ color: '#facc15' }),
    );
    marker.position.copy(toScenePosition(config, relief.x, relief.y, height + 0.06));
    reliefGroup.add(marker);
  }
  assignEntity(reliefGroup, { type: 'relief', id: relief.id });
  group.add(reliefGroup);
};

const addActionZone = (group, config, zone, options = {}) => {
  const { playMode = false } = options;
  const width = Math.max(0.24, getActionZoneWidth(zone) * WORLD_SCALE);
  const depth = Math.max(0.24, getActionZoneHeight(zone) * WORLD_SCALE);
  const height = Math.max(0.24, getActionZoneModelHeight(zone) * WORLD_SCALE);
  const color = getActionZoneColor(zone);
  const opacity = getActionZoneOpacity(zone);
  const zoneGroup = new THREE.Group();
  zoneGroup.position.copy(toScenePosition(config, zone.x, zone.y, 0));
  zoneGroup.rotation.y = degreesToRadians(zone.rotation || 0);

  const geometry = new THREE.BoxGeometry(width, height, depth);
  const veil = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  veil.position.y = height / 2;
  veil.renderOrder = 20;
  zoneGroup.add(veil);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: Math.min(1, Math.max(0.48, opacity + 0.34)),
    }),
  );
  edges.position.y = height / 2;
  edges.renderOrder = 21;
  zoneGroup.add(edges);

  if (!playMode || zone.visibleInPlay) {
    const footprintGeometry = new THREE.PlaneGeometry(width, depth);
    const footprint = new THREE.LineSegments(
      new THREE.EdgesGeometry(footprintGeometry),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 }),
    );
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.y = 0.06;
    footprint.renderOrder = 22;
    zoneGroup.add(footprint);
  }

  assignEntity(zoneGroup, { type: 'actionZone', id: zone.id });
  group.add(zoneGroup);
};

const addProp = (group, config, prop, engine, selected, getTexture, getModel, options = {}) => {
  const width = Math.max(0.24, getPropWidth(prop) * WORLD_SCALE);
  const depth = Math.max(0.24, getPropHeight(prop) * WORLD_SCALE);
  const propHeight = Math.max(0.08, getPropModelHeight(prop) * WORLD_SCALE * (Number(engine.propHeight) || 1));
  const lift = getEntityLiftHeight(prop);
  const renderMode = getPropRenderMode(prop);
  const propGroup = new THREE.Group();
  propGroup.position.copy(toScenePosition(config, prop.x, prop.y, lift));
  propGroup.rotation.y = degreesToRadians(prop.rotation || 0);
  const visualGroup = new THREE.Group();
  applyModelRotation(visualGroup, prop);

  const texture = getTexture(prop.imageData, Boolean(prop.repeatTexture || renderMode === 'floor'));
  const modelSource = getPropModelSource(prop);
  const modelTemplate = renderMode === 'glb' ? getModel?.(modelSource) : null;
  const textureMaterial = (fallbackColor, options = {}) => new THREE.MeshStandardMaterial({
    color: fallbackColor,
    map: texture || null,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive || '#061721',
    emissiveIntensity: options.emissiveIntensity ?? 0.1,
  });

  if (renderMode === 'glb') {
    if (modelTemplate) {
      const animation = addGltfPropModel(
        propGroup,
        modelTemplate,
        prop,
        propHeight,
        Math.max(width, depth) * 0.56,
        selected,
        texture,
      );
      if (animation?.mixer) {
        if (!Array.isArray(group.userData.animationMixers)) group.userData.animationMixers = [];
        group.userData.animationMixers.push(animation.mixer);
      }
    } else {
      const geometry = new THREE.BoxGeometry(width, propHeight, depth);
      const mesh = new THREE.Mesh(geometry, textureMaterial(selected ? '#e0f7ff' : '#38bdf8', { roughness: 0.62 }));
      mesh.position.y = propHeight / 2;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      visualGroup.add(mesh);
      if (selected) {
        const edges = createSelectionEdges(geometry);
        edges.position.copy(mesh.position);
        visualGroup.add(edges);
      }
    }
  } else if (renderMode === 'floor') {
    const material = textureMaterial('#2f5368', { roughness: 0.88, emissiveIntensity: 0.04 });
    material.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 0.045;
    mesh.receiveShadow = true;
    visualGroup.add(mesh);
    if (selected) {
      const outline = createSelectionEdges(new THREE.BoxGeometry(width, 0.04, depth));
      outline.position.y = 0.07;
      visualGroup.add(outline);
    }
  } else if (renderMode === 'box') {
    const geometry = new THREE.BoxGeometry(width, propHeight, depth);
    const mesh = new THREE.Mesh(geometry, textureMaterial(selected ? '#e0f7ff' : '#7dd3fc', { roughness: 0.68 }));
    mesh.position.y = propHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    visualGroup.add(mesh);
    if (selected) {
      const edges = createSelectionEdges(geometry);
      edges.position.copy(mesh.position);
      visualGroup.add(edges);
    }
  } else if (renderMode === 'house') {
    const bodyHeight = Math.max(0.38, propHeight * 0.68);
    const roofHeight = Math.max(0.24, propHeight * 0.32);
    const bodyGeometry = new THREE.BoxGeometry(width, bodyHeight, depth);
    const body = new THREE.Mesh(bodyGeometry, textureMaterial(selected ? '#e0f7ff' : '#d9b889', { roughness: 0.78 }));
    body.position.y = bodyHeight / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    visualGroup.add(body);

    const roof = new THREE.Mesh(
      new THREE.ConeGeometry(Math.max(width, depth) * 0.72, roofHeight, 4),
      new THREE.MeshStandardMaterial({
        color: '#7f1d1d',
        roughness: 0.7,
        emissive: '#2a0b0b',
        emissiveIntensity: 0.08,
      }),
    );
    roof.rotation.y = Math.PI / 4;
    roof.position.y = bodyHeight + roofHeight / 2;
    roof.castShadow = true;
    visualGroup.add(roof);

    const door = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.18, bodyHeight * 0.42, 0.035),
      new THREE.MeshStandardMaterial({ color: '#3b2417', roughness: 0.8 }),
    );
    door.position.set(0, bodyHeight * 0.22, depth / 2 + 0.025);
    visualGroup.add(door);

    if (selected) {
      const edges = createSelectionEdges(new THREE.BoxGeometry(width, propHeight, depth));
      edges.position.y = propHeight / 2;
      visualGroup.add(edges);
    }
  } else if (renderMode === 'rock') {
    const geometry = createRockGeometry(prop.id || prop.name || 'rock');
    const material = textureMaterial(selected ? '#e0f7ff' : '#64748b', {
      roughness: 0.92,
      metalness: 0,
      emissive: '#111827',
      emissiveIntensity: 0.08,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(width * 0.48, propHeight * 0.5, depth * 0.48);
    mesh.position.y = propHeight * 0.48;
    mesh.rotation.y = hashString(prop.id || prop.name || 'rock') * 0.01;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    visualGroup.add(mesh);
    if (selected) propGroup.add(createSelectionRing(Math.max(width, depth) * 0.52, '#67e8f9'));
  } else if (texture) {
    const material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08 });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(width, Math.max(depth, propHeight), 1);
    sprite.position.y = Math.max(depth, propHeight) / 2;
    visualGroup.add(sprite);
  } else {
    const geometry = new THREE.CylinderGeometry(width * 0.38, width * 0.48, propHeight, 10);
    const material = new THREE.MeshStandardMaterial({
      color: selected ? '#67e8f9' : '#2dd4bf',
      roughness: 0.82,
      emissive: '#06231f',
      emissiveIntensity: 0.16,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.y = propHeight / 2;
    visualGroup.add(mesh);
  }

  if (!(renderMode === 'glb' && modelTemplate)) {
    if (prop.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(visualGroup);
    snapObjectToGround(visualGroup, renderMode === 'floor' ? 0.045 : 0);
  }

  if (selected && !['floor', 'box', 'rock', 'house', 'glb'].includes(renderMode)) {
    propGroup.add(createSelectionRing(Math.max(width, depth) * 0.55, '#67e8f9'));
  }
  propGroup.add(visualGroup);
  assignEntity(propGroup, { type: 'prop', id: prop.id });
  if (selected && isFlatTileLikeProp(prop) && options.showTileDuplicateHandles !== false) {
    const handleSize = getFlatTileSceneDimensions(prop, width, depth);
    addTileDuplicateHandles(propGroup, prop, handleSize.width, handleSize.depth);
  }
  group.add(propGroup);
};

const addPickup = (group, config, pickup, selected, time) => {
  const position = toScenePosition(config, pickup.x, pickup.y, 0.42 + Math.sin(time * 4) * 0.04 + getEntityLiftHeight(pickup));
  const color = pickup.type === 'health' ? '#ef4444' : pickup.type === 'mana' ? '#38bdf8' : '#facc15';
  const pickupGroup = new THREE.Group();
  pickupGroup.position.copy(position);
  pickupGroup.add(new THREE.Mesh(
    new THREE.TorusGeometry(PICKUP_RADIUS * WORLD_SCALE, 0.055, 10, 32),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.36 }),
  ));
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(PICKUP_RADIUS * WORLD_SCALE * 0.52, 12, 12),
    new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 0.75 }),
  );
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
    supportHeight = 0,
  } = options;
  const actorGroup = new THREE.Group();
  const lift = getEntityLiftHeight(actor);
  actorGroup.position.copy(toScenePosition(config, actor.x, actor.y, supportHeight + lift));
  const radius3d = Math.max(0.22, radius * WORLD_SCALE);
  const modelScale = forcedModelScale || getCharacterModelScale(actor);
  const height = (type === 'player' ? 1.32 : 1.18) * modelScale;
  const bodyColor = active ? preset.accent : preset.body;
  const texture = getTexture(imageData);
  const renderMode = forcedRenderMode || getCharacterRenderMode(actor);
  const modelTemplate = renderMode === 'glb' ? getModel?.(actor.characterModelUrl) : null;
  const skinnedBodyColor = selected ? '#f8fbff' : texture ? '#d8e5f5' : bodyColor;
  const aim = normalize((aimTarget?.x || actor.x + 1) - actor.x, (aimTarget?.y || actor.y) - actor.y);
  const angle = useStoredRotation ? degreesToRadians(actor.rotation || 0) : Math.atan2(aim.x, aim.y);
  actorGroup.rotation.y = angle;

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(radius3d * (renderMode === 'boss' ? 2.4 : 1.35) * modelScale, 24),
    new THREE.MeshBasicMaterial({ color: '#000000', transparent: true, opacity: 0.24 }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -lift + 0.012;
  actorGroup.userData.actorShadow = shadow;
  actorGroup.add(shadow);

  const actorMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
    color: options.skin && texture ? '#ffffff' : color,
    map: options.skin && texture ? texture : null,
    roughness: options.roughness ?? 0.58,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive || preset.accent,
    emissiveIntensity: options.emissiveIntensity ?? (active ? 0.26 : 0.08),
  });

  const addTexturePanel = (width, panelHeight, y, z, opacity = 0.96) => {
    if (!texture) return;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, panelHeight),
      new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        opacity,
        alphaTest: 0.06,
        side: THREE.DoubleSide,
      }),
    );
    panel.position.set(0, y, z);
    actorGroup.add(panel);
  };

  const addImageSprite = (width, spriteHeight, y, z = 0) => {
    if (!texture || renderMode === 'sprite') return;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      opacity: 0.98,
      alphaTest: 0.05,
      depthTest: false,
      depthWrite: false,
    }));
    sprite.scale.set(width, spriteHeight, 1);
    sprite.position.set(0, y, z);
    sprite.renderOrder = 12;
    actorGroup.add(sprite);
  };

  if (renderMode === 'glb' && actor.characterModelUrl) {
    if (!modelTemplate) {
      const placeholder = new THREE.Mesh(
        new THREE.CapsuleGeometry(radius3d * 0.88 * modelScale, height * 0.58, 6, 12),
        actorMaterial(skinnedBodyColor, { metalness: 0.12, skin: false }),
      );
      placeholder.position.y = height * 0.5;
      actorGroup.add(placeholder);
      if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * modelScale, '#f8fbff'));
    } else {
      const animation = addGltfActorModel(actorGroup, modelTemplate, actor, height, radius3d, selected, modelScale, animationTime);
      if (animation?.mixer) {
        if (!Array.isArray(group.userData.animationMixers)) group.userData.animationMixers = [];
        group.userData.animationMixers.push(animation.mixer);
      }
    }
    assignEntity(actorGroup, { type, id });
    group.add(actorGroup);
    return;
  }

  if (renderMode === 'sprite' && texture) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: 0.08 }));
    sprite.scale.set(radius3d * 3.4 * modelScale, height * 1.18, 1);
    sprite.position.y = height * 0.58;
    actorGroup.add(sprite);
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
    new THREE.MeshStandardMaterial({
      color: preset.weapon,
      roughness: 0.28,
      metalness: 0.24,
      emissive: preset.accent,
      emissiveIntensity: 0.16,
    }),
  );
  weapon.position.set(0, height * 0.62, radius3d * 1.55 * modelScale);
  weapon.castShadow = true;
  actorGroup.add(weapon);

  if (selected) actorGroup.add(createSelectionRing(radius3d * (renderMode === 'boss' ? 2.35 : 1.75) * modelScale, '#f8fbff'));
  assignEntity(actorGroup, { type, id });
  group.add(actorGroup);
};

const addBullet = (group, config, bullet) => {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(0.08, 12, 8),
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
    new THREE.SphereGeometry(0.045 + alpha * 0.035, 8, 6),
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

const updateActorTransform = (root, config, actor, options = {}) => {
  if (!root || !actor) return;
  const {
    aimTarget,
    useStoredRotation = false,
    supportHeight = 0,
  } = options;
  const lift = getEntityLiftHeight(actor);
  root.position.copy(toScenePosition(config, actor.x, actor.y, supportHeight + lift));
  const aim = normalize((aimTarget?.x || actor.x + 1) - actor.x, (aimTarget?.y || actor.y) - actor.y);
  root.rotation.y = useStoredRotation ? degreesToRadians(actor.rotation || 0) : Math.atan2(aim.x, aim.y);
  if (root.userData.actorShadow) root.userData.actorShadow.position.y = -lift + 0.012;
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

const updateDynamicTransforms = (group, config, state, options = {}) => {
  if (!group || !config || !state) return;
  const { playMode = false, aimPoint = null } = options;
  const time = state.time || 0;
  const getActorSupportHeight = (actor) => getSupportSurfaceHeightAtPoint(config, actor);

  (config.heroes || []).forEach((hero) => {
    updateActorTransform(findDynamicEntityRoot(group, 'hero', hero.id), config, hero, {
      aimTarget: playMode ? state.player : config.player,
      useStoredRotation: true,
      supportHeight: getActorSupportHeight(hero),
    });
  });

  const enemies = playMode ? state.enemies : config.enemies;
  (enemies || []).forEach((enemy) => {
    updateActorTransform(findDynamicEntityRoot(group, 'enemy', enemy.id), config, enemy, {
      aimTarget: playMode ? state.player : config.player,
      useStoredRotation: !playMode,
      supportHeight: getActorSupportHeight(enemy),
    });
  });

  const pickups = playMode ? state.pickups : config.pickups;
  (pickups || []).forEach((pickup) => {
    updatePickupTransform(findDynamicEntityRoot(group, 'pickup', pickup.id), config, pickup, time);
  });

  if (playMode) {
    updateActorTransform(findDynamicEntityRoot(group, 'spawn', 'player'), config, state.player, {
      aimTarget: aimPoint || state.player?.moveTarget || { x: config.player.x + 1, y: config.player.y },
      supportHeight: getActorSupportHeight(state.player),
    });
  }

  const bulletRoots = new Map(
    group.children
      .filter((child) => child.userData?.dynamicKind === 'bullet')
      .map((child) => [child.userData.dynamicId, child]),
  );
  const activeBulletIds = new Set();
  (state.bullets || []).forEach((bullet) => {
    activeBulletIds.add(bullet.id);
    updateBulletTransform(bulletRoots.get(bullet.id), config, bullet);
  });
  bulletRoots.forEach((root, id) => {
    if (!activeBulletIds.has(id)) root.visible = false;
  });

  const particleRoots = group.children
    .filter((child) => child.userData?.dynamicKind === 'particle')
    .sort((a, b) => (a.userData.dynamicIndex || 0) - (b.userData.dynamicIndex || 0));
  particleRoots.forEach((root, index) => {
    const particle = state.particles?.[index];
    if (particle) updateParticleTransform(root, config, particle);
    else root.visible = false;
  });
};

const getMapEntityItem = (config, selected) => {
  if (!selected || !config) return null;
  if (selected.type === 'spawn') return config.player || null;
  const key = selected.type === 'obstacle'
    ? 'obstacles'
    : selected.type === 'hero'
      ? 'heroes'
      : selected.type === 'enemy'
        ? 'enemies'
        : selected.type === 'pickup'
          ? 'pickups'
          : selected.type === 'relief'
            ? 'reliefs'
            : selected.type === 'actionZone'
              ? 'actionZones'
              : 'props';
  return (config[key] || []).find((item) => item.id === selected.id) || null;
};

const findSelectedPosition = (config, selected) => {
  if (!selected) return null;
  const entity = getMapEntityItem(config, selected);
  if (!entity) return null;
  if (selected.type === 'obstacle') return { x: entity.x + entity.w / 2, y: entity.y + entity.h / 2 };
  return { x: entity.x, y: entity.y };
};
const isDraggableEntity = (entity = {}) => (
  ['spawn', 'prop', 'hero', 'enemy', 'pickup', 'relief', 'obstacle', 'actionZone'].includes(entity.type)
);
const isCameraTargetEntity = (entity = {}) => (
  ['spawn', 'prop', 'hero', 'enemy', 'pickup', 'relief', 'obstacle', 'actionZone'].includes(entity.type)
);
const getCameraTargetPoint = (config, entity, engine = DEFAULT_ENGINE) => {
  if (!config || !isCameraTargetEntity(entity)) return null;
  const item = getMapEntityItem(config, entity);
  const position = findSelectedPosition(config, entity);
  if (!item || !position) return null;
  if (entity.type === 'spawn' || entity.type === 'hero' || entity.type === 'enemy') {
    return {
      ...position,
      height: getSupportSurfaceHeightAtPoint(config, item) + getEntityLiftHeight(item) + 0.72,
    };
  }
  if (entity.type === 'pickup') {
    return { ...position, height: 0.42 + getEntityLiftHeight(item) };
  }
  if (entity.type === 'obstacle') {
    return { ...position, height: Math.max(0.4, Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight) / 2 + getEntityLiftHeight(item) };
  }
  if (entity.type === 'relief') {
    const elevation = getReliefElevation(item);
    const height = Math.max(0.08, Math.abs(elevation) * WORLD_SCALE * (Number(engine.reliefScale) || 1));
    return { ...position, height: elevation >= 0 ? height : 0.04 };
  }
  if (entity.type === 'actionZone') {
    return { ...position, height: Math.max(0.24, getActionZoneModelHeight(item) * WORLD_SCALE) / 2 };
  }
  if (entity.type === 'prop') {
    const propHeight = Math.max(0.08, getPropModelHeight(item) * WORLD_SCALE * (Number(engine.propHeight) || 1));
    const height = isFlatTileLikeProp(item) ? getFlatTileSurfaceHeight(item) + 0.08 : getEntityLiftHeight(item) + propHeight / 2;
    return { ...position, height };
  }
  return { ...position, height: 0.65 };
};
const getEntityKey = (entity = {}) => (entity?.type && entity?.id ? `${entity.type}:${entity.id}` : '');
const isSameEntity = (a = {}, b = {}) => Boolean(a?.type && b?.type && a.type === b.type && a.id === b.id);
const isSelectionActive = (type, id, selected, multiSelected = []) => (
  (selected?.type === type && selected.id === id)
  || multiSelected.some((entry) => entry.type === type && entry.id === id)
);
const normalizeScreenRect = (box = {}) => ({
  left: Math.min(box.startX, box.currentX),
  top: Math.min(box.startY, box.currentY),
  width: Math.abs(box.currentX - box.startX),
  height: Math.abs(box.currentY - box.startY),
});
const screenRectsIntersect = (a, b) => (
  a.left <= b.left + b.width
  && a.left + a.width >= b.left
  && a.top <= b.top + b.height
  && a.top + a.height >= b.top
);
const projectWorldPointToScreen = (config, camera, viewport, point = {}) => {
  const vector = toScenePosition(config, point.x, point.y, point.height || 0);
  vector.project(camera);
  if (!Number.isFinite(vector.x) || !Number.isFinite(vector.y) || vector.z < -1 || vector.z > 1) return null;
  return {
    x: (vector.x * 0.5 + 0.5) * viewport.width,
    y: (-vector.y * 0.5 + 0.5) * viewport.height,
  };
};
const getProjectedBounds = (config, camera, viewport, points = []) => {
  const projected = points
    .map((point) => projectWorldPointToScreen(config, camera, viewport, point))
    .filter(Boolean);
  if (!projected.length) return null;
  return {
    left: Math.min(...projected.map((point) => point.x)),
    top: Math.min(...projected.map((point) => point.y)),
    width: Math.max(...projected.map((point) => point.x)) - Math.min(...projected.map((point) => point.x)),
    height: Math.max(...projected.map((point) => point.y)) - Math.min(...projected.map((point) => point.y)),
  };
};
const createWorldBoxPoints = (x, y, width, height) => [
  { x, y },
  { x: x - width / 2, y: y - height / 2 },
  { x: x + width / 2, y: y - height / 2 },
  { x: x + width / 2, y: y + height / 2 },
  { x: x - width / 2, y: y + height / 2 },
];

function ArcadeThreeViewport({
  config,
  configRef,
  studioProject = null,
  stateRef,
  mode,
  selected,
  multiSelected = [],
  multiSelectMode = false,
  cameraTargetPickMode = false,
  placementEntity = null,
  dragEnabled = false,
  onWorldPointer,
  onWorldClick,
  onCameraTargetPick,
  onWorldDragStart,
  onWorldDrag,
  onWorldDrop,
  onMarqueeSelect,
  onShootChange,
  onUnavailable,
}) {
  const containerRef = useRef(null);
  const rendererRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const staticGroupRef = useRef(null);
  const selectionGroupRef = useRef(null);
  const dynamicGroupRef = useRef(null);
  const groundRef = useRef(null);
  const raycasterRef = useRef(new THREE.Raycaster());
  const pointerRef = useRef(new THREE.Vector2());
  const aimPointRef = useRef(null);
  const clickStartRef = useRef(null);
  const dragRef = useRef(null);
  const placementPreviewRef = useRef(null);
  const marqueeRef = useRef(null);
  const textureCacheRef = useRef(new Map());
  const modelCacheRef = useRef(new Map());
  const modelPendingRef = useRef(new Set());
  const latestRef = useRef({
    config,
    mode,
    selected,
    multiSelected,
    multiSelectMode,
    cameraTargetPickMode,
    placementEntity,
    dragEnabled,
    onWorldPointer,
    onWorldClick,
    onCameraTargetPick,
    onWorldDragStart,
    onWorldDrag,
    onWorldDrop,
    onMarqueeSelect,
    onShootChange,
    onUnavailable,
  });
  const cameraReadyRef = useRef(false);
  const lastEditCameraDistanceRef = useRef(null);
  const dynamicFrameRef = useRef({ lastTime: 0, signature: '', forceSignature: '' });
  const [webglError, setWebglError] = useState('');
  const [staticAssetVersion, setStaticAssetVersion] = useState(0);
  const [marqueeRect, setMarqueeRect] = useState(null);
  const studioDecorTextureById = React.useMemo(() => {
    const entries = (studioProject?.decorModels3d || [])
      .filter((model) => model?.id && model.imageData)
      .map((model) => [model.id, {
        imageData: model.imageData,
        imageName: model.imageName || '',
        repeatTexture: Boolean(model.repeatTexture),
      }]);
    return new Map(entries);
  }, [studioProject]);
  const staticSceneSignature = React.useMemo(() => getStaticSceneSignature(config), [
    config.world,
    config.engine?.wallHeight,
    config.engine?.reliefScale,
    config.engine?.propHeight,
    config.obstacles,
    config.reliefs,
    config.actionZones,
    config.props,
  ]);
  const selectionOverlaySignature = React.useMemo(
    () => getSelectionOverlaySignature(config, selected, multiSelected),
    [
      config.world,
      config.engine?.wallHeight,
      config.engine?.reliefScale,
      config.engine?.propHeight,
      config.obstacles,
      config.reliefs,
      config.actionZones,
      config.props,
      selected,
      multiSelected,
    ],
  );

  latestRef.current = {
    config,
    mode,
    selected,
    multiSelected,
    multiSelectMode,
    cameraTargetPickMode,
    placementEntity,
    dragEnabled,
    onWorldPointer,
    onWorldClick,
    onCameraTargetPick,
    onWorldDragStart,
    onWorldDrag,
    onWorldDrop,
    onMarqueeSelect,
    onShootChange,
    onUnavailable,
  };

  const getScreenPoint = useCallback((event) => {
    const renderer = rendererRef.current;
    if (!renderer) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    return {
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
      viewport: { width: rect.width, height: rect.height },
    };
  }, []);

  const resolvePointer = useCallback((event, { pickEntity = false } = {}) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    if (!renderer || !camera || !scene || !liveConfig) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;
    pointerRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointerRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = raycasterRef.current;
    raycaster.setFromCamera(pointerRef.current, camera);

    const entityHit = pickEntity
      ? raycaster
        .intersectObjects([staticGroupRef.current, selectionGroupRef.current, dynamicGroupRef.current].filter(Boolean), true)
        .map((hit) => readEntity(hit.object))
        .find(Boolean)
      : null;
    const groundPoint = new THREE.Vector3();
    const hitGround = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), groundPoint);
    if (!hitGround) return null;
    return {
      point: fromScenePosition(liveConfig, groundPoint),
      entity: entityHit,
      screenX: event.clientX - rect.left,
      screenY: event.clientY - rect.top,
    };
  }, [configRef]);

  const getEntitiesInMarquee = useCallback((rect) => {
    const renderer = rendererRef.current;
    const camera = cameraRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    if (!renderer || !camera || !liveConfig || !rect) return [];
    const viewport = renderer.domElement.getBoundingClientRect();
    if (!viewport.width || !viewport.height) return [];
    const selectedEntities = [];
    const addIfInside = (entity, points) => {
      const bounds = getProjectedBounds(liveConfig, camera, viewport, points);
      if (bounds && screenRectsIntersect(bounds, rect)) selectedEntities.push(entity);
    };

    if (liveConfig.player) {
      addIfInside(
        { type: 'spawn', id: 'player' },
        createWorldBoxPoints(liveConfig.player.x, liveConfig.player.y, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2),
      );
    }
    (liveConfig.heroes || []).forEach((hero) => {
      addIfInside({ type: 'hero', id: hero.id }, createWorldBoxPoints(hero.x, hero.y, PLAYER_RADIUS * 2, PLAYER_RADIUS * 2));
    });
    (liveConfig.enemies || []).forEach((enemy) => {
      addIfInside({ type: 'enemy', id: enemy.id }, createWorldBoxPoints(enemy.x, enemy.y, ENEMY_RADIUS * 2, ENEMY_RADIUS * 2));
    });
    (liveConfig.pickups || []).forEach((pickup) => {
      addIfInside({ type: 'pickup', id: pickup.id }, createWorldBoxPoints(pickup.x, pickup.y, PICKUP_RADIUS * 2, PICKUP_RADIUS * 2));
    });
    (liveConfig.obstacles || []).forEach((obstacle) => {
      addIfInside(
        { type: 'obstacle', id: obstacle.id },
        createWorldBoxPoints(
          (Number(obstacle.x) || 0) + getPropWidth(obstacle) / 2,
          (Number(obstacle.y) || 0) + getPropHeight(obstacle) / 2,
          getPropWidth(obstacle),
          getPropHeight(obstacle),
        ),
      );
    });
    (liveConfig.reliefs || []).forEach((relief) => {
      addIfInside({ type: 'relief', id: relief.id }, createWorldBoxPoints(relief.x, relief.y, getReliefWidth(relief), getReliefHeight(relief)));
    });
    (liveConfig.actionZones || []).forEach((zone) => {
      addIfInside({ type: 'actionZone', id: zone.id }, createWorldBoxPoints(zone.x, zone.y, getActionZoneWidth(zone), getActionZoneHeight(zone)));
    });
    (liveConfig.props || []).forEach((prop) => {
      addIfInside({ type: 'prop', id: prop.id }, createWorldBoxPoints(prop.x, prop.y, getPropWidth(prop), getPropHeight(prop)));
    });

    return selectedEntities;
  }, [configRef]);

  const setCameraTargetFromEntity = useCallback((entity) => {
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const liveConfig = configRef.current || latestRef.current.config;
    if (!camera || !controls || !liveConfig || !isCameraTargetEntity(entity)) return false;
    const targetPoint = getCameraTargetPoint(liveConfig, entity, getEngine(liveConfig));
    if (!targetPoint) return false;
    const nextTarget = toScenePosition(liveConfig, targetPoint.x, targetPoint.y, targetPoint.height ?? 0.65);
    const viewOffset = camera.position.clone().sub(controls.target);
    controls.target.copy(nextTarget);
    camera.position.copy(nextTarget).add(viewOffset);
    controls.update();
    cameraReadyRef.current = true;
    return true;
  }, [configRef]);

  const findEntityRoots = useCallback((entity) => {
    if (!isDraggableEntity(entity)) return [];
    const roots = [];
    [staticGroupRef.current, selectionGroupRef.current, dynamicGroupRef.current].filter(Boolean).forEach((group) => {
      group.children.forEach((child) => {
        if (child.userData?.entityType === entity.type && child.userData?.entityId === entity.id) {
          roots.push(child);
        }
      });
    });
    return roots;
  }, []);

  const createDragPreviewTargets = useCallback((draggedEntity) => {
    const latest = latestRef.current;
    const liveConfig = configRef.current || latest.config;
    const activeEntity = { type: draggedEntity?.type, id: draggedEntity?.id };
    const dragEntities = latest.multiSelected?.some((entry) => isSameEntity(entry, activeEntity))
      ? latest.multiSelected.filter(isDraggableEntity)
      : [activeEntity].filter(isDraggableEntity);

    return dragEntities
      .map((entity) => {
        const startWorld = findSelectedPosition(liveConfig, entity);
        if (!startWorld) return null;
        return {
          entity,
          roots: findEntityRoots(entity).map((root) => ({
            root,
            startPosition: root.position.clone(),
          })),
          startWorld,
        };
      })
      .filter(Boolean);
  }, [configRef, findEntityRoots]);

  const applyDragPreview = useCallback((drag, point) => {
    if (!drag || !point) return;
    const delta = {
      x: point.x - drag.anchor.x,
      y: point.y - drag.anchor.y,
    };
    const sceneDelta = new THREE.Vector3(delta.x * WORLD_SCALE, 0, delta.y * WORLD_SCALE);

    drag.previewTargets.forEach((target) => {
      const activeRoots = target.roots.filter(({ root }) => root.parent);
      if (activeRoots.length !== target.roots.length || activeRoots.length === 0) {
        target.roots = findEntityRoots(target.entity).map((root) => ({
          root,
          startPosition: root.position.clone(),
        }));
      }
      target.roots.forEach(({ root, startPosition }) => {
        root.position.copy(startPosition).add(sceneDelta);
      });
    });
  }, [findEntityRoots]);

  const resetDragPreview = useCallback((drag) => {
    drag?.previewTargets?.forEach((target) => {
      target.roots.forEach(({ root, startPosition }) => {
        if (root.parent) root.position.copy(startPosition);
      });
    });
  }, []);

  const applyPlacementPreview = useCallback((entity, point) => {
    if (!entity?.type || !entity.id || !point) return;
    const key = getEntityKey(entity);
    const liveConfig = configRef.current || latestRef.current.config;
    if (!key || !liveConfig) return;
    if (placementPreviewRef.current?.key !== key) {
      resetDragPreview(placementPreviewRef.current);
      placementPreviewRef.current = {
        key,
        entity,
        anchor: findSelectedPosition(liveConfig, entity) || point,
        previewTargets: createDragPreviewTargets(entity),
      };
    }
    applyDragPreview(placementPreviewRef.current, point);
  }, [applyDragPreview, configRef, createDragPreviewTargets, resetDragPreview]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
      });
    } catch {
      setWebglError('La vue 3D est indisponible pour le moment.');
      latestRef.current.onUnavailable?.();
      return undefined;
    }
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor('#081521', 1);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.15));
    renderer.shadowMap.enabled = false;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'arcade-three-canvas';
    const handleContextLost = (event) => {
      event.preventDefault();
      setWebglError('La vue 3D a ete suspendue par le navigateur.');
      latestRef.current.onUnavailable?.();
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#081521');
    scene.fog = new THREE.FogExp2('#081521', 0.012);
    sceneRef.current = scene;
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;

    const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
    camera.position.set(-18, 16, 18);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 5;
    controls.maxDistance = 90;
    controls.screenSpacePanning = false;
    controlsRef.current = controls;
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
      enabled: () => latestRef.current.mode !== 'play' && !latestRef.current.cameraTargetPickMode && !latestRef.current.placementEntity && !dragRef.current && !marqueeRef.current,
    });

    const staticGroup = new THREE.Group();
    const selectionGroup = new THREE.Group();
    const dynamicGroup = new THREE.Group();
    staticGroupRef.current = staticGroup;
    selectionGroupRef.current = selectionGroup;
    dynamicGroupRef.current = dynamicGroup;
    scene.add(staticGroup);
    scene.add(selectionGroup);
    scene.add(dynamicGroup);

    const hemi = new THREE.HemisphereLight('#d6f6ff', '#26170f', 1.14);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight('#fff1cf', 1.75);
    sun.position.set(-16, 32, 18);
    sun.castShadow = true;
    sun.shadow.camera.near = 1;
    sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -45;
    sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45;
    sun.shadow.camera.bottom = -45;
    scene.add(sun);
    const frontFill = new THREE.DirectionalLight('#d8e8ff', 0.95);
    frontFill.position.set(18, 14, 24);
    scene.add(frontFill);
    const rim = new THREE.DirectionalLight('#7df3ff', 0.42);
    rim.position.set(20, 18, -24);
    scene.add(rim);
    scene.add(new THREE.AmbientLight('#78b7ff', 0.24));
    scene.userData.hemi = hemi;
    scene.userData.sun = sun;
    scene.userData.frontFill = frontFill;
    scene.userData.rim = rim;

    let frameId = 0;
    let lastResizeCheck = 0;
    let previousAnimationTime = 0;
    const resize = (timestamp = 0) => {
      if (timestamp && timestamp - lastResizeCheck < 250) return;
      lastResizeCheck = timestamp;
      const width = Math.max(320, container.clientWidth);
      const height = Math.max(280, container.clientHeight);
      const canvas = renderer.domElement;
      if (canvas.width !== Math.floor(width * renderer.getPixelRatio()) || canvas.height !== Math.floor(height * renderer.getPixelRatio())) {
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
      }
    };

    const render = (timestamp = 0) => {
      const liveConfig = configRef.current || latestRef.current.config;
      const state = stateRef.current;
      const latest = latestRef.current;
      if (!liveConfig || !state) {
        frameId = requestAnimationFrame(render);
        return;
      }
      const animationDelta = previousAnimationTime ? Math.min(0.05, (timestamp - previousAnimationTime) / 1000) : 0;
      previousAnimationTime = timestamp;
      staticGroup.userData.animationMixers?.forEach((mixer) => mixer.update(animationDelta));
      dynamicGroup.userData.animationMixers?.forEach((mixer) => mixer.update(animationDelta));
      const engine = getEngine(liveConfig);
      const playMode = latest.mode === 'play';
      const player = playMode ? state.player : liveConfig.player;
      const selectedPosition = !playMode ? findSelectedPosition(liveConfig, latest.selected) : null;
      const editFocus = { x: liveConfig.world.width * 0.5, y: liveConfig.world.height * 0.48 };
      const selectedEditFocus = selectedPosition ? {
        x: clamp(selectedPosition.x, liveConfig.world.width * 0.22, liveConfig.world.width * 0.78),
        y: clamp(selectedPosition.y, liveConfig.world.height * 0.22, liveConfig.world.height * 0.78),
      } : null;
      const focus = playMode ? player : (selectedEditFocus || editFocus);
      const target = toScenePosition(liveConfig, focus.x, focus.y, 0.65);

      resize(timestamp);
      scene.userData.hemi.intensity = Number(engine.lightIntensity) || DEFAULT_ENGINE.lightIntensity;
      scene.userData.sun.intensity = (Number(engine.lightIntensity) || DEFAULT_ENGINE.lightIntensity) * 1.35;
      controls.enabled = !playMode && !latest.dragEnabled && !latest.multiSelectMode && !latest.cameraTargetPickMode && !latest.placementEntity && !dragRef.current && !marqueeRef.current;

      if (playMode) {
        const distance = Number(engine.cameraDistance) || DEFAULT_ENGINE.cameraDistance;
        const height = Number(engine.cameraHeight) || DEFAULT_ENGINE.cameraHeight;
        const offset = new THREE.Vector3(-distance * 0.48, height, distance * 0.72);
        camera.position.lerp(target.clone().add(offset), 0.12);
        camera.lookAt(target);
        lastEditCameraDistanceRef.current = null;
      } else {
        const distance = Number(engine.cameraDistance) || DEFAULT_ENGINE.cameraDistance;
        if (!cameraReadyRef.current) {
          const height = Number(engine.cameraHeight) || DEFAULT_ENGINE.cameraHeight;
          camera.position.copy(target.clone().add(new THREE.Vector3(-distance * 0.65, height, distance * 0.78)));
          controls.target.copy(target);
          cameraReadyRef.current = true;
          lastEditCameraDistanceRef.current = distance;
        } else if (lastEditCameraDistanceRef.current !== distance) {
          const direction = camera.position.clone().sub(controls.target);
          if (direction.lengthSq() < 0.0001) direction.set(-0.45, 0.42, 0.68);
          direction.normalize();
          camera.position.copy(controls.target).add(direction.multiplyScalar(distance));
          lastEditCameraDistanceRef.current = distance;
        }
      }
      controls.update();

      const now = performance.now();
      const dynamicSelectedKey = [
        DYNAMIC_SELECTION_TYPES.has(latest.selected?.type) ? `${latest.selected.type}:${latest.selected.id}` : 'none',
        (latest.multiSelected || [])
          .filter((entry) => DYNAMIC_SELECTION_TYPES.has(entry?.type))
          .map(getEntityKey)
          .sort()
          .join(','),
      ].join('|');
      const dynamicHeroes = liveConfig.heroes || [];
      const dynamicEnemies = playMode ? state.enemies : liveConfig.enemies;
      const dynamicPickups = playMode ? state.pickups : liveConfig.pickups;
      const getActorSupportHeight = (actor) => getSupportSurfaceHeightAtPoint(liveConfig, actor);
      if (playMode) {
        updateDynamicTransforms(dynamicGroup, liveConfig, state, {
          playMode,
          aimPoint: aimPointRef.current,
        });
      }
      const heroVisualSignature = dynamicHeroes.map((hero) => [
        getActorVisualSignature(hero),
        playMode ? '' : `${Math.round(hero.x)}:${Math.round(hero.y)}`,
      ].join(':')).join(';');
      const enemyVisualSignature = dynamicEnemies.map((enemy) => [
        enemy.id,
        enemy.alert ? 1 : 0,
        playMode ? '' : `${Math.round(enemy.x)}:${Math.round(enemy.y)}`,
        getActorVisualSignature(enemy),
      ].join(':')).join(';');
      const bulletVisualSignature = (state.bullets || []).map((bullet) => `${bullet.id}:${bullet.color}`).join(';');
      const particleFrameSignature = `${state.particles.length}:${Math.floor((state.time || 0) * 10)}`;
      const pickupVisualSignature = dynamicPickups.map((pickup) => [
        pickup.id,
        pickup.type,
        Math.round(getEntityLift(pickup)),
        playMode ? '' : `${Math.round(pickup.x)}:${Math.round(pickup.y)}`,
      ].join(':')).join(';');
      const forceSignature = [
        latest.mode,
        dynamicSelectedKey,
        getActorVisualSignature(liveConfig.player),
        playMode && state.player?.dash > 0 ? 'dash' : 'walk',
        heroVisualSignature,
        enemyVisualSignature,
        pickupVisualSignature,
        bulletVisualSignature,
      ].join('|');
      const dynamicSignature = [
        forceSignature,
        particleFrameSignature,
      ].join('|');
      const minInterval = playMode ? 90 : 1000;
      const shouldRefreshDynamic = dynamicFrameRef.current.forceSignature !== forceSignature
        || (
          dynamicFrameRef.current.signature !== dynamicSignature
          && now - dynamicFrameRef.current.lastTime > minInterval
        );

      if (shouldRefreshDynamic) {
        dynamicFrameRef.current = { signature: dynamicSignature, forceSignature, lastTime: now };
        const getTexture = createCachedTextureGetter(textureCacheRef.current);
        const getModel = createCachedModelGetter(modelCacheRef.current, modelPendingRef.current, () => {
          dynamicFrameRef.current.forceSignature = '';
        });
        clearGroup(dynamicGroup);

        dynamicPickups.forEach((pickup) => addPickup(dynamicGroup, liveConfig, pickup, isSelectionActive('pickup', pickup.id, latest.selected, latest.multiSelected), state.time || 0));

        state.bullets.forEach((bullet) => addBullet(dynamicGroup, liveConfig, bullet));
        state.particles.forEach((particle, index) => addParticle(dynamicGroup, liveConfig, particle, index));

        dynamicHeroes.forEach((hero) => {
          addActor(dynamicGroup, liveConfig, hero, {
            type: 'hero',
            id: hero.id,
            radius: PLAYER_RADIUS,
            preset: getCharacterPreset(getHeroCharacterId(hero), 'runner'),
            selected: isSelectionActive('hero', hero.id, latest.selected, latest.multiSelected),
            active: false,
            imageData: hero.characterImageData,
            renderMode: getCharacterRenderMode(hero),
            modelScale: getCharacterModelScale(hero),
            animationTime: (state.time || timestamp * 0.001) + Math.abs(hashString(hero.id || 'hero')) * 0.001,
            aimTarget: playMode ? state.player : liveConfig.player,
            getTexture,
            getModel,
            useStoredRotation: true,
            supportHeight: getActorSupportHeight(hero),
          });
        });

        dynamicEnemies.forEach((enemy) => {
          const enemyPreset = getCharacterPreset(getEnemyCharacterId(enemy), 'guard');
          const aimTarget = playMode ? state.player : liveConfig.player;
          addActor(dynamicGroup, liveConfig, enemy, {
            type: 'enemy',
            id: enemy.id,
            radius: ENEMY_RADIUS,
            preset: enemyPreset,
            selected: isSelectionActive('enemy', enemy.id, latest.selected, latest.multiSelected),
            active: Boolean(enemy.alert),
            imageData: enemy.characterImageData,
            renderMode: getCharacterRenderMode(enemy),
            modelScale: getCharacterModelScale(enemy),
            animationTime: (state.time || timestamp * 0.001) + Math.abs(hashString(enemy.id || 'enemy')) * 0.001,
            aimTarget,
            getTexture,
            getModel,
            useStoredRotation: !playMode,
            supportHeight: getActorSupportHeight(enemy),
          });
        });

        if (playMode) {
          const pointerTarget = aimPointRef.current || state.player?.moveTarget || {
            x: liveConfig.player.x + 1,
            y: liveConfig.player.y,
          };
          addActor(dynamicGroup, liveConfig, player, {
            type: 'spawn',
            id: 'player',
            radius: PLAYER_RADIUS,
            preset: getCharacterPreset(liveConfig.player.character || 'runner', 'runner'),
            selected: false,
            active: player.dash > 0,
            imageData: liveConfig.player.characterImageData,
            renderMode: getCharacterRenderMode(liveConfig.player),
            modelScale: getCharacterModelScale(liveConfig.player),
            animationTime: state.time || timestamp * 0.001,
            aimTarget: pointerTarget,
            getTexture,
            getModel,
            supportHeight: getActorSupportHeight(player),
          });
        }
      }

      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(frameId);
      detachCameraControls();
      controls.dispose();
      clearGroup(staticGroup);
      clearGroup(selectionGroup);
      clearGroup(dynamicGroup);
      textureCacheRef.current.forEach((texture) => texture.dispose());
      textureCacheRef.current.clear();
      modelCacheRef.current.forEach((object) => disposeObject(object));
      modelCacheRef.current.clear();
      modelPendingRef.current.clear();
      scene.environment = null;
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
      rendererRef.current = null;
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      staticGroupRef.current = null;
      selectionGroupRef.current = null;
      dynamicGroupRef.current = null;
    };
  }, [configRef, stateRef]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const scene = sceneRef.current;
    const staticGroup = staticGroupRef.current;
    if (!scene || !staticGroup || !liveConfig) return;
    const engine = getEngine(liveConfig);
    const getTexture = createCachedTextureGetter(textureCacheRef.current);
    const getModel = createCachedModelGetter(modelCacheRef.current, modelPendingRef.current, () => {
      setStaticAssetVersion((version) => version + 1);
    });
    clearGroup(staticGroup);

    const floorTexture = createFloorTexture();
    floorTexture.repeat.set(
      Math.max(1, liveConfig.world.width / Math.max(240, liveConfig.world.grid * 2)),
      Math.max(1, liveConfig.world.height / Math.max(240, liveConfig.world.grid * 2)),
    );
    const floorMaterial = new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.92,
      metalness: 0,
      emissive: '#071016',
      emissiveIntensity: 0.08,
    });
    floorMaterial.userData.disposeTextures = true;
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(liveConfig.world.width * WORLD_SCALE, liveConfig.world.height * WORLD_SCALE),
      floorMaterial,
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.userData.ground = true;
    groundRef.current = floor;
    staticGroup.add(floor);

    const gridSize = Math.max(liveConfig.world.width, liveConfig.world.height) * WORLD_SCALE;
    const grid = new THREE.GridHelper(
      gridSize,
      Math.max(8, Math.round(Math.max(liveConfig.world.width, liveConfig.world.height) / liveConfig.world.grid)),
      '#67e8f9',
      '#314052',
    );
    grid.material.transparent = true;
    grid.material.opacity = 0.42;
    grid.position.y = 0.018;
    staticGroup.add(grid);

    liveConfig.obstacles.forEach((obstacle) => {
      addWall(staticGroup, liveConfig, obstacle, engine, false);
    });

    (liveConfig.reliefs || []).forEach((relief) => {
      addRelief(staticGroup, liveConfig, relief, engine, false);
    });

    (liveConfig.actionZones || []).forEach((zone) => {
      addActionZone(staticGroup, liveConfig, zone, { playMode: mode === 'play' });
    });

    liveConfig.props.forEach((prop) => {
      const studioTexture = prop.decorModel3dId && !prop.imageData
        ? studioDecorTextureById.get(prop.decorModel3dId)
        : null;
      const renderedProp = studioTexture ? { ...prop, ...studioTexture } : prop;
      addProp(
        staticGroup,
        liveConfig,
        renderedProp,
        engine,
        false,
        getTexture,
        getModel,
      );
    });
    dynamicFrameRef.current.signature = '';
    dynamicFrameRef.current.forceSignature = '';
  }, [configRef, mode, staticAssetVersion, staticSceneSignature, studioDecorTextureById]);

  useEffect(() => {
    const liveConfig = configRef.current || config;
    const selectionGroup = selectionGroupRef.current;
    if (!selectionGroup || !liveConfig) return;
    clearGroup(selectionGroup);
    addStaticSelectionOverlays(selectionGroup, liveConfig, selected, multiSelected);
  }, [configRef, selectionOverlaySignature]);

  useEffect(() => {
    const activeKey = getEntityKey(placementEntity);
    if (activeKey && placementPreviewRef.current?.key === activeKey) return;
    resetDragPreview(placementPreviewRef.current);
    placementPreviewRef.current = null;
  }, [placementEntity, resetDragPreview]);

  const handlePointerMove = useCallback((event) => {
    const resolved = resolvePointer(event);
    const screenPoint = resolved || getScreenPoint(event);
    if (!resolved && !screenPoint) return;
    if (resolved) {
      aimPointRef.current = resolved.point;
      latestRef.current.onWorldPointer?.({
        x: resolved.point.x,
        y: resolved.point.y,
        screenX: resolved.screenX,
        screenY: resolved.screenY,
      });
      if (latestRef.current.placementEntity && latestRef.current.mode !== 'play') {
        applyPlacementPreview(latestRef.current.placementEntity, resolved.point);
      }
    }
    if (marqueeRef.current && screenPoint) {
      event.preventDefault();
      marqueeRef.current.currentX = screenPoint.screenX;
      marqueeRef.current.currentY = screenPoint.screenY;
      setMarqueeRect(normalizeScreenRect(marqueeRef.current));
      return;
    }
    if (dragRef.current) {
      event.preventDefault();
      const drag = dragRef.current;
      const point = {
        x: resolved.point.x - drag.offsetX,
        y: resolved.point.y - drag.offsetY,
      };
      applyDragPreview(drag, point);
      latestRef.current.onWorldDrag?.(drag.entity, point);
    }
  }, [applyDragPreview, applyPlacementPreview, getScreenPoint, resolvePointer]);

  const handlePointerDown = useCallback((event) => {
    const resolved = resolvePointer(event, { pickEntity: true });
    const screenPoint = resolved || getScreenPoint(event);
    if (resolved) {
      aimPointRef.current = resolved.point;
      latestRef.current.onWorldPointer?.({
        x: resolved.point.x,
        y: resolved.point.y,
        screenX: resolved.screenX,
        screenY: resolved.screenY,
      });
    }
    if (event.button === 0) {
      clickStartRef.current = resolved ? {
        x: event.clientX,
        y: event.clientY,
        point: resolved.point,
        entity: resolved.entity,
      } : null;
    }
    if (event.button === 2) {
      event.preventDefault();
      latestRef.current.onShootChange?.(true);
      return;
    }
    if (event.button !== 0 || !resolved) return;
    if (latestRef.current.mode === 'play') {
      latestRef.current.onWorldClick?.(resolved.point, resolved.entity, event.button);
      return;
    }
    if (latestRef.current.placementEntity) {
      event.preventDefault();
      return;
    }
    if (latestRef.current.cameraTargetPickMode) {
      event.preventDefault();
      clickStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        point: resolved.point,
        entity: resolved.entity,
        cameraTargetPick: true,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (latestRef.current.dragEnabled && isDraggableEntity(resolved.entity)) {
      event.preventDefault();
      const position = findSelectedPosition(configRef.current || latestRef.current.config, resolved.entity) || resolved.point;
      dragRef.current = {
        entity: resolved.entity,
        anchor: position,
        offsetX: resolved.point.x - position.x,
        offsetY: resolved.point.y - position.y,
        previewTargets: createDragPreviewTargets(resolved.entity),
      };
      clickStartRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      latestRef.current.onWorldDragStart?.(resolved.entity);
      return;
    }
    if (latestRef.current.multiSelectMode && latestRef.current.mode === 'edit' && screenPoint) {
      event.preventDefault();
      marqueeRef.current = {
        startX: screenPoint.screenX,
        startY: screenPoint.screenY,
        currentX: screenPoint.screenX,
        currentY: screenPoint.screenY,
      };
      setMarqueeRect(normalizeScreenRect(marqueeRef.current));
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }, [configRef, createDragPreviewTargets, getScreenPoint, resolvePointer]);

  const handlePointerUp = useCallback((event) => {
    if (event.button === 0 && clickStartRef.current?.cameraTargetPick) {
      const start = clickStartRef.current;
      clickStartRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (movement < 6 && isCameraTargetEntity(start.entity)) {
        const success = setCameraTargetFromEntity(start.entity);
        latestRef.current.onCameraTargetPick?.(start.entity, success);
      } else {
        latestRef.current.onCameraTargetPick?.(null, false);
      }
      return;
    }
    if (event.button === 0 && dragRef.current) {
      const drag = dragRef.current;
      const resolved = resolvePointer(event);
      dragRef.current = null;
      if (resolved) {
        const point = {
          x: resolved.point.x - drag.offsetX,
          y: resolved.point.y - drag.offsetY,
        };
        latestRef.current.onWorldDrop?.(drag.entity, point);
      } else {
        resetDragPreview(drag);
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && marqueeRef.current) {
      const screenPoint = getScreenPoint(event);
      if (screenPoint) {
        marqueeRef.current.currentX = screenPoint.screenX;
        marqueeRef.current.currentY = screenPoint.screenY;
      }
      const rect = normalizeScreenRect(marqueeRef.current);
      const start = clickStartRef.current;
      const movement = Math.hypot(
        marqueeRef.current.currentX - marqueeRef.current.startX,
        marqueeRef.current.currentY - marqueeRef.current.startY,
      );
      marqueeRef.current = null;
      setMarqueeRect(null);
      clickStartRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (movement >= 6) {
        latestRef.current.onMarqueeSelect?.(getEntitiesInMarquee(rect));
      } else if (start && latestRef.current.mode !== 'play') {
        latestRef.current.onWorldClick?.(start.point, start.entity, event.button);
      }
      return;
    }
    if (event.button === 0) {
      const start = clickStartRef.current;
      clickStartRef.current = null;
      if (start && latestRef.current.mode !== 'play') {
        const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (movement < 6) latestRef.current.onWorldClick?.(start.point, start.entity, event.button);
      }
    }
    if (event.button === 2) latestRef.current.onShootChange?.(false);
  }, [getEntitiesInMarquee, getScreenPoint, resetDragPreview, resolvePointer, setCameraTargetFromEntity]);

  return (
    <div
      ref={containerRef}
      className={[
        'arcade-three-viewport',
        dragEnabled && mode !== 'play' ? 'drag-enabled' : '',
        cameraTargetPickMode && mode !== 'play' ? 'camera-target-pick-enabled' : '',
        placementEntity && mode !== 'play' ? 'placement-enabled' : '',
      ].filter(Boolean).join(' ')}
      role="application"
      aria-label="Editeur RPG 3D WebGL"
      tabIndex={0}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={() => {
        if (marqueeRef.current) return;
        clickStartRef.current = null;
        if (!dragRef.current) latestRef.current.onShootChange?.(false);
      }}
      onPointerCancel={(event) => {
        clickStartRef.current = null;
        if (marqueeRef.current) {
          marqueeRef.current = null;
          setMarqueeRect(null);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        if (dragRef.current) {
          resetDragPreview(dragRef.current);
          dragRef.current = null;
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }
        latestRef.current.onShootChange?.(false);
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {webglError ? (
        <div className="arcade-three-fallback" role="status">{webglError}</div>
      ) : null}
      {marqueeRect && marqueeRect.width + marqueeRect.height > 2 ? (
        <div
          className="arcade-three-marquee"
          aria-hidden="true"
          style={{
            left: `${marqueeRect.left}px`,
            top: `${marqueeRect.top}px`,
            width: `${marqueeRect.width}px`,
            height: `${marqueeRect.height}px`,
          }}
        />
      ) : null}
      <div className="arcade-three-badge">WebGL 3D</div>
    </div>
  );
}

export default ArcadeThreeViewport;
