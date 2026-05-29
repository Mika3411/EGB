import { EXPORT_ASSET_SOURCE_KINDS, collectExportAssets } from './exportAssetCollector';

const slugify = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'asset';

const dataUrlToBytes = (dataUrl) => {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl || '');
  if (!match) return null;

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { mimeType, bytes };
  }

  const decoded = decodeURIComponent(payload);
  const bytes = new TextEncoder().encode(decoded);
  return { mimeType, bytes };
};

const extensionFromMime = (mimeType = '') => {
  const mapping = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'model/gltf-binary': 'glb',
    'model/gltf+json': 'gltf',
    'model/obj': 'obj',
    'model/vnd.fbx': 'fbx',
    'application/vnd.autodesk.fbx': 'fbx',
    'text/plain': 'txt',
  };
  if (mapping[mimeType]) return mapping[mimeType];
  const raw = mimeType.split('/')[1] || 'bin';
  return raw.replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'bin';
};

const GENERIC_REMOTE_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

const shortHash = (value = '') => {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const getCleanContentType = (value = '') => String(value || '').split(';')[0].trim().toLowerCase();

const getSafeExtensionFromUrl = (url = '') => {
  try {
    const parsed = new URL(url, 'https://example.invalid');
    const rawExtension = parsed.pathname.split('/').pop()?.split('.').pop() || '';
    const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return extension && extension.length <= 12 ? extension : '';
  } catch {
    const rawExtension = String(url).split('?')[0].split('#')[0].split('/').pop()?.split('.').pop() || '';
    const extension = rawExtension.toLowerCase().replace(/[^a-z0-9]+/g, '');
    return extension && extension.length <= 12 ? extension : '';
  }
};

const preferredNameFromUrl = (url = '') => {
  try {
    const parsed = new URL(url, 'https://example.invalid');
    return decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || '');
  } catch {
    return String(url).split('?')[0].split('#')[0].split('/').filter(Boolean).pop() || '';
  }
};

const extensionFromRemote = ({ contentType = '', url = '' } = {}) => {
  const normalizedContentType = getCleanContentType(contentType);
  const urlExtension = getSafeExtensionFromUrl(url);
  if (normalizedContentType && !GENERIC_REMOTE_MIME_TYPES.has(normalizedContentType)) {
    return extensionFromMime(normalizedContentType);
  }
  return urlExtension || extensionFromMime(normalizedContentType || 'application/octet-stream');
};

const createStableRemoteAssetPath = (reference, url, contentType, usedRemotePaths) => {
  const baseName = slugify(reference.preferredName || preferredNameFromUrl(url) || 'asset');
  const extension = extensionFromRemote({ contentType, url });
  const folder = reference.targetFolder || 'assets';
  const hash = shortHash(url);
  const prefix = folder ? `assets/${folder}/${baseName}-${hash}` : `assets/${baseName}-${hash}`;
  let assetPath = `${prefix}.${extension}`;
  let collisionIndex = 2;

  while (usedRemotePaths.has(assetPath) && usedRemotePaths.get(assetPath) !== url) {
    assetPath = `${prefix}-${collisionIndex}.${extension}`;
    collisionIndex += 1;
  }

  usedRemotePaths.set(assetPath, url);
  return assetPath;
};

const deepClone = (value) => JSON.parse(JSON.stringify(value || {}));

const ROUTE_CANVAS_ROOM_LIMIT = 15;
const DEFAULT_ROUTE_CANVAS_ID = 'route_canvas_1';

const makeDefaultCanvas = (index = 0) => ({
  id: index === 0 ? DEFAULT_ROUTE_CANVAS_ID : `route_canvas_${index + 1}`,
  name: `Canvas ${index + 1}`,
});

const ANIME2D_LAYER_MEDIA_PATH_PATTERN = /\.layers\[\d+\](?:\.(?:src|imageData|originalSrc)|\.layer\.(?:src|imageData|originalSrc))$/;

