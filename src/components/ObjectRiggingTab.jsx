import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box3 as ThreeBox3,
  MathUtils as ThreeMathUtils,
  Vector3 as ThreeVector3,
} from 'three';
import {
  Activity,
  Brush,
  Cuboid,
  Fingerprint,
  Grid2X2,
  Hand,
  Plus,
  Trash2,
  Undo2,
  Save,
  Scissors,
  UserRound,
  ZoomIn,
} from 'lucide-react';
import {
  getDecorModelDimensions,
} from '../utils/rpg3dModelImportCore.js';
import {
  disposeThreeObject,
} from '../utils/rpg3dModelImport.js';
import {
  loadThreeModelFromSource,
} from '../utils/threeGltfUtils';
import { getThreeModelSource } from '../utils/threeModelUtils.js';
import {
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
} from '../utils/rpg3dCharacterRig.js';
import { lazyWithRetry } from '../utils/lazyImportRetry';

const Decor3DPreview = lazyWithRetry(() => import('./rpg3d/Decor3DPreview.jsx'));

const ARMOR_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Plastron', shortLabel: 'P' },
  { id: 'left-arm', label: 'Bras gauche', shortLabel: 'G' },
  { id: 'right-arm', label: 'Bras droit', shortLabel: 'D' },
];
const LEGGINGS_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Jambieres', shortLabel: 'J' },
  { id: 'left-arm', label: 'Jambe gauche', shortLabel: 'G' },
  { id: 'right-arm', label: 'Jambe droite', shortLabel: 'D' },
];
const HELMET_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Casque', shortLabel: 'C' },
];
const WEAPON_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Arme', shortLabel: 'A' },
];
const SHIELD_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Bouclier', shortLabel: 'B' },
];
const JEWELRY_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Bijou', shortLabel: 'B' },
];
const MISC_SEGMENT_OPTIONS = [
  { id: 'body', label: 'Objet', shortLabel: 'O' },
];
const ARMOR_CONTOUR_POINT_LIMIT = 80;
const ARMOR_PAINT_POINT_LIMIT = 240;
const ARMOR_PAINT_RADIUS = 0.14;
const ARMOR_PAINT_RADIUS_MIN = 0.04;
const ARMOR_PAINT_RADIUS_MAX = 0.5;
const ARMOR_PAINT_SIZE_MIN = Math.round(ARMOR_PAINT_RADIUS_MIN * 100);
const ARMOR_PAINT_SIZE_MAX = Math.round(ARMOR_PAINT_RADIUS_MAX * 100);
const ARMOR_PIECE_NAME_MAX_LENGTH = 48;
const ARMOR_PIECE_ID_MAX_LENGTH = 80;
const EQUIPMENT_GRIP_POSITION_MIN = -2;
const EQUIPMENT_GRIP_POSITION_MAX = 2;

const WEAPON_GRIP_HANDS = [
  { id: 'right', label: 'Main droite', suffix: 'Right' },
  { id: 'left', label: 'Main gauche', suffix: 'Left' },
];
const SHIELD_GRIP_POINTS = [
  { id: 'hand', label: 'Poignet / main', suffix: 'Hand', defaultY: -0.35 },
  { id: 'elbow', label: 'Coude', suffix: 'Elbow', defaultY: 0.35 },
];

const ARMOR_GRIP_MARKERS = CHARACTER_RIG_ARMOR_GRIP_POINTS.filter((point) => point.core);
const HELMET_GRIP_MARKERS = CHARACTER_RIG_ARMOR_GRIP_POINTS.filter((point) => point.id === 'mouth');
const LEGGINGS_GRIP_POINT_IDS = [
  'left-groin-fold',
  'right-groin-fold',
  'left-knee',
  'right-knee',
  'left-foot',
  'right-foot',
];
const LEGGINGS_GRIP_MARKERS = LEGGINGS_GRIP_POINT_IDS
  .map((id) => CHARACTER_RIG_ARMOR_GRIP_POINTS.find((point) => point.id === id))
  .filter(Boolean);
const ALL_ARMOR_GRIP_MARKERS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const ARMOR_RIG_POINT_OPTIONS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const ARMOR_RIG_POINT_IDS = new Set(ARMOR_RIG_POINT_OPTIONS.map((point) => point.rigPointId || point.id));

const buildArmorGripDefaults = (markers = []) => Object.fromEntries(markers.flatMap((marker) => [
  [`armorGrip${marker.suffix}Enabled`, false],
  [`armorGrip${marker.suffix}X`, marker.defaultX],
  [`armorGrip${marker.suffix}Y`, marker.defaultY],
  [`armorGrip${marker.suffix}Z`, marker.defaultZ],
]));

const ARMOR_GRIP_DEFAULTS = buildArmorGripDefaults(ARMOR_GRIP_MARKERS);
const LEGGINGS_GRIP_DEFAULTS = buildArmorGripDefaults(LEGGINGS_GRIP_MARKERS);
const HELMET_GRIP_DEFAULTS = buildArmorGripDefaults(HELMET_GRIP_MARKERS);

const makeRigProfile = ({
  id,
  segmentOptions,
  defaultGripMarkers,
  gripDefaults,
  defaultRigPointBySegment,
  skeletonButtonLabel,
  skeletonStatus,
  fallbackLabel,
  gripType = 'armor',
}) => ({
  id,
  segmentOptions,
  defaultGripMarkers,
  defaultGripMarkerIds: new Set(defaultGripMarkers.map((marker) => marker.id)),
  gripDefaults,
  defaultRigPointBySegment,
  skeletonButtonLabel,
  skeletonStatus,
  fallbackLabel,
  gripType,
});

const ARMOR_RIG_PROFILE = makeRigProfile({
  id: 'armor',
  segmentOptions: ARMOR_SEGMENT_OPTIONS,
  defaultGripMarkers: ARMOR_GRIP_MARKERS,
  gripDefaults: ARMOR_GRIP_DEFAULTS,
  defaultRigPointBySegment: {
    body: 'lower-belly',
    'left-arm': 'left-elbow',
    'right-arm': 'right-elbow',
  },
  skeletonButtonLabel: 'Squelette armure',
  skeletonStatus: 'Pastilles armure disponibles dans le cadre.',
  fallbackLabel: 'Plastron',
});

const WEAPON_RIG_PROFILE = makeRigProfile({
  id: 'weapon',
  segmentOptions: WEAPON_SEGMENT_OPTIONS,
  defaultGripMarkers: [],
  gripDefaults: {},
  defaultRigPointBySegment: {
    body: 'right-hand',
  },
  skeletonButtonLabel: 'Points arme',
  skeletonStatus: 'Pastilles arme disponibles dans le cadre.',
  fallbackLabel: 'Arme',
  gripType: 'weapon',
});

const SHIELD_RIG_PROFILE = makeRigProfile({
  id: 'shield',
  segmentOptions: SHIELD_SEGMENT_OPTIONS,
  defaultGripMarkers: [],
  gripDefaults: {},
  defaultRigPointBySegment: {
    body: 'left-elbow',
  },
  skeletonButtonLabel: 'Points bouclier',
  skeletonStatus: 'Pastilles bouclier disponibles dans le cadre.',
  fallbackLabel: 'Bouclier',
  gripType: 'shield',
});

const LEGGINGS_RIG_PROFILE = makeRigProfile({
  id: 'leggings',
  segmentOptions: LEGGINGS_SEGMENT_OPTIONS,
  defaultGripMarkers: LEGGINGS_GRIP_MARKERS,
  gripDefaults: LEGGINGS_GRIP_DEFAULTS,
  defaultRigPointBySegment: {
    body: 'lower-belly',
    'left-arm': 'left-knee',
    'right-arm': 'right-knee',
  },
  skeletonButtonLabel: 'Squelette jambieres',
  skeletonStatus: 'Pastilles jambieres disponibles dans le cadre.',
  fallbackLabel: 'Jambieres',
});

const HELMET_RIG_PROFILE = makeRigProfile({
  id: 'helmet',
  segmentOptions: HELMET_SEGMENT_OPTIONS,
  defaultGripMarkers: HELMET_GRIP_MARKERS,
  gripDefaults: HELMET_GRIP_DEFAULTS,
  defaultRigPointBySegment: {
    body: 'mouth',
  },
  skeletonButtonLabel: 'Squelette casque',
  skeletonStatus: 'Pastille casque disponible dans le cadre.',
  fallbackLabel: 'Casque',
});

