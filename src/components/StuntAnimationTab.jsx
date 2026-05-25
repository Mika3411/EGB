import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  Pause,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { uid } from '../data/projectData';
import {
  CHARACTER_RIG_POINT_DEFINITIONS,
  CHARACTER_RIG_POINT_GROUPS,
} from '../utils/rpg3dCharacterRig.js';
import StuntCharacter3DPreview from './StuntCharacter3DPreview';
import '../styles/stunt-animation.css';

const makeLocalId = (prefix) => `${prefix}_${uid()}`;
const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
const rounded = (value, precision = 2) => Number(Number(value || 0).toFixed(precision));
const smooth = (value) => value * value * (3 - (2 * value));
const MIN_MOVEMENT_COUNT = 1;
const MAX_MOVEMENT_COUNT = 200;

const clampMovementCount = (value) => Math.round(clamp(value, MIN_MOVEMENT_COUNT, MAX_MOVEMENT_COUNT));

const MOTION_POSE_FIELDS = [
  { id: 'rootX', label: 'X', min: 8, max: 92, step: 1 },
  { id: 'rootY', label: 'Y', min: 24, max: 86, step: 1 },
  { id: 'bodyTilt', label: 'Corps', min: -140, max: 420, step: 1 },
  { id: 'bodyYaw', label: 'Tour Y', min: -180, max: 180, step: 1 },
  { id: 'bodyCurl', label: 'Courbe', min: -55, max: 82, step: 1 },
  { id: 'headTilt', label: 'Tete', min: -55, max: 55, step: 1 },
  { id: 'leftArm', label: 'Bras G', min: -125, max: 125, step: 1 },
  { id: 'leftForearm', label: 'Avant G', min: -105, max: 105, step: 1 },
  { id: 'rightArm', label: 'Bras D', min: -125, max: 125, step: 1 },
  { id: 'rightForearm', label: 'Avant D', min: -105, max: 105, step: 1 },
  { id: 'leftLeg', label: 'Jambe G', min: -98, max: 98, step: 1 },
  { id: 'leftShin', label: 'Tibia G', min: -105, max: 105, step: 1 },
  { id: 'rightLeg', label: 'Jambe D', min: -98, max: 98, step: 1 },
  { id: 'rightShin', label: 'Tibia D', min: -105, max: 105, step: 1 },
];

const ROTATION_POSE_FIELDS = [
  { id: 'bodyTwist', label: 'Torse Y', min: -55, max: 55, step: 1 },
  { id: 'headYaw', label: 'Tete Y', min: -60, max: 60, step: 1 },
  { id: 'leftArmSide', label: 'Bras G Y', min: -70, max: 70, step: 1 },
  { id: 'leftForearmSide', label: 'Avant G Y', min: -75, max: 75, step: 1 },
  { id: 'rightArmSide', label: 'Bras D Y', min: -70, max: 70, step: 1 },
  { id: 'rightForearmSide', label: 'Avant D Y', min: -75, max: 75, step: 1 },
  { id: 'leftLegSide', label: 'Jambe G Y', min: -42, max: 42, step: 1 },
  { id: 'leftShinSide', label: 'Tibia G Y', min: -36, max: 36, step: 1 },
  { id: 'rightLegSide', label: 'Jambe D Y', min: -42, max: 42, step: 1 },
  { id: 'rightShinSide', label: 'Tibia D Y', min: -36, max: 36, step: 1 },
];

const POSE_FIELDS = [...MOTION_POSE_FIELDS, ...ROTATION_POSE_FIELDS];
const POSE_FIELD_CONFIG_BY_ID = new Map(POSE_FIELDS.map((field) => [field.id, field]));
const BODY_RIG_POINTS = CHARACTER_RIG_POINT_DEFINITIONS
  .filter((point) => point.group === CHARACTER_RIG_POINT_GROUPS.body);

const JOINT_FIELD_MAP = {
  mouth: ['headTilt', 'headYaw'],
  neck: ['bodyTilt', 'bodyCurl', 'bodyYaw', 'bodyTwist'],
  'left-shoulder': ['bodyTilt', 'bodyCurl', 'bodyYaw', 'bodyTwist'],
  'right-shoulder': ['bodyTilt', 'bodyCurl', 'bodyYaw', 'bodyTwist'],
  'left-elbow': ['leftArm', 'leftArmSide'],
  'left-hand': ['leftForearm', 'leftForearmSide'],
  'right-elbow': ['rightArm', 'rightArmSide'],
  'right-hand': ['rightForearm', 'rightForearmSide'],
  'lower-belly': ['rootX', 'rootY', 'bodyYaw'],
  'left-groin-fold': ['leftLeg', 'leftLegSide'],
  'right-groin-fold': ['rightLeg', 'rightLegSide'],
  'left-knee': ['leftLeg', 'leftLegSide'],
  'left-ankle': ['leftShin', 'leftShinSide'],
  'left-foot': ['leftShin', 'leftShinSide'],
  'right-knee': ['rightLeg', 'rightLegSide'],
  'right-ankle': ['rightShin', 'rightShinSide'],
  'right-foot': ['rightShin', 'rightShinSide'],
};

const BONE_ROTATION_FIELD_MAP = {
  mouth: ['headYaw'],
  neck: ['bodyYaw', 'bodyTwist'],
  'left-shoulder': ['bodyYaw', 'bodyTwist'],
  'right-shoulder': ['bodyYaw', 'bodyTwist'],
  'left-elbow': ['leftArmSide'],
  'left-hand': ['leftForearmSide'],
  'right-elbow': ['rightArmSide'],
  'right-hand': ['rightForearmSide'],
  'lower-belly': ['bodyYaw'],
  'left-groin-fold': ['leftLegSide'],
  'right-groin-fold': ['rightLegSide'],
  'left-knee': ['leftLegSide'],
  'left-ankle': ['leftShinSide'],
  'left-foot': ['leftShinSide'],
  'right-knee': ['rightLegSide'],
  'right-ankle': ['rightShinSide'],
  'right-foot': ['rightShinSide'],
};

