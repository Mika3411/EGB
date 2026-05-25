import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import {
  fitObjectToHeight,
  getImportedModelPrepareOptions,
  prepareGltfModel,
} from '../utils/threeGltfUtils';
import {
  CHARACTER_RIG_POINT_DEFINITIONS,
  CHARACTER_RIG_POINT_GROUPS,
} from '../utils/rpg3dCharacterRig.js';

const STUNT_CHARACTER_BASE_URL = '/assets/3d/characters/exemple/';
const STUNT_CHARACTER_MODEL_URL = `${STUNT_CHARACTER_BASE_URL}exemple.fbx`;
const STUNT_CHARACTER_DIFFUSE_URL = `${STUNT_CHARACTER_BASE_URL}exemple.fbm/Material_001_Diffuse.jpg`;
const STUNT_CHARACTER_NORMAL_URL = `${STUNT_CHARACTER_BASE_URL}exemple.fbm/Material_001_Normal.jpg`;
const STUNT_CHARACTER_TEXTURES = {
  'material_001_diffuse.jpg': STUNT_CHARACTER_DIFFUSE_URL,
  'material_001_normal.jpg': STUNT_CHARACTER_NORMAL_URL,
};

const JOINT_DEFINITIONS = CHARACTER_RIG_POINT_DEFINITIONS
  .filter((point) => point.group === CHARACTER_RIG_POINT_GROUPS.body);
const JOINT_IDS = JOINT_DEFINITIONS.map((point) => point.id);
const JOINT_CONFIG_BY_ID = new Map(JOINT_DEFINITIONS.map((point) => [point.id, point]));
const JOINT_LABELS = Object.fromEntries(JOINT_DEFINITIONS.map((point) => [point.id, point.label]));

const JOINT_BONE_SLOTS = {
  'right-hand': 'rightHand',
  'left-hand': 'leftHand',
  'right-elbow': 'rightLowerArm',
  'left-elbow': 'leftLowerArm',
  'right-shoulder': 'rightUpperArm',
  'left-shoulder': 'leftUpperArm',
  neck: 'neck',
  mouth: 'head',
  'lower-belly': 'pelvis',
  'right-groin-fold': 'rightUpperLeg',
  'left-groin-fold': 'leftUpperLeg',
  'right-knee': 'rightLowerLeg',
  'left-knee': 'leftLowerLeg',
  'right-ankle': 'rightFoot',
  'left-ankle': 'leftFoot',
  'right-foot': 'rightToe',
  'left-foot': 'leftToe',
};

const JOINT_FALLBACK_KEYS = {
  mouth: 'mouth',
  neck: 'neck',
  'right-hand': 'rightHand',
  'left-hand': 'leftHand',
  'right-elbow': 'rightElbow',
  'left-elbow': 'leftElbow',
  'right-shoulder': 'rightShoulder',
  'left-shoulder': 'leftShoulder',
  'lower-belly': 'lowerBelly',
  'right-groin-fold': 'rightGroinFold',
  'left-groin-fold': 'leftGroinFold',
  'right-knee': 'rightKnee',
  'left-knee': 'leftKnee',
  'right-ankle': 'rightAnkle',
  'left-ankle': 'leftAnkle',
  'right-foot': 'rightFoot',
  'left-foot': 'leftFoot',
};

const posePoint = (origin, length, angleDeg, zOffset = 0) => {
  const radians = (angleDeg * Math.PI) / 180;
  return new THREE.Vector3(
    origin.x + Math.sin(radians) * length,
    origin.y - Math.cos(radians) * length,
    origin.z + zOffset
  );
};

