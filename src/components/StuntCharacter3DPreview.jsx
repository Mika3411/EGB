import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box3 as ThreeBox3,
  BufferGeometry as ThreeBufferGeometry,
  CanvasTexture as ThreeCanvasTexture,
  CircleGeometry as ThreeCircleGeometry,
  Color as ThreeColor,
  DirectionalLight as ThreeDirectionalLight,
  DoubleSide as ThreeDoubleSide,
  Euler as ThreeEuler,
  GridHelper as ThreeGridHelper,
  Group as ThreeGroup,
  HemisphereLight as ThreeHemisphereLight,
  Line as ThreeLine,
  LineBasicMaterial as ThreeLineBasicMaterial,
  MathUtils as ThreeMathUtils,
  Mesh as ThreeMesh,
  MeshBasicMaterial as ThreeMeshBasicMaterial,
  MeshStandardMaterial as ThreeMeshStandardMaterial,
  PerspectiveCamera as ThreePerspectiveCamera,
  Quaternion as ThreeQuaternion,
  RepeatWrapping as ThreeRepeatWrapping,
  SRGBColorSpace as ThreeSRGBColorSpace,
  Scene as ThreeScene,
  Sprite as ThreeSprite,
  SpriteMaterial as ThreeSpriteMaterial,
  TextureLoader as ThreeTextureLoader,
  Vector2 as ThreeVector2,
  Vector3 as ThreeVector3,
  WebGLRenderer as ThreeWebGLRenderer,
} from 'three';
import {
  fitObjectToHeight,
  getImportedModelPrepareOptions,
  loadThreeModelFromSource,
  prepareGltfModel,
} from '../utils/threeGltfUtils';
import {
  CHARACTER_RIG_POINT_DEFINITIONS,
  CHARACTER_RIG_POINT_GROUPS,
  normalizeCharacterRigPoints,
} from '../utils/rpg3dCharacterRig.js';

const STUNT_CHARACTER_BASE_URL = '/assets/3d/characters/exemple/';
const STUNT_CHARACTER_MODEL_URL = `${STUNT_CHARACTER_BASE_URL}exemple.glb`;
const STUNT_CHARACTER_DIFFUSE_URL = `${STUNT_CHARACTER_BASE_URL}exemple.fbm/Material_001_Diffuse.jpg`;
const STUNT_CHARACTER_NORMAL_URL = `${STUNT_CHARACTER_BASE_URL}exemple.fbm/Material_001_Normal.jpg`;
const STUNT_GROUND_Y = 0;
const STUNT_GROUND_CLEARANCE = 0.012;
const STUNT_RIG_MARKERS = normalizeCharacterRigPoints(CHARACTER_RIG_POINT_DEFINITIONS)
  .map((point) => ({
    ...point,
    enabled: true,
    selected: false,
    size: point.group === CHARACTER_RIG_POINT_GROUPS.phalanges ? 0.54 : point.size,
  }));
const STUNT_RIG_BODY_MARKER_COUNT = STUNT_RIG_MARKERS
  .filter((point) => point.group === CHARACTER_RIG_POINT_GROUPS.body).length;
const STUNT_RIG_FINGER_MARKER_COUNT = STUNT_RIG_MARKERS.length - STUNT_RIG_BODY_MARKER_COUNT;
const STUNT_RIG_MARKER_COLORS = {
  weapon: { fill: '#38bdf8', stroke: '#e0f2fe', text: '#061728' },
  shield: { fill: '#fbbf24', stroke: '#fff7ed', text: '#1f1300' },
  armor: { fill: '#34d399', stroke: '#ecfdf5', text: '#052e1b' },
  finger: { fill: '#f8fafc', stroke: '#bae6fd', text: '#061728', line: '#cbd5e1' },
  selected: { fill: '#fb7185', stroke: '#fff1f2', text: '#2a0610', glow: 'rgba(251,113,133,.95)' },
};
const STUNT_RIG_HAND_CENTERS = {
  right: 0.76,
  left: 0.24,
};
const STUNT_RIG_MARKER_BY_ID = new Map(STUNT_RIG_MARKERS.map((point) => [point.id, point]));
const STUNT_RIG_BODY_MARKER_BONE_SLOTS = {
  mouth: 'mouth',
  neck: 'neck',
  'left-shoulder': 'leftUpperArm',
  'right-shoulder': 'rightUpperArm',
  'left-elbow': 'leftLowerArm',
  'right-elbow': 'rightLowerArm',
  'left-hand': 'leftHand',
  'right-hand': 'rightHand',
  'lower-belly': 'pelvis',
  'left-groin-fold': 'leftUpperLeg',
  'right-groin-fold': 'rightUpperLeg',
  'left-knee': 'leftLowerLeg',
  'right-knee': 'rightLowerLeg',
  'left-ankle': 'leftFoot',
  'right-ankle': 'rightFoot',
  'left-foot': 'leftToe',
  'right-foot': 'rightToe',
};
const STUNT_RIG_FIELD_LIMITS = {
  rootX: [8, 92],
  rootY: [24, 86],
  bodyTilt: [-420, 420],
  bodyYaw: [-180, 180],
  bodyCurl: [-35, 95],
  bodyTwist: [-55, 55],
  bodyRoll: [-70, 70],
  lowerBodyTwist: [-70, 70],
  lowerBodyRoll: [-70, 70],
  shoulderRoll: [-45, 45],
  headTilt: [-55, 55],
  headYaw: [-60, 60],
  leftArm: [-96, 96],
  leftForearm: [-118, 0],
  leftArmSide: [-56, 56],
  leftForearmSide: [-64, 64],
  rightArm: [-96, 96],
  rightForearm: [0, 118],
  rightArmSide: [-56, 56],
  rightForearmSide: [-64, 64],
  leftLeg: [-76, 76],
  leftShin: [-96, 0],
  leftLegSide: [-32, 32],
  leftShinSide: [-24, 24],
  rightLeg: [-76, 76],
  rightShin: [0, 96],
  rightLegSide: [-32, 32],
  rightShinSide: [-24, 24],
};
const STUNT_RIG_DRAG_FIELD_STEPS = {
  rootX: 2,
  rootY: 2,
  bodyTilt: 6,
  bodyYaw: 6,
  bodyCurl: 4,
  bodyTwist: 4,
  bodyRoll: 4,
  lowerBodyTwist: 5,
  lowerBodyRoll: 5,
  shoulderRoll: 5,
  headTilt: 5,
  headYaw: 5,
  leftArm: 6,
  leftForearm: 6,
  leftArmSide: 5,
  leftForearmSide: 5,
  rightArm: 6,
  rightForearm: 6,
  rightArmSide: 5,
  rightForearmSide: 5,
  leftLeg: 6,
  leftShin: 6,
  leftLegSide: 5,
  leftShinSide: 5,
  rightLeg: 6,
  rightShin: 6,
  rightLegSide: 5,
  rightShinSide: 5,
};
const STUNT_RIG_DRAG_FIELD_GROUPS = {
  mouth: ['headTilt', 'headYaw'],
  neck: ['bodyTilt', 'bodyCurl', 'bodyTwist', 'bodyRoll', 'headTilt'],
  'left-shoulder': ['bodyTilt', 'bodyCurl', 'bodyTwist', 'bodyRoll', 'shoulderRoll'],
  'right-shoulder': ['bodyTilt', 'bodyCurl', 'bodyTwist', 'bodyRoll', 'shoulderRoll'],
  'left-elbow': ['leftArm', 'leftArmSide', 'shoulderRoll'],
  'left-hand': ['leftArm', 'leftForearm', 'leftArmSide', 'leftForearmSide'],
  'right-elbow': ['rightArm', 'rightArmSide', 'shoulderRoll'],
  'right-hand': ['rightArm', 'rightForearm', 'rightArmSide', 'rightForearmSide'],
  'lower-belly': ['rootX', 'rootY', 'bodyTilt', 'bodyYaw'],
  'left-groin-fold': ['leftLegSide', 'lowerBodyTwist', 'lowerBodyRoll'],
  'right-groin-fold': ['rightLegSide', 'lowerBodyTwist', 'lowerBodyRoll'],
  'left-knee': ['leftLeg', 'leftLegSide'],
  'right-knee': ['rightLeg', 'rightLegSide'],
  'left-ankle': ['leftLeg', 'leftShin', 'leftLegSide', 'leftShinSide'],
  'left-foot': ['leftLeg', 'leftShin', 'leftLegSide', 'leftShinSide'],
  'right-ankle': ['rightLeg', 'rightShin', 'rightLegSide', 'rightShinSide'],
  'right-foot': ['rightLeg', 'rightShin', 'rightLegSide', 'rightShinSide'],
};
const STUNT_RIG_DRAG_MAX_DELTA = {
  rootX: 55,
  rootY: 55,
  bodyTilt: 220,
  bodyYaw: 140,
  bodyCurl: 80,
  bodyTwist: 70,
  bodyRoll: 80,
  lowerBodyTwist: 24,
  lowerBodyRoll: 24,
  shoulderRoll: 42,
  headTilt: 80,
  headYaw: 80,
  leftArm: 112,
  leftForearm: 140,
  leftArmSide: 68,
  leftForearmSide: 76,
  rightArm: 112,
  rightForearm: 140,
  rightArmSide: 68,
  rightForearmSide: 76,
  leftLeg: 96,
  leftShin: 96,
  leftLegSide: 38,
  leftShinSide: 30,
  rightLeg: 96,
  rightShin: 96,
  rightLegSide: 38,
  rightShinSide: 30,
};

const posePoint = (origin, length, angleDeg, zOffset = 0) => {
  const radians = (angleDeg * Math.PI) / 180;
  return new ThreeVector3(
    origin.x + Math.sin(radians) * length,
    origin.y - Math.cos(radians) * length,
    origin.z + zOffset
  );
};

