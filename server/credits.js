import { randomUUID } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { rootDir } from './config.js';
import { getSupabaseAdminClient } from './supabase.js';
import { verifySupabaseAdminRequest, verifySupabaseUserRequest } from './auth.js';
import { readJsonBody, sendJson } from './http.js';
import { getGumroadPack, getGumroadUserId } from './creditsGumroad.js';

const creditStorePath = process.env.AI_CREDITS_FILE || join(rootDir, '.data', 'ai-credits.json');
const creditStoreLockPath = `${creditStorePath}.lock`;

export const defaultAiCredits = Number(process.env.AI_DEFAULT_CREDITS || 20);
export const FREE_STORAGE_BYTES = 250 * 1024 * 1024;
export const STORAGE_BYTES_PER_CREDIT = 5 * 1024 * 1024;
const STORAGE_UPGRADE_REASON_PREFIX = 'storage_upgrade:';
const STORAGE_QUOTA_SET_REASON_PREFIX = 'storage_quota_set:';
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

export const isLocalCreditAuthAllowed = (env = process.env) =>
  /^(1|true|yes)$/i.test(String(env.ALLOW_LOCAL_CREDIT_AUTH || ''));

export const resolveCreditUserId = async (req, body = {}) => {
  const requestedUserId = getCreditUserId(req, body);
  if (!getSupabaseAdminClient()) {
    if (isLocalCreditAuthAllowed(process.env)) return requestedUserId;

    const error = new Error('Authentification Supabase requise pour les credits.');
    error.status = 503;
    error.code = 'SUPABASE_AUTH_REQUIRED';
    throw error;
  }

  const authUser = await verifySupabaseUserRequest(req);
  const userId = sanitizeCreditUserId(authUser.id || authUser.email || requestedUserId);
  if (requestedUserId !== 'anonymous' && requestedUserId !== userId && requestedUserId !== authUser.email) {
    const error = new Error('Compte credits invalide.');
    error.status = 403;
    throw error;
  }
  return userId;
};

const ensureLocalCreditAccount = (store, userId) => {
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

const getLocalCreditAccount = (userId) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureLocalCreditAccount(store, userId);
    writeCreditStore(store);
    return account;
  });
};

export const calculateImageCreditCost = (account, body = {}) => {
  if (body.type !== 'item') return aiCreditCosts.image;
  if (body.variant === 'thumbnail') return aiCreditCosts.objectThumbnail;
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  const usedInBatch = toCount(account.objectImagesInCurrentBatch ?? account.object_images_in_current_batch);
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

const reserveLocalImageCredits = (userId, body = {}) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureLocalCreditAccount(store, userId);
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

const releaseLocalImageCreditReservation = (userId, reservation = {}, reason = 'failed_image') => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureLocalCreditAccount(store, userId);
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

const normalizeSupabaseCreditAccount = (account = {}, transactions = account.transactions || []) => ({
  userId: account.user_id || account.userId || '',
  balance: Number(account.balance || 0),
  objectImagesInCurrentBatch: toCount(account.object_images_in_current_batch ?? account.objectImagesInCurrentBatch),
  createdAt: account.created_at || account.createdAt || '',
  updatedAt: account.updated_at || account.updatedAt || '',
  transactions,
});

const makeCreditError = (message, status = 500, code = 'AI_CREDITS_ERROR', details = {}) => {
  const error = new Error(message);
  error.status = status;
  error.statusCode = status;
  error.code = code;
  Object.assign(error, details);
  return error;
};

const getCreditBackend = () => {
  const supabase = getSupabaseAdminClient();
  if (supabase) return { type: 'supabase', supabase };
  if (isLocalCreditAuthAllowed(process.env)) return { type: 'local' };
  throw makeCreditError(
    'Supabase est requis pour les credits IA. Active ALLOW_LOCAL_CREDIT_AUTH=true uniquement en developpement local pour utiliser le fichier fallback.',
    503,
    'SUPABASE_CREDITS_REQUIRED',
  );
};

export const ensureSupabaseCreditAccount = async (supabase, userId) => {
  const { data, error } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  if (data) {
    if (data.object_images_in_current_batch == null) {
      const { data: normalized, error: normalizeError } = await supabase
        .from('ai_credits')
        .update({
          object_images_in_current_batch: 0,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select('*')
        .single();
      if (normalizeError) throw normalizeError;
      return normalized;
    }
    return data;
  }

  const now = new Date().toISOString();
  const initialBalance = Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0;
  const { data: inserted, error: insertError } = await supabase
    .from('ai_credits')
    .insert({
      user_id: userId,
      balance: initialBalance,
      object_images_in_current_batch: 0,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  const { error: transactionError } = await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    type: 'grant',
    amount: initialBalance,
    reason: 'initial_balance',
    created_at: now,
  });
  if (transactionError) throw transactionError;

  return inserted;
};

export const getRecentTransactions = async (supabase, userId, limit = 10) => {
  const { data, error } = await supabase
    .from('ai_credit_transactions')
    .select('type, amount, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map((entry) => ({
    type: entry.type,
    amount: Number(entry.amount || 0),
    reason: entry.reason || '',
    at: entry.created_at || '',
  }));
};

const addSupabaseCreditTransaction = async (supabase, userId, transaction = {}) => {
  const { error } = await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    type: transaction.type || 'spend',
    amount: Number(transaction.amount || 0),
    reason: transaction.reason || '',
    created_at: transaction.createdAt || new Date().toISOString(),
  });
  if (error) throw error;
};

