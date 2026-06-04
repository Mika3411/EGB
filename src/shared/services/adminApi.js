import { getAllAccounts, normalizeEmail, updateStoredAccount } from './authStorage';
import { getSupabaseAuthHeaders, hasRemoteSupabaseConfig } from './remoteSession';
import { fileToDataURL, uploadFileToSupabase } from '../utils/fileHelpers';
import { safeParseJson } from '../utils/storageHelpers';

const ADMIN_EMAIL = normalizeEmail(import.meta.env.VITE_ADMIN_EMAIL || '');
const ADMIN_USERS_ENDPOINT = import.meta.env.VITE_ADMIN_USERS_ENDPOINT || '/api/admin/users';
const ADMIN_CREDITS_ENDPOINT = import.meta.env.VITE_ADMIN_CREDITS_ENDPOINT || '/api/admin/credits';
const ADMIN_PROJECTS_ENDPOINT = import.meta.env.VITE_ADMIN_PROJECTS_ENDPOINT || '/api/admin/projects';
const ADMIN_MODERATION_ENDPOINT = import.meta.env.VITE_ADMIN_MODERATION_ENDPOINT || '/api/admin/moderation';
const LOCAL_PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';
const VISITOR_ANALYTICS_SURFACES = ['builder', 'gallery'];
const isConfiguredAdminEmail = (email = '') => Boolean(
  ADMIN_EMAIL && normalizeEmail(email) === ADMIN_EMAIL,
);

const readJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallbackMessage || `Requete admin impossible (${response.status}).`);
  return payload;
};

const getErrorMessage = (error) => error?.message || String(error || '');

const fallbackAdminPayload = (result, fallback, warning) => {
  if (result.status === 'fulfilled') return { payload: result.value, warning: '' };
  const details = getErrorMessage(result.reason);
  const nextWarning = details ? `${warning} ${details}` : warning;
  console.warn(nextWarning, result.reason);
  return { payload: fallback, warning: nextWarning };
};

const readLocalProjects = (userId) => {
  if (!userId || typeof window === 'undefined') return [];
  return safeParseJson(window.localStorage.getItem(`${LOCAL_PROJECTS_KEY_PREFIX}.${userId}`), []);
};

const DAY_MS = 24 * 60 * 60 * 1000;

const getTime = (value) => {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
};

const getConnectionTime = (account = {}) => Math.max(
  getTime(account.lastSignInAt),
  getTime(account.lastLoginAt),
  getTime(account.updatedAt),
);

const isWithinDays = (time, days, now) => Boolean(time && now - time <= days * DAY_MS);

