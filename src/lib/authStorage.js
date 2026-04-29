import { buildStoragePath, downloadTextFile, getSupabaseClient, hasSupabaseConfig, uploadToStorage } from '../supabaseStorage';

const ACCOUNTS_KEY = 'escape_builder_accounts_v1';
const SESSION_KEY = 'escape_builder_session_v1';
const PROJECTS_KEY = 'escape_builder_projects_v1';
const SIGNUP_ATTEMPTS_KEY = 'escape_builder_signup_attempts_v1';
const SIGNUP_COOLDOWN_MS = 10 * 60 * 1000;

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const readJson = (key, fallback) => {
  if (!canUseStorage()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const writeJson = (key, value) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const getSignupAttempts = () => readJson(SIGNUP_ATTEMPTS_KEY, {});

const getSignupCooldownRemainingMs = (email) => {
  const attempts = getSignupAttempts();
  const lastAttemptAt = Number(attempts[normalizeEmail(email)] || 0);
  if (!lastAttemptAt) return 0;
  return Math.max(0, SIGNUP_COOLDOWN_MS - (Date.now() - lastAttemptAt));
};

const rememberSignupAttempt = (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || !canUseStorage()) return;
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

export const normalizeEmail = (value = '') => value.trim().toLowerCase();

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
  if (!canUseStorage()) return '';
  return window.localStorage.getItem(SESSION_KEY) || '';
}

const supabaseUserToAccount = (user) => {
  if (!user) return null;
  return {
    id: user.id,
    name: user.user_metadata?.name || user.email?.split('@')[0] || 'Utilisateur',
    email: user.email || '',
    createdAt: user.created_at || new Date().toISOString(),
    provider: 'supabase',
  };
};

const getEmailRedirectUrl = () => {
  if (typeof window === 'undefined') return undefined;
  return `${window.location.origin}${window.location.pathname}`;
};

export async function getSessionUser() {
  if (hasSupabaseConfig()) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.getSession();
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

  if (hasSupabaseConfig()) {
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
    salt,
    passwordHash,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  writeJson(ACCOUNTS_KEY, accounts);
  rememberSignupAttempt(normalizedEmail);
  window.localStorage.setItem(SESSION_KEY, account.id);
  return account;
}

export async function loginUser({ email, password }) {
  if (hasSupabaseConfig()) {
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
    return rememberAccount(account);
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
  return account;
}

export async function sendPasswordResetEmail(email) {
  const normalizedEmail = normalizeEmail(email);

  if (hasSupabaseConfig()) {
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

export async function updateCurrentUserPassword(password) {
  if (hasSupabaseConfig()) {
    const client = getSupabaseClient();
    const { data, error } = await client.auth.updateUser({ password });
    if (error) throw error;
    const account = supabaseUserToAccount(data.user);
    if (!account) throw new Error('Mot de passe mis à jour, mais session introuvable.');
    return account;
  }

  throw new Error('La réinitialisation par lien nécessite Supabase.');
}

export function isPasswordRecoverySession() {
  if (!hasSupabaseConfig() || typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  return params.get('type') === 'recovery';
}

export async function logoutUser() {
  if (hasSupabaseConfig()) {
    const client = getSupabaseClient();
    await client.auth.signOut();
  }

  if (!canUseStorage()) return;
  window.localStorage.removeItem(SESSION_KEY);
}

export async function saveProjectRecordsForUser(userId, projects = [], options = {}) {
  if (!userId) return [];
  const normalizedProjects = Array.isArray(projects) ? projects : [];

  if (!hasSupabaseConfig()) {
    return normalizedProjects;
  }

  const blob = new Blob([JSON.stringify(normalizedProjects, null, 2)], { type: 'application/json' });
  await uploadToStorage(getProjectsStoragePath(userId), blob, {
    contentType: 'application/json',
    cacheControl: '0',
  });

  if (options.requirePublicIndex) {
    await updatePublicProjectIndexForUser(userId, normalizedProjects);
  } else {
    await updatePublicProjectIndexForUser(userId, normalizedProjects).catch((error) => {
      console.warn('Index public impossible a mettre a jour', error);
    });
  }

  return normalizedProjects;
}

export async function loadPublicProjectIndex() {
  if (!hasSupabaseConfig()) return [];

  try {
    const text = await downloadTextFile(getPublicProjectsStoragePath());
    const projects = JSON.parse(text);
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    const message = String(error?.message || '');
    const isMissingFile = /not found|object not found|status code 400|status code 404/i.test(message);
    if (isMissingFile) return [];
    throw error;
  }
}

async function savePublicProjectIndex(projects = []) {
  if (!hasSupabaseConfig()) return projects;
  const blob = new Blob([JSON.stringify(projects, null, 2)], { type: 'application/json' });
  await uploadToStorage(getPublicProjectsStoragePath(), blob, {
    contentType: 'application/json',
    cacheControl: '0',
  });
  return projects;
}

async function updatePublicProjectIndexForUser(userId, projects = []) {
  if (!userId || !hasSupabaseConfig()) return [];

  const publicRecords = projects
    .filter((project) => project?.id && project.shareState?.isPublic)
    .map((project) => ({
      ...project,
      userId,
      publicKey: `${userId}:${project.id}`,
    }));

  const existingIndex = await loadPublicProjectIndex();
  const withoutUser = existingIndex.filter((project) => project.userId !== userId);
  return savePublicProjectIndex([...withoutUser, ...publicRecords]);
}

export async function loadProjectRecordsForUser(userId) {
  if (!userId || !hasSupabaseConfig()) return null;

  try {
    const text = await downloadTextFile(getProjectsStoragePath(userId));
    const projects = JSON.parse(text);
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    const message = String(error?.message || '');
    const isMissingFile = /not found|object not found|status code 400|status code 404/i.test(message);
    if (isMissingFile) return null;
    throw error;
  }
}

export async function loadProjectForUser(userId) {
  if (!userId) return null;

  if (!hasSupabaseConfig()) {
    return getLocalProjects()[userId]?.project || null;
  }

  try {
    const text = await downloadTextFile(getProjectStoragePath(userId));
    const project = JSON.parse(text);
    updateLocalProjectCache(userId, project);
    return project;
  } catch (error) {
    const fallback = getLocalProjects()[userId]?.project || null;
    if (fallback) return fallback;

    const message = String(error?.message || '');
    const isMissingFile = /not found|object not found|status code 400|status code 404/i.test(message);
    if (isMissingFile) return null;
    throw error;
  }
}

export async function getProjectMetaForUser(userId) {
  if (!userId) return null;
  const localMeta = getLocalProjects()[userId] || null;
  return localMeta;
}
