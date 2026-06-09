import { getVisitorAnalyticsId } from './visitorAnalytics';
import { isHotspotLinkAction } from './hotspotLinks.js';
import { getSupabaseAuthHeaders } from './remoteSession';

const PRO_CLICK_ANALYTICS_ENDPOINT = import.meta.env.VITE_PRO_CLICK_ANALYTICS_ENDPOINT || '/api/analytics/click';
const FIELD_MAX_LENGTH = 240;
const URL_MAX_LENGTH = 900;

const truncate = (value = '', maxLength = FIELD_MAX_LENGTH) => String(value || '').trim().slice(0, maxLength);

const getClickableLabel = (entry = {}) => truncate(
  entry.analyticsLabel
  || entry.statsName
  || entry.statName
  || entry.buttonLabel
  || entry.blockText
  || entry.blockLabel
  || entry.dialogue
  || entry.name
  || entry.id
  || 'Zone cliquée',
);

export const makeProClickPayload = (entry = {}, context = {}) => {
  const actionType = entry?.actionType || '';
  if (!isHotspotLinkAction(actionType)) return null;

  const project = context.project || {};
  const scene = context.scene || {};

  return {
    scope: 'pro_click',
    event: 'click',
    visitorId: getVisitorAnalyticsId(),
    clickedAt: new Date(context.now || Date.now()).toISOString(),
    source: truncate(context.source || 'player', 80),
    pageUrl: truncate(context.href || (typeof window !== 'undefined' ? window.location?.href : ''), URL_MAX_LENGTH),
    projectId: truncate(context.projectId || project.id || project.projectId || project.data?.projectId || ''),
    projectTitle: truncate(context.projectTitle || project.title || project.name || ''),
    userId: truncate(context.userId || project.userId || project.ownerId || project.authorId || ''),
    sceneId: truncate(context.sceneId || scene.id || ''),
    sceneName: truncate(context.sceneName || scene.name || scene.title || ''),
    elementId: truncate(entry.id || ''),
    elementName: getClickableLabel(entry),
    actionType,
    targetType: actionType === 'project_link' ? 'project' : 'external',
    targetUrl: truncate(context.targetUrl || '', URL_MAX_LENGTH),
    targetProjectId: truncate(entry.targetProjectId || ''),
    targetProjectUserId: truncate(entry.targetProjectUserId || ''),
  };
};

export const sendProClickPayload = (payload = {}, { endpoint = PRO_CLICK_ANALYTICS_ENDPOINT } = {}) => {
  if (typeof window === 'undefined' || !endpoint) return false;

  const body = JSON.stringify(payload);

  try {
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      const sent = navigator.sendBeacon(
        endpoint,
        new Blob([body], { type: 'application/json' }),
      );
      if (sent) return true;
    }
  } catch {
    // fetch fallback below
  }

  window.fetch?.(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  }).catch(() => {});
  return true;
};

export const trackProClick = (entry = {}, context = {}) => {
  const payload = makeProClickPayload(entry, context);
  if (!payload) return false;
  return sendProClickPayload(payload, context);
};

const toSafeCount = (value = 0) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : 0;
};

export const normalizeProClickAnalyticsSummary = (summary = {}) => ({
  projectId: String(summary.projectId || '').trim(),
  clicks: toSafeCount(summary.clicks),
  clicks7d: toSafeCount(summary.clicks7d),
  clicks30d: toSafeCount(summary.clicks30d),
  updatedAt: summary.updatedAt || '',
  elements: (Array.isArray(summary.elements) ? summary.elements : []).map((element) => ({
    key: String(element.key || '').trim(),
    projectId: String(element.projectId || '').trim(),
    elementId: String(element.elementId || '').trim(),
    elementName: String(element.elementName || 'Zone cliquée').trim(),
    actionType: String(element.actionType || '').trim(),
    targetType: String(element.targetType || '').trim(),
    targetUrl: String(element.targetUrl || '').trim(),
    targetProjectId: String(element.targetProjectId || '').trim(),
    clicks: toSafeCount(element.clicks),
    clicks7d: toSafeCount(element.clicks7d),
    clicks30d: toSafeCount(element.clicks30d),
    uniqueVisitors: toSafeCount(element.uniqueVisitors),
    updatedAt: element.updatedAt || '',
  })),
});

export const loadProClickAnalytics = async ({ projectId = '' } = {}) => {
  const targetProjectId = String(projectId || '').trim();
  if (!targetProjectId || typeof window === 'undefined') return normalizeProClickAnalyticsSummary({ projectId: targetProjectId });

  const endpoint = new URL(PRO_CLICK_ANALYTICS_ENDPOINT, window.location.href);
  endpoint.searchParams.set('projectId', targetProjectId);
  const response = await fetch(endpoint.toString(), {
    headers: await getSupabaseAuthHeaders(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || 'Statistiques indisponibles.');
  }
  return normalizeProClickAnalyticsSummary(payload.summary || payload);
};
