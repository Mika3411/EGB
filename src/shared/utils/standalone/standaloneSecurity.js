export const buildStandaloneSecurityScript = (standaloneGameEngineScript) => `
function isFullscreenActive() {
  return Boolean(document.fullscreenElement);
}

function syncFullscreenUi() {
  document.body.classList.toggle('game-fullscreen', isFullscreenActive());
  const button = root.querySelector('#fullscreen-toggle');
  if (button) {
    button.textContent = isFullscreenActive() ? 'Quitter le plein écran' : 'Plein écran';
  }
}

function setSceneAspectFromImage(image) {
  if (!image?.naturalWidth || !image?.naturalHeight || !image.parentElement) return;
  image.parentElement.style.setProperty('--scene-aspect', String(image.naturalWidth / image.naturalHeight));
}

function getVisualEffectZoneZIndex(layer) {
  if (layer === 'front') return 26;
  if (layer === 'between') return 19;
  return 13;
}

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    document.body.classList.toggle('game-fullscreen');
    syncFullscreenUi();
  }
}

document.addEventListener('fullscreenchange', syncFullscreenUi);

function safeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(value = '') {
  return safeHtml(String(value).replace(/[\\x00-\\x1f\\x7f]/g, ''))
    .replace(/'/g, '&#39;')
    .replaceAll(String.fromCharCode(96), '&#96;');
}

function safeDataAttr(value = '') {
  return escapeAttr(value);
}

function safeClassToken(value = '', fallback = '') {
  const token = String(value || '').trim();
  if (/^[a-z0-9_-]+$/i.test(token)) return token;
  const fallbackToken = String(fallback || '').trim();
  return /^[a-z0-9_-]+$/i.test(fallbackToken) ? fallbackToken : '';
}

function isInternalAssetUrl(value = '') {
  return /^(?:\\.\\/)?assets\\/[a-z0-9._~!$&()*+,;=:@%\\/-]+$/i.test(value);
}

function decodeDataUrlPayload(raw = '') {
  const text = String(raw || '');
  const commaIndex = text.indexOf(',');
  if (commaIndex < 0) return '';
  const metadata = text.slice(0, commaIndex);
  const payload = text.slice(commaIndex + 1);
  if (/;base64(?:;|$)/i.test(metadata)) {
    try {
      return typeof atob === 'function' ? atob(payload.replace(/\\s/g, '')) : '';
    } catch {
      return '';
    }
  }
  try {
    return decodeURIComponent(payload);
  } catch {
    return payload;
  }
}

function isSafeSvgDataUrl(raw = '') {
  const svg = decodeDataUrlPayload(raw).slice(0, 20000);
  return Boolean(svg.trim()) && !/<\\s*script\\b|javascript\\s*:|on[a-z]+\\s*=|<\\s*foreignObject\\b/i.test(svg);
}

function isAllowedDataMediaUrl(raw = '', kind = 'image') {
  if (kind !== 'image') return false;
  const match = /^data:([^;,]+)(?:;charset=[^;,]+)?(?:;base64)?,/i.exec(String(raw || '').trim());
  if (!match) return false;
  const mimeType = match[1].toLowerCase();
  if (mimeType === 'image/svg+xml') return isSafeSvgDataUrl(raw);
  return ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/avif', 'image/bmp']
    .includes(mimeType);
}

function safeMediaUrl(value = '', kind = 'image') {
  const raw = String(value || '').trim();
  if (!raw || /[\\x00-\\x1f\\x7f]/.test(raw)) return '';
  if (isInternalAssetUrl(raw)) return raw;
  if (isAllowedDataMediaUrl(raw, kind)) return raw;
  try {
    const parsed = new URL(raw);
    return parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function escapeMediaAttr(value = '', kind = 'image') {
  return escapeAttr(safeMediaUrl(value, kind));
}

function cssMediaUrl(value = '', kind = 'image') {
  const url = safeMediaUrl(value, kind);
  return url ? 'url(&quot;' + escapeAttr(url) + '&quot;)' : 'none';
}

function cssNumber(value, fallback = 0, min = -10000, max = 10000) {
  const number = Number(value);
  const fallbackNumber = Number(fallback);
  const lower = Number.isFinite(Number(min)) ? Number(min) : -10000;
  const upper = Number.isFinite(Number(max)) ? Number(max) : 10000;
  const safeValue = Number.isFinite(number)
    ? number
    : Number.isFinite(fallbackNumber) ? fallbackNumber : 0;
  return String(Math.round(Math.max(lower, Math.min(upper, safeValue)) * 1000) / 1000);
}

function cssPercent(value, fallback = 0) {
  return cssNumber(value, fallback, 0, 100);
}

function safeStylePercent(value, fallback = 0) {
  return cssPercent(value, fallback) + '%';
}

function safeSceneObjectPositionPercent(value, fallback = 0) {
  return cssNumber(value, fallback, -1000, 1000) + '%';
}

function safeSceneObjectSizePercent(value, fallback = 10) {
  return cssNumber(value, fallback, 0, 1000) + '%';
}

function getLayerZIndex(entry = {}, type = 'sceneObject') {
  return cssNumber(entry?.zIndex, type === 'hotspot' ? 20 : 18, -1000, 1000);
}

function safeCssColor(value = '', fallback = 'rgba(2, 6, 23, .62)') {
  const raw = String(value || '').trim();
  if (!raw || /[\\x00-\\x1f\\x7f;"'{}<>]/.test(raw) || /url\\s*\\(/i.test(raw) || /expression\\s*\\(/i.test(raw)) {
    return fallback;
  }
  if (/^#[0-9a-f]{3,8}$/i.test(raw)) return raw;
  if (/^rgba?\\(\\s*(?:\\d{1,3}\\s*,\\s*){2}\\d{1,3}\\s*(?:,\\s*(?:0|1|0?\\.\\d+|\\.\\d+))?\\s*\\)$/i.test(raw)) return raw;
  if (/^hsla?\\(\\s*-?\\d+(?:deg)?\\s*,\\s*\\d{1,3}%\\s*,\\s*\\d{1,3}%\\s*(?:,\\s*(?:0|1|0?\\.\\d+|\\.\\d+))?\\s*\\)$/i.test(raw)) return raw;
  if (/^-?\\d+(?:deg)?\\s+\\d{1,3}%\\s+\\d{1,3}%$/i.test(raw)) return raw;
  if (/^(?:transparent|black|white)$/i.test(raw)) return raw.toLowerCase();
  return fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function getElementShapeCorners(entry = {}) {
  const corners = entry.shapeCorners || {};
  return {
    nw: { x: Number.isFinite(Number(corners.nw?.x)) ? Number(corners.nw.x) : 0, y: Number.isFinite(Number(corners.nw?.y)) ? Number(corners.nw.y) : 0 },
    ne: { x: Number.isFinite(Number(corners.ne?.x)) ? Number(corners.ne.x) : 100, y: Number.isFinite(Number(corners.ne?.y)) ? Number(corners.ne.y) : 0 },
    se: { x: Number.isFinite(Number(corners.se?.x)) ? Number(corners.se.x) : 100, y: Number.isFinite(Number(corners.se?.y)) ? Number(corners.se.y) : 100 },
    sw: { x: Number.isFinite(Number(corners.sw?.x)) ? Number(corners.sw.x) : 0, y: Number.isFinite(Number(corners.sw?.y)) ? Number(corners.sw.y) : 100 },
  };
}

function getElementShapeType(entry = {}) {
  if (['rectangle', 'ellipse', 'free'].includes(entry.shapeType)) return entry.shapeType;
  return (Array.isArray(entry.shapePoints) && entry.shapePoints.length >= 3) || entry.shapeCorners ? 'free' : 'rectangle';
}

function getElementShapePoints(entry = {}) {
  if (Array.isArray(entry.shapePoints) && entry.shapePoints.length >= 3) {
    return entry.shapePoints.map((point) => ({
      x: Number.isFinite(Number(point?.x)) ? Number(point.x) : 50,
      y: Number.isFinite(Number(point?.y)) ? Number(point.y) : 50,
    }));
  }
  const corners = getElementShapeCorners(entry);
  return [corners.nw, corners.ne, corners.se, corners.sw];
}

function getElementShapeStyle(entry = {}) {
  const shapeType = getElementShapeType(entry);
  if (shapeType === 'ellipse') return 'clip-path:ellipse(50% 50% at 50% 50%);';
  if (shapeType !== 'free') return '';
  const points = getElementShapePoints(entry);
  return 'clip-path:polygon(' + points.map((point) => (
    clampPercent(point.x) + '% ' + clampPercent(point.y) + '%'
  )).join(',') + ');';
}

function isPointInsidePolygon(point, polygon) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const currentPoint = polygon[index];
    const previousPoint = polygon[previous];
    const intersects = ((currentPoint.y > point.y) !== (previousPoint.y > point.y))
      && (point.x < ((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) / ((previousPoint.y - currentPoint.y) || 0.0001) + currentPoint.x);
    if (intersects) inside = !inside;
  }
  return inside;
}

function isPointerInsideElementShape(event, entry, element) {
  const shapeType = getElementShapeType(entry);
  if (shapeType === 'rectangle') return true;
  const rect = element.getBoundingClientRect();
  if (!rect.width || !rect.height) return true;
  const point = {
    x: clampPercent(((event.clientX - rect.left) / rect.width) * 100),
    y: clampPercent(((event.clientY - rect.top) / rect.height) * 100),
  };
  if (shapeType === 'ellipse') {
    const x = (point.x - 50) / 50;
    const y = (point.y - 50) / 50;
    return (x * x + y * y) <= 1;
  }
  return isPointInsidePolygon(point, getElementShapePoints(entry));
}

${standaloneGameEngineScript}
`;
