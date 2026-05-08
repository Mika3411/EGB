export const DEFAULT_SCENE_ASPECT_RATIO = 1.6;
export const ASSET_TYPES = ['image', 'audio', 'video', 'json', 'unknown'];

const DATA_URL_TYPE_PATTERN = /^data:([^/;]+)\/([^;,]+)[;,]/;

const getAssetTypeFromUrl = (url = '') => {
  const match = String(url).match(DATA_URL_TYPE_PATTERN);
  if (!match) return 'unknown';
  if (ASSET_TYPES.includes(match[1])) return match[1];
  return 'unknown';
};

const compactList = (items = []) => [...new Set(items.filter(Boolean))];

export const makeAssetId = (...parts) => `asset_${parts.filter(Boolean).join('_')}`.replace(/[^a-zA-Z0-9_:-]/g, '_');

const makeStableAssetId = (type = 'unknown', url = '', name = '') => {
  const source = `${type}:${url}:${name}`;
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = ((hash << 5) - hash + source.charCodeAt(index)) | 0;
  }
  return makeAssetId('library', type, Math.abs(hash).toString(36));
};

export function normalizeAsset(asset = {}) {
  const url = asset.url || asset.src || asset.data || '';
  const type = ASSET_TYPES.includes(asset.type) ? asset.type : getAssetTypeFromUrl(url);
  return {
    id: asset.id || (url ? makeStableAssetId(type, url, asset.name) : ''),
    type,
    url,
    name: asset.name || '',
    width: Math.max(0, Math.round(Number(asset.width) || 0)),
    height: Math.max(0, Math.round(Number(asset.height) || 0)),
    size: Math.max(0, Math.round(Number(asset.size) || Number(asset.bytes) || 0)),
    usedIn: compactList(Array.isArray(asset.usedIn) ? asset.usedIn : []),
    meta: asset.meta && typeof asset.meta === 'object' ? asset.meta : {},
  };
}

export function findAssetById(project = {}, assetId = '') {
  return (project.assets || []).find((asset) => asset.id === assetId) || null;
}

export function resolveAssetUrl(project = {}, assetId = '', fallbackUrl = '') {
  return findAssetById(project, assetId)?.url || fallbackUrl || '';
}

export function upsertProjectAsset(project = {}, asset = {}) {
  if (!project || !asset?.url) return null;
  if (!Array.isArray(project.assets)) project.assets = [];
  const normalized = normalizeAsset(asset);
  const existingById = normalized.id ? project.assets.find((entry) => entry.id === normalized.id) : null;
  const existingByUrl = project.assets.find((entry) => entry.url === normalized.url);
  const existing = existingById || existingByUrl;

  if (existing) {
    Object.assign(existing, normalizeAsset({
      ...existing,
      ...normalized,
      id: existing.id || normalized.id,
      usedIn: compactList([...(existing.usedIn || []), ...(normalized.usedIn || [])]),
    }));
    return existing;
  }

  project.assets.push(normalized);
  return normalized;
}

export function removeProjectAssetUsage(project = {}, assetId = '', usedIn = '') {
  if (!project || !assetId || !Array.isArray(project.assets)) return;
  const asset = project.assets.find((entry) => entry.id === assetId);
  if (!asset) return;
  asset.usedIn = compactList((asset.usedIn || []).filter((entry) => entry !== usedIn));
}

export function getAssetUsage(project = {}, assetId = '') {
  if (!assetId) return [];
  const usage = [];
  const addUsage = (scope, id, field) => {
    if (!id) return;
    usage.push(`${scope}:${id}${field ? `:${field}` : ''}`);
  };

  (project.items || []).forEach((item) => {
    if (item.imageId === assetId) addUsage('item', item.id, 'image');
  });

  (project.scenes || []).forEach((scene) => {
    if (scene.backgroundId === assetId) addUsage('scene', scene.id, 'background');
    if (scene.musicId === assetId) addUsage('scene', scene.id, 'music');
    if (scene.ambientSoundId === assetId) addUsage('scene', scene.id, 'ambientSound');

    (scene.sceneObjects || []).forEach((object) => {
      if (object.imageId === assetId) addUsage('sceneObject', object.id, 'image');
      if (object.objectImageId === assetId) addUsage('sceneObject', object.id, 'objectImage');
      if (object.popupImageId === assetId) addUsage('sceneObject', object.id, 'popupImage');
      if (object.soundId === assetId) addUsage('sceneObject', object.id, 'sound');
    });
  });

  (project.cinematics || []).forEach((cinematic) => {
    if (cinematic.videoId === assetId) addUsage('cinematic', cinematic.id, 'video');
    (cinematic.slides || []).forEach((slide) => {
      if (slide.imageId === assetId) addUsage('slide', slide.id, 'image');
      if (slide.audioId === assetId) addUsage('slide', slide.id, 'audio');
    });
  });

  (project.enigmas || []).forEach((enigma) => {
    if (enigma.popupBackgroundId === assetId) addUsage('enigma', enigma.id, 'popupBackground');
  });

  return compactList(usage);
}

