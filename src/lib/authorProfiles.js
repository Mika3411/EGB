const AUTHOR_PROFILES_KEY = 'escapeGameBuilder.authorProfiles.v1';

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const safeParse = (value, fallback) => {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
};

const readProfiles = () => {
  if (!canUseStorage()) return {};
  return safeParse(window.localStorage.getItem(AUTHOR_PROFILES_KEY), {});
};

const writeProfiles = (profiles) => {
  if (!canUseStorage()) return;
  window.localStorage.setItem(AUTHOR_PROFILES_KEY, JSON.stringify(profiles));
};

export const normalizeAuthorProfile = (profile = {}, user = {}) => ({
  displayName: profile.displayName || user.name || user.email || 'Créateur',
  tagline: profile.tagline || '',
  bio: profile.bio || '',
  website: profile.website || '',
  avatar: profile.avatar || '',
  blogPosts: Array.isArray(profile.blogPosts) ? profile.blogPosts : [],
  updatedAt: profile.updatedAt || '',
});

export const getAuthorProfile = (userId, fallbackUser = {}) => {
  if (!userId) return normalizeAuthorProfile({}, fallbackUser);
  return normalizeAuthorProfile(readProfiles()[userId] || {}, fallbackUser);
};

export const saveAuthorProfile = (userId, profile, fallbackUser = {}) => {
  if (!userId) return normalizeAuthorProfile(profile, fallbackUser);
  const profiles = readProfiles();
  const nextProfile = normalizeAuthorProfile({
    ...profiles[userId],
    ...profile,
    updatedAt: new Date().toISOString(),
  }, fallbackUser);
  profiles[userId] = nextProfile;
  writeProfiles(profiles);
  return nextProfile;
};
