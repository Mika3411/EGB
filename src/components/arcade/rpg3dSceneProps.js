import * as THREE from 'three';

import {
  clone as cloneGltfScene,
} from 'three/examples/jsm/utils/SkeletonUtils.js';

import {
  applyTextureToGltfModel,
  fitObjectToDimensions,
  getRuntimeModelPrepareOptions,
  playGltfAnimations,
  prepareGltfModel,
  snapObjectToGround,
} from '../../utils/threeGltfUtils';

import {
  MODEL_ERASER_RENDER_LIMIT,
  getDecorMaterialBrightness as getPropMaterialBrightness,
  getDecorModelScale as getPropModelScale,
  getFloorBaseColor,
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
  isFlatTileLikeProp,
  isFloorDecorKind,
} from '../../utils/rpg3dDomain.js';

import {
  hashString,
} from './rpg3dRuntimeModels.js';

import {
  addTileDuplicateHandles,
  alignObjectTopToGround,
  applyModelRotation,
  assignEntity,
  centerObjectHorizontallyOnOrigin,
  createSelectionEdges,
  createSelectionRing,
  createVisibleImagePlaneMaterial,
  DEFAULT_ENGINE,
  degreesToRadians,
  enableObjectShadows,
  getEntityLiftHeight,
  getFlatTileSceneDimensions,
  setTransformBase,
  toScenePosition,
  WORLD_SCALE,
} from './rpg3dSceneShared.js';

import {
  applyContinuousFloorUvs,
} from './rpg3dSceneTerrain.js';

const MODEL_ERASER_MAX_REMOVAL_RATIO = 0.72;

const RELIEF_STYLE_COLORS = {
  plateau: { top: '#7c5939', side: '#372217', emissive: '#20110a' },
  ridge: { top: '#766a56', side: '#2e2921', emissive: '#1a1712' },
  basin: { top: '#2f2119', side: '#17100c', emissive: '#0f0907' },
};

const applyPropModelOrientation = (root, prop = {}) => {
  root?.traverse?.((child) => {
    if (child.userData?.rpg3dPropModelOrientation) applyModelRotation(child, prop);
  });
};

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
  if (!strokes.length) return false;
  let didClip = false;
  instance?.traverse?.((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const meshSurfaceIndex = Number(child.userData?.rpg3dModelEraserSurfaceIndex);
    if (!Number.isFinite(meshSurfaceIndex)) return;
    const meshStrokes = strokes.filter((stroke) => Number(stroke.surfaceIndex) === meshSurfaceIndex);
    if (!meshStrokes.length) return;
    const clippedGeometry = clipGeometryWithModelEraser(child, meshStrokes);
    if (!clippedGeometry) return;
    const previousGeometry = child.geometry;
    child.geometry = clippedGeometry;
    if (child.userData.disposeGeometryWithInstance && previousGeometry && previousGeometry !== clippedGeometry) {
      previousGeometry.dispose?.();
    }
    child.userData.disposeGeometryWithInstance = true;
    didClip = true;
  });
  return didClip;
};

const GLTF_MATERIAL_TEXTURE_FIELDS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'emissiveMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
  'specularColorMap',
  'sheenColorMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'transmissionMap',
  'thicknessMap',
];