const updateSupabaseCreditAccount = async (supabase, userId, patch = {}) => {
  const { data, error } = await supabase
    .from('ai_credits')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const spendSupabaseCredits = async (supabase, userId, amount, reason) => {
  const cost = Math.max(0, Math.round(Number(amount || 0)));
  if (cost <= 0) return ensureSupabaseCreditAccount(supabase, userId);

  let lastBalance = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await ensureSupabaseCreditAccount(supabase, userId);
    lastBalance = Number(account.balance || 0);
    if (lastBalance < cost) break;

    const { data: updated, error } = await supabase
      .from('ai_credits')
      .update({
        balance: lastBalance - cost,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('balance', lastBalance)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (updated) {
      await addSupabaseCreditTransaction(supabase, userId, {
        type: 'spend',
        amount: -cost,
        reason,
      });
      return updated;
    }
  }

  throw makeCreditError('Credits IA insuffisants.', 402, 'AI_CREDITS_EXHAUSTED', {
    balance: lastBalance,
    required: cost,
  });
};

export const refundSupabaseCredits = async (supabase, userId, amount, reason) => {
  const cost = Math.max(0, Math.round(Number(amount || 0)));
  if (cost <= 0) return ensureSupabaseCreditAccount(supabase, userId);
  const account = await ensureSupabaseCreditAccount(supabase, userId);
  const updated = await updateSupabaseCreditAccount(supabase, userId, {
    balance: Number(account.balance || 0) + cost,
  });
  await addSupabaseCreditTransaction(supabase, userId, {
    type: 'refund',
    amount: cost,
    reason,
  });
  return updated;
};

const addSupabaseCredits = async (supabase, userId, amount, reason, type = 'grant') => {
  const safeAmount = Math.max(0, Math.round(Number(amount || 0)));
  if (!safeAmount) return ensureSupabaseCreditAccount(supabase, userId);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await ensureSupabaseCreditAccount(supabase, userId);
    const previousBalance = Number(account.balance || 0);
    const nextBalance = previousBalance + safeAmount;
    const { data: updated, error } = await supabase
      .from('ai_credits')
      .update({
        balance: nextBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('balance', previousBalance)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (updated) {
      await addSupabaseCreditTransaction(supabase, userId, {
        type,
        amount: safeAmount,
        reason,
      });
      return updated;
    }
  }

  throw makeCreditError('Mise a jour des credits impossible, reessaie.', 409, 'AI_CREDITS_CONFLICT');
};

const hasSupabaseCreditTransaction = async (supabase, userId, transaction = {}) => {
  const { data, error } = await supabase
    .from('ai_credit_transactions')
    .select('id')
    .eq('user_id', userId)
    .eq('type', transaction.type)
    .eq('amount', Number(transaction.amount || 0))
    .eq('reason', transaction.reason || '')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
};

const refundSupabaseImageCreditReservation = async (supabase, userId, reservation = {}, reason = 'failed_image') => {
  const cost = Math.max(0, Math.round(Number(reservation.cost || 0)));
  if (cost <= 0) return ensureSupabaseCreditAccount(supabase, userId);

  const refundReason = getReservationRefundReason(reason, reservation);
  if (reservation.id && await hasSupabaseCreditTransaction(supabase, userId, {
    type: 'refund',
    amount: cost,
    reason: refundReason,
  })) {
    return ensureSupabaseCreditAccount(supabase, userId);
  }

  return refundSupabaseCredits(supabase, userId, cost, refundReason);
};

export const reserveSupabaseImageCredits = async (supabase, userId, body = {}) => {
  const reservationId = makeImageCreditReservationId();
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  const advancesBatch = body.type === 'item' && body.variant !== 'thumbnail';
  let lastBalance = 0;
  let required = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const account = await ensureSupabaseCreditAccount(supabase, userId);
    const previousBatchCount = toCount(account.object_images_in_current_batch);
    const cost = calculateImageCreditCost(account, body);
    const balance = Number(account.balance || 0);
    lastBalance = balance;
    required = cost;
    if (balance < cost) break;

    const nextBatchCount = advancesBatch ? (previousBatchCount + 1) % batchSize : previousBatchCount;
    if (cost <= 0 && !advancesBatch) {
      return {
        id: reservationId,
        account: normalizeSupabaseCreditAccount(account),
        cost: 0,
        batchSize,
        advancesBatch,
        previousBatchCount,
        nextBatchCount,
      };
    }

    const patch = {
      updated_at: new Date().toISOString(),
      ...(cost > 0 ? { balance: balance - cost } : {}),
      ...(advancesBatch ? { object_images_in_current_batch: nextBatchCount } : {}),
    };
    const { data: updated, error } = await supabase
      .from('ai_credits')
      .update(patch)
      .eq('user_id', userId)
      .eq('balance', balance)
      .eq('object_images_in_current_batch', previousBatchCount)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (updated) {
      if (cost > 0) {
        await addSupabaseCreditTransaction(supabase, userId, {
          type: 'spend',
          amount: -cost,
          reason: `image:${body.type || 'image'}`,
        });
      }
      return {
        id: reservationId,
        account: normalizeSupabaseCreditAccount(updated),
        cost,
        batchSize,
        advancesBatch,
        previousBatchCount,
        nextBatchCount,
      };
    }
  }

  throw makeCreditError('Credits IA insuffisants.', 402, 'AI_CREDITS_EXHAUSTED', {
    balance: lastBalance,
    required,
  });
};

const rollbackSupabaseImageBatchReservation = async (supabase, userId, reservation = {}) => {
  if (!reservation.advancesBatch) return ensureSupabaseCreditAccount(supabase, userId);
  const batchSize = Math.max(1, toCount(reservation.batchSize) || 1);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const account = await ensureSupabaseCreditAccount(supabase, userId);
    const currentBatchCount = toCount(account.object_images_in_current_batch);
    const nextBatchCount = (currentBatchCount - 1 + batchSize) % batchSize;
    const { data: updated, error } = await supabase
      .from('ai_credits')
      .update({
        object_images_in_current_batch: nextBatchCount,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('object_images_in_current_batch', currentBatchCount)
      .select('*')
      .maybeSingle();

    if (error) throw error;
    if (updated) return updated;
  }
  return ensureSupabaseCreditAccount(supabase, userId);
};

export const releaseSupabaseImageCreditReservation = async (supabase, userId, reservation = {}, reason = 'failed_image') => {
  const refundedAccount = await refundSupabaseImageCreditReservation(supabase, userId, reservation, reason);
  try {
    return await rollbackSupabaseImageBatchReservation(supabase, userId, reservation);
  } catch (error) {
    if (Number(reservation.cost || 0) > 0) return refundedAccount;
    throw error;
  }
};

export const ensureCreditAccount = async (userId) => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') {
    return normalizeSupabaseCreditAccount(await ensureSupabaseCreditAccount(backend.supabase, userId));
  }
  return getLocalCreditAccount(userId);
};

export const getCreditAccount = async (userId) => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') {
    const account = await ensureSupabaseCreditAccount(backend.supabase, userId);
    const transactions = await getRecentTransactions(backend.supabase, userId);
    return normalizeSupabaseCreditAccount(account, transactions);
  }
  return normalizeCreditAccount(userId, getLocalCreditAccount(userId));
};