const toSafeCount = (value = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

export const normalizeVisitorAnalyticsSummary = (visitorAnalytics = {}) => Object.fromEntries(
  VISITOR_ANALYTICS_SURFACES.map((surface) => {
    const entry = visitorAnalytics?.[surface] || {};
    return [surface, {
      visitors: toSafeCount(entry.visitors),
      visitors24h: toSafeCount(entry.visitors24h),
      visits: toSafeCount(entry.visits),
      visits24h: toSafeCount(entry.visits24h),
      updatedAt: entry.updatedAt || '',
    }];
  }),
);

export const getDisplayName = (account) =>
  account?.name || account?.email || account?.userId || 'Utilisateur';

export const getAdminProjectCount = (account) => Number.isFinite(Number(account?.projectCount))
  ? Number(account.projectCount)
  : (account?.projects || []).length;

const getRemoteProjectCount = (userId, account = {}, projectCounts = {}) => Math.max(
  Number(projectCounts[userId] || 0),
  Number(account.projectCount || 0),
);

export const getAdminAuthHeaders = async () => {
  return getSupabaseAuthHeaders();
};

export const canUseRemoteAdminApi = hasRemoteSupabaseConfig;

export const buildModerationState = (actions = []) => actions.reduce((state, action) => {
  if (action.target_type === 'game') state.games.add(action.target_id);
  if (action.target_type === 'blog') state.blogs.add(action.target_id);
  if (action.target_type === 'comment') state.comments.add(action.target_id);
  state.actions.push(action);
  return state;
}, {
  games: new Set(),
  blogs: new Set(),
  comments: new Set(),
  actions: [],
});

export const getManagedUsers = ({ accounts = [], supabaseUsers = [], creditUsers = [], projectCounts = {} }) => {
  const byId = new Map();

  accounts.forEach((account) => {
    const projects = readLocalProjects(account.id);
    const projectCount = Math.max(projects.length, getRemoteProjectCount(account.id, account, projectCounts));
    byId.set(account.id, {
      userId: account.id,
      name: account.name,
      email: account.email,
      provider: account.provider || 'local',
      status: account.status || 'active',
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastLoginAt: account.lastLoginAt,
      projects,
      projectCount,
      publicProjects: projects.filter((project) => project.shareState?.isPublic).length,
    });
  });

  supabaseUsers.forEach((account) => {
    const projects = readLocalProjects(account.id);
    const projectCount = Math.max(projects.length, getRemoteProjectCount(account.id, account, projectCounts));
    byId.set(account.id, {
      userId: account.id,
      name: account.name,
      email: account.email,
      provider: 'supabase',
      status: account.isDisabled ? 'disabled' : 'active',
      createdAt: account.createdAt,
      updatedAt: account.updatedAt,
      lastSignInAt: account.lastSignInAt,
      projects,
      projectCount,
      publicProjects: projects.filter((project) => project.shareState?.isPublic).length,
    });
  });

  creditUsers.forEach((creditAccount) => {
    if (isConfiguredAdminEmail(creditAccount.userId)) return;
    const existing = byId.get(creditAccount.userId) || {
      userId: creditAccount.userId,
      name: '',
      email: '',
      provider: 'credits',
      status: 'active',
      createdAt: creditAccount.createdAt,
      projects: [],
      projectCount: getRemoteProjectCount(creditAccount.userId, creditAccount, projectCounts),
      publicProjects: 0,
    };
    byId.set(creditAccount.userId, {
      ...existing,
      credits: creditAccount,
      projectCount: Math.max(
        Number(existing.projectCount || 0),
        getRemoteProjectCount(creditAccount.userId, creditAccount, projectCounts),
      ),
    });
  });

  return Array.from(byId.values())
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr'));
};

export const buildAdminStatistics = ({
  managedUsers = [],
  creditUsers = [],
  publicGames = [],
  visitorAnalytics = {},
  moderation = {},
  supportThreads = [],
  now = Date.now(),
} = {}) => {
  const users = Array.isArray(managedUsers) ? managedUsers : [];
  const credits = Array.isArray(creditUsers) ? creditUsers : [];
  const games = Array.isArray(publicGames) ? publicGames : [];
  const threads = Array.isArray(supportThreads) ? supportThreads : [];
  const visitors = normalizeVisitorAnalyticsSummary(visitorAnalytics);

  const usersWithConnection = users
    .map((account) => ({
      ...account,
      lastConnectionAt: getConnectionTime(account),
    }))
    .filter((account) => account.lastConnectionAt > 0);

  const countConnectionsWithinDays = (days) => usersWithConnection
    .filter((account) => isWithinDays(account.lastConnectionAt, days, now))
    .length;

  const totalProjectCount = users.reduce((sum, account) => sum + getAdminProjectCount(account), 0);
  const usersWithProjects = users.filter((account) => getAdminProjectCount(account) > 0).length;
  const publicAuthorIds = new Set(games.map((game) => game.userId).filter(Boolean));
  const totalPlays = games.reduce((sum, game) => sum + Number(game.plays || 0), 0);
  const totalVotes = games.reduce((sum, game) => sum + Number(game.feedback?.votes || 0), 0);
  const totalComments = games.reduce((sum, game) => sum + (game.feedback?.comments || []).length, 0);
  const totalCreditBalance = credits.reduce((sum, account) => sum + Number(account.balance || 0), 0);
  const recentCreditTransactions = credits.reduce((sum, account) => (
    sum + (Array.isArray(account.transactions) ? account.transactions.length : 0)
  ), 0);
  const supportOpen = threads.filter((thread) => thread.status !== 'closed').length;
  const supportWaitingReply = threads.filter((thread) => {
    const lastMessage = thread.messages?.[thread.messages.length - 1];
    return thread.status !== 'closed' && lastMessage?.authorRole === 'user';
  }).length;
  const newUsersLast30Days = users
    .filter((account) => isWithinDays(getTime(account.createdAt), 30, now))
    .length;

  return {
    totalUsers: users.length,
    activeUsers: users.filter((account) => account.status !== 'disabled').length,
    disabledUsers: users.filter((account) => account.status === 'disabled').length,
    supabaseUsers: users.filter((account) => account.provider === 'supabase').length,
    localUsers: users.filter((account) => account.provider === 'local').length,
    creditOnlyUsers: users.filter((account) => account.provider === 'credits').length,
    uniqueConnections: usersWithConnection.length,
    connectedLast24Hours: countConnectionsWithinDays(1),
    connectedLast7Days: countConnectionsWithinDays(7),
    connectedLast30Days: countConnectionsWithinDays(30),
    neverConnectedUsers: Math.max(0, users.length - usersWithConnection.length),
    newUsersLast30Days,
    totalProjectCount,
    usersWithProjects,
    publicGameCount: games.length,
    publicAuthorCount: publicAuthorIds.size,
    builderVisitors: visitors.builder.visitors,
    builderVisitors24h: visitors.builder.visitors24h,
    galleryVisitors: visitors.gallery.visitors,
    galleryVisitors24h: visitors.gallery.visitors24h,
    totalPlays,
    totalVotes,
    totalComments,
    totalCreditBalance,
    creditAccountCount: credits.length,
    recentCreditTransactions,
    moderationActions: Array.isArray(moderation.actions) ? moderation.actions.length : 0,
    supportOpen,
    supportWaitingReply,
    supportClosed: threads.filter((thread) => thread.status === 'closed').length,
    connectionWindows: [
      { id: '24h', label: '24h', count: countConnectionsWithinDays(1) },
      { id: '7d', label: '7 jours', count: countConnectionsWithinDays(7) },
      { id: '30d', label: '30 jours', count: countConnectionsWithinDays(30) },
      { id: 'never', label: 'Jamais', count: Math.max(0, users.length - usersWithConnection.length) },
    ],
    recentConnections: usersWithConnection
      .sort((a, b) => b.lastConnectionAt - a.lastConnectionAt)
      .slice(0, 6),
  };
};

export const loadAdminDashboard = async () => {
  const authHeaders = await getAdminAuthHeaders();
  const localAccounts = getAllAccounts()
    .filter((account) => !isConfiguredAdminEmail(account.email));

  const [usersResult, creditsResult, projectsResult, moderationResult] = await Promise.allSettled([
    hasRemoteSupabaseConfig()
      ? fetch(ADMIN_USERS_ENDPOINT, { headers: authHeaders })
        .then((response) => readJsonResponse(response, `Utilisateurs Supabase indisponibles (${response.status}).`))
      : Promise.resolve({ users: [] }),
    fetch(ADMIN_CREDITS_ENDPOINT, { headers: authHeaders })
      .then((response) => readJsonResponse(response, `Credits indisponibles (${response.status}).`)),
    fetch(ADMIN_PROJECTS_ENDPOINT, { headers: authHeaders })
      .then((response) => readJsonResponse(response, `Projets admin indisponibles (${response.status}).`)),
    fetch(ADMIN_MODERATION_ENDPOINT, { headers: authHeaders })
      .then((response) => readJsonResponse(response, `Moderation indisponible (${response.status}).`)),
  ]);
  const { payload: usersPayload, warning: usersWarning } = fallbackAdminPayload(
    usersResult,
    { users: [] },
    'Utilisateurs Supabase indisponibles.',
  );
  const { payload: creditsPayload } = fallbackAdminPayload(
    creditsResult,
    { users: [] },
    'Credits indisponibles.',
  );
  const { payload: projectsPayload } = fallbackAdminPayload(
    projectsResult,
    { projects: [] },
    'Projets admin indisponibles.',
  );
  const { payload: moderationPayload } = fallbackAdminPayload(
    moderationResult,
    { actions: [] },
    'Moderation indisponible.',
  );

  const supabaseUsers = Array.isArray(usersPayload.users) ? usersPayload.users : [];
  const projectCounts = Object.fromEntries(supabaseUsers.map((account) => [
    account.id,
    Number(account.projectCount || 0),
  ]));
  Object.entries(projectsPayload.projectCounts || {}).forEach(([userId, count]) => {
    projectCounts[userId] = Math.max(Number(projectCounts[userId] || 0), Number(count || 0));
  });

  return {
    accounts: localAccounts,
    warning: usersWarning,
    supabaseUsers,
    creditUsers: Array.isArray(creditsPayload.users) ? creditsPayload.users : [],
    projectCounts,
    publicGames: (projectsPayload.projects || []).filter((game) => !isConfiguredAdminEmail(game.authorEmail)),
    visitorAnalytics: normalizeVisitorAnalyticsSummary(projectsPayload.visitorAnalytics),
    moderation: buildModerationState(Array.isArray(moderationPayload.actions) ? moderationPayload.actions : []),
  };
};

export const updateAdminCredits = async ({ userId, action, amount, reason }) => {
  const response = await fetch(ADMIN_CREDITS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAdminAuthHeaders()),
    },
    body: JSON.stringify({ userId, action, amount, reason }),
  });
  return readJsonResponse(response, 'Modification crédits impossible.');
};

