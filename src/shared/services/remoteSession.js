import {
  getSupabaseClient,
  hasSupabaseAuthConfig,
  hasSupabaseConfig,
  hasSupabaseStorageConfig,
} from '../storage/supabaseStorage';

export const hasRemoteAuthConfig = hasSupabaseAuthConfig;
export const hasRemoteSupabaseConfig = hasSupabaseConfig;
export const hasRemoteStorageConfig = hasSupabaseStorageConfig;

export const getSupabaseAccessToken = async () => {
  if (!hasRemoteAuthConfig()) return '';
  const { data } = await getSupabaseClient().auth.getSession();
  return data.session?.access_token || '';
};

export const getSupabaseAuthHeaders = async () => {
  const token = await getSupabaseAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const subscribeToRemoteAuthStateChanges = (callback) => {
  if (!hasRemoteAuthConfig()) return null;
  const { data } = getSupabaseClient().auth.onAuthStateChange(callback);
  return data?.subscription || null;
};
