import { readJsonBody, sendJson } from './http.js';
import { verifySupabaseAdminRequest } from './auth.js';
import { downloadStorageJson, uploadStorageJson } from './storage.js';
import { getSupabaseAdminClient } from './supabase.js';
import { getCreditAccount, resolveCreditUserId, spendCredits } from './credits.js';
import { resolveShopPackDownload, toPublicShopPackDownloadState } from './shopDownloads.js';

const shopPacksStoragePath = 'public/shop-packs.json';
const soldShopPackStatuses = ['pending', 'paid'];
const missingShopSalesTablePattern = /shop_pack_sales|schema cache|relation .* does not exist|could not find the table/i;

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

export const loadSoldShopPackIds = async (supabase) => {
  const { data, error } = await supabase
    .from('shop_pack_sales')
    .select('pack_id')
    .in('status', soldShopPackStatuses);
  if (error) {
    const code = String(error.code || '').toUpperCase();
    const message = String(error.message || error.details || error.hint || '').toLowerCase();
    if (code === 'PGRST205' || code === '42P01' || missingShopSalesTablePattern.test(message)) {
      return new Set();
    }
    throw error;
  }
  return new Set((data || []).map((entry) => entry.pack_id).filter(Boolean));
};

export const applySoldShopPackState = (packs = [], soldPackIds = new Set()) => packs.map((pack) => (
  soldPackIds.has(pack.id)
    ? normalizeShopPack({
      ...pack,
      archived: true,
      archivedReason: pack.archivedReason || 'sold',
    })
    : pack
));

const loadVisibleServerShopPacks = async (supabase = getSupabaseAdminClient()) => {
  const packs = await loadServerShopPacks();
  if (!supabase) return packs;
  return applySoldShopPackState(packs, await loadSoldShopPackIds(supabase));
};

const deleteShopPackSale = async (supabase, packId) => {
  if (!supabase) return;
  const { error } = await supabase
    .from('shop_pack_sales')
    .delete()
    .eq('pack_id', packId);
  if (error) throw error;
};

export const purchaseShopPack = async (supabase, {
  packId,
  userId,
  title,
  costCredits,
  downloadFileName,
}) => {
  const { data, error } = await supabase
    .rpc('purchase_shop_pack', {
      p_pack_id: packId,
      p_user_id: userId,
      p_title: title,
      p_cost_credits: costCredits,
      p_download_file_name: downloadFileName,
    })
    .single();

  if (error?.code === '23505') {
    const soldError = new Error('Pack indisponible.');
    soldError.status = 404;
    soldError.statusCode = 404;
    throw soldError;
  }
  if (error?.message?.includes('Credits IA insuffisants')) {
    const creditError = new Error(error.message);
    creditError.status = 402;
    creditError.statusCode = 402;
    throw creditError;
  }
  if (error) throw error;
  return data;
};

const preserveExistingShopPackDownload = (incomingPack = {}, existingPack = null) => {
  if (!existingPack) return normalizeShopPack(incomingPack);
  const hasIncomingDownload = Boolean(
    String(incomingPack.downloadUrl || '').trim()
    || String(incomingPack.downloadStoragePath || '').trim()
  );
  return normalizeShopPack({
    ...incomingPack,
    downloadUrl: hasIncomingDownload && Object.prototype.hasOwnProperty.call(incomingPack, 'downloadUrl')
      ? incomingPack.downloadUrl
      : existingPack.downloadUrl,
    downloadFileName: hasIncomingDownload && Object.prototype.hasOwnProperty.call(incomingPack, 'downloadFileName')
      ? incomingPack.downloadFileName
      : existingPack.downloadFileName,
    downloadStoragePath: hasIncomingDownload && Object.prototype.hasOwnProperty.call(incomingPack, 'downloadStoragePath')
      ? incomingPack.downloadStoragePath
      : existingPack.downloadStoragePath,
    downloadMode: hasIncomingDownload && Object.prototype.hasOwnProperty.call(incomingPack, 'downloadMode')
      ? incomingPack.downloadMode
      : existingPack.downloadMode,
    downloadStorageBucket: hasIncomingDownload && Object.prototype.hasOwnProperty.call(incomingPack, 'downloadStorageBucket')
      ? incomingPack.downloadStorageBucket
      : existingPack.downloadStorageBucket,
  });
};

export const handleShopPacks = async (req, res) => {
  if (req.method === 'GET') {
    const packs = await loadVisibleServerShopPacks();
    sendJson(res, 200, { packs: packs.map(toPublicShopPack) });
    return;
  }

  const supabase = getSupabaseAdminClient();
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
    await deleteShopPackSale(supabase, packId);
    sendJson(res, 200, { packs: await saveServerShopPacks(packs.filter((entry) => entry.id !== packId)) });
    return;
  }

  if (action === 'archive' || action === 'relist') {
    if (action === 'relist') await deleteShopPackSale(supabase, packId);
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

const handleSupabaseShopPurchase = async ({ supabase, packId, userId, res }) => {
  const packs = await loadVisibleServerShopPacks(supabase);
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
  const downloadFileName = pack.downloadFileName || `${title || 'pack'}.zip`;
  if (!costCredits) {
    sendJson(res, 400, { error: 'Cout en credits invalide.' });
    return;
  }

  const purchaseResult = await purchaseShopPack(supabase, {
    packId,
    userId,
    title,
    costCredits,
    downloadFileName,
  });

  sendJson(res, 200, {
    ok: true,
    purchase: {
      packId,
      title,
      costCredits,
      downloadUrl: download.downloadUrl,
      downloadFileName,
      purchasedAt: purchaseResult.purchased_at,
    },
    balance: Number(purchaseResult.balance || 0),
  });
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

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    await handleSupabaseShopPurchase({ supabase, packId, userId, res });
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

    const accountBeforePurchase = await getCreditAccount(userId);
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
      account = await spendCredits(userId, costCredits, `shop_pack:${packId}:${title}`);
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
