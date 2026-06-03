import { EXPORT_ASSET_SOURCE_KINDS, collectExportAssets } from './exportAssetCollector';
import { SENSITIVE_ASSET_URL_PARAMS, getRemoteAssetDedupeKey } from './mediaDedupe';

export { getRemoteAssetDedupeKey } from './mediaDedupe';

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
const DEFAULT_REMOTE_ASSET_TIMEOUT_MS = 30000;
const DEFAULT_MAX_REMOTE_ASSET_BYTES = 100 * 1024 * 1024;
const SENSITIVE_REPORT_URL_PARAMS = SENSITIVE_ASSET_URL_PARAMS;
const REDACTED_REPORT_URL_VALUE = '[redacted]';

const shortHash = (value = '') => {
  let hash = 0x811c9dc5;
  const text = String(value);
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const shortByteHash = (bytes = new Uint8Array()) => {
  let hash = 0x811c9dc5;
  hash ^= bytes.byteLength;
  hash = Math.imul(hash, 0x01000193);
  for (let index = 0; index < bytes.byteLength; index += 1) {
    hash ^= bytes[index];
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

const bytesEqual = (left, right) => {
  if (!left || !right || left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
};

const remoteContentSignature = (bytes = new Uint8Array()) => `${bytes.byteLength}:${shortByteHash(bytes)}`;

const getCleanContentType = (value = '') => String(value || '').split(';')[0].trim().toLowerCase();

const getNumberOption = (value, defaultValue) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : defaultValue;
};

const getOfflineAssetFetchTimeoutMs = (options = {}) => (
  getNumberOption(
    options.offlineAssetFetchTimeoutMs ?? options.remoteAssetTimeoutMs,
    DEFAULT_REMOTE_ASSET_TIMEOUT_MS,
  )
);

const getOfflineAssetMaxBytes = (options = {}) => {
  const value = options.offlineAssetMaxBytes ?? options.maxRemoteAssetBytes;
  if (value === false) return Infinity;
  return getNumberOption(value, DEFAULT_MAX_REMOTE_ASSET_BYTES);
};

const getResponseHeader = (headers, name) => (
  headers?.get?.(name)
  || headers?.get?.(name.toLowerCase())
  || ''
);

const parseContentLength = (value) => {
  const normalized = String(value || '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
};

const redactSensitiveReportUrl = (url = '') => {
  const value = String(url || '');
  const hashIndex = value.indexOf('#');
  const beforeHash = hashIndex >= 0 ? value.slice(0, hashIndex) : value;
  const hash = hashIndex >= 0 ? value.slice(hashIndex) : '';
  const queryIndex = beforeHash.indexOf('?');

  if (queryIndex < 0) return value;

  const base = beforeHash.slice(0, queryIndex);
  const query = beforeHash.slice(queryIndex + 1);
  const redactedQuery = query.split('&').map((part) => {
    if (!part) return part;
    const separatorIndex = part.indexOf('=');
    const rawName = separatorIndex >= 0 ? part.slice(0, separatorIndex) : part;
    let decodedName = rawName;
    try {
      decodedName = decodeURIComponent(rawName.replace(/\+/g, ' '));
    } catch {
      decodedName = rawName;
    }
    if (!SENSITIVE_REPORT_URL_PARAMS.has(decodedName.toLowerCase())) return part;
    return `${rawName}=${REDACTED_REPORT_URL_VALUE}`;
  }).join('&');

  return `${base}?${redactedQuery}${hash}`;
};

const getRemoteAssetFailureMessage = (error, timeoutMs) => {
  if (error?.offlineAssetTimedOut) return `Remote asset request timed out after ${timeoutMs} ms.`;
  if (error?.name === 'AbortError') return 'Remote asset request was aborted.';
  return error?.message || 'Remote asset request failed.';
};

const withRemoteAssetTimeout = async (operation, { timeoutMs, controller } = {}) => {
  if (!timeoutMs || timeoutMs <= 0) return operation();

  let timeoutId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      controller?.abort?.();
      const error = new Error(`Remote asset request timed out after ${timeoutMs} ms.`);
      error.name = 'AbortError';
      error.offlineAssetTimedOut = true;
      reject(error);
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(), timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

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

const getRemoteAssetNameParts = (reference, url, contentType) => {
  const baseName = slugify(reference.preferredName || preferredNameFromUrl(url) || 'asset');
  const extension = extensionFromRemote({ contentType, url });
  const folder = reference.targetFolder || 'assets';
  return { baseName, extension, folder };
};

const getRemoteAssetNameDedupeKey = (reference, url, contentType) => {
  const { baseName, extension, folder } = getRemoteAssetNameParts(reference, url, contentType);
  return `${folder || 'assets'}/${baseName}.${extension}`;
};

const createStableRemoteAssetPath = (reference, url, contentType, usedRemotePaths, dedupeKey = url) => {
  const { baseName, extension, folder } = getRemoteAssetNameParts(reference, url, contentType);
  const hash = shortHash(dedupeKey);
  const prefix = folder ? `assets/${folder}/${baseName}-${hash}` : `assets/${baseName}-${hash}`;
  let assetPath = `${prefix}.${extension}`;
  let collisionIndex = 2;

  while (usedRemotePaths.has(assetPath) && usedRemotePaths.get(assetPath) !== dedupeKey) {
    assetPath = `${prefix}-${collisionIndex}.${extension}`;
    collisionIndex += 1;
  }

  usedRemotePaths.set(assetPath, dedupeKey);
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
const ASSET_LIBRARY_URL_PATH_PATTERN = /^assets\[(\d+)\]\.url$/;
const MEDIA_ASSET_ID_FIELD_PATTERN = /(?:asset|src|image|background|music|sound|audio|video|model|portrait|popup|ambient|object|hero|enemy|effect).*id$/i;

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

export const isLegacyStandaloneAssetReference = (reference) => {
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

const getAssetLibraryIndex = (path = '') => {
  const match = ASSET_LIBRARY_URL_PATH_PATTERN.exec(path);
  return match ? Number(match[1]) : null;
};

const collectReferencedAssetIds = (value, knownAssetIds, usedAssetIds = new Set(), seen = new Set(), isRoot = true) => {
  if (!value || typeof value !== 'object' || seen.has(value) || !knownAssetIds.size) return usedAssetIds;
  seen.add(value);

  Object.entries(value).forEach(([key, entry]) => {
    if (isRoot && key === 'assets' && Array.isArray(entry)) return;
    if (
      typeof entry === 'string'
      && knownAssetIds.has(entry)
      && MEDIA_ASSET_ID_FIELD_PATTERN.test(key)
    ) {
      usedAssetIds.add(entry);
      return;
    }
    collectReferencedAssetIds(entry, knownAssetIds, usedAssetIds, seen, false);
  });

  return usedAssetIds;
};

const remoteDedupeKeyForReferenceValue = (value = '') => {
  const url = String(value || '').trim();
  return url ? getRemoteAssetDedupeKey(url) || url : '';
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
  const dataUrlAssetPaths = new Map();
  const usedRemotePaths = new Map();
  const remoteAssetCache = new Map();
  const remoteContentAssetCache = new Map();
  const remoteNameAssetCache = new Map();
  const offlineWarnings = [];
  const exportOfflineAssets = options.exportOfflineAssets === true;
  const offlineAssetFetchTimeoutMs = getOfflineAssetFetchTimeoutMs(options);
  const offlineAssetMaxBytes = getOfflineAssetMaxBytes(options);
  let bundledCount = 0;
  let onlineCount = 0;
  const references = collectExportAssets(nextProject, { includeEmpty: false, dedupe: false });
  const knownAssetIds = new Set((Array.isArray(nextProject.assets) ? nextProject.assets : [])
    .map((asset) => asset?.id)
    .filter(Boolean));
  const referencedAssetIds = collectReferencedAssetIds(nextProject, knownAssetIds);
  const activeRemoteAssetKeys = new Set();
  const activeDataAssetValues = new Set();

  references.forEach((reference) => {
    if (!isLegacyStandaloneAssetReference(reference)) return;
    if (getAssetLibraryIndex(reference.path) !== null) return;
    if (reference.sourceKind === EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL) {
      const dedupeKey = remoteDedupeKeyForReferenceValue(reference.value);
      if (dedupeKey) activeRemoteAssetKeys.add(dedupeKey);
      return;
    }
    if (reference.sourceKind === EXPORT_ASSET_SOURCE_KINDS.DATA_URL) {
      activeDataAssetValues.add(reference.value);
    }
  });

  const uniqueAssetPath = (folder, preferredName, mimeType) => {
    const baseName = slugify(preferredName || 'asset');
    const extension = extensionFromMime(mimeType);
    const prefix = folder ? `assets/${folder}/${baseName}` : `assets/${baseName}`;
    const count = usedPaths.get(prefix) || 0;
    usedPaths.set(prefix, count + 1);
    return count === 0 ? `${prefix}.${extension}` : `${prefix}-${count + 1}.${extension}`;
  };

  const shouldExportReference = (reference) => {
    if (!isLegacyStandaloneAssetReference(reference)) return false;

    const assetIndex = getAssetLibraryIndex(reference.path);
    if (assetIndex === null) return true;

    const asset = Array.isArray(nextProject.assets) ? nextProject.assets[assetIndex] : null;
    if (!asset) return false;
    if (asset.id && referencedAssetIds.has(asset.id)) return true;

    if (reference.sourceKind === EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL) {
      const dedupeKey = remoteDedupeKeyForReferenceValue(reference.value);
      return Boolean(dedupeKey && activeRemoteAssetKeys.has(dedupeKey));
    }

    if (reference.sourceKind === EXPORT_ASSET_SOURCE_KINDS.DATA_URL) {
      return activeDataAssetValues.has(reference.value);
    }

    return false;
  };

  const exportCollectedMediaReference = (reference) => {
    if (!shouldExportReference(reference)) return;
    if (reference.sourceKind !== EXPORT_ASSET_SOURCE_KINDS.DATA_URL) return;

    const slot = getReferenceSlot(nextProject, reference.path);
    const value = slot?.value;
    if (!value || typeof value !== 'string' || !value.startsWith('data:')) return;

    const existingAssetPath = dataUrlAssetPaths.get(value);
    if (existingAssetPath) {
      slot.target[slot.key] = existingAssetPath;
      return;
    }

    const parsed = dataUrlToBytes(value);
    if (!parsed) return;

    const assetPath = uniqueAssetPath(reference.targetFolder, reference.preferredName, parsed.mimeType);
    zip.file(assetPath, parsed.bytes);
    dataUrlAssetPaths.set(value, assetPath);
    bundledCount += 1;
    slot.target[slot.key] = assetPath;
  };

  const collectRemoteReference = (groups, reference) => {
    if (!shouldExportReference(reference)) return;
    if (reference.sourceKind !== EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL) return;
    const slot = getReferenceSlot(nextProject, reference.path);
    const url = typeof slot?.value === 'string' ? slot.value.trim() : '';
    if (!url) return;
    const dedupeKey = remoteDedupeKeyForReferenceValue(url);

    const existing = groups.get(dedupeKey);
    if (existing) {
      existing.references.push(reference);
      if (!existing.urls.includes(url)) existing.urls.push(url);
      return;
    }

    groups.set(dedupeKey, {
      dedupeKey,
      url,
      urls: [url],
      references: [reference],
    });
  };

  const getBundledRemoteContentAsset = (bytes) => {
    const signature = remoteContentSignature(bytes);
    const candidates = remoteContentAssetCache.get(signature) || [];
    return candidates.find((candidate) => bytesEqual(candidate.bytes, bytes))?.result || null;
  };

  const rememberBundledRemoteContentAsset = (bytes, result) => {
    const signature = remoteContentSignature(bytes);
    const candidates = remoteContentAssetCache.get(signature) || [];
    candidates.push({ bytes, result });
    remoteContentAssetCache.set(signature, candidates);
  };

  const addOfflineWarning = ({ url, references, message, status = null }) => {
    onlineCount += 1;
    offlineWarnings.push({
      url: redactSensitiveReportUrl(url),
      paths: references.map((reference) => reference.path),
      message,
      ...(status === null || status === undefined ? {} : { status }),
    });
  };

  const fetchRemoteAsset = async (group) => {
    const cacheKey = group.dedupeKey || group.url;
    if (remoteAssetCache.has(cacheKey)) return remoteAssetCache.get(cacheKey);

    if (typeof fetch !== 'function') {
      addOfflineWarning({
        url: group.url,
        references: group.references,
        message: 'fetch is not available in this environment.',
      });
      remoteAssetCache.set(cacheKey, null);
      return null;
    }

    const controller = typeof AbortController === 'function'
      ? new AbortController()
      : null;

    try {
      const downloadedAsset = await withRemoteAssetTimeout(async () => {
        const response = await fetch(group.url, controller ? { signal: controller.signal } : undefined);
        if (!response?.ok) {
          return {
            warning: {
              status: response?.status ?? null,
              message: response?.statusText || 'Remote asset request failed.',
            },
          };
        }

        const contentLength = parseContentLength(getResponseHeader(response.headers, 'Content-Length'));
        if (contentLength !== null && contentLength > offlineAssetMaxBytes) {
          return {
            warning: {
              message: `Remote asset is too large (${contentLength} bytes, limit ${offlineAssetMaxBytes} bytes).`,
            },
          };
        }

        return {
          bytes: new Uint8Array(await response.arrayBuffer()),
          contentType: getResponseHeader(response.headers, 'Content-Type'),
        };
      }, { timeoutMs: offlineAssetFetchTimeoutMs, controller });

      if (downloadedAsset?.warning) {
        addOfflineWarning({
          url: group.url,
          references: group.references,
          ...downloadedAsset.warning,
        });
        remoteAssetCache.set(cacheKey, null);
        return null;
      }

      const nameDedupeKey = getRemoteAssetNameDedupeKey(
        group.references[0],
        group.url,
        downloadedAsset.contentType,
      );
      const existingNamedAsset = remoteNameAssetCache.get(nameDedupeKey);
      if (existingNamedAsset) {
        remoteAssetCache.set(cacheKey, existingNamedAsset);
        return existingNamedAsset;
      }

      const existingContentAsset = getBundledRemoteContentAsset(downloadedAsset.bytes);
      if (existingContentAsset) {
        remoteNameAssetCache.set(nameDedupeKey, existingContentAsset);
        remoteAssetCache.set(cacheKey, existingContentAsset);
        return existingContentAsset;
      }

      const assetPath = createStableRemoteAssetPath(
        group.references[0],
        group.url,
        downloadedAsset.contentType,
        usedRemotePaths,
        cacheKey,
      );
      zip.file(assetPath, downloadedAsset.bytes);
      bundledCount += 1;

      const result = { assetPath };
      remoteNameAssetCache.set(nameDedupeKey, result);
      rememberBundledRemoteContentAsset(downloadedAsset.bytes, result);
      remoteAssetCache.set(cacheKey, result);
      return result;
    } catch (error) {
      addOfflineWarning({
        url: group.url,
        references: group.references,
        message: getRemoteAssetFailureMessage(error, offlineAssetFetchTimeoutMs),
      });
      remoteAssetCache.set(cacheKey, null);
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
