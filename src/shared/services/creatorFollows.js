import { readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const CREATOR_FOLLOWS_KEY = 'escapeGameBuilder.creatorFollows.v1';

const normalizeId = (value = '') => String(value || '').trim();

const getTimestamp = (value = '') => {
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const normalizeIsoDate = (value = '') => {
  const timestamp = getTimestamp(value);
  return timestamp ? new Date(timestamp).toISOString() : '';
};

const normalizeFollowState = (state = {}) => {
  const followedCreatorIds = Array.isArray(state.followedCreatorIds)
    ? [...new Set(state.followedCreatorIds.map(normalizeId).filter(Boolean))]
    : [];
  const lastSeenAtByCreator = {};
  const sourceSeen = state.lastSeenAtByCreator && typeof state.lastSeenAtByCreator === 'object'
    ? state.lastSeenAtByCreator
    : {};

  followedCreatorIds.forEach((creatorId) => {
    lastSeenAtByCreator[creatorId] = normalizeIsoDate(sourceSeen[creatorId]);
  });

  return {
    followedCreatorIds,
    lastSeenAtByCreator,
  };
};

const readAllCreatorFollows = () => {
  const stored = readJsonStorage(CREATOR_FOLLOWS_KEY, {});
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) return {};
  return Object.fromEntries(Object.entries(stored).map(([userId, state]) => [
    normalizeId(userId),
    normalizeFollowState(state),
  ]).filter(([userId]) => userId));
};

const writeAllCreatorFollows = (follows) => writeJsonStorage(CREATOR_FOLLOWS_KEY, follows);

export const getCreatorFollowState = (followerId = '') => {
  const safeFollowerId = normalizeId(followerId);
  if (!safeFollowerId) return normalizeFollowState();
  return normalizeFollowState(readAllCreatorFollows()[safeFollowerId]);
};

export const isFollowingCreator = (followerId = '', creatorId = '') => (
  getCreatorFollowState(followerId).followedCreatorIds.includes(normalizeId(creatorId))
);

export const getCreatorLatestActivityAt = (games = [], creatorId = '') => {
  const safeCreatorId = normalizeId(creatorId);
  if (!safeCreatorId) return '';

  const seenPostIds = new Set();
  const latestTimestamp = (Array.isArray(games) ? games : []).reduce((latest, game) => {
    if (normalizeId(game?.userId) !== safeCreatorId) return latest;

    let nextLatest = Math.max(
      latest,
      getTimestamp(game.publishedAt || game.updatedAt || game.createdAt),
    );

    (game.authorProfile?.blogPosts || []).forEach((post) => {
      const postId = normalizeId(post?.id);
      if (postId && seenPostIds.has(postId)) return;
      if (postId) seenPostIds.add(postId);
      nextLatest = Math.max(nextLatest, getTimestamp(post?.createdAt || post?.updatedAt));
    });

    return nextLatest;
  }, 0);

  return latestTimestamp ? new Date(latestTimestamp).toISOString() : '';
};

export const followCreator = (followerId = '', creatorId = '', seenAt = '') => {
  const safeFollowerId = normalizeId(followerId);
  const safeCreatorId = normalizeId(creatorId);
  if (!safeFollowerId || !safeCreatorId || safeFollowerId === safeCreatorId) return getCreatorFollowState(safeFollowerId);

  const follows = readAllCreatorFollows();
  const state = normalizeFollowState(follows[safeFollowerId]);
  if (!state.followedCreatorIds.includes(safeCreatorId)) {
    state.followedCreatorIds.push(safeCreatorId);
  }
  state.lastSeenAtByCreator[safeCreatorId] = normalizeIsoDate(seenAt) || new Date().toISOString();
  follows[safeFollowerId] = state;
  writeAllCreatorFollows(follows);
  return state;
};

export const unfollowCreator = (followerId = '', creatorId = '') => {
  const safeFollowerId = normalizeId(followerId);
  const safeCreatorId = normalizeId(creatorId);
  if (!safeFollowerId || !safeCreatorId) return getCreatorFollowState(safeFollowerId);

  const follows = readAllCreatorFollows();
  const state = normalizeFollowState(follows[safeFollowerId]);
  state.followedCreatorIds = state.followedCreatorIds.filter((entry) => entry !== safeCreatorId);
  delete state.lastSeenAtByCreator[safeCreatorId];
  follows[safeFollowerId] = state;
  writeAllCreatorFollows(follows);
  return state;
};

export const getUnreadFollowedCreatorActivity = (followerId = '', games = []) => {
  const state = getCreatorFollowState(followerId);
  return state.followedCreatorIds.map((creatorId) => {
    const latestAt = getCreatorLatestActivityAt(games, creatorId);
    const lastSeenAt = state.lastSeenAtByCreator[creatorId] || '';
    return {
      creatorId,
      latestAt,
      lastSeenAt,
      unread: Boolean(latestAt && getTimestamp(latestAt) > getTimestamp(lastSeenAt)),
    };
  }).filter((entry) => entry.unread);
};

export const markCreatorActivitySeen = (followerId = '', creatorId = '', games = []) => {
  const safeFollowerId = normalizeId(followerId);
  const safeCreatorId = normalizeId(creatorId);
  if (!safeFollowerId || !safeCreatorId) return getCreatorFollowState(safeFollowerId);

  const follows = readAllCreatorFollows();
  const state = normalizeFollowState(follows[safeFollowerId]);
  if (!state.followedCreatorIds.includes(safeCreatorId)) return state;

  state.lastSeenAtByCreator[safeCreatorId] = getCreatorLatestActivityAt(games, safeCreatorId) || new Date().toISOString();
  follows[safeFollowerId] = state;
  writeAllCreatorFollows(follows);
  return state;
};

export const markFollowedCreatorActivitySeen = (followerId = '', games = []) => {
  const safeFollowerId = normalizeId(followerId);
  if (!safeFollowerId) return getCreatorFollowState();

  const follows = readAllCreatorFollows();
  const state = normalizeFollowState(follows[safeFollowerId]);
  state.followedCreatorIds.forEach((creatorId) => {
    state.lastSeenAtByCreator[creatorId] = getCreatorLatestActivityAt(games, creatorId) || new Date().toISOString();
  });
  follows[safeFollowerId] = state;
  writeAllCreatorFollows(follows);
  return state;
};

export const getFollowersForCreator = (creatorId = '') => {
  const safeCreatorId = normalizeId(creatorId);
  if (!safeCreatorId) return [];

  return Object.entries(readAllCreatorFollows())
    .filter(([, state]) => state.followedCreatorIds.includes(safeCreatorId))
    .map(([followerId, state]) => ({
      followerId,
      lastSeenAt: state.lastSeenAtByCreator[safeCreatorId] || '',
    }));
};
