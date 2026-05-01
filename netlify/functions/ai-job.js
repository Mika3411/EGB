import {
  getCreditUserId,
  getSupabaseAdminClient,
  json,
  readAiJob,
  withErrors,
} from './_shared.js';

export const handler = async (event) => withErrors(event, async () => {
  if (event.httpMethod !== 'GET') return json(405, { error: 'Methode non autorisee.' });

  const query = event.queryStringParameters || {};
  const jobId = String(query.id || '').trim();
  if (!jobId) return json(400, { error: 'Job IA manquant.' });

  const supabase = getSupabaseAdminClient();
  const job = await readAiJob(supabase, jobId);
  const userId = getCreditUserId(event, { userId: query.userId });
  if (job.userId && userId !== 'anonymous' && job.userId !== userId) {
    return json(403, { error: 'Job IA refuse.' });
  }

  return json(200, job);
});
