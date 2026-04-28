import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const rootDir = fileURLToPath(new URL('.', import.meta.url));
const publicDir = resolve(rootDir, 'dist');
const port = Number(process.env.PORT || 8787);
const ADMIN_EMAIL = 'thorez.m@hotmail.fr';

const loadEnvFile = () => {
  const envPath = join(rootDir, '.env');
  if (!existsSync(envPath)) return;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
    const [key, ...valueParts] = trimmed.split('=');
    const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = value;
  }
};

loadEnvFile();

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabaseAdminClient = null;

const creditStorePath = process.env.AI_CREDITS_FILE || join(rootDir, '.data', 'ai-credits.json');
const defaultAiCredits = Number(process.env.AI_DEFAULT_CREDITS || 20);
const aiCreditCosts = {
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

const toCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
};

const calculateProjectGenerationCost = (brief = {}) => {
  const units = aiCreditCosts.projectGeneration;
  return Math.max(1, Math.ceil(
    toCount(brief.actCount) * units.act
    + toCount(brief.sceneCount) * units.scene
    + toCount(brief.enigmaCount) * units.enigma
    + toCount(brief.cinematicCount) * units.cinematic
    + toCount(brief.itemCount) * units.item,
  ));
};

const calculateTextCreditCost = (body = {}) => (
  body.mode === 'repair_item_names' ? 0
    : body.mode === 'generate' ? calculateProjectGenerationCost(body.brief || {})
      : aiCreditCosts.text
);

const jsonHeaders = {
  'Content-Type': 'application/json; charset=utf-8',
  'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-AI-User-Id',
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};

const sendJson = (res, status, payload) => {
  res.writeHead(status, jsonHeaders);
  res.end(JSON.stringify(payload));
};

const readJsonBody = (req) => new Promise((resolveBody, rejectBody) => {
  let raw = '';
  req.on('data', (chunk) => {
    raw += chunk;
    if (raw.length > 20 * 1024 * 1024) {
      req.destroy();
      rejectBody(new Error('Payload trop volumineux.'));
    }
  });
  req.on('end', () => {
    try {
      const contentType = String(req.headers['content-type'] || '').toLowerCase();
      if (!raw) {
        resolveBody({});
        return;
      }
      if (contentType.includes('application/x-www-form-urlencoded')) {
        resolveBody(Object.fromEntries(new URLSearchParams(raw)));
        return;
      }
      resolveBody(JSON.parse(raw));
    } catch {
      rejectBody(new Error('Payload invalide.'));
    }
  });
  req.on('error', rejectBody);
});

