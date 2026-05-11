import { readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const AUTHOR_PROFILES_KEY = 'escapeGameBuilder.authorProfiles.v1';

const readProfiles = () => readJsonStorage(AUTHOR_PROFILES_KEY, {});

const writeProfiles = (profiles) => writeJsonStorage(AUTHOR_PROFILES_KEY, profiles);

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
