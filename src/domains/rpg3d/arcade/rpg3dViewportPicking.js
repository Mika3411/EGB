import {
  BoxGeometry as ThreeBoxGeometry,
  DoubleSide as ThreeDoubleSide,
  EdgesGeometry as ThreeEdgesGeometry,
  Euler as ThreeEuler,
  Group as ThreeGroup,
  LineBasicMaterial as ThreeLineBasicMaterial,
  LineSegments as ThreeLineSegments,
  Mesh as ThreeMesh,
  MeshBasicMaterial as ThreeMeshBasicMaterial,
  TorusGeometry as ThreeTorusGeometry,
  Vector3 as ThreeVector3,
} from 'three';
import {
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  clamp,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneWidth,
  getCharacterModelAxisScale,
  getCharacterModelScale,
  getDecorModelScale as getPropModelScale,
  getPropHeight,
  getPropModelHeight,
  getPropRenderMode,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  isFlatTileLikeProp,
  normalizeModelRotation as normalizeModelRotationDegrees,
} from '../../../shared/utils/rpg3dDomain.js';
import {
  DEFAULT_ENGINE,
  ENEMY_RADIUS,
  WORLD_SCALE,
  degreesToRadians,
  getEngine,
  getEntityLiftHeight,
  getFlatTileSceneDimensions,
  getFlatTileSurfaceHeight,
  getSupportSurfaceHeightAtPoint,
  toScenePosition,
} from './rpg3dSceneBuilders.js';
import { resolveProportionalScaleDelta } from '../../../shared/utils/rpg3dMapEditing.js';

const DYNAMIC_SELECTION_TYPES = new Set(['hero', 'enemy', 'pickup']);
const TRANSFORM_ROTATE_TYPES = new Set(['hero', 'enemy', 'prop']);
const TRANSFORM_SCALE_TYPES = new Set(['hero', 'enemy', 'prop', 'relief', 'obstacle', 'actionZone']);

const getSingleTransformSelection = (selected, multiSelected = []) => {
  const selection = Array.isArray(multiSelected) && multiSelected.length ? multiSelected : selected ? [selected] : [];
  return selection.length === 1 ? selection[0] : null;
};

