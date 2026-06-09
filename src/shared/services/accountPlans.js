export const ACCOUNT_TYPE_PERSONAL = 'particulier';
export const ACCOUNT_TYPE_PRO = 'pro';
export const ACCOUNT_PROFILE_TYPE_ESCAPE_ROOM = 'escape_room';

export const ACCOUNT_TYPE_OPTIONS = [
  [ACCOUNT_TYPE_PERSONAL, 'Particulier'],
  [ACCOUNT_TYPE_PRO, 'Salle d’escape / pro'],
];

const ACCOUNT_TYPE_ALIASES = new Map([
  ['individual', ACCOUNT_TYPE_PERSONAL],
  ['personal', ACCOUNT_TYPE_PERSONAL],
  ['particulier', ACCOUNT_TYPE_PERSONAL],
  ['private', ACCOUNT_TYPE_PERSONAL],
  ['pro', ACCOUNT_TYPE_PRO],
  ['professional', ACCOUNT_TYPE_PRO],
  ['professionnel', ACCOUNT_TYPE_PRO],
  ['business', ACCOUNT_TYPE_PRO],
  ['company', ACCOUNT_TYPE_PRO],
  ['organisation', ACCOUNT_TYPE_PRO],
  ['organization', ACCOUNT_TYPE_PRO],
]);

export const normalizeAccountType = (value = '') => {
  const normalized = String(value || '').trim().toLowerCase();
  return ACCOUNT_TYPE_ALIASES.get(normalized) || ACCOUNT_TYPE_PERSONAL;
};

export const getAccountType = (account = {}) => normalizeAccountType(
  account?.accountType
  || account?.account_type
  || account?.plan
  || account?.user_metadata?.accountType
  || account?.user_metadata?.account_type
  || '',
);

export const isProfessionalAccount = (account = {}) => getAccountType(account) === ACCOUNT_TYPE_PRO;

export const getAccountTypeLabel = (account = {}) => (
  isProfessionalAccount(account) ? 'Compte Pro' : 'Compte particulier'
);
