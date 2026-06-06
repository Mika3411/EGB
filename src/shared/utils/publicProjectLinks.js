function buildPlayableProjectUrl(userId, projectId, href = globalThis.location?.href || '/') {
  if (!userId || !projectId) return '';

  const base = globalThis.location?.origin || 'https://escape-game-studio.netlify.app';
  const url = new URL(href || '/', base);
  url.search = '';
  url.hash = '';
  url.searchParams.set('playUser', userId);
  url.searchParams.set('playProject', projectId);
  return url.toString();
}

function sanitizeAuthorProfileSlug(value = '', fallback = 'creator') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || fallback;
}

function getAuthorProfileIdSuffix(userId = '') {
  return sanitizeAuthorProfileSlug(userId, 'id').slice(0, 16) || 'id';
}

function getAuthorProfileSlug(source = {}) {
  if (typeof source === 'string') return sanitizeAuthorProfileSlug(source);

  const safeSource = source && typeof source === 'object' ? source : {};
  const baseName = safeSource.slug
    || safeSource.displayName
    || safeSource.name
    || String(safeSource.email || '').split('@')[0]
    || '';
  const fallback = safeSource.userId ? `creator-${getAuthorProfileIdSuffix(safeSource.userId)}` : 'creator';
  return sanitizeAuthorProfileSlug(baseName, fallback);
}

function getAuthorProfileRouteSlug(source = {}, peers = []) {
  const safeSource = source && typeof source === 'object' ? source : { displayName: source };
  const baseSlug = getAuthorProfileSlug(safeSource);
  const sourceKey = safeSource.userId || baseSlug;
  const sourcesByKey = new Map();

  [...(Array.isArray(peers) ? peers : []), safeSource]
    .filter(Boolean)
    .forEach((entry) => {
      const safeEntry = entry && typeof entry === 'object' ? entry : { displayName: entry };
      const key = safeEntry.userId || getAuthorProfileSlug(safeEntry);
      if (key && !sourcesByKey.has(key)) sourcesByKey.set(key, safeEntry);
    });

  const matchingSources = [...sourcesByKey.values()]
    .filter((entry) => getAuthorProfileSlug(entry) === baseSlug);

  if (matchingSources.length <= 1) return baseSlug;
  return `${baseSlug}-${getAuthorProfileIdSuffix(safeSource.userId || sourceKey)}`;
}

function getAuthorProfileSlugFromPath(pathname = globalThis.location?.pathname || '') {
  const match = String(pathname || '').match(/^\/creator\/([^/?#]+)/i);
  if (!match) return '';

  try {
    return sanitizeAuthorProfileSlug(decodeURIComponent(match[1]), '');
  } catch {
    return sanitizeAuthorProfileSlug(match[1], '');
  }
}

function buildAuthorProfileUrl(userId, href = globalThis.location?.href || '/', source = {}) {
  if (!userId) return '';

  const base = globalThis.location?.origin || 'https://escape-game-studio.netlify.app';
  const url = new URL(href || '/', base);
  const slug = getAuthorProfileSlug({
    ...(source && typeof source === 'object' ? source : { slug: source }),
    userId,
  });
  url.pathname = `/creator/${encodeURIComponent(slug)}`;
  url.search = '';
  url.hash = '';
  return url.toString();
}

function sanitizeDownloadName(value, fallback = 'escape-game') {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return normalized || fallback;
}

function downloadDataUrl(filename, dataUrl) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body?.appendChild(link);
  link.click();
  link.remove();
}

async function downloadProjectQrCode(url, { projectName = 'escape-game' } = {}) {
  if (!url) {
    throw new Error('Lien joueur introuvable.');
  }

  const qrCodeModule = await import('qrcode');
  const QRCode = qrCodeModule.default || qrCodeModule;
  const dataUrl = await QRCode.toDataURL(String(url), {
    errorCorrectionLevel: 'M',
    margin: 3,
    scale: 12,
    type: 'image/png',
    color: {
      dark: '#0f172a',
      light: '#ffffff',
    },
  });
  const filename = `${sanitizeDownloadName(projectName)}-qr-code.png`;
  downloadDataUrl(filename, dataUrl);
  return { dataUrl, filename };
}

export {
  buildAuthorProfileUrl,
  buildPlayableProjectUrl,
  getAuthorProfileRouteSlug,
  getAuthorProfileSlug,
  getAuthorProfileSlugFromPath,
  sanitizeAuthorProfileSlug,
  downloadProjectQrCode,
  sanitizeDownloadName,
};
