import {
  buildStoragePath,
  deleteStorageFile,
  downloadTextFile,
  getSupabaseClient,
  hasSupabaseAuthConfig,
  hasSupabaseStorageConfig,
  isStorageNotFoundError,
  uploadToStorage,
} from '../supabaseStorage';
import {
  canUseLocalStorage,
  readJsonStorage,
  removeStorageKey,
  writeJsonStorage,
} from '../utils/storageHelpers';

const ACCOUNTS_KEY = 'escape_builder_accounts_v1';
const SESSION_KEY = 'escape_builder_session_v1';
const PROJECTS_KEY = 'escape_builder_projects_v1';
const SIGNUP_ATTEMPTS_KEY = 'escape_builder_signup_attempts_v1';
const SIGNUP_COOLDOWN_MS = 10 * 60 * 1000;
const PROJECT_RECORDS_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

const readJson = (key, fallback) => readJsonStorage(key, fallback);

const writeJson = (key, value) => writeJsonStorage(key, value);

const getSignupAttempts = () => readJson(SIGNUP_ATTEMPTS_KEY, {});

const getSignupCooldownRemainingMs = (email) => {
  const attempts = getSignupAttempts();
  const lastAttemptAt = Number(attempts[normalizeEmail(email)] || 0);
  if (!lastAttemptAt) return 0;
  return Math.max(0, SIGNUP_COOLDOWN_MS - (Date.now() - lastAttemptAt));
};

const rememberSignupAttempt = (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !canUseLocalStorage()) return;
  const attempts = getSignupAttempts();
  attempts[normalizedEmail] = Date.now();
  writeJson(SIGNUP_ATTEMPTS_KEY, attempts);
};

const formatCooldown = (milliseconds) => {
  const minutes = Math.ceil(milliseconds / 60000);
  return `${minutes} minute${minutes > 1 ? 's' : ''}`;
};

const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');

const randomSalt = () => {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
};

const getProjectStoragePath = (userId) => buildStoragePath('users', userId, 'project.json');
const getProjectsStoragePath = (userId) => buildStoragePath('users', userId, 'projects.json');
const getProjectRecordStoragePath = (userId, projectId) => buildStoragePath('users', userId, 'projects', `${projectId || 'project'}.json`);
const getPublicProjectsStoragePath = () => buildStoragePath('public', 'projects.json');

const getLocalProjects = () => readJson(PROJECTS_KEY, {});

const updateLocalProjectCache = (userId, project) => {
  if (!userId) return null;
  const entry = {
    project,
    updatedAt: new Date().toISOString(),
  };
  const projects = getLocalProjects();
  projects[userId] = entry;
  writeJson(PROJECTS_KEY, projects);
  return entry;
};

export const normalizeEmail = (value = '') => String(value).trim().toLowerCase();
const ADMIN_EMAIL = normalizeEmail(import.meta.env.VITE_ADMIN_EMAIL || '');
const normalizeRole = (value = '') => String(value).trim().toLowerCase();
const hasTruthyAdminFlag = (value) => value === true || /^(1|true|yes)$/i.test(String(value || ''));
const getMetadataRoles = (metadata = {}) => {
  const roles = Array.isArray(metadata.roles)
    ? metadata.roles
    : typeof metadata.roles === 'string'
      ? metadata.roles.split(/[,\s]+/)
      : [];
  return [...roles, metadata.role].map(normalizeRole).filter(Boolean);
};
const isConfiguredAdminEmail = (email = '') => Boolean(
  ADMIN_EMAIL && normalizeEmail(email) === ADMIN_EMAIL,
);

export async function hashPassword(password, salt) {
  const input = `${salt}:${password}`;
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return toHex(hash);
  }

  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = ((hash << 5) - hash) + input.charCodeAt(index);
    hash |= 0;
  }
  return String(hash);
}

export function getAllAccounts() {
  return readJson(ACCOUNTS_KEY, []);
}

export function saveAllAccounts(accounts = []) {
  const safeAccounts = Array.isArray(accounts) ? accounts : [];
  writeJson(ACCOUNTS_KEY, safeAccounts);
  return safeAccounts;
}

function rememberAccount(account) {
  if (!account?.id) return account;
  const accounts = getAllAccounts();
  const existing = accounts.find((entry) => entry.id === account.id || normalizeEmail(entry.email || '') === normalizeEmail(account.email || ''));
  const nextAccount = {
    ...(existing || {}),
    ...account,
    updatedAt: new Date().toISOString(),
  };
  const nextAccounts = [
    nextAccount,
    ...accounts.filter((entry) => entry.id !== nextAccount.id && normalizeEmail(entry.email || '') !== normalizeEmail(nextAccount.email || '')),
  ];
  saveAllAccounts(nextAccounts);
  return nextAccount;
}