const LEGACY_STANDALONE_DIRECT_MEDIA_PATTERNS = [
  /^assets\[\d+\]\.url$/,
  /^heroAdventure\.combat\.(?:backgroundImageData|heroImageData|enemyImageData|(?:hero|enemy)(?:Hit|Death)Effect(?:Image|Video|Audio)Data)$/,
  /^scenes\[\d+\]\.(?:backgroundData|musicData|ambientSoundData)$/,
  /^scenes\[\d+\]\.hotspots\[\d+\]\.(?:objectImageData|soundData|secondObjectImageData|combatBackgroundImageData|combatHeroImageData|combatEnemyImageData)$/,
  /^scenes\[\d+\]\.hotspots\[\d+\]\.logicRules\[\d+\]\.(?:successSoundData|failureSoundData)$/,
  /^scenes\[\d+\]\.hotspots\[\d+\]\.conversation\.nodes\[\d+\]\.replies\[\d+\]\.(?:combatBackgroundImageData|combatHeroImageData|combatEnemyImageData)$/,
  /^scenes\[\d+\]\.sceneObjects\[\d+\]\.(?:imageData|popupImage|popupImageData|soundData)$/,
  /^scenes\[\d+\]\.sceneObjects\[\d+\]\.logicRules\[\d+\]\.(?:successSoundData|failureSoundData)$/,
  /^items\[\d+\]\.imageData$/,
  /^cinematics\[\d+\]\.videoData$/,
  /^cinematics\[\d+\]\.steps\[\d+\]\.src$/,
  /^cinematics\[\d+\]\.slides\[\d+\]\.(?:imageData|audioData)$/,
  /^enigmas\[\d+\]\.(?:imageData|popupBackgroundData)$/,
];

const LEGACY_STANDALONE_ANIME2D_SPEC_PATTERNS = [
  /^heroAdventure\.combat\.(?:hero|enemy)Anime2dSpec/,
  /^heroAdventure\.combat\.(?:hero|enemy)(?:Hit|Death)EffectAnime2dSpec/,
  /^scenes\[\d+\]\.hotspots\[\d+\]\.combat(?:Hero|Enemy)Anime2dSpec/,
  /^scenes\[\d+\]\.hotspots\[\d+\]\.conversation\.nodes\[\d+\]\.replies\[\d+\]\.combat(?:Hero|Enemy)Anime2dSpec/,
  /^scenes\[\d+\]\.sceneObjects\[\d+\]\.anime2dSpec/,
  /^cinematics\[\d+\]\.anime2dSpec/,
  /^cinematics\[\d+\]\.steps\[\d+\]\.spec/,
];

const isLegacyStandaloneAssetReference = (reference) => {
  const path = reference?.path || '';
  if (LEGACY_STANDALONE_DIRECT_MEDIA_PATTERNS.some((pattern) => pattern.test(path))) return true;
  return ANIME2D_LAYER_MEDIA_PATH_PATTERN.test(path)
    && LEGACY_STANDALONE_ANIME2D_SPEC_PATTERNS.some((pattern) => pattern.test(path));
};

const parseReferencePath = (path = '') => {
  const parts = [];
  let index = 0;

  while (index < path.length) {
    const char = path[index];
    if (char === '.') {
      index += 1;
      continue;
    }

    if (char === '[') {
      const endIndex = path.indexOf(']', index);
      if (endIndex < 0) return [];
      const rawPart = path.slice(index + 1, endIndex);
      if (/^\d+$/.test(rawPart)) {
        parts.push(Number(rawPart));
      } else {
        try {
          parts.push(JSON.parse(rawPart));
        } catch {
          parts.push(rawPart);
        }
      }
      index = endIndex + 1;
      continue;
    }

    const start = index;
    while (index < path.length && path[index] !== '.' && path[index] !== '[') {
      index += 1;
    }
    parts.push(path.slice(start, index));
  }

  return parts;
};

