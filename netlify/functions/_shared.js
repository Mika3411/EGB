import { createClient } from '@supabase/supabase-js';

export const ADMIN_EMAIL = 'thorez.m@hotmail.fr';

export const aiCreditCosts = {
  text: Number(process.env.AI_TEXT_CREDIT_COST || 2),
  image: Number(process.env.AI_IMAGE_CREDIT_COST || 5),
  objectImageBatchSize: Number(process.env.AI_OBJECT_IMAGE_BATCH_SIZE || 5),
  objectImageBatchCost: Number(process.env.AI_OBJECT_IMAGE_BATCH_COST || 1),
  projectGeneration: {
    act: Number(process.env.AI_PROJECT_ACT_CREDIT_COST || 2),
    scene: Number(process.env.AI_PROJECT_SCENE_CREDIT_COST || 1),
    enigma: Number(process.env.AI_PROJECT_ENIGMA_CREDIT_COST || 1),
    cinematic: Number(process.env.AI_PROJECT_CINEMATIC_CREDIT_COST || 1),
    item: Number(process.env.AI_PROJECT_ITEM_CREDIT_COST || 1),
  },
};

export const defaultAiCredits = Number(process.env.AI_DEFAULT_CREDITS || 20);

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

export const withErrors = async (event, callback) => {
  if (event.httpMethod === 'OPTIONS') return optionsResponse();
  try {
    return await callback();
  } catch (error) {
    return json(error.statusCode || error.status || 500, {
      error: error.message || 'Erreur serveur.',
      code: error.code,
    });
  }
};
