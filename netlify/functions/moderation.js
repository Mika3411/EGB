import {
  getSupabaseAdminClient,
  json,
  parseBody,
  verifyAdmin,
  withErrors,
} from './_shared.js';

const publicFields = 'target_type,target_id,action,reason,created_at,updated_at';

export const handler = async (event) => withErrors(event, async () => {
  const supabase = getSupabaseAdminClient();

  if (event.httpMethod === 'GET') {
    const { data, error } = await supabase
      .from('moderation_actions')
      .select(publicFields)
      .eq('action', 'hidden')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return json(200, { actions: data || [] });
  }

  if (event.httpMethod === 'POST') {
    const adminUser = await verifyAdmin(event);
    const body = parseBody(event);
    const targetType = String(body.targetType || '').trim();
    const targetId = String(body.targetId || '').trim();
    const action = String(body.action || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 240);

    if (!['game', 'blog', 'comment'].includes(targetType)) return json(400, { error: 'Type de cible invalide.' });
    if (!targetId) return json(400, { error: 'Cible manquante.' });
    if (!['hidden', 'visible'].includes(action)) return json(400, { error: 'Action de moderation invalide.' });

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('moderation_actions')
      .upsert({
        target_type: targetType,
        target_id: targetId,
        action,
        reason,
        moderator_email: adminUser.email || '',
        updated_at: now,
      }, { onConflict: 'target_type,target_id' })
      .select('*')
      .single();

    if (error) throw error;
    return json(200, { action: data });
  }

  return json(405, { error: 'Methode non autorisee.' });
});
