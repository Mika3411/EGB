import { readJsonBody, sendJson } from './http.js';
import {
  isConfiguredAdminEmail,
  normalizeEmail,
  verifySupabaseAdminRequest,
} from './auth.js';
import { getSupabaseAdminClient } from './supabase.js';
import { downloadStorageJson } from './storage.js';
import {
  getProjectThumbnail,
  getProjectTitle,
  getPublicProjectCounts,
  getStoredProjectCountForUser,
} from './projects.js';

const publicProjectsStoragePath = 'public/projects.json';

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

export const handleAdminUsers = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  const client = getSupabaseAdminClient();
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;
  const publicRecords = await downloadStorageJson(publicProjectsStoragePath, [], { visibility: 'public' });
  const publicCounts = getPublicProjectCounts(publicRecords);
  const users = await Promise.all((data.users || [])
    .map(async (user) => ({
      ...supabaseUserToAdminRecord(user),
      projectCount: await getStoredProjectCountForUser(user.id, publicCounts[user.id]),
    })));

  const visibleUsers = users
    .filter((account) => !isConfiguredAdminEmail(account.email))
    .sort((a, b) => normalizeEmail(a.email).localeCompare(normalizeEmail(b.email), 'fr'));

  sendJson(res, 200, { users: visibleUsers });
};

export const handleAdminUserUpdate = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  const body = await readJsonBody(req);
  const userId = String(body.userId || '').trim();
  if (!userId) {
    sendJson(res, 400, { error: 'Utilisateur manquant.' });
    return;
  }

  const client = getSupabaseAdminClient();
  const action = String(body.action || '');
  if (action === 'delete') {
    const { error } = await client.auth.admin.deleteUser(userId);
    if (error) throw error;
    sendJson(res, 200, { deletedUserId: userId });
    return;
  }

  const attributes = {};

  if (action === 'disable') attributes.ban_duration = '876000h';
  if (action === 'enable') attributes.ban_duration = 'none';
  if (action === 'ban_temp') attributes.ban_duration = String(body.banDuration || '24h');

  if (!Object.keys(attributes).length) {
    sendJson(res, 400, { error: 'Action admin inconnue.' });
    return;
  }

  const { data, error } = await client.auth.admin.updateUserById(userId, attributes);
  if (error) throw error;
  sendJson(res, 200, { user: supabaseUserToAdminRecord(data.user) });
};

const getAdminProjectPayload = (record = {}) => {
  const shareState = record.shareState || record.share_state || {};
  const data = shareState.publishedData || record.data || record.project || {};
  const projectId = record.id || record.projectId || '';
  const userId = record.userId || '';
  const key = record.publicKey || (userId && projectId ? `${userId}:${projectId}` : projectId);
  const scenes = Array.isArray(data.scenes) ? data.scenes.length : 0;
  const enigmas = Array.isArray(data.enigmas) ? data.enigmas.length : 0;

  return {
    key,
    userId,
    projectId,
    title: getProjectTitle(data, record),
    author: record.authorName || record.author || record.authorEmail || 'CrÃ©ateur',
    authorEmail: record.authorEmail || '',
    category: shareState.category || data.category || 'Autre',
    ageRating: shareState.ageRating || data.ageRating || 'Tout public',
    thumbnail: shareState.galleryThumbnail || shareState.publishedThumbnail || record.thumbnail || getProjectThumbnail(data, record),
    publishedAt: shareState.publishedAt || shareState.copiedAt || record.updatedAt || '',
    plays: Number(record.plays || 0),
    scenes,
    enigmas,
    feedback: record.feedback || { votes: 0, average: 0, comments: [] },
    authorProfile: record.authorProfile || { blogPosts: [] },
    shareState,
  };
};

const getAdminProjectCounts = async (client, publicRecords = []) => {
  const { data, error } = await client.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });

  if (error) throw error;

  const publicCounts = getPublicProjectCounts(publicRecords);

  const entries = await Promise.all((data.users || []).map(async (user) => {
    const projectCount = await getStoredProjectCountForUser(user.id, publicCounts[user.id]);
    return [user.id, projectCount];
  }));

  return Object.fromEntries(entries);
};

export const handleAdminProjects = async (req, res) => {
  await verifySupabaseAdminRequest(req);

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Methode non autorisee.' });
    return;
  }

  const client = getSupabaseAdminClient();
  const records = await downloadStorageJson(publicProjectsStoragePath, [], { visibility: 'public' });
  const projects = Array.isArray(records) ? records.map(getAdminProjectPayload) : [];
  const projectCounts = await getAdminProjectCounts(client, records);
  sendJson(res, 200, { projects, projectCounts });
};
