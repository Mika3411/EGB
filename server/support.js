import { randomUUID } from 'node:crypto';
import { readJsonBody, sendJson } from './http.js';
import { verifySupabaseAdminRequest, verifySupabaseUserRequest } from './auth.js';
import { getSupabaseAdminClient } from './supabase.js';

const THREADS_TABLE = 'support_threads';
const MESSAGES_TABLE = 'support_messages';
const SUPPORT_CATEGORIES = new Set(['problem', 'suggestion', 'advice', 'review', 'help']);
const SUPPORT_STATUSES = new Set(['open', 'answered', 'pending', 'closed']);

const createId = () => randomUUID();

const normalizeCategory = (value) => (SUPPORT_CATEGORIES.has(value) ? value : 'help');
const normalizeStatus = (value) => (SUPPORT_STATUSES.has(value) ? value : 'open');

const isSupportStorageUnavailable = (error) => {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ].filter(Boolean).join(' ');
  return /relation .* does not exist|schema cache|PGRST|42P01|support_threads|support_messages/i.test(text);
};

const makeUnavailableError = (error) => {
  const unavailable = new Error(error?.message || 'Tables support Supabase absentes.');
  unavailable.status = 501;
  unavailable.code = 'SUPPORT_STORAGE_UNAVAILABLE';
  return unavailable;
};

const getUserName = (user = {}) => (
  user.user_metadata?.name
  || user.user_metadata?.pseudo
  || user.email?.split('@')?.[0]
  || 'Utilisateur'
);

const mapMessage = (message = {}) => ({
  id: message.id,
  threadId: message.thread_id,
  authorId: message.author_id || '',
  authorEmail: message.author_email || '',
  authorName: message.author_name || 'Utilisateur',
  authorRole: message.author_role || 'user',
  body: message.body || '',
  createdAt: message.created_at || '',
});

const mapThread = (thread = {}) => ({
  id: thread.id,
  userId: thread.user_id || '',
  userEmail: thread.user_email || '',
  userName: thread.user_name || 'Utilisateur',
  category: thread.category || 'help',
  subject: thread.subject || '',
  status: thread.status || 'open',
  pageUrl: thread.page_url || '',
  context: thread.context || '',
  createdAt: thread.created_at || '',
  updatedAt: thread.updated_at || thread.created_at || '',
  closedAt: thread.closed_at || '',
  messages: (thread.support_messages || [])
    .map(mapMessage)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
});

const supportThreadSelect = `
  id,
  user_id,
  user_email,
  user_name,
  category,
  subject,
  status,
  page_url,
  context,
  created_at,
  updated_at,
  closed_at,
  support_messages (
    id,
    thread_id,
    author_id,
    author_email,
    author_name,
    author_role,
    body,
    created_at
  )
`;

const fetchThread = async (client, threadId) => {
  const { data, error } = await client
    .from(THREADS_TABLE)
    .select(supportThreadSelect)
    .eq('id', threadId)
    .single();

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
    throw error;
  }

  return mapThread(data);
};

const assertOwnedThread = async (client, threadId, userId) => {
  const { data, error } = await client
    .from(THREADS_TABLE)
    .select('id,user_id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
    throw error;
  }

  if (!data?.id) {
    const notFound = new Error('Conversation introuvable.');
    notFound.status = 404;
    throw notFound;
  }

  return data;
};

const updateThreadStatus = async (client, threadId, status) => {
  const now = new Date().toISOString();
  const { error } = await client
    .from(THREADS_TABLE)
    .update({
      status,
      closed_at: status === 'closed' ? now : null,
      updated_at: now,
    })
    .eq('id', threadId);

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
    throw error;
  }
};

const insertMessage = async (client, {
  threadId,
  user,
  body,
  authorRole,
  authorName,
}) => {
  const { error } = await client
    .from(MESSAGES_TABLE)
    .insert({
      id: createId(),
      thread_id: threadId,
      author_id: user?.id || null,
      author_email: user?.email || '',
      author_name: authorName || getUserName(user),
      author_role: authorRole,
      body,
      created_at: new Date().toISOString(),
    });

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
    throw error;
  }
};

