import { EXPORT_ASSET_SOURCE_KINDS, collectExportAssets } from './exportAssetCollector';
import { isLegacyStandaloneAssetReference } from './exportAssetBundler';
import {
  REMOTE_MEDIA_URL_KEYS,
  REMOTE_URL_PATTERN,
  getKnownAssetByteSize,
  getKnownAssetDuplicateName,
  getKnownDuplicateMediaKey,
  getReferenceDuplicateMediaKey,
  getRemoteAssetDedupeKey,
} from './mediaDedupe';

const ONE_MIB = 1024 * 1024;

const ASSET_LIBRARY_URL_PATH_PATTERN = /^assets\[(\d+)\]\.url$/;
const MEDIA_ASSET_ID_FIELDS = new Set([
  'assetId',
  'srcId',
  'imageId',
  'backgroundId',
  'musicId',
  'ambientSoundId',
  'objectImageId',
  'secondObjectImageId',
  'popupImageId',
  'soundId',
  'successSoundId',
  'failureSoundId',
  'videoId',
  'audioId',
  'popupBackgroundId',
]);
const getReferenceDuplicateNameKey = (reference = {}) => {
  return getReferenceDuplicateMediaKey({
    mediaType: reference.mediaType,
    name: reference.preferredName,
  });
};

const setKnownRemoteByteSize = (sizes, url, byteSize) => {
  if (!url || byteSize <= 0) return;
  if (!sizes.has(url)) sizes.set(url, byteSize);
  const dedupeKey = getRemoteAssetDedupeKey(url);
  if (dedupeKey && !sizes.has(dedupeKey)) sizes.set(dedupeKey, byteSize);
};

const knownByteSizeFromObject = getKnownAssetByteSize;

const collectKnownRemoteByteSizes = (value, sizes = new Map(), seen = new Set()) => {
  if (!value || typeof value !== 'object' || seen.has(value)) return sizes;
  seen.add(value);

  if (!Array.isArray(value)) {
    const byteSize = knownByteSizeFromObject(value);
    if (byteSize > 0) {
      Object.values(value).forEach((entry) => {
        if (typeof entry !== 'string') return;
        const url = entry.trim();
        if (REMOTE_URL_PATTERN.test(url)) {
          setKnownRemoteByteSize(sizes, url, byteSize);
        }
      });
    }
  }

  Object.values(value).forEach((entry) => {
    collectKnownRemoteByteSizes(entry, sizes, seen);
  });

  return sizes;
};

const collectKnownRemoteByteSizesFromAssets = (assets = [], sizes = new Map()) => {
  if (!Array.isArray(assets)) return sizes;

  assets.forEach((asset) => {
    if (!asset || typeof asset !== 'object') return;
    const byteSize = knownByteSizeFromObject(asset);
    if (byteSize <= 0) return;

    REMOTE_MEDIA_URL_KEYS.forEach((key) => {
      const url = typeof asset[key] === 'string' ? asset[key].trim() : '';
      if (REMOTE_URL_PATTERN.test(url)) {
        setKnownRemoteByteSize(sizes, url, byteSize);
      }
    });

    if (Array.isArray(asset.urls)) {
      asset.urls.forEach((entry) => {
        const url = typeof entry === 'string' ? entry.trim() : '';
        if (REMOTE_URL_PATTERN.test(url)) {
          setKnownRemoteByteSize(sizes, url, byteSize);
        }
      });
    }
  });

  return sizes;
};

const collectKnownRemoteDuplicateKeysFromAssets = (assets = [], keys = new Map()) => {
  if (!Array.isArray(assets)) return keys;

  assets.forEach((asset) => {
    if (!asset || typeof asset !== 'object') return;
    const byteSize = knownByteSizeFromObject(asset);
    if (byteSize <= 0) return;

    const mediaKey = getKnownDuplicateMediaKey({
      mediaType: asset.type || asset.kind || '',
      name: getKnownAssetDuplicateName(asset),
      byteSize,
    });
    if (!mediaKey) return;

    REMOTE_MEDIA_URL_KEYS.forEach((key) => {
      const url = typeof asset[key] === 'string' ? asset[key].trim() : '';
      if (!REMOTE_URL_PATTERN.test(url)) return;
      if (!keys.has(url)) keys.set(url, mediaKey);
      const dedupeKey = getRemoteAssetDedupeKey(url);
      if (dedupeKey && !keys.has(dedupeKey)) keys.set(dedupeKey, mediaKey);
    });

    if (Array.isArray(asset.urls)) {
      asset.urls.forEach((entry) => {
        const url = typeof entry === 'string' ? entry.trim() : '';
        if (!REMOTE_URL_PATTERN.test(url)) return;
        if (!keys.has(url)) keys.set(url, mediaKey);
        const dedupeKey = getRemoteAssetDedupeKey(url);
        if (dedupeKey && !keys.has(dedupeKey)) keys.set(dedupeKey, mediaKey);
      });
    }
  });

  return keys;
};

const collectUsedAssetIds = (value, usedAssetIds = new Set(), seen = new Set()) => {
  if (!value || typeof value !== 'object' || seen.has(value)) return usedAssetIds;
  seen.add(value);

  Object.entries(value).forEach(([key, entry]) => {
    if (typeof entry === 'string' && MEDIA_ASSET_ID_FIELDS.has(key) && entry.trim()) {
      usedAssetIds.add(entry);
      return;
    }
    collectUsedAssetIds(entry, usedAssetIds, seen);
  });

  return usedAssetIds;
};

