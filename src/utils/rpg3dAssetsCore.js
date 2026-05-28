import {
  DEFAULT_ARCADE_CONFIG,
  MATERIAL_BRIGHTNESS_MAX,
  MATERIAL_BRIGHTNESS_MIN,
  cloneConfig,
  clonePlainObjectArray,
  getCharacterModelAxisScale,
  getDecorMaterialBrightness,
  getDecorModelScale,
  getStudioDecorKindId,
  isFloorDecorKind,
  clamp,
} from './rpg3dDomain.js';
import {
  cloneStudioProjectForEdit,
  createConfigFromSavedAssets,
  createDefaultStudioProject,
} from './rpg3dStudioProject.js';
import {
  CHARACTER_RIG_ARMOR_GRIP_POINTS,
  getCharacterRigSignature,
  normalizeCharacterRigPoints,
} from './rpg3dCharacterRig.js';

export const ARCADE_ASSETS_STORAGE_KEY = 'escape-game-builder:arcade-assets:v1';
export const ARCADE_ASSETS_BACKUP_STORAGE_KEY = 'escape-game-builder:arcade-assets-backups:v1';
export const ARCADE_ASSETS_REMOTE_VERSION = 2;
export const RPG3D_HISTORY_DATA_URL_MAX_CHARS = 512 * 1024;
const ARCADE_ASSETS_BACKUP_LIMIT = 8;

const ARCADE_WORLD_SCALE = 0.018;

export const readSavedArcadeAssets = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(ARCADE_ASSETS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

export const isBlobUrl = (value = '') => String(value || '').startsWith('blob:');
export const isDataUrl = (value = '') => String(value || '').startsWith('data:');

const localBlobFileCache = new Map();
const localModelObjectUrlCache = new Map();
const LOCAL_MODEL_DB_NAME = 'escape-game-builder:rpg3d-local-models';
const LOCAL_MODEL_DB_VERSION = 1;
const LOCAL_MODEL_STORE_NAME = 'modelFiles';

const canUseIndexedDb = () => typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';

const openLocalModelDb = () => new Promise((resolve, reject) => {
  if (!canUseIndexedDb()) {
    resolve(null);
    return;
  }
  const request = window.indexedDB.open(LOCAL_MODEL_DB_NAME, LOCAL_MODEL_DB_VERSION);
  request.onupgradeneeded = () => {
    const db = request.result;
    if (!db.objectStoreNames.contains(LOCAL_MODEL_STORE_NAME)) db.createObjectStore(LOCAL_MODEL_STORE_NAME, { keyPath: 'id' });
  };
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error || new Error('Stockage local 3D indisponible.'));
});

const runLocalModelStore = async (mode, runner) => {
  const db = await openLocalModelDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(LOCAL_MODEL_STORE_NAME, mode);
    const store = transaction.objectStore(LOCAL_MODEL_STORE_NAME);
    const request = runner(store);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Operation de stockage local impossible.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error('Transaction de stockage local impossible.'));
    };
  });
};

export const createLocalModelFileId = (modelType = 'model', modelId = '', file = null) => (
  [
    'rpg3d',
    modelType || 'model',
    modelId || 'model',
    file?.name || 'asset',
    Number(file?.size) || 0,
    Number(file?.lastModified) || Date.now(),
  ]
    .map((part) => encodeURIComponent(String(part)))
    .join(':')
);

export const persistLocalModelFile = async (localModelFileId = '', file = null) => {
  if (!localModelFileId || !file) return false;
  try {
    await runLocalModelStore('readwrite', (store) => store.put({
      id: localModelFileId,
      file,
      name: file.name || '',
      type: file.type || '',
      size: Number(file.size) || 0,
      updatedAt: Date.now(),
    }));
    return true;
  } catch {
    return false;
  }
};

export const loadLocalModelFile = async (localModelFileId = '') => {
  if (!localModelFileId) return null;
  try {
    const record = await runLocalModelStore('readonly', (store) => store.get(localModelFileId));
    return record?.file || null;
  } catch {
    return null;
  }
};

export const createLocalModelObjectUrl = async (localModelFileId = '') => {
  if (!localModelFileId) return '';
  const cachedUrl = localModelObjectUrlCache.get(localModelFileId);
  if (cachedUrl) return cachedUrl;
  const file = await loadLocalModelFile(localModelFileId);
  if (!file) return '';
  const objectUrl = URL.createObjectURL(file);
  localModelObjectUrlCache.set(localModelFileId, objectUrl);
  localBlobFileCache.set(objectUrl, file);
  return objectUrl;
};

export const rememberRpg3DLocalBlobFile = (blobUrl = '', file = null, localModelFileId = '', options = {}) => {
  if (!isBlobUrl(blobUrl) || !file) return false;
  localBlobFileCache.set(blobUrl, file);
  if (localModelFileId) {
    localModelObjectUrlCache.set(localModelFileId, blobUrl);
    if (options.persist !== false) persistLocalModelFile(localModelFileId, file);
  }
  return true;
};

export const forgetRpg3DLocalBlobFile = (blobUrl = '') => {
  if (!isBlobUrl(blobUrl)) return false;
  return localBlobFileCache.delete(blobUrl);
};

export const createArcadeAssetsPayload = (config, studioProject) => ({
  version: ARCADE_ASSETS_REMOTE_VERSION,
  savedAt: new Date().toISOString(),
  config: {
    ...cloneConfig(config),
  },
  studioProject: cloneStudioProjectForEdit(studioProject),
});

const countArrayItems = (value) => (Array.isArray(value) ? value.length : 0);

const countTerrainPaintPoints = (strokes = []) => (
  Array.isArray(strokes)
    ? strokes.reduce((total, stroke) => total + Math.max(1, countArrayItems(stroke?.points)), 0)
    : 0
);

export const getArcadeConfigContentScore = (config = {}) => {
  if (!config || typeof config !== 'object') return 0;
  return [
    countArrayItems(config.obstacles),
    countArrayItems(config.reliefs),
    countArrayItems(config.heroes),
    countArrayItems(config.enemies),
    countArrayItems(config.pickups),
    countArrayItems(config.props),
    countArrayItems(config.actionZones),
    countTerrainPaintPoints(config.terrainPaintStrokes),
  ].reduce((total, count) => total + count, 0);
};

export const getArcadeAssetsContentScore = (payload = {}) => {
  if (!payload || typeof payload !== 'object') return 0;
  const studioProject = payload.studioProject || {};
  const canvases = Array.isArray(studioProject.rpg3dCanvases) ? studioProject.rpg3dCanvases : [];
  const canvasScore = canvases.reduce((total, canvas) => total + getArcadeConfigContentScore(canvas?.config), 0);
  const mapScore = Math.max(getArcadeConfigContentScore(payload.config), canvasScore);
  const modelScore = (
    countArrayItems(studioProject.characterModels3d) * 8
    + countArrayItems(studioProject.decorModels3d) * 8
    + countArrayItems(studioProject.mediaAssets) * 2
  );
  const structureScore = Math.max(0, canvases.length - 1) * 2
    + Math.max(0, countArrayItems(studioProject.rpg3dActs) - 1)
    + Math.max(0, countArrayItems(studioProject.rpg3dScenes) - 1);
  return mapScore * 4 + modelScore + structureScore;
};

