import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
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
  fitObjectToLargestDimension,
  getDecorMaterialBrightness,
  getDecorModelDimensions,
  getDecorModelSources,
  isInventoryDecorKind,
  isFloorTileKind,
  loadThreeDecor,
  makePreviewStandardMaterial,
  numberValue,
} from '../../utils/rpg3dModelImport';
import {
  fitObjectToDimensions,
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
const ARMOR_CONTOUR_SEGMENT_PRIORITY = ['left-arm', 'right-arm', 'body'];
const ARMOR_CONTOUR_POINT_LIMIT = 80;
const ARMOR_PAINT_POINT_LIMIT = 240;
const ARMOR_PAINT_RADIUS = 0.14;
const ARMOR_PAINT_RADIUS_MIN = 0.04;
const ARMOR_PAINT_RADIUS_MAX = 0.5;
const DECOR_CAMERA_ZOOM_DRAG_SENSITIVITY = 0.018;
const DECOR_CAMERA_ZOOM_MIN_DISTANCE = 0.02;
const DECOR_CAMERA_ZOOM_MAX_DISTANCE = 100000;
const WEAPON_GRIP_POSITION_MIN = -2;
const WEAPON_GRIP_POSITION_MAX = 2;

const clampGripValue = (value) => THREE.MathUtils.clamp(
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

const normalizeArmorContourPoint = (point = {}) => ({
  x: roundGripValue(point.x),
  y: roundGripValue(point.y),
  z: roundGripValue(point.z),
  ...normalizeArmorPaintSurfaceNormal(point),
});

const normalizeArmorPaintRadius = (value = ARMOR_PAINT_RADIUS) => (
  THREE.MathUtils.clamp(
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
        .slice(0, ARMOR_PAINT_POINT_LIMIT)
        .map(normalizeArmorContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const getArmorCutContoursSignature = (contours = [], activeSegment = 'body', modelObject = null) => (
  [
    modelObject?.uuid || '',
    modelObject?.position ? modelObject.position.toArray().map((value) => Number(value).toFixed(3)).join(',') : '',
    activeSegment,
    JSON.stringify(normalizeArmorCutContours(contours)),
  ].join('|')
);

const getArmorCutPaintSignature = (strokes = [], activeSegment = 'body', modelObject = null) => (
  [
    modelObject?.uuid || '',
    modelObject?.position ? modelObject.position.toArray().map((value) => Number(value).toFixed(3)).join(',') : '',
    activeSegment,
    JSON.stringify(normalizeArmorCutPaintStrokes(strokes)),
  ].join('|')
);

const getArmorPaintDepthTolerance = (radius = ARMOR_PAINT_RADIUS) => (
  THREE.MathUtils.clamp(normalizeArmorPaintRadius(radius) * 0.28, 0.025, 0.08)
);

const getArmorPaintPlaneTolerance = (radius = ARMOR_PAINT_RADIUS) => (
  THREE.MathUtils.clamp(normalizeArmorPaintRadius(radius) * 0.12, 0.012, 0.035)
);

const getArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return null;
  const normal = new THREE.Vector3(nx, ny, nz);
  return normal.lengthSq() > 0.000001 ? normal.normalize() : null;
};

const isPointOnPaintSurface = (point, paintPoint, radius = ARMOR_PAINT_RADIUS) => (
  Math.abs((Number(point?.z) || 0) - (Number(paintPoint?.z) || 0)) <= getArmorPaintDepthTolerance(radius)
);

const isPointInsidePaintStamp = (point, paintPoint, radius = ARMOR_PAINT_RADIUS) => {
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
    const normal = startNormal.lerp(endNormal, THREE.MathUtils.clamp(t, 0, 1));
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
  const t = THREE.MathUtils.clamp((
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

const isPointInsideArmorPaintBounds = (point = new THREE.Vector3(), bounds = null) => (
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

const classifyArmorPaintPoint = (point = new THREE.Vector3(), strokes = []) => {
  const preparedStrokes = prepareArmorPaintStrokes(strokes);
  if (!preparedStrokes.length) return '';
  return preparedStrokes.find((stroke) => {
    if (!isPointInsideArmorPaintBounds(point, stroke.paintBounds)) return false;
    if (stroke.points.some((paintPoint) => isPointInsidePaintStamp(point, paintPoint, stroke.radius))) return true;
    for (let index = 1; index < stroke.points.length; index += 1) {
      if (getPointToPaintSegmentHit(point, stroke.points[index - 1], stroke.points[index], stroke.radius)) return true;
    }
    return false;
  })?.segment || '';
};

const isPointInsideArmorContour = (point = new THREE.Vector3(), points = []) => {
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

const classifyArmorContourPoint = (point = new THREE.Vector3(), contours = []) => {
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

const createWeaponGripMarkerTexture = (marker = 'right') => {
  const markerKey = typeof marker === 'string' ? marker : getGripMarkerKey(marker);
  const config = WEAPON_GRIP_MARKER_COLORS[markerKey] || WEAPON_GRIP_MARKER_COLORS.right;
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
  context.font = '900 38px system-ui, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillStyle = config.text;
  context.fillText(config.label, 48, 50);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const createWeaponGripMarker = (marker = {}) => {
  const texture = createWeaponGripMarkerTexture(marker);
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    opacity: marker.enabled ? 1 : 0.42,
  });
  const sprite = new THREE.Sprite(material);
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

const createRigCutPreviewMaterial = (segment = 'body') => {
  const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
  return new THREE.MeshBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: config.opacity,
    depthTest: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
    side: THREE.DoubleSide,
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
  clone.side = THREE.DoubleSide;
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
  object.material.opacity = activeSegment === segment ? config.activeOpacity : config.opacity;
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
  const geometry = new THREE.BufferGeometry();
  builder.attributeNames.forEach((name) => {
    const attribute = sourceGeometry.attributes[name];
    const values = builder.attributes[name];
    if (!attribute || !values?.length) return;
    const ArrayCtor = attribute.array?.constructor || attribute.data?.array?.constructor || Float32Array;
    geometry.setAttribute(name, new THREE.BufferAttribute(new ArrayCtor(values), attribute.itemSize, attribute.normalized));
  });
  builder.groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const getPointToSegmentDistance = (point, start, end) => {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  if (lengthSq <= 0.000001) return point.distanceTo(start);
  const t = THREE.MathUtils.clamp(point.clone().sub(start).dot(segment) / lengthSq, 0, 1);
  return point.distanceTo(start.clone().add(segment.multiplyScalar(t)));
};

const isPointInsideArmorTorso = (point, leftShoulder, rightShoulder, lowerBelly, referenceScale = 1) => {
  const minShoulderX = Math.min(leftShoulder.x, rightShoulder.x);
  const maxShoulderX = Math.max(leftShoulder.x, rightShoulder.x);
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const torsoHeight = Math.max(0.0001, shoulderY - lowerBelly.y);
  const t = THREE.MathUtils.clamp((point.y - lowerBelly.y) / torsoHeight, 0, 1);
  const shoulderWidth = Math.max(0.0001, maxShoulderX - minShoulderX);
  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const topHalfWidth = Math.max(referenceScale * 0.16, shoulderWidth * 0.37);
  const bottomHalfWidth = Math.max(referenceScale * 0.22, shoulderWidth * 0.48);
  const leftEdge = THREE.MathUtils.lerp(lowerBelly.x - bottomHalfWidth, shoulderCenterX - topHalfWidth, t);
  const rightEdge = THREE.MathUtils.lerp(lowerBelly.x + bottomHalfWidth, shoulderCenterX + topHalfWidth, t);
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

const classifyArmorCutPoint = (point = new THREE.Vector3(), markerOffsets = {}, contours = [], paintStrokes = []) => {
  const paintSegment = classifyArmorPaintPoint(point, paintStrokes);
  if (paintSegment) return paintSegment;
  const contourSegment = classifyArmorContourPoint(point, contours);
  if (contourSegment) return contourSegment;
  const leftShoulder = markerOffsets.leftShoulder || new THREE.Vector3(-0.45, 0.55, 0);
  const rightShoulder = markerOffsets.rightShoulder || new THREE.Vector3(0.45, 0.55, 0);
  const leftElbow = markerOffsets.leftElbow || new THREE.Vector3(-0.65, 0.05, 0);
  const rightElbow = markerOffsets.rightElbow || new THREE.Vector3(0.65, 0.05, 0);
  const lowerBelly = markerOffsets.lowerBelly || new THREE.Vector3(0, -0.55, 0);
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
    leftShoulder: get('left-shoulder', new THREE.Vector3(-0.45, 0.55, 0)),
    rightShoulder: get('right-shoulder', new THREE.Vector3(0.45, 0.55, 0)),
    leftElbow: get('left-elbow', new THREE.Vector3(-0.65, 0.05, 0)),
    rightElbow: get('right-elbow', new THREE.Vector3(0.65, 0.05, 0)),
    lowerBelly: get('lower-belly', new THREE.Vector3(0, -0.55, 0)),
  };
};

const getArmorCutSignature = (modelObject = null, markers = [], contours = [], paintStrokes = []) => {
  const meshSignature = [];
  modelObject?.traverse?.((child) => {
    if (child.isMesh && child.geometry?.attributes?.position) {
      meshSignature.push(`${child.uuid}:${child.geometry.uuid}:${child.geometry.attributes.position.count}`);
    }
  });
  const markerSignature = markers
    .map((marker) => `${marker.id}:${Number(marker.x).toFixed(3)}:${Number(marker.y).toFixed(3)}:${Number(marker.z).toFixed(3)}:${marker.enabled !== false ? 1 : 0}`)
    .join('|');
  return `${meshSignature.join(';')}|${markerSignature}|${JSON.stringify(normalizeArmorCutContours(contours))}|${JSON.stringify(normalizeArmorCutPaintStrokes(paintStrokes))}`;
};

const buildArmorCutPreviewMeshes = ({ root, objects, decorObject, markers, contours, paintStrokes }) => {
  const gripSpace = getDecorGripSpace(decorObject);
  const modelObject = gripSpace?.modelObject;
  if (!root || !modelObject?.traverse || !gripSpace?.space) return false;
  const markerOffsets = getArmorCutMarkerOffsets(markers);
  const preparedPaintStrokes = prepareArmorPaintStrokes(paintStrokes);
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
    const localCenter = new THREE.Vector3();
    const worldCenter = new THREE.Vector3();
    const gripPoint = new THREE.Vector3();
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
      const segment = classifyArmorCutPoint(gripPoint, markerOffsets, contours, preparedPaintStrokes);
      appendRigCutTriangle(builders[segment], geometry, vertexIndices, getRigCutTriangleMaterialIndex(geometry, triangleStart));
    }
    Object.entries(builders).forEach(([segment, builder]) => {
      const splitGeometry = buildRigCutGeometry(geometry, builder);
      if (!splitGeometry) return;
      const colorMaterial = createRigCutPreviewMaterial(segment);
      const overlay = new THREE.Mesh(splitGeometry, colorMaterial);
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
    const points = entry.points.map((point) => new THREE.Vector3(
      basePosition.x + point.x,
      basePosition.y + point.y,
      basePosition.z + point.z,
    ));
    if (points.length >= 2) {
      const closed = points.length >= 3;
      const curve = new THREE.CatmullRomCurve3(points, closed);
      const geometry = new THREE.TubeGeometry(curve, Math.max(12, points.length * 4), 0.022, 8, closed);
      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        depthTest: false,
        depthWrite: false,
        transparent: true,
        opacity: activeSegment === entry.segment ? 0.95 : 0.52,
      });
      const line = new THREE.Mesh(geometry, material);
      line.name = `ArmorCutContour-${entry.segment}`;
      line.renderOrder = 230;
      line.userData.rigCutContour = true;
      gripSpace.space.add(line);
      objects.set(`${entry.segment}:line`, line);
    }
    const pointGeometry = new THREE.BufferGeometry().setFromPoints(points);
    const pointMaterial = new THREE.PointsMaterial({
      color: config.color,
      depthTest: false,
      depthWrite: false,
      size: activeSegment === entry.segment ? 0.075 : 0.052,
      sizeAttenuation: true,
      transparent: true,
      opacity: activeSegment === entry.segment ? 1 : 0.62,
    });
    const pointCloud = new THREE.Points(pointGeometry, pointMaterial);
    pointCloud.name = `ArmorCutContourPoints-${entry.segment}`;
    pointCloud.renderOrder = 231;
    pointCloud.userData.rigCutContour = true;
    gripSpace.space.add(pointCloud);
    objects.set(`${entry.segment}:points`, pointCloud);
  });
  return objects.size > 0;
};

const createArmorPaintBrushPreview = (segment = 'body') => {
  const config = ARMOR_CUT_PREVIEW_COLORS[normalizeArmorContourSegment(segment)] || ARMOR_CUT_PREVIEW_COLORS.body;
  const group = new THREE.Group();
  group.name = 'ArmorPaintBrushPreview';
  group.userData.previewSegment = normalizeArmorContourSegment(segment);
  group.visible = false;

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.985, 1.015, 64),
    new THREE.MeshBasicMaterial({
      color: config.color,
      depthTest: true,
      depthWrite: false,
      side: THREE.DoubleSide,
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

const buildArmorCutPaintObjects = ({ objects, decorObject, paintStrokes, activeSegment }) => {
  const gripSpace = getDecorGripSpace(decorObject);
  if (!gripSpace?.space || !gripSpace?.modelObject) return false;
  const preparedStrokes = prepareArmorPaintStrokes(paintStrokes);
  if (!preparedStrokes.length) return false;
  const sourceMeshes = [];
  gripSpace.modelObject.updateMatrixWorld?.(true);
  gripSpace.space.updateMatrixWorld?.(true);
  gripSpace.modelObject.traverse((child) => {
    if (
      (child.isMesh || child.isSkinnedMesh)
      && child.geometry?.attributes?.position
      && !child.userData?.rigCutPaint
      && !child.userData?.rigCutContour
    ) {
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
    const localCenter = new THREE.Vector3();
    const worldCenter = new THREE.Vector3();
    const gripPoint = new THREE.Vector3();
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
      const segment = classifyArmorPaintPoint(gripPoint, preparedStrokes);
      if (segment) {
        appendRigCutTriangle(builders[segment], geometry, vertexIndices, getRigCutTriangleMaterialIndex(geometry, triangleStart));
      }
    }
    Object.entries(builders).forEach(([segment, builder]) => {
      const splitGeometry = buildRigCutGeometry(geometry, builder);
      if (!splitGeometry) return;
      const config = ARMOR_CUT_PREVIEW_COLORS[segment] || ARMOR_CUT_PREVIEW_COLORS.body;
      const material = new THREE.MeshBasicMaterial({
        color: config.color,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -10,
        polygonOffsetUnits: -10,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: activeSegment === segment ? 0.5 : 0.28,
      });
      const paintSurface = new THREE.Mesh(splitGeometry, material);
      paintSurface.name = `ArmorCutPaintSurface-${segment}`;
      paintSurface.frustumCulled = false;
      paintSurface.renderOrder = 238;
      paintSurface.userData.rigCutPaint = true;
      mesh.add(paintSurface);
      objects.set(`${mesh.uuid}:${segment}:paint-surface`, paintSurface);
    });
  });
  return objects.size > 0;
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
  return new THREE.Vector3(x, y, z);
};

const getArmorManipulationLineForMarker = (markerId = '') => (
  ARMOR_MANIPULATION_ARM_LINES.find((entry) => entry.shoulderId === markerId || entry.elbowId === markerId) || null
);

const roundGripVector = (vector = new THREE.Vector3()) => ({
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
  const line = getArmorManipulationLineForMarker(markerId);
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
  const desiredPoint = new THREE.Vector3(
    Number(position.x) || 0,
    Number(position.y) || 0,
    Number(position.z) || 0,
  );
  let direction = desiredPoint.sub(fixedPoint);
  if (direction.lengthSq() <= 0.000001 && referenceDraggedPoint && referenceFixedPoint) {
    direction = referenceDraggedPoint.clone().sub(referenceFixedPoint);
  }
  if (direction.lengthSq() <= 0.000001) direction = new THREE.Vector3(0, markerId === line.shoulderId ? 1 : -1, 0);
  const constrainedPoint = fixedPoint.add(direction.normalize().multiplyScalar(referenceLength));
  return roundGripVector(constrainedPoint);
};

const createArmorManipulationGuide = (line = {}) => {
  const config = ARMOR_CUT_PREVIEW_COLORS[line.segment] || ARMOR_CUT_PREVIEW_COLORS.body;
  const geometry = new THREE.CylinderGeometry(0.014, 0.014, 1, 12, 1, true);
  const material = new THREE.MeshBasicMaterial({
    color: config.color,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    opacity: 0.94,
  });
  const guide = new THREE.Mesh(geometry, material);
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
  guide.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
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
  const shoulderKey = isRightArm ? 'rightShoulder' : 'leftShoulder';
  const elbowKey = isRightArm ? 'rightElbow' : 'leftElbow';
  const toGripSpacePoint = (offset) => gripSpace.modelObject.position.clone().add(offset);
  const sourceShoulder = toGripSpacePoint(sourceOffsets[shoulderKey]);
  const sourceElbow = toGripSpacePoint(sourceOffsets[elbowKey]);
  const targetShoulder = toGripSpacePoint(targetOffsets[shoulderKey]);
  const targetElbow = toGripSpacePoint(targetOffsets[elbowKey]);
  const sourceLine = sourceShoulder.clone().sub(sourceElbow);
  const targetLine = targetShoulder.clone().sub(targetElbow);
  if (sourceLine.lengthSq() <= 0.000001 || targetLine.lengthSq() <= 0.000001) return null;
  const lineRotation = new THREE.Quaternion().setFromUnitVectors(sourceLine.normalize(), targetLine.normalize());
  const localTransform = new THREE.Matrix4()
    .makeTranslation(targetShoulder.x, targetShoulder.y, targetShoulder.z)
    .multiply(new THREE.Matrix4().makeRotationFromQuaternion(lineRotation))
    .multiply(new THREE.Matrix4().makeTranslation(-sourceShoulder.x, -sourceShoulder.y, -sourceShoulder.z));
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
};

const getPreviewFrameBox = (decorObject) => {
  const object = decorObject?.userData?.decorOrientationObject || decorObject;
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object, true);
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
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const verticalFov = THREE.MathUtils.degToRad(camera.fov || 48);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.1, camera.aspect || 1));
  const distanceForHeight = size.y / (2 * Math.tan(verticalFov / 2));
  const distanceForWidth = Math.max(size.x, size.z) / (2 * Math.tan(horizontalFov / 2));
  const desiredDistance = THREE.MathUtils.clamp(
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
  const nextDistance = THREE.MathUtils.clamp(
    currentDistance + (Number(deltaY) || 0) * sensitivity,
    DECOR_CAMERA_ZOOM_MIN_DISTANCE,
    DECOR_CAMERA_ZOOM_MAX_DISTANCE,
  );
  camera.position.copy(controls.target).addScaledVector(direction, nextDistance);
  controls.update();
  return getDecorCameraZoomPercent(camera, controls);
};

const applyDecorPreviewSize = (decorObject, model = {}) => {
  const modelObject = decorObject?.userData?.decorModelObject;
  if (!modelObject) return;
  resetObjectBaseTransform(modelObject);
  const dimensions = getDecorModelDimensions(model);
  if (isInventoryDecorKind(model.kind)) {
    fitObjectToLargestDimension(modelObject, Math.max(dimensions.x, dimensions.y, dimensions.z), { groundY: 0 });
  } else {
    fitObjectToDimensions(modelObject, {
      width: dimensions.x,
      height: dimensions.y,
      depth: dimensions.z,
    }, { groundY: 0 });
  }

  const collisionRing = decorObject.userData?.decorCollisionRing;
  if (collisionRing?.userData?.baseRadius) {
    const nextRadius = Math.max(dimensions.x, dimensions.z);
    const baseRadius = Number(collisionRing.userData.baseRadius) || nextRadius;
    collisionRing.scale.setScalar(Math.max(0.001, nextRadius / baseRadius));
  }
  applyDecorPreviewPose(decorObject, model);
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
  const armorCutPaintSignatureRef = useRef('');
  const armorCutPreviewDirtyRef = useRef(true);
  const armorCutContourDirtyRef = useRef(true);
  const armorCutPaintDirtyRef = useRef(true);
  const armorPaintStrokeActiveRef = useRef(false);
  const armorPaintBrushPreviewRef = useRef(null);
  const armorPaintBrushPointRef = useRef(null);
  const armorManipulationGuideObjectsRef = useRef(new Map());
  const gripMarkersRef = useRef(new Map());
  const gripDragRef = useRef(null);
  const cameraRef = useRef(null);
  const controlsRef = useRef(null);
  const latestModelRef = useRef(model);
  const latestWeaponGripMarkersRef = useRef(weaponGripMarkers);
  const latestShieldGripMarkersRef = useRef(shieldGripMarkers);
  const latestArmorCanvasCutEnabledRef = useRef(armorCanvasCutEnabled);
  const latestArmorContourDrawEnabledRef = useRef(armorContourDrawEnabled);
  const latestArmorPaintDrawEnabledRef = useRef(armorPaintDrawEnabled);
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
  const buildSignature = useMemo(() => getDecorPreviewModelSignature(model), [model]);
  const sizeSignature = useMemo(() => getDecorSizeSignature(model), [model]);
  const poseSignature = useMemo(() => getDecorPoseSignature(model), [model]);
  const appearanceSignature = useMemo(() => getDecorAppearanceSignature(model), [model]);

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
    latestArmorCutPaintStrokesRef.current = normalizeArmorCutPaintStrokes(armorCutPaintStrokes);
    armorCutPreviewDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
  }, [armorCutPaintStrokes]);

  useEffect(() => {
    latestArmorCanvasCutEnabledRef.current = armorCanvasCutEnabled;
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
  }, [armorCanvasCutEnabled]);

  useEffect(() => {
    latestArmorContourDrawEnabledRef.current = armorContourDrawEnabled;
  }, [armorContourDrawEnabled]);

  useEffect(() => {
    latestArmorPaintDrawEnabledRef.current = armorPaintDrawEnabled;
    syncWeaponGripMarkersRef.current?.(cameraRef.current);
    syncArmorPaintBrushPreviewRef.current?.();
  }, [armorPaintDrawEnabled]);

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
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    syncArmorPaintBrushPreviewRef.current?.();
  }, [rigActiveSegment]);

  useEffect(() => {
    latestOnRigMeshPickRef.current = onRigMeshPick;
  }, [onRigMeshPick]);

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
      const worldPosition = getWeaponGripWorldPosition(decorObject, { ...markerConfig, hand });
      if (!worldPosition) {
        marker.visible = false;
        return;
      }
      marker.visible = true;
      marker.position.copy(worldPosition);
      marker.material.opacity = markerConfig.enabled ? 1 : 0.42;
      marker.userData.weaponGripEnabled = Boolean(markerConfig.enabled);
      marker.userData.gripMarkerType = markerConfig.type;
      marker.userData.gripMarkerId = markerConfig.type === 'armor'
        ? (markerConfig.id || 'lower-belly')
        : (markerConfig.type === 'shield' ? (markerConfig.id || 'hand') : hand);
      if (camera) {
        const distance = Math.max(0.1, camera.position.distanceTo(marker.position));
        const markerSize = THREE.MathUtils.clamp(distance * 0.065, 0.08, 0.28);
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
      gripSpace.modelObject.position.clone().add(offset || new THREE.Vector3()),
    );
    ARMOR_MANIPULATION_ARM_LINES.forEach((line) => {
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
    const paintStrokes = latestArmorCutPaintStrokesRef.current;
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
      const signature = getArmorCutSignature(modelObject, markers, contours, paintStrokes);
      if (signature !== rigCutPreviewSignatureRef.current && !deferArmorCutRebuild) {
        disposeRigCutPreviewObjects(objects);
        rigCutPreviewSignatureRef.current = '';
        if (!buildArmorCutPreviewMeshes({ root, objects, decorObject, markers, contours, paintStrokes })) {
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
        manipulationEnabled ? 'object' : 'cut',
      );
    });
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
    const signature = getArmorCutContoursSignature(contours, latestRigActiveSegmentRef.current, modelObject);
    if (signature === armorCutContourSignatureRef.current) {
      armorCutContourDirtyRef.current = false;
      return;
    }
    disposeArmorCutContourObjects(objects);
    armorCutContourSignatureRef.current = '';
    if (buildArmorCutContourObjects({
      objects,
      decorObject,
      contours,
      activeSegment: latestRigActiveSegmentRef.current || 'body',
    })) {
      armorCutContourSignatureRef.current = signature;
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
      armorCutPaintSignatureRef.current = '';
      armorCutPaintDirtyRef.current = false;
      return;
    }
    const signature = getArmorCutPaintSignature(paintStrokes, latestRigActiveSegmentRef.current, modelObject);
    if (signature === armorCutPaintSignatureRef.current) {
      armorCutPaintDirtyRef.current = false;
      return;
    }
    disposeArmorCutContourObjects(objects);
    armorCutPaintSignatureRef.current = '';
    if (buildArmorCutPaintObjects({
      objects,
      decorObject,
      paintStrokes,
      activeSegment: latestRigActiveSegmentRef.current || 'body',
    })) {
      armorCutPaintSignatureRef.current = signature;
    }
    armorCutPaintDirtyRef.current = false;
  }, []);

  syncArmorCutPaintRef.current = syncArmorCutPaint;

  const syncArmorPaintBrushPreview = useCallback(() => {
    const decorObject = decorObjectRef.current;
    const point = armorPaintBrushPointRef.current;
    if (!decorObject || !latestArmorPaintDrawEnabledRef.current || !point) {
      if (armorPaintBrushPreviewRef.current) armorPaintBrushPreviewRef.current.visible = false;
      return;
    }
    const gripSpace = getDecorGripSpace(decorObject);
    if (!gripSpace?.space || !gripSpace?.modelObject) {
      if (armorPaintBrushPreviewRef.current) armorPaintBrushPreviewRef.current.visible = false;
      return;
    }
    const radius = normalizeArmorPaintRadius(latestArmorPaintBrushRadiusRef.current);
    const segment = normalizeArmorContourSegment(latestRigActiveSegmentRef.current || 'body');
    if (!armorPaintBrushPreviewRef.current) {
      armorPaintBrushPreviewRef.current = createArmorPaintBrushPreview(segment);
    }
    if (armorPaintBrushPreviewRef.current.parent !== gripSpace.space) {
      armorPaintBrushPreviewRef.current.parent?.remove?.(armorPaintBrushPreviewRef.current);
      gripSpace.space.add(armorPaintBrushPreviewRef.current);
    }
    const nextPreview = armorPaintBrushPreviewRef.current;
    if (!nextPreview) return;
    updateArmorPaintBrushPreviewAppearance(nextPreview, radius, segment);
    const basePosition = gripSpace.modelObject.position;
    const normal = getArmorPaintSurfaceNormal(point) || new THREE.Vector3(0, 0, 1);
    nextPreview.position.set(
      basePosition.x + point.x + (normal.x * 0.006),
      basePosition.y + point.y + (normal.y * 0.006),
      basePosition.z + point.z + (normal.z * 0.006),
    );
    nextPreview.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    nextPreview.visible = true;
  }, []);

  syncArmorPaintBrushPreviewRef.current = syncArmorPaintBrushPreview;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'default' });
    } catch {
      setWebglError('Apercu 3D indisponible.');
      return undefined;
    }

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.domElement.className = 'decor3d-canvas';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    setWebglError('');

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#07111e');
    scene.fog = new THREE.Fog('#07111e', 8, 22);
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    const roomEnvironment = new RoomEnvironment();
    const environmentMap = pmremGenerator.fromScene(roomEnvironment, 0.04).texture;
    roomEnvironment.dispose?.();
    scene.environment = environmentMap;
    const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
    camera.position.set(4.2, 3.2, 5.4);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = DECOR_CAMERA_ZOOM_MIN_DISTANCE;
    controls.maxDistance = DECOR_CAMERA_ZOOM_MAX_DISTANCE;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.target.set(0, 0.75, 0);
    controlsRef.current = controls;
    const detachCameraControls = attachClickTargetCameraControls({
      camera,
      controls,
      domElement: renderer.domElement,
      scene,
      groundY: 0,
    });

    scene.add(new THREE.HemisphereLight('#c9f5ff', '#24160c', 1.15));
    const sun = new THREE.DirectionalLight('#fff0c7', 2.1);
    sun.position.set(-4.5, 6, 5);
    sun.castShadow = true;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -7;
    sun.shadow.camera.right = 7;
    sun.shadow.camera.top = 7;
    sun.shadow.camera.bottom = -7;
    scene.add(sun);
    scene.add(new THREE.AmbientLight('#4f8cff', 0.28));

    const floorTexture = new THREE.CanvasTexture(createPreviewFloorCanvas({
      backgroundColor: '#132033',
      oddColor: '#1d2c43',
      evenColor: '#142238',
      cellLineColor: 'rgba(148, 163, 184, .16)',
      markerColor: 'rgba(103, 232, 249, .2)',
      markerLineWidth: 4,
      markerShape: 'square',
      markerRect: { x: 96, y: 96, width: 320, height: 320 },
    }));
    floorTexture.wrapS = THREE.RepeatWrapping;
    floorTexture.wrapT = THREE.RepeatWrapping;
    floorTexture.repeat.set(5, 5);
    floorTexture.colorSpace = THREE.SRGBColorSpace;
    const floorMaterial = makePreviewStandardMaterial('#172033', { texture: floorTexture, roughness: 0.9 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(8, 16, '#67e8f9', '#263c5c');
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    grid.position.y = 0.018;
    scene.add(grid);

    const decorRoot = new THREE.Group();
    decorRootRef.current = decorRoot;
    scene.add(decorRoot);
    const gripRoot = new THREE.Group();
    gripRoot.name = 'WeaponGripMarkers';
    gripRootRef.current = gripRoot;
    scene.add(gripRoot);
    const rigCutPreviewRoot = new THREE.Group();
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
      if (!gripDragRef.current && decorRoot.children[0]) {
        decorRoot.children[0].rotation.y = Math.sin(time * 0.00036) * 0.08;
      }
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

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const planeNormal = new THREE.Vector3();
    const planePoint = new THREE.Vector3();
    let rigPickStart = null;
    let contourPickStart = null;
    let paintStroke = null;
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

    const findGripMarkerHit = (event) => {
      updatePointer(event);
      const markerObjects = Array.from(gripMarkersRef.current.values()).filter((marker) => marker.visible);
      return raycaster.intersectObjects(markerObjects, false)[0] || null;
    };

    const findRigMeshHit = (event) => {
      const decorObject = decorObjectRef.current;
      const modelObject = decorObject?.userData?.decorModelObject || decorObject;
      if (!modelObject?.traverse) return null;
      updatePointer(event);
      const hits = raycaster.intersectObject(modelObject, true);
      const hit = hits.find((entry) => entry?.object?.isMesh || entry?.object?.isSkinnedMesh);
      if (!hit?.object) return null;
      modelObject.updateMatrixWorld?.(true);
      hit.object.updateMatrixWorld?.(true);
      const box = new THREE.Box3().setFromObject(hit.object);
      const size = box.getSize(new THREE.Vector3());
      const center = modelObject.worldToLocal(box.getCenter(new THREE.Vector3()));
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
      updatePointer(event);
      const hits = raycaster.intersectObject(modelObject, true);
      const hit = hits.find((entry) => entry?.object?.isMesh || entry?.object?.isSkinnedMesh);
      if (!hit?.point) return null;
      const gripPoint = hit.point.clone();
      gripSpace.space.worldToLocal(gripPoint);
      gripPoint.sub(gripSpace.modelObject.position);
      const surfaceNormal = hit.face?.normal
        ? (() => {
          const worldNormal = hit.face.normal.clone()
            .applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld))
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
      });
    };

    const setArmorPaintBrushPoint = (point = null) => {
      armorPaintBrushPointRef.current = point
        ? { x: point.x, y: point.y, z: point.z, ...normalizeArmorPaintSurfaceNormal(point) }
        : null;
      syncArmorPaintBrushPreviewRef.current?.();
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
      latestOnWeaponGripMarkerChangeRef.current?.(drag?.hand || markerKey, nextPosition);
      return nextPosition;
    };

    const endGripDrag = (event) => {
      const drag = gripDragRef.current;
      if (!drag) return;
      if (drag.type === 'armor' && drag.lastPosition && !latestArmorCutManipulationEnabledRef.current) {
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
        grabOffset: hitPlane ? marker.position.clone().sub(planePoint) : new THREE.Vector3(),
        lastPosition: null,
      };
      controls.enabled = false;
      container.classList.add('is-grip-dragging');
      try {
        renderer.domElement.setPointerCapture?.(event.pointerId);
      } catch {
        // Some embedded browsers do not expose pointer capture for canvas.
      }
      commitGripWorldPosition(markerKey, marker.position, { persist: markerType !== 'armor' });
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
      const resolvedPosition = commitGripWorldPosition(drag.key || drag.hand, nextWorldPosition, { persist: drag.type !== 'armor' });
      const marker = gripMarkersRef.current.get(drag.key || drag.hand);
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

    const appendArmorPaintPoint = (event, options = {}) => {
      const point = findArmorContourPoint(event);
      setArmorPaintBrushPoint(point);
      if (!point) return null;
      const lastPoint = paintStroke?.lastPoint;
      if (
        !options.force
        && lastPoint
        && Math.hypot(point.x - lastPoint.x, point.y - lastPoint.y, point.z - lastPoint.z) < 0.035
      ) {
        return lastPoint;
      }
      if (paintStroke) {
        paintStroke.lastPoint = point;
        paintStroke.points.push(point);
      }
      return point;
    };

    const handleArmorPaintPointerDown = (event) => {
      if (
        event.button !== 0
        || latestCameraZoomDragEnabledRef.current
        || !latestArmorPaintDrawEnabledRef.current
        || !latestOnArmorCutPaintChangeRef.current
      ) return;
      const point = findArmorContourPoint(event);
      if (!point) return;
      setArmorPaintBrushPoint(point);
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation?.();
      paintStroke = {
        pointerId: event.pointerId,
        lastPoint: point,
        points: [point],
        radius: normalizeArmorPaintRadius(latestArmorPaintBrushRadiusRef.current),
        segment: latestRigActiveSegmentRef.current || 'body',
      };
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
      appendArmorPaintPoint(event);
    };

    const handleArmorPaintPointerHover = (event) => {
      if (paintStroke) return;
      if (!latestArmorPaintDrawEnabledRef.current) {
        setArmorPaintBrushPoint(null);
        return;
      }
      setArmorPaintBrushPoint(findArmorContourPoint(event));
    };

    const handleArmorPaintPointerLeave = () => {
      setArmorPaintBrushPoint(null);
    };

    const endArmorPaint = (event) => {
      if (!paintStroke) return;
      const completedStroke = paintStroke;
      try {
        renderer.domElement.releasePointerCapture?.(completedStroke.pointerId || event?.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      paintStroke = null;
      armorPaintStrokeActiveRef.current = false;
      armorCutPreviewDirtyRef.current = true;
      armorCutPaintDirtyRef.current = true;
      controls.enabled = true;
      container.classList.remove('is-painting');
      if (completedStroke.points?.length) {
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
      || contourPickStart
      || rigPickStart
    );

    const endCanvasPointerInteractions = (event) => {
      if (!hasCanvasPointerInteraction()) return;
      endGripDrag(event);
      endCameraZoom(event);
      endArmorPaint(event);
      handleArmorContourPointerCancel();
      rigPickStart = null;
      controls.enabled = true;
      container.classList.remove('is-grip-dragging', 'is-painting', 'is-camera-zooming');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') endCanvasPointerInteractions();
    };

    renderer.domElement.addEventListener('pointerdown', handleGripPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleCameraZoomPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleArmorPaintPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleArmorContourPointerDown, true);
    renderer.domElement.addEventListener('pointerdown', handleRigPickPointerDown, true);
    renderer.domElement.addEventListener('pointermove', handleArmorPaintPointerHover, true);
    renderer.domElement.addEventListener('pointermove', handleCameraZoomPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleArmorPaintPointerMove, true);
    renderer.domElement.addEventListener('pointermove', handleGripPointerMove, true);
    renderer.domElement.addEventListener('pointerleave', handleArmorPaintPointerLeave, true);
    renderer.domElement.addEventListener('pointerup', endGripDrag, true);
    renderer.domElement.addEventListener('pointerup', endCameraZoom, true);
    renderer.domElement.addEventListener('pointerup', endArmorPaint, true);
    renderer.domElement.addEventListener('pointerup', handleArmorContourPointerUp, true);
    renderer.domElement.addEventListener('pointerup', handleRigPickPointerUp, true);
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
      renderer.domElement.removeEventListener('pointerdown', handleGripPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleCameraZoomPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleArmorPaintPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleArmorContourPointerDown, true);
      renderer.domElement.removeEventListener('pointerdown', handleRigPickPointerDown, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorPaintPointerHover, true);
      renderer.domElement.removeEventListener('pointermove', handleCameraZoomPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleArmorPaintPointerMove, true);
      renderer.domElement.removeEventListener('pointermove', handleGripPointerMove, true);
      renderer.domElement.removeEventListener('pointerleave', handleArmorPaintPointerLeave, true);
      renderer.domElement.removeEventListener('pointerup', endGripDrag, true);
      renderer.domElement.removeEventListener('pointerup', endCameraZoom, true);
      renderer.domElement.removeEventListener('pointerup', endArmorPaint, true);
      renderer.domElement.removeEventListener('pointerup', handleArmorContourPointerUp, true);
      renderer.domElement.removeEventListener('pointerup', handleRigPickPointerUp, true);
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
      armorPaintBrushPreviewRef.current = null;
      disposeArmorManipulationGuides(armorManipulationGuideObjectsRef.current);
      rigCutPreviewRootRef.current = null;
      gripRootRef.current = null;
      clearGroup(decorRoot);
      disposeThreeObject(floor);
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
    };
  }, []);

  useEffect(() => {
    applyDecorPreviewSize(decorObjectRef.current, latestModelRef.current);
    frameDecorPreviewObject(decorObjectRef.current, cameraRef.current, controlsRef.current);
    latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
  }, [sizeSignature]);

  useEffect(() => {
    applyDecorPreviewPose(decorObjectRef.current, latestModelRef.current);
    frameDecorPreviewObject(decorObjectRef.current, cameraRef.current, controlsRef.current);
    latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
  }, [poseSignature]);

  useEffect(() => {
    applyDecorPreviewAppearance(decorObjectRef.current, latestModelRef.current);
  }, [appearanceSignature]);

  useEffect(() => {
    const decorRoot = decorRootRef.current;
    if (!decorRoot || !model) return undefined;
    let cancelled = false;
    decorObjectRef.current = null;
    disposeArmorPaintBrushPreview(armorPaintBrushPreviewRef.current);
    armorPaintBrushPreviewRef.current = null;
    armorPaintBrushPointRef.current = null;
    armorCutPreviewDirtyRef.current = true;
    armorCutContourDirtyRef.current = true;
    armorCutPaintDirtyRef.current = true;
    clearGroup(decorRoot);
    const sources = getDecorModelSources(model);
    if (sources.length) {
      setPreviewStatus('Chargement du modele 3D...');
      const loadingRoot = new THREE.Group();
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
        armorCutPreviewDirtyRef.current = true;
        armorCutContourDirtyRef.current = true;
        armorCutPaintDirtyRef.current = true;
        latestOnCameraZoomChangeRef.current?.(getDecorCameraZoomPercent(cameraRef.current, controlsRef.current));
        setPreviewStatus('');
      }, (error) => {
        if (cancelled) return;
        clearGroup(loadingRoot);
        setPreviewStatus(error?.message ? `Modele 3D non affiche: ${error.message}` : 'Modele 3D non affiche.');
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

  return (
    <div
      ref={containerRef}
      className={`decor3d-canvas-shell ${weaponGripMarkers?.length || shieldGripMarkers?.length || armorGripMarkers?.length ? 'decor3d-canvas-shell-grips' : ''} ${armorContourDrawEnabled || armorPaintDrawEnabled ? 'decor3d-canvas-shell-contour' : ''} ${cameraZoomDragEnabled ? 'decor3d-canvas-shell-zoom' : ''}`}
    >
      {children}
      {webglError ? <div className="decor3d-webgl-error">{webglError}</div> : null}
      {!webglError && previewStatus ? <div className="decor3d-preview-status">{previewStatus}</div> : null}
    </div>
  );
}