export function isAssetUsed(project = {}, assetId = '') {
  return getAssetUsage(project, assetId).length > 0;
}

export function removeProjectAssetIfUnused(project = {}, assetId = '') {
  if (!project || !assetId || !Array.isArray(project.assets)) return false;
  if (isAssetUsed(project, assetId)) return false;
  const previousLength = project.assets.length;
  project.assets = project.assets.filter((asset) => asset.id !== assetId);
  return project.assets.length !== previousLength;
}

export function createAsset({
  id = '',
  type,
  url = '',
  name = '',
  width = 0,
  height = 0,
  size = 0,
  usedIn = [],
  meta = {},
} = {}) {
  return normalizeAsset({
    id,
    type,
    url,
    name,
    width,
    height,
    size,
    usedIn,
    meta,
  });
}

function pushAsset(assets, {
  id,
  type,
  url,
  name,
  width = 0,
  height = 0,
  size = 0,
  usedIn = [],
  meta = {},
}) {
  if (!url) return;
  const existing = assets.find((asset) => asset.url === url);
  if (existing) {
    existing.usedIn = compactList([...existing.usedIn, ...usedIn]);
    existing.meta = { ...(existing.meta || {}), ...(meta || {}) };
    return existing;
  }
  const asset = createAsset({ id, type, url, name, width, height, size, usedIn, meta });
  assets.push(asset);
  return asset;
}

export function attachProjectAssetReference(target = {}, project = {}, {
  idField,
  dataField,
  nameField,
  type = 'unknown',
  url = '',
  name = '',
  idParts = [],
  usedIn = [],
  meta = {},
  width = 0,
  height = 0,
  size = 0,
} = {}) {
  if (!target || !dataField || !url) return null;
  const asset = createAsset({
    id: target[idField] || makeAssetId(...idParts),
    type,
    url,
    name,
    width,
    height,
    size,
    usedIn,
    meta,
  });
  const storedAsset = upsertProjectAsset(project, asset) || asset;
  target[dataField] = storedAsset.url;
  if (nameField) target[nameField] = storedAsset.name || name;
  if (idField) target[idField] = storedAsset.id;
  return storedAsset;
}

const assignAssetIdFromUrl = (project, target, {
  idField,
  dataField,
  fallbackParts = [],
}) => {
  if (!target?.[dataField] || !idField) return;
  target[idField] = project.assets.find((asset) => asset.url === target[dataField])?.id
    || target[idField]
    || makeAssetId(...fallbackParts);
};

const getAnime2dLayerUrl = (layer = {}) => (
  layer.src || layer.imageData || layer.layer?.src || layer.layer?.imageData || ''
);

const pushAnime2dLayerAssets = (assets, spec, {
  scope = '',
  scopeId = '',
  fallbackParts = [],
} = {}) => {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.layers)) return;
  spec.layers.forEach((layer, index) => {
    const url = getAnime2dLayerUrl(layer);
    const layerId = layer.id || layer.layer?.id || `layer-${index + 1}`;
    pushAsset(assets, {
      id: layer.assetId || layer.imageId || makeAssetId(...fallbackParts, layerId, 'image'),
      type: 'image',
      url,
      name: layer.name || layer.layer?.name || layerId,
      usedIn: compactList([scopeId ? `${scope}:${scopeId}` : '', `anime2dLayer:${layerId}`]),
      meta: { role: 'anime2dLayer' },
    });
  });
};

const assignAnime2dLayerAssetIds = (project, spec, fallbackParts = []) => {
  if (!spec || typeof spec !== 'object' || !Array.isArray(spec.layers)) return;
  spec.layers.forEach((layer, index) => {
    const layerId = layer.id || layer.layer?.id || `layer-${index + 1}`;
    assignAssetIdFromUrl(project, layer, {
      idField: 'assetId',
      dataField: 'src',
      fallbackParts: [...fallbackParts, layerId, 'image'],
    });
    if (layer.layer && typeof layer.layer === 'object') {
      assignAssetIdFromUrl(project, layer.layer, {
        idField: 'assetId',
        dataField: 'src',
        fallbackParts: [...fallbackParts, layerId, 'image'],
      });
    }
  });
};