export function updateStoredAccount(accountId, patch = {}) {
  if (!accountId) return null;
  const accounts = getAllAccounts();
  const nextAccounts = accounts.map((account) => (
    account.id === accountId ? { ...account, ...patch, updatedAt: new Date().toISOString() } : account
  ));
  saveAllAccounts(nextAccounts);
  return nextAccounts.find((account) => account.id === accountId) || null;
}

export function getSessionUserId() {
  if (!canUseLocalStorage()) return '';
  return window.localStorage.getItem(SESSION_KEY) || '';
}

export const supabaseUserToAccount = (user) => {
  if (!user) return null;
  const metadata = user.app_metadata || {};
  const roles = getMetadataRoles(metadata);
  const isAdmin = Boolean(
    hasTruthyAdminFlag(metadata.isAdmin)
    || hasTruthyAdminFlag(metadata.is_admin)
    || roles.includes('admin')
  );
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
    email: user.email || '',
    createdAt: user.created_at || new Date().toISOString(),
    provider: 'supabase',
    role: isAdmin ? 'admin' : 'user',
    roles: isAdmin ? Array.from(new Set([...roles, 'admin'])) : Array.from(new Set(roles.length ? roles : ['user'])),
    isAdmin,
  };
};

export const getAccountRole = (account) => {
  const safeAccount = account || {};
  return safeAccount.isAdmin || safeAccount.role === 'admin' || safeAccount.roles?.includes?.('admin') ? 'admin' : 'user';
};

export const isAdminAccount = (account = {}) => getAccountRole(account) === 'admin';

const getEmailRedirectUrl = () => {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
};

const withTimeout = (promise, milliseconds, fallback = null) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(fallback), milliseconds);
  promise
    .then((value) => resolve(value))
    .catch(() => resolve(fallback))
    .finally(() => clearTimeout(timer));
});

export async function getSessionUser() {
  if (hasSupabaseAuthConfig()) {
    const client = getSupabaseClient();
    const session = await withTimeout(client.auth.getSession(), 10000, null);
    if (!session) return null;
    const { data, error } = session;
    if (error) return null;
    const account = supabaseUserToAccount(data.session?.user);
    return account ? rememberAccount(account) : null;
  }

  const userId = getSessionUserId();
  if (!userId) return null;
  return getAllAccounts().find((account) => account.id === userId) || null;
}

