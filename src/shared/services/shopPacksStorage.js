import {
  getSupabaseAuthHeaders,
  hasRemoteSupabaseConfig,
} from './remoteSession';
import { readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const SHOP_PACKS_KEY = 'escapeGameBuilder.shopPacks.v1';
const SHOP_PACKS_PUBLIC_MANIFEST = '/boutique/shop-packs.json';
const SHOP_PACKS_ENDPOINT = import.meta.env.VITE_SHOP_PACKS_ENDPOINT || '/api/shop/packs';

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

export const createEmptyShopPack = () => ({
  id: '',
  title: '',
  costCredits: 50,
  description: '',
  rating: 8,
  actsCount: 1,
  scenesCount: 5,
  objectsCount: 5,
  enigmasCount: 3,
  cinematicsCount: 1,
  combinationsCount: 1,
  screenshots: [],
  downloadUrl: '',
  downloadFileName: '',
  downloadStoragePath: '',
  downloadMode: '',
  archived: false,
  archivedAt: '',
  archivedReason: '',
  soldAt: '',
  soldTo: '',
  createdAt: '',
  updatedAt: '',
});

export const normalizeShopPack = (pack = {}) => ({
  ...createEmptyShopPack(),
  ...pack,
  id: pack.id || `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
  title: String(pack.title || '').trim(),
  costCredits: normalizeNumber(pack.costCredits, 50),
  description: String(pack.description || '').trim(),
  rating: Math.min(10, normalizeNumber(pack.rating, 8)),
  actsCount: normalizeNumber(pack.actsCount, 0),
  scenesCount: normalizeNumber(pack.scenesCount, 0),
  objectsCount: normalizeNumber(pack.objectsCount, 0),
  enigmasCount: normalizeNumber(pack.enigmasCount, 0),
  cinematicsCount: normalizeNumber(pack.cinematicsCount, 0),
  combinationsCount: normalizeNumber(pack.combinationsCount, 0),
  screenshots: Array.isArray(pack.screenshots) ? pack.screenshots.filter((entry) => entry?.src) : [],
  downloadUrl: String(pack.downloadUrl || '').trim(),
  downloadFileName: String(pack.downloadFileName || '').trim(),
  downloadStoragePath: String(pack.downloadStoragePath || '').trim(),
  downloadMode: String(pack.downloadMode || '').trim(),
  archived: Boolean(pack.archived),
  archivedAt: String(pack.archivedAt || '').trim(),
  archivedReason: String(pack.archivedReason || '').trim(),
  soldAt: String(pack.soldAt || '').trim(),
  soldTo: String(pack.soldTo || '').trim(),
  createdAt: pack.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const normalizePublicShopPack = (pack = {}) => {
  const {
    downloadUrl,
    downloadStoragePath,
    ...publicPack
  } = normalizeShopPack(pack);
  return {
    ...publicPack,
    hasDownload: Boolean(downloadUrl || downloadStoragePath || pack.hasDownload),
  };
};

export function getShopPacks() {
  return readJsonStorage(SHOP_PACKS_KEY, []).map(normalizeShopPack);
}

export function saveShopPacks(packs = []) {
  const nextPacks = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
  if (writeJsonStorage(SHOP_PACKS_KEY, nextPacks)) {
    window.dispatchEvent(new CustomEvent('shop-packs-updated'));
  }
  return nextPacks;
}

async function loadBundledShopPacks() {
  if (typeof fetch !== 'function') return [];
  try {
    const response = await fetch(`${SHOP_PACKS_PUBLIC_MANIFEST}?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return [];
    const packs = await response.json();
    return Array.isArray(packs) ? packs.map(normalizePublicShopPack) : [];
  } catch {
    return [];
  }
}

const mergeShopPacks = (...groups) => {
  const byId = new Map();
  groups.flat().forEach((pack) => {
    if (!pack?.id || byId.has(pack.id)) return;
    byId.set(pack.id, pack);
  });
  return Array.from(byId.values());
};

const readJsonResponse = async (response, fallbackMessage) => {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    const status = response?.status ? `HTTP ${response.status}` : '';
    throw new Error(`${fallbackMessage}${status ? ` (${status}).` : ''}`);
  }
};

const getAdminAuthHeaders = async () => {
  return getSupabaseAuthHeaders();
};

