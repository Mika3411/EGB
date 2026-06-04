import { normalizeProject } from '../data/projectData';

export const isMediaFileAccept = (accept = '') => /image|audio|video/i.test(accept);

export const getAcceptedMediaType = (accept = '') => {
  if (/image/i.test(accept)) return 'image';
  if (/audio/i.test(accept)) return 'audio';
  if (/video/i.test(accept)) return 'video';
  return '';
};

export const dataUrlToFile = async (url, name = 'media') => {
  const response = await fetch(url);
  const blob = await response.blob();
  return new File([blob], name, { type: blob.type || 'application/octet-stream' });
};

const clearMediaFieldsByAsset = (target, urls, assetIds, fields) => {
  if (!target) return;
  fields.forEach(([dataField, nameField, idField]) => {
    const matchesUrl = dataField && urls.has(target[dataField]);
    const matchesId = idField && assetIds.has(target[idField]);
    if (!matchesUrl && !matchesId) return;
    target[dataField] = '';
    if (nameField) target[nameField] = '';
    if (idField) target[idField] = '';
  });
};

const clearMatchingMediaValues = (target, urls, assetIds) => {
  if (!target || typeof target !== 'object') return;
  Object.entries(target).forEach(([key, value]) => {
    if (typeof value === 'string' && (urls.has(value) || assetIds.has(value))) {
      target[key] = '';
      return;
    }
    if (value && typeof value === 'object') {
      clearMatchingMediaValues(value, urls, assetIds);
    }
  });
};

export const removeMediaAssetsFromProject = (project = {}, { urls = [], assetIds = [] } = {}) => {
  const urlSet = new Set(urls.filter(Boolean));
  const assetIdSet = new Set(assetIds.filter(Boolean));
  if (!urlSet.size && !assetIdSet.size) return normalizeProject(project);
  const draft = structuredClone(project);
  (draft.items || []).forEach((item) => {
    clearMediaFieldsByAsset(item, urlSet, assetIdSet, [['imageData', 'imageName', 'imageId']]);
  });
  (draft.scenes || []).forEach((scene) => {
    clearMediaFieldsByAsset(scene, urlSet, assetIdSet, [
      ['backgroundData', 'backgroundName', 'backgroundId'],
      ['musicData', 'musicName', 'musicId'],
      ['ambientSoundData', 'ambientSoundName', 'ambientSoundId'],
    ]);
    (scene.sceneObjects || []).forEach((object) => {
      clearMediaFieldsByAsset(object, urlSet, assetIdSet, [
        ['imageData', 'imageName', 'imageId'],
        ['objectImageData', 'objectImageName', 'objectImageId'],
        ['popupImageData', 'popupImageName', 'popupImageId'],
        ['popupImage', 'popupImageName', 'popupImageId'],
        ['soundData', 'soundName', 'soundId'],
      ]);
      (object.logicRules || []).forEach((rule) => {
        clearMediaFieldsByAsset(rule, urlSet, assetIdSet, [
          ['successSoundData', 'successSoundName', 'successSoundId'],
          ['failureSoundData', 'failureSoundName', 'failureSoundId'],
        ]);
      });
    });
    (scene.hotspots || []).forEach((hotspot) => {
      clearMediaFieldsByAsset(hotspot, urlSet, assetIdSet, [
        ['objectImageData', 'objectImageName', 'objectImageId'],
        ['secondObjectImageData', 'secondObjectImageName', 'secondObjectImageId'],
        ['soundData', 'soundName', 'soundId'],
      ]);
      (hotspot.logicRules || []).forEach((rule) => {
        clearMediaFieldsByAsset(rule, urlSet, assetIdSet, [
          ['successSoundData', 'successSoundName', 'successSoundId'],
          ['failureSoundData', 'failureSoundName', 'failureSoundId'],
        ]);
      });
    });
  });
  (draft.cinematics || []).forEach((cinematic) => {
    clearMediaFieldsByAsset(cinematic, urlSet, assetIdSet, [['videoData', 'videoName', 'videoId']]);
    (cinematic.slides || []).forEach((slide) => {
      clearMediaFieldsByAsset(slide, urlSet, assetIdSet, [
        ['imageData', 'imageName', 'imageId'],
        ['audioData', 'audioName', 'audioId'],
      ]);
    });
  });
  (draft.enigmas || []).forEach((enigma) => {
    clearMediaFieldsByAsset(enigma, urlSet, assetIdSet, [
      ['imageData', 'imageName', 'imageId'],
      ['popupBackgroundData', 'popupBackgroundName', 'popupBackgroundId'],
    ]);
  });
  (draft.anime2dDraft?.layers || []).forEach((layer) => {
    clearMediaFieldsByAsset(layer, urlSet, assetIdSet, [
      ['src', 'name', 'assetId'],
      ['imageData', 'name', 'imageId'],
    ]);
  });
  draft.assets = (draft.assets || []).filter((asset) => (
    !urlSet.has(asset.url) && !assetIdSet.has(asset.id)
  ));
  clearMatchingMediaValues(draft, urlSet, assetIdSet);
  return normalizeProject(draft);
};

export const formatMediaDeletionUsage = (asset = {}) => {
  const counts = (asset.usageKinds || []).reduce((acc, kind) => {
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {});
  const labels = {
    scene: ['scene', 'scenes'],
    object: ['objet', 'objets'],
    cinematic: ['cinematic', 'cinematics'],
    animation: ['animation', 'animations'],
  };
  const parts = Object.entries(counts).map(([kind, count]) => {
    const [singular, plural] = labels[kind] || ['endroit', 'endroits'];
    return `${count} ${count > 1 ? plural : singular}`;
  });
  return parts.length ? parts.join(', ') : `${asset.usages?.length || 1} endroit${asset.usages?.length > 1 ? 's' : ''}`;
};

export const dataUrlToBlob = (dataUrl) => {
  const match = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  const [, mimeType, base64] = match;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
};

export const extensionFromMime = (mimeType = '') => {
  if (mimeType.includes('jpeg')) return 'jpg';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('svg')) return 'svg';
  return 'png';
};
