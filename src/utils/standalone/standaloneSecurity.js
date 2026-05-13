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

function isInternalAssetUrl(value = '') {
  return /^(?:\\.\\/)?assets\\/[a-z0-9._~!$&()*+,;=:@%\\/-]+$/i.test(value);
}

function isAllowedDataMediaUrl(raw = '', kind = 'image') {
  return kind === 'image' && raw.toLowerCase().startsWith('data:image/');
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
