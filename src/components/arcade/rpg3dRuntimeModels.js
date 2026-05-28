import * as THREE from 'three';
import {
  getRuntimeModelPrepareOptions,
  hasThreeModelResources,
  loadThreeModelFromSource,
  prepareImportedAnimationClipForObject,
  prepareGltfModel,
} from '../../utils/threeGltfUtils';
import { getAnimationBaseSlotId } from '../../utils/rpg3dModelImportCore.js';

const LOCAL_FBX_RUNTIME_ANIMATION_MAX_BYTES = 192 * 1024 * 1024;
const LOCAL_FBX_RUNTIME_MAX_BYTES = 24 * 1024 * 1024;
const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
const getRuntimeModelFormat = (model = {}) => (
  String(model.modelFormat || model.characterModelFormat || model.decorModelFormat || '').toLowerCase()
);
const getRuntimeModelFileSize = (model = {}) => (
  Number(model.modelFileSize || model.characterModelFileSize || model.decorModelFileSize) || 0
);
const isHeavyLocalFbxAsset = (source = '', model = {}) => (
  getRuntimeModelFormat(model) === 'fbx'
  && isBlobUrl(source || model.modelUrl || model.characterModelUrl || model.decorModelUrl)
  && getRuntimeModelFileSize(model) > LOCAL_FBX_RUNTIME_MAX_BYTES
);
const isHeavyLocalFbxAnimationAsset = (source = '', animation = {}) => (
  getRuntimeModelFormat(animation) === 'fbx'
  && isBlobUrl(source || animation.modelUrl)
  && getRuntimeModelFileSize(animation) > LOCAL_FBX_RUNTIME_ANIMATION_MAX_BYTES
);

const IMAGE_SIGNATURE_CACHE_LIMIT = 128;
const imageSignatureCache = new Map();

const hashString = (value = '') => [...String(value)].reduce((hash, char) => (
  ((hash << 5) - hash + char.charCodeAt(0)) | 0
), 0);

const hashSourceSample = (src = '') => {
  if (src.length <= 4096) return hashString(src);
  const middle = Math.max(0, Math.floor(src.length / 2) - 512);
  return hashString([
    src.slice(0, 1024),
    src.slice(middle, middle + 1024),
    src.slice(-1024),
  ].join('|'));
};

const getImageSignature = (src = '') => {
  if (!src) return '0';
  const cached = imageSignatureCache.get(src);
  if (cached) return cached;
  const signature = `${src.length}:${hashSourceSample(src)}`;
  imageSignatureCache.set(src, signature);
  if (imageSignatureCache.size > IMAGE_SIGNATURE_CACHE_LIMIT) {
    imageSignatureCache.delete(imageSignatureCache.keys().next().value);
  }
  return signature;
};

const getModelResourcesSignature = (model = {}) => (
  [
    ...(Array.isArray(model.modelResources) ? model.modelResources : []),
    ...(Array.isArray(model.characterModelResources) ? model.characterModelResources : []),
  ]
    .map((resource) => `${resource?.path || resource?.name || ''}:${resource?.data?.length || resource?.url?.length || 0}`)
    .join(';')
);