const poseNumber = (pose, field, fallback = 0) => Number(pose[field] ?? fallback) || 0;
const LEG_KNEE_MAX_BEND = 96;
const LEG_HIP_STRAIGHT_LIMIT = 24;
const LEG_HIP_EXTREME_MIN_BEND = 58;
const LEG_SHIN_SIDE_LIMIT = 8;
const ARM_ELBOW_MAX_BEND = 118;
const ARM_SHOULDER_STRAIGHT_LIMIT = 62;
const ARM_SHOULDER_EXTREME_MIN_BEND = 22;
const ARM_FOREARM_SIDE_LIMIT = 18;
const getRequiredArmElbowBend = (upperArmValue = 0) => {
  const upperMagnitude = Math.abs(Number(upperArmValue) || 0);
  const excess = upperMagnitude - ARM_SHOULDER_STRAIGHT_LIMIT;
  if (excess <= 0) return 0;
  const maxArmSwing = STUNT_RIG_FIELD_LIMITS.leftArm?.[1] || 96;
  const denominator = Math.max(1, maxArmSwing - ARM_SHOULDER_STRAIGHT_LIMIT);
  return ThreeMathUtils.clamp((excess / denominator) * ARM_SHOULDER_EXTREME_MIN_BEND, 0, ARM_SHOULDER_EXTREME_MIN_BEND);
};
const clampElbowBend = (side, value, upperArmValue = 0) => {
  const next = Number(value) || 0;
  const minBend = getRequiredArmElbowBend(upperArmValue);
  const magnitude = ThreeMathUtils.clamp(Math.abs(next), minBend, ARM_ELBOW_MAX_BEND);
  return side === 'left'
    ? -magnitude
    : magnitude;
};
const getRequiredLegKneeBend = (upperLegValue = 0) => {
  const upperMagnitude = Math.abs(Number(upperLegValue) || 0);
  const excess = upperMagnitude - LEG_HIP_STRAIGHT_LIMIT;
  if (excess <= 0) return 0;
  const maxLegSwing = STUNT_RIG_FIELD_LIMITS.leftLeg?.[1] || 76;
  const denominator = Math.max(1, maxLegSwing - LEG_HIP_STRAIGHT_LIMIT);
  return ThreeMathUtils.clamp((excess / denominator) * LEG_HIP_EXTREME_MIN_BEND, 0, LEG_HIP_EXTREME_MIN_BEND);
};

const clampKneeBend = (side, value, upperLegValue = 0) => {
  const next = Number(value) || 0;
  const minBend = getRequiredLegKneeBend(upperLegValue);
  const magnitude = ThreeMathUtils.clamp(Math.abs(next), minBend, LEG_KNEE_MAX_BEND);
  return side === 'left'
    ? -magnitude
    : magnitude;
};
const xOffset = (value, scale = 0.007) => (Number(value) || 0) * scale;
const addPoseOffset = (point, x = 0, y = 0, z = 0) => (
  point.clone().add(new ThreeVector3(x, y, z))
);

const rotatePosePointAroundZ = (point, pivot, angleDeg = 0) => {
  if (!point || !pivot || !angleDeg) return point;
  const rad = ThreeMathUtils.degToRad(angleDeg);
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return new ThreeVector3(
    pivot.x + (dx * cos) - (dy * sin),
    pivot.y + (dx * sin) + (dy * cos),
    point.z
  );
};

const getPoseAngleToPoint = (from, to) => (
  ThreeMathUtils.radToDeg(Math.atan2(to.x - from.x, -(to.y - from.y)))
);

const normalizePoseAngle = (value = 0) => {
  let next = Number(value) || 0;
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
};

const solveTwoBonePoseAngles = (origin, target, upperLength, lowerLength, bendSign = 1) => {
  if (!origin || !target) return null;
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const distance = ThreeMathUtils.clamp(
    Math.hypot(dx, dy),
    Math.max(0.001, Math.abs(upperLength - lowerLength) + 0.001),
    Math.max(0.001, upperLength + lowerLength - 0.001)
  );
  const targetAngle = ThreeMathUtils.degToRad(getPoseAngleToPoint(origin, target));
  const cosDelta = ThreeMathUtils.clamp(
    ((distance * distance) - (upperLength * upperLength) - (lowerLength * lowerLength)) / (2 * upperLength * lowerLength),
    -1,
    1
  );
  const lowerDelta = (bendSign >= 0 ? 1 : -1) * Math.acos(cosDelta);
  const shoulderOffset = Math.atan2(
    lowerLength * Math.sin(lowerDelta),
    upperLength + (lowerLength * Math.cos(lowerDelta))
  );
  return {
    upper: normalizePoseAngle(ThreeMathUtils.radToDeg(targetAngle - shoulderOffset)),
    lower: normalizePoseAngle(ThreeMathUtils.radToDeg(lowerDelta)),
  };
};

const poseToRig = (pose = {}) => {
  const rootX = poseNumber(pose, 'rootX', 50);
  const rootY = poseNumber(pose, 'rootY', 76);
  const bodyTilt = poseNumber(pose, 'bodyTilt');
  const bodyCurl = poseNumber(pose, 'bodyCurl');
  const bodyYaw = poseNumber(pose, 'bodyYaw');
  const bodyTwist = poseNumber(pose, 'bodyTwist');
  const bodyRoll = poseNumber(pose, 'bodyRoll');
  const lowerBodyTwist = poseNumber(pose, 'lowerBodyTwist');
  const lowerBodyRoll = poseNumber(pose, 'lowerBodyRoll');
  const shoulderRoll = poseNumber(pose, 'shoulderRoll');
  const headTilt = poseNumber(pose, 'headTilt');
  const headYaw = poseNumber(pose, 'headYaw');
  const leftArm = poseNumber(pose, 'leftArm');
  const leftForearm = clampElbowBend('left', poseNumber(pose, 'leftForearm'), leftArm);
  const leftArmSide = poseNumber(pose, 'leftArmSide');
  const leftForearmSide = poseNumber(pose, 'leftForearmSide');
  const rightArm = poseNumber(pose, 'rightArm');
  const rightForearm = clampElbowBend('right', poseNumber(pose, 'rightForearm'), rightArm);
  const rightArmSide = poseNumber(pose, 'rightArmSide');
  const rightForearmSide = poseNumber(pose, 'rightForearmSide');
  const leftLeg = poseNumber(pose, 'leftLeg');
  const leftShin = clampKneeBend('left', poseNumber(pose, 'leftShin'), leftLeg);
  const leftLegSide = poseNumber(pose, 'leftLegSide');
  const leftShinSide = poseNumber(pose, 'leftShinSide');
  const rightLeg = poseNumber(pose, 'rightLeg');
  const rightShin = clampKneeBend('right', poseNumber(pose, 'rightShin'), rightLeg);
  const rightLegSide = poseNumber(pose, 'rightLegSide');
  const rightShinSide = poseNumber(pose, 'rightShinSide');
  const forwardCurl = Math.max(0, bodyCurl);
  const backwardCurl = Math.max(0, -bodyCurl);
  const curlYOffset = (backwardCurl * 0.001) - (forwardCurl * 0.0032);
  const curlDepthOffset = bodyCurl * 0.005;
  const hip = new ThreeVector3((rootX - 50) / 23, ((86 - rootY) / 23) + 0.38, 0);
  const upperBodyX = xOffset(bodyTwist, 0.006) + xOffset(bodyYaw, 0.003);
  const chest = addPoseOffset(
    posePoint(hip, 0.42, 180 + bodyTilt + (bodyRoll * 0.75) + bodyCurl * 0.05),
    upperBodyX * 0.52,
    curlYOffset * 0.5,
    curlDepthOffset * 0.48
  );
  const shoulder = addPoseOffset(
    posePoint(hip, 0.82, 180 + bodyTilt + bodyRoll + bodyCurl * 0.04),
    upperBodyX,
    curlYOffset,
    curlDepthOffset
  );
  const neck = addPoseOffset(
    posePoint(shoulder, 0.18, 180 + bodyTilt + bodyRoll + headTilt * 0.16 + bodyCurl * 0.03),
    0,
    curlYOffset * 0.35,
    curlDepthOffset * 0.24
  );
  const head = addPoseOffset(
    posePoint(neck, 0.28, 180 + bodyTilt + bodyRoll + headTilt * 0.42 + bodyCurl * 0.04),
    0,
    curlYOffset * 0.28,
    curlDepthOffset * 0.18
  );
  const mouth = neck.clone().lerp(head, 0.72).add(new ThreeVector3(0.02 + xOffset(headYaw, 0.006), -0.015, 0));
  const shoulderYaw = ((bodyYaw * 0.32) + (bodyTwist * 0.82)) * (Math.PI / 180);
  const shoulderSpread = 0.17;
  const getShoulderOffset = (side) => new ThreeVector3(
    Math.cos(shoulderYaw) * shoulderSpread * side,
    -0.03,
    -Math.sin(shoulderYaw) * shoulderSpread * side
  );
  const leftShoulderBase = shoulder.clone().add(getShoulderOffset(-1));
  const rightShoulderBase = shoulder.clone().add(getShoulderOffset(1));
  const leftShoulder = rotatePosePointAroundZ(leftShoulderBase, neck, shoulderRoll);
  const rightShoulder = rotatePosePointAroundZ(rightShoulderBase, neck, shoulderRoll);
  const lowerBodyYaw = lowerBodyTwist * (Math.PI / 180);
  const getHipOffset = (side) => new ThreeVector3(
    Math.cos(lowerBodyYaw) * 0.12 * side,
    -0.02,
    -Math.sin(lowerBodyYaw) * 0.12 * side
  );
  const leftHip = rotatePosePointAroundZ(hip.clone().add(getHipOffset(-1)), hip, lowerBodyRoll);
  const rightHip = rotatePosePointAroundZ(hip.clone().add(getHipOffset(1)), hip, lowerBodyRoll);
  const leftGroinFold = addPoseOffset(leftHip, xOffset(leftLegSide, 0.0065));
  const rightGroinFold = addPoseOffset(rightHip, xOffset(rightLegSide, 0.0065));
  const leftElbow = addPoseOffset(posePoint(leftShoulder, 0.5, leftArm), xOffset(leftArmSide));
  const leftHand = addPoseOffset(posePoint(leftElbow, 0.43, leftArm + leftForearm), xOffset(leftForearmSide, 0.008));
  const rightElbow = addPoseOffset(posePoint(rightShoulder, 0.5, rightArm), xOffset(rightArmSide));
  const rightHand = addPoseOffset(posePoint(rightElbow, 0.43, rightArm + rightForearm), xOffset(rightForearmSide, 0.008));
  const leftKnee = addPoseOffset(posePoint(leftHip, 0.58, leftLeg + lowerBodyRoll), xOffset(leftLegSide, 0.0065));
  const leftAnkle = addPoseOffset(posePoint(leftKnee, 0.48, leftLeg + lowerBodyRoll + leftShin), xOffset(leftShinSide, 0.0065));
  const leftFoot = addPoseOffset(posePoint(leftKnee, 0.62, leftLeg + lowerBodyRoll + leftShin), xOffset(leftShinSide, 0.007));
  const rightKnee = addPoseOffset(posePoint(rightHip, 0.58, rightLeg + lowerBodyRoll), xOffset(rightLegSide, 0.0065));
  const rightAnkle = addPoseOffset(posePoint(rightKnee, 0.48, rightLeg + lowerBodyRoll + rightShin), xOffset(rightShinSide, 0.0065));
  const rightFoot = addPoseOffset(posePoint(rightKnee, 0.62, rightLeg + lowerBodyRoll + rightShin), xOffset(rightShinSide, 0.007));

  return {
    hip,
    chest,
    shoulder,
    neck,
    head,
    mouth,
    lowerBelly: hip,
    leftShoulder,
    rightShoulder,
    leftHip,
    rightHip,
    leftGroinFold,
    rightGroinFold,
    leftElbow,
    leftHand,
    rightElbow,
    rightHand,
    leftKnee,
    leftAnkle,
    leftFoot,
    rightKnee,
    rightAnkle,
    rightFoot,
    'right-hand': rightHand,
    'left-hand': leftHand,
    'right-elbow': rightElbow,
    'left-elbow': leftElbow,
    'right-shoulder': rightShoulder,
    'left-shoulder': leftShoulder,
    'lower-belly': hip,
    'right-groin-fold': rightHip,
    'left-groin-fold': leftHip,
    'right-knee': rightKnee,
    'left-knee': leftKnee,
    'right-ankle': rightAnkle,
    'left-ankle': leftAnkle,
    'right-foot': rightFoot,
    'left-foot': leftFoot,
  };
};

