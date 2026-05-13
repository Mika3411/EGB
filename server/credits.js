import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from './config.js';
import { getSupabaseAdminClient } from './supabase.js';
import { verifySupabaseAdminRequest, verifySupabaseUserRequest } from './auth.js';
import { readJsonBody, sendJson } from './http.js';

const creditStorePath = process.env.AI_CREDITS_FILE || join(rootDir, '.data', 'ai-credits.json');
const creditStoreLockPath = `${creditStorePath}.lock`;

export const defaultAiCredits = Number(process.env.AI_DEFAULT_CREDITS || 20);
export const FREE_STORAGE_BYTES = 250 * 1024 * 1024;
export const STORAGE_BYTES_PER_CREDIT = 5 * 1024 * 1024;
export const aiCreditCosts = {
  text: Number(process.env.AI_TEXT_CREDIT_COST || 2),
  improve: Number(process.env.AI_IMPROVE_CREDIT_COST || 5),
  image: Number(process.env.AI_IMAGE_CREDIT_COST || 5),
  removeBackground: Number(process.env.REMOVE_BG_CREDIT_COST || 8),
  objectImageBatchSize: Number(process.env.AI_OBJECT_IMAGE_BATCH_SIZE || 1),
  objectImageBatchCost: Number(process.env.AI_OBJECT_IMAGE_BATCH_COST || 3),
  objectThumbnail: Number(process.env.AI_OBJECT_THUMBNAIL_CREDIT_COST || 1),
  projectGeneration: {
    act: Number(process.env.AI_PROJECT_ACT_CREDIT_COST || 2),
    scene: Number(process.env.AI_PROJECT_SCENE_CREDIT_COST || 1),
    enigma: Number(process.env.AI_PROJECT_ENIGMA_CREDIT_COST || 1),
    cinematic: Number(process.env.AI_PROJECT_CINEMATIC_CREDIT_COST || 1),
    item: Number(process.env.AI_PROJECT_ITEM_CREDIT_COST || 1),
  },
};

export const toCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
};

export const calculateProjectGenerationCost = (brief = {}) => {
  const units = aiCreditCosts.projectGeneration;
  return Math.max(1, Math.ceil(
    toCount(brief.actCount) * units.act
    + toCount(brief.sceneCount) * units.scene
    + toCount(brief.enigmaCount) * units.enigma
    + toCount(brief.cinematicCount) * units.cinematic
    + toCount(brief.itemCount) * units.item,
  ));
};

export const calculateTextCreditCost = (body = {}) => (
  body.mode === 'repair_item_names' ? 0
    : body.mode === 'generate'
      || (body.mode === 'progressive' && /^act\d+$/.test(String(body.stage || '')))
      || (body.mode === 'extend' && body.stage !== 'enrich_interactions')
      ? calculateProjectGenerationCost(body.brief || {})
      : body.mode === 'improve' ? aiCreditCosts.improve
      : aiCreditCosts.text
);

export const readCreditStore = () => {
  if (!existsSync(creditStorePath)) return { users: {}, gumroadSales: {} };
  try {
    const parsed = JSON.parse(readFileSync(creditStorePath, 'utf8'));
    return parsed && typeof parsed === 'object' ?
       { users: parsed.users || {}, gumroadSales: parsed.gumroadSales || {} }
      : { users: {}, gumroadSales: {} };
  } catch {
    return { users: {}, gumroadSales: {} };
  }
};