export function collectProjectAssets(project = {}) {
  const assets = Array.isArray(project.assets)
    ? project.assets.map((asset) => normalizeAsset({ ...asset, usedIn: [] }))
    : [];

  (project.items || []).forEach((item) => {
    pushAsset(assets, {
      id: item.imageId || makeAssetId('item', item.id, 'image'),
      type: 'image',
      url: item.imageData,
      name: item.imageName || item.name,
      usedIn: [`item:${item.id}`],
    });
  });

  (project.scenes || []).forEach((scene) => {
    pushAsset(assets, {
      id: scene.backgroundId || makeAssetId('scene', scene.id, 'background'),
      type: 'image',
      url: scene.backgroundData,
      name: scene.backgroundName || `${scene.name} background`,
      width: scene.backgroundWidth,
      height: scene.backgroundHeight,
      usedIn: [`scene:${scene.id}`],
      meta: { role: 'background' },
    });
    pushAsset(assets, {
      id: scene.musicId || makeAssetId('scene', scene.id, 'music'),
      type: 'audio',
      url: scene.musicData,
      name: scene.musicName || `${scene.name} music`,
      usedIn: [`scene:${scene.id}`],
      meta: { role: 'music', loop: scene.musicLoop !== false },
    });
    pushAsset(assets, {
      id: scene.ambientSoundId || makeAssetId('scene', scene.id, 'ambient'),
      type: 'audio',
      url: scene.ambientSoundData,
      name: scene.ambientSoundName || `${scene.name} ambient sound`,
      usedIn: [`scene:${scene.id}`],
      meta: { role: 'ambientSound', loop: Boolean(scene.ambientSoundLoop) },
    });

    (scene.sceneObjects || []).forEach((object) => {
      pushAsset(assets, {
        id: object.imageId || makeAssetId('scene_object', object.id, 'image'),
        type: 'image',
        url: object.imageData,
        name: object.imageName || object.name,
        usedIn: [`scene:${scene.id}`, `sceneObject:${object.id}`],
      });
      pushAsset(assets, {
        id: object.objectImageId || makeAssetId('scene_object', object.id, 'object_image'),
        type: 'image',
        url: object.objectImageData,
        name: object.objectImageName || object.name,
        usedIn: [`scene:${scene.id}`, `sceneObject:${object.id}`],
      });
      pushAsset(assets, {
        id: object.popupImageId || makeAssetId('scene_object', object.id, 'popup_image'),
        type: 'image',
        url: object.popupImageData || object.popupImage,
        name: object.popupImageName || object.name,
        usedIn: [`scene:${scene.id}`, `sceneObject:${object.id}`],
      });
      pushAsset(assets, {
        id: object.soundId || makeAssetId('scene_object', object.id, 'sound'),
        type: 'audio',
        url: object.soundData,
        name: object.soundName || object.name,
        usedIn: [`scene:${scene.id}`, `sceneObject:${object.id}`],
      });
      pushAnime2dLayerAssets(assets, object.anime2dSpec, {
        scope: 'sceneObject',
        scopeId: object.id,
        fallbackParts: ['scene_object', object.id, 'anime2d'],
      });
    });

    (scene.hotspots || []).forEach((hotspot) => {
      pushAsset(assets, {
        id: hotspot.objectImageId || makeAssetId('hotspot', hotspot.id, 'object_image'),
        type: 'image',
        url: hotspot.objectImageData,
        name: hotspot.objectImageName || hotspot.name,
        usedIn: [`scene:${scene.id}`, `hotspot:${hotspot.id}`],
      });
      pushAsset(assets, {
        id: hotspot.secondObjectImageId || makeAssetId('hotspot', hotspot.id, 'second_object_image'),
        type: 'image',
        url: hotspot.secondObjectImageData,
        name: hotspot.secondObjectImageName || hotspot.name,
        usedIn: [`scene:${scene.id}`, `hotspot:${hotspot.id}`],
      });
      pushAsset(assets, {
        id: hotspot.soundId || makeAssetId('hotspot', hotspot.id, 'sound'),
        type: 'audio',
        url: hotspot.soundData,
        name: hotspot.soundName || hotspot.name,
        usedIn: [`scene:${scene.id}`, `hotspot:${hotspot.id}`],
      });

      (hotspot.logicRules || []).forEach((rule) => {
        pushAsset(assets, {
          id: rule.successSoundId || makeAssetId('logic_rule', rule.id, 'success_sound'),
          type: 'audio',
          url: rule.successSoundData,
          name: rule.successSoundName || rule.name,
          usedIn: [`scene:${scene.id}`, `hotspot:${hotspot.id}`, `logicRule:${rule.id}:successSound`],
        });
        pushAsset(assets, {
          id: rule.failureSoundId || makeAssetId('logic_rule', rule.id, 'failure_sound'),
          type: 'audio',
          url: rule.failureSoundData,
          name: rule.failureSoundName || rule.name,
          usedIn: [`scene:${scene.id}`, `hotspot:${hotspot.id}`, `logicRule:${rule.id}:failureSound`],
        });
      });
    });
  });

  (project.cinematics || []).forEach((cinematic) => {
    pushAsset(assets, {
      id: cinematic.videoId || makeAssetId('cinematic', cinematic.id, 'video'),
      type: 'video',
      url: cinematic.videoData,
      name: cinematic.videoName || cinematic.name,
      usedIn: [`cinematic:${cinematic.id}`],
      meta: { role: 'cinematicVideo' },
    });
    pushAnime2dLayerAssets(assets, cinematic.anime2dSpec, {
      scope: 'cinematic',
      scopeId: cinematic.id,
      fallbackParts: ['cinematic', cinematic.id, 'anime2d'],
    });
    (cinematic.steps || []).forEach((step) => {
      if (step.type !== 'anime2d') return;
      pushAnime2dLayerAssets(assets, step.spec, {
        scope: 'cinematic',
        scopeId: cinematic.id,
        fallbackParts: ['cinematic', cinematic.id, 'step', step.id || 'anime2d'],
      });
    });

    (cinematic.slides || []).forEach((slide) => {
      pushAsset(assets, {
        id: slide.imageId || makeAssetId('cinematic', cinematic.id, 'slide', slide.id, 'image'),
        type: 'image',
        url: slide.imageData,
        name: slide.imageName || cinematic.name,
        usedIn: [`cinematic:${cinematic.id}`, `slide:${slide.id}`],
        meta: { role: 'slideImage' },
      });
      pushAsset(assets, {
        id: slide.audioId || makeAssetId('cinematic', cinematic.id, 'slide', slide.id, 'audio'),
        type: 'audio',
        url: slide.audioData,
        name: slide.audioName || cinematic.name,
        usedIn: [`cinematic:${cinematic.id}`, `slide:${slide.id}`],
        meta: { role: 'slideAudio' },
      });
    });
  });

  (project.enigmas || []).forEach((enigma) => {
    pushAsset(assets, {
      id: enigma.imageId || makeAssetId('enigma', enigma.id, 'image'),
      type: 'image',
      url: enigma.imageData,
      name: enigma.imageName || enigma.title || enigma.name,
      usedIn: [`enigma:${enigma.id}`],
      meta: { role: 'enigmaImage' },
    });
    pushAsset(assets, {
      id: enigma.popupBackgroundId || makeAssetId('enigma', enigma.id, 'popup_background'),
      type: 'image',
      url: enigma.popupBackgroundData,
      name: enigma.popupBackgroundName || enigma.title || enigma.name,
      usedIn: [`enigma:${enigma.id}`],
      meta: { role: 'popupBackground' },
    });
  });

  return assets;
}