const createStuntRigMarkerTexture = (marker = {}) => {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  const colors = marker.selected
    ? STUNT_RIG_MARKER_COLORS.selected
    : (STUNT_RIG_MARKER_COLORS[marker.socket] || STUNT_RIG_MARKER_COLORS.armor);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.shadowColor = marker.selected ? colors.glow : 'rgba(0,0,0,.42)';
  context.shadowBlur = marker.selected ? 26 : (marker.socket === 'finger' ? 12 : 16);
  context.beginPath();
  context.arc(64, 64, marker.socket === 'finger' ? 38 : 46, 0, Math.PI * 2);
  context.fillStyle = colors.fill;
  context.fill();
  context.lineWidth = marker.socket === 'finger' ? 7 : 8;
  context.strokeStyle = colors.stroke;
  context.stroke();
  context.shadowBlur = 0;
  if (!marker.hideLabel) {
    context.fillStyle = colors.text;
    context.font = '800 34px system-ui, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(marker.shortLabel || '?', 64, 66);
  }
  const texture = new ThreeCanvasTexture(canvas);
  texture.colorSpace = ThreeSRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
};

const getStuntRigMarkerTextureSignature = (marker = {}) => [
  marker.socket || '',
  marker.shortLabel || '',
  marker.hideLabel ? 1 : 0,
  marker.selected ? 1 : 0,
].join(':');

const updateStuntRigMarkerTexture = (markerObject = null, markerConfig = {}) => {
  if (!markerObject?.material) return;
  const signature = getStuntRigMarkerTextureSignature(markerConfig);
  if (markerObject.userData.stuntRigMarkerTextureSignature === signature) return;
  markerObject.material.map?.dispose?.();
  markerObject.material.map = createStuntRigMarkerTexture(markerConfig);
  markerObject.material.needsUpdate = true;
  markerObject.userData.stuntRigMarkerTextureSignature = signature;
};

const createStuntRigMarker = (marker = {}) => {
  const texture = createStuntRigMarkerTexture(marker);
  const material = new ThreeSpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sprite = new ThreeSprite(material);
  sprite.name = `StuntRigMarker-${marker.id || 'point'}`;
  sprite.renderOrder = 65;
  sprite.userData.stuntRigMarker = true;
  sprite.userData.stuntRigPointId = marker.id || '';
  sprite.userData.stuntRigMarkerTextureSignature = getStuntRigMarkerTextureSignature(marker);
  return sprite;
};

const createStuntRigMarkerLine = (marker = {}) => {
  const colors = STUNT_RIG_MARKER_COLORS[marker.socket] || STUNT_RIG_MARKER_COLORS.armor;
  const geometry = new ThreeBufferGeometry().setFromPoints([
    new ThreeVector3(),
    new ThreeVector3(),
  ]);
  const material = new ThreeLineBasicMaterial({
    color: colors.line || colors.fill,
    transparent: true,
    opacity: 0.56,
    depthTest: false,
    depthWrite: false,
  });
  const line = new ThreeLine(geometry, material);
  line.name = `StuntRigLine-${marker.id || 'point'}`;
  line.renderOrder = 60;
  line.userData.stuntRigLine = true;
  return line;
};

const disposeStuntRigMarkers = (markers) => {
  markers?.forEach?.((marker) => {
    marker.parent?.remove(marker);
    marker.material?.map?.dispose?.();
    marker.material?.dispose?.();
  });
  markers?.clear?.();
};

const disposeStuntRigMarkerLines = (lines) => {
  lines?.forEach?.((line) => {
    line.parent?.remove(line);
    line.geometry?.dispose?.();
    line.material?.dispose?.();
  });
  lines?.clear?.();
};

const getStuntRigBodyMarkerPosition = (rig = {}, marker = {}) => (
  rig[marker.id] || null
);

const getStuntRigHandBasis = (rig = {}, hand = 'right') => {
  const wrist = rig[`${hand}-hand`];
  const elbow = rig[`${hand}-elbow`];
  if (!wrist || !elbow) return null;
  const forward = wrist.clone().sub(elbow);
  if (forward.lengthSq() < 0.0001) forward.set(0, -1, 0);
  forward.normalize();
  const across = new ThreeVector3(-forward.y, forward.x, 0);
  if (across.lengthSq() < 0.0001) across.set(hand === 'right' ? 1 : -1, 0, 0);
  across.normalize();
  return { wrist, forward, across };
};

const getStuntRigPhalangeMarkerPosition = (rig = {}, marker = {}) => {
  const hand = marker.hand === 'left' ? 'left' : 'right';
  const basis = getStuntRigHandBasis(rig, hand);
  if (!basis) return null;
  const centerX = STUNT_RIG_HAND_CENTERS[hand] ?? 0.5;
  const lateralOffset = ((Number(marker.x) || centerX) - centerX) * 0.82;
  const forwardOffset = Math.max(0.01, (0.53 - (Number(marker.y) || 0.5)) * 1.14);
  const depthOffset = (((Number(marker.z) || 0.68) - 0.68) * 0.9) + (hand === 'right' ? 0.016 : -0.016);
  return basis.wrist.clone()
    .addScaledVector(basis.forward, forwardOffset)
    .addScaledVector(basis.across, lateralOffset)
    .add(new ThreeVector3(0, 0, depthOffset));
};

const getStuntRigMarkerPosition = (rig = {}, marker = {}, groundLift = 0) => {
  const basePosition = marker.group === CHARACTER_RIG_POINT_GROUPS.phalanges
    ? getStuntRigPhalangeMarkerPosition(rig, marker)
    : getStuntRigBodyMarkerPosition(rig, marker);
  if (!basePosition) return null;
  return basePosition.clone().add(new ThreeVector3(0, Number(groundLift) || 0, 0));
};

const getStuntRigBoneWorldPosition = (ctx, boneSlot = '') => {
  const bone = ctx?.characterBones?.[boneSlot];
  if (!bone) return null;
  bone.updateMatrixWorld?.(true);
  return bone.getWorldPosition(new ThreeVector3());
};

const stuntRigWorldToMarkerLocal = (ctx, worldPosition = null) => {
  if (!ctx?.rigMarkerRoot || !worldPosition) return null;
  ctx.rigMarkerRoot.updateMatrixWorld?.(true);
  return ctx.rigMarkerRoot.worldToLocal(worldPosition.clone());
};

const getStuntRigBodyBoneMarkerPosition = (ctx, marker = {}) => {
  const boneSlot = STUNT_RIG_BODY_MARKER_BONE_SLOTS[marker.id];
  const worldPosition = getStuntRigBoneWorldPosition(ctx, boneSlot);
  return stuntRigWorldToMarkerLocal(ctx, worldPosition);
};

const getStuntRigFingerBoneSlot = (marker = {}, jointOverride = null) => {
  const hand = marker.hand === 'left' ? 'left' : 'right';
  const finger = marker.finger || 'middle';
  const joint = ThreeMathUtils.clamp(
    Number(jointOverride ?? marker.joint) || 1,
    1,
    3
  );
  return `${hand}${capitalizeStuntRigSegment(finger)}${Math.round(joint)}`;
};

const getStuntRigPhalangeBoneMarkerPosition = (ctx, marker = {}) => {
  const joint = Number(marker.joint) || 1;
  if (joint >= 4) {
    const previousWorldPosition = getStuntRigBoneWorldPosition(ctx, getStuntRigFingerBoneSlot(marker, 2));
    const endWorldPosition = getStuntRigBoneWorldPosition(ctx, getStuntRigFingerBoneSlot(marker, 3));
    if (previousWorldPosition && endWorldPosition) {
      const direction = endWorldPosition.clone().sub(previousWorldPosition);
      const length = direction.length();
      if (length > 0.001) {
        direction.normalize();
        return stuntRigWorldToMarkerLocal(
          ctx,
          endWorldPosition.addScaledVector(direction, ThreeMathUtils.clamp(length * 0.72, 0.018, 0.055))
        );
      }
    }
  }
  return stuntRigWorldToMarkerLocal(
    ctx,
    getStuntRigBoneWorldPosition(ctx, getStuntRigFingerBoneSlot(marker))
  );
};

const getStuntRigDisplayMarkerPosition = (ctx, marker = {}) => {
  const bonePosition = marker.group === CHARACTER_RIG_POINT_GROUPS.phalanges
    ? getStuntRigPhalangeBoneMarkerPosition(ctx, marker)
    : getStuntRigBodyBoneMarkerPosition(ctx, marker);
  if (bonePosition) return bonePosition;
  return getStuntRigMarkerPosition(ctx?.currentRig, marker, ctx?.groundLift);
};