export const updateAdminUser = async ({ userId, action, ...options }) => {
  const response = await fetch(ADMIN_USERS_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAdminAuthHeaders()),
    },
    body: JSON.stringify({ userId, action, ...options }),
  });
  return readJsonResponse(response, 'Modification utilisateur impossible.');
};

export const updateAdminModeration = async ({ targetType, targetId, action, reason }) => {
  const response = await fetch(ADMIN_MODERATION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAdminAuthHeaders()),
    },
    body: JSON.stringify({ targetType, targetId, action, reason }),
  });
  return readJsonResponse(response, 'Moderation impossible.');
};

export const toggleStoredLocalAccountStatus = (targetUser) => {
  if (!targetUser?.userId || targetUser.provider === 'credits' || targetUser.provider === 'supabase') return null;
  const nextStatus = targetUser.status === 'disabled' ? 'active' : 'disabled';
  updateStoredAccount(targetUser.userId, { status: nextStatus });
  return {
    nextStatus,
    accounts: getAllAccounts().filter((account) => !isConfiguredAdminEmail(account.email)),
  };
};

export const createAdminShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const prepareAdminShopPackZip = async ({ file, packId, userId }) => {
  if (!file) throw new Error('Fichier ZIP manquant.');
  if (!/\.zip$/i.test(file.name)) throw new Error('Importe un fichier ZIP pour le pack.');

  const safePackId = packId || createAdminShopPackId();
  const patch = hasRemoteSupabaseConfig()
    ? await uploadFileToSupabase(file, {
      userId,
      folder: `shop-packs-${safePackId}`,
      optimizeImage: false,
      cacheControl: '0',
    }).then((result) => ({
      downloadUrl: result.publicUrl,
      downloadStoragePath: result.path,
      downloadMode: 'supabase',
    }))
    : {
      downloadUrl: await fileToDataURL(file),
      downloadStoragePath: '',
      downloadMode: 'local',
    };

  return {
    id: safePackId,
    downloadFileName: file.name,
    ...patch,
  };
};

export const prepareAdminShopPackScreenshots = async (files = []) => Promise.all(
  Array.from(files).map(async (file) => ({
    id: `shot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    src: await fileToDataURL(file),
  })),
);
