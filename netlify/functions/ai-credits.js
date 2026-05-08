import {
  aiCreditCosts,
  ensureCreditAccount,
  getRecentTransactions,
  getSupabaseAdminClient,
  json,
  normalizeCreditAccount,
  resolveCreditUserId,
  withErrors,
} from './_shared.js';

const toCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
};

const FREE_STORAGE_BYTES = 250 * 1024 * 1024;

const getStorageQuotaFromTransactions = async (supabase, userId) => {
  const { data, error } = await supabase
    .from('ai_credit_transactions')
    .select('reason')
    .eq('user_id', userId)
    .like('reason', 'storage_upgrade:%');

  if (error) throw error;

  return (data || []).reduce((quota, entry) => {
    const [, , bytes] = String(entry.reason || '').split(':');
    return Math.max(quota, Math.round(Number(bytes) || 0));
  }, FREE_STORAGE_BYTES);
};

const calculateImageCreditCost = (account, body = {}) => {
  if (body.type !== 'item') return aiCreditCosts.image;
  if (body.variant === 'thumbnail') return aiCreditCosts.objectThumbnail;
  const batchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);
  const usedInBatch = toCount(account.object_images_in_current_batch);
  return usedInBatch % batchSize === 0 ? aiCreditCosts.objectImageBatchCost : 0;
};

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Methode non autorisee.' });

  const supabase = getSupabaseAdminClient();
  const userId = await resolveCreditUserId(event);
  const account = await ensureCreditAccount(supabase, userId);
  const objectImageBatchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);

  return json(200, {
    ...normalizeCreditAccount({
      ...account,
      transactions: await getRecentTransactions(supabase, userId),
    }),
    storageQuotaBytes: await getStorageQuotaFromTransactions(supabase, userId),
    costs: aiCreditCosts,
    nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    objectImagesInCurrentBatch: toCount(account.object_images_in_current_batch),
    objectImageBatchSize,
  });
});
