import { getSupabaseAuthHeaders } from '../services/remoteSession';

export const getAiAuthHeaders = async () => {
  return getSupabaseAuthHeaders();
};
