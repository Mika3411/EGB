import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
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
  { id: 'bodyTilt', label: 'Corps', min: -420, max: 420, step: 1 },
  { id: 'bodyYaw', label: 'Tour Y', min: -180, max: 180, step: 1 },
  { id: 'bodyCurl', label: 'Courbe', min: -35, max: 95, step: 1 },
  { id: 'headTilt', label: 'Tete', min: -55, max: 55, step: 1 },
  { id: 'leftArm', label: 'Bras G', min: -96, max: 96, step: 1 },
  { id: 'leftForearm', label: 'Avant G', min: -118, max: 0, step: 1 },
  { id: 'rightArm', label: 'Bras D', min: -96, max: 96, step: 1 },
  { id: 'rightForearm', label: 'Avant D', min: 0, max: 118, step: 1 },
  { id: 'leftLeg', label: 'Jambe G', min: -76, max: 76, step: 1 },
  { id: 'leftShin', label: 'Tibia G', min: -96, max: 0, step: 1 },
  { id: 'rightLeg', label: 'Jambe D', min: -76, max: 76, step: 1 },
  { id: 'rightShin', label: 'Tibia D', min: 0, max: 96, step: 1 },
];

const ROTATION_POSE_FIELDS = [
  { id: 'bodyTwist', label: 'Torse Y', min: -55, max: 55, step: 1 },
  { id: 'bodyRoll', label: 'Torse Z', min: -70, max: 70, step: 1 },
  { id: 'lowerBodyTwist', label: 'Bas Y', min: -70, max: 70, step: 1 },
  { id: 'lowerBodyRoll', label: 'Bas Z', min: -70, max: 70, step: 1 },
  { id: 'shoulderRoll', label: 'Epaules Z', min: -45, max: 45, step: 1 },
  { id: 'headYaw', label: 'Tete Y', min: -60, max: 60, step: 1 },
  { id: 'leftArmSide', label: 'Bras G Y', min: -56, max: 56, step: 1 },
  { id: 'leftForearmSide', label: 'Avant G Y', min: -64, max: 64, step: 1 },
  { id: 'rightArmSide', label: 'Bras D Y', min: -56, max: 56, step: 1 },
  { id: 'rightForearmSide', label: 'Avant D Y', min: -64, max: 64, step: 1 },
  { id: 'leftLegSide', label: 'Jambe G Y', min: -32, max: 32, step: 1 },
  { id: 'leftShinSide', label: 'Tibia G Y', min: -24, max: 24, step: 1 },
  { id: 'rightLegSide', label: 'Jambe D Y', min: -32, max: 32, step: 1 },
  { id: 'rightShinSide', label: 'Tibia D Y', min: -24, max: 24, step: 1 },
];

const POSE_FIELDS = [...MOTION_POSE_FIELDS, ...ROTATION_POSE_FIELDS];
const POSE_FIELD_CONFIG_BY_ID = new Map(POSE_FIELDS.map((field) => [field.id, field]));
const WHOLE_BODY_ROTATION_STEP = 15;
const WHOLE_BODY_TRANSLATION_STEP = 4;

const WHOLE_BODY_ROTATION_BUTTONS = [
  {
    id: 'body-forward',
    label: 'Avant',
    title: 'Pivoter tout le corps en avant',
    field: 'bodyTilt',
    delta: WHOLE_BODY_ROTATION_STEP,
    Icon: ArrowUp,
  },
  {
    id: 'body-back',
    label: 'Arriere',
    title: 'Pivoter tout le corps en arriere',
    field: 'bodyTilt',
    delta: -WHOLE_BODY_ROTATION_STEP,
    Icon: ArrowDown,
  },
  {
    id: 'body-left',
    label: 'Gauche',
    title: 'Tourner tout le corps a gauche',
    field: 'bodyYaw',
    delta: -WHOLE_BODY_ROTATION_STEP,
    Icon: ArrowLeft,
  },
  {
    id: 'body-right',
    label: 'Droite',
    title: 'Tourner tout le corps a droite',
    field: 'bodyYaw',
    delta: WHOLE_BODY_ROTATION_STEP,
    Icon: ArrowRight,
  },
];

