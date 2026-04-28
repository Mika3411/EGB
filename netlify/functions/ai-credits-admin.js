import {
  aiCreditCosts,
  defaultAiCredits,
  ensureCreditAccount,
  getCreditUserId,
  getRecentTransactions,
  getSupabaseAdminClient,
  json,
  normalizeCreditAccount,
  parseBody,
  verifyAdmin,
  withErrors,
} from './_shared.js';

export const handler = async (event) => withErrors(event, async () => {
  await verifyAdmin(event);
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('ai_credits')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;

    const users = await Promise.all((data || []).map(async (account) => ({
      ...normalizeCreditAccount(account),
      transactions: await getRecentTransactions(supabase, account.user_id),
    })));

    return json(200, {
      users,
      costs: aiCreditCosts,
      defaultCredits: Number.isFinite(defaultAiCredits) ? Math.max(0, defaultAiCredits) : 0,
    });
  }

  if (event.httpMethod === 'POST') {
    const body = parseBody(event);
    const userId = getCreditUserId(event, body);
    if (!userId || userId === 'anonymous') return json(400, { error: 'Utilisateur invalide.' });

    const action = String(body.action || 'add');
    const amount = Math.round(Number(body.amount || 0));
    if (!Number.isFinite(amount)) return json(400, { error: 'Montant invalide.' });

    const account = await ensureCreditAccount(supabase, userId);
    const previousBalance = Number(account.balance || 0);
    const nextBalance = action === 'set'
      ? Math.max(0, amount)
      : Math.max(0, previousBalance + (action === 'subtract' ? -Math.abs(amount) : Math.abs(amount)));
    const signedAmount = nextBalance - previousBalance;
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from('ai_credits')
      .update({
        balance: nextBalance,
        updated_at: now,
      })
      .eq('user_id', userId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    const transactionType = action === 'set' ? 'admin_set' : signedAmount < 0 ? 'admin_debit' : 'admin_grant';
    const { error: transactionError } = await supabase.from('ai_credit_transactions').insert({
      user_id: userId,
      type: transactionType,
      amount: signedAmount,
      reason: body.reason || `admin_${action}`,
      created_at: now,
    });

    if (transactionError) throw transactionError;

    return json(200, {
      user: {
        ...normalizeCreditAccount(updated),
        transactions: await getRecentTransactions(supabase, userId),
      },
      costs: aiCreditCosts,
    });
  }

  return json(405, { error: 'Methode non autorisee.' });
});
