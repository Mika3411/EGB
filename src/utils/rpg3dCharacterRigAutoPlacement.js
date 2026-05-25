import * as THREE from 'three';
import { getCharacterRigPointDefinition } from './rpg3dCharacterRig.js';

const DEFAULT_POINT_EPSILON = 0.001;
const BODY_POINT_IDS = new Set([
  'right-hand',
  'left-hand',
  'right-elbow',
  'left-elbow',
  'right-shoulder',
  'left-shoulder',
  'neck',
  'mouth',
  'lower-belly',
  'right-groin-fold',
  'left-groin-fold',
  'right-knee',
  'left-knee',
  'right-ankle',
  'left-ankle',
  'right-foot',
  'left-foot',
]);

const cleanBoneName = (value = '') => String(value || '')
  .toLowerCase()
  .replace(/mixamorig|armature|skeleton|bip001|bip01|biped/g, '')
  .replace(/[^a-z0-9]+/g, '');

const collectCharacterRigBones = (root = null) => {
  const boneByUuid = new Map();
  root?.updateMatrixWorld?.(true);
  root?.traverse?.((object) => {
    if (object?.isBone) boneByUuid.set(object.uuid, object);
    if (object?.isSkinnedMesh && Array.isArray(object.skeleton?.bones)) {
      object.skeleton.bones.forEach((bone) => {
        if (bone?.isBone) boneByUuid.set(bone.uuid, bone);
      });
    }
  });
  return [...boneByUuid.values()].map((bone) => ({
    bone,
    key: cleanBoneName(bone.name),
  })).filter((entry) => entry.key);
};

const getBoneWorldPosition = (bone = null) => {
  if (!bone?.isObject3D) return null;
  return bone.getWorldPosition(new THREE.Vector3());
};

const scoreBoneAlias = (key = '', alias = '') => {
  if (!key || !alias) return 0;
  if (key === alias) return 1000;
  if (key.endsWith(alias)) return 860 - key.length * 0.01;
  if (key.startsWith(alias)) return 780 - key.length * 0.01;
  if (key.includes(alias)) return 650 - key.length * 0.01;
  return 0;
};

const findRigBone = (bones = [], aliases = [], rejects = []) => {
  let best = null;
  bones.forEach((entry) => {
    if (!entry?.key || rejects.some((reject) => entry.key.includes(reject))) return;
    const score = aliases.reduce((highest, alias) => Math.max(highest, scoreBoneAlias(entry.key, cleanBoneName(alias))), 0);
    if (score > 0 && (!best || score > best.score)) best = { ...entry, score };
  });
  return best?.bone || null;
};

const getFingerAliases = (hand = 'right', finger = 'index', segment = '1') => {
  const side = hand === 'left' ? 'left' : 'right';
  const sideShort = hand === 'left' ? 'l' : 'r';
  const fingerAliases = finger === 'pinky' ? ['pinky', 'little'] : [finger];
  const segmentAliases = {
    1: ['1', '01', 'proximal'],
    2: ['2', '02', 'intermediate'],
    3: ['3', '03', 'distal'],
  }[String(segment)] || [String(segment)];
  return fingerAliases.flatMap((fingerName) => segmentAliases.flatMap((segmentName) => [
    `${side}${fingerName}${segmentName}`,
    `${side}hand${fingerName}${segmentName}`,
    `${sideShort}${fingerName}${segmentName}`,
    `${fingerName}${segmentName}${side}`,
    `${fingerName}${segmentName}${sideShort}`,
  ]));
};

export const isDefaultCharacterRigPointPlacement = (point = {}) => {
  const base = getCharacterRigPointDefinition(point?.id);
  if (!base) return false;
  return ['x', 'y', 'z'].every((axis) => (
    Math.abs((Number(point[axis]) || 0) - (Number(base[axis]) || 0)) <= DEFAULT_POINT_EPSILON
  ));
};

export const getCharacterRigBoundsWorldPoint = (bounds = null, point = {}) => {
  if (!bounds) return null;
  const size = bounds.getSize(new THREE.Vector3());
  if (
    !Number.isFinite(size.x)
    || !Number.isFinite(size.y)
    || !Number.isFinite(size.z)
    || size.x <= 0.0001
    || size.y <= 0.0001
    || size.z <= 0.0001
  ) return null;
  return new THREE.Vector3(
    bounds.min.x + size.x * point.x,
    bounds.min.y + size.y * point.y,
    bounds.min.z + size.z * point.z,
  );
};