export function migrateProjectAssetReferences(project = {}) {
  if (!project) return project;
  project.assets = collectProjectAssets(project);

  (project.scenes || []).forEach((scene) => {
    assignAssetIdFromUrl(project, scene, { idField: 'backgroundId', dataField: 'backgroundData', fallbackParts: ['scene', scene.id, 'background'] });
    assignAssetIdFromUrl(project, scene, { idField: 'musicId', dataField: 'musicData', fallbackParts: ['scene', scene.id, 'music'] });
    assignAssetIdFromUrl(project, scene, { idField: 'ambientSoundId', dataField: 'ambientSoundData', fallbackParts: ['scene', scene.id, 'ambient'] });

    (scene.sceneObjects || []).forEach((object) => {
      assignAssetIdFromUrl(project, object, { idField: 'imageId', dataField: 'imageData', fallbackParts: ['scene_object', object.id, 'image'] });
      assignAssetIdFromUrl(project, object, { idField: 'objectImageId', dataField: 'objectImageData', fallbackParts: ['scene_object', object.id, 'object_image'] });
      assignAssetIdFromUrl(project, object, { idField: 'popupImageId', dataField: 'popupImageData', fallbackParts: ['scene_object', object.id, 'popup_image'] });
      assignAssetIdFromUrl(project, object, { idField: 'soundId', dataField: 'soundData', fallbackParts: ['scene_object', object.id, 'sound'] });
      assignAnime2dLayerAssetIds(project, object.anime2dSpec, ['scene_object', object.id, 'anime2d']);
    });

    (scene.hotspots || []).forEach((hotspot) => {
      assignAssetIdFromUrl(project, hotspot, { idField: 'objectImageId', dataField: 'objectImageData', fallbackParts: ['hotspot', hotspot.id, 'object_image'] });
      assignAssetIdFromUrl(project, hotspot, { idField: 'secondObjectImageId', dataField: 'secondObjectImageData', fallbackParts: ['hotspot', hotspot.id, 'second_object_image'] });
      assignAssetIdFromUrl(project, hotspot, { idField: 'soundId', dataField: 'soundData', fallbackParts: ['hotspot', hotspot.id, 'sound'] });
      (hotspot.logicRules || []).forEach((rule) => {
        assignAssetIdFromUrl(project, rule, { idField: 'successSoundId', dataField: 'successSoundData', fallbackParts: ['logic_rule', rule.id, 'success_sound'] });
        assignAssetIdFromUrl(project, rule, { idField: 'failureSoundId', dataField: 'failureSoundData', fallbackParts: ['logic_rule', rule.id, 'failure_sound'] });
      });
    });
  });

  (project.items || []).forEach((item) => {
    assignAssetIdFromUrl(project, item, { idField: 'imageId', dataField: 'imageData', fallbackParts: ['item', item.id, 'image'] });
  });

  (project.cinematics || []).forEach((cinematic) => {
    assignAssetIdFromUrl(project, cinematic, { idField: 'videoId', dataField: 'videoData', fallbackParts: ['cinematic', cinematic.id, 'video'] });
    assignAnime2dLayerAssetIds(project, cinematic.anime2dSpec, ['cinematic', cinematic.id, 'anime2d']);
    (cinematic.steps || []).forEach((step) => {
      if (step.type !== 'anime2d') return;
      assignAnime2dLayerAssetIds(project, step.spec, ['cinematic', cinematic.id, 'step', step.id || 'anime2d']);
    });
    (cinematic.slides || []).forEach((slide) => {
      assignAssetIdFromUrl(project, slide, { idField: 'imageId', dataField: 'imageData', fallbackParts: ['cinematic', cinematic.id, 'slide', slide.id, 'image'] });
      assignAssetIdFromUrl(project, slide, { idField: 'audioId', dataField: 'audioData', fallbackParts: ['cinematic', cinematic.id, 'slide', slide.id, 'audio'] });
    });
  });

  (project.enigmas || []).forEach((enigma) => {
    assignAssetIdFromUrl(project, enigma, { idField: 'imageId', dataField: 'imageData', fallbackParts: ['enigma', enigma.id, 'image'] });
    assignAssetIdFromUrl(project, enigma, { idField: 'popupBackgroundId', dataField: 'popupBackgroundData', fallbackParts: ['enigma', enigma.id, 'popup_background'] });
  });

  return project;
}

