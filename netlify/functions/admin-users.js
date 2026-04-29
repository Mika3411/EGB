import {
  ADMIN_EMAIL,
  getSupabaseAdminClient,
  json,
  normalizeEmail,
  parseBody,
  verifyAdmin,
  withErrors,
} from './_shared.js';

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

export const handler = async (event) => withErrors(event, async () => {
  await verifyAdmin(event);
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    if (error) throw error;

    const users = (data.users || [])
      .map(supabaseUserToAdminRecord)
      .filter((account) => normalizeEmail(account.email) !== ADMIN_EMAIL)
      .sort((a, b) => normalizeEmail(a.email).localeCompare(normalizeEmail(b.email), 'fr'));

    return json(200, { users });
  }

  if (event.httpMethod === 'POST') {
    const body = parseBody(event);
    const userId = String(body.userId || '').trim();
    if (!userId) return json(400, { error: 'Utilisateur manquant.' });

    const action = String(body.action || '');
    if (action === 'delete') {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;
      return json(200, { deletedUserId: userId });
    }

    const attributes = {};
    if (action === 'disable') attributes.ban_duration = '876000h';
    if (action === 'enable') attributes.ban_duration = 'none';
    if (action === 'ban_temp') attributes.ban_duration = String(body.banDuration || '24h');
    if (!Object.keys(attributes).length) return json(400, { error: 'Action admin inconnue.' });

    const { data, error } = await supabase.auth.admin.updateUserById(userId, attributes);
    if (error) throw error;
    return json(200, { user: supabaseUserToAdminRecord(data.user) });
  }

  return json(405, { error: 'Methode non autorisee.' });
});
