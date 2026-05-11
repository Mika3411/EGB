import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { assertAiRateLimit, getAiRateLimitConfig, getClientIpFromHeaders } from '../../src/utils/aiRateLimit.js';
import { assertAiContentAllowed, makeImageModerationInput } from '../../src/utils/aiModeration.js';
import { assertCorsRequestAllowed, makeCorsHeaders } from '../../src/utils/corsConfig.js';
import { assertProjectSafety, parseProjectJsonPayload } from '../../src/utils/projectSafetyValidation.js';

export const ADMIN_EMAIL = String(process.env.ADMIN_EMAIL || process.env.VITE_ADMIN_EMAIL || 'thorez.m@hotmail.fr')
  .trim()
  .toLowerCase();

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

export const defaultAiCredits = Number(process.env.AI_DEFAULT_CREDITS || 20);
export const aiJobBucket = process.env.SUPABASE_STORAGE_BUCKET || process.env.VITE_SUPABASE_STORAGE_BUCKET || 'escape-game-assets';

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

export const calculateImageCreditCost = (account = {}, body = {}) => {
  if (body.type !== 'item') return aiCreditCosts.image;
  if (body.variant === 'thumbnail') return aiCreditCosts.objectThumbnail;
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  const usedInBatch = toCount(account.object_images_in_current_batch);
  return usedInBatch % batchSize === 0 ? aiCreditCosts.objectImageBatchCost : 0;
};

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const corsEventStore = new AsyncLocalStorage();

export const json = (statusCode, payload, event = corsEventStore.getStore()) => ({
  statusCode,
  headers: makeCorsHeaders(event?.headers || {}, process.env, {
    'Content-Type': 'application/json; charset=utf-8',
  }),
  body: JSON.stringify(payload),
});

export const optionsResponse = (event) => json(204, {}, event);

export const getSupabaseAdminClient = () => {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceRoleKey) {
    const error = new Error('Configuration Supabase admin manquante.');
    error.statusCode = 500;
    throw error;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

export const getBearerToken = (event) => {
  const authorization = event.headers.authorization || event.headers.Authorization || '';
  return String(authorization).replace(/^Bearer\s+/i, '').trim();
};

export const verifyAdmin = async (event) => {
  const token = getBearerToken(event);
  if (!token) {
    const error = new Error('Session admin manquante.');
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || normalizeEmail(data.user?.email) !== ADMIN_EMAIL) {
    const accessError = new Error('Acces admin refuse.');
    accessError.statusCode = 403;
    throw accessError;
  }

  return data.user;
};

export const sanitizeCreditUserId = (value = '') =>
  String(value).trim().replace(/[^a-zA-Z0-9._:@-]/g, '-') || 'anonymous';

export const verifyUser = async (event) => {
  const token = getBearerToken(event);
  if (!token) {
    const error = new Error('Session manquante.');
    error.statusCode = 401;
    throw error;
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user?.id) {
    const accessError = new Error('Session invalide.');
    accessError.statusCode = 401;
    throw accessError;
  }

  return data.user;
};

export const parseBody = (event) => {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch {
    const error = new Error('Payload invalide.');
    error.statusCode = 400;
    throw error;
  }
};

export const getCreditUserId = (event, body = {}) => {
  const raw = event.headers['x-ai-user-id'] || event.headers['X-AI-User-Id'] || body.userId || 'anonymous';
  return sanitizeCreditUserId(raw);
};

export const resolveCreditUserId = async (event) => {
  const user = await verifyUser(event);
  return sanitizeCreditUserId(user.id || user.email);
};

export const normalizeCreditAccount = (account = {}) => ({
  userId: account.user_id,
  balance: Number(account.balance || 0),
  objectImagesInCurrentBatch: Number(account.object_images_in_current_batch || 0),
  createdAt: account.created_at || '',
  updatedAt: account.updated_at || '',
  transactions: account.transactions || [],
});

export const ensureCreditAccount = async (supabase, userId) => {
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
  const { data: inserted, error: insertError } = await supabase
    .from('ai_credits')
    .insert({
      user_id: userId,
      balance: Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0,
      object_images_in_current_batch: 0,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (insertError) throw insertError;

  await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    type: 'grant',
    amount: inserted.balance,
    reason: 'initial_balance',
    created_at: now,
  });

  return inserted;
};

export const getRecentTransactions = async (supabase, userId) => {
  const { data, error } = await supabase
    .from('ai_credit_transactions')
    .select('type, amount, reason, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data || []).map((entry) => ({
    type: entry.type,
    amount: Number(entry.amount || 0),
    reason: entry.reason || '',
    at: entry.created_at || '',
  }));
};