const readCreditStore = () => {
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

const writeCreditStore = (store) => {
  mkdirSync(join(creditStorePath, '..'), { recursive: true });
  writeFileSync(creditStorePath, JSON.stringify(store, null, 2));
};

const getCreditUserId = (req, body = {}) => {
  const fromHeader = req.headers['x-ai-user-id'];
  const raw = Array.isArray(fromHeader) ? fromHeader[0] : fromHeader || body.userId || 'anonymous';
  return String(raw).trim().replace(/[^a-zA-Z0-9._:@-]/g, '-') || 'anonymous';
};

const normalizeEmail = (value = '') => String(value).trim().toLowerCase();

const getSupabaseAdminClient = () => {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  if (!supabaseAdminClient) {
    supabaseAdminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminClient;
};

const getBearerToken = (req) => {
  const authorization = req.headers.authorization || '';
  const value = Array.isArray(authorization) ? authorization[0] : authorization;
  return String(value).replace(/^Bearer\s+/i, '').trim();
};

const verifySupabaseAdminRequest = async (req) => {
  const client = getSupabaseAdminClient();
  if (!client) {
    const error = new Error('Configuration Supabase admin manquante.');
    error.status = 500;
    throw error;
  }

  const token = getBearerToken(req);
  if (!token) {
    const error = new Error('Session admin manquante.');
    error.status = 401;
    throw error;
  }

  const { data, error } = await client.auth.getUser(token);
  if (error || normalizeEmail(data.user?.email) !== ADMIN_EMAIL) {
    const accessError = new Error('Acces admin refuse.');
    accessError.status = 403;
    throw accessError;
  }

  return data.user;
};

const ensureCreditAccount = (store, userId) => {
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

const getCreditAccount = (userId) => {
  const store = readCreditStore();
  const account = ensureCreditAccount(store, userId);
  writeCreditStore(store);
  return account;
};

const calculateImageCreditCost = (account, body = {}) => {
  if (body.type !== 'item') return aiCreditCosts.image;
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 5);
  const usedInBatch = toCount(account.objectImagesInCurrentBatch);
  return usedInBatch % batchSize === 0 ? aiCreditCosts.objectImageBatchCost : 0;
};

const commitImageCreditUsage = (userId, body = {}, cost = 0) => {
  const store = readCreditStore();
  const account = ensureCreditAccount(store, userId);
  if (body.type === 'item') {
    const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 5);
    account.objectImagesInCurrentBatch = (toCount(account.objectImagesInCurrentBatch) + 1) % batchSize;
    account.updatedAt = new Date().toISOString();
  }
  if (cost > 0) {
    const lastTransaction = (account.transactions || [])[account.transactions.length - 1];
    if (lastTransaction?.reason?.startsWith('image:item')) {
      lastTransaction.batchProgress = `${account.objectImagesInCurrentBatch || batchSize}/${batchSize}`;
    }
  }
  writeCreditStore(store);
  return account;
};

const addCreditTransaction = (account, transaction) => {
  account.balance = Math.max(0, Number(account.balance || 0) + Number(transaction.amount || 0));
  account.updatedAt = transaction.at;
  account.transactions = [...(account.transactions || []), transaction].slice(-100);
};

const normalizeCreditAccount = (userId, account = {}) => ({
  userId,
  balance: Number(account.balance || 0),
  objectImagesInCurrentBatch: toCount(account.objectImagesInCurrentBatch),
  createdAt: account.createdAt || '',
  updatedAt: account.updatedAt || '',
  transactions: (account.transactions || []).slice(-10).reverse(),
});

const requireCreditAdmin = async (req, body = {}) => {
  const adminKey = process.env.AI_CREDIT_ADMIN_KEY || '';
  const headerKey = req.headers.authorization?.replace(/^Bearer\s+/i, '') || req.headers['x-admin-key'];
  const providedKey = Array.isArray(headerKey) ? headerKey[0] : headerKey || body.adminKey || '';
  if (adminKey && providedKey === adminKey) return true;

  await verifySupabaseAdminRequest(req);
  return true;
};

const spendCredits = (userId, amount, reason) => {
  const store = readCreditStore();
  const account = ensureCreditAccount(store, userId);
  const safeAmount = Math.max(0, Number(amount || 0));
  if (safeAmount > 0 && Number(account.balance || 0) < safeAmount) {
    const error = new Error(`Crédits IA insuffisants (${account.balance || 0}/${safeAmount}).`);
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
};

const refundCredits = (userId, amount, reason) => {
  const safeAmount = Math.max(0, Number(amount || 0));
  if (!safeAmount) return;
  const store = readCreditStore();
  const account = ensureCreditAccount(store, userId);
  addCreditTransaction(account, {
    type: 'refund',
    amount: safeAmount,
    reason,
    at: new Date().toISOString(),
  });
  writeCreditStore(store);
};

const grantCredits = (userId, amount, reason) => {
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
};

const handleCredits = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const userId = getCreditUserId(req, { userId: url.searchParams.get('userId') });
  const account = getCreditAccount(userId);
  const objectImageBatchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 5);
  sendJson(res, 200, {
    userId,
    balance: account.balance || 0,
    costs: aiCreditCosts,
    nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    objectImagesInCurrentBatch: toCount(account.objectImagesInCurrentBatch),
    objectImageBatchSize,
    transactions: (account.transactions || []).slice(-10).reverse(),
  });
};

const handleCreditTopUp = async (req, res) => {
  const body = await readJsonBody(req);
  await requireCreditAdmin(req, body);

  const userId = getCreditUserId(req, body);
  const amount = Math.max(0, Math.round(Number(body.amount || 0)));
  if (!amount) {
    sendJson(res, 400, { error: 'Montant de crédits invalide.' });
    return;
  }

  const account = grantCredits(userId, amount, body.reason || 'manual_top_up');
  sendJson(res, 200, { userId, balance: account.balance, costs: aiCreditCosts });
};

