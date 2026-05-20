import * as THREE from 'three';
import { clone as cloneGltfScene } from 'three/examples/jsm/utils/SkeletonUtils.js';
import {
  applyObjectAxisScaleRatios,
  applyTextureToGltfModel,
  fitObjectToDimensions,
  fitObjectToHeight,
  getRuntimeModelPrepareOptions,
  hasThreeModelResources,
  playGltfAnimations,
  prepareGltfModel,
  snapObjectToGround,
} from '../../utils/threeGltfUtils';
import {
  DEFAULT_FLOOR_ZERO_Z,
  FLAT_GROUND_DEFAULT_COLOR,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  MODEL_ERASER_RENDER_LIMIT,
  clamp,
  getActionZoneColor,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneOpacity,
  getActionZoneRenderMode,
  getActionZoneType,
  getActionZoneWidth,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getCharacterModelScale,
  getDecorMaterialBrightness as getPropMaterialBrightness,
  getDecorModelScale as getPropModelScale,
  getEntityZ as getEntityLift,
  getFloorBaseColor,
  getFloorZeroZ,
  getHexColor,
  getModelEraserStrokeRadius,
  getModelEraserStrokes,
  getPropHeight,
  getPropModelHeight,
  getPropModelSource,
  getPropRenderMode,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  getTerrainPaintColor,
  getTerrainPaintOpacity,
  getTerrainPaintPoints,
  getTerrainPaintRadius,
  getTerrainPaintShape,
  isFlatTileLikeProp,
  isFloorDecorKind,
  normalizeModelRotation as normalizeModelRotationDegrees,
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

const WORLD_SCALE = 0.018;
const ENEMY_RADIUS = 16;
const TILE_DUPLICATE_HANDLE_SCALE = 2;
const SHADOW_CAMERA_PADDING = 12;
const SHADOW_CAMERA_MIN_EXTENT = 46;
const SHADOW_MAP_SIZE = 1024;
const EDIT_RENDER_PIXEL_RATIO_MAX = 1.15;
const PLAY_RENDER_PIXEL_RATIO_MAX = 1;
const EDIT_MODEL_ANIMATION_FRAME_MS = 125;
const FLOOR_VISUAL_PADDING_WORLD = 3600;
const MODEL_ERASER_MAX_REMOVAL_RATIO = 0.72;

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
const updateSceneLighting = (scene, engine = DEFAULT_ENGINE) => {
  if (!scene?.userData) return;
  const intensity = getLightIntensity(engine);
  const orientation = degreesToRadians(getLightOrientation(engine));
  const sunRadius = 36;
  if (scene.userData.hemi) scene.userData.hemi.intensity = intensity * 0.32;
  if (scene.userData.sun) {
    scene.userData.sun.intensity = intensity * 3.4;
    scene.userData.sun.position.set(
      Math.sin(orientation) * sunRadius,
      32,
      Math.cos(orientation) * sunRadius,
    );
    scene.userData.sun.target?.position.set(0, 0, 0);
    scene.userData.sun.target?.updateMatrixWorld();
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
const getEnemyCharacterId = (enemy = {}) => enemy.character || DEFAULT_ENEMY_CHARACTER_BY_ROLE[enemy.role] || 'guard';
const getHeroCharacterId = (hero = {}) => hero.character || 'runner';
const getCharacterPreset = (id = 'runner', fallbackId = 'runner') => (
  CHARACTER_PRESETS.find((preset) => preset.id === id)
  || CHARACTER_PRESETS.find((preset) => preset.id === fallbackId)
  || CHARACTER_PRESETS[0]
);
const getCharacterRenderMode = (actor = {}) => actor.characterRenderMode || 'capsule';

const toScenePosition = (config, x, y, height = 0) => new THREE.Vector3(
  (x - config.world.width / 2) * WORLD_SCALE,
  height,
  (y - config.world.height / 2) * WORLD_SCALE,
);

const fromScenePosition = (config, position) => ({
  x: clamp(position.x / WORLD_SCALE + config.world.width / 2, 0, config.world.width),
  y: clamp(position.z / WORLD_SCALE + config.world.height / 2, 0, config.world.height),
});

const getModelEraserStrokeScenePoint = (prop = {}, stroke = {}, config = {}) => {
  const localSceneX = Number(stroke.localSceneX);
  const localSceneY = Number(stroke.localSceneY);
  const localSceneZ = Number(stroke.localSceneZ);
  if (
    Number.isFinite(localSceneX)
    && Number.isFinite(localSceneY)
    && Number.isFinite(localSceneZ)
    && config?.world
  ) {
    const origin = toScenePosition(config, prop.x, prop.y, getEntityLiftHeight(prop));
    const rotation = degreesToRadians(prop.rotation || 0);
    const cos = Math.cos(rotation);
    const sin = Math.sin(rotation);
    return new THREE.Vector3(
      origin.x + localSceneX * cos + localSceneZ * sin,
      origin.y + localSceneY,
      origin.z - localSceneX * sin + localSceneZ * cos,
    );
  }
  const sceneX = Number(stroke.sceneX);
  const sceneY = Number(stroke.sceneY);
  const sceneZ = Number(stroke.sceneZ);
  if (Number.isFinite(sceneX) && Number.isFinite(sceneY) && Number.isFinite(sceneZ)) {
    return new THREE.Vector3(sceneX, sceneY, sceneZ);
  }
  return null;
};

const getModelEraserSceneStamps = (prop = {}, config = {}) => (
  getModelEraserStrokes(prop)
    .slice(-MODEL_ERASER_RENDER_LIMIT)
    .map((stroke) => {
      const surfaceIndex = Number(stroke.surfaceIndex);
      if (!Number.isFinite(surfaceIndex)) return null;
      const scenePoint = getModelEraserStrokeScenePoint(prop, stroke, config);
      if (!scenePoint) return null;
      const stamp = new THREE.Vector4(scenePoint.x, scenePoint.y, scenePoint.z, stroke.radius * WORLD_SCALE);
      stamp.surfaceIndex = Math.round(surfaceIndex);
      return stamp;
    })
    .filter(Boolean)
);

const getModelEraserVisualSignature = (prop = {}) => (
  getModelEraserStrokes(prop)
    .map((stroke) => {
      const sceneX = Number(stroke.sceneX);
      const sceneY = Number(stroke.sceneY);
      const sceneZ = Number(stroke.sceneZ);
      const localSceneX = Number(stroke.localSceneX);
      const localSceneY = Number(stroke.localSceneY);
      const localSceneZ = Number(stroke.localSceneZ);
      const localMeshX = Number(stroke.localMeshX);
      const localMeshY = Number(stroke.localMeshY);
      const localMeshZ = Number(stroke.localMeshZ);
      if (Number.isFinite(localMeshX) && Number.isFinite(localMeshY) && Number.isFinite(localMeshZ)) {
        return [
          stroke.id || '',
          'm',
          Math.round(Number(stroke.surfaceIndex) || -1),
          Math.round(Number(stroke.materialIndex) || -1),
          Math.round(localMeshX * 1000),
          Math.round(localMeshY * 1000),
          Math.round(localMeshZ * 1000),
          Math.round(stroke.radius),
        ].join(',');
      }
      if (Number.isFinite(localSceneX) && Number.isFinite(localSceneY) && Number.isFinite(localSceneZ)) {
        return [
          stroke.id || '',
          'p',
          Math.round(Number(stroke.surfaceIndex) || -1),
          Math.round(Number(stroke.materialIndex) || -1),
          Math.round((Number(stroke.uvX) || 0) * 1000),
          Math.round((Number(stroke.uvY) || 0) * 1000),
          Math.round(localSceneX * 1000),
          Math.round(localSceneY * 1000),
          Math.round(localSceneZ * 1000),
          Math.round(stroke.radius),
        ].join(',');
      }
      if (Number.isFinite(sceneX) && Number.isFinite(sceneY) && Number.isFinite(sceneZ)) {
        return [
          stroke.id || '',
          's',
          Math.round(Number(stroke.surfaceIndex) || -1),
          Math.round(Number(stroke.materialIndex) || -1),
          Math.round((Number(stroke.uvX) || 0) * 1000),
          Math.round((Number(stroke.uvY) || 0) * 1000),
          Math.round(sceneX * 1000),
          Math.round(sceneY * 1000),
          Math.round(sceneZ * 1000),
          Math.round(stroke.radius),
        ].join(',');
      }
      return [
        stroke.id || '',
        'l',
        Math.round((Number(stroke.localX) || 0) * 10),
        Math.round((Number(stroke.localY) || 0) * 10),
        Math.round(stroke.radius),
      ].join(',');
    })
    .join(';')
);

const getMeshModelEraserStamps = (mesh, stamps = []) => {
  if (!mesh || !stamps.length) return [];
  const meshSurfaceIndex = Number(mesh.userData?.rpg3dModelEraserSurfaceIndex);
  if (!Number.isFinite(meshSurfaceIndex)) return [];
  mesh.updateWorldMatrix?.(true, false);
  return stamps
    .map((stamp) => {
      if (Number(stamp.surfaceIndex) !== meshSurfaceIndex) return null;
      const localMeshX = Number(stamp.localMeshX);
      const localMeshY = Number(stamp.localMeshY);
      const localMeshZ = Number(stamp.localMeshZ);
      if (![localMeshX, localMeshY, localMeshZ].every(Number.isFinite)) return null;
      const point = mesh.localToWorld(new THREE.Vector3(localMeshX, localMeshY, localMeshZ));
      return new THREE.Vector4(point.x, point.y, point.z, getModelEraserStrokeRadius(stamp) * WORLD_SCALE);
    })
    .filter(Boolean);
};

const applyModelEraserToMaterial = (material, stamps = []) => {
  if (!material || !stamps.length) return;
  const previousOnBeforeCompile = material.onBeforeCompile;
  const previousProgramKey = material.customProgramCacheKey?.bind(material);
  const stampSignature = stamps
    .map((stamp) => `${stamp.x.toFixed(3)},${stamp.y.toFixed(3)},${stamp.z.toFixed(3)},${stamp.w.toFixed(3)}`)
    .join(';');

  material.onBeforeCompile = (shader, renderer) => {
    previousOnBeforeCompile?.(shader, renderer);
    if (!shader.vertexShader.includes('#include <common>')
      || !shader.vertexShader.includes('#include <worldpos_vertex>')
      || !shader.fragmentShader.includes('#include <common>')
      || !shader.fragmentShader.includes('#include <clipping_planes_fragment>')) {
      return;
    }
    shader.uniforms.rpg3dModelEraserCount = { value: stamps.length };
    shader.uniforms.rpg3dModelEraserStrokes = { value: stamps };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vRpg3dModelEraserWorldPosition;',
      )
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvRpg3dModelEraserWorldPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform int rpg3dModelEraserCount;
uniform vec4 rpg3dModelEraserStrokes[${MODEL_ERASER_RENDER_LIMIT}];
varying vec3 vRpg3dModelEraserWorldPosition;
void rpg3dApplyModelEraser() {
  for (int i = 0; i < ${MODEL_ERASER_RENDER_LIMIT}; i++) {
    if (i < rpg3dModelEraserCount) {
      vec4 stroke = rpg3dModelEraserStrokes[i];
      if (distance(vRpg3dModelEraserWorldPosition, stroke.xyz) <= stroke.w) discard;
    }
  }
}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        '#include <clipping_planes_fragment>\nrpg3dApplyModelEraser();',
      );
  };
  material.customProgramCacheKey = () => [
    previousProgramKey?.() || '',
    'rpg3d-model-eraser',
    MODEL_ERASER_RENDER_LIMIT,
    stampSignature,
  ].join('|');
  material.needsUpdate = true;
};

const cloneMaterialForModelEraser = (material) => {
  const clone = material?.clone?.() || material;
  if (!clone) return clone;
  clone.onBeforeCompile = () => {};
  delete clone.customProgramCacheKey;
  const { disposeTextures, ...sourceUserData } = material.userData || {};
  clone.userData = {
    ...sourceUserData,
    disposeWithInstance: true,
    rpg3dModelEraserMaterial: true,
  };
  clone.needsUpdate = true;
  return clone;
};

const getTriangleMaterialIndex = (geometry, triangleIndex) => {
  const indexOffset = triangleIndex * 3;
  const group = (geometry.groups || []).find((entry) => (
    indexOffset >= entry.start && indexOffset < entry.start + entry.count
  ));
  return Number.isFinite(Number(group?.materialIndex)) ? Number(group.materialIndex) : 0;
};

const getGeometryVertex = (geometry, vertexOffset, target) => {
  const position = geometry.getAttribute('position');
  const index = geometry.index;
  const vertexIndex = index ? index.getX(vertexOffset) : vertexOffset;
  return target.fromBufferAttribute(position, vertexIndex);
};

const getTriangleCentroidDistanceToPoint = (mesh, geometry, triangleIndex, point) => {
  const offset = triangleIndex * 3;
  const a = getGeometryVertex(geometry, offset, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  const b = getGeometryVertex(geometry, offset + 1, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  const c = getGeometryVertex(geometry, offset + 2, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
  return a.add(b).add(c).multiplyScalar(1 / 3).distanceTo(point);
};

const clipGeometryWithModelEraser = (mesh, strokes = []) => {
  const geometry = mesh?.geometry;
  const position = geometry?.getAttribute?.('position');
  if (!geometry || !position || !strokes.length) return null;
  const sourceIndex = geometry.index;
  const triangleCount = Math.floor((sourceIndex?.count || position.count) / 3);
  if (!triangleCount) return null;
  mesh.updateWorldMatrix?.(true, false);
  const erasers = strokes
    .map((stroke) => {
      const localMeshX = Number(stroke.localMeshX);
      const localMeshY = Number(stroke.localMeshY);
      const localMeshZ = Number(stroke.localMeshZ);
      const materialIndex = Number(stroke.materialIndex);
      if (![localMeshX, localMeshY, localMeshZ, materialIndex].every(Number.isFinite)) return null;
      return {
        materialIndex: Math.round(materialIndex),
        point: mesh.localToWorld(new THREE.Vector3(localMeshX, localMeshY, localMeshZ)),
        radius: getModelEraserStrokeRadius(stroke) * WORLD_SCALE,
      };
    })
    .filter(Boolean);
  if (!erasers.length) return null;

  const removedTriangles = new Set();
  let removed = 0;
  erasers.forEach((eraser) => {
    const candidates = [];
    for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
      if (removedTriangles.has(triangleIndex)) continue;
      const materialIndex = getTriangleMaterialIndex(geometry, triangleIndex);
      if (
        eraser.materialIndex === materialIndex
        && getTriangleCentroidDistanceToPoint(mesh, geometry, triangleIndex, eraser.point) <= eraser.radius
      ) {
        candidates.push(triangleIndex);
      }
    }
    const remaining = triangleCount - removed;
    if (
      !candidates.length
      || candidates.length >= remaining
      || candidates.length / remaining > MODEL_ERASER_MAX_REMOVAL_RATIO
    ) {
      return;
    }
    candidates.forEach((triangleIndex) => {
      removedTriangles.add(triangleIndex);
      removed += 1;
    });
  });
  if (!removed) return null;

  const keptIndices = [];
  const groups = [];
  let currentGroup = null;
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const materialIndex = getTriangleMaterialIndex(geometry, triangleIndex);
    if (removedTriangles.has(triangleIndex)) continue;
    const start = keptIndices.length;
    keptIndices.push(
      sourceIndex ? sourceIndex.getX(triangleIndex * 3) : triangleIndex * 3,
      sourceIndex ? sourceIndex.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1,
      sourceIndex ? sourceIndex.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2,
    );
    if (!currentGroup || currentGroup.materialIndex !== materialIndex) {
      currentGroup = { start, count: 3, materialIndex };
      groups.push(currentGroup);
    } else {
      currentGroup.count += 3;
    }
  }
  const clippedGeometry = geometry.clone();
  clippedGeometry.setIndex(keptIndices);
  clippedGeometry.clearGroups();
  groups.forEach((group) => clippedGeometry.addGroup(group.start, group.count, group.materialIndex));
  clippedGeometry.computeBoundingBox?.();
  clippedGeometry.computeBoundingSphere?.();
  return clippedGeometry;
};

const applyModelEraserToGltfModel = (instance, prop = {}, config = {}) => {
  const strokes = getModelEraserStrokes(prop).filter((stroke) => (
    Number.isFinite(Number(stroke.surfaceIndex))
    && Number.isFinite(Number(stroke.materialIndex))
    && Number.isFinite(Number(stroke.localMeshX))
    && Number.isFinite(Number(stroke.localMeshY))
    && Number.isFinite(Number(stroke.localMeshZ))
  ));
  if (!strokes.length) return;
  instance?.traverse?.((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const meshSurfaceIndex = Number(child.userData?.rpg3dModelEraserSurfaceIndex);
    if (!Number.isFinite(meshSurfaceIndex)) return;
    const meshStrokes = strokes.filter((stroke) => Number(stroke.surfaceIndex) === meshSurfaceIndex);
    if (!meshStrokes.length) return;
    const clippedGeometry = clipGeometryWithModelEraser(child, meshStrokes);
    if (!clippedGeometry) return;
    child.geometry = clippedGeometry;
    child.userData.disposeGeometryWithInstance = true;
  });
};

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
  group.remove(child);
  disposeObject(child);
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

const createTerrainPaintPolygonGeometry = (radiusWorld, shape) => {
  const points = shape === 'triangle'
    ? Array.from({ length: 3 }, (_, index) => {
      const angle = Math.PI / 2 + index * ((Math.PI * 2) / 3);
      return { x: Math.cos(angle) * radiusWorld, y: Math.sin(angle) * radiusWorld };
    })
    : [
      { x: -radiusWorld, y: -radiusWorld },
      { x: radiusWorld, y: -radiusWorld },
      { x: radiusWorld, y: radiusWorld },
      { x: -radiusWorld, y: radiusWorld },
    ];
  const path = new THREE.Shape();
  points.forEach((point, index) => {
    if (index === 0) path.moveTo(point.x, point.y);
    else path.lineTo(point.x, point.y);
  });
  path.closePath();
  return {
    fillGeometry: new THREE.ShapeGeometry(path),
    outlineGeometry: new THREE.BufferGeometry().setFromPoints(points.map((point) => new THREE.Vector3(point.x, point.y, 0))),
  };
};

const createTerrainPaintPreview = (
  radius = TERRAIN_PAINT_DEFAULT_RADIUS,
  color = TERRAIN_PAINT_DEFAULT_COLOR,
  shape = TERRAIN_PAINT_DEFAULT_SHAPE,
) => {
  const radiusWorld = Math.max(0.08, getTerrainPaintRadius({ radius }) * WORLD_SCALE);
  const previewColor = getHexColor(color, TERRAIN_PAINT_DEFAULT_COLOR);
  const previewShape = getTerrainPaintShape({ shape });
  const group = new THREE.Group();
  group.userData.previewRadius = radiusWorld;
  group.userData.previewColor = previewColor;
  group.userData.previewShape = previewShape;

  const fillMaterial = new THREE.MeshBasicMaterial({
    color: previewColor,
    transparent: true,
    opacity: 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });

  if (previewShape === 'round') {
    const fill = new THREE.Mesh(new THREE.CircleGeometry(radiusWorld, 64), fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.renderOrder = 90;
    group.add(fill);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radiusWorld * 0.96, radiusWorld * 1.02, 64),
      new THREE.MeshBasicMaterial({
        color: previewColor,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: true,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.002;
    ring.renderOrder = 91;
    group.add(ring);
  } else {
    const { fillGeometry, outlineGeometry } = createTerrainPaintPolygonGeometry(radiusWorld, previewShape);
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.rotation.x = -Math.PI / 2;
    fill.renderOrder = 90;
    group.add(fill);

    const outline = new THREE.LineLoop(outlineGeometry, new THREE.LineBasicMaterial({
      color: previewColor,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      depthTest: true,
    }));
    outline.rotation.x = -Math.PI / 2;
    outline.position.y = 0.002;
    outline.renderOrder = 91;
    group.add(outline);
  }

  return group;
};

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
  if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * Math.max(axisScale.x, axisScale.z), '#f8fbff'));
  return { mixer: animationController?.mixer || null, animationController };
};

const addGltfPropModel = (propGroup, template, prop, width, propHeight, depth, radius, selected, texture = null, config = null) => {
  const instance = cloneGltfScene(template);
  let surfaceIndex = 0;
  instance.traverse((child) => {
    child.userData.preserveSharedResources = true;
    if (child.isMesh || child.isSkinnedMesh) {
      child.userData.rpg3dModelEraserSurface = true;
      child.userData.rpg3dModelEraserSurfaceIndex = surfaceIndex;
      surfaceIndex += 1;
    }
  });
  prepareGltfModel(instance, getRuntimeModelPrepareOptions(template.userData?.modelFormat, {
    restoreTextureColor: true,
    forceLitMaterials: true,
    hasResourceTextures: Boolean(template.userData?.hasModelResources),
    cloneMaterials: true,
    materialBrightness: getPropMaterialBrightness(prop),
    maxEnvMapIntensity: isFloorDecorKind(prop.decorKind) ? 0.42 : 1,
    maxEmissiveIntensity: isFloorDecorKind(prop.decorKind) ? 0.03 : 0.18,
  }));
  applyTextureToGltfModel(instance, texture);
  const modelScale = getPropModelScale(prop);
  fitObjectToDimensions(instance, {
    width: width * modelScale,
    height: propHeight * modelScale,
    depth: depth * modelScale,
  }, { groundY: 0 });
  enableObjectShadows(instance);
  const orientedGroup = new THREE.Group();
  orientedGroup.add(instance);
  applyModelRotation(orientedGroup, prop);
  if (prop.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(orientedGroup);
  snapObjectToGround(orientedGroup, 0);
  if (prop.modelFlushToGround) alignObjectTopToGround(orientedGroup);
  propGroup.add(orientedGroup);
  propGroup.updateMatrixWorld(true);
  applyModelEraserToGltfModel(instance, prop, config);
  const clips = template.userData?.gltfAnimationClips || [];
  const mixer = playGltfAnimations(instance, clips, { timeOffset: Math.abs(hashString(prop.id || prop.name || 'prop')) * 0.001 });
  if (selected) propGroup.add(createSelectionRing(radius * modelScale, '#67e8f9'));
  return { mixer };
};

const FLOOR_TEXTURE_CONTINUITY_GAP_WORLD = 24;

const getFloorContinuityKey = (prop = {}) => {
  if (getPropRenderMode(prop) !== 'floor' || !prop.imageData) return '';
  return [
    getImageSignature(prop.imageData),
    prop.imageName || '',
    Math.round(normalizeModelRotationDegrees(prop.rotation || 0)),
    Math.round(getFloorZeroZ(prop) * 10),
  ].join(':');
};

const getFloorTileBounds = (prop = {}) => {
  const width = getPropWidth(prop);
  const height = getPropHeight(prop);
  const x = Number(prop.x) || 0;
  const y = Number(prop.y) || 0;
  return {
    prop,
    width,
    height,
    x,
    y,
    minX: x - width / 2,
    maxX: x + width / 2,
    minY: y - height / 2,
    maxY: y + height / 2,
  };
};

const getRangeGap = (minA, maxA, minB, maxB) => {
  if (maxA < minB) return minB - maxA;
  if (maxB < minA) return minA - maxB;
  return 0;
};

const getRangeOverlap = (minA, maxA, minB, maxB) => (
  Math.max(0, Math.min(maxA, maxB) - Math.max(minA, minB))
);

const areFloorTilesConnected = (left, right) => {
  const gapX = getRangeGap(left.minX, left.maxX, right.minX, right.maxX);
  const gapY = getRangeGap(left.minY, left.maxY, right.minY, right.maxY);
  const overlapX = getRangeOverlap(left.minX, left.maxX, right.minX, right.maxX);
  const overlapY = getRangeOverlap(left.minY, left.maxY, right.minY, right.maxY);
  return (
    gapX <= FLOOR_TEXTURE_CONTINUITY_GAP_WORLD && overlapY > 1
  ) || (
    gapY <= FLOOR_TEXTURE_CONTINUITY_GAP_WORLD && overlapX > 1
  );
};

const buildContinuousFloorUvMap = (props = []) => {
  const byKey = new Map();
  props.forEach((prop) => {
    const key = getFloorContinuityKey(prop);
    if (!key) return;
    const bounds = getFloorTileBounds(prop);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(bounds);
  });

  const uvMap = new Map();
  byKey.forEach((tiles) => {
    const remaining = new Set(tiles);
    while (remaining.size) {
      const first = remaining.values().next().value;
      remaining.delete(first);
      const component = [first];
      for (let index = 0; index < component.length; index += 1) {
        const current = component[index];
        [...remaining].forEach((candidate) => {
          if (!areFloorTilesConnected(current, candidate)) return;
          remaining.delete(candidate);
          component.push(candidate);
        });
      }
      if (component.length <= 1) continue;
      const groupBounds = component.reduce((bounds, tile) => ({
        minX: Math.min(bounds.minX, tile.minX),
        maxX: Math.max(bounds.maxX, tile.maxX),
        minY: Math.min(bounds.minY, tile.minY),
        maxY: Math.max(bounds.maxY, tile.maxY),
      }), {
        minX: component[0].minX,
        maxX: component[0].maxX,
        minY: component[0].minY,
        maxY: component[0].maxY,
      });
      const groupWidth = Math.max(1, groupBounds.maxX - groupBounds.minX);
      const groupHeight = Math.max(1, groupBounds.maxY - groupBounds.minY);
      component.forEach((tile) => {
        uvMap.set(tile.prop.id, {
          ...groupBounds,
          width: groupWidth,
          height: groupHeight,
          tileCenterX: tile.x,
          tileCenterY: tile.y,
        });
      });
    }
  });
  return uvMap;
};

const applyContinuousFloorUvs = (geometry, mapping = null) => {
  if (!geometry || !mapping) return geometry;
  const positions = geometry.attributes.position;
  const uvs = geometry.attributes.uv;
  if (!positions || !uvs) return geometry;
  for (let index = 0; index < positions.count; index += 1) {
    const worldX = mapping.tileCenterX + positions.getX(index) / WORLD_SCALE;
    const worldY = mapping.tileCenterY - positions.getY(index) / WORLD_SCALE;
    const u = clamp((worldX - mapping.minX) / mapping.width, 0, 1);
    const v = clamp(1 - ((worldY - mapping.minY) / mapping.height), 0, 1);
    uvs.setXY(index, u, v);
  }
  uvs.needsUpdate = true;
  return geometry;
};

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
].join(':');

const getEntityKey = (entity = {}) => (entity?.type && entity?.id ? `${entity.type}:${entity.id}` : '');

const isSelectionActive = (type, id, selected, multiSelected = []) => (
  (selected?.type === type && selected.id === id)
  || multiSelected.some((entry) => entry.type === type && entry.id === id)
);

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

const getTerrainPaintVisualSignature = (stroke = {}) => [
  stroke.id || '',
  getTerrainPaintColor(stroke),
  Math.round(getTerrainPaintRadius(stroke)),
  Math.round(getTerrainPaintOpacity(stroke) * 100),
  getTerrainPaintShape(stroke),
  getTerrainPaintPoints(stroke).map((point) => `${Math.round(point.x)},${Math.round(point.y)}`).join(';'),
].join(':');

const getTerrainPaintLayerSignature = (config = {}) => {
  const world = config.world || {};
  return [
    Number(world.width) || 0,
    Number(world.height) || 0,
    (config.terrainPaintStrokes || []).map(getTerrainPaintVisualSignature).join(';'),
  ].join('|');
};

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
  prop.decorKind || '',
  getPropModelScale(prop),
  prop.decorModel3dId || '',
  prop.decorModelName || '',
  getImageSignature(getPropModelSource(prop)),
  getModelResourcesSignature(prop),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationX || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationY || 0)),
  Math.round(normalizeModelRotationDegrees(prop.modelRotationZ || 0)),
  prop.modelCenterOnOrigin ? 1 : 0,
  prop.modelFlushToGround ? 1 : 0,
  getModelEraserVisualSignature(prop),
  prop.imageName || '',
  getImageSignature(prop.imageData),
  prop.repeatTexture ? 1 : 0,
  prop.baseColor || '',
  prop.floorColor || '',
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

