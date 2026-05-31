import {
  Box3 as ThreeBox3,
  BoxGeometry as ThreeBoxGeometry,
  BufferAttribute as ThreeBufferAttribute,
  BufferGeometry as ThreeBufferGeometry,
  CapsuleGeometry as ThreeCapsuleGeometry,
  ConeGeometry as ThreeConeGeometry,
  DoubleSide as ThreeDoubleSide,
  Euler as ThreeEuler,
  Group as ThreeGroup,
  MathUtils as ThreeMathUtils,
  Matrix4 as ThreeMatrix4,
  Mesh as ThreeMesh,
  MeshBasicMaterial as ThreeMeshBasicMaterial,
  MeshStandardMaterial as ThreeMeshStandardMaterial,
  Plane as ThreePlane,
  PlaneGeometry as ThreePlaneGeometry,
  Quaternion as ThreeQuaternion,
  SphereGeometry as ThreeSphereGeometry,
  Sprite as ThreeSprite,
  SpriteMaterial as ThreeSpriteMaterial,
  TorusGeometry as ThreeTorusGeometry,
  Vector3 as ThreeVector3,
} from 'three';

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
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
  CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_IDS,
  getCharacterRigPointDefinition,
  getCharacterRigSignature,
  getEnabledCharacterRigPointById,
} from '../../utils/rpg3dCharacterRig.js';
import {
  getCharacterRigAutoAnchorMap,
  getCharacterRigAutoWorldPosition,
  getCharacterRigBoundsWorldPoint,
} from '../../utils/rpg3dCharacterRigAutoPlacement.js';

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

const LEFT_WEAPON_SOCKET_NAME_KEYS = [
  'weaponsocketl',
  'weaponsocketleft',
  'leftweaponsocket',
  'lweaponsocket',
  'lefthandsocket',
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

const RIGHT_SHIELD_SOCKET_NAME_KEYS = [
  'shieldsocketr',
  'shieldsocketright',
  'rightshieldsocket',
  'rshieldsocket',
  'weaponsocketr',
  'weaponsocketright',
  'rightweaponsocket',
  'rweaponsocket',
  'rightforearmsocket',
  'rforearmsocket',
  'rightlowerarmsocket',
  'rlowerarmsocket',
  'forearmsocketr',
  'lowerarmsocketr',
];

const HELMET_SOCKET_NAME_KEYS = [
  'helmetsocket',
  'helmetattach',
  'helmetanchor',
  'headsocket',
  'headattach',
  'headanchor',
  'hatsocket',
  'hatattach',
];

const WEAPON_GRIP_NAME_KEYS = [
  'weaponanchor',
  'weaponattach',
  'weaponattachment',
  'weapongrip',
  'gripweapon',
  'weaponhandle',
  'handleweapon',
  'swordgrip',
  'swordhandle',
  'bladegrip',
  'hilt',
  'handgrip',
  'righthandgrip',
  'gripr',
  'handler',
  'poignee',
  'poigne',
  'attachpoint',
  'attachmentpoint',
  'equipmentsocket',
  'weaponsocket',
  'handlesocket',
  'gripsocket',
];

const SHIELD_GRIP_NAME_KEYS = [
  'shieldanchor',
  'shieldattach',
  'shieldattachment',
  'shieldgrip',
  'gripshield',
  'shieldhandle',
  'handleshield',
  'shieldstrap',
  'forearmgrip',
  'leftforearmgrip',
  'poignee',
  'poigne',
  'attachpoint',
  'attachmentpoint',
  'equipmentsocket',
  'shieldsocket',
  'handlesocket',
  'gripsocket',
];

const ARMOR_GRIP_NAME_KEYS = [
  'armoranchor',
  'armorattach',
  'armorattachment',
  'armorgrip',
  'griparmor',
  'armoursocket',
  'armorsocket',
  'chestgrip',
  'chestsocket',
  'torsoanchor',
  'torsosocket',
  'bodyanchor',
  'bodysocket',
  'attachpoint',
  'attachmentpoint',
  'equipmentsocket',
  'gripsocket',
];

const HELMET_GRIP_NAME_KEYS = [
  'helmetanchor',
  'helmetattach',
  'helmetattachment',
  'helmetgrip',
  'griphelmet',
  'helmetsocket',
  'headanchor',
  'headattach',
  'headattachment',
  'headgrip',
  'hatsocket',
  'hatgrip',
  'attachpoint',
  'attachmentpoint',
  'equipmentsocket',
  'gripsocket',
];

const ARMOR_GRIP_POINTS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const HELMET_MOUTH_GRIP_POINT = ARMOR_GRIP_POINTS.find((point) => point.id === 'mouth') || null;
const LEGGINGS_GRIP_POINT_IDS = [
  'left-groin-fold',
  'right-groin-fold',
  'left-knee',
  'right-knee',
  'left-foot',
  'right-foot',
];
const LEGGINGS_GRIP_POINT_SET = new Set(LEGGINGS_GRIP_POINT_IDS);
const LEGGINGS_GRIP_POINTS = ARMOR_GRIP_POINTS.filter((point) => LEGGINGS_GRIP_POINT_SET.has(point.id));
const ARMOR_BODY_POINT_SUFFIXES = new Set(['LeftShoulder', 'RightShoulder', 'LowerBelly']);
const ARMOR_LEFT_ARM_POINT_SUFFIXES = new Set(['LeftShoulder', 'LeftElbow']);
const ARMOR_RIGHT_ARM_POINT_SUFFIXES = new Set(['RightShoulder', 'RightElbow']);
const CORE_ARMOR_GRIP_SUFFIXES = new Set(
  ARMOR_GRIP_POINTS
    .filter((point) => point.core || CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_IDS.includes(point.rigPointId))
    .map((point) => point.suffix),
);
const ARMOR_ARM_SEGMENT_NAME_KEYS = ['arm', 'upperarm', 'shoulder', 'pauldron', 'bracer', 'brassard', 'sleeve', 'manche', 'coude', 'elbow'];
const ARMOR_SEGMENT_VALUES = ['body', 'left-arm', 'right-arm'];
const ARMOR_RIG_POINT_IDS = new Set(ARMOR_GRIP_POINTS.map((point) => point.rigPointId || point.id));
const ARMOR_SURFACE_CLEARANCE_SCALE = 1.018;
const ARMOR_SURFACE_RENDER_ORDER = 18;
const ARMOR_SURFACE_POLYGON_OFFSET_FACTOR = -1.5;
const ARMOR_SURFACE_POLYGON_OFFSET_UNITS = -6;

const getDefaultArmorPieceRigPointId = (segment = 'body') => {
  if (segment === 'left-arm') return 'left-elbow';
  if (segment === 'right-arm') return 'right-elbow';
  return 'lower-belly';
};

const normalizeArmorPieceRigPointId = (value = '', segment = 'body') => {
  const id = String(value || '').trim();
  return ARMOR_RIG_POINT_IDS.has(id) ? id : getDefaultArmorPieceRigPointId(segment);
};

const FINGER_NAME_KEYS = ['thumb', 'index', 'middle', 'ring', 'pinky', 'little', 'finger'];
const PALM_SOCKET_FINGER_ROOT_FACTOR = 0.82;
const FINGER_BASE_WEAPON_SOCKET_NORMAL_OFFSET = 0.32;

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

const normalizeArmorSegment = (value = '') => {
  if (value === 'left' || value === 'left-arm') return 'left';
  if (value === 'right' || value === 'right-arm') return 'right';
  return 'body';
};

const normalizeStoredArmorSegment = (value = '') => (
  ARMOR_SEGMENT_VALUES.includes(value) ? value : 'body'
);

const getArmorSegmentAssignments = (item = {}) => (
  Array.isArray(item.armorSegmentAssignments)
    ? item.armorSegmentAssignments.map((entry) => {
      const segment = normalizeStoredArmorSegment(entry?.segment);
      return {
        path: String(entry?.path || ''),
        name: String(entry?.name || ''),
        segment,
        ...(entry?.pieceId ? { pieceId: String(entry.pieceId || '') } : {}),
        ...(entry?.pieceName ? { pieceName: String(entry.pieceName || '') } : {}),
        ...(entry?.pieceId ? { rigPointId: normalizeArmorPieceRigPointId(entry?.rigPointId, segment) } : {}),
      };
    }).filter((entry) => entry.path)
    : []
);

const getArmorCustomPieces = (item = {}) => (
  Array.isArray(item.armorCustomPieces)
    ? item.armorCustomPieces.map((piece, index) => {
      const segment = normalizeStoredArmorSegment(piece?.segment);
      return {
        id: String(piece?.id || `piece-${index + 1}`),
        name: String(piece?.name || `Morceau ${index + 1}`),
        segment,
        rigPointId: normalizeArmorPieceRigPointId(piece?.rigPointId, segment),
      };
    }).filter((piece) => piece.id)
    : []
);

const getArmorCustomPieceById = (item = {}, pieceId = '') => (
  getArmorCustomPieces(item).find((piece) => piece.id === String(pieceId || '')) || null
);

const normalizeArmorCutContourPoint = (point = {}) => ({
  x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 0,
  y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 0,
  z: Number.isFinite(Number(point?.z)) ? Number(point.z) : 0,
  ...normalizeArmorPaintSurfaceNormal(point),
  ...normalizeArmorPaintSectionPlane(point),
});

const normalizeArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: nx / length,
    ny: ny / length,
    nz: nz / length,
  };
};

const normalizeArmorPaintSectionPlane = (point = {}) => {
  const cx = Number(point?.cx);
  const cy = Number(point?.cy);
  const cz = Number(point?.cz);
  const cw = Number(point?.cw);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz) || !Number.isFinite(cw)) return {};
  const length = Math.hypot(cx, cy, cz);
  if (length <= 0.001) return {};
  return {
    cx: cx / length,
    cy: cy / length,
    cz: cz / length,
    cw: cw / length,
  };
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

const isPointOnArmorPaintVisibleSide = (point, paintPoint, radius = 0.14, depthTolerance = 0.04) => {
  const plane = getArmorPaintSectionPlane(paintPoint);
  if (!plane) return true;
  return plane.distanceToPoint(point) >= -getArmorPaintPlaneTolerance(radius, depthTolerance);
};

const getArmorCutContours = (item = {}, referenceScale = 1) => {
  const entries = Array.isArray(item.armorCutContours)
    ? item.armorCutContours
    : Object.entries(item.armorCutContours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeArmorSegment(entry?.segment),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 80)
        .map(normalizeArmorCutContourPoint)
        .map((point) => ({
          x: point.x * referenceScale,
          y: point.y * referenceScale,
          z: point.z * referenceScale,
        })),
    }))
    .filter((entry) => entry.points.length >= 3);
};

const getArmorPaintDepthTolerance = (radius = 0.14, referenceScale = 1) => (
  ThreeMathUtils.clamp(
    (Number(radius) || 0.14) * 0.36,
    0.035 * referenceScale,
    0.11 * referenceScale,
  )
);

const getArmorPaintPlaneTolerance = (radius = 0.14, depthTolerance = 0.04) => (
  ThreeMathUtils.clamp(
    (Number(radius) || 0.14) * 0.18,
    depthTolerance * 0.35,
    depthTolerance * 0.9,
  )
);

const getArmorCutPaintStrokes = (item = {}, referenceScale = 1) => {
  const entries = Array.isArray(item.armorCutPaintStrokes)
    ? item.armorCutPaintStrokes
    : Object.entries(item.armorCutPaintStrokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => {
      const radius = Math.max(0.01, Number(entry?.radius) || 0.14) * referenceScale;
      return {
        segment: normalizeArmorSegment(entry?.segment),
        radius,
        depthTolerance: getArmorPaintDepthTolerance(radius, referenceScale),
        points: (Array.isArray(entry?.points) ? entry.points : [])
          .slice(0, 240)
          .map(normalizeArmorCutContourPoint)
          .map((point) => {
            const sectionPlane = normalizeArmorPaintSectionPlane(point);
            return {
              x: point.x * referenceScale,
              y: point.y * referenceScale,
              z: point.z * referenceScale,
              ...normalizeArmorPaintSurfaceNormal(point),
              ...(sectionPlane.cx !== undefined ? { ...sectionPlane, cw: sectionPlane.cw * referenceScale } : {}),
            };
          }),
      };
    })
    .filter((entry) => entry.points.length);
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

const isPointOnArmorPaintSurface = (point, paintPoint, depthTolerance = 0.04) => (
  Math.abs((Number(point?.z) || 0) - (Number(paintPoint?.z) || 0)) <= depthTolerance
);

const getArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return null;
  const normal = new ThreeVector3(nx, ny, nz);
  return normal.lengthSq() > 0.000001 ? normal.normalize() : null;
};

const isPointInsideArmorPaintStamp = (point, paintPoint, radius = 0.14, depthTolerance = 0.04) => {
  if (!isPointOnArmorPaintVisibleSide(point, paintPoint, radius, depthTolerance)) return false;
  const normal = getArmorPaintSurfaceNormal(paintPoint);
  if (normal) {
    const dx = point.x - paintPoint.x;
    const dy = point.y - paintPoint.y;
    const dz = point.z - paintPoint.z;
    const planeDistance = (dx * normal.x) + (dy * normal.y) + (dz * normal.z);
    const surfaceDistanceSq = Math.max(0, (dx * dx) + (dy * dy) + (dz * dz) - (planeDistance * planeDistance));
    return surfaceDistanceSq <= radius * radius
      && Math.abs(planeDistance) <= Math.min(depthTolerance, getArmorPaintPlaneTolerance(radius, depthTolerance));
  }
  return Math.hypot(point.x - paintPoint.x, point.y - paintPoint.y) <= radius
    && isPointOnArmorPaintSurface(point, paintPoint, depthTolerance);
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

const isPointInsidePaintSegment = (point, start, end, radius = 0.14, depthTolerance = 0.04) => {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = (Number(end.z) || 0) - (Number(start.z) || 0);
  const hasSurfaceNormal = Boolean(getArmorPaintSurfaceNormal(start) || getArmorPaintSurfaceNormal(end));
  const lengthSq = hasSurfaceNormal
    ? (dx * dx) + (dy * dy) + (dz * dz)
    : (dx * dx) + (dy * dy);
  if (lengthSq <= 0.000001) {
    return isPointInsideArmorPaintStamp(point, start, radius, depthTolerance);
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
  return isPointInsideArmorPaintStamp(point, projectedPoint, radius, depthTolerance);
};

const getArmorPaintStrokeBounds = (stroke = {}) => {
  const points = Array.isArray(stroke.points) ? stroke.points : [];
  if (!points.length) return null;
  const padding = (Number(stroke.radius) || 0.14) + (Number(stroke.depthTolerance) || 0.04);
  const bounds = {
    minX: Infinity,
    maxX: -Infinity,
    minY: Infinity,
    maxY: -Infinity,
    minZ: Infinity,
    maxZ: -Infinity,
  };
  points.forEach((paintPoint) => {
    bounds.minX = Math.min(bounds.minX, paintPoint.x - padding);
    bounds.maxX = Math.max(bounds.maxX, paintPoint.x + padding);
    bounds.minY = Math.min(bounds.minY, paintPoint.y - padding);
    bounds.maxY = Math.max(bounds.maxY, paintPoint.y + padding);
    bounds.minZ = Math.min(bounds.minZ, paintPoint.z - padding);
    bounds.maxZ = Math.max(bounds.maxZ, paintPoint.z + padding);
  });
  return bounds;
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

const prepareArmorPaintStrokes = (item = {}, referenceScale = 1) => (
  getArmorCutPaintStrokes(item, referenceScale)
    .map((stroke) => ({
      ...stroke,
      paintBounds: getArmorPaintStrokeBounds(stroke),
    }))
    .sort((a, b) => ['left', 'right', 'body'].indexOf(a.segment) - ['left', 'right', 'body'].indexOf(b.segment))
);

const classifyArmorPaintSegment = (point = new ThreeVector3(), item = {}, referenceScale = 1, preparedStrokes = null) => {
  const strokes = Array.isArray(preparedStrokes) ? preparedStrokes : prepareArmorPaintStrokes(item, referenceScale);
  if (!strokes.length) return '';
  return strokes
    .find((stroke) => {
      if (!isPointInsideArmorPaintBounds(point, stroke.paintBounds)) return false;
      if (stroke.points.some((paintPoint) => (
        isPointInsideArmorPaintStamp(point, paintPoint, stroke.radius, stroke.depthTolerance)
      ))) return true;
      for (let index = 1; index < stroke.points.length; index += 1) {
        if (isPointInsidePaintSegment(
          point,
          stroke.points[index - 1],
          stroke.points[index],
          stroke.radius,
          stroke.depthTolerance,
        )) return true;
      }
      return false;
    })?.segment || '';
};

const classifyArmorContourSegment = (point = new ThreeVector3(), item = {}, referenceScale = 1) => {
  const contours = getArmorCutContours(item, referenceScale);
  if (!contours.length) return '';
  const priority = ['left', 'right', 'body'];
  return contours
    .sort((a, b) => priority.indexOf(a.segment) - priority.indexOf(b.segment))
    .find((entry) => isPointInsideArmorContour(point, entry.points))?.segment || '';
};

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
    || (normalized.includes('armtwist') && !normalized.includes('upperarm'));
  return hasForearmMarker && (
    hasLeftRigMarker(name)
    || normalized.includes('leftforearm')
    || normalized.includes('leftlowerarm')
    || normalized.includes('forearml')
    || normalized.includes('lowerarml')
  );
};

const isRightForearmRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  const hasForearmMarker = normalized.includes('forearm')
    || normalized.includes('lowerarm')
    || (normalized.includes('armtwist') && !normalized.includes('upperarm'));
  return hasForearmMarker && (
    hasRightRigMarker(name)
    || normalized.includes('rightforearm')
    || normalized.includes('rightlowerarm')
    || normalized.includes('forearmr')
    || normalized.includes('lowerarmr')
  );
};

const isUpperArmRigName = (name = '', arm = 'left') => {
  const normalized = normalizeRigObjectName(name);
  if (
    normalized.includes('forearm')
    || normalized.includes('lowerarm')
    || normalized.includes('hand')
    || isFingerRigName(name)
  ) return false;
  const hasArmMarker = normalized.includes('upperarm')
    || normalized.includes(`${arm}arm`)
    || normalized.includes(`arm${arm}`)
    || normalized.endsWith('arm');
  if (!hasArmMarker) return false;
  return arm === 'right' ? hasRightRigMarker(name) : hasLeftRigMarker(name);
};

const isLeftUpperArmRigName = (name = '') => isUpperArmRigName(name, 'left');
const isRightUpperArmRigName = (name = '') => isUpperArmRigName(name, 'right');

const isShoulderRigName = (name = '', arm = 'left') => {
  const normalized = normalizeRigObjectName(name);
  const hasShoulderMarker = normalized.includes('shoulder') || normalized.includes('clavicle') || normalized.includes('collar');
  if (!hasShoulderMarker) return false;
  return arm === 'right' ? hasRightRigMarker(name) : hasLeftRigMarker(name);
};

const isLeftShoulderRigName = (name = '') => isShoulderRigName(name, 'left');
const isRightShoulderRigName = (name = '') => isShoulderRigName(name, 'right');

const isLowerBellyRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  return normalized.includes('hips')
    || normalized.includes('pelvis')
    || normalized.includes('waist')
    || normalized.includes('lowerabdomen')
    || normalized.includes('abdomen')
    || normalized === 'hip';
};

const isHeadRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  return normalized.includes('head') || normalized.includes('tete') || normalized.includes('crane') || normalized.includes('skull');
};

const isNeckRigName = (name = '') => {
  const normalized = normalizeRigObjectName(name);
  return normalized.includes('neck') || normalized.includes('cou');
};

const isUpperLegRigName = (name = '', side = 'left') => {
  const normalized = normalizeRigObjectName(name);
  if (
    normalized.includes('lowerleg')
    || normalized.includes('calf')
    || normalized.includes('shin')
    || normalized.includes('foot')
    || normalized.includes('toe')
  ) return false;
  const hasLegMarker = normalized.includes('upperleg')
    || normalized.includes('thigh')
    || normalized.includes(`${side}leg`)
    || normalized.includes(`leg${side}`);
  if (!hasLegMarker) return false;
  return side === 'right' ? hasRightRigMarker(name) : hasLeftRigMarker(name);
};

const isLowerLegRigName = (name = '', side = 'left') => {
  const normalized = normalizeRigObjectName(name);
  if (normalized.includes('foot') || normalized.includes('toe')) return false;
  const hasLegMarker = normalized.includes('lowerleg')
    || normalized.includes('calf')
    || normalized.includes('shin')
    || normalized.includes('knee');
  if (!hasLegMarker) return false;
  return side === 'right' ? hasRightRigMarker(name) : hasLeftRigMarker(name);
};