export const getCharacterRigAutoAnchorMap = (root = null, bounds = null) => {
  const anchors = new Map();
  const bones = collectCharacterRigBones(root);
  if (!bones.length) return anchors;
  const size = bounds?.getSize?.(new THREE.Vector3()) || new THREE.Vector3(1, 1, 1);
  const fingerRejects = ['thumb', 'index', 'middle', 'ring', 'pinky', 'little'];
  const bonePosition = (aliases, rejects = []) => getBoneWorldPosition(findRigBone(bones, aliases, rejects));

  const bodyAnchors = {
    'right-hand': bonePosition(['righthand', 'rightwrist', 'rhand', 'rwrist', 'handr', 'wristr'], fingerRejects),
    'left-hand': bonePosition(['lefthand', 'leftwrist', 'lhand', 'lwrist', 'handl', 'wristl'], fingerRejects),
    'right-elbow': bonePosition(['rightforearm', 'rightlowerarm', 'rightelbow', 'rforearm', 'rlowerarm', 'relbow', 'forearmr'], ['hand', ...fingerRejects]),
    'left-elbow': bonePosition(['leftforearm', 'leftlowerarm', 'leftelbow', 'lforearm', 'llowerarm', 'lelbow', 'forearml'], ['hand', ...fingerRejects]),
    'right-shoulder': bonePosition(['rightupperarm', 'rightshoulder', 'rightarm', 'rupperarm', 'rshoulder', 'upperarmr'], ['forearm', 'lowerarm', 'hand', ...fingerRejects]),
    'left-shoulder': bonePosition(['leftupperarm', 'leftshoulder', 'leftarm', 'lupperarm', 'lshoulder', 'upperarml'], ['forearm', 'lowerarm', 'hand', ...fingerRejects]),
    neck: bonePosition(['neck']),
    'lower-belly': bonePosition(['hips', 'pelvis', 'hip', 'spine1', 'spine']),
    'right-groin-fold': bonePosition(['rightupleg', 'rightthigh', 'rthigh', 'rupleg', 'righthip'], ['legend']),
    'left-groin-fold': bonePosition(['leftupleg', 'leftthigh', 'lthigh', 'lupleg', 'lefthip'], ['legend']),
    'right-knee': bonePosition(['rightleg', 'rightlowerleg', 'rightshin', 'rightcalf', 'rightknee', 'rleg', 'rlowerleg', 'rshin', 'rcalf', 'rknee', 'legr', 'lowerlegr', 'shinr', 'calfr'], ['foot', 'toe']),
    'left-knee': bonePosition(['leftleg', 'leftlowerleg', 'leftshin', 'leftcalf', 'leftknee', 'lleg', 'llowerleg', 'lshin', 'lcalf', 'lknee', 'legl', 'lowerlegl', 'shinl', 'calfl'], ['foot', 'toe']),
    'right-ankle': bonePosition(['rightfoot', 'rightankle', 'rfoot', 'rankle', 'footr', 'ankler'], ['toe']),
    'left-ankle': bonePosition(['leftfoot', 'leftankle', 'lfoot', 'lankle', 'footl', 'anklel'], ['toe']),
    'right-foot': bonePosition(['righttoebase', 'righttoe', 'rightfootend', 'rtoebase', 'rtoe', 'toebaser', 'toer']) || bonePosition(['rightfoot', 'rfoot', 'footr'], ['toe']),
    'left-foot': bonePosition(['lefttoebase', 'lefttoe', 'leftfootend', 'ltoebase', 'ltoe', 'toebasel', 'toel']) || bonePosition(['leftfoot', 'lfoot', 'footl'], ['toe']),
  };

  Object.entries(bodyAnchors).forEach(([pointId, position]) => {
    if (BODY_POINT_IDS.has(pointId) && position) anchors.set(pointId, position);
  });

  const head = bonePosition(['head']);
  const neck = bodyAnchors.neck;
  if (head && neck && head.y > neck.y + 0.001) {
    anchors.set('mouth', neck.clone().lerp(head, 0.72).add(new THREE.Vector3(0, 0, -size.z * 0.035)));
  } else if (head) {
    anchors.set('mouth', head.clone().add(new THREE.Vector3(0, size.y * 0.035, -size.z * 0.045)));
  }

  ['right', 'left'].forEach((hand) => {
    ['thumb', 'index', 'middle', 'ring', 'pinky'].forEach((finger) => {
      ['1', '2', '3'].forEach((joint) => {
        const bone = findRigBone(bones, getFingerAliases(hand, finger, joint));
        const position = getBoneWorldPosition(bone);
        if (position) anchors.set(`${hand}-phalange-${finger}-${joint}`, position);
      });
    });
  });

  return anchors;
};

export const getCharacterRigAutoWorldPosition = (root = null, point = {}, bounds = null, autoAnchors = null) => {
  if (!root || !point?.id || !isDefaultCharacterRigPointPlacement(point)) return null;
  const anchors = autoAnchors || getCharacterRigAutoAnchorMap(root, bounds);
  return anchors.get(point.id)?.clone() || null;
};
