import { getSupabaseAuthHeaders, hasRemoteSupabaseConfig } from './remoteSession';
import { readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const SUPPORT_ENDPOINT = import.meta.env.VITE_SUPPORT_ENDPOINT || '/api/support';
const ADMIN_SUPPORT_ENDPOINT = import.meta.env.VITE_ADMIN_SUPPORT_ENDPOINT || '/api/admin/support';
const SUPPORT_STORAGE_KEY = 'escapeGameBuilder.supportThreads.v1';

export const SUPPORT_CATEGORIES = [
  ['problem', 'Problème'],
  ['suggestion', 'Suggestion'],
  ['advice', 'Conseil'],
  ['review', 'Avis'],
  ['help', 'Aide'],
];

export const SUPPORT_STATUSES = [
  ['open', 'Ouvert'],
  ['answered', 'Répondu'],
  ['pending', 'À suivre'],
  ['closed', 'Clos'],
];

const CATEGORY_VALUES = new Set(SUPPORT_CATEGORIES.map(([value]) => value));
const STATUS_VALUES = new Set(SUPPORT_STATUSES.map(([value]) => value));

export const getSupportCategoryLabel = (value) => (
  SUPPORT_CATEGORIES.find(([entryValue]) => entryValue === value)?.[1] || 'Aide'
);

export const getSupportStatusLabel = (value) => (
  SUPPORT_STATUSES.find(([entryValue]) => entryValue === value)?.[1] || 'Ouvert'
);

export const getSupportUserId = (user = {}) => (
  user?.id || user?.email || 'local-user'
);

export const getSupportUserName = (user = {}) => (
  user?.name
  || user?.pseudo
  || user?.username
  || user?.email?.split('@')?.[0]
  || 'Utilisateur'
);

const getSupportUserEmail = (user = {}) => user?.email || '';

const createSupportId = (prefix = 'support') => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
};

const normalizeCategory = (value) => (CATEGORY_VALUES.has(value) ? value : 'help');
const normalizeStatus = (value) => (STATUS_VALUES.has(value) ? value : 'open');

export const normalizeSupportMessage = (message = {}) => ({
  id: message.id || createSupportId('msg'),
  threadId: message.threadId || message.thread_id || '',
  authorId: message.authorId || message.author_id || '',
  authorEmail: message.authorEmail || message.author_email || '',
  authorName: message.authorName || message.author_name || 'Utilisateur',
  authorRole: message.authorRole || message.author_role || 'user',
  body: String(message.body || '').slice(0, 2400),
  createdAt: message.createdAt || message.created_at || new Date().toISOString(),
});

export const normalizeSupportThread = (thread = {}) => {
  const createdAt = thread.createdAt || thread.created_at || new Date().toISOString();
  const updatedAt = thread.updatedAt || thread.updated_at || createdAt;
  const messages = (thread.messages || thread.support_ticket_messages || [])
    .map(normalizeSupportMessage)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));

  return {
    id: thread.id || createSupportId('ticket'),
    userId: thread.userId || thread.user_id || '',
    userEmail: thread.userEmail || thread.user_email || '',
    userName: thread.userName || thread.user_name || 'Utilisateur',
    category: normalizeCategory(thread.category),
    subject: String(thread.subject || '').slice(0, 140),
    status: normalizeStatus(thread.status),
    pageUrl: thread.pageUrl || thread.page_url || '',
    context: thread.context || '',
    createdAt,
    updatedAt,
    closedAt: thread.closedAt || thread.closed_at || '',
    messages,
  };
};

const sortThreads = (threads = []) => [...threads]
  .map(normalizeSupportThread)
  .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

const readLocalThreads = () => sortThreads(readJsonStorage(SUPPORT_STORAGE_KEY, []));

const writeLocalThreads = (threads) => {
  const nextThreads = sortThreads(threads);
  writeJsonStorage(SUPPORT_STORAGE_KEY, nextThreads);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('support-messages-updated'));
  }
  return nextThreads;
};

const hasRemoteSupport = () => hasRemoteSupabaseConfig();

const getAuthHeaders = async () => {
  return getSupabaseAuthHeaders();
};

