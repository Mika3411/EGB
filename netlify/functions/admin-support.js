import {
  getSupabaseAdminClient,
  json,
  parseBody,
  verifyAdmin,
  withErrors,
} from './_shared.js';
import {
  fetchSupportThread,
  insertSupportMessage,
  isSupportStorageUnavailable,
  makeSupportUnavailableError,
  mapSupportThread,
  normalizeSupportStatus,
  supportThreadSelect,
  THREADS_TABLE_NAME,
  updateSupportStatus,
} from './_support.js';

export const handler = async (event) => withErrors(event, async () => {
  const adminUser = await verifyAdmin(event);
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from(THREADS_TABLE_NAME)
      .select(supportThreadSelect)
      .order('updated_at', { ascending: false });

    if (error) {
      if (isSupportStorageUnavailable(error)) throw makeSupportUnavailableError(error);
      throw error;
    }

    return json(200, { threads: (data || []).map(mapSupportThread) });
  }

  if (event.httpMethod === 'POST') {
    const body = parseBody(event);
    const threadId = String(body.threadId || '').trim();
    if (!threadId) return json(400, { error: 'Conversation manquante.' });

    if (body.action === 'reply') {
      const messageBody = String(body.body || '').trim().slice(0, 2400);
      if (!messageBody) return json(400, { error: 'Réponse vide.' });
      const status = normalizeSupportStatus(body.status || 'answered');
      await insertSupportMessage(supabase, {
        threadId,
        user: adminUser,
        body: messageBody,
        authorRole: 'admin',
        authorName: 'Support',
      });
      await updateSupportStatus(supabase, threadId, status);
      return json(200, { thread: await fetchSupportThread(supabase, threadId) });
    }

    if (body.action === 'status') {
      const status = normalizeSupportStatus(body.status);
      await updateSupportStatus(supabase, threadId, status);
      return json(200, { thread: await fetchSupportThread(supabase, threadId) });
    }

    return json(400, { error: 'Action support inconnue.' });
  }

  return json(405, { error: 'Methode non autorisee.' });
});