export const spendCredits = async (userId, amount, reason) => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') {
    return normalizeSupabaseCreditAccount(await spendSupabaseCredits(backend.supabase, userId, amount, reason));
  }
  return spendLocalCredits(userId, amount, reason);
};

export const refundCredits = async (userId, amount, reason) => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') {
    return normalizeSupabaseCreditAccount(await refundSupabaseCredits(backend.supabase, userId, amount, reason));
  }
  return refundLocalCredits(userId, amount, reason);
};

export const grantCredits = async (userId, amount, reason) => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') {
    return normalizeSupabaseCreditAccount(await addSupabaseCredits(backend.supabase, userId, amount, reason, 'grant'));
  }
  return grantLocalCredits(userId, amount, reason);
};

export const reserveImageCredits = async (userId, body = {}) => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') return reserveSupabaseImageCredits(backend.supabase, userId, body);
  return reserveLocalImageCredits(userId, body);
};

export const releaseImageCreditReservation = async (userId, reservation = {}, reason = 'failed_image') => {
  const backend = getCreditBackend();
  if (backend.type === 'supabase') {
    return normalizeSupabaseCreditAccount(await releaseSupabaseImageCreditReservation(backend.supabase, userId, reservation, reason));
  }
  return releaseLocalImageCreditReservation(userId, reservation, reason);
};