const objectHasMaterialTextureMaps = (object) => {
  let hasTexture = false;
  object?.traverse?.((child) => {
    if (hasTexture || (!child.isMesh && !child.isSkinnedMesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    hasTexture = materials
      .filter(Boolean)
      .some((material) => GLTF_MATERIAL_TEXTURE_FIELDS.some((field) => material[field]?.isTexture));
  });
  return hasTexture;
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
  if (texture && !objectHasMaterialTextureMaps(instance)) {
    applyTextureToGltfModel(instance, texture);
  }
  const modelScale = getPropModelScale(prop);
  fitObjectToDimensions(instance, {
    width: width * modelScale,
    height: propHeight * modelScale,
    depth: depth * modelScale,
  }, { groundY: 0 });
  enableObjectShadows(instance);
  const orientedGroup = new THREE.Group();
  orientedGroup.userData.rpg3dPropModelOrientation = true;
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
  const width = Math.max(0.2, (Number(obstacle.w) || 0) * WORLD_SCALE);
  const depth = Math.max(0.2, (Number(obstacle.h) || 0) * WORLD_SCALE);
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
  mesh.position.y = height / 2;

  const wallGroup = new THREE.Group();
  wallGroup.position.copy(toScenePosition(
    config,
    (Number(obstacle.x) || 0) + (Number(obstacle.w) || 0) / 2,
    (Number(obstacle.y) || 0) + (Number(obstacle.h) || 0) / 2,
    lift,
  ));
  setTransformBase(wallGroup, { width, height, depth });
  wallGroup.add(mesh);
  if (selected) {
    const edges = createSelectionEdges(geometry);
    edges.position.y = height / 2;
    wallGroup.add(edges);
  }
  assignEntity(wallGroup, { type: 'obstacle', id: obstacle.id });
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
  mesh.position.y = elevation >= 0 ? height / 2 : height * 0.1;

  const reliefGroup = new THREE.Group();
  reliefGroup.position.copy(toScenePosition(config, relief.x, relief.y, getEntityLiftHeight(relief)));
  setTransformBase(reliefGroup, { width, height, depth });
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
    marker.position.y = height + 0.06;
    reliefGroup.add(marker);
  }
  assignEntity(reliefGroup, { type: 'relief', id: relief.id });
  group.add(reliefGroup);
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
  visualGroup.userData.rpg3dPropModelOrientation = true;
  applyModelRotation(visualGroup, prop);
  const baseModelScale = renderMode === 'glb' ? getPropModelScale(prop) : 1;
  setTransformBase(propGroup, {
    width: width * baseModelScale,
    height: propHeight * baseModelScale,
    depth: depth * baseModelScale,
  });

  const texture = getTexture(prop.imageData, Boolean(prop.repeatTexture || renderMode === 'floor'));
  const modelSource = getPropModelSource(prop);
  const modelTemplate = renderMode === 'glb' ? getModel?.(modelSource, prop) : null;
  const modelLoadStatus = renderMode === 'glb' ? getModel?.getStatus?.(modelSource, prop) : '';
  const propAnimationMixers = [];
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
        propAnimationMixers.push(animation.mixer);
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
    const billboardHeight = Math.max(depth, propHeight);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(width, billboardHeight),
      createVisibleImagePlaneMaterial(texture),
    );
    mesh.position.y = billboardHeight / 2;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    visualGroup.add(mesh);
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
  if (propAnimationMixers.length) propGroup.userData.animationMixers = propAnimationMixers;
  group.add(propGroup);
};

const getObstacleSceneDimensions = (obstacle = {}, engine = DEFAULT_ENGINE) => ({
  width: Math.max(0.2, (Number(obstacle.w) || 0) * WORLD_SCALE),
  height: Math.max(0.4, Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight),
  depth: Math.max(0.2, (Number(obstacle.h) || 0) * WORLD_SCALE),
});

const getReliefSceneDimensions = (relief = {}, engine = DEFAULT_ENGINE) => ({
  width: Math.max(0.2, getReliefWidth(relief) * WORLD_SCALE),
  height: Math.max(0.08, Math.abs(getReliefElevation(relief)) * WORLD_SCALE * (Number(engine.reliefScale) || 1)),
  depth: Math.max(0.2, getReliefHeight(relief) * WORLD_SCALE),
});

const getPropSceneDimensions = (prop = {}, engine = DEFAULT_ENGINE) => {
  const renderMode = getPropRenderMode(prop);
  const modelScale = renderMode === 'glb' ? getPropModelScale(prop) : 1;
  return {
    width: Math.max(0.24, getPropWidth(prop) * WORLD_SCALE) * modelScale,
    height: Math.max(0.08, getPropModelHeight(prop) * WORLD_SCALE * (Number(engine.propHeight) || 1)) * modelScale,
    depth: Math.max(0.24, getPropHeight(prop) * WORLD_SCALE) * modelScale,
  };
};

export {
  MODEL_ERASER_MAX_REMOVAL_RATIO,
  RELIEF_STYLE_COLORS,
  applyPropModelOrientation,
  getModelEraserStrokeScenePoint,
  getModelEraserSceneStamps,
  getModelEraserVisualSignature,
  getMeshModelEraserStamps,
  applyModelEraserToMaterial,
  cloneMaterialForModelEraser,
  getTriangleMaterialIndex,
  getGeometryVertex,
  getTriangleCentroidDistanceToPoint,
  clipGeometryWithModelEraser,
  applyModelEraserToGltfModel,
  GLTF_MATERIAL_TEXTURE_FIELDS,
  objectHasMaterialTextureMaps,
  addGltfPropModel,
  createRockGeometry,
  addWall,
  addRelief,
  addProp,
  getObstacleSceneDimensions,
  getReliefSceneDimensions,
  getPropSceneDimensions,
};