const getReferenceSlot = (root, path) => {
  const parts = parseReferencePath(path);
  if (!parts.length) return null;

  let target = root;
  for (let index = 0; index < parts.length - 1; index += 1) {
    if (!target || typeof target !== 'object') return null;
    target = target[parts[index]];
  }

  if (!target || typeof target !== 'object') return null;
  const key = parts[parts.length - 1];
  return { target, key, value: target[key] };
};

export const normalizeRouteMapCanvasesForExport = (routeMap) => {
  if (!routeMap || typeof routeMap !== 'object') return;

  const sourceCanvases = Array.isArray(routeMap.canvases) && routeMap.canvases.length
    ? routeMap.canvases
    : [makeDefaultCanvas(0)];
  const usedCanvasIds = new Set();

  routeMap.canvases = sourceCanvases.map((canvas, index) => {
    const fallback = makeDefaultCanvas(index);
    const source = canvas && typeof canvas === 'object' ? canvas : {};
    let id = typeof source.id === 'string' && source.id.trim() ? source.id : fallback.id;
    let dedupeIndex = index + 1;

    while (usedCanvasIds.has(id)) {
      id = `route_canvas_${dedupeIndex + 1}`;
      dedupeIndex += 1;
    }

    usedCanvasIds.add(id);
    return {
      ...source,
      id,
      name: typeof source.name === 'string' && source.name.trim() ? source.name : fallback.name,
    };
  });

  const ensureCanvas = (canvasId) => {
    if (routeMap.canvases.some((canvas) => canvas.id === canvasId)) return;
    routeMap.canvases.push({ id: canvasId, name: `Canvas ${routeMap.canvases.length + 1}` });
  };

  const rooms = Array.isArray(routeMap.rooms) ? routeMap.rooms : [];
  rooms.forEach((room, index) => {
    if (!room || typeof room !== 'object') return;
    const fallbackCanvasIndex = Math.floor(index / ROUTE_CANVAS_ROOM_LIMIT);
    const fallbackCanvas = routeMap.canvases[fallbackCanvasIndex] || makeDefaultCanvas(fallbackCanvasIndex);

    if (!routeMap.canvases[fallbackCanvasIndex]) {
      routeMap.canvases.push(fallbackCanvas);
    }

    const canvasId = typeof room.canvasId === 'string' && room.canvasId.trim()
      ? room.canvasId
      : fallbackCanvas.id;
    room.canvasId = canvasId;
    ensureCanvas(canvasId);
  });

  if (routeMap.actMaps && typeof routeMap.actMaps === 'object') {
    Object.values(routeMap.actMaps).forEach(normalizeRouteMapCanvasesForExport);
  }
};

