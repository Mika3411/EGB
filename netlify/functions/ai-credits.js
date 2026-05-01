import {
  aiCreditCosts,
  ensureCreditAccount,
  getCreditUserId,
  getRecentTransactions,
  getSupabaseAdminClient,
  json,
  normalizeCreditAccount,
  withErrors,
} from './_shared.js';

const toCount = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.round(number));
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
  const query = event.queryStringParameters || {};
  const userId = getCreditUserId(event, { userId: query.userId });
  const account = await ensureCreditAccount(supabase, userId);
  const objectImageBatchSize = Math.max(1, toCount(aiCreditCosts.objectImageBatchSize) || 1);

  return json(200, {
    ...normalizeCreditAccount({
      ...account,
      transactions: await getRecentTransactions(supabase, userId),
    }),
    costs: aiCreditCosts,
    nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
    nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    objectImagesInCurrentBatch: toCount(account.object_images_in_current_batch),
    objectImageBatchSize,
  });
});
