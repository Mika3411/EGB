import { createServer } from 'node:http';
import { assertAiContentAllowed, makeImageModerationInput } from './src/utils/aiModeration.js';
import { assertAiRateLimit, getClientIpFromHeaders } from './src/utils/aiRateLimit.js';
import { assertCorsRequestAllowed } from './src/utils/corsConfig.js';
import { assertProjectSafety, parseProjectJsonPayload } from './src/utils/projectSafetyValidation.js';
import { port } from './server/config.js';
import { getJsonHeaders, imageDataToBlob, readJsonBody, requestContext, sendJson } from './server/http.js';
import { getSupabaseAdminClient } from './server/supabase.js';
import {
  isConfiguredAdminEmail,
  normalizeEmail,
  verifySupabaseAdminRequest,
  verifySupabaseUserRequest,
} from './server/auth.js';
import { buildStoragePath, downloadStorageJson, uploadStorageJson } from './server/storage.js';
import {
  aiCreditCosts,
  calculateImageCreditCost,
  calculateTextCreditCost,
  getCreditAccount,
  handleAdminCredits,
  handleCreditTopUp,
  handleCredits,
  handleCreditsAdminList,
  handleCreditsAdminUpdate,
  handleGumroadWebhook,
  handleStorageUpgrade,
  refundCredits,
  releaseImageCreditReservation,
  reserveImageCredits,
  resolveCreditUserId,
  spendCredits,
} from './server/credits.js';
import { serveStatic } from './server/staticFiles.js';

const shopPacksStoragePath = 'public/shop-packs.json';
const publicProjectsStoragePath = 'public/projects.json';
const aiJobs = new Map();

const createEmptyShopPack = () => ({
  id: '',
  title: '',
  costCredits: 50,
  description: '',
  rating: 8,
  actsCount: 1,
  scenesCount: 5,
  objectsCount: 5,
  enigmasCount: 3,
  cinematicsCount: 1,
  combinationsCount: 1,
  screenshots: [],
  downloadUrl: '',
  downloadFileName: '',
  downloadStoragePath: '',
  downloadMode: '',
  archived: false,
  archivedAt: '',
  archivedReason: '',
  soldAt: '',
  soldTo: '',
  createdAt: '',
  updatedAt: '',
});

const normalizeNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : fallback;
};

const createShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

