import {
  aiJobBucket,
  getSupabaseAdminClient,
  json,
  parseBody,
  verifyAdmin,
  withErrors,
} from './_shared.js';

const shopPacksStoragePath = 'public/shop-packs.json';

const createShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

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

const toPublicShopPack = (pack = {}) => {
  const {
    downloadUrl,
    downloadStoragePath,
    ...publicPack
  } = normalizeShopPack(pack);
  return {
    ...publicPack,
    hasDownload: Boolean(downloadUrl || downloadStoragePath),
  };
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

const loadShopPacks = async (supabase) => {
  const { data, error } = await supabase.storage.from(aiJobBucket).download(shopPacksStoragePath);
  if (error) throw error;
  const packs = JSON.parse(await data.text());
  return Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
};

const loadSoldShopPackIds = async (supabase) => {
  const { data, error } = await supabase
    .from('shop_pack_sales')
    .select('pack_id')
    .in('status', ['pending', 'paid']);
  if (error) throw error;
  return new Set((data || []).map((entry) => entry.pack_id).filter(Boolean));
};

const applySoldShopPackState = (packs = [], soldPackIds = new Set()) => packs.map((pack) => (
  soldPackIds.has(pack.id)
    ? normalizeShopPack({
      ...pack,
      archived: true,
      archivedReason: pack.archivedReason || 'sold',
    })
    : pack
));

const saveShopPacks = async (supabase, packs = []) => {
  const normalized = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
  const { error } = await supabase.storage
    .from(aiJobBucket)
    .upload(shopPacksStoragePath, Buffer.from(JSON.stringify(normalized, null, 2)), {
      upsert: true,
      contentType: 'application/json; charset=utf-8',
      cacheControl: '0',
    });
  if (error) throw error;
  return normalized;
};

export const handler = async (event) => withErrors(event, async () => {
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const soldPackIds = await loadSoldShopPackIds(supabase);
    const packs = applySoldShopPackState(await loadShopPacks(supabase), soldPackIds);
    return json(200, { packs: packs.map(toPublicShopPack) });
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const adminUser = await verifyAdmin(event);
  const body = parseBody(event);
  const action = String(body.action || '').trim();
  const packs = await loadShopPacks(supabase);

  if (action === 'replace') {
    const nextPacks = await saveShopPacks(supabase, (Array.isArray(body.packs) ? body.packs : []).map((pack) => (
      preserveExistingShopPackDownload(pack, packs.find((entry) => entry.id === pack?.id))
    )));
    return json(200, { packs: nextPacks, admin: adminUser.email || '' });
  }

  if (action === 'upsert') {
    const rawPack = body.pack || {};
    const pack = preserveExistingShopPackDownload(rawPack, packs.find((entry) => entry.id === rawPack?.id));
    if (!pack.title) return json(400, { error: 'Nom du pack manquant.' });
    const nextPacks = await saveShopPacks(supabase, [
      pack,
      ...packs.filter((entry) => entry.id !== pack.id),
    ]);
    return json(200, { packs: nextPacks, pack, admin: adminUser.email || '' });
  }

  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  if (!packId) return json(400, { error: 'Pack manquant.' });

  if (action === 'delete') {
    await supabase.from('shop_pack_sales').delete().eq('pack_id', packId);
    return json(200, { packs: await saveShopPacks(supabase, packs.filter((entry) => entry.id !== packId)) });
  }

  if (action === 'archive' || action === 'relist') {
    if (action === 'relist') await supabase.from('shop_pack_sales').delete().eq('pack_id', packId);
    const now = new Date().toISOString();
    const nextPacks = await saveShopPacks(supabase, packs.map((pack) => {
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
    return json(200, { packs: nextPacks });
  }

  return json(400, { error: 'Action boutique inconnue.' });
});