const PROFILE_JOINT_DRAG_FIELDS = {
  mouth: { headTilt: { x: 0.7, y: -0.32 } },
  neck: { bodyTilt: { x: 0.62, y: -0.28 } },
  'left-shoulder': { bodyTilt: { x: 0.62, y: -0.28 } },
  'right-shoulder': { bodyTilt: { x: 0.62, y: -0.28 } },
  'left-elbow': { leftArm: { x: 0.72, y: -0.32 } },
  'left-hand': { leftForearm: { x: 0.72, y: -0.32 } },
  'right-elbow': { rightArm: { x: 0.72, y: -0.32 } },
  'right-hand': { rightForearm: { x: 0.72, y: -0.32 } },
  'lower-belly': { rootX: { x: 0.12 }, rootY: { y: 0.12 } },
  'left-groin-fold': { leftLeg: { x: 0.64, y: -0.28 } },
  'right-groin-fold': { rightLeg: { x: 0.64, y: -0.28 } },
  'left-knee': { leftLeg: { x: 0.64, y: -0.28 } },
  'left-ankle': { leftShin: { x: 0.64, y: -0.28 } },
  'left-foot': { leftShin: { x: 0.64, y: -0.28 } },
  'right-knee': { rightLeg: { x: 0.64, y: -0.28 } },
  'right-ankle': { rightShin: { x: 0.64, y: -0.28 } },
  'right-foot': { rightShin: { x: 0.64, y: -0.28 } },
};

const FRONT_JOINT_DRAG_FIELDS = {
  mouth: { headYaw: { x: 0.68 }, headTilt: { y: -0.34 } },
  neck: { bodyTwist: { x: 0.52 }, bodyCurl: { y: -0.22 } },
  'left-shoulder': { bodyTwist: { x: 0.52 }, bodyCurl: { y: -0.22 } },
  'right-shoulder': { bodyTwist: { x: 0.52 }, bodyCurl: { y: -0.22 } },
  'left-elbow': { leftArmSide: { x: 0.72 }, leftArm: { y: -0.34 } },
  'left-hand': { leftForearmSide: { x: 0.72 }, leftForearm: { y: -0.34 } },
  'right-elbow': { rightArmSide: { x: 0.72 }, rightArm: { y: -0.34 } },
  'right-hand': { rightForearmSide: { x: 0.72 }, rightForearm: { y: -0.34 } },
  'lower-belly': { rootX: { x: 0.12 }, rootY: { y: 0.12 }, bodyYaw: { x: 0.24 } },
  'left-groin-fold': { leftLegSide: { x: 0.62 }, leftLeg: { y: -0.28 } },
  'right-groin-fold': { rightLegSide: { x: 0.62 }, rightLeg: { y: -0.28 } },
  'left-knee': { leftLegSide: { x: 0.62 }, leftLeg: { y: -0.28 } },
  'left-ankle': { leftShinSide: { x: 0.62 }, leftShin: { y: -0.28 } },
  'left-foot': { leftShinSide: { x: 0.62 }, leftShin: { y: -0.28 } },
  'right-knee': { rightLegSide: { x: 0.62 }, rightLeg: { y: -0.28 } },
  'right-ankle': { rightShinSide: { x: 0.62 }, rightShin: { y: -0.28 } },
  'right-foot': { rightShinSide: { x: 0.62 }, rightShin: { y: -0.28 } },
};

const BACK_VIEW_ROTATION_FIELDS = new Set([
  'bodyYaw',
  'bodyTwist',
  'headYaw',
  'leftArmSide',
  'leftForearmSide',
  'rightArmSide',
  'rightForearmSide',
  'leftLegSide',
  'leftShinSide',
  'rightLegSide',
  'rightShinSide',
]);

const getJointDragFields = (jointId, editView) => {
  const fields = (editView === 'profile' ? PROFILE_JOINT_DRAG_FIELDS : FRONT_JOINT_DRAG_FIELDS)[jointId];
  if (!fields || editView !== 'back') return fields;
  return Object.entries(fields).reduce((next, [field, config]) => {
    next[field] = {
      ...config,
      x: BACK_VIEW_ROTATION_FIELDS.has(field) ? -(Number(config.x) || 0) : config.x,
    };
    return next;
  }, {});
};

const JOINT_LABELS = Object.fromEntries(BODY_RIG_POINTS.map((point) => [point.id, point.label]));

const BASE_POSE = {
  rootX: 22,
  rootY: 74,
  bodyTilt: 0,
  bodyYaw: 0,
  bodyCurl: 0,
  bodyTwist: 0,
  headTilt: 0,
  headYaw: 0,
  leftArm: 24,
  leftForearm: -18,
  leftArmSide: 0,
  leftForearmSide: 0,
  rightArm: -26,
  rightForearm: 22,
  rightArmSide: 0,
  rightForearmSide: 0,
  leftLeg: 12,
  leftShin: -10,
  leftLegSide: 0,
  leftShinSide: 0,
  rightLeg: -10,
  rightShin: 12,
  rightLegSide: 0,
  rightShinSide: 0,
};

const clampPoseFieldValue = (field, value) => {
  const config = POSE_FIELD_CONFIG_BY_ID.get(field);
  if (!config) return value;
  return clamp(value, config.min, config.max);
};

const clampPoseFields = (source = {}) => POSE_FIELDS.reduce((next, field) => ({
  ...next,
  [field.id]: clampPoseFieldValue(field.id, source[field.id] ?? BASE_POSE[field.id] ?? 0),
}), {});

const pose = (time, label, overrides = {}) => ({
  id: makeLocalId('pose'),
  label,
  time,
  ...clampPoseFields({ ...BASE_POSE, ...overrides }),
});

