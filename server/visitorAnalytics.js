import { createHash } from 'node:crypto';
import { readJsonBody, sendJson } from './http.js';
import { downloadStorageJson, uploadStorageJson } from './storage.js';

export const VISITOR_ANALYTICS_STORAGE_PATH = 'admin/visitor-analytics.json';
export const VISITOR_ANALYTICS_SCOPES = ['builder', 'gallery'];

const DAY_MS = 24 * 60 * 60 * 1000;
const VISITOR_ID_MAX_LENGTH = 180;
const MAX_VISITORS_PER_SURFACE = 50000;

const makeVisitorAnalyticsError = (message, status = 400, code = 'VISITOR_ANALYTICS_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
};

export const normalizeVisitorScope = (value = '') => {
  const scope = String(value || '').trim().toLowerCase();
  return VISITOR_ANALYTICS_SCOPES.includes(scope) ? scope : '';
};

const toTimestamp = (value, fallback = 0) => {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : fallback;
};

const toIsoString = (time = Date.now()) => new Date(time).toISOString();

const toDayKey = (time = Date.now()) => toIsoString(time).slice(0, 10);

const toSafeCount = (value = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

const normalizeVisitors = (visitors = {}) => {
  if (!visitors || typeof visitors !== 'object' || Array.isArray(visitors)) return {};

  return Object.fromEntries(Object.entries(visitors)
    .filter(([visitorHash]) => /^[a-f0-9]{24,64}$/i.test(visitorHash))
    .map(([visitorHash, visitor = {}]) => {
      const firstSeenAt = toTimestamp(visitor.firstSeenAt) ? visitor.firstSeenAt : '';
      const lastSeenAt = toTimestamp(visitor.lastSeenAt) ? visitor.lastSeenAt : firstSeenAt;
      return [visitorHash, {
        firstSeenAt,
        lastSeenAt,
        lastVisitDay: /^\d{4}-\d{2}-\d{2}$/.test(String(visitor.lastVisitDay || ''))
          ? String(visitor.lastVisitDay)
          : (lastSeenAt ? String(lastSeenAt).slice(0, 10) : ''),
        visits: toSafeCount(visitor.visits),
      }];
    }));
};

const normalizeVisitsByDay = (visitsByDay = {}) => {
  if (!visitsByDay || typeof visitsByDay !== 'object' || Array.isArray(visitsByDay)) return {};
  return Object.fromEntries(Object.entries(visitsByDay)
    .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
    .map(([day, count]) => [day, toSafeCount(count)]));
};

const normalizeSurface = (surface = {}) => {
  const visitors = normalizeVisitors(surface.visitors);
  return {
    visits: toSafeCount(surface.visits),
    uniqueVisitors: Math.max(toSafeCount(surface.uniqueVisitors), Object.keys(visitors).length),
    visitors,
    visitsByDay: normalizeVisitsByDay(surface.visitsByDay),
    updatedAt: toTimestamp(surface.updatedAt) ? surface.updatedAt : '',
  };
};

export const normalizeVisitorAnalyticsRecord = (record = {}) => {
  const surfaces = {};
  VISITOR_ANALYTICS_SCOPES.forEach((scope) => {
    surfaces[scope] = normalizeSurface(record?.surfaces?.[scope]);
  });
  return {
    version: 1,
    updatedAt: toTimestamp(record.updatedAt) ? record.updatedAt : '',
    surfaces,
  };
};

const getHeader = (headers = {}, name = '') => {
  const target = String(name || '').toLowerCase();
  const match = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === target);
  const value = Array.isArray(match?.[1]) ? match[1][0] : match?.[1];
  return String(value || '').trim();
};

export const getVisitorRequestMetadata = (headers = {}, remoteAddress = '') => {
  const forwardedFor = getHeader(headers, 'x-forwarded-for').split(',')[0]?.trim() || '';
  return {
    ip: getHeader(headers, 'x-nf-client-connection-ip')
      || getHeader(headers, 'cf-connecting-ip')
      || forwardedFor
      || String(remoteAddress || '').trim(),
    userAgent: getHeader(headers, 'user-agent').slice(0, 220),
  };
};

