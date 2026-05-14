import { readJsonBody, sendJson } from './http.js';
import { verifySupabaseAdminRequest } from './auth.js';
import { getSupabaseAdminClient } from './supabase.js';

export const handleAdminModeration = async (req, res) => {
  await verifySupabaseAdminRequest(req);
  await handleModeration(req, res, { includePrivateFields: true });
};

export const toPublicModerationAction = (action = {}) => ({
  target_type: action.target_type,
  target_id: action.target_id,
  action: action.action,
});

export const handleModeration = async (req, res, options = {}) => {
  const client = getSupabaseAdminClient();

  if (req.method === 'GET') {
    const { data, error } = await client
      .from('moderation_actions')
      .select(options.includePrivateFields
        ? 'target_type,target_id,action,reason,created_at,updated_at'
        : 'target_type,target_id,action')
      .eq('action', 'hidden')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    sendJson(res, 200, {
      actions: options.includePrivateFields ? data || [] : (data || []).map(toPublicModerationAction),
    });
    return;
  }

  if (req.method === 'POST') {
    const adminUser = await verifySupabaseAdminRequest(req);
    const body = await readJsonBody(req);
    const targetType = String(body.targetType || '').trim();
    const targetId = String(body.targetId || '').trim();
    const action = String(body.action || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 240);

    if (!['game', 'blog', 'comment'].includes(targetType)) {
      sendJson(res, 400, { error: 'Type de cible invalide.' });
      return;
    }
    if (!targetId) {
      sendJson(res, 400, { error: 'Cible manquante.' });
      return;
    }
    if (!['hidden', 'visible'].includes(action)) {
      sendJson(res, 400, { error: 'Action de moderation invalide.' });
      return;
    }

    const { data, error } = await client
      .from('moderation_actions')
      .upsert({
        target_type: targetType,
        target_id: targetId,
        action,
        reason,
        moderator_email: adminUser.email || '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'target_type,target_id' })
      .select('*')
      .single();

    if (error) throw error;
    sendJson(res, 200, { action: data });
    return;
  }

  sendJson(res, 405, { error: 'Methode non autorisee.' });
};