const getSavedTime = (payload = {}) => {
  const time = Date.parse(payload?.savedAt || '');
  return Number.isFinite(time) ? time : 0;
};

export const selectPreferredArcadeAssets = (candidate = null, fallback = null) => {
  if (!candidate) return fallback || null;
  if (!fallback) return candidate;
  const candidateScore = getArcadeAssetsContentScore(candidate);
  const fallbackScore = getArcadeAssetsContentScore(fallback);
  if (candidateScore !== fallbackScore) return candidateScore > fallbackScore ? candidate : fallback;
  return getSavedTime(candidate) >= getSavedTime(fallback) ? candidate : fallback;
};

export const getPersistedModelSource = (model = {}) => {
  if (isDataUrl(model.modelData)) return model.modelData;
  if (model.modelData && isBlobUrl(model.modelUrl)) return model.modelData;
  if (isBlobUrl(model.modelUrl)) return '';
  return model.modelUrl || model.modelData || '';
};

export const getLiveModelSource = (model = {}) => {
  if (isBlobUrl(model.modelUrl)) return model.modelUrl;
  return getPersistedModelSource(model);
};

export const getModelSourceForMode = (model = {}, options = {}) => (
  options.preferLocalBlob ? getLiveModelSource(model) : getPersistedModelSource(model)
);

export const getPersistedModelAnimations = (model = {}, options = {}) => (
  Object.entries(model.modelAnimations || {}).reduce((next, [slot, animation]) => {
    const source = getModelSourceForMode(animation || {}, options);
    if (!source) return next;
    next[slot] = {
      ...(animation || {}),
      modelUrl: source,
    };
    return next;
  }, {})
);

const stripVolatileModelSourceData = (model = {}) => {
  const next = { ...(model || {}) };
  if (next.localModelFileId && isDataUrl(next.modelData)) next.modelData = '';
  if (next.localModelFileId && isDataUrl(next.modelUrl)) next.modelUrl = '';
  if (isDataUrl(next.modelData) && next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) next.modelUrl = '';
  if (isBlobUrl(next.modelUrl) && !next.modelData) next.modelUrl = '';
  if (next.modelUrl && !isBlobUrl(next.modelUrl) && !isDataUrl(next.modelUrl)) next.modelData = '';
  return next;
};

export const stripVolatileModelData = (model = {}) => {
  const next = stripVolatileModelSourceData(model);
  if (next.modelAnimations && typeof next.modelAnimations === 'object') {
    next.modelAnimations = Object.entries(next.modelAnimations).reduce((animations, [slot, animation]) => {
      animations[slot] = stripVolatileModelSourceData(animation);
      return animations;
    }, {});
  }
  return next;
};

export const createLocalArcadeAssetsSnapshot = (payload = {}) => {
  const studioProject = {
    ...createDefaultStudioProject(),
    ...(payload.studioProject || {}),
    characterModels3d: (payload.studioProject?.characterModels3d || []).map(stripVolatileModelData),
    decorModels3d: (payload.studioProject?.decorModels3d || []).map(stripVolatileModelData),
    mediaAssets: clonePlainObjectArray(payload.studioProject?.mediaAssets || []),
  };
  const synced = syncConfigModelReferences(payload.config || DEFAULT_ARCADE_CONFIG, studioProject);
  return {
    ...payload,
    config: synced.config,
    studioProject,
  };
};

const readLocalArcadeAssetBackups = () => {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ARCADE_ASSETS_BACKUP_STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
};

const rememberArcadeAssetBackup = (rawPayload = '') => {
  if (typeof window === 'undefined' || !rawPayload) return;
  try {
    const payload = JSON.parse(rawPayload);
    if (!payload || typeof payload !== 'object') return;
    const score = getArcadeAssetsContentScore(payload);
    if (score <= 0) return;
    const backup = {
      backedUpAt: new Date().toISOString(),
      savedAt: payload.savedAt || '',
      score,
      payload,
    };
    const backups = readLocalArcadeAssetBackups();
    const nextBackups = [
      backup,
      ...backups.filter((entry) => JSON.stringify(entry?.payload || {}) !== rawPayload),
    ].slice(0, ARCADE_ASSETS_BACKUP_LIMIT);
    window.localStorage.setItem(ARCADE_ASSETS_BACKUP_STORAGE_KEY, JSON.stringify(nextBackups));
  } catch {
    // Backup creation is best-effort; the active save remains the priority.
  }
};

const rehydrateLocalModelSource = async (model = {}) => {
  if (!model?.localModelFileId) return model;
  const persistedSource = getPersistedModelSource(model);
  if (persistedSource && !isBlobUrl(persistedSource)) return model;
  const objectUrl = await createLocalModelObjectUrl(model.localModelFileId);
  if (!objectUrl) return model;
  return {
    ...model,
    modelUrl: objectUrl,
    modelData: '',
  };
};

const rehydrateLocalModel = async (model = {}) => {
  const nextModel = await rehydrateLocalModelSource(model);
  if (!nextModel?.modelAnimations || typeof nextModel.modelAnimations !== 'object') return nextModel;
  const animationEntries = await Promise.all(Object.entries(nextModel.modelAnimations).map(async ([slot, animation]) => [
    slot,
    await rehydrateLocalModelSource(animation || {}),
  ]));
  const animationsChanged = animationEntries.some(([slot, animation]) => animation !== nextModel.modelAnimations?.[slot]);
  if (!animationsChanged) return nextModel;
  return {
    ...nextModel,
    modelAnimations: Object.fromEntries(animationEntries),
  };
};

export const restoreLocalArcadeAssetsSources = async ({ config, studioProject } = {}) => {
  const baseStudioProject = cloneStudioProjectForEdit(studioProject || createDefaultStudioProject());
  const characterModels3d = await Promise.all((baseStudioProject.characterModels3d || []).map(rehydrateLocalModel));
  const decorModels3d = await Promise.all((baseStudioProject.decorModels3d || []).map(rehydrateLocalModel));
  const nextStudioProject = {
    ...baseStudioProject,
    characterModels3d,
    decorModels3d,
  };
  const synced = syncConfigModelReferences(config || DEFAULT_ARCADE_CONFIG, nextStudioProject, { preferLocalBlob: true });
  const changed = synced.changed
    || characterModels3d.some((model, index) => model !== baseStudioProject.characterModels3d?.[index])
    || decorModels3d.some((model, index) => model !== baseStudioProject.decorModels3d?.[index]);
  return {
    changed,
    config: synced.config,
    studioProject: nextStudioProject,
  };
};

export const rememberArcadeAssetsLocally = (payload) => {
  if (typeof window === 'undefined') return false;
  try {
    const rawCurrent = window.localStorage.getItem(ARCADE_ASSETS_STORAGE_KEY) || '';
    const nextPayload = createLocalArcadeAssetsSnapshot(payload);
    const nextRaw = JSON.stringify(nextPayload);
    if (rawCurrent && rawCurrent !== nextRaw) rememberArcadeAssetBackup(rawCurrent);
    window.localStorage.setItem(ARCADE_ASSETS_STORAGE_KEY, nextRaw);
    return true;
  } catch {
    return false;
  }
};