const WHOLE_BODY_TRANSLATION_BUTTONS = [
  {
    id: 'body-move-up',
    label: 'Monter',
    title: 'Faire monter le personnage',
    field: 'rootY',
    delta: -WHOLE_BODY_TRANSLATION_STEP,
    Icon: ArrowUp,
  },
  {
    id: 'body-move-down',
    label: 'Descendre',
    title: 'Faire descendre le personnage',
    field: 'rootY',
    delta: WHOLE_BODY_TRANSLATION_STEP,
    Icon: ArrowDown,
  },
  {
    id: 'body-move-left',
    label: 'Gauche',
    title: 'Decaler le personnage a gauche',
    field: 'rootX',
    delta: -WHOLE_BODY_TRANSLATION_STEP,
    Icon: ArrowLeft,
  },
  {
    id: 'body-move-right',
    label: 'Droite',
    title: 'Decaler le personnage a droite',
    field: 'rootX',
    delta: WHOLE_BODY_TRANSLATION_STEP,
    Icon: ArrowRight,
  },
];

const LEG_KNEE_MAX_BEND = 96;
const LEG_HIP_STRAIGHT_LIMIT = 24;
const LEG_HIP_EXTREME_MIN_BEND = 58;
const LEG_SHIN_SIDE_LIMIT = 8;
const ARM_ELBOW_MAX_BEND = 118;
const ARM_SHOULDER_STRAIGHT_LIMIT = 62;
const ARM_SHOULDER_EXTREME_MIN_BEND = 22;
const ARM_FOREARM_SIDE_LIMIT = 18;

const hasOwn = (source, field) => Object.prototype.hasOwnProperty.call(source, field);
const isArmLowerField = (field) => field === 'leftForearm' || field === 'rightForearm';
const isLegLowerField = (field) => field === 'leftShin' || field === 'rightShin';

const getArmBendSign = (field, fallback = 1) => {
  if (field === 'leftForearm') return -1;
  if (field === 'rightForearm') return 1;
  return fallback >= 0 ? 1 : -1;
};

const getLegBendSign = (field, fallback = 1) => {
  if (field === 'leftShin') return -1;
  if (field === 'rightShin') return 1;
  return fallback >= 0 ? 1 : -1;
};

const getRequiredArmElbowBend = (upperArmValue = 0) => {
  const upperMagnitude = Math.abs(Number(upperArmValue) || 0);
  const excess = upperMagnitude - ARM_SHOULDER_STRAIGHT_LIMIT;
  if (excess <= 0) return 0;
  const maxArmSwing = POSE_FIELD_CONFIG_BY_ID.get('leftArm')?.max || 96;
  const denominator = Math.max(1, maxArmSwing - ARM_SHOULDER_STRAIGHT_LIMIT);
  return clamp((excess / denominator) * ARM_SHOULDER_EXTREME_MIN_BEND, 0, ARM_SHOULDER_EXTREME_MIN_BEND);
};

const clampArmElbowBend = (field, value, upperArmValue = 0) => {
  if (!isArmLowerField(field)) return value;
  const sign = getArmBendSign(field);
  const minBend = getRequiredArmElbowBend(upperArmValue);
  const magnitude = clamp(Math.abs(Number(value) || 0), minBend, ARM_ELBOW_MAX_BEND);
  return sign * magnitude;
};

