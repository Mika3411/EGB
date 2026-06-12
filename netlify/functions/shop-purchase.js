import {
  getSupabaseAdminClient,
  json,
  parseBody,
  privateDataBucket,
  publicAssetsBucket,
  resolveCreditUserId,
  withErrors,
} from './_shared.js';

const shopPacksStoragePath = 'public/shop-packs.json';
const storageNotFoundMessagePattern = /(?:not found|no such key|object not found|resource not found|introuvable)/i;

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

const loadShopPacks = async (supabase) => {
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

const validateStoragePath = (path = '') => {
  const storagePath = String(path || '').trim().replace(/^\/+/, '');
  if (!storagePath || storagePath.includes('..') || /[\0\\]/.test(storagePath)) {
    const error = new Error('Chemin Supabase invalide.');
    error.statusCode = 400;
    throw error;
  }
  return storagePath;
};

const getDownloadBuckets = (pack = {}) => {
  const configuredBuckets = [
    pack.downloadStorageBucket,
    pack.downloadBucket,
  ].map((bucket) => String(bucket || '').trim()).filter(Boolean);
  const defaultBuckets = pack.downloadMode === 'supabase'
    ? [publicAssetsBucket, privateDataBucket]
    : [privateDataBucket, publicAssetsBucket];

  return [...new Set([...configuredBuckets, ...defaultBuckets])];
};

const resolvePackDownloadUrl = async (supabase, pack = {}) => {
  const downloadUrl = String(pack.downloadUrl || '').trim();
  if (downloadUrl) return downloadUrl;

  const downloadStoragePath = String(pack.downloadStoragePath || '').trim();
  if (!downloadStoragePath) return '';

  const storagePath = validateStoragePath(downloadStoragePath);
  let lastError = null;
  for (const bucket of getDownloadBuckets(pack)) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(storagePath, 60 * 60);
    if (!error && data?.signedUrl) return data.signedUrl;
    lastError = error || lastError;
  }

  if (lastError) throw lastError;
  return '';
};

const purchaseShopPack = async (supabase, {
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
    soldError.statusCode = 404;
    throw soldError;
  }
  if (error?.message?.includes('Credits IA insuffisants')) {
    const creditError = new Error(error.message);
    creditError.statusCode = 402;
    throw creditError;
  }
  if (error) throw error;
  return data;
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const userId = await resolveCreditUserId(event);
  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');

  if (!packId) return json(400, { error: 'Pack manquant.' });
  if (!userId || userId === 'anonymous') return json(400, { error: 'Utilisateur manquant.' });

  const supabase = getSupabaseAdminClient();
  const packs = await loadShopPacks(supabase);
  const pack = packs.find((entry) => entry.id === packId);
  if (!pack || pack.archived) return json(404, { error: 'Pack indisponible.' });
  const downloadUrl = await resolvePackDownloadUrl(supabase, pack);
  if (!downloadUrl) return json(400, { error: 'Pack sans fichier telechargeable.' });

  const costCredits = Math.max(0, Math.round(Number(pack.costCredits || 0)));
  const title = String(pack.title || 'Pack boutique').trim().slice(0, 120);
  const downloadFileName = pack.downloadFileName || `${title || 'pack'}.zip`;
  if (!costCredits) return json(400, { error: 'Cout en credits invalide.' });

  const purchaseResult = await purchaseShopPack(supabase, {
    packId,
    userId,
    title,
    costCredits,
    downloadFileName,
  });

  return json(200, {
    ok: true,
    purchase: {
      packId,
      title,
      costCredits,
      downloadUrl,
      downloadFileName,
      purchasedAt: purchaseResult.purchased_at,
    },
    balance: Number(purchaseResult.balance || 0),
  });
});
