import {
  getCreditUserId,
  getSupabaseAdminClient,
  json,
  parseBody,
  spendCredits,
  withErrors,
} from './_shared.js';

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Methode non autorisee.' });

  const body = parseBody(event);
  const userId = getCreditUserId(event, body);
  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  const costCredits = Math.max(0, Math.round(Number(body.costCredits || 0)));
  const title = String(body.title || 'Pack boutique').trim().slice(0, 120);

  if (!packId) return json(400, { error: 'Pack manquant.' });
  if (!userId || userId === 'anonymous') return json(400, { error: 'Utilisateur manquant.' });
  if (!costCredits) return json(400, { error: 'Cout en credits invalide.' });

  const supabase = getSupabaseAdminClient();
  const account = await spendCredits(supabase, userId, costCredits, `shop_pack:${packId}:${title}`);

  return json(200, {
    ok: true,
    packId,
    costCredits,
    balance: Number(account.balance || 0),
  });
});