const clampStuntRigPoseField = (field, value) => {
  const limits = STUNT_RIG_FIELD_LIMITS[field];
  if (!limits) return Number(value) || 0;
  return ThreeMathUtils.clamp(Number(value) || 0, limits[0], limits[1]);
};

const normalizeStuntRigPose = (pose = {}) => {
  const next = { ...pose };
  next.leftArm = clampStuntRigPoseField('leftArm', next.leftArm);
  next.rightArm = clampStuntRigPoseField('rightArm', next.rightArm);
  next.leftForearm = clampElbowBend('left', next.leftForearm, next.leftArm);
  next.rightForearm = clampElbowBend('right', next.rightForearm, next.rightArm);
  next.leftArmSide = clampStuntRigPoseField('leftArmSide', next.leftArmSide);
  next.rightArmSide = clampStuntRigPoseField('rightArmSide', next.rightArmSide);
  const leftForearmSide = clampStuntRigPoseField('leftForearmSide', next.leftForearmSide);
  const rightForearmSide = clampStuntRigPoseField('rightForearmSide', next.rightForearmSide);
  next.leftForearmSide = ThreeMathUtils.clamp(
    leftForearmSide,
    next.leftArmSide - ARM_FOREARM_SIDE_LIMIT,
    next.leftArmSide + ARM_FOREARM_SIDE_LIMIT
  );
  next.rightForearmSide = ThreeMathUtils.clamp(
    rightForearmSide,
    next.rightArmSide - ARM_FOREARM_SIDE_LIMIT,
    next.rightArmSide + ARM_FOREARM_SIDE_LIMIT
  );
  next.leftLeg = clampStuntRigPoseField('leftLeg', next.leftLeg);
  next.rightLeg = clampStuntRigPoseField('rightLeg', next.rightLeg);
  next.leftShin = clampKneeBend('left', next.leftShin, next.leftLeg);
  next.rightShin = clampKneeBend('right', next.rightShin, next.rightLeg);
  next.leftLegSide = clampStuntRigPoseField('leftLegSide', next.leftLegSide);
  next.rightLegSide = clampStuntRigPoseField('rightLegSide', next.rightLegSide);
  const leftShinSide = clampStuntRigPoseField('leftShinSide', next.leftShinSide);
  const rightShinSide = clampStuntRigPoseField('rightShinSide', next.rightShinSide);
  next.leftShinSide = ThreeMathUtils.clamp(
    leftShinSide,
    next.leftLegSide - LEG_SHIN_SIDE_LIMIT,
    next.leftLegSide + LEG_SHIN_SIDE_LIMIT
  );
  next.rightShinSide = ThreeMathUtils.clamp(
    rightShinSide,
    next.rightLegSide - LEG_SHIN_SIDE_LIMIT,
    next.rightLegSide + LEG_SHIN_SIDE_LIMIT
  );
  return next;
};

const getStuntRigDragFields = (pointId = '') => {
  const marker = STUNT_RIG_MARKER_BY_ID.get(pointId);
  const targetId = marker?.group === CHARACTER_RIG_POINT_GROUPS.phalanges
    ? `${marker.hand === 'left' ? 'left' : 'right'}-hand`
    : pointId;
  return STUNT_RIG_DRAG_FIELD_GROUPS[targetId] || [];
};

const clampStuntRigDragFieldFromStart = (field, value, startPose = {}) => {
  const maxDelta = STUNT_RIG_DRAG_MAX_DELTA[field] || 115;
  const startValue = Number(startPose[field]) || 0;
  return ThreeMathUtils.clamp(
    clampStuntRigPoseField(field, value),
    startValue - maxDelta,
    startValue + maxDelta
  );
};

const applyStuntRigPoseToContext = (ctx, pose = {}) => {
  if (!ctx) return null;
  const rig = poseToRig(pose);
  ctx.currentRig = rig;
  applyPoseToCharacter(ctx, pose, rig);
  return rig;
};

const projectStuntRigLocalPosition = (ctx, localPosition = null) => {
  if (!ctx?.renderer?.domElement || !ctx?.camera || !localPosition) return null;
  ctx.rigMarkerRoot?.updateMatrixWorld?.(true);
  ctx.model?.updateMatrixWorld?.(true);
  ctx.camera.updateMatrixWorld(true);
  const worldPosition = localPosition.clone();
  if (ctx.rigMarkerRoot) ctx.rigMarkerRoot.localToWorld(worldPosition);
  else ctx.model.localToWorld(worldPosition);
  const projected = worldPosition.clone().project(ctx.camera);
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  return {
    x: ((projected.x + 1) / 2) * rect.width,
    y: ((1 - projected.y) / 2) * rect.height,
    z: projected.z,
    localPosition,
    worldPosition,
  };
};

const getProjectedStuntRigPoint = (ctx, pose = {}, pointId = '', options = {}) => {
  if (!ctx?.renderer?.domElement || !ctx?.camera || !ctx?.model) return null;
  const marker = STUNT_RIG_MARKER_BY_ID.get(pointId);
  if (!marker) return null;
  const canMeasureDisplayedMarker = options.useDisplay !== false
    && ctx.characterObject
    && Object.keys(ctx.characterBones || {}).length > 0;
  const rig = canMeasureDisplayedMarker ? applyStuntRigPoseToContext(ctx, pose) : poseToRig(pose);
  const localPosition = canMeasureDisplayedMarker
    ? getStuntRigDisplayMarkerPosition(ctx, marker)
    : getStuntRigMarkerPosition(rig, marker, ctx.groundLift);
  return projectStuntRigLocalPosition(ctx, localPosition);
};

const getStuntRigPointerTargetLocalPosition = (ctx, pointId = '', startPose = {}, movement = {}) => {
  const pointerPosition = movement.targetLocalPosition;
  if (!pointerPosition) return null;
  const marker = STUNT_RIG_MARKER_BY_ID.get(pointId);
  if (!marker) return pointerPosition.clone?.() || null;
  const targetPosition = pointerPosition.clone();
  if (marker.group !== CHARACTER_RIG_POINT_GROUPS.phalanges) return targetPosition;
  const handId = `${marker.hand === 'left' ? 'left' : 'right'}-hand`;
  const handMarker = STUNT_RIG_MARKER_BY_ID.get(handId);
  if (!handMarker) return targetPosition;
  applyStuntRigPoseToContext(ctx, startPose);
  const markerPosition = getStuntRigDisplayMarkerPosition(ctx, marker);
  const handPosition = getStuntRigDisplayMarkerPosition(ctx, handMarker);
  if (!markerPosition || !handPosition) return targetPosition;
  return targetPosition.sub(markerPosition.clone().sub(handPosition));
};

const getDirectStuntRigDragPose = (ctx, pointId = '', startPose = {}, movement = {}) => {
  const target = getStuntRigPointerTargetLocalPosition(ctx, pointId, startPose, movement);
  if (!target) return {};
  const rig = poseToRig(startPose);
  const marker = STUNT_RIG_MARKER_BY_ID.get(pointId);
  const targetId = marker?.group === CHARACTER_RIG_POINT_GROUPS.phalanges
    ? `${marker.hand === 'left' ? 'left' : 'right'}-hand`
    : pointId;
  const updates = {};

  if (targetId === 'left-hand' || targetId === 'right-hand') {
    const side = targetId.startsWith('left') ? 'left' : 'right';
    const solution = solveTwoBonePoseAngles(
      rig[`${side}-shoulder`],
      target,
      0.5,
      0.43,
      side === 'left' ? -1 : 1
    );
    if (solution) {
      updates[`${side}Arm`] = clampStuntRigDragFieldFromStart(`${side}Arm`, solution.upper, startPose);
      updates[`${side}Forearm`] = clampStuntRigDragFieldFromStart(`${side}Forearm`, solution.lower, startPose);
    }
    const depthDelta = Number(target.z - (rig[`${side}-shoulder`]?.z || 0)) || 0;
    if (Math.abs(depthDelta) > 0.005) {
      const sideField = `${side}ForearmSide`;
      updates[sideField] = clampStuntRigDragFieldFromStart(sideField, (Number(startPose[sideField]) || 0) + (depthDelta * 160), startPose);
    }
  }

  if (['left-ankle', 'left-foot', 'right-ankle', 'right-foot'].includes(targetId)) {
    const side = targetId.startsWith('left') ? 'left' : 'right';
    const lowerLength = targetId.endsWith('foot') ? 0.62 : 0.48;
    const solution = solveTwoBonePoseAngles(
      rig[`${side}Hip`],
      target,
      0.58,
      lowerLength,
      side === 'left' ? -1 : 1
    );
    if (solution) {
      updates[`${side}Leg`] = clampStuntRigDragFieldFromStart(`${side}Leg`, solution.upper, startPose);
      updates[`${side}Shin`] = clampStuntRigDragFieldFromStart(`${side}Shin`, solution.lower, startPose);
    }
    const depthDelta = Number(target.z - (rig[`${side}Hip`]?.z || 0)) || 0;
    if (Math.abs(depthDelta) > 0.005) {
      const sideField = `${side}ShinSide`;
      updates[sideField] = clampStuntRigDragFieldFromStart(sideField, (Number(startPose[sideField]) || 0) + (depthDelta * 82), startPose);
    }
  }

  return updates;
};