export const getAiJobPath = (jobId) => `ai-jobs/${String(jobId || '').replace(/[^a-zA-Z0-9._-]/g, '-')}.json`;

export const writeAiJob = async (supabase, job = {}) => {
  const payload = {
    ...job,
    updatedAt: new Date().toISOString(),
  };
  const { error } = await supabase.storage
    .from(aiJobBucket)
    .upload(getAiJobPath(payload.id), Buffer.from(JSON.stringify(payload)), {
      upsert: true,
      contentType: 'application/json; charset=utf-8',
      cacheControl: '0',
    });

  if (error) throw error;
  return payload;
};

export const readAiJob = async (supabase, jobId) => {
  const { data, error } = await supabase.storage.from(aiJobBucket).download(getAiJobPath(jobId));
  if (error) {
    const notFound = new Error('Job IA introuvable.');
    notFound.statusCode = 404;
    throw notFound;
  }
  return JSON.parse(await data.text());
};

export const addCreditTransaction = async (supabase, userId, transaction = {}) => {
  const { error } = await supabase.from('ai_credit_transactions').insert({
    user_id: userId,
    type: transaction.type || 'spend',
    amount: Number(transaction.amount || 0),
    reason: transaction.reason || '',
    created_at: transaction.createdAt || new Date().toISOString(),
  });
  if (error) throw error;
};

export const updateCreditAccount = async (supabase, userId, patch = {}) => {
  const { data, error } = await supabase
    .from('ai_credits')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
};

export const spendCredits = async (supabase, userId, amount, reason) => {
  const cost = Math.max(0, Math.round(Number(amount || 0)));
  if (cost <= 0) return ensureCreditAccount(supabase, userId);

  let lastBalance = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await ensureCreditAccount(supabase, userId);
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
      await addCreditTransaction(supabase, userId, {
        type: 'spend',
        amount: -cost,
        reason,
      });
      return updated;
    }
  }

  const error = new Error('Credits IA insuffisants.');
  error.statusCode = 402;
  error.code = 'AI_CREDITS_INSUFFICIENT';
  error.balance = lastBalance;
  error.required = cost;
  throw error;
};

export const refundCredits = async (supabase, userId, amount, reason) => {
  const cost = Math.max(0, Math.round(Number(amount || 0)));
  if (cost <= 0) return ensureCreditAccount(supabase, userId);
  const account = await ensureCreditAccount(supabase, userId);
  const updated = await updateCreditAccount(supabase, userId, {
    balance: Number(account.balance || 0) + cost,
  });
  await addCreditTransaction(supabase, userId, {
    type: 'refund',
    amount: cost,
    reason,
  });
  return updated;
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

const hasCreditTransaction = async (supabase, userId, transaction = {}) => {
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

const refundImageCreditReservation = async (supabase, userId, reservation = {}, reason = 'failed_image') => {
  const cost = Math.max(0, Math.round(Number(reservation.cost || 0)));
  if (cost <= 0) return ensureCreditAccount(supabase, userId);

  const refundReason = getReservationRefundReason(reason, reservation);
  if (reservation.id && await hasCreditTransaction(supabase, userId, {
    type: 'refund',
    amount: cost,
    reason: refundReason,
  })) {
    return ensureCreditAccount(supabase, userId);
  }

  return refundCredits(supabase, userId, cost, refundReason);
};

export const reserveImageCredits = async (supabase, userId, body = {}) => {
  const reservationId = makeImageCreditReservationId();
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  const advancesBatch = body.type === 'item' && body.variant !== 'thumbnail';
  let lastBalance = 0;
  let required = 0;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const account = await ensureCreditAccount(supabase, userId);
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
        account,
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
        await addCreditTransaction(supabase, userId, {
          type: 'spend',
          amount: -cost,
          reason: `image:${body.type || 'image'}`,
        });
      }
      return {
        id: reservationId,
        account: updated,
        cost,
        batchSize,
        advancesBatch,
        previousBatchCount,
        nextBatchCount,
      };
    }
  }

  const error = new Error('Credits IA insuffisants.');
  error.statusCode = 402;
  error.code = 'AI_CREDITS_INSUFFICIENT';
  error.balance = lastBalance;
  error.required = required;
  throw error;
};

const rollbackImageBatchReservation = async (supabase, userId, reservation = {}) => {
  if (!reservation.advancesBatch) return ensureCreditAccount(supabase, userId);
  const batchSize = Math.max(1, toCount(reservation.batchSize) || 1);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const account = await ensureCreditAccount(supabase, userId);
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
  return ensureCreditAccount(supabase, userId);
};