const poseToRig = (pose = {}) => {
  const rootX = Number(pose.rootX ?? 50);
  const rootY = Number(pose.rootY ?? 76);
  const bodyTilt = Number(pose.bodyTilt ?? 0);
  const bodyCurl = Number(pose.bodyCurl ?? 0);
  const headTilt = Number(pose.headTilt ?? 0);
  const hip = new THREE.Vector3((rootX - 50) / 23, ((86 - rootY) / 23) + 0.38, 0);
  const chest = posePoint(hip, 0.42, 180 + bodyTilt + bodyCurl * 0.25);
  const shoulder = posePoint(hip, 0.82, 180 + bodyTilt + bodyCurl * 0.18);
  const neck = posePoint(shoulder, 0.18, 180 + bodyTilt + headTilt * 0.16);
  const head = posePoint(neck, 0.28, 180 + bodyTilt + headTilt * 0.42);
  const mouth = neck.clone().lerp(head, 0.72).add(new THREE.Vector3(0.02, -0.015, 0));
  const leftShoulder = shoulder.clone().add(new THREE.Vector3(0, -0.03, -0.17));
  const rightShoulder = shoulder.clone().add(new THREE.Vector3(0, -0.03, 0.17));
  const leftHip = hip.clone().add(new THREE.Vector3(0, -0.02, -0.12));
  const rightHip = hip.clone().add(new THREE.Vector3(0, -0.02, 0.12));
  const leftElbow = posePoint(leftShoulder, 0.5, Number(pose.leftArm ?? 0), -0.08);
  const leftHand = posePoint(leftElbow, 0.43, Number(pose.leftArm ?? 0) + Number(pose.leftForearm ?? 0), -0.06);
  const rightElbow = posePoint(rightShoulder, 0.5, Number(pose.rightArm ?? 0), 0.08);
  const rightHand = posePoint(rightElbow, 0.43, Number(pose.rightArm ?? 0) + Number(pose.rightForearm ?? 0), 0.06);
  const leftKnee = posePoint(leftHip, 0.58, Number(pose.leftLeg ?? 0), -0.04);
  const leftAnkle = posePoint(leftKnee, 0.48, Number(pose.leftLeg ?? 0) + Number(pose.leftShin ?? 0), -0.05);
  const leftFoot = posePoint(leftKnee, 0.62, Number(pose.leftLeg ?? 0) + Number(pose.leftShin ?? 0), -0.075);
  const rightKnee = posePoint(rightHip, 0.58, Number(pose.rightLeg ?? 0), 0.04);
  const rightAnkle = posePoint(rightKnee, 0.48, Number(pose.rightLeg ?? 0) + Number(pose.rightShin ?? 0), 0.05);
  const rightFoot = posePoint(rightKnee, 0.62, Number(pose.rightLeg ?? 0) + Number(pose.rightShin ?? 0), 0.075);

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
    leftGroinFold: leftHip,
    rightGroinFold: rightHip,
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

const createMaterial = (color, options = {}) => new THREE.MeshStandardMaterial({
  color,
  roughness: 0.45,
  metalness: 0.06,
  ...options,
});

const degToRad = (value = 0) => THREE.MathUtils.degToRad(Number(value) || 0);

const normalizeBoneName = (value = '') => String(value || '')
  .replace(/\\/g, '/')
  .split('/')
  .pop()
  .replace(/[^a-z0-9]/gi, '')
  .toLowerCase();

const BONE_CANDIDATES = {
  pelvis: ['pelvis', 'ccbasepelvis', 'hips', 'mixamorighips'],
  spine01: ['spine01', 'spine1', 'spine'],
  spine03: ['spine03', 'spine3', 'spine02', 'spine2', 'chest'],
  spine05: ['spine05', 'spine5', 'spine04', 'spine4', 'upperchest'],
  neck: ['neck01', 'neck1', 'neck02', 'neck2', 'neck'],
  head: ['head'],
  leftUpperArm: ['upperarml', 'leftupperarm', 'mixamorigleftarm'],
  leftLowerArm: ['lowerarml', 'leftlowerarm', 'mixamorigleftforearm'],
  leftHand: ['handl', 'lefthand', 'mixamoriglefthand'],
  rightUpperArm: ['upperarmr', 'rightupperarm', 'mixamorigrightarm'],
  rightLowerArm: ['lowerarmr', 'rightlowerarm', 'mixamorigrightforearm'],
  rightHand: ['handr', 'righthand', 'mixamorigrighthand'],
  leftUpperLeg: ['thighl', 'leftupleg', 'leftupperleg', 'mixamorigleftupleg'],
  leftLowerLeg: ['calfl', 'leftleg', 'leftlowerleg', 'mixamorigleftleg'],
  leftFoot: ['footl', 'leftfoot', 'mixamorigleftfoot'],
  leftToe: ['toebasel', 'lefttoebase', 'lefttoe', 'mixamoriglefttoe', 'mixamoriglefttoebase'],
  rightUpperLeg: ['thighr', 'rightupleg', 'rightupperleg', 'mixamorigrightupleg'],
  rightLowerLeg: ['calfr', 'rightleg', 'rightlowerleg', 'mixamorigrightleg'],
  rightFoot: ['footr', 'rightfoot', 'mixamorigrightfoot'],
  rightToe: ['toebaser', 'righttoebase', 'righttoe', 'mixamorigrighttoe', 'mixamorigrighttoebase'],
};

const createCharacterLoadingManager = () => {
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url = '') => {
    const normalized = String(url || '').replace(/\\/g, '/').toLowerCase();
    const fileName = normalized.split('/').filter(Boolean).pop() || '';
    if (STUNT_CHARACTER_TEXTURES[fileName]) return STUNT_CHARACTER_TEXTURES[fileName];
    if (normalized.includes('exemple.fbm/') && fileName) {
      return `${STUNT_CHARACTER_BASE_URL}exemple.fbm/${fileName}`;
    }
    return url;
  });
  return manager;
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
  const textureLoader = new THREE.TextureLoader();
  const loadTexture = (url, colorSpace = null) => {
    const texture = textureLoader.load(url, () => onUpdate());
    if (colorSpace) texture.colorSpace = colorSpace;
    texture.anisotropy = 4;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.needsUpdate = true;
    return texture;
  };
  return {
    diffuse: loadTexture(STUNT_CHARACTER_DIFFUSE_URL, THREE.SRGBColorSpace),
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
      const nextMaterial = material.isMeshStandardMaterial ? material : new THREE.MeshStandardMaterial();
      if (nextMaterial !== material) {
        nextMaterial.name = material.name || '';
        nextMaterial.side = material.side ?? THREE.DoubleSide;
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
  bone.quaternion.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(
    degToRad(x),
    degToRad(y),
    degToRad(z),
    'XYZ'
  )));
};

