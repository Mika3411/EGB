const slugify = (value = '') => String(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '')
  || 'asset';

const dataUrlToBytes = (dataUrl) => {
  const match = /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl || '');
  if (!match) return null;

  const mimeType = match[1] || 'application/octet-stream';
  const isBase64 = Boolean(match[2]);
  const payload = match[3] || '';

  if (isBase64) {
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { mimeType, bytes };
  }

  const decoded = decodeURIComponent(payload);
  const bytes = new TextEncoder().encode(decoded);
  return { mimeType, bytes };
};

const extensionFromMime = (mimeType = '') => {
  const mapping = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'audio/mpeg': 'mp3',
    'audio/mp3': 'mp3',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/ogg': 'ogg',
    'audio/webm': 'webm',
    'audio/mp4': 'm4a',
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
  };
  if (mapping[mimeType]) return mapping[mimeType];
  const raw = mimeType.split('/')[1] || 'bin';
  return raw.replace(/[^a-z0-9]+/gi, '').toLowerCase() || 'bin';
};

const deepClone = (value) => JSON.parse(JSON.stringify(value || {}));

export function buildExportProjectWithAssets(project, zip) {
  const nextProject = deepClone(project);
  const usedPaths = new Map();

  const uniqueAssetPath = (folder, preferredName, mimeType) => {
    const baseName = slugify(preferredName || 'asset');
    const extension = extensionFromMime(mimeType);
    const prefix = folder ? `assets/${folder}/${baseName}` : `assets/${baseName}`;
    const count = usedPaths.get(prefix) || 0;
    usedPaths.set(prefix, count + 1);
    return count === 0 ? `${prefix}.${extension}` : `${prefix}-${count + 1}.${extension}`;
  };

  const exportMediaField = (target, dataKey, nameKey, folder, fallbackName) => {
    if (!target || !target[dataKey] || typeof target[dataKey] !== 'string') return;
    const value = target[dataKey];
    if (!value.startsWith('data:')) return;

    const parsed = dataUrlToBytes(value);
    if (!parsed) return;

    const assetPath = uniqueAssetPath(folder, target[nameKey] || fallbackName, parsed.mimeType);
    zip.file(assetPath, parsed.bytes);
    target[dataKey] = assetPath;
  };

  (nextProject.scenes || []).forEach((scene, sceneIndex) => {
    exportMediaField(scene, 'backgroundData', 'backgroundName', 'scenes', scene.name || `scene-${sceneIndex + 1}-background`);
    exportMediaField(scene, 'musicData', 'musicName', 'audio', scene.name || `scene-${sceneIndex + 1}-music`);

    (scene.hotspots || []).forEach((spot, spotIndex) => {
      const hotspotName = `${scene.name || `scene-${sceneIndex + 1}`}-${spot.name || `hotspot-${spotIndex + 1}`}`;
      exportMediaField(spot, 'objectImageData', 'objectImageName', 'hotspots', `${hotspotName}-image`);
      exportMediaField(spot, 'soundData', 'soundName', 'audio', `${hotspotName}-sound`);
      exportMediaField(spot, 'secondObjectImageData', 'secondObjectImageName', 'hotspots', `${hotspotName}-second-image`);
    });

    (scene.sceneObjects || []).forEach((obj, objIndex) => {
      exportMediaField(obj, 'imageData', 'name', 'scene-objects', `${scene.name || `scene-${sceneIndex + 1}`}-object-${objIndex + 1}`);
      exportMediaField(obj, 'popupImage', 'popupImageName', 'scene-objects', `${scene.name || `scene-${sceneIndex + 1}`}-object-popup-${objIndex + 1}`);
      exportMediaField(obj, 'popupImageData', 'popupImageName', 'scene-objects', `${scene.name || `scene-${sceneIndex + 1}`}-object-popup-${objIndex + 1}`);
    });
  });

  (nextProject.items || []).forEach((item, itemIndex) => {
    exportMediaField(item, 'imageData', 'imageName', 'items', item.name || `item-${itemIndex + 1}`);
  });

  (nextProject.cinematics || []).forEach((cinematic, cinematicIndex) => {
    exportMediaField(cinematic, 'videoData', 'videoName', 'video', cinematic.name || `cinematic-${cinematicIndex + 1}`);

    (cinematic.slides || []).forEach((slide, slideIndex) => {
      const slideName = `${cinematic.name || `cinematic-${cinematicIndex + 1}`}-slide-${slideIndex + 1}`;
      exportMediaField(slide, 'imageData', 'imageName', 'cinematics', `${slideName}-image`);
      exportMediaField(slide, 'audioData', 'audioName', 'audio', `${slideName}-audio`);
    });
  });

  (nextProject.enigmas || []).forEach((enigma, enigmaIndex) => {
    exportMediaField(enigma, 'imageData', 'imageName', 'enigmas', enigma.name || `enigma-${enigmaIndex + 1}`);
    exportMediaField(enigma, 'popupBackgroundData', 'popupBackgroundName', 'enigmas', `${enigma.name || `enigma-${enigmaIndex + 1}`}-popup-bg`);
  });

  return nextProject;
}
