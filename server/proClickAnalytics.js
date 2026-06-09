import { createHash } from 'node:crypto';
import { readJsonBody, sendJson } from './http.js';
import { downloadStorageJson, uploadStorageJson } from './storage.js';
import { verifySupabaseUserRequest } from './auth.js';
import { getVisitorHash, getVisitorRequestMetadata } from './visitorAnalytics.js';

export const PRO_CLICK_ANALYTICS_STORAGE_PATH = 'admin/pro-click-analytics.json';

const DAY_MS = 24 * 60 * 60 * 1000;
const STRING_MAX_LENGTH = 240;
const URL_MAX_LENGTH = 900;
const MAX_ELEMENTS = 5000;
const VALID_ACTION_TYPES = new Set(['external_link', 'project_link']);

const makeProClickAnalyticsError = (message, status = 400, code = 'PRO_CLICK_ANALYTICS_ERROR') => {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
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

const truncate = (value = '', maxLength = STRING_MAX_LENGTH) => String(value || '').trim().slice(0, maxLength);

const incrementDay = (days = {}, dayKey = toDayKey(), amount = 1) => ({
  ...(days && typeof days === 'object' && !Array.isArray(days) ? days : {}),
  [dayKey]: toSafeCount(days?.[dayKey]) + amount,
});

const makeElementKey = (event = {}) => {
  const stableIdentity = [
    event.userId,
    event.projectId,
    event.sceneId,
    event.elementId,
    event.actionType,
    event.targetProjectId || event.targetUrl,
  ].map((value) => truncate(value, URL_MAX_LENGTH)).join('|');
  return createHash('sha256').update(stableIdentity || event.elementName || 'click').digest('hex').slice(0, 24);
};

const normalizeActionType = (value = '') => {
  const actionType = truncate(value, 40);
  return VALID_ACTION_TYPES.has(actionType) ? actionType : '';
};

export const normalizeProClickEvent = (event = {}, metadata = {}) => {
  const actionType = normalizeActionType(event.actionType);
  if (!actionType) {
    throw makeProClickAnalyticsError('Type de clic invalide.', 400, 'PRO_CLICK_ACTION_INVALID');
  }

  const elementName = truncate(event.elementName || event.name || event.elementId || 'Zone cliquée');
  if (!elementName && !event.elementId) {
    throw makeProClickAnalyticsError('Element clique manquant.', 400, 'PRO_CLICK_ELEMENT_MISSING');
  }

  return {
    visitorId: truncate(event.visitorId, 180),
    userId: truncate(event.userId),
    projectId: truncate(event.projectId),
    projectTitle: truncate(event.projectTitle),
    sceneId: truncate(event.sceneId),
    sceneName: truncate(event.sceneName),
    elementId: truncate(event.elementId),
    elementName,
    actionType,
    targetType: actionType === 'project_link' ? 'project' : 'external',
    targetUrl: truncate(event.targetUrl, URL_MAX_LENGTH),
    targetProjectId: truncate(event.targetProjectId),
    targetProjectUserId: truncate(event.targetProjectUserId),
    source: truncate(event.source || 'player', 80),
    pageUrl: truncate(event.pageUrl, URL_MAX_LENGTH),
    ip: truncate(metadata.ip || event.ip, 180),
    userAgent: truncate(metadata.userAgent || event.userAgent, 220),
  };
};

const normalizeElement = (element = {}) => ({
  key: truncate(element.key, 40),
  userId: truncate(element.userId),
  projectId: truncate(element.projectId),
  projectTitle: truncate(element.projectTitle),
  sceneId: truncate(element.sceneId),
  sceneName: truncate(element.sceneName),
  elementId: truncate(element.elementId),
  elementName: truncate(element.elementName || 'Zone cliquée'),
  actionType: normalizeActionType(element.actionType) || 'external_link',
  targetType: truncate(element.targetType || 'external', 40),
  targetUrl: truncate(element.targetUrl, URL_MAX_LENGTH),
  targetProjectId: truncate(element.targetProjectId),
  targetProjectUserId: truncate(element.targetProjectUserId),
  clicks: toSafeCount(element.clicks),
  uniqueVisitors: toSafeCount(element.uniqueVisitors),
  clicksByDay: element.clicksByDay && typeof element.clicksByDay === 'object' && !Array.isArray(element.clicksByDay)
    ? Object.fromEntries(Object.entries(element.clicksByDay)
      .filter(([day]) => /^\d{4}-\d{2}-\d{2}$/.test(day))
      .map(([day, count]) => [day, toSafeCount(count)]))
    : {},
  visitors: element.visitors && typeof element.visitors === 'object' && !Array.isArray(element.visitors)
    ? Object.fromEntries(Object.entries(element.visitors)
      .filter(([visitorHash]) => /^[a-f0-9]{24,64}$/i.test(visitorHash))
      .map(([visitorHash, visitor = {}]) => [visitorHash, {
        firstClickedAt: toTimestamp(visitor.firstClickedAt) ? visitor.firstClickedAt : '',
        lastClickedAt: toTimestamp(visitor.lastClickedAt) ? visitor.lastClickedAt : '',
        clicks: toSafeCount(visitor.clicks),
      }]))
    : {},
  updatedAt: toTimestamp(element.updatedAt) ? element.updatedAt : '',
});

export const normalizeProClickAnalyticsRecord = (record = {}) => ({
  version: 1,
  clicks: toSafeCount(record.clicks),
  updatedAt: toTimestamp(record.updatedAt) ? record.updatedAt : '',
  elements: record.elements && typeof record.elements === 'object' && !Array.isArray(record.elements)
    ? Object.fromEntries(Object.entries(record.elements)
      .map(([key, element]) => [key, normalizeElement({ ...element, key })]))
    : {},
});

const pruneElements = (elements = {}) => Object.fromEntries(
  Object.entries(elements)
    .sort(([, a], [, b]) => toTimestamp(b.updatedAt) - toTimestamp(a.updatedAt))
    .slice(0, MAX_ELEMENTS),
);

export const recordProClickAnalytics = (record = {}, event = {}, now = Date.now()) => {
  const normalizedEvent = normalizeProClickEvent(event, event);
  const nextRecord = normalizeProClickAnalyticsRecord(record);
  const nowIso = toIsoString(now);
  const dayKey = toDayKey(now);
  const elementKey = makeElementKey(normalizedEvent);
  const previousElement = nextRecord.elements[elementKey] || {};
  const element = normalizeElement({
    ...previousElement,
    key: elementKey,
    ...normalizedEvent,
  });

  const visitorHash = getVisitorHash(normalizedEvent);
  const previousVisitor = element.visitors[visitorHash] || null;

  element.clicks += 1;
  element.clicksByDay = incrementDay(element.clicksByDay, dayKey);
  element.visitors[visitorHash] = {
    firstClickedAt: previousVisitor?.firstClickedAt || nowIso,
    lastClickedAt: nowIso,
    clicks: toSafeCount(previousVisitor?.clicks) + 1,
  };
  element.uniqueVisitors = Object.keys(element.visitors).length;
  element.updatedAt = nowIso;

  nextRecord.elements[elementKey] = element;
  nextRecord.elements = pruneElements(nextRecord.elements);
  nextRecord.clicks += 1;
  nextRecord.updatedAt = nowIso;
  return nextRecord;
};

const countClicksSince = (element = {}, since = 0) => Object.entries(element.clicksByDay || {})
  .filter(([day]) => toTimestamp(`${day}T23:59:59.999Z`) >= since)
  .reduce((sum, [, count]) => sum + toSafeCount(count), 0);

export const summarizeProClickAnalytics = (record = {}, now = Date.now()) => {
  const normalized = normalizeProClickAnalyticsRecord(record);
  const since7d = now - 7 * DAY_MS;
  const since30d = now - 30 * DAY_MS;
  const elements = Object.values(normalized.elements)
    .sort((a, b) => toSafeCount(b.clicks) - toSafeCount(a.clicks))
    .map((element) => ({
      key: element.key,
      userId: element.userId,
      projectId: element.projectId,
      projectTitle: element.projectTitle,
      sceneId: element.sceneId,
      sceneName: element.sceneName,
      elementId: element.elementId,
      elementName: element.elementName,
      actionType: element.actionType,
      targetType: element.targetType,
      targetUrl: element.targetUrl,
      targetProjectId: element.targetProjectId,
      targetProjectUserId: element.targetProjectUserId,
      clicks: element.clicks,
      clicks7d: countClicksSince(element, since7d),
      clicks30d: countClicksSince(element, since30d),
      uniqueVisitors: element.uniqueVisitors,
      updatedAt: element.updatedAt,
    }));

  return {
    clicks: toSafeCount(normalized.clicks),
    clicks7d: elements.reduce((sum, element) => sum + toSafeCount(element.clicks7d), 0),
    clicks30d: elements.reduce((sum, element) => sum + toSafeCount(element.clicks30d), 0),
    updatedAt: normalized.updatedAt || '',
    elements,
  };
};

export const getProjectProClickAnalyticsSummary = (record = {}, { projectId = '', userId = '' } = {}, now = Date.now()) => {
  const targetProjectId = truncate(projectId);
  const targetUserId = truncate(userId);
  const summary = summarizeProClickAnalytics(record, now);
  const elements = summary.elements.filter((element) => {
    if (targetProjectId && element.projectId !== targetProjectId) return false;
    return !targetUserId || element.userId === targetUserId || !element.userId;
  });
  return {
    projectId: targetProjectId,
    clicks: elements.reduce((sum, element) => sum + toSafeCount(element.clicks), 0),
    clicks7d: elements.reduce((sum, element) => sum + toSafeCount(element.clicks7d), 0),
    clicks30d: elements.reduce((sum, element) => sum + toSafeCount(element.clicks30d), 0),
    updatedAt: elements.reduce((latest, element) => (
      toTimestamp(element.updatedAt) > toTimestamp(latest) ? element.updatedAt : latest
    ), ''),
    elements,
  };
};

export const handleProClickAnalytics = async (req, res) => {
  if (req.method === 'GET') {
    const user = await verifySupabaseUserRequest(req);
    const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const projectId = requestUrl.searchParams.get('projectId') || '';
    if (!projectId) {
      sendJson(res, 400, { error: 'Projet manquant.' });
      return;
    }
    const currentRecord = await downloadStorageJson(PRO_CLICK_ANALYTICS_STORAGE_PATH, {}, { visibility: 'private' });
    sendJson(res, 200, {
      summary: getProjectProClickAnalyticsSummary(currentRecord, {
        projectId,
        userId: user.id,
      }),
    });
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Methode non autorisee.' });
    return;
  }

  const body = await readJsonBody(req, { maxBytes: 4096 });
  const metadata = getVisitorRequestMetadata(req.headers || {}, req.socket?.remoteAddress || '');
  const currentRecord = await downloadStorageJson(PRO_CLICK_ANALYTICS_STORAGE_PATH, {}, { visibility: 'private' });
  const nextRecord = recordProClickAnalytics(currentRecord, {
    ...body,
    ...metadata,
  });

  await uploadStorageJson(PRO_CLICK_ANALYTICS_STORAGE_PATH, nextRecord, { visibility: 'private' });
  sendJson(res, 200, { ok: true });
};
