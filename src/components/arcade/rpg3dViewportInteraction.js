import * as THREE from 'three';
import {
  clamp,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneTopVertices,
  getActionZoneVertices,
  getActionZoneWidth,
} from '../../utils/rpg3dDomain.js';
import { isPointInActionZone } from '../../utils/rpg3dMapEditing.js';
import {
  DEFAULT_ENGINE,
  WORLD_SCALE,
  readEntity,
  toScenePosition,
} from './rpg3dSceneBuilders.js';
import {
  getCameraTargetPoint,
  isSameEntity,
} from './rpg3dViewportPicking.js';

export const MODEL_ERASER_PREVIEW_COLOR = '#fb923c';
export const ACTION_ZONE_EDGE_DRAG_THRESHOLD = 6;
const ACTION_ZONE_VERTEX_HIT_RADIUS_WORLD = 6;
export const ACTION_ZONE_VERTEX_POINTS_RAY_THRESHOLD = 0.08;
const ACTION_ZONE_HEIGHT_DRAG_UNITS_PER_PIXEL = 2;

export const getHoveredActionZoneId = (config = {}, point = null) => {
  if (!point) return '';
  const zones = Array.isArray(config.actionZones) ? config.actionZones : [];
  for (let index = zones.length - 1; index >= 0; index -= 1) {
    const zone = zones[index];
    if (zone?.id && isPointInActionZone(zone, point)) return zone.id;
  }
  return '';
};

export const syncArcadeShadowMapForFrame = (renderer, shouldUpdate = true) => {
  if (!renderer?.shadowMap) return;
  renderer.shadowMap.autoUpdate = false;
  if (shouldUpdate) renderer.shadowMap.needsUpdate = true;
};

export const getActionZoneHeightDragPoint = (startPoint = {}, startClientY = 0, currentClientY = 0) => ({
  x: Number(startPoint.x) || 0,
  y: Number(startPoint.y) || 0,
  z: clamp(
    (Number.isFinite(Number(startPoint.z)) ? Number(startPoint.z) : 0)
      - ((Number(currentClientY) || 0) - (Number(startClientY) || 0)) * ACTION_ZONE_HEIGHT_DRAG_UNITS_PER_PIXEL,
    0,
    900,
  ),
});

export const getActionZoneHeightDragDelta = (lastClientY = 0, currentClientY = 0) => ({
  x: 0,
  y: 0,
  z: -((Number(currentClientY) || 0) - (Number(lastClientY) || 0)) * ACTION_ZONE_HEIGHT_DRAG_UNITS_PER_PIXEL,
});

export const getEntityRootObject = (object, entity) => {
  let current = object;
  let root = null;
  while (current) {
    if (isSameEntity(readEntity(current), entity)) root = current;
    else if (root) break;
    current = current.parent;
  }
  return root;
};

export const createModelEraserSurfacePreview = (radiusWorld, color = MODEL_ERASER_PREVIEW_COLOR) => {
  const radius = Math.max(0.025, Number(radiusWorld) || 0.025);
  const group = new THREE.Group();
  group.userData.previewRadius = radius;
  group.userData.previewColor = color;

  const fill = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 24, 12),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      depthTest: false,
    }),
  );
  fill.renderOrder = 97;
  group.add(fill);

  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(new THREE.SphereGeometry(radius, 16, 8)),
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.82,
      depthTest: false,
    }),
  );
  wire.renderOrder = 98;
  group.add(wire);

  return group;
};

const getPointSegmentDistance = (point, start, end) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq <= 0.0001) return Math.hypot(point.x - start.x, point.y - start.y);
  const ratio = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq, 0, 1);
  return Math.hypot(point.x - (start.x + dx * ratio), point.y - (start.y + dy * ratio));
};

