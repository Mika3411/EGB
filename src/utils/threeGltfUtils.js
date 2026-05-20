import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MTLLoader } from 'three/examples/jsm/loaders/MTLLoader.js';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
const isDataUrl = (value = '') => String(value || '').startsWith('data:');
const THREE_MODEL_FORMATS = new Set(['glb', 'fbx', 'obj']);
const THREE_MODEL_ARCHIVE_FORMATS = new Set(['zip']);
const THREE_MODEL_MIME_FORMATS = {
  'model/gltf-binary': 'glb',
  'model/gltf+json': 'glb',
  'model/obj': 'obj',
  'application/vnd.autodesk.fbx': 'fbx',
  'model/vnd.fbx': 'fbx',
};
const THREE_MODEL_MIME_TYPES = {
  glb: 'model/gltf-binary',
  fbx: 'application/octet-stream',
  obj: 'model/obj',
};
const THREE_MODEL_FORMAT_LABELS = {
  glb: 'GLB',
  fbx: 'FBX',
  obj: 'OBJ',
};
const THREE_MODEL_ARCHIVE_MIME_FORMATS = {
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
};

export const THREE_MODEL_ACCEPT = [
  '.glb',
  '.fbx',
  '.obj',
  '.zip',
  'model/gltf-binary',
  'model/obj',
  'application/vnd.autodesk.fbx',
  'model/vnd.fbx',
  'application/zip',
  'application/x-zip-compressed',
  'application/octet-stream',
].join(',');

const getDataUrlMimeType = (source = '') => (
  String(source || '').match(/^data:([^;,]+)/i)?.[1]?.toLowerCase() || ''
);