const getCanvasRgba = (hexColor, opacity = 1) => {
  const color = new THREE.Color(getHexColor(hexColor, TERRAIN_PAINT_DEFAULT_COLOR));
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${clamp(opacity, 0, 1)})`;
};

const addTerrainBrushStampPath = (ctx, point, radius, shape) => {
  if (shape === 'square') {
    ctx.rect(point.x - radius, point.y - radius, radius * 2, radius * 2);
    return;
  }
  if (shape === 'triangle') {
    for (let index = 0; index < 3; index += 1) {
      const angle = -Math.PI / 2 + index * ((Math.PI * 2) / 3);
      const x = point.x + Math.cos(angle) * radius;
      const y = point.y + Math.sin(angle) * radius;
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    return;
  }
  ctx.moveTo(point.x + radius, point.y);
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
};

const drawTerrainPaintMask = (ctx, points, radius, shape, toCanvasPoint, style) => {
  ctx.fillStyle = style;
  ctx.strokeStyle = style;
  if (shape === 'round' && points.length > 1) {
    ctx.lineWidth = radius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    const start = toCanvasPoint(points[0]);
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    points.slice(1).forEach((point) => {
      const canvasPoint = toCanvasPoint(point);
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    });
    ctx.stroke();
    return;
  }

  const stampSpacing = Math.max(1, radius * 0.35);
  let previous = toCanvasPoint(points[0]);
  ctx.beginPath();
  addTerrainBrushStampPath(ctx, previous, radius, shape);
  points.slice(1).forEach((point) => {
    const current = toCanvasPoint(point);
    const distanceToPrevious = Math.hypot(current.x - previous.x, current.y - previous.y);
    const steps = Math.max(1, Math.ceil(distanceToPrevious / stampSpacing));
    for (let step = 1; step <= steps; step += 1) {
      const ratio = step / steps;
      addTerrainBrushStampPath(ctx, {
        x: previous.x + (current.x - previous.x) * ratio,
        y: previous.y + (current.y - previous.y) * ratio,
      }, radius, shape);
    }
    previous = current;
  });
  ctx.fill();
};

const drawTerrainPaintStroke = (ctx, config = {}, stroke = {}, scale = 1) => {
  const points = getTerrainPaintPoints(stroke);
  if (!points.length) return;
  const radius = Math.max(1, getTerrainPaintRadius(stroke) * scale);
  const shape = getTerrainPaintShape(stroke);
  const toCanvasPoint = (point) => ({
    x: point.x * scale,
    y: point.y * scale,
  });

  const width = ctx.canvas?.width || 0;
  const height = ctx.canvas?.height || 0;
  if (!width || !height) return;

  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  drawTerrainPaintMask(ctx, points, radius, shape, toCanvasPoint, '#000000');
  ctx.globalCompositeOperation = 'source-over';
  drawTerrainPaintMask(
    ctx,
    points,
    radius,
    shape,
    toCanvasPoint,
    getCanvasRgba(getTerrainPaintColor(stroke), getTerrainPaintOpacity(stroke)),
  );
  ctx.restore();
};

const createTerrainPaintTexture = (config = {}) => {
  const strokes = (config.terrainPaintStrokes || []).filter((stroke) => getTerrainPaintPoints(stroke).length);
  if (!strokes.length) return null;
  const worldWidth = Math.max(1, Number(config.world?.width) || 1);
  const worldHeight = Math.max(1, Number(config.world?.height) || 1);
  const maxCanvasSide = 1536;
  const scale = maxCanvasSide / Math.max(worldWidth, worldHeight);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(64, Math.round(worldWidth * scale));
  canvas.height = Math.max(64, Math.round(worldHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  strokes.forEach((stroke) => drawTerrainPaintStroke(ctx, config, stroke, scale));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
};

const addTerrainPaintLayer = (group, config = {}) => {
  const texture = createTerrainPaintTexture(config);
  if (!texture) return;
  const width = Math.max(1, Number(config.world?.width) || 1) * WORLD_SCALE;
  const depth = Math.max(1, Number(config.world?.height) || 1) * WORLD_SCALE;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity: 1,
    side: THREE.DoubleSide,
    depthWrite: false,
    depthTest: true,
  });
  material.userData.disposeTextures = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.065;
  mesh.renderOrder = 18;
  group.add(mesh);
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
  const modelTemplate = renderMode === 'glb' ? getModel?.(modelSource, prop) : null;
  const modelLoadStatus = renderMode === 'glb' ? getModel?.getStatus?.(modelSource, prop) : '';
  const textureMaterial = (fallbackColor, options = {}) => new THREE.MeshStandardMaterial({
    color: fallbackColor,
    map: texture || null,
    roughness: options.roughness ?? 0.72,
    metalness: options.metalness ?? 0.04,
    emissive: options.emissive || '#061721',
    emissiveIntensity: options.emissiveIntensity ?? 0.1,
  });
  const addLoadingFootprint = () => {
    const footprintGeometry = new THREE.PlaneGeometry(width, depth);
    const footprint = new THREE.Mesh(
      footprintGeometry,
      new THREE.MeshStandardMaterial({
        color: selected ? '#e0f7ff' : '#38bdf8',
        transparent: true,
        opacity: selected ? 0.22 : 0.08,
        roughness: 0.9,
        emissive: '#061721',
        emissiveIntensity: 0.06,
        depthWrite: false,
      }),
    );
    footprint.rotation.x = -Math.PI / 2;
    footprint.position.y = 0.045;
    visualGroup.add(footprint);
    if (selected) {
      const outline = createSelectionEdges(new THREE.BoxGeometry(width, 0.04, depth));
      outline.position.y = 0.07;
      visualGroup.add(outline);
    }
  };

  if (renderMode === 'glb') {
    if (modelTemplate) {
      const animation = addGltfPropModel(
        propGroup,
        modelTemplate,
        prop,
        width,
        propHeight,
        depth,
        Math.max(width, depth) * 0.56,
        selected,
        texture,
        config,
      );
      if (animation?.mixer) {
        if (!Array.isArray(group.userData.animationMixers)) group.userData.animationMixers = [];
        group.userData.animationMixers.push(animation.mixer);
      }
    } else if (modelSource && modelLoadStatus !== 'failed') {
      addLoadingFootprint();
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
    const material = textureMaterial(getFloorBaseColor(prop), { roughness: 0.88, emissiveIntensity: 0.04 });
    material.side = THREE.DoubleSide;
    const geometry = applyContinuousFloorUvs(new THREE.PlaneGeometry(width, depth), options.floorUv || null);
    const mesh = new THREE.Mesh(geometry, material);
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
    door.castShadow = true;
    door.receiveShadow = true;
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
    sprite.castShadow = true;
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
  const animationState = getActorAnimationState(actor);
  const skinnedBodyColor = selected ? '#f8fbff' : texture ? '#d8e5f5' : bodyColor;
  if (useStoredRotation) {
    actorGroup.rotation.y = degreesToRadians(actor.rotation || 0);
  } else if (aimTarget) {
    const aim = normalize((Number(aimTarget.x) || actor.x + 1) - actor.x, (Number(aimTarget.y) || actor.y) - actor.y);
    actorGroup.rotation.y = Math.atan2(aim.x, aim.y);
  } else {
    actorGroup.rotation.y = degreesToRadians(actor.rotation || 0);
  }

  const actorMaterial = (color, options = {}) => {
    const material = new THREE.MeshStandardMaterial({
      color: options.skin && texture ? '#ffffff' : color,
      map: options.skin && texture ? texture : null,
      roughness: options.roughness ?? 0.58,
      metalness: options.metalness ?? 0.04,
      emissive: options.emissive || preset.accent,
      emissiveIntensity: options.emissiveIntensity ?? (active ? 0.26 : 0.08),
    });
    material.color.multiplyScalar(actorBrightness);
    if (actorBrightness < 1 && material.emissiveIntensity) material.emissiveIntensity *= actorBrightness;
    return material;
  };

  const addTexturePanel = (width, panelHeight, y, z, opacity = 0.96) => {
    if (!texture) return;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(width, panelHeight),
      new THREE.MeshBasicMaterial({
        map: texture,
        color: new THREE.Color('#ffffff').multiplyScalar(actorBrightness),
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
      color: new THREE.Color('#ffffff').multiplyScalar(actorBrightness),
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
          getActorAnimationOptions(animationState),
        );
        if (animation?.mixer) {
          if (!Array.isArray(group.userData.animationMixers)) group.userData.animationMixers = [];
          group.userData.animationMixers.push(animation.mixer);
        }
      } catch {
        addFallbackActorBody('#facc15');
        if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * modelScale, '#f8fbff'));
      }
    }
    addEditVisibilityRing();
    assignEntity(actorGroup, { type, id });
    group.add(actorGroup);
    return;
  }

  if (renderMode === 'sprite' && texture) {
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: texture,
      color: new THREE.Color('#ffffff').multiplyScalar(actorBrightness),
      transparent: true,
      alphaTest: 0.08,
    }));
    sprite.scale.set(radius3d * 3.4 * modelScale, height * 1.18, 1);
    sprite.position.y = height * 0.58;
    sprite.castShadow = true;
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
  assignEntity(actorGroup, { type, id });
  group.add(actorGroup);
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
  DEFAULT_ENGINE,
  EDIT_MODEL_ANIMATION_FRAME_MS,
  EDIT_RENDER_PIXEL_RATIO_MAX,
  ENEMY_RADIUS,
  FLOOR_VISUAL_PADDING_WORLD,
  PLAY_RENDER_PIXEL_RATIO_MAX,
  SHADOW_CAMERA_MIN_EXTENT,
  SHADOW_MAP_SIZE,
  WORLD_SCALE,
  addActionZone,
  addActor,
  addBullet,
  addParticle,
  addPickup,
  addProp,
  addRelief,
  addStaticSelectionOverlays,
  addTerrainPaintLayer,
  addWall,
  buildContinuousFloorUvMap,
  clearGroup,
  configureSunShadowCamera,
  createFloorTexture,
  createSelectionRing,
  createSupportSurfaceHeightResolver,
  createTerrainPaintPreview,
  degreesToRadians,
  disposeObject,
  fromScenePosition,
  getActorVisualSignature,
  getCameraDistance,
  getCameraHeightForDistance,
  getCharacterPreset,
  getCharacterRenderMode,
  getEnemyCharacterId,
  getEngine,
  getEntityKey,
  getEntityLift,
  getEntityLiftHeight,
  getFlatTileSceneDimensions,
  getFlatTileSurfaceHeight,
  getHeroCharacterId,
  getSelectionOverlaySignature,
  getStaticSceneSignature,
  getTerrainPaintLayerSignature,
  getSupportSurfaceHeightAtPoint,
  isSelectionActive,
  readEntity,
  removeGroupChild,
  toScenePosition,
  updateDynamicTransforms,
  updateSceneLighting,
};
