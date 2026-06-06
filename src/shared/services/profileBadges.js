import { readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const PROFILE_BADGE_EVENTS_KEY_PREFIX = 'escapeGameBuilder.profileBadgeEvents.v1';
const PROFILE_BADGE_PROGRESS_KEY_PREFIX = 'escapeGameBuilder.profileBadgeProgress.v1';

export const PROFILE_BADGE_EVENTS_UPDATED_EVENT = 'profile-badge-events-updated';
export const PROFILE_BADGE_EVENT_PLAY_GAME = 'play-game';

const getProfileBadgeEventsKey = (userKey = 'anonymous') => (
  `${PROFILE_BADGE_EVENTS_KEY_PREFIX}.${userKey || 'anonymous'}`
);

const getProfileBadgeProgressKey = (userKey = 'anonymous') => (
  `${PROFILE_BADGE_PROGRESS_KEY_PREFIX}.${userKey || 'anonymous'}`
);

export const readProfileBadgeEvents = (userKey = 'anonymous') => {
  const events = readJsonStorage(getProfileBadgeEventsKey(userKey), {});
  return events && typeof events === 'object' ? events : {};
};

export const readProfileBadgeProgress = (userKey = 'anonymous') => {
  const progress = readJsonStorage(getProfileBadgeProgressKey(userKey), null);
  return progress && typeof progress === 'object' ? progress : null;
};

export const writeProfileBadgeProgress = (userKey = 'anonymous', progress = {}) => (
  writeJsonStorage(getProfileBadgeProgressKey(userKey), {
    ...(progress || {}),
    updatedAt: new Date().toISOString(),
  })
);

export const markProfileBadgeEvent = (userKey = 'anonymous', eventId = '', details = {}) => {
  if (!eventId) return readProfileBadgeEvents(userKey);
  const timestamp = new Date().toISOString();
  const previous = readProfileBadgeEvents(userKey);
  const previousEvent = previous[eventId] || {};
  const previousCount = Number(previousEvent.count);
  const nextEvents = {
    ...previous,
    [eventId]: {
      ...previousEvent,
      ...details,
      count: Number.isFinite(previousCount) ? previousCount + 1 : 1,
      firstAt: previousEvent.firstAt || timestamp,
      lastAt: timestamp,
    },
  };

  writeJsonStorage(getProfileBadgeEventsKey(userKey), nextEvents);

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(PROFILE_BADGE_EVENTS_UPDATED_EVENT, {
      detail: { userKey, eventId, events: nextEvents },
    }));
  }

  return nextEvents;
};