const STUNT_PRESETS = [
  {
    id: 'front-flip',
    name: 'Saut perilleux',
    tone: 'air',
    durationMs: 1450,
    intensity: 78,
    landingWeight: 72,
    keyframes: [
      pose(0, 'Impulsion', { rootX: 18, rootY: 76, bodyTilt: -10, bodyCurl: -12, leftArm: -70, rightArm: -82, leftLeg: 18, rightLeg: -22 }),
      pose(18, 'Decollage', { rootX: 30, rootY: 58, bodyTilt: 40, bodyCurl: 24, leftArm: -118, rightArm: -125, leftLeg: 58, leftShin: -82, rightLeg: -55, rightShin: 88 }),
      pose(48, 'Rotation', { rootX: 52, rootY: 35, bodyTilt: 188, bodyCurl: 86, headTilt: -22, leftArm: 118, leftForearm: 70, rightArm: -116, rightForearm: -70, leftLeg: 98, leftShin: -118, rightLeg: -92, rightShin: 116 }),
      pose(76, 'Ouverture', { rootX: 74, rootY: 58, bodyTilt: 315, bodyCurl: 18, leftArm: 64, rightArm: -58, leftLeg: 25, leftShin: -32, rightLeg: -24, rightShin: 34 }),
      pose(100, 'Reception', { rootX: 84, rootY: 76, bodyTilt: 360, bodyCurl: -18, leftArm: 18, rightArm: -18, leftLeg: 28, leftShin: -46, rightLeg: -20, rightShin: 38 }),
    ],
  },
  {
    id: 'roll-forward',
    name: 'Roulade avant',
    tone: 'ground',
    durationMs: 1100,
    intensity: 62,
    landingWeight: 44,
    keyframes: [
      pose(0, 'Baisse', { rootX: 16, rootY: 78, bodyTilt: 42, bodyCurl: 44, headTilt: 18, leftArm: 82, rightArm: 72, leftLeg: 54, rightLeg: -28 }),
      pose(25, 'Epaule', { rootX: 30, rootY: 76, bodyTilt: 112, bodyCurl: 82, headTilt: -28, leftArm: 108, rightArm: 118, leftLeg: 88, leftShin: -110, rightLeg: -74, rightShin: 96 }),
      pose(52, 'Boule', { rootX: 50, rootY: 73, bodyTilt: 210, bodyCurl: 102, headTilt: -40, leftArm: 132, rightArm: -132, leftLeg: 92, leftShin: -126, rightLeg: -94, rightShin: 126 }),
      pose(78, 'Sortie', { rootX: 70, rootY: 77, bodyTilt: 310, bodyCurl: 52, leftArm: 74, rightArm: -58, leftLeg: 38, leftShin: -54, rightLeg: -44, rightShin: 62 }),
      pose(100, 'Debout', { rootX: 84, rootY: 74, bodyTilt: 360, bodyCurl: 0, leftArm: 20, rightArm: -20, leftLeg: 10, rightLeg: -10 }),
    ],
  },
  {
    id: 'back-fall',
    name: 'Chute arriere',
    tone: 'impact',
    durationMs: 1250,
    intensity: 70,
    landingWeight: 88,
    keyframes: [
      pose(0, 'Surprise', { rootX: 46, rootY: 70, bodyTilt: -8, headTilt: -8, leftArm: -82, rightArm: 82, leftLeg: 18, rightLeg: -18 }),
      pose(32, 'Bascule', { rootX: 48, rootY: 72, bodyTilt: -62, bodyCurl: 6, headTilt: 24, leftArm: -112, rightArm: 116, leftLeg: 66, leftShin: -62, rightLeg: -62, rightShin: 70 }),
      pose(68, 'Impact', { rootX: 52, rootY: 81, bodyTilt: -100, bodyCurl: 26, headTilt: 30, leftArm: -138, rightArm: 126, leftLeg: 86, leftShin: -88, rightLeg: -90, rightShin: 96 }),
      pose(100, 'Amorti', { rootX: 58, rootY: 82, bodyTilt: -86, bodyCurl: 48, headTilt: 12, leftArm: -94, rightArm: 94, leftLeg: 72, leftShin: -72, rightLeg: -78, rightShin: 86 }),
    ],
  },
  {
    id: 'jump-kick',
    name: 'Coup saute',
    tone: 'strike',
    durationMs: 980,
    intensity: 86,
    landingWeight: 64,
    keyframes: [
      pose(0, 'Appui', { rootX: 18, rootY: 76, bodyTilt: -12, bodyCurl: -10, leftArm: 64, rightArm: -74, leftLeg: 30, leftShin: -36, rightLeg: -18 }),
      pose(28, 'Monte', { rootX: 35, rootY: 55, bodyTilt: 20, bodyCurl: 14, leftArm: 92, rightArm: -106, leftLeg: 86, leftShin: -108, rightLeg: -74, rightShin: 88 }),
      pose(58, 'Frappe', { rootX: 58, rootY: 47, bodyTilt: 34, bodyCurl: -8, headTilt: -8, leftArm: 118, rightArm: -122, leftLeg: 104, leftShin: -118, rightLeg: -112, rightShin: -18 }),
      pose(82, 'Rappel', { rootX: 76, rootY: 60, bodyTilt: 10, bodyCurl: 20, leftArm: 72, rightArm: -78, leftLeg: 64, leftShin: -70, rightLeg: -62, rightShin: 86 }),
      pose(100, 'Pose', { rootX: 84, rootY: 76, bodyTilt: -4, bodyCurl: -12, leftArm: 28, rightArm: -34, leftLeg: 16, rightLeg: -16 }),
    ],
  },
  {
    id: 'slide-dodge',
    name: 'Esquive glissee',
    tone: 'ground',
    durationMs: 820,
    intensity: 58,
    landingWeight: 38,
    keyframes: [
      pose(0, 'Declenche', { rootX: 18, rootY: 74, bodyTilt: 8, leftArm: 40, rightArm: -54, leftLeg: 18, rightLeg: -12 }),
      pose(30, 'Plonge', { rootX: 34, rootY: 82, bodyTilt: 70, bodyCurl: 16, headTilt: -16, leftArm: 92, rightArm: -96, leftLeg: 82, leftShin: -24, rightLeg: -72, rightShin: 34 }),
      pose(70, 'Glisse', { rootX: 64, rootY: 84, bodyTilt: 82, bodyCurl: 8, leftArm: 118, rightArm: -118, leftLeg: 96, leftShin: -12, rightLeg: -88, rightShin: 20 }),
      pose(100, 'Releve', { rootX: 82, rootY: 76, bodyTilt: 14, bodyCurl: -8, leftArm: 28, rightArm: -34, leftLeg: 20, rightLeg: -14 }),
    ],
  },
  {
    id: 'heavy-land',
    name: 'Reception lourde',
    tone: 'impact',
    durationMs: 760,
    intensity: 66,
    landingWeight: 96,
    keyframes: [
      pose(0, 'Descente', { rootX: 48, rootY: 42, bodyTilt: 0, leftArm: -84, rightArm: -92, leftLeg: 44, rightLeg: -44 }),
      pose(56, 'Choc', { rootX: 50, rootY: 80, bodyTilt: 8, bodyCurl: 54, headTilt: 16, leftArm: 102, rightArm: -104, leftLeg: 62, leftShin: -98, rightLeg: -60, rightShin: 98 }),
      pose(100, 'Stabilise', { rootX: 52, rootY: 76, bodyTilt: 0, bodyCurl: 8, leftArm: 28, rightArm: -30, leftLeg: 24, leftShin: -32, rightLeg: -22, rightShin: 34 }),
    ],
  },
];

const RIG_PRESETS = [
  { id: 'humanoid', label: 'Humanoid' },
  { id: 'mixamo', label: 'Mixamo' },
  { id: 'auto', label: 'Auto bones' },
];

const cloneKeyframe = (keyframe) => ({
  ...clampPoseFields({ ...BASE_POSE, ...keyframe }),
  id: keyframe?.id || makeLocalId('pose'),
  label: keyframe?.label || 'Mouvement',
  time: clamp(keyframe?.time, 0, 100),
});

const sortKeyframes = (keyframes = []) => [...keyframes].sort((a, b) => Number(a.time) - Number(b.time));

