import {
  Box3 as ThreeBox3,
  Euler as ThreeEuler,
  Group as ThreeGroup,
  MathUtils as ThreeMathUtils,
  Matrix4 as ThreeMatrix4,
  Plane as ThreePlane,
  Quaternion as ThreeQuaternion,
  Vector3 as ThreeVector3,
} from 'three';

import { clamp } from '../../../shared/utils/rpg3dDomain.js';
import {
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
  CHARACTER_RIG_CORE_ARMOR_GRIP_POINT_IDS,
  getCharacterRigPointDefinition,
  getEnabledCharacterRigPointById,
} from '../../../shared/utils/rpg3dCharacterRig.js';
import {
  getCharacterRigAutoAnchorMap,
  getCharacterRigAutoWorldPosition,
  getCharacterRigBoundsWorldPoint,
} from '../../../shared/utils/rpg3dCharacterRigAutoPlacement.js';
import {
  getImageSignature,
  getModelResourcesSignature,
} from './rpg3dRuntimeModels.js';
import { degreesToRadians } from './rpg3dSceneShared.js';

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

export {
  CHARACTER_PRESETS,
  WEAPON_SOCKET_NAME_KEYS,
  LEFT_WEAPON_SOCKET_NAME_KEYS,
  SHIELD_SOCKET_NAME_KEYS,
  RIGHT_SHIELD_SOCKET_NAME_KEYS,
  HELMET_SOCKET_NAME_KEYS,
  WEAPON_GRIP_NAME_KEYS,
  SHIELD_GRIP_NAME_KEYS,
  ARMOR_GRIP_NAME_KEYS,
  HELMET_GRIP_NAME_KEYS,
  ARMOR_GRIP_POINTS,
  HELMET_MOUTH_GRIP_POINT,
  LEGGINGS_GRIP_POINT_IDS,
  LEGGINGS_GRIP_POINT_SET,
  LEGGINGS_GRIP_POINTS,
  ARMOR_BODY_POINT_SUFFIXES,
  ARMOR_LEFT_ARM_POINT_SUFFIXES,
  ARMOR_RIGHT_ARM_POINT_SUFFIXES,
  CORE_ARMOR_GRIP_SUFFIXES,
  ARMOR_ARM_SEGMENT_NAME_KEYS,
  ARMOR_SEGMENT_VALUES,
  ARMOR_RIG_POINT_IDS,
  ARMOR_SURFACE_CLEARANCE_SCALE,
  ARMOR_SURFACE_RENDER_ORDER,
  ARMOR_SURFACE_POLYGON_OFFSET_FACTOR,
  ARMOR_SURFACE_POLYGON_OFFSET_UNITS,
  getDefaultArmorPieceRigPointId,
  normalizeArmorPieceRigPointId,
  FINGER_NAME_KEYS,
  PALM_SOCKET_FINGER_ROOT_FACTOR,
  FINGER_BASE_WEAPON_SOCKET_NORMAL_OFFSET,
  normalizeRigObjectName,
  getRigNodePath,
  normalizeArmorSegment,
  normalizeStoredArmorSegment,
  getArmorSegmentAssignments,
  getArmorCustomPieces,
  getArmorCustomPieceById,
  normalizeArmorCutContourPoint,
  normalizeArmorPaintSurfaceNormal,
  normalizeArmorPaintSectionPlane,
  getArmorPaintSectionPlane,
  isPointOnArmorPaintVisibleSide,
  getArmorCutContours,
  getArmorPaintDepthTolerance,
  getArmorPaintPlaneTolerance,
  getArmorCutPaintStrokes,
  isPointInsideArmorContour,
  isPointOnArmorPaintSurface,
  getArmorPaintSurfaceNormal,
  isPointInsideArmorPaintStamp,
  getInterpolatedArmorPaintNormal,
  isPointInsidePaintSegment,
  getArmorPaintStrokeBounds,
  isPointInsideArmorPaintBounds,
  prepareArmorPaintStrokes,
  classifyArmorPaintSegment,
  classifyArmorContourSegment,
  hasRightRigMarker,
  hasLeftRigMarker,
  isFingerRigName,
  findFirstRigObject,
  isRightHandRigName,
  isLeftHandRigName,
  isLeftForearmRigName,
  isRightForearmRigName,
  isUpperArmRigName,
  isLeftUpperArmRigName,
  isRightUpperArmRigName,
  isShoulderRigName,
  isLeftShoulderRigName,
  isRightShoulderRigName,
  isLowerBellyRigName,
  isHeadRigName,
  isNeckRigName,
  isUpperLegRigName,
  isLowerLegRigName,
  isFootRigName,
  findRightHandFromFingerBones,
  findLeftHandFromFingerBones,
  findLeftForearmFromFingerBones,
  findRightForearmFromFingerBones,
  getFingerRootBonesForHand,
  getFingerPalmOffset,
  getFingerFamilyRank,
  getFingerSegmentIndex,
  getFingerBoneDepthFromRoot,
  getFingerTipBoneFromRoot,
  getFingerBasePhalanxBoneFromRoot,
  getFingerTipBonesForHand,
  getFingerBasePhalanxBonesForHand,
  getFingerGripEntriesForHand,
  getLocalBonePosition,
  getAverageVector,
  getProjectedPerpendicularAxis,
  getFingerGripFrame,
  getArmorFramePoint,
  getArmorPairCenter,
  getArmorGripFrame,
  updateFingerTipsWeaponSocket,
  updateFingerTipsWeaponSockets,
  createFingerWeaponSocket,
  createPalmWeaponSocket,
  getCharacterRigLocalPoint,
  createCharacterRigPointSocket,
  createCharacterRigLineSocket,
  findRightHandWeaponSocket,
  findLeftHandWeaponSocket,
  getWeaponGripHand,
  getShieldGripArm,
  findWeaponSocketForHand,
  getShieldGripPointEnabled,
  getEquipmentModelRotationValue,
  getEquipmentModelBaseQuaternion,
  hasEquipmentModelBaseRotation,
  findHandBoneForArm,
  findForearmBoneForArm,
  findShoulderBoneForArm,
  findUpperLegBoneForSide,
  findLowerLegBoneForSide,
  findFootBoneForSide,
  findLowerBellyBone,
  getHeadBoneRank,
  findHeadBone,
  isHelmetMouthGripEnabled,
  findHelmetSocket,
  getFingerRankForRigPoint,
  findFingerBoneForRigPoint,
  findArmorRigPointBone,
  getLocalPointFromWorld,
  updateShieldArmLineSocket,
  updateShieldArmLineSockets,
  createShieldArmLineSocket,
  findLeftForearmShieldSocket,
  findRightForearmShieldSocket,
  findShieldSocketForArm,
  resolveArmorGripPoint,
  getArmorGripPointEnabled,
  getEnabledArmorGripPoints,
  getEnabledLeggingsGripPoints,
  getEnabledArmorBodyGripPoints,
  getArmorGripTargetBone,
  getFallbackArmorGripLocalPoint,
  updateArmorBodySocket,
  updateArmorBodySockets,
  updateArmorArmLineSocket,
  updateArmorArmLineSockets,
  createArmorBodySocket,
  createArmorArmLineSocket,
  findArmorSocket,
  findLeggingsSocket,
  findArmorArmSocket,
  findArmorPieceSocket,
  getEquipmentGripNameKeys,
  findEquipmentGripSocket,
  getEquippedWeaponItem,
  getEquippedShieldItem,
  getEquippedArmorItem,
  getEquippedHelmetItem,
  getEquippedLeggingsItem,
  getWeaponModelSource,
  getWeaponModelPayload,
  getEquipmentItemModelSignature,
  getWeaponModelSignature,
  getEquipmentModelSignature,
  getActorModelBodyBounds,
};