const getCharacterPelvisOffset = (object, pelvisBone) => {
  if (!object || !pelvisBone) return new THREE.Vector3();
  object.updateMatrixWorld(true);
  const rootPosition = object.getWorldPosition(new THREE.Vector3());
  const pelvisPosition = pelvisBone.getWorldPosition(new THREE.Vector3());
  return pelvisPosition.sub(rootPosition);
};

const applyPoseToCharacter = (ctx, currentPose, rig) => {
  if (!ctx?.characterAnchor || !currentPose || !rig) return;
  const pose = currentPose;
  const bodyTilt = Number(pose.bodyTilt) || 0;
  const bodyYaw = Number(pose.bodyYaw) || 0;
  const bodyCurl = Number(pose.bodyCurl) || 0;
  const bodyTwist = Number(pose.bodyTwist) || 0;
  const headYaw = Number(pose.headYaw) || 0;
  ctx.characterAnchor.position.copy(rig.hip).add(new THREE.Vector3(0, -0.02, 0));
  ctx.characterAnchor.rotation.set(0, degToRad(bodyYaw), degToRad(-bodyTilt), 'XYZ');

  resetCharacterBones(ctx.characterBones);
  const bones = ctx.characterBones || {};
  rotateBone(bones.pelvis, 0, bodyTwist * 0.16, bodyCurl * 0.18);
  rotateBone(bones.spine01, bodyCurl * 0.22, bodyTwist * 0.28, bodyCurl * 0.08);
  rotateBone(bones.spine03, bodyCurl * 0.18, bodyTwist * 0.34, bodyCurl * 0.06);
  rotateBone(bones.spine05, bodyCurl * 0.12, bodyTwist * 0.38, bodyCurl * 0.04);
  rotateBone(bones.neck, Number(pose.headTilt) * 0.25, headYaw * 0.2, 0);
  rotateBone(bones.head, Number(pose.headTilt) * 0.52, headYaw * 0.58, 0);

  rotateBone(bones.leftUpperArm, 0, -12 + (Number(pose.leftArmSide) || 0) * 0.42, -Number(pose.leftArm) * 0.62);
  rotateBone(bones.leftLowerArm, 0, (Number(pose.leftForearmSide) || 0) * 0.34, -Number(pose.leftForearm) * 0.58);
  rotateBone(bones.leftHand, 0, (Number(pose.leftForearmSide) || 0) * 0.12, -Number(pose.leftForearm) * 0.14);
  rotateBone(bones.rightUpperArm, 0, 12 + (Number(pose.rightArmSide) || 0) * 0.42, -Number(pose.rightArm) * 0.62);
  rotateBone(bones.rightLowerArm, 0, (Number(pose.rightForearmSide) || 0) * 0.34, -Number(pose.rightForearm) * 0.58);
  rotateBone(bones.rightHand, 0, (Number(pose.rightForearmSide) || 0) * 0.12, -Number(pose.rightForearm) * 0.14);

  rotateBone(bones.leftUpperLeg, Number(pose.leftLeg) * 0.14, (Number(pose.leftLegSide) || 0) * 0.32, -Number(pose.leftLeg) * 0.48);
  rotateBone(bones.leftLowerLeg, Number(pose.leftShin) * 0.09, (Number(pose.leftShinSide) || 0) * 0.28, -Number(pose.leftShin) * 0.46);
  rotateBone(bones.leftFoot, -Number(pose.leftShin) * 0.1, (Number(pose.leftShinSide) || 0) * 0.1, 0);
  rotateBone(bones.rightUpperLeg, Number(pose.rightLeg) * 0.14, (Number(pose.rightLegSide) || 0) * 0.32, -Number(pose.rightLeg) * 0.48);
  rotateBone(bones.rightLowerLeg, Number(pose.rightShin) * 0.09, (Number(pose.rightShinSide) || 0) * 0.28, -Number(pose.rightShin) * 0.46);
  rotateBone(bones.rightFoot, -Number(pose.rightShin) * 0.1, (Number(pose.rightShinSide) || 0) * 0.1, 0);

  ctx.characterAnchor.updateMatrixWorld(true);
};

