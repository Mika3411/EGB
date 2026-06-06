import { buildPlayableProjectUrl } from '../utils/publicProjectLinks';

function normalizeHotspotExternalUrl(value = '', href = globalThis.location?.href || '/') {
  const allowedProtocols = ['http:', 'https:', 'mailto:', 'tel:'];
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';

  const hasProtocol = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  const candidate = hasProtocol ? trimmed : `https://${trimmed}`;

  try {
    const base = globalThis.location?.origin || 'https://escape-game-studio.netlify.app';
    const url = new URL(candidate, href || base);
    if (!allowedProtocols.includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function getHotspotProjectLinkUrl(hotspot = {}, { href = globalThis.location?.href || '/' } = {}) {
  const targetUserId = hotspot.targetProjectUserId || '';
  const targetProjectId = hotspot.targetProjectId || '';
  return buildPlayableProjectUrl(targetUserId, targetProjectId, href);
}

function getHotspotLinkUrl(hotspot = {}, context = {}) {
  const actionType = hotspot?.actionType || '';
  if (actionType === 'external_link') {
    return normalizeHotspotExternalUrl(hotspot.externalUrl || '', context.href);
  }
  if (actionType === 'project_link') {
    return buildPlayableProjectUrl(hotspot.targetProjectUserId || '', hotspot.targetProjectId || '', context.href);
  }
  return '';
}

function isHotspotLinkAction(actionType = '') {
  return actionType === 'external_link' || actionType === 'project_link';
}

export {
  getHotspotLinkUrl,
  getHotspotProjectLinkUrl,
  isHotspotLinkAction,
  normalizeHotspotExternalUrl,
};