const readJsonResponse = async (response, fallbackMessage) => {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || fallbackMessage || `Requête support impossible (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
};

const requestSupportJson = async (endpoint, options = {}) => {
  const authHeaders = await getAuthHeaders();
  if (!authHeaders.Authorization) {
    const error = new Error('Session Supabase absente.');
    error.status = 401;
    throw error;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(options.headers || {}),
    },
  });
  return readJsonResponse(response, 'Messagerie indisponible.');
};

const shouldUseLocalFallback = (error) => (
  !hasRemoteSupport()
  || Number(error?.status || 0) === 404
  || Number(error?.status || 0) === 501
  || Number(error?.status || 0) >= 500
  || /fetch|network|session supabase absente|table|relation|schema|support/i.test(String(error?.message || ''))
);

const createLocalThread = (payload = {}, user = {}) => {
  const timestamp = new Date().toISOString();
  const threadId = createSupportId('ticket');
  const message = normalizeSupportMessage({
    id: createSupportId('msg'),
    threadId,
    authorId: getSupportUserId(user),
    authorEmail: getSupportUserEmail(user),
    authorName: getSupportUserName(user),
    authorRole: 'user',
    body: payload.body,
    createdAt: timestamp,
  });
  const thread = normalizeSupportThread({
    id: threadId,
    userId: getSupportUserId(user),
    userEmail: getSupportUserEmail(user),
    userName: getSupportUserName(user),
    category: payload.category,
    subject: payload.subject,
    status: 'open',
    pageUrl: payload.pageUrl,
    context: payload.context,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages: [message],
  });
  writeLocalThreads([thread, ...readLocalThreads()]);
  return thread;
};

const appendLocalMessage = ({ threadId, body, user, authorRole = 'user', status = '' }) => {
  const timestamp = new Date().toISOString();
  let updatedThread = null;
  const nextThreads = readLocalThreads().map((thread) => {
    if (thread.id !== threadId) return thread;
    const message = normalizeSupportMessage({
      id: createSupportId('msg'),
      threadId,
      authorId: getSupportUserId(user),
      authorEmail: getSupportUserEmail(user),
      authorName: authorRole === 'admin' ? 'Support' : getSupportUserName(user),
      authorRole,
      body,
      createdAt: timestamp,
    });
    updatedThread = normalizeSupportThread({
      ...thread,
      status: status || (authorRole === 'admin' ? 'answered' : 'open'),
      updatedAt: timestamp,
      messages: [...(thread.messages || []), message],
    });
    return updatedThread;
  });
  writeLocalThreads(nextThreads);
  return updatedThread;
};

const updateLocalThreadStatus = ({ threadId, status }) => {
  const timestamp = new Date().toISOString();
  let updatedThread = null;
  const nextThreads = readLocalThreads().map((thread) => {
    if (thread.id !== threadId) return thread;
    updatedThread = normalizeSupportThread({
      ...thread,
      status,
      closedAt: status === 'closed' ? timestamp : '',
      updatedAt: timestamp,
    });
    return updatedThread;
  });
  writeLocalThreads(nextThreads);
  return updatedThread;
};

export const loadUserSupportThreads = async (user = {}) => {
  try {
    const payload = await requestSupportJson(SUPPORT_ENDPOINT);
    return sortThreads(payload.threads || []);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    const userId = getSupportUserId(user);
    return readLocalThreads().filter((thread) => thread.userId === userId);
  }
};

export const createSupportTicket = async (payload = {}, user = {}) => {
  const cleanPayload = {
    category: normalizeCategory(payload.category),
    subject: String(payload.subject || '').trim().slice(0, 140),
    body: String(payload.body || '').trim().slice(0, 2400),
    pageUrl: String(payload.pageUrl || '').slice(0, 500),
    context: String(payload.context || '').slice(0, 500),
  };
  if (!cleanPayload.subject || !cleanPayload.body) {
    throw new Error('Sujet et message sont obligatoires.');
  }

  try {
    const response = await requestSupportJson(SUPPORT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ action: 'create', ...cleanPayload }),
    });
    return normalizeSupportThread(response.thread);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return createLocalThread(cleanPayload, user);
  }
};

export const sendUserSupportMessage = async ({ threadId, body }, user = {}) => {
  const cleanBody = String(body || '').trim().slice(0, 2400);
  if (!threadId || !cleanBody) throw new Error('Message vide.');

  try {
    const response = await requestSupportJson(SUPPORT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ action: 'reply', threadId, body: cleanBody }),
    });
    return normalizeSupportThread(response.thread);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return appendLocalMessage({ threadId, body: cleanBody, user, authorRole: 'user' });
  }
};

export const loadAdminSupportThreads = async () => {
  try {
    const payload = await requestSupportJson(ADMIN_SUPPORT_ENDPOINT);
    return sortThreads(payload.threads || []);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return readLocalThreads();
  }
};

export const replyToSupportThread = async ({ threadId, body, status = 'answered' }, user = {}) => {
  const cleanBody = String(body || '').trim().slice(0, 2400);
  if (!threadId || !cleanBody) throw new Error('Réponse vide.');

  try {
    const response = await requestSupportJson(ADMIN_SUPPORT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ action: 'reply', threadId, body: cleanBody, status: normalizeStatus(status) }),
    });
    return normalizeSupportThread(response.thread);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return appendLocalMessage({ threadId, body: cleanBody, user, authorRole: 'admin', status: normalizeStatus(status) });
  }
};

export const updateSupportThreadStatus = async ({ threadId, status }) => {
  const nextStatus = normalizeStatus(status);
  if (!threadId) throw new Error('Conversation manquante.');

  try {
    const response = await requestSupportJson(ADMIN_SUPPORT_ENDPOINT, {
      method: 'POST',
      body: JSON.stringify({ action: 'status', threadId, status: nextStatus }),
    });
    return normalizeSupportThread(response.thread);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) throw error;
    return updateLocalThreadStatus({ threadId, status: nextStatus });
  }
};
