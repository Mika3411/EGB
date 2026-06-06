import {
  getSupabaseAdminClient,
  isConfiguredAdminEmail,
  json,
  normalizeEmail,
  parseBody,
  privateDataBucket,
  verifyAdmin,
  withErrors,
} from './_shared.js';
import { normalizeAccountType } from '../../src/shared/services/accountPlans.js';

const sanitizeStorageSegment = (value = '') => String(value || '')
  .trim()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-')
  .replace(/-+/g, '-')
  .replace(/^-+|-+$/g, '')
  .toLowerCase();

const isMissingStorageResource = (error) => Number(error?.statusCode || error?.status) === 404
  || /not found/i.test(String(error?.message || ''));

const getErrorMessage = (error) => error?.message || String(error || 'Erreur inconnue');

const getStoredProjectCountForUser = async (supabase, userId) => {
  const safeUserId = sanitizeStorageSegment(userId);
  if (!safeUserId) return 0;

  const { data, error } = await supabase.storage
    .from(privateDataBucket)
    .download(`users/${safeUserId}/projects.json`);

  if (error) {
    if (isMissingStorageResource(error)) return 0;
    throw error;
  }

  const text = await data.text();
  if (!text.trim()) return 0;
  let records = [];
  try {
    records = JSON.parse(text);
  } catch (error) {
    console.warn(`Index projets illisible pour ${userId}: ${getErrorMessage(error)}`);
    return 0;
  }
  return Array.isArray(records) ? records.filter((project) => project?.id).length : 0;
};

const getSafeStoredProjectCountForUser = async (supabase, userId) => {
  try {
    return await getStoredProjectCountForUser(supabase, userId);
  } catch (error) {
    console.warn(`Compteur projets indisponible pour ${userId}: ${getErrorMessage(error)}`);
    return 0;
  }
};

const getUserAccountType = (user = {}) => normalizeAccountType(
  user.user_metadata?.accountType
  || user.user_metadata?.account_type
  || user.app_metadata?.accountType
  || user.app_metadata?.account_type
  || '',
);

const supabaseUserToAdminRecord = (user, projectCount = 0) => ({
  id: user.id,
  email: user.email || '',
  name: user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
  accountType: getUserAccountType(user),
  profileType: user.user_metadata?.profileType || user.user_metadata?.profile_type || '',
  organization: user.user_metadata?.organization || '',
  provider: 'supabase',
  createdAt: user.created_at || '',
  updatedAt: user.updated_at || '',
  lastSignInAt: user.last_sign_in_at || '',
  bannedUntil: user.banned_until || '',
  isDisabled: Boolean(user.banned_until && new Date(user.banned_until).getTime() > Date.now()),
  projectCount,
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

    const users = await Promise.all((data.users || [])
      .map(async (user) => supabaseUserToAdminRecord(
        user,
        await getSafeStoredProjectCountForUser(supabase, user.id),
      )));

    const visibleUsers = users
      .filter((account) => !isConfiguredAdminEmail(account.email))
      .sort((a, b) => normalizeEmail(a.email).localeCompare(normalizeEmail(b.email), 'fr'));

    return json(200, { users: visibleUsers });
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
    if (action === 'set_account_type') {
      if (!String(body.accountType || '').trim()) return json(400, { error: 'Type de compte manquant.' });
      const accountType = normalizeAccountType(body.accountType);
      const { data: currentData, error: currentError } = await supabase.auth.admin.getUserById(userId);
      if (currentError) throw currentError;
      attributes.user_metadata = {
        ...(currentData.user?.user_metadata || {}),
        accountType,
        account_type: accountType,
      };
    }
    if (!Object.keys(attributes).length) return json(400, { error: 'Action admin inconnue.' });

    const { data, error } = await supabase.auth.admin.updateUserById(userId, attributes);
    if (error) throw error;
    return json(200, {
      user: supabaseUserToAdminRecord(
        data.user,
        await getSafeStoredProjectCountForUser(supabase, data.user.id),
      ),
    });
  }

  return json(405, { error: 'Methode non autorisee.' });
});
