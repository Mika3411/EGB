import { getSupabaseClient, hasSupabaseConfig } from '../supabaseStorage';

export const getAiAuthHeaders = async () => {
  if (!hasSupabaseConfig()) return {};
  const { data } = await getSupabaseClient().auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};