export function getSceneAspectRatio(scene = {}) {
  const ratio = Number(scene?.backgroundAspectRatio);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : DEFAULT_SCENE_ASPECT_RATIO;
}

export function calculateImageAspectRatio(image = {}) {
  if (!image?.naturalWidth || !image?.naturalHeight) return null;
  const ratio = Number((image.naturalWidth / image.naturalHeight).toFixed(4));
  return Number.isFinite(ratio) && ratio > 0 ? ratio : null;
}

export function calculateImageDimensions(image = {}) {
  const width = Math.round(Number(image?.naturalWidth) || 0);
  const height = Math.round(Number(image?.naturalHeight) || 0);
  return width > 0 && height > 0 ? { width, height } : null;
}

export function getSceneObjectAssetSource(object = {}, items = []) {
  return object?.imageData || items.find((item) => item.id === object?.linkedItemId)?.imageData || '';
}

export function getSceneMediaStatus(scene = {}) {
  return [
    { label: 'Fond', ready: Boolean(scene?.backgroundData) },
    { label: 'Effet', ready: Boolean(scene?.visualEffect && scene.visualEffect !== 'none') },
    { label: 'Musique', ready: Boolean(scene?.musicData) },
    { label: 'Son', ready: Boolean(scene?.ambientSoundData) },
    { label: 'Timer', ready: Boolean(scene?.timerEnabled) },
  ];
}