const requireCreditAdmin = async (req) => {
  await verifySupabaseAdminRequest(req);
  return true;
};

const spendLocalCredits = (userId, amount, reason) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureLocalCreditAccount(store, userId);
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

const refundLocalCredits = (userId, amount, reason) => {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (!safeAmount) return;
  withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureLocalCreditAccount(store, userId);
    addCreditTransaction(account, {
      type: 'refund',
      amount: safeAmount,
      reason,
      at: new Date().toISOString(),
    });
    writeCreditStore(store);
  });
};

const grantLocalCredits = (userId, amount, reason) => {
  return withCreditStoreLock(() => {
    const store = readCreditStore();
    const account = ensureLocalCreditAccount(store, userId);
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

const getTransactionOrder = (entry = {}, index = 0) => {
  const time = new Date(entry.created_at || entry.createdAt || entry.at || '').getTime();
  return Number.isFinite(time) ? time : index;
};

const getStorageQuotaBytesFromReason = (reason = '', prefix = STORAGE_UPGRADE_REASON_PREFIX) => {
  const parts = String(reason || '').split(':');
  const rawBytes = prefix === STORAGE_QUOTA_SET_REASON_PREFIX ? parts[1] : parts[parts.length - 1];
  const bytes = Math.round(Number(rawBytes || 0));
  return Number.isFinite(bytes) ? Math.max(0, bytes) : 0;
};

const resolveStorageQuotaFromTransactionEntries = (transactions = []) => {
  const entries = Array.isArray(transactions) ? transactions : [];
  const latestAdminSet = entries.reduce((latest, entry, index) => {
    const reason = String(entry.reason || '');
    if (!reason.startsWith(STORAGE_QUOTA_SET_REASON_PREFIX)) return latest;
    const bytes = getStorageQuotaBytesFromReason(reason, STORAGE_QUOTA_SET_REASON_PREFIX);
    if (!bytes) return latest;
    const order = getTransactionOrder(entry, index);
    if (!latest || order >= latest.order) return { bytes, order };
    return latest;
  }, null);

  return entries.reduce((quota, entry, index) => {
    const reason = String(entry.reason || '');
    if (!reason.startsWith(STORAGE_UPGRADE_REASON_PREFIX)) return quota;
    if (latestAdminSet && getTransactionOrder(entry, index) < latestAdminSet.order) return quota;
    return Math.max(quota, getStorageQuotaBytesFromReason(reason));
  }, latestAdminSet?.bytes || FREE_STORAGE_BYTES);
};

const getSupabaseStorageQuotaTransactions = async (supabase, userId) => {
  const [upgradesResult, adminSetsResult] = await Promise.all([
    supabase
      .from('ai_credit_transactions')
      .select('reason, created_at')
      .eq('user_id', userId)
      .like('reason', `${STORAGE_UPGRADE_REASON_PREFIX}%`),
    supabase
      .from('ai_credit_transactions')
      .select('reason, created_at')
      .eq('user_id', userId)
      .like('reason', `${STORAGE_QUOTA_SET_REASON_PREFIX}%`),
  ]);

  if (upgradesResult.error) throw upgradesResult.error;
  if (adminSetsResult.error) throw adminSetsResult.error;
  return [...(upgradesResult.data || []), ...(adminSetsResult.data || [])];
};

export const getStorageQuotaFromTransactions = async (accountOrUserId = {}) => {
  if (typeof accountOrUserId === 'string') {
    const backend = getCreditBackend();
    if (backend.type === 'supabase') {
      return resolveStorageQuotaFromTransactionEntries(
        await getSupabaseStorageQuotaTransactions(backend.supabase, accountOrUserId),
      );
    }
    return getStorageQuotaFromTransactions(getLocalCreditAccount(accountOrUserId));
  }

  return resolveStorageQuotaFromTransactionEntries(accountOrUserId.transactions || []);
};

export const handleCredits = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = await resolveCreditUserId(req, { userId: url.searchParams.get('userId') });
  const account = await getCreditAccount(userId);
  const objectImageBatchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  sendJson(res, 200, {
    userId,
    balance: account.balance || 0,
    costs: aiCreditCosts,
    nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    objectImagesInCurrentBatch: toCount(account.objectImagesInCurrentBatch),
    objectImageBatchSize,
    storageQuotaBytes: await getStorageQuotaFromTransactions(userId),
    transactions: account.transactions || [],
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
  const account = await spendCredits(userId, credits, `storage_upgrade:${credits}:${storageQuotaBytes}`);
  sendJson(res, 200, {
    ok: true,
    balance: Number(account.balance || 0),
    storageQuotaBytes: await getStorageQuotaFromTransactions(userId),
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

  const account = await grantCredits(userId, amount, body.reason || 'manual_top_up');
  sendJson(res, 200, { userId, balance: account.balance, costs: aiCreditCosts });
};

export const handleCreditsAdminList = async (req, res) => {
  await requireCreditAdmin(req);

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data, error } = await supabase
      .from('ai_credits')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const users = await Promise.all((data || []).map(async (account) => ({
      ...normalizeSupabaseCreditAccount(account),
      storageQuotaBytes: await getStorageQuotaFromTransactions(account.user_id),
      transactions: await getRecentTransactions(supabase, account.user_id),
    })));

    sendJson(res, 200, {
      users,
      costs: aiCreditCosts,
      defaultCredits: Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0,
    });
    return;
  }

  const store = readCreditStore();
  const users = await Promise.all(Object.entries(store.users || {})
    .map(async ([userId, account]) => ({
      ...normalizeCreditAccount(userId, account),
      storageQuotaBytes: await getStorageQuotaFromTransactions(account),
    })));
  users.sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

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

  const supabase = getSupabaseAdminClient();
  if (action === 'set_storage_quota') {
    const requestedStorageQuotaBytes = Math.round(Number(body.storageQuotaBytes || 0));
    if (!Number.isFinite(requestedStorageQuotaBytes) || requestedStorageQuotaBytes <= 0) {
      sendJson(res, 400, { error: 'Quota de stockage invalide.' });
      return;
    }

    const storageQuotaBytes = Math.max(FREE_STORAGE_BYTES, requestedStorageQuotaBytes);
    const now = new Date().toISOString();
    const reason = `${STORAGE_QUOTA_SET_REASON_PREFIX}${storageQuotaBytes}`;

    if (supabase) {
      await ensureSupabaseCreditAccount(supabase, userId);
      const { data: updated, error: updateError } = await supabase
        .from('ai_credits')
        .update({ updated_at: now })
        .eq('user_id', userId)
        .select('*')
        .single();

      if (updateError) throw updateError;

      await addSupabaseCreditTransaction(supabase, userId, {
        type: 'admin_storage_quota',
        amount: 0,
        reason,
        createdAt: now,
      });

      sendJson(res, 200, {
        user: {
          ...normalizeSupabaseCreditAccount(updated),
          storageQuotaBytes: await getStorageQuotaFromTransactions(userId),
          transactions: await getRecentTransactions(supabase, userId),
        },
        costs: aiCreditCosts,
      });
      return;
    }

    const account = withCreditStoreLock(() => {
      const store = readCreditStore();
      const lockedAccount = ensureLocalCreditAccount(store, userId);
      lockedAccount.updatedAt = now;
      lockedAccount.transactions = [...(lockedAccount.transactions || []), {
        type: 'admin_storage_quota',
        amount: 0,
        reason,
        at: now,
      }].slice(-100);
      writeCreditStore(store);
      return lockedAccount;
    });

    sendJson(res, 200, {
      user: {
        ...normalizeCreditAccount(userId, account),
        storageQuotaBytes: await getStorageQuotaFromTransactions(account),
      },
      costs: aiCreditCosts,
    });
    return;
  }

  if (supabase) {
    const account = await ensureSupabaseCreditAccount(supabase, userId);
    const previousBalance = Number(account.balance || 0);
    const nextBalance = action === 'set'
      ? Math.max(0, amount)
      : Math.max(0, previousBalance + (action === 'subtract' ? -Math.abs(amount) : Math.abs(amount)));
    const signedAmount = nextBalance - previousBalance;
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('ai_credits')
      .update({
        balance: nextBalance,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    const transactionType = action === 'set' ? 'admin_set' : signedAmount < 0 ? 'admin_debit' : 'admin_grant';
    await addSupabaseCreditTransaction(supabase, userId, {
      type: transactionType,
      amount: signedAmount,
      reason: body.reason || `admin_${action}`,
      createdAt: now,
    });

    sendJson(res, 200, {
      user: {
        ...normalizeSupabaseCreditAccount(updated),
        storageQuotaBytes: await getStorageQuotaFromTransactions(userId),
        transactions: await getRecentTransactions(supabase, userId),
      },
      costs: aiCreditCosts,
    });
    return;
  }

  const account = withCreditStoreLock(() => {
    const store = readCreditStore();
    const lockedAccount = ensureLocalCreditAccount(store, userId);
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
    user: {
      ...normalizeCreditAccount(userId, account),
      storageQuotaBytes: await getStorageQuotaFromTransactions(account),
    },
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

  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const { data: existingSale, error: existingSaleError } = await supabase
      .from('ai_credit_transactions')
      .select('id, user_id, amount')
      .eq('reason', `gumroad:${saleId}`)
      .maybeSingle();

    if (existingSaleError) throw existingSaleError;
    if (existingSale) {
      sendJson(res, 200, { ok: true, duplicate: true, saleId, userId: existingSale.user_id });
      return;
    }

    const account = await addSupabaseCredits(supabase, userId, pack.credits, `gumroad:${saleId}`, 'grant');
    sendJson(res, 200, {
      ok: true,
      saleId,
      userId,
      creditsAdded: pack.credits,
      balance: Number(account.balance || 0),
    });
    return;
  }

  if (!isLocalCreditAuthAllowed(process.env)) {
    sendJson(res, 503, {
      ok: false,
      error: 'Supabase est requis pour les credits IA. Active ALLOW_LOCAL_CREDIT_AUTH=true uniquement en developpement local pour utiliser le fichier fallback.',
      code: 'SUPABASE_CREDITS_REQUIRED',
    });
    return;
  }

  const gumroadResult = withCreditStoreLock(() => {
    const store = readCreditStore();
    if (store.gumroadSales[saleId]) {
      return { duplicate: true };
    }

    const account = ensureLocalCreditAccount(store, userId);
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
