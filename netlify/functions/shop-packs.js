import {
  getSupabaseAdminClient,
  json,
  parseBody,
  privateDataBucket,
  publicAssetsBucket,
  verifyAdmin,
  withErrors,
} from './_shared.js';

const shopPacksStoragePath = 'public/shop-packs.json';
const storageNotFoundMessagePattern = /(?:not found|no such key|object not found|resource not found|introuvable)/i;
const missingShopSalesTablePattern = /shop_pack_sales|schema cache|relation .* does not exist|could not find the table/i;
const maxApiScreenshotSrcLength = 32 * 1024;
const screenshotMimeExtensions = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const createShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const sanitizeStorageSegment = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase() || 'asset';

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

const toApiScreenshots = (screenshots = []) => (
  Array.isArray(screenshots)
    ? screenshots.filter((entry) => {
      const src = String(entry?.src || '');
      return src && (!src.startsWith('data:') || src.length <= maxApiScreenshotSrcLength);
    })
    : []
);

export const toAdminShopPack = (pack = {}) => {
  const normalized = normalizeShopPack(pack);
  return {
    ...normalized,
    screenshots: toApiScreenshots(normalized.screenshots),
    hasDownload: Boolean(normalized.downloadUrl || normalized.downloadStoragePath),
  };
};

const toPublicShopPack = (pack = {}) => {
  const {
    downloadUrl,
    downloadStoragePath,
    downloadBucket,
    downloadStorageBucket,
    ...publicPack
  } = toAdminShopPack(pack);
  return publicPack;
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

export const isStorageNotFoundError = (error = {}) => {
  const status = Number(error.statusCode || error.status || error.httpStatusCode || 0);
  const code = String(error.code || error.error || error.statusCode || '').toLowerCase();
  const message = String(error.message || '').toLowerCase();
  return status === 404
    || code === '404'
    || code === 'not_found'
    || code === 'not-found'
    || code === 'nosuchkey'
    || storageNotFoundMessagePattern.test(message);
};

export const loadShopPacks = async (supabase) => {
  const { data, error } = await supabase.storage.from(privateDataBucket).download(shopPacksStoragePath);
  if (error) {
    if (isStorageNotFoundError(error)) return [];
    throw error;
  }
  try {
    const packs = JSON.parse(await data.text());
    return Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
  } catch {
    return [];
  }
};

const parseImageDataUrl = (src = '') => {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(String(src || ''));
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const extension = screenshotMimeExtensions[mimeType];
  if (!extension) return null;
  return {
    mimeType,
    extension,
    buffer: Buffer.from(match[2], 'base64'),
  };
};

export const migrateShopPackScreenshots = async (supabase, packs = []) => {
  if (!publicAssetsBucket || !supabase?.storage?.from) return { packs, didChange: false };

  let didChange = false;
  const nextPacks = [];

  for (const pack of packs) {
    const screenshots = Array.isArray(pack.screenshots) ? pack.screenshots : [];
    let didChangePack = false;
    const nextScreenshots = [];

    for (let index = 0; index < screenshots.length; index += 1) {
      const screenshot = screenshots[index] || {};
      const parsed = parseImageDataUrl(screenshot.src);
      if (!parsed) {
        nextScreenshots.push(screenshot);
        continue;
      }

      const storagePath = [
        'shop-pack-screenshots',
        sanitizeStorageSegment(pack.id || createShopPackId()),
        `${sanitizeStorageSegment(screenshot.id || `shot-${index + 1}`)}.${parsed.extension}`,
      ].join('/');
      const bucket = supabase.storage.from(publicAssetsBucket);
      const { error } = await bucket.upload(storagePath, parsed.buffer, {
        upsert: true,
        contentType: parsed.mimeType,
        cacheControl: '31536000',
      });
      if (error) {
        nextScreenshots.push(screenshot);
        continue;
      }

      const publicUrl = bucket.getPublicUrl(storagePath).data.publicUrl;
      nextScreenshots.push({
        ...screenshot,
        src: publicUrl,
        storagePath,
        storageBucket: publicAssetsBucket,
        contentType: parsed.mimeType,
      });
      didChange = true;
      didChangePack = true;
    }

    nextPacks.push(didChangePack ? normalizeShopPack({ ...pack, screenshots: nextScreenshots }) : pack);
  }

  return { packs: nextPacks, didChange };
};

const isMissingShopSalesTableError = (error = {}) => {
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || error.details || error.hint || '').toLowerCase();
  return code === 'PGRST205'
    || code === '42P01'
    || missingShopSalesTablePattern.test(message);
};

export const loadSoldShopPackIds = async (supabase) => {
  const { data, error } = await supabase
    .from('shop_pack_sales')
    .select('pack_id')
    .in('status', ['pending', 'paid']);
  if (error) {
    if (isMissingShopSalesTableError(error)) return new Set();
    throw error;
  }
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
  const migrated = await migrateShopPackScreenshots(supabase, normalized);
  const { error } = await supabase.storage
    .from(privateDataBucket)
    .upload(shopPacksStoragePath, Buffer.from(JSON.stringify(migrated.packs, null, 2)), {
      upsert: true,
      contentType: 'application/json; charset=utf-8',
      cacheControl: '0',
    });
  if (error) throw error;
  return migrated.packs;
};

export const handler = async (event) => withErrors(event, async () => {
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const soldPackIds = await loadSoldShopPackIds(supabase);
    const loadedPacks = await loadShopPacks(supabase);
    const migrated = await migrateShopPackScreenshots(supabase, loadedPacks);
    if (migrated.didChange) await saveShopPacks(supabase, migrated.packs);
    const packs = applySoldShopPackState(migrated.packs, soldPackIds);
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
    return json(200, { packs: nextPacks.map(toAdminShopPack), admin: adminUser.email || '' });
  }

  if (action === 'upsert') {
    const rawPack = body.pack || {};
    const pack = preserveExistingShopPackDownload(rawPack, packs.find((entry) => entry.id === rawPack?.id));
    if (!pack.title) return json(400, { error: 'Nom du pack manquant.' });
    const nextPacks = await saveShopPacks(supabase, [
      pack,
      ...packs.filter((entry) => entry.id !== pack.id),
    ]);
    return json(200, { packs: nextPacks.map(toAdminShopPack), pack: toAdminShopPack(pack), admin: adminUser.email || '' });
  }

  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  if (!packId) return json(400, { error: 'Pack manquant.' });

  if (action === 'delete') {
    await supabase.from('shop_pack_sales').delete().eq('pack_id', packId);
    const nextPacks = await saveShopPacks(supabase, packs.filter((entry) => entry.id !== packId));
    return json(200, { packs: nextPacks.map(toAdminShopPack) });
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
    return json(200, { packs: nextPacks.map(toAdminShopPack) });
  }

  return json(400, { error: 'Action boutique inconnue.' });
});