const JEWELRY_RIG_PROFILE = makeRigProfile({
  id: 'jewelry',
  segmentOptions: JEWELRY_SEGMENT_OPTIONS,
  defaultGripMarkers: [],
  gripDefaults: {},
  defaultRigPointBySegment: {
    body: 'right-hand',
  },
  skeletonButtonLabel: 'Point bijou',
  skeletonStatus: 'Repere bijou actif.',
  fallbackLabel: 'Bijou',
  gripType: 'none',
});

const MISC_RIG_PROFILE = makeRigProfile({
  id: 'misc',
  segmentOptions: MISC_SEGMENT_OPTIONS,
  defaultGripMarkers: [],
  gripDefaults: {},
  defaultRigPointBySegment: {
    body: 'lower-belly',
  },
  skeletonButtonLabel: 'Point objet',
  skeletonStatus: 'Repere objet actif.',
  fallbackLabel: 'Objet',
  gripType: 'none',
});

const getRigProfile = (model = {}) => {
  if (model?.kind === 'inventory-weapon') return WEAPON_RIG_PROFILE;
  if (model?.kind === 'inventory-shield') return SHIELD_RIG_PROFILE;
  if (model?.kind === 'inventory-leggings') return LEGGINGS_RIG_PROFILE;
  if (model?.kind === 'inventory-helmet') return HELMET_RIG_PROFILE;
  if (model?.kind === 'inventory-armor') return ARMOR_RIG_PROFILE;
  if (model?.kind === 'inventory-jewelry') return JEWELRY_RIG_PROFILE;
  if (model?.kind === 'inventory-misc') return MISC_RIG_PROFILE;
  return MISC_RIG_PROFILE;
};

const normalizeRigObjectName = (name = '') => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const sanitizeArmorPieceId = (value = '') => (
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, ARMOR_PIECE_ID_MAX_LENGTH)
);

const normalizeArmorPieceName = (name = '', fallback = 'Morceau') => {
  const cleanName = String(name || '').replace(/\s+/g, ' ').trim().slice(0, ARMOR_PIECE_NAME_MAX_LENGTH);
  return cleanName || fallback;
};

const getUniqueArmorPieceId = (seed = 'piece', usedIds = new Set()) => {
  const base = sanitizeArmorPieceId(seed) || 'piece';
  let id = base;
  let index = 2;
  while (usedIds.has(id)) {
    id = `${base}-${index}`;
    index += 1;
  }
  usedIds.add(id);
  return id;
};

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

const getRiggingModelSourceSignature = (model = null) => {
  if (!model) return '';
  const resources = Array.isArray(model.modelResources) ? model.modelResources : [];
  return [
    model.id || '',
    model.modelUrl || '',
    model.modelData || '',
    model.modelName || '',
    model.modelFormat || '',
    model.modelFileSize || '',
    resources
      .map((resource) => `${resource.path || resource.name || ''}:${resource.data?.length || resource.url?.length || 0}`)
      .join(';'),
  ].join('|');
};

const getProfileSegmentOptions = (profile = ARMOR_RIG_PROFILE) => (
  Array.isArray(profile?.segmentOptions) && profile.segmentOptions.length
    ? profile.segmentOptions
    : ARMOR_SEGMENT_OPTIONS
);

const normalizeSegment = (value = '', profile = ARMOR_RIG_PROFILE) => (
  getProfileSegmentOptions(profile).some((option) => option.id === value) ? value : 'body'
);

const getDefaultArmorPieceRigPointId = (segment = 'body', profile = ARMOR_RIG_PROFILE) => {
  const normalizedSegment = normalizeSegment(segment, profile);
  return profile?.defaultRigPointBySegment?.[normalizedSegment]
    || profile?.defaultRigPointBySegment?.body
    || 'lower-belly';
};

const normalizeArmorPieceRigPointId = (value = '', segment = 'body', profile = ARMOR_RIG_PROFILE) => {
  const id = String(value || '').trim();
  return ARMOR_RIG_POINT_IDS.has(id) ? id : getDefaultArmorPieceRigPointId(segment, profile);
};

const normalizeAssignments = (assignments = [], profile = ARMOR_RIG_PROFILE) => (
  Array.isArray(assignments)
    ? assignments.map((entry) => {
      const pieceId = sanitizeArmorPieceId(entry?.pieceId);
      const pieceName = normalizeArmorPieceName(entry?.pieceName, '');
      const segment = normalizeSegment(entry?.segment, profile);
      return {
        path: String(entry?.path || '').slice(0, 260),
        name: String(entry?.name || '').slice(0, 120),
        segment,
        ...(pieceId ? { pieceId } : {}),
        ...(pieceName ? { pieceName } : {}),
        ...(pieceId ? { rigPointId: normalizeArmorPieceRigPointId(entry?.rigPointId, segment, profile) } : {}),
      };
    }).filter((entry) => entry.path)
    : []
);

const normalizeArmorCustomPieces = (pieces = [], profile = ARMOR_RIG_PROFILE) => {
  if (!Array.isArray(pieces)) return [];
  const usedIds = new Set();
  return pieces
    .map((piece, index) => ({
      id: getUniqueArmorPieceId(piece?.id || `piece-${index + 1}-${piece?.name || ''}`, usedIds),
      name: normalizeArmorPieceName(piece?.name, `Morceau ${index + 1}`),
      segment: normalizeSegment(piece?.segment, profile),
      rigPointId: normalizeArmorPieceRigPointId(piece?.rigPointId, piece?.segment, profile),
    }))
    .filter((piece) => piece.id);
};

const getArmorCustomPieces = (model = {}, profile = ARMOR_RIG_PROFILE) => {
  const pieces = normalizeArmorCustomPieces(model.armorCustomPieces, profile);
  const pieceIds = new Set(pieces.map((piece) => piece.id));
  normalizeAssignments(model.armorSegmentAssignments, profile).forEach((assignment) => {
    if (!assignment.pieceId || pieceIds.has(assignment.pieceId)) return;
    pieceIds.add(assignment.pieceId);
    pieces.push({
      id: assignment.pieceId,
      name: normalizeArmorPieceName(assignment.pieceName || assignment.name, `Morceau ${pieces.length + 1}`),
      segment: normalizeSegment(assignment.segment, profile),
      rigPointId: normalizeArmorPieceRigPointId(assignment.rigPointId, assignment.segment, profile),
    });
  });
  return pieces;
};

const getSegmentLabel = (segmentId = 'body', profile = ARMOR_RIG_PROFILE) => (
  getProfileSegmentOptions(profile)
    .find((segment) => segment.id === normalizeSegment(segmentId, profile))?.label
    || profile?.fallbackLabel
    || 'Plastron'
);

const getRigPointLabel = (rigPointId = '') => (
  ARMOR_RIG_POINT_OPTIONS.find((point) => point.rigPointId === rigPointId || point.id === rigPointId)?.label || 'Bassin'
);

const normalizeContourPoint = (point = {}) => ({
  x: Math.round(ThreeMathUtils.clamp(Number(point.x) || 0, -2, 2) * 1000) / 1000,
  y: Math.round(ThreeMathUtils.clamp(Number(point.y) || 0, -2, 2) * 1000) / 1000,
  z: Math.round(ThreeMathUtils.clamp(Number(point.z) || 0, -2, 2) * 1000) / 1000,
  ...normalizePaintSurfaceNormal(point),
  ...normalizePaintSectionPlane(point),
});

