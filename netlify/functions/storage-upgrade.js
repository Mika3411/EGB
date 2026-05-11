import {
  getSupabaseAdminClient,
  json,
  parseBody,
  resolveCreditUserId,
  spendCredits,
  withErrors,
} from './_shared.js';

const MB = 1024 * 1024;
const FREE_STORAGE_BYTES = 250 * MB;
const STORAGE_BYTES_PER_CREDIT = 5 * MB;

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

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const credits = Math.max(0, Math.round(Number(body.credits || 0)));

  if (!credits) return json(400, { error: 'Nombre de credits invalide.' });

  const userId = await resolveCreditUserId(event);
  if (!userId || userId === 'anonymous') return json(400, { error: 'Utilisateur manquant.' });

  const supabase = getSupabaseAdminClient();
  const storageQuotaBytes = credits * STORAGE_BYTES_PER_CREDIT;
  const account = await spendCredits(
    supabase,
    userId,
    credits,
    `storage_upgrade:${credits}:${storageQuotaBytes}`,
  );

  return json(200, {
    ok: true,
    balance: Number(account.balance || 0),
    storageQuotaBytes: await getStorageQuotaFromTransactions(supabase, userId),
    storagePackCredits: credits,
  });
});