const getRequiredLegKneeBend = (upperLegValue = 0) => {
  const upperMagnitude = Math.abs(Number(upperLegValue) || 0);
  const excess = upperMagnitude - LEG_HIP_STRAIGHT_LIMIT;
  if (excess <= 0) return 0;
  const maxLegSwing = POSE_FIELD_CONFIG_BY_ID.get('leftLeg')?.max || 76;
  const denominator = Math.max(1, maxLegSwing - LEG_HIP_STRAIGHT_LIMIT);
  return clamp((excess / denominator) * LEG_HIP_EXTREME_MIN_BEND, 0, LEG_HIP_EXTREME_MIN_BEND);
};

const clampLegKneeBend = (field, value, upperLegValue = 0) => {
  if (!isLegLowerField(field)) return value;
  const sign = getLegBendSign(field);
  const minBend = getRequiredLegKneeBend(upperLegValue);
  const magnitude = clamp(Math.abs(Number(value) || 0), minBend, LEG_KNEE_MAX_BEND);
  return sign * magnitude;
};

const BASE_POSE = {
  rootX: 22,
  rootY: 74,
  bodyTilt: 0,
  bodyYaw: 0,
  bodyCurl: 0,
  bodyTwist: 0,
  bodyRoll: 0,
  lowerBodyTwist: 0,
  lowerBodyRoll: 0,
  shoulderRoll: 0,
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

const normalizeAnatomicalPoseUpdates = (updates = {}, keyframe = {}) => {
  const next = { ...updates };
  const leftArmValue = Number(hasOwn(next, 'leftArm') ? next.leftArm : keyframe.leftArm) || 0;
  const rightArmValue = Number(hasOwn(next, 'rightArm') ? next.rightArm : keyframe.rightArm) || 0;
  if (hasOwn(next, 'leftArm') || hasOwn(next, 'leftForearm')) {
    next.leftForearm = clampArmElbowBend(
      'leftForearm',
      hasOwn(next, 'leftForearm') ? next.leftForearm : keyframe.leftForearm,
      leftArmValue
    );
  }
  if (hasOwn(next, 'rightArm') || hasOwn(next, 'rightForearm')) {
    next.rightForearm = clampArmElbowBend(
      'rightForearm',
      hasOwn(next, 'rightForearm') ? next.rightForearm : keyframe.rightForearm,
      rightArmValue
    );
  }
  const leftLegValue = Number(hasOwn(next, 'leftLeg') ? next.leftLeg : keyframe.leftLeg) || 0;
  const rightLegValue = Number(hasOwn(next, 'rightLeg') ? next.rightLeg : keyframe.rightLeg) || 0;
  if (hasOwn(next, 'leftLeg') || hasOwn(next, 'leftShin')) {
    next.leftShin = clampLegKneeBend(
      'leftShin',
      hasOwn(next, 'leftShin') ? next.leftShin : keyframe.leftShin,
      leftLegValue
    );
  }
  if (hasOwn(next, 'rightLeg') || hasOwn(next, 'rightShin')) {
    next.rightShin = clampLegKneeBend(
      'rightShin',
      hasOwn(next, 'rightShin') ? next.rightShin : keyframe.rightShin,
      rightLegValue
    );
  }

  [
    ['leftArmSide', 'leftForearmSide'],
    ['rightArmSide', 'rightForearmSide'],
  ].forEach(([upperField, lowerField]) => {
    if (!hasOwn(next, upperField) && !hasOwn(next, lowerField)) return;
    const upperSide = Number(hasOwn(next, upperField) ? next[upperField] : keyframe[upperField]) || 0;
    const lowerSide = Number(hasOwn(next, lowerField) ? next[lowerField] : keyframe[lowerField]) || 0;
    next[lowerField] = clamp(lowerSide, upperSide - ARM_FOREARM_SIDE_LIMIT, upperSide + ARM_FOREARM_SIDE_LIMIT);
  });

  [
    ['leftLegSide', 'leftShinSide'],
    ['rightLegSide', 'rightShinSide'],
  ].forEach(([upperField, lowerField]) => {
    if (!hasOwn(next, upperField) && !hasOwn(next, lowerField)) return;
    const upperSide = Number(hasOwn(next, upperField) ? next[upperField] : keyframe[upperField]) || 0;
    const lowerSide = Number(hasOwn(next, lowerField) ? next[lowerField] : keyframe[lowerField]) || 0;
    next[lowerField] = clamp(lowerSide, upperSide - LEG_SHIN_SIDE_LIMIT, upperSide + LEG_SHIN_SIDE_LIMIT);
  });

  return next;
};

const clampPoseFields = (source = {}) => {
  const preliminary = POSE_FIELDS.reduce((next, field) => ({
    ...next,
    [field.id]: clampPoseFieldValue(field.id, source[field.id] ?? BASE_POSE[field.id] ?? 0),
  }), {});
  const anatomical = normalizeAnatomicalPoseUpdates(preliminary, BASE_POSE);
  return POSE_FIELDS.reduce((next, field) => ({
    ...next,
    [field.id]: clampPoseFieldValue(field.id, anatomical[field.id] ?? BASE_POSE[field.id] ?? 0),
  }), {});
};

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
    Spine: { rotateX: rounded(keyframe.bodyCurl, 2), rotateY: rounded(keyframe.bodyTwist, 2), rotateZ: rounded(keyframe.bodyRoll, 2) },
    Shoulders: { rotateZ: rounded(keyframe.shoulderRoll || 0, 2) },
    Head: { rotateX: rounded(keyframe.headTilt, 2), rotateY: rounded(keyframe.headYaw, 2) },
    LeftUpperArm: { rotateX: rounded(keyframe.leftArm, 2), rotateY: rounded(keyframe.leftArmSide, 2) },
    LeftLowerArm: { rotateX: rounded(keyframe.leftForearm, 2), rotateY: rounded(keyframe.leftForearmSide, 2) },
    RightUpperArm: { rotateX: rounded(keyframe.rightArm, 2), rotateY: rounded(keyframe.rightArmSide, 2) },
    RightLowerArm: { rotateX: rounded(keyframe.rightForearm, 2), rotateY: rounded(keyframe.rightForearmSide, 2) },
    LowerBody: { rotateY: rounded(keyframe.lowerBodyTwist || 0, 2), rotateZ: rounded(keyframe.lowerBodyRoll || 0, 2) },
    LeftUpperLeg: { rotateX: rounded(keyframe.leftLeg, 2), rotateY: rounded((keyframe.lowerBodyTwist || 0) + keyframe.leftLegSide, 2), rotateZ: rounded(keyframe.lowerBodyRoll || 0, 2) },
    LeftLowerLeg: { rotateX: rounded(keyframe.leftShin, 2), rotateY: rounded(keyframe.leftShinSide, 2) },
    RightUpperLeg: { rotateX: rounded(keyframe.rightLeg, 2), rotateY: rounded((keyframe.lowerBodyTwist || 0) + keyframe.rightLegSide, 2), rotateZ: rounded(keyframe.lowerBodyRoll || 0, 2) },
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

const FieldRange = ({ field, value, onChange }) => (
  <label className="stunt-range">
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
      const safeUpdates = normalizeAnatomicalPoseUpdates(updates, keyframe);
      Object.entries(safeUpdates).forEach(([field, value]) => {
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
      Object.assign(keyframe, clampPoseFields(keyframe));
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

  const rotateWholeBody = useCallback((button) => {
    if (!selectedKeyframe || !button?.field) return;
    const currentValue = Number(selectedKeyframe[button.field]) || 0;
    setIsPlaying(false);
    patchKeyframeFields({
      [button.field]: currentValue + button.delta,
    });
    setStatus(button.label ? `Corps entier ${button.label.toLowerCase()}` : 'Corps entier ajuste');
  }, [patchKeyframeFields, selectedKeyframe]);

  const moveWholeBody = useCallback((button) => {
    if (!selectedKeyframe || !button?.field) return;
    const currentValue = Number(selectedKeyframe[button.field]) || 0;
    setIsPlaying(false);
    patchKeyframeFields({
      [button.field]: currentValue + button.delta,
    });
    setStatus(button.label ? `Personnage ${button.label.toLowerCase()}` : 'Personnage deplace');
  }, [patchKeyframeFields, selectedKeyframe]);

  const selectRigMarker = useCallback((pointId, marker = null) => {
    if (!selectedKeyframe) return;
    const keyframeTime = Number(selectedKeyframe.time) || 0;
    setIsPlaying(false);
    setProgress(keyframeTime);
    playbackRef.current.progress = keyframeTime;
    setStatus(`${marker?.label || pointId || 'Pastille'} selectionnee`);
  }, [selectedKeyframe]);

  const patchRigMarkerFromDrag = useCallback((pointId, updates = {}) => {
    if (!selectedKeyframe || !updates || !Object.keys(updates).length) return;
    setIsPlaying(false);
    patchKeyframeFields(updates);
  }, [patchKeyframeFields, selectedKeyframe]);

  const finishRigMarkerDrag = useCallback((pointId, marker = null) => {
    setStatus(`${marker?.label || pointId || 'Pastille'} ajustee`);
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
            onRigMarkerSelect={selectRigMarker}
            onRigMarkerDrag={patchRigMarkerFromDrag}
            onRigMarkerDragEnd={finishRigMarkerDrag}
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
            <div className="stunt-body-tool-grid">
              <div className="stunt-body-rotation-panel" aria-label="Deplacement personnage">
                <div className="stunt-body-rotation-head">
                  <span>Position</span>
                  <strong>X {Math.round(selectedKeyframe.rootX)} / Y {Math.round(selectedKeyframe.rootY)}</strong>
                </div>
                <div className="stunt-body-rotation-pad">
                  {WHOLE_BODY_TRANSLATION_BUTTONS.map(({ Icon, ...button }) => (
                    <button
                      key={button.id}
                      type="button"
                      className={`secondary-action stunt-body-rotate-button stunt-body-move-button ${button.id}`}
                      title={button.title}
                      aria-label={button.title}
                      onClick={() => moveWholeBody(button)}
                    >
                      <Icon aria-hidden="true" size={16} />
                    </button>
                  ))}
                </div>
              </div>
              <div className="stunt-body-rotation-panel" aria-label="Rotation corps entier">
                <div className="stunt-body-rotation-head">
                  <span>Corps entier</span>
                  <strong>{Math.round(selectedKeyframe.bodyTilt)}deg / {Math.round(selectedKeyframe.bodyYaw)}deg</strong>
                </div>
                <div className="stunt-body-rotation-pad">
                  {WHOLE_BODY_ROTATION_BUTTONS.map(({ Icon, ...button }) => (
                    <button
                      key={button.id}
                      type="button"
                      className={`secondary-action stunt-body-rotate-button ${button.id}`}
                      title={button.title}
                      aria-label={button.title}
                      onClick={() => rotateWholeBody(button)}
                    >
                      <Icon aria-hidden="true" size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="stunt-pose-controls">
              {MOTION_POSE_FIELDS.map((field) => (
                <FieldRange
                  key={field.id}
                  field={field}
                  value={selectedKeyframe[field.id]}
                  onChange={patchKeyframeField}
                />
              ))}
            </div>
            <div className="stunt-bone-rotation-panel">
              <div className="stunt-bone-rotation-head">
                <span>Rotations</span>
                <strong>Pose</strong>
              </div>
              <div className="stunt-pose-controls">
                {ROTATION_POSE_FIELDS.map((field) => (
                  <FieldRange
                    key={field.id}
                    field={field}
                    value={selectedKeyframe[field.id]}
                    onChange={patchKeyframeField}
                  />
                ))}
              </div>
            </div>
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
