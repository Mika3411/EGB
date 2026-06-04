const MODERATION_ENDPOINT = import.meta.env.VITE_MODERATION_ENDPOINT || '/api/moderation';

const emptyModeration = {
  games: new Set(),
  blogs: new Set(),
  comments: new Set(),
  actions: [],
};

export async function getModerationState() {
  try {
    const response = await fetch(MODERATION_ENDPOINT);
    if (!response.ok) throw new Error(`Moderation indisponible (${response.status}).`);
    const payload = await response.json();
    const actions = Array.isArray(payload.actions) ? payload.actions : [];
    return actions.reduce((state, action) => {
      if (action.target_type === 'game') state.games.add(action.target_id);
      if (action.target_type === 'blog') state.blogs.add(action.target_id);
      if (action.target_type === 'comment') state.comments.add(action.target_id);
      state.actions.push(action);
      return state;
    }, {
      games: new Set(),
      blogs: new Set(),
      comments: new Set(),
      actions,
    });
  } catch {
    return emptyModeration;
  }
}

export async function updateModerationAction({ targetType, targetId, action, reason = '', authHeaders = {} }) {
  const response = await fetch(MODERATION_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify({ targetType, targetId, action, reason }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || 'Moderation impossible.');
  return payload.action;
}

export const getBlogModerationId = (userId, postId) => `${userId}:${postId}`;
