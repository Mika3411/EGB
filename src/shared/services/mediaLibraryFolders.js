export const MEDIA_FOLDERS = [
  { id: 'scene-images', label: 'Photos scènes', type: 'image' },
  { id: 'object-images', label: 'Photos objets', type: 'image' },
  { id: 'cinematic-images', label: 'Photos cinématiques', type: 'image' },
  { id: 'animation-images', label: 'Photos animation', type: 'image' },
  { id: 'music', label: 'Musiques', type: 'audio' },
  { id: 'sounds', label: 'Sons', type: 'audio' },
  { id: 'videos', label: 'Videos', type: 'video' },
];

const compactList = (items = []) => [...new Set(items.filter(Boolean))];

const normalizeUsageText = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

export const getAssetFolderId = (asset = {}) => {
  const usageText = normalizeUsageText((asset.usedIn || []).join(' '));
  const idText = String(asset.id || '');
  if (asset.type === 'audio') {
    if (asset.meta?.role === 'music') return 'music';
    return 'sounds';
  }
  if (asset.type === 'video') return 'videos';
  if (asset.type === 'image') {
    if (
      asset.meta?.role === 'popupBackground'
      || asset.meta?.role === 'enigmaImage'
      || asset.meta?.role === 'decor3dTexture'
      || /\b(sceneObject|hotspot|item|decor3d):/.test(usageText)
    ) return 'object-images';
    if (asset.meta?.role === 'background') return 'scene-images';
    if (
      asset.meta?.role === 'cinematicImage'
      || asset.meta?.role === 'slideImage'
      || /\bcinematic:/.test(usageText)
      || /\bslide:/.test(usageText)
      || /asset_cinematic/.test(idText)
    ) return 'cinematic-images';
    if (
      asset.meta?.role === 'animationImage'
      || /\banimation:/.test(usageText)
      || /\banime2dLayer:/.test(asset.usedIn?.join(' ') || '')
      || /asset_animation|asset_anime/i.test(idText)
    ) return 'animation-images';
    if (/\bscene:/.test(usageText)) return 'scene-images';
    return 'object-images';
  }
  return 'object-images';
};

export const getAssetFolderIds = (asset = {}) => compactList([
  ...(Array.isArray(asset.folderIds) ? asset.folderIds : []),
  asset.folderId,
  getAssetFolderId(asset),
]);
