import { getAllAccounts, normalizeEmail, updateStoredAccount } from './authStorage';
import { getSupabaseClient, hasSupabaseConfig } from '../supabaseStorage';
import { fileToDataURL, uploadFileToSupabase } from '../utils/fileHelpers';

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL || 'thorez.m@hotmail.fr';
const ADMIN_USERS_ENDPOINT = import.meta.env.VITE_ADMIN_USERS_ENDPOINT || '/api/admin/users';
const ADMIN_CREDITS_ENDPOINT = import.meta.env.VITE_ADMIN_CREDITS_ENDPOINT || '/api/admin/credits';
const ADMIN_PROJECTS_ENDPOINT = import.meta.env.VITE_ADMIN_PROJECTS_ENDPOINT || '/api/admin/projects';
const ADMIN_MODERATION_ENDPOINT = import.meta.env.VITE_ADMIN_MODERATION_ENDPOINT || '/api/admin/moderation';
const LOCAL_PROJECTS_KEY_PREFIX = 'escapeGameBuilder.projects';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || fallbackMessage || `Requete admin impossible (${response.status}).`);
  return payload;
};

const readLocalProjects = (userId) => {
  if (!userId || typeof window === 'undefined') return [];
  return safeParse(window.localStorage.getItem(`${LOCAL_PROJECTS_KEY_PREFIX}.${userId}`), []);
};

export const getDisplayName = (account) =>
  account?.name || account?.email || account?.userId || 'Utilisateur';

export const getAdminAuthHeaders = async () => {
  if (!hasSupabaseConfig()) return {};
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

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

export const getManagedUsers = ({ accounts = [], supabaseUsers = [], creditUsers = [] }) => {
  const byId = new Map();

  accounts.forEach((account) => {
    const projects = readLocalProjects(account.id);
    byId.set(account.id, {
      userId: account.id,
      name: account.name,
      email: account.email,
      provider: account.provider || 'local',
      status: account.status || 'active',
      createdAt: account.createdAt,
      projects,
      publicProjects: projects.filter((project) => project.shareState?.isPublic).length,
    });
  });

  supabaseUsers.forEach((account) => {
    const projects = readLocalProjects(account.id);
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
      publicProjects: projects.filter((project) => project.shareState?.isPublic).length,
    });
  });

  creditUsers.forEach((creditAccount) => {
    if (normalizeEmail(creditAccount.userId) === normalizeEmail(ADMIN_EMAIL)) return;
    const existing = byId.get(creditAccount.userId) || {
      userId: creditAccount.userId,
      name: '',
      email: '',
      provider: 'credits',
      status: 'active',
      createdAt: creditAccount.createdAt,
      projects: [],
      publicProjects: 0,
    };
    byId.set(creditAccount.userId, {
      ...existing,
      credits: creditAccount,
    });
  });

  return Array.from(byId.values())
    .sort((a, b) => getDisplayName(a).localeCompare(getDisplayName(b), 'fr'));
};

export const loadAdminDashboard = async () => {
  const authHeaders = await getAdminAuthHeaders();
  const localAccounts = getAllAccounts()
    .filter((account) => normalizeEmail(account.email) !== normalizeEmail(ADMIN_EMAIL));

  const [usersPayload, creditsPayload, projectsPayload, moderationPayload] = await Promise.all([
    hasSupabaseConfig()
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

  return {
    accounts: localAccounts,
    supabaseUsers: Array.isArray(usersPayload.users) ? usersPayload.users : [],
    creditUsers: Array.isArray(creditsPayload.users) ? creditsPayload.users : [],
    publicGames: (projectsPayload.projects || []).filter((game) => normalizeEmail(game.authorEmail) !== normalizeEmail(ADMIN_EMAIL)),
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
  return readJsonResponse(response, 'Modification credits impossible.');
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
    accounts: getAllAccounts().filter((account) => normalizeEmail(account.email) !== normalizeEmail(ADMIN_EMAIL)),
  };
};

export const createAdminShopPackId = () => `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

export const prepareAdminShopPackZip = async ({ file, packId, userId }) => {
  if (!file) throw new Error('Fichier ZIP manquant.');
  if (!/\.zip$/i.test(file.name)) throw new Error('Importe un fichier ZIP pour le pack.');

  const safePackId = packId || createAdminShopPackId();
  const patch = hasSupabaseConfig()
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
