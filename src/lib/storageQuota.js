import { collectProjectAssetManifest, collectProjectAssets } from './assetManager';
import { getRemoteAssetDedupeKey } from '../utils/mediaDedupe';

export const MB = 1024 * 1024;
export const ACCOUNT_FREE_STORAGE_BYTES = 250 * MB;

export const STORAGE_PACK_TIERS = [
  { credits: 100, bytes: 500 * MB, label: '~500 Mo' },
  { credits: 250, bytes: 1.25 * 1024 * MB, label: '~1.25 Go' },
  { credits: 500, bytes: 2.5 * 1024 * MB, label: '~2.5 Go' },
  { credits: 1000, bytes: 5 * 1024 * MB, label: '~5 Go' },
];

const REMOTE_URL_PATTERN = /^(?:https?:)?\/\//i;

export const formatStorageSize = (bytes = 0) => {
  const safeBytes = Math.max(0, Number(bytes) || 0);
  if (safeBytes >= 1024 * MB) {
    return `${(safeBytes / (1024 * MB)).toFixed(safeBytes >= 10 * 1024 * MB ? 0 : 2).replace(/\.00$/, '')} Go`;
  }
  if (safeBytes > 0 && safeBytes < MB) return '< 0,1 Mo';
  if (safeBytes < 10 * MB) return `${(safeBytes / MB).toFixed(1).replace('.', ',')} Mo`;
  return `${Math.round(safeBytes / MB)} Mo`;
};

export const getStorageQuotaBytes = ({ storageQuotaBytes = 0, storagePackCredits = 0 } = {}) => {
  const explicitQuota = Number(storageQuotaBytes) || 0;
  if (explicitQuota > 0) return explicitQuota;
  const credits = Number(storagePackCredits) || 0;
  const tier = [...STORAGE_PACK_TIERS].reverse().find((entry) => credits >= entry.credits);
  return tier?.bytes || ACCOUNT_FREE_STORAGE_BYTES;
};

const estimateDataUrlBytes = (url = '') => {
  const value = String(url || '');
  const commaIndex = value.indexOf(',');
  if (!value.startsWith('data:') || commaIndex < 0) return 0;
  const payload = value.slice(commaIndex + 1);
  if (!/;base64[,;]/i.test(value.slice(0, commaIndex + 1))) {
    try {
      return new Blob([decodeURIComponent(payload)]).size;
    } catch {
      return new Blob([payload]).size;
    }
  }
  const compactPayload = payload.replace(/\s/g, '');
  const padding = compactPayload.endsWith('==') ? 2 : compactPayload.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((compactPayload.length * 3) / 4) - padding);
};

export const getAssetStorageBytes = (asset = {}) => (
  Math.max(0, Number(asset.size) || Number(asset.bytes) || estimateDataUrlBytes(asset.url))
);

const getStorageAssetDedupeKey = (asset = {}) => {
  const url = asset.url || asset.src || asset.data || '';
  if (!url) return '';
  return REMOTE_URL_PATTERN.test(url) ? getRemoteAssetDedupeKey(url) || url : url;
};

export const getExactAssetStorageBytes = async (asset = {}) => {
  const knownBytes = getAssetStorageBytes(asset);
  if (knownBytes > 0) return knownBytes;

  const url = asset.url || asset.src || asset.data || '';
  if (!url || String(url).startsWith('data:')) return 0;

  try {
    const headResponse = await fetch(url, { method: 'HEAD' });
    const contentLength = Number(headResponse.headers.get('content-length'));
    if (headResponse.ok && contentLength > 0) return contentLength;
  } catch {
    // Some storage providers block HEAD; fetch the blob below as the exact fallback.
  }

  try {
    const response = await fetch(url);
    if (!response.ok) return 0;
    return (await response.blob()).size;
  } catch {
    return 0;
  }
};

const getProjectStorageAssets = (project = {}, { includeLegacyFields = false } = {}) => {
  const manifestAssets = collectProjectAssetManifest(project);
  if (manifestAssets.length && !includeLegacyFields) return manifestAssets;
  return collectProjectAssets(project);
};

export const getAccountStorageUsageBytes = (projects = [], options = {}) => {
  const seenAssetKeys = new Set();
  return projects.reduce((total, projectRecordOrData) => {
    const project = projectRecordOrData?.data || projectRecordOrData || {};
    return total + getProjectStorageAssets(project, options).reduce((projectTotal, asset) => {
      const assetKey = getStorageAssetDedupeKey(asset);
      if (!assetKey || seenAssetKeys.has(assetKey)) return projectTotal;
      seenAssetKeys.add(assetKey);
      return projectTotal + getAssetStorageBytes(asset);
    }, 0);
  }, 0);
};

const getUniqueStorageAssets = (projects = [], options = {}) => {
  const assets = [];
  const seenAssetKeys = new Set();
  projects.forEach((projectRecordOrData) => {
    const project = projectRecordOrData?.data || projectRecordOrData || {};
    getProjectStorageAssets(project, options).forEach((asset) => {
      const assetKey = getStorageAssetDedupeKey(asset);
      if (!assetKey || seenAssetKeys.has(assetKey)) return;
      seenAssetKeys.add(assetKey);
      assets.push(asset);
    });
  });
  return assets;
};

export const getAccountExactStorageAssetSizes = async (projects = [], options = {}) => {
  const entries = await Promise.all(getUniqueStorageAssets(projects, options).map(async (asset) => ([
    asset.url,
    await getExactAssetStorageBytes(asset),
  ])));
  return new Map(entries.filter(([, size]) => Number(size) > 0));
};

export const getAccountExactStorageUsageBytes = async (projects = [], options = {}) => {
  const sizesByUrl = await getAccountExactStorageAssetSizes(projects, options);
  return [...sizesByUrl.values()].reduce((total, size) => total + (Number(size) || 0), 0);
};
