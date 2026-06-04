import {
  BoxGeometry as ThreeBoxGeometry,
  BufferGeometry as ThreeBufferGeometry,
  DataTexture as ThreeDataTexture,
  DoubleSide as ThreeDoubleSide,
  EdgesGeometry as ThreeEdgesGeometry,
  Float32BufferAttribute as ThreeFloat32BufferAttribute,
  Group as ThreeGroup,
  LineBasicMaterial as ThreeLineBasicMaterial,
  LineLoop as ThreeLineLoop,
  LineSegments as ThreeLineSegments,
  LinearFilter as ThreeLinearFilter,
  Mesh as ThreeMesh,
  MeshBasicMaterial as ThreeMeshBasicMaterial,
  NearestFilter as ThreeNearestFilter,
  Points as ThreePoints,
  PointsMaterial as ThreePointsMaterial,
  ShapeUtils as ThreeShapeUtils,
  SphereGeometry as ThreeSphereGeometry,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
} from 'three';

import {
  clamp,
  getActionZoneColor,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneOpacity,
  getActionZoneRenderMode,
  getActionZoneTopVertices,
  getActionZoneType,
  getActionZoneVertices,
  getActionZoneWidth,
} from '../../../shared/utils/rpg3dDomain.js';

import {
  assignEntity,
  createSelectionEdges,
  createSelectionOverlayGroup,
  setTransformBase,
  toScenePosition,
  WORLD_SCALE,
} from './rpg3dSceneShared.js';

const createInvisibleActionZoneHitArea = (geometry) => new ThreeMesh(
  geometry,
  new ThreeMeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  }),
);

let actionZoneVertexHandleTexture = null;

const getActionZoneVertexHandleTexture = () => {
  if (actionZoneVertexHandleTexture) return actionZoneVertexHandleTexture;
  const size = 32;
  const data = new Uint8Array(size * size * 4);
  const rim = [15, 23, 42, 230];
  const fill = [254, 243, 199, 245];
  const outerMin = 7;
  const outerMax = 24;
  const innerMin = 10;
  const innerMax = 21;
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const offset = (y * size + x) * 4;
      const inOuter = x >= outerMin && x <= outerMax && y >= outerMin && y <= outerMax;
      const inInner = x >= innerMin && x <= innerMax && y >= innerMin && y <= innerMax;
      const color = inInner ? fill : inOuter ? rim : null;
      if (!color) continue;
      data[offset] = color[0];
      data[offset + 1] = color[1];
      data[offset + 2] = color[2];
      data[offset + 3] = color[3];
    }
  }
  actionZoneVertexHandleTexture = new ThreeDataTexture(data, size, size);
  actionZoneVertexHandleTexture.needsUpdate = true;
  actionZoneVertexHandleTexture.magFilter = ThreeNearestFilter;
  actionZoneVertexHandleTexture.minFilter = ThreeLinearFilter;
  return actionZoneVertexHandleTexture;
};

const ACTION_ZONE_VERTEX_HIT_RADIUS = 0.08;

const getActionZonePointSceneHeight = (point = {}, fallbackWorldHeight = 0) => (
  clamp(
    Number.isFinite(Number(point.z)) ? Number(point.z) : Number(fallbackWorldHeight) || 0,
    0,
    900,
  ) * WORLD_SCALE
);

const createActionZoneVertexHandle = (zoneId, vertexIndex, localPoint, vertexLayer = 'bottom') => {
  const handle = new ThreeGroup();
  handle.position.set(localPoint.x, localPoint.y, localPoint.z);
  const pointGeometry = new ThreeBufferGeometry();
  pointGeometry.setAttribute('position', new ThreeFloat32BufferAttribute([0, 0, 0], 3));
  const marker = new ThreePoints(
    pointGeometry,
    new ThreePointsMaterial({
      size: 10,
      sizeAttenuation: false,
      map: getActionZoneVertexHandleTexture(),
      transparent: true,
      alphaTest: 0.12,
      depthTest: false,
      depthWrite: false,
    }),
  );
  marker.renderOrder = 997;
  marker.userData.rpg3dActionZoneVertexHandle = true;
  handle.add(marker);
  const hitArea = createInvisibleActionZoneHitArea(new ThreeSphereGeometry(ACTION_ZONE_VERTEX_HIT_RADIUS, 8, 6));
  handle.add(hitArea);
  assignEntity(handle, { type: 'actionZoneVertex', id: zoneId, vertexIndex, vertexLayer });
  return handle;
};