export const writeCreditStore = (store) => {
  mkdirSync(join(creditStorePath, '..'), { recursive: true });
  const tempPath = `${creditStorePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tempPath, JSON.stringify(store, null, 2));
  renameSync(tempPath, creditStorePath);
};

const sleepSync = (delayMs) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
};

export const withCreditStoreLock = (task) => {
  mkdirSync(join(creditStorePath, '..'), { recursive: true });
  const startedAt = Date.now();
  let lockHandle = null;

  while (lockHandle === null) {
    try {
      lockHandle = openSync(creditStoreLockPath, 'wx');
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      if (Date.now() - startedAt > 5000) {
        const lockError = new Error('Store de credits occupe, reessaie dans un instant.');
        lockError.status = 503;
        throw lockError;
      }
      sleepSync(25);
    }
  }

  try {
    return task();
  } finally {
    closeSync(lockHandle);
    try {
      unlinkSync(creditStoreLockPath);
    } catch {
      // Le verrou est best-effort: s'il a deja disparu, la section critique est terminee.
    }
  }
};

export const getCreditUserId = (req, body = {}) => {
  const fromHeader = req.headers['x-ai-user-id'];
  const raw = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader || body.userId || 'anonymous';
  return String(raw).trim().replace(/[^a-zA-Z0-9._:@-]/g, '-') || 'anonymous';
};

export const sanitizeCreditUserId = (value = '') =>
  String(value).trim().replace(/[^a-zA-Z0-9._:@-]/g, '-') || 'anonymous';

export const resolveCreditUserId = async (req, body = {}) => {
  const requestedUserId = getCreditUserId(req, body);
  if (!getSupabaseAdminClient()) return requestedUserId;

  const authUser = await verifySupabaseUserRequest(req);
  const userId = sanitizeCreditUserId(authUser.id || authUser.email || requestedUserId);
  if (requestedUserId !== 'anonymous' && requestedUserId !== userId && requestedUserId !== authUser.email) {
    const error = new Error('Compte credits invalide.');
    error.status = 403;
    throw error;
  }
  return userId;
};

export const ensureCreditAccount = (store, userId) => {
  if (!store.users[userId]) {
    const now = new Date().toISOString();
    store.users[userId] = {
      balance: Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0,
      objectImagesInCurrentBatch: 0,
      createdAt: now,
      updatedAt: now,
      transactions: [{
        type: 'grant',
        amount: Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0,
        reason: 'initial_balance',
        at: now,
      }],
    };
  }
  return store.users[userId];
};

export const getCreditAccount = (userId) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureCreditAccount(store, userId);
    writeCreditStore(store);
    return account;
  });
};

export const calculateImageCreditCost = (account, body = {}) => {
  if (body.type !== 'item') return aiCreditCosts.image;
  if (body.variant === 'thumbnail') return aiCreditCosts.objectThumbnail;
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  const usedInBatch = toCount(account.objectImagesInCurrentBatch);
  return usedInBatch % batchSize === 0 ? aiCreditCosts.objectImageBatchCost : 0;
};

const makeImageCreditReservationId = () => `image_${Date.now()}_${randomUUID()}`;

const sanitizeCreditTrace = (value = '') => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_.:-]/g, '-')
  .slice(0, 120);

const getReservationRefundReason = (reason, reservation = {}) => {
  const reservationId = sanitizeCreditTrace(reservation.id || reservation.reservationId);
  return reservationId ? `${reason}:reservation:${reservationId}` : reason;
};

export const reserveImageCredits = (userId, body = {}) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureCreditAccount(store, userId);
    const reservationId = makeImageCreditReservationId();
    const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
    const advancesBatch = body.type === 'item' && body.variant !== 'thumbnail';
    const previousBatchCount = toCount(account.objectImagesInCurrentBatch);
    const cost = calculateImageCreditCost(account, body);
    const balance = Number(account.balance || 0);
    if (balance < cost) {
      const error = new Error(`Credits IA insuffisants (${balance}/${cost}).`);
      error.status = 402;
      error.code = 'AI_CREDITS_EXHAUSTED';
      error.balance = balance;
      error.required = cost;
      throw error;
    }
    const now = new Date().toISOString();
    const nextBatchCount = advancesBatch ? (previousBatchCount + 1) % batchSize : previousBatchCount;

    if (cost > 0) {
      addCreditTransaction(account, {
        type: 'debit',
        amount: -cost,
        reason: `image:${body.type || 'image'}`,
        at: now,
      });
      const lastTransaction = (account.transactions || [])[account.transactions.length - 1];
      if (lastTransaction?.reason?.startsWith('image:item')) {
        lastTransaction.batchProgress = `${nextBatchCount || batchSize}/${batchSize}`;
      }
    }

    if (advancesBatch) {
      account.objectImagesInCurrentBatch = nextBatchCount;
      account.updatedAt = now;
    }

    writeCreditStore(store);
    return {
      id: reservationId,
      account,
      cost,
      batchSize,
      advancesBatch,
      previousBatchCount,
      nextBatchCount,
    };
  });
};

export const releaseImageCreditReservation = (userId, reservation = {}, reason = 'failed_image') => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureCreditAccount(store, userId);
    const cost = Math.max(0, Math.round(Number(reservation.cost || 0)));
    const batchSize = Math.max(1, toCount(reservation.batchSize) || 1);
    const currentBatchCount = toCount(account.objectImagesInCurrentBatch);
    const refundReason = getReservationRefundReason(reason, reservation);
    const alreadyRefunded = reservation.id && (account.transactions || []).some((transaction) => (
      transaction.type === 'refund'
      && Number(transaction.amount || 0) === cost
      && transaction.reason === refundReason
    ));
    const now = new Date().toISOString();

    if (cost > 0 && !alreadyRefunded) {
      addCreditTransaction(account, {
        type: 'refund',
        amount: cost,
        reason: refundReason,
        at: now,
      });
    }

    if (reservation.advancesBatch) {
      account.objectImagesInCurrentBatch = (currentBatchCount - 1 + batchSize) % batchSize;
      account.updatedAt = now;
    }

    writeCreditStore(store);
    return account;
  });
};

export const addCreditTransaction = (account, transaction) => {
  account.balance = Math.max(0, Number(account.balance || 0) + Number(transaction.amount || 0));
  account.updatedAt = transaction.at;
  account.transactions = [...(account.transactions || []), transaction].slice(-100);
};

export const normalizeCreditAccount = (userId, account = {}) => ({
  userId,
  balance: Number(account.balance || 0),
  objectImagesInCurrentBatch: toCount(account.objectImagesInCurrentBatch),
  createdAt: account.createdAt || '',
  updatedAt: account.updatedAt || '',
  transactions: (account.transactions || []).slice(-10).reverse(),
});

const requireCreditAdmin = async (req) => {
  await verifySupabaseAdminRequest(req);
  return true;
};

export const spendCredits = (userId, amount, reason) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureCreditAccount(store, userId);
    const safeAmount = Math.max(0, Number(amount || 0));
    if (safeAmount > 0 && Number(account.balance || 0) < safeAmount) {
      const error = new Error(`CrÃ©dits IA insuffisants (${account.balance || 0}/${safeAmount}).`);
      error.status = 402;
      error.code = 'AI_CREDITS_EXHAUSTED';
      error.balance = account.balance || 0;
      error.required = safeAmount;
      throw error;
    }
    if (safeAmount > 0) {
      addCreditTransaction(account, {
        type: 'debit',
        amount: -safeAmount,
        reason,
        at: new Date().toISOString(),
      });
      writeCreditStore(store);
    }
    return account;
  });
};

export const refundCredits = (userId, amount, reason) => {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (!safeAmount) return;
  withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureCreditAccount(store, userId);
    addCreditTransaction(account, {
      type: 'refund',
      amount: safeAmount,
      reason,
      at: new Date().toISOString(),
    });
    writeCreditStore(store);
  });
};

export const grantCredits = (userId, amount, reason) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureCreditAccount(store, userId);
    addCreditTransaction(account, {
      type: 'grant',
      amount,
      reason,
      at: new Date().toISOString(),
    });
    writeCreditStore(store);
    return account;
  });
};

export const getStorageQuotaFromTransactions = (account = {}) => (
  (account.transactions || []).reduce((quota, entry) => {
    const [, , bytes] = String(entry.reason || '').split(':');
    return Math.max(quota, Math.round(Number(bytes) || 0));
  }, FREE_STORAGE_BYTES)
);

export const handleCredits = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = await resolveCreditUserId(req, { userId: url.searchParams.get('userId') });
  const account = getCreditAccount(userId);
  const objectImageBatchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  sendJson(res, 200, {
    userId,
    balance: account.balance || 0,
    costs: aiCreditCosts,
    nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    objectImagesInCurrentBatch: toCount(account.objectImagesInCurrentBatch),
    objectImageBatchSize,
    storageQuotaBytes: getStorageQuotaFromTransactions(account),
    transactions: (account.transactions || []).slice(-10).reverse(),
  });
};

export const handleStorageUpgrade = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Methode non autorisee.' });
    return;
  }

  const body = await readJsonBody(req);
  const credits = Math.max(0, Math.round(Number(body.credits || 0)));
  if (!credits) {
    sendJson(res, 400, { error: 'Nombre de credits invalide.' });
    return;
  }

  const userId = await resolveCreditUserId(req, body);
  if (!userId || (userId === 'anonymous' && getSupabaseAdminClient())) {
    sendJson(res, 400, { error: 'Utilisateur manquant.' });
    return;
  }

  const storageQuotaBytes = credits * STORAGE_BYTES_PER_CREDIT;
  const account = spendCredits(userId, credits, `storage_upgrade:${credits}:${storageQuotaBytes}`);
  sendJson(res, 200, {
    ok: true,
    balance: Number(account.balance || 0),
    storageQuotaBytes: getStorageQuotaFromTransactions(account),
    storagePackCredits: credits,
  });
};

export const handleCreditTopUp = async (req, res) => {
  const body = await readJsonBody(req);
  await requireCreditAdmin(req);

  const userId = getCreditUserId(req, body);
  const amount = Math.max(0, Math.round(Number(body.amount || 0)));
  if (!amount) {
    sendJson(res, 400, { error: 'Montant de crÃ©dits invalide.' });
    return;
  }

  const account = grantCredits(userId, amount, body.reason || 'manual_top_up');
  sendJson(res, 200, { userId, balance: account.balance, costs: aiCreditCosts });
};

export const handleCreditsAdminList = async (req, res) => {
  await requireCreditAdmin(req);

  const store = readCreditStore();
  const users = Object.entries(store.users || {})
    .map(([userId, account]) => normalizeCreditAccount(userId, account))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

  sendJson(res, 200, {
    users,
    costs: aiCreditCosts,
    defaultCredits: Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0,
  });
};

export const handleCreditsAdminUpdate = async (req, res) => {
  const body = await readJsonBody(req);
  await requireCreditAdmin(req);

  const userId = getCreditUserId(req, body);
  if (!userId || userId === 'anonymous') {
    sendJson(res, 400, { error: 'Utilisateur invalide.' });
    return;
  }

  const action = String(body.action || 'add');
  const amount = Math.round(Number(body.amount || 0));
  if (!Number.isFinite(amount)) {
    sendJson(res, 400, { error: 'Montant invalide.' });
    return;
  }

  const account = withCreditStoreLock(() => {
    const store = readCreditStore();
    const lockedAccount = ensureCreditAccount(store, userId);
    const now = new Date().toISOString();
    const reason = body.reason || `admin_${action}`;

    if (action === 'set') {
      const previousBalance = Number(lockedAccount.balance || 0);
      const nextBalance = Math.max(0, amount);
      lockedAccount.balance = nextBalance;
      lockedAccount.updatedAt = now;
      lockedAccount.transactions = [...(lockedAccount.transactions || []), {
        type: 'admin_set',
        amount: nextBalance - previousBalance,
        previousBalance,
        nextBalance,
        reason,
        at: now,
      }].slice(-100);
    } else {
      const signedAmount = action === 'subtract' ? -Math.abs(amount) : Math.abs(amount);
      addCreditTransaction(lockedAccount, {
        type: signedAmount < 0 ? 'admin_debit' : 'admin_grant',
        amount: signedAmount,
        reason,
        at: now,
      });
    }

    writeCreditStore(store);
    return lockedAccount;
  });
  sendJson(res, 200, {
    user: normalizeCreditAccount(userId, account),
    costs: aiCreditCosts,
  });
};

export const handleAdminCredits = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  if (req.method === 'GET') {
    await handleCreditsAdminList(req, res);
    return;
  }
  if (req.method === 'POST') {
    await handleCreditsAdminUpdate(req, res);
    return;
  }
  sendJson(res, 405, { error: 'Methode non autorisee.' });
};

const gumroadPacks = [
  {
    credits: Number(process.env.GUMROAD_PACK_100_CREDITS || 100),
    productId: process.env.GUMROAD_PACK_100_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_100_PERMALINK || 'BLFVPJ',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_250_CREDITS || 250),
    productId: process.env.GUMROAD_PACK_250_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_250_PERMALINK || 'lvnjan',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_500_CREDITS || 500),
    productId: process.env.GUMROAD_PACK_500_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_500_PERMALINK || 'ojrsxa',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_1000_CREDITS || 1000),
    productId: process.env.GUMROAD_PACK_1000_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_1000_PERMALINK || 'zyedcq',
  },
].filter((pack) => pack.credits > 0);

const parseGumroadCustomFields = (body = {}) => {
  if (body.custom_fields && typeof body.custom_fields === 'object') return body.custom_fields;
  if (typeof body.custom_fields === 'string') {
    try {
      return JSON.parse(body.custom_fields);
    } catch {
      return {};
    }
  }

  return Object.fromEntries(Object.entries(body)
    .filter(([key]) => key.startsWith('custom_fields['))
    .map(([key, value]) => [key.match(/^custom_fields\[(.+)\]$/)?.[1] || key, value]));
};

const getGumroadUserId = (body = {}) => {
  const customFields = parseGumroadCustomFields(body);
  return body.user_id
    || body.userId
    || body.purchase_id
    || customFields.user_id
    || customFields.userId
    || customFields['Identifiant achat']
    || customFields['identifiant achat']
    || body.email
    || '';
};

const getGumroadPack = (body = {}) => {
  const productId = String(body.product_id || '').trim();
  const permalink = String(body.product_permalink || body.permalink || '').trim().split('/').filter(Boolean).pop()?.toLowerCase() || '';
  const productName = String(body.product_name || body.product || '').toLowerCase();
  return gumroadPacks.find((pack) => (
    (pack.productId && pack.productId === productId)
    || (pack.permalink && pack.permalink.toLowerCase() === permalink)
    || (pack.permalink && productName.includes(pack.permalink.toLowerCase()))
    || (pack.credits && new RegExp(`\\bpack\\s+${pack.credits}\\b`, 'i').test(productName))
  ));
};

export const handleGumroadWebhook = async (req, res) => {
  const body = await readJsonBody(req);
  const expectedSecret = process.env.GUMROAD_WEBHOOK_SECRET || '';
  if (!expectedSecret) {
    sendJson(res, 503, { ok: false, error: 'Secret Gumroad serveur non configure.' });
    return;
  }
  if (body.secret !== expectedSecret) {
    sendJson(res, 403, { ok: false, error: 'Secret Gumroad invalide.' });
    return;
  }

  const saleId = String(body.sale_id || body.id || body.order_number || '').trim();
  if (!saleId) {
    sendJson(res, 400, { ok: false, error: 'sale_id Gumroad manquant.' });
    return;
  }

  const pack = getGumroadPack(body);
  if (!pack) {
    sendJson(res, 400, { ok: false, error: 'Pack Gumroad inconnu.' });
    return;
  }

  const userId = getCreditUserId(req, { userId: getGumroadUserId(body) });
  if (!userId || userId === 'anonymous') {
    sendJson(res, 400, { ok: false, error: 'Identifiant utilisateur manquant.' });
    return;
  }

  const gumroadResult = withCreditStoreLock(() => {
    const store = readCreditStore();
    if (store.gumroadSales[saleId]) {
      return { duplicate: true };
    }

    const account = ensureCreditAccount(store, userId);
    const processedAt = new Date().toISOString();
    addCreditTransaction(account, {
      type: 'grant',
      amount: pack.credits,
      reason: `gumroad:${saleId}`,
      at: processedAt,
      productId: body.product_id || '',
      productPermalink: body.product_permalink || body.permalink || '',
      buyerEmail: body.email || '',
    });
    store.gumroadSales[saleId] = {
      userId,
      credits: pack.credits,
      productId: body.product_id || '',
      productPermalink: body.product_permalink || body.permalink || '',
      email: body.email || '',
      processedAt,
    };
    writeCreditStore(store);
    return { balance: account.balance };
  });

  if (gumroadResult.duplicate) {
    sendJson(res, 200, { ok: true, duplicate: true, saleId });
    return;
  }

  sendJson(res, 200, {
    ok: true,
    saleId,
    userId,
    creditsAdded: pack.credits,
    balance: gumroadResult.balance,
  });
};
