import { getSupabaseClient, hasSupabaseConfig } from '../supabaseStorage';

const POSTS_TABLE = 'forum_posts';
const REPLIES_TABLE = 'forum_replies';

const isForumStorageUnavailable = (error) => {
  const text = [
    error?.message,
    error?.details,
    error?.hint,
    error?.code,
  ].filter(Boolean).join(' ');
  return /relation .* does not exist|schema cache|PGRST|42P01|forum_posts|forum_replies/i.test(text);
};

const mapReplyFromRow = (row = {}) => ({
  id: row.id,
  author: row.author || 'Createur',
  ownerId: row.owner_id || '',
  body: row.body || '',
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || row.created_at || '',
});

const mapPostFromRow = (row = {}) => ({
  id: row.id,
  category: row.category || 'help',
  author: row.author || 'Createur',
  ownerId: row.owner_id || '',
  title: row.title || '',
  body: row.body || '',
  link: row.link || '',
  replies: (row.forum_replies || [])
    .map(mapReplyFromRow)
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)),
  readOnly: Boolean(row.read_only),
  createdAt: row.created_at || '',
  updatedAt: row.updated_at || row.created_at || '',
});

export const canUseSupabaseForum = () => hasSupabaseConfig();

export async function loadForumPostsFromSupabase() {
  if (!canUseSupabaseForum()) return null;
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(POSTS_TABLE)
    .select(`
      id,
      category,
      author,
      owner_id,
      title,
      body,
      link,
      read_only,
      created_at,
      updated_at,
      forum_replies (
        id,
        post_id,
        author,
        owner_id,
        body,
        created_at,
        updated_at
      )
    `)
    .order('updated_at', { ascending: false });

  if (error) {
    if (isForumStorageUnavailable(error)) return null;
    throw error;
  }

  return Array.isArray(data) ? data.map(mapPostFromRow) : [];
}

export async function createForumPostInSupabase({ post, userId }) {
  if (!canUseSupabaseForum()) return null;
  const client = getSupabaseClient();
  const timestamp = post.createdAt || new Date().toISOString();
  const { data, error } = await client
    .from(POSTS_TABLE)
    .insert({
      id: post.id,
      category: post.category,
      author: post.author,
      owner_id: userId,
      title: post.title,
      body: post.body,
      link: post.link || '',
      read_only: false,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select()
    .single();

  if (error) {
    if (isForumStorageUnavailable(error)) return null;
    throw error;
  }

  return mapPostFromRow({ ...data, forum_replies: [] });
}

export async function updateForumPostInSupabase({ postId, patch, userId }) {
  if (!canUseSupabaseForum()) return null;
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(POSTS_TABLE)
    .update({
      category: patch.category,
      title: patch.title,
      body: patch.body,
      link: patch.link || '',
      updated_at: patch.updatedAt || new Date().toISOString(),
    })
    .eq('id', postId)
    .eq('owner_id', userId)
    .select()
    .single();

  if (error) {
    if (isForumStorageUnavailable(error)) return null;
    throw error;
  }

  return mapPostFromRow({ ...data, forum_replies: [] });
}

export async function deleteForumPostFromSupabase({ postId, userId }) {
  if (!canUseSupabaseForum()) return false;
  const client = getSupabaseClient();
  const { error } = await client
    .from(POSTS_TABLE)
    .delete()
    .eq('id', postId)
    .eq('owner_id', userId);

  if (error) {
    if (isForumStorageUnavailable(error)) return false;
    throw error;
  }

  return true;
}

export async function createForumReplyInSupabase({ postId, reply, userId }) {
  if (!canUseSupabaseForum()) return null;
  const client = getSupabaseClient();
  const timestamp = reply.createdAt || new Date().toISOString();
  const { data, error } = await client
    .from(REPLIES_TABLE)
    .insert({
      id: reply.id,
      post_id: postId,
      author: reply.author,
      owner_id: userId,
      body: reply.body,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select()
    .single();

  if (error) {
    if (isForumStorageUnavailable(error)) return null;
    throw error;
  }

  return mapReplyFromRow(data);
}

export async function updateForumReplyInSupabase({ replyId, body, userId }) {
  if (!canUseSupabaseForum()) return null;
  const client = getSupabaseClient();
  const { data, error } = await client
    .from(REPLIES_TABLE)
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq('id', replyId)
    .eq('owner_id', userId)
    .select()
    .single();

  if (error) {
    if (isForumStorageUnavailable(error)) return null;
    throw error;
  }

  return mapReplyFromRow(data);
}

export async function deleteForumReplyFromSupabase({ replyId, userId }) {
  if (!canUseSupabaseForum()) return false;
  const client = getSupabaseClient();
  const { error } = await client
    .from(REPLIES_TABLE)
    .delete()
    .eq('id', replyId)
    .eq('owner_id', userId);

  if (error) {
    if (isForumStorageUnavailable(error)) return false;
    throw error;
  }

  return true;
}

export function subscribeToForumChanges(onChange) {
  if (!canUseSupabaseForum()) return () => {};
  const client = getSupabaseClient();
  const channel = client
    .channel('help-forum')
    .on('postgres_changes', { event: '*', schema: 'public', table: POSTS_TABLE }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: REPLIES_TABLE }, onChange)
    .subscribe();

  return () => {
    client.removeChannel(channel);
  };
}