const isAssetLibraryReferenceUsed = (project, usedAssetIds, reference) => {
  const match = ASSET_LIBRARY_URL_PATH_PATTERN.exec(reference.path || '');
  if (!match) return true;

  const asset = Array.isArray(project?.assets) ? project.assets[Number(match[1])] : null;
  return Boolean(asset?.id && usedAssetIds.has(asset.id));
};

export const estimateDataUrlByteLength = (dataUrl) => {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(String(dataUrl || ''));
  if (!match) return 0;

  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (isBase64) {
    const normalized = payload.replace(/\s/g, '');
    const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
    return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
  }

  try {
    return new TextEncoder().encode(decodeURIComponent(payload)).byteLength;
  } catch {
    return new TextEncoder().encode(payload).byteLength;
  }
};

export const estimateOfflineExportSize = (project, options = {}) => {
  const knownAssets = options.knownAssets || options.mediaLibrary;
  const knownRemoteByteSizes = collectKnownRemoteByteSizesFromAssets(
    knownAssets,
    collectKnownRemoteByteSizes(project),
  );
  const knownRemoteDuplicateKeys = collectKnownRemoteDuplicateKeysFromAssets(knownAssets);
  const usedAssetIds = collectUsedAssetIds(project);
  const references = collectExportAssets(project, { includeEmpty: false, dedupe: false })
    .filter(isLegacyStandaloneAssetReference)
    .filter((reference) => isAssetLibraryReferenceUsed(project, usedAssetIds, reference));
  const remoteReferencesByUrl = new Map();
  const dataUrls = new Set();

  let dataUrlBytes = 0;
  let dataUrlCount = 0;

  references.forEach((reference) => {
    if (reference.sourceKind === EXPORT_ASSET_SOURCE_KINDS.DATA_URL) {
      if (dataUrls.has(reference.value)) return;
      dataUrls.add(reference.value);
      dataUrlBytes += estimateDataUrlByteLength(reference.value);
      dataUrlCount += 1;
      return;
    }

    if (reference.sourceKind !== EXPORT_ASSET_SOURCE_KINDS.REMOTE_URL) return;

    const url = String(reference.value || '').trim();
    const remoteDedupeKey = getRemoteAssetDedupeKey(url) || url;
    const knownSize = knownRemoteByteSizes.get(url) || knownRemoteByteSizes.get(remoteDedupeKey) || 0;
    const dedupeKey = knownRemoteDuplicateKeys.get(url)
      || knownRemoteDuplicateKeys.get(remoteDedupeKey)
      || getReferenceDuplicateNameKey(reference)
      || getKnownDuplicateMediaKey({
        mediaType: reference.mediaType,
        name: reference.preferredName,
        byteSize: knownSize,
        requireFileName: true,
      })
      || remoteDedupeKey;
    if (!url || remoteReferencesByUrl.has(dedupeKey)) return;
    remoteReferencesByUrl.set(dedupeKey, {
      reference,
      remoteDedupeKey,
    });
  });

  let remoteBytes = 0;
  let knownRemoteCount = 0;
  let unknownRemoteCount = 0;

  remoteReferencesByUrl.forEach(({ reference, remoteDedupeKey }, dedupeKey) => {
    const url = String(reference.value || '').trim();
    const knownSize = knownRemoteByteSizes.get(url) || knownRemoteByteSizes.get(remoteDedupeKey) || knownRemoteByteSizes.get(dedupeKey) || 0;
    if (knownSize > 0) {
      remoteBytes += knownSize;
      knownRemoteCount += 1;
      return;
    }

    unknownRemoteCount += 1;
  });

  return {
    estimatedBytes: dataUrlBytes + remoteBytes,
    dataUrlBytes,
    dataUrlCount,
    remoteBytes,
    remoteCount: remoteReferencesByUrl.size,
    knownRemoteCount,
    approximatedRemoteCount: 0,
    unknownRemoteCount,
    mediaCount: dataUrlCount + remoteReferencesByUrl.size,
  };
};

export const formatOfflineExportSizeEstimate = (bytes) => {
  const normalizedBytes = Math.max(0, Number(bytes) || 0);
  const megabytes = normalizedBytes / ONE_MIB;

  if (megabytes < 1) return 'moins de 1 Mo';

  const rounded = megabytes < 10
    ? Math.round(megabytes * 10) / 10
    : Math.round(megabytes);

  return `~${new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: megabytes < 10 ? 1 : 0,
  }).format(rounded)} Mo`;
};

export const getOfflineExportEstimateMessage = (project, options = {}) => {
  const estimate = estimateOfflineExportSize(project, options);
  if (estimate.unknownRemoteCount > 0) {
    const mediaLabel = estimate.unknownRemoteCount > 1 ? 'médias sans taille connue' : 'média sans taille connue';
    if (estimate.estimatedBytes > 0) {
      const sizeLabel = formatOfflineExportSizeEstimate(estimate.estimatedBytes);
      const prefix = estimate.estimatedBytes >= ONE_MIB ? `au moins ${sizeLabel}` : sizeLabel;
      return `Export hors ligne estimé : ${prefix} (+ ${estimate.unknownRemoteCount} ${mediaLabel})`;
    }
    return `Export hors ligne estimé : taille à confirmer (${estimate.unknownRemoteCount} ${mediaLabel})`;
  }
  return `Export hors ligne estimé : ${formatOfflineExportSizeEstimate(estimate.estimatedBytes)}`;
};
