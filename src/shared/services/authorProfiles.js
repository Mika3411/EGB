import { readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const AUTHOR_PROFILES_KEY = 'escapeGameBuilder.authorProfiles.v1';

const readProfiles = () => readJsonStorage(AUTHOR_PROFILES_KEY, {});

const writeProfiles = (profiles) => writeJsonStorage(AUTHOR_PROFILES_KEY, profiles);

export const AUTHOR_SOCIAL_LINK_TYPES = [
  { type: 'site', label: 'Site' },
  { type: 'instagram', label: 'Instagram' },
  { type: 'youtube', label: 'YouTube' },
  { type: 'tiktok', label: 'TikTok' },
  { type: 'discord', label: 'Discord' },
  { type: 'x-twitter', label: 'X/Twitter' },
  { type: 'linkedin', label: 'LinkedIn' },
];

export const AUTHOR_PROFILE_THEME_DEFAULTS = {
  pageBackground: '#08101d',
  panelBackground: '#0f172a',
  accentColor: '#60a5fa',
  textColor: '#f8fafc',
  mutedTextColor: '#cbd5e1',
};

const AUTHOR_SOCIAL_LINK_TYPE_ALIASES = {
  twitter: 'x-twitter',
  x: 'x-twitter',
  'x/twitter': 'x-twitter',
};

const AUTHOR_SOCIAL_LINK_TYPES_SET = new Set(AUTHOR_SOCIAL_LINK_TYPES.map((link) => link.type));

const normalizeProfileString = (value = '') => String(value || '').trim();

const normalizeProfileColor = (value = '', fallback = '#000000') => {
  const color = normalizeProfileString(value).toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(color)) return color;
  if (/^#[0-9a-f]{3}$/.test(color)) {
    return `#${color.slice(1).split('').map((digit) => `${digit}${digit}`).join('')}`;
  }
  return fallback;
};

const normalizeLikeCount = (value = 0) => {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, count) : 0;
};

const normalizeBlogPost = (post = {}) => {
  const likedBy = Array.isArray(post.likedBy)
    ? [...new Set(post.likedBy.map((userId) => normalizeProfileString(userId)).filter(Boolean))]
    : [];
  const likes = Math.max(normalizeLikeCount(post.likes), likedBy.length);

  return {
    ...post,
    id: normalizeProfileString(post.id),
    title: String(post.title || ''),
    body: String(post.body || ''),
    likes,
    likedBy,
  };
};

const normalizeBlogPosts = (blogPosts = []) => (
  Array.isArray(blogPosts) ? blogPosts.map(normalizeBlogPost).filter((post) => post.id) : []
);

export const formatAuthorBlogPostDateTime = (value = '') => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Paris',
  }).format(date).replace(',', ' à');
};

const normalizeSocialLinkType = (type = '') => {
  const normalized = String(type || '').trim().toLowerCase();
  return AUTHOR_SOCIAL_LINK_TYPE_ALIASES[normalized] || normalized;
};

export const normalizeAuthorSocialLinks = (socialLinks = [], website = '') => {
  const urlsByType = new Map();
  if (Array.isArray(socialLinks)) {
    socialLinks.forEach((link) => {
      const type = normalizeSocialLinkType(link?.type);
      if (!AUTHOR_SOCIAL_LINK_TYPES_SET.has(type)) return;
      const url = normalizeProfileString(link?.url);
      if (url || !urlsByType.has(type)) urlsByType.set(type, url);
    });
  }

  const websiteUrl = normalizeProfileString(website);
  if (websiteUrl && !urlsByType.get('site')) urlsByType.set('site', websiteUrl);

  return AUTHOR_SOCIAL_LINK_TYPES.map(({ type }) => ({
    type,
    url: urlsByType.get(type) || '',
  }));
};

export const getAuthorSocialLinkUrl = (socialLinks = [], type = '') => (
  normalizeAuthorSocialLinks(socialLinks).find((link) => link.type === type)?.url || ''
);

export const setAuthorSocialLinkUrl = (socialLinks = [], type = '', url = '', website = '') => {
  const normalizedType = normalizeSocialLinkType(type);
  return normalizeAuthorSocialLinks(socialLinks, website).map((link) => (
    link.type === normalizedType ? { ...link, url: normalizeProfileString(url) } : link
  ));
};

export const normalizeAuthorProfileTheme = (theme = {}) => {
  const source = theme && typeof theme === 'object' ? theme : {};
  return Object.fromEntries(
    Object.entries(AUTHOR_PROFILE_THEME_DEFAULTS).map(([key, fallback]) => [
      key,
      normalizeProfileColor(source[key], fallback),
    ]),
  );
};

export const normalizeAuthorProfile = (profile = {}, user = {}) => {
  const socialLinks = normalizeAuthorSocialLinks(profile.socialLinks, profile.website);
  const website = normalizeProfileString(getAuthorSocialLinkUrl(socialLinks, 'site') || profile.website);

  return {
    displayName: profile.displayName || user.name || user.email || 'Créateur',
    tagline: profile.tagline || '',
    bio: profile.bio || '',
    country: normalizeProfileString(profile.country || user.country),
    city: normalizeProfileString(profile.city || user.city),
    website,
    avatar: normalizeProfileString(profile.avatar),
    banner: normalizeProfileString(profile.banner),
    theme: normalizeAuthorProfileTheme(profile.theme),
    socialLinks,
    blogPosts: normalizeBlogPosts(profile.blogPosts),
    updatedAt: profile.updatedAt || '',
  };
};

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

export const toggleAuthorBlogPostLike = (userId, postId, likerId, fallbackUser = {}) => {
  const safeUserId = normalizeProfileString(userId);
  const safePostId = normalizeProfileString(postId);
  const safeLikerId = normalizeProfileString(likerId);
  if (!safeUserId || !safePostId || !safeLikerId) return null;

  const profiles = readProfiles();
  const currentProfile = normalizeAuthorProfile(profiles[safeUserId] || {}, fallbackUser);
  let updatedPost = null;

  const blogPosts = currentProfile.blogPosts.map((post) => {
    if (post.id !== safePostId) return post;

    const isLiked = post.likedBy.includes(safeLikerId);
    const likedBy = isLiked
      ? post.likedBy.filter((entry) => entry !== safeLikerId)
      : [...post.likedBy, safeLikerId];
    const likes = isLiked ? Math.max(0, post.likes - 1) : post.likes + 1;
    updatedPost = normalizeBlogPost({
      ...post,
      likes,
      likedBy,
    });
    return updatedPost;
  });

  if (!updatedPost) return null;

  const nextProfile = normalizeAuthorProfile({
    ...currentProfile,
    blogPosts,
  }, fallbackUser);
  profiles[safeUserId] = nextProfile;
  writeProfiles(profiles);
  return {
    profile: nextProfile,
    post: updatedPost,
    liked: updatedPost.likedBy.includes(safeLikerId),
  };
};
