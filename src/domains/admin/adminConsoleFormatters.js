import { getAccountType } from '../../shared/services/accountPlans';
import { getStorageQuotaBytes } from '../../shared/services/storageQuota';

export const MB = 1024 * 1024;

const ONLINE_WINDOW_MS = 15 * 60 * 1000;

export const formatDate = (value) => {
  if (!value) return 'Jamais';
  try {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return 'Date inconnue';
  }
};

export const formatNumber = (value) => new Intl.NumberFormat('fr-FR').format(Number(value || 0));

export const getAccountStorageQuotaBytes = (account = {}) => getStorageQuotaBytes({
  storageQuotaBytes: account?.credits?.storageQuotaBytes,
  account,
});

export const getProviderLabel = (provider = '') => ({
  supabase: 'Supabase',
  local: 'Local',
  credits: 'Crédits seuls',
}[provider] || provider || 'Inconnu');

export const getLastConnectionDate = (account = {}) => (
  account.lastSignInAt || account.lastLoginAt || account.updatedAt || ''
);

export const isAccountOnline = (account = {}) => {
  if (account.status === 'disabled') return false;
  const time = new Date(getLastConnectionDate(account)).getTime();
  return Number.isFinite(time) && Date.now() - time <= ONLINE_WINDOW_MS;
};

export const getPresenceLabel = (account = {}) => (isAccountOnline(account) ? 'En ligne' : 'Hors ligne');

export const getAccountTypeActionLabel = (account = {}) => (
  getAccountType(account) === 'pro' ? 'Reléguer en particulier' : 'Promouvoir en Pro'
);
