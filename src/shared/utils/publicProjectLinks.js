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
  buildPlayableProjectUrl,
  downloadProjectQrCode,
  sanitizeDownloadName,
};
