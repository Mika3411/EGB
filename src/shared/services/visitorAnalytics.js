import { canUseLocalStorage, readJsonStorage, writeJsonStorage } from '../utils/storageHelpers';

const VISITOR_ANALYTICS_ENDPOINT = import.meta.env.VITE_VISITOR_ANALYTICS_ENDPOINT || '/api/analytics/visit';
const VISITOR_ID_KEY = 'escapeGameBuilder.visitorId.v1';
const TRACKED_DAYS_KEY = 'escapeGameBuilder.visitorAnalyticsTrackedDays.v1';
const VALID_SURFACES = new Set(['builder', 'gallery']);

let memoryVisitorId = '';
let memoryTrackedDays = {};

export const normalizeVisitorSurface = (value = '') => {
  const surface = String(value || '').trim().toLowerCase();
  return VALID_SURFACES.has(surface) ? surface : '';
};

const makeVisitorId = () => {
  const cryptoApi = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoApi?.randomUUID) return cryptoApi.randomUUID();
  if (cryptoApi?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoApi.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
};

export const getVisitorAnalyticsId = () => {
  if (!canUseLocalStorage()) {
    if (!memoryVisitorId) memoryVisitorId = makeVisitorId();
    return memoryVisitorId;
  }

  const storedId = String(window.localStorage.getItem(VISITOR_ID_KEY) || '').trim();
  if (storedId) return storedId;

  const visitorId = makeVisitorId();
  try {
    window.localStorage.setItem(VISITOR_ID_KEY, visitorId);
  } catch {
    memoryVisitorId = visitorId;
  }
  return visitorId;
};

const getDayKey = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);

const readTrackedDays = () => {
  if (!canUseLocalStorage()) return memoryTrackedDays;
  const stored = readJsonStorage(TRACKED_DAYS_KEY, {});
  return stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
};

const writeTrackedDays = (trackedDays) => {
  memoryTrackedDays = trackedDays;
  if (canUseLocalStorage()) writeJsonStorage(TRACKED_DAYS_KEY, trackedDays);
};

export const shouldTrackVisitorSurface = (surface, now = Date.now()) => {
  const normalizedSurface = normalizeVisitorSurface(surface);
  if (!normalizedSurface) return false;
  const trackedDays = readTrackedDays();
  return trackedDays[normalizedSurface] !== getDayKey(now);
};

const markVisitorSurfaceTracked = (surface, now = Date.now()) => {
  const normalizedSurface = normalizeVisitorSurface(surface);
  if (!normalizedSurface) return;
  writeTrackedDays({
    ...readTrackedDays(),
    [normalizedSurface]: getDayKey(now),
  });
};

export const trackVisitorSurface = (surface, { userId = '' } = {}) => {
  const normalizedSurface = normalizeVisitorSurface(surface);
  if (
    !normalizedSurface
    || typeof window === 'undefined'
    || !VISITOR_ANALYTICS_ENDPOINT
    || !shouldTrackVisitorSurface(normalizedSurface)
  ) {
    return false;
  }

  const payload = JSON.stringify({
    scope: normalizedSurface,
    visitorId: getVisitorAnalyticsId(),
    userId: String(userId || '').slice(0, 180),
  });

  markVisitorSurfaceTracked(normalizedSurface);

  try {
    if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
      const sent = navigator.sendBeacon(
        VISITOR_ANALYTICS_ENDPOINT,
        new Blob([payload], { type: 'application/json' }),
      );
      if (sent) return true;
    }
  } catch {
    // fetch fallback below
  }

  window.fetch?.(VISITOR_ANALYTICS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload,
    keepalive: true,
  }).catch(() => {});
  return true;
};