const createClipFromPreset = (preset = STUNT_PRESETS[0], targetCharacterId = '') => ({
  id: makeLocalId('stunt'),
  name: preset.name,
  targetCharacterId,
  rigPreset: 'humanoid',
  durationMs: preset.durationMs,
  intensity: preset.intensity,
  landingWeight: preset.landingWeight,
  loop: false,
  keyframes: preset.keyframes.map((keyframe) => cloneKeyframe({ ...keyframe, id: makeLocalId('pose') })),
});

const normalizeClip = (clip, targetCharacterId = '') => {
  const preset = STUNT_PRESETS[0];
  const keyframes = sortKeyframes(Array.isArray(clip?.keyframes) && clip.keyframes.length >= 1
    ? clip.keyframes.map(cloneKeyframe)
    : [cloneKeyframe(preset.keyframes[0])]);

  return {
    id: clip?.id || makeLocalId('stunt'),
    name: clip?.name || preset.name,
    targetCharacterId: clip?.targetCharacterId || targetCharacterId,
    rigPreset: RIG_PRESETS.some((entry) => entry.id === clip?.rigPreset) ? clip.rigPreset : 'humanoid',
    durationMs: clamp(clip?.durationMs || preset.durationMs, 250, 8000),
    intensity: clamp(clip?.intensity ?? preset.intensity, 0, 100),
    landingWeight: clamp(clip?.landingWeight ?? preset.landingWeight, 0, 100),
    loop: Boolean(clip?.loop),
    keyframes,
  };
};

const interpolatePose = (keyframes, progress) => {
  const sorted = sortKeyframes(keyframes);
  if (!sorted.length) return { ...BASE_POSE, time: progress };
  if (progress <= sorted[0].time) return { ...sorted[0] };
  if (progress >= sorted[sorted.length - 1].time) return { ...sorted[sorted.length - 1] };
  const next = sorted.find((keyframe) => keyframe.time >= progress) || sorted[sorted.length - 1];
  const previousIndex = Math.max(0, sorted.indexOf(next) - 1);
  const previous = sorted[previousIndex];
  const span = Math.max(1, next.time - previous.time);
  const amount = smooth((progress - previous.time) / span);
  const result = { ...previous, id: 'preview', label: 'Preview', time: progress };
  POSE_FIELDS.forEach(({ id }) => {
    result[id] = rounded(previous[id] + ((next[id] - previous[id]) * amount), 3);
  });
  return result;
};

const createKeyframesForMovementCount = (keyframes = [], requestedCount = 1) => {
  const count = clampMovementCount(requestedCount);
  const sorted = sortKeyframes(keyframes.length ? keyframes.map(cloneKeyframe) : [cloneKeyframe(BASE_POSE)]);
  return Array.from({ length: count }, (_, index) => {
    const time = count === 1 ? 0 : rounded((index / (count - 1)) * 100, 2);
    const exact = sorted.find((keyframe) => Math.abs((Number(keyframe.time) || 0) - time) < 0.01);
    const source = exact || interpolatePose(sorted, time);
    return cloneKeyframe({
      ...source,
      id: exact?.id || makeLocalId('pose'),
      label: exact?.label || `Mouvement ${index + 1}`,
      time,
    });
  });
};

const pointFrom = (origin, length, angleDeg, scale = 1) => {
  const rad = (angleDeg * Math.PI) / 180;
  return {
    x: origin.x + (Math.sin(rad) * length * scale),
    y: origin.y + (Math.cos(rad) * length * scale),
  };
};

const angleBetweenPoints = (from, to) => {
  if (!from || !to) return 0;
  return (Math.atan2(to.x - from.x, to.y - from.y) * 180) / Math.PI;
};

const normalizeSignedAngle = (value) => {
  let next = Number(value) || 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
};

const nearestAngle = (value, current = 0) => {
  let next = Number(value) || 0;
  const base = Number(current) || 0;
  while (next - base > 180) next -= 360;
  while (next - base < -180) next += 360;
  return next;
};

const buildFigure = (currentPose) => {
  const scale = 1;
  const hip = { x: currentPose.rootX, y: currentPose.rootY };
  const shoulder = pointFrom(hip, 17, 180 + currentPose.bodyTilt + (currentPose.bodyCurl * 0.18), scale);
  const chest = pointFrom(hip, 9, 180 + currentPose.bodyTilt + (currentPose.bodyCurl * 0.25), scale);
  const neck = pointFrom(shoulder, 4, 180 + currentPose.bodyTilt + (currentPose.headTilt * 0.16), scale);
  const head = pointFrom(neck, 5, 180 + currentPose.bodyTilt + (currentPose.headTilt * 0.42), scale);
  const leftElbow = pointFrom(shoulder, 10, currentPose.leftArm, scale);
  const leftHand = pointFrom(leftElbow, 9, currentPose.leftArm + currentPose.leftForearm, scale);
  const rightElbow = pointFrom(shoulder, 10, currentPose.rightArm, scale);
  const rightHand = pointFrom(rightElbow, 9, currentPose.rightArm + currentPose.rightForearm, scale);
  const leftKnee = pointFrom(hip, 12, currentPose.leftLeg, scale);
  const leftFoot = pointFrom(leftKnee, 12, currentPose.leftLeg + currentPose.leftShin, scale);
  const rightKnee = pointFrom(hip, 12, currentPose.rightLeg, scale);
  const rightFoot = pointFrom(rightKnee, 12, currentPose.rightLeg + currentPose.rightShin, scale);

  return {
    hip,
    chest,
    shoulder,
    neck,
    head,
    leftElbow,
    leftHand,
    rightElbow,
    rightHand,
    leftKnee,
    leftFoot,
    rightKnee,
    rightFoot,
  };
};

const line = (from, to, className, width = 3.2) => (
  <line
    className={className}
    x1={from.x}
    y1={from.y}
    x2={to.x}
    y2={to.y}
    strokeWidth={width}
    strokeLinecap="round"
  />
);

const buildMotionPath = (keyframes) => {
  const points = sortKeyframes(keyframes).map((keyframe) => `${rounded(keyframe.rootX, 1)},${rounded(keyframe.rootY, 1)}`);
  return points.length ? `M ${points.join(' L ')}` : '';
};

const buildJointHandles = (figure) => [
  { id: 'hip', point: figure.hip, main: true },
  { id: 'shoulder', point: figure.shoulder, main: true },
  { id: 'head', point: figure.head, head: true },
  { id: 'leftElbow', point: figure.leftElbow },
  { id: 'rightElbow', point: figure.rightElbow },
  { id: 'leftKnee', point: figure.leftKnee },
  { id: 'rightKnee', point: figure.rightKnee },
  { id: 'leftHand', point: figure.leftHand, end: true },
  { id: 'rightHand', point: figure.rightHand, end: true },
  { id: 'leftFoot', point: figure.leftFoot, end: true },
  { id: 'rightFoot', point: figure.rightFoot, end: true },
];