const handleCreditsAdminList = async (req, res) => {
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

const handleCreditsAdminUpdate = async (req, res) => {
  const body = await readJsonBody(req);
  await requireCreditAdmin(req, body);

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

  const store = readCreditStore();
  const account = ensureCreditAccount(store, userId);
  const now = new Date().toISOString();
  const reason = body.reason || `admin_${action}`;

  if (action === 'set') {
    const previousBalance = Number(account.balance || 0);
    const nextBalance = Math.max(0, amount);
    account.balance = nextBalance;
    account.updatedAt = now;
    account.transactions = [...(account.transactions || []), {
      type: 'admin_set',
      amount: nextBalance - previousBalance,
      previousBalance,
      nextBalance,
      reason,
      at: now,
    }].slice(-100);
  } else {
    const signedAmount = action === 'subtract' ? -Math.abs(amount) : Math.abs(amount);
    addCreditTransaction(account, {
      type: signedAmount < 0 ? 'admin_debit' : 'admin_grant',
      amount: signedAmount,
      reason,
      at: now,
    });
  }

  writeCreditStore(store);
  sendJson(res, 200, {
    user: normalizeCreditAccount(userId, account),
    costs: aiCreditCosts,
  });
};

const supabaseUserToAdminRecord = (user) => ({
  id: user.id,
  email: user.email || '',
  name: user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
  provider: 'supabase',
  createdAt: user.created_at || '',
  updatedAt: user.updated_at || '',
  lastSignInAt: user.last_sign_in_at || '',
  bannedUntil: user.banned_until || '',
  isDisabled: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
});

const handleAdminUsers = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;
  const users = (data.users || [])
    .map(supabaseUserToAdminRecord)
    .filter((account) => normalizeEmail(account.email) !== ADMIN_EMAIL)
    .sort((a, b) => normalizeEmail(a.email).localeCompare(normalizeEmail(b.email), 'fr'));

  sendJson(res, 200, { users });
};

const handleAdminUserUpdate = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  const body = await readJsonBody(req);
  const userId = String(body.userId || '').trim();
  if (!userId) {
    sendJson(res, 400, { error: 'Utilisateur manquant.' });
    return;
  }

  const client = getSupabaseAdminClient();
  const action = String(body.action || '');
  const attributes = {};

  if (action === 'disable') attributes.ban_duration = '876000h';
  if (action === 'enable') attributes.ban_duration = 'none';

  if (!Object.keys(attributes).length) {
    sendJson(res, 400, { error: 'Action admin inconnue.' });
    return;
  }

  const { data, error } = await client.auth.admin.updateUserById(userId, attributes);
  if (error) throw error;
  sendJson(res, 200, { user: supabaseUserToAdminRecord(data.user) });
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
    permalink: process.env.GUMROAD_PACK_250_PERMALINK || '',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_500_CREDITS || 500),
    productId: process.env.GUMROAD_PACK_500_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_500_PERMALINK || '',
  },
  {
    credits: Number(process.env.GUMROAD_PACK_1000_CREDITS || 1000),
    productId: process.env.GUMROAD_PACK_1000_PRODUCT_ID || '',
    permalink: process.env.GUMROAD_PACK_1000_PERMALINK || '',
  },
].filter((pack) => pack.credits > 0 && (pack.productId || pack.permalink));

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
  const permalink = String(body.product_permalink || body.permalink || '').trim();
  const productName = String(body.product_name || body.product || '').toLowerCase();
  return gumroadPacks.find((pack) => (
    (pack.productId && pack.productId === productId)
    || (pack.permalink && pack.permalink === permalink)
    || (pack.permalink && productName.includes(pack.permalink.toLowerCase()))
  ));
};

const handleGumroadWebhook = async (req, res) => {
  const body = await readJsonBody(req);
  const expectedSecret = process.env.GUMROAD_WEBHOOK_SECRET || '';
  if (expectedSecret && body.secret !== expectedSecret) {
    sendJson(res, 403, { ok: false, error: 'Secret Gumroad invalide.' });
    return;
  }

  const saleId = String(body.sale_id || body.id || body.order_number || '').trim();
  if (!saleId) {
    sendJson(res, 400, { ok: false, error: 'sale_id Gumroad manquant.' });
    return;
  }

  const store = readCreditStore();
  if (store.gumroadSales[saleId]) {
    sendJson(res, 200, { ok: true, duplicate: true, saleId });
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

  const account = ensureCreditAccount(store, userId);
  addCreditTransaction(account, {
    type: 'grant',
    amount: pack.credits,
    reason: `gumroad:${saleId}`,
    at: new Date().toISOString(),
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
    processedAt: new Date().toISOString(),
  };
  writeCreditStore(store);

  sendJson(res, 200, {
    ok: true,
    saleId,
    userId,
    creditsAdded: pack.credits,
    balance: account.balance,
  });
};

const openaiFetch = async (path, body) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY manquant.');
    error.status = 500;
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
    error.status = response.status;
    throw error;
  }
  return payload;
};