export const resolveActionZoneShapeControl = (config, selected, multiSelected = [], point) => {
  if (!config?.actionZones?.length || !point) return null;
  const actionZoneSelection = selected?.type === 'actionZone'
    ? selected
    : (multiSelected || []).find((entity) => entity?.type === 'actionZone');
  if (!actionZoneSelection?.id) return null;
  const zone = (config.actionZones || []).find((entry) => entry.id === actionZoneSelection.id);
  if (!zone) return null;
  const vertices = getActionZoneVertices(zone);
  if (vertices.length < 3) return null;
  const vertexHitThreshold = ACTION_ZONE_VERTEX_HIT_RADIUS_WORLD;
  const edgeHitThreshold = 22;
  const closestVertex = vertices
    .map((vertex, index) => ({
      index,
      distance: Math.hypot(point.x - vertex.x, point.y - vertex.y),
    }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (closestVertex && closestVertex.distance <= vertexHitThreshold) {
    return { type: 'actionZoneVertex', id: zone.id, vertexIndex: closestVertex.index, vertexLayer: 'bottom' };
  }
  const closestEdge = vertices
    .map((vertex, index) => ({
      index,
      distance: getPointSegmentDistance(point, vertex, vertices[(index + 1) % vertices.length]),
    }))
    .sort((left, right) => left.distance - right.distance)[0];
  if (closestEdge && closestEdge.distance <= edgeHitThreshold) {
    return { type: 'actionZoneEdge', id: zone.id, edgeIndex: closestEdge.index, vertexLayer: 'bottom' };
  }
  return null;
};

export const ACTION_ZONE_VIEW_MODES = [
  { id: 'north', label: 'N', title: 'Voir de face', direction: new THREE.Vector3(0, 0, -1) },
  { id: 'east', label: 'E', title: 'Voir le cote droit', direction: new THREE.Vector3(1, 0, 0) },
  { id: 'south', label: 'S', title: 'Voir de dos', direction: new THREE.Vector3(0, 0, 1) },
  { id: 'west', label: 'O', title: 'Voir le cote gauche', direction: new THREE.Vector3(-1, 0, 0) },
];
export const ACTION_ZONE_VIEW_BY_ID = ACTION_ZONE_VIEW_MODES.reduce((map, mode) => {
  map[mode.id] = mode;
  return map;
}, {});
const NESO_VIEW_ENTITY_TYPES = new Set(['actionZone', 'hero', 'enemy', 'pickup', 'prop']);

export const getNesoViewEntity = (selected, multiSelected = []) => (
  selected?.id && NESO_VIEW_ENTITY_TYPES.has(selected.type)
    ? selected
    : (multiSelected || []).find((entity) => entity?.id && NESO_VIEW_ENTITY_TYPES.has(entity.type)) || null
);

export const getSelectedActionZone = (config, selected, multiSelected = []) => {
  const selection = selected?.type === 'actionZone'
    ? selected
    : (multiSelected || []).find((entity) => entity?.type === 'actionZone');
  if (!selection?.id) return null;
  return (config?.actionZones || []).find((zone) => zone.id === selection.id) || null;
};

const getActionZonePointZ = (point = {}, fallback = 0) => (
  clamp(Number.isFinite(Number(point.z)) ? Number(point.z) : Number(fallback) || 0, 0, 900)
);

const getActionZoneLayerVertices = (zone, vertexLayer = 'bottom') => (
  vertexLayer === 'top' ? getActionZoneTopVertices(zone) : getActionZoneVertices(zone)
);

export const getActionZonePointForEntity = (config, entity) => {
  if (!config?.actionZones?.length || !entity?.id) return null;
  const zone = (config.actionZones || []).find((entry) => entry.id === entity.id);
  if (!zone) return null;
  const vertexLayer = entity.vertexLayer === 'top' ? 'top' : 'bottom';
  const fallbackZ = vertexLayer === 'top' ? getActionZoneModelHeight(zone) : 0;
  const vertices = getActionZoneLayerVertices(zone, vertexLayer);
  const index = Number(entity.vertexIndex ?? entity.edgeIndex);
  if (!Number.isInteger(index) || index < 0 || index >= vertices.length) return null;
  if (entity.type === 'actionZoneVertex') {
    const point = vertices[index];
    return { x: point.x, y: point.y, z: getActionZonePointZ(point, fallbackZ) };
  }
  if (entity.type === 'actionZoneEdge') {
    const start = vertices[index];
    const end = vertices[(index + 1) % vertices.length];
    return {
      x: start.x + (end.x - start.x) / 2,
      y: start.y + (end.y - start.y) / 2,
      z: getActionZonePointZ(start, fallbackZ) + (getActionZonePointZ(end, fallbackZ) - getActionZonePointZ(start, fallbackZ)) / 2,
    };
  }
  return null;
};

const getActionZoneCameraTarget = (config, zone) => {
  if (!config?.world || !zone) return null;
  const bottomVertices = getActionZoneVertices(zone);
  const topVertices = getActionZoneTopVertices(zone);
  const modelHeight = getActionZoneModelHeight(zone);
  const zValues = [
    ...bottomVertices.map((point) => getActionZonePointZ(point, 0)),
    ...topVertices.map((point) => getActionZonePointZ(point, modelHeight)),
  ];
  const minZ = zValues.length ? Math.min(...zValues) : 0;
  const maxZ = zValues.length ? Math.max(...zValues) : modelHeight;
  return toScenePosition(
    config,
    Number(zone.x) || 0,
    Number(zone.y) || 0,
    ((minZ + maxZ) / 2) * WORLD_SCALE,
  );
};

const getActionZoneSideViewDistance = (zone) => (
  clamp(
    Math.max(getActionZoneWidth(zone), getActionZoneHeight(zone), getActionZoneModelHeight(zone), 220) * WORLD_SCALE * 2.6,
    5,
    70,
  )
);

export const getNesoCameraTarget = (config, entity, engine = DEFAULT_ENGINE) => {
  if (!config?.world || !entity?.id) return null;
  if (entity.type === 'actionZone') {
    const zone = (config.actionZones || []).find((entry) => entry.id === entity.id);
    return zone ? getActionZoneCameraTarget(config, zone) : null;
  }
  const targetPoint = getCameraTargetPoint(config, entity, engine);
  if (!targetPoint) return null;
  return toScenePosition(
    config,
    targetPoint.x,
    targetPoint.y,
    Number.isFinite(Number(targetPoint.height)) ? Number(targetPoint.height) : 0.65,
  );
};

export const getNesoFallbackViewDistance = (config, entity, fallbackDistance = 12) => {
  if (entity?.type === 'actionZone') {
    const zone = (config?.actionZones || []).find((entry) => entry.id === entity.id);
    if (zone) return getActionZoneSideViewDistance(zone);
  }
  return fallbackDistance;
};

export const getActionZoneCurrentViewDistance = (camera, controls, fallbackDistance = 12) => {
  const currentDistance = camera?.position?.distanceTo?.(controls?.target);
  const minDistance = Number.isFinite(Number(controls?.minDistance)) ? Number(controls.minDistance) : 2.6;
  const maxDistance = Number.isFinite(Number(controls?.maxDistance)) ? Number(controls.maxDistance) : 90;
  const fallback = Number.isFinite(Number(fallbackDistance)) ? Number(fallbackDistance) : 12;
  return clamp(
    Number.isFinite(Number(currentDistance)) && Number(currentDistance) > 0.01
      ? Number(currentDistance)
      : fallback,
    minDistance,
    maxDistance,
  );
};