export const releaseImageCreditReservation = async (supabase, userId, reservation = {}, reason = 'failed_image') => {
  const refundedAccount = await refundImageCreditReservation(supabase, userId, reservation, reason);
  try {
    return await rollbackImageBatchReservation(supabase, userId, reservation);
  } catch (error) {
    if (Number(reservation.cost || 0) > 0) return refundedAccount;
    throw error;
  }
};

const sanitizeRateLimitIdentity = (value = '') => String(value || '')
  .trim()
  .replace(/[^a-zA-Z0-9_.:@-]/g, '-')
  .slice(0, 160) || 'unknown';

const assertSupabaseAiRateLimit = async (supabase, event, userId, kind = 'text') => {
  const config = getAiRateLimitConfig(process.env, kind);
  if (config.disabled) return { ok: true, skipped: true };

  const ip = getClientIpFromHeaders(event?.headers || {});
  const keys = [
    `ai:${kind}:user:${sanitizeRateLimitIdentity(userId || 'anonymous')}`,
    `ai:${kind}:ip:${sanitizeRateLimitIdentity(ip || 'unknown')}`,
  ];
  const limits = [config.userLimit, config.ipLimit];
  const { data, error } = await supabase.rpc('consume_ai_rate_limits', {
    p_keys: keys,
    p_limits: limits,
    p_window_seconds: Math.max(1, Math.ceil(config.windowMs / 1000)),
  });

  if (error) {
    if (String(process.env.AI_RATE_LIMIT_REQUIRE_PERSISTENT || '').toLowerCase() === 'true') {
      throw error;
    }
    return assertAiRateLimit({ kind, userId, ip, env: process.env });
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result && result.allowed === false) {
    const rateError = new Error('Trop de requetes IA. Reessaie dans un instant.');
    rateError.statusCode = 429;
    rateError.status = 429;
    rateError.code = 'AI_RATE_LIMITED';
    rateError.retryAfter = Math.max(1, Math.ceil(Number(result.retry_after || 1)));
    rateError.scope = String(result.blocked_key || '').includes(':ip:') ? 'ip' : 'user';
    throw rateError;
  }

  return { ok: true };
};

export const assertAiRequestRateLimit = async (event, userId, kind = 'text', supabase = null) => {
  if (supabase) return assertSupabaseAiRateLimit(supabase, event, userId, kind);
  return assertAiRateLimit({
    kind,
    userId,
    ip: getClientIpFromHeaders(event?.headers || {}),
    env: process.env,
  });
};

export const openaiFetch = async (path, body) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY manquant.');
    error.statusCode = 500;
    throw error;
  }

  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message || `Erreur OpenAI ${response.status}.`;
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
};

export const buildTextGenerationInput = (body = {}) => [
  'Tu dois repondre uniquement avec un JSON valide, sans Markdown ni commentaire.',
  body.prompt,
].filter(Boolean).join('\n\n');

export const assertAiTextPromptAllowed = (input) => assertAiContentAllowed({
  input,
  openaiFetch,
  env: process.env,
  stage: 'input_text',
});

export const assertAiGeneratedTextAllowed = (outputText) => assertAiContentAllowed({
  input: outputText,
  openaiFetch,
  env: process.env,
  stage: 'output_text',
});

export const assertAiImagePromptAllowed = (prompt) => assertAiContentAllowed({
  input: String(prompt || ''),
  openaiFetch,
  env: process.env,
  stage: 'input_image',
});

export const assertAiGeneratedImageAllowed = (imageData, contextText = '') => assertAiContentAllowed({
  input: makeImageModerationInput(imageData, contextText),
  openaiFetch,
  env: process.env,
  stage: 'output_image',
});

export const extractOutputText = (payload = {}) => {
  if (payload.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
      if (content.type === 'text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
};

export const parseOpenAiProjectJson = (outputText = '') => {
  const project = parseProjectJsonPayload(outputText);
  assertProjectSafety(project, { mode: 'ai' });
  return project;
};

export const withErrors = async (event, callback) => {
  return corsEventStore.run(event, async () => {
    try {
      assertCorsRequestAllowed(event.headers || {}, process.env);
      if (event.httpMethod === 'OPTIONS') return optionsResponse(event);
      return await callback();
    } catch (error) {
      return json(error.statusCode || error.status || 500, {
        error: error.message || 'Erreur serveur.',
        code: error.code,
        balance: error.balance,
        required: error.required,
        retryAfter: error.retryAfter,
      }, event);
    }
  });
};