const extractOutputText = (payload) => {
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

const handleGenerate = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = getCreditUserId(req, body);
  const cost = calculateTextCreditCost(body);
  const input = [
    'Tu dois repondre uniquement avec un JSON valide, sans Markdown ni commentaire.',
    body.prompt,
  ].filter(Boolean).join('\n\n');

  spendCredits(userId, cost, `text:${body.mode || 'generate'}`);
  let payload;
  try {
    payload = await openaiFetch('responses', {
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.2',
      input,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 12000),
    });
  } catch (error) {
    refundCredits(userId, cost, `failed_text:${body.mode || 'generate'}`);
    throw error;
  }

  const outputText = extractOutputText(payload);
  const account = getCreditAccount(userId);
  sendJson(res, 200, {
    output_text: outputText,
    requestId: payload.id,
    credits: {
      balance: account.balance || 0,
      cost,
      costs: aiCreditCosts,
      nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    },
  });
};

const handleImage = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = getCreditUserId(req, body);
  const accountBeforeImage = getCreditAccount(userId);
  const cost = calculateImageCreditCost(accountBeforeImage, body);
  spendCredits(userId, cost, `image:${body.type || 'image'}`);
  let payload;
  try {
    payload = await openaiFetch('images/generations', {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt: body.prompt,
      size: process.env.OPENAI_IMAGE_SIZE || '1536x1024',
      quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
      n: 1,
    });
  } catch (error) {
    refundCredits(userId, cost, `failed_image:${body.type || 'image'}`);
    throw error;
  }

  const image = payload.data?.[0] || {};
  const imageData = image.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : image.url;

  if (!imageData) {
    refundCredits(userId, cost, `failed_image:${body.type || 'image'}`);
    const error = new Error('OpenAI n\'a pas renvoye d\'image.');
    error.status = 502;
    throw error;
  }

  const account = commitImageCreditUsage(userId, body, cost);
  sendJson(res, 200, {
    imageData,
    imageName: `${body.type || 'image'}-${body.entity?.id || Date.now()}.png`,
    elements: [],
    credits: {
      balance: account.balance || 0,
      cost,
      costs: aiCreditCosts,
      nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    },
  });
};

const serveStatic = (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestedPath = decodeURIComponent(url.pathname);
  const filePath = requestedPath === '/'
    ? join(publicDir, 'index.html')
    : resolve(publicDir, `.${requestedPath}`);

  const safePath = filePath.startsWith(publicDir) ? filePath : join(publicDir, 'index.html');
  const finalPath = existsSync(safePath) && !safePath.endsWith('\\')
    ? safePath
    : join(publicDir, 'index.html');

  if (!existsSync(finalPath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Build introuvable. Lance npm run build avant npm start.');
    return;
  }

  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(finalPath)] || 'application/octet-stream',
  });
  res.end(readFileSync(finalPath));
};

const server = createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, jsonHeaders);
      res.end();
      return;
    }

    if (req.url === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/admin/users')) {
      await handleAdminUsers(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/admin/users') {
      await handleAdminUserUpdate(req, res);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/ai-credits/admin')) {
      await handleCreditsAdminList(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai-credits/top-up') {
      await handleCreditTopUp(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai-credits/admin') {
      await handleCreditsAdminUpdate(req, res);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/ai-credits')) {
      await handleCredits(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/gumroad/webhook') {
      await handleGumroadWebhook(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
      await handleGenerate(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/image') {
      await handleImage(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || 'Erreur serveur.',
      code: error.code,
      balance: error.balance,
      required: error.required,
    });
  }
});

server.listen(port, () => {
  console.log(`Escape Game Builder API listening on ${port}`);
});