const normalizePaintSurfaceNormal = (point = {}) => {
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

const normalizePaintSectionPlane = (point = {}) => {
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

const normalizeArmorPaintRadius = (value = ARMOR_PAINT_RADIUS) => (
  Math.round(ThreeMathUtils.clamp(
    Number(value) || ARMOR_PAINT_RADIUS,
    ARMOR_PAINT_RADIUS_MIN,
    ARMOR_PAINT_RADIUS_MAX,
  ) * 100) / 100
);

const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeSegment(entry?.segment),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, ARMOR_CONTOUR_POINT_LIMIT)
        .map(normalizeContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const getContourPoints = (contours = [], segmentId = 'body') => (
  normalizeArmorCutContours(contours)
    .find((entry) => entry.segment === normalizeSegment(segmentId))?.points || []
);

const patchContourEntries = (contours = [], segmentId = 'body', points = []) => {
  const segment = normalizeSegment(segmentId);
  const map = new Map(normalizeArmorCutContours(contours).map((entry) => [entry.segment, entry]));
  const nextPoints = points.slice(0, ARMOR_CONTOUR_POINT_LIMIT).map(normalizeContourPoint);
  if (nextPoints.length) map.set(segment, { segment, points: nextPoints });
  else map.delete(segment);
  return [...map.values()];
};

const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: normalizeSegment(entry?.segment),
      radius: normalizeArmorPaintRadius(entry?.radius),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, ARMOR_PAINT_POINT_LIMIT)
        .map(normalizeContourPoint),
    }))
    .filter((entry) => entry.points.length);
};

const getPaintStroke = (strokes = [], segmentId = 'body') => (
  normalizeArmorCutPaintStrokes(strokes)
    .find((entry) => entry.segment === normalizeSegment(segmentId))
);

const getPaintPoints = (strokes = [], segmentId = 'body') => getPaintStroke(strokes, segmentId)?.points || [];

const patchPaintEntries = (strokes = [], segmentId = 'body', points = [], radius = ARMOR_PAINT_RADIUS) => {
  const segment = normalizeSegment(segmentId);
  const map = new Map(normalizeArmorCutPaintStrokes(strokes).map((entry) => [entry.segment, entry]));
  const previous = map.get(segment);
  const nextPoints = points.slice(-ARMOR_PAINT_POINT_LIMIT).map(normalizeContourPoint);
  const nextRadius = normalizeArmorPaintRadius(radius ?? previous?.radius ?? ARMOR_PAINT_RADIUS);
  if (nextPoints.length) {
    map.set(segment, {
      segment,
      radius: nextRadius,
      points: nextPoints,
    });
  } else {
    map.delete(segment);
  }
  return [...map.values()];
};

const getAssignmentMap = (model = {}, profile = ARMOR_RIG_PROFILE) => new Map(
  normalizeAssignments(model.armorSegmentAssignments, profile).map((entry) => [entry.path, entry]),
);

const getArmorGripValue = (model = {}, suffix = '', axis = 'X', fallback = 0) => {
  const value = Number(model[`armorGrip${suffix}${axis}`]);
  return Number.isFinite(value) ? value : fallback;
};

const hasArmorGripNumber = (value) => Number.isFinite(Number(value));

const getArmorGripMarkers = (model = null, profile = ARMOR_RIG_PROFILE) => (
  model && profile.gripType === 'armor'
    ? (model.armorFullCharacterRigEnabled ? ALL_ARMOR_GRIP_MARKERS : profile.defaultGripMarkers).map((marker) => ({
      id: marker.id,
      label: marker.label,
      shortLabel: marker.shortLabel,
      group: marker.group,
      enabled: Boolean(model[`armorGrip${marker.suffix}Enabled`]),
      x: getArmorGripValue(model, marker.suffix, 'X', marker.defaultX),
      y: getArmorGripValue(model, marker.suffix, 'Y', marker.defaultY),
      z: getArmorGripValue(model, marker.suffix, 'Z', marker.defaultZ),
      defaultX: marker.defaultX,
      defaultY: marker.defaultY,
      defaultZ: marker.defaultZ,
    }))
    : []
);

const getGripNumberValue = (value, fallback = 0) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
};

const clampGripPositionValue = (value, fallback = 0) => {
  const fallbackNumber = getGripNumberValue(fallback, 0);
  return Math.round(ThreeMathUtils.clamp(
    getGripNumberValue(value, fallbackNumber),
    EQUIPMENT_GRIP_POSITION_MIN,
    EQUIPMENT_GRIP_POSITION_MAX,
  ) * 1000) / 1000;
};

const getWeaponGripMarkers = (model = null, profile = ARMOR_RIG_PROFILE) => (
  model && profile.gripType === 'weapon'
    ? WEAPON_GRIP_HANDS.map((hand) => ({
      hand: hand.id,
      label: hand.label,
      enabled: Boolean(model[`weaponGrip${hand.suffix}Enabled`]),
      x: getGripNumberValue(model[`weaponGrip${hand.suffix}X`]),
      y: getGripNumberValue(model[`weaponGrip${hand.suffix}Y`]),
      z: getGripNumberValue(model[`weaponGrip${hand.suffix}Z`]),
    }))
    : []
);

const getShieldGripMarkers = (model = null, profile = ARMOR_RIG_PROFILE) => (
  model && profile.gripType === 'shield'
    ? SHIELD_GRIP_POINTS.map((point) => ({
      id: point.id,
      label: point.label,
      enabled: Boolean(model[`shieldGrip${point.suffix}Enabled`]),
      x: getGripNumberValue(model[`shieldGrip${point.suffix}X`]),
      y: getGripNumberValue(model[`shieldGrip${point.suffix}Y`], point.defaultY),
      z: getGripNumberValue(model[`shieldGrip${point.suffix}Z`]),
    }))
    : []
);

const getModelReferenceScale = (model = {}) => {
  const dimensions = getDecorModelDimensions(model);
  return Math.max(
    1,
    Number(dimensions.x) || 0,
    Number(dimensions.y) || 0,
    Number(dimensions.z) || 0,
  );
};

const inferSegment = (mesh = {}, center = new ThreeVector3(), profile = ARMOR_RIG_PROFILE) => {
  const name = normalizeRigObjectName(mesh.name || mesh.path || '');
  if (profile?.id === 'leggings') {
    if (/(left|gauche|jambegh|jambegr|jambegauche|genougauche|piedgauche|bottegauche|greaveleft|leftleg|leftknee|leftfoot|leftboot)/.test(name)) return 'left-arm';
    if (/(right|droite|jambedroite|genoudroit|pieddroit|bottedroite|greaveright|rightleg|rightknee|rightfoot|rightboot)/.test(name)) return 'right-arm';
    if (/(leg|jambe|jambiere|jambieres|leggings|greave|greaves|knee|genou|foot|pied|boot|botte|shin|thigh|cuisse|tibia|mollet)/.test(name)) {
      return center.x < 0 ? 'left-arm' : 'right-arm';
    }
    if (Math.abs(center.x) > 0.18) return center.x < 0 ? 'left-arm' : 'right-arm';
    return 'body';
  }
  if (/(left|larm|lshoulder|gauche|brasgauche|epaulegauche|pauldrong)/.test(name)) return 'left-arm';
  if (/(right|rarm|rshoulder|droite|brasdroit|epauledroite|pauldrond)/.test(name)) return 'right-arm';
  if (/(pauldron|shoulder|bracer|brassard|upperarm|forearm|sleeve|manche|elbow|coude)/.test(name)) {
    return center.x < 0 ? 'left-arm' : 'right-arm';
  }
  if (Math.abs(center.x) > 0.42 && center.y > -0.25) return center.x < 0 ? 'left-arm' : 'right-arm';
  return 'body';
};

const extractMeshNodes = (object = null) => {
  if (!object?.traverse) return [];
  object.updateMatrixWorld(true);
  const nodes = [];
  object.traverse((child) => {
    if (child === object || (!child.isMesh && !child.isSkinnedMesh)) return;
    const box = new ThreeBox3().setFromObject(child);
    const size = box.getSize(new ThreeVector3());
    const center = object.worldToLocal(box.getCenter(new ThreeVector3()));
    const path = getRigNodePath(child, object);
    nodes.push({
      path,
      name: child.name || child.parent?.name || 'Morceau',
      center: { x: center.x, y: center.y, z: center.z },
      size: { x: size.x, y: size.y, z: size.z },
    });
  });
  return nodes.sort((a, b) => a.path.localeCompare(b.path));
};

