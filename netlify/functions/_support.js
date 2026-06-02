const THREADS_TABLE = 'support_threads';
const MESSAGES_TABLE = 'support_messages';
const SUPPORT_CATEGORIES = new Set(['problem', 'suggestion', 'advice', 'review', 'help']);
const SUPPORT_STATUSES = new Set(['open', 'answered', 'pending', 'closed']);

export const normalizeSupportCategory = (value) => (SUPPORT_CATEGORIES.has(value) ? value : 'help');
export const normalizeSupportStatus = (value) => (SUPPORT_STATUSES.has(value) ? value : 'open');

export const isSupportStorageUnavailable = (error) => {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ].filter(Boolean).join(' ');
  return /relation .* does not exist|schema cache|PGRST|42P01|support_threads|support_messages/i.test(text);
};

export const makeSupportUnavailableError = (error) => {
  const unavailable = new Error(error?.message || 'Tables support Supabase absentes.');
  unavailable.statusCode = 501;
  unavailable.code = 'SUPPORT_STORAGE_UNAVAILABLE';
  return unavailable;
};

export const getSupportUserName = (user = {}) => (
  user.user_metadata?.name
  || user.user_metadata?.pseudo
  || user.email?.split('@')?.[0]
  || 'Utilisateur'
);

export const supportThreadSelect = `
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

export const mapSupportMessage = (message = {}) => ({
  id: message.id,
  threadId: message.thread_id,
  authorId: message.author_id || '',
  authorEmail: message.author_email || '',
  authorName: message.author_name || 'Utilisateur',
  authorRole: message.author_role || 'user',
  body: message.body || '',
  createdAt: message.created_at || '',
});

export const mapSupportThread = (thread = {}) => ({
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
    .map(mapSupportMessage)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
});

export const fetchSupportThread = async (supabase, threadId) => {
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .select(supportThreadSelect)
    .eq('id', threadId)
    .single();

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
    throw error;
  }

  return mapSupportThread(data);
};

export const assertOwnSupportThread = async (supabase, threadId, userId) => {
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .select('id,user_id')
    .eq('id', threadId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
    throw error;
  }

  if (!data?.id) {
    const notFound = new Error('Conversation introuvable.');
    notFound.statusCode = 404;
    throw notFound;
  }

  return data;
};

export const insertSupportMessage = async (supabase, {
  threadId,
  user,
  body,
  authorRole,
  authorName,
}) => {
  const { error } = await supabase
    .from(MESSAGES_TABLE)
    .insert({
      thread_id: threadId,
      author_id: user?.id || null,
      author_email: user?.email || '',
      author_name: authorName || getSupportUserName(user),
      author_role: authorRole,
      body,
      created_at: new Date().toISOString(),
    });

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
    throw error;
  }
};

export const updateSupportStatus = async (supabase, threadId, status) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from(THREADS_TABLE)
    .update({
      status,
      closed_at: status === 'closed' ? now : null,
      updated_at: now,
    })
    .eq('id', threadId);

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
    throw error;
  }
};

export const createSupportThread = async (supabase, { body, payload, user }) => {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from(THREADS_TABLE)
    .insert({
      user_id: user.id,
      user_email: user.email || '',
      user_name: getSupportUserName(user),
      category: normalizeSupportCategory(body.category),
      subject: String(body.subject || '').trim().slice(0, 140),
      status: 'open',
      page_url: String(body.pageUrl || '').slice(0, 500),
      context: String(body.context || '').slice(0, 500),
      created_at: now,
      updated_at: now,
    })
    .select('id')
    .single();

  if (error) {
    if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
    throw error;
  }

  await insertSupportMessage(supabase, {
    threadId: data.id,
    user,
    body: payload,
    authorRole: 'user',
  });
  return fetchSupportThread(supabase, data.id);
};

export const THREADS_TABLE_NAME = THREADS_TABLE;
