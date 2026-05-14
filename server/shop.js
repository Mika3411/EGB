import { readJsonBody, sendJson } from './http.js';
import { verifySupabaseAdminRequest } from './auth.js';
import { downloadStorageJson, uploadStorageJson } from './storage.js';
import { getCreditAccount, resolveCreditUserId, spendCredits } from './credits.js';
import { resolveShopPackDownload, toPublicShopPackDownloadState } from './shopDownloads.js';

const shopPacksStoragePath = 'public/shop-packs.json';

const createEmptyShopPack = () => ({
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

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

const createShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeShopPack = (pack = {}) => ({
  ...createEmptyShopPack(),
  ...pack,
  id: String(pack.id || createShopPackId()).trim().replace(/[^a-zA-Z0-9._:-]/g, '-'),
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

const loadServerShopPacks = async () => {
  const packs = await downloadStorageJson(shopPacksStoragePath, []);
  return Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
};

const saveServerShopPacks = async (packs = []) => {
  const normalized = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
  await uploadStorageJson(shopPacksStoragePath, normalized);
  return normalized;
};

const shopPurchaseLocks = new Map();

const withShopPurchaseLock = async (packId, task) => {
  const previous = shopPurchaseLocks.get(packId) || Promise.resolve();
  let releaseLock;
  const current = new Promise((resolve) => {
    releaseLock = resolve;
  });
  const queued = previous.then(() => current, () => current);
  shopPurchaseLocks.set(packId, queued);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    releaseLock();
    if (shopPurchaseLocks.get(packId) === queued) {
      shopPurchaseLocks.delete(packId);
    }
  }
};

const toPublicShopPack = (pack = {}) => {
  return toPublicShopPackDownloadState(normalizeShopPack(pack));
};

const preserveExistingShopPackDownload = (incomingPack = {}, existingPack = null) => {
  if (!existingPack) return normalizeShopPack(incomingPack);
  return normalizeShopPack({
    ...incomingPack,
    downloadUrl: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadUrl')
      ? incomingPack.downloadUrl
      : existingPack.downloadUrl,
    downloadFileName: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadFileName')
      ? incomingPack.downloadFileName
      : existingPack.downloadFileName,
    downloadStoragePath: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadStoragePath')
      ? incomingPack.downloadStoragePath
      : existingPack.downloadStoragePath,
    downloadMode: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadMode')
      ? incomingPack.downloadMode
      : existingPack.downloadMode,
  });
};

export const handleShopPacks = async (req, res) => {
  if (req.method === 'GET') {
    const packs = await loadServerShopPacks();
    sendJson(res, 200, { packs: packs.map(toPublicShopPack) });
    return;
  }

  const adminUser = await verifySupabaseAdminRequest(req);
  const body = await readJsonBody(req);
  const action = String(body.action || '').trim();
  const packs = await loadServerShopPacks();

  if (action === 'replace') {
    const nextPacks = await saveServerShopPacks((Array.isArray(body.packs) ? body.packs : []).map((pack) => (
      preserveExistingShopPackDownload(pack, packs.find((entry) => entry.id === pack?.id))
    )));
    sendJson(res, 200, { packs: nextPacks, admin: adminUser.email || '' });
    return;
  }

  if (action === 'upsert') {
    const rawPack = body.pack || {};
    const pack = preserveExistingShopPackDownload(rawPack, packs.find((entry) => entry.id === rawPack?.id));
    if (!pack.title) {
      sendJson(res, 400, { error: 'Nom du pack manquant.' });
      return;
    }
    const nextPacks = await saveServerShopPacks([
      pack,
      ...packs.filter((entry) => entry.id !== pack.id),
    ]);
    sendJson(res, 200, { packs: nextPacks, pack, admin: adminUser.email || '' });
    return;
  }

  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  if (!packId) {
    sendJson(res, 400, { error: 'Pack manquant.' });
    return;
  }

  if (action === 'delete') {
    sendJson(res, 200, { packs: await saveServerShopPacks(packs.filter((entry) => entry.id !== packId)) });
    return;
  }

  if (action === 'archive' || action === 'relist') {
    const now = new Date().toISOString();
    const nextPacks = await saveServerShopPacks(packs.map((pack) => {
      if (pack.id !== packId) return pack;
      return action === 'archive'
        ? normalizeShopPack({
          ...pack,
          archived: true,
          archivedAt: body.archivedAt || now,
          archivedReason: body.archivedReason || 'admin',
          soldAt: body.soldAt || pack.soldAt || '',
          soldTo: body.soldTo || pack.soldTo || '',
        })
        : normalizeShopPack({
          ...pack,
          archived: false,
          archivedAt: '',
          archivedReason: '',
          soldAt: '',
          soldTo: '',
        });
    }));
    sendJson(res, 200, { packs: nextPacks });
    return;
  }

  sendJson(res, 400, { error: 'Action boutique inconnue.' });
};

export const handleShopPurchase = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');

  if (!packId) {
    sendJson(res, 400, { error: 'Pack manquant.' });
    return;
  }
  if (!userId || userId === 'anonymous') {
    sendJson(res, 400, { error: 'Utilisateur manquant.' });
    return;
  }

  await withShopPurchaseLock(packId, async () => {
    const packs = await loadServerShopPacks();
    const pack = packs.find((entry) => entry.id === packId);
    if (!pack || pack.archived) {
      sendJson(res, 404, { error: 'Pack indisponible.' });
      return;
    }
    const download = await resolveShopPackDownload(pack);
    if (!download?.downloadUrl) {
      sendJson(res, 400, { error: 'Pack sans fichier telechargeable.' });
      return;
    }

    const costCredits = Math.max(0, Math.round(Number(pack.costCredits || 0)));
    const title = String(pack.title || 'Pack boutique').trim().slice(0, 120);
    if (!costCredits) {
      sendJson(res, 400, { error: 'Cout en credits invalide.' });
      return;
    }

    const accountBeforePurchase = getCreditAccount(userId);
    if (Number(accountBeforePurchase.balance || 0) < costCredits) {
      sendJson(res, 402, {
        error: `Credits IA insuffisants (${accountBeforePurchase.balance || 0}/${costCredits}).`,
        balance: accountBeforePurchase.balance || 0,
        required: costCredits,
      });
      return;
    }

    const purchasedAt = new Date().toISOString();
    const nextPacks = packs.map((entry) => (
      entry.id === packId ? normalizeShopPack({
        ...entry,
        archived: true,
        archivedAt: purchasedAt,
        archivedReason: 'sold',
        soldAt: purchasedAt,
        soldTo: userId,
      }) : entry
    ));
    await saveServerShopPacks(nextPacks);

    let account;
    try {
      account = spendCredits(userId, costCredits, `shop_pack:${packId}:${title}`);
    } catch (error) {
      await saveServerShopPacks(packs);
      throw error;
    }

    sendJson(res, 200, {
      ok: true,
      purchase: {
        packId,
        title,
        costCredits,
        downloadUrl: download.downloadUrl,
        downloadFileName: pack.downloadFileName || `${title || 'pack'}.zip`,
        purchasedAt,
      },
      balance: account.balance || 0,
    });
  });
};
