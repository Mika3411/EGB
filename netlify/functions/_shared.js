import { createClient } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'thorez.m@hotmail.fr';

export const aiCreditCosts = {
  text: Number(process.env.AI_TEXT_CREDIT_COST || 2),
  image: Number(process.env.AI_IMAGE_CREDIT_COST || 5),
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
    : body.mode === 'generate' ? calculateProjectGenerationCost(body.brief || {})
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

export const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-AI-User-Id',
  },
  body: JSON.stringify(payload),
});

export const optionsResponse = () => json(204, {});

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
  return String(raw).trim().replace(/[^a-zA-Z0-9._:@-]/g, '-') || 'anonymous';
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
  if (data) return data;

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
  const account = await ensureCreditAccount(supabase, userId);
  const cost = Math.max(0, Math.round(Number(amount || 0)));
  if (cost <= 0) return account;
  if (Number(account.balance || 0) < cost) {
    const error = new Error('Credits IA insuffisants.');
    error.statusCode = 402;
    error.code = 'AI_CREDITS_INSUFFICIENT';
    error.balance = Number(account.balance || 0);
    error.required = cost;
    throw error;
  }

  const updated = await updateCreditAccount(supabase, userId, {
    balance: Number(account.balance || 0) - cost,
  });
  await addCreditTransaction(supabase, userId, {
    type: 'spend',
    amount: -cost,
    reason,
  });
  return updated;
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

export const commitImageCreditUsage = async (supabase, userId, body = {}) => {
  const account = await ensureCreditAccount(supabase, userId);
  if (body.type !== 'item' || body.variant === 'thumbnail') return account;
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  return updateCreditAccount(supabase, userId, {
    object_images_in_current_batch: (toCount(account.object_images_in_current_batch) + 1) % batchSize,
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

export const withErrors = async (event, callback) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  try {
    return await callback();
  } catch (error) {
    return json(error.statusCode || error.status || 500, {
      error: error.message || 'Erreur serveur.',
      code: error.code,
      balance: error.balance,
      required: error.required,
    });
  }
};