const buildCustomPiecesFromMeshNodes = (nodes = [], profile = ARMOR_RIG_PROFILE) => {
  const usedIds = new Set();
  return nodes.map((node, index) => {
    const segment = normalizeSegment(inferSegment(node, node.center, profile), profile);
    return {
      id: getUniqueArmorPieceId(`piece-${index + 1}-${node.path || node.name || 'mesh'}`, usedIds),
      name: normalizeArmorPieceName(node.name, `Morceau ${index + 1}`),
      segment,
      rigPointId: getDefaultArmorPieceRigPointId(segment, profile),
    };
  });
};

const ensureDecorModels = (draft) => {
  if (!Array.isArray(draft.decorModels3d)) draft.decorModels3d = [];
  return draft.decorModels3d;
};

const ensureArmorRigDefaults = (model = {}, profile = ARMOR_RIG_PROFILE) => {
  model.armorGripReferenceScale = model.armorGripReferenceScale || getModelReferenceScale(model);
  Object.entries(profile.gripDefaults).forEach(([key, value]) => {
    if (model[key] === undefined || model[key] === null || model[key] === '') {
      model[key] = value;
    }
  });
};

const ensureArmorGripPoints = (model = {}, markers = ARMOR_GRIP_MARKERS) => {
  markers.forEach((marker) => {
    model[`armorGrip${marker.suffix}Enabled`] = true;
    ['X', 'Y', 'Z'].forEach((axis) => {
      const key = `armorGrip${marker.suffix}${axis}`;
      if (!hasArmorGripNumber(model[key])) model[key] = marker[`default${axis}`];
    });
  });
};

const ensureWeaponGripDefaults = (model = {}, enabled = false) => {
  model.weaponGripReferenceScale = model.weaponGripReferenceScale || getModelReferenceScale(model);
  model.weaponGripHand = model.weaponGripHand === 'left' ? 'left' : 'right';
  WEAPON_GRIP_HANDS.forEach((hand) => {
    model[`weaponGrip${hand.suffix}Enabled`] = enabled;
    ['X', 'Y', 'Z'].forEach((axis) => {
      const key = `weaponGrip${hand.suffix}${axis}`;
      if (!hasArmorGripNumber(model[key])) model[key] = axis === 'Y' ? -0.44 : 0;
    });
    if (!hasArmorGripNumber(model[`weaponGrip${hand.suffix}RotationZ`])) {
      model[`weaponGrip${hand.suffix}RotationZ`] = 180;
    }
  });
};

const ensureShieldGripDefaults = (model = {}, enabled = false) => {
  model.shieldGripReferenceScale = model.shieldGripReferenceScale || getModelReferenceScale(model);
  model.shieldGripArm = model.shieldGripArm === 'right' ? 'right' : 'left';
  SHIELD_GRIP_POINTS.forEach((point) => {
    model[`shieldGrip${point.suffix}Enabled`] = enabled;
    ['X', 'Y', 'Z'].forEach((axis) => {
      const key = `shieldGrip${point.suffix}${axis}`;
      const fallback = axis === 'Y' ? point.defaultY : 0;
      if (!hasArmorGripNumber(model[key])) model[key] = fallback;
    });
  });
};

