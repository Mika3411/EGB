import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const SUPABASE_BROWSER_KEY = SUPABASE_PUBLISHABLE_KEY || SUPABASE_ANON_KEY;

export const STORAGE_BUCKET = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'escape-game-assets';

let supabaseClient = null;

export function hasSupabaseConfig() {
  return Boolean(SUPABASE_URL && SUPABASE_BROWSER_KEY);
}

export function getSupabaseClient() {
  if (!hasSupabaseConfig()) {
    throw new Error(
      'Configuration Supabase manquante. Ajoute VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY).',
    );
  }

  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_BROWSER_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }

  return supabaseClient;
}

const sanitizeSegment = (value = '') =>
  String(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase() || 'asset';

export function buildStoragePath(...segments) {
  return segments
    .filter(Boolean)
    .map((segment) => sanitizeSegment(segment))
    .join('/');
}

export async function uploadToStorage(path, file, options = {}) {
  const client = getSupabaseClient();
  const { upsert = true, cacheControl = '3600', contentType } = options;

  const { error } = await client.storage
    .from(STORAGE_BUCKET)
    .upload(path, file, {
      upsert,
      cacheControl,
      contentType: contentType || file?.type || 'application/octet-stream',
    });

  if (error) throw error;

  const { data } = client.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return {
    path,
    publicUrl: data.publicUrl,
  };
}

export async function downloadTextFile(path) {
  const client = getSupabaseClient();
  const { data, error } = await client.storage.from(STORAGE_BUCKET).download(path);
  if (error) throw error;
  return data.text();
}