export function setSceneBackgroundAsset(scene, data = '', name = '', project = null) {
  if (!scene) return;
  const assetId = makeAssetId('scene', scene.id || 'unknown', 'background');
  scene.backgroundData = data;
  scene.backgroundName = name;
  scene.backgroundAspectRatio = DEFAULT_SCENE_ASPECT_RATIO;
  const asset = createAsset({
    id: assetId,
    type: 'image',
    url: data,
    name,
    usedIn: scene.id ? [`scene:${scene.id}`] : [],
    meta: { role: 'background' },
  });
  const storedAsset = upsertProjectAsset(project, asset) || asset;
  scene.backgroundId = storedAsset.id;
  scene.backgroundAsset = storedAsset;
}

export function setSceneBackgroundAspectRatio(scene, ratio) {
  if (!scene) return;
  const nextRatio = Number(ratio);
  if (!Number.isFinite(nextRatio) || nextRatio <= 0) return;
  scene.backgroundAspectRatio = nextRatio;
}

export function setSceneBackgroundDimensions(scene, width = 0, height = 0, project = null) {
  if (!scene) return;
  const nextWidth = Math.round(Number(width) || 0);
  const nextHeight = Math.round(Number(height) || 0);
  if (nextWidth <= 0 || nextHeight <= 0) return;
  scene.backgroundWidth = nextWidth;
  scene.backgroundHeight = nextHeight;
  scene.backgroundAspectRatio = Number((nextWidth / nextHeight).toFixed(4));
  if (scene.backgroundAsset) {
    scene.backgroundAsset = normalizeAsset({
      ...scene.backgroundAsset,
      width: nextWidth,
      height: nextHeight,
    });
    upsertProjectAsset(project, scene.backgroundAsset);
  }
}

export function setSceneMusicAsset(scene, data = '', name = '', project = null) {
  if (!scene) return;
  const assetId = makeAssetId('scene', scene.id || 'unknown', 'music');
  scene.musicData = data;
  scene.musicName = name;
  if (typeof scene.musicLoop !== 'boolean') scene.musicLoop = true;
  const asset = createAsset({
    id: assetId,
    type: 'audio',
    url: data,
    name,
    usedIn: scene.id ? [`scene:${scene.id}`] : [],
    meta: { role: 'music', loop: scene.musicLoop !== false },
  });
  const storedAsset = upsertProjectAsset(project, asset) || asset;
  scene.musicId = storedAsset.id;
  scene.musicAsset = storedAsset;
}

export function clearSceneMusicAsset(scene, project = null) {
  if (!scene) return;
  const assetId = scene.musicId;
  scene.musicData = '';
  scene.musicName = '';
  scene.musicId = '';
  scene.musicLoop = true;
  scene.musicAsset = null;
  removeProjectAssetUsage(project, assetId, scene.id ? `scene:${scene.id}` : '');
}

export function setSceneAmbientSoundAsset(scene, data = '', name = '', project = null) {
  if (!scene) return;
  const assetId = makeAssetId('scene', scene.id || 'unknown', 'ambient');
  scene.ambientSoundData = data;
  scene.ambientSoundName = name;
  if (typeof scene.ambientSoundLoop !== 'boolean') scene.ambientSoundLoop = false;
  const asset = createAsset({
    id: assetId,
    type: 'audio',
    url: data,
    name,
    usedIn: scene.id ? [`scene:${scene.id}`] : [],
    meta: { role: 'ambientSound', loop: Boolean(scene.ambientSoundLoop) },
  });
  const storedAsset = upsertProjectAsset(project, asset) || asset;
  scene.ambientSoundId = storedAsset.id;
  scene.ambientSoundAsset = storedAsset;
}

export function clearSceneAmbientSoundAsset(scene, project = null) {
  if (!scene) return;
  const assetId = scene.ambientSoundId;
  scene.ambientSoundData = '';
  scene.ambientSoundName = '';
  scene.ambientSoundId = '';
  scene.ambientSoundLoop = false;
  scene.ambientSoundAsset = null;
  removeProjectAssetUsage(project, assetId, scene.id ? `scene:${scene.id}` : '');
}