const solveStuntRigDragUpdates = (ctx, pointId = '', startPose = {}, movement = {}) => {
  const fields = getStuntRigDragFields(pointId);
  if (!fields.length) return {};
  const safeStartPose = normalizeStuntRigPose(startPose);
  const startProjection = getProjectedStuntRigPoint(ctx, safeStartPose, pointId);
  if (!startProjection) return {};

  const targetX = Number.isFinite(Number(movement.targetX))
    ? Number(movement.targetX)
    : startProjection.x + (Number(movement.dx) || 0);
  const targetY = Number.isFinite(Number(movement.targetY))
    ? Number(movement.targetY)
    : startProjection.y + (Number(movement.dy) || 0);
  const workingPose = {
    ...safeStartPose,
    ...getDirectStuntRigDragPose(ctx, pointId, safeStartPose, movement),
  };
  Object.assign(workingPose, normalizeStuntRigPose(workingPose));

  try {
    for (let pass = 0; pass < 6; pass += 1) {
      const currentProjection = getProjectedStuntRigPoint(ctx, workingPose, pointId);
      if (!currentProjection) break;
      let residualX = targetX - currentProjection.x;
      let residualY = targetY - currentProjection.y;
      if (Math.hypot(residualX, residualY) < 1.2) break;

      const derivatives = fields
        .map((field) => {
          const baseValue = Number(workingPose[field]) || 0;
          const requestedStep = STUNT_RIG_DRAG_FIELD_STEPS[field] || 4;
          let steppedValue = clampStuntRigPoseField(field, baseValue + requestedStep);
          let effectiveStep = steppedValue - baseValue;
          if (Math.abs(effectiveStep) < 0.001) {
            steppedValue = clampStuntRigPoseField(field, baseValue - requestedStep);
            effectiveStep = steppedValue - baseValue;
          }
          if (Math.abs(effectiveStep) < 0.001) return null;
          const projection = getProjectedStuntRigPoint(ctx, { ...workingPose, [field]: steppedValue }, pointId);
          if (!projection) return null;
          const x = (projection.x - currentProjection.x) / effectiveStep;
          const y = (projection.y - currentProjection.y) / effectiveStep;
          const lengthSq = (x * x) + (y * y);
          if (lengthSq < 0.0004) return null;
          return { field, x, y, lengthSq };
        })
        .filter(Boolean)
        .sort((left, right) => right.lengthSq - left.lengthSq);

      if (!derivatives.length) break;
      let moved = false;
      derivatives.forEach((derivative) => {
        const amount = ((residualX * derivative.x) + (residualY * derivative.y)) / derivative.lengthSq;
        if (!Number.isFinite(amount) || Math.abs(amount) < 0.001) return;
        const currentValue = Number(workingPose[derivative.field]) || 0;
        const nextValue = clampStuntRigDragFieldFromStart(derivative.field, currentValue + amount, startPose);
        const applied = nextValue - currentValue;
        if (Math.abs(applied) < 0.001) return;
        workingPose[derivative.field] = nextValue;
        Object.assign(workingPose, normalizeStuntRigPose(workingPose));
        residualX -= derivative.x * applied;
        residualY -= derivative.y * applied;
        moved = true;
      });
      if (!moved) break;
    }
  } finally {
    applyStuntRigPoseToContext(ctx, safeStartPose);
  }

  const normalizedPose = normalizeStuntRigPose(workingPose);
  const outputFields = new Set(fields);
  if (fields.includes('leftArm') || fields.includes('leftForearm')) outputFields.add('leftForearm');
  if (fields.includes('rightArm') || fields.includes('rightForearm')) outputFields.add('rightForearm');
  if (fields.includes('leftArmSide') || fields.includes('leftForearmSide')) outputFields.add('leftForearmSide');
  if (fields.includes('rightArmSide') || fields.includes('rightForearmSide')) outputFields.add('rightForearmSide');
  if (fields.includes('leftLeg') || fields.includes('leftShin')) outputFields.add('leftShin');
  if (fields.includes('rightLeg') || fields.includes('rightShin')) outputFields.add('rightShin');
  if (fields.includes('leftLegSide') || fields.includes('leftShinSide')) outputFields.add('leftShinSide');
  if (fields.includes('rightLegSide') || fields.includes('rightShinSide')) outputFields.add('rightShinSide');
  return Array.from(outputFields).reduce((updates, field) => {
    const value = clampStuntRigPoseField(field, Number(normalizedPose[field]) || 0);
    if (Math.abs(value - (Number(safeStartPose[field]) || 0)) > 0.01) updates[field] = value;
    return updates;
  }, {});
};

const syncStuntRigMarkers = (ctx) => {
  const markerRoot = ctx?.rigMarkerRoot;
  const rig = ctx?.currentRig;
  if (!markerRoot || !rig) return;
  const activeMarkers = new Set();
  const activeLines = new Set();
  const projectedMarkers = {};

  STUNT_RIG_MARKERS.forEach((markerConfig) => {
    activeMarkers.add(markerConfig.id);
    const effectiveMarkerConfig = {
      ...markerConfig,
      selected: ctx.activeRigMarkerId === markerConfig.id,
    };
    let marker = ctx.rigMarkers.get(markerConfig.id);
    if (!marker) {
      marker = createStuntRigMarker(effectiveMarkerConfig);
      ctx.rigMarkers.set(markerConfig.id, marker);
      markerRoot.add(marker);
    }
    updateStuntRigMarkerTexture(marker, effectiveMarkerConfig);
    const dragPosition = ctx.activeRigMarkerId === markerConfig.id
      ? ctx.activeRigMarkerPointerPosition
      : null;
    const position = dragPosition || getStuntRigDisplayMarkerPosition(ctx, markerConfig);
    if (!position) {
      marker.visible = false;
      return;
    }
    marker.visible = true;
    marker.position.copy(position);
    marker.material.opacity = effectiveMarkerConfig.selected ? 1 : (markerConfig.socket === 'finger' ? 0.88 : 0.95);
    marker.userData.stuntRigPointId = markerConfig.id;
    if (ctx.camera && ctx.model) {
      const worldPosition = position.clone();
      markerRoot.localToWorld(worldPosition);
      const distance = Math.max(0.1, ctx.camera.position.distanceTo(worldPosition));
      const markerSize = Number.isFinite(Number(markerConfig.size)) ? Number(markerConfig.size) : 1;
      marker.scale.setScalar(ThreeMathUtils.clamp(distance * 0.043 * markerSize, 0.024 * markerSize, 0.13 * markerSize));
      const projected = worldPosition.clone().project(ctx.camera);
      const rect = ctx.renderer?.domElement?.getBoundingClientRect?.();
      if (rect) {
        const radius = ThreeMathUtils.clamp(18 * markerSize, 11, 30);
        projectedMarkers[markerConfig.id] = {
          x: Math.round(((projected.x + 1) / 2) * rect.width),
          y: Math.round(((1 - projected.y) / 2) * rect.height),
          z: Number(projected.z.toFixed(4)),
          radius,
        };
      }
    }
  });

  STUNT_RIG_MARKERS.forEach((markerConfig) => {
    if (!markerConfig.connectTo) return;
    const marker = ctx.rigMarkers.get(markerConfig.id);
    const connectedMarker = ctx.rigMarkers.get(markerConfig.connectTo);
    if (!marker?.visible || !connectedMarker?.visible) return;
    activeLines.add(markerConfig.id);
    let line = ctx.rigMarkerLines.get(markerConfig.id);
    if (!line) {
      line = createStuntRigMarkerLine(markerConfig);
      ctx.rigMarkerLines.set(markerConfig.id, line);
      markerRoot.add(line);
    }
    const positionAttribute = line.geometry.getAttribute('position');
    positionAttribute.setXYZ(0, connectedMarker.position.x, connectedMarker.position.y, connectedMarker.position.z);
    positionAttribute.setXYZ(1, marker.position.x, marker.position.y, marker.position.z);
    positionAttribute.needsUpdate = true;
    line.visible = true;
  });

  ctx.rigMarkers.forEach((marker, key) => {
    if (!activeMarkers.has(key)) marker.visible = false;
  });
  ctx.rigMarkerLines.forEach((line, key) => {
    if (!activeLines.has(key)) line.visible = false;
  });

  if (ctx.renderer?.domElement) {
    ctx.projectedRigMarkers = projectedMarkers;
    ctx.renderer.domElement.dataset.rigMarkers = String(activeMarkers.size);
    ctx.renderer.domElement.dataset.rigBodyMarkers = String(STUNT_RIG_BODY_MARKER_COUNT);
    ctx.renderer.domElement.dataset.rigFingerMarkers = String(STUNT_RIG_FINGER_MARKER_COUNT);
    ctx.renderer.domElement.dataset.rigMarkerPoints = JSON.stringify(projectedMarkers);
  }
};

const degToRad = (value = 0) => ThreeMathUtils.degToRad(Number(value) || 0);

const normalizeBoneName = (value = '') => String(value || '')
  .replace(/\\/g, '/')
  .split('/')
  .pop()
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

const capitalizeStuntRigSegment = (value = '') => (
  String(value || '').slice(0, 1).toUpperCase() + String(value || '').slice(1)
);

const makeFingerBoneCandidates = () => (
  ['left', 'right'].reduce((slots, hand) => {
    const suffix = hand === 'left' ? 'l' : 'r';
    ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((finger) => {
      [1, 2, 3].forEach((joint) => {
        const paddedJoint = String(joint).padStart(2, '0');
        slots[`${hand}${capitalizeStuntRigSegment(finger)}${joint}`] = [
          `${finger}_${paddedJoint}_${suffix}`,
          `${finger}${paddedJoint}${suffix}`,
        ];
      });
    });
    return slots;
  }, {})
);

const BONE_CANDIDATES = {
  pelvis: ['pelvis', 'ccbasepelvis', 'hips', 'mixamorighips'],
  spine01: ['spine01', 'spine1', 'spine'],
  spine03: ['spine03', 'spine3', 'spine02', 'spine2', 'chest'],
  spine05: ['spine05', 'spine5', 'spine04', 'spine4', 'upperchest'],
  neck: ['neck01', 'neck1', 'neck02', 'neck2', 'neck'],
  head: ['head'],
  mouth: ['ccbasejawroot', 'ccbaseupperjaw', 'head'],
  leftClavicle: ['claviclel', 'leftclavicle', 'leftshoulder', 'mixamorigleftshoulder'],
  leftUpperArm: ['upperarml', 'leftupperarm', 'mixamorigleftarm'],
  leftLowerArm: ['lowerarml', 'leftlowerarm', 'mixamorigleftforearm'],
  leftHand: ['handl', 'lefthand', 'mixamoriglefthand'],
  rightClavicle: ['clavicler', 'rightclavicle', 'rightshoulder', 'mixamorigrightshoulder'],
  rightUpperArm: ['upperarmr', 'rightupperarm', 'mixamorigrightarm'],
  rightLowerArm: ['lowerarmr', 'rightlowerarm', 'mixamorigrightforearm'],
  rightHand: ['handr', 'righthand', 'mixamorigrighthand'],
  leftUpperLeg: ['thighl', 'leftupleg', 'leftupperleg', 'mixamorigleftupleg'],
  leftLowerLeg: ['calfl', 'leftleg', 'leftlowerleg', 'mixamorigleftleg'],
  leftFoot: ['footl', 'leftfoot', 'mixamorigleftfoot'],
  leftToe: ['balll', 'ccbaseltoebasesharebone', 'toebasel', 'lefttoebase', 'lefttoe', 'mixamoriglefttoe', 'mixamoriglefttoebase'],
  rightUpperLeg: ['thighr', 'rightupleg', 'rightupperleg', 'mixamorigrightupleg'],
  rightLowerLeg: ['calfr', 'rightleg', 'rightlowerleg', 'mixamorigrightleg'],
  rightFoot: ['footr', 'rightfoot', 'mixamorigrightfoot'],
  rightToe: ['ballr', 'ccbasertoebasesharebone', 'toebaser', 'righttoebase', 'righttoe', 'mixamorigrighttoe', 'mixamorigrighttoebase'],
  ...makeFingerBoneCandidates(),
};