export const getVisitorHash = ({
  visitorId = '',
  userId = '',
  ip = '',
  userAgent = '',
} = {}) => {
  const explicitIdentity = String(visitorId || userId || '')
    .trim()
    .slice(0, VISITOR_ID_MAX_LENGTH);
  const fallbackIdentity = [ip, userAgent]
    .map((value) => String(value || '').trim())
    .filter(Boolean)
    .join('|')
    .slice(0, VISITOR_ID_MAX_LENGTH);
  const identity = explicitIdentity || fallbackIdentity;

  if (!identity || identity.length < 3) {
    throw makeVisitorAnalyticsError('Identifiant visiteur manquant.', 400, 'VISITOR_ID_MISSING');
  }

  return createHash('sha256').update(identity).digest('hex');
};

const pruneVisitors = (surface, now = Date.now()) => {
  const entries = Object.entries(surface.visitors);
  if (entries.length <= MAX_VISITORS_PER_SURFACE) return surface;

  const visitors = Object.fromEntries(entries
    .sort(([, a], [, b]) => toTimestamp(b.lastSeenAt, now) - toTimestamp(a.lastSeenAt, now))
    .slice(0, MAX_VISITORS_PER_SURFACE));

  return {
    ...surface,
    visitors,
    uniqueVisitors: Math.max(surface.uniqueVisitors, entries.length),
  };
};

export const recordVisitorAnalytics = (record = {}, event = {}, now = Date.now()) => {
  const scope = normalizeVisitorScope(event.scope);
  if (!scope) {
    throw makeVisitorAnalyticsError('Surface visiteur inconnue.', 400, 'VISITOR_SCOPE_INVALID');
  }

  const visitorHash = getVisitorHash(event);
  const nextRecord = normalizeVisitorAnalyticsRecord(record);
  const surface = nextRecord.surfaces[scope];
  const nowIso = toIsoString(now);
  const dayKey = toDayKey(now);
  const previousVisitor = surface.visitors[visitorHash] || null;
  const isNewVisitor = !previousVisitor;
  const isNewDailyVisit = previousVisitor?.lastVisitDay !== dayKey;

  surface.visitors[visitorHash] = {
    firstSeenAt: previousVisitor?.firstSeenAt || nowIso,
    lastSeenAt: nowIso,
    lastVisitDay: dayKey,
    visits: toSafeCount(previousVisitor?.visits) + (isNewDailyVisit ? 1 : 0),
  };

  if (isNewVisitor) surface.uniqueVisitors += 1;
  if (isNewDailyVisit) {
    surface.visits += 1;
    surface.visitsByDay[dayKey] = toSafeCount(surface.visitsByDay[dayKey]) + 1;
  }

  const prunedSurface = pruneVisitors(surface, now);
  nextRecord.surfaces[scope] = {
    ...prunedSurface,
    updatedAt: nowIso,
  };
  nextRecord.updatedAt = nowIso;
  return nextRecord;
};

const countVisitorsSince = (surface, since) => Object.values(surface.visitors)
  .filter((visitor) => toTimestamp(visitor.lastSeenAt) >= since)
  .length;

const countVisitsSince = (surface, since) => Object.entries(surface.visitsByDay)
  .filter(([day]) => toTimestamp(`${day}T23:59:59.999Z`) >= since)
  .reduce((sum, [, count]) => sum + toSafeCount(count), 0);

export const summarizeVisitorAnalytics = (record = {}, now = Date.now()) => {
  const normalized = normalizeVisitorAnalyticsRecord(record);
  const since24h = now - DAY_MS;

  return Object.fromEntries(VISITOR_ANALYTICS_SCOPES.map((scope) => {
    const surface = normalized.surfaces[scope];
    return [scope, {
      visitors: toSafeCount(surface.uniqueVisitors),
      visitors24h: countVisitorsSince(surface, since24h),
      visits: toSafeCount(surface.visits),
      visits24h: countVisitsSince(surface, since24h),
      updatedAt: surface.updatedAt || normalized.updatedAt || '',
    }];
  }));
};

export const handleVisitorAnalytics = async (req, res) => {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Methode non autorisee.' });
    return;
  }

  const body = await readJsonBody(req, { maxBytes: 2048 });
  const metadata = getVisitorRequestMetadata(req.headers || {}, req.socket?.remoteAddress || '');
  const currentRecord = await downloadStorageJson(VISITOR_ANALYTICS_STORAGE_PATH, {}, { visibility: 'private' });
  const nextRecord = recordVisitorAnalytics(currentRecord, {
    ...body,
    ...metadata,
  });

  await uploadStorageJson(VISITOR_ANALYTICS_STORAGE_PATH, nextRecord, { visibility: 'private' });
  sendJson(res, 200, { ok: true });
};
