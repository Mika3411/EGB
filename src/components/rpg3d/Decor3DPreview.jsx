import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ACESFilmicToneMapping as ThreeACESFilmicToneMapping,
  AlwaysStencilFunc as ThreeAlwaysStencilFunc,
  AmbientLight as ThreeAmbientLight,
  Box3 as ThreeBox3,
  BufferAttribute as ThreeBufferAttribute,
  BufferGeometry as ThreeBufferGeometry,
  CanvasTexture as ThreeCanvasTexture,
  CatmullRomCurve3 as ThreeCatmullRomCurve3,
  CircleGeometry as ThreeCircleGeometry,
  Color as ThreeColor,
  CylinderGeometry as ThreeCylinderGeometry,
  DirectionalLight as ThreeDirectionalLight,
  DoubleSide as ThreeDoubleSide,
  EqualStencilFunc as ThreeEqualStencilFunc,
  Fog as ThreeFog,
  GridHelper as ThreeGridHelper,
  Group as ThreeGroup,
  HemisphereLight as ThreeHemisphereLight,
  InstancedMesh as ThreeInstancedMesh,
  KeepStencilOp as ThreeKeepStencilOp,
  MathUtils as ThreeMathUtils,
  Matrix3 as ThreeMatrix3,
  Matrix4 as ThreeMatrix4,
  Mesh as ThreeMesh,
  MeshBasicMaterial as ThreeMeshBasicMaterial,
  MeshStandardMaterial as ThreeMeshStandardMaterial,
  PCFShadowMap as ThreePCFShadowMap,
  PMREMGenerator as ThreePMREMGenerator,
  PerspectiveCamera as ThreePerspectiveCamera,
  Plane as ThreePlane,
  PlaneGeometry as ThreePlaneGeometry,
  Points as ThreePoints,
  PointsMaterial as ThreePointsMaterial,
  Quaternion as ThreeQuaternion,
  Raycaster as ThreeRaycaster,
  RepeatWrapping as ThreeRepeatWrapping,
  ReplaceStencilOp as ThreeReplaceStencilOp,
  RingGeometry as ThreeRingGeometry,
  SRGBColorSpace as ThreeSRGBColorSpace,
  Scene as ThreeScene,
  Sprite as ThreeSprite,
  SpriteMaterial as ThreeSpriteMaterial,
  TubeGeometry as ThreeTubeGeometry,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
  WebGLRenderer as ThreeWebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { attachClickTargetCameraControls } from '../three/clickTargetCameraControls.js';
import {
  clearGroup,
  alignObjectTopToGround,
  applyModelRotation,
  centerObjectHorizontallyOnOrigin,
  createPreviewFloorCanvas,
  disposeThreeObject,
  fitDecorModelObjectToDimensions,
  getDecorMaterialBrightness,
  getDecorModelDimensions,
  getDecorModelSources,
  isFloorTileKind,
  loadThreeDecor,
  makePreviewStandardMaterial,
  numberValue,
} from '../../utils/rpg3dModelImport';
import {
  resetObjectBaseTransform,
  snapObjectToGround,
  updateGltfModelMaterialAppearance,
} from '../../utils/threeGltfUtils';