const getSkeletonJointPoint = (ctx, jointId, fallbackRig = {}) => {
  const boneSlot = JOINT_BONE_SLOTS[jointId];
  const bone = ctx?.characterBones?.[boneSlot];
  const fallbackKey = JOINT_FALLBACK_KEYS[jointId] || jointId;
  if (!bone || !ctx?.model) return fallbackRig[fallbackKey] || fallbackRig[jointId] || null;
  ctx.model.updateMatrixWorld(true);
  ctx.characterAnchor?.updateMatrixWorld(true);
  bone.updateMatrixWorld?.(true);
  const localPoint = bone.getWorldPosition(new THREE.Vector3());
  ctx.model.worldToLocal(localPoint);
  return localPoint;
};

const updateJointHandles = (ctx, rig = {}, activeJointId = '') => {
  if (!ctx?.joints) return {};
  const jointPoints = {};
  JOINT_IDS.forEach((jointId) => {
    const joint = ctx.joints[jointId];
    const point = getSkeletonJointPoint(ctx, jointId, rig);
    if (!joint || !point) return;
    jointPoints[jointId] = point.clone();
    joint.sphere.position.copy(point);
    joint.hit.position.copy(point);
    const isActive = jointId === activeJointId;
    const config = JOINT_CONFIG_BY_ID.get(jointId);
    joint.sphere.material = isActive
      ? ctx.materials.active
      : ctx.materials[config?.socket || 'armor'];
    joint.sphere.scale.setScalar(isActive ? 1.22 : 1);
  });
  ctx.currentJointPoints = jointPoints;
  return jointPoints;
};