const isFootRigName = (name = '', side = 'left') => {
  const normalized = normalizeRigObjectName(name);
  const hasFootMarker = normalized.includes('foot')
    || normalized.includes('ankle')
    || normalized.includes('toe');
  if (!hasFootMarker) return false;
  return side === 'right' ? hasRightRigMarker(name) : hasLeftRigMarker(name);
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

const findLeftHandFromFingerBones = (root) => {
  const candidates = new Map();
  root?.traverse?.((child) => {
    if (!child?.isBone || !isFingerRigName(child.name) || !hasLeftRigMarker(child.name)) return;
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

const findRightForearmFromFingerBones = (root) => {
  const candidates = new Map();
  root?.traverse?.((child) => {
    if (!child?.isBone || !isFingerRigName(child.name) || !hasRightRigMarker(child.name)) return;
    let ancestor = child.parent;
    while (ancestor?.isBone && isFingerRigName(ancestor.name)) ancestor = ancestor.parent;
    let forearm = null;
    let cursor = ancestor;
    while (cursor?.isBone) {
      if (isRightForearmRigName(cursor.name)) {
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

const getFingerRootBonesForHand = (handBone = null, hand = 'right') => {
  if (!handBone?.traverse) return [];
  const hasOppositeHandMarker = hand === 'left' ? hasRightRigMarker : hasLeftRigMarker;
  const roots = new Set();
  handBone.traverse((child) => {
    if (child === handBone || !child?.isBone || !isFingerRigName(child.name) || hasOppositeHandMarker(child.name)) return;
    let root = child;
    while (
      root.parent
      && root.parent !== handBone
      && root.parent.isBone
      && isFingerRigName(root.parent.name)
    ) {
      root = root.parent;
    }
    roots.add(root);
  });
  return [...roots];
};

const getFingerPalmOffset = (handBone = null, hand = 'right') => {
  const fingerRoots = getFingerRootBonesForHand(handBone, hand);
  if (fingerRoots.length < 2) return null;
  handBone.updateMatrixWorld?.(true);
  const offset = new ThreeVector3();
  const worldPoint = new ThreeVector3();
  let count = 0;
  fingerRoots.forEach((fingerRoot) => {
    fingerRoot.updateMatrixWorld?.(true);
    fingerRoot.getWorldPosition(worldPoint);
    const localPoint = handBone.worldToLocal(worldPoint.clone());
    if (!Number.isFinite(localPoint.x) || !Number.isFinite(localPoint.y) || !Number.isFinite(localPoint.z)) return;
    if (localPoint.lengthSq() <= 0.000001) return;
    offset.add(localPoint);
    count += 1;
  });
  if (count < 2) return null;
  offset.multiplyScalar(1 / count);
  if (offset.lengthSq() <= 0.000001) return null;
  return offset.multiplyScalar(PALM_SOCKET_FINGER_ROOT_FACTOR);
};

const getFingerFamilyRank = (bone = null) => {
  const normalized = normalizeRigObjectName(bone?.name || '');
  if (normalized.includes('thumb')) return 0;
  if (normalized.includes('index')) return 1;
  if (normalized.includes('middle')) return 2;
  if (normalized.includes('ring')) return 3;
  if (normalized.includes('pinky') || normalized.includes('little')) return 4;
  return 5;
};

const getFingerSegmentIndex = (bone = null) => {
  const raw = String(bone?.name || '').toLowerCase();
  const matches = [...raw.matchAll(/(?:^|[^0-9])([0-9]+)(?=$|[^0-9])/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0);
  const directValue = matches[matches.length - 1];
  if (directValue) return directValue > 5 && directValue < 100 ? directValue % 10 : directValue;
  const compactMatch = normalizeRigObjectName(bone?.name || '')
    .match(/(?:thumb|index|middle|ring|pinky|little|finger)([0-9]+)/);
  if (!compactMatch) return 0;
  const compactValue = Number(compactMatch[1]);
  if (!Number.isFinite(compactValue) || compactValue <= 0) return 0;
  return compactValue > 5 && compactValue < 100 ? compactValue % 10 : compactValue;
};

const getFingerBoneDepthFromRoot = (bone = null, root = null) => {
  let depth = 0;
  let cursor = bone;
  while (cursor && cursor !== root) {
    depth += 1;
    cursor = cursor.parent;
  }
  return cursor === root ? depth : 0;
};

const getFingerTipBoneFromRoot = (fingerRoot = null, hand = 'right') => {
  if (!fingerRoot?.traverse) return null;
  const hasOppositeHandMarker = hand === 'left' ? hasRightRigMarker : hasLeftRigMarker;
  const candidates = [];
  fingerRoot.traverse((child) => {
    if (!child?.isBone || !isFingerRigName(child.name) || hasOppositeHandMarker(child.name)) return;
    const depth = getFingerBoneDepthFromRoot(child, fingerRoot);
    const segment = getFingerSegmentIndex(child);
    const hasFingerChild = (child.children || []).some((grandChild) => (
      grandChild?.isBone
      && isFingerRigName(grandChild.name)
      && !hasOppositeHandMarker(grandChild.name)
    ));
    candidates.push({
      bone: child,
      depth,
      segment,
      isThirdPhalanx: segment === 3,
      isLeaf: !hasFingerChild,
    });
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (a.isThirdPhalanx !== b.isThirdPhalanx) return a.isThirdPhalanx ? -1 : 1;
    if (a.isLeaf !== b.isLeaf) return a.isLeaf ? -1 : 1;
    if (a.segment !== b.segment) return b.segment - a.segment;
    return b.depth - a.depth;
  });
  return candidates[0].bone;
};

const getFingerBasePhalanxBoneFromRoot = (fingerRoot = null, hand = 'right') => {
  if (!fingerRoot?.traverse) return null;
  const hasOppositeHandMarker = hand === 'left' ? hasRightRigMarker : hasLeftRigMarker;
  const candidates = [];
  fingerRoot.traverse((child) => {
    if (!child?.isBone || !isFingerRigName(child.name) || hasOppositeHandMarker(child.name)) return;
    const depth = getFingerBoneDepthFromRoot(child, fingerRoot);
    const segment = getFingerSegmentIndex(child);
    candidates.push({
      bone: child,
      depth,
      segment,
      isFirstPhalanx: segment === 1,
    });
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => {
    if (a.isFirstPhalanx !== b.isFirstPhalanx) return a.isFirstPhalanx ? -1 : 1;
    if (a.segment !== b.segment) {
      if (!a.segment) return 1;
      if (!b.segment) return -1;
      return a.segment - b.segment;
    }
    return a.depth - b.depth;
  });
  return candidates[0].bone;
};

const getFingerTipBonesForHand = (handBone = null, hand = 'right') => (
  getFingerRootBonesForHand(handBone, hand)
    .sort((a, b) => getFingerFamilyRank(a) - getFingerFamilyRank(b))
    .map((fingerRoot) => getFingerTipBoneFromRoot(fingerRoot, hand))
    .filter(Boolean)
);

const getFingerBasePhalanxBonesForHand = (handBone = null, hand = 'right') => (
  getFingerRootBonesForHand(handBone, hand)
    .sort((a, b) => getFingerFamilyRank(a) - getFingerFamilyRank(b))
    .map((fingerRoot) => getFingerBasePhalanxBoneFromRoot(fingerRoot, hand))
    .filter(Boolean)
);

const getFingerGripEntriesForHand = (handBone = null, hand = 'right') => (
  getFingerRootBonesForHand(handBone, hand)
    .sort((a, b) => getFingerFamilyRank(a) - getFingerFamilyRank(b))
    .map((fingerRoot) => ({
      root: fingerRoot,
      grip: getFingerBasePhalanxBoneFromRoot(fingerRoot, hand),
      tip: getFingerTipBoneFromRoot(fingerRoot, hand),
    }))
    .filter((entry) => entry.root?.isBone && entry.grip?.isBone && entry.tip?.isBone)
);

const getLocalBonePosition = (parent = null, bone = null) => {
  if (!parent || !bone?.isBone) return null;
  parent.updateMatrixWorld?.(true);
  bone.updateMatrixWorld?.(true);
  const point = bone.getWorldPosition(new ThreeVector3());
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return null;
  return parent.worldToLocal(point);
};

const getAverageVector = (points = []) => {
  const average = new ThreeVector3();
  let count = 0;
  points.forEach((point) => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !Number.isFinite(point.z)) return;
    average.add(point);
    count += 1;
  });
  return count ? average.multiplyScalar(1 / count) : null;
};

const getProjectedPerpendicularAxis = (axis, preferred) => {
  const fallback = Math.abs(axis.y) < 0.85 ? new ThreeVector3(0, 1, 0) : new ThreeVector3(0, 0, 1);
  const candidate = (preferred?.lengthSq?.() > 0.000001 ? preferred.clone() : fallback)
    .addScaledVector(axis, -axis.dot(preferred || fallback));
  if (candidate.lengthSq() > 0.000001) return candidate.normalize();
  const fallbackCandidate = fallback.addScaledVector(axis, -axis.dot(fallback));
  return fallbackCandidate.lengthSq() > 0.000001 ? fallbackCandidate.normalize() : new ThreeVector3(0, 1, 0);
};

const getFingerGripFrame = (parent = null, entries = [], hand = 'right') => {
  const validEntries = entries
    .map((entry) => ({
      root: entry.root,
      grip: entry.grip || entry.root,
      tip: entry.tip,
      gripPoint: getLocalBonePosition(parent, entry.grip || entry.root),
      tipPoint: getLocalBonePosition(parent, entry.tip),
    }))
    .filter((entry) => entry.gripPoint && entry.tipPoint);
  if (validEntries.length < 2) return null;

  const gripPoints = validEntries.map((entry) => entry.gripPoint);
  const tipPoints = validEntries.map((entry) => entry.tipPoint);
  const fingerBaseCenter = getAverageVector(gripPoints);
  const tipCenter = getAverageVector(tipPoints);
  if (!fingerBaseCenter || !tipCenter) return null;
  const center = fingerBaseCenter.clone();

  const spreadEntries = validEntries.filter((entry) => getFingerFamilyRank(entry.grip || entry.root) > 0);
  const orderedEntries = spreadEntries.length >= 2 ? spreadEntries : validEntries;
  const spreadAxis = orderedEntries[orderedEntries.length - 1].gripPoint.clone()
    .sub(orderedEntries[0].gripPoint);
  if (spreadAxis.lengthSq() <= 0.000001) spreadAxis.set(hand === 'left' ? -1 : 1, 0, 0);
  spreadAxis.normalize();

  const yAxis = spreadAxis;
  const closingAxis = fingerBaseCenter.lengthSq() > 0.000001 ? fingerBaseCenter.clone() : tipCenter.clone().sub(fingerBaseCenter);
  let zAxis = getProjectedPerpendicularAxis(yAxis, closingAxis);
  if (zAxis.lengthSq() <= 0.000001) zAxis = new ThreeVector3(0, 0, hand === 'left' ? -1 : 1);
  zAxis.normalize();
  const xAxis = yAxis.clone().cross(zAxis).normalize();
  const stableZAxis = xAxis.clone().cross(yAxis).normalize();
  const thumbEntry = validEntries.find((entry) => getFingerFamilyRank(entry.grip || entry.root) === 0);
  const nonThumbCenter = getAverageVector(validEntries
    .filter((entry) => getFingerFamilyRank(entry.grip || entry.root) > 0)
    .map((entry) => entry.gripPoint));
  const thumbSide = thumbEntry?.gripPoint && nonThumbCenter
    ? Math.sign(thumbEntry.gripPoint.clone().sub(nonThumbCenter).dot(xAxis))
    : 0;
  const normalSide = thumbSide || (hand === 'left' ? -1 : 1);
  const spreadWidth = orderedEntries[orderedEntries.length - 1].gripPoint.distanceTo(orderedEntries[0].gripPoint);
  center.addScaledVector(xAxis, spreadWidth * FINGER_BASE_WEAPON_SOCKET_NORMAL_OFFSET * normalSide);

  const matrix = new ThreeMatrix4().makeBasis(xAxis, yAxis, stableZAxis);
  return {
    center,
    quaternion: new ThreeQuaternion().setFromRotationMatrix(matrix),
  };
};

const getArmorFramePoint = (entries = [], suffix = '') => (
  entries.find((entry) => entry?.suffix === suffix && entry.point)?.point || null
);

const getArmorPairCenter = (leftPoint = null, rightPoint = null) => {
  if (leftPoint && rightPoint) return leftPoint.clone().add(rightPoint).multiplyScalar(0.5);
  return leftPoint?.clone?.() || rightPoint?.clone?.() || null;
};

const getArmorGripFrame = (entries = []) => {
  const validEntries = entries.filter((entry) => (
    entry?.point
    && Number.isFinite(entry.point.x)
    && Number.isFinite(entry.point.y)
    && Number.isFinite(entry.point.z)
  ));
  const leftShoulder = getArmorFramePoint(validEntries, 'LeftShoulder');
  const rightShoulder = getArmorFramePoint(validEntries, 'RightShoulder');
  const leftElbow = getArmorFramePoint(validEntries, 'LeftElbow');
  const rightElbow = getArmorFramePoint(validEntries, 'RightElbow');
  const lowerBelly = getArmorFramePoint(validEntries, 'LowerBelly');
  const shoulderCenter = getArmorPairCenter(leftShoulder, rightShoulder);
  const elbowCenter = getArmorPairCenter(leftElbow, rightElbow);
  const center = shoulderCenter?.clone?.() || getAverageVector(validEntries.map((entry) => entry.point));
  if (!center) return null;

  const xAxes = [];
  if (leftShoulder && rightShoulder) xAxes.push(rightShoulder.clone().sub(leftShoulder));
  if (leftElbow && rightElbow) xAxes.push(rightElbow.clone().sub(leftElbow));
  let xAxis = getAverageVector(xAxes.filter((axis) => axis.lengthSq() > 0.000001));

  const yAxes = [];
  if (shoulderCenter && lowerBelly) yAxes.push(shoulderCenter.clone().sub(lowerBelly));
  if (shoulderCenter && elbowCenter) yAxes.push(shoulderCenter.clone().sub(elbowCenter));
  if (leftShoulder && leftElbow) yAxes.push(leftShoulder.clone().sub(leftElbow));
  if (rightShoulder && rightElbow) yAxes.push(rightShoulder.clone().sub(rightElbow));
  let yAxis = getAverageVector(yAxes.filter((axis) => axis.lengthSq() > 0.000001));

  if (!yAxis || yAxis.lengthSq() <= 0.000001) yAxis = new ThreeVector3(0, 1, 0);
  yAxis.normalize();
  if (!xAxis || xAxis.lengthSq() <= 0.000001) xAxis = getProjectedPerpendicularAxis(yAxis, new ThreeVector3(1, 0, 0));
  else xAxis.addScaledVector(yAxis, -xAxis.dot(yAxis));
  if (xAxis.lengthSq() <= 0.000001) xAxis = getProjectedPerpendicularAxis(yAxis, new ThreeVector3(1, 0, 0));
  xAxis.normalize();

  let zAxis = xAxis.clone().cross(yAxis);
  if (zAxis.lengthSq() <= 0.000001) zAxis = getProjectedPerpendicularAxis(yAxis, new ThreeVector3(0, 0, 1));
  zAxis.normalize();
  const stableXAxis = yAxis.clone().cross(zAxis).normalize();
  const matrix = new ThreeMatrix4().makeBasis(stableXAxis, yAxis, zAxis);
  return {
    center,
    quaternion: new ThreeQuaternion().setFromRotationMatrix(matrix),
  };
};

const updateFingerTipsWeaponSocket = (socket = null) => {
  const entries = (socket?.rpg3dFingerGripEntries || [])
    .filter((entry) => (entry?.grip?.isBone || entry?.root?.isBone) && entry?.tip?.isBone);
  const parent = socket?.parent;
  if (!parent || entries.length < 2) return false;
  const frame = getFingerGripFrame(parent, entries, socket.userData?.rpg3dEquipmentSocketHand || 'right');
  if (!frame) return false;
  socket.position.copy(frame.center);
  socket.quaternion.copy(frame.quaternion);
  socket.scale.set(1, 1, 1);
  socket.updateMatrixWorld?.(true);
  return true;
};

const updateFingerTipsWeaponSockets = (root = null) => {
  let didUpdate = false;
  root?.traverse?.((child) => {
    if (!child?.userData?.rpg3dFingerTipsWeaponSocket && !child?.userData?.rpg3dFingerBaseWeaponSocket) return;
    didUpdate = updateFingerTipsWeaponSocket(child) || didUpdate;
  });
  didUpdate = updateShieldArmLineSockets(root) || didUpdate;
  didUpdate = updateArmorBodySockets(root) || didUpdate;
  didUpdate = updateArmorArmLineSockets(root) || didUpdate;
  return didUpdate;
};

const createFingerWeaponSocket = (handBone = null, hand = 'right') => {
  const gripEntries = getFingerGripEntriesForHand(handBone, hand);
  const gripBones = gripEntries.map((entry) => entry.grip);
  if (gripBones.length < 2) return null;
  const socketKey = hand === 'left' ? 'weapon-left-finger-bases' : 'weapon-right-finger-bases';
  let existingSocket = null;
  handBone.children?.forEach((child) => {
    if (
      child.userData?.rpg3dFingerBaseWeaponSocket === socketKey
      || child.userData?.rpg3dFingerTipsWeaponSocket === socketKey
    ) existingSocket = child;
  });
  const socket = existingSocket || new ThreeGroup();
  socket.name = hand === 'left' ? 'Rpg3DLeftFingerBaseWeaponSocket' : 'Rpg3DRightFingerBaseWeaponSocket';
  socket.userData.rpg3dFingerBaseWeaponSocket = socketKey;
  socket.userData.rpg3dFingerTipsWeaponSocket = socketKey;
  socket.userData.rpg3dFingerBaseBoneNames = gripBones.map((bone) => bone.name || '');
  socket.userData.rpg3dFingerTipBoneNames = gripBones.map((bone) => bone.name || '');
  socket.rpg3dFingerGripBones = gripBones;
  socket.rpg3dFingerTipBones = gripBones;
  socket.rpg3dFingerGripEntries = gripEntries;
  socket.userData.rpg3dEquipmentSocketHand = hand;
  socket.position.set(0, 0, 0);
  socket.rotation.set(0, 0, 0);
  socket.scale.set(1, 1, 1);
  if (!existingSocket) handBone.add(socket);
  updateFingerTipsWeaponSocket(socket);
  return socket;
};

const createPalmWeaponSocket = (handBone = null, hand = 'right') => {
  if (!handBone?.isBone) return null;
  const socketKey = hand === 'left' ? 'weapon-left-palm' : 'weapon-right-palm';
  let existingSocket = null;
  handBone.children?.forEach((child) => {
    if (child.userData?.rpg3dPalmWeaponSocket === socketKey) existingSocket = child;
  });
  const palmOffset = getFingerPalmOffset(handBone, hand);
  if (!palmOffset) return existingSocket || null;
  const socket = existingSocket || new ThreeGroup();
  socket.name = hand === 'left' ? 'Rpg3DLeftPalmWeaponSocket' : 'Rpg3DRightPalmWeaponSocket';
  socket.userData.rpg3dPalmWeaponSocket = socketKey;
  socket.userData.rpg3dEquipmentSocketHand = hand;
  socket.position.copy(palmOffset);
  socket.rotation.set(0, 0, 0);
  socket.scale.set(1, 1, 1);
  if (!existingSocket) handBone.add(socket);
  return socket;
};

const getCharacterRigLocalPoint = (root = null, actor = {}, pointId = '') => {
  const point = getEnabledCharacterRigPointById(actor?.characterRigPoints, pointId);
  if (!root || !point) return null;
  root.updateMatrixWorld?.(true);
  const bounds = getActorModelBodyBounds(root);
  const autoAnchors = getCharacterRigAutoAnchorMap(root, bounds);
  const worldPoint = getCharacterRigAutoWorldPosition(root, point, bounds, autoAnchors)
    || getCharacterRigBoundsWorldPoint(bounds, point);
  if (!worldPoint) return null;
  return root.worldToLocal(worldPoint.clone());
};

const createCharacterRigPointSocket = (root = null, actor = {}, pointId = '') => {
  const localPoint = getCharacterRigLocalPoint(root, actor, pointId);
  if (!root || !localPoint) return null;
  const socketKey = `character-rig-${pointId}`;
  let existingSocket = null;
  root.traverse?.((child) => {
    if (!existingSocket && child.userData?.rpg3dCharacterRigSocket === socketKey) existingSocket = child;
  });
  const socket = existingSocket || new ThreeGroup();
  socket.name = `Rpg3DCharacterRig${pointId.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())}Socket`;
  socket.userData.rpg3dCharacterRigSocket = socketKey;
  socket.position.copy(localPoint);
  socket.rotation.set(0, 0, 0);
  socket.scale.set(1, 1, 1);
  if (!existingSocket) root.add(socket);
  socket.updateMatrixWorld?.(true);
  return socket;
};

const createCharacterRigLineSocket = (root = null, actor = {}, socketKey = '', startPointId = '', endPointId = '') => {
  const startPoint = getCharacterRigLocalPoint(root, actor, startPointId);
  const endPoint = getCharacterRigLocalPoint(root, actor, endPointId);
  if (!root || !startPoint || !endPoint) return null;
  const yAxis = startPoint.clone().sub(endPoint);
  if (yAxis.lengthSq() <= 0.000001) return null;
  yAxis.normalize();
  const zAxis = getProjectedPerpendicularAxis(yAxis, new ThreeVector3(0, 0, 1));
  const xAxis = yAxis.clone().cross(zAxis).normalize();
  const stableZAxis = xAxis.clone().cross(yAxis).normalize();
  let existingSocket = null;
  root.traverse?.((child) => {
    if (!existingSocket && child.userData?.rpg3dCharacterRigLineSocket === socketKey) existingSocket = child;
  });
  const socket = existingSocket || new ThreeGroup();
  socket.name = `Rpg3DCharacterRig${socketKey.replace(/(^|-)([a-z])/g, (_, __, letter) => letter.toUpperCase())}Socket`;
  socket.userData.rpg3dCharacterRigLineSocket = socketKey;
  socket.position.copy(startPoint.clone().add(endPoint).multiplyScalar(0.5));
  socket.quaternion.setFromRotationMatrix(new ThreeMatrix4().makeBasis(xAxis, yAxis, stableZAxis));
  socket.scale.set(1, 1, 1);
  if (!existingSocket) root.add(socket);
  socket.updateMatrixWorld?.(true);
  return socket;
};

const findRightHandWeaponSocket = (root, actor = {}) => {
  const rigSocket = createCharacterRigPointSocket(root, actor, 'right-hand');
  if (rigSocket) return rigSocket;
  const explicitSocket = findFirstRigObject(root, (child) => WEAPON_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)));
  if (explicitSocket) return explicitSocket;
  const handBone = findFirstRigObject(root, (child) => child?.isBone && isRightHandRigName(child.name))
    || findRightHandFromFingerBones(root);
  return createFingerWeaponSocket(handBone, 'right') || createPalmWeaponSocket(handBone, 'right') || handBone;
};

const findLeftHandWeaponSocket = (root, actor = {}) => {
  const rigSocket = createCharacterRigPointSocket(root, actor, 'left-hand');
  if (rigSocket) return rigSocket;
  const explicitSocket = findFirstRigObject(root, (child) => LEFT_WEAPON_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)));
  if (explicitSocket) return explicitSocket;
  const handBone = findFirstRigObject(root, (child) => child?.isBone && isLeftHandRigName(child.name))
    || findLeftHandFromFingerBones(root);
  return createFingerWeaponSocket(handBone, 'left') || createPalmWeaponSocket(handBone, 'left') || handBone;
};

const getWeaponGripHand = (item = {}) => (item.weaponGripHand === 'left' ? 'left' : 'right');
const getShieldGripArm = (item = {}) => (item.shieldGripArm === 'right' ? 'right' : 'left');

const findWeaponSocketForHand = (root, hand = 'right', actor = {}) => (
  hand === 'left' ? findLeftHandWeaponSocket(root, actor) : findRightHandWeaponSocket(root, actor)
);

const getShieldGripPointEnabled = (item = {}, point = 'Hand') => Boolean(item[`shieldGrip${point}Enabled`]);

const getEquipmentModelRotationValue = (item = {}, axis = 'X') => {
  const baseField = `weaponModelRotation${axis}`;
  if (item[baseField] !== undefined && item[baseField] !== null && item[baseField] !== '') {
    return clamp(Number(item[baseField]) || 0, -180, 180);
  }
  return clamp(Number(item[`modelRotation${axis}`]) || 0, -180, 180);
};

const getEquipmentModelBaseQuaternion = (item = {}) => (
  new ThreeQuaternion().setFromEuler(new ThreeEuler(
    degreesToRadians(getEquipmentModelRotationValue(item, 'X')),
    degreesToRadians(getEquipmentModelRotationValue(item, 'Y')),
    degreesToRadians(getEquipmentModelRotationValue(item, 'Z')),
  ))
);

const hasEquipmentModelBaseRotation = (item = {}) => (
  Math.abs(getEquipmentModelRotationValue(item, 'X')) > 0.0001
  || Math.abs(getEquipmentModelRotationValue(item, 'Y')) > 0.0001
  || Math.abs(getEquipmentModelRotationValue(item, 'Z')) > 0.0001
);

const findHandBoneForArm = (root, arm = 'left') => {
  if (arm === 'right') {
    return findFirstRigObject(root, (child) => child?.isBone && isRightHandRigName(child.name))
      || findRightHandFromFingerBones(root);
  }
  return findFirstRigObject(root, (child) => child?.isBone && isLeftHandRigName(child.name))
    || findLeftHandFromFingerBones(root);
};

const findForearmBoneForArm = (root, arm = 'left') => {
  const isForearm = arm === 'right' ? isRightForearmRigName : isLeftForearmRigName;
  const fromFingerBones = arm === 'right' ? findRightForearmFromFingerBones : findLeftForearmFromFingerBones;
  const explicit = findFirstRigObject(root, (child) => child?.isBone && isForearm(child.name));
  if (explicit) return explicit;
  const handBone = findHandBoneForArm(root, arm);
  let cursor = handBone?.parent;
  while (cursor?.isBone) {
    if (isForearm(cursor.name)) return cursor;
    cursor = cursor.parent;
  }
  return fromFingerBones(root);
};

const findShoulderBoneForArm = (root, arm = 'left') => {
  const isUpperArm = arm === 'right' ? isRightUpperArmRigName : isLeftUpperArmRigName;
  const isShoulder = arm === 'right' ? isRightShoulderRigName : isLeftShoulderRigName;
  const forearmBone = findForearmBoneForArm(root, arm);
  let cursor = forearmBone?.parent;
  while (cursor?.isBone) {
    if (isUpperArm(cursor.name)) return cursor;
    if (isShoulder(cursor.name)) return cursor;
    cursor = cursor.parent;
  }
  return findFirstRigObject(root, (child) => child?.isBone && isUpperArm(child.name))
    || findFirstRigObject(root, (child) => child?.isBone && isShoulder(child.name));
};

const findUpperLegBoneForSide = (root, side = 'left') => (
  findFirstRigObject(root, (child) => child?.isBone && isUpperLegRigName(child.name, side))
);

const findLowerLegBoneForSide = (root, side = 'left') => (
  findFirstRigObject(root, (child) => child?.isBone && isLowerLegRigName(child.name, side))
  || findUpperLegBoneForSide(root, side)
);

const findFootBoneForSide = (root, side = 'left') => (
  findFirstRigObject(root, (child) => child?.isBone && isFootRigName(child.name, side))
  || findLowerLegBoneForSide(root, side)
);

const findLowerBellyBone = (root) => (
  findFirstRigObject(root, (child) => child?.isBone && isLowerBellyRigName(child.name))
  || findFirstRigObject(root, (child) => {
    const normalized = normalizeRigObjectName(child?.name || '');
    return child?.isBone && normalized.includes('spine') && !normalized.includes('neck') && !normalized.includes('head');
  })
);

const getHeadBoneRank = (bone = null) => {
  const normalized = normalizeRigObjectName(bone?.name || '');
  if (!normalized) return 99;
  if (normalized === 'head' || normalized.endsWith('head')) return 0;
  if (normalized.includes('head') && !normalized.includes('end') && !normalized.includes('top')) return 1;
  if (normalized.includes('skull') || normalized.includes('crane') || normalized.includes('tete')) return 2;
  if (normalized.includes('head')) return 3;
  return 9;
};

const findHeadBone = (root) => {
  const candidates = [];
  root?.traverse?.((child) => {
    if (child?.isBone && isHeadRigName(child.name)) candidates.push(child);
  });
  if (candidates.length) {
    return candidates.sort((left, right) => getHeadBoneRank(left) - getHeadBoneRank(right))[0];
  }
  return findFirstRigObject(root, (child) => child?.isBone && isNeckRigName(child.name));
};

const isHelmetMouthGripEnabled = (item = {}) => Boolean(item?.armorGripMouthEnabled);

const findHelmetSocket = (root, item = {}, actor = {}) => {
  if (isHelmetMouthGripEnabled(item)) {
    const mouthSocket = createCharacterRigPointSocket(root, actor, 'mouth');
    if (mouthSocket) return mouthSocket;
  }
  return findFirstRigObject(root, (child) => HELMET_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)))
    || findHeadBone(root);
};

const getFingerRankForRigPoint = (point = {}) => {
  if (point.finger === 'thumb') return 0;
  if (point.finger === 'index') return 1;
  if (point.finger === 'middle') return 2;
  if (point.finger === 'ring') return 3;
  if (point.finger === 'pinky') return 4;
  return -1;
};

const findFingerBoneForRigPoint = (root = null, point = {}) => {
  const hand = point.hand === 'left' ? 'left' : 'right';
  const handBone = findHandBoneForArm(root, hand);
  const targetRank = getFingerRankForRigPoint(point);
  if (!handBone || targetRank < 0) return null;
  const fingerRoot = getFingerRootBonesForHand(handBone, hand)
    .find((rootBone) => getFingerFamilyRank(rootBone) === targetRank);
  if (!fingerRoot) return handBone;
  const joint = Number(point.joint);
  if (joint <= 1) return getFingerBasePhalanxBoneFromRoot(fingerRoot, hand) || fingerRoot;
  if (joint >= 4) return getFingerTipBoneFromRoot(fingerRoot, hand) || fingerRoot;
  let match = null;
  fingerRoot.traverse?.((child) => {
    if (!match && child?.isBone && getFingerSegmentIndex(child) === joint) match = child;
  });
  return match || getFingerTipBoneFromRoot(fingerRoot, hand) || fingerRoot;
};

const findArmorRigPointBone = (root = null, rigPointId = '') => {
  const point = getCharacterRigPointDefinition(rigPointId);
  if (!point) return null;
  if (point.group === 'phalanges') return findFingerBoneForRigPoint(root, point);
  if (rigPointId === 'right-hand') return findHandBoneForArm(root, 'right');
  if (rigPointId === 'left-hand') return findHandBoneForArm(root, 'left');
  if (rigPointId === 'right-elbow') return findForearmBoneForArm(root, 'right');
  if (rigPointId === 'left-elbow') return findForearmBoneForArm(root, 'left');
  if (rigPointId === 'right-shoulder') return findShoulderBoneForArm(root, 'right');
  if (rigPointId === 'left-shoulder') return findShoulderBoneForArm(root, 'left');
  if (rigPointId === 'neck') return findFirstRigObject(root, (child) => child?.isBone && isNeckRigName(child.name));
  if (rigPointId === 'mouth') return findHeadBone(root);
  if (rigPointId === 'lower-belly') return findLowerBellyBone(root);
  if (rigPointId === 'right-groin-fold') return findUpperLegBoneForSide(root, 'right') || findLowerBellyBone(root);
  if (rigPointId === 'left-groin-fold') return findUpperLegBoneForSide(root, 'left') || findLowerBellyBone(root);
  if (rigPointId === 'right-knee') return findLowerLegBoneForSide(root, 'right');
  if (rigPointId === 'left-knee') return findLowerLegBoneForSide(root, 'left');
  if (rigPointId === 'right-ankle' || rigPointId === 'right-foot') return findFootBoneForSide(root, 'right');
  if (rigPointId === 'left-ankle' || rigPointId === 'left-foot') return findFootBoneForSide(root, 'left');
  return null;
};

const getLocalPointFromWorld = (parent = null, worldPoint = null) => {
  if (!parent || !worldPoint) return null;
  parent.updateMatrixWorld?.(true);
  return parent.worldToLocal(worldPoint.clone());
};

const updateShieldArmLineSocket = (socket = null) => {
  const handBone = socket?.rpg3dShieldHandBone;
  const elbowBone = socket?.rpg3dShieldElbowBone;
  const parent = socket?.parent;
  if (!parent || !handBone?.isBone || !elbowBone?.isBone) return false;
  handBone.updateMatrixWorld?.(true);
  elbowBone.updateMatrixWorld?.(true);
  const handPoint = getLocalPointFromWorld(parent, handBone.getWorldPosition(new ThreeVector3()));
  const elbowPoint = getLocalPointFromWorld(parent, elbowBone.getWorldPosition(new ThreeVector3()));
  if (!handPoint || !elbowPoint) return false;
  const yAxis = handPoint.clone().sub(elbowPoint);
  if (yAxis.lengthSq() <= 0.000001) return false;
  yAxis.normalize();
  const preferred = handBone.localToWorld(new ThreeVector3(0, 0, 1));
  const preferredLocal = getLocalPointFromWorld(parent, preferred)?.sub(handPoint) || new ThreeVector3(0, 0, 1);
  const zAxis = getProjectedPerpendicularAxis(yAxis, preferredLocal);
  const xAxis = yAxis.clone().cross(zAxis).normalize();
  const stableZAxis = xAxis.clone().cross(yAxis).normalize();
  socket.position.copy(handPoint.clone().add(elbowPoint).multiplyScalar(0.5));
  socket.quaternion.setFromRotationMatrix(new ThreeMatrix4().makeBasis(xAxis, yAxis, stableZAxis));
  socket.scale.set(1, 1, 1);
  socket.updateMatrixWorld?.(true);
  return true;
};

const updateShieldArmLineSockets = (root = null) => {
  let didUpdate = false;
  root?.traverse?.((child) => {
    if (!child?.userData?.rpg3dShieldArmLineSocket) return;
    didUpdate = updateShieldArmLineSocket(child) || didUpdate;
  });
  return didUpdate;
};

const createShieldArmLineSocket = (root = null, arm = 'left') => {
  if (!root?.traverse) return null;
  const handBone = findHandBoneForArm(root, arm);
  const elbowBone = findForearmBoneForArm(root, arm);
  if (!handBone?.isBone || !elbowBone?.isBone) return null;
  const socketKey = arm === 'right' ? 'shield-right-arm-line' : 'shield-left-arm-line';
  let existingSocket = null;
  root.traverse((child) => {
    if (!existingSocket && child.userData?.rpg3dShieldArmLineSocket === socketKey) existingSocket = child;
  });
  const socket = existingSocket || new ThreeGroup();
  socket.name = arm === 'right' ? 'Rpg3DRightShieldArmLineSocket' : 'Rpg3DLeftShieldArmLineSocket';
  socket.userData.rpg3dShieldArmLineSocket = socketKey;
  socket.userData.rpg3dEquipmentSocketHand = arm;
  socket.rpg3dShieldHandBone = handBone;
  socket.rpg3dShieldElbowBone = elbowBone;
  if (!existingSocket) root.add(socket);
  updateShieldArmLineSocket(socket);
  return socket;
};

const findLeftForearmShieldSocket = (root) => (
  findFirstRigObject(root, (child) => SHIELD_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)))
  || findFirstRigObject(root, (child) => child?.isBone && isLeftForearmRigName(child.name))
  || findLeftForearmFromFingerBones(root)
  || findFirstRigObject(root, (child) => child?.isBone && isLeftHandRigName(child.name))
);

const findRightForearmShieldSocket = (root) => (
  findFirstRigObject(root, (child) => RIGHT_SHIELD_SOCKET_NAME_KEYS.includes(normalizeRigObjectName(child.name)))
  || findFirstRigObject(root, (child) => child?.isBone && isRightForearmRigName(child.name))
  || findRightForearmFromFingerBones(root)
  || findFirstRigObject(root, (child) => child?.isBone && isRightHandRigName(child.name))
);

const findShieldSocketForArm = (root, item = {}, actor = {}) => {
  const arm = getShieldGripArm(item);
  const hasHand = getShieldGripPointEnabled(item, 'Hand');
  const hasElbow = getShieldGripPointEnabled(item, 'Elbow');
  const handRigId = arm === 'right' ? 'right-hand' : 'left-hand';
  const elbowRigId = arm === 'right' ? 'right-elbow' : 'left-elbow';
  if (hasHand && hasElbow) {
    const rigSocket = createCharacterRigLineSocket(root, actor, `shield-${arm}-line`, handRigId, elbowRigId);
    if (rigSocket) return rigSocket;
  }
  if (hasHand) {
    const rigSocket = createCharacterRigPointSocket(root, actor, handRigId);
    if (rigSocket) return rigSocket;
  }
  if (hasElbow) {
    const rigSocket = createCharacterRigPointSocket(root, actor, elbowRigId);
    if (rigSocket) return rigSocket;
  }
  if (hasHand && hasElbow) return createShieldArmLineSocket(root, arm);
  if (hasHand) return findHandBoneForArm(root, arm);
  if (hasElbow) return findForearmBoneForArm(root, arm);
  return arm === 'right' ? findRightForearmShieldSocket(root) : findLeftForearmShieldSocket(root);
};

const resolveArmorGripPoint = (pointOrSuffix = '') => (
  typeof pointOrSuffix === 'string'
    ? ARMOR_GRIP_POINTS.find((point) => point.suffix === pointOrSuffix)
    : pointOrSuffix
);

const getArmorGripPointEnabled = (item = {}, pointOrSuffix = '') => {
  const point = resolveArmorGripPoint(pointOrSuffix);
  const suffix = point?.suffix || String(pointOrSuffix || '');
  const value = item[`armorGrip${suffix}Enabled`];
  const isCorePoint = CORE_ARMOR_GRIP_SUFFIXES.has(suffix);
  if (value === undefined || value === null || value === '') {
    return isCorePoint ? Boolean(item.armorFullCharacterRigEnabled) : false;
  }
  return Boolean(value);
};

const getEnabledArmorGripPoints = (item = {}) => (
  ARMOR_GRIP_POINTS.filter((point) => getArmorGripPointEnabled(item, point))
);

const getEnabledLeggingsGripPoints = (item = {}) => (
  LEGGINGS_GRIP_POINTS.filter((point) => getArmorGripPointEnabled(item, point))
);

const getEnabledArmorBodyGripPoints = (item = {}) => {
  if (item.armorFullCharacterRigEnabled) return getEnabledArmorGripPoints(item);
  const bodyPoints = ARMOR_GRIP_POINTS.filter((point) => (
    ARMOR_BODY_POINT_SUFFIXES.has(point.suffix)
    && getArmorGripPointEnabled(item, point)
  ));
  return bodyPoints.length >= 2 ? bodyPoints : getEnabledArmorGripPoints(item);
};

const getArmorGripTargetBone = (root = null, point = {}) => {
  const rigPointBone = findArmorRigPointBone(root, point.rigPointId);
  if (rigPointBone) return rigPointBone;
  if (point.role === 'shoulder') return findShoulderBoneForArm(root, point.arm);
  if (point.role === 'elbow') return findForearmBoneForArm(root, point.arm);
  if (point.role === 'lower-belly') return findLowerBellyBone(root);
  if (point.rigPointId === 'right-hand') return findHandBoneForArm(root, 'right');
  if (point.rigPointId === 'left-hand') return findHandBoneForArm(root, 'left');
  if (point.rigPointId === 'neck') return findFirstRigObject(root, (child) => child?.isBone && isNeckRigName(child.name));
  if (point.rigPointId === 'mouth') return findHeadBone(root);
  return null;
};

const getFallbackArmorGripLocalPoint = (root = null, point = {}) => {
  if (!root) return null;
  const bounds = getActorModelBodyBounds(root);
  const rigPointDefinition = getCharacterRigPointDefinition(point.rigPointId);
  if (rigPointDefinition) {
    const worldRigPoint = getCharacterRigBoundsWorldPoint(bounds, rigPointDefinition);
    if (worldRigPoint) {
      root.updateMatrixWorld?.(true);
      return root.worldToLocal(worldRigPoint);
    }
  }
  const size = bounds.getSize(new ThreeVector3());
  const center = bounds.getCenter(new ThreeVector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || size.y <= 0.0001) return null;
  const side = point.arm === 'right' ? 1 : (point.arm === 'left' ? -1 : 0);
  const heightRatio = point.role === 'shoulder'
    ? 0.78
    : (point.role === 'elbow' ? 0.58 : 0.42);
  const lateralRatio = point.role === 'shoulder'
    ? 0.34
    : (point.role === 'elbow' ? 0.46 : 0);
  const worldPoint = new ThreeVector3(
    center.x + side * Math.max(size.x * lateralRatio, side ? 0.18 : 0),
    bounds.min.y + size.y * heightRatio,
    center.z + size.z * 0.08,
  );
  root.updateMatrixWorld?.(true);
  return root.worldToLocal(worldPoint);
};

const updateArmorBodySocket = (socket = null) => {
  const parent = socket?.parent;
  const entries = (socket?.rpg3dArmorGripEntries || [])
    .map((entry) => {
      const point = entry.source?.isBone
        ? getLocalBonePosition(parent, entry.source)
        : entry.fallbackPoint?.clone?.();
      return point ? { suffix: entry.suffix, point } : null;
    })
    .filter(Boolean);
  if (!parent || !entries.length) return false;
  const frame = getArmorGripFrame(entries);
  if (!frame) return false;
  socket.position.copy(frame.center);
  socket.quaternion.copy(frame.quaternion);
  socket.scale.set(1, 1, 1);
  socket.updateMatrixWorld?.(true);
  return true;
};

const updateArmorBodySockets = (root = null) => {
  let didUpdate = false;
  root?.traverse?.((child) => {
    if (!child?.userData?.rpg3dArmorBodySocket) return;
    didUpdate = updateArmorBodySocket(child) || didUpdate;
  });
  return didUpdate;
};

const updateArmorArmLineSocket = (socket = null) => {
  const shoulderBone = socket?.rpg3dArmorShoulderBone;
  const elbowBone = socket?.rpg3dArmorElbowBone;
  const parent = socket?.parent;
  if (!parent || !shoulderBone?.isBone || !elbowBone?.isBone) return false;
  shoulderBone.updateMatrixWorld?.(true);
  elbowBone.updateMatrixWorld?.(true);
  const shoulderPoint = getLocalPointFromWorld(parent, shoulderBone.getWorldPosition(new ThreeVector3()));
  const elbowPoint = getLocalPointFromWorld(parent, elbowBone.getWorldPosition(new ThreeVector3()));
  if (!shoulderPoint || !elbowPoint) return false;
  const yAxis = shoulderPoint.clone().sub(elbowPoint);
  if (yAxis.lengthSq() <= 0.000001) return false;
  yAxis.normalize();
  const preferred = elbowBone.localToWorld(new ThreeVector3(0, 0, 1));
  const preferredLocal = getLocalPointFromWorld(parent, preferred)?.sub(elbowPoint) || new ThreeVector3(0, 0, 1);
  const zAxis = getProjectedPerpendicularAxis(yAxis, preferredLocal);
  const xAxis = yAxis.clone().cross(zAxis).normalize();
  const stableZAxis = xAxis.clone().cross(yAxis).normalize();
  socket.position.copy(shoulderPoint);
  socket.quaternion.setFromRotationMatrix(new ThreeMatrix4().makeBasis(xAxis, yAxis, stableZAxis));
  socket.scale.set(1, 1, 1);
  socket.updateMatrixWorld?.(true);
  return true;
};

const updateArmorArmLineSockets = (root = null) => {
  let didUpdate = false;
  root?.traverse?.((child) => {
    if (!child?.userData?.rpg3dArmorArmLineSocket) return;
    didUpdate = updateArmorArmLineSocket(child) || didUpdate;
  });
  return didUpdate;
};

const createArmorBodySocket = (root = null, item = {}, actor = {}, options = {}) => {
  if (!root?.traverse) return null;
  const enabledPoints = Array.isArray(options.enabledPoints)
    ? options.enabledPoints
    : getEnabledArmorBodyGripPoints(item);
  if (!enabledPoints.length) return null;
  const socketKey = options.socketKey || 'armor-body-frame';
  const socketName = options.socketName || 'Rpg3DArmorBodySocket';
  const socketUserDataField = options.socketUserDataField || 'rpg3dArmorBodySocket';
  let existingSocket = null;
  root.traverse((child) => {
    if (!existingSocket && child.userData?.[socketUserDataField] === socketKey) existingSocket = child;
  });
  const socket = existingSocket || new ThreeGroup();
  socket.name = socketName;
  socket.userData.rpg3dArmorBodySocket = socketKey;
  socket.userData[socketUserDataField] = socketKey;
  socket.rpg3dArmorGripEntries = enabledPoints.map((point) => ({
    suffix: point.suffix,
    source: getArmorGripTargetBone(root, point),
    fallbackPoint: getCharacterRigLocalPoint(root, actor, point.rigPointId) || getFallbackArmorGripLocalPoint(root, point),
  }));
  if (!existingSocket) root.add(socket);
  if (!updateArmorBodySocket(socket)) {
    if (!existingSocket) socket.parent?.remove?.(socket);
    return null;
  }
  return socket;
};

const createArmorArmLineSocket = (root = null, arm = 'left', actor = {}) => {
  if (!root?.traverse) return null;
  const shoulderBone = findShoulderBoneForArm(root, arm);
  const elbowBone = findForearmBoneForArm(root, arm);
  const socketKey = arm === 'right' ? 'armor-right-arm-line' : 'armor-left-arm-line';
  if (shoulderBone?.isBone && elbowBone?.isBone) {
    let existingSocket = null;
    root.traverse((child) => {
      if (!existingSocket && child.userData?.rpg3dArmorArmLineSocket === socketKey) existingSocket = child;
    });
    const socket = existingSocket || new ThreeGroup();
    socket.name = arm === 'right' ? 'Rpg3DRightArmorArmSocket' : 'Rpg3DLeftArmorArmSocket';
    socket.userData.rpg3dArmorArmLineSocket = socketKey;
    socket.rpg3dArmorShoulderBone = shoulderBone;
    socket.rpg3dArmorElbowBone = elbowBone;
    if (!existingSocket) root.add(socket);
    if (!updateArmorArmLineSocket(socket)) {
      if (!existingSocket) socket.parent?.remove?.(socket);
      return null;
    }
    return socket;
  }
  return createCharacterRigLineSocket(
    root,
    actor,
    socketKey,
    arm === 'right' ? 'right-shoulder' : 'left-shoulder',
    arm === 'right' ? 'right-elbow' : 'left-elbow',
  );
};

const findArmorSocket = (root, item = {}, actor = {}) => {
  if (getEnabledArmorBodyGripPoints(item).length) {
    const frameSocket = createArmorBodySocket(root, item, actor);
    if (frameSocket) return frameSocket;
  }
  const rigSocket = createCharacterRigPointSocket(root, actor, 'lower-belly');
  if (rigSocket) return rigSocket;
  return findLowerBellyBone(root);
};

const findLeggingsSocket = (root, item = {}, actor = {}) => {
  const enabledPoints = getEnabledLeggingsGripPoints(item);
  if (enabledPoints.length) {
    const frameSocket = createArmorBodySocket(root, item, actor, {
      enabledPoints,
      socketKey: 'leggings-body-frame',
      socketName: 'Rpg3DLeggingsBodySocket',
      socketUserDataField: 'rpg3dLeggingsBodySocket',
    });
    if (frameSocket) return frameSocket;
  }
  const rigSocket = createCharacterRigPointSocket(root, actor, 'lower-belly');
  if (rigSocket) return rigSocket;
  return findLowerBellyBone(root);
};

const findArmorArmSocket = (root, item = {}, arm = 'left', actor = {}) => {
  const suffixes = arm === 'right' ? ARMOR_RIGHT_ARM_POINT_SUFFIXES : ARMOR_LEFT_ARM_POINT_SUFFIXES;
  const hasArmLine = [...suffixes].every((suffix) => getArmorGripPointEnabled(item, suffix));
  return hasArmLine ? createArmorArmLineSocket(root, arm, actor) : null;
};

const findArmorPieceSocket = (root, item = {}, piece = {}, actor = {}) => {
  const rigPointId = normalizeArmorPieceRigPointId(piece.rigPointId, piece.segment);
  return findArmorRigPointBone(root, rigPointId)
    || createCharacterRigPointSocket(root, actor, rigPointId)
    || findArmorSocket(root, item, actor);
};

const getEquipmentGripNameKeys = (role = 'weapon') => (
  String(role).startsWith('armor')
    ? ARMOR_GRIP_NAME_KEYS
    : (role === 'shield'
      ? SHIELD_GRIP_NAME_KEYS
      : (role === 'helmet' ? HELMET_GRIP_NAME_KEYS : WEAPON_GRIP_NAME_KEYS))
);

const findEquipmentGripSocket = (root, role = 'weapon') => {
  const keys = getEquipmentGripNameKeys(role);
  let exactMatch = null;
  let partialMatch = null;
  root?.traverse?.((child) => {
    if (child === root || (!child.name && !child.userData?.rpg3dGripSocket)) return;
    const normalized = normalizeRigObjectName(child.name);
    if (!exactMatch && keys.includes(normalized)) exactMatch = child;
    if (!partialMatch && keys.some((key) => normalized.includes(key))) partialMatch = child;
    if (!partialMatch && child.userData?.rpg3dGripSocket) partialMatch = child;
  });
  return exactMatch || partialMatch;
};

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

const getEquippedArmorItem = (actor = {}) => {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  return inventory.find((item) => (
    item?.type === 'armor'
    && item.equipped
    && (item.weaponModelUrl || item.modelUrl)
  )) || null;
};

const getEquippedHelmetItem = (actor = {}) => {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  return inventory.find((item) => (
    item?.type === 'helmet'
    && item.equipped
    && (item.weaponModelUrl || item.modelUrl)
  )) || null;
};

const getEquippedLeggingsItem = (actor = {}) => {
  const inventory = Array.isArray(actor.inventory) ? actor.inventory : [];
  return inventory.find((item) => (
    item?.type === 'leggings'
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
    Number(item.weaponModelSourceScale) || 0,
    Number(item.weaponModelWidth) || 0,
    Number(item.weaponModelHeight) || 0,
    Number(item.weaponModelDepth) || 0,
    Number(item.weaponModelSourceWidth) || 0,
    Number(item.weaponModelSourceHeight) || 0,
    Number(item.weaponModelSourceDepth) || 0,
    getEquipmentModelRotationValue(item, 'X'),
    getEquipmentModelRotationValue(item, 'Y'),
    getEquipmentModelRotationValue(item, 'Z'),
    Number(item.weaponOffsetX) || 0,
    Number(item.weaponOffsetY) || 0,
    Number(item.weaponOffsetZ) || 0,
    Number(item.weaponRotationX) || 0,
    Number(item.weaponRotationY) || 0,
    Number(item.weaponRotationZ) || 0,
    getWeaponGripHand(item),
    item.weaponGripRightEnabled ? 1 : 0,
    Number(item.weaponGripRightX) || 0,
    Number(item.weaponGripRightY) || 0,
    Number(item.weaponGripRightZ) || 0,
    Number(item.weaponGripRightRotationX) || 0,
    Number(item.weaponGripRightRotationY) || 0,
    Number(item.weaponGripRightRotationZ) || 0,
    item.weaponGripLeftEnabled ? 1 : 0,
    Number(item.weaponGripLeftX) || 0,
    Number(item.weaponGripLeftY) || 0,
    Number(item.weaponGripLeftZ) || 0,
    Number(item.weaponGripLeftRotationX) || 0,
    Number(item.weaponGripLeftRotationY) || 0,
    Number(item.weaponGripLeftRotationZ) || 0,
    getShieldGripArm(item),
    Number(item.shieldGripReferenceScale) || 1,
    item.shieldGripHandEnabled ? 1 : 0,
    Number(item.shieldGripHandX) || 0,
    Number(item.shieldGripHandY) || 0,
    Number(item.shieldGripHandZ) || 0,
    item.shieldGripElbowEnabled ? 1 : 0,
    Number(item.shieldGripElbowX) || 0,
    Number(item.shieldGripElbowY) || 0,
    Number(item.shieldGripElbowZ) || 0,
    Number(item.armorGripReferenceScale) || 1,
    ...ARMOR_GRIP_POINTS.flatMap((point) => [
      getArmorGripPointEnabled(item, point.suffix) ? 1 : 0,
      Number(item[`armorGrip${point.suffix}X`]) || point.defaultX,
      Number(item[`armorGrip${point.suffix}Y`]) || point.defaultY,
      Number(item[`armorGrip${point.suffix}Z`]) || point.defaultZ,
    ]),
    item.armorCanvasCutEnabled ? 1 : 0,
    item.armorFullCharacterRigEnabled ? 1 : 0,
    JSON.stringify(Array.isArray(item.armorCustomPieces) ? item.armorCustomPieces : []),
    JSON.stringify(getArmorSegmentAssignments(item)),
    JSON.stringify(Array.isArray(item.armorCutContours) ? item.armorCutContours : []),
    JSON.stringify(Array.isArray(item.armorCutPaintStrokes) ? item.armorCutPaintStrokes : []),
  ].join(':');
};

const getWeaponModelSignature = (actor = {}) => getEquipmentItemModelSignature(getEquippedWeaponItem(actor));

const getEquipmentModelSignature = (actor = {}) => [
  getWeaponModelSignature(actor),
  getEquipmentItemModelSignature(getEquippedShieldItem(actor)),
  getEquipmentItemModelSignature(getEquippedArmorItem(actor)),
  getEquipmentItemModelSignature(getEquippedHelmetItem(actor)),
  getEquipmentItemModelSignature(getEquippedLeggingsItem(actor)),
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
  instance.userData.rpg3dActorModelRoot = true;
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
    const fallback = new ThreeMesh(
      new ThreeCapsuleGeometry(radius3d * modelScale, Math.max(0.2, height - radius3d * 2 * modelScale), 6, 14),
      new ThreeMeshStandardMaterial({
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
  const equipmentSignatures = {};
  if (fitted && animationOptions.weaponTemplate && animationOptions.weaponItem) {
    if (addEquippedWeaponToActorModel(instance, animationOptions.weaponTemplate, animationOptions.weaponItem, actor)) {
      equipmentSignatures.weapon = getActorEquipmentRoleSignature(actor, 'weapon');
    }
  }
  if (fitted && animationOptions.shieldTemplate && animationOptions.shieldItem) {
    if (addEquippedShieldToActorModel(instance, animationOptions.shieldTemplate, animationOptions.shieldItem, actor)) {
      equipmentSignatures.shield = getActorEquipmentRoleSignature(actor, 'shield');
    }
  }
  if (fitted && animationOptions.armorTemplate && animationOptions.armorItem) {
    if (addEquippedArmorToActorModel(instance, animationOptions.armorTemplate, animationOptions.armorItem, actor)) {
      equipmentSignatures.armor = getActorEquipmentRoleSignature(actor, 'armor');
    }
  }
  if (fitted && animationOptions.helmetTemplate && animationOptions.helmetItem) {
    if (addEquippedHelmetToActorModel(instance, animationOptions.helmetTemplate, animationOptions.helmetItem, actor)) {
      equipmentSignatures.helmet = getActorEquipmentRoleSignature(actor, 'helmet');
    }
  }
  if (fitted && animationOptions.leggingsTemplate && animationOptions.leggingsItem) {
    if (addEquippedLeggingsToActorModel(instance, animationOptions.leggingsTemplate, animationOptions.leggingsItem, actor)) {
      equipmentSignatures.leggings = getActorEquipmentRoleSignature(actor, 'leggings');
    }
  }
  if (selected) actorGroup.add(createSelectionRing(radius3d * 1.9 * Math.max(axisScale.x, axisScale.z), '#f8fbff'));
  return {
    mixer: animationController?.mixer || null,
    animationController,
    axisScaleApplied: Boolean(fitted),
    equipmentSignatures,
  };
};

const fitWeaponModelToLargestDimension = (object, targetSize = 1.15) => {
  object.updateMatrixWorld(true);
  const box = new ThreeBox3().setFromObject(object);
  const size = box.getSize(new ThreeVector3());
  const largest = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(largest) || largest <= 0.0001) return;
  object.scale.multiplyScalar(targetSize / largest);
};

const getPositiveEquipmentNumber = (value, fallback = 1) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0.0001 ? numeric : fallback;
};

const getEquipmentTargetDimensions = (item = {}) => {
  const scale = getPositiveEquipmentNumber(item.weaponModelScale, 1);
  return {
    width: getPositiveEquipmentNumber(item.weaponModelWidth, scale),
    height: getPositiveEquipmentNumber(item.weaponModelHeight, scale),
    depth: getPositiveEquipmentNumber(item.weaponModelDepth, scale),
  };
};

const hasExplicitEquipmentDimensions = (item = {}) => {
  const scale = getPositiveEquipmentNumber(item.weaponModelScale, 1);
  const dimensions = ['weaponModelWidth', 'weaponModelHeight', 'weaponModelDepth']
    .map((field) => Number(item[field]))
    .filter((value) => Number.isFinite(value) && value > 0.0001);
  if (dimensions.length < 3) return false;
  return dimensions.some((value) => Math.abs(value - scale) > 0.0001)
    || Math.abs(dimensions[0] - dimensions[1]) > 0.0001
    || Math.abs(dimensions[0] - dimensions[2]) > 0.0001;
};

const isArmorEquipmentRole = (role = '') => (
  String(role || '').startsWith('armor') || role === 'leggings'
);

const applyArmorSurfaceMaterialBias = (material = null) => {
  if (!material) return;
  const currentFactor = Number(material.polygonOffsetFactor);
  const currentUnits = Number(material.polygonOffsetUnits);
  material.polygonOffset = true;
  material.polygonOffsetFactor = Number.isFinite(currentFactor)
    ? Math.min(currentFactor, ARMOR_SURFACE_POLYGON_OFFSET_FACTOR)
    : ARMOR_SURFACE_POLYGON_OFFSET_FACTOR;
  material.polygonOffsetUnits = Number.isFinite(currentUnits)
    ? Math.min(currentUnits, ARMOR_SURFACE_POLYGON_OFFSET_UNITS)
    : ARMOR_SURFACE_POLYGON_OFFSET_UNITS;
  if (!material.transparent || Number(material.opacity) >= 0.999 || Number(material.alphaTest) > 0) {
    material.depthWrite = true;
  }
  material.needsUpdate = true;
};

const applyArmorSurfaceClearance = (equipment = null, role = 'equipment') => {
  if (!equipment?.traverse || !isArmorEquipmentRole(role)) return false;
  let applied = false;
  equipment.traverse((child) => {
    if (!child || (!child.isMesh && !child.isSkinnedMesh)) return;
    if (!child.userData?.rpg3dArmorSurfaceClearanceApplied) {
      child.scale.multiplyScalar(ARMOR_SURFACE_CLEARANCE_SCALE);
      child.userData = {
        ...(child.userData || {}),
        rpg3dArmorSurfaceClearanceApplied: true,
      };
    }
    child.renderOrder = Math.max(Number(child.renderOrder) || 0, ARMOR_SURFACE_RENDER_ORDER);
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach(applyArmorSurfaceMaterialBias);
    applied = true;
  });
  if (applied) {
    equipment.userData = {
      ...(equipment.userData || {}),
      rpg3dArmorSurfaceClearanceApplied: true,
    };
  }
  return applied;
};

const fitEquipmentModelToItemDimensions = (object, item = {}) => {
  if (!object) return false;
  if (!hasExplicitEquipmentDimensions(item)) {
    fitWeaponModelToLargestDimension(object, Math.max(0.001, Number(item.weaponModelScale) || 1));
    return true;
  }
  object.updateMatrixWorld(true);
  const box = new ThreeBox3().setFromObject(object);
  const size = box.getSize(new ThreeVector3());
  if (
    !Number.isFinite(size.x) || size.x <= 0.0001
    || !Number.isFinite(size.y) || size.y <= 0.0001
    || !Number.isFinite(size.z) || size.z <= 0.0001
  ) return false;
  const dimensions = getEquipmentTargetDimensions(item);
  object.scale.set(
    object.scale.x * Math.max(0.000001, dimensions.width / size.x),
    object.scale.y * Math.max(0.000001, dimensions.height / size.y),
    object.scale.z * Math.max(0.000001, dimensions.depth / size.z),
  );
  object.updateMatrixWorld(true);
  return true;
};

const getEquipmentAttachmentName = (role = 'equipment') => {
  if (role === 'weapon') return 'Rpg3DWeaponAttachment';
  if (role === 'shield') return 'Rpg3DShieldAttachment';
  if (role === 'armor') return 'Rpg3DArmorAttachment';
  if (role === 'armor-left-arm') return 'Rpg3DArmorLeftArmAttachment';
  if (role === 'armor-right-arm') return 'Rpg3DArmorRightArmAttachment';
  if (String(role).startsWith('armor-piece')) return 'Rpg3DArmorPieceAttachment';
  if (role === 'helmet') return 'Rpg3DHelmetAttachment';
  if (role === 'leggings') return 'Rpg3DLeggingsAttachment';
  return 'Rpg3DEquipmentAttachment';
};

const markEquipmentAttachment = (target, role = 'equipment', socket = null, grip = null) => {
  if (!target) return;
  const gripName = typeof grip === 'string' ? grip : (grip?.name || '');
  target.userData.rpg3dEquipmentRole = role;
  target.userData.rpg3dEquipmentSocket = socket?.name || '';
  target.userData.rpg3dEquipmentGripSocket = gripName;
  if (role === 'weapon') {
    target.userData.rpg3dEquippedWeapon = true;
    target.userData.rpg3dWeaponSocket = socket?.name || '';
  }
  if (role === 'shield') {
    target.userData.rpg3dEquippedShield = true;
    target.userData.rpg3dShieldSocket = socket?.name || '';
  }
  if (String(role).startsWith('armor')) {
    target.userData.rpg3dEquippedArmor = true;
    target.userData.rpg3dArmorSocket = socket?.name || '';
  }
  if (role === 'helmet') {
    target.userData.rpg3dEquippedHelmet = true;
    target.userData.rpg3dHelmetSocket = socket?.name || '';
  }
  if (role === 'leggings') {
    target.userData.rpg3dEquippedLeggings = true;
    target.userData.rpg3dLeggingsSocket = socket?.name || '';
  }
};

const alignEquipmentGripToOrigin = (equipment, grip = null) => {
  if (!equipment || !grip) return false;
  equipment.updateMatrixWorld(true);
  grip.updateMatrixWorld(true);
  const objectOrigin = equipment.getWorldPosition(new ThreeVector3());
  const gripOrigin = grip.getWorldPosition(new ThreeVector3());
  const gripOffset = gripOrigin.sub(objectOrigin);
  if (!Number.isFinite(gripOffset.x) || !Number.isFinite(gripOffset.y) || !Number.isFinite(gripOffset.z)) return false;
  equipment.position.sub(gripOffset);
  equipment.userData.rpg3dEquipmentGripSocket = grip.name || '';
  return true;
};

const getManualEquipmentGrip = (item = {}, equipmentScale = 1) => {
  const suffix = getWeaponGripHand(item) === 'left' ? 'Left' : 'Right';
  if (!item[`weaponGrip${suffix}Enabled`]) return null;
  const referenceScale = Number(item.weaponGripReferenceScale);
  const offsetScale = Number.isFinite(referenceScale) && referenceScale > 0.0001
    ? Math.max(0.001, Number(equipmentScale) || 1) / referenceScale
    : 1;
  const offset = new ThreeVector3(
    Number(item[`weaponGrip${suffix}X`]) || 0,
    Number(item[`weaponGrip${suffix}Y`]) || 0,
    Number(item[`weaponGrip${suffix}Z`]) || 0,
  ).multiplyScalar(offsetScale);
  return {
    name: suffix === 'Left' ? 'manual-left-hand' : 'manual-right-hand',
    offset,
    rotation: new ThreeEuler(
      degreesToRadians(item[`weaponGrip${suffix}RotationX`] || 0),
      degreesToRadians(item[`weaponGrip${suffix}RotationY`] || 0),
      degreesToRadians(item[`weaponGrip${suffix}RotationZ`] || 0),
    ),
  };
};

const getShieldGripOffsetScale = (item = {}, equipmentScale = 1) => {
  const referenceScale = Number(item.shieldGripReferenceScale || item.weaponGripReferenceScale);
  return Number.isFinite(referenceScale) && referenceScale > 0.0001
    ? Math.max(0.001, Number(equipmentScale) || 1) / referenceScale
    : 1;
};

const getShieldGripPointOffset = (item = {}, point = 'Hand', equipmentScale = 1) => {
  const fallbackY = point === 'Elbow' ? 0.35 : -0.35;
  return new ThreeVector3(
    Number(item[`shieldGrip${point}X`]) || 0,
    Number(item[`shieldGrip${point}Y`]) || fallbackY,
    Number(item[`shieldGrip${point}Z`]) || 0,
  ).multiplyScalar(getShieldGripOffsetScale(item, equipmentScale));
};

const getManualShieldGrip = (item = {}, equipmentScale = 1) => {
  const hasHand = getShieldGripPointEnabled(item, 'Hand');
  const hasElbow = getShieldGripPointEnabled(item, 'Elbow');
  if (!hasHand && !hasElbow) return null;
  const handOffset = hasHand ? getShieldGripPointOffset(item, 'Hand', equipmentScale) : null;
  const elbowOffset = hasElbow ? getShieldGripPointOffset(item, 'Elbow', equipmentScale) : null;
  if (handOffset && elbowOffset) {
    const line = handOffset.clone().sub(elbowOffset);
    if (line.lengthSq() > 0.000001) {
      return {
        name: 'manual-shield-arm-line',
        mode: 'line',
        midpoint: handOffset.clone().add(elbowOffset).multiplyScalar(0.5),
        line,
        rotation: new ThreeQuaternion().setFromUnitVectors(line.normalize(), new ThreeVector3(0, 1, 0)),
      };
    }
  }
  return {
    name: handOffset ? 'manual-shield-hand' : 'manual-shield-elbow',
    mode: 'point',
    offset: handOffset || elbowOffset,
  };
};

const getArmorGripOffsetScale = (item = {}, equipmentScale = 1) => {
  const referenceScale = Number(item.armorGripReferenceScale || item.weaponGripReferenceScale);
  return Number.isFinite(referenceScale) && referenceScale > 0.0001
    ? Math.max(0.001, Number(equipmentScale) || 1) / referenceScale
    : 1;
};

const getArmorGripPointOffset = (item = {}, point = {}, equipmentScale = 1) => (
  new ThreeVector3(
    Number.isFinite(Number(item[`armorGrip${point.suffix}X`])) ? Number(item[`armorGrip${point.suffix}X`]) : point.defaultX,
    Number.isFinite(Number(item[`armorGrip${point.suffix}Y`])) ? Number(item[`armorGrip${point.suffix}Y`]) : point.defaultY,
    Number.isFinite(Number(item[`armorGrip${point.suffix}Z`])) ? Number(item[`armorGrip${point.suffix}Z`]) : point.defaultZ,
  ).multiplyScalar(getArmorGripOffsetScale(item, equipmentScale))
);

const getManualHelmetGrip = (item = {}, equipmentScale = 1) => {
  if (!HELMET_MOUTH_GRIP_POINT || !isHelmetMouthGripEnabled(item)) return null;
  return {
    name: 'manual-helmet-mouth',
    mode: 'point',
    offset: getArmorGripPointOffset(item, HELMET_MOUTH_GRIP_POINT, equipmentScale),
  };
};

const getManualLeggingsGrip = (item = {}, equipmentScale = 1) => {
  const entries = getEnabledLeggingsGripPoints(item)
    .map((point) => ({
      suffix: point.suffix,
      point: getArmorGripPointOffset(item, point, equipmentScale),
    }));
  if (!entries.length) return null;
  const frame = getArmorGripFrame(entries);
  if (!frame) return null;
  return {
    name: 'manual-leggings-frame',
    mode: 'frame',
    oriented: true,
    center: frame.center,
    quaternion: frame.quaternion,
  };
};

const getManualArmorGrip = (item = {}, equipmentScale = 1, segment = 'body') => {
  const enabledPoints = segment === 'body' ? getEnabledArmorBodyGripPoints(item) : getEnabledArmorGripPoints(item);
  const entries = enabledPoints
    .map((point) => ({
      suffix: point.suffix,
      point: getArmorGripPointOffset(item, point, equipmentScale),
    }));
  if (!entries.length) return null;
  const frame = getArmorGripFrame(entries);
  if (!frame) return null;
  return {
    name: 'manual-armor-body-frame',
    mode: 'frame',
    oriented: true,
    center: frame.center,
    quaternion: frame.quaternion,
  };
};

const getManualArmorArmGrip = (item = {}, equipmentScale = 1, arm = 'left') => {
  const shoulderSuffix = arm === 'right' ? 'RightShoulder' : 'LeftShoulder';
  const elbowSuffix = arm === 'right' ? 'RightElbow' : 'LeftElbow';
  if (!getArmorGripPointEnabled(item, shoulderSuffix) || !getArmorGripPointEnabled(item, elbowSuffix)) return null;
  const shoulderConfig = ARMOR_GRIP_POINTS.find((point) => point.suffix === shoulderSuffix);
  const elbowConfig = ARMOR_GRIP_POINTS.find((point) => point.suffix === elbowSuffix);
  const shoulderOffset = getArmorGripPointOffset(item, shoulderConfig, equipmentScale);
  const elbowOffset = getArmorGripPointOffset(item, elbowConfig, equipmentScale);
  const line = shoulderOffset.clone().sub(elbowOffset);
  if (line.lengthSq() <= 0.000001) return null;
  return {
    name: arm === 'right' ? 'manual-armor-right-arm-line' : 'manual-armor-left-arm-line',
    mode: 'line',
    oriented: true,
    anchor: shoulderOffset,
    midpoint: shoulderOffset.clone().add(elbowOffset).multiplyScalar(0.5),
    line,
    rotation: new ThreeQuaternion().setFromUnitVectors(line.clone().normalize(), new ThreeVector3(0, 1, 0)),
  };
};

const getObjectLocalBoundsCenter = (object = null) => {
  if (!object) return new ThreeVector3();
  object.updateMatrixWorld?.(true);
  const box = new ThreeBox3().setFromObject(object);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return new ThreeVector3();
  return object.worldToLocal(box.getCenter(new ThreeVector3()));
};

const getManualArmorPieceGrip = (pieceObject = null, piece = {}) => ({
  name: `manual-armor-piece-${piece.id || 'piece'}`,
  mode: 'point',
  offset: getObjectLocalBoundsCenter(pieceObject),
});

const getFallbackWeaponGripOffset = (equipment) => {
  if (!equipment) return null;
  equipment.updateMatrixWorld(true);
  const box = new ThreeBox3().setFromObject(equipment);
  const size = box.getSize(new ThreeVector3());
  const dimensions = [
    { axis: 'x', size: size.x },
    { axis: 'y', size: size.y },
    { axis: 'z', size: size.z },
  ].sort((a, b) => b.size - a.size);
  if (!Number.isFinite(dimensions[0]?.size) || dimensions[0].size <= 0.0001) return null;
  if (dimensions[0].size < Math.max(dimensions[1]?.size || 0, dimensions[2]?.size || 0) * 1.6) return null;
  const objectOrigin = equipment.getWorldPosition(new ThreeVector3());
  const gripPoint = box.getCenter(new ThreeVector3());
  const axis = dimensions[0].axis;
  gripPoint[axis] = box.min[axis] + dimensions[0].size * 0.12;
  const offset = gripPoint.sub(objectOrigin);
  if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y) || !Number.isFinite(offset.z)) return null;
  return offset;
};

const getEquipmentParentScaleFactor = (socket = null) => {
  if (!socket) return 1;
  socket.updateMatrixWorld?.(true);
  const parentScale = socket.getWorldScale(new ThreeVector3());
  const scaleFactor = Math.max(
    Math.abs(parentScale.x),
    Math.abs(parentScale.y),
    Math.abs(parentScale.z),
  );
  return Number.isFinite(scaleFactor) && scaleFactor > 0.00001 ? scaleFactor : 1;
};

const attachPreparedEquipmentToSocket = (socket, equipment, item = {}, role = 'equipment', options = {}) => {
  if (!socket || !equipment) return null;
  const scale = Math.max(0.001, Number(item.weaponModelScale) || 1);
  if (options.fit !== false) fitEquipmentModelToItemDimensions(equipment, item);
  const hasBaseRotation = options.applyBaseRotation !== false && hasEquipmentModelBaseRotation(item);
  if (hasBaseRotation) {
    equipment.quaternion.premultiply(getEquipmentModelBaseQuaternion(item));
  }
  const manualGrip = options.manualGrip || (role === 'weapon'
    ? getManualEquipmentGrip(item, scale)
    : (role === 'shield'
      ? getManualShieldGrip(item, scale)
      : (role === 'helmet'
        ? getManualHelmetGrip(item, scale)
        : (String(role).startsWith('armor') ? getManualArmorGrip(item, scale) : null))));
  const grip = manualGrip ? null : findEquipmentGripSocket(equipment, role);
  const fallbackGripOffset = (manualGrip || grip || role !== 'weapon') ? null : getFallbackWeaponGripOffset(equipment);
  const attachment = manualGrip || grip || fallbackGripOffset || hasBaseRotation ? new ThreeGroup() : equipment;
  if (manualGrip || grip || fallbackGripOffset || hasBaseRotation) {
    attachment.name = getEquipmentAttachmentName(role);
    if (manualGrip) {
      if (manualGrip.mode === 'frame') {
        const frameQuaternion = manualGrip.quaternion?.isQuaternion
          ? manualGrip.quaternion
          : new ThreeQuaternion();
        if (manualGrip.oriented) {
          const frameRotation = frameQuaternion.clone().invert();
          equipment.quaternion.premultiply(frameRotation);
          equipment.position.sub((manualGrip.center || new ThreeVector3()).clone().applyQuaternion(frameRotation));
        } else {
          const orientedFrame = equipment.quaternion.clone().multiply(frameQuaternion).normalize();
          equipment.quaternion.premultiply(orientedFrame.invert());
          equipment.position.sub((manualGrip.center || new ThreeVector3()).clone().applyQuaternion(equipment.quaternion));
        }
      } else if (manualGrip.mode === 'line') {
        const line = manualGrip.line?.clone?.() || new ThreeVector3(0, 1, 0);
        const lineOrigin = manualGrip.anchor?.clone?.() || manualGrip.midpoint?.clone?.() || new ThreeVector3();
        if (manualGrip.oriented) {
          if (line.lengthSq() > 0.000001) {
            const lineRotation = new ThreeQuaternion().setFromUnitVectors(line.normalize(), new ThreeVector3(0, 1, 0));
            equipment.quaternion.premultiply(lineRotation);
            equipment.position.sub(lineOrigin.applyQuaternion(lineRotation));
          }
        } else {
          const orientedLine = line.applyQuaternion(equipment.quaternion);
          if (orientedLine.lengthSq() > 0.000001) {
            const lineRotation = new ThreeQuaternion().setFromUnitVectors(orientedLine.normalize(), new ThreeVector3(0, 1, 0));
            equipment.quaternion.premultiply(lineRotation);
          }
          equipment.position.sub(lineOrigin.applyQuaternion(equipment.quaternion));
        }
      } else {
        equipment.position.sub(manualGrip.offset.clone().applyQuaternion(equipment.quaternion));
      }
      equipment.userData.rpg3dEquipmentGripSocket = manualGrip.name;
    } else if (grip) alignEquipmentGripToOrigin(equipment, grip);
    else if (fallbackGripOffset) {
      equipment.position.sub(fallbackGripOffset);
      equipment.userData.rpg3dEquipmentGripSocket = 'auto-blade-base';
    }
    equipment.userData.rpg3dEquipmentRole = role;
    equipment.userData.rpg3dEquipmentSocket = socket.name || '';
    attachment.add(equipment);
  }
  const parentScaleFactor = getEquipmentParentScaleFactor(socket);
  const scaleCompensation = 1 / parentScaleFactor;
  attachment.scale.multiplyScalar(scaleCompensation);
  attachment.position.set(
    (Number(item.weaponOffsetX) || 0) * scaleCompensation,
    (Number(item.weaponOffsetY) || 0) * scaleCompensation,
    (Number(item.weaponOffsetZ) || 0) * scaleCompensation,
  );
  attachment.rotation.set(
    degreesToRadians(item.weaponRotationX || 0),
    degreesToRadians(item.weaponRotationY || 0),
    degreesToRadians(item.weaponRotationZ || 0) + (fallbackGripOffset ? Math.PI : 0),
  );
  if (manualGrip?.rotation?.isEuler) {
    attachment.rotation.x += manualGrip.rotation.x;
    attachment.rotation.y += manualGrip.rotation.y;
    attachment.rotation.z += manualGrip.rotation.z;
  }
  applyArmorSurfaceClearance(equipment, role);
  markEquipmentAttachment(attachment, role, socket, manualGrip?.name || grip || (fallbackGripOffset ? 'auto-blade-base' : null));
  socket.add(attachment);
  return attachment;
};

const getActorModelBodyBounds = (actorModel) => {
  const bounds = new ThreeBox3();
  const childBounds = new ThreeBox3();
  const skipped = new Set();
  let hasBounds = false;
  actorModel?.updateMatrixWorld?.(true);
  actorModel?.traverse?.((child) => {
    if (child !== actorModel && child.parent && skipped.has(child.parent)) {
      skipped.add(child);
      return;
    }
    if (child.userData?.rpg3dEquipmentRole || child.userData?.rpg3dFallbackEquipmentSocket) {
      skipped.add(child);
      return;
    }
    if (!child.isMesh && !child.isSkinnedMesh && !child.isSprite) return;
    childBounds.setFromObject(child);
    if (!Number.isFinite(childBounds.min.x) || !Number.isFinite(childBounds.max.x)) return;
    if (!hasBounds) bounds.copy(childBounds);
    else bounds.union(childBounds);
    hasBounds = true;
  });
  return hasBounds ? bounds : new ThreeBox3().setFromObject(actorModel);
};

const createFallbackEquipmentSocket = (actorModel, role = 'weapon', hand = 'right') => {
  if (!actorModel) return null;
  const fallbackRole = role === 'weapon' && hand === 'left' ? 'weapon-left' : role;
  let existingSocket = null;
  actorModel.traverse?.((child) => {
    if (!existingSocket && child.userData?.rpg3dFallbackEquipmentSocket === fallbackRole) {
      existingSocket = child;
    }
  });
  if (existingSocket) return existingSocket;
  const bounds = getActorModelBodyBounds(actorModel);
  const size = bounds.getSize(new ThreeVector3());
  const center = bounds.getCenter(new ThreeVector3());
  if (!Number.isFinite(size.x) || !Number.isFinite(size.y) || size.y <= 0.0001) return null;
  const side = role === 'shield' || (role === 'weapon' && hand === 'left') ? -1 : 1;
  const centeredRole = role === 'armor' || role === 'helmet' || role === 'leggings';
  const worldPoint = new ThreeVector3(
    centeredRole ? center.x : center.x + side * Math.max(size.x * 0.42, 0.28),
    bounds.min.y + size.y * (role === 'helmet' ? 0.88 : (role === 'leggings' ? 0.25 : (role === 'armor' ? 0.48 : (role === 'shield' ? 0.5 : 0.48)))),
    center.z + size.z * (role === 'helmet' ? 0.02 : (role === 'leggings' ? 0.1 : (role === 'armor' ? 0.08 : (role === 'shield' ? 0.08 : 0.22)))),
  );
  const socket = new ThreeGroup();
  socket.name = role === 'armor'
    ? 'Rpg3DFallbackArmorSocket'
    : (role === 'helmet'
      ? 'Rpg3DFallbackHelmetSocket'
      : (role === 'leggings'
        ? 'Rpg3DFallbackLeggingsSocket'
        : (role === 'shield'
        ? 'Rpg3DFallbackShieldSocket'
        : (hand === 'left' ? 'Rpg3DFallbackLeftWeaponSocket' : 'Rpg3DFallbackWeaponSocket'))));
  socket.userData.rpg3dFallbackEquipmentSocket = fallbackRole;
  socket.position.copy(actorModel.worldToLocal(worldPoint));
  actorModel.add(socket);
  return socket;
};

const addEquippedModelToActorSocket = (actorModel, modelTemplate, item = {}, findSocket, role = 'equipment', options = {}) => {
  const socket = findSocket?.(actorModel) || createFallbackEquipmentSocket(
    actorModel,
    role,
    role === 'shield' ? getShieldGripArm(item) : getWeaponGripHand(item),
  );
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
  return Boolean(attachPreparedEquipmentToSocket(socket, equipment, item, role, options));
};

const addEquippedWeaponToActorModel = (actorModel, weaponTemplate, weaponItem = {}, actor = {}) => (
  addEquippedModelToActorSocket(
    actorModel,
    weaponTemplate,
    weaponItem,
    (root) => findWeaponSocketForHand(root, getWeaponGripHand(weaponItem), actor),
    'weapon',
  )
);

const addEquippedShieldToActorModel = (actorModel, shieldTemplate, shieldItem = {}, actor = {}) => (
  addEquippedModelToActorSocket(
    actorModel,
    shieldTemplate,
    shieldItem,
    (root) => findShieldSocketForArm(root, shieldItem, actor),
    'shield',
  )
);

const addEquippedHelmetToActorModel = (actorModel, helmetTemplate, helmetItem = {}, actor = {}) => (
  addEquippedModelToActorSocket(
    actorModel,
    helmetTemplate,
    helmetItem,
    (root) => findHelmetSocket(root, helmetItem, actor),
    'helmet',
  )
);

const addEquippedLeggingsToActorModel = (actorModel, leggingsTemplate, leggingsItem = {}, actor = {}) => {
  const scale = Math.max(0.001, Number(leggingsItem.weaponModelScale) || 1);
  return addEquippedModelToActorSocket(
    actorModel,
    leggingsTemplate,
    leggingsItem,
    (root) => findLeggingsSocket(root, leggingsItem, actor),
    'leggings',
    {
      manualGrip: getManualLeggingsGrip(leggingsItem, scale),
    },
  );
};

const getObjectLargestDimension = (object = null) => {
  if (!object) return 0;
  object.updateMatrixWorld?.(true);
  const box = new ThreeBox3().setFromObject(object);
  const size = box.getSize(new ThreeVector3());
  const largest = Math.max(size.x, size.y, size.z);
  return Number.isFinite(largest) && largest > 0.0001 ? largest : 0;
};

const getObjectBoundingDimensions = (object = null) => {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new ThreeBox3().setFromObject(object);
  const size = box.getSize(new ThreeVector3());
  if (
    !Number.isFinite(size.x) || size.x <= 0.0001
    || !Number.isFinite(size.y) || size.y <= 0.0001
    || !Number.isFinite(size.z) || size.z <= 0.0001
  ) return null;
  return size;
};

const getArmorGripReferenceScale = (item = {}, fallback = 1) => {
  const explicit = Number(item.armorGripReferenceScale || item.weaponGripReferenceScale || item.weaponModelSourceScale);
  return Number.isFinite(explicit) && explicit > 0.0001 ? explicit : fallback;
};

const getArmorPointOriginalSpace = (item = {}, suffix = '', referenceScale = 1) => {
  const point = ARMOR_GRIP_POINTS.find((entry) => entry.suffix === suffix);
  if (!point) return new ThreeVector3();
  return new ThreeVector3(
    Number.isFinite(Number(item[`armorGrip${suffix}X`])) ? Number(item[`armorGrip${suffix}X`]) : point.defaultX,
    Number.isFinite(Number(item[`armorGrip${suffix}Y`])) ? Number(item[`armorGrip${suffix}Y`]) : point.defaultY,
    Number.isFinite(Number(item[`armorGrip${suffix}Z`])) ? Number(item[`armorGrip${suffix}Z`]) : point.defaultZ,
  ).multiplyScalar(referenceScale);
};

const getArmorObjectNameHaystack = (object = null) => {
  const names = [];
  let cursor = object;
  while (cursor) {
    if (cursor.name) names.push(cursor.name);
    cursor = cursor.parent;
  }
  return normalizeRigObjectName(names.join(' '));
};

const classifyArmorMeshSegment = (mesh = null, equipment = null, item = {}, referenceScale = 1) => {
  const nodePath = getRigNodePath(mesh, equipment);
  const assignedSegment = getArmorSegmentAssignments(item).find((entry) => entry.path === nodePath)?.segment;
  if (assignedSegment) return normalizeArmorSegment(assignedSegment);
  const haystack = getArmorObjectNameHaystack(mesh);
  const namedAsArm = ARMOR_ARM_SEGMENT_NAME_KEYS.some((key) => haystack.includes(key));
  if (namedAsArm && (haystack.includes('left') || haystack.includes('larm') || haystack.includes('lshoulder'))) return 'left';
  if (namedAsArm && (haystack.includes('right') || haystack.includes('rarm') || haystack.includes('rshoulder'))) return 'right';
  if (!equipment) return 'body';
  const box = new ThreeBox3().setFromObject(mesh);
  if (!Number.isFinite(box.min.x) || !Number.isFinite(box.max.x)) return 'body';
  const center = equipment.worldToLocal(box.getCenter(new ThreeVector3()));
  return classifyArmorPointSegment(center, item, referenceScale);
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

const classifyArmorPointSegment = (center = new ThreeVector3(), item = {}, referenceScale = 1, preparedPaintStrokes = null) => {
  const paintSegment = classifyArmorPaintSegment(center, item, referenceScale, preparedPaintStrokes);
  if (paintSegment) return paintSegment;
  const contourSegment = classifyArmorContourSegment(center, item, referenceScale);
  if (contourSegment) return contourSegment;
  const leftShoulder = getArmorPointOriginalSpace(item, 'LeftShoulder', referenceScale);
  const rightShoulder = getArmorPointOriginalSpace(item, 'RightShoulder', referenceScale);
  const leftElbow = getArmorPointOriginalSpace(item, 'LeftElbow', referenceScale);
  const rightElbow = getArmorPointOriginalSpace(item, 'RightElbow', referenceScale);
  const lowerBelly = getArmorPointOriginalSpace(item, 'LowerBelly', referenceScale);
  const scaledReference = Math.max(
    0.001,
    referenceScale,
    leftShoulder.distanceTo(rightShoulder),
    leftShoulder.distanceTo(lowerBelly),
    rightShoulder.distanceTo(lowerBelly),
  );
  const bodyCenter = leftShoulder.clone().add(rightShoulder).multiplyScalar(0.5).lerp(lowerBelly, 0.38);
  const candidates = [
    getArmorArmCutCandidate(center, leftShoulder, leftElbow, bodyCenter, 'left', -1, scaledReference),
    getArmorArmCutCandidate(center, rightShoulder, rightElbow, bodyCenter, 'right', 1, scaledReference),
  ].filter(Boolean).sort((a, b) => a.score - b.score);
  if (candidates[0]) return candidates[0].segment;
  if (isPointInsideArmorTorso(center, leftShoulder, rightShoulder, lowerBelly, scaledReference)) return 'body';
  return 'body';
};

const getTriangleMaterialIndex = (geometry = null, triangleStart = 0) => {
  const groups = Array.isArray(geometry?.groups) ? geometry.groups : [];
  const group = groups.find((entry) => triangleStart >= entry.start && triangleStart < entry.start + entry.count);
  return Number.isInteger(group?.materialIndex) ? group.materialIndex : 0;
};

const createSplitGeometryBuilder = (geometry = null, options = {}) => {
  const excludedAttributes = options.excludeAttributes || new Set();
  const attributeNames = Object.keys(geometry?.attributes || {})
    .filter((name) => !excludedAttributes.has(name));
  return {
    attributeNames,
    attributeReaders: options.attributeReaders || {},
    attributes: Object.fromEntries(attributeNames.map((name) => [name, []])),
    groups: [],
    vertexCount: 0,
    triangleCount: 0,
  };
};

const appendSplitGeometryVertex = (builder, geometry, vertexIndex) => {
  builder.attributeNames.forEach((name) => {
    const attribute = geometry.attributes[name];
    const output = builder.attributes[name];
    const readAttributeValues = builder.attributeReaders?.[name];
    if (readAttributeValues) {
      const values = readAttributeValues(vertexIndex, attribute);
      for (let offset = 0; offset < attribute.itemSize; offset += 1) {
        output.push(values?.[offset] ?? 0);
      }
      return;
    }
    for (let offset = 0; offset < attribute.itemSize; offset += 1) {
      output.push(attribute.array[(vertexIndex * attribute.itemSize) + offset] ?? 0);
    }
  });
  builder.vertexCount += 1;
};

const appendSplitGeometryTriangle = (builder, geometry, vertexIndices, materialIndex = 0) => {
  const group = builder.groups[builder.groups.length - 1];
  if (group && group.start + group.count === builder.vertexCount && group.materialIndex === materialIndex) {
    group.count += 3;
  } else {
    builder.groups.push({ start: builder.vertexCount, count: 3, materialIndex });
  }
  vertexIndices.forEach((vertexIndex) => appendSplitGeometryVertex(builder, geometry, vertexIndex));
  builder.triangleCount += 1;
};

const buildSplitBufferGeometry = (sourceGeometry = null, builder = null) => {
  const positionValues = builder?.attributes?.position || [];
  if (!sourceGeometry || !builder || positionValues.length < 9) return null;
  const geometry = new ThreeBufferGeometry();
  builder.attributeNames.forEach((name) => {
    const attribute = sourceGeometry.attributes[name];
    const values = builder.attributes[name];
    if (!attribute || !values?.length) return;
    geometry.setAttribute(name, new ThreeBufferAttribute(new attribute.array.constructor(values), attribute.itemSize, attribute.normalized));
  });
  builder.groups.forEach((group) => geometry.addGroup(group.start, group.count, group.materialIndex));
  if (!geometry.attributes.normal) geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
};

const createSegmentMeshFromSplitGeometry = (sourceMesh = null, geometry = null, options = {}) => {
  if (!sourceMesh || !geometry) return null;
  const mesh = options.bakedSkinnedMesh
    ? new ThreeMesh(geometry, sourceMesh.material)
    : sourceMesh.clone(false);
  if (options.bakedSkinnedMesh) {
    mesh.name = sourceMesh.name || 'Rpg3DArmorSplitSegment';
    mesh.position.copy(sourceMesh.position);
    mesh.quaternion.copy(sourceMesh.quaternion);
    mesh.scale.copy(sourceMesh.scale);
    mesh.matrix.copy(sourceMesh.matrix);
    mesh.matrixAutoUpdate = sourceMesh.matrixAutoUpdate;
    mesh.castShadow = sourceMesh.castShadow;
    mesh.receiveShadow = sourceMesh.receiveShadow;
    mesh.frustumCulled = sourceMesh.frustumCulled;
    mesh.visible = sourceMesh.visible;
  }
  mesh.geometry = geometry;
  mesh.material = sourceMesh.material;
  mesh.userData = { ...(sourceMesh.userData || {}), rpg3dArmorSplitSegment: true, preserveSharedResources: true };
  return mesh;
};

const addArmorSplitReferenceScaleCandidate = (candidates = [], value = 0) => {
  const scale = Number(value);
  if (!Number.isFinite(scale) || scale <= 0.0001) return;
  if (candidates.some((candidate) => Math.abs(candidate - scale) <= 0.0001)) return;
  candidates.push(scale);
};

const getArmorSplitReferenceScaleCandidates = (referenceScale = 1, mesh = null, equipment = null) => {
  const candidates = [];
  addArmorSplitReferenceScaleCandidate(candidates, referenceScale);
  const meshLargest = getObjectLargestDimension(mesh);
  const equipmentLargest = getObjectLargestDimension(equipment);
  const largest = meshLargest || equipmentLargest;
  addArmorSplitReferenceScaleCandidate(candidates, largest);
  addArmorSplitReferenceScaleCandidate(candidates, equipmentLargest);
  addArmorSplitReferenceScaleCandidate(candidates, 1);
  return candidates;
};

const classifySingleArmorMeshTriangles = ({
  geometry = null,
  position = null,
  readVertexPosition = null,
  mesh = null,
  equipment = null,
  item = {},
  referenceScale = 1,
  preparedPaintStrokes = null,
  builders = null,
} = {}) => {
  const counts = { body: 0, left: 0, right: 0 };
  if (!geometry || !position || !readVertexPosition || !mesh || !equipment) return counts;
  const index = geometry.index;
  const triangleLimit = index ? index.count : position.count;
  const localCenter = new ThreeVector3();
  const worldCenter = new ThreeVector3();
  equipment.updateMatrixWorld?.(true);
  mesh.updateMatrixWorld?.(true);
  for (let triangleStart = 0; triangleStart + 2 < triangleLimit; triangleStart += 3) {
    const vertexIndices = index
      ? [index.getX(triangleStart), index.getX(triangleStart + 1), index.getX(triangleStart + 2)]
      : [triangleStart, triangleStart + 1, triangleStart + 2];
    localCenter.set(0, 0, 0);
    vertexIndices.forEach((vertexIndex) => {
      localCenter.add(readVertexPosition(vertexIndex));
    });
    localCenter.multiplyScalar(1 / 3);
    worldCenter.copy(localCenter);
    mesh.localToWorld(worldCenter);
    const segment = classifyArmorPointSegment(
      equipment.worldToLocal(worldCenter.clone()),
      item,
      referenceScale,
      preparedPaintStrokes,
    );
    counts[segment] += 1;
    if (builders) {
      appendSplitGeometryTriangle(builders[segment], geometry, vertexIndices, getTriangleMaterialIndex(geometry, triangleStart));
    }
  }
  return counts;
};

const splitSingleArmorMeshIntoSegments = (mesh = null, equipment = null, item = {}, referenceScale = 1, segments = {}) => {
  if (!mesh?.geometry || !equipment) return null;
  const geometry = mesh.geometry;
  const position = geometry.attributes?.position;
  if (!position || position.count < 3) return null;
  const bakeSkinnedMesh = Boolean(
    mesh.isSkinnedMesh
    && geometry.attributes?.skinIndex
    && geometry.attributes?.skinWeight
    && typeof mesh.applyBoneTransform === 'function',
  );
  const vertexPositionCache = new Map();
  const readVertexPosition = (vertexIndex) => {
    if (vertexPositionCache.has(vertexIndex)) return vertexPositionCache.get(vertexIndex);
    const vertex = new ThreeVector3(
      position.getX(vertexIndex),
      position.getY(vertexIndex),
      position.getZ(vertexIndex),
    );
    if (bakeSkinnedMesh) mesh.applyBoneTransform(vertexIndex, vertex);
    vertexPositionCache.set(vertexIndex, vertex);
    return vertex;
  };
  const builderOptions = bakeSkinnedMesh
    ? {
      excludeAttributes: new Set(['normal', 'tangent', 'skinIndex', 'skinWeight']),
      attributeReaders: {
        position: (vertexIndex) => {
          const vertex = readVertexPosition(vertexIndex);
          return [vertex.x, vertex.y, vertex.z];
        },
      },
    }
    : {};
  const referenceScales = getArmorSplitReferenceScaleCandidates(referenceScale, mesh, equipment);
  const selectedReferenceScale = referenceScales.find((candidate) => {
    const preparedPaintStrokes = prepareArmorPaintStrokes(item, candidate);
    const candidateCounts = classifySingleArmorMeshTriangles({
      geometry,
      position,
      readVertexPosition,
      mesh,
      equipment,
      item,
      referenceScale: candidate,
      preparedPaintStrokes,
    });
    return Boolean(candidateCounts.left || candidateCounts.right);
  });
  if (!selectedReferenceScale) return null;
  const preparedPaintStrokes = prepareArmorPaintStrokes(item, selectedReferenceScale);
  const builders = {
    body: createSplitGeometryBuilder(geometry, builderOptions),
    left: createSplitGeometryBuilder(geometry, builderOptions),
    right: createSplitGeometryBuilder(geometry, builderOptions),
  };
  const counts = classifySingleArmorMeshTriangles({
    geometry,
    position,
    readVertexPosition,
    mesh,
    equipment,
    item,
    referenceScale: selectedReferenceScale,
    preparedPaintStrokes,
    builders,
  });
  const parent = mesh.parent || equipment;
  Object.entries(builders).forEach(([segment, builder]) => {
    const splitGeometry = buildSplitBufferGeometry(geometry, builder);
    if (!splitGeometry) return;
    const splitMesh = createSegmentMeshFromSplitGeometry(mesh, splitGeometry, {
      bakedSkinnedMesh: bakeSkinnedMesh,
    });
    if (!splitMesh) {
      splitGeometry.dispose();
      return;
    }
    parent.add(splitMesh);
    segments[segment]?.attach(splitMesh);
  });
  parent.remove(mesh);
  return { ...counts, referenceScale: selectedReferenceScale };
};

const createSegmentedArmorEquipment = (equipment = null, item = {}) => {
  if (!equipment?.traverse) return null;
  const meshes = [];
  equipment.updateMatrixWorld?.(true);
  equipment.traverse((child) => {
    if (child === equipment || (!child.isMesh && !child.isSkinnedMesh)) return;
    meshes.push(child);
  });
  if (!meshes.length) return null;
  const largest = getObjectLargestDimension(equipment);
  const referenceScale = getArmorGripReferenceScale(item, largest || 1);
  const targetSize = Math.max(0.001, Number(item.weaponModelScale) || 1);
  const targetDimensions = getEquipmentTargetDimensions({ ...item, weaponModelScale: targetSize });
  const sourceDimensions = getObjectBoundingDimensions(equipment);
  const fitScale = sourceDimensions && hasExplicitEquipmentDimensions(item)
    ? new ThreeVector3(
      targetDimensions.width / sourceDimensions.x,
      targetDimensions.height / sourceDimensions.y,
      targetDimensions.depth / sourceDimensions.z,
    )
    : new ThreeVector3(
      largest > 0.0001 ? targetSize / largest : 1,
      largest > 0.0001 ? targetSize / largest : 1,
      largest > 0.0001 ? targetSize / largest : 1,
    );
  const body = new ThreeGroup();
  const left = new ThreeGroup();
  const right = new ThreeGroup();
  body.name = 'Rpg3DArmorBodyModel';
  left.name = 'Rpg3DArmorLeftArmModel';
  right.name = 'Rpg3DArmorRightArmModel';
  const segments = { body, left, right };
  const counts = { body: 0, left: 0, right: 0 };
  const pieceGroups = [];
  const applySegmentFitScale = () => {
    [body, left, right, ...pieceGroups.map((entry) => entry.object)]
      .filter(Boolean)
      .forEach((group) => group.scale.copy(fitScale));
  };
  if (meshes.length === 1) {
    if (!item.armorCanvasCutEnabled) return null;
    const splitCounts = splitSingleArmorMeshIntoSegments(meshes[0], equipment, item, referenceScale, segments);
    if (!splitCounts) return null;
    applySegmentFitScale();
    return { body, left, right, pieces: pieceGroups, counts: splitCounts, referenceScale: splitCounts.referenceScale || referenceScale };
  }
  const assignments = getArmorSegmentAssignments(item);
  const assignmentByPath = new Map(assignments.map((assignment) => [assignment.path, assignment]));
  const customPiecesById = new Map(getArmorCustomPieces(item).map((piece) => [piece.id, piece]));
  const meshEntries = meshes.map((mesh) => ({
    mesh,
    nodePath: getRigNodePath(mesh, equipment),
  }));
  const pieceGroupById = new Map();
  const getPieceGroup = (piece) => {
    if (pieceGroupById.has(piece.id)) return pieceGroupById.get(piece.id);
    const group = new ThreeGroup();
    group.name = `Rpg3DArmorPieceModel_${piece.name || piece.id}`;
    group.userData.rpg3dArmorPieceId = piece.id;
    group.userData.rpg3dArmorPieceName = piece.name || '';
    group.userData.rpg3dArmorPieceRigPointId = piece.rigPointId || '';
    const entry = { piece, object: group };
    pieceGroupById.set(piece.id, entry);
    pieceGroups.push(entry);
    return entry;
  };
  meshEntries.forEach(({ mesh, nodePath }) => {
    const assignment = assignmentByPath.get(nodePath);
    const assignmentSegment = normalizeStoredArmorSegment(assignment?.segment);
    const piece = assignment?.pieceId
      ? (customPiecesById.get(assignment.pieceId) || {
        id: assignment.pieceId,
        name: assignment.pieceName || assignment.name || assignment.pieceId,
        segment: assignmentSegment,
        rigPointId: normalizeArmorPieceRigPointId(assignment.rigPointId, assignmentSegment),
      })
      : null;
    if (piece?.id) {
      const pieceEntry = getPieceGroup(piece);
      pieceEntry.object.attach(mesh);
      return;
    }
    const segment = assignment
      ? normalizeArmorSegment(assignmentSegment)
      : classifyArmorMeshSegment(mesh, equipment, item, referenceScale);
    segments[segment].attach(mesh);
    counts[segment] += 1;
  });
  if (!pieceGroups.length && !counts.left && !counts.right) return null;
  applySegmentFitScale();
  return { body, left, right, pieces: pieceGroups, counts, referenceScale };
};

const clonePreparedEquipmentModel = (modelTemplate = null) => {
  if (!modelTemplate) return null;
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
  return equipment;
};

const attachArmorSegment = (actorModel, segmentObject, item = {}, role = 'armor', socket = null, manualGrip = null) => {
  if (!segmentObject?.children?.length || !socket || !manualGrip) return false;
  return Boolean(attachPreparedEquipmentToSocket(socket, segmentObject, item, role, {
    fit: false,
    manualGrip,
  }));
};

const attachArmorPiece = (actorModel, pieceEntry = null, item = {}, actor = {}) => {
  const pieceObject = pieceEntry?.object;
  const piece = pieceEntry?.piece;
  if (!pieceObject?.children?.length || !piece?.id) return false;
  const socket = findArmorPieceSocket(actorModel, item, piece, actor);
  if (!socket) return false;
  return Boolean(attachPreparedEquipmentToSocket(
    socket,
    pieceObject,
    item,
    `armor-piece-${piece.id}`,
    {
      fit: false,
      manualGrip: getManualArmorPieceGrip(pieceObject, piece),
    },
  ));
};

const addSegmentedArmorToActorModel = (actorModel, armorTemplate, armorItem = {}, actor = {}) => {
  const equipment = clonePreparedEquipmentModel(armorTemplate);
  const segments = createSegmentedArmorEquipment(equipment, armorItem);
  if (!segments) return false;
  const attachmentItem = segments.referenceScale
    ? { ...armorItem, armorGripReferenceScale: segments.referenceScale }
    : armorItem;
  const scale = Math.max(0.001, Number(attachmentItem.weaponModelScale) || 1);
  let attached = false;
  (segments.pieces || []).forEach((pieceEntry) => {
    attached = attachArmorPiece(actorModel, pieceEntry, attachmentItem, actor) || attached;
  });
  const bodySocket = findArmorSocket(actorModel, attachmentItem, actor) || createFallbackEquipmentSocket(actorModel, 'armor');
  attached = attachArmorSegment(
    actorModel,
    segments.body,
    attachmentItem,
    'armor',
    bodySocket,
    getManualArmorGrip(attachmentItem, scale, 'body'),
  ) || attached;
  const leftSocket = findArmorArmSocket(actorModel, attachmentItem, 'left', actor);
  attached = attachArmorSegment(
    actorModel,
    segments.left,
    attachmentItem,
    'armor-left-arm',
    leftSocket,
    getManualArmorArmGrip(attachmentItem, scale, 'left'),
  ) || attached;
  const rightSocket = findArmorArmSocket(actorModel, attachmentItem, 'right', actor);
  attached = attachArmorSegment(
    actorModel,
    segments.right,
    attachmentItem,
    'armor-right-arm',
    rightSocket,
    getManualArmorArmGrip(attachmentItem, scale, 'right'),
  ) || attached;
  return attached;
};

const addEquippedArmorToActorModel = (actorModel, armorTemplate, armorItem = {}, actor = {}) => (
  addSegmentedArmorToActorModel(actorModel, armorTemplate, armorItem, actor)
  || addEquippedModelToActorSocket(
    actorModel,
    armorTemplate,
    armorItem,
    (root) => findArmorSocket(root, armorItem, actor),
    'armor',
  )
);

const ACTOR_EQUIPMENT_ROLES = ['weapon', 'shield', 'armor', 'helmet', 'leggings'];

const getEquippedEquipmentItemForRole = (actor = {}, role = 'weapon') => {
  if (role === 'shield') return getEquippedShieldItem(actor);
  if (role === 'armor') return getEquippedArmorItem(actor);
  if (role === 'helmet') return getEquippedHelmetItem(actor);
  if (role === 'leggings') return getEquippedLeggingsItem(actor);
  return getEquippedWeaponItem(actor);
};

const getActorEquipmentRoleSignature = (actor = {}, role = 'weapon') => (
  getEquipmentItemModelSignature(getEquippedEquipmentItemForRole(actor, role))
);

const getActorEquipmentRoleSignatures = (actor = {}) => (
  ACTOR_EQUIPMENT_ROLES.reduce((signatures, role) => ({
    ...signatures,
    [role]: getActorEquipmentRoleSignature(actor, role),
  }), {})
);

const isEquipmentRoleMatch = (equipmentRole = '', targetRole = '') => (
  targetRole === 'armor'
    ? String(equipmentRole).startsWith('armor')
    : equipmentRole === targetRole
);

const removeActorEquipmentAttachments = (actorModel, role = '') => {
  if (!actorModel?.traverse) return false;
  const attachments = [];
  const visit = (object, insideAttachment = false) => {
    const isAttachment = object !== actorModel && Boolean(object?.userData?.rpg3dEquipmentRole);
    const roleMatches = !role || isEquipmentRoleMatch(object?.userData?.rpg3dEquipmentRole, role);
    if (isAttachment && !insideAttachment && roleMatches) {
      attachments.push(object);
      return;
    }
    object?.children?.forEach((child) => visit(child, insideAttachment || isAttachment));
  };
  visit(actorModel);
  attachments.forEach((attachment) => removeGroupChild(attachment.parent, attachment));

  const fallbackSockets = [];
  actorModel.traverse((object) => {
    if (object === actorModel || !object?.userData?.rpg3dFallbackEquipmentSocket) return;
    if (role && !isEquipmentRoleMatch(object.userData.rpg3dFallbackEquipmentSocket, role)) return;
    if (object.children?.length) return;
    fallbackSockets.push(object);
  });
  fallbackSockets.forEach((socket) => removeGroupChild(socket.parent, socket));
  return Boolean(attachments.length || fallbackSockets.length);
};

const getPendingEquipmentSignature = (signature = '') => (signature ? `${signature}|pending` : signature);

const addEquipmentRoleToActorModel = (actorModel, role = 'weapon', template = null, item = {}, actor = {}) => {
  if (role === 'shield') return addEquippedShieldToActorModel(actorModel, template, item, actor);
  if (role === 'armor') return addEquippedArmorToActorModel(actorModel, template, item, actor);
  if (role === 'helmet') return addEquippedHelmetToActorModel(actorModel, template, item, actor);
  if (role === 'leggings') return addEquippedLeggingsToActorModel(actorModel, template, item, actor);
  return addEquippedWeaponToActorModel(actorModel, template, item, actor);
};

const findActorModelRoot = (actorRoot = null) => (
  actorRoot?.children?.find((child) => child.userData?.rpg3dActorModelRoot)
  || actorRoot?.children?.find((child) => child.type === 'Group' && child.traverse)
  || null
);

const createInitialActorEquipmentSignatures = (actor = {}, attachedSignatures = {}) => {
  const signatures = getActorEquipmentRoleSignatures(actor);
  return ACTOR_EQUIPMENT_ROLES.reduce((next, role) => {
    const item = getEquippedEquipmentItemForRole(actor, role);
    if (!getWeaponModelSource(item) || attachedSignatures[role] === signatures[role]) {
      next[role] = signatures[role];
    } else {
      next[role] = getPendingEquipmentSignature(signatures[role]);
    }
    return next;
  }, {});
};

const syncActorEquipmentRole = (actorRoot, actorModel, actor = {}, role = 'weapon', getModel = () => null) => {
  if (!actorRoot || !actorModel) return false;
  const signatures = actorRoot.userData.rpg3dActorEquipmentSignatures || {};
  const nextSignature = getActorEquipmentRoleSignature(actor, role);
  if (signatures[role] === nextSignature) return false;

  let didChange = removeActorEquipmentAttachments(actorModel, role);
  const item = getEquippedEquipmentItemForRole(actor, role);
  const source = getWeaponModelSource(item);
  if (!source) {
    actorRoot.userData.rpg3dActorEquipmentSignatures = { ...signatures, [role]: nextSignature };
    return true;
  }

  const template = getModel?.(source, getWeaponModelPayload(item));
  if (!template) {
    actorRoot.userData.rpg3dActorEquipmentSignatures = {
      ...signatures,
      [role]: getPendingEquipmentSignature(nextSignature),
    };
    return true;
  }

  const attached = addEquipmentRoleToActorModel(actorModel, role, template, item, actor);
  didChange = attached || didChange;
  actorRoot.userData.rpg3dActorEquipmentSignatures = {
    ...signatures,
    [role]: attached ? nextSignature : getPendingEquipmentSignature(nextSignature),
  };
  return true;
};

const syncActorEquipmentAttachments = (actorRoot, actor = {}, getModel = () => null) => {
  if (!actorRoot || actorRoot.userData?.rpg3dActorRenderMode !== 'glb') return false;
  const actorModel = findActorModelRoot(actorRoot);
  if (!actorModel) return false;
  return ACTOR_EQUIPMENT_ROLES.reduce((didChange, role) => (
    syncActorEquipmentRole(actorRoot, actorModel, actor, role, getModel) || didChange
  ), false);
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
  getEquipmentModelSignature(actor),
  getCharacterRigSignature(actor.characterRigPoints),
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
  getCharacterRigSignature(actor.characterRigPoints),
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
  const pickupGroup = new ThreeGroup();
  pickupGroup.position.copy(position);
  const ring = new ThreeMesh(
    new ThreeTorusGeometry(PICKUP_RADIUS * WORLD_SCALE, 0.055, 10, 32),
    new ThreeMeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4, roughness: 0.36 }),
  );
  ring.castShadow = true;
  ring.receiveShadow = true;
  pickupGroup.add(ring);
  const core = new ThreeMesh(
    new ThreeSphereGeometry(PICKUP_RADIUS * WORLD_SCALE * 0.52, 12, 12),
    new ThreeMeshStandardMaterial({ color: '#ffffff', emissive: color, emissiveIntensity: 0.75 }),
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
  const actorGroup = new ThreeGroup();
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
  const equippedArmor = renderMode === 'glb' ? getEquippedArmorItem(actor) : null;
  const equippedArmorSource = getWeaponModelSource(equippedArmor);
  const armorTemplate = equippedArmorSource ? getModel?.(equippedArmorSource, getWeaponModelPayload(equippedArmor)) : null;
  const equippedHelmet = renderMode === 'glb' ? getEquippedHelmetItem(actor) : null;
  const equippedHelmetSource = getWeaponModelSource(equippedHelmet);
  const helmetTemplate = equippedHelmetSource ? getModel?.(equippedHelmetSource, getWeaponModelPayload(equippedHelmet)) : null;
  const equippedLeggings = renderMode === 'glb' ? getEquippedLeggingsItem(actor) : null;
  const equippedLeggingsSource = getWeaponModelSource(equippedLeggings);
  const leggingsTemplate = equippedLeggingsSource ? getModel?.(equippedLeggingsSource, getWeaponModelPayload(equippedLeggings)) : null;
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

  let actorEquipmentSignatures = {};

  const finalizeActorGroup = (axisScaleApplied = false) => {
    actorGroup.userData.rpg3dActorType = type;
    actorGroup.userData.rpg3dActorRadius = radius;
    actorGroup.userData.rpg3dActorRenderMode = renderMode;
    actorGroup.userData.rpg3dActorAxisScaleApplied = Boolean(axisScaleApplied);
    actorGroup.userData.rpg3dActorEquipmentSignatures = createInitialActorEquipmentSignatures(actor, actorEquipmentSignatures);
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
    const material = new ThreeMeshStandardMaterial({
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
    const material = new ThreeMeshBasicMaterial({
      map: texture,
      color: '#ffffff',
      transparent: true,
      opacity,
      alphaTest: 0.06,
      side: ThreeDoubleSide,
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    const panel = new ThreeMesh(
      new ThreePlaneGeometry(width, panelHeight),
      material,
    );
    panel.position.set(0, y, z);
    panel.castShadow = true;
    panel.receiveShadow = true;
    panel.material.shadowSide = ThreeDoubleSide;
    actorGroup.add(panel);
  };

  const addImageSprite = (width, spriteHeight, y, z = 0) => {
    if (!texture || renderMode === 'sprite') return;
    const material = new ThreeSpriteMaterial({
      map: texture,
      color: '#ffffff',
      transparent: true,
      opacity: 0.98,
      alphaTest: 0.05,
      depthTest: false,
      depthWrite: false,
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    const sprite = new ThreeSprite(material);
    sprite.scale.set(width, spriteHeight, 1);
    sprite.position.set(0, y, z);
    sprite.renderOrder = 12;
    actorGroup.add(sprite);
    const shadowCaster = createImageShadowCasterPlane(texture, width, spriteHeight, y, z);
    if (shadowCaster) actorGroup.add(shadowCaster);
  };

  const addFallbackActorBody = (color = skinnedBodyColor) => {
    const fallback = new ThreeMesh(
      new ThreeCapsuleGeometry(radius3d * 0.88 * modelScale, height * 0.58, 6, 12),
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
            armorTemplate,
            armorItem: equippedArmor,
            helmetTemplate,
            helmetItem: equippedHelmet,
            leggingsTemplate,
            leggingsItem: equippedLeggings,
          },
        );
        actorAxisScaleApplied = Boolean(animation?.axisScaleApplied);
        actorEquipmentSignatures = animation?.equipmentSignatures || {};
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
    const material = new ThreeSpriteMaterial({
      map: texture,
      color: '#ffffff',
      transparent: true,
      alphaTest: 0.08,
    });
    applyMaterialBrightnessFromBase(material, actorBrightness, { actorManaged: true });
    const sprite = new ThreeSprite(material);
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
    const bodyGeometry = new ThreeBoxGeometry(radius3d * 1.7 * modelScale, height * 0.62, radius3d * 1.15 * modelScale);
    const body = new ThreeMesh(bodyGeometry, actorMaterial(skinnedBodyColor, { roughness: 0.5, metalness: 0.12, skin: true }));
    body.position.y = height * 0.42;
    body.castShadow = true;
    body.receiveShadow = true;
    actorGroup.add(body);
    addTexturePanel(radius3d * 1.58 * modelScale, height * 0.5, height * 0.42, radius3d * 0.59 * modelScale + 0.012);
    addImageSprite(radius3d * 2.45 * modelScale, height * 0.82, height * 0.55);

    const head = new ThreeMesh(
      new ThreeBoxGeometry(radius3d * 1.15 * modelScale, radius3d * 1.05 * modelScale, radius3d * 1.05 * modelScale),
      actorMaterial('#f0c9a5', { roughness: 0.64, emissiveIntensity: 0.04 }),
    );
    head.position.y = height * 0.82;
    head.castShadow = true;
    actorGroup.add(head);

    const shoulderGeometry = new ThreeBoxGeometry(radius3d * 2.1 * modelScale, radius3d * 0.3, radius3d * 0.7 * modelScale);
    const shoulders = new ThreeMesh(shoulderGeometry, actorMaterial(preset.weapon, { roughness: 0.4, metalness: 0.18 }));
    shoulders.position.y = height * 0.61;
    shoulders.castShadow = true;
    actorGroup.add(shoulders);
  } else if (renderMode === 'boss') {
    const core = new ThreeMesh(
      new ThreeSphereGeometry(radius3d * 1.42 * modelScale, 18, 14),
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
      const horn = new ThreeMesh(new ThreeConeGeometry(radius3d * 0.32 * modelScale, radius3d * 1.1 * modelScale, 8), hornMaterial);
      horn.position.set(side * radius3d * 0.9 * modelScale, height * 0.98, radius3d * 0.1);
      horn.rotation.z = -side * 0.52;
      horn.castShadow = true;
      actorGroup.add(horn);
    });

    [-1, 1].forEach((side) => {
      const arm = new ThreeMesh(
        new ThreeCapsuleGeometry(radius3d * 0.3 * modelScale, radius3d * 1.25 * modelScale, 5, 10),
        actorMaterial(preset.accent, { roughness: 0.55, emissiveIntensity: 0.2 }),
      );
      arm.position.set(side * radius3d * 1.42 * modelScale, height * 0.48, radius3d * 0.02);
      arm.rotation.z = side * 0.36;
      arm.castShadow = true;
      actorGroup.add(arm);
    });
  } else {
    const body = new ThreeMesh(
      new ThreeCapsuleGeometry(radius3d * modelScale, Math.max(0.2, height - radius3d * 2 * modelScale), 6, 14),
      actorMaterial(skinnedBodyColor, { metalness: type === 'enemy' ? 0.08 : 0.03, skin: true }),
    );
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    actorGroup.add(body);
    addTexturePanel(radius3d * 1.85 * modelScale, height * 0.68, height * 0.48, radius3d * 0.98 * modelScale + 0.012);
    addImageSprite(radius3d * 2.45 * modelScale, height * 0.94, height * 0.58);

    const head = new ThreeMesh(
      new ThreeSphereGeometry(radius3d * 0.74 * modelScale, 16, 12),
      actorMaterial('#f0c9a5', { roughness: 0.68, emissive: '#000000', emissiveIntensity: 0 }),
    );
    head.position.set(radius3d * 0.32 * modelScale, height * 0.9, radius3d * 0.1);
    head.castShadow = true;
    actorGroup.add(head);
  }

  const weapon = new ThreeMesh(
    new ThreeBoxGeometry(radius3d * 0.36 * modelScale, radius3d * 0.3 * modelScale, radius3d * 2.55 * modelScale),
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
  const mesh = new ThreeMesh(
    new ThreeSphereGeometry(0.08, 8, 5),
    new ThreeMeshStandardMaterial({
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
  const mesh = new ThreeMesh(
    new ThreeSphereGeometry(0.045 + alpha * 0.035, 6, 4),
    new ThreeMeshBasicMaterial({ color: particle.color, transparent: true, opacity: alpha }),
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
      update: (root) => syncActorEquipmentAttachments(root, hero, getModel),
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
      update: (root) => syncActorEquipmentAttachments(root, enemy, getModel),
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
    didChange = Boolean(descriptor.update?.(root)) || didChange;
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
  updateFingerTipsWeaponSockets(group);
};

export {
  CHARACTER_PRESETS,
  WEAPON_SOCKET_NAME_KEYS,
  LEFT_WEAPON_SOCKET_NAME_KEYS,
  SHIELD_SOCKET_NAME_KEYS,
  RIGHT_SHIELD_SOCKET_NAME_KEYS,
  WEAPON_GRIP_NAME_KEYS,
  SHIELD_GRIP_NAME_KEYS,
  ARMOR_GRIP_NAME_KEYS,
  FINGER_NAME_KEYS,
  normalizeRigObjectName,
  hasRightRigMarker,
  hasLeftRigMarker,
  isFingerRigName,
  findFirstRigObject,
  isRightHandRigName,
  isLeftHandRigName,
  isLeftForearmRigName,
  isRightForearmRigName,
  isLeftUpperArmRigName,
  isRightUpperArmRigName,
  isLeftShoulderRigName,
  isRightShoulderRigName,
  isLowerBellyRigName,
  findRightHandFromFingerBones,
  findLeftHandFromFingerBones,
  findLeftForearmFromFingerBones,
  findRightForearmFromFingerBones,
  findRightHandWeaponSocket,
  findLeftHandWeaponSocket,
  findWeaponSocketForHand,
  findLeftForearmShieldSocket,
  findRightForearmShieldSocket,
  findShieldSocketForArm,
  findHeadBone,
  findHelmetSocket,
  findShoulderBoneForArm,
  findLowerBellyBone,
  findArmorSocket,
  findArmorArmSocket,
  findLeggingsSocket,
  findEquipmentGripSocket,
  getFingerTipBonesForHand,
  getFingerBasePhalanxBonesForHand,
  updateFingerTipsWeaponSockets,
  updateShieldArmLineSockets,
  updateArmorBodySockets,
  updateArmorArmLineSockets,
  getShieldGripArm,
  getEquippedWeaponItem,
  getEquippedShieldItem,
  getEquippedArmorItem,
  getEquippedHelmetItem,
  getEquippedLeggingsItem,
  classifyArmorPaintSegment,
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
  attachPreparedEquipmentToSocket,
  createFallbackEquipmentSocket,
  addEquippedModelToActorSocket,
  addEquippedWeaponToActorModel,
  addEquippedShieldToActorModel,
  addEquippedArmorToActorModel,
  addEquippedHelmetToActorModel,
  addEquippedLeggingsToActorModel,
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