export async function registerUser({
  name,
  email,
  password,
  profileType = '',
  organization = '',
  country = '',
  language = 'fr',
  marketingConsent = false,
  acceptedTerms = false,
}) {
  const normalizedEmail = normalizeEmail(email);
  const cooldownRemaining = getSignupCooldownRemainingMs(normalizedEmail);
  if (cooldownRemaining > 0) {
    throw new Error(`Une demande d’inscription vient déjà d’être envoyée pour cet email. Réessaie dans ${formatCooldown(cooldownRemaining)}.`);
  }

  if (hasSupabaseAuthConfig()) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: getEmailRedirectUrl(),
        data: {
          name: name.trim(),
          profileType,
          organization: organization.trim(),
          country: country.trim(),
          language,
          marketingConsent: Boolean(marketingConsent),
          acceptedTerms: Boolean(acceptedTerms),
          acceptedTermsAt: acceptedTerms ? new Date().toISOString() : '',
        },
      },
    });

    if (error) throw error;
    rememberSignupAttempt(normalizedEmail);
    const account = supabaseUserToAccount(data.user);
    if (!account) throw new Error('Inscription impossible.');
    return rememberAccount({
      ...account,
      needsEmailConfirmation: !data.session,
    });
  }

  const accounts = getAllAccounts();

  if (accounts.some((account) => normalizeEmail(account.email) === normalizedEmail)) {
    throw new Error('Un compte existe déjà avec cet email.');
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const account = {
    id: `user_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: name.trim(),
    email: normalizedEmail,
    profileType,
    organization: organization.trim(),
    country: country.trim(),
    language,
    marketingConsent: Boolean(marketingConsent),
    acceptedTerms: Boolean(acceptedTerms),
    acceptedTermsAt: acceptedTerms ? new Date().toISOString() : '',
    role: isConfiguredAdminEmail(email) ? 'admin' : 'user',
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };
  account.roles = [account.role];
  account.isAdmin = account.role === 'admin';

  accounts.push(account);
  writeJson(ACCOUNTS_KEY, accounts);
  rememberSignupAttempt(normalizedEmail);
  window.localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export async function loginUser({ email, password }) {
  if (hasSupabaseAuthConfig()) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.signInWithPassword({
      email: normalizeEmail(email),
      password,
    });

    if (error) {
      if (/email not confirmed/i.test(error.message || '')) {
        throw new Error('Adresse email non confirmée. Clique sur le lien reçu par email avant de te connecter.');
      }
      throw error;
    }
    const account = supabaseUserToAccount(data.user);
    if (!account) throw new Error('Connexion impossible.');
    return rememberAccount({
      ...account,
      lastLoginAt: new Date().toISOString(),
    });
  }

  const normalizedEmail = normalizeEmail(email);
  const account = getAllAccounts().find((entry) => normalizeEmail(entry.email) === normalizedEmail);

  if (!account) {
    throw new Error('Compte introuvable.');
  }

  if (account.status === 'disabled') {
    throw new Error('Ce compte est desactive.');
  }

  const passwordHash = await hashPassword(password, account.salt);
  if (passwordHash !== account.passwordHash) {
    throw new Error('Mot de passe incorrect.');
  }

  window.localStorage.setItem(SESSION_KEY, account.id);
  return rememberAccount({
    ...account,
    role: account.role || (isConfiguredAdminEmail(account.email) ? 'admin' : 'user'),
    roles: account.roles || [account.role || 'user'],
    isAdmin: Boolean(account.isAdmin || account.role === 'admin'),
    lastLoginAt: new Date().toISOString(),
  });
}

export async function sendPasswordResetEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (hasSupabaseAuthConfig()) {
    const client = getSupabaseClient();
    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: getEmailRedirectUrl(),
    });
    if (error) throw error;
    return true;
  }

  const account = getAllAccounts().find((entry) => normalizeEmail(entry.email) === normalizedEmail);
  if (!account) throw new Error('Compte introuvable.');
  throw new Error('La réinitialisation par email nécessite Supabase.');
}

export async function updateCurrentUserPassword({ password, currentPassword = '' } = {}) {
  if (hasSupabaseAuthConfig()) {
    const client = getSupabaseClient();
    if (currentPassword) {
      const { data: sessionData } = await client.auth.getSession();
      const email = sessionData.session?.user?.email || '';
      if (!email) throw new Error('Session introuvable. Reconnecte-toi avant de changer le mot de passe.');
      const { error: confirmationError } = await client.auth.signInWithPassword({
        email: normalizeEmail(email),
        password: currentPassword,
      });
      if (confirmationError) {
        throw new Error('Mot de passe actuel incorrect.');
      }
    }
    const { data, error } = await client.auth.updateUser({ password });
    if (error) throw error;
    const account = supabaseUserToAccount(data.user);
    if (!account) throw new Error('Mot de passe mis à jour, mais session introuvable.');
    return account;
  }

  throw new Error('La réinitialisation par lien nécessite Supabase.');
}

export function isPasswordRecoverySession() {
  if (!hasSupabaseAuthConfig() || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('type') === 'recovery';
}

export async function logoutUser() {
  if (hasSupabaseAuthConfig()) {
    const client = getSupabaseClient();
    await client.auth.signOut();
  }

  removeStorageKey(SESSION_KEY);
}

export async function saveProjectRecordsForUser(userId, projects = [], options = {}) {
  if (!userId) return [];
  const normalizedProjects = Array.isArray(projects) ? projects : [];

  if (!hasSupabaseStorageConfig()) {
    return normalizedProjects;
  }

  const storedProjects = [];
  for (const project of normalizedProjects) {
    if (!project?.id) continue;
    storedProjects.push(await uploadProjectRecordForUser(userId, project));
  }

  const projectIndex = storedProjects.map((project) => getProjectIndexRecord(userId, project));
  const indexBlob = new Blob([JSON.stringify(projectIndex, null, 2)], { type: 'application/json' });
  await uploadToStorage(getProjectsStoragePath(userId), indexBlob, {
    contentType: 'application/json',
    cacheControl: '0',
    maxFileSize: PROJECT_RECORDS_MAX_UPLOAD_BYTES,
    visibility: 'private',
    upsert: true,
  });

  if (options.requirePublicIndex) await updatePublicProjectIndexForUser(userId, storedProjects);

  return storedProjects;
}

const getProjectIndexRecord = (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const { data, project: legacyProject, ...metadata } = project;
  return {
    ...metadata,
    storagePath,
  };
};

const uploadProjectRecordForUser = async (userId, project = {}) => {
  const storagePath = project.storagePath || getProjectRecordStoragePath(userId, project.id);
  const record = { ...project, storagePath };
  const blob = new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' });
  await uploadToStorage(storagePath, blob, {
    contentType: 'application/json',
    cacheControl: '0',
    maxFileSize: PROJECT_RECORDS_MAX_UPLOAD_BYTES,
    visibility: 'private',
    upsert: true,
  });
  return record;
};

export async function deleteProjectRecordForUser(userId, project = {}) {
  if (!userId || !project?.id || !hasSupabaseStorageConfig()) return false;

  const projectsPrefix = buildStoragePath('users', userId, 'projects');
  const storagePath = typeof project.storagePath === 'string' && project.storagePath.startsWith(`${projectsPrefix}/`)
    ? project.storagePath
    : getProjectRecordStoragePath(userId, project.id);

  await deleteStorageFile(storagePath, { visibility: 'private' });
  return true;
}

export async function saveProjectRecordForUser(userId, project = {}, projects = [], options = {}) {
  if (!userId || !project?.id) return project;
  const normalizedProjects = Array.isArray(projects) ? projects : [];

  if (!hasSupabaseStorageConfig()) return project;

  const storedProject = await uploadProjectRecordForUser(userId, project);
  const storedProjects = [];
  for (const record of normalizedProjects) {
    if (!record?.id) continue;
    if (record.id === storedProject.id) {
      storedProjects.push(storedProject);
    } else if (record.storagePath) {
      storedProjects.push(record);
    } else {
      storedProjects.push(await uploadProjectRecordForUser(userId, record));
    }
  }
  const projectIndex = storedProjects
    .filter((record) => record?.id)
    .map((record) => getProjectIndexRecord(userId, record));
  const indexBlob = new Blob([JSON.stringify(projectIndex, null, 2)], { type: 'application/json' });
  await uploadToStorage(getProjectsStoragePath(userId), indexBlob, {
    contentType: 'application/json',
    cacheControl: '0',
    maxFileSize: PROJECT_RECORDS_MAX_UPLOAD_BYTES,
    visibility: 'private',
    upsert: true,
  });

  if (options.requirePublicIndex) await updatePublicProjectIndexForUser(userId, storedProjects);

  return {
    ...storedProject,
    syncedProjects: storedProjects,
  };
}

export async function loadPublicProjectIndex() {
  if (!hasSupabaseStorageConfig()) return [];

  try {
    const text = await downloadTextFile(getPublicProjectsStoragePath(), { visibility: 'public' });
    const projects = JSON.parse(text);
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    if (isStorageNotFoundError(error)) return [];
    throw error;
  }
}

async function savePublicProjectIndex() {
  const error = new Error('La mise a jour de l index public doit passer par l API serveur.');
  error.code = 'PUBLIC_PROJECT_INDEX_SERVER_REQUIRED';
  throw error;
}

async function updatePublicProjectIndexForUser(userId) {
  if (!userId || !hasSupabaseStorageConfig()) return [];
  return savePublicProjectIndex();
}

export async function loadProjectRecordsForUser(userId) {
  if (!userId || !hasSupabaseStorageConfig()) return null;

  try {
    const text = await downloadTextFile(getProjectsStoragePath(userId), { visibility: 'private' });
    const projects = JSON.parse(text);
    if (!Array.isArray(projects)) return [];
    return Promise.all(projects.map(async (project) => {
      if (!project?.storagePath) return project;
      try {
        const projectText = await downloadTextFile(project.storagePath, { visibility: 'private' });
        return { ...project, ...JSON.parse(projectText), storagePath: project.storagePath };
      } catch (error) {
        if (isStorageNotFoundError(error)) return project;
        throw error;
      }
    }));
  } catch (error) {
    if (isStorageNotFoundError(error)) return null;
    throw error;
  }
}

export async function loadProjectForUser(userId) {
  if (!userId) return null;

  if (!hasSupabaseStorageConfig()) {
    return getLocalProjects()[userId]?.project || null;
  }

  try {
    const text = await downloadTextFile(getProjectStoragePath(userId), { visibility: 'private' });
    const project = JSON.parse(text);
    updateLocalProjectCache(userId, project);
    return project;
  } catch (error) {
    const fallback = getLocalProjects()[userId]?.project || null;
    if (fallback) return fallback;

    if (isStorageNotFoundError(error)) return null;
    throw error;
  }
}

export async function getProjectMetaForUser(userId) {
  if (!userId) return null;
  const localMeta = getLocalProjects()[userId] || null;
  return localMeta;
}