export default function ObjectRiggingTab({
  project,
  patchProject,
  selectedModelId: controlledSelectedModelId,
  onSelectedModelIdChange,
  onSaveAssets,
  onTestOnCharacter,
  saveStatus = '',
  saveInProgress = false,
}) {
  const decorModels = useMemo(() => (
    (project.decorModels3d || []).filter((model) => getThreeModelSource(model))
  ), [project.decorModels3d]);
  const characterModels = useMemo(() => (
    (project.characterModels3d || []).filter((model) => getThreeModelSource(model))
  ), [project.characterModels3d]);
  const [localSelectedModelId, setLocalSelectedModelId] = useState(controlledSelectedModelId || decorModels[0]?.id || '');
  const selectedModelId = controlledSelectedModelId ?? localSelectedModelId;
  const [selectedCharacterId, setSelectedCharacterId] = useState(characterModels[0]?.id || '');
  const [meshNodes, setMeshNodes] = useState([]);
  const [loadStatus, setLoadStatus] = useState('');
  const [activeSegment, setActiveSegment] = useState('body');
  const [activePieceId, setActivePieceId] = useState('');
  const [canvasInteractionMode, setCanvasInteractionMode] = useState('cut');
  const [paintBrushRadii, setPaintBrushRadii] = useState({});
  const [paintDraftStrokes, setPaintDraftStrokes] = useState(null);
  const paintDraftStrokesRef = useRef(null);
  const [cameraZoomPercent, setCameraZoomPercent] = useState(100);
  const [gridVisible, setGridVisible] = useState(true);

  useEffect(() => {
    if (!decorModels.length) return;
    if (!decorModels.some((model) => model.id === selectedModelId)) {
      const nextId = decorModels[0].id;
      setLocalSelectedModelId(nextId);
      onSelectedModelIdChange?.(nextId);
    }
  }, [decorModels, onSelectedModelIdChange, selectedModelId]);

  useEffect(() => {
    if (!characterModels.length) return;
    if (!characterModels.some((model) => model.id === selectedCharacterId)) {
      setSelectedCharacterId(characterModels[0].id);
    }
  }, [characterModels, selectedCharacterId]);

  useEffect(() => {
    paintDraftStrokesRef.current = null;
    setPaintDraftStrokes(null);
  }, [selectedModelId]);

  const selectedModel = decorModels.find((model) => model.id === selectedModelId) || decorModels[0] || null;
  const selectedCharacter = characterModels.find((model) => model.id === selectedCharacterId) || characterModels[0] || null;
  const rigProfile = getRigProfile(selectedModel);
  const selectedModelSourceSignature = useMemo(
    () => getRiggingModelSourceSignature(selectedModel),
    [selectedModel],
  );
  const assignmentMap = useMemo(() => getAssignmentMap(selectedModel || {}, rigProfile), [rigProfile, selectedModel]);
  const customPieces = useMemo(() => getArmorCustomPieces(selectedModel || {}, rigProfile), [rigProfile, selectedModel]);
  const activePiece = useMemo(
    () => customPieces.find((piece) => piece.id === activePieceId) || null,
    [activePieceId, customPieces],
  );
  const pieceAssignmentCounts = useMemo(() => (
    normalizeAssignments(selectedModel?.armorSegmentAssignments, rigProfile).reduce((counts, assignment) => {
      if (assignment.pieceId) counts[assignment.pieceId] = (counts[assignment.pieceId] || 0) + 1;
      return counts;
    }, {})
  ), [rigProfile, selectedModel]);
  const armorCutContours = useMemo(() => normalizeArmorCutContours(selectedModel?.armorCutContours), [selectedModel]);
  const armorCutPaintStrokes = useMemo(() => normalizeArmorCutPaintStrokes(selectedModel?.armorCutPaintStrokes), [selectedModel]);
  const displayedArmorCutPaintStrokes = paintDraftStrokes || armorCutPaintStrokes;
  const activePaintStroke = useMemo(
    () => getPaintStroke(displayedArmorCutPaintStrokes, activeSegment),
    [activeSegment, displayedArmorCutPaintStrokes],
  );
  const activePaintPoints = useMemo(
    () => activePaintStroke?.points || [],
    [activePaintStroke],
  );
  const activePaintRadius = normalizeArmorPaintRadius(
    paintBrushRadii[activeSegment] ?? activePaintStroke?.radius ?? ARMOR_PAINT_RADIUS,
  );
  const activePaintSize = Math.round(activePaintRadius * 100);
  const armorGripMarkers = useMemo(() => getArmorGripMarkers(selectedModel, rigProfile), [rigProfile, selectedModel]);
  const weaponGripMarkers = useMemo(() => getWeaponGripMarkers(selectedModel, rigProfile), [rigProfile, selectedModel]);
  const shieldGripMarkers = useMemo(() => getShieldGripMarkers(selectedModel, rigProfile), [rigProfile, selectedModel]);
  const rigGripMarkerCount = armorGripMarkers.length + weaponGripMarkers.length + shieldGripMarkers.length;
  const canvasCutEnabled = Boolean(selectedModel?.armorCanvasCutEnabled);
  const canvasManipulationEnabled = canvasCutEnabled && canvasInteractionMode === 'manipulate';
  const canvasPaintEnabled = canvasCutEnabled && canvasInteractionMode === 'paint';
  const canvasSectionEnabled = canvasCutEnabled && canvasInteractionMode === 'section';
  const canvasZoomEnabled = canvasInteractionMode === 'zoom';

  useEffect(() => {
    if (!canvasCutEnabled && (canvasInteractionMode === 'paint' || canvasInteractionMode === 'manipulate' || canvasInteractionMode === 'section')) {
      setCanvasInteractionMode('cut');
    }
  }, [canvasCutEnabled, canvasInteractionMode]);

  useEffect(() => {
    if (!customPieces.length) {
      if (activePieceId) setActivePieceId('');
      return;
    }
    if (activePieceId && !customPieces.some((piece) => piece.id === activePieceId)) {
      setActivePieceId('');
    }
  }, [activePieceId, customPieces]);

  useEffect(() => {
    if (!getProfileSegmentOptions(rigProfile).some((segment) => segment.id === activeSegment)) {
      setActiveSegment('body');
    }
  }, [activeSegment, rigProfile]);

  const setSelectedModelId = (nextId) => {
    if (nextId !== selectedModelId) commitPendingPaintDraft();
    setLocalSelectedModelId(nextId);
    onSelectedModelIdChange?.(nextId);
  };

  const patchSelectedModel = (updater, options = {}) => {
    if (!selectedModel?.id) return;
    const modelId = selectedModel.id;
    const fastModelPatch = Boolean(options.fastModelPatch);
    patchProject((draft) => {
      const model = ensureDecorModels(draft).find((entry) => entry.id === modelId);
      if (model) updater(model);
    }, {
      ...options,
      ...(fastModelPatch ? {
        createDraft: (previous) => ({
          ...previous,
          decorModels3d: Array.isArray(previous.decorModels3d)
            ? previous.decorModels3d.map((entry) => (entry.id === modelId ? { ...entry } : entry))
            : [],
        }),
        migrate: false,
        rememberHistory: false,
      } : {}),
    });
  };

  const getNextArmorPaintStrokes = (baseStrokes = [], segmentId = activeSegment, action = {}) => {
    const segment = normalizeSegment(segmentId);
    const radius = normalizeArmorPaintRadius(action?.radius ?? activePaintRadius);
    const previous = getPaintPoints(baseStrokes, segment);
    let nextPoints = previous;
    if (action?.action === 'clear') {
      nextPoints = [];
    } else if (action?.action === 'undo') {
      nextPoints = previous.slice(0, -1);
    } else if (action?.action === 'replace') {
      nextPoints = Array.isArray(action.points) ? action.points : [];
    } else if (action?.action === 'append' && Array.isArray(action.points)) {
      nextPoints = [...previous, ...action.points];
    } else if (action?.point) {
      nextPoints = [...previous, action.point];
    }
    return patchPaintEntries(baseStrokes, segment, nextPoints, radius);
  };

  const commitPendingPaintDraft = () => {
    const draftStrokes = paintDraftStrokesRef.current;
    if (!draftStrokes || !selectedModel?.id) return false;
    const normalizedStrokes = normalizeArmorCutPaintStrokes(draftStrokes);
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      model.armorCutPaintStrokes = normalizedStrokes;
    }, { fastModelPatch: true });
    paintDraftStrokesRef.current = null;
    setPaintDraftStrokes(null);
    return true;
  };

  const changeCanvasInteractionMode = (nextMode) => {
    const mode = typeof nextMode === 'function' ? nextMode(canvasInteractionMode) : nextMode;
    if (canvasInteractionMode === 'paint' && mode !== 'paint') {
      commitPendingPaintDraft();
    }
    setCanvasInteractionMode(mode);
  };

  const handleSaveAssets = () => {
    commitPendingPaintDraft();
    onSaveAssets?.();
  };

  useEffect(() => {
    const source = selectedModel ? getThreeModelSource(selectedModel) : '';
    if (!selectedModel || !source) {
      setMeshNodes([]);
      setLoadStatus('Aucun objet 3D');
      return undefined;
    }
    let cancelled = false;
    setLoadStatus('Lecture du modele...');
    setMeshNodes([]);
    loadThreeModelFromSource(
      source,
      selectedModel,
      ({ object } = {}) => {
        if (cancelled) {
          if (object) disposeThreeObject(object);
          return;
        }
        const nodes = extractMeshNodes(object);
        setMeshNodes(nodes);
        setLoadStatus(nodes.length ? `${nodes.length} morceau${nodes.length > 1 ? 'x' : ''}` : 'Aucun mesh separe');
        if (object) disposeThreeObject(object);
      },
      (error) => {
        if (cancelled) return;
        setMeshNodes([]);
        setLoadStatus(error?.message || 'Modele non lisible');
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selectedModelSourceSignature]);

  const setNodeSegment = (node, segment) => {
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      const map = new Map(normalizeAssignments(model.armorSegmentAssignments, rigProfile).map((entry) => [entry.path, entry]));
      map.set(node.path, {
        path: node.path,
        name: node.name,
        segment: normalizeSegment(segment, rigProfile),
      });
      model.armorSegmentAssignments = [...map.values()];
    });
  };

  const setNodePiece = (node, piece) => {
    const pieceId = sanitizeArmorPieceId(piece?.id);
    if (!pieceId) return;
    const pieceName = normalizeArmorPieceName(piece?.name, 'Morceau');
    const pieceSegment = normalizeSegment(piece?.segment, rigProfile);
    const rigPointId = normalizeArmorPieceRigPointId(piece?.rigPointId, pieceSegment, rigProfile);
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      const pieces = getArmorCustomPieces(model, rigProfile);
      if (!pieces.some((entry) => entry.id === pieceId)) {
        pieces.push({ id: pieceId, name: pieceName, segment: pieceSegment, rigPointId });
      }
      model.armorCustomPieces = pieces.map((entry) => (
        entry.id === pieceId ? {
          ...entry,
          name: pieceName,
          segment: pieceSegment,
          rigPointId,
        } : entry
      ));
      const map = new Map(normalizeAssignments(model.armorSegmentAssignments, rigProfile).map((entry) => [entry.path, entry]));
      map.set(node.path, {
        path: node.path,
        name: node.name,
        segment: pieceSegment,
        pieceId,
        pieceName,
        rigPointId,
      });
      model.armorSegmentAssignments = [...map.values()];
    });
  };

  const addCustomPiece = () => {
    let createdPiece = null;
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      const pieces = getArmorCustomPieces(model, rigProfile);
      const usedIds = new Set(pieces.map((piece) => piece.id));
      createdPiece = {
        id: getUniqueArmorPieceId(`piece-${pieces.length + 1}`, usedIds),
        name: `Morceau ${pieces.length + 1}`,
        segment: normalizeSegment(activeSegment, rigProfile),
        rigPointId: getDefaultArmorPieceRigPointId(activeSegment, rigProfile),
      };
      model.armorCustomPieces = [...pieces, createdPiece];
    });
    if (createdPiece) {
      setActivePieceId(createdPiece.id);
      setActiveSegment(createdPiece.segment);
      changeCanvasInteractionMode('cut');
      setLoadStatus(`${createdPiece.name}: clique les meshes a integrer.`);
    }
  };

  const selectCustomPiece = (piece) => {
    if (!piece?.id) return;
    setActivePieceId(piece.id);
    setActiveSegment(normalizeSegment(piece.segment, rigProfile));
    if (canvasInteractionMode !== 'paint') changeCanvasInteractionMode('cut');
  };

  const renameCustomPiece = (pieceId, name) => {
    const normalizedPieceId = sanitizeArmorPieceId(pieceId);
    const nextName = normalizeArmorPieceName(name, 'Morceau');
    patchSelectedModel((model) => {
      const pieces = getArmorCustomPieces(model, rigProfile).map((piece) => (
        piece.id === normalizedPieceId ? { ...piece, name: nextName } : piece
      ));
      model.armorCustomPieces = pieces;
      model.armorSegmentAssignments = normalizeAssignments(model.armorSegmentAssignments, rigProfile).map((assignment) => (
        assignment.pieceId === normalizedPieceId
          ? { ...assignment, pieceName: nextName }
          : assignment
      ));
    });
  };

  const updateCustomPieceSegment = (pieceId, segment) => {
    const normalizedPieceId = sanitizeArmorPieceId(pieceId);
    const nextSegment = normalizeSegment(segment, rigProfile);
    patchSelectedModel((model) => {
      const pieces = getArmorCustomPieces(model, rigProfile).map((piece) => (
        piece.id === normalizedPieceId ? { ...piece, segment: nextSegment } : piece
      ));
      model.armorCustomPieces = pieces;
      model.armorSegmentAssignments = normalizeAssignments(model.armorSegmentAssignments, rigProfile).map((assignment) => (
        assignment.pieceId === normalizedPieceId
          ? { ...assignment, segment: nextSegment }
          : assignment
      ));
    });
    if (activePieceId === normalizedPieceId) setActiveSegment(nextSegment);
  };

  const updateCustomPieceRigPoint = (pieceId, rigPointId) => {
    const normalizedPieceId = sanitizeArmorPieceId(pieceId);
    const currentPiece = customPieces.find((piece) => piece.id === normalizedPieceId);
    const nextRigPointId = normalizeArmorPieceRigPointId(rigPointId, currentPiece?.segment, rigProfile);
    patchSelectedModel((model) => {
      const pieces = getArmorCustomPieces(model, rigProfile).map((piece) => (
        piece.id === normalizedPieceId ? { ...piece, rigPointId: nextRigPointId } : piece
      ));
      model.armorCustomPieces = pieces;
      model.armorSegmentAssignments = normalizeAssignments(model.armorSegmentAssignments, rigProfile).map((assignment) => (
        assignment.pieceId === normalizedPieceId
          ? { ...assignment, rigPointId: nextRigPointId }
          : assignment
      ));
    });
  };

  const deleteCustomPiece = (pieceId) => {
    const normalizedPieceId = sanitizeArmorPieceId(pieceId);
    const remainingPieces = customPieces.filter((piece) => piece.id !== normalizedPieceId);
    patchSelectedModel((model) => {
      model.armorCustomPieces = getArmorCustomPieces(model, rigProfile).filter((piece) => piece.id !== normalizedPieceId);
      model.armorSegmentAssignments = normalizeAssignments(model.armorSegmentAssignments, rigProfile).map((assignment) => {
        if (assignment.pieceId !== normalizedPieceId) return assignment;
        return {
          path: assignment.path,
          name: assignment.name,
          segment: assignment.segment,
        };
      });
    });
    if (activePieceId === normalizedPieceId) {
      const nextPiece = remainingPieces[0];
      setActivePieceId(nextPiece?.id || '');
      if (nextPiece) setActiveSegment(nextPiece.segment);
    }
  };

  const applyArmorSkeleton = () => {
    patchSelectedModel((model) => {
      if (rigProfile.gripType === 'weapon') {
        ensureWeaponGripDefaults(model);
        return;
      }
      if (rigProfile.gripType === 'shield') {
        ensureShieldGripDefaults(model);
        return;
      }
      if (rigProfile.gripType === 'armor') {
        model.armorFullCharacterRigEnabled = false;
        ALL_ARMOR_GRIP_MARKERS.filter((marker) => !rigProfile.defaultGripMarkerIds.has(marker.id)).forEach((marker) => {
          model[`armorGrip${marker.suffix}Enabled`] = false;
        });
        Object.assign(model, {
          ...rigProfile.gripDefaults,
          armorGripReferenceScale: model.armorGripReferenceScale || getModelReferenceScale(model),
        });
      }
    });
    setLoadStatus(rigProfile.skeletonStatus);
  };

  const applyFullCharacterRigSkeleton = () => {
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorFullCharacterRigEnabled = true;
      ensureArmorGripPoints(model, ALL_ARMOR_GRIP_MARKERS);
    });
    setLoadStatus('Tous les os du rig personnage sont disponibles sur cet objet.');
  };

  const applyCanvasCut = () => {
    const cutPieces = meshNodes.length > 1 ? buildCustomPiecesFromMeshNodes(meshNodes, rigProfile) : [];
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      model.armorCustomPieces = cutPieces;
      model.armorSegmentAssignments = meshNodes.length > 1
        ? meshNodes.map((node, index) => ({
          path: node.path,
          name: node.name,
          segment: cutPieces[index]?.segment || normalizeSegment(inferSegment(node, node.center, rigProfile), rigProfile),
          pieceId: cutPieces[index]?.id,
          pieceName: cutPieces[index]?.name,
          rigPointId: cutPieces[index]?.rigPointId,
        }))
        : [];
    });
    if (cutPieces.length) {
      setActivePieceId(cutPieces[0].id);
      setActiveSegment(cutPieces[0].segment);
    }
    setLoadStatus(meshNodes.length > 1 ? 'Morceaux decoupes dans le canevas.' : 'Zones colorees activees dans le canevas.');
  };

  const setPaintMode = () => {
    if (!selectedModel) return;
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      model.armorCutPaintStrokes = normalizeArmorCutPaintStrokes(model.armorCutPaintStrokes);
    });
    changeCanvasInteractionMode('paint');
  };

  const updateArmorCutContour = (segmentId = activeSegment, action = {}) => {
    const segment = normalizeSegment(segmentId, rigProfile);
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      const previous = getContourPoints(model.armorCutContours, segment);
      let nextPoints = previous;
      if (action?.action === 'clear') {
        nextPoints = [];
      } else if (action?.action === 'undo') {
        nextPoints = previous.slice(0, -1);
      } else if (action?.action === 'replace') {
        nextPoints = Array.isArray(action.points) ? action.points : [];
      } else if (action?.action === 'append' && Array.isArray(action.points)) {
        nextPoints = [...previous, ...action.points];
      } else if (action?.point) {
        nextPoints = [...previous, action.point];
      }
      model.armorCutContours = patchContourEntries(model.armorCutContours, segment, nextPoints);
    });
  };

  const updateArmorCutPaint = (segmentId = activeSegment, action = {}) => {
    const segment = normalizeSegment(segmentId, rigProfile);
    if (canvasInteractionMode === 'paint') {
      const nextStrokes = getNextArmorPaintStrokes(
        paintDraftStrokesRef.current || armorCutPaintStrokes,
        segment,
        action,
      );
      paintDraftStrokesRef.current = nextStrokes;
      setPaintDraftStrokes(nextStrokes);
      return;
    }
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      model.armorCutPaintStrokes = getNextArmorPaintStrokes(model.armorCutPaintStrokes, segment, action);
    }, { fastModelPatch: true });
  };

  const updateArmorPaintRadius = (value) => {
    const radius = normalizeArmorPaintRadius(value);
    setPaintBrushRadii((previous) => ({
      ...previous,
      [activeSegment]: radius,
    }));
    if (activePaintPoints.length) {
      updateArmorCutPaint(activeSegment, { action: 'radius', radius });
    }
  };

  const updateArmorPaintSize = (value) => {
    const nextSize = ThreeMathUtils.clamp(
      Math.round(Number(value) || activePaintSize),
      ARMOR_PAINT_SIZE_MIN,
      ARMOR_PAINT_SIZE_MAX,
    );
    updateArmorPaintRadius(nextSize / 100);
  };

  const updateWeaponGripMarker = (hand = 'right', position = {}) => {
    const gripHand = hand === 'left' ? 'left' : 'right';
    const suffix = gripHand === 'left' ? 'Left' : 'Right';
    patchSelectedModel((model) => {
      model.weaponGripReferenceScale = model.weaponGripReferenceScale || getModelReferenceScale(model);
      model.weaponGripHand = model.weaponGripHand === 'left' ? 'left' : 'right';
      model[`weaponGrip${suffix}Enabled`] = true;
      if (!hasArmorGripNumber(model[`weaponGrip${suffix}RotationZ`])) {
        model[`weaponGrip${suffix}RotationZ`] = 180;
      }
      model[`weaponGrip${suffix}X`] = clampGripPositionValue(position.x, model[`weaponGrip${suffix}X`]);
      model[`weaponGrip${suffix}Y`] = clampGripPositionValue(position.y, model[`weaponGrip${suffix}Y`]);
      model[`weaponGrip${suffix}Z`] = clampGripPositionValue(position.z, model[`weaponGrip${suffix}Z`]);
    });
  };

  const updateShieldGripMarker = (pointId = 'hand', position = {}) => {
    const config = SHIELD_GRIP_POINTS.find((entry) => entry.id === pointId);
    if (!config) return;
    patchSelectedModel((model) => {
      model.shieldGripReferenceScale = model.shieldGripReferenceScale || getModelReferenceScale(model);
      model.shieldGripArm = model.shieldGripArm === 'right' ? 'right' : 'left';
      model[`shieldGrip${config.suffix}Enabled`] = true;
      model[`shieldGrip${config.suffix}X`] = clampGripPositionValue(position.x, model[`shieldGrip${config.suffix}X`]);
      model[`shieldGrip${config.suffix}Y`] = clampGripPositionValue(position.y, model[`shieldGrip${config.suffix}Y`] ?? config.defaultY);
      model[`shieldGrip${config.suffix}Z`] = clampGripPositionValue(position.z, model[`shieldGrip${config.suffix}Z`]);
    });
  };

  const updateArmorGripMarker = (markerId, position = {}) => {
    const marker = ALL_ARMOR_GRIP_MARKERS.find((entry) => entry.id === markerId);
    if (!marker) return;
    patchSelectedModel((model) => {
      ensureArmorRigDefaults(model, rigProfile);
      model.armorCanvasCutEnabled = true;
      model[`armorGrip${marker.suffix}Enabled`] = true;
      model[`armorGrip${marker.suffix}X`] = position.x;
      model[`armorGrip${marker.suffix}Y`] = position.y;
      model[`armorGrip${marker.suffix}Z`] = position.z;
    });
  };

  const handleCanvasMeshPick = (node = {}) => {
    if (canvasManipulationEnabled || canvasPaintEnabled || canvasZoomEnabled) return;
    if (!node.path) return;
    if (meshNodes.length <= 1) {
      applyCanvasCut();
      return;
    }
    const knownNode = meshNodes.find((entry) => entry.path === node.path) || node;
    if (activePiece) {
      setNodePiece(knownNode, activePiece);
      return;
    }
    setNodeSegment(knownNode, activeSegment);
  };

  const testOnCharacter = () => {
    if (!selectedModel?.id || !selectedCharacter?.id) return;
    onTestOnCharacter?.({
      decorModelId: selectedModel.id,
      characterModelId: selectedCharacter.id,
    });
  };

  const singleMeshCanvasCut = canvasCutEnabled && meshNodes.length <= 1;
  const assignedCounts = singleMeshCanvasCut
    ? rigProfile.segmentOptions.reduce((counts, segment) => ({ ...counts, [segment.id]: 1 }), {})
    : meshNodes.reduce((counts, node) => {
      const segment = normalizeSegment(assignmentMap.get(node.path)?.segment || inferSegment(node, node.center, rigProfile), rigProfile);
      counts[segment] = (counts[segment] || 0) + 1;
      return counts;
    }, {});
  const getSegmentCountLabel = (segmentId) => (
    singleMeshCanvasCut ? 'visible' : `${assignedCounts[segmentId] || 0}`
  );

  const previewModel = selectedModel && getThreeModelSource(selectedModel) ? selectedModel : null;

  return (
    <main className="object-rigging-tab">
      <section className="panel object-rigging-controls">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker"><Cuboid size={14} /> Rig 3D</span>
            <h2>Assemblage objets</h2>
          </div>
          <button type="button" className="primary-action" onClick={handleSaveAssets} disabled={saveInProgress}>
            <Save aria-hidden="true" size={16} />
            <span>{saveInProgress ? 'Sauvegarde...' : 'Sauver'}</span>
          </button>
        </div>
        <label>
          <span>Objet</span>
          <select value={selectedModel?.id || ''} onChange={(event) => setSelectedModelId(event.target.value)}>
            {decorModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name || model.modelName || 'Objet 3D'}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Personnage test</span>
          <select value={selectedCharacter?.id || ''} onChange={(event) => setSelectedCharacterId(event.target.value)}>
            {characterModels.map((model) => (
              <option key={model.id} value={model.id}>{model.name || model.modelName || 'Personnage 3D'}</option>
            ))}
          </select>
        </label>
        <div className="object-rigging-actions">
          {rigProfile.gripType !== 'none' ? (
            <button type="button" className="secondary-action" onClick={applyArmorSkeleton} disabled={!selectedModel}>
              <Activity aria-hidden="true" size={16} />
              <span>{rigProfile.skeletonButtonLabel}</span>
            </button>
          ) : null}
          {rigProfile.gripType === 'armor' ? (
            <button type="button" className="secondary-action" onClick={applyFullCharacterRigSkeleton} disabled={!selectedModel}>
              <Fingerprint aria-hidden="true" size={16} />
              <span>Os personnage</span>
            </button>
          ) : null}
          <button type="button" className="secondary-action" onClick={applyCanvasCut} disabled={!selectedModel}>
            <Scissors aria-hidden="true" size={16} />
            <span>{canvasCutEnabled ? 'Revoir coupe' : 'Decouper'}</span>
          </button>
          <button
            type="button"
            className={canvasPaintEnabled ? 'secondary-action active' : 'secondary-action'}
            onClick={setPaintMode}
            disabled={!selectedModel}
          >
            <Brush aria-hidden="true" size={16} />
            <span>Peindre zone</span>
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={testOnCharacter}
            disabled={!selectedModel || !selectedCharacter || !onTestOnCharacter}
          >
            <UserRound aria-hidden="true" size={16} />
            <span>Tester sur personnage</span>
          </button>
        </div>
        <p className="small-note">{saveStatus || loadStatus}</p>
        <div className="object-rigging-stats">
          {rigProfile.segmentOptions.map((segment) => (
            <span key={segment.id}>{segment.label}: {getSegmentCountLabel(segment.id)}</span>
          ))}
          <span>Morceaux nommes: {customPieces.length}</span>
          <span>Os rig: {rigGripMarkerCount}</span>
        </div>
        <div className="object-rigging-pieces">
          <div className="object-rigging-pieces-head">
            <strong>Morceaux</strong>
            <button
              type="button"
              aria-label="Ajouter un morceau"
              className="secondary-action"
              onClick={addCustomPiece}
              disabled={!selectedModel}
              title="Ajouter un morceau nommable"
            >
              <Plus aria-hidden="true" size={15} />
            </button>
          </div>
          {customPieces.length ? (
            <div className="object-rigging-pieces-list">
              {customPieces.map((piece) => (
                <div
                  className={activePieceId === piece.id ? 'object-rigging-piece-row active' : 'object-rigging-piece-row'}
                  key={piece.id}
                >
                  <button
                    type="button"
                    className="object-rigging-piece-select"
                    aria-label={`Selectionner ${piece.name}`}
                    aria-pressed={activePieceId === piece.id}
                    onClick={() => selectCustomPiece(piece)}
                    title="Utiliser ce morceau pour le prochain clic canvas"
                  >
                    <strong>{piece.name}</strong>
                    <small>{getSegmentLabel(piece.segment, rigProfile)} - {getRigPointLabel(piece.rigPointId)} - {pieceAssignmentCounts[piece.id] || 0} mesh</small>
                  </button>
                  <input
                    aria-label={`Nom du morceau ${piece.name}`}
                    value={piece.name}
                    maxLength={ARMOR_PIECE_NAME_MAX_LENGTH}
                    onChange={(event) => renameCustomPiece(piece.id, event.target.value)}
                  />
                  <select
                    aria-label={`Ancrage ${piece.name}`}
                    value={piece.segment}
                    onChange={(event) => updateCustomPieceSegment(piece.id, event.target.value)}
                  >
                    {rigProfile.segmentOptions.map((segment) => (
                      <option key={segment.id} value={segment.id}>{segment.label}</option>
                    ))}
                  </select>
                  <select
                    aria-label={`Os cible ${piece.name}`}
                    value={piece.rigPointId}
                    onChange={(event) => updateCustomPieceRigPoint(piece.id, event.target.value)}
                  >
                    {ARMOR_RIG_POINT_OPTIONS.map((point) => (
                      <option key={point.rigPointId || point.id} value={point.rigPointId || point.id}>{point.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    aria-label={`Supprimer ${piece.name}`}
                    className="secondary-action object-rigging-piece-delete"
                    onClick={() => deleteCustomPiece(piece.id)}
                    title="Retirer ce morceau nomme"
                  >
                    <Trash2 aria-hidden="true" size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="small-note">Decoupe l'objet pour creer les morceaux, puis renomme ceux que tu veux garder.</p>
          )}
        </div>
        <div className="object-rigging-contour-tools">
          <span>
            Peinture {rigProfile.segmentOptions.find((segment) => segment.id === activeSegment)?.shortLabel || 'P'}:
            {' '}
            {activePaintPoints.length} touche{activePaintPoints.length > 1 ? 's' : ''}
          </span>
          <label className="object-rigging-brush-size" title="Taille du pinceau">
            <span>Taille</span>
            <input
              aria-label="Taille pinceau"
              type="number"
              min={ARMOR_PAINT_SIZE_MIN}
              max={ARMOR_PAINT_SIZE_MAX}
              step="1"
              value={activePaintSize}
              onChange={(event) => updateArmorPaintSize(event.target.value)}
            />
          </label>
          <div className="object-rigging-contour-actions">
            <button
              type="button"
              aria-label="Annuler"
              className="secondary-action"
              onClick={() => updateArmorCutPaint(activeSegment, { action: 'undo' })}
              disabled={!activePaintPoints.length}
              title="Retirer la derniere touche"
            >
              <Undo2 aria-hidden="true" size={15} />
            </button>
            <button
              type="button"
              aria-label="Effacer"
              className="secondary-action"
              onClick={() => updateArmorCutPaint(activeSegment, { action: 'clear' })}
              disabled={!activePaintPoints.length}
              title="Effacer la peinture active"
            >
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </div>
      </section>

      <section className="panel object-rigging-preview-panel">
        <React.Suspense fallback={<div className="decor3d-preview-loading" />}>
          {previewModel ? (
            <Decor3DPreview
              armorCanvasCutEnabled={canvasCutEnabled}
              armorCutManipulationEnabled={canvasManipulationEnabled}
              armorCutContours={armorCutContours}
              armorCutPaintStrokes={armorCutPaintStrokes}
              weaponGripMarkers={weaponGripMarkers}
              onWeaponGripMarkerChange={weaponGripMarkers.length ? updateWeaponGripMarker : undefined}
              shieldGripMarkers={shieldGripMarkers}
              onShieldGripMarkerChange={shieldGripMarkers.length ? updateShieldGripMarker : undefined}
              armorGripMarkers={armorGripMarkers}
              onArmorCutContourChange={updateArmorCutContour}
              onArmorCutPaintChange={updateArmorCutPaint}
              model={previewModel}
              onArmorGripMarkerChange={armorGripMarkers.length ? updateArmorGripMarker : undefined}
              onRigMeshPick={handleCanvasMeshPick}
              armorPaintDrawEnabled={canvasPaintEnabled}
              cameraZoomDragEnabled={canvasZoomEnabled}
              onCameraZoomChange={setCameraZoomPercent}
              showGrid={gridVisible}
              rigMeshPickEnabled={!canvasManipulationEnabled && !canvasPaintEnabled && !canvasZoomEnabled && !canvasSectionEnabled}
              rigActiveSegment={activeSegment}
              armorPaintBrushRadius={activePaintRadius}
              armorSectionToolEnabled={canvasSectionEnabled}
            >
              <div className="object-rigging-canvas-hud decor3d-canvas-overlay">
                <div>
                  <span className="section-kicker"><Cuboid size={14} /> Objet</span>
                  <h2>{selectedModel?.name || selectedModel?.modelName || 'Objet 3D'}</h2>
                </div>
                <div className="object-rigging-segment-pills" aria-label="Segment actif">
                  {rigProfile.segmentOptions.map((segment) => (
                    <button
                      aria-pressed={activeSegment === segment.id}
                      className={activeSegment === segment.id ? 'active' : ''}
                      key={segment.id}
                      onClick={() => {
                        setActivePieceId('');
                        setActiveSegment(segment.id);
                        if (canvasInteractionMode !== 'paint') changeCanvasInteractionMode('cut');
                      }}
                      type="button"
                    >
                      <b>{segment.shortLabel}</b>
                      <span>{segment.label}</span>
                    </button>
                  ))}
                  <button
                    aria-pressed={gridVisible}
                    className={gridVisible ? 'active object-rigging-grid-button' : 'object-rigging-grid-button'}
                    onClick={() => setGridVisible((visible) => !visible)}
                    title={gridVisible ? 'Masquer la grille' : 'Afficher la grille'}
                    type="button"
                  >
                    <Grid2X2 aria-hidden="true" size={15} />
                    <span>Grille</span>
                  </button>
                  <button
                    aria-pressed={canvasZoomEnabled}
                    className={canvasZoomEnabled ? 'active object-rigging-zoom-button' : 'object-rigging-zoom-button'}
                    onClick={() => changeCanvasInteractionMode(canvasZoomEnabled ? 'cut' : 'zoom')}
                    title={canvasZoomEnabled ? 'Revenir a la coupe' : 'Zoom souris: clic gauche et glisse haut/bas'}
                    type="button"
                  >
                    <ZoomIn aria-hidden="true" size={15} />
                    <span>{canvasZoomEnabled ? 'Couper' : 'Zoom'}</span>
                  </button>
                  {canvasCutEnabled ? (
                    <>
                      <button
                        aria-pressed={canvasSectionEnabled}
                        className={canvasSectionEnabled ? 'active object-rigging-section-button' : 'object-rigging-section-button'}
                        onClick={() => changeCanvasInteractionMode(canvasSectionEnabled ? 'cut' : 'section')}
                        title="Tracer une vue en coupe puis choisir la face visible"
                        type="button"
                      >
                        <Scissors aria-hidden="true" size={15} />
                        <span>Vue coupe</span>
                      </button>
                      <button
                        aria-pressed={canvasPaintEnabled}
                        className={canvasPaintEnabled ? 'active object-rigging-contour-button' : 'object-rigging-contour-button'}
                        onClick={() => changeCanvasInteractionMode(canvasPaintEnabled ? 'cut' : 'paint')}
                        title={canvasPaintEnabled ? 'Revenir a la coupe' : 'Peindre une zone de decoupe'}
                        type="button"
                      >
                        <Brush aria-hidden="true" size={15} />
                        <span>{canvasPaintEnabled ? 'Couper' : 'Peindre'}</span>
                      </button>
                    <button
                      aria-pressed={canvasManipulationEnabled}
                      className={canvasManipulationEnabled ? 'active object-rigging-manipulate-button' : 'object-rigging-manipulate-button'}
                      onClick={() => changeCanvasInteractionMode(canvasManipulationEnabled ? 'cut' : 'manipulate')}
                      title={canvasManipulationEnabled ? 'Revenir a la coupe' : "Manipuler l'objet dans le canvas"}
                      type="button"
                    >
                      <Hand aria-hidden="true" size={15} />
                      <span>{canvasManipulationEnabled ? 'Couper' : 'Manipuler'}</span>
                    </button>
                    </>
                  ) : null}
                </div>
                <div className="object-rigging-cut-status">
                  {canvasSectionEnabled
                    ? 'Vue coupe: trace une ligne puis clique la face visible'
                    : (canvasManipulationEnabled
                    ? 'Manipulation active dans le canevas'
                    : (canvasZoomEnabled
                      ? `Zoom souris: ${cameraZoomPercent}%`
                    : (canvasPaintEnabled
                      ? `Peinture active: ${activePaintPoints.length} touche${activePaintPoints.length > 1 ? 's' : ''}`
                      : (canvasCutEnabled
                        ? `Clic canvas: ${activePiece?.name || getSegmentLabel(activeSegment, rigProfile)}`
                        : `Clic canvas: ${activePiece?.name || getSegmentLabel(activeSegment, rigProfile)}`))))}
                </div>
              </div>
            </Decor3DPreview>
          ) : (
            <div className="object-rigging-empty-preview">Selectionne un objet 3D.</div>
          )}
        </React.Suspense>
      </section>
    </main>
  );
}