const normalizeShopPack = (pack = {}) => ({
  ...createEmptyShopPack(),
  ...pack,
  id: String(pack.id || createShopPackId()).trim().replace(/[^a-zA-Z0-9._:-]/g, '-'),
  title: String(pack.title || '').trim(),
  costCredits: normalizeNumber(pack.costCredits, 50),
  description: String(pack.description || '').trim(),
  rating: Math.min(10, normalizeNumber(pack.rating, 8)),
  actsCount: normalizeNumber(pack.actsCount, 0),
  scenesCount: normalizeNumber(pack.scenesCount, 0),
  objectsCount: normalizeNumber(pack.objectsCount, 0),
  enigmasCount: normalizeNumber(pack.enigmasCount, 0),
  cinematicsCount: normalizeNumber(pack.cinematicsCount, 0),
  combinationsCount: normalizeNumber(pack.combinationsCount, 0),
  screenshots: Array.isArray(pack.screenshots) ? pack.screenshots.filter((entry) => entry?.src) : [],
  downloadUrl: String(pack.downloadUrl || '').trim(),
  downloadFileName: String(pack.downloadFileName || '').trim(),
  downloadStoragePath: String(pack.downloadStoragePath || '').trim(),
  downloadMode: String(pack.downloadMode || '').trim(),
  archived: Boolean(pack.archived),
  archivedAt: String(pack.archivedAt || '').trim(),
  archivedReason: String(pack.archivedReason || '').trim(),
  soldAt: String(pack.soldAt || '').trim(),
  soldTo: String(pack.soldTo || '').trim(),
  createdAt: pack.createdAt || new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const loadServerShopPacks = async () => {
  const packs = await downloadStorageJson(shopPacksStoragePath, []);
  return Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
};

const saveServerShopPacks = async (packs = []) => {
  const normalized = Array.isArray(packs) ? packs.map(normalizeShopPack) : [];
  await uploadStorageJson(shopPacksStoragePath, normalized);
  return normalized;
};

const shopPurchaseLocks = new Map();

const withShopPurchaseLock = async (packId, task) => {
  const previous = shopPurchaseLocks.get(packId) || Promise.resolve();
  let releaseLock;
  const current = new Promise((resolve) => {
    releaseLock = resolve;
  });
  const queued = previous.then(() => current, () => current);
  shopPurchaseLocks.set(packId, queued);
  await previous.catch(() => {});
  try {
    return await task();
  } finally {
    releaseLock();
    if (shopPurchaseLocks.get(packId) === queued) {
      shopPurchaseLocks.delete(packId);
    }
  }
};

const toPublicShopPack = (pack = {}) => {
  const {
    downloadUrl,
    downloadStoragePath,
    ...publicPack
  } = normalizeShopPack(pack);
  return {
    ...publicPack,
    hasDownload: Boolean(downloadUrl || downloadStoragePath),
  };
};

const preserveExistingShopPackDownload = (incomingPack = {}, existingPack = null) => {
  if (!existingPack) return normalizeShopPack(incomingPack);
  return normalizeShopPack({
    ...incomingPack,
    downloadUrl: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadUrl')
      ? incomingPack.downloadUrl
      : existingPack.downloadUrl,
    downloadFileName: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadFileName')
      ? incomingPack.downloadFileName
      : existingPack.downloadFileName,
    downloadStoragePath: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadStoragePath')
      ? incomingPack.downloadStoragePath
      : existingPack.downloadStoragePath,
    downloadMode: Object.prototype.hasOwnProperty.call(incomingPack, 'downloadMode')
      ? incomingPack.downloadMode
      : existingPack.downloadMode,
  });
};

const handleShopPacks = async (req, res) => {
  if (req.method === 'GET') {
    const packs = await loadServerShopPacks();
    sendJson(res, 200, { packs: packs.map(toPublicShopPack) });
    return;
  }

  const adminUser = await verifySupabaseAdminRequest(req);
  const body = await readJsonBody(req);
  const action = String(body.action || '').trim();
  const packs = await loadServerShopPacks();

  if (action === 'replace') {
    const nextPacks = await saveServerShopPacks((Array.isArray(body.packs) ? body.packs : []).map((pack) => (
      preserveExistingShopPackDownload(pack, packs.find((entry) => entry.id === pack?.id))
    )));
    sendJson(res, 200, { packs: nextPacks, admin: adminUser.email || '' });
    return;
  }

  if (action === 'upsert') {
    const rawPack = body.pack || {};
    const pack = preserveExistingShopPackDownload(rawPack, packs.find((entry) => entry.id === rawPack?.id));
    if (!pack.title) {
      sendJson(res, 400, { error: 'Nom du pack manquant.' });
      return;
    }
    const nextPacks = await saveServerShopPacks([
      pack,
      ...packs.filter((entry) => entry.id !== pack.id),
    ]);
    sendJson(res, 200, { packs: nextPacks, pack, admin: adminUser.email || '' });
    return;
  }

  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');
  if (!packId) {
    sendJson(res, 400, { error: 'Pack manquant.' });
    return;
  }

  if (action === 'delete') {
    sendJson(res, 200, { packs: await saveServerShopPacks(packs.filter((entry) => entry.id !== packId)) });
    return;
  }

  if (action === 'archive' || action === 'relist') {
    const now = new Date().toISOString();
    const nextPacks = await saveServerShopPacks(packs.map((pack) => {
      if (pack.id !== packId) return pack;
      return action === 'archive'
        ? normalizeShopPack({
          ...pack,
          archived: true,
          archivedAt: body.archivedAt || now,
          archivedReason: body.archivedReason || 'admin',
          soldAt: body.soldAt || pack.soldAt || '',
          soldTo: body.soldTo || pack.soldTo || '',
        })
        : normalizeShopPack({
          ...pack,
          archived: false,
          archivedAt: '',
          archivedReason: '',
          soldAt: '',
          soldTo: '',
        });
    }));
    sendJson(res, 200, { packs: nextPacks });
    return;
  }

  sendJson(res, 400, { error: 'Action boutique inconnue.' });
};

const handleShopPurchase = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  const packId = String(body.packId || '').trim().replace(/[^a-zA-Z0-9._:-]/g, '-');

  if (!packId) {
    sendJson(res, 400, { error: 'Pack manquant.' });
    return;
  }
  if (!userId || userId === 'anonymous') {
    sendJson(res, 400, { error: 'Utilisateur manquant.' });
    return;
  }

  await withShopPurchaseLock(packId, async () => {
    const packs = await loadServerShopPacks();
    const pack = packs.find((entry) => entry.id === packId);
    if (!pack || pack.archived) {
      sendJson(res, 404, { error: 'Pack indisponible.' });
      return;
    }
    if (!pack.downloadUrl) {
      sendJson(res, 400, { error: 'Pack sans fichier telechargeable.' });
      return;
    }

    const costCredits = Math.max(0, Math.round(Number(pack.costCredits || 0)));
    const title = String(pack.title || 'Pack boutique').trim().slice(0, 120);
    if (!costCredits) {
      sendJson(res, 400, { error: 'Cout en credits invalide.' });
      return;
    }

    const accountBeforePurchase = getCreditAccount(userId);
    if (Number(accountBeforePurchase.balance || 0) < costCredits) {
      sendJson(res, 402, {
        error: `Credits IA insuffisants (${accountBeforePurchase.balance || 0}/${costCredits}).`,
        balance: accountBeforePurchase.balance || 0,
        required: costCredits,
      });
      return;
    }

    const purchasedAt = new Date().toISOString();
    const nextPacks = packs.map((entry) => (
      entry.id === packId ? normalizeShopPack({
        ...entry,
        archived: true,
        archivedAt: purchasedAt,
        archivedReason: 'sold',
        soldAt: purchasedAt,
        soldTo: userId,
      }) : entry
    ));
    await saveServerShopPacks(nextPacks);

    let account;
    try {
      account = spendCredits(userId, costCredits, `shop_pack:${packId}:${title}`);
    } catch (error) {
      await saveServerShopPacks(packs);
      throw error;
    }

    sendJson(res, 200, {
      ok: true,
      purchase: {
        packId,
        title,
        costCredits,
        downloadUrl: pack.downloadUrl,
        downloadFileName: pack.downloadFileName || `${title || 'pack'}.zip`,
        purchasedAt,
      },
      balance: account.balance || 0,
    });
  });
};

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

const getPublicProjectCounts = (records = []) => (
  (Array.isArray(records) ? records : []).reduce((counts, record) => {
    const userId = record?.userId || '';
    if (userId) counts[userId] = (counts[userId] || 0) + 1;
    return counts;
  }, {})
);

const getStoredProjectCountForUser = async (userId, publicCount = 0) => {
  const records = await downloadStorageJson(getProjectsStoragePath(userId), []);
  const privateCount = Array.isArray(records) ? records.filter((project) => project?.id).length : 0;
  return Math.max(privateCount, Number(publicCount || 0));
};

const handleAdminUsers = async (req, res) => {
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

const handleAdminUserUpdate = async (req, res) => {
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

const handleAdminProjects = async (req, res) => {
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

const handleAdminModeration = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  await handleModeration(req, res);
};

const handleModeration = async (req, res) => {
  const client = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const { data, error } = await client
      .from('moderation_actions')
      .select('target_type,target_id,action,reason,created_at,updated_at')
      .eq('action', 'hidden')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    sendJson(res, 200, { actions: data || [] });
    return;
  }

  if (req.method === 'POST') {
    const adminUser = await verifySupabaseAdminRequest(req);
    const body = await readJsonBody(req);
    const targetType = String(body.targetType || '').trim();
    const targetId = String(body.targetId || '').trim();
    const action = String(body.action || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 240);

    if (!['game', 'blog', 'comment'].includes(targetType)) {
      sendJson(res, 400, { error: 'Type de cible invalide.' });
      return;
    }
    if (!targetId) {
      sendJson(res, 400, { error: 'Cible manquante.' });
      return;
    }
    if (!['hidden', 'visible'].includes(action)) {
      sendJson(res, 400, { error: 'Action de moderation invalide.' });
      return;
    }

    const { data, error } = await client
      .from('moderation_actions')
      .upsert({
        target_type: targetType,
        target_id: targetId,
        action,
        reason,
        moderator_email: adminUser.email || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'target_type,target_id' })
      .select('*')
      .single();

    if (error) throw error;
    sendJson(res, 200, { action: data });
    return;
  }

  sendJson(res, 405, { error: 'Methode non autorisee.' });
};

const cloneProjectData = (data) => JSON.parse(JSON.stringify(data || {}));

const getProjectTitle = (project = {}, record = {}) =>
  record?.name || project?.title || project?.name || 'Escape game sans titre';

const getProjectThumbnail = (project = {}, record = {}) => {
  const startScene = Array.isArray(project.scenes)
    ? project.scenes.find((scene) => scene.id === project.start?.targetSceneId)
    : null;
  const candidates = [
    record.shareState?.galleryThumbnail,
    record.shareState?.publishedThumbnail,
    record.thumbnail,
    startScene?.backgroundData,
    ...(project.scenes || []).map((scene) => scene.backgroundData),
    ...(project.cinematics || []).flatMap((cinematic) => [
      cinematic.videoPoster,
      ...(cinematic.slides || []).map((slide) => slide.imageData),
    ]),
  ];

  return candidates.find((value) => typeof value === 'string' && value.trim()) || '';
};

const normalizeProjectRecord = (record = {}) => ({
  ...record,
  shareState: record.shareState || record.share_state || { isPublic: false, copiedAt: '' },
});

const PUBLIC_SETTINGS_KEYS = new Set([
  'category',
  'ageRating',
  'mature',
  'galleryThumbnail',
  'galleryThumbnailName',
  'galleryThumbnailCrop',
  'galleryThumbnailStorage',
  'durationMinutes',
  'difficulty',
]);

const sanitizePublicSettings = (settings = {}) => Object.fromEntries(
  Object.entries(settings || {}).filter(([key]) => PUBLIC_SETTINGS_KEYS.has(key)),
);

const getProjectsStoragePath = (userId) => buildStoragePath('users', userId, 'projects.json');
const getProjectRecordStoragePath = (userId, projectId) => buildStoragePath('users', userId, 'projects', `${projectId || 'project'}.json`);

const getProjectIndexRecord = (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const { data, project: legacyProject, ...metadata } = project;
  return {
    ...metadata,
    storagePath,
  };
};

const saveProjectRecordForUser = async (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const record = { ...project, storagePath };
  await uploadStorageJson(storagePath, record);
  return record;
};

const loadServerProjectsForUser = async (userId) => {
  const projects = await downloadStorageJson(getProjectsStoragePath(userId), []);
  if (!Array.isArray(projects)) return [];
  return Promise.all(projects.map(async (project) => {
    if (!project?.storagePath) return normalizeProjectRecord(project);
    const fullProject = await downloadStorageJson(project.storagePath, project);
    return normalizeProjectRecord({ ...project, ...fullProject, storagePath: project.storagePath });
  }));
};

const savePublicProjectIndexForUser = async (userId, projects = []) => {
  const publicRecords = projects
    .filter((project) => project?.id && project.shareState?.isPublic)
    .map((project) => ({
      ...project,
      userId,
      publicKey: `${userId}:${project.id}`,
    }));

  const existingIndex = await downloadStorageJson(publicProjectsStoragePath, [], { visibility: 'public' });
  const safeIndex = Array.isArray(existingIndex) ? existingIndex : [];
  const withoutUser = safeIndex.filter((project) => project.userId !== userId);
  return uploadStorageJson(publicProjectsStoragePath, [...withoutUser, ...publicRecords], { visibility: 'public' });
};

const saveServerProjectsForUser = async (userId, projects = []) => {
  const normalized = Array.isArray(projects) ? projects.map(normalizeProjectRecord) : [];
  const storedProjects = [];
  for (const project of normalized) {
    if (!project?.id) continue;
    storedProjects.push(await saveProjectRecordForUser(userId, project));
  }
  await uploadStorageJson(getProjectsStoragePath(userId), storedProjects.map((project) => getProjectIndexRecord(userId, project)));
  await savePublicProjectIndexForUser(userId, storedProjects);
  return storedProjects;
};

const handleProjectPublication = async (req, res) => {
  const user = await verifySupabaseUserRequest(req);
  const body = await readJsonBody(req);
  const action = String(body.action || '').trim();
  const projectId = String(body.projectId || body.project?.id || '').trim();
  const settings = sanitizePublicSettings(body.settings && typeof body.settings === 'object' ? body.settings : {});

  if (!projectId) {
    sendJson(res, 400, { error: 'Projet manquant.' });
    return;
  }
  if (!['markCopied', 'publish', 'unpublish', 'settings'].includes(action)) {
    sendJson(res, 400, { error: 'Action de publication inconnue.' });
    return;
  }

  const timestamp = new Date().toISOString();
  const projects = await loadServerProjectsForUser(user.id);
  const existing = projects.find((project) => project.id === projectId);
  if (!existing) {
    sendJson(res, 404, { error: 'Projet introuvable.' });
    return;
  }

  const sourceProject = normalizeProjectRecord(existing);

  const nextProject = (() => {
    if (action === 'settings') {
      return {
        ...sourceProject,
        shareState: {
          ...(sourceProject.shareState || {}),
          ...settings,
        },
        updatedAt: timestamp,
      };
    }

    if (action === 'unpublish') {
      return {
        ...sourceProject,
        shareState: {
          ...(sourceProject.shareState || {}),
          isPublic: false,
          unpublishedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    }

    if (action === 'markCopied') {
      return {
        ...sourceProject,
        shareState: {
          ...(sourceProject.shareState || {}),
          isPublic: true,
          copiedAt: timestamp,
          publishedAt: sourceProject.shareState?.publishedAt || timestamp,
          durationMinutes: sourceProject.shareState?.durationMinutes || Math.max(15, Math.min(90, 15 + (sourceProject.data?.scenes?.length || 0) * 8 + (sourceProject.data?.enigmas?.length || 0) * 5)),
          difficulty: sourceProject.shareState?.difficulty || ((sourceProject.data?.enigmas?.length || 0) >= 5 ? 'difficile' : (sourceProject.data?.enigmas?.length || 0) >= 2 ? 'intermÃ©diaire' : 'facile'),
        },
        updatedAt: timestamp,
      };
    }

    const snapshot = cloneProjectData(sourceProject.data);
    return {
      ...sourceProject,
      shareState: {
        ...(sourceProject.shareState || {}),
        isPublic: true,
        copiedAt: sourceProject.shareState?.copiedAt || timestamp,
        publishedAt: timestamp,
        publishedData: snapshot,
        publishedName: sourceProject.name || getProjectTitle(sourceProject.data),
        publishedThumbnail: sourceProject.shareState?.galleryThumbnail || sourceProject.thumbnail || getProjectThumbnail(snapshot) || '',
        durationMinutes: Math.max(15, Math.min(90, 15 + (snapshot?.scenes?.length || 0) * 8 + (snapshot?.enigmas?.length || 0) * 5)),
        difficulty: (snapshot?.enigmas?.length || 0) >= 5 ? 'difficile' : (snapshot?.enigmas?.length || 0) >= 2 ? 'intermÃ©diaire' : 'facile',
      },
      updatedAt: timestamp,
    };
  })();

  const nextProjects = [
    nextProject,
    ...projects.filter((project) => project.id !== projectId),
  ];

  await saveServerProjectsForUser(user.id, nextProjects);
  sendJson(res, 200, { project: nextProject });
};

const openaiFetch = async (path, body) => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    const error = new Error('OPENAI_API_KEY manquant.');
    error.status = 500;
    throw error;
  }

  const response = await fetch(`https://api.openai.com/v1/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  const payload = text ? JSON.parse(text) : {};
  if (!response.ok) {
    const message = payload?.error?.message || `Erreur OpenAI ${response.status}.`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
};

const buildTextGenerationInput = (body = {}) => [
  'Tu dois repondre uniquement avec un JSON valide, sans Markdown ni commentaire.',
  body.prompt,
].filter(Boolean).join('\n\n');

const assertServerAiContentAllowed = (input, stage) => assertAiContentAllowed({
  input,
  openaiFetch,
  env: process.env,
  stage,
});

const assertServerAiRateLimit = (req, userId, kind = 'text') => assertAiRateLimit({
  kind,
  userId,
  ip: getClientIpFromHeaders(req?.headers || {}),
  env: process.env,
});

const extractOutputText = (payload) => {
  if (payload.output_text) return payload.output_text;
  const chunks = [];
  for (const item of payload.output || []) {
    for (const content of item.content || []) {
      if (content.type === 'output_text' && content.text) chunks.push(content.text);
      if (content.type === 'text' && content.text) chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
};

const makeAiJobId = () => `ai_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

const getPublicCreditPayload = (account, cost) => ({
  balance: account.balance || 0,
  cost,
  costs: aiCreditCosts,
  nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
});

const runTextGeneration = async (body, userId, cost) => {
  const input = buildTextGenerationInput(body);

  let charged = false;
  try {
    await assertServerAiContentAllowed(input, 'input_text');
    spendCredits(userId, cost, `text:${body.mode || 'generate'}`);
    charged = cost > 0;

    const payload = await openaiFetch('responses', {
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5.2',
      input,
      max_output_tokens: Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 30000),
    });

    const outputText = extractOutputText(payload);
    if (!outputText) {
      const error = new Error('OpenAI n\'a pas renvoye de texte exploitable.');
      error.status = 502;
      throw error;
    }
    await assertServerAiContentAllowed(outputText, 'output_text');
    if (body.responseFormat === 'escape-game-project-json') {
      try {
        const project = parseProjectJsonPayload(outputText);
        assertProjectSafety(project, { mode: 'ai' });
      } catch (validationError) {
        const error = new Error(validationError.message || 'OpenAI a renvoye un JSON invalide ou incomplet. Credits rembourses.');
        error.status = 502;
        error.code = validationError.code || 'AI_INVALID_JSON';
        throw error;
      }
    }

    const account = getCreditAccount(userId);
    return {
      output_text: outputText,
      requestId: payload.id,
      credits: getPublicCreditPayload(account, cost),
    };
  } catch (error) {
    if (charged) {
      refundCredits(userId, cost, `failed_text:${body.mode || 'generate'}`);
    }
    throw error;
  }
};

const startAiJob = (body, userId, cost) => {
  const jobId = makeAiJobId();
  aiJobs.set(jobId, {
    id: jobId,
    userId,
    status: 'pending',
    mode: body.mode || 'generate',
    cost,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  setTimeout(async () => {
    const runningJob = aiJobs.get(jobId) || {};
    aiJobs.set(jobId, {
      ...runningJob,
      status: 'running',
      updatedAt: new Date().toISOString(),
    });

    try {
      const result = await runTextGeneration(body, userId, cost);
      aiJobs.set(jobId, {
        ...runningJob,
        ...result,
        id: jobId,
        userId,
        status: 'complete',
        mode: body.mode || 'generate',
        cost,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      aiJobs.set(jobId, {
        ...runningJob,
        id: jobId,
        userId,
        status: 'error',
        mode: body.mode || 'generate',
        cost,
        error: error.message || 'Erreur IA.',
        code: error.code,
        balance: error.balance,
        required: error.required,
        updatedAt: new Date().toISOString(),
      });
    }
  }, 0);

  return aiJobs.get(jobId);
};

const handleGenerate = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  const cost = calculateTextCreditCost(body);
  assertServerAiRateLimit(req, userId, 'text');
  const shouldRunAsync = body.responseFormat === 'escape-game-project-json'
    && body.mode !== 'repair_item_names'
    && !body.runInline;

  if (shouldRunAsync) {
    const job = startAiJob(body, userId, cost);
    sendJson(res, 202, {
      jobId: job.id,
      status: job.status,
      message: 'Generation IA lancee en arriere-plan.',
      credits: { cost, costs: aiCreditCosts },
    });
    return;
  }

  const result = await runTextGeneration(body, userId, cost);
  sendJson(res, 200, result);
};

const handleAiJob = async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const jobId = String(url.searchParams.get('id') || '').trim();
  if (!jobId) {
    sendJson(res, 400, { error: 'Job IA manquant.' });
    return;
  }

  const job = aiJobs.get(jobId);
  if (!job) {
    sendJson(res, 404, { error: 'Job IA introuvable.' });
    return;
  }

  const userId = await resolveCreditUserId(req, { userId: url.searchParams.get('userId') });
  if (job.userId && userId !== 'anonymous' && job.userId !== userId) {
    sendJson(res, 403, { error: 'Job IA refuse.' });
    return;
  }

  sendJson(res, 200, job);
};

const handleImage = async (req, res) => {
  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  assertServerAiRateLimit(req, userId, 'image');
  await assertServerAiContentAllowed(String(body.prompt || ''), 'input_image');
  const reservation = reserveImageCredits(userId, body);
  const cost = reservation.cost;
  let payload;
  try {
    const imageRequest = {
      model: process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1',
      prompt: body.prompt,
      size: process.env.OPENAI_IMAGE_SIZE || '1536x1024',
      quality: process.env.OPENAI_IMAGE_QUALITY || 'medium',
      n: 1,
    };
    if (body.type === 'item') {
      imageRequest.background = 'transparent';
      imageRequest.output_format = 'png';
      if (body.variant === 'thumbnail') {
        imageRequest.model = process.env.OPENAI_ITEM_THUMBNAIL_MODEL || 'gpt-image-1-mini';
        imageRequest.size = process.env.OPENAI_ITEM_THUMBNAIL_SIZE || '1024x1024';
        imageRequest.quality = process.env.OPENAI_ITEM_THUMBNAIL_QUALITY || 'low';
      }
    }
    payload = await openaiFetch('images/generations', imageRequest);
  } catch (error) {
    releaseImageCreditReservation(userId, reservation, `failed_image:${body.type || 'image'}`);
    throw error;
  }

  const image = payload.data?.[0] || {};
  const imageData = image.b64_json
    ? `data:image/png;base64,${image.b64_json}`
    : image.url;

  if (!imageData) {
    releaseImageCreditReservation(userId, reservation, `failed_image:${body.type || 'image'}`);
    const error = new Error('OpenAI n\'a pas renvoye d\'image.');
    error.status = 502;
    throw error;
  }

  let account;
  try {
    await assertServerAiContentAllowed(makeImageModerationInput(imageData, body.prompt), 'output_image');
    account = getCreditAccount(userId);
  } catch (error) {
    releaseImageCreditReservation(userId, reservation, `failed_image:${body.type || 'image'}`);
    throw error;
  }
  sendJson(res, 200, {
    imageData,
    imageName: `${body.type || 'image'}-${body.entity?.id || Date.now()}.png`,
    elements: [],
    credits: {
      balance: account.balance || 0,
      cost,
      costs: aiCreditCosts,
      nextObjectImageCost: calculateImageCreditCost(account, { type: 'item' }),
      nextObjectThumbnailCost: calculateImageCreditCost(account, { type: 'item', variant: 'thumbnail' }),
    },
  });
};

const handleRemoveBackground = async (req, res) => {
  const apiKey = process.env.REMOVE_BG_API_KEY || '';
  if (!apiKey) {
    sendJson(res, 500, { error: 'Cle remove.bg manquante cote serveur.' });
    return;
  }

  const body = await readJsonBody(req);
  const userId = await resolveCreditUserId(req, body);
  const cost = Math.max(0, Math.round(Number(aiCreditCosts.removeBackground || 0)));
  if (!body.imageData) {
    sendJson(res, 400, { error: 'Image manquante.' });
    return;
  }

  let charged = false;
  let account = null;

  const formData = new FormData();
  formData.append('image_file', imageDataToBlob(body.imageData), 'image.png');
  formData.append('size', 'auto');
  formData.append('format', 'png');

  try {
    account = spendCredits(userId, cost, 'remove_background:remove.bg');
    charged = cost > 0;

    const response = await fetch('https://api.remove.bg/v1.0/removebg', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const error = new Error(errorText || `remove.bg a repondu ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    const arrayBuffer = await response.arrayBuffer();
    const imageData = `data:image/png;base64,${Buffer.from(arrayBuffer).toString('base64')}`;
    sendJson(res, 200, {
      imageData,
      credits: {
        balance: account?.balance || 0,
        cost,
        costs: aiCreditCosts,
      },
    });
  } catch (error) {
    if (charged) refundCredits(userId, cost, 'failed_remove_background:remove.bg');
    throw error;
  }
};

const server = createServer((req, res) => requestContext.run(req, async () => {
  try {
    assertCorsRequestAllowed(req.headers || {}, process.env);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, getJsonHeaders(req));
      res.end();
      return;
    }

    if (req.url === '/api/health') {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/admin/users')) {
      await handleAdminUsers(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/admin/users') {
      await handleAdminUserUpdate(req, res);
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && req.url.startsWith('/api/admin/credits')) {
      await handleAdminCredits(req, res);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/admin/projects')) {
      await handleAdminProjects(req, res);
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && req.url.startsWith('/api/admin/moderation')) {
      await handleAdminModeration(req, res);
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && req.url.startsWith('/api/moderation')) {
      await handleModeration(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/projects/publication') {
      await handleProjectPublication(req, res);
      return;
    }

    if ((req.method === 'GET' || req.method === 'POST') && req.url.startsWith('/api/shop/packs')) {
      await handleShopPacks(req, res);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/ai-credits/admin')) {
      await handleCreditsAdminList(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai-credits/top-up') {
      await handleCreditTopUp(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/ai-credits/admin') {
      await handleCreditsAdminUpdate(req, res);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/ai-credits')) {
      await handleCredits(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/storage-upgrade') {
      await handleStorageUpgrade(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/shop/purchase') {
      await handleShopPurchase(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/gumroad/webhook') {
      await handleGumroadWebhook(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/generate') {
      await handleGenerate(req, res);
      return;
    }

    if (req.method === 'GET' && req.url.startsWith('/api/ai-job')) {
      await handleAiJob(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/image') {
      await handleImage(req, res);
      return;
    }

    if (req.method === 'POST' && req.url === '/api/remove-background') {
      await handleRemoveBackground(req, res);
      return;
    }

    serveStatic(req, res);
  } catch (error) {
    console.error('[api-error]', req.method, req.url, error);
    sendJson(res, error.status || error.statusCode || 500, {
      error: error.message || 'Erreur serveur.',
      code: error.code,
      balance: error.balance,
      required: error.required,
      retryAfter: error.retryAfter,
    });
  }
}));

server.requestTimeout = 0;
server.headersTimeout = 0;

server.listen(port, () => {
  console.log(`Escape Game Builder API listening on ${port}`);
});