const requestShopPacksApi = async (body) => {
  const response = await fetch(SHOP_PACKS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAdminAuthHeaders()),
    },
    body: JSON.stringify(body),
  });
  const payload = await readJsonResponse(response, 'API boutique indisponible.');
  if (!response.ok) throw new Error(payload.error || 'Operation boutique impossible.');
  const packs = Array.isArray(payload.packs) ? payload.packs.map(normalizeShopPack) : [];
  writeJsonStorage(SHOP_PACKS_KEY, packs);
  window.dispatchEvent(new CustomEvent('shop-packs-updated'));
  return packs;
};

export async function loadSharedShopPacks() {
  if (typeof fetch === 'function') {
    try {
      const response = await fetch(`${SHOP_PACKS_ENDPOINT}?v=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) {
        const payload = await readJsonResponse(response, 'API boutique indisponible.');
        const apiPacks = Array.isArray(payload.packs) ? payload.packs.map(normalizePublicShopPack) : [];
        const merged = mergeShopPacks(apiPacks, await loadBundledShopPacks());
        writeJsonStorage(SHOP_PACKS_KEY, merged);
        return merged;
      }
    } catch {
      // Fallback local ci-dessous pour le mode dev/offline.
    }
  }

  const bundled = await loadBundledShopPacks();
  if (hasRemoteSupabaseConfig()) return bundled;

  if (!hasRemoteSupabaseConfig()) {
    const local = getShopPacks();
    return mergeShopPacks(local, bundled);
  }
}

export async function saveSharedShopPacks(packs = []) {
  if (hasRemoteSupabaseConfig()) {
    const normalized = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
    const response = await fetch(SHOP_PACKS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAdminAuthHeaders()),
      },
      body: JSON.stringify({ action: 'replace', packs: normalized }),
    });
    if (response.ok) {
      const payload = await readJsonResponse(response, 'API boutique indisponible.');
      return Array.isArray(payload.packs) ? saveShopPacks(payload.packs) : normalized;
    }
    const payload = await readJsonResponse(response, 'API boutique indisponible.');
    throw new Error(payload.error || 'API boutique indisponible.');
  }

  const normalized = saveShopPacks(packs);
  return normalized;
}

export function upsertShopPack(pack) {
  const normalized = normalizeShopPack(pack);
  const existing = getShopPacks();
  const nextPacks = [
    normalized,
    ...existing.filter((entry) => entry.id !== normalized.id),
  ];
  return saveShopPacks(nextPacks);
}

export async function upsertSharedShopPack(pack) {
  if (hasRemoteSupabaseConfig()) return requestShopPacksApi({ action: 'upsert', pack });

  const normalized = normalizeShopPack(pack);
  const existing = await loadSharedShopPacks();
  return saveSharedShopPacks([
    normalized,
    ...existing.filter((entry) => entry.id !== normalized.id),
  ]);
}

export function deleteShopPack(packId) {
  return saveShopPacks(getShopPacks().filter((entry) => entry.id !== packId));
}

export async function deleteSharedShopPack(packId) {
  if (hasRemoteSupabaseConfig()) return requestShopPacksApi({ action: 'delete', packId });

  const existing = await loadSharedShopPacks();
  return saveSharedShopPacks(existing.filter((entry) => entry.id !== packId));
}

export async function updateSharedShopPackStatus(packId, patch = {}) {
  if (hasRemoteSupabaseConfig()) {
    const action = patch.archived === false ? 'relist' : 'archive';
    return requestShopPacksApi({ action, packId, ...patch });
  }

  const existing = await loadSharedShopPacks();
  return saveSharedShopPacks(existing.map((pack) => (
    pack.id === packId ? normalizeShopPack({ ...pack, ...patch }) : pack
  )));
}

export const archiveSharedShopPack = (packId, options = {}) => updateSharedShopPackStatus(packId, {
  archived: true,
  archivedAt: options.archivedAt || new Date().toISOString(),
  archivedReason: options.archivedReason || 'sold',
  soldAt: options.soldAt || new Date().toISOString(),
  soldTo: options.soldTo || '',
});

export const relistSharedShopPack = (packId) => updateSharedShopPackStatus(packId, {
  archived: false,
  archivedAt: '',
  archivedReason: '',
  soldAt: '',
  soldTo: '',
});