const createCachedTextureGetter = (cache) => (src, repeat = false) => {
  if (!src) return null;
  const cacheKey = `${repeat ? 'repeat' : 'single'}:${src}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const texture = new THREE.TextureLoader().load(src);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
  }
  cache.set(cacheKey, texture);
  return texture;
};

const getAnimationSource = (animation = {}) => {
  if (String(animation.modelData || '').startsWith('data:')) return animation.modelData;
  return animation.modelUrl || animation.modelData || '';
};

const getModelAnimationEntries = (model = {}) => (
  model.characterModelAnimations && typeof model.characterModelAnimations === 'object'
    ? model.characterModelAnimations
    : model.modelAnimations || {}
);

const getAnimationResourcesSignature = (animation = {}) => (
  (animation.modelResources || [])
    .map((resource) => `${resource?.path || resource?.name || ''}:${resource?.data?.length || resource?.url?.length || 0}`)
    .join(',')
);

const getModelAnimationsSignature = (model = {}) => (
  Object.entries(getModelAnimationEntries(model))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([state, animation]) => [
      state,
      animation?.modelName || '',
      animation?.modelFormat || '',
      animation?.modelFileSize || '',
      getImageSignature(animation?.modelUrl || ''),
      getImageSignature(animation?.modelData || ''),
      getAnimationResourcesSignature(animation || {}),
    ].join(':'))
    .join(';')
);

const RUNTIME_MODEL_TEXTURE_FIELDS = [
  'map',
  'alphaMap',
  'aoMap',
  'bumpMap',
  'clearcoatMap',
  'clearcoatNormalMap',
  'clearcoatRoughnessMap',
  'displacementMap',
  'emissiveMap',
  'envMap',
  'iridescenceMap',
  'iridescenceThicknessMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'sheenColorMap',
  'sheenRoughnessMap',
  'specularColorMap',
  'specularIntensityMap',
  'specularMap',
  'thicknessMap',
  'transmissionMap',
];

const disposeRuntimeModelMaterial = (material, disposedTextures) => {
  if (!material) return;
  RUNTIME_MODEL_TEXTURE_FIELDS.forEach((field) => {
    const texture = material[field];
    if (!texture?.isTexture || disposedTextures.has(texture)) return;
    texture.dispose?.();
    disposedTextures.add(texture);
  });
  material.dispose?.();
};

const disposeRuntimeModelObject = (object) => {
  const disposedGeometries = new Set();
  const disposedMaterials = new Set();
  const disposedTextures = new Set();
  object?.traverse?.((child) => {
    if (child.geometry && !disposedGeometries.has(child.geometry)) {
      child.geometry.dispose?.();
      disposedGeometries.add(child.geometry);
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (disposedMaterials.has(material)) return;
      disposeRuntimeModelMaterial(material, disposedTextures);
      disposedMaterials.add(material);
    });
  });
};

const getModelCacheKey = (src, model = {}) => (
  `${src}|${getModelResourcesSignature(model)}|${getModelAnimationsSignature(model)}`
);

const loadModelAnimationClipMap = async (model = {}) => {
  const entries = Object.entries(getModelAnimationEntries(model));
  if (!entries.length) return {};
  const loadedEntries = await Promise.all(entries.map(([key, animation]) => new Promise((resolve) => {
    const state = getAnimationBaseSlotId(key, animation || {});
    if (!state) {
      resolve(['', []]);
      return;
    }
    const source = getAnimationSource(animation || {});
    if (!source || isHeavyLocalFbxAnimationAsset(source, animation || {})) {
      resolve([state, []]);
      return;
    }
    loadThreeModelFromSource(
      source,
      animation || {},
      ({ object, animations = [], format = '' } = {}) => {
        if (object) disposeRuntimeModelObject(object);
        const clips = Array.isArray(animations)
          ? animations.map((clip) => {
            if (clip) clip.userData = { ...(clip.userData || {}), rpg3dSourceFormat: format };
            return clip;
          })
          : [];
        resolve([state, clips]);
      },
      () => resolve([state, []]),
    );
  })));
  return loadedEntries.reduce((clipMap, [state, clips]) => {
    if (state && Array.isArray(clips) && clips.length) {
      clipMap[state] = [...(clipMap[state] || []), ...clips];
    }
    return clipMap;
  }, {});
};

const createCachedModelGetter = (cache, pending, failed, onLoaded, options = {}) => {
  const isActive = typeof options.isActive === 'function' ? options.isActive : () => true;
  const loadModelFromSource = options.loadModelFromSource || loadThreeModelFromSource;
  const loadAnimationClipMap = options.loadModelAnimationClipMap || loadModelAnimationClipMap;
  const getStatus = (src, model = {}) => {
    if (!src) return 'empty';
    if (isHeavyLocalFbxAsset(src, model)) return 'unsupported';
    const cacheKey = getModelCacheKey(src, model);
    if (cache.has(cacheKey)) return 'loaded';
    if (failed.has(cacheKey)) return 'failed';
    if (pending.has(cacheKey)) return 'loading';
    return 'idle';
  };
  const getter = (src, model = {}) => {
    if (!src) return null;
    if (isHeavyLocalFbxAsset(src, model)) return null;
    const cacheKey = getModelCacheKey(src, model);
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    if (failed.has(cacheKey) || pending.has(cacheKey)) return null;
    pending.add(cacheKey);
    loadModelFromSource(
      src,
      model,
      async ({ object, animations = [], format = '' } = {}) => {
        if (object) {
          if (!isActive()) {
            disposeRuntimeModelObject(object);
            pending.delete(cacheKey);
            return;
          }
          prepareGltfModel(object, getRuntimeModelPrepareOptions(format, {
            restoreTextureColor: true,
            forceLitMaterials: true,
            hasResourceTextures: hasThreeModelResources(model),
          }));
          object.userData.gltfAnimationClips = animations;
          object.userData.gltfAnimationClipMap = await loadAnimationClipMap(model);
          if (!isActive()) {
            disposeRuntimeModelObject(object);
            pending.delete(cacheKey);
            return;
          }
          object.userData.hasModelResources = hasThreeModelResources(model);
          cache.set(cacheKey, object);
          failed.delete(cacheKey);
        } else {
          failed.add(cacheKey);
        }
        pending.delete(cacheKey);
        onLoaded?.();
      },
      () => {
        pending.delete(cacheKey);
        failed.add(cacheKey);
        onLoaded?.();
      },
    );
    return null;
  };
  getter.getStatus = getStatus;
  return getter;
};

const getActorAnimationState = (actor = {}) => {
  if (Number(actor.attackTimer) > 0) return 'attack';
  if (Number(actor.dash) > 0) return 'dash';
  const speed = Math.hypot(Number(actor.vx) || 0, Number(actor.vy) || 0);
  return speed > 1 ? 'walk' : 'idle';
};

const getActorMovementFacingTarget = (actor = {}) => {
  const vx = Number(actor.vx) || 0;
  const vy = Number(actor.vy) || 0;
  if (Math.hypot(vx, vy) > 1) {
    return {
      x: (Number(actor.x) || 0) + vx,
      y: (Number(actor.y) || 0) + vy,
    };
  }
  const moveTarget = actor.moveTarget;
  if (moveTarget && Number.isFinite(Number(moveTarget.x)) && Number.isFinite(Number(moveTarget.y))) {
    const targetDistance = Math.hypot((Number(moveTarget.x) || 0) - (Number(actor.x) || 0), (Number(moveTarget.y) || 0) - (Number(actor.y) || 0));
    if (targetDistance > 2) return moveTarget;
  }
  return null;
};

const getActorAnimationOptions = (animationState = 'idle') => {
  if (animationState === 'attack') {
    return {
      state: 'attack',
      preferredNames: ['attack', 'atk', 'counter', 'hit', 'slash', 'melee', 'cast', 'spell', 'shoot', 'fire'],
      fallbackToFirst: true,
      loopOnce: true,
      timeOffset: 0,
    };
  }
  if (animationState === 'dash') {
    return { state: 'dash', preferredNames: ['run', 'sprint', 'dash', 'walk'], fallbackToFirst: true };
  }
  if (animationState === 'walk') {
    return { state: 'walk', preferredNames: ['walk', 'run', 'move', 'locomotion'], fallbackToFirst: true };
  }
  return { state: 'idle', preferredNames: ['idle', 'stand', 'breath', 'wait'], fallbackToFirst: false };
};

const getActorClipsForAnimationState = (template, state = 'idle') => {
  const clipMap = template?.userData?.gltfAnimationClipMap || {};
  if (Array.isArray(clipMap[state]) && clipMap[state].length) return clipMap[state];
  return Array.isArray(template?.userData?.gltfAnimationClips) ? template.userData.gltfAnimationClips : [];
};

const ACTOR_ANIMATION_STATES = ['idle', 'walk', 'dash', 'attack'];
const ACTOR_ANIMATION_FADE_SECONDS = 0.1;

const selectActorAnimationClip = (clips = [], preferredNames = [], options = {}) => {
  const animationClips = clips.filter((clip) => clip && Number(clip.duration) > 0);
  if (!animationClips.length) return null;
  const preferredClip = animationClips.find((clip) => {
    const name = String(clip.name || '').toLowerCase();
    return preferredNames.some((pattern) => name.includes(String(pattern).toLowerCase()));
  });
  if (preferredClip) return preferredClip;
  return options.fallbackToFirst === false ? null : animationClips[0] || null;
};

const configureActorAnimationAction = (action, options = {}) => {
  if (!action) return;
  const loopOnce = Boolean(options.loopOnce);
  action.enabled = true;
  action.clampWhenFinished = loopOnce;
  action.setLoop(loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, loopOnce ? 1 : Infinity);
};

const getActorAnimationEntry = (controller, animationState = 'idle') => {
  if (!controller?.actions) return null;
  return controller.actions[animationState]
    || (animationState === 'dash' ? controller.actions.walk : null)
    || controller.actions.idle
    || Object.values(controller.actions)[0]
    || null;
};

const applyActorAnimationTimeOffset = (entry, timeOffset = 0) => {
  const duration = Number(entry?.clip?.duration) || 0;
  if (!entry?.action || duration <= 0 || entry.options?.loopOnce) return;
  const offset = Number.isFinite(Number(timeOffset)) ? Number(timeOffset) : 0;
  entry.action.time = ((offset % duration) + duration) % duration;
};

const setActorAnimationState = (controller, animationState = 'idle', options = {}) => {
  const entry = getActorAnimationEntry(controller, animationState);
  if (!entry?.action) return false;
  const nextAction = entry.action;
  const previousAction = controller.currentAction;
  const sameAction = previousAction === nextAction;
  const sameState = controller.currentState === animationState && sameAction;
  if (sameState) return true;

  configureActorAnimationAction(nextAction, entry.options);
  const immediate = Boolean(options.immediate);
  const fadeSeconds = immediate || !previousAction ? 0 : ACTOR_ANIMATION_FADE_SECONDS;

  if (previousAction && !sameAction) {
    previousAction.fadeOut(fadeSeconds);
  }

  if (entry.options?.loopOnce || immediate || !sameAction) {
    nextAction.reset();
    applyActorAnimationTimeOffset(entry, options.timeOffset);
  }
  nextAction.paused = false;
  nextAction.setEffectiveWeight(1);
  if (!immediate && previousAction && !sameAction) nextAction.fadeIn(fadeSeconds);
  nextAction.play();

  controller.currentState = animationState;
  controller.currentAction = nextAction;
  return true;
};

const createActorAnimationController = (object, template, initialState = 'idle', timeOffset = 0) => {
  if (!object || !template) return null;
  const mixer = new THREE.AnimationMixer(object);
  const actions = {};

  ACTOR_ANIMATION_STATES.forEach((state) => {
    const stateOptions = getActorAnimationOptions(state);
    const hasDedicatedStateClips = Array.isArray(template?.userData?.gltfAnimationClipMap?.[state])
      && template.userData.gltfAnimationClipMap[state].length > 0;
    const rawSelectedClip = selectActorAnimationClip(
      getActorClipsForAnimationState(template, state),
      stateOptions.preferredNames,
      { fallbackToFirst: stateOptions.fallbackToFirst || (state === 'idle' && hasDedicatedStateClips) },
    );
    const selectedClip = prepareImportedAnimationClipForObject(object, rawSelectedClip, {
      convertFbxRootQuaternionTracks: String(rawSelectedClip?.userData?.rpg3dSourceFormat || '').toLowerCase() === 'fbx',
      stripObjectPositionScaleTracks: true,
    });
    const clip = selectedClip;
    if (!clip) return;
    const action = mixer.clipAction(clip);
    configureActorAnimationAction(action, stateOptions);
    action.setEffectiveWeight(0);
    actions[state] = { action, clip, options: stateOptions };
  });

  if (!Object.keys(actions).length) return null;
  const controller = {
    mixer,
    actions,
    currentAction: null,
    currentState: '',
  };
  setActorAnimationState(controller, initialState, { immediate: true, timeOffset });
  mixer.update(0);
  object.userData.animationMixer = mixer;
  object.userData.animationController = controller;
  return controller;
};

const updateActorAnimationState = (root, actor = {}) => {
  const controller = root?.userData?.animationController;
  if (!controller) return;
  setActorAnimationState(controller, getActorAnimationState(actor));
};

export {
  createActorAnimationController,
  createCachedModelGetter,
  createCachedTextureGetter,
  disposeRuntimeModelObject,
  getActorAnimationOptions,
  getActorAnimationState,
  getActorMovementFacingTarget,
  getImageSignature,
  getModelAnimationsSignature,
  getModelResourcesSignature,
  hashString,
  updateActorAnimationState,
};
