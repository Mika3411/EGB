import {
  getSupabaseAdminClient,
  json,
  parseBody,
  verifyUser,
  withErrors,
} from './_shared.js';
import {
  assertOwnSupportThread,
  createSupportThread,
  fetchSupportThread,
  insertSupportMessage,
  isSupportStorageUnavailable,
  makeSupportUnavailableError,
  mapSupportThread,
  supportThreadSelect,
  THREADS_TABLE_NAME,
  updateSupportStatus,
} from './_support.js';

export const handler = async (event) => withErrors(event, async () => {
  const user = await verifyUser(event);
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from(THREADS_TABLE_NAME)
      .select(supportThreadSelect)
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
      throw error;
    }

    return json(200, { threads: (data || []).map(mapSupportThread) });
  }

  if (event.httpMethod === 'POST') {
    const body = parseBody(event);
    const action = String(body.action || 'create');
    const messageBody = String(body.body || '').trim().slice(0, 2400);
    if (!messageBody) return json(400, { error: 'Message vide.' });

    if (action === 'create') {
      if (!String(body.subject || '').trim()) return json(400, { error: 'Sujet obligatoire.' });
      const thread = await createSupportThread(supabase, { body, payload: messageBody, user });
      return json(200, { thread });
    }

    if (action === 'reply') {
      const threadId = String(body.threadId || '').trim();
      if (!threadId) return json(400, { error: 'Conversation manquante.' });
      await assertOwnSupportThread(supabase, threadId, user.id);
      await insertSupportMessage(supabase, {
        threadId,
        user,
        body: messageBody,
        authorRole: 'user',
      });
      await updateSupportStatus(supabase, threadId, 'open');
      return json(200, { thread: await fetchSupportThread(supabase, threadId) });
    }

    return json(400, { error: 'Action support inconnue.' });
  }

  return json(405, { error: 'Methode non autorisee.' });
});