const getSourceExtension = (source = '') => {
  const withoutQuery = String(source || '').split(/[?#]/)[0];
  const extension = withoutQuery.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return THREE_MODEL_FORMATS.has(extension) ? extension : '';
};

export const getThreeModelMimeType = (format = '') => (
  THREE_MODEL_MIME_TYPES[String(format || '').toLowerCase()] || 'application/octet-stream'
);

export const getThreeModelFormatLabel = (format = '') => (
  THREE_MODEL_FORMAT_LABELS[String(format || '').toLowerCase()] || '3D'
);

export const getThreeModelFormat = (modelOrSource = {}, source = '') => {
  const candidates = [];
  if (modelOrSource && typeof modelOrSource === 'object') {
    candidates.push(
      modelOrSource.modelFormat,
      modelOrSource.modelName,
      modelOrSource.characterModelName,
      modelOrSource.decorModelName,
      modelOrSource.modelUrl,
      modelOrSource.modelData,
      modelOrSource.characterModelUrl,
      modelOrSource.decorModelUrl,
      modelOrSource.decorModelData,
      modelOrSource.name,
    );
  } else {
    candidates.push(modelOrSource);
  }
  candidates.push(source);

  for (const candidate of candidates.filter(Boolean).map(String)) {
    const explicitFormat = candidate.toLowerCase();
    if (THREE_MODEL_FORMATS.has(explicitFormat)) return explicitFormat;

    const dataMimeType = getDataUrlMimeType(candidate);
    if (THREE_MODEL_MIME_FORMATS[dataMimeType]) return THREE_MODEL_MIME_FORMATS[dataMimeType];

    const extension = getSourceExtension(candidate);
    if (extension) return extension;

    const mimeFormat = THREE_MODEL_MIME_FORMATS[explicitFormat];
    if (mimeFormat) return mimeFormat;
  }
  return '';
};

export const getThreeModelFileFormat = (file = null) => {
  if (!file) return '';
  return getThreeModelFormat(file.name || '') || getThreeModelFormat(file.type || '');
};

export const isThreeModelFile = (file = null) => Boolean(getThreeModelFileFormat(file));

export const getThreeModelArchiveFileFormat = (file = null) => {
  if (!file) return '';
  const extension = String(file.name || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  if (THREE_MODEL_ARCHIVE_FORMATS.has(extension)) return extension;
  return THREE_MODEL_ARCHIVE_MIME_FORMATS[String(file.type || '').toLowerCase()] || '';
};

export const isThreeModelArchiveFile = (file = null) => Boolean(getThreeModelArchiveFileFormat(file));

export const normalizeThreeModelFile = (file = null, format = '') => {
  if (!file) return file;
  const modelFormat = format || getThreeModelFileFormat(file);
  const mimeType = getThreeModelMimeType(modelFormat);
  if (!modelFormat || file.type === mimeType || typeof File === 'undefined') return file;
  const fileName = file.name || `modele.${modelFormat}`;
  return new File([file], fileName, {
    type: mimeType,
    lastModified: file.lastModified || Date.now(),
  });
};

export const getGltfModelSource = (model = {}) => {
  if (isBlobUrl(model.modelUrl)) return model.modelUrl;
  if (isDataUrl(model.modelData) && (isBlobUrl(model.modelUrl) || model.modelUrl)) return model.modelData;
  return model.modelUrl || model.modelData || '';
};

export const getGltfModelSources = (model = {}) => {
  const primarySource = getGltfModelSource(model);
  const sources = isBlobUrl(model.modelUrl)
    ? [model.modelUrl, model.modelData]
    : [primarySource, model.modelUrl, model.modelData];
  return [...new Set(sources)];
};

const normalizeResourcePath = (value = '') => {
  const withoutQuery = String(value || '').split(/[?#]/)[0].replace(/\\/g, '/');
  try {
    return decodeURIComponent(withoutQuery);
  } catch {
    return withoutQuery;
  }
};

const getResourcePathKeys = (value = '') => {
  const normalized = normalizeResourcePath(value).replace(/^\.\/+/, '').replace(/^\/+/, '');
  const basename = normalized.split('/').filter(Boolean).pop() || normalized;
  return [normalized, basename]
    .filter(Boolean)
    .map((entry) => entry.toLowerCase());
};

const getResourceExtension = (value = '') => (
  normalizeResourcePath(value).match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || ''
);

export const getThreeModelResourceEntries = (model = {}) => (
  [
    ...(Array.isArray(model.modelResources) ? model.modelResources : []),
    ...(Array.isArray(model.characterModelResources) ? model.characterModelResources : []),
    ...(Array.isArray(model.decorModelResources) ? model.decorModelResources : []),
  ]
    .filter((resource) => resource && (resource.data || resource.url) && (resource.path || resource.name))
);

export const hasThreeModelResources = (model = {}) => getThreeModelResourceEntries(model).length > 0;

const createModelLoadingManager = (model = {}) => {
  const resources = getThreeModelResourceEntries(model);
  if (!resources.length) return new THREE.LoadingManager();
  const resourceMap = new Map();
  resources.forEach((resource) => {
    const source = resource.url || resource.data || '';
    if (!source) return;
    [resource.path, resource.name].forEach((candidate) => {
      getResourcePathKeys(candidate).forEach((key) => resourceMap.set(key, source));
    });
  });
  const manager = new THREE.LoadingManager();
  manager.setURLModifier((url) => {
    for (const key of getResourcePathKeys(url)) {
      const source = resourceMap.get(key);
      if (source) return source;
    }
    return url;
  });
  return manager;
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

const dataUrlToText = (source = '') => {
  const match = /^data:([^,]*),(.*)$/s.exec(source);
  if (!match) return null;
  const metadata = match[1] || '';
  const payload = match[2] || '';
  if (!metadata.toLowerCase().includes(';base64')) return decodeURIComponent(payload);
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new TextDecoder().decode(bytes);
};

const loadTextFromSource = async (source = '', invalidMessage = 'Source texte invalide.') => {
  if (String(source).startsWith('data:')) {
    const text = dataUrlToText(source);
    if (!text) throw new Error(invalidMessage);
    return text;
  }
  const response = await fetch(source);
  if (!response.ok) throw new Error(invalidMessage);
  return response.text();
};

const getObjMaterialResourceSource = (model = {}, objText = '') => {
  const materialResources = getThreeModelResourceEntries(model).filter((resource) => (
    getResourceExtension(resource.path || resource.name) === 'mtl'
  ));
  if (!materialResources.length) return '';
  const references = Array.from(String(objText || '').matchAll(/^\s*mtllib\s+(.+)$/gim))
    .map((match) => match[1]?.trim())
    .filter(Boolean);
  for (const reference of references) {
    const referenceKeys = getResourcePathKeys(reference);
    const match = materialResources.find((resource) => {
      const resourceKeys = [
        ...getResourcePathKeys(resource.path || ''),
        ...getResourcePathKeys(resource.name || ''),
      ];
      return resourceKeys.some((key) => referenceKeys.includes(key));
    });
    if (match) return match.url || match.data || '';
  }
  return materialResources[0].url || materialResources[0].data || '';
};

const applyObjMaterialLibrary = async (loader, model, manager, objText) => {
  const materialSource = getObjMaterialResourceSource(model, objText);
  if (!materialSource) return;
  const materialText = await loadTextFromSource(materialSource, 'MTL introuvable.');
  const materials = new MTLLoader(manager).parse(materialText, '');
  materials.preload();
  loader.setMaterials(materials);
};

export const loadGltfFromSource = (loader, source, onLoad, onError) => {
  if (!loader || !source) {
    onError?.(new Error('Source 3D manquante.'));
    return;
  }

  if (String(source).startsWith('data:')) {
    try {
      const buffer = dataUrlToArrayBuffer(source);
      if (!buffer) throw new Error('Data URL 3D invalide.');
      loader.parse(buffer, '', onLoad, onError);
    } catch (error) {
      onError?.(error);
    }
    return;
  }

  loader.load(source, onLoad, undefined, onError);
};

const loadFbxFromSource = (loader, source, onLoad, onError) => {
  if (String(source).startsWith('data:')) {
    try {
      const buffer = dataUrlToArrayBuffer(source);
      if (!buffer) throw new Error('Data URL FBX invalide.');
      onLoad?.(loader.parse(buffer, ''));
    } catch (error) {
      onError?.(error);
    }
    return;
  }
  if (isBlobUrl(source)) {
    fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error('Blob FBX inaccessible.');
        return response.arrayBuffer();
      })
      .then((buffer) => onLoad?.(loader.parse(buffer, '')))
      .catch((error) => onError?.(error));
    return;
  }
  loader.load(source, onLoad, undefined, onError);
};

const loadObjFromSource = (loader, source, model, manager, onLoad, onError) => {
  const handleText = (text) => {
    applyObjMaterialLibrary(loader, model, manager, text)
      .then(() => onLoad?.(loader.parse(text)))
      .catch((error) => onError?.(error));
  };
  if (String(source).startsWith('data:')) {
    try {
      const text = dataUrlToText(source);
      if (!text) throw new Error('Data URL OBJ invalide.');
      handleText(text);
    } catch (error) {
      onError?.(error);
    }
    return;
  }
  if (isBlobUrl(source)) {
    fetch(source)
      .then((response) => {
        if (!response.ok) throw new Error('Blob OBJ inaccessible.');
        return response.text();
      })
      .then(handleText)
      .catch((error) => onError?.(error));
    return;
  }
  if (getObjMaterialResourceSource(model)) {
    loadTextFromSource(source, 'OBJ inaccessible.')
      .then(handleText)
      .catch((error) => onError?.(error));
    return;
  }
  loader.load(source, onLoad, undefined, onError);
};

export const loadThreeModelFromSource = (source, model = {}, onLoad, onError) => {
  const format = getThreeModelFormat(model, source);
  if (!source || !format) {
    onError?.(new Error('Modele 3D manquant ou format non supporte.'));
    return;
  }
  const manager = createModelLoadingManager(model);

  if (format === 'glb') {
    const gltfLoader = new GLTFLoader(manager);
    gltfLoader.setMeshoptDecoder(MeshoptDecoder);
    loadGltfFromSource(
      gltfLoader,
      source,
      (gltf) => {
        const object = gltf.scene || gltf.scenes?.[0];
        if (!object) {
          onError?.(new Error('Scene GLB introuvable.'));
          return;
        }
        object.userData.modelFormat = format;
        onLoad?.({ object, animations: getGltfAnimationClips(gltf), format });
      },
      onError,
    );
    return;
  }

  const handleObject = (object) => {
    if (!object) {
      onError?.(new Error('Objet 3D introuvable.'));
      return;
    }
    object.userData.modelFormat = format;
    onLoad?.({ object, animations: getGltfAnimationClips(object), format });
  };

  if (format === 'fbx') {
    loadFbxFromSource(new FBXLoader(manager), source, handleObject, onError);
    return;
  }

  if (format === 'obj') {
    loadObjFromSource(new OBJLoader(manager), source, model, manager, handleObject, onError);
    return;
  }

  onError?.(new Error('Format 3D non supporte.'));
};

export const getThreeModelSource = getGltfModelSource;
export const getThreeModelSources = getGltfModelSources;

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
      const { disposeTextures, ...sourceUserData } = material.userData || {};
      nextMaterial.userData = {
        ...sourceUserData,
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

const materialReceivesLighting = (material) => Boolean(
  material?.isMeshStandardMaterial
  || material?.isMeshPhysicalMaterial
  || material?.isMeshLambertMaterial
  || material?.isMeshPhongMaterial
  || material?.isMeshToonMaterial
);

const copyMaterialRenderState = (source, target) => {
  if (!source || !target) return;
  [
    'vertexColors',
    'blending',
    'side',
    'opacity',
    'transparent',
    'alphaHash',
    'alphaTest',
    'depthFunc',
    'depthTest',
    'depthWrite',
    'colorWrite',
    'stencilWrite',
    'stencilWriteMask',
    'stencilFunc',
    'stencilRef',
    'stencilFuncMask',
    'stencilFail',
    'stencilZFail',
    'stencilZPass',
    'clippingPlanes',
    'clipIntersection',
    'clipShadows',
    'shadowSide',
    'colorWrite',
    'polygonOffset',
    'polygonOffsetFactor',
    'polygonOffsetUnits',
    'dithering',
    'alphaToCoverage',
    'premultipliedAlpha',
    'forceSinglePass',
    'visible',
    'toneMapped',
    'flatShading',
    'wireframe',
    'wireframeLinewidth',
    'wireframeLinecap',
    'wireframeLinejoin',
  ].forEach((field) => {
    if (field in source && field in target) target[field] = source[field];
  });
  [
    'blendSrc',
    'blendDst',
    'blendEquation',
    'blendSrcAlpha',
    'blendDstAlpha',
    'blendEquationAlpha',
    'blendAlpha',
  ].forEach((field) => {
    if (field in source && field in target) target[field] = source[field];
  });
  if (source.blendColor?.isColor && target.blendColor?.copy) target.blendColor.copy(source.blendColor);
};

const convertToLitMaterial = (material, options = {}) => {
  if (!options.forceLitMaterials || !material) return material;
  const shouldConvert = options.forceStandardMaterials || !materialReceivesLighting(material);
  if (!shouldConvert) return material;
  const useNeutralTextureTint = Boolean(options.forceTextureBaseColor && material.map);
  const nextMaterial = new THREE.MeshStandardMaterial({
    name: material.name || '',
    color: useNeutralTextureTint
      ? new THREE.Color('#ffffff')
      : material.color?.clone?.() || new THREE.Color('#ffffff'),
    map: material.map || null,
    alphaMap: material.alphaMap || null,
    aoMap: material.aoMap || null,
    aoMapIntensity: Number.isFinite(Number(material.aoMapIntensity)) ? Number(material.aoMapIntensity) : 1,
    bumpMap: material.bumpMap || null,
    bumpScale: Number.isFinite(Number(material.bumpScale)) ? Number(material.bumpScale) : 1,
    displacementMap: material.displacementMap || null,
    displacementScale: Number.isFinite(Number(material.displacementScale)) ? Number(material.displacementScale) : 1,
    displacementBias: Number.isFinite(Number(material.displacementBias)) ? Number(material.displacementBias) : 0,
    emissive: material.emissive?.clone?.() || new THREE.Color('#000000'),
    emissiveMap: material.emissiveMap || null,
    emissiveIntensity: Number.isFinite(Number(material.emissiveIntensity)) ? Number(material.emissiveIntensity) : 1,
    lightMap: material.lightMap || null,
    lightMapIntensity: Number.isFinite(Number(material.lightMapIntensity)) ? Number(material.lightMapIntensity) : 1,
    normalMap: material.normalMap || null,
    normalScale: material.normalScale?.clone?.() || new THREE.Vector2(1, 1),
    roughnessMap: material.roughnessMap || null,
    metalnessMap: material.metalnessMap || null,
    transparent: Boolean(material.transparent),
    opacity: Number.isFinite(Number(material.opacity)) ? Number(material.opacity) : 1,
    alphaTest: Number.isFinite(Number(material.alphaTest)) ? Number(material.alphaTest) : 0,
    side: material.side ?? THREE.FrontSide,
    roughness: Number.isFinite(Number(material.roughness)) ? Number(material.roughness) : 0.78,
    metalness: Number.isFinite(Number(material.metalness)) ? Number(material.metalness) : 0.04,
  });
  copyMaterialRenderState(material, nextMaterial);
  const { disposeTextures, ...sourceUserData } = material.userData || {};
  nextMaterial.userData = {
    ...sourceUserData,
    convertedToLitMaterial: true,
    disposeWithInstance: true,
  };
  return nextMaterial;
};

const TEXTURE_MAP_FIELDS = [
  ...COLOR_TEXTURE_FIELDS,
  'alphaMap',
  'aoMap',
  'bumpMap',
  'displacementMap',
  'lightMap',
  'metalnessMap',
  'normalMap',
  'roughnessMap',
  'specularMap',
];

const hasFiniteNumber = (value) => Number.isFinite(Number(value));

const getMaterialBrightness = (options = {}) => {
  const value = Number(options.materialBrightness);
  return Number.isFinite(value) ? Math.min(1.6, Math.max(0.15, value)) : 1;
};

const getOrCreateMaterialAppearanceBase = (material) => {
  if (!material) return null;
  const existing = material.userData?.rpg3dAppearanceBase;
  if (existing?.color?.isColor || existing?.emissive?.isColor) return existing;
  const base = {
    color: material.color?.clone?.() || null,
    emissive: material.emissive?.clone?.() || null,
    emissiveIntensity: Number.isFinite(Number(material.emissiveIntensity)) ? Number(material.emissiveIntensity) : null,
    envMapIntensity: Number.isFinite(Number(material.envMapIntensity)) ? Number(material.envMapIntensity) : null,
  };
  material.userData = {
    ...(material.userData || {}),
    rpg3dAppearanceBase: base,
  };
  return base;
};

const applyManagedMaterialAppearance = (material, options = {}) => {
  if (!material) return false;
  const base = getOrCreateMaterialAppearanceBase(material);
  const brightness = getMaterialBrightness(options);
  if (base?.color?.isColor && material.color?.copy) {
    material.color.copy(base.color);
    if (brightness !== 1) material.color.multiplyScalar(brightness);
  }
  if (base?.emissive?.isColor && material.emissive?.copy) {
    material.emissive.copy(base.emissive);
    if (brightness < 1) material.emissive.multiplyScalar(Math.max(0.2, brightness));
  }
  if (base && 'envMapIntensity' in material && base.envMapIntensity !== null) {
    const maxEnvMapIntensity = Number(options.maxEnvMapIntensity);
    material.envMapIntensity = Number.isFinite(maxEnvMapIntensity)
      ? Math.min(base.envMapIntensity, Math.max(0, maxEnvMapIntensity))
      : base.envMapIntensity;
  }
  if (base && 'emissiveIntensity' in material && base.emissiveIntensity !== null) {
    const maxEmissiveIntensity = Number(options.maxEmissiveIntensity);
    material.emissiveIntensity = Number.isFinite(maxEmissiveIntensity)
      ? Math.min(base.emissiveIntensity, Math.max(0, maxEmissiveIntensity))
      : base.emissiveIntensity;
    if (brightness < 1) material.emissiveIntensity *= brightness;
  }
  material.userData = {
    ...(material.userData || {}),
    rpg3dAppearanceManaged: true,
    rpg3dAppearanceBrightness: brightness,
  };
  material.needsUpdate = true;
  return true;
};

const shouldCloneMaterialsForAppearance = (options = {}) => (
  Boolean(options.cloneMaterials)
  || hasFiniteNumber(options.materialBrightness)
  || hasFiniteNumber(options.maxEnvMapIntensity)
  || hasFiniteNumber(options.maxEmissiveIntensity)
);

const cloneMaterialForAppearance = (material) => {
  const nextMaterial = material?.clone?.() || material;
  if (nextMaterial?.userData) {
    const { disposeTextures, ...sourceUserData } = material.userData || {};
    nextMaterial.userData = {
      ...sourceUserData,
      disposeWithInstance: true,
    };
  }
  return nextMaterial;
};

const tuneImportedMaterialAppearance = (material, options = {}) => {
  if (!material) return;
  applyManagedMaterialAppearance(material, options);
};

const forceMaterialVisibility = (material, options = {}) => {
  if (!material) return;
  if (options.forceVisibleMaterials && 'visible' in material) material.visible = true;
  if (options.forceDoubleSidedMaterials) material.side = THREE.DoubleSide;
  if (options.stripTextureMaps) {
    TEXTURE_MAP_FIELDS.forEach((field) => {
      if (field in material) material[field] = null;
    });
    if (material.color?.set) material.color.set(options.fallbackColor || '#f8fafc');
  } else if (options.ignoreOpacityTextures && 'alphaMap' in material) {
    material.alphaMap = null;
  }
  const opacity = Number(material.opacity);
  const alphaTest = Number(material.alphaTest);
  const minimumOpacity = Number(options.minimumOpacity);
  if (Number.isFinite(minimumOpacity) && (!Number.isFinite(opacity) || opacity < minimumOpacity)) {
    material.opacity = 1;
    material.transparent = false;
    material.depthWrite = true;
  }
  if (Number.isFinite(minimumOpacity) && Number.isFinite(alphaTest) && alphaTest >= 0.95) {
    material.alphaTest = 0.05;
  }
  if (
    (options.stripTextureMaps || options.ignoreOpacityTextures)
    && (!Number.isFinite(Number(material.opacity)) || Number(material.opacity) >= 0.999)
    && (!Number.isFinite(Number(material.alphaTest)) || Number(material.alphaTest) <= 0.05)
  ) {
    material.transparent = false;
    material.depthWrite = true;
  }
};

export const getImportedModelPrepareOptions = (format = '', options = {}) => {
  const modelFormat = String(format || '').toLowerCase();
  if (modelFormat !== 'fbx') return options;
  const hasResourceTextures = Boolean(options.hasResourceTextures);
  return {
    ...options,
    forceDoubleSidedMaterials: true,
    forceStandardMaterials: true,
    forceTextureBaseColor: hasResourceTextures,
    ignoreOpacityTextures: true,
    stripTextureMaps: !hasResourceTextures,
  };
};

export const getRuntimeModelPrepareOptions = (format = '', options = {}) => {
  const modelFormat = String(format || '').toLowerCase();
  if (modelFormat === 'glb' || modelFormat === 'gltf' || !modelFormat) {
    const {
      forceLitMaterials,
      forceVisibleMaterials,
      forceVisibleMeshes,
      ignoreOpacityTextures,
      minimumOpacity,
      stripTextureMaps,
      ...safeOptions
    } = options;
    return {
      ...safeOptions,
      forceLitMaterials: false,
      forceVisibleMaterials: false,
      forceVisibleMeshes: false,
      ignoreOpacityTextures: false,
      stripTextureMaps: false,
    };
  }
  return getImportedModelPrepareOptions(format, options);
};

export const getGltfAnimationClips = (gltf) => (
  Array.isArray(gltf?.animations)
    ? gltf.animations.filter((clip) => clip && Number(clip.duration) > 0)
    : []
);

const selectAnimationClip = (clips, preferredNames = [], options = {}) => {
  const preferredPatterns = preferredNames.length
    ? preferredNames
    : ['idle', 'stand', 'walk', 'run', 'animation', 'take'];
  const selectedClip = clips.find((clip) => {
    const name = String(clip.name || '').toLowerCase();
    return preferredPatterns.some((pattern) => name.includes(String(pattern).toLowerCase()));
  });
  if (selectedClip) return selectedClip;
  return options.fallbackToFirst === false ? null : clips[0] || null;
};

export const playGltfAnimations = (object, clips = [], options = {}) => {
  const animationClips = clips.filter((clip) => clip && Number(clip.duration) > 0);
  if (!object || !animationClips.length) return null;

  const mixer = new THREE.AnimationMixer(object);
  const selectedClips = options.playAll
    ? animationClips
    : [selectAnimationClip(animationClips, options.preferredNames, {
      fallbackToFirst: options.fallbackToFirst,
    })].filter(Boolean);
  if (!selectedClips.length) return null;
  const timeOffset = Number.isFinite(Number(options.timeOffset)) ? Number(options.timeOffset) : 0;

  selectedClips.forEach((clip, index) => {
    const action = mixer.clipAction(clip);
    action.reset();
    action.enabled = true;
    action.clampWhenFinished = Boolean(options.loopOnce);
    action.setLoop(options.loopOnce ? THREE.LoopOnce : THREE.LoopRepeat, options.loopOnce ? 1 : Infinity);
    action.play();
    if (clip.duration > 0) {
      const offset = timeOffset + index * 0.137;
      action.time = ((offset % clip.duration) + clip.duration) % clip.duration;
    }
  });
  mixer.update(0);

  object.userData.animationMixer = mixer;
  object.userData.animationClips = selectedClips;
  return mixer;
};

export const prepareGltfModel = (object, options = {}) => {
  object.traverse((child) => {
    if (options.forceVisibleMeshes) child.visible = true;
    if (!child.isMesh && !child.isSkinnedMesh) return;
    child.castShadow = true;
    child.receiveShadow = true;
    child.frustumCulled = false;
    if (options.forceLitMaterials && child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map((material) => convertToLitMaterial(material, options))
        : convertToLitMaterial(child.material, options);
    }
    if (shouldCloneMaterialsForAppearance(options) && child.material) {
      child.material = Array.isArray(child.material)
        ? child.material.map(cloneMaterialForAppearance)
        : cloneMaterialForAppearance(child.material);
    }
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      COLOR_TEXTURE_FIELDS.forEach((field) => {
        if (material[field]) material[field].colorSpace = THREE.SRGBColorSpace;
      });
      restoreGeneratedTextureColor(material, options);
      forceMaterialVisibility(material, options);
      tuneImportedMaterialAppearance(material, options);
    });
  });
};

export const updateGltfModelMaterialAppearance = (object, options = {}) => {
  let didUpdate = false;
  object?.traverse?.((child) => {
    if (!child.isMesh && !child.isSkinnedMesh) return;
    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.filter(Boolean).forEach((material) => {
      if (!material.userData?.rpg3dAppearanceManaged && !options.includeUnmanaged) return;
      didUpdate = applyManagedMaterialAppearance(material, options) || didUpdate;
    });
  });
  return didUpdate;
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

export const rememberObjectBaseTransform = (object) => {
  if (!object || object.userData?.rpg3dBaseTransform) return false;
  object.userData.rpg3dBaseTransform = {
    position: object.position?.clone?.() || new THREE.Vector3(),
    rotation: object.rotation?.clone?.() || new THREE.Euler(),
    scale: object.scale?.clone?.() || new THREE.Vector3(1, 1, 1),
  };
  return true;
};

export const resetObjectBaseTransform = (object) => {
  const baseTransform = object?.userData?.rpg3dBaseTransform;
  if (!object || !baseTransform) return false;
  object.position.copy(baseTransform.position);
  object.rotation.copy(baseTransform.rotation);
  object.scale.copy(baseTransform.scale);
  object.updateMatrixWorld(true);
  return true;
};

export const fitObjectToHeight = (object, targetHeight = 2, options = {}) => {
  object.updateMatrixWorld(true);
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

export const applyObjectAxisScaleRatios = (object, axisScale = {}, referenceY = 1, options = {}) => {
  if (!object) return false;
  const reference = Number.isFinite(Number(referenceY)) && Number(referenceY) > 0
    ? Number(referenceY)
    : 1;
  const scaleX = Number.isFinite(Number(axisScale.x)) && Number(axisScale.x) > 0
    ? Number(axisScale.x) / reference
    : 1;
  const scaleZ = Number.isFinite(Number(axisScale.z)) && Number(axisScale.z) > 0
    ? Number(axisScale.z) / reference
    : 1;
  object.scale.set(
    object.scale.x * Math.max(0.001, scaleX),
    object.scale.y,
    object.scale.z * Math.max(0.001, scaleZ),
  );
  object.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(object, true);
  const center = fittedBox.getCenter(new THREE.Vector3());
  const groundY = Number.isFinite(Number(options.groundY)) ? Number(options.groundY) : 0;
  object.position.x += options.centerX === false ? 0 : -center.x;
  object.position.z += options.centerZ === false ? 0 : -center.z;
  snapObjectToGround(object, groundY);
  return true;
};

export const fitObjectToDimensions = (object, dimensions = {}, options = {}) => {
  if (!object) return false;
  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object, true);
  const size = box.getSize(new THREE.Vector3());
  if (
    !Number.isFinite(size.x) || size.x <= 0.0001
    || !Number.isFinite(size.y) || size.y <= 0.0001
    || !Number.isFinite(size.z) || size.z <= 0.0001
  ) return false;

  const targetWidth = Number(dimensions.width);
  const targetHeight = Number(dimensions.height);
  const targetDepth = Number(dimensions.depth);
  const scaleX = Number.isFinite(targetWidth) && targetWidth > 0 ? targetWidth / size.x : 1;
  const scaleY = Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight / size.y : 1;
  const scaleZ = Number.isFinite(targetDepth) && targetDepth > 0 ? targetDepth / size.z : 1;
  object.scale.set(
    object.scale.x * Math.max(0.001, scaleX),
    object.scale.y * Math.max(0.001, scaleY),
    object.scale.z * Math.max(0.001, scaleZ),
  );
  object.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(object, true);
  const center = fittedBox.getCenter(new THREE.Vector3());
  const groundY = Number.isFinite(Number(options.groundY)) ? Number(options.groundY) : 0;
  object.position.x += options.centerX === false ? 0 : -center.x;
  object.position.z += options.centerZ === false ? 0 : -center.z;
  snapObjectToGround(object, groundY);
  return true;
};