const collectCharacterBones = (object) => {
  const byName = new Map();
  object?.traverse?.((child) => {
    if (child.isBone || child.type === 'Bone') byName.set(normalizeBoneName(child.name), child);
  });
  return Object.entries(BONE_CANDIDATES).reduce((next, [slot, candidates]) => {
    const bone = candidates.map(normalizeBoneName).map((candidate) => byName.get(candidate)).find(Boolean);
    if (bone) {
      bone.userData.stuntRestQuaternion = bone.quaternion.clone();
      next[slot] = bone;
    }
    return next;
  }, {});
};

const createCharacterTextureSet = (onUpdate = () => {}) => {
  const textureLoader = new ThreeTextureLoader();
  const loadTexture = (url, colorSpace = null) => {
    const texture = textureLoader.load(url, () => onUpdate());
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.anisotropy = 4;
    texture.flipY = false;
    texture.wrapS = ThreeRepeatWrapping;
    texture.wrapT = ThreeRepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  };
  return {
    diffuse: loadTexture(STUNT_CHARACTER_DIFFUSE_URL, ThreeSRGBColorSpace),
    normal: loadTexture(STUNT_CHARACTER_NORMAL_URL),
  };
};

const applyCharacterTextures = (object, textures = {}) => {
  if (!object || !textures.diffuse) return;
  object.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    const nextMaterials = materials.map((material) => {
      if (!material) return material;
      const nextMaterial = material.isMeshStandardMaterial ? material : new ThreeMeshStandardMaterial();
      if (nextMaterial !== material) {
        nextMaterial.name = material.name || '';
        nextMaterial.side = material.side ?? ThreeDoubleSide;
        nextMaterial.skinning = material.skinning;
      }
      nextMaterial.map = nextMaterial.map || textures.diffuse;
      nextMaterial.normalMap = nextMaterial.normalMap || textures.normal || null;
      nextMaterial.color?.set?.(0xffffff);
      nextMaterial.vertexColors = false;
      nextMaterial.roughness = 0.72;
      nextMaterial.metalness = 0.04;
      nextMaterial.envMapIntensity = Math.min(Number(nextMaterial.envMapIntensity) || 0.75, 0.9);
      nextMaterial.userData = {
        ...(nextMaterial.userData || {}),
        stuntForcedTexture: true,
        disposeWithInstance: true,
      };
      nextMaterial.needsUpdate = true;
      return nextMaterial;
    });
    child.material = Array.isArray(child.material) ? nextMaterials : nextMaterials[0];
  });
};

const resetCharacterBones = (bones = {}) => {
  Object.values(bones).forEach((bone) => {
    const rest = bone?.userData?.stuntRestQuaternion;
    if (rest) bone.quaternion.copy(rest);
  });
};

const rotateBone = (bone, x = 0, y = 0, z = 0) => {
  if (!bone) return;
  bone.quaternion.multiply(new ThreeQuaternion().setFromEuler(new ThreeEuler(
    degToRad(x),
    degToRad(y),
    degToRad(z),
    'XYZ'
  )));
};

const getRigPointWorldPosition = (ctx, point = null) => {
  if (!ctx?.model || !point) return null;
  ctx.model.updateMatrixWorld(true);
  const worldPosition = point.clone();
  ctx.model.localToWorld(worldPosition);
  return worldPosition;
};

const alignBoneTowardWorldPoint = (bone, childBone, targetWorldPosition = null) => {
  if (!bone || !childBone || !targetWorldPosition) return;
  bone.parent?.updateMatrixWorld?.(true);
  bone.updateMatrixWorld?.(true);
  childBone.updateMatrixWorld?.(true);
  const boneWorldPosition = bone.getWorldPosition(new ThreeVector3());
  const childWorldPosition = childBone.getWorldPosition(new ThreeVector3());
  const currentDirection = childWorldPosition.sub(boneWorldPosition).normalize();
  const desiredDirection = targetWorldPosition.clone().sub(boneWorldPosition).normalize();
  if (currentDirection.lengthSq() < 0.0001 || desiredDirection.lengthSq() < 0.0001) return;
  const currentWorldQuaternion = bone.getWorldQuaternion(new ThreeQuaternion());
  const parentWorldQuaternion = bone.parent
    ? bone.parent.getWorldQuaternion(new ThreeQuaternion())
    : new ThreeQuaternion();
  const alignQuaternion = new ThreeQuaternion().setFromUnitVectors(currentDirection, desiredDirection);
  const nextWorldQuaternion = alignQuaternion.multiply(currentWorldQuaternion);
  bone.quaternion.copy(parentWorldQuaternion.invert().multiply(nextWorldQuaternion));
  bone.updateMatrixWorld(true);
};

const getCharacterPelvisOffset = (object, pelvisBone) => {
  if (!object || !pelvisBone) return new ThreeVector3();
  object.updateMatrixWorld(true);
  const rootPosition = object.getWorldPosition(new ThreeVector3());
  const pelvisPosition = pelvisBone.getWorldPosition(new ThreeVector3());
  return pelvisPosition.sub(rootPosition);
};

const getCharacterGroundMinY = (ctx) => {
  if (!ctx?.characterAnchor || !ctx?.model) return Infinity;
  ctx.model.updateMatrixWorld(true);
  ctx.characterAnchor.updateMatrixWorld(true);
  let minY = Infinity;

  if (ctx.characterObject) {
    ctx.characterObject.updateMatrixWorld(true);
    const box = new ThreeBox3().setFromObject(ctx.characterObject);
    if (Number.isFinite(box.min.y)) minY = Math.min(minY, box.min.y);
  }

  Object.values(ctx.characterBones || {}).forEach((bone) => {
    if (!bone) return;
    bone.updateMatrixWorld?.(true);
    minY = Math.min(minY, bone.getWorldPosition(new ThreeVector3()).y);
  });

  return minY;
};

const keepCharacterAboveGround = (ctx) => {
  if (!ctx?.characterAnchor) return;
  const minY = getCharacterGroundMinY(ctx);
  if (!Number.isFinite(minY)) return;
  const lift = STUNT_GROUND_Y + STUNT_GROUND_CLEARANCE - minY;
  if (lift > 0) {
    ctx.characterAnchor.position.y += lift;
    ctx.characterAnchor.updateMatrixWorld(true);
  }
  ctx.groundLift = Math.max(0, lift);
  if (ctx.renderer?.domElement) {
    ctx.renderer.domElement.dataset.groundLift = String(Number(ctx.groundLift.toFixed(3)));
    ctx.renderer.domElement.dataset.groundMinY = String(Number((minY + ctx.groundLift).toFixed(3)));
  }
};

const applyPoseToCharacter = (ctx, currentPose, rig) => {
  if (!ctx?.characterAnchor || !currentPose || !rig) return;
  const pose = currentPose;
  const bodyTilt = Number(pose.bodyTilt) || 0;
  const bodyYaw = Number(pose.bodyYaw) || 0;
  const bodyCurl = Number(pose.bodyCurl) || 0;
  const bodyTwist = Number(pose.bodyTwist) || 0;
  const bodyRoll = Number(pose.bodyRoll) || 0;
  const lowerBodyTwist = Number(pose.lowerBodyTwist) || 0;
  const lowerBodyRoll = Number(pose.lowerBodyRoll) || 0;
  const shoulderRoll = Number(pose.shoulderRoll) || 0;
  const headYaw = Number(pose.headYaw) || 0;
  const leftForearm = clampElbowBend('left', pose.leftForearm, pose.leftArm);
  const rightForearm = clampElbowBend('right', pose.rightForearm, pose.rightArm);
  const leftShin = clampKneeBend('left', pose.leftShin, pose.leftLeg);
  const rightShin = clampKneeBend('right', pose.rightShin, pose.rightLeg);
  const forwardCurl = Math.max(0, bodyCurl);
  const backwardCurl = Math.max(0, -bodyCurl);
  const meshCurl = -(forwardCurl * 0.95) + (backwardCurl * 0.42);
  ctx.characterAnchor.position.copy(rig.hip).add(new ThreeVector3(0, -0.02, 0));
  ctx.characterAnchor.rotation.set(degToRad(meshCurl * 0.08), degToRad(bodyYaw), degToRad(-bodyTilt), 'XYZ');

  resetCharacterBones(ctx.characterBones);
  const bones = ctx.characterBones || {};
  rotateBone(bones.pelvis, 0, 0, 0);
  rotateBone(bones.spine01, meshCurl * 0.3, bodyTwist * 0.28, (bodyRoll * 0.5) + (meshCurl * 0.04));
  rotateBone(bones.spine03, meshCurl * 0.24, bodyTwist * 0.34, (bodyRoll * 0.34) + (meshCurl * 0.035));
  rotateBone(bones.spine05, meshCurl * 0.17, bodyTwist * 0.38, (bodyRoll * 0.18) + (meshCurl * 0.03));
  rotateBone(bones.neck, Number(pose.headTilt) * 0.25, headYaw * 0.2, 0);
  rotateBone(bones.head, Number(pose.headTilt) * 0.52, headYaw * 0.58, 0);

  rotateBone(bones.leftClavicle, 0, shoulderRoll * 1.65, 0);
  rotateBone(bones.rightClavicle, 0, -shoulderRoll * 1.65, 0);
  rotateBone(bones.leftUpperArm, 0, -12 - (Number(pose.leftArmSide) || 0) * 0.85, -Number(pose.leftArm) * 0.62);
  rotateBone(bones.leftLowerArm, 0, -(Number(pose.leftForearmSide) || 0) * 1.1, -leftForearm * 0.58);
  rotateBone(bones.leftHand, 0, -(Number(pose.leftForearmSide) || 0) * 0.28, -leftForearm * 0.14);
  rotateBone(bones.rightUpperArm, 0, 12 + (Number(pose.rightArmSide) || 0) * 0.85, -Number(pose.rightArm) * 0.62);
  rotateBone(bones.rightLowerArm, 0, (Number(pose.rightForearmSide) || 0) * 1.1, -rightForearm * 0.58);
  rotateBone(bones.rightHand, 0, (Number(pose.rightForearmSide) || 0) * 0.28, -rightForearm * 0.14);

  rotateBone(bones.leftUpperLeg, Number(pose.leftLeg) * 0.14, (lowerBodyTwist * 0.75) - ((Number(pose.leftLegSide) || 0) * 0.75), -(Number(pose.leftLeg) + lowerBodyRoll) * 0.85);
  rotateBone(bones.leftLowerLeg, leftShin * 0.09, -(Number(pose.leftShinSide) || 0) * 0.65, -leftShin * 0.82);
  rotateBone(bones.leftFoot, -leftShin * 0.14, -(Number(pose.leftShinSide) || 0) * 0.22, 0);
  rotateBone(bones.rightUpperLeg, Number(pose.rightLeg) * 0.14, (lowerBodyTwist * 0.75) + ((Number(pose.rightLegSide) || 0) * 0.75), -(Number(pose.rightLeg) + lowerBodyRoll) * 0.85);
  rotateBone(bones.rightLowerLeg, rightShin * 0.09, (Number(pose.rightShinSide) || 0) * 0.65, -rightShin * 0.82);
  rotateBone(bones.rightFoot, -rightShin * 0.14, (Number(pose.rightShinSide) || 0) * 0.22, 0);

  ctx.characterAnchor.updateMatrixWorld(true);
  alignBoneTowardWorldPoint(bones.leftUpperArm, bones.leftLowerArm, getRigPointWorldPosition(ctx, rig.leftElbow));
  alignBoneTowardWorldPoint(bones.leftLowerArm, bones.leftHand, getRigPointWorldPosition(ctx, rig.leftHand));
  alignBoneTowardWorldPoint(bones.rightUpperArm, bones.rightLowerArm, getRigPointWorldPosition(ctx, rig.rightElbow));
  alignBoneTowardWorldPoint(bones.rightLowerArm, bones.rightHand, getRigPointWorldPosition(ctx, rig.rightHand));
  alignBoneTowardWorldPoint(bones.leftUpperLeg, bones.leftLowerLeg, getRigPointWorldPosition(ctx, rig.leftKnee));
  alignBoneTowardWorldPoint(bones.leftLowerLeg, bones.leftFoot, getRigPointWorldPosition(ctx, rig.leftAnkle));
  alignBoneTowardWorldPoint(bones.rightUpperLeg, bones.rightLowerLeg, getRigPointWorldPosition(ctx, rig.rightKnee));
  alignBoneTowardWorldPoint(bones.rightLowerLeg, bones.rightFoot, getRigPointWorldPosition(ctx, rig.rightAnkle));

  ctx.characterAnchor.updateMatrixWorld(true);
  keepCharacterAboveGround(ctx);
};