const getDecorSizeSignature = (model = {}) => {
  const dimensions = getDecorModelDimensions(model);
  return `${dimensions.x}:${dimensions.y}:${dimensions.z}`;
};
const getDecorPoseSignature = (model = {}) => [
  model.modelRotationX || '',
  model.modelRotationY || '',
  model.modelRotationZ || '',
  model.elevation || '',
  model.modelCenterOnOrigin ? 'center' : '',
  model.modelFlushToGround ? 'flush' : '',
].join(':');
const getDecorAppearanceSignature = (model = {}) => `${getDecorMaterialBrightness(model)}`;
const getDecorPreviewModelSignature = (model = {}) => [
  model?.id || '',
  model?.kind || '',
  model?.modelUrl || '',
  model?.modelData || '',
  model?.localModelFileId || '',
  model?.modelName || '',
  model?.modelFormat || '',
  model?.modelFileSize || '',
  model?.imageData || '',
  model?.imageName || '',
  model?.collision ? 'collision' : '',
  model?.repeatTexture ? 'repeat' : '',
  (Array.isArray(model?.modelResources) ? model.modelResources : [])
    .map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`)
    .join(';'),
].join('|');
const normalizeRigObjectName = (name = '') => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const getRigNodePath = (object = null, root = null) => {
  if (!object || !root) return '';
  const parts = [];
  let cursor = object;
  while (cursor && cursor !== root) {
    const parent = cursor.parent;
    const index = parent?.children ? parent.children.indexOf(cursor) : -1;
    const name = normalizeRigObjectName(cursor.name || cursor.type || 'node') || 'node';
    parts.unshift(`${Math.max(0, index)}:${name}`);
    cursor = parent;
  }
  return parts.join('/');
};
const WEAPON_GRIP_MARKER_COLORS = {
  right: { fill: '#f59e0b', stroke: '#fff7ed', text: '#111827', label: 'D' },
  left: { fill: '#38bdf8', stroke: '#e0f2fe', text: '#06111f', label: 'G' },
  'shield-hand': { fill: '#22c55e', stroke: '#dcfce7', text: '#052e16', label: 'M' },
  'shield-elbow': { fill: '#f97316', stroke: '#ffedd5', text: '#111827', label: 'C' },
  'armor-left-shoulder': { fill: '#a78bfa', stroke: '#f5f3ff', text: '#1e1238', label: 'EG' },
  'armor-right-shoulder': { fill: '#818cf8', stroke: '#eef2ff', text: '#111827', label: 'ED' },
  'armor-left-elbow': { fill: '#14b8a6', stroke: '#ccfbf1', text: '#042f2e', label: 'CG' },
  'armor-right-elbow': { fill: '#06b6d4', stroke: '#cffafe', text: '#062533', label: 'CD' },
  'armor-lower-belly': { fill: '#f43f5e', stroke: '#ffe4e6', text: '#111827', label: 'B' },
};
const ARMOR_CUT_PREVIEW_COLORS = {
  body: { color: '#f59e0b', activeOpacity: 0.72, opacity: 0.5 },
  'left-arm': { color: '#14b8a6', activeOpacity: 0.76, opacity: 0.54 },
  'right-arm': { color: '#3b82f6', activeOpacity: 0.76, opacity: 0.54 },
};
const ARMOR_MANIPULATION_ARM_LINES = [
  {
    arm: 'left',
    segment: 'left-arm',
    shoulderId: 'left-shoulder',
    elbowId: 'left-elbow',
    shoulderKey: 'leftShoulder',
    elbowKey: 'leftElbow',
  },
  {
    arm: 'right',
    segment: 'right-arm',
    shoulderId: 'right-shoulder',
    elbowId: 'right-elbow',
    shoulderKey: 'rightShoulder',
    elbowKey: 'rightElbow',
  },
];
const LEGGINGS_MANIPULATION_LEG_LINES = [
  {
    arm: 'left',
    segment: 'left-arm',
    shoulderId: 'left-groin-fold',
    elbowId: 'left-foot',
    shoulderKey: 'leftGroinFold',
    elbowKey: 'leftFoot',
  },
  {
    arm: 'right',
    segment: 'right-arm',
    shoulderId: 'right-groin-fold',
    elbowId: 'right-foot',
    shoulderKey: 'rightGroinFold',
    elbowKey: 'rightFoot',
  },
];
const LEGGINGS_MARKER_IDS = new Set([
  'left-groin-fold',
  'right-groin-fold',
  'left-knee',
  'right-knee',
  'left-foot',
  'right-foot',
]);
const hasLeggingsRigMarkers = (markers = []) => (
  Array.isArray(markers) && markers.some((marker) => LEGGINGS_MARKER_IDS.has(marker?.id))
);
const getArmorManipulationLines = (markers = []) => (
  hasLeggingsRigMarkers(markers) ? LEGGINGS_MANIPULATION_LEG_LINES : ARMOR_MANIPULATION_ARM_LINES
);
const ARMOR_CONTOUR_SEGMENT_PRIORITY = ['left-arm', 'right-arm', 'body'];
const ARMOR_CONTOUR_POINT_LIMIT = 80;
const ARMOR_PAINT_POINT_LIMIT = 240;
const ARMOR_PAINT_RADIUS = 0.14;
const ARMOR_PAINT_RADIUS_MIN = 0.04;
const ARMOR_PAINT_RADIUS_MAX = 0.5;
const ARMOR_PAINT_SURFACE_OFFSET_RATIO = 0.08;
const ARMOR_PAINT_SURFACE_OFFSET_MIN = 0.008;
const ARMOR_PAINT_SURFACE_OFFSET_MAX = 0.04;
const ARMOR_PAINT_ACTIVE_OPACITY = 0.68;
const ARMOR_PAINT_IDLE_OPACITY = 0.52;
const ARMOR_PAINT_HOLD_INTERVAL_MS = 110;
const ARMOR_PAINT_SPATIAL_CELL_SIZE = 0.12;
const ARMOR_PAINT_STAMP_SPACING_RATIO = 0.42;
const ARMOR_PAINT_STAMP_SEGMENTS = 36;
const ARMOR_PAINT_STAMP_DEDUP_RATIO = 0.22;
const ARMOR_CUT_PAINT_GUIDE_ACTIVE_OPACITY = 0.18;
const ARMOR_CUT_PAINT_GUIDE_IDLE_OPACITY = 0.07;
const ARMOR_PAINT_STENCIL_REF = 7;
const ARMOR_PAINT_STENCIL_MASK = 0xff;
const DECOR_CAMERA_ZOOM_DRAG_SENSITIVITY = 0.018;
const DECOR_CAMERA_ZOOM_MIN_DISTANCE = 0.02;
const DECOR_CAMERA_ZOOM_MAX_DISTANCE = 100000;
const WEAPON_GRIP_POSITION_MIN = -2;
const WEAPON_GRIP_POSITION_MAX = 2;
const GRIP_TRAY_SCREEN_BOUNDS = {
  left: 0.825,
  right: 0.975,
  top: 0.18,
  bottom: 0.82,
};

const clampGripValue = (value) => ThreeMathUtils.clamp(
  Number.isFinite(Number(value)) ? Number(value) : 0,
  WEAPON_GRIP_POSITION_MIN,
  WEAPON_GRIP_POSITION_MAX,
);

const roundGripValue = (value) => Math.round(clampGripValue(value) * 100) / 100;

const normalizeArmorContourSegment = (segment = '') => (
  ARMOR_CUT_PREVIEW_COLORS[segment] ? segment : 'body'
);

const normalizeArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point.nx);
  const ny = Number(point.ny);
  const nz = Number(point.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: Math.round((nx / length) * 1000) / 1000,
    ny: Math.round((ny / length) * 1000) / 1000,
    nz: Math.round((nz / length) * 1000) / 1000,
  };
};

const normalizeArmorPaintSectionPlane = (point = {}) => {
  const cx = Number(point.cx);
  const cy = Number(point.cy);
  const cz = Number(point.cz);
  const cw = Number(point.cw);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz) || !Number.isFinite(cw)) return {};
  const length = Math.hypot(cx, cy, cz);
  if (length <= 0.001) return {};
  return {
    cx: Math.round((cx / length) * 1000) / 1000,
    cy: Math.round((cy / length) * 1000) / 1000,
    cz: Math.round((cz / length) * 1000) / 1000,
    cw: Math.round((cw / length) * 1000) / 1000,
  };
};

const normalizeArmorContourPoint = (point = {}) => ({
  x: roundGripValue(point.x),
  y: roundGripValue(point.y),
  z: roundGripValue(point.z),
  ...normalizeArmorPaintSurfaceNormal(point),
  ...normalizeArmorPaintSectionPlane(point),
});

const normalizeArmorPaintRadius = (value = ARMOR_PAINT_RADIUS) => (
  ThreeMathUtils.clamp(
    Number(value) || ARMOR_PAINT_RADIUS,
    ARMOR_PAINT_RADIUS_MIN,
    ARMOR_PAINT_RADIUS_MAX,
  )
);

const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeArmorContourSegment(entry?.segment),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, ARMOR_CONTOUR_POINT_LIMIT)
        .map(normalizeArmorContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeArmorContourSegment(entry?.segment),
      radius: normalizeArmorPaintRadius(entry?.radius),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(-ARMOR_PAINT_POINT_LIMIT)
        .map(normalizeArmorContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const mergeArmorPaintStroke = (baseStrokes = [], segment = 'body', points = [], radius = ARMOR_PAINT_RADIUS) => {
  const normalizedSegment = normalizeArmorContourSegment(segment);
  const strokeMap = new Map(normalizeArmorCutPaintStrokes(baseStrokes).map((entry) => [entry.segment, entry]));
  const previousStroke = strokeMap.get(normalizedSegment);
  const nextPoints = [
    ...(previousStroke?.points || []),
    ...(Array.isArray(points) ? points : []),
  ].slice(-ARMOR_PAINT_POINT_LIMIT).map(normalizeArmorContourPoint);
  if (nextPoints.length) {
    strokeMap.set(normalizedSegment, {
      segment: normalizedSegment,
      radius: normalizeArmorPaintRadius(radius),
      points: nextPoints,
    });
  }
  return [...strokeMap.values()];
};

const getArmorCutContoursSignature = (contours = [], modelObject = null) => (
  [
    modelObject?.uuid || '',
    modelObject?.position ? modelObject.position.toArray().map((value) => Number(value).toFixed(3)).join(',') : '',
    JSON.stringify(normalizeArmorCutContours(contours)),
  ].join('|')
);

const getArmorCutPaintSignature = (strokes = [], modelObject = null) => (
  [
    modelObject?.uuid || '',
    modelObject?.position ? modelObject.position.toArray().map((value) => Number(value).toFixed(3)).join(',') : '',
    JSON.stringify(normalizeArmorCutPaintStrokes(strokes)),
  ].join('|')
);

const getArmorPaintDepthTolerance = (radius = ARMOR_PAINT_RADIUS) => (
  ThreeMathUtils.clamp(normalizeArmorPaintRadius(radius) * 0.36, 0.035, 0.11)
);

const getArmorPaintPlaneTolerance = (radius = ARMOR_PAINT_RADIUS) => (
  ThreeMathUtils.clamp(normalizeArmorPaintRadius(radius) * 0.18, 0.02, 0.038)
);

const getArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return null;
  const normal = new ThreeVector3(nx, ny, nz);
  return normal.lengthSq() > 0.000001 ? normal.normalize() : null;
};

const getArmorPaintSectionPlane = (point = {}) => {
  const cx = Number(point?.cx);
  const cy = Number(point?.cy);
  const cz = Number(point?.cz);
  const cw = Number(point?.cw);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz) || !Number.isFinite(cw)) return null;
  const normal = new ThreeVector3(cx, cy, cz);
  const length = normal.length();
  if (length <= 0.000001) return null;
  normal.multiplyScalar(1 / length);
  return new ThreePlane(normal, cw / length);
};

const isPointOnArmorPaintVisibleSide = (point, paintPoint, radius = ARMOR_PAINT_RADIUS) => {
  const plane = getArmorPaintSectionPlane(paintPoint);
  if (!plane) return true;
  return plane.distanceToPoint(point) >= -getArmorPaintPlaneTolerance(radius);
};

const isPointOnPaintSurface = (point, paintPoint, radius = ARMOR_PAINT_RADIUS) => (
  Math.abs((Number(point?.z) || 0) - (Number(paintPoint?.z) || 0)) <= getArmorPaintDepthTolerance(radius)
);

const isPointInsidePaintStamp = (point, paintPoint, radius = ARMOR_PAINT_RADIUS) => {
  if (!isPointOnArmorPaintVisibleSide(point, paintPoint, radius)) return false;
  const normal = getArmorPaintSurfaceNormal(paintPoint);
  if (normal) {
    const dx = point.x - paintPoint.x;
    const dy = point.y - paintPoint.y;
    const dz = point.z - paintPoint.z;
    const planeDistance = (dx * normal.x) + (dy * normal.y) + (dz * normal.z);
    const surfaceDistanceSq = Math.max(0, (dx * dx) + (dy * dy) + (dz * dz) - (planeDistance * planeDistance));
    return surfaceDistanceSq <= radius * radius
      && Math.abs(planeDistance) <= getArmorPaintPlaneTolerance(radius);
  }
  return Math.hypot(point.x - paintPoint.x, point.y - paintPoint.y) <= radius
    && isPointOnPaintSurface(point, paintPoint, radius);
};

const getInterpolatedArmorPaintNormal = (start = {}, end = {}, t = 0) => {
  const startNormal = getArmorPaintSurfaceNormal(start);
  const endNormal = getArmorPaintSurfaceNormal(end);
  if (startNormal && endNormal) {
    if (startNormal.dot(endNormal) < 0) endNormal.multiplyScalar(-1);
    const normal = startNormal.lerp(endNormal, ThreeMathUtils.clamp(t, 0, 1));
    return normal.lengthSq() > 0.000001 ? normal.normalize() : startNormal;
  }
  return startNormal || endNormal;
};

const getPointToPaintSegmentHit = (point, start, end, radius = ARMOR_PAINT_RADIUS) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = (Number(end.z) || 0) - (Number(start.z) || 0);
  const hasSurfaceNormal = Boolean(getArmorPaintSurfaceNormal(start) || getArmorPaintSurfaceNormal(end));
  const lengthSq = hasSurfaceNormal
    ? (dx * dx) + (dy * dy) + (dz * dz)
    : (dx * dx) + (dy * dy);
  if (lengthSq <= 0.000001) {
    return isPointInsidePaintStamp(point, start, radius);
  }
  const t = ThreeMathUtils.clamp((
    ((point.x - start.x) * dx)
    + ((point.y - start.y) * dy)
    + (hasSurfaceNormal ? (((Number(point.z) || 0) - (Number(start.z) || 0)) * dz) : 0)
  ) / lengthSq, 0, 1);
  const normal = getInterpolatedArmorPaintNormal(start, end, t);
  const projectedPoint = {
    x: start.x + dx * t,
    y: start.y + dy * t,
    z: (Number(start.z) || 0) + (((Number(end.z) || 0) - (Number(start.z) || 0)) * t),
    ...(normal ? { nx: normal.x, ny: normal.y, nz: normal.z } : {}),
    ...normalizeArmorPaintSectionPlane(start.cx !== undefined ? start : end),
  };
  return isPointInsidePaintStamp(point, projectedPoint, radius);
};

const getArmorPaintStrokeBounds = (stroke = {}) => {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return null;
  const padding = normalizeArmorPaintRadius(stroke.radius) + getArmorPaintDepthTolerance(stroke.radius);
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  points.forEach((point) => {
    bounds.minX = Math.min(bounds.minX, point.x - padding);
    bounds.maxX = Math.max(bounds.maxX, point.x + padding);
    bounds.minY = Math.min(bounds.minY, point.y - padding);
    bounds.maxY = Math.max(bounds.maxY, point.y + padding);
    bounds.minZ = Math.min(bounds.minZ, point.z - padding);
    bounds.maxZ = Math.max(bounds.maxZ, point.z + padding);
  });
  return bounds;
};

const getArmorPaintBoundsForRange = (start = {}, end = start, radius = ARMOR_PAINT_RADIUS) => {
  const normalizedRadius = normalizeArmorPaintRadius(radius);
  const padding = normalizedRadius + getArmorPaintDepthTolerance(normalizedRadius);
  const startX = Number(start?.x) || 0;
  const startY = Number(start?.y) || 0;
  const startZ = Number(start?.z) || 0;
  const endX = Number(end?.x) || 0;
  const endY = Number(end?.y) || 0;
  const endZ = Number(end?.z) || 0;
  return {
    minX: Math.min(startX, endX) - padding,
    maxX: Math.max(startX, endX) + padding,
    minY: Math.min(startY, endY) - padding,
    maxY: Math.max(startY, endY) + padding,
    minZ: Math.min(startZ, endZ) - padding,
    maxZ: Math.max(startZ, endZ) + padding,
  };
};

const getArmorPaintStrokeHits = (stroke = {}) => {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  const radius = normalizeArmorPaintRadius(stroke.radius);
  if (!points.length) return [];
  const hits = [{
    type: 'point',
    start: points[0],
    bounds: getArmorPaintBoundsForRange(points[0], points[0], radius),
  }];
  for (let index = 1; index < points.length; index += 1) {
    hits.push({
      type: 'segment',
      start: points[index - 1],
      end: points[index],
      bounds: getArmorPaintBoundsForRange(points[index - 1], points[index], radius),
    });
  }
  return hits;
};

const isPointInsideArmorPaintBounds = (point = new ThreeVector3(), bounds = null) => (
  !bounds
  || (
    point.x >= bounds.minX
    && point.x <= bounds.maxX
    && point.y >= bounds.minY
    && point.y <= bounds.maxY
    && point.z >= bounds.minZ
    && point.z <= bounds.maxZ
  )
);

const isPointInsideArmorPaintHit = (point = new ThreeVector3(), hit = null, radius = ARMOR_PAINT_RADIUS) => {
  if (!hit || !isPointInsideArmorPaintBounds(point, hit.bounds)) return false;
  if (hit.type === 'segment') return getPointToPaintSegmentHit(point, hit.start, hit.end, radius);
  return isPointInsidePaintStamp(point, hit.start, radius);
};

const prepareArmorPaintStrokes = (strokes = []) => {
  if (Array.isArray(strokes) && strokes.every((stroke) => stroke?.paintBounds)) return strokes;
  return normalizeArmorCutPaintStrokes(strokes)
    .map((stroke) => ({
      ...stroke,
      paintBounds: getArmorPaintStrokeBounds(stroke),
    }))
    .sort((a, b) => (
      ARMOR_CONTOUR_SEGMENT_PRIORITY.indexOf(a.segment) - ARMOR_CONTOUR_SEGMENT_PRIORITY.indexOf(b.segment)
    ));
};

const classifyArmorPaintPoint = (point = new ThreeVector3(), strokes = []) => {
  const preparedStrokes = prepareArmorPaintStrokes(strokes);
  if (!preparedStrokes.length) return '';
  return preparedStrokes.find((stroke) => isPointInsidePreparedPaintStroke(point, stroke))?.segment || '';
};

const isPointInsidePreparedPaintStroke = (point = new ThreeVector3(), stroke = null) => {
  if (!stroke || !isPointInsideArmorPaintBounds(point, stroke.paintBounds)) return false;
  if (stroke.points.some((paintPoint) => isPointInsidePaintStamp(point, paintPoint, stroke.radius))) return true;
  for (let index = 1; index < stroke.points.length; index += 1) {
    if (getPointToPaintSegmentHit(point, stroke.points[index - 1], stroke.points[index], stroke.radius)) return true;
  }
  return false;
};

const isPointInsideArmorContour = (point = new ThreeVector3(), points = []) => {
  if (!point || !Array.isArray(points) || points.length < 3) return false;
  let inside = false;
  for (let index = 0, previousIndex = points.length - 1; index < points.length; previousIndex = index, index += 1) {
    const current = points[index];
    const previous = points[previousIndex];
    const intersects = ((current.y > point.y) !== (previous.y > point.y))
      && (point.x < ((previous.x - current.x) * (point.y - current.y)) / ((previous.y - current.y) || 0.000001) + current.x);
    if (intersects) inside = !inside;
  }
  return inside;
};

const classifyArmorContourPoint = (point = new ThreeVector3(), contours = []) => {
  const normalizedContours = normalizeArmorCutContours(contours).filter((entry) => entry.points.length >= 3);
  if (!normalizedContours.length) return '';
  const sortedContours = normalizedContours.sort(
    (a, b) => ARMOR_CONTOUR_SEGMENT_PRIORITY.indexOf(a.segment) - ARMOR_CONTOUR_SEGMENT_PRIORITY.indexOf(b.segment),
  );
  return sortedContours.find((entry) => isPointInsideArmorContour(point, entry.points))?.segment || '';
};

const getGripMarkerKey = (marker = {}) => (
  marker.type === 'armor'
    ? `armor-${marker.id || 'lower-belly'}`
    : (marker.type === 'shield' ? `shield-${marker.id || 'hand'}` : (marker.hand === 'left' ? 'left' : 'right'))
);

const getGripTraySlotRatio = (index = 0, count = 1) => {
  const safeCount = Math.max(1, count);
  const columns = safeCount > 18 ? 3 : (safeCount > 3 ? 2 : 1);
  const rows = Math.max(1, Math.ceil(safeCount / columns));
  const column = index % columns;
  const row = Math.floor(index / columns);
  const xRatio = GRIP_TRAY_SCREEN_BOUNDS.left
    + ((column + 0.5) / columns) * (GRIP_TRAY_SCREEN_BOUNDS.right - GRIP_TRAY_SCREEN_BOUNDS.left);
  const yRatio = GRIP_TRAY_SCREEN_BOUNDS.top
    + ((row + 0.5) / rows) * (GRIP_TRAY_SCREEN_BOUNDS.bottom - GRIP_TRAY_SCREEN_BOUNDS.top);
  return { xRatio, yRatio, columns, rows };
};

const getGripTraySlotNdc = (index = 0, count = 1) => {
  const slot = getGripTraySlotRatio(index, count);
  return {
    x: slot.xRatio * 2 - 1,
    y: -(slot.yRatio * 2 - 1),
    columns: slot.columns,
    rows: slot.rows,
  };
};

const isCanvasPointInGripTray = (canvasPoint = {}) => {
  const width = Math.max(1, Number(canvasPoint.width) || 1);
  const height = Math.max(1, Number(canvasPoint.height) || 1);
  const x = Number(canvasPoint.x);
  const y = Number(canvasPoint.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  return x >= width * GRIP_TRAY_SCREEN_BOUNDS.left
    && x <= width * GRIP_TRAY_SCREEN_BOUNDS.right
    && y >= height * GRIP_TRAY_SCREEN_BOUNDS.top
    && y <= height * GRIP_TRAY_SCREEN_BOUNDS.bottom;
};

const getGripTrayReferencePoint = (decorObject = null) => {
  const gripSpace = getDecorGripSpace(decorObject);
  const target = gripSpace?.modelObject || decorObject?.userData?.decorModelObject || decorObject;
  if (!target?.getWorldPosition) return new ThreeVector3();
  target.updateMatrixWorld?.(true);
  return target.getWorldPosition(new ThreeVector3());
};

const getGripTrayWorldPosition = (camera = null, index = 0, count = 1, referencePoint = new ThreeVector3()) => {
  if (!camera) return null;
  camera.updateMatrixWorld?.(true);
  const slot = getGripTraySlotNdc(index, count);
  const ndcPoint = new ThreeVector3(slot.x, slot.y, 0.5);
  if (camera.isOrthographicCamera) return ndcPoint.unproject(camera);
  const distance = Math.max(0.5, camera.position.distanceTo(referencePoint || new ThreeVector3()));
  const direction = ndcPoint.unproject(camera).sub(camera.position).normalize();
  return camera.position.clone().add(direction.multiplyScalar(distance));
};

const getGripMarkerFallbackLabel = (marker = {}) => {
  const label = String(marker.shortLabel || marker.label || marker.id || '').trim();
  if (!label) return '?';
  if (/phalange/i.test(marker.id || '')) {
    const joint = String(marker.joint || '').trim();
    if (joint) return `${String(marker.finger || label).slice(0, 1).toUpperCase()}${joint}`;
  }
  return label.replace(/\s+/g, '').slice(0, 4).toUpperCase();
};

const getGripMarkerFallbackConfig = (marker = {}) => {
  if (marker.type !== 'armor') return WEAPON_GRIP_MARKER_COLORS.right;
  if (marker.group === 'phalanges') {
    return { fill: '#d946ef', stroke: '#fae8ff', text: '#2e1036', label: getGripMarkerFallbackLabel(marker) };
  }
  if (String(marker.id || '').startsWith('left-')) {
    return { fill: '#14b8a6', stroke: '#ccfbf1', text: '#042f2e', label: getGripMarkerFallbackLabel(marker) };
  }
  if (String(marker.id || '').startsWith('right-')) {
    return { fill: '#60a5fa', stroke: '#dbeafe', text: '#082f49', label: getGripMarkerFallbackLabel(marker) };
  }
  return { fill: '#64748b', stroke: '#f8fafc', text: '#ffffff', label: getGripMarkerFallbackLabel(marker) };
};

const createWeaponGripMarkerTexture = (marker = 'right') => {
  const markerKey = typeof marker === 'string' ? marker : getGripMarkerKey(marker);
  const config = WEAPON_GRIP_MARKER_COLORS[markerKey] || getGripMarkerFallbackConfig(marker);
  const markerLabel = String(config.label || '?').slice(0, 4);
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = 'rgba(0,0,0,.42)';
  context.shadowBlur = 12;
  context.shadowOffsetY = 4;
  context.beginPath();
  context.arc(48, 48, 30, 0, Math.PI * 2);
  context.fillStyle = config.fill;
  context.fill();
  context.shadowColor = 'transparent';
  context.lineWidth = 7;
  context.strokeStyle = config.stroke;
  context.stroke();
  const fontSize = markerLabel.length >= 4 ? 23 : (markerLabel.length === 3 ? 29 : 38);
  context.font = `900 ${fontSize}px system-ui, sans-serif`;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = config.text;
  context.fillText(markerLabel, 48, 50);
  const texture = new ThreeCanvasTexture(canvas);
  texture.colorSpace = ThreeSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const createWeaponGripMarker = (marker = {}) => {
  const texture = createWeaponGripMarkerTexture(marker);
  const material = new ThreeSpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: marker.enabled ? 1 : 0.42,
  });
  const sprite = new ThreeSprite(material);
  sprite.name = marker.type === 'armor'
    ? `ArmorGripMarker${marker.id || 'Point'}`
    : (marker.type === 'shield'
      ? `ShieldGripMarker${marker.id === 'elbow' ? 'Elbow' : 'Hand'}`
      : (marker.hand === 'left' ? 'WeaponGripMarkerLeft' : 'WeaponGripMarkerRight'));
  sprite.renderOrder = 200;
  sprite.userData.weaponGripMarker = true;
  sprite.userData.gripMarkerType = marker.type === 'armor' ? 'armor' : (marker.type === 'shield' ? 'shield' : 'weapon');
  sprite.userData.gripMarkerId = marker.type === 'armor'
    ? (marker.id || 'lower-belly')
    : (marker.type === 'shield' ? (marker.id || 'hand') : (marker.hand === 'left' ? 'left' : 'right'));
  sprite.userData.weaponGripHand = marker.hand === 'left' ? 'left' : 'right';
  return sprite;
};

const disposeWeaponGripMarkers = (markers) => {
  markers?.forEach?.((marker) => {
    marker.material?.map?.dispose?.();
    marker.material?.dispose?.();
    marker.parent?.remove?.(marker);
  });
  markers?.clear?.();
};

const disposeRigCutPreviewObjects = (objects) => {
  const restoredMeshes = new Set();
  objects?.forEach?.((object) => {
    const sourceMesh = object.userData?.rigCutSourceMesh;
    if (sourceMesh && !restoredMeshes.has(sourceMesh)) {
      if (sourceMesh.userData?.rigCutPreviewOriginalVisible !== undefined) {
        sourceMesh.visible = sourceMesh.userData.rigCutPreviewOriginalVisible;
        delete sourceMesh.userData.rigCutPreviewOriginalVisible;
      }
      restoredMeshes.add(sourceMesh);
    }
    object.geometry?.dispose?.();
    object.userData?.rigCutColorMaterial?.dispose?.();
    const realMaterial = object.userData?.rigCutObjectMaterial;
    if (Array.isArray(realMaterial)) realMaterial.forEach((material) => material?.dispose?.());
    else realMaterial?.dispose?.();
    object.parent?.remove?.(object);
  });
  objects?.clear?.();
};

const disposeArmorCutContourObjects = (objects) => {
  objects?.forEach?.((object) => {
    object.geometry?.dispose?.();
    object.material?.dispose?.();
    object.parent?.remove?.(object);
  });
  objects?.clear?.();
};

const disposeArmorPaintBrushPreview = (preview = null) => {
  if (!preview) return;
  preview.traverse?.((object) => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach((material) => material?.dispose?.());
    else object.material?.dispose?.();
  });
  preview.parent?.remove?.(preview);
};

const disposeArmorManipulationGuides = (objects) => {
  objects?.forEach?.((object) => {
    object.geometry?.dispose?.();
    object.material?.dispose?.();
    object.parent?.remove?.(object);
  });
  objects?.clear?.();
};

const applyArmorPaintStencilToMaterial = (material = null) => {
  if (!material) return;
  material.stencilWrite = true;
  material.stencilRef = ARMOR_PAINT_STENCIL_REF;
  material.stencilFunc = ThreeAlwaysStencilFunc;
  material.stencilFail = ThreeKeepStencilOp;
  material.stencilZFail = ThreeKeepStencilOp;
  material.stencilZPass = ThreeReplaceStencilOp;
  material.stencilFuncMask = ARMOR_PAINT_STENCIL_MASK;
  material.stencilWriteMask = ARMOR_PAINT_STENCIL_MASK;
  material.needsUpdate = true;
};

const applyArmorPaintStencilMask = (decorObject = null) => {
  const modelObject = decorObject?.userData?.decorModelObject || decorObject;
  modelObject?.traverse?.((child) => {
    if (
      (!child.isMesh && !child.isSkinnedMesh)
      || child.userData?.rigCutPaint
      || child.userData?.rigCutContour
      || child.userData?.weaponGripMarker
    ) {
      return;
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(applyArmorPaintStencilToMaterial);
  });
};

const createRigCutPreviewMaterial = (segment = 'body') => {
  const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
  return new ThreeMeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: ThreeDoubleSide,
  });
};

const cloneRigCutObjectMaterial = (material) => {
  if (Array.isArray(material)) return material.map((entry) => cloneRigCutObjectMaterial(entry));
  if (!material?.clone) return material;
  const clone = material.clone();
  clone.transparent = false;
  clone.opacity = 1;
  clone.depthWrite = true;
  clone.depthTest = true;
  clone.polygonOffset = false;
  clone.side = ThreeDoubleSide;
  return clone;
};

const setRigCutSourceVisible = (sourceMesh = null, visible = true) => {
  if (!sourceMesh) return;
  if (sourceMesh.userData.rigCutPreviewOriginalVisible === undefined) {
    sourceMesh.userData.rigCutPreviewOriginalVisible = sourceMesh.visible;
  }
  sourceMesh.visible = visible ? sourceMesh.userData.rigCutPreviewOriginalVisible !== false : false;
};

const updateRigCutPreviewMaterial = (object, segment = 'body', activeSegment = '', mode = 'cut') => {
  const colorMaterial = object.userData?.rigCutColorMaterial || object.material;
  const objectMaterial = object.userData?.rigCutObjectMaterial || colorMaterial;
  object.material = mode === 'object' ? objectMaterial : colorMaterial;
  if (mode === 'object') return;
  const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
  object.material.color.set(config.color);
  const paintGuide = mode === 'paint-guide';
  object.material.opacity = activeSegment === segment
    ? (paintGuide ? ARMOR_CUT_PAINT_GUIDE_ACTIVE_OPACITY : config.activeOpacity)
    : (paintGuide ? ARMOR_CUT_PAINT_GUIDE_IDLE_OPACITY : config.opacity);
};

const getBufferAttributeComponent = (attribute, vertexIndex, component) => {
  if (!attribute) return 0;
  if (component === 0 && attribute.getX) return attribute.getX(vertexIndex);
  if (component === 1 && attribute.getY) return attribute.getY(vertexIndex);
  if (component === 2 && attribute.getZ) return attribute.getZ(vertexIndex);
  if (component === 3 && attribute.getW) return attribute.getW(vertexIndex);
  const array = attribute.array || attribute.data?.array;
  return array?.[(vertexIndex * attribute.itemSize) + component] ?? 0;
};

const getRigCutTriangleMaterialIndex = (geometry = null, triangleStart = 0) => {
  const groups = Array.isArray(geometry?.groups) ? geometry.groups : [];
  const group = groups.find((entry) => triangleStart >= entry.start && triangleStart < entry.start + entry.count);
  return Number.isInteger(group?.materialIndex) ? group.materialIndex : 0;
};

const createRigCutGeometryBuilder = (geometry = null) => {
  const attributeNames = Object.keys(geometry?.attributes || {});
  return {
    attributeNames,
    attributes: Object.fromEntries(attributeNames.map((name) => [name, []])),
    groups: [],
    vertexCount: 0,
    triangleCount: 0,
  };
};

const appendRigCutVertex = (builder, geometry, vertexIndex) => {
  builder.attributeNames.forEach((name) => {
    const attribute = geometry.attributes[name];
    const output = builder.attributes[name];
    for (let offset = 0; offset < attribute.itemSize; offset += 1) {
      output.push(getBufferAttributeComponent(attribute, vertexIndex, offset));
    }
  });
  builder.vertexCount += 1;
};

const appendRigCutTriangle = (builder, geometry, vertexIndices, materialIndex = 0) => {
  const group = builder.groups[builder.groups.length - 1];
  if (group && group.start + group.count === builder.vertexCount && group.materialIndex === materialIndex) {
    group.count += 3;
  } else {
    builder.groups.push({ start: builder.vertexCount, count: 3, materialIndex });
  }
  vertexIndices.forEach((vertexIndex) => appendRigCutVertex(builder, geometry, vertexIndex));
  builder.triangleCount += 1;
};

const buildRigCutGeometry = (sourceGeometry = null, builder = null) => {
  const positionValues = builder?.attributes?.position || [];
  if (!sourceGeometry || !builder || positionValues.length < 9) return null;
  const geometry = new ThreeBufferGeometry();
  builder.attributeNames.forEach((name) => {
    const attribute = sourceGeometry.attributes[name];
    const values = builder.attributes[name];
    if (!attribute || !values?.length) return;
    const ArrayCtor = attribute.array?.constructor || attribute.data?.array?.constructor || Float32Array;
    geometry.setAttribute(name, new ThreeBufferAttribute(new ArrayCtor(values), attribute.itemSize, attribute.normalized));
  });
  builder.groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const getArmorPaintTriangleSetKey = (mesh = null, segment = 'body') => (
  `${mesh?.uuid || 'mesh'}:${normalizeArmorContourSegment(segment)}`
);

const getArmorPaintTriangleSet = (paintedTriangleKeys = null, mesh = null, segment = 'body') => {
  if (!paintedTriangleKeys) return null;
  const key = getArmorPaintTriangleSetKey(mesh, segment);
  if (!paintedTriangleKeys.has(key)) paintedTriangleKeys.set(key, new Set());
  return paintedTriangleKeys.get(key);
};

const createArmorCutPaintSurfaceMesh = ({
  geometry,
  segment = 'body',
  activeSegment = 'body',
  sectionPlane = null,
  name = 'ArmorCutPaintSurface',
}) => {
  if (!geometry) return null;
  const normalizedSegment = normalizeArmorContourSegment(segment);
  const config = ARMOR_CUT_PREVIEW_COLORS[normalizedSegment] || ARMOR_CUT_PREVIEW_COLORS.body;
  const material = new ThreeMeshBasicMaterial({
    color: config.color,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -10,
    polygonOffsetUnits: -10,
    side: ThreeDoubleSide,
    transparent: true,
    opacity: activeSegment === normalizedSegment ? ARMOR_PAINT_ACTIVE_OPACITY : ARMOR_PAINT_IDLE_OPACITY,
  });
  const paintSurface = new ThreeMesh(geometry, material);
  paintSurface.name = name;
  paintSurface.frustumCulled = false;
  paintSurface.renderOrder = 238;
  paintSurface.userData.rigCutPaint = true;
  paintSurface.userData.rigCutSegment = normalizedSegment;
  applyArmorSectionClipping(paintSurface, sectionPlane);
  return paintSurface;
};

const getArmorPaintSurfaceOffset = (radius = ARMOR_PAINT_RADIUS) => (
  ThreeMathUtils.clamp(
    normalizeArmorPaintRadius(radius) * ARMOR_PAINT_SURFACE_OFFSET_RATIO,
    ARMOR_PAINT_SURFACE_OFFSET_MIN,
    ARMOR_PAINT_SURFACE_OFFSET_MAX,
  )
);

const appendArmorPaintStamp = (entriesBySegment, point = {}, segment = 'body', radius = ARMOR_PAINT_RADIUS, normal = null) => {
  const normalizedSegment = normalizeArmorContourSegment(segment);
  const stampNormal = normal?.clone?.() || getArmorPaintSurfaceNormal(point) || new ThreeVector3(0, 0, 1);
  if (stampNormal.lengthSq() <= 0.000001) stampNormal.set(0, 0, 1);
  stampNormal.normalize();
  const normalizedRadius = normalizeArmorPaintRadius(radius);
  const x = Number(point.x) || 0;
  const y = Number(point.y) || 0;
  const z = Number(point.z) || 0;
  const entries = entriesBySegment[normalizedSegment];
  const previous = entries?.[entries.length - 1];
  const minDistance = Math.max(normalizedRadius * ARMOR_PAINT_STAMP_DEDUP_RATIO, 0.014);
  if (previous && Math.hypot(previous.x - x, previous.y - y, previous.z - z) < minDistance) return;
  entries?.push({
    x,
    y,
    z,
    radius: normalizedRadius,
    normal: stampNormal,
  });
};

const collectArmorPaintStamps = (paintStrokes = []) => {
  const entriesBySegment = { body: [], 'left-arm': [], 'right-arm': [] };
  prepareArmorPaintStrokes(paintStrokes).forEach((stroke) => {
    const segment = normalizeArmorContourSegment(stroke.segment);
    const radius = normalizeArmorPaintRadius(stroke.radius);
    const points = Array.isArray(stroke.points) ? stroke.points : [];
    if (!points.length) return;
    appendArmorPaintStamp(entriesBySegment, points[0], segment, radius);
    const spacing = Math.max(radius * ARMOR_PAINT_STAMP_SPACING_RATIO, 0.018);
    for (let index = 1; index < points.length; index += 1) {
      const start = points[index - 1];
      const end = points[index];
      const dx = (Number(end.x) || 0) - (Number(start.x) || 0);
      const dy = (Number(end.y) || 0) - (Number(start.y) || 0);
      const dz = (Number(end.z) || 0) - (Number(start.z) || 0);
      const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy, dz) / spacing));
      for (let step = 1; step <= steps; step += 1) {
        const t = step / steps;
        const normal = getInterpolatedArmorPaintNormal(start, end, t);
        appendArmorPaintStamp(entriesBySegment, {
          x: (Number(start.x) || 0) + dx * t,
          y: (Number(start.y) || 0) + dy * t,
          z: (Number(start.z) || 0) + dz * t,
        }, segment, radius, normal);
      }
    }
  });
  return entriesBySegment;
};

const createArmorPaintStampMesh = (segment = 'body', stamps = [], activeSegment = 'body', basePosition = new ThreeVector3()) => {
  if (!stamps.length) return null;
  const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
  const geometry = new ThreeCircleGeometry(1, ARMOR_PAINT_STAMP_SEGMENTS);
  const material = new ThreeMeshStandardMaterial({
    color: config.color,
    depthTest: true,
    depthWrite: false,
    metalness: 0.04,
    polygonOffset: true,
    polygonOffsetFactor: -8,
    polygonOffsetUnits: -8,
    roughness: 0.82,
    side: ThreeDoubleSide,
    stencilWrite: true,
    stencilRef: ARMOR_PAINT_STENCIL_REF,
    stencilFunc: ThreeEqualStencilFunc,
    stencilFuncMask: ARMOR_PAINT_STENCIL_MASK,
    stencilWriteMask: 0x00,
    stencilFail: ThreeKeepStencilOp,
    stencilZFail: ThreeKeepStencilOp,
    stencilZPass: ThreeKeepStencilOp,
    transparent: true,
    opacity: activeSegment === segment ? ARMOR_PAINT_ACTIVE_OPACITY : ARMOR_PAINT_IDLE_OPACITY,
  });
  const mesh = new ThreeInstancedMesh(geometry, material, stamps.length);
  const matrix = new ThreeMatrix4();
  const position = new ThreeVector3();
  const quaternion = new ThreeQuaternion();
  const scale = new ThreeVector3();
  const forward = new ThreeVector3(0, 0, 1);
  stamps.forEach((stamp, index) => {
    const normal = stamp.normal?.clone?.() || forward.clone();
    if (normal.lengthSq() <= 0.000001) normal.copy(forward);
    normal.normalize();
    const offset = getArmorPaintSurfaceOffset(stamp.radius);
    position.set(
      basePosition.x + stamp.x + normal.x * offset,
      basePosition.y + stamp.y + normal.y * offset,
      basePosition.z + stamp.z + normal.z * offset,
    );
    quaternion.setFromUnitVectors(forward, normal);
    scale.set(stamp.radius, stamp.radius, 1);
    matrix.compose(position, quaternion, scale);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.name = `ArmorCutPaintStamps-${segment}`;
  mesh.frustumCulled = false;
  mesh.renderOrder = 238;
  mesh.userData.rigCutPaint = true;
  mesh.userData.rigCutSegment = segment;
  return mesh;
};

const updateArmorCutPaintObjectsAppearance = (objects, activeSegment = 'body', sectionPlane = null) => {
  objects?.forEach?.((object) => {
    const segment = normalizeArmorContourSegment(object.userData?.rigCutSegment);
    const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
    object.material?.color?.set?.(config.color);
    if (object.material) {
      object.material.opacity = activeSegment === segment ? ARMOR_PAINT_ACTIVE_OPACITY : ARMOR_PAINT_IDLE_OPACITY;
    }
    applyArmorSectionClipping(object, sectionPlane);
  });
};

const getPointToSegmentDistance = (point, start, end) => {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 0.000001) return point.distanceTo(start);
  const t = ThreeMathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
  return point.distanceTo(start.clone().add(segment.multiplyScalar(t)));
};

const isPointInsideArmorTorso = (point, leftShoulder, rightShoulder, lowerBelly, referenceScale = 1) => {
  const minShoulderX = Math.min(leftShoulder.x, rightShoulder.x);
  const maxShoulderX = Math.max(leftShoulder.x, rightShoulder.x);
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const torsoHeight = Math.max(0.0001, shoulderY - lowerBelly.y);
  const t = ThreeMathUtils.clamp((point.y - lowerBelly.y) / torsoHeight, 0, 1);
  const shoulderWidth = Math.max(0.0001, maxShoulderX - minShoulderX);
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const topHalfWidth = Math.max(referenceScale * 0.16, shoulderWidth * 0.37);
  const bottomHalfWidth = Math.max(referenceScale * 0.22, shoulderWidth * 0.48);
  const leftEdge = ThreeMathUtils.lerp(lowerBelly.x - bottomHalfWidth, shoulderCenterX - topHalfWidth, t);
  const rightEdge = ThreeMathUtils.lerp(lowerBelly.x + bottomHalfWidth, shoulderCenterX + topHalfWidth, t);
  const margin = Math.max(referenceScale * 0.04, shoulderWidth * 0.055);
  return point.x >= leftEdge - margin && point.x <= rightEdge + margin;
};

const getArmorArmCutCandidate = (point, shoulder, elbow, bodyCenter, segment, fallbackSign, referenceScale = 1) => {
  const sideSign = Math.sign(((shoulder.x + elbow.x) / 2) - bodyCenter.x) || fallbackSign;
  const shoulderWidth = Math.abs(shoulder.x - bodyCenter.x) * 2;
  const bodyEdgeX = bodyCenter.x + sideSign * Math.max(referenceScale * 0.16, shoulderWidth * 0.36);
  if ((point.x - bodyEdgeX) * sideSign <= 0) return null;
  const lineLength = shoulder.distanceTo(elbow);
  const upperPadding = Math.max(referenceScale * 0.08, lineLength * 0.2);
  const lowerPadding = Math.max(referenceScale * 0.025, lineLength * 0.08);
  if (point.y < Math.min(shoulder.y, elbow.y) - lowerPadding || point.y > Math.max(shoulder.y, elbow.y) + upperPadding) return null;
  const lineDistance = getPointToSegmentDistance(point, shoulder, elbow);
  const maxLineDistance = Math.max(referenceScale * 0.18, lineLength * 0.72);
  if (lineDistance > maxLineDistance) return null;
  return { segment, score: lineDistance - Math.abs((point.x - bodyEdgeX) * 0.15) };
};

const getLeggingsLegCutCandidate = (point, groin, knee, foot, segment, fallbackSign, referenceScale = 1) => {
  if (!groin || !knee || !foot) return null;
  const sideSign = Math.sign(((groin.x + knee.x + foot.x) / 3)) || fallbackSign;
  const legTop = Math.max(groin.y, knee.y, foot.y);
  const legBottom = Math.min(groin.y, knee.y, foot.y);
  const legLength = Math.max(0.0001, groin.distanceTo(foot), groin.distanceTo(knee));
  const yPadding = Math.max(referenceScale * 0.08, legLength * 0.12);
  if (point.y > legTop + yPadding || point.y < legBottom - yPadding) return null;
  const upperDistance = getPointToSegmentDistance(point, groin, knee);
  const lowerDistance = getPointToSegmentDistance(point, knee, foot);
  const lineDistance = Math.min(upperDistance, lowerDistance);
  const maxLineDistance = Math.max(referenceScale * 0.2, legLength * 0.42);
  if (lineDistance > maxLineDistance) return null;
  const centerX = (groin.x + knee.x + foot.x) / 3;
  return { segment, score: lineDistance - Math.abs((point.x - centerX) * sideSign * 0.04) };
};

const classifyLeggingsCutPoint = (point = new ThreeVector3(), markerOffsets = {}) => {
  const leftGroin = markerOffsets.leftGroinFold;
  const rightGroin = markerOffsets.rightGroinFold;
  const leftKnee = markerOffsets.leftKnee;
  const rightKnee = markerOffsets.rightKnee;
  const leftFoot = markerOffsets.leftFoot;
  const rightFoot = markerOffsets.rightFoot;
  const referenceScale = Math.max(
    0.001,
    leftGroin.distanceTo(leftFoot),
    rightGroin.distanceTo(rightFoot),
    leftGroin.distanceTo(rightGroin),
  );
  const candidates = [
    getLeggingsLegCutCandidate(point, leftGroin, leftKnee, leftFoot, 'left-arm', -1, referenceScale),
    getLeggingsLegCutCandidate(point, rightGroin, rightKnee, rightFoot, 'right-arm', 1, referenceScale),
  ].filter(Boolean).sort((a, b) => a.score - b.score);
  if (candidates[0]) return candidates[0].segment;
  const midX = (leftGroin.x + rightGroin.x + leftFoot.x + rightFoot.x) / 4;
  const legTop = Math.max(leftGroin.y, rightGroin.y);
  const legBottom = Math.min(leftFoot.y, rightFoot.y);
  if (point.y <= legTop + referenceScale * 0.18 && point.y >= legBottom - referenceScale * 0.18) {
    return point.x <= midX ? 'left-arm' : 'right-arm';
  }
  return 'body';
};

const classifyArmorCutPoint = (point = new ThreeVector3(), markerOffsets = {}, contours = [], paintStrokes = []) => {
  const paintSegment = classifyArmorPaintPoint(point, paintStrokes);
  if (paintSegment) return paintSegment;
  const contourSegment = classifyArmorContourPoint(point, contours);
  if (contourSegment) return contourSegment;
  if (markerOffsets.isLeggingsRig) return classifyLeggingsCutPoint(point, markerOffsets);
  const leftShoulder = markerOffsets.leftShoulder || new ThreeVector3(-0.45, 0.55, 0);
  const rightShoulder = markerOffsets.rightShoulder || new ThreeVector3(0.45, 0.55, 0);
  const leftElbow = markerOffsets.leftElbow || new ThreeVector3(-0.65, 0.05, 0);
  const rightElbow = markerOffsets.rightElbow || new ThreeVector3(0.65, 0.05, 0);
  const lowerBelly = markerOffsets.lowerBelly || new ThreeVector3(0, -0.55, 0);
  const referenceScale = Math.max(
    0.001,
    leftShoulder.distanceTo(rightShoulder),
    leftShoulder.distanceTo(lowerBelly),
    rightShoulder.distanceTo(lowerBelly),
  );
  const bodyCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5).lerp(lowerBelly, 0.38);
  const candidates = [
    getArmorArmCutCandidate(point, leftShoulder, leftElbow, bodyCenter, 'left-arm', -1, referenceScale),
    getArmorArmCutCandidate(point, rightShoulder, rightElbow, bodyCenter, 'right-arm', 1, referenceScale),
  ].filter(Boolean).sort((a, b) => a.score - b.score);
  if (candidates[0]) return candidates[0].segment;
  if (isPointInsideArmorTorso(point, leftShoulder, rightShoulder, lowerBelly, referenceScale)) return 'body';
  return 'body';
};

const getArmorCutMarkerOffsets = (markers = []) => {
  const markerById = new Map(markers.map((marker) => [marker.id, marker]));
  const get = (id, fallback) => (
    markerById.has(id)
      ? getWeaponGripMarkerPosition({ ...markerById.get(id), type: 'armor' })
      : fallback
  );
  return {
    isLeggingsRig: hasLeggingsRigMarkers(markers),
    leftShoulder: get('left-shoulder', new ThreeVector3(-0.45, 0.55, 0)),
    rightShoulder: get('right-shoulder', new ThreeVector3(0.45, 0.55, 0)),
    leftElbow: get('left-elbow', new ThreeVector3(-0.65, 0.05, 0)),
    rightElbow: get('right-elbow', new ThreeVector3(0.65, 0.05, 0)),
    lowerBelly: get('lower-belly', new ThreeVector3(0, -0.55, 0)),
    leftGroinFold: get('left-groin-fold', new ThreeVector3(-0.22, -0.38, 0.05)),
    rightGroinFold: get('right-groin-fold', new ThreeVector3(0.22, -0.38, 0.05)),
    leftKnee: get('left-knee', new ThreeVector3(-0.25, -0.72, 0.05)),
    rightKnee: get('right-knee', new ThreeVector3(0.25, -0.72, 0.05)),
    leftFoot: get('left-foot', new ThreeVector3(-0.22, -1.05, 0.1)),
    rightFoot: get('right-foot', new ThreeVector3(0.22, -1.05, 0.1)),
  };
};

const getArmorCutSignature = (modelObject = null, markers = [], contours = []) => {
  const meshSignature = [];
  modelObject?.traverse?.((child) => {
    if (child.isMesh && child.geometry?.attributes?.position) {
      meshSignature.push(`${child.uuid}:${child.geometry.uuid}:${child.geometry.attributes.position.count}`);
    }
  });
  const markerSignature = markers
    .map((marker) => `${marker.id}:${Number(marker.x).toFixed(3)}:${Number(marker.y).toFixed(3)}:${Number(marker.z).toFixed(3)}:${marker.enabled !== false ? 1 : 0}`)
    .join('|');
  return `${meshSignature.join(';')}|${markerSignature}|${JSON.stringify(normalizeArmorCutContours(contours))}`;
};

const buildArmorCutPreviewMeshes = ({ root, objects, decorObject, markers, contours }) => {
  const gripSpace = getDecorGripSpace(decorObject);
  const modelObject = gripSpace?.modelObject;
  if (!root || !modelObject?.traverse || !gripSpace?.space) return false;
  const markerOffsets = getArmorCutMarkerOffsets(markers);
  const sourceMeshes = [];
  modelObject.updateMatrixWorld?.(true);
  gripSpace.space.updateMatrixWorld?.(true);
  modelObject.traverse((child) => {
    if (child.isMesh && child.geometry?.attributes?.position && !child.userData?.weaponGripMarker) {
      sourceMeshes.push(child);
    }
  });
  sourceMeshes.forEach((mesh) => {
    const geometry = mesh.geometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    const builders = {
      body: createRigCutGeometryBuilder(geometry),
      'left-arm': createRigCutGeometryBuilder(geometry),
      'right-arm': createRigCutGeometryBuilder(geometry),
    };
    const triangleLimit = index ? index.count : position.count;
    const localCenter = new ThreeVector3();
    const worldCenter = new ThreeVector3();
    const gripPoint = new ThreeVector3();
    mesh.updateMatrixWorld?.(true);
    for (let triangleStart = 0; triangleStart + 2 < triangleLimit; triangleStart += 3) {
      const vertexIndices = index
        ? [index.getX(triangleStart), index.getX(triangleStart + 1), index.getX(triangleStart + 2)]
        : [triangleStart, triangleStart + 1, triangleStart + 2];
      localCenter.set(0, 0, 0);
      vertexIndices.forEach((vertexIndex) => {
        localCenter.x += position.getX(vertexIndex);
        localCenter.y += position.getY(vertexIndex);
        localCenter.z += position.getZ(vertexIndex);
      });
      localCenter.multiplyScalar(1 / 3);
      worldCenter.copy(localCenter);
      mesh.localToWorld(worldCenter);
      gripPoint.copy(worldCenter);
      gripSpace.space.worldToLocal(gripPoint);
      gripPoint.sub(gripSpace.modelObject.position);
      const segment = classifyArmorCutPoint(gripPoint, markerOffsets, contours);
      appendRigCutTriangle(builders[segment], geometry, vertexIndices, getRigCutTriangleMaterialIndex(geometry, triangleStart));
    }
    Object.entries(builders).forEach(([segment, builder]) => {
      const splitGeometry = buildRigCutGeometry(geometry, builder);
      if (!splitGeometry) return;
      const colorMaterial = createRigCutPreviewMaterial(segment);
      const overlay = new ThreeMesh(splitGeometry, colorMaterial);
      overlay.name = `ArmorCutPreviewSurface-${segment}`;
      overlay.matrixAutoUpdate = false;
      overlay.frustumCulled = false;
      overlay.renderOrder = 170;
      overlay.userData.rigCutSourceMesh = mesh;
      overlay.userData.rigCutSegment = segment;
      overlay.userData.rigCutColorMaterial = colorMaterial;
      overlay.userData.rigCutObjectMaterial = cloneRigCutObjectMaterial(mesh.material);
      root.add(overlay);
      objects.set(`${mesh.uuid}:${segment}`, overlay);
    });
  });
  return objects.size > 0;
};

const buildArmorCutContourObjects = ({ objects, decorObject, contours, activeSegment }) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace?.space || !gripSpace?.modelObject) return false;
  const normalizedContours = normalizeArmorCutContours(contours);
  normalizedContours.forEach((entry) => {
    const config = ARMOR_CUT_PREVIEW_COLORS[entry.segment] || ARMOR_CUT_PREVIEW_COLORS.body;
    const basePosition = gripSpace.modelObject.position;
    const points = entry.points.map((point) => new ThreeVector3(
      basePosition.x + point.x,
      basePosition.y + point.y,
      basePosition.z + point.z,
    ));
    if (points.length >= 2) {
      const closed = points.length >= 3;
      const curve = new ThreeCatmullRomCurve3(points, closed);
      const geometry = new ThreeTubeGeometry(curve, Math.max(12, points.length * 4), 0.022, 8, closed);
      const material = new ThreeMeshBasicMaterial({
        color: config.color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: activeSegment === entry.segment ? 0.95 : 0.52,
      });
      const line = new ThreeMesh(geometry, material);
      line.name = `ArmorCutContour-${entry.segment}`;
      line.renderOrder = 230;
      line.userData.rigCutContour = true;
      line.userData.rigCutSegment = entry.segment;
      gripSpace.space.add(line);
      objects.set(`${entry.segment}:line`, line);
    }
    const pointGeometry = new ThreeBufferGeometry().setFromPoints(points);
    const pointMaterial = new ThreePointsMaterial({
      color: config.color,
      depthTest: false,
      depthWrite: false,
      size: activeSegment === entry.segment ? 0.075 : 0.052,
      sizeAttenuation: true,
      transparent: true,
      opacity: activeSegment === entry.segment ? 1 : 0.62,
    });
    const pointCloud = new ThreePoints(pointGeometry, pointMaterial);
    pointCloud.name = `ArmorCutContourPoints-${entry.segment}`;
    pointCloud.renderOrder = 231;
    pointCloud.userData.rigCutContour = true;
    pointCloud.userData.rigCutSegment = entry.segment;
    gripSpace.space.add(pointCloud);
    objects.set(`${entry.segment}:points`, pointCloud);
  });
  return objects.size > 0;
};

const updateArmorCutContourObjectsAppearance = (objects, activeSegment = 'body') => {
  objects?.forEach?.((object) => {
    const segment = normalizeArmorContourSegment(object.userData?.rigCutSegment);
    const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
    if (!object.material) return;
    object.material.color?.set?.(config.color);
    if (object.isPoints) {
      object.material.size = activeSegment === segment ? 0.075 : 0.052;
      object.material.opacity = activeSegment === segment ? 1 : 0.62;
    } else {
      object.material.opacity = activeSegment === segment ? 0.95 : 0.52;
    }
  });
};

const createArmorPaintBrushPreview = (segment = 'body') => {
  const config = ARMOR_CUT_PREVIEW_COLORS[normalizeArmorContourSegment(segment)] || ARMOR_CUT_PREVIEW_COLORS.body;
  const group = new ThreeGroup();
  group.name = 'ArmorPaintBrushPreview';
  group.userData.previewSegment = normalizeArmorContourSegment(segment);
  group.visible = false;

  const ring = new ThreeMesh(
    new ThreeRingGeometry(0.985, 1.015, 64),
    new ThreeMeshBasicMaterial({
      color: config.color,
      depthTest: true,
      depthWrite: false,
      side: ThreeDoubleSide,
      transparent: true,
      opacity: 0.82,
    }),
  );
  ring.name = 'ArmorPaintBrushPreviewRing';
  ring.frustumCulled = false;
  ring.position.z = 0.004;
  ring.renderOrder = 246;
  group.add(ring);
  group.userData.previewRing = ring;

  return group;
};

const updateArmorPaintBrushPreviewAppearance = (preview = null, radius = ARMOR_PAINT_RADIUS, segment = 'body') => {
  if (!preview) return;
  const previewRadius = normalizeArmorPaintRadius(radius);
  const previewSegment = normalizeArmorContourSegment(segment);
  const config = ARMOR_CUT_PREVIEW_COLORS[previewSegment] || ARMOR_CUT_PREVIEW_COLORS.body;
  const ring = preview.userData?.previewRing;
  if (ring) {
    ring.scale.setScalar(previewRadius);
    ring.material?.color?.set?.(config.color);
  }
  preview.userData.previewRadius = previewRadius;
  preview.userData.previewSegment = previewSegment;
};

const projectWorldPointToCanvas = (worldPoint = null, camera = null, renderer = null) => {
  const canvas = renderer?.domElement;
  if (!worldPoint || !camera || !canvas) return null;
  const width = canvas.clientWidth || canvas.width || 0;
  const height = canvas.clientHeight || canvas.height || 0;
  if (width <= 0 || height <= 0) return null;
  const projected = worldPoint.clone().project(camera);
  if (
    !Number.isFinite(projected.x)
    || !Number.isFinite(projected.y)
    || !Number.isFinite(projected.z)
    || projected.z < -1
    || projected.z > 1
  ) {
    return null;
  }
  return {
    x: ((projected.x + 1) / 2) * width,
    y: ((1 - projected.y) / 2) * height,
    z: projected.z,
  };
};

const getArmorPaintBrushScreenCircle = ({ gripSpace, point, radius, camera, renderer, segment }) => {
  if (!gripSpace?.space || !gripSpace?.modelObject || !point || !camera || !renderer) return null;
  gripSpace.space.updateMatrixWorld?.(true);
  camera.updateMatrixWorld?.();
  const basePosition = gripSpace.modelObject.position || new ThreeVector3();
  const worldCenter = gripSpace.space.localToWorld(new ThreeVector3(
    basePosition.x + point.x,
    basePosition.y + point.y,
    basePosition.z + point.z,
  ));
  const center = projectWorldPointToCanvas(worldCenter, camera, renderer);
  if (!center) return null;

  const cameraRight = new ThreeVector3().setFromMatrixColumn(camera.matrixWorld, 0).normalize();
  const cameraUp = new ThreeVector3().setFromMatrixColumn(camera.matrixWorld, 1).normalize();
  const rightEdge = projectWorldPointToCanvas(worldCenter.clone().addScaledVector(cameraRight, radius), camera, renderer);
  const upEdge = projectWorldPointToCanvas(worldCenter.clone().addScaledVector(cameraUp, radius), camera, renderer);
  const radiusCandidates = [rightEdge, upEdge]
    .filter(Boolean)
    .map((edge) => Math.hypot(edge.x - center.x, edge.y - center.y))
    .filter((value) => Number.isFinite(value) && value > 0);
  const canvas = renderer.domElement;
  const canvasWidth = canvas.clientWidth || canvas.width || 0;
  const canvasHeight = canvas.clientHeight || canvas.height || 0;
  const maxRadius = Math.max(12, Math.min(canvasWidth, canvasHeight) * 0.38);
  return {
    x: center.x,
    y: center.y,
    radius: ThreeMathUtils.clamp(Math.max(...radiusCandidates, 10), 10, maxRadius),
    color: (ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body).color,
  };
};

const getArmorPaintBrushPointerCircle = ({ canvasPoint, radius, renderer, segment }) => {
  const canvas = renderer?.domElement;
  if (!canvasPoint || !canvas) return null;
  const canvasWidth = canvas.clientWidth || canvas.width || 0;
  const canvasHeight = canvas.clientHeight || canvas.height || 0;
  if (canvasWidth <= 0 || canvasHeight <= 0) return null;
  const maxRadius = Math.max(12, Math.min(canvasWidth, canvasHeight) * 0.32);
  return {
    x: ThreeMathUtils.clamp(canvasPoint.x, 0, canvasWidth),
    y: ThreeMathUtils.clamp(canvasPoint.y, 0, canvasHeight),
    radius: ThreeMathUtils.clamp(normalizeArmorPaintRadius(radius) * 220, 10, maxRadius),
    color: (ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body).color,
  };
};

const getArmorPaintTriangleCacheSignature = (mesh = null, gripSpace = null) => {
  const meshMatrix = mesh?.matrixWorld?.elements?.map((value) => Number(value).toFixed(5)).join(',');
  const gripMatrix = gripSpace?.space?.matrixWorld?.elements?.map((value) => Number(value).toFixed(5)).join(',');
  const basePosition = gripSpace?.modelObject?.position;
  return [
    mesh?.geometry?.uuid || '',
    mesh?.geometry?.attributes?.position?.count || 0,
    mesh?.geometry?.index?.count || 0,
    meshMatrix || '',
    gripMatrix || '',
    basePosition ? `${basePosition.x.toFixed(5)},${basePosition.y.toFixed(5)},${basePosition.z.toFixed(5)}` : '',
  ].join('|');
};

const getArmorPaintSpatialKey = (x = 0, y = 0, z = 0) => `${x}:${y}:${z}`;

const getArmorPaintSpatialCoord = (value = 0) => Math.floor(value / ARMOR_PAINT_SPATIAL_CELL_SIZE);

const buildArmorPaintTriangleCache = (mesh = null, gripSpace = null) => {
  const geometry = mesh?.geometry;
  const position = geometry?.attributes?.position;
  if (!mesh || !geometry || !position || !gripSpace?.space || !gripSpace?.modelObject) return null;
  const signature = getArmorPaintTriangleCacheSignature(mesh, gripSpace);
  const cached = mesh.userData?.armorPaintTriangleCache;
  if (cached?.signature === signature) return cached;

  const records = [];
  const grid = new Map();
  const index = geometry.index;
  const triangleLimit = index ? index.count : position.count;
  const localCenter = new ThreeVector3();
  const worldCenter = new ThreeVector3();
  const gripPoint = new ThreeVector3();
  mesh.updateMatrixWorld?.(true);
  gripSpace.space.updateMatrixWorld?.(true);
  const basePosition = gripSpace.modelObject.position || new ThreeVector3();

  for (let triangleStart = 0; triangleStart + 2 < triangleLimit; triangleStart += 3) {
    const vertexIndices = index
      ? [index.getX(triangleStart), index.getX(triangleStart + 1), index.getX(triangleStart + 2)]
      : [triangleStart, triangleStart + 1, triangleStart + 2];
    localCenter.set(0, 0, 0);
    vertexIndices.forEach((vertexIndex) => {
      localCenter.x += position.getX(vertexIndex);
      localCenter.y += position.getY(vertexIndex);
      localCenter.z += position.getZ(vertexIndex);
    });
    localCenter.multiplyScalar(1 / 3);
    worldCenter.copy(localCenter);
    mesh.localToWorld(worldCenter);
    gripPoint.copy(worldCenter);
    gripSpace.space.worldToLocal(gripPoint);
    gripPoint.sub(basePosition);
    const record = {
      triangleStart,
      vertexIndices,
      materialIndex: getRigCutTriangleMaterialIndex(geometry, triangleStart),
      point: gripPoint.clone(),
      worldPoint: worldCenter.clone(),
    };
    const recordIndex = records.push(record) - 1;
    const key = getArmorPaintSpatialKey(
      getArmorPaintSpatialCoord(record.point.x),
      getArmorPaintSpatialCoord(record.point.y),
      getArmorPaintSpatialCoord(record.point.z),
    );
    if (!grid.has(key)) grid.set(key, []);
    grid.get(key).push(recordIndex);
  }

  const nextCache = { signature, records, grid };
  mesh.userData.armorPaintTriangleCache = nextCache;
  return nextCache;
};

const queryArmorPaintTriangleCache = (cache = null, bounds = null) => {
  if (!cache?.records?.length) return [];
  if (!bounds) return cache.records;
  const minX = getArmorPaintSpatialCoord(bounds.minX);
  const maxX = getArmorPaintSpatialCoord(bounds.maxX);
  const minY = getArmorPaintSpatialCoord(bounds.minY);
  const maxY = getArmorPaintSpatialCoord(bounds.maxY);
  const minZ = getArmorPaintSpatialCoord(bounds.minZ);
  const maxZ = getArmorPaintSpatialCoord(bounds.maxZ);
  const seen = new Set();
  const records = [];
  for (let x = minX; x <= maxX; x += 1) {
    for (let y = minY; y <= maxY; y += 1) {
      for (let z = minZ; z <= maxZ; z += 1) {
        const bucket = cache.grid.get(getArmorPaintSpatialKey(x, y, z));
        if (!bucket) continue;
        bucket.forEach((recordIndex) => {
          if (seen.has(recordIndex)) return;
          seen.add(recordIndex);
          const record = cache.records[recordIndex];
          if (record && isPointInsideArmorPaintBounds(record.point, bounds)) records.push(record);
        });
      }
    }
  }
  return records;
};

const getArmorPaintSourceMeshes = (gripSpace = null) => {
  const sourceMeshes = [];
  gripSpace?.modelObject?.traverse?.((child) => {
    if (
      (child.isMesh || child.isSkinnedMesh)
      && child.geometry?.attributes?.position
      && !child.userData?.rigCutPaint
      && !child.userData?.rigCutContour
      && !child.userData?.weaponGripMarker
    ) {
      sourceMeshes.push(child);
    }
  });
  return sourceMeshes;
};

const warmArmorPaintTriangleCaches = (decorObject = null) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace?.space || !gripSpace?.modelObject) return;
  gripSpace.modelObject.updateMatrixWorld?.(true);
  gripSpace.space.updateMatrixWorld?.(true);
  getArmorPaintSourceMeshes(gripSpace).forEach((mesh) => {
    buildArmorPaintTriangleCache(mesh, gripSpace);
  });
};

const buildArmorCutPaintObjects = ({
  objects,
  paintedTriangleKeys = null,
  decorObject,
  paintStrokes,
  activeSegment,
  sectionPlane = null,
}) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace?.space || !gripSpace?.modelObject) return false;
  const preparedStrokes = prepareArmorPaintStrokes(paintStrokes);
  if (!preparedStrokes.length) return false;
  gripSpace.modelObject.updateMatrixWorld?.(true);
  gripSpace.space.updateMatrixWorld?.(true);
  const sourceMeshes = getArmorPaintSourceMeshes(gripSpace);
  sourceMeshes.forEach((mesh) => {
    const geometry = mesh.geometry;
    const triangleCache = buildArmorPaintTriangleCache(mesh, gripSpace);
    if (!triangleCache?.records?.length) return;
    const builders = {
      body: createRigCutGeometryBuilder(geometry),
      'left-arm': createRigCutGeometryBuilder(geometry),
      'right-arm': createRigCutGeometryBuilder(geometry),
    };
    const paintedTriangles = new Set();
    preparedStrokes.forEach((stroke) => {
      const segmentTriangleSet = getArmorPaintTriangleSet(paintedTriangleKeys, mesh, stroke.segment);
      const hits = getArmorPaintStrokeHits(stroke);
      hits.forEach((hit) => {
        const candidates = queryArmorPaintTriangleCache(triangleCache, hit.bounds);
        candidates.forEach((record) => {
          if (!record || paintedTriangles.has(record.triangleStart)) return;
          if (sectionPlane && sectionPlane.distanceToPoint(record.worldPoint) < -0.002) return;
          if (!isPointInsideArmorPaintHit(record.point, hit, stroke.radius)) return;
          paintedTriangles.add(record.triangleStart);
          segmentTriangleSet?.add(record.triangleStart);
          appendRigCutTriangle(
            builders[stroke.segment],
            geometry,
            record.vertexIndices,
            record.materialIndex,
          );
        });
      });
    });
    Object.entries(builders).forEach(([segment, builder]) => {
      const splitGeometry = buildRigCutGeometry(geometry, builder);
      if (!splitGeometry) return;
      const paintSurface = createArmorCutPaintSurfaceMesh({
        geometry: splitGeometry,
        segment,
        activeSegment,
        sectionPlane,
        name: `ArmorCutPaintSurface-${segment}`,
      });
      if (!paintSurface) return;
      mesh.add(paintSurface);
      objects.set(`${mesh.uuid}:${segment}:paint-surface`, paintSurface);
    });
  });
  return objects.size > 0;
};

const appendArmorCutPaintPatchObjects = ({
  objects,
  paintedTriangleKeys,
  decorObject,
  stroke,
  activeSegment,
  sectionPlane = null,
  patchId = 0,
}) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace?.space || !gripSpace?.modelObject || !stroke?.points?.length) return false;
  const preparedStroke = prepareArmorPaintStrokes([stroke])[0];
  if (!preparedStroke) return false;
  gripSpace.modelObject.updateMatrixWorld?.(true);
  gripSpace.space.updateMatrixWorld?.(true);
  let didAppend = false;
  getArmorPaintSourceMeshes(gripSpace).forEach((mesh) => {
    const geometry = mesh.geometry;
    const triangleCache = buildArmorPaintTriangleCache(mesh, gripSpace);
    if (!triangleCache?.records?.length) return;
    const builder = createRigCutGeometryBuilder(geometry);
    const segmentTriangleSet = getArmorPaintTriangleSet(paintedTriangleKeys, mesh, preparedStroke.segment);
    getArmorPaintStrokeHits(preparedStroke).forEach((hit) => {
      const candidates = queryArmorPaintTriangleCache(triangleCache, hit.bounds);
      candidates.forEach((record) => {
        if (!record || segmentTriangleSet?.has(record.triangleStart)) return;
        if (sectionPlane && sectionPlane.distanceToPoint(record.worldPoint) < -0.002) return;
        if (!isPointInsideArmorPaintHit(record.point, hit, preparedStroke.radius)) return;
        segmentTriangleSet?.add(record.triangleStart);
        appendRigCutTriangle(builder, geometry, record.vertexIndices, record.materialIndex);
      });
    });
    const patchGeometry = buildRigCutGeometry(geometry, builder);
    if (!patchGeometry) return;
    const segment = normalizeArmorContourSegment(preparedStroke.segment);
    const paintSurface = createArmorCutPaintSurfaceMesh({
      geometry: patchGeometry,
      segment,
      activeSegment,
      sectionPlane,
      name: `ArmorCutPaintPatch-${segment}-${patchId}`,
    });
    if (!paintSurface) return;
    mesh.add(paintSurface);
    objects.set(`${mesh.uuid}:${segment}:paint-patch:${patchId}`, paintSurface);
    didAppend = true;
  });
  return didAppend;
};

const getWeaponGripMarkerPosition = (marker = {}) => {
  let x = clampGripValue(marker.x);
  let y = clampGripValue(marker.y);
  let z = clampGripValue(marker.z);
  if (!marker.enabled && x === 0 && y === 0 && z === 0) {
    if (marker.type === 'armor') {
      x = Number.isFinite(Number(marker.defaultX)) ? Number(marker.defaultX) : 0;
      y = Number.isFinite(Number(marker.defaultY)) ? Number(marker.defaultY) : 0;
      z = Number.isFinite(Number(marker.defaultZ)) ? Number(marker.defaultZ) : 0;
    } else if (marker.type === 'shield') {
      y = marker.id === 'elbow' ? 0.35 : -0.35;
    } else {
      x = marker.hand === 'left' ? -0.08 : 0.08;
      y = -0.44;
    }
  }
  return new ThreeVector3(x, y, z);
};

const getArmorManipulationLineForMarker = (markerId = '', markers = []) => (
  getArmorManipulationLines(markers)
    .find((entry) => entry.shoulderId === markerId || entry.elbowId === markerId) || null
);

const roundGripVector = (vector = new ThreeVector3()) => ({
  x: roundGripValue(vector.x),
  y: roundGripValue(vector.y),
  z: roundGripValue(vector.z),
});

const constrainArmorManipulationMarkerPosition = (
  markerId = '',
  position = {},
  currentMarkers = [],
  referenceMarkers = currentMarkers,
) => {
  const line = getArmorManipulationLineForMarker(markerId, currentMarkers.length ? currentMarkers : referenceMarkers);
  if (!line) return position;
  const currentOffsets = getArmorCutMarkerOffsets(currentMarkers);
  const referenceOffsets = getArmorCutMarkerOffsets(referenceMarkers);
  const draggedKey = markerId === line.shoulderId ? line.shoulderKey : line.elbowKey;
  const fixedKey = markerId === line.shoulderId ? line.elbowKey : line.shoulderKey;
  const fixedPoint = currentOffsets[fixedKey]?.clone?.();
  const referenceFixedPoint = referenceOffsets[fixedKey];
  const referenceDraggedPoint = referenceOffsets[draggedKey];
  const referenceLength = referenceOffsets[line.shoulderKey]?.distanceTo?.(referenceOffsets[line.elbowKey]) || 0;
  if (!fixedPoint || !Number.isFinite(referenceLength) || referenceLength <= 0.000001) return position;
  const desiredPoint = new ThreeVector3(
    Number(position.x) || 0,
    Number(position.y) || 0,
    Number(position.z) || 0,
  );
  let direction = desiredPoint.sub(fixedPoint);
  if (direction.lengthSq() <= 0.000001 && referenceDraggedPoint && referenceFixedPoint) {
    direction = referenceDraggedPoint.clone().sub(referenceFixedPoint);
  }
  if (direction.lengthSq() <= 0.000001) direction = new ThreeVector3(0, markerId === line.shoulderId ? 1 : -1, 0);
  const constrainedPoint = fixedPoint.add(direction.normalize().multiplyScalar(referenceLength));
  return roundGripVector(constrainedPoint);
};

const createArmorManipulationGuide = (line = {}) => {
  const config = ARMOR_CUT_PREVIEW_COLORS[line.segment] || ARMOR_CUT_PREVIEW_COLORS.body;
  const geometry = new ThreeCylinderGeometry(0.014, 0.014, 1, 12, 1, true);
  const material = new ThreeMeshBasicMaterial({
    color: config.color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.94,
  });
  const guide = new ThreeMesh(geometry, material);
  guide.name = `ArmorManipulationGuide-${line.arm || 'arm'}`;
  guide.frustumCulled = false;
  guide.renderOrder = 190;
  guide.userData.armorManipulationGuide = true;
  return guide;
};

const updateArmorManipulationGuide = (guide = null, start = null, end = null, referenceLength = 0) => {
  if (!guide || !start || !end) return;
  const direction = end.clone().sub(start);
  let length = direction.length();
  if (!Number.isFinite(length) || length <= 0.000001) {
    guide.visible = false;
    return;
  }
  if (Number.isFinite(referenceLength) && referenceLength > 0.000001) {
    direction.normalize().multiplyScalar(referenceLength);
    end = start.clone().add(direction);
    length = referenceLength;
  }
  guide.visible = true;
  guide.position.copy(start).add(end).multiplyScalar(0.5);
  guide.quaternion.setFromUnitVectors(new ThreeVector3(0, 1, 0), direction.clone().normalize());
  guide.scale.set(1, length, 1);
};

const getDecorGripSpace = (decorObject) => {
  const modelObject = decorObject?.userData?.decorModelObject;
  const orientationObject = decorObject?.userData?.decorOrientationObject || decorObject;
  const space = modelObject?.parent || orientationObject;
  if (!modelObject || !space) return null;
  return { modelObject, space };
};

const getArmorCutArmPreviewMatrix = (
  segment = 'body',
  sourceMesh = null,
  gripSpace = null,
  targetMarkers = [],
  sourceMarkers = targetMarkers,
) => {
  if (!sourceMesh || !gripSpace?.space || !gripSpace?.modelObject) return null;
  const isRightArm = segment === 'right-arm';
  const isLeftArm = segment === 'left-arm';
  if (!isRightArm && !isLeftArm) return null;
  const sourceOffsets = getArmorCutMarkerOffsets(sourceMarkers);
  const targetOffsets = getArmorCutMarkerOffsets(targetMarkers);
  const line = getArmorManipulationLines(sourceMarkers.length ? sourceMarkers : targetMarkers)
    .find((entry) => entry.segment === segment);
  const shoulderKey = line?.shoulderKey || (isRightArm ? 'rightShoulder' : 'leftShoulder');
  const elbowKey = line?.elbowKey || (isRightArm ? 'rightElbow' : 'leftElbow');
  const toGripSpacePoint = (offset) => gripSpace.modelObject.position.clone().add(offset);
  const sourceShoulder = toGripSpacePoint(sourceOffsets[shoulderKey]);
  const sourceElbow = toGripSpacePoint(sourceOffsets[elbowKey]);
  const targetShoulder = toGripSpacePoint(targetOffsets[shoulderKey]);
  const targetElbow = toGripSpacePoint(targetOffsets[elbowKey]);
  const sourceLine = sourceShoulder.clone().sub(sourceElbow);
  const targetLine = targetShoulder.clone().sub(targetElbow);
  if (sourceLine.lengthSq() <= 0.000001 || targetLine.lengthSq() <= 0.000001) return null;
  const lineRotation = new ThreeQuaternion().setFromUnitVectors(sourceLine.normalize(), targetLine.normalize());
  const localTransform = new ThreeMatrix4()
    .makeTranslation(targetShoulder.x, targetShoulder.y, targetShoulder.z)
    .multiply(new ThreeMatrix4().makeRotationFromQuaternion(lineRotation))
    .multiply(new ThreeMatrix4().makeTranslation(-sourceShoulder.x, -sourceShoulder.y, -sourceShoulder.z));
  const worldTransform = gripSpace.space.matrixWorld.clone()
    .multiply(localTransform)
    .multiply(gripSpace.space.matrixWorld.clone().invert());
  return worldTransform.multiply(sourceMesh.matrixWorld);
};

const getWeaponGripWorldPosition = (decorObject, marker = {}) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace) return null;
  const localPoint = gripSpace.modelObject.position.clone().add(getWeaponGripMarkerPosition(marker));
  gripSpace.space.updateMatrixWorld?.(true);
  return gripSpace.space.localToWorld(localPoint);
};

const getWeaponGripOffsetFromWorld = (decorObject, worldPoint) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace || !worldPoint) return null;
  gripSpace.space.updateMatrixWorld?.(true);
  const localPoint = gripSpace.space.worldToLocal(worldPoint.clone());
  return localPoint.sub(gripSpace.modelObject.position);
};

const applyDecorPreviewPose = (decorObject, model = {}) => {
  const orientationObject = decorObject?.userData?.decorOrientationObject;
  if (!orientationObject) return;
  orientationObject.position.set(0, 0, 0);
  applyModelRotation(orientationObject, model);
  if (model.modelCenterOnOrigin) centerObjectHorizontallyOnOrigin(orientationObject);
  const elevation = numberValue(model.elevation, 0, -1, 3);
  snapObjectToGround(orientationObject, elevation);
  if (model.modelFlushToGround) alignObjectTopToGround(orientationObject, elevation + 0.018);
};

const applyDecorPreviewAppearance = (decorObject, model = {}) => {
  const modelObject = decorObject?.userData?.decorModelObject || decorObject;
  if (!modelObject) return;
  updateGltfModelMaterialAppearance(modelObject, {
    materialBrightness: getDecorMaterialBrightness(model),
    maxEnvMapIntensity: isFloorTileKind(model.kind) ? 0.42 : 1,
    maxEmissiveIntensity: isFloorTileKind(model.kind) ? 0.03 : 0.18,
  });
  applyArmorPaintStencilMask(modelObject);
};

const getPreviewFrameBox = (decorObject) => {
  const object = decorObject?.userData?.decorOrientationObject || decorObject;
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new ThreeBox3().setFromObject(object, true);
  if (
    !Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)
    || !Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)
    || !Number.isFinite(box.min.z) || !Number.isFinite(box.max.z)
    || box.isEmpty()
  ) {
    return null;
  }
  return box;
};

const frameDecorPreviewObject = (decorObject, camera, controls) => {
  if (!decorObject || !camera || !controls) return;
  const box = getPreviewFrameBox(decorObject);
  if (!box) return;
  const size = box.getSize(new ThreeVector3());
  const center = box.getCenter(new ThreeVector3());
  const verticalFov = ThreeMathUtils.degToRad(camera.fov || 48);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, camera.aspect || 1));
  const distanceForHeight = size.y / (2 * Math.tan(verticalFov / 2));
  const distanceForWidth = Math.max(size.x, size.z) / (2 * Math.tan(horizontalFov / 2));
  const desiredDistance = ThreeMathUtils.clamp(
    Math.max(distanceForHeight, distanceForWidth, 1) * 1.55,
    2.8,
    18,
  );
  const direction = camera.position.clone().sub(controls.target);
  if (direction.lengthSq() < 0.0001) direction.set(4.2, 2.4, 5.4);
  direction.normalize();
  camera.userData.decorPreviewBaseDistance = desiredDistance;
  controls.target.copy(center);
  camera.position.copy(center).addScaledVector(direction, desiredDistance);
  camera.near = Math.max(0.01, desiredDistance / 120);
  camera.far = Math.max(80, desiredDistance * 8);
  camera.updateProjectionMatrix();
  controls.minDistance = DECOR_CAMERA_ZOOM_MIN_DISTANCE;
  controls.maxDistance = DECOR_CAMERA_ZOOM_MAX_DISTANCE;
  controls.update();
};

const getDecorCameraZoomPercent = (camera = null, controls = null) => {
  if (!camera || !controls) return 100;
  const baseDistance = Number(camera.userData?.decorPreviewBaseDistance)
    || Math.max(0.001, camera.position.distanceTo(controls.target));
  const currentDistance = Math.max(0.001, camera.position.distanceTo(controls.target));
  return Math.round((baseDistance / currentDistance) * 100);
};

const applyDecorCameraZoomDelta = (camera = null, controls = null, deltaY = 0) => {
  if (!camera || !controls) return 100;
  const direction = camera.position.clone().sub(controls.target);
  const currentDistance = Math.max(0.001, direction.length());
  if (direction.lengthSq() < 0.000001) direction.set(4.2, 2.4, 5.4);
  direction.normalize();
  const sensitivity = Math.max(0.008, currentDistance * DECOR_CAMERA_ZOOM_DRAG_SENSITIVITY);
  const nextDistance = ThreeMathUtils.clamp(
    currentDistance + (Number(deltaY) || 0) * sensitivity,
    DECOR_CAMERA_ZOOM_MIN_DISTANCE,
    DECOR_CAMERA_ZOOM_MAX_DISTANCE,
  );
  camera.position.copy(controls.target).addScaledVector(direction, nextDistance);
  controls.update();
  return getDecorCameraZoomPercent(camera, controls);
};

const applyArmorSectionClipping = (decorObject = null, plane = null) => {
  decorObject?.traverse?.((child) => {
    if (!child?.material || (!child.isMesh && !child.isSkinnedMesh)) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!material) return;
      material.clippingPlanes = plane ? [plane] : null;
      material.clipIntersection = false;
      material.needsUpdate = true;
    });
  });
};

const getArmorSectionLocalPaintPlane = (decorObject = null, worldPlane = null) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!worldPlane || !gripSpace?.space || !gripSpace?.modelObject) return null;
  gripSpace.space.updateMatrixWorld?.(true);
  const localPlane = worldPlane.clone().applyMatrix4(
    new ThreeMatrix4().copy(gripSpace.space.matrixWorld).invert(),
  );
  const basePosition = gripSpace.modelObject.position || new ThreeVector3();
  localPlane.constant += localPlane.normal.dot(basePosition);
  return localPlane.normalize();
};

const applyDecorPreviewSize = (decorObject, model = {}) => {
  const modelObject = decorObject?.userData?.decorModelObject;
  if (!modelObject) return;
  const orientationObject = decorObject?.userData?.decorOrientationObject;
  resetObjectBaseTransform(modelObject);
  const dimensions = getDecorModelDimensions(model);
  fitDecorModelObjectToDimensions(modelObject, model, { dimensions, orientationObject });

  const collisionRing = decorObject.userData?.decorCollisionRing;
  if (collisionRing?.userData?.baseRadius) {
    const nextRadius = Math.max(dimensions.x, dimensions.z);
    const baseRadius = Number(collisionRing.userData.baseRadius) || nextRadius;
    collisionRing.scale.setScalar(Math.max(0.001, nextRadius / baseRadius));
  }
  applyDecorPreviewPose(decorObject, model);
};

export const __decor3dPreviewRigTestUtils = {
  classifyArmorCutPoint,
  getArmorCutMarkerOffsets,
  getArmorManipulationLines,
  getGripTraySlotNdc,
  isCanvasPointInGripTray,
};

export default function Decor3DPreview({
  children,
  model,
  weaponGripMarkers = [],
  onWeaponGripMarkerChange,
  shieldGripMarkers = [],
  onShieldGripMarkerChange,
  armorCanvasCutEnabled = false,
  armorContourDrawEnabled = false,
  armorPaintDrawEnabled = false,
  armorSectionToolEnabled = false,
  armorPaintBrushRadius = ARMOR_PAINT_RADIUS,
  cameraZoomDragEnabled = false,
  armorCutManipulationEnabled = false,
  armorCutContours = [],
  armorCutPaintStrokes = [],
  armorGripMarkers = [],
  onArmorCutContourChange,
  onArmorCutPaintChange,
  onArmorGripMarkerChange,
  onCameraZoomChange,
  showGrid = true,
  rigMeshPickEnabled = false,
  rigActiveSegment = 'body',
  onRigMeshPick,
}) {
  const containerRef = useRef(null);
  const decorRootRef = useRef(null);
  const decorObjectRef = useRef(null);
  const gripRootRef = useRef(null);
  const rigCutPreviewRootRef = useRef(null);
  const rigCutPreviewObjectsRef = useRef(new Map());
  const rigCutPreviewSignatureRef = useRef('');
  const armorCutContourObjectsRef = useRef(new Map());
  const armorCutContourSignatureRef = useRef('');
  const armorCutPaintObjectsRef = useRef(new Map());
  const armorCutPaintTriangleKeysRef = useRef(new Map());
  const armorCutPaintPatchIdRef = useRef(0);
  const armorCutPaintSignatureRef = useRef('');
  const skipNextArmorCutPaintSignatureRef = useRef('');
  const armorCutPreviewDirtyRef = useRef(true);
  const armorCutContourDirtyRef = useRef(true);
  const armorCutPaintDirtyRef = useRef(true);
  const armorPaintStrokeActiveRef = useRef(false);
  const armorPaintBrushPreviewRef = useRef(null);
  const armorPaintBrushPointRef = useRef(null);
  const armorPaintBrushCanvasPointRef = useRef(null);
  const armorSectionWorldPlaneRef = useRef(null);
  const armorSectionLocalPlaneRef = useRef(null);
  const armorSectionDraftPlaneRef = useRef(null);
  const armorSectionDragRef = useRef(null);
  const armorManipulationGuideObjectsRef = useRef(new Map());
  const gripMarkersRef = useRef(new Map());
  const gripDragRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const previewFloorRef = useRef(null);
  const previewGridRef = useRef(null);
  const showGridRef = useRef(showGrid !== false);
  const latestModelRef = useRef(model);
  const latestWeaponGripMarkersRef = useRef(weaponGripMarkers);
  const latestShieldGripMarkersRef = useRef(shieldGripMarkers);
  const latestArmorCanvasCutEnabledRef = useRef(armorCanvasCutEnabled);
  const latestArmorContourDrawEnabledRef = useRef(armorContourDrawEnabled);
  const latestArmorPaintDrawEnabledRef = useRef(armorPaintDrawEnabled);
  const latestArmorSectionToolEnabledRef = useRef(armorSectionToolEnabled);
  const latestArmorPaintBrushRadiusRef = useRef(normalizeArmorPaintRadius(armorPaintBrushRadius));
  const latestCameraZoomDragEnabledRef = useRef(cameraZoomDragEnabled);
  const latestArmorCutManipulationEnabledRef = useRef(armorCutManipulationEnabled);
  const latestArmorCutContoursRef = useRef(armorCutContours);
  const latestArmorCutPaintStrokesRef = useRef(armorCutPaintStrokes);
  const latestArmorGripMarkersRef = useRef(armorGripMarkers);
  const latestArmorManipulationMarkersRef = useRef(null);
  const latestOnWeaponGripMarkerChangeRef = useRef(onWeaponGripMarkerChange);
  const latestOnShieldGripMarkerChangeRef = useRef(onShieldGripMarkerChange);
  const latestOnArmorCutContourChangeRef = useRef(onArmorCutContourChange);
  const latestOnArmorCutPaintChangeRef = useRef(onArmorCutPaintChange);
  const latestOnArmorGripMarkerChangeRef = useRef(onArmorGripMarkerChange);
  const latestOnCameraZoomChangeRef = useRef(onCameraZoomChange);
  const latestRigMeshPickEnabledRef = useRef(rigMeshPickEnabled);
  const latestRigActiveSegmentRef = useRef(rigActiveSegment);
  const latestOnRigMeshPickRef = useRef(onRigMeshPick);
  const syncWeaponGripMarkersRef = useRef(() => {});
  const syncArmorCutPreviewRef = useRef(() => {});
  const syncArmorCutContoursRef = useRef(() => {});
  const syncArmorCutPaintRef = useRef(() => {});
  const syncArmorPaintBrushPreviewRef = useRef(() => {});
  const syncArmorManipulationGuidesRef = useRef(() => {});
  const rendererRef = useRef(null);
  const [webglError, setWebglError] = useState('');
  const [previewStatus, setPreviewStatus] = useState('');
  const [sectionLine, setSectionLine] = useState(null);
  const [sectionStatus, setSectionStatus] = useState('');
  const [paintBrushCircle, setPaintBrushCircle] = useState(null);
  const paintBrushCircleFrameRef = useRef(0);
  const pendingPaintBrushCircleRef = useRef(null);
  const buildSignature = useMemo(() => getDecorPreviewModelSignature(model), [model]);
  const sizeSignature = useMemo(() => getDecorSizeSignature(model), [model]);
  const poseSignature = useMemo(() => getDecorPoseSignature(model), [model]);
  const appearanceSignature = useMemo(() => getDecorAppearanceSignature(model), [model]);

  const commitPaintBrushCircle = useCallback((nextCircle = null) => {
    pendingPaintBrushCircleRef.current = nextCircle;
    if (!nextCircle) {
      if (paintBrushCircleFrameRef.current) {
        cancelAnimationFrame(paintBrushCircleFrameRef.current);
        paintBrushCircleFrameRef.current = 0;
      }
      setPaintBrushCircle(null);
      return;
    }
    if (paintBrushCircleFrameRef.current) return;
    paintBrushCircleFrameRef.current = requestAnimationFrame(() => {
      paintBrushCircleFrameRef.current = 0;
      setPaintBrushCircle(pendingPaintBrushCircleRef.current);
    });
  }, []);

  useEffect(() => () => {
    if (paintBrushCircleFrameRef.current) cancelAnimationFrame(paintBrushCircleFrameRef.current);
  }, []);

  useEffect(() => {
    latestModelRef.current = model;
  }, [model]);

  useEffect(() => {
    latestWeaponGripMarkersRef.current = Array.isArray(weaponGripMarkers) ? weaponGripMarkers : [];
  }, [weaponGripMarkers]);

  useEffect(() => {
    latestShieldGripMarkersRef.current = Array.isArray(shieldGripMarkers) ? shieldGripMarkers : [];
  }, [shieldGripMarkers]);

  useEffect(() => {
    latestArmorGripMarkersRef.current = Array.isArray(armorGripMarkers) ? armorGripMarkers : [];
    latestArmorManipulationMarkersRef.current = null;
    armorCutPreviewDirtyRef.current = true;
  }, [armorGripMarkers]);

  useEffect(() => {
    latestArmorCutContoursRef.current = normalizeArmorCutContours(armorCutContours);
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
  }, [armorCutContours]);

  useEffect(() => {
    const normalizedStrokes = normalizeArmorCutPaintStrokes(armorCutPaintStrokes);
    latestArmorCutPaintStrokesRef.current = normalizedStrokes;
    const decorObject = decorObjectRef.current;
    const modelObject = decorObject?.userData?.decorModelObject || decorObject;
    const signature = getArmorCutPaintSignature(normalizedStrokes, modelObject);
    if (
      signature
      && signature === skipNextArmorCutPaintSignatureRef.current
      && signature === armorCutPaintSignatureRef.current
    ) {
      skipNextArmorCutPaintSignatureRef.current = '';
      armorCutPaintDirtyRef.current = false;
      return;
    }
    armorCutPaintDirtyRef.current = true;
  }, [armorCutPaintStrokes]);

  useEffect(() => {
    latestArmorCanvasCutEnabledRef.current = armorCanvasCutEnabled;
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    if (!armorCanvasCutEnabled) {
      armorCutPaintTriangleKeysRef.current.clear();
      armorCutPaintPatchIdRef.current = 0;
      skipNextArmorCutPaintSignatureRef.current = '';
      armorSectionWorldPlaneRef.current = null;
      armorSectionLocalPlaneRef.current = null;
      armorSectionDraftPlaneRef.current = null;
      applyArmorSectionClipping(decorObjectRef.current, null);
      applyArmorSectionClipping(rigCutPreviewRootRef.current, null);
      setSectionLine(null);
      setSectionStatus('');
    }
  }, [armorCanvasCutEnabled]);

  useEffect(() => {
    latestArmorContourDrawEnabledRef.current = armorContourDrawEnabled;
  }, [armorContourDrawEnabled]);

  useEffect(() => {
    latestArmorPaintDrawEnabledRef.current = armorPaintDrawEnabled;
    syncWeaponGripMarkersRef.current?.(cameraRef.current);
    syncArmorCutPreviewRef.current?.(cameraRef.current);
    syncArmorPaintBrushPreviewRef.current?.();
    if (!armorPaintDrawEnabled) return undefined;
    const warmCacheTimer = window.setTimeout(() => {
      warmArmorPaintTriangleCaches(decorObjectRef.current);
    }, 40);
    return () => window.clearTimeout(warmCacheTimer);
  }, [armorPaintDrawEnabled]);

  useEffect(() => {
    latestArmorSectionToolEnabledRef.current = armorSectionToolEnabled;
    if (armorSectionToolEnabled) {
      setSectionStatus(armorSectionWorldPlaneRef.current
        ? 'Coupe active: trace une nouvelle ligne ou passe en peinture.'
        : 'Trace une ligne de coupe, puis clique la face visible.');
    } else {
      armorSectionDraftPlaneRef.current = null;
      armorSectionDragRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = true;
      containerRef.current?.classList?.remove('is-section-drawing');
      setSectionLine(null);
      setSectionStatus('');
    }
  }, [armorSectionToolEnabled]);

  useEffect(() => {
    latestArmorPaintBrushRadiusRef.current = normalizeArmorPaintRadius(armorPaintBrushRadius);
    syncArmorPaintBrushPreviewRef.current?.();
  }, [armorPaintBrushRadius]);

  useEffect(() => {
    latestCameraZoomDragEnabledRef.current = cameraZoomDragEnabled;
  }, [cameraZoomDragEnabled]);

  useEffect(() => {
    latestArmorCutManipulationEnabledRef.current = armorCutManipulationEnabled;
    armorCutPreviewDirtyRef.current = true;
    if (!armorCutManipulationEnabled) {
      latestArmorManipulationMarkersRef.current = null;
      syncWeaponGripMarkersRef.current?.(cameraRef.current);
      syncArmorManipulationGuidesRef.current?.();
      syncArmorCutPreviewRef.current?.(cameraRef.current);
    }
  }, [armorCutManipulationEnabled]);

  useEffect(() => {
    latestOnWeaponGripMarkerChangeRef.current = onWeaponGripMarkerChange;
  }, [onWeaponGripMarkerChange]);

  useEffect(() => {
    latestOnShieldGripMarkerChangeRef.current = onShieldGripMarkerChange;
  }, [onShieldGripMarkerChange]);

  useEffect(() => {
    latestOnArmorCutContourChangeRef.current = onArmorCutContourChange;
  }, [onArmorCutContourChange]);

  useEffect(() => {
    latestOnArmorCutPaintChangeRef.current = onArmorCutPaintChange;
  }, [onArmorCutPaintChange]);

  useEffect(() => {
    latestOnArmorGripMarkerChangeRef.current = onArmorGripMarkerChange;
  }, [onArmorGripMarkerChange]);

  useEffect(() => {
    latestOnCameraZoomChangeRef.current = onCameraZoomChange;
  }, [onCameraZoomChange]);

  useEffect(() => {
    latestRigMeshPickEnabledRef.current = rigMeshPickEnabled;
  }, [rigMeshPickEnabled]);

  useEffect(() => {
    latestRigActiveSegmentRef.current = rigActiveSegment;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    syncArmorCutPreviewRef.current?.(cameraRef.current);
    syncArmorPaintBrushPreviewRef.current?.();
  }, [rigActiveSegment]);

  useEffect(() => {
    latestOnRigMeshPickRef.current = onRigMeshPick;
  }, [onRigMeshPick]);

  useEffect(() => {
    const visible = showGrid !== false;
    showGridRef.current = visible;
    if (previewFloorRef.current) previewFloorRef.current.visible = visible;
    if (previewGridRef.current) previewGridRef.current.visible = visible;
  }, [showGrid]);

  const syncWeaponGripMarkers = useCallback((camera = cameraRef.current) => {
    const gripRoot = gripRootRef.current;
    const decorObject = decorObjectRef.current;
    if (latestArmorPaintDrawEnabledRef.current) {
      gripMarkersRef.current.forEach((marker) => { marker.visible = false; });
      return;
    }
    const isManipulatingArmor = Boolean(latestArmorCutManipulationEnabledRef.current);
    if (!isManipulatingArmor) latestArmorManipulationMarkersRef.current = null;
    const armorMarkers = isManipulatingArmor
      ? (latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current)
      : latestArmorGripMarkersRef.current;
    const markers = [
      ...latestWeaponGripMarkersRef.current.map((marker) => ({ ...marker, type: 'weapon', key: `weapon-${marker.hand === 'left' ? 'left' : 'right'}` })),
      ...latestShieldGripMarkersRef.current.map((marker) => ({ ...marker, type: 'shield', key: `shield-${marker.id || 'hand'}` })),
      ...armorMarkers.map((marker) => ({ ...marker, type: 'armor', key: `armor-${marker.id || 'lower-belly'}` })),
    ];
    if (!gripRoot || !decorObject || !Array.isArray(markers) || !markers.length) {
      gripMarkersRef.current.forEach((marker) => { marker.visible = false; });
      return;
    }

    const activeMarkers = new Set();
    const inactiveMarkerKeys = markers
      .filter((markerConfig) => !markerConfig.enabled)
      .map((markerConfig) => markerConfig.key);
    const inactiveMarkerIndexByKey = new Map(inactiveMarkerKeys.map((markerKey, index) => [markerKey, index]));
    const trayReferencePoint = getGripTrayReferencePoint(decorObject);
    markers.forEach((markerConfig) => {
      const hand = markerConfig.hand === 'left' ? 'left' : 'right';
      const markerKey = markerConfig.key;
      activeMarkers.add(markerKey);
      let marker = gripMarkersRef.current.get(markerKey);
      if (!marker) {
        marker = createWeaponGripMarker({ ...markerConfig, hand });
        gripMarkersRef.current.set(markerKey, marker);
        gripRoot.add(marker);
      }
      const isDraggingMarker = gripDragRef.current?.key === markerKey;
      const isEnabled = Boolean(markerConfig.enabled || (isDraggingMarker && gripDragRef.current?.activated));
      const trayIndex = inactiveMarkerIndexByKey.get(markerKey);
      const inTray = !isEnabled && Number.isFinite(trayIndex);
      const worldPosition = inTray
        ? getGripTrayWorldPosition(camera, trayIndex, inactiveMarkerKeys.length, trayReferencePoint)
        : getWeaponGripWorldPosition(decorObject, { ...markerConfig, hand, enabled: isEnabled });
      if (!worldPosition) {
        marker.visible = false;
        return;
      }
      marker.visible = true;
      marker.position.copy(worldPosition);
      marker.material.opacity = inTray ? 0.72 : 1;
      marker.userData.weaponGripEnabled = isEnabled;
      marker.userData.gripMarkerInTray = inTray;
      marker.userData.gripTrayIndex = inTray ? trayIndex : -1;
      marker.userData.gripMarkerType = markerConfig.type;
      marker.userData.gripMarkerId = markerConfig.type === 'armor'
        ? (markerConfig.id || 'lower-belly')
        : (markerConfig.type === 'shield' ? (markerConfig.id || 'hand') : hand);
      if (camera) {
        const distance = Math.max(0.1, camera.position.distanceTo(marker.position));
        const markerSize = ThreeMathUtils.clamp(distance * (inTray ? 0.056 : 0.065), 0.07, inTray ? 0.22 : 0.28);
        marker.scale.setScalar(markerSize);
      }
    });

    gripMarkersRef.current.forEach((marker, markerKey) => {
      if (!activeMarkers.has(markerKey)) marker.visible = false;
    });
  }, []);

  syncWeaponGripMarkersRef.current = syncWeaponGripMarkers;

  const syncArmorManipulationGuides = useCallback(() => {
    const root = gripRootRef.current;
    const decorObject = decorObjectRef.current;
    const objects = armorManipulationGuideObjectsRef.current;
    if (
      !root
      || !decorObject
      || !latestArmorCanvasCutEnabledRef.current
      || !latestArmorCutManipulationEnabledRef.current
    ) {
      disposeArmorManipulationGuides(objects);
      return;
    }
    const gripSpace = getDecorGripSpace(decorObject);
    if (!gripSpace?.space || !gripSpace?.modelObject) {
      disposeArmorManipulationGuides(objects);
      return;
    }
    const markers = latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current;
    const markerOffsets = getArmorCutMarkerOffsets(markers);
    const referenceOffsets = getArmorCutMarkerOffsets(latestArmorGripMarkersRef.current);
    const activeKeys = new Set();
    gripSpace.space.updateMatrixWorld?.(true);
    const toWorldPoint = (offset) => gripSpace.space.localToWorld(
      gripSpace.modelObject.position.clone().add(offset || new ThreeVector3()),
    );
    getArmorManipulationLines(markers).forEach((line) => {
      activeKeys.add(line.arm);
      let guide = objects.get(line.arm);
      if (!guide) {
        guide = createArmorManipulationGuide(line);
        objects.set(line.arm, guide);
        root.add(guide);
      }
      const shoulderPoint = toWorldPoint(markerOffsets[line.shoulderKey]);
      const elbowPoint = toWorldPoint(markerOffsets[line.elbowKey]);
      const referenceLength = referenceOffsets[line.shoulderKey]?.distanceTo?.(referenceOffsets[line.elbowKey]) || 0;
      updateArmorManipulationGuide(guide, shoulderPoint, elbowPoint, referenceLength);
    });
    objects.forEach((guide, key) => {
      if (!activeKeys.has(key)) {
        guide.geometry?.dispose?.();
        guide.material?.dispose?.();
        guide.parent?.remove?.(guide);
        objects.delete(key);
      }
    });
  }, []);

  syncArmorManipulationGuidesRef.current = syncArmorManipulationGuides;

  const syncArmorCutPreview = useCallback((camera = cameraRef.current) => {
    const root = rigCutPreviewRootRef.current;
    const decorObject = decorObjectRef.current;
    const markers = latestArmorGripMarkersRef.current;
    const contours = latestArmorCutContoursRef.current;
    const objects = rigCutPreviewObjectsRef.current;
    if (!root || !decorObject || !latestArmorCanvasCutEnabledRef.current || !Array.isArray(markers) || !markers.length) {
      disposeRigCutPreviewObjects(objects);
      rigCutPreviewSignatureRef.current = '';
      armorCutPreviewDirtyRef.current = false;
      return;
    }
    const modelObject = decorObject.userData?.decorModelObject || decorObject;
    const deferArmorCutRebuild = gripDragRef.current?.type === 'armor' && objects.size > 0;
    const shouldCheckPreviewBuild = armorCutPreviewDirtyRef.current || !objects.size;
    if (shouldCheckPreviewBuild) {
      const signature = getArmorCutSignature(modelObject, markers, contours);
      if (signature !== rigCutPreviewSignatureRef.current && !deferArmorCutRebuild) {
        disposeRigCutPreviewObjects(objects);
        rigCutPreviewSignatureRef.current = '';
        if (!buildArmorCutPreviewMeshes({ root, objects, decorObject, markers, contours })) {
          armorCutPreviewDirtyRef.current = false;
          return;
        }
        rigCutPreviewSignatureRef.current = signature;
      }
    }
    const activeSegment = latestRigActiveSegmentRef.current || 'body';
    const manipulationEnabled = Boolean(latestArmorCutManipulationEnabledRef.current);
    if (!manipulationEnabled) latestArmorManipulationMarkersRef.current = null;
    const manipulationMarkers = latestArmorManipulationMarkersRef.current || markers;
    const gripSpace = manipulationEnabled ? getDecorGripSpace(decorObject) : null;
    const syncedSourceMeshes = new Set();
    objects.forEach((object) => {
      const sourceMesh = object.userData?.rigCutSourceMesh;
      if (!sourceMesh?.matrixWorld) {
        object.visible = false;
        return;
      }
      sourceMesh.updateMatrixWorld?.(true);
      if (!syncedSourceMeshes.has(sourceMesh)) {
        setRigCutSourceVisible(sourceMesh, !manipulationEnabled);
        syncedSourceMeshes.add(sourceMesh);
      }
      object.visible = sourceMesh.userData?.rigCutPreviewOriginalVisible !== false;
      const manipulationMatrix = manipulationEnabled
        ? getArmorCutArmPreviewMatrix(
          object.userData?.rigCutSegment || 'body',
          sourceMesh,
          gripSpace,
          manipulationMarkers,
          markers,
        )
        : null;
      object.matrix.copy(manipulationMatrix || sourceMesh.matrixWorld);
      updateRigCutPreviewMaterial(
        object,
        object.userData?.rigCutSegment || 'body',
        activeSegment,
        manipulationEnabled ? 'object' : (latestArmorPaintDrawEnabledRef.current ? 'paint-guide' : 'cut'),
      );
    });
    applyArmorSectionClipping(root, armorSectionWorldPlaneRef.current);
    if (!objects.size && camera) {
      armorCutPreviewDirtyRef.current = false;
      return;
    }
    armorCutPreviewDirtyRef.current = shouldCheckPreviewBuild && Boolean(deferArmorCutRebuild);
  }, []);

  syncArmorCutPreviewRef.current = syncArmorCutPreview;

  const syncArmorCutContours = useCallback(() => {
    const decorObject = decorObjectRef.current;
    const contours = latestArmorCutContoursRef.current;
    const objects = armorCutContourObjectsRef.current;
    const modelObject = decorObject?.userData?.decorModelObject || decorObject;
    if (!decorObject || !latestArmorCanvasCutEnabledRef.current || !Array.isArray(contours) || !contours.length) {
      disposeArmorCutContourObjects(objects);
      armorCutContourSignatureRef.current = '';
      armorCutContourDirtyRef.current = false;
      return;
    }
    const activeSegment = latestRigActiveSegmentRef.current || 'body';
    const signature = getArmorCutContoursSignature(contours, modelObject);
    if (signature === armorCutContourSignatureRef.current) {
      updateArmorCutContourObjectsAppearance(objects, activeSegment);
      armorCutContourDirtyRef.current = false;
      return;
    }
    disposeArmorCutContourObjects(objects);
    armorCutContourSignatureRef.current = '';
    if (buildArmorCutContourObjects({
      objects,
      decorObject,
      contours,
      activeSegment,
    })) {
      armorCutContourSignatureRef.current = signature;
      updateArmorCutContourObjectsAppearance(objects, activeSegment);
    }
    armorCutContourDirtyRef.current = false;
  }, []);

  syncArmorCutContoursRef.current = syncArmorCutContours;

  const syncArmorCutPaint = useCallback(() => {
    const decorObject = decorObjectRef.current;
    const paintStrokes = latestArmorCutPaintStrokesRef.current;
    const objects = armorCutPaintObjectsRef.current;
    const modelObject = decorObject?.userData?.decorModelObject || decorObject;
    if (!decorObject || !latestArmorCanvasCutEnabledRef.current || !Array.isArray(paintStrokes) || !paintStrokes.length) {
      disposeArmorCutContourObjects(objects);
      armorCutPaintTriangleKeysRef.current.clear();
      armorCutPaintPatchIdRef.current = 0;
      armorCutPaintSignatureRef.current = '';
      armorCutPaintDirtyRef.current = false;
      return;
    }
    const activeSegment = latestRigActiveSegmentRef.current || 'body';
    const sectionPlane = armorSectionWorldPlaneRef.current;
    const signature = getArmorCutPaintSignature(paintStrokes, modelObject);
    if (signature === armorCutPaintSignatureRef.current) {
      updateArmorCutPaintObjectsAppearance(objects, activeSegment, sectionPlane);
      armorCutPaintDirtyRef.current = false;
      return;
    }
    disposeArmorCutContourObjects(objects);
    armorCutPaintTriangleKeysRef.current.clear();
    armorCutPaintPatchIdRef.current = 0;
    armorCutPaintSignatureRef.current = '';
    if (buildArmorCutPaintObjects({
      objects,
      paintedTriangleKeys: armorCutPaintTriangleKeysRef.current,
      decorObject,
      paintStrokes,
      activeSegment,
      sectionPlane,
    })) {
      armorCutPaintSignatureRef.current = signature;
      updateArmorCutPaintObjectsAppearance(objects, activeSegment, sectionPlane);
    }
    armorCutPaintDirtyRef.current = false;
  }, []);

  syncArmorCutPaintRef.current = syncArmorCutPaint;

  const syncArmorPaintBrushPreview = useCallback(() => {
    const canvasPoint = armorPaintBrushCanvasPointRef.current;
    if (armorPaintBrushPreviewRef.current) armorPaintBrushPreviewRef.current.visible = false;
    if (!latestArmorPaintDrawEnabledRef.current || !canvasPoint) {
      commitPaintBrushCircle(null);
      return;
    }
    const radius = normalizeArmorPaintRadius(latestArmorPaintBrushRadiusRef.current);
    const segment = normalizeArmorContourSegment(latestRigActiveSegmentRef.current || 'body');
    const nextCircle = getArmorPaintBrushPointerCircle({
      canvasPoint,
      radius,
      renderer: rendererRef.current,
      segment,
    });
    if (!nextCircle) {
      commitPaintBrushCircle(null);
      return;
    }
    commitPaintBrushCircle((paintBrushCircle && paintBrushCircle.color === nextCircle?.color
      && Math.abs(paintBrushCircle.x - nextCircle.x) < 0.5
      && Math.abs(paintBrushCircle.y - nextCircle.y) < 0.5
      && Math.abs(paintBrushCircle.radius - nextCircle.radius) < 0.5)
      ? paintBrushCircle
      : nextCircle);
  }, [commitPaintBrushCircle, paintBrushCircle]);

  syncArmorPaintBrushPreviewRef.current = syncArmorPaintBrushPreview;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new ThreeWebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: 'default',
        stencil: true,
      });
    } catch {
      setWebglError('Aperçu 3D indisponible.');
      return undefined;
    }

    renderer.outputColorSpace = ThreeSRGBColorSpace;
    renderer.toneMapping = ThreeACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.localClippingEnabled = true;
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = ThreePCFShadowMap;
    renderer.domElement.className = 'decor3d-canvas';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new ThreeScene();
    scene.background = new ThreeColor('#07111e');
    scene.fog = new ThreeFog('#07111e', 8, 22);
    const pmremGenerator = new ThreePMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;
    const camera = new ThreePerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(4.2, 3.2, 5.4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = DECOR_CAMERA_ZOOM_MIN_DISTANCE;
    controls.maxDistance = DECOR_CAMERA_ZOOM_MAX_DISTANCE;
    controls.minPolarAngle = 0.01;
    controls.maxPolarAngle = Math.PI - 0.01;
    controls.target.set(0, 0.75, 0);
    controlsRef.current = controls;
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
    });

    scene.add(new ThreeHemisphereLight('#c9f5ff', '#24160c', 1.15));
    const sun = new ThreeDirectionalLight('#fff0c7', 2.1);
    sun.position.set(-4.5, 6, 5);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);
    scene.add(new ThreeAmbientLight('#4f8cff', 0.28));

    const floorTexture = new ThreeCanvasTexture(createPreviewFloorCanvas({
      backgroundColor: '#132033',
      oddColor: '#1d2c43',
      evenColor: '#142238',
      cellLineColor: 'rgba(148, 163, 184, .16)',
      markerColor: 'rgba(103, 232, 249, .2)',
      markerLineWidth: 4,
      markerShape: 'square',
      markerRect: { x: 96, y: 96, width: 320, height: 320 },
    }));
    floorTexture.wrapS = ThreeRepeatWrapping;
    floorTexture.wrapT = ThreeRepeatWrapping;
    floorTexture.repeat.set(5, 5);
    floorTexture.colorSpace = ThreeSRGBColorSpace;
    const floorMaterial = makePreviewStandardMaterial('#172033', { texture: floorTexture, roughness: 0.9 });
    const floor = new ThreeMesh(new ThreePlaneGeometry(8, 8), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.visible = showGridRef.current;
    previewFloorRef.current = floor;
    scene.add(floor);

    const grid = new ThreeGridHelper(8, 16, '#67e8f9', '#263c5c');
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    grid.position.y = 0.018;
    grid.visible = showGridRef.current;
    previewGridRef.current = grid;
    scene.add(grid);

    const decorRoot = new ThreeGroup();
    decorRootRef.current = decorRoot;
    scene.add(decorRoot);
    const gripRoot = new ThreeGroup();
    gripRoot.name = 'WeaponGripMarkers';
    gripRootRef.current = gripRoot;
    scene.add(gripRoot);
    const rigCutPreviewRoot = new ThreeGroup();
    rigCutPreviewRoot.name = 'ArmorCutPreviewZones';
    rigCutPreviewRootRef.current = rigCutPreviewRoot;
    scene.add(rigCutPreviewRoot);

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
    const render = (time = 0) => {
      resize();
      controls.update();
      syncWeaponGripMarkersRef.current?.(camera);
      syncArmorManipulationGuidesRef.current?.();
      const paintStrokeActive = armorPaintStrokeActiveRef.current;
      if (
        !paintStrokeActive
        && (armorCutPreviewDirtyRef.current || latestArmorCutManipulationEnabledRef.current || gripDragRef.current?.type === 'armor')
      ) {
        syncArmorCutPreviewRef.current?.(camera);
      }
      if (armorCutContourDirtyRef.current) {
        syncArmorCutContoursRef.current?.();
      }
      if (!paintStrokeActive && armorCutPaintDirtyRef.current) {
        syncArmorCutPaintRef.current?.();
      }
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(render);
    };
    render();

    const raycaster = new ThreeRaycaster();
    const pointer = new ThreeVector2();
    const dragPlane = new ThreePlane();
    const planeNormal = new ThreeVector3();
    const planePoint = new ThreeVector3();
    let rigPickStart = null;
    let contourPickStart = null;
    let paintStroke = null;
    let paintHoldTimer = null;
    let cameraZoomDrag = null;
    let reportedZoomPercent = null;

    const reportCameraZoom = () => {
      const percent = getDecorCameraZoomPercent(camera, controls);
      if (percent === reportedZoomPercent) return;
      reportedZoomPercent = percent;
      latestOnCameraZoomChangeRef.current?.(percent);
    };

    const handleControlsChange = () => {
      reportCameraZoom();
      syncArmorPaintBrushPreviewRef.current?.();
    };
    controls.addEventListener?.('change', handleControlsChange);

    const updatePointer = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(
        ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1,
        -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1),
      );
      raycaster.setFromCamera(pointer, camera);
    };

    const getCanvasPoint = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: ThreeMathUtils.clamp(event.clientX - rect.left, 0, rect.width),
        y: ThreeMathUtils.clamp(event.clientY - rect.top, 0, rect.height),
        width: rect.width,
        height: rect.height,
      };
    };

    const getSectionRayDirection = (canvasPoint) => {
      const ndc = new ThreeVector3(
        (canvasPoint.x / Math.max(1, canvasPoint.width)) * 2 - 1,
        -((canvasPoint.y / Math.max(1, canvasPoint.height)) * 2 - 1),
        0.5,
      );
      return ndc.unproject(camera).sub(camera.position).normalize();
    };

    const createSectionPlaneFromLine = (start, end) => {
      if (!start || !end || Math.hypot(end.x - start.x, end.y - start.y) < 8) return null;
      const startDirection = getSectionRayDirection(start);
      const endDirection = getSectionRayDirection(end);
      const normal = startDirection.cross(endDirection);
      if (normal.lengthSq() <= 0.000001) return null;
      normal.normalize();
      return new ThreePlane().setFromNormalAndCoplanarPoint(normal, camera.position);
    };

    const isWorldPointVisibleBySection = (point = null) => {
      const plane = armorSectionWorldPlaneRef.current;
      if (!plane || !point) return true;
      return plane.distanceToPoint(point) >= -0.002;
    };

    const getFirstModelHit = (event, options = {}) => {
      const decorObject = decorObjectRef.current;
      const modelObject = decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse) return null;
      updatePointer(event);
      const hits = raycaster.intersectObject(modelObject, true);
      return hits.find((entry) => (
        (entry?.object?.isMesh || entry?.object?.isSkinnedMesh)
        && (options.ignoreSection || isWorldPointVisibleBySection(entry.point))
      )) || null;
    };

    const findGripMarkerHit = (event) => {
      updatePointer(event);
      const markerObjects = Array.from(gripMarkersRef.current.values()).filter((marker) => marker.visible);
      return raycaster.intersectObjects(markerObjects, false)[0] || null;
    };

    const findRigMeshHit = (event) => {
      const decorObject = decorObjectRef.current;
      const modelObject = decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse) return null;
      const hit = getFirstModelHit(event);
      if (!hit?.object) return null;
      modelObject.updateMatrixWorld?.(true);
      hit.object.updateMatrixWorld?.(true);
      const box = new ThreeBox3().setFromObject(hit.object);
      const size = box.getSize(new ThreeVector3());
      const center = modelObject.worldToLocal(box.getCenter(new ThreeVector3()));
      return {
        path: getRigNodePath(hit.object, modelObject),
        name: hit.object.name || hit.object.parent?.name || 'Mesh',
        center: { x: center.x, y: center.y, z: center.z },
        size: { x: size.x, y: size.y, z: size.z },
      };
    };

    const findArmorContourPoint = (event) => {
      const decorObject = decorObjectRef.current;
      const gripSpace = getDecorGripSpace(decorObject);
      const modelObject = gripSpace?.modelObject || decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse || !gripSpace?.space) return null;
      const hit = getFirstModelHit(event);
      if (!hit?.point) return null;
      const gripPoint = hit.point.clone();
      gripSpace.space.worldToLocal(gripPoint);
      gripPoint.sub(gripSpace.modelObject.position);
      const surfaceNormal = hit.face?.normal
        ? (() => {
          const worldNormal = hit.face.normal.clone()
            .applyMatrix3(new ThreeMatrix3().getNormalMatrix(hit.object.matrixWorld))
            .normalize();
          if (worldNormal.lengthSq() <= 0.000001) return {};
          const normalEnd = hit.point.clone().add(worldNormal);
          gripSpace.space.worldToLocal(normalEnd);
          normalEnd.sub(gripSpace.modelObject.position);
          normalEnd.sub(gripPoint);
          if (normalEnd.lengthSq() <= 0.000001) return {};
          normalEnd.normalize();
          return { nx: normalEnd.x, ny: normalEnd.y, nz: normalEnd.z };
        })()
        : {};
      return normalizeArmorContourPoint({
        x: gripPoint.x,
        y: gripPoint.y,
        z: gripPoint.z,
        ...surfaceNormal,
        ...normalizeArmorPaintSectionPlane(armorSectionLocalPlaneRef.current ? {
          cx: armorSectionLocalPlaneRef.current.normal.x,
          cy: armorSectionLocalPlaneRef.current.normal.y,
          cz: armorSectionLocalPlaneRef.current.normal.z,
          cw: armorSectionLocalPlaneRef.current.constant,
        } : {}),
      });
    };

    const setArmorPaintBrushPoint = (point = null) => {
      armorPaintBrushPointRef.current = point
        ? { x: point.x, y: point.y, z: point.z, ...normalizeArmorPaintSurfaceNormal(point) }
        : null;
      syncArmorPaintBrushPreviewRef.current?.();
    };

    const storeArmorPaintBrushSurfacePoint = (point = null) => {
      armorPaintBrushPointRef.current = point
        ? { x: point.x, y: point.y, z: point.z, ...normalizeArmorPaintSurfaceNormal(point) }
        : null;
    };

    const setArmorPaintBrushCanvasPoint = (canvasPoint = null) => {
      armorPaintBrushCanvasPointRef.current = canvasPoint
        ? { x: canvasPoint.x, y: canvasPoint.y }
        : null;
      syncArmorPaintBrushPreviewRef.current?.();
    };

    const selectArmorSectionVisibleSide = (event) => {
      const draftPlane = armorSectionDraftPlaneRef.current;
      if (!draftPlane) return false;
      const hit = getFirstModelHit(event, { ignoreSection: true });
      if (!hit?.point) {
        setSectionStatus('Clique directement sur la face a garder visible.');
        return true;
      }
      const sectionPlane = draftPlane.clone();
      if (sectionPlane.distanceToPoint(hit.point) < 0) sectionPlane.negate();
      sectionPlane.normalize();
      armorSectionWorldPlaneRef.current = sectionPlane;
      armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(decorObjectRef.current, sectionPlane);
      armorSectionDraftPlaneRef.current = null;
      applyArmorSectionClipping(decorObjectRef.current, sectionPlane);
      applyArmorSectionClipping(rigCutPreviewRootRef.current, sectionPlane);
      armorCutPaintDirtyRef.current = true;
      setSectionLine(null);
      setSectionStatus('Coupe active: la peinture reste sur la face visible.');
      return true;
    };

    const handleArmorSectionPointerDown = (event) => {
      if (event.button !== 0 || !latestArmorSectionToolEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      if (armorSectionDraftPlaneRef.current) {
        selectArmorSectionVisibleSide(event);
        return;
      }
      const start = getCanvasPoint(event);
      armorSectionWorldPlaneRef.current = null;
      armorSectionLocalPlaneRef.current = null;
      applyArmorSectionClipping(decorObjectRef.current, null);
      applyArmorSectionClipping(rigCutPreviewRootRef.current, null);
      armorCutPaintDirtyRef.current = true;
      armorSectionDragRef.current = {
        pointerId: event.pointerId,
        start,
        last: start,
      };
      setSectionLine({ ...start, x2: start.x, y2: start.y, pending: false });
      setSectionStatus('Trace la ligne de coupe.');
      controls.enabled = false;
      container.classList.add('is-section-drawing');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture may be unavailable in some embedded browsers.
      }
    };

    const handleArmorSectionPointerMove = (event) => {
      const drag = armorSectionDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const end = getCanvasPoint(event);
      drag.last = end;
      setSectionLine({ ...drag.start, x2: end.x, y2: end.y, pending: false });
    };

    const endArmorSectionLine = (event) => {
      const drag = armorSectionDragRef.current;
      if (!drag || (event?.pointerId !== undefined && drag.pointerId !== event.pointerId)) return;
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      try {
        renderer.domElement.releasePointerCapture?.(drag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released.
      }
      armorSectionDragRef.current = null;
      controls.enabled = true;
      container.classList.remove('is-section-drawing');
      const end = drag.last || drag.start;
      const plane = createSectionPlaneFromLine(drag.start, end);
      if (!plane) {
        setSectionLine(null);
        setSectionStatus('Ligne trop courte: recommence la coupe.');
        return;
      }
      armorSectionDraftPlaneRef.current = plane;
      setSectionLine({ ...drag.start, x2: end.x, y2: end.y, pending: true });
      setSectionStatus('Clique la face que tu veux garder visible.');
    };

    const updateLocalArmorGripMarker = (markerId = 'lower-belly', position = {}) => {
      const isManipulatingArmor = Boolean(latestArmorCutManipulationEnabledRef.current);
      const sourceMarkers = isManipulatingArmor
        ? (latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current || [])
        : (latestArmorGripMarkersRef.current || []);
      const nextMarkers = sourceMarkers.map((marker) => (
        marker.id === markerId
          ? {
            ...marker,
            enabled: true,
            x: position.x,
            y: position.y,
            z: position.z,
          }
          : marker
      ));
      if (isManipulatingArmor) latestArmorManipulationMarkersRef.current = nextMarkers;
      else latestArmorGripMarkersRef.current = nextMarkers;
    };

    const updateLocalWeaponGripMarker = (hand = 'right', position = {}) => {
      const gripHand = hand === 'left' ? 'left' : 'right';
      latestWeaponGripMarkersRef.current = (latestWeaponGripMarkersRef.current || []).map((marker) => (
        (marker.hand === 'left' ? 'left' : 'right') === gripHand
          ? {
            ...marker,
            enabled: true,
            x: position.x,
            y: position.y,
            z: position.z,
          }
          : marker
      ));
    };

    const updateLocalShieldGripMarker = (markerId = 'hand', position = {}) => {
      const pointId = markerId || 'hand';
      latestShieldGripMarkersRef.current = (latestShieldGripMarkersRef.current || []).map((marker) => (
        (marker.id || 'hand') === pointId
          ? {
            ...marker,
            enabled: true,
            x: position.x,
            y: position.y,
            z: position.z,
          }
          : marker
      ));
    };

    const commitGripWorldPosition = (markerKey, worldPosition, options = {}) => {
      const offset = getWeaponGripOffsetFromWorld(decorObjectRef.current, worldPosition);
      if (!offset) return null;
      const drag = gripDragRef.current;
      let nextPosition = {
        x: roundGripValue(offset.x),
        y: roundGripValue(offset.y),
        z: roundGripValue(offset.z),
      };
      if (drag?.type === 'armor' && latestArmorCutManipulationEnabledRef.current) {
        nextPosition = constrainArmorManipulationMarkerPosition(
          drag.id || 'lower-belly',
          nextPosition,
          latestArmorManipulationMarkersRef.current || latestArmorGripMarkersRef.current || [],
          latestArmorGripMarkersRef.current || [],
        );
      }
      if (
        drag?.lastPosition
        && drag.lastPosition.x === nextPosition.x
        && drag.lastPosition.y === nextPosition.y
        && drag.lastPosition.z === nextPosition.z
      ) return nextPosition;
      if (drag) drag.lastPosition = nextPosition;
      if (drag?.type === 'shield') {
        updateLocalShieldGripMarker(drag.id || 'hand', nextPosition);
        latestOnShieldGripMarkerChangeRef.current?.(drag.id || 'hand', nextPosition);
        return nextPosition;
      }
      if (drag?.type === 'armor') {
        updateLocalArmorGripMarker(drag.id || 'lower-belly', nextPosition);
        if (options.persist && !latestArmorCutManipulationEnabledRef.current) {
          latestOnArmorGripMarkerChangeRef.current?.(drag.id || 'lower-belly', nextPosition);
        }
        return nextPosition;
      }
      updateLocalWeaponGripMarker(drag?.hand || markerKey, nextPosition);
      latestOnWeaponGripMarkerChangeRef.current?.(drag?.hand || markerKey, nextPosition);
      return nextPosition;
    };

    const endGripDrag = (event) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      if (drag.type === 'armor' && drag.activated && drag.lastPosition && !latestArmorCutManipulationEnabledRef.current) {
        latestOnArmorGripMarkerChangeRef.current?.(drag.id || 'lower-belly', drag.lastPosition);
      }
      gripDragRef.current = null;
      controls.enabled = true;
      container.classList.remove('is-grip-dragging');
      try {
        renderer.domElement.releasePointerCapture?.(drag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
    };

    const handleGripPointerDown = (event) => {
      if (
        event.button !== 0
        || latestArmorContourDrawEnabledRef.current
        || latestArmorPaintDrawEnabledRef.current
        || latestCameraZoomDragEnabledRef.current
        || (!latestWeaponGripMarkersRef.current?.length && !latestShieldGripMarkersRef.current?.length && !latestArmorGripMarkersRef.current?.length)
      ) return;
      syncWeaponGripMarkersRef.current?.(camera);
      const hit = findGripMarkerHit(event);
      if (!hit?.object?.userData?.weaponGripMarker) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      const marker = hit.object;
      const hand = marker.userData.weaponGripHand === 'left' ? 'left' : 'right';
      const markerType = marker.userData.gripMarkerType === 'armor'
        ? 'armor'
        : (marker.userData.gripMarkerType === 'shield' ? 'shield' : 'weapon');
      const markerId = markerType === 'armor'
        ? (marker.userData.gripMarkerId || 'lower-belly')
        : (markerType === 'shield' ? (marker.userData.gripMarkerId || 'hand') : hand);
      const markerKey = `${markerType}-${markerId}`;
      const fromTray = marker.userData.gripMarkerInTray === true;
      camera.getWorldDirection(planeNormal).normalize();
      dragPlane.setFromNormalAndCoplanarPoint(planeNormal, marker.position);
      updatePointer(event);
      const hitPlane = raycaster.ray.intersectPlane(dragPlane, planePoint);
      gripDragRef.current = {
        hand,
        type: markerType,
        id: markerId,
        key: markerKey,
        pointerId: event.pointerId,
        grabOffset: hitPlane ? marker.position.clone().sub(planePoint) : new ThreeVector3(),
        fromTray,
        activated: !fromTray,
        trayPosition: marker.position.clone(),
        lastPosition: null,
      };
      controls.enabled = false;
      container.classList.add('is-grip-dragging');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
      if (!fromTray) {
        commitGripWorldPosition(markerKey, marker.position, { persist: markerType !== 'armor' });
      }
    };

    const handleGripPointerMove = (event) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      updatePointer(event);
      if (!raycaster.ray.intersectPlane(dragPlane, planePoint)) return;
      const nextWorldPosition = planePoint.clone().add(drag.grabOffset);
      const canvasPoint = getCanvasPoint(event);
      const marker = gripMarkersRef.current.get(drag.key || drag.hand);
      if (drag.fromTray && !drag.activated && isCanvasPointInGripTray(canvasPoint)) {
        if (marker) {
          marker.position.copy(nextWorldPosition);
          marker.material.opacity = 0.72;
        }
        return;
      }
      if (drag.fromTray && !drag.activated) {
        drag.activated = true;
      }
      const resolvedPosition = commitGripWorldPosition(drag.key || drag.hand, nextWorldPosition, { persist: drag.type !== 'armor' });
      if (marker) {
        if (drag.type === 'armor' && resolvedPosition) {
          marker.position.copy(getWeaponGripWorldPosition(decorObjectRef.current, {
            type: 'armor',
            id: drag.id || 'lower-belly',
            enabled: true,
            ...resolvedPosition,
          }) || nextWorldPosition);
        } else {
          marker.position.copy(nextWorldPosition);
        }
      }
    };

    const handleRigPickPointerDown = (event) => {
      if (
        event.button !== 0
        || latestArmorContourDrawEnabledRef.current
        || latestArmorPaintDrawEnabledRef.current
        || latestCameraZoomDragEnabledRef.current
        || !latestRigMeshPickEnabledRef.current
        || !latestOnRigMeshPickRef.current
      ) return;
      rigPickStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    };

    const handleRigPickPointerUp = (event) => {
      if (!rigPickStart || gripDragRef.current || !latestRigMeshPickEnabledRef.current || !latestOnRigMeshPickRef.current) {
        rigPickStart = null;
        return;
      }
      const moved = Math.hypot((event.clientX || 0) - rigPickStart.x, (event.clientY || 0) - rigPickStart.y);
      rigPickStart = null;
      if (moved > 7) return;
      const node = findRigMeshHit(event);
      if (!node?.path) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      latestOnRigMeshPickRef.current?.(node);
    };

    const handleArmorContourPointerDown = (event) => {
      if (
        event.button !== 0
        || latestCameraZoomDragEnabledRef.current
        || !latestArmorContourDrawEnabledRef.current
        || !latestOnArmorCutContourChangeRef.current
      ) return;
      contourPickStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    };

    const handleArmorContourPointerUp = (event) => {
      if (
        !contourPickStart
        || gripDragRef.current
        || !latestArmorContourDrawEnabledRef.current
        || !latestOnArmorCutContourChangeRef.current
      ) {
        contourPickStart = null;
        return;
      }
      const moved = Math.hypot((event.clientX || 0) - contourPickStart.x, (event.clientY || 0) - contourPickStart.y);
      contourPickStart = null;
      if (moved > 7) return;
      const point = findArmorContourPoint(event);
      if (!point) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      latestOnArmorCutContourChangeRef.current?.(latestRigActiveSegmentRef.current || 'body', { action: 'append', point });
    };

    const handleArmorContourPointerCancel = () => {
      contourPickStart = null;
    };

    const getArmorPaintPointerSnapshot = (event) => ({
      clientX: event.clientX,
      clientY: event.clientY,
      pointerId: event.pointerId,
    });

    const appendLiveArmorPaintPatch = (points = []) => {
      if (!paintStroke || !Array.isArray(points) || !points.length) return;
      appendArmorCutPaintPatchObjects({
        objects: armorCutPaintObjectsRef.current,
        paintedTriangleKeys: armorCutPaintTriangleKeysRef.current,
        decorObject: decorObjectRef.current,
        stroke: {
          segment: paintStroke.segment,
          radius: paintStroke.radius,
          points,
        },
        activeSegment: latestRigActiveSegmentRef.current || paintStroke.segment,
        sectionPlane: armorSectionWorldPlaneRef.current,
        patchId: armorCutPaintPatchIdRef.current += 1,
      });
      armorCutPaintDirtyRef.current = false;
    };

    const appendArmorPaintPoint = (event, options = {}) => {
      if (paintStroke) paintStroke.lastEvent = getArmorPaintPointerSnapshot(event);
      const previousPointCount = paintStroke?.points?.length || 0;
      if (options.updateCursor !== false) setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
      const point = findArmorContourPoint(event);
      storeArmorPaintBrushSurfacePoint(point);
      if (!point) return null;
      const lastPoint = paintStroke?.lastPoint;
      if (
        lastPoint
        && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y, point.z - lastPoint.z) < 0.035
      ) {
        return lastPoint;
      }
      if (paintStroke) {
        const patchPoints = lastPoint ? [lastPoint, point] : [point];
        paintStroke.lastPoint = point;
        paintStroke.points.push(point);
        if (paintStroke.points.length > ARMOR_PAINT_POINT_LIMIT) {
          paintStroke.points = paintStroke.points.slice(-ARMOR_PAINT_POINT_LIMIT);
        }
        if (paintStroke.points.length !== previousPointCount) appendLiveArmorPaintPatch(patchPoints);
      }
      return point;
    };

    const stopArmorPaintHold = () => {
      if (!paintHoldTimer) return;
      window.clearInterval(paintHoldTimer);
      paintHoldTimer = null;
    };

    const startArmorPaintHold = () => {
      stopArmorPaintHold();
      paintHoldTimer = window.setInterval(() => {
        if (!paintStroke || !latestArmorPaintDrawEnabledRef.current) {
          stopArmorPaintHold();
          return;
        }
        const event = paintStroke.lastEvent;
        if (!event) return;
        appendArmorPaintPoint(event, { force: true, updateCursor: false });
      }, ARMOR_PAINT_HOLD_INTERVAL_MS);
    };

    const handleArmorPaintPointerDown = (event) => {
      if (
        event.button !== 0
        || latestCameraZoomDragEnabledRef.current
        || !latestArmorPaintDrawEnabledRef.current
        || !latestOnArmorCutPaintChangeRef.current
      ) return;
      setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
      const point = findArmorContourPoint(event);
      if (!point) return;
      storeArmorPaintBrushSurfacePoint(point);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      paintStroke = {
        baseStrokes: normalizeArmorCutPaintStrokes(latestArmorCutPaintStrokesRef.current),
        lastEvent: getArmorPaintPointerSnapshot(event),
        pointerId: event.pointerId,
        lastPoint: point,
        points: [point],
        radius: normalizeArmorPaintRadius(latestArmorPaintBrushRadiusRef.current),
        segment: latestRigActiveSegmentRef.current || 'body',
      };
      appendLiveArmorPaintPatch([point]);
      startArmorPaintHold();
      armorPaintStrokeActiveRef.current = true;
      controls.enabled = false;
      container.classList.add('is-painting');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
    };

    const handleArmorPaintPointerMove = (event) => {
      if (!paintStroke || !latestArmorPaintDrawEnabledRef.current) return;
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      paintStroke.lastEvent = getArmorPaintPointerSnapshot(event);
      setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
    };

    const handleArmorPaintPointerHover = (event) => {
      if (paintStroke) return;
      if (!latestArmorPaintDrawEnabledRef.current) {
        setArmorPaintBrushCanvasPoint(null);
        return;
      }
      setArmorPaintBrushCanvasPoint(getCanvasPoint(event));
    };

    const handleArmorPaintPointerLeave = () => {
      setArmorPaintBrushCanvasPoint(null);
      setArmorPaintBrushPoint(null);
    };

    const endArmorPaint = (event) => {
      if (!paintStroke) return;
      stopArmorPaintHold();
      const completedStroke = paintStroke;
      try {
        renderer.domElement.releasePointerCapture?.(completedStroke.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      appendArmorPaintPoint(event || completedStroke.lastEvent, { force: true, updateCursor: false });
      paintStroke = null;
      armorPaintStrokeActiveRef.current = false;
      controls.enabled = true;
      container.classList.remove('is-painting');
      if (completedStroke.points?.length) {
        const segment = normalizeArmorContourSegment(completedStroke.segment);
        const nextStrokes = mergeArmorPaintStroke(
          completedStroke.baseStrokes,
          segment,
          completedStroke.points,
          completedStroke.radius,
        );
        latestArmorCutPaintStrokesRef.current = nextStrokes;
        const modelObject = decorObjectRef.current?.userData?.decorModelObject || decorObjectRef.current;
        const signature = getArmorCutPaintSignature(nextStrokes, modelObject);
        armorCutPaintSignatureRef.current = signature;
        skipNextArmorCutPaintSignatureRef.current = signature;
        armorCutPaintDirtyRef.current = false;
        latestOnArmorCutPaintChangeRef.current?.(completedStroke.segment, {
          action: 'append',
          points: completedStroke.points,
          radius: completedStroke.radius,
        });
      }
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
      applyDecorCameraZoomDelta(camera, controls, deltaY);
      reportCameraZoom();
    };

    const endCameraZoom = (event) => {
      if (!cameraZoomDrag || (event?.pointerId !== undefined && cameraZoomDrag.pointerId !== event.pointerId)) return;
      try {
        renderer.domElement.releasePointerCapture?.(cameraZoomDrag.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      cameraZoomDrag = null;
      controls.enabled = true;
      container.classList.remove('is-camera-zooming');
      reportCameraZoom();
    };

    const hasCanvasPointerInteraction = () => Boolean(
      gripDragRef.current
      || cameraZoomDrag
      || paintStroke
      || armorSectionDragRef.current
      || contourPickStart
      || rigPickStart
    );

    const endCanvasPointerInteractions = (event) => {
      if (!hasCanvasPointerInteraction()) return;
      endGripDrag(event);
      endCameraZoom(event);
      endArmorPaint(event);
      endArmorSectionLine(event);
      handleArmorContourPointerCancel();
      rigPickStart = null;
      controls.enabled = true;
      container.classList.remove('is-grip-dragging', 'is-painting', 'is-camera-zooming', 'is-section-drawing');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endCanvasPointerInteractions();
    };

    renderer.domElement.addEventListener('pointerdown', handleArmorSectionPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleGripPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleCameraZoomPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleArmorPaintPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleArmorContourPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleRigPickPointerDown, true);
    renderer.domElement.addEventListener('pointermove', handleArmorSectionPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleArmorPaintPointerHover, true);
    renderer.domElement.addEventListener('pointermove', handleCameraZoomPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleArmorPaintPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleGripPointerMove, true);
    renderer.domElement.addEventListener('pointerleave', handleArmorPaintPointerLeave, true);
    renderer.domElement.addEventListener('pointerup', endArmorSectionLine, true);
    renderer.domElement.addEventListener('pointerup', endGripDrag, true);
    renderer.domElement.addEventListener('pointerup', endCameraZoom, true);
    renderer.domElement.addEventListener('pointerup', endArmorPaint, true);
    renderer.domElement.addEventListener('pointerup', handleArmorContourPointerUp, true);
    renderer.domElement.addEventListener('pointerup', handleRigPickPointerUp, true);
    renderer.domElement.addEventListener('pointercancel', endArmorSectionLine, true);
    renderer.domElement.addEventListener('pointercancel', endGripDrag, true);
    renderer.domElement.addEventListener('pointercancel', endCameraZoom, true);
    renderer.domElement.addEventListener('pointercancel', endArmorPaint, true);
    renderer.domElement.addEventListener('pointercancel', handleArmorContourPointerCancel, true);
    renderer.domElement.addEventListener('lostpointercapture', endCanvasPointerInteractions);
    window.addEventListener('pointerup', endCanvasPointerInteractions);
    window.addEventListener('pointercancel', endCanvasPointerInteractions);
    window.addEventListener('blur', endCanvasPointerInteractions);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelAnimationFrame(frameId);
      controls.removeEventListener?.('change', handleControlsChange);
      renderer.domElement.removeEventListener('pointerdown', handleArmorSectionPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleGripPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleCameraZoomPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleArmorPaintPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleArmorContourPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleRigPickPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorSectionPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorPaintPointerHover, true);
      renderer.domElement.removeEventListener('pointermove', handleCameraZoomPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorPaintPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleGripPointerMove, true);
      renderer.domElement.removeEventListener('pointerleave', handleArmorPaintPointerLeave, true);
      renderer.domElement.removeEventListener('pointerup', endArmorSectionLine, true);
      renderer.domElement.removeEventListener('pointerup', endGripDrag, true);
      renderer.domElement.removeEventListener('pointerup', endCameraZoom, true);
      renderer.domElement.removeEventListener('pointerup', endArmorPaint, true);
      renderer.domElement.removeEventListener('pointerup', handleArmorContourPointerUp, true);
      renderer.domElement.removeEventListener('pointerup', handleRigPickPointerUp, true);
      renderer.domElement.removeEventListener('pointercancel', endArmorSectionLine, true);
      renderer.domElement.removeEventListener('pointercancel', endGripDrag, true);
      renderer.domElement.removeEventListener('pointercancel', endCameraZoom, true);
      renderer.domElement.removeEventListener('pointercancel', endArmorPaint, true);
      renderer.domElement.removeEventListener('pointercancel', handleArmorContourPointerCancel, true);
      renderer.domElement.removeEventListener('lostpointercapture', endCanvasPointerInteractions);
      window.removeEventListener('pointerup', endCanvasPointerInteractions);
      window.removeEventListener('pointercancel', endCanvasPointerInteractions);
      window.removeEventListener('blur', endCanvasPointerInteractions);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      detachCameraControls();
      controls.dispose();
      decorObjectRef.current = null;
      disposeWeaponGripMarkers(gripMarkersRef.current);
      disposeRigCutPreviewObjects(rigCutPreviewObjectsRef.current);
      disposeArmorCutContourObjects(armorCutContourObjectsRef.current);
      disposeArmorCutContourObjects(armorCutPaintObjectsRef.current);
      disposeArmorPaintBrushPreview(armorPaintBrushPreviewRef.current);
      stopArmorPaintHold();
      armorPaintBrushPreviewRef.current = null;
      disposeArmorManipulationGuides(armorManipulationGuideObjectsRef.current);
      rigCutPreviewRootRef.current = null;
      gripRootRef.current = null;
      clearGroup(decorRoot);
      disposeThreeObject(floor);
      disposeThreeObject(grid);
      scene.environment = null;
      environmentMap.dispose();
      pmremGenerator.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      if (renderer.domElement.parentNode === container) container.removeChild(renderer.domElement);
      decorRootRef.current = null;
      rendererRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      previewFloorRef.current = null;
      previewGridRef.current = null;
    };
  }, []);

  useEffect(() => {
    applyDecorPreviewSize(decorObjectRef.current, latestModelRef.current);
    frameDecorPreviewObject(decorObjectRef.current, cameraRef.current, controlsRef.current);
    if (armorSectionWorldPlaneRef.current) {
      armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(decorObjectRef.current, armorSectionWorldPlaneRef.current);
      applyArmorSectionClipping(decorObjectRef.current, armorSectionWorldPlaneRef.current);
    }
    latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
  }, [sizeSignature]);

  useEffect(() => {
    applyDecorPreviewPose(decorObjectRef.current, latestModelRef.current);
    frameDecorPreviewObject(decorObjectRef.current, cameraRef.current, controlsRef.current);
    if (armorSectionWorldPlaneRef.current) {
      armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(decorObjectRef.current, armorSectionWorldPlaneRef.current);
      applyArmorSectionClipping(decorObjectRef.current, armorSectionWorldPlaneRef.current);
    }
    latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
  }, [poseSignature]);

  useEffect(() => {
    applyDecorPreviewAppearance(decorObjectRef.current, latestModelRef.current);
    if (armorSectionWorldPlaneRef.current) {
      applyArmorSectionClipping(decorObjectRef.current, armorSectionWorldPlaneRef.current);
    }
  }, [appearanceSignature]);

  useEffect(() => {
    const decorRoot = decorRootRef.current;
    if (!decorRoot || !model) return undefined;
    let cancelled = false;
    decorObjectRef.current = null;
    disposeArmorPaintBrushPreview(armorPaintBrushPreviewRef.current);
    armorPaintBrushPreviewRef.current = null;
    armorPaintBrushPointRef.current = null;
    disposeArmorCutContourObjects(armorCutPaintObjectsRef.current);
    armorCutPaintTriangleKeysRef.current.clear();
    armorCutPaintPatchIdRef.current = 0;
    armorCutPaintSignatureRef.current = '';
    skipNextArmorCutPaintSignatureRef.current = '';
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    clearGroup(decorRoot);
    const sources = getDecorModelSources(model);
    if (sources.length) {
      setPreviewStatus('Chargement du modèle 3D...');
      const loadingRoot = new ThreeGroup();
      decorRoot.add(loadingRoot);
      loadThreeDecor(sources, model, (object) => {
        if (cancelled || decorRoot.userData?.disposed) {
          disposeThreeObject(object);
          return;
        }
        clearGroup(loadingRoot);
        loadingRoot.add(object);
        decorObjectRef.current = object;
        applyDecorPreviewSize(object, latestModelRef.current);
        applyDecorPreviewAppearance(object, latestModelRef.current);
        frameDecorPreviewObject(object, cameraRef.current, controlsRef.current);
        if (armorSectionWorldPlaneRef.current) {
          armorSectionLocalPlaneRef.current = getArmorSectionLocalPaintPlane(object, armorSectionWorldPlaneRef.current);
          applyArmorSectionClipping(object, armorSectionWorldPlaneRef.current);
        }
        armorCutPreviewDirtyRef.current = true;
        armorCutContourDirtyRef.current = true;
        armorCutPaintDirtyRef.current = true;
        latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
        setPreviewStatus('');
      }, (error) => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        setPreviewStatus(error?.message ? `Modèle 3D non affiché: ${error.message}` : 'Modèle 3D non affiché.');
      });
    } else {
      clearGroup(decorRoot);
      setPreviewStatus('');
    }
    return () => {
      cancelled = true;
      decorObjectRef.current = null;
    };
  }, [buildSignature]);

  const sectionLineStyle = sectionLine
    ? {
      left: `${sectionLine.x}px`,
      top: `${sectionLine.y}px`,
      width: `${Math.hypot((sectionLine.x2 || sectionLine.x) - sectionLine.x, (sectionLine.y2 || sectionLine.y) - sectionLine.y)}px`,
      transform: `rotate(${Math.atan2((sectionLine.y2 || sectionLine.y) - sectionLine.y, (sectionLine.x2 || sectionLine.x) - sectionLine.x)}rad)`,
    }
    : null;
  const hasGripMarkers = Boolean(weaponGripMarkers?.length || shieldGripMarkers?.length || armorGripMarkers?.length);

  return (
    <div
      ref={containerRef}
      className={`decor3d-canvas-shell ${hasGripMarkers ? 'decor3d-canvas-shell-grips' : ''} ${armorContourDrawEnabled || armorPaintDrawEnabled ? 'decor3d-canvas-shell-contour' : ''} ${armorSectionToolEnabled ? 'decor3d-canvas-shell-section' : ''} ${cameraZoomDragEnabled ? 'decor3d-canvas-shell-zoom' : ''}`}
    >
      {children}
      {hasGripMarkers ? <div className="decor3d-grip-tray-frame" aria-hidden="true" /> : null}
      {paintBrushCircle ? (
        <div
          className="decor3d-paint-brush-circle"
          style={{
            borderColor: paintBrushCircle.color,
            color: paintBrushCircle.color,
            height: `${paintBrushCircle.radius * 2}px`,
            left: `${paintBrushCircle.x}px`,
            top: `${paintBrushCircle.y}px`,
            width: `${paintBrushCircle.radius * 2}px`,
          }}
        />
      ) : null}
      {sectionLineStyle ? (
        <div
          className={`decor3d-section-line${sectionLine?.pending ? ' is-pending' : ''}`}
          style={sectionLineStyle}
        />
      ) : null}
      {sectionStatus ? <div className="decor3d-section-status">{sectionStatus}</div> : null}
      {webglError ? <div className="decor3d-webgl-error">{webglError}</div> : null}
      {!webglError && previewStatus ? <div className="decor3d-preview-status">{previewStatus}</div> : null}
    </div>
  );
}