export const handleSupport = async (req, res) => {
  const user = await verifySupabaseUserRequest(req);
  const client = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const { data, error } = await client
      .from(THREADS_TABLE)
      .select(supportThreadSelect)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
      throw error;
    }

    sendJson(res, 200, { threads: (data || []).map(mapThread) });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Methode non autorisee.' });
    return;
  }

  const body = await readJsonBody(req, { maxBytes: 128 * 1024 });
  const action = String(body.action || 'create');
  const messageBody = String(body.body || '').trim().slice(0, 2400);
  if (!messageBody) {
    sendJson(res, 400, { error: 'Message vide.' });
    return;
  }

  if (action === 'create') {
    const subject = String(body.subject || '').trim().slice(0, 140);
    if (!subject) {
      sendJson(res, 400, { error: 'Sujet obligatoire.' });
      return;
    }
    const now = new Date().toISOString();
    const threadId = createId();
    const { error } = await client
      .from(THREADS_TABLE)
      .insert({
        id: threadId,
        user_id: user.id,
        user_email: user.email || '',
        user_name: getUserName(user),
        category: normalizeCategory(body.category),
        subject,
        status: 'open',
        page_url: String(body.pageUrl || '').slice(0, 500),
        context: String(body.context || '').slice(0, 500),
        created_at: now,
        updated_at: now,
      });

    if (error) {
      if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
      throw error;
    }

    await insertMessage(client, {
      threadId,
      user,
      body: messageBody,
      authorRole: 'user',
    });
    sendJson(res, 200, { thread: await fetchThread(client, threadId) });
    return;
  }

  if (action === 'reply') {
    const threadId = String(body.threadId || '').trim();
    if (!threadId) {
      sendJson(res, 400, { error: 'Conversation manquante.' });
      return;
    }
    await assertOwnedThread(client, threadId, user.id);
    await insertMessage(client, {
      threadId,
      user,
      body: messageBody,
      authorRole: 'user',
    });
    await updateThreadStatus(client, threadId, 'open');
    sendJson(res, 200, { thread: await fetchThread(client, threadId) });
    return;
  }

  sendJson(res, 400, { error: 'Action support inconnue.' });
};

export const handleAdminSupport = async (req, res) => {
  const adminUser = await verifySupabaseAdminRequest(req);
  const client = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const { data, error } = await client
      .from(THREADS_TABLE)
      .select(supportThreadSelect)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isSupportStorageUnavailable(error)) throw makeUnavailableError(error);
      throw error;
    }

    sendJson(res, 200, { threads: (data || []).map(mapThread) });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Methode non autorisee.' });
    return;
  }

  const body = await readJsonBody(req, { maxBytes: 128 * 1024 });
  const action = String(body.action || '');
  const threadId = String(body.threadId || '').trim();
  if (!threadId) {
    sendJson(res, 400, { error: 'Conversation manquante.' });
    return;
  }

  if (action === 'reply') {
    const messageBody = String(body.body || '').trim().slice(0, 2400);
    if (!messageBody) {
      sendJson(res, 400, { error: 'Réponse vide.' });
      return;
    }
    const status = normalizeStatus(body.status || 'answered');
    await insertMessage(client, {
      threadId,
      user: adminUser,
      body: messageBody,
      authorRole: 'admin',
      authorName: 'Support',
    });
    await updateThreadStatus(client, threadId, status);
    sendJson(res, 200, { thread: await fetchThread(client, threadId) });
    return;
  }

  if (action === 'status') {
    const status = normalizeStatus(body.status);
    await updateThreadStatus(client, threadId, status);
    sendJson(res, 200, { thread: await fetchThread(client, threadId) });
    return;
  }

  sendJson(res, 400, { error: 'Action support inconnue.' });
};