const getTransformDescriptor = (config = {}, selected, multiSelected = [], transformMode = '') => {
  const entity = getSingleTransformSelection(selected, multiSelected);
  if (!entity?.type || !entity.id || !config?.world) return null;
  if (transformMode === 'rotate' && !TRANSFORM_ROTATE_TYPES.has(entity.type)) return null;
  if (transformMode === 'scale' && !TRANSFORM_SCALE_TYPES.has(entity.type)) return null;
  const item = getMapEntityItem(config, entity);
  if (!item) return null;
  const engine = getEngine(config);
  const baseRotation = new ThreeEuler(0, degreesToRadians(item.rotation || 0), 0);
  const minimumSize = 0.42;
  const descriptor = {
    entity,
    rotation: baseRotation,
    center: toScenePosition(config, Number(item.x) || 0, Number(item.y) || 0, 0.65),
    dimensions: new ThreeVector3(minimumSize, minimumSize, minimumSize),
    radius: 0.72,
  };

  if (entity.type === 'hero' || entity.type === 'enemy') {
    const radius = (entity.type === 'enemy' ? ENEMY_RADIUS : PLAYER_RADIUS) * WORLD_SCALE;
    const axisScale = getCharacterModelAxisScale(item);
    const scale = getCharacterModelScale(item);
    const height = 1.18 * scale;
    const supportHeight = getSupportSurfaceHeightAtPoint(config, item);
    descriptor.center = toScenePosition(config, item.x, item.y, supportHeight + getEntityLiftHeight(item) + height / 2);
    descriptor.dimensions.set(
      Math.max(minimumSize, radius * 2.8 * axisScale.x),
      Math.max(minimumSize, height),
      Math.max(minimumSize, radius * 2.8 * axisScale.z),
    );
  } else if (entity.type === 'obstacle') {
    const width = Math.max(0.2, getPropWidth(item) * WORLD_SCALE);
    const depth = Math.max(0.2, getPropHeight(item) * WORLD_SCALE);
    const height = Math.max(0.4, Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight);
    descriptor.center = toScenePosition(config, (Number(item.x) || 0) + getPropWidth(item) / 2, (Number(item.y) || 0) + getPropHeight(item) / 2, getEntityLiftHeight(item) + height / 2);
    descriptor.dimensions.set(width, height, depth);
  } else if (entity.type === 'relief') {
    const width = Math.max(0.2, getReliefWidth(item) * WORLD_SCALE);
    const depth = Math.max(0.2, getReliefHeight(item) * WORLD_SCALE);
    const elevation = getReliefElevation(item);
    const height = Math.max(0.08, Math.abs(elevation) * WORLD_SCALE * (Number(engine.reliefScale) || 1));
    descriptor.center = toScenePosition(config, item.x, item.y, elevation >= 0 ? height / 2 : 0.04);
    descriptor.dimensions.set(width, Math.max(minimumSize, height), depth);
  } else if (entity.type === 'actionZone') {
    const width = Math.max(0.24, getActionZoneWidth(item) * WORLD_SCALE);
    const depth = Math.max(0.24, getActionZoneHeight(item) * WORLD_SCALE);
    const height = Math.max(0.24, getActionZoneModelHeight(item) * WORLD_SCALE);
    descriptor.center = toScenePosition(config, item.x, item.y, height / 2);
    descriptor.dimensions.set(width, height, depth);
  } else if (entity.type === 'prop') {
    const renderMode = getPropRenderMode(item);
    const modelScale = renderMode === 'glb' ? getPropModelScale(item) : 1;
    const width = Math.max(0.24, getPropWidth(item) * WORLD_SCALE * modelScale);
    const depth = Math.max(0.24, getPropHeight(item) * WORLD_SCALE * modelScale);
    const propHeight = Math.max(0.08, getPropModelHeight(item) * WORLD_SCALE * (Number(engine.propHeight) || 1) * modelScale);
    const lift = getEntityLiftHeight(item);
    if (isFlatTileLikeProp(item)) {
      const tileSize = getFlatTileSceneDimensions(item, width, depth);
      descriptor.center = toScenePosition(config, item.x, item.y, getFlatTileSurfaceHeight(item) + 0.05);
      descriptor.dimensions.set(tileSize.width, Math.max(0.12, propHeight), tileSize.depth);
    } else {
      descriptor.center = toScenePosition(config, item.x, item.y, lift + propHeight / 2);
      descriptor.dimensions.set(width, Math.max(minimumSize, propHeight), depth);
    }
    descriptor.rotation.set(
      renderMode === 'glb' ? degreesToRadians(normalizeModelRotationDegrees(item.modelRotationX || 0)) : 0,
      degreesToRadians(item.rotation || 0),
      renderMode === 'glb' ? degreesToRadians(normalizeModelRotationDegrees(item.modelRotationZ || 0)) : 0,
    );
  }

  descriptor.radius = Math.max(
    minimumSize,
    descriptor.dimensions.x,
    descriptor.dimensions.y,
    descriptor.dimensions.z,
  ) * 0.72;
  descriptor.controlSize = clamp(descriptor.radius * 0.42, 0.45, 1.25);
  return descriptor;
};