const projectJointPoints = (ctx, jointPoints = ctx?.currentJointPoints || {}) => {
  if (!ctx?.renderer || !ctx?.model || !ctx?.camera) return;
  const rect = ctx.renderer.domElement.getBoundingClientRect();
  const projected = {};
  ctx.model.updateMatrixWorld(true);
  ctx.camera.updateMatrixWorld(true);
  Object.entries(jointPoints).forEach(([jointId, point]) => {
    if (!point) return;
    const worldPoint = point.clone();
    ctx.model.localToWorld(worldPoint);
    worldPoint.project(ctx.camera);
    projected[jointId] = {
      x: Math.round(((worldPoint.x + 1) / 2) * rect.width),
      y: Math.round(((1 - worldPoint.y) / 2) * rect.height),
    };
  });
  ctx.renderer.domElement.dataset.jointPoints = JSON.stringify(projected);
};

const createCameraControls = () => ({
  target: new THREE.Vector3(0, 0.92, 0),
  radius: 4.7,
  yaw: -0.08,
  pitch: 0.1,
});

const updateCameraFromControls = (camera, controls) => {
  if (!camera || !controls) return;
  const pitch = THREE.MathUtils.clamp(controls.pitch, -0.45, 0.78);
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
  projectJointPoints(ctx);
};

const panCamera = (ctx, dx = 0, dy = 0) => {
  if (!ctx?.cameraControls || !ctx.camera) return;
  const distanceScale = ctx.cameraControls.radius * 0.0019;
  const direction = new THREE.Vector3();
  ctx.camera.getWorldDirection(direction);
  const right = new THREE.Vector3().crossVectors(direction, ctx.camera.up).normalize();
  const up = new THREE.Vector3().crossVectors(right, direction).normalize();
  ctx.cameraControls.target
    .addScaledVector(right, -dx * distanceScale)
    .addScaledVector(up, dy * distanceScale);
  updateCameraFromControls(ctx.camera, ctx.cameraControls);
  projectJointPoints(ctx);
};