const makeRigFrame = (keyframe, durationMs) => ({
  timeMs: Math.round((keyframe.time / 100) * durationMs),
  root: {
    translateX: rounded((keyframe.rootX - 50) / 50, 3),
    translateY: rounded((76 - keyframe.rootY) / 50, 3),
    rotateY: rounded(keyframe.bodyYaw, 2),
    rotateZ: rounded(keyframe.bodyTilt, 2),
  },
  bones: {
    Hips: { rotateY: rounded(keyframe.bodyYaw * 0.25, 2), rotateZ: rounded(keyframe.bodyTilt * 0.55, 2) },
    Spine: { rotateX: rounded(keyframe.bodyCurl, 2), rotateY: rounded(keyframe.bodyTwist, 2), rotateZ: rounded(keyframe.bodyTilt * 0.3, 2) },
    Head: { rotateX: rounded(keyframe.headTilt, 2), rotateY: rounded(keyframe.headYaw, 2) },
    LeftUpperArm: { rotateX: rounded(keyframe.leftArm, 2), rotateY: rounded(keyframe.leftArmSide, 2) },
    LeftLowerArm: { rotateX: rounded(keyframe.leftForearm, 2), rotateY: rounded(keyframe.leftForearmSide, 2) },
    RightUpperArm: { rotateX: rounded(keyframe.rightArm, 2), rotateY: rounded(keyframe.rightArmSide, 2) },
    RightLowerArm: { rotateX: rounded(keyframe.rightForearm, 2), rotateY: rounded(keyframe.rightForearmSide, 2) },
    LeftUpperLeg: { rotateX: rounded(keyframe.leftLeg, 2), rotateY: rounded(keyframe.leftLegSide, 2) },
    LeftLowerLeg: { rotateX: rounded(keyframe.leftShin, 2), rotateY: rounded(keyframe.leftShinSide, 2) },
    RightUpperLeg: { rotateX: rounded(keyframe.rightLeg, 2), rotateY: rounded(keyframe.rightLegSide, 2) },
    RightLowerLeg: { rotateX: rounded(keyframe.rightShin, 2), rotateY: rounded(keyframe.rightShinSide, 2) },
  },
});

const buildExportPayload = (clip, characters = []) => {
  const targetCharacter = characters.find((entry) => entry.id === clip.targetCharacterId);
  return {
    version: 1,
    type: 'escape-game-builder.stunt-animation',
    name: clip.name,
    durationMs: clip.durationMs,
    loop: clip.loop,
    rigPreset: clip.rigPreset,
    targetCharacterId: clip.targetCharacterId,
    targetCharacterName: targetCharacter?.name || '',
    intensity: clip.intensity,
    landingWeight: clip.landingWeight,
    keyframes: clip.keyframes,
    rigFrames: clip.keyframes.map((keyframe) => makeRigFrame(keyframe, clip.durationMs)),
  };
};

const FieldRange = ({ field, value, onChange, active = false }) => (
  <label className={`stunt-range ${active ? 'active' : ''}`}>
    <span>
      {field.label}
      <strong>{Math.round(Number(value) || 0)}</strong>
    </span>
    <input
      type="range"
      min={field.min}
      max={field.max}
      step={field.step}
      value={Number(value) || 0}
      onChange={(event) => onChange(field.id, Number(event.target.value))}
    />
  </label>
);

