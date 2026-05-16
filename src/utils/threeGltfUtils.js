import * as THREE from 'three';

const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
const isDataUrl = (value = '') => String(value || '').startsWith('data:');

export const getGltfModelSource = (model = {}) => {
  if (isDataUrl(model.modelData) && (isBlobUrl(model.modelUrl) || model.modelUrl)) return model.modelData;
  return model.modelUrl || model.modelData || '';
};

export const getGltfModelSources = (model = {}) => {
  const primarySource = getGltfModelSource(model);
  const sources = [primarySource, model.modelUrl, model.modelData].filter(Boolean).map(String);
  return [...new Set(sources)];
};

const dataUrlToArrayBuffer = (source = '') => {
  const match = /^data:([^,]*),(.*)$/s.exec(source);
  if (!match) return null;
  const metadata = match[1] || '';
  const payload = match[2] || '';
  const binary = metadata.toLowerCase().includes(';base64')
    ? atob(payload)
    : decodeURIComponent(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes.buffer;
};

export const loadGltfFromSource = (loader, source, onLoad, onError) => {
  if (!loader || !source) {
    onError?.(new Error('Source GLB manquante.'));
    return;
  }

  if (String(source).startsWith('data:')) {
    try {
      const buffer = dataUrlToArrayBuffer(source);
      if (!buffer) throw new Error('Data URL GLB invalide.');
      loader.parse(buffer, '', onLoad, onError);
    } catch (error) {
      onError?.(error);
    }
    return;
  }

  loader.load(source, onLoad, undefined, onError);
};

const COLOR_TEXTURE_FIELDS = [
  'map',
  'emissiveMap',
  'sheenColorMap',
  'specularColorMap',
];

export const applyTextureToGltfModel = (object, texture, options = {}) => {
  if (!object || !texture) return false;
  let applied = false;
  let textureDisposalAssigned = false;
  object.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const applyToMaterial = (material) => {
      if (!material) return material;
      const nextMaterial = material.clone();
      nextMaterial.map = texture;
      if (nextMaterial.color?.set) nextMaterial.color.set(options.color || '#ffffff');
      nextMaterial.needsUpdate = true;
      nextMaterial.userData = {
        ...(material.userData || {}),
        disposeWithInstance: true,
      };
      if (options.disposeTextureWithMaterial && !textureDisposalAssigned) {
        nextMaterial.userData.disposeTextures = true;
        textureDisposalAssigned = true;
      }
      applied = true;
      return nextMaterial;
    };
    child.material = Array.isArray(child.material)
      ? child.material.map(applyToMaterial)
      : applyToMaterial(child.material);
  });
  return applied;
};

const restoreGeneratedTextureColor = (material, options) => {
  if (!options.restoreTextureColor) return;
  const envMapIntensity = Number.isFinite(Number(options.envMapIntensity)) ? Number(options.envMapIntensity) : 1.45;
  if ('envMapIntensity' in material) {
    material.envMapIntensity = Math.max(Number(material.envMapIntensity) || 1, envMapIntensity);
  }
  if (!material.map) return;
  const maxMetalness = Number.isFinite(Number(options.maxMetalness)) ? Number(options.maxMetalness) : 0.12;
  if (Number(material.metalness) >= 0.95 && Number(material.roughness) >= 0.85) {
    material.metalness = Math.min(Number(material.metalness) || 0, maxMetalness);
    material.roughness = Math.min(Math.max(Number(material.roughness) || 0.72, 0.42), 0.78);
  }
};

export const getGltfAnimationClips = (gltf) => (
  Array.isArray(gltf?.animations)
    ? gltf.animations.filter((clip) => clip && Number(clip.duration) > 0)
    : []
);

const selectAnimationClip = (clips, preferredNames = []) => {
  const preferredPatterns = preferredNames.length
    ? preferredNames
    : ['idle', 'stand', 'walk', 'run', 'animation', 'take'];
  return clips.find((clip) => {
    const name = String(clip.name || '').toLowerCase();
    return preferredPatterns.some((pattern) => name.includes(String(pattern).toLowerCase()));
  }) || clips[0] || null;
};

export const playGltfAnimations = (object, clips = [], options = {}) => {
  const animationClips = clips.filter((clip) => clip && Number(clip.duration) > 0);
  if (!object || !animationClips.length) return null;

  const mixer = new THREE.AnimationMixer(object);
  const selectedClips = options.playAll
    ? animationClips
    : [selectAnimationClip(animationClips, options.preferredNames)].filter(Boolean);
  const timeOffset = Number.isFinite(Number(options.timeOffset)) ? Number(options.timeOffset) : 0;

  selectedClips.forEach((clip, index) => {
    const action = mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = false;
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.play();
    if (clip.duration > 0) {
      const offset = timeOffset + index * 0.137;
      action.time = ((offset % clip.duration) + clip.duration) % clip.duration;
    }
  });

  object.userData.animationMixer = mixer;
  object.userData.animationClips = selectedClips;
  return mixer;
};

export const prepareGltfModel = (object, options = {}) => {
  object.traverse((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      COLOR_TEXTURE_FIELDS.forEach((field) => {
        if (material[field]) material[field].colorSpace = THREE.SRGBColorSpace;
      });
      restoreGeneratedTextureColor(material, options);
      material.needsUpdate = true;
    });
  });
};

export const snapObjectToGround = (object, groundY = 0) => {
  if (!object) return false;
  const targetGroundY = Number.isFinite(Number(groundY)) ? Number(groundY) : 0;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  if (!Number.isFinite(box.min.y) || !Number.isFinite(box.max.y)) return false;
  object.position.y += targetGroundY - box.min.y;
  object.updateMatrixWorld(true);
  return true;
};

export const fitObjectToHeight = (object, targetHeight = 2, options = {}) => {
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  if (!Number.isFinite(size.y) || size.y <= 0.0001) return false;

  const scale = Math.max(0.001, targetHeight / size.y);
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(object, true);
  const center = fittedBox.getCenter(new THREE.Vector3());
  const groundY = Number.isFinite(Number(options.groundY)) ? Number(options.groundY) : 0;
  object.position.x += options.centerX === false ? 0 : -center.x;
  object.position.z += options.centerZ === false ? 0 : -center.z;
  snapObjectToGround(object, groundY);
  return true;
};