const createCameraControls = () => ({
  target: new ThreeVector3(0, 0.92, 0),
  radius: 4.7,
  yaw: -0.08,
  pitch: 0.1,
});

const updateCameraFromControls = (camera, controls) => {
  if (!camera || !controls) return;
  const pitch = ThreeMathUtils.clamp(controls.pitch, -0.45, 0.78);
  controls.pitch = pitch;
  const horizontalRadius = Math.cos(pitch) * controls.radius;
  camera.position.set(
    controls.target.x + Math.sin(controls.yaw) * horizontalRadius,
    controls.target.y + Math.sin(pitch) * controls.radius,
    controls.target.z + Math.cos(controls.yaw) * horizontalRadius
  );
  camera.lookAt(controls.target);
  camera.updateMatrixWorld(true);
};

const orbitCamera = (ctx, dx = 0, dy = 0) => {
  if (!ctx?.cameraControls) return;
  ctx.cameraControls.yaw -= dx * 0.008;
  ctx.cameraControls.pitch += dy * 0.006;
  updateCameraFromControls(ctx.camera, ctx.cameraControls);
  syncStuntRigMarkers(ctx);
};

const panCamera = (ctx, dx = 0, dy = 0) => {
  if (!ctx?.cameraControls || !ctx.camera) return;
  const distanceScale = ctx.cameraControls.radius * 0.0019;
  const direction = new ThreeVector3();
  ctx.camera.getWorldDirection(direction);
  const right = new ThreeVector3().crossVectors(direction, ctx.camera.up).normalize();
  const up = new ThreeVector3().crossVectors(right, direction).normalize();
  ctx.cameraControls.target
    .addScaledVector(right, -dx * distanceScale)
    .addScaledVector(up, dy * distanceScale);
  updateCameraFromControls(ctx.camera, ctx.cameraControls);
  syncStuntRigMarkers(ctx);
};