export default function StuntAnimationTab({ project, patchProject }) {
  const characters = project.characterModels3d || [];
  const defaultCharacterId = characters[0]?.id || '';
  const storedClips = Array.isArray(project.stuntAnimations) ? project.stuntAnimations : [];
  const clips = useMemo(
    () => storedClips.map((clip) => normalizeClip(clip, defaultCharacterId)),
    [defaultCharacterId, storedClips]
  );
  const [selectedClipId, setSelectedClipId] = useState(storedClips[0]?.id || '');
  const [selectedKeyframeId, setSelectedKeyframeId] = useState('');
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [activeJointId, setActiveJointId] = useState('');
  const [movementCountDraft, setMovementCountDraft] = useState('');
  const playbackRef = useRef({ start: 0, progress: 0, frame: 0 });

  useEffect(() => {
    if (storedClips.length) return;
    const firstClip = createClipFromPreset(STUNT_PRESETS[0], defaultCharacterId);
    patchProject((draft) => {
      draft.stuntAnimations = [firstClip];
    }, { rememberHistory: false });
    setSelectedClipId(firstClip.id);
    setSelectedKeyframeId(firstClip.keyframes[0]?.id || '');
  }, [defaultCharacterId, patchProject, storedClips.length]);

  useEffect(() => {
    if (!clips.length) return;
    if (!clips.some((clip) => clip.id === selectedClipId)) {
      setSelectedClipId(clips[0].id);
    }
  }, [clips, selectedClipId]);

  const selectedClip = clips.find((clip) => clip.id === selectedClipId) || clips[0] || null;
  const selectedKeyframe = selectedClip?.keyframes.find((keyframe) => keyframe.id === selectedKeyframeId)
    || selectedClip?.keyframes[0]
    || null;
  const currentPose = useMemo(
    () => selectedClip ? interpolatePose(selectedClip.keyframes, progress) : BASE_POSE,
    [progress, selectedClip]
  );
  const activeRotationFields = useMemo(() => {
    const ids = activeJointId ? BONE_ROTATION_FIELD_MAP[activeJointId] || [] : [];
    return ROTATION_POSE_FIELDS.filter((field) => ids.includes(field.id));
  }, [activeJointId]);
  const exportPayload = useMemo(
    () => selectedClip ? buildExportPayload(selectedClip, characters) : null,
    [characters, selectedClip]
  );

  useEffect(() => {
    if (!selectedClip || selectedKeyframeId) return;
    setSelectedKeyframeId(selectedClip.keyframes[0]?.id || '');
  }, [selectedClip, selectedKeyframeId]);

  useEffect(() => {
    if (!selectedClip) return;
    setMovementCountDraft(String(selectedClip.keyframes.length));
  }, [selectedClip?.id, selectedClip?.keyframes.length]);

  useEffect(() => {
    if (!isPlaying || !selectedClip) return undefined;
    const duration = Math.max(250, Number(selectedClip.durationMs) || 1000);
    const startProgress = clamp(playbackRef.current.progress ?? progress, 0, 100);
    playbackRef.current.start = performance.now() - ((startProgress / 100) * duration);

    const tick = (now) => {
      const elapsed = now - playbackRef.current.start;
      const nextProgress = selectedClip.loop
        ? ((elapsed % duration) / duration) * 100
        : Math.min(100, (elapsed / duration) * 100);
      setProgress(nextProgress);
      if (!selectedClip.loop && nextProgress >= 100) {
        window.clearInterval(playbackRef.current.frame);
        setIsPlaying(false);
      }
    };

    tick(performance.now());
    playbackRef.current.frame = window.setInterval(() => tick(performance.now()), 16);
    return () => window.clearInterval(playbackRef.current.frame);
  }, [isPlaying, selectedClip]);

  const togglePlayback = useCallback(() => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }
    const startProgress = progress >= 99.9 ? 0 : progress;
    playbackRef.current.progress = startProgress;
    setProgress(startProgress);
    setIsPlaying(true);
  }, [isPlaying, progress]);

  const patchSelectedClip = useCallback((updater, options = {}) => {
    if (!selectedClipId) return;
    patchProject((draft) => {
      if (!Array.isArray(draft.stuntAnimations)) draft.stuntAnimations = [];
      const clip = draft.stuntAnimations.find((entry) => entry.id === selectedClipId);
      if (clip) updater(clip);
    }, options);
  }, [patchProject, selectedClipId]);

  const createClip = useCallback((preset = STUNT_PRESETS[0]) => {
    const nextClip = createClipFromPreset(preset, defaultCharacterId);
    patchProject((draft) => {
      if (!Array.isArray(draft.stuntAnimations)) draft.stuntAnimations = [];
      draft.stuntAnimations.push(nextClip);
    });
    setSelectedClipId(nextClip.id);
    setSelectedKeyframeId(nextClip.keyframes[0]?.id || '');
    setProgress(0);
    setStatus('Cascade creee');
  }, [defaultCharacterId, patchProject]);

  const duplicateClip = useCallback(() => {
    if (!selectedClip) return;
    const copy = {
      ...selectedClip,
      id: makeLocalId('stunt'),
      name: `${selectedClip.name} copie`,
      keyframes: selectedClip.keyframes.map((keyframe) => ({ ...keyframe, id: makeLocalId('pose') })),
    };
    patchProject((draft) => {
      if (!Array.isArray(draft.stuntAnimations)) draft.stuntAnimations = [];
      draft.stuntAnimations.push(copy);
    });
    setSelectedClipId(copy.id);
    setSelectedKeyframeId(copy.keyframes[0]?.id || '');
    setStatus('Cascade dupliquee');
  }, [patchProject, selectedClip]);

  const deleteClip = useCallback(() => {
    if (!selectedClip) return;
    const nextClipId = clips.find((clip) => clip.id !== selectedClip.id)?.id || '';
    patchProject((draft) => {
      draft.stuntAnimations = (draft.stuntAnimations || []).filter((clip) => clip.id !== selectedClip.id);
      if (!draft.stuntAnimations.length) {
        draft.stuntAnimations.push(createClipFromPreset(STUNT_PRESETS[0], defaultCharacterId));
      }
    });
    setSelectedClipId(nextClipId);
    setProgress(0);
    setStatus('Cascade supprimee');
  }, [clips, defaultCharacterId, patchProject, selectedClip]);

  const applyPreset = useCallback((preset) => {
    if (!selectedClip) return;
    const replacement = createClipFromPreset(preset, selectedClip.targetCharacterId || defaultCharacterId);
    patchSelectedClip((clip) => {
      Object.assign(clip, {
        ...replacement,
        id: clip.id,
        targetCharacterId: clip.targetCharacterId || replacement.targetCharacterId,
        rigPreset: clip.rigPreset || replacement.rigPreset,
      });
    });
    setSelectedKeyframeId(replacement.keyframes[0]?.id || '');
    setProgress(0);
    setStatus('Preset applique');
  }, [defaultCharacterId, patchSelectedClip, selectedClip]);

  const patchClipField = useCallback((field, value) => {
    patchSelectedClip((clip) => {
      if (field === 'name') clip.name = value;
      if (field === 'targetCharacterId') clip.targetCharacterId = value;
      if (field === 'rigPreset') clip.rigPreset = value;
      if (field === 'durationMs') clip.durationMs = clamp(value, 250, 8000);
      if (field === 'intensity') clip.intensity = clamp(value, 0, 100);
      if (field === 'landingWeight') clip.landingWeight = clamp(value, 0, 100);
      if (field === 'loop') clip.loop = Boolean(value);
    }, { rememberHistory: false });
  }, [patchSelectedClip]);

  const applyMovementCount = useCallback((rawValue = movementCountDraft) => {
    if (!selectedClip) return;
    const count = clampMovementCount(rawValue || selectedClip.keyframes.length);
    const nextKeyframes = createKeyframesForMovementCount(selectedClip.keyframes, count);
    const nextSelection = nextKeyframes.find((keyframe) => Math.abs((Number(keyframe.time) || 0) - progress) < 0.01)
      || nextKeyframes.find((keyframe) => (Number(keyframe.time) || 0) >= progress)
      || nextKeyframes[nextKeyframes.length - 1]
      || nextKeyframes[0];
    patchSelectedClip((clip) => {
      clip.keyframes = nextKeyframes;
    });
    setMovementCountDraft(String(count));
    setSelectedKeyframeId(nextSelection?.id || '');
    setProgress(Number(nextSelection?.time) || 0);
    playbackRef.current.progress = Number(nextSelection?.time) || 0;
    setStatus(`${count} mouvement${count > 1 ? 's' : ''}`);
  }, [movementCountDraft, patchSelectedClip, progress, selectedClip]);

  const selectKeyframe = useCallback((keyframe) => {
    setIsPlaying(false);
    setSelectedKeyframeId(keyframe.id);
    setProgress(Number(keyframe.time) || 0);
    playbackRef.current.progress = Number(keyframe.time) || 0;
  }, []);

  const patchKeyframeFields = useCallback((updates) => {
    if (!selectedKeyframe?.id) return;
    const normalizedUpdates = {};
    patchSelectedClip((clip) => {
      const keyframe = (clip.keyframes || []).find((entry) => entry.id === selectedKeyframe.id);
      if (!keyframe) return;
      Object.entries(updates).forEach(([field, value]) => {
        if (field === 'label') {
          keyframe.label = value;
          normalizedUpdates.label = value;
          return;
        }
        if (field === 'time') {
          const nextTime = clamp(value, 0, 100);
          keyframe.time = nextTime;
          normalizedUpdates.time = nextTime;
          return;
        }
        if (!POSE_FIELDS.some((entry) => entry.id === field)) return;
        const nextValue = clampPoseFieldValue(field, value);
        keyframe[field] = nextValue;
        normalizedUpdates[field] = nextValue;
      });
      clip.keyframes = sortKeyframes(clip.keyframes);
    }, { rememberHistory: false });
    if (Object.prototype.hasOwnProperty.call(normalizedUpdates, 'time')) {
      setProgress(normalizedUpdates.time);
      playbackRef.current.progress = normalizedUpdates.time;
    }
  }, [patchSelectedClip, selectedKeyframe]);

  const patchKeyframeField = useCallback((field, value) => {
    patchKeyframeFields({ [field]: value });
  }, [patchKeyframeFields]);

  const activateJoint = useCallback((jointId) => {
    if (!selectedKeyframe) return;
    setIsPlaying(false);
    setActiveJointId(jointId);
    setProgress(Number(selectedKeyframe.time) || 0);
    playbackRef.current.progress = Number(selectedKeyframe.time) || 0;
    setStatus(`${JOINT_LABELS[jointId] || 'Os'} selectionne`);
  }, [selectedKeyframe]);

  const patchJointFromDrag = useCallback((jointId, movement = {}) => {
    if (!selectedKeyframe) return;
    const dragFields = getJointDragFields(jointId, 'front');
    if (!dragFields) return;
    const dx = Number(movement.dx) || 0;
    const dy = Number(movement.dy) || 0;
    const updates = {};
    Object.entries(dragFields).forEach(([field, config]) => {
      const scaleX = Number(config?.x) || 0;
      const scaleY = Number(config?.y) || 0;
      updates[field] = (Number(selectedKeyframe[field]) || 0) + (dx * scaleX) + (dy * scaleY);
    });
    patchKeyframeFields(updates);
  }, [patchKeyframeFields, selectedKeyframe]);

  const finishJointDrag = useCallback((jointId) => {
    setStatus(`${JOINT_LABELS[jointId] || 'Mouvement'} ajuste`);
  }, []);

  const addKeyframe = useCallback(() => {
    if (!selectedClip) return;
    const nextKeyframe = {
      ...currentPose,
      id: makeLocalId('pose'),
      label: `Mouvement ${selectedClip.keyframes.length + 1}`,
      time: Math.round(progress),
    };
    patchSelectedClip((clip) => {
      if (!Array.isArray(clip.keyframes)) clip.keyframes = [];
      clip.keyframes.push(nextKeyframe);
      clip.keyframes = sortKeyframes(clip.keyframes);
    });
    setSelectedKeyframeId(nextKeyframe.id);
    setMovementCountDraft(String(selectedClip.keyframes.length + 1));
    setStatus('Mouvement ajoute');
  }, [currentPose, patchSelectedClip, progress, selectedClip]);

  const deleteKeyframe = useCallback(() => {
    if (!selectedClip || !selectedKeyframe || selectedClip.keyframes.length <= 1) return;
    const fallback = selectedClip.keyframes.find((keyframe) => keyframe.id !== selectedKeyframe.id);
    patchSelectedClip((clip) => {
      clip.keyframes = (clip.keyframes || []).filter((keyframe) => keyframe.id !== selectedKeyframe.id);
    });
    setMovementCountDraft(String(Math.max(1, selectedClip.keyframes.length - 1)));
    setSelectedKeyframeId(fallback?.id || '');
    setProgress(fallback?.time || 0);
    setStatus('Mouvement supprime');
  }, [patchSelectedClip, selectedClip, selectedKeyframe]);

  const copyExport = useCallback(async () => {
    if (!exportPayload) return;
    const text = JSON.stringify(exportPayload, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setStatus('JSON copie');
    } catch {
      setStatus('Copie indisponible');
    }
  }, [exportPayload]);

  const downloadExport = useCallback(() => {
    if (!exportPayload) return;
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(selectedClip?.name || 'cascade').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setStatus('JSON exporte');
  }, [exportPayload, selectedClip?.name]);

  if (!selectedClip) {
    return (
      <section className="panel stunt-empty">
        <button type="button" onClick={() => createClip(STUNT_PRESETS[0])}>
          <Plus aria-hidden="true" size={16} />
          Creer une cascade
        </button>
      </section>
    );
  }

  return (
    <div className="stunt-tab">
      <section className="panel stunt-library-panel">
        <div className="stunt-panel-head">
          <div>
            <span className="eyebrow">Animation</span>
            <h2>Cascadeur</h2>
          </div>
          <button type="button" className="secondary-action stunt-icon-button" title="Nouvelle cascade" onClick={() => createClip(STUNT_PRESETS[0])}>
            <Plus aria-hidden="true" size={16} />
          </button>
        </div>

        <div className="stunt-clip-list">
          {clips.map((clip) => (
            <button
              type="button"
              key={clip.id}
              className={`stunt-clip-button ${clip.id === selectedClip.id ? 'selected' : ''}`}
              onClick={() => {
                setSelectedClipId(clip.id);
                setSelectedKeyframeId(clip.keyframes[0]?.id || '');
                setProgress(0);
              }}
            >
              <strong>{clip.name}</strong>
              <span>{clip.keyframes.length} mouvements - {clip.durationMs} ms</span>
            </button>
          ))}
        </div>

        <div className="stunt-preset-grid">
          {STUNT_PRESETS.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={`stunt-preset-button ${preset.tone}`}
              onClick={() => applyPreset(preset)}
            >
              <Sparkles aria-hidden="true" size={14} />
              <span>{preset.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel stunt-preview-panel">
        <div className="stunt-panel-head stunt-preview-head">
          <div className="stunt-preview-title">
            <span className="eyebrow">Preview</span>
            <h2>{selectedClip.name}</h2>
          </div>
          <div className="stunt-playbar stunt-playbar-inline">
            <button
              type="button"
              className="stunt-play-button"
              onClick={togglePlayback}
            >
              {isPlaying ? <Pause aria-hidden="true" size={17} /> : <Play aria-hidden="true" size={17} />}
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={progress}
              onChange={(event) => {
                const nextProgress = Number(event.target.value);
                setIsPlaying(false);
                playbackRef.current.progress = nextProgress;
                setProgress(nextProgress);
              }}
            />
            <strong>{Math.round(progress)}%</strong>
            <button
              type="button"
              className="secondary-action stunt-icon-button"
              title="Retour debut"
              onClick={() => {
                setIsPlaying(false);
                playbackRef.current.progress = 0;
                setProgress(0);
              }}
            >
              <RotateCcw aria-hidden="true" size={15} />
            </button>
          </div>
          <div className="stunt-head-actions">
            <button type="button" className="secondary-action" onClick={duplicateClip}>
              <Copy aria-hidden="true" size={15} />
              Dupliquer
            </button>
            <button type="button" className="danger-button" onClick={deleteClip}>
              <Trash2 aria-hidden="true" size={15} />
              Supprimer
            </button>
          </div>
        </div>

        <div className={`stunt-stage stunt-tone-${selectedClip.landingWeight > 80 ? 'heavy' : selectedClip.intensity > 78 ? 'fast' : 'balanced'}`}>
          <StuntCharacter3DPreview
            pose={currentPose}
            keyframes={selectedClip.keyframes}
            activeJointId={activeJointId}
            onJointSelect={activateJoint}
            onJointDrag={patchJointFromDrag}
            onJointDragEnd={finishJointDrag}
          />
        </div>

        <div className="stunt-timeline">
          {selectedClip.keyframes.map((keyframe) => (
            <button
              type="button"
              key={keyframe.id}
              className={`stunt-keyframe-button ${keyframe.id === selectedKeyframe?.id ? 'active' : ''}`}
              aria-pressed={keyframe.id === selectedKeyframe?.id}
              style={{ '--pose-time': `${keyframe.time}%` }}
              onClick={() => selectKeyframe(keyframe)}
              title={`${keyframe.label} - ${Math.round(keyframe.time)}%`}
            >
              <span className="stunt-keyframe-dot" aria-hidden="true" />
              <span className="stunt-keyframe-copy">
                <span>{keyframe.label}</span>
                <em>{Math.round(keyframe.time)}%</em>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel stunt-editor-panel">
        <div className="stunt-panel-head">
          <div>
            <span className="eyebrow">Reglages</span>
            <h2>Clip</h2>
          </div>
          <span className="stunt-status">{status || 'Sauvegarde auto'}</span>
        </div>

        <div className="stunt-form-grid">
          <label>
            Nom
            <input value={selectedClip.name} onChange={(event) => patchClipField('name', event.target.value)} />
          </label>
          <label>
            Personnage
            <select value={selectedClip.targetCharacterId} onChange={(event) => patchClipField('targetCharacterId', event.target.value)}>
              <option value="">Aucun</option>
              {characters.map((character) => (
                <option key={character.id} value={character.id}>{character.name}</option>
              ))}
            </select>
          </label>
          <label>
            Rig
            <select value={selectedClip.rigPreset} onChange={(event) => patchClipField('rigPreset', event.target.value)}>
              {RIG_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>{preset.label}</option>
              ))}
            </select>
          </label>
          <label>
            Duree ms
            <input type="number" min="250" max="8000" step="50" value={selectedClip.durationMs} onChange={(event) => patchClipField('durationMs', event.target.value)} />
          </label>
        </div>

        <div className="stunt-movement-count-row">
          <label>
            Mouvements
            <input
              aria-label="Nombre de mouvements"
              type="number"
              min={MIN_MOVEMENT_COUNT}
              max={MAX_MOVEMENT_COUNT}
              step="1"
              value={movementCountDraft}
              onChange={(event) => setMovementCountDraft(event.target.value)}
              onBlur={(event) => applyMovementCount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                applyMovementCount(event.currentTarget.value);
              }}
            />
          </label>
          <button type="button" className="secondary-action" onClick={() => applyMovementCount()}>
            Ajuster
          </button>
        </div>

        <div className="stunt-two-ranges">
          <FieldRange field={{ id: 'intensity', label: 'Energie', min: 0, max: 100, step: 1 }} value={selectedClip.intensity} onChange={patchClipField} />
          <FieldRange field={{ id: 'landingWeight', label: 'Impact', min: 0, max: 100, step: 1 }} value={selectedClip.landingWeight} onChange={patchClipField} />
        </div>

        <label className="stunt-check">
          <input type="checkbox" checked={selectedClip.loop} onChange={(event) => patchClipField('loop', event.target.checked)} />
          Boucle
        </label>

        <div className="stunt-section-head">
          <h3>Mouvement</h3>
          <div>
            <button type="button" className="secondary-action stunt-icon-button" title="Ajouter mouvement" onClick={addKeyframe}>
              <Plus aria-hidden="true" size={15} />
            </button>
            <button type="button" className="secondary-action stunt-icon-button" title="Reset mouvement" onClick={() => {
              Object.entries(BASE_POSE).forEach(([field, value]) => patchKeyframeField(field, value));
              setStatus('Mouvement reset');
            }}>
              <RefreshCcw aria-hidden="true" size={15} />
            </button>
            <button type="button" className="danger-button stunt-icon-button" title="Supprimer mouvement" disabled={selectedClip.keyframes.length <= 1} onClick={deleteKeyframe}>
              <Trash2 aria-hidden="true" size={15} />
            </button>
          </div>
        </div>

        {selectedKeyframe ? (
          <>
            <div className="stunt-form-grid">
              <label>
                Label
                <input value={selectedKeyframe.label} onChange={(event) => patchKeyframeField('label', event.target.value)} />
              </label>
              <label>
                Timing %
                <input type="number" min="0" max="100" step="1" value={Math.round(selectedKeyframe.time)} onChange={(event) => patchKeyframeField('time', event.target.value)} />
              </label>
            </div>
            <div className="stunt-pose-controls">
              {MOTION_POSE_FIELDS.map((field) => (
                <FieldRange
                  key={field.id}
                  field={field}
                  value={selectedKeyframe[field.id]}
                  onChange={patchKeyframeField}
                  active={(JOINT_FIELD_MAP[activeJointId] || []).includes(field.id)}
                />
              ))}
            </div>
            {activeRotationFields.length ? (
              <div className="stunt-bone-rotation-panel">
                <div className="stunt-bone-rotation-head">
                  <span>Rotation os</span>
                  <strong>{JOINT_LABELS[activeJointId]}</strong>
                </div>
                <div className="stunt-pose-controls">
                  {activeRotationFields.map((field) => (
                    <FieldRange
                      key={field.id}
                      field={field}
                      value={selectedKeyframe[field.id]}
                      onChange={patchKeyframeField}
                      active={(JOINT_FIELD_MAP[activeJointId] || []).includes(field.id)}
                    />
                  ))}
                </div>
              </div>
            ) : null}
          </>
        ) : null}

        <div className="stunt-export-actions">
          <button type="button" className="secondary-action" onClick={copyExport}>
            <Copy aria-hidden="true" size={15} />
            Copier JSON
          </button>
          <button type="button" className="secondary-action" onClick={downloadExport}>
            <Download aria-hidden="true" size={15} />
            Exporter
          </button>
          <span><Save aria-hidden="true" size={14} /> {selectedClip.keyframes.length} mouvements</span>
        </div>
      </section>
    </div>
  );
}