export const getExtensionForMimeType = (mimeType = '') => ({
  'model/gltf-binary': 'glb',
  'model/obj': 'obj',
  'application/vnd.autodesk.fbx': 'fbx',
  'model/vnd.fbx': 'fbx',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'image/bmp': 'bmp',
  'text/plain': 'txt',
}[String(mimeType).toLowerCase()] || 'bin');

const MIME_TYPE_BY_EXTENSION = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  mtl: 'text/plain',
};

export const getMimeTypeForFilename = (filename = '') => {
  const extension = String(filename || '').split(/[?#]/)[0].match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase() || '';
  return MIME_TYPE_BY_EXTENSION[extension] || '';
};

export const dataUrlToFile = (dataUrl, fallbackName = 'asset.bin', options = {}) => {
  const [header = '', encoded = ''] = String(dataUrl || '').split(',');
  const headerMimeType = header.match(/^data:([^;,]+)/i)?.[1] || '';
  const sourceName = fallbackName || options.defaultName || 'asset';
  const nameMimeType = getMimeTypeForFilename(sourceName);
  const mimeType = (
    !headerMimeType
    || headerMimeType === 'application/octet-stream'
    || headerMimeType === 'binary/octet-stream'
  )
    ? (nameMimeType || options.mimeType || 'application/octet-stream')
    : headerMimeType;
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  const extension = options.extension || getExtensionForMimeType(mimeType);
  const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
  return new File([bytes], fileName, { type: mimeType });
};

export const blobUrlToFile = async (blobUrl, fallbackName = 'asset.bin', options = {}) => {
  const cachedFile = localBlobFileCache.get(blobUrl);
  if (cachedFile) {
    const sourceName = fallbackName || cachedFile.name || options.defaultName || 'asset.bin';
    const mimeType = cachedFile.type || getMimeTypeForFilename(sourceName) || options.mimeType || 'application/octet-stream';
    const extension = options.extension || getExtensionForMimeType(mimeType);
    const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
    return new File([cachedFile], fileName, { type: mimeType });
  }
  const response = await fetch(blobUrl);
  if (!response.ok) throw new Error('Fichier local inaccessible. Reimporte le modele puis relance la sauvegarde.');
  const blob = await response.blob();
  const sourceName = fallbackName || options.defaultName || 'asset.bin';
  const mimeType = blob.type || getMimeTypeForFilename(sourceName) || options.mimeType || 'application/octet-stream';
  const extension = options.extension || getExtensionForMimeType(mimeType);
  const fileName = /\.[a-z0-9]+$/i.test(sourceName) ? sourceName : `${sourceName}.${extension}`;
  return new File([blob], fileName, { type: mimeType });
};

export const getStudioModelSource = (model = {}) => {
  if (isBlobUrl(model.modelUrl)) return model.modelUrl;
  if (isDataUrl(model.modelData)) return model.modelData;
  return model.modelUrl || model.modelData || '';
};

const getStudioMaterialBrightness = (model = {}) => {
  const value = Number(model.materialBrightness);
  return clamp(Number.isFinite(value) ? value : 1, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
};

const getStudioCharacterRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (model.shape === 'robot') return 'block';
  if (model.shape === 'creature') return 'boss';
  return 'capsule';
};

const getDecorImportRenderMode = (model = {}) => {
  if (getStudioModelSource(model)) return 'glb';
  if (isFloorDecorKind(model.kind)) return 'floor';
  if (model.kind === 'wall') return 'box';
  if (model.kind === 'house') return 'house';
  if (model.imageData) return 'billboard';
  return 'rock';
};

const getDecorModelWorldSize = (model = {}) => {
  const modelScale = getDecorModelScale(model);
  const width = Math.round(clamp(((Number(model.width) || 2.2) * modelScale) / ARCADE_WORLD_SCALE, 24, 9000));
  const depth = Math.round(clamp(((Number(model.depth) || 2.2) * modelScale) / ARCADE_WORLD_SCALE, 24, 9000));
  const modelHeight = Number(model.height) || 1.2;
  const height = Math.round(clamp((modelHeight * modelScale) / ARCADE_WORLD_SCALE, 12, 9000));
  if (isFloorDecorKind(model.kind) && !getStudioModelSource(model)) {
    const tileSize = Math.max(width, depth);
    return { width: tileSize, depth: tileSize, height: Math.max(12, height) };
  }
  return { width, depth, height };
};

const shouldPropBlockByMode = (mode) => ['box', 'rock', 'house'].includes(mode);

const getModelRotationValue = (item = {}, field = 'modelRotationX') => {
  const numeric = Number(item[field]);
  return clamp(Number.isFinite(numeric) ? numeric : 0, -180, 180);
};

const getEquipmentHand = (value = '') => (value === 'left' ? 'left' : 'right');
const getEquipmentArm = (value = '') => (value === 'right' ? 'right' : 'left');
const EQUIPMENT_MODEL_TYPES = new Set(['weapon', 'shield', 'armor', 'helmet', 'leggings']);
const isEquipmentModelForType = (model = null, type = '') => (
  Boolean(model && EQUIPMENT_MODEL_TYPES.has(type) && getStudioModelSource(model))
);
const EQUIPMENT_MODEL_SCALE_MIN = 0.001;
const EQUIPMENT_MODEL_SCALE_MAX = 8;
const ARMOR_SEGMENT_VALUES = new Set(['body', 'left-arm', 'right-arm']);
const ARMOR_RIG_POINT_IDS = new Set(CHARACTER_RIG_ARMOR_GRIP_POINTS.map((point) => point.rigPointId || point.id));
const getDefaultArmorPieceRigPointId = (segment = 'body') => {
  if (segment === 'left-arm') return 'left-elbow';
  if (segment === 'right-arm') return 'right-elbow';
  return 'lower-belly';
};
const normalizeArmorPieceRigPointId = (value = '', segment = 'body') => {
  const id = String(value || '').trim();
  return ARMOR_RIG_POINT_IDS.has(id) ? id : getDefaultArmorPieceRigPointId(segment);
};
const normalizeArmorPieceId = (value = '') => (
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
);
const normalizeArmorPieceName = (value = '', fallback = '') => {
  const cleanName = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 48);
  return cleanName || fallback;
};
const normalizeArmorSegmentAssignments = (assignments = []) => (
  Array.isArray(assignments)
    ? assignments.map((entry) => {
      const pieceId = normalizeArmorPieceId(entry?.pieceId);
      const pieceName = normalizeArmorPieceName(entry?.pieceName);
      const segment = ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body';
      return {
        path: String(entry?.path || '').slice(0, 260),
        name: String(entry?.name || '').slice(0, 120),
        segment,
        ...(pieceId ? { pieceId } : {}),
        ...(pieceName ? { pieceName } : {}),
        ...(pieceId ? { rigPointId: normalizeArmorPieceRigPointId(entry?.rigPointId, segment) } : {}),
      };
    }).filter((entry) => entry.path)
    : []
);
const normalizeArmorCustomPieces = (pieces = []) => (
  Array.isArray(pieces)
    ? pieces.map((piece, index) => {
      const id = normalizeArmorPieceId(piece?.id || `piece-${index + 1}`);
      return {
        id,
        name: normalizeArmorPieceName(piece?.name, `Morceau ${index + 1}`),
        segment: ARMOR_SEGMENT_VALUES.has(piece?.segment) ? piece.segment : 'body',
        rigPointId: normalizeArmorPieceRigPointId(piece?.rigPointId, piece?.segment),
      };
    }).filter((piece) => piece.id)
    : []
);
const normalizeArmorCutContourPoint = (point = {}) => ({
  x: clamp(Number(point?.x) || 0, -2, 2),
  y: clamp(Number(point?.y) || 0, -2, 2),
  z: clamp(Number(point?.z) || 0, -2, 2),
  ...normalizeArmorPaintSurfaceNormal(point),
  ...normalizeArmorPaintSectionPlane(point),
});
const normalizeArmorPaintSurfaceNormal = (point = {}) => {
  const nx = Number(point?.nx);
  const ny = Number(point?.ny);
  const nz = Number(point?.nz);
  if (!Number.isFinite(nx) || !Number.isFinite(ny) || !Number.isFinite(nz)) return {};
  const length = Math.hypot(nx, ny, nz);
  if (length <= 0.001) return {};
  return {
    nx: nx / length,
    ny: ny / length,
    nz: nz / length,
  };
};
const normalizeArmorPaintSectionPlane = (point = {}) => {
  const cx = Number(point?.cx);
  const cy = Number(point?.cy);
  const cz = Number(point?.cz);
  const cw = Number(point?.cw);
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || !Number.isFinite(cz) || !Number.isFinite(cw)) return {};
  const length = Math.hypot(cx, cy, cz);
  if (length <= 0.001) return {};
  return {
    cx: cx / length,
    cy: cy / length,
    cz: cz / length,
    cw: cw / length,
  };
};
const normalizeArmorCutContours = (contours = []) => {
  const entries = Array.isArray(contours)
    ? contours
    : Object.entries(contours || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body',
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 80)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const normalizeArmorCutPaintStrokes = (strokes = []) => {
  const entries = Array.isArray(strokes)
    ? strokes
    : Object.entries(strokes || {}).map(([segment, points]) => ({ segment, points }));
  return entries
    .map((entry) => ({
      segment: ARMOR_SEGMENT_VALUES.has(entry?.segment) ? entry.segment : 'body',
      radius: clamp(Number(entry?.radius) || 0.14, 0.04, 0.5),
      points: (Array.isArray(entry?.points) ? entry.points : [])
        .slice(0, 240)
        .map(normalizeArmorCutContourPoint),
    }))
    .filter((entry) => entry.points.length);
};
const ARMOR_GRIP_POINTS = CHARACTER_RIG_ARMOR_GRIP_POINTS;
const getEquipmentGripReferenceScale = (source = {}) => {
  const legacyScale = Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1;
  const dimensions = [
    Number(source.width) || 0,
    Number(source.height) || 0,
    Number(source.depth) || 0,
  ].map((value) => value * legacyScale).filter((value) => Number.isFinite(value) && value > 0.0001);
  if (dimensions.length) return clamp(Math.max(...dimensions), EQUIPMENT_MODEL_SCALE_MIN, 120);
  const explicitScale = Number(source.weaponGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clamp(explicitScale, EQUIPMENT_MODEL_SCALE_MIN, 120)
    : 1;
};
const getShieldGripReferenceScale = (source = {}) => {
  const explicitScale = Number(source.shieldGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clamp(explicitScale, EQUIPMENT_MODEL_SCALE_MIN, 120)
    : getEquipmentGripReferenceScale(source);
};
const getArmorGripReferenceScale = (source = {}) => {
  const explicitScale = Number(source.armorGripReferenceScale);
  return Number.isFinite(explicitScale) && explicitScale > 0.0001
    ? clamp(explicitScale, EQUIPMENT_MODEL_SCALE_MIN, 120)
    : getEquipmentGripReferenceScale(source);
};
const getEquipmentModelReferenceScale = (source = {}) => (
  clamp(getEquipmentGripReferenceScale(source), EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX)
);
const getEquipmentModelDimensions = (source = {}) => {
  const legacyScale = Number.isFinite(Number(source.scale)) && Number(source.scale) > 0 ? Number(source.scale) : 1;
  const fallbackScale = getEquipmentModelReferenceScale(source);
  return {
    width: clamp((Number(source.width) || fallbackScale) * legacyScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    height: clamp((Number(source.height) || fallbackScale) * legacyScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    depth: clamp((Number(source.depth) || fallbackScale) * legacyScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
  };
};
const getEquipmentDimensionsScale = (dimensions = {}) => (
  clamp(
    Math.max(Number(dimensions.width) || 0, Number(dimensions.height) || 0, Number(dimensions.depth) || 0),
    EQUIPMENT_MODEL_SCALE_MIN,
    EQUIPMENT_MODEL_SCALE_MAX,
  )
);
const getStoredEquipmentSourceScale = (item = {}) => {
  const sourceScale = Number(item.weaponModelSourceScale);
  return Number.isFinite(sourceScale) && sourceScale > 0
    ? clamp(sourceScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX)
    : 0;
};
const getStoredEquipmentDimensions = (item = {}) => {
  const fallbackScale = clamp(Number(item.weaponModelScale) || 1, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX);
  return {
    width: clamp(Number(item.weaponModelWidth) || fallbackScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    height: clamp(Number(item.weaponModelHeight) || fallbackScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    depth: clamp(Number(item.weaponModelDepth) || fallbackScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
  };
};
const getStoredEquipmentSourceDimensions = (item = {}) => {
  const fallbackScale = getStoredEquipmentSourceScale(item) || getEquipmentDimensionsScale(getStoredEquipmentDimensions(item));
  return {
    width: clamp(Number(item.weaponModelSourceWidth) || fallbackScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    height: clamp(Number(item.weaponModelSourceHeight) || fallbackScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    depth: clamp(Number(item.weaponModelSourceDepth) || fallbackScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
  };
};
const hasStoredEquipmentSourceDimensions = (item = {}) => (
  Number(item.weaponModelSourceWidth) > 0
  && Number(item.weaponModelSourceHeight) > 0
  && Number(item.weaponModelSourceDepth) > 0
);
const resolveLinkedEquipmentModelDimensions = (item = {}, source = null) => {
  const currentDimensions = getStoredEquipmentDimensions(item);
  if (!source) return currentDimensions;
  const sourceDimensions = getEquipmentModelDimensions(source);
  if (!hasStoredEquipmentSourceDimensions(item)) {
    const sourceScale = getEquipmentDimensionsScale(sourceDimensions);
    const currentScale = Number(item.weaponModelScale);
    const targetScale = Number.isFinite(currentScale) && currentScale > 0 && Math.abs(currentScale - 1) > 0.0001
      ? clamp(currentScale, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX)
      : sourceScale;
    const ratio = targetScale / Math.max(EQUIPMENT_MODEL_SCALE_MIN, sourceScale);
    return {
      width: clamp(sourceDimensions.width * ratio, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
      height: clamp(sourceDimensions.height * ratio, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
      depth: clamp(sourceDimensions.depth * ratio, EQUIPMENT_MODEL_SCALE_MIN, EQUIPMENT_MODEL_SCALE_MAX),
    };
  }
  const previousSourceDimensions = getStoredEquipmentSourceDimensions(item);
  return {
    width: clamp(
      sourceDimensions.width * (currentDimensions.width / Math.max(EQUIPMENT_MODEL_SCALE_MIN, previousSourceDimensions.width)),
      EQUIPMENT_MODEL_SCALE_MIN,
      EQUIPMENT_MODEL_SCALE_MAX,
    ),
    height: clamp(
      sourceDimensions.height * (currentDimensions.height / Math.max(EQUIPMENT_MODEL_SCALE_MIN, previousSourceDimensions.height)),
      EQUIPMENT_MODEL_SCALE_MIN,
      EQUIPMENT_MODEL_SCALE_MAX,
    ),
    depth: clamp(
      sourceDimensions.depth * (currentDimensions.depth / Math.max(EQUIPMENT_MODEL_SCALE_MIN, previousSourceDimensions.depth)),
      EQUIPMENT_MODEL_SCALE_MIN,
      EQUIPMENT_MODEL_SCALE_MAX,
    ),
  };
};
const getEquipmentModelRotationValue = (source = {}, axis = 'X') => {
  const modelField = `weaponModelRotation${axis}`;
  if (source[modelField] !== undefined && source[modelField] !== null && source[modelField] !== '') {
    return getModelRotationValue(source, modelField);
  }
  return getModelRotationValue(source, `modelRotation${axis}`);
};
const getEquipmentGripFields = (source = {}) => ({
  weaponModelRotationX: getEquipmentModelRotationValue(source, 'X'),
  weaponModelRotationY: getEquipmentModelRotationValue(source, 'Y'),
  weaponModelRotationZ: getEquipmentModelRotationValue(source, 'Z'),
  weaponGripHand: getEquipmentHand(source.weaponGripHand),
  weaponGripReferenceScale: getEquipmentGripReferenceScale(source),
  weaponGripRightEnabled: Boolean(source.weaponGripRightEnabled),
  weaponGripRightX: clamp(Number(source.weaponGripRightX) || 0, -2, 2),
  weaponGripRightY: clamp(Number(source.weaponGripRightY) || 0, -2, 2),
  weaponGripRightZ: clamp(Number(source.weaponGripRightZ) || 0, -2, 2),
  weaponGripRightRotationX: getModelRotationValue(source, 'weaponGripRightRotationX'),
  weaponGripRightRotationY: getModelRotationValue(source, 'weaponGripRightRotationY'),
  weaponGripRightRotationZ: getModelRotationValue(source, 'weaponGripRightRotationZ'),
  weaponGripLeftEnabled: Boolean(source.weaponGripLeftEnabled),
  weaponGripLeftX: clamp(Number(source.weaponGripLeftX) || 0, -2, 2),
  weaponGripLeftY: clamp(Number(source.weaponGripLeftY) || 0, -2, 2),
  weaponGripLeftZ: clamp(Number(source.weaponGripLeftZ) || 0, -2, 2),
  weaponGripLeftRotationX: getModelRotationValue(source, 'weaponGripLeftRotationX'),
  weaponGripLeftRotationY: getModelRotationValue(source, 'weaponGripLeftRotationY'),
  weaponGripLeftRotationZ: getModelRotationValue(source, 'weaponGripLeftRotationZ'),
  shieldGripArm: getEquipmentArm(source.shieldGripArm),
  shieldGripReferenceScale: getShieldGripReferenceScale(source),
  shieldGripHandEnabled: Boolean(source.shieldGripHandEnabled),
  shieldGripHandX: clamp(Number(source.shieldGripHandX) || 0, -2, 2),
  shieldGripHandY: clamp(Number(source.shieldGripHandY) || -0.35, -2, 2),
  shieldGripHandZ: clamp(Number(source.shieldGripHandZ) || 0, -2, 2),
  shieldGripElbowEnabled: Boolean(source.shieldGripElbowEnabled),
  shieldGripElbowX: clamp(Number(source.shieldGripElbowX) || 0, -2, 2),
  shieldGripElbowY: clamp(Number(source.shieldGripElbowY) || 0.35, -2, 2),
  shieldGripElbowZ: clamp(Number(source.shieldGripElbowZ) || 0, -2, 2),
  armorGripReferenceScale: getArmorGripReferenceScale(source),
  ...ARMOR_GRIP_POINTS.reduce((fields, point) => ({
    ...fields,
    [`armorGrip${point.suffix}Enabled`]: Boolean(source[`armorGrip${point.suffix}Enabled`]),
    [`armorGrip${point.suffix}X`]: clamp(Number(source[`armorGrip${point.suffix}X`]) || point.defaultX, -2, 2),
    [`armorGrip${point.suffix}Y`]: clamp(Number(source[`armorGrip${point.suffix}Y`]) || point.defaultY, -2, 2),
    [`armorGrip${point.suffix}Z`]: clamp(Number(source[`armorGrip${point.suffix}Z`]) || point.defaultZ, -2, 2),
  }), {}),
  armorCanvasCutEnabled: Boolean(source.armorCanvasCutEnabled),
  armorFullCharacterRigEnabled: Boolean(source.armorFullCharacterRigEnabled),
  armorCustomPieces: normalizeArmorCustomPieces(source.armorCustomPieces),
  armorSegmentAssignments: normalizeArmorSegmentAssignments(source.armorSegmentAssignments),
  armorCutContours: normalizeArmorCutContours(source.armorCutContours),
  armorCutPaintStrokes: normalizeArmorCutPaintStrokes(source.armorCutPaintStrokes),
});

export const syncConfigModelReferences = (config, studioProject, options = {}) => {
  const next = createConfigFromSavedAssets(config);
  let changed = false;
  const characterModels = new Map((studioProject.characterModels3d || []).map((model) => [model.id, model]));
  const decorModels = new Map((studioProject.decorModels3d || []).map((model) => [model.id, model]));
  const setField = (target, field, value) => {
    if (!target || target[field] === value) return;
    target[field] = value;
    changed = true;
  };
  const setMissingField = (target, field, value) => {
    if (!target || (target[field] !== undefined && target[field] !== null && target[field] !== '')) return;
    setField(target, field, value);
  };
  const setActorModelDefaultField = (actor, field, value) => {
    if (!actor) return;
    const currentValue = actor[field];
    const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== '';
    if (actor.characterModelUrl && hasValue) return;
    const defaultValue = DEFAULT_ARCADE_CONFIG.player[field];
    if (hasValue && defaultValue !== undefined && currentValue !== defaultValue) return;
    setField(actor, field, value);
  };
  const getCharacterModelEquipmentInventory = (model = {}) => (
    (Array.isArray(model?.inventory) ? model.inventory : [])
      .filter((item) => EQUIPMENT_MODEL_TYPES.has(item?.type))
      .map((item, index) => {
        const modelId = item.weaponModel3dId || item.model3dId || '';
        const equipmentModel = decorModels.get(modelId);
        if (!isEquipmentModelForType(equipmentModel, item.type)) return null;
        const source = getModelSourceForMode(equipmentModel, options);
        if (!source) return null;
        const resolvedDimensions = resolveLinkedEquipmentModelDimensions(item, equipmentModel);
        const sourceDimensions = getEquipmentModelDimensions(equipmentModel);
        return {
          id: `${model.id || 'character'}-${item.type}-${modelId || index}`,
          name: item.name || (item.type === 'shield' ? 'Bouclier' : (item.type === 'armor' ? 'Armure' : (item.type === 'helmet' ? 'Casque' : (item.type === 'leggings' ? 'Jambieres' : 'Arme')))),
          type: item.type,
          quantity: 1,
          effect: item.effect || '',
          equipped: item.equipped !== false,
          weaponModel3dId: modelId,
          weaponModelUrl: source,
          weaponModelName: equipmentModel.modelName || equipmentModel.name || item.weaponModelName || item.modelName || '',
          weaponModelFormat: equipmentModel.modelFormat || item.weaponModelFormat || item.modelFormat || '',
          weaponModelFileSize: Number(equipmentModel.modelFileSize || item.weaponModelFileSize || item.modelFileSize) || 0,
          weaponModelResources: Array.isArray(equipmentModel.modelResources)
            ? equipmentModel.modelResources
            : (Array.isArray(item.weaponModelResources)
              ? item.weaponModelResources
              : (Array.isArray(item.modelResources) ? item.modelResources : [])),
          weaponModelScale: getEquipmentDimensionsScale(resolvedDimensions),
          weaponModelSourceScale: getEquipmentModelReferenceScale(equipmentModel),
          weaponModelWidth: resolvedDimensions.width,
          weaponModelHeight: resolvedDimensions.height,
          weaponModelDepth: resolvedDimensions.depth,
          weaponModelSourceWidth: sourceDimensions.width,
          weaponModelSourceHeight: sourceDimensions.height,
          weaponModelSourceDepth: sourceDimensions.depth,
          weaponOffsetX: Number(item.weaponOffsetX) || 0,
          weaponOffsetY: Number(item.weaponOffsetY) || 0,
          weaponOffsetZ: Number(item.weaponOffsetZ) || 0,
          weaponRotationX: Number(item.weaponRotationX) || 0,
          weaponRotationY: Number(item.weaponRotationY) || 0,
          weaponRotationZ: Number(item.weaponRotationZ) || 0,
          ...getEquipmentGripFields({
            ...equipmentModel,
            weaponGripHand: item.weaponGripHand || equipmentModel.weaponGripHand,
            shieldGripArm: item.shieldGripArm || equipmentModel.shieldGripArm,
          }),
          sourceCharacterEquipment: true,
          sourceCharacterModel3dId: model.id || '',
        };
      })
      .filter((item) => item && item.equipped && item.weaponModel3dId && item.weaponModelUrl)
  );
  const getInventorySignature = (items = []) => JSON.stringify((Array.isArray(items) ? items : []).map((item) => ({
    id: item?.id || '',
    type: item?.type || '',
    equipped: Boolean(item?.equipped),
    weaponModel3dId: item?.weaponModel3dId || '',
    weaponModelUrl: item?.weaponModelUrl || '',
    weaponModelName: item?.weaponModelName || '',
    weaponModelScale: Number(item?.weaponModelScale) || 1,
    weaponModelSourceScale: getStoredEquipmentSourceScale(item),
    weaponModelWidth: getStoredEquipmentDimensions(item).width,
    weaponModelHeight: getStoredEquipmentDimensions(item).height,
    weaponModelDepth: getStoredEquipmentDimensions(item).depth,
    weaponModelSourceWidth: getStoredEquipmentSourceDimensions(item).width,
    weaponModelSourceHeight: getStoredEquipmentSourceDimensions(item).height,
    weaponModelSourceDepth: getStoredEquipmentSourceDimensions(item).depth,
    weaponModelRotationX: getEquipmentModelRotationValue(item, 'X'),
    weaponModelRotationY: getEquipmentModelRotationValue(item, 'Y'),
    weaponModelRotationZ: getEquipmentModelRotationValue(item, 'Z'),
    weaponOffsetX: Number(item?.weaponOffsetX) || 0,
    weaponOffsetY: Number(item?.weaponOffsetY) || 0,
    weaponOffsetZ: Number(item?.weaponOffsetZ) || 0,
    weaponRotationX: Number(item?.weaponRotationX) || 0,
    weaponRotationY: Number(item?.weaponRotationY) || 0,
    weaponRotationZ: Number(item?.weaponRotationZ) || 0,
    weaponGripHand: getEquipmentHand(item?.weaponGripHand),
    weaponGripRightEnabled: Boolean(item?.weaponGripRightEnabled),
    weaponGripRightX: Number(item?.weaponGripRightX) || 0,
    weaponGripRightY: Number(item?.weaponGripRightY) || 0,
    weaponGripRightZ: Number(item?.weaponGripRightZ) || 0,
    weaponGripRightRotationX: Number(item?.weaponGripRightRotationX) || 0,
    weaponGripRightRotationY: Number(item?.weaponGripRightRotationY) || 0,
    weaponGripRightRotationZ: Number(item?.weaponGripRightRotationZ) || 0,
    weaponGripLeftEnabled: Boolean(item?.weaponGripLeftEnabled),
    weaponGripLeftX: Number(item?.weaponGripLeftX) || 0,
    weaponGripLeftY: Number(item?.weaponGripLeftY) || 0,
    weaponGripLeftZ: Number(item?.weaponGripLeftZ) || 0,
    weaponGripLeftRotationX: Number(item?.weaponGripLeftRotationX) || 0,
    weaponGripLeftRotationY: Number(item?.weaponGripLeftRotationY) || 0,
    weaponGripLeftRotationZ: Number(item?.weaponGripLeftRotationZ) || 0,
    shieldGripArm: getEquipmentArm(item?.shieldGripArm),
    shieldGripReferenceScale: Number(item?.shieldGripReferenceScale) || 1,
    shieldGripHandEnabled: Boolean(item?.shieldGripHandEnabled),
    shieldGripHandX: Number(item?.shieldGripHandX) || 0,
    shieldGripHandY: Number(item?.shieldGripHandY) || 0,
    shieldGripHandZ: Number(item?.shieldGripHandZ) || 0,
    shieldGripElbowEnabled: Boolean(item?.shieldGripElbowEnabled),
    shieldGripElbowX: Number(item?.shieldGripElbowX) || 0,
    shieldGripElbowY: Number(item?.shieldGripElbowY) || 0,
    shieldGripElbowZ: Number(item?.shieldGripElbowZ) || 0,
    armorGripReferenceScale: Number(item?.armorGripReferenceScale) || 1,
    ...ARMOR_GRIP_POINTS.reduce((fields, point) => ({
      ...fields,
      [`armorGrip${point.suffix}Enabled`]: Boolean(item?.[`armorGrip${point.suffix}Enabled`]),
      [`armorGrip${point.suffix}X`]: Number(item?.[`armorGrip${point.suffix}X`]) || point.defaultX,
      [`armorGrip${point.suffix}Y`]: Number(item?.[`armorGrip${point.suffix}Y`]) || point.defaultY,
      [`armorGrip${point.suffix}Z`]: Number(item?.[`armorGrip${point.suffix}Z`]) || point.defaultZ,
    }), {}),
    armorCanvasCutEnabled: Boolean(item?.armorCanvasCutEnabled),
    armorFullCharacterRigEnabled: Boolean(item?.armorFullCharacterRigEnabled),
    armorCustomPieces: normalizeArmorCustomPieces(item?.armorCustomPieces),
    armorSegmentAssignments: normalizeArmorSegmentAssignments(item?.armorSegmentAssignments),
    armorCutContours: normalizeArmorCutContours(item?.armorCutContours),
    armorCutPaintStrokes: normalizeArmorCutPaintStrokes(item?.armorCutPaintStrokes),
    sourceCharacterEquipment: Boolean(item?.sourceCharacterEquipment),
    sourceCharacterModel3dId: item?.sourceCharacterModel3dId || '',
  })));
  const syncActorCharacterEquipment = (actor, model = null) => {
    if (!actor) return;
    const currentInventory = Array.isArray(actor.inventory) ? actor.inventory : [];
    const baseInventory = currentInventory.filter((item) => !item?.sourceCharacterEquipment);
    const equipment = getCharacterModelEquipmentInventory(model || {});
    const equipmentTypes = new Set(equipment.map((item) => item.type));
    const nextInventory = equipment.length
      ? [
        ...baseInventory.map((item) => (
          equipmentTypes.has(item?.type) ? { ...item, equipped: false } : item
        )),
        ...equipment,
      ]
      : baseInventory;
    if (getInventorySignature(currentInventory) !== getInventorySignature(nextInventory)) {
      setField(actor, 'inventory', nextInventory);
    }
  };
  const syncActor = (actor) => {
    if (!actor) return;
    const model = characterModels.get(actor.characterModel3dId);
    if (model) {
      const axisScale = getCharacterModelAxisScale(model);
      setActorModelDefaultField(actor, 'characterModelScale', axisScale.y);
      setActorModelDefaultField(actor, 'characterModelScaleX', axisScale.x);
      setActorModelDefaultField(actor, 'characterModelScaleY', axisScale.y);
      setActorModelDefaultField(actor, 'characterModelScaleZ', axisScale.z);
      setActorModelDefaultField(actor, 'characterModelScaleProportional', model.characterModelScaleProportional !== false);
      setActorModelDefaultField(actor, 'characterMaterialBrightness', getStudioMaterialBrightness(model));
      if (getCharacterRigSignature(actor.characterRigPoints) !== getCharacterRigSignature(model.characterRigPoints)) {
        setField(actor, 'characterRigPoints', normalizeCharacterRigPoints(model.characterRigPoints));
      }
      syncActorCharacterEquipment(actor, model);
      const source = getModelSourceForMode(model, options);
      if (source) {
        setField(actor, 'characterModelUrl', source);
        setField(actor, 'characterModelName', model.modelName || model.name || actor.characterModelName || '');
        setField(actor, 'characterModelFormat', model.modelFormat || '');
        setField(actor, 'characterModelFileSize', Number(model.modelFileSize) || 0);
        setField(actor, 'characterModelResources', Array.isArray(model.modelResources) ? model.modelResources : []);
        setField(actor, 'characterModelAnimations', getPersistedModelAnimations(model, options));
        setField(actor, 'characterLocalModelFileId', model.localModelFileId || '');
        setField(actor, 'characterRenderMode', 'glb');
        return;
      }
      setField(actor, 'characterModelUrl', '');
      setField(actor, 'characterModelName', '');
      setField(actor, 'characterModelFormat', '');
      setField(actor, 'characterModelFileSize', 0);
      setField(actor, 'characterModelResources', []);
      setField(actor, 'characterModelAnimations', {});
      setField(actor, 'characterLocalModelFileId', model.localModelFileId || '');
      if (actor.characterRenderMode === 'glb') setField(actor, 'characterRenderMode', getStudioCharacterRenderMode(model));
    } else if (actor.characterModel3dId || isBlobUrl(actor.characterModelUrl)) {
      setField(actor, 'characterModel3dId', '');
      setField(actor, 'characterModelUrl', '');
      setField(actor, 'characterModelName', '');
      setField(actor, 'characterModelFormat', '');
      setField(actor, 'characterModelFileSize', 0);
      setField(actor, 'characterModelResources', []);
      setField(actor, 'characterModelAnimations', {});
      setField(actor, 'characterLocalModelFileId', '');
      setField(actor, 'characterModelScale', 1);
      setField(actor, 'characterModelScaleX', 1);
      setField(actor, 'characterModelScaleY', 1);
      setField(actor, 'characterModelScaleZ', 1);
      setField(actor, 'characterModelScaleProportional', true);
      setField(actor, 'characterMaterialBrightness', 1);
      if (
        Array.isArray(actor.characterRigPoints)
        && actor.characterRigPoints.length
        && getCharacterRigSignature(actor.characterRigPoints) !== getCharacterRigSignature([])
      ) {
        setField(actor, 'characterRigPoints', []);
      }
      syncActorCharacterEquipment(actor, null);
      if (actor.characterRenderMode === 'glb') setField(actor, 'characterRenderMode', 'capsule');
    }
  };
  const syncActorInventoryWeapons = (actor) => {
    if (!actor || !Array.isArray(actor.inventory)) return;
    actor.inventory.forEach((item) => {
      if (!EQUIPMENT_MODEL_TYPES.has(item?.type)) return;
      const model = decorModels.get(item.weaponModel3dId);
      if (isEquipmentModelForType(model, item.type)) {
        const source = getModelSourceForMode(model, options);
        if (source) {
          const resolvedDimensions = resolveLinkedEquipmentModelDimensions(item, model);
          const sourceDimensions = getEquipmentModelDimensions(model);
          setField(item, 'weaponModelUrl', source);
          setField(item, 'weaponModelName', model.modelName || model.name || item.weaponModelName || '');
          setField(item, 'weaponModelFormat', model.modelFormat || '');
          setField(item, 'weaponModelFileSize', Number(model.modelFileSize) || 0);
          setField(item, 'weaponModelResources', Array.isArray(model.modelResources) ? model.modelResources : []);
          setField(item, 'weaponModelScale', getEquipmentDimensionsScale(resolvedDimensions));
          setField(item, 'weaponModelSourceScale', getEquipmentModelReferenceScale(model));
          setField(item, 'weaponModelWidth', resolvedDimensions.width);
          setField(item, 'weaponModelHeight', resolvedDimensions.height);
          setField(item, 'weaponModelDepth', resolvedDimensions.depth);
          setField(item, 'weaponModelSourceWidth', sourceDimensions.width);
          setField(item, 'weaponModelSourceHeight', sourceDimensions.height);
          setField(item, 'weaponModelSourceDepth', sourceDimensions.depth);
          const gripFields = getEquipmentGripFields({
            ...model,
            weaponGripHand: item.weaponGripHand || model.weaponGripHand,
            shieldGripArm: item.shieldGripArm || model.shieldGripArm,
          });
          Object.entries(gripFields).forEach(([field, value]) => setField(item, field, value));
          return;
        }
        setField(item, 'weaponModelUrl', '');
        setField(item, 'weaponModelName', '');
        setField(item, 'weaponModelFormat', '');
        setField(item, 'weaponModelFileSize', 0);
        setField(item, 'weaponModelResources', []);
        setField(item, 'weaponModelSourceScale', 0);
        setField(item, 'weaponModelSourceWidth', 0);
        setField(item, 'weaponModelSourceHeight', 0);
        setField(item, 'weaponModelSourceDepth', 0);
      } else if (item.weaponModel3dId || item.weaponModelUrl) {
        setField(item, 'weaponModel3dId', '');
        setField(item, 'weaponModelUrl', '');
        setField(item, 'weaponModelName', '');
        setField(item, 'weaponModelFormat', '');
        setField(item, 'weaponModelFileSize', 0);
        setField(item, 'weaponModelResources', []);
        setField(item, 'weaponModelSourceScale', 0);
        setField(item, 'weaponModelSourceWidth', 0);
        setField(item, 'weaponModelSourceHeight', 0);
        setField(item, 'weaponModelSourceDepth', 0);
        setField(item, 'equipped', false);
      }
    });
  };
  syncActor(next.player);
  (next.heroes || []).forEach(syncActor);
  (next.enemies || []).forEach(syncActor);
  syncActorInventoryWeapons(next.player);
  (next.heroes || []).forEach(syncActorInventoryWeapons);
  (next.enemies || []).forEach(syncActorInventoryWeapons);
  (next.props || []).forEach((prop) => {
    const model = decorModels.get(prop.decorModel3dId);
    if (model) {
      const decorKind = getStudioDecorKindId(model.kind);
      setMissingField(prop, 'materialBrightness', getDecorMaterialBrightness(model));
      setMissingField(prop, 'decorModelScale', 1);
      setMissingField(prop, 'decorKind', decorKind);
      setMissingField(prop, 'modelRotationX', getModelRotationValue(model, 'modelRotationX'));
      setMissingField(prop, 'modelRotationY', getModelRotationValue(model, 'modelRotationY'));
      setMissingField(prop, 'modelRotationZ', getModelRotationValue(model, 'modelRotationZ'));
      setMissingField(prop, 'modelCenterOnOrigin', Boolean(model.modelCenterOnOrigin));
      setMissingField(prop, 'modelFlushToGround', Boolean(model.modelFlushToGround));
      const source = getModelSourceForMode(model, options);
      if (source) {
        setField(prop, 'decorModelUrl', source);
        setField(prop, 'decorModelName', model.modelName || model.name || prop.decorModelName || '');
        setField(prop, 'decorLocalModelFileId', model.localModelFileId || '');
        setField(prop, 'modelFormat', model.modelFormat || '');
        setField(prop, 'modelFileSize', Number(model.modelFileSize) || 0);
        setField(prop, 'modelResources', Array.isArray(model.modelResources) ? model.modelResources : []);
        setField(prop, 'renderMode', 'glb');
        const size = getDecorModelWorldSize(model);
        setMissingField(prop, 'w', size.width);
        setMissingField(prop, 'h', size.depth);
        setMissingField(prop, 'r', Math.round(Math.max(size.width, size.depth) / 2));
        setMissingField(prop, 'modelHeight', size.height);
        setMissingField(prop, 'blocksMovement', model.collision ?? shouldPropBlockByMode('glb'));
        if (!prop.imageData || prop.imageData === model.imageData || prop.imageName === model.imageName) {
          setField(prop, 'imageData', '');
          setField(prop, 'imageName', '');
          setField(prop, 'repeatTexture', false);
        }
        return;
      }
      setField(prop, 'decorModelUrl', '');
      setField(prop, 'decorModelName', '');
      setField(prop, 'decorLocalModelFileId', model.localModelFileId || '');
      setField(prop, 'modelFormat', '');
      setField(prop, 'modelFileSize', 0);
      setField(prop, 'modelResources', []);
      setField(prop, 'materialBrightness', getDecorMaterialBrightness(model));
      const renderMode = getDecorImportRenderMode(model);
      const size = getDecorModelWorldSize(model);
      const tileSize = renderMode === 'floor' ? Math.max(size.width, size.depth) : 0;
      setField(prop, 'renderMode', renderMode);
      setMissingField(prop, 'w', tileSize || size.width);
      setMissingField(prop, 'h', tileSize || size.depth);
      setMissingField(prop, 'r', Math.round((tileSize || Math.max(size.width, size.depth)) / 2));
      setMissingField(prop, 'modelHeight', renderMode === 'floor' ? 12 : size.height);
      setMissingField(prop, 'blocksMovement', model.collision ?? shouldPropBlockByMode(renderMode));
      setMissingField(prop, 'imageData', model.imageData || '');
      setMissingField(prop, 'imageName', model.imageName || '');
      setMissingField(prop, 'repeatTexture', Boolean(model.repeatTexture));
    } else if (isBlobUrl(prop.decorModelUrl)) {
      setField(prop, 'decorModelUrl', '');
      setField(prop, 'decorLocalModelFileId', '');
      setField(prop, 'modelFormat', '');
      setField(prop, 'modelFileSize', 0);
      setField(prop, 'modelResources', []);
    }
  });
  return { config: changed ? next : config, changed };
};

export const syncConfigModelUrls = (config, studioProject) => syncConfigModelReferences(config, studioProject).config;

export const compactHistoryDataUrl = (value = '') => (
  isDataUrl(value) && value.length > RPG3D_HISTORY_DATA_URL_MAX_CHARS ? '' : value
);

export const compactHistoryModel = (model = {}) => stripVolatileModelData({
  ...model,
  modelData: compactHistoryDataUrl(model.modelData || ''),
  modelUrl: isDataUrl(model.modelUrl || '') ? compactHistoryDataUrl(model.modelUrl) : (model.modelUrl || ''),
  imageData: compactHistoryDataUrl(model.imageData || ''),
  modelResources: Array.isArray(model.modelResources)
    ? model.modelResources.map((resource) => ({
      ...(resource || {}),
      data: compactHistoryDataUrl(resource?.data || ''),
    }))
    : [],
  modelAnimations: Object.entries(model.modelAnimations || {}).reduce((animations, [slot, animation]) => {
    animations[slot] = {
      ...(animation || {}),
      modelData: compactHistoryDataUrl(animation?.modelData || ''),
      modelUrl: isDataUrl(animation?.modelUrl || '') ? compactHistoryDataUrl(animation.modelUrl) : (animation?.modelUrl || ''),
      modelResources: Array.isArray(animation?.modelResources)
        ? animation.modelResources.map((resource) => ({
          ...(resource || {}),
          data: compactHistoryDataUrl(resource?.data || ''),
        }))
        : [],
    };
    return animations;
  }, {}),
});

export const createHistoryStudioProjectSnapshot = (studioProject = null) => ({
  ...createDefaultStudioProject(),
  ...(studioProject && typeof studioProject === 'object' ? studioProject : {}),
  characterModels3d: (studioProject?.characterModels3d || []).map(compactHistoryModel),
  decorModels3d: (studioProject?.decorModels3d || []).map(compactHistoryModel),
  mediaAssets: (studioProject?.mediaAssets || []).map((asset) => ({
    ...(asset || {}),
    url: compactHistoryDataUrl(asset?.url || ''),
  })),
});

export const createRpg3DHistorySnapshot = (config, studioProject) => ({
  config: cloneConfig(config),
  studioProject: createHistoryStudioProjectSnapshot(studioProject),
});
