import {
  ensureCreditAccount,
  getSupabaseAdminClient,
  json,
  normalizeEmail,
  normalizeCreditAccount,
  withErrors,
} from './_shared.js';

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
].filter((pack) => pack.credits > 0);

const parseBody = (event) => {
  if (!event.body) return {};
  const raw = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  const contentType = String(event.headers['content-type'] || event.headers['Content-Type'] || '').toLowerCase();

  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(raw));
  }

  try {
    return JSON.parse(raw);
  } catch {
    return Object.fromEntries(new URLSearchParams(raw));
  }
};

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
    || body['url_params[user_id]']
    || body['url_params[purchase_id]']
    || customFields.user_id
    || customFields.userId
    || customFields['Identifiant achat']
    || customFields['identifiant achat']
    || body.email
    || '';
};

const getGumroadBuyerEmail = (body = {}) => normalizeEmail(body.email || body.email_address || body.buyer_email || '');

const resolveSupabaseUserIdByEmail = async (supabase, email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return '';

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw error;

  return (data.users || []).find((user) => normalizeEmail(user.email) === normalizedEmail)?.id || '';
};

const sanitizeCreditUserId = (value = '') => String(value).trim().replace(/[^a-zA-Z0-9._:@-]/g, '-') || 'anonymous';

const normalizePermalink = (value = '') => String(value).trim().split('/').filter(Boolean).pop() || '';

const getGumroadPack = (body = {}) => {
  const productId = String(body.product_id || '').trim();
  const permalink = normalizePermalink(body.product_permalink || body.permalink || body.short_product_id).toLowerCase();
  const productName = String(body.product_name || body.product || '').toLowerCase();

  return gumroadPacks.find((pack) => (
    (pack.productId && pack.productId === productId)
    || (pack.permalink && pack.permalink.toLowerCase() === permalink)
    || (pack.permalink && productName.includes(pack.permalink.toLowerCase()))
    || (pack.credits && productName.includes(`pack ${pack.credits}`))
  ));
};

const findExistingSale = async (supabase, saleId) => {
  const { data, error } = await supabase
    .from('ai_credit_transactions')
    .select('id, user_id')
    .eq('reason', `gumroad:${saleId}`)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const getCreditAccount = async (supabase, userId) => {
  const { data, error } = await supabase
    .from('ai_credits')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const setCreditBalance = async (supabase, userId, balance) => {
  const { error } = await supabase
    .from('ai_credits')
    .update({ balance: Math.max(0, Number(balance || 0)), updated_at: new Date().toISOString() })
    .eq('user_id', userId);

  if (error) throw error;
};

const reassignExistingSale = async (supabase, existingSale, nextUserId, credits) => {
  const targetAccount = await ensureCreditAccount(supabase, nextUserId);
  const sourceAccount = await getCreditAccount(supabase, existingSale.user_id);

  const { error: transactionError } = await supabase
    .from('ai_credit_transactions')
    .update({ user_id: nextUserId })
    .eq('id', existingSale.id);

  if (transactionError) throw transactionError;

  if (sourceAccount && sourceAccount.user_id !== nextUserId) {
    await setCreditBalance(supabase, sourceAccount.user_id, Number(sourceAccount.balance || 0) - credits);
  }

  await setCreditBalance(supabase, nextUserId, Number(targetAccount.balance || 0) + credits);
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const expectedSecret = process.env.GUMROAD_WEBHOOK_SECRET || '';
  if (expectedSecret && body.secret !== expectedSecret) {
    return json(403, { ok: false, error: 'Secret Gumroad invalide.' });
  }

  const saleId = String(body.sale_id || body.id || body.order_number || '').trim();
  if (!saleId) return json(400, { ok: false, error: 'sale_id Gumroad manquant.' });

  const pack = getGumroadPack(body);
  if (!pack) return json(400, { ok: false, error: 'Pack Gumroad inconnu.' });

  const supabase = getSupabaseAdminClient();
  const gumroadUserId = getGumroadUserId(body);
  const resolvedUserId = await resolveSupabaseUserIdByEmail(supabase, getGumroadBuyerEmail(body));
  const userId = sanitizeCreditUserId(resolvedUserId || gumroadUserId);
  if (!userId || userId === 'anonymous') {
    return json(400, { ok: false, error: 'Identifiant utilisateur manquant.' });
  }

  const existingSale = await findExistingSale(supabase, saleId);
  if (existingSale) {
    if (existingSale.user_id !== userId) {
      await reassignExistingSale(supabase, existingSale, userId, pack.credits);
      return json(200, { ok: true, reassigned: true, saleId, userId, creditsAdded: pack.credits });
    }
    return json(200, { ok: true, duplicate: true, saleId, userId: existingSale.user_id });
  }

  const account = await ensureCreditAccount(supabase, userId);
  const now = new Date().toISOString();
  const nextBalance = Number(account.balance || 0) + pack.credits;

  const { data: updatedAccount, error: updateError } = await supabase
    .from('ai_credits')
    .update({ balance: nextBalance, updated_at: now })
    .eq('user_id', userId)
    .select('*')
    .single();

  if (updateError) throw updateError;

  const { error: transactionError } = await supabase
    .from('ai_credit_transactions')
    .insert({
      user_id: userId,
      type: 'grant',
      amount: pack.credits,
      reason: `gumroad:${saleId}`,
      created_at: now,
    });

  if (transactionError) throw transactionError;

  return json(200, {
    ok: true,
    saleId,
    userId,
    creditsAdded: pack.credits,
    ...normalizeCreditAccount(updatedAccount),
  });
});
