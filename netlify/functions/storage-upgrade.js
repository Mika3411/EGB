import {
  getSupabaseAdminClient,
  getStorageQuotaFromTransactions,
  json,
  parseBody,
  resolveCreditUserId,
  spendCredits,
  STORAGE_BYTES_PER_CREDIT,
  withErrors,
} from './_shared.js';

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