const createActionZoneEdgeInsertHandle = (zoneId, edgeIndex, startPoint, endPoint, vertexLayer = 'bottom') => {
  const deltaX = endPoint.x - startPoint.x;
  const deltaZ = endPoint.z - startPoint.z;
  const deltaY = endPoint.y - startPoint.y;
  const length = Math.hypot(deltaX, deltaZ);
  if (length <= 0.001) return null;
  const handle = new ThreeGroup();
  handle.position.set(
    startPoint.x + deltaX / 2,
    startPoint.y + deltaY / 2 + 0.08,
    startPoint.z + deltaZ / 2,
  );
  handle.rotation.y = -Math.atan2(deltaZ, deltaX);
  const hitArea = createInvisibleActionZoneHitArea(new ThreeBoxGeometry(length, 0.12, 0.3));
  handle.add(hitArea);
  assignEntity(handle, { type: 'actionZoneEdge', id: zoneId, edgeIndex, vertexLayer });
  return handle;
};

const createActionZoneVolumeGeometry = (bottomVertices, topVertices, height, fallbackWidth, fallbackDepth) => {
  const bottom = bottomVertices.length >= 3
    ? bottomVertices
    : [
      { x: -fallbackWidth / 2, z: -fallbackDepth / 2 },
      { x: fallbackWidth / 2, z: -fallbackDepth / 2 },
      { x: fallbackWidth / 2, z: fallbackDepth / 2 },
      { x: -fallbackWidth / 2, z: fallbackDepth / 2 },
    ];
  const top = topVertices.length === bottom.length ? topVertices : bottom;
  const positions = [];
  bottom.forEach((point) => positions.push(point.x, Number.isFinite(Number(point.y)) ? Number(point.y) : 0, point.z));
  top.forEach((point) => positions.push(point.x, Number.isFinite(Number(point.y)) ? Number(point.y) : height, point.z));
  const triangles = ThreeShapeUtils.triangulateShape(
    bottom.map((point) => new ThreeVector2(point.x, point.z)),
    [],
  );
  const indices = [];
  triangles.forEach((triangle) => {
    indices.push(triangle[2], triangle[1], triangle[0]);
    indices.push(triangle[0] + bottom.length, triangle[1] + bottom.length, triangle[2] + bottom.length);
  });
  for (let index = 0; index < bottom.length; index += 1) {
    const next = (index + 1) % bottom.length;
    indices.push(index, next, next + bottom.length);
    indices.push(index, next + bottom.length, index + bottom.length);
  }
  const geometry = new ThreeBufferGeometry();
  geometry.setAttribute('position', new ThreeFloat32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
};

const addActionZoneSelectionOverlay = (group, config, zone, options = {}) => {
  const width = Math.max(0.24, getActionZoneWidth(zone) * WORLD_SCALE);
  const depth = Math.max(0.24, getActionZoneHeight(zone) * WORLD_SCALE);
  const height = Math.max(0.24, getActionZoneModelHeight(zone) * WORLD_SCALE);
  const centerX = Number(zone.x) || 0;
  const centerY = Number(zone.y) || 0;
  const localVertices = getActionZoneVertices(zone).map((point) => ({
    x: (Number(point.x) - centerX) * WORLD_SCALE,
    y: getActionZonePointSceneHeight(point, 0) + 0.14,
    z: (Number(point.y) - centerY) * WORLD_SCALE,
  }));
  const localTopVertices = getActionZoneTopVertices(zone).map((point) => ({
    x: (Number(point.x) - centerX) * WORLD_SCALE,
    y: getActionZonePointSceneHeight(point, getActionZoneModelHeight(zone)) + 0.14,
    z: (Number(point.y) - centerY) * WORLD_SCALE,
  }));
  const overlay = createSelectionOverlayGroup({ type: 'actionZone', id: zone.id });
  overlay.position.copy(toScenePosition(config, centerX, centerY, 0));
  const geometry = createActionZoneVolumeGeometry(localVertices, localTopVertices, height, width, depth);
  const edges = createSelectionEdges(geometry);
  overlay.add(edges);
  if (options.showVertexHandles !== false) {
    localVertices.forEach((point, index) => {
      const next = localVertices[(index + 1) % localVertices.length];
      const handle = createActionZoneEdgeInsertHandle(zone.id, index, point, next, 'bottom');
      if (handle) overlay.add(handle);
    });
    localTopVertices.forEach((point, index) => {
      const next = localTopVertices[(index + 1) % localTopVertices.length];
      const handle = createActionZoneEdgeInsertHandle(zone.id, index, point, next, 'top');
      if (handle) overlay.add(handle);
    });
    localVertices.forEach((point, index) => {
      overlay.add(createActionZoneVertexHandle(zone.id, index, point, 'bottom'));
    });
    localTopVertices.forEach((point, index) => {
      overlay.add(createActionZoneVertexHandle(zone.id, index, point, 'top'));
    });
  }
  group.add(overlay);
};

const formatActionZoneSignaturePoint = (zone = {}, point = {}, fallbackHeight = 0) => [
  Math.round(Number(point.x) - (Number(zone.x) || 0)),
  Math.round(Number(point.y) - (Number(zone.y) || 0)),
  Math.round(getActionZonePointSceneHeight(point, fallbackHeight) / WORLD_SCALE),
].join(',');

const getActionZoneVisualSignature = (zone = {}) => [
  zone.id || '',
  Number(zone.x) || 0,
  Number(zone.y) || 0,
  getActionZoneWidth(zone),
  getActionZoneHeight(zone),
  getActionZoneModelHeight(zone),
  getActionZoneVertices(zone).map((point) => formatActionZoneSignaturePoint(zone, point, 0)).join(';'),
  getActionZoneTopVertices(zone).map((point) => formatActionZoneSignaturePoint(zone, point, getActionZoneModelHeight(zone))).join(';'),
  getActionZoneRenderMode(zone),
  getActionZoneType(zone),
  getActionZoneColor(zone),
  Math.round(getActionZoneOpacity(zone) * 100),
  Math.round(Number(zone.rotation) || 0),
  zone.visibleInPlay ? 1 : 0,
].join(':');

const getActionZoneStructureSignature = (zone = {}) => [
  zone.id || '',
  getActionZoneVertices(zone).map((point) => formatActionZoneSignaturePoint(zone, point, 0)).join(';'),
  getActionZoneTopVertices(zone).map((point) => formatActionZoneSignaturePoint(zone, point, getActionZoneModelHeight(zone))).join(';'),
  Math.round(Number(zone.rotation) || 0),
  getActionZoneRenderMode(zone),
  getActionZoneType(zone),
  getActionZoneColor(zone),
  Math.round(getActionZoneOpacity(zone) * 100),
  zone.visibleInPlay ? 1 : 0,
].join(':');

const getActionZoneTransformSignature = (zone = {}) => [
  zone.id || '',
  Number(zone.x) || 0,
  Number(zone.y) || 0,
  getActionZoneWidth(zone),
  getActionZoneHeight(zone),
  getActionZoneModelHeight(zone),
  Math.round(Number(zone.rotation) || 0),
].join(':');

const addActionZone = (group, config, zone, options = {}) => {
  const { playMode = false } = options;
  const width = Math.max(0.24, getActionZoneWidth(zone) * WORLD_SCALE);
  const depth = Math.max(0.24, getActionZoneHeight(zone) * WORLD_SCALE);
  const height = Math.max(0.24, getActionZoneModelHeight(zone) * WORLD_SCALE);
  const color = getActionZoneColor(zone);
  const opacity = getActionZoneOpacity(zone);
  const centerX = Number(zone.x) || 0;
  const centerY = Number(zone.y) || 0;
  const localVertices = getActionZoneVertices(zone).map((point) => ({
    x: (Number(point.x) - centerX) * WORLD_SCALE,
    y: getActionZonePointSceneHeight(point, 0),
    z: (Number(point.y) - centerY) * WORLD_SCALE,
  }));
  const localTopVertices = getActionZoneTopVertices(zone).map((point) => ({
    x: (Number(point.x) - centerX) * WORLD_SCALE,
    y: getActionZonePointSceneHeight(point, getActionZoneModelHeight(zone)),
    z: (Number(point.y) - centerY) * WORLD_SCALE,
  }));
  const zoneGroup = new ThreeGroup();
  zoneGroup.position.copy(toScenePosition(config, centerX, centerY, 0));
  setTransformBase(zoneGroup, { width, height, depth });

  const geometry = createActionZoneVolumeGeometry(localVertices, localTopVertices, height, width, depth);
  geometry.computeVertexNormals();
  const veil = new ThreeMesh(
    geometry,
    new ThreeMeshBasicMaterial({
      color,
      transparent: true,
      opacity: playMode ? Math.min(0.34, Math.max(0.18, opacity + 0.08)) : opacity,
      side: ThreeDoubleSide,
      depthWrite: false,
      depthTest: !playMode,
    }),
  );
  veil.renderOrder = playMode ? 90 : 20;
  if (playMode) {
    veil.visible = false;
    veil.userData.rpg3dActionZoneHoverHighlight = true;
  }
  zoneGroup.add(veil);

  const edges = new ThreeLineSegments(
    new ThreeEdgesGeometry(geometry),
    new ThreeLineBasicMaterial({
      color,
      transparent: true,
      opacity: playMode ? 1 : Math.min(1, Math.max(0.48, opacity + 0.34)),
      depthTest: !playMode,
    }),
  );
  edges.renderOrder = playMode ? 91 : 21;
  if (playMode) {
    edges.visible = false;
    edges.userData.rpg3dActionZoneHoverHighlight = true;
  }
  zoneGroup.add(edges);

  const footprintGeometry = new ThreeBufferGeometry().setFromPoints(
    localVertices.map((point) => new ThreeVector3(point.x, 0, point.z)),
  );
  const footprint = new ThreeLineLoop(
    footprintGeometry,
    new ThreeLineBasicMaterial({
      color,
      transparent: true,
      opacity: playMode ? 1 : 0.8,
      depthTest: !playMode,
    }),
  );
  footprint.position.y = 0.06;
  footprint.renderOrder = playMode ? 92 : 22;
  if (playMode) {
    footprint.visible = false;
    footprint.userData.rpg3dActionZoneHoverHighlight = true;
  }
  zoneGroup.add(footprint);

  assignEntity(zoneGroup, { type: 'actionZone', id: zone.id });
  group.add(zoneGroup);
};

const updateActionZoneHoverHighlight = (group, hoveredZoneId = '') => {
  if (!group) return false;
  const activeId = hoveredZoneId ? String(hoveredZoneId) : '';
  let didChange = false;
  group.traverse((object) => {
    if (!object.userData?.rpg3dActionZoneHoverHighlight) return;
    const shouldShow = Boolean(activeId) && String(object.userData.entityId || '') === activeId;
    if (object.visible === shouldShow) return;
    object.visible = shouldShow;
    didChange = true;
  });
  return didChange;
};

const getActionZoneSceneDimensions = (zone = {}) => ({
  width: Math.max(0.24, getActionZoneWidth(zone) * WORLD_SCALE),
  height: Math.max(0.24, getActionZoneModelHeight(zone) * WORLD_SCALE),
  depth: Math.max(0.24, getActionZoneHeight(zone) * WORLD_SCALE),
});

export {
  createInvisibleActionZoneHitArea,
  actionZoneVertexHandleTexture,
  getActionZoneVertexHandleTexture,
  ACTION_ZONE_VERTEX_HIT_RADIUS,
  getActionZonePointSceneHeight,
  createActionZoneVertexHandle,
  createActionZoneEdgeInsertHandle,
  createActionZoneVolumeGeometry,
  addActionZoneSelectionOverlay,
  formatActionZoneSignaturePoint,
  getActionZoneVisualSignature,
  getActionZoneStructureSignature,
  getActionZoneTransformSignature,
  addActionZone,
  updateActionZoneHoverHighlight,
  getActionZoneSceneDimensions,
};