export default function StuntCharacter3DPreview({
  pose,
  keyframes = [],
  onRigMarkerSelect = () => {},
  onRigMarkerDrag = () => {},
  onRigMarkerDragEnd = () => {},
}) {
  const containerRef = useRef(null);
  const ctxRef = useRef(null);
  const poseRef = useRef(pose);
  const callbacksRef = useRef({ onRigMarkerSelect, onRigMarkerDrag, onRigMarkerDragEnd });
  const [loadStatus, setLoadStatus] = useState('Chargement personnage...');
  const keyframeSignature = useMemo(
    () => keyframes.map((keyframe) => `${keyframe.rootX}:${keyframe.rootY}:${keyframe.time}`).join('|'),
    [keyframes]
  );

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    callbacksRef.current = { onRigMarkerSelect, onRigMarkerDrag, onRigMarkerDragEnd };
  }, [onRigMarkerDrag, onRigMarkerDragEnd, onRigMarkerSelect]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new ThreeWebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = ThreeSRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = 'stunt-3d-canvas';
    container.appendChild(renderer.domElement);

    const scene = new ThreeScene();
    scene.background = new ThreeColor(0x07111f);
    const camera = new ThreePerspectiveCamera(38, 1, 0.1, 20);
    const cameraControls = createCameraControls();
    updateCameraFromControls(camera, cameraControls);

    const ambient = new ThreeHemisphereLight(0xffffff, 0x172033, 1.18);
    scene.add(ambient);
    const keyLight = new ThreeDirectionalLight(0xfff7ed, 2.35);
    keyLight.position.set(2.3, 4, 3.2);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new ThreeDirectionalLight(0xbfdbfe, 0.3);
    rimLight.position.set(-3.2, 2.2, -2.6);
    scene.add(rimLight);

    const grid = new ThreeGridHelper(4.8, 16, 0x38bdf8, 0x1e293b);
    grid.position.y = STUNT_GROUND_Y;
    scene.add(grid);
    const ground = new ThreeMesh(
      new ThreeCircleGeometry(2.35, 48),
      new ThreeMeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.64 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = STUNT_GROUND_Y - 0.006;
    scene.add(ground);

    const model = new ThreeGroup();
    model.rotation.y = -0.38;
    scene.add(model);

    const characterAnchor = new ThreeGroup();
    characterAnchor.name = 'stunt-fbx-character-anchor';
    model.add(characterAnchor);

    const rigMarkerRoot = new ThreeGroup();
    rigMarkerRoot.name = 'StuntCharacterRigMarkers';
    model.add(rigMarkerRoot);

    const pathLine = new ThreeLine(
      new ThreeBufferGeometry(),
      new ThreeLineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 })
    );
    pathLine.position.z = -0.5;
    scene.add(pathLine);

    const pointer = new ThreeVector2();
    const dragState = {
      mode: '',
      pointId: '',
      startX: 0,
      startY: 0,
      lastX: 0,
      lastY: 0,
      screenDepth: 0,
      startPose: null,
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      updateCameraFromControls(camera, cameraControls);
      syncStuntRigMarkers(ctxRef.current);
    };

    const pickRigMarker = (event) => {
      const ctx = ctxRef.current;
      if (!ctx?.renderer?.domElement || !ctx.camera) return null;
      syncStuntRigMarkers(ctx);
      const rect = ctx.renderer.domElement.getBoundingClientRect();
      const pointerX = event.clientX - rect.left;
      const pointerY = event.clientY - rect.top;
      const projected = ctx.projectedRigMarkers || {};
      const bestHit = Object.entries(projected).reduce((best, [pointId, point]) => {
        const markerObject = ctx.rigMarkers.get(pointId);
        if (!markerObject?.visible) return best;
        const radius = Math.max(14, Number(point.radius) || 18);
        const distance = Math.hypot(pointerX - point.x, pointerY - point.y);
        if (distance > radius) return best;
        const markerConfig = STUNT_RIG_MARKER_BY_ID.get(pointId);
        const isBodyMarker = markerConfig?.group === CHARACTER_RIG_POINT_GROUPS.body;
        const isEndLimbMarker = pointId.endsWith('-hand') || pointId.endsWith('-foot');
        const priority = (isBodyMarker ? 8 : 0) + (isEndLimbMarker ? 6 : 0);
        const score = distance - priority;
        if (!best || score < best.score || (Math.abs(score - best.score) < 2 && point.z < best.z)) {
          return { pointId, distance, score, z: Number(point.z) || 0 };
        }
        return best;
      }, null);
      return bestHit
        ? {
          pointId: bestHit.pointId,
          marker: STUNT_RIG_MARKER_BY_ID.get(bestHit.pointId) || null,
        }
        : null;
    };

    const getPointerCanvasPosition = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        rect,
      };
    };

    const getPointerWorldPositionAtDepth = (event, screenDepth) => {
      const ctx = ctxRef.current;
      if (!ctx?.camera || !Number.isFinite(screenDepth)) return null;
      const { rect } = getPointerCanvasPosition(event);
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      return new ThreeVector3(pointer.x, pointer.y, screenDepth).unproject(ctx.camera);
    };

    const setActiveMarkerPointerPosition = (event) => {
      const ctx = ctxRef.current;
      if (!ctx?.rigMarkerRoot || !dragState.pointId) return null;
      const worldPosition = getPointerWorldPositionAtDepth(event, dragState.screenDepth);
      if (!worldPosition) return null;
      ctx.rigMarkerRoot.updateMatrixWorld(true);
      ctx.activeRigMarkerPointerPosition = ctx.rigMarkerRoot.worldToLocal(worldPosition.clone());
      return ctx.activeRigMarkerPointerPosition;
    };

    const previewRigMarkerDrag = (pointId, updates) => {
      const ctx = ctxRef.current;
      if (!ctx || !dragState.startPose) return;
      const nextPose = { ...dragState.startPose, ...updates };
      const nextRig = poseToRig(nextPose);
      ctx.currentRig = nextRig;
      applyPoseToCharacter(ctx, nextPose, nextRig);
      syncStuntRigMarkers(ctx);
      ctx.renderer.render(ctx.scene, ctx.camera);
      if (updates && Object.keys(updates).length) {
        callbacksRef.current.onRigMarkerDrag(pointId, updates, STUNT_RIG_MARKER_BY_ID.get(pointId) || null);
      }
    };

    const handlePointerDown = (event) => {
      if (dragState.mode) return;
      const button = Number(event.button ?? 0);
      if (button !== 0 && button !== 2) return;
      event.preventDefault();
      if (event.pointerId !== undefined) renderer.domElement.setPointerCapture?.(event.pointerId);
      if (button === 2) {
        dragState.mode = 'pan';
        renderer.domElement.classList.add('panning');
        renderer.domElement.dataset.cameraMode = 'pan';
      } else {
        const hit = pickRigMarker(event);
        if (hit?.pointId) {
          dragState.mode = 'marker';
          dragState.pointId = hit.pointId;
          dragState.startPose = { ...poseRef.current };
          ctxRef.current.activeRigMarkerId = hit.pointId;
          const hitObject = ctxRef.current.rigMarkers.get(hit.pointId);
          const hitWorldPosition = hitObject?.getWorldPosition?.(new ThreeVector3());
          dragState.screenDepth = hitWorldPosition ? hitWorldPosition.project(ctxRef.current.camera).z : 0;
          setActiveMarkerPointerPosition(event);
          renderer.domElement.classList.add('dragging');
          renderer.domElement.dataset.cameraMode = 'marker';
          renderer.domElement.dataset.activeRigMarker = hit.pointId;
          callbacksRef.current.onRigMarkerSelect(hit.pointId, hit.marker);
          syncStuntRigMarkers(ctxRef.current);
        } else {
          dragState.mode = 'orbit';
          renderer.domElement.classList.add('rotating');
          renderer.domElement.dataset.cameraMode = 'orbit';
        }
      }
      dragState.startX = event.clientX;
      dragState.startY = event.clientY;
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
    };

    const handlePointerMove = (event) => {
      if (!dragState.mode) {
        const overMarker = Boolean(pickRigMarker(event));
        renderer.domElement.classList.toggle('can-grab', overMarker);
        renderer.domElement.classList.toggle('can-rotate', !overMarker);
        renderer.domElement.dataset.hoverRigMarker = overMarker ? '1' : '';
        return;
      }
      event.preventDefault();
      const dx = event.clientX - dragState.lastX;
      const dy = event.clientY - dragState.lastY;
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) <= 0) return;
      if (dragState.mode === 'marker') {
        setActiveMarkerPointerPosition(event);
        const target = getPointerCanvasPosition(event);
        const updates = solveStuntRigDragUpdates(ctxRef.current, dragState.pointId, dragState.startPose, {
          dx: event.clientX - dragState.startX,
          dy: event.clientY - dragState.startY,
          targetX: target.x,
          targetY: target.y,
          targetLocalPosition: ctxRef.current?.activeRigMarkerPointerPosition?.clone?.() || null,
        });
        renderer.domElement.dataset.lastRigDrag = dragState.pointId;
        previewRigMarkerDrag(dragState.pointId, updates);
        return;
      }
      if (dragState.mode === 'orbit') {
        orbitCamera(ctxRef.current, dx, dy);
        return;
      }
      if (dragState.mode === 'pan') {
        panCamera(ctxRef.current, dx, dy);
      }
    };

    const finishDrag = (event) => {
      if (!dragState.mode) return;
      if (event.pointerId !== undefined) renderer.domElement.releasePointerCapture?.(event.pointerId);
      const finishedMode = dragState.mode;
      const finishedPointId = dragState.pointId;
      dragState.mode = '';
      dragState.pointId = '';
      dragState.startPose = null;
      dragState.screenDepth = 0;
      if (finishedMode === 'marker') callbacksRef.current.onRigMarkerDragEnd(finishedPointId, STUNT_RIG_MARKER_BY_ID.get(finishedPointId) || null);
      renderer.domElement.classList.remove('rotating');
      renderer.domElement.classList.remove('panning');
      renderer.domElement.classList.remove('dragging');
      if (ctxRef.current) {
        ctxRef.current.activeRigMarkerId = '';
        ctxRef.current.activeRigMarkerPointerPosition = null;
        syncStuntRigMarkers(ctxRef.current);
      }
      renderer.domElement.dataset.cameraMode = finishedMode ? `done:${finishedMode}` : '';
      renderer.domElement.dataset.activeRigMarker = '';
    };

    const preventContextMenu = (event) => event.preventDefault();

    renderer.domElement.addEventListener('pointerdown', handlePointerDown);
    renderer.domElement.addEventListener('pointermove', handlePointerMove);
    renderer.domElement.addEventListener('pointerup', finishDrag);
    renderer.domElement.addEventListener('pointercancel', finishDrag);
    renderer.domElement.addEventListener('lostpointercapture', finishDrag);
    renderer.domElement.addEventListener('contextmenu', preventContextMenu);

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const characterTextures = createCharacterTextureSet(() => renderer.render(scene, camera));
    const context = {
      renderer,
      scene,
      model,
      characterAnchor,
      characterObject: null,
      characterBones: {},
      characterTextures,
      camera,
      cameraControls,
      pathLine,
      currentRig: null,
      groundLift: 0,
      rigMarkerRoot,
      rigMarkers: new Map(),
      rigMarkerLines: new Map(),
    };
    ctxRef.current = context;
    const initialRig = poseToRig(pose);
    context.currentRig = initialRig;
    applyPoseToCharacter(context, pose, initialRig);
    syncStuntRigMarkers(context);

    let loadCancelled = false;
    setLoadStatus('Chargement personnage...');
    loadThreeModelFromSource(
      STUNT_CHARACTER_MODEL_URL,
      { modelFormat: 'glb', modelUrl: STUNT_CHARACTER_MODEL_URL },
      ({ object, format = 'glb' } = {}) => {
        if (loadCancelled || !ctxRef.current) return;
        try {
          prepareGltfModel(object, getImportedModelPrepareOptions(format || 'glb', {
            restoreTextureColor: true,
            forceLitMaterials: true,
            forceVisibleMeshes: true,
            forceVisibleMaterials: true,
            hasResourceTextures: true,
            cloneMaterials: true,
            materialBrightness: 1.02,
          }));
          applyCharacterTextures(object, context.characterTextures);
          fitObjectToHeight(object, 1.96, { groundY: 0 });
          const characterBones = collectCharacterBones(object);
          const pelvisOffset = getCharacterPelvisOffset(object, characterBones.pelvis);
          object.position.sub(pelvisOffset);
          object.traverse((child) => {
            if (child.isMesh || child.isSkinnedMesh) {
              child.castShadow = true;
              child.receiveShadow = true;
              child.frustumCulled = false;
            }
          });
          characterAnchor.clear();
          characterAnchor.add(object);
          context.characterObject = object;
          context.characterBones = characterBones;
          const loadedRig = poseToRig(poseRef.current);
          applyPoseToCharacter(context, poseRef.current, loadedRig);
          context.currentRig = loadedRig;
          syncStuntRigMarkers(context);
          renderer.domElement.dataset.characterModel = 'exemple.glb';
          renderer.domElement.dataset.characterBones = String(Object.keys(characterBones).length);
          renderer.domElement.dataset.characterTexture = 'Material_001_Diffuse.jpg';
          setLoadStatus('');
        } catch (error) {
          setLoadStatus(error?.message ? `Personnage non charge: ${error.message}` : 'Personnage non charge');
        }
      },
      (error) => {
        if (!loadCancelled) setLoadStatus(error?.message ? `Personnage non charge: ${error.message}` : 'Personnage non charge');
      }
    );

    let frame = 0;
    let projectionFrame = 0;
    const render = () => {
      projectionFrame += 1;
      if (context.currentRig && (projectionFrame === 1 || projectionFrame % 8 === 0)) {
        syncStuntRigMarkers(context);
        renderer.domElement.dataset.renderFrame = String(projectionFrame);
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();

    return () => {
      loadCancelled = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', handlePointerDown);
      renderer.domElement.removeEventListener('pointermove', handlePointerMove);
      renderer.domElement.removeEventListener('pointerup', finishDrag);
      renderer.domElement.removeEventListener('pointercancel', finishDrag);
      renderer.domElement.removeEventListener('lostpointercapture', finishDrag);
      renderer.domElement.removeEventListener('contextmenu', preventContextMenu);
      renderer.dispose();
      disposeStuntRigMarkers(context.rigMarkers);
      disposeStuntRigMarkerLines(context.rigMarkerLines);
      const disposedTextures = new Set();
      scene.traverse((object) => {
        if (object.geometry) object.geometry.dispose();
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        objectMaterials.filter(Boolean).forEach((material) => {
          Object.values(material).forEach((value) => {
            if (!value?.isTexture || disposedTextures.has(value)) return;
            value.dispose();
            disposedTextures.add(value);
          });
          material.dispose?.();
        });
      });
      Object.values(characterTextures).forEach((texture) => {
        if (texture && !disposedTextures.has(texture)) texture.dispose?.();
      });
      renderer.domElement.remove();
      ctxRef.current = null;
    };
  }, []);

  useEffect(() => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const rig = poseToRig(pose);
    ctx.currentRig = rig;
    applyPoseToCharacter(ctx, pose, rig);
    syncStuntRigMarkers(ctx);

    const points = keyframes
      .map((keyframe) => poseToRig(keyframe).hip.clone().add(new ThreeVector3(0, 0.02, -0.48)));
    ctx.pathLine.geometry.dispose();
    ctx.pathLine.geometry = new ThreeBufferGeometry().setFromPoints(points.length > 1 ? points : []);
    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [pose, keyframeSignature, keyframes]);

  return (
    <div
      ref={containerRef}
      className="stunt-3d-stage"
      role="img"
      aria-label="Personnage cascadeur 3D"
      data-character-model="exemple.glb"
    >
      {loadStatus ? <span className="stunt-3d-status">{loadStatus}</span> : null}
    </div>
  );
}