export async function buildExportProjectWithAssets(project, zip, options = {}) {
  const nextProject = deepClone(project);
  normalizeRouteMapCanvasesForExport(nextProject.routeMap);
  const usedPaths = new Map();
  const usedRemotePaths = new Map();
  const remoteAssetCache = new Map();
  const offlineWarnings = [];
  const exportOfflineAssets = options.exportOfflineAssets === true;
  let bundledCount = 0;
  let onlineCount = 0;

  const uniqueAssetPath = (folder, preferredName, mimeType) => {
    const baseName = slugify(preferredName || 'asset');
    const extension = extensionFromMime(mimeType);
    const prefix = folder ? `assets/${folder}/${baseName}` : `assets/${baseName}`;
    const count = usedPaths.get(prefix) || 0;
    usedPaths.set(prefix, count + 1);
    return count === 0 ? `${prefix}.${extension}` : `${prefix}-${count + 1}.${extension}`;
  };

  const exportCollectedMediaReference = (reference) => {
    if (!isLegacyStandaloneAssetReference(reference)) return;
    if (reference.sourceKind !== EXPORT_ASSET_SOURCE_KINDS.DATA_URL) return;

    const slot = getReferenceSlot(nextProject, reference.path);
    const value = slot?.value;
    if (!value || typeof value !== 'string' || !value.startsWith('data:')) return;

    const parsed = dataUrlToBytes(value);
    if (!parsed) return;

    const assetPath = uniqueAssetPath(reference.targetFolder, reference.preferredName, parsed.mimeType);
    zip.file(assetPath, parsed.bytes);
    bundledCount += 1;
    slot.target[slot.key] = assetPath;
  };

  const collectRemoteReference = (groups, reference) => {
    if (!isLegacyStandaloneAssetReference(reference)) return;
    if (reference.sourceKind !== EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL) return;
    const slot = getReferenceSlot(nextProject, reference.path);
    const url = typeof slot?.value === 'string' ? slot.value.trim() : '';
    if (!url) return;

    const existing = groups.get(url);
    if (existing) {
      existing.references.push(reference);
      return;
    }

    groups.set(url, {
      url,
      references: [reference],
    });
  };

  const addOfflineWarning = ({ url, references, message, status = null }) => {
    onlineCount += 1;
    offlineWarnings.push({
      url,
      paths: references.map((reference) => reference.path),
      message,
      ...(status === null || status === undefined ? {} : { status }),
    });
  };

  const fetchRemoteAsset = async (group) => {
    if (remoteAssetCache.has(group.url)) return remoteAssetCache.get(group.url);

    if (typeof fetch !== 'function') {
      addOfflineWarning({
        url: group.url,
        references: group.references,
        message: 'fetch is not available in this environment.',
      });
      remoteAssetCache.set(group.url, null);
      return null;
    }

    try {
      const response = await fetch(group.url);
      if (!response?.ok) {
        addOfflineWarning({
          url: group.url,
          references: group.references,
          status: response?.status ?? null,
          message: response?.statusText || 'Remote asset request failed.',
        });
        remoteAssetCache.set(group.url, null);
        return null;
      }

      const bytes = new Uint8Array(await response.arrayBuffer());
      const contentType = response.headers?.get?.('Content-Type') || response.headers?.get?.('content-type') || '';
      const assetPath = createStableRemoteAssetPath(
        group.references[0],
        group.url,
        contentType,
        usedRemotePaths,
      );
      zip.file(assetPath, bytes);
      bundledCount += 1;

      const result = { assetPath };
      remoteAssetCache.set(group.url, result);
      return result;
    } catch (error) {
      addOfflineWarning({
        url: group.url,
        references: group.references,
        message: error?.message || 'Remote asset request failed.',
      });
      remoteAssetCache.set(group.url, null);
      return null;
    }
  };

  const exportRemoteReferences = async (references) => {
    const remoteGroups = new Map();
    references.forEach((reference) => collectRemoteReference(remoteGroups, reference));

    for (const group of remoteGroups.values()) {
      const exported = await fetchRemoteAsset(group);
      if (!exported) continue;

      group.references.forEach((reference) => {
        const slot = getReferenceSlot(nextProject, reference.path);
        if (!slot) return;
        slot.target[slot.key] = exported.assetPath;
      });
    }
  };

  const references = collectExportAssets(nextProject, { includeEmpty: false, dedupe: false });
  references.forEach(exportCollectedMediaReference);

  if (exportOfflineAssets) {
    await exportRemoteReferences(references);
    if (offlineWarnings.length) {
      zip.file('offline-assets-report.json', JSON.stringify({
        warnings: offlineWarnings,
      }, null, 2));
    }
  }

  options.onOfflineAssetsSummary?.({
    enabled: exportOfflineAssets,
    bundledCount,
    onlineCount,
    warningCount: offlineWarnings.length,
    warnings: offlineWarnings,
    message: exportOfflineAssets
      ? `Export offline : ${bundledCount} médias intégrés, ${onlineCount} médias restés en ligne.`
      : '',
  });

  return nextProject;
}