export default function StuntCharacter3DPreview({
  pose,
  keyframes = [],
  activeJointId = '',
  onJointSelect = () => {},
  onJointDrag = () => {},
  onJointDragEnd = () => {},
}) {
  const containerRef = useRef(null);
  const ctxRef = useRef(null);
  const callbacksRef = useRef({ onJointSelect, onJointDrag, onJointDragEnd });
  const poseRef = useRef(pose);
  const activeJointRef = useRef(activeJointId);
  const [loadStatus, setLoadStatus] = useState('Chargement personnage...');
  const keyframeSignature = useMemo(
    () => keyframes.map((keyframe) => `${keyframe.rootX}:${keyframe.rootY}:${keyframe.time}`).join('|'),
    [keyframes]
  );

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    activeJointRef.current = activeJointId;
  }, [activeJointId]);

  useEffect(() => {
    callbacksRef.current = { onJointSelect, onJointDrag, onJointDragEnd };
  }, [onJointSelect, onJointDrag, onJointDragEnd]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.shadowMap.enabled = true;
    renderer.domElement.className = 'stunt-3d-canvas';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07111f);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 20);
    const cameraControls = createCameraControls();
    updateCameraFromControls(camera, cameraControls);

    const ambient = new THREE.HemisphereLight(0xffffff, 0x172033, 1.18);
    scene.add(ambient);
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.35);
    keyLight.position.set(2.3, 4, 3.2);
    keyLight.castShadow = true;
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0xbfdbfe, 0.3);
    rimLight.position.set(-3.2, 2.2, -2.6);
    scene.add(rimLight);

    const grid = new THREE.GridHelper(4.8, 16, 0x38bdf8, 0x1e293b);
    grid.position.y = 0;
    scene.add(grid);
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(2.35, 48),
      new THREE.MeshBasicMaterial({ color: 0x0f172a, transparent: true, opacity: 0.64 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.006;
    scene.add(ground);

    const model = new THREE.Group();
    model.rotation.y = -0.38;
    scene.add(model);

    const materials = {
      weapon: createMaterial(0x38bdf8, { emissive: 0x075985, emissiveIntensity: 0.22, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false }),
      shield: createMaterial(0xfbbf24, { emissive: 0x92400e, emissiveIntensity: 0.28, transparent: true, opacity: 0.96, depthTest: false, depthWrite: false }),
      armor: createMaterial(0x34d399, { emissive: 0x052e1b, emissiveIntensity: 0.2, transparent: true, opacity: 0.94, depthTest: false, depthWrite: false }),
      active: createMaterial(0xfb7185, { emissive: 0x9f1239, emissiveIntensity: 0.38, transparent: true, opacity: 0.98, depthTest: false, depthWrite: false }),
      hit: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.002, depthWrite: false }),
      path: new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.72 }),
    };

    const characterAnchor = new THREE.Group();
    characterAnchor.name = 'stunt-fbx-character-anchor';
    model.add(characterAnchor);

    const joints = {};
    const hitTargets = [];
    JOINT_IDS.forEach((jointId) => {
      const config = JOINT_CONFIG_BY_ID.get(jointId);
      const radius = Math.max(0.035, Math.min(0.056, 0.043 * (Number(config?.size) || 1)));
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 18), materials[config?.socket || 'armor']);
      sphere.castShadow = true;
      sphere.renderOrder = 10;
      model.add(sphere);

      const hit = new THREE.Mesh(new THREE.SphereGeometry(radius * 4.2, 16, 12), materials.hit);
      hit.userData.jointId = jointId;
      model.add(hit);
      hitTargets.push(hit);
      joints[jointId] = { sphere, hit, baseRadius: radius };
    });

    const pathLine = new THREE.Line(new THREE.BufferGeometry(), materials.path);
    pathLine.position.z = -0.5;
    scene.add(pathLine);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragState = { mode: '', jointId: '', lastX: 0, lastY: 0 };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      updateCameraFromControls(camera, cameraControls);
      projectJointPoints(ctxRef.current);
    };

    const pickJoint = (event) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1);
      model.updateMatrixWorld(true);
      camera.updateMatrixWorld(true);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(hitTargets, false)[0];
      return hit?.object?.userData?.jointId || '';
    };

    const handlePointerDown = (event) => {
      if (dragState.mode) return;
      const button = Number(event.button ?? 0);
      if (button === 2) {
        event.preventDefault();
        if (event.pointerId !== undefined) renderer.domElement.setPointerCapture?.(event.pointerId);
        dragState.mode = 'pan';
        dragState.lastX = event.clientX;
        dragState.lastY = event.clientY;
        renderer.domElement.classList.add('panning');
        renderer.domElement.dataset.cameraMode = 'pan';
        return;
      }

      const jointId = pickJoint(event);
      renderer.domElement.dataset.lastPointerEvent = jointId ? `down:${jointId}` : 'down:none';
      if (!jointId) {
        if (button !== 0) return;
        event.preventDefault();
        if (event.pointerId !== undefined) renderer.domElement.setPointerCapture?.(event.pointerId);
        dragState.mode = 'orbit';
        dragState.lastX = event.clientX;
        dragState.lastY = event.clientY;
        renderer.domElement.classList.add('rotating');
        renderer.domElement.dataset.cameraMode = 'orbit';
        return;
      }
      if (button !== 0) return;
      event.preventDefault();
      if (event.pointerId !== undefined) renderer.domElement.setPointerCapture?.(event.pointerId);
      dragState.mode = 'joint';
      dragState.jointId = jointId;
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      renderer.domElement.classList.add('dragging');
      callbacksRef.current.onJointSelect(jointId);
    };

    const handlePointerMove = (event) => {
      if (!dragState.mode) {
        const overJoint = Boolean(pickJoint(event));
        renderer.domElement.classList.toggle('can-grab', overJoint);
        renderer.domElement.classList.toggle('can-rotate', !overJoint);
        return;
      }
      event.preventDefault();
      const dx = event.clientX - dragState.lastX;
      const dy = event.clientY - dragState.lastY;
      dragState.lastX = event.clientX;
      dragState.lastY = event.clientY;
      if (Math.abs(dx) + Math.abs(dy) <= 0) return;
      if (dragState.mode === 'orbit') {
        orbitCamera(ctxRef.current, dx, dy);
        return;
      }
      if (dragState.mode === 'pan') {
        panCamera(ctxRef.current, dx, dy);
        return;
      }
      callbacksRef.current.onJointDrag(dragState.jointId, { dx, dy });
    };

    const finishDrag = (event) => {
      if (!dragState.mode) return;
      if (event.pointerId !== undefined) renderer.domElement.releasePointerCapture?.(event.pointerId);
      if (dragState.mode === 'joint') callbacksRef.current.onJointDragEnd(dragState.jointId);
      const finishedMode = dragState.mode;
      dragState.mode = '';
      dragState.jointId = '';
      renderer.domElement.classList.remove('dragging');
      renderer.domElement.classList.remove('rotating');
      renderer.domElement.classList.remove('panning');
      renderer.domElement.dataset.cameraMode = finishedMode ? `done:${finishedMode}` : '';
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
      joints,
      pathLine,
      materials,
      currentRig: null,
      currentJointPoints: {},
    };
    ctxRef.current = context;
    const initialRig = poseToRig(pose);
    context.currentRig = initialRig;
    applyPoseToCharacter(context, pose, initialRig);
    updateJointHandles(context, initialRig, activeJointId);

    let loadCancelled = false;
    setLoadStatus('Chargement personnage...');
    const loader = new FBXLoader(createCharacterLoadingManager());
    loader.load(
      STUNT_CHARACTER_MODEL_URL,
      (object) => {
        if (loadCancelled || !ctxRef.current) return;
        try {
          prepareGltfModel(object, getImportedModelPrepareOptions('fbx', {
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
          updateJointHandles(context, loadedRig, activeJointRef.current);
          projectJointPoints(context);
          renderer.domElement.dataset.characterModel = 'exemple.fbx';
          renderer.domElement.dataset.characterBones = String(Object.keys(characterBones).length);
          renderer.domElement.dataset.characterTexture = 'Material_001_Diffuse.jpg';
          setLoadStatus('');
        } catch (error) {
          setLoadStatus(error?.message ? `Personnage non charge: ${error.message}` : 'Personnage non charge');
        }
      },
      undefined,
      (error) => {
        if (!loadCancelled) setLoadStatus(error?.message ? `Personnage non charge: ${error.message}` : 'Personnage non charge');
      }
    );

    let frame = 0;
    let projectionFrame = 0;
    const render = () => {
      projectionFrame += 1;
      if (context.currentRig && (projectionFrame === 1 || projectionFrame % 8 === 0)) {
        projectJointPoints(context);
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
    updateJointHandles(ctx, rig, activeJointId);

    const points = keyframes
      .map((keyframe) => poseToRig(keyframe).hip.clone().add(new THREE.Vector3(0, 0.02, -0.48)));
    ctx.pathLine.geometry.dispose();
    ctx.pathLine.geometry = new THREE.BufferGeometry().setFromPoints(points.length > 1 ? points : []);
    projectJointPoints(ctx);
    ctx.renderer.render(ctx.scene, ctx.camera);
  }, [pose, activeJointId, keyframeSignature, keyframes]);

  return (
    <div
      ref={containerRef}
      className="stunt-3d-stage"
      role="img"
      aria-label="Personnage cascadeur 3D"
      data-active-joint={activeJointId ? JOINT_LABELS[activeJointId] : ''}
      data-character-model="exemple.fbx"
    >
      {loadStatus ? <span className="stunt-3d-status">{loadStatus}</span> : null}
    </div>
  );
}