const createTransformGuide = (descriptor, mode) => {
  const guide = new ThreeGroup();
  const dimensions = descriptor?.dimensions || new ThreeVector3(0.6, 0.6, 0.6);
  if (mode === 'scale') {
    const geometry = new ThreeBoxGeometry(
      Math.max(0.18, dimensions.x),
      Math.max(0.18, dimensions.y),
      Math.max(0.18, dimensions.z),
    );
    const edges = new ThreeLineSegments(
      new ThreeEdgesGeometry(geometry),
      new ThreeLineBasicMaterial({
        color: '#f8fbff',
        transparent: true,
        opacity: 0.86,
        depthTest: false,
      }),
    );
    edges.renderOrder = 92;
    guide.add(edges);
    return guide;
  }

  const radius = clamp(Number(descriptor?.radius) || 0.72, 0.38, 1.45);
  const tube = clamp(radius * 0.018, 0.006, 0.016);
  const ringMaterial = (color) => new ThreeMeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.72,
    depthTest: false,
    side: ThreeDoubleSide,
  });
  [
    { color: '#ef4444', rotation: [0, Math.PI / 2, 0] },
    { color: '#22c55e', rotation: [Math.PI / 2, 0, 0] },
    { color: '#3b82f6', rotation: [0, 0, 0] },
  ].forEach((ring) => {
    const mesh = new ThreeMesh(
      new ThreeTorusGeometry(radius, tube, 8, 80),
      ringMaterial(ring.color),
    );
    mesh.rotation.set(ring.rotation[0], ring.rotation[1], ring.rotation[2]);
    mesh.renderOrder = 92;
    guide.add(mesh);
  });
  return guide;
};

const getTransformPreviewRoots = (roots = [], descriptor = {}) => {
  const center = descriptor?.center;
  const maxDistance = Math.max(0.8, (Number(descriptor?.radius) || 0.8) + 0.55);
  return roots
    .filter((root) => root && center && root.position.distanceTo(center) <= maxDistance)
    .map((root) => ({
      root,
      position: root.position.clone(),
      quaternion: root.quaternion.clone(),
      scale: root.scale.clone(),
    }));
};

const applyTransformPreview = (session, proxy) => {
  if (!session || !proxy || !Array.isArray(session.previewRoots)) return;
  if (session.mode === 'rotate') {
    const deltaQuaternion = proxy.quaternion.clone().multiply(session.startProxyQuaternion.clone().invert());
    session.previewRoots.forEach(({ root, quaternion }) => {
      root.quaternion.copy(deltaQuaternion).multiply(quaternion);
    });
    return;
  }
  if (session.mode === 'scale') {
    const scaleRatio = resolveProportionalScaleDelta({
      x: proxy.scale.x / Math.max(0.001, session.startProxyScale.x),
      y: proxy.scale.y / Math.max(0.001, session.startProxyScale.y),
      z: proxy.scale.z / Math.max(0.001, session.startProxyScale.z),
    }, session.proportionalAxes);
    session.previewRoots.forEach(({ root, scale }) => {
      root.scale.set(
        scale.x * scaleRatio.x,
        scale.y * scaleRatio.y,
        scale.z * scaleRatio.z,
      );
    });
  }
};

const resetTransformPreview = (session) => {
  if (!session || !Array.isArray(session.previewRoots)) return;
  session.previewRoots.forEach(({ root, position, quaternion, scale }) => {
    if (!root?.parent) return;
    root.position.copy(position);
    root.quaternion.copy(quaternion);
    root.scale.copy(scale);
  });
};


const getMapEntityItem = (config, selected) => {
  if (!selected || !config) return null;
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
  ['prop', 'hero', 'enemy', 'pickup', 'relief', 'obstacle', 'actionZone'].includes(entity.type)
);
const isCameraTargetEntity = (entity = {}) => (
  ['prop', 'hero', 'enemy', 'pickup', 'relief', 'obstacle', 'actionZone'].includes(entity.type)
);
const getCameraTargetPoint = (config, entity, engine = DEFAULT_ENGINE) => {
  if (!config || !isCameraTargetEntity(entity)) return null;
  const item = getMapEntityItem(config, entity);
  const position = findSelectedPosition(config, entity);
  if (!item || !position) return null;
  if (entity.type === 'hero' || entity.type === 'enemy') {
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

export {
  DYNAMIC_SELECTION_TYPES,
  applyTransformPreview,
  createTransformGuide,
  createWorldBoxPoints,
  findSelectedPosition,
  getCameraTargetPoint,
  getMapEntityItem,
  getProjectedBounds,
  getSingleTransformSelection,
  getTransformDescriptor,
  getTransformPreviewRoots,
  isCameraTargetEntity,
  isDraggableEntity,
  isSameEntity,
  normalizeScreenRect,
  resetTransformPreview,
  screenRectsIntersect,
};
