import { buildStoragePath, downloadTextFile, hasSupabaseConfig, uploadToStorage } from '../supabaseStorage';

const SHOP_PACKS_KEY = 'escapeGameBuilder.shopPacks.v1';
const SHOP_PACKS_STORAGE_PATH = buildStoragePath('public', 'shop-packs.json');
const SHOP_PACKS_PUBLIC_MANIFEST = '/boutique/shop-packs.json';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

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

export function getShopPacks() {
  if (!canUseStorage()) return [];
  return safeParse(window.localStorage.getItem(SHOP_PACKS_KEY), []).map(normalizeShopPack);
}

export function saveShopPacks(packs = []) {
  const nextPacks = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
  if (canUseStorage()) {
    window.localStorage.setItem(SHOP_PACKS_KEY, JSON.stringify(nextPacks));
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
    return Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
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

export async function loadSharedShopPacks() {
  if (!hasSupabaseConfig()) {
    const bundled = await loadBundledShopPacks();
    const local = getShopPacks();
    return mergeShopPacks(local, bundled);
  }

  try {
    const bundled = await loadBundledShopPacks();
    const text = await downloadTextFile(SHOP_PACKS_STORAGE_PATH);
    const packs = safeParse(text, []);
    const normalized = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
    const merged = mergeShopPacks(normalized, bundled);
    if (canUseStorage()) window.localStorage.setItem(SHOP_PACKS_KEY, JSON.stringify(merged));
    return merged;
  } catch (error) {
    const message = String(error?.message || '');
    const isMissingFile = /not found|object not found|status code 400|status code 404/i.test(message);
    if (isMissingFile) return mergeShopPacks(getShopPacks(), await loadBundledShopPacks());
    throw error;
  }
}

export async function saveSharedShopPacks(packs = []) {
  const normalized = saveShopPacks(packs);
  if (!hasSupabaseConfig()) return normalized;

  const blob = new Blob([JSON.stringify(normalized, null, 2)], { type: 'application/json' });
  await uploadToStorage(SHOP_PACKS_STORAGE_PATH, blob, {
    contentType: 'application/json',
    cacheControl: '0',
  });
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
  const existing = await loadSharedShopPacks();
  return saveSharedShopPacks(existing.filter((entry) => entry.id !== packId));
}

export async function updateSharedShopPackStatus(packId, patch = {}) {
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
