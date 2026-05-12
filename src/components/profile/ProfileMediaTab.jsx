import React, { useEffect, useMemo, useState } from 'react';
import { showConfirm } from '../AccessibleDialog';
import { getProjectName } from '../../lib/projectAnalysis';
import { getAssetStorageBytes } from '../../lib/storageQuota';

const MEDIA_FOLDERS = [
  { id: 'scene-images', label: 'Photos scènes', type: 'image' },
  { id: 'object-images', label: 'Photos objets', type: 'image' },
  { id: 'cinematic-images', label: 'Photos cinématiques', type: 'image' },
  { id: 'animation-images', label: 'Photos animation', type: 'image' },
  { id: 'music', label: 'Musiques', type: 'audio' },
  { id: 'sounds', label: 'Sons', type: 'audio' },
  { id: 'videos', label: 'Videos', type: 'video' },
];

const MEDIA_ORGANIZATION_KEY_PREFIX = 'escapeGameBuilder.mediaOrganization';

const getMediaOrganizationKey = (userKey = 'anonymous') => `${MEDIA_ORGANIZATION_KEY_PREFIX}.${userKey || 'anonymous'}`;

const readMediaOrganization = (userKey) => {
  if (typeof window === 'undefined') return { folders: [], assets: {} };
  try {
    const parsed = JSON.parse(window.localStorage.getItem(getMediaOrganizationKey(userKey)) || '{}');
    const assets = parsed.assets && typeof parsed.assets === 'object'
      ? Object.fromEntries(Object.entries(parsed.assets).map(([assetKey, assetConfig]) => {
        const folderTags = Array.isArray(assetConfig?.folderTags)
          ? assetConfig.folderTags
          : [assetConfig?.folderId].filter(Boolean);
        return [assetKey, {
          ...assetConfig,
          folderTags: [...new Set(folderTags.filter(Boolean))],
        }];
      }))
      : {};
    return {
      folders: Array.isArray(parsed.folders) ? parsed.folders : [],
      assets,
    };
  } catch {
    return { folders: [], assets: {} };
  }
};

const writeMediaOrganization = (userKey, organization) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(getMediaOrganizationKey(userKey), JSON.stringify(organization));
};

const LARGE_MEDIA_KEY_LENGTH = 200_000;
const HASH_SAMPLE_LENGTH = 4096;
const INITIAL_VISIBLE_MEDIA_LIMIT = 24;
const VISIBLE_MEDIA_INCREMENT = 24;

const mixHash = (hash, value) => Math.imul(hash ^ value, 16777619) >>> 0;

const hashText = (text = '') => {
  const value = String(text || '');
  const length = value.length;
  let hash = mixHash(2166136261, length);

  if (length <= HASH_SAMPLE_LENGTH * 3) {
    for (let index = 0; index < length; index += 1) {
      hash = mixHash(hash, value.charCodeAt(index));
    }
    return hash.toString(36);
  }

  for (let index = 0; index < HASH_SAMPLE_LENGTH; index += 1) {
    hash = mixHash(hash, value.charCodeAt(index));
  }
  const middleStart = Math.max(0, Math.floor((length - HASH_SAMPLE_LENGTH) / 2));
  for (let index = middleStart; index < middleStart + HASH_SAMPLE_LENGTH; index += 1) {
    hash = mixHash(hash, value.charCodeAt(index));
  }
  for (let index = length - HASH_SAMPLE_LENGTH; index < length; index += 1) {
    hash = mixHash(hash, value.charCodeAt(index));
  }
  return hash.toString(36);
};

const compactMediaKeyPart = (value = '') => {
  const text = String(value || '');
  if (!text) return '';
  if (text.length > LARGE_MEDIA_KEY_LENGTH || text.startsWith('data:')) {
    return `hash:${text.length}:${hashText(text)}`;
  }
  return text;
};

const makeStableMediaKey = ({ type = 'unknown', url = '', name = '' } = {}) => {
  const source = `${type}:${compactMediaKeyPart(url)}:${name}`;
  return `media_${hashText(source)}`;
};

const splitTags = (value = '') => String(value)
  .split(',')
  .map((entry) => entry.trim())
  .filter(Boolean);

const compactList = (items = []) => [...new Set(items.filter(Boolean))];

const STORAGE_MB_PER_CREDIT = 5;

const formatCreditStorage = (credits = 0) => {
  const megaBytes = Math.max(0, Math.round(Number(credits || 0))) * STORAGE_MB_PER_CREDIT;
  if (megaBytes >= 1024) return `~${(megaBytes / 1024).toFixed(megaBytes >= 10240 ? 0 : 2).replace(/\.00$/, '')} Go`;
  return `~${megaBytes} Mo`;
};

const getMediaType = (url = '', fallback = 'unknown') => {
  const match = String(url).match(/^data:([^/;]+)\//);
  if (match?.[1]) return match[1];
  if (/\.(mp3|wav|ogg|m4a|aac)(\?|$)/i.test(url)) return 'audio';
  if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) return 'video';
  if (/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)) return 'image';
  return fallback;
};

const fileLabel = (name = '', fallback = 'Média') => String(name || fallback).trim() || fallback;

const getMediaDedupeKey = ({ type, url, name }) => {
  const normalizedName = fileLabel(name, '')
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  if ((type === 'audio' || type === 'video') && normalizedName && normalizedName !== 'media') {
    return `name:${type}:${normalizedName}`;
  }
  const rawUrl = String(url || '');
  const normalizedUrl = rawUrl.startsWith('data:') ? rawUrl : rawUrl.split('?')[0].split('#')[0];
  return `url:${type || 'unknown'}:${compactMediaKeyPart(normalizedUrl || rawUrl)}`;
};

const getAssetFolderId = (asset = {}) => {
  const usageText = (asset.usedIn || []).join(' ');
  const idText = String(asset.id || '');
  if (asset.type === 'audio') {
    if (asset.meta?.role === 'music') return 'music';
    return 'sounds';
  }
  if (asset.type === 'video') return 'videos';
  if (asset.type === 'image') {
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
      || /asset_animation|asset_anime/i.test(idText)
    ) return 'animation-images';
    if (asset.meta?.role === 'popupBackground' || asset.meta?.role === 'enigmaImage') return 'object-images';
    return 'object-images';
  }
  return 'object-images';
};

const getUsageKindFromReference = (reference = '') => {
  if (/^sceneObject:|^hotspot:|^item:/.test(reference)) return 'object';
  if (/^scene:/.test(reference)) return 'scene';
  if (/^cinematic:|^slide:/.test(reference)) return 'cinematic';
  if (/^animation:|^anime/i.test(reference)) return 'animation';
  return '';
};

const getUsageLabelFromReference = (reference = '') => {
  const [kind, id, role] = String(reference || '').split(':');
  const labels = {
    scene: 'Scène',
    sceneObject: 'Objet',
    hotspot: 'Hotspot',
    item: 'Objet inventaire',
    cinematic: 'Cinématique',
    slide: 'Slide cinematic',
    animation: 'Animation',
  };
  return labels[kind] ? `${labels[kind]}: ${id || role || 'reference'}` : reference;
};

const getProjectKey = (project = {}) => project.id || project.projectId || project.title || project.name || 'project';
const makeProjectFilterId = (projectKey = '') => `project:${projectKey}`;
const makeProjectCategoryFilterId = (projectKey = '', folderId = '') => `project:${projectKey}:folder:${folderId}`;
const parseProjectFilterId = (filterId = '') => {
  const match = String(filterId).match(/^project:(.*?)(?::folder:(.*))?$/);
  return match ? { projectKey: match[1], folderId: match[2] || '' } : null;
};

const collectProfileMedia = (projects = [], mediaLibrary = []) => {
  const byUrl = new Map();

  const addMedia = ({
    project,
    folderId,
    type,
    url,
    name,
    assetId = '',
    usage,
    usageKind = 'usage',
    width = 0,
    height = 0,
    size = 0,
    bytes = 0,
    usedIn = [],
  }) => {
    if (!url) return;
    const key = getMediaDedupeKey({ folderId, type, url, name });
    const existing = byUrl.get(key);
    const folder = MEDIA_FOLDERS.find((entry) => entry.id === folderId);
    const projectName = getProjectName(project);
    const projectKey = getProjectKey(project);
    const inferredUsages = usage
      ? [{ label: usage, kind: usageKind }]
      : compactList(usedIn).map((reference) => ({
        label: getUsageLabelFromReference(reference),
        kind: getUsageKindFromReference(reference),
      })).filter((entry) => entry.kind);
    const nextUsages = inferredUsages.map((entry) => `${projectName} - ${entry.label}`);
    const nextUsageKinds = inferredUsages.map((entry) => entry.kind || usageKind).filter(Boolean);

    if (existing) {
      existing.urls = [...new Set([...(existing.urls || []), url])];
      existing.assetIds = [...new Set([...(existing.assetIds || []), assetId].filter(Boolean))];
      existing.projectIds = [...new Set([...(existing.projectIds || []), projectKey].filter(Boolean))];
      existing.projectNames = [...new Set([...(existing.projectNames || []), projectName].filter(Boolean))];
      existing.usages = nextUsages.length ? [...new Set([...existing.usages, ...nextUsages])] : existing.usages;
      existing.usageKinds = nextUsageKinds.length ? [...existing.usageKinds, ...nextUsageKinds] : existing.usageKinds;
      const folderIds = existing.usages.length && folderId !== 'object-images'
        ? existing.folderIds.filter((entry) => entry !== 'object-images')
        : existing.folderIds;
      const folderLabels = existing.usages.length && folderId !== 'object-images'
        ? existing.folderLabels.filter((entry) => entry !== 'Photos objets')
        : existing.folderLabels;
      existing.folderIds = [...new Set([...folderIds, folderId])];
      existing.folderLabels = [...new Set([...folderLabels, folder?.label].filter(Boolean))];
      if (!existing.width && width) existing.width = width;
      if (!existing.height && height) existing.height = height;
      if (!existing.size && (size || bytes)) existing.size = Math.max(0, Number(size) || Number(bytes) || 0);
      if (!existing.storageBytes) existing.storageBytes = getAssetStorageBytes({ url, size, bytes });
      return;
    }

    const storageBytes = getAssetStorageBytes({ url, size, bytes });

    const orgKey = makeStableMediaKey({ type, url, name });

    byUrl.set(key, {
      id: orgKey,
      orgKey,
      folderId,
      folderIds: [folderId],
      folderLabel: folder?.label || 'Médias',
      folderLabels: [folder?.label || 'Médias'],
      type: getMediaType(url, type),
      url,
      urls: [url],
      assetId,
      assetIds: [assetId].filter(Boolean),
      name: fileLabel(name),
      projectName,
      projectIds: [projectKey].filter(Boolean),
      projectNames: [projectName].filter(Boolean),
      usages: nextUsages,
      usageKinds: nextUsageKinds,
      width,
      height,
      size: Math.max(0, Number(size) || Number(bytes) || 0),
      storageBytes,
    });
  };

  projects.forEach((projectRecord) => {
    const projectData = projectRecord?.data || projectRecord?.project || projectRecord || {};
    const project = {
      ...projectData,
      id: projectRecord?.id || projectData.id || projectRecord?.projectId,
      projectId: projectRecord?.id || projectData.projectId || projectData.id,
      title: projectData.title || projectRecord?.name || projectRecord?.title,
      name: projectData.name || projectRecord?.name || projectData.title,
    };

    (project.assets || []).forEach((asset) => {
      addMedia({
        project,
        folderId: getAssetFolderId(asset),
        type: asset.type,
        url: asset.url,
        name: asset.name,
        assetId: asset.id,
        width: asset.width,
        height: asset.height,
        size: asset.size,
        bytes: asset.bytes,
        usedIn: asset.usedIn,
      });
    });

    if (Array.isArray(project.assets) && project.assets.length) return;

    (project.scenes || []).forEach((scene) => {
      addMedia({
        project,
        folderId: 'scene-images',
        type: 'image',
        url: scene.backgroundData,
        name: scene.backgroundName || scene.name,
        assetId: scene.backgroundId,
        usage: `Scène: ${scene.name || scene.id}`,
        usageKind: 'scene',
        width: scene.backgroundWidth,
        height: scene.backgroundHeight,
      });
      addMedia({
        project,
        folderId: 'music',
        type: 'audio',
        url: scene.musicData,
        name: scene.musicName || scene.name,
        assetId: scene.musicId,
        usage: `Musique: ${scene.name || scene.id}`,
        usageKind: 'scene',
      });
      addMedia({
        project,
        folderId: 'sounds',
        type: 'audio',
        url: scene.ambientSoundData,
        name: scene.ambientSoundName || scene.name,
        assetId: scene.ambientSoundId,
        usage: `Son secondaire: ${scene.name || scene.id}`,
        usageKind: 'scene',
      });

      (scene.sceneObjects || []).forEach((object) => {
        addMedia({
          project,
          folderId: 'object-images',
          type: 'image',
          url: object.imageData,
          name: object.imageName || object.name,
          assetId: object.imageId,
          usage: `Objet: ${object.name || object.id}`,
          usageKind: 'object',
        });
        addMedia({
          project,
          folderId: 'object-images',
          type: 'image',
          url: object.objectImageData,
          name: object.objectImageName || object.name,
          assetId: object.objectImageId,
          usage: `Objet action: ${object.name || object.id}`,
          usageKind: 'object',
        });
        addMedia({
          project,
          folderId: 'object-images',
          type: 'image',
          url: object.popupImageData || object.popupImage,
          name: object.popupImageName || object.name,
          assetId: object.popupImageId,
          usage: `Pop-up objet: ${object.name || object.id}`,
          usageKind: 'object',
        });
        addMedia({
          project,
          folderId: 'sounds',
          type: 'audio',
          url: object.soundData,
          name: object.soundName || object.name,
          assetId: object.soundId,
          usage: `Son objet: ${object.name || object.id}`,
          usageKind: 'object',
        });
      });

      (scene.hotspots || []).forEach((hotspot) => {
        addMedia({
          project,
          folderId: 'object-images',
          type: 'image',
          url: hotspot.objectImageData,
          name: hotspot.objectImageName || hotspot.name,
          assetId: hotspot.objectImageId,
          usage: `Hotspot: ${hotspot.name || hotspot.id}`,
          usageKind: 'object',
        });
        addMedia({
          project,
          folderId: 'object-images',
          type: 'image',
          url: hotspot.secondObjectImageData,
          name: hotspot.secondObjectImageName || hotspot.name,
          assetId: hotspot.secondObjectImageId,
          usage: `Hotspot alternative: ${hotspot.name || hotspot.id}`,
          usageKind: 'object',
        });
      });
    });

    (project.items || []).forEach((item) => {
      addMedia({
        project,
        folderId: 'object-images',
        type: 'image',
        url: item.imageData,
        name: item.imageName || item.name,
        assetId: item.imageId,
        usage: `Objet inventaire: ${item.name || item.id}`,
        usageKind: 'object',
      });
    });

    (project.cinematics || []).forEach((cinematic) => {
      addMedia({
        project,
        folderId: 'videos',
        type: 'video',
        url: cinematic.videoData,
        name: cinematic.videoName || cinematic.name,
        assetId: cinematic.videoId,
        usage: `Cinématique: ${cinematic.name || cinematic.id}`,
        usageKind: 'cinematic',
      });

      (cinematic.slides || []).forEach((slide, index) => {
        addMedia({
          project,
          folderId: 'cinematic-images',
          type: 'image',
          url: slide.imageData,
          name: slide.imageName || cinematic.name,
          assetId: slide.imageId,
          usage: `Cinématique: ${cinematic.name || cinematic.id} / slide ${index + 1}`,
          usageKind: 'cinematic',
        });
        addMedia({
          project,
          folderId: 'sounds',
          type: 'audio',
          url: slide.audioData,
          name: slide.audioName || cinematic.name,
          assetId: slide.audioId,
          usage: `Audio cinematic: ${cinematic.name || cinematic.id} / slide ${index + 1}`,
          usageKind: 'cinematic',
        });
      });
    });

    (project.anime2dDraft?.layers || []).forEach((layer) => {
      addMedia({
        project,
        folderId: 'animation-images',
        type: 'image',
        url: layer.src || layer.imageData,
        name: layer.name || project.anime2dDraft?.sceneName,
        assetId: layer.assetId || layer.imageId,
        usage: `Animation: ${layer.name || layer.id}`,
        usageKind: 'animation',
      });
    });
  });

  mediaLibrary.forEach((asset) => {
    addMedia({
      project: { id: asset.projectId || asset.projectKey || 'library', title: asset.projectName || 'Médiathèque' },
      folderId: getAssetFolderId(asset),
      type: asset.type,
      url: asset.url,
      name: asset.name,
      assetId: asset.id,
      width: asset.width,
      height: asset.height,
      size: asset.size,
      bytes: asset.bytes,
      usedIn: asset.usedIn,
    });
  });

  return [...byUrl.values()].sort((left, right) => (
    left.folderLabel.localeCompare(right.folderLabel, 'fr') || left.name.localeCompare(right.name, 'fr')
  ));
};

const formatDimensions = (asset) => (
  asset.width && asset.height ? `${asset.width} x ${asset.height}` : 'Dimensions inconnues'
);

const USAGE_KIND_LABELS = {
  scene: ['scene', 'scenes'],
  object: ['objet', 'objets'],
  cinematic: ['cinematic', 'cinematics'],
  animation: ['animation', 'animations'],
};

const formatUsageSummary = (asset) => {
  const counts = (asset.usageKinds || []).reduce((acc, kind) => {
    acc[kind] = (acc[kind] || 0) + 1;
    return acc;
  }, {});
  const parts = Object.entries(counts)
    .map(([kind, count]) => {
      const labels = USAGE_KIND_LABELS[kind] || ['usage', 'usages'];
      return `${count} ${count > 1 ? labels[1] : labels[0]}`;
    });
  return parts.length ? parts.join(', ') : '0 usage';
};

function MediaPreview({ asset }) {
  if (asset.type === 'image') {
    return <img loading="lazy" decoding="async" src={asset.url} alt={asset.name} />;
  }
  if (asset.type === 'video') {
    return <video controls preload="metadata" src={asset.url} />;
  }
  if (asset.type === 'audio') {
    return <audio controls preload="metadata" src={asset.url} />;
  }
  return <span>{asset.type || 'média'}</span>;
}

export default function ProfileMediaTab({
  projects = [],
  mediaLibrary = [],
  onImportMediaFile,
  onDeleteMedia,
  onRefreshStorageUsage,
  storageSummary = null,
  aiCreditBalance = 0,
  onBuyStorage,
  mediaOrganizationKey = 'anonymous',
}) {
  const [activeFolderId, setActiveFolderId] = useState('all');
  const [search, setSearch] = useState('');
  const [storageCreditAmount, setStorageCreditAmount] = useState(100);
  const [newFolderName, setNewFolderName] = useState('');
  const [tagDrafts, setTagDrafts] = useState({});
  const [draggedAssetKey, setDraggedAssetKey] = useState('');
  const [dragOverFolderId, setDragOverFolderId] = useState('');
  const [isImportingDrop, setIsImportingDrop] = useState(false);
  const [collapsedProjectFolders, setCollapsedProjectFolders] = useState({});
  const [visibleMediaLimit, setVisibleMediaLimit] = useState(INITIAL_VISIBLE_MEDIA_LIMIT);
  const [organization, setOrganization] = useState(() => readMediaOrganization(mediaOrganizationKey));
  useEffect(() => {
    setOrganization(readMediaOrganization(mediaOrganizationKey));
  }, [mediaOrganizationKey]);
  useEffect(() => {
    if (storageSummary?.isExact) return;
    onRefreshStorageUsage?.();
  }, [onRefreshStorageUsage, storageSummary?.isExact]);
  const persistOrganization = (updater) => {
    setOrganization((previous) => {
      const next = typeof updater === 'function' ? updater(previous) : updater;
      writeMediaOrganization(mediaOrganizationKey, next);
      return next;
    });
  };
  const media = useMemo(() => collectProfileMedia(projects, mediaLibrary), [mediaLibrary, projects]);
  const storageLabel = `Stockage ${storageSummary?.usedLabel || 'Calcul...'} / ${storageSummary?.quotaLabel || 'quota'}`;
  const decoratedMedia = useMemo(() => media.map((asset) => {
    const assetOrganization = organization.assets?.[asset.orgKey] || {};
    const customFolderIds = compactList(Array.isArray(assetOrganization.folderTags)
      ? assetOrganization.folderTags
      : [assetOrganization.folderId]);
    const customFolderLabels = (organization.folders || [])
      .filter((folder) => customFolderIds.includes(folder.id))
      .map((folder) => folder.label);
    return {
      ...asset,
      customFolderIds,
      customFolderLabels,
      tags: Array.isArray(assetOrganization.tags) ? assetOrganization.tags : [],
    };
  }), [media, organization]);
  const projectFolders = useMemo(() => {
    const byProject = new Map();
    decoratedMedia.forEach((asset) => {
      (asset.projectIds?.length ? asset.projectIds : ['project']).forEach((projectKey, index) => {
        const projectName = asset.projectNames?.[index] || asset.projectNames?.[0] || asset.projectName || 'Projet';
        if (!byProject.has(projectKey)) {
          byProject.set(projectKey, {
            id: makeProjectFilterId(projectKey),
            projectKey,
            label: projectName,
            count: 0,
            categories: new Map(),
          });
        }
        const projectFolder = byProject.get(projectKey);
        projectFolder.count += 1;
        (asset.folderIds || []).forEach((folderId) => {
          const folder = MEDIA_FOLDERS.find((entry) => entry.id === folderId);
          if (!folder) return;
          const currentCategory = projectFolder.categories.get(folderId) || {
            id: makeProjectCategoryFilterId(projectKey, folderId),
            folderId,
            label: folder.label,
            count: 0,
          };
          currentCategory.count += 1;
          projectFolder.categories.set(folderId, currentCategory);
        });
      });
    });
    return [...byProject.values()]
      .sort((left, right) => left.label.localeCompare(right.label, 'fr'))
      .map((projectFolder) => ({
        ...projectFolder,
        categories: [...projectFolder.categories.values()].sort((left, right) => left.label.localeCompare(right.label, 'fr')),
      }));
  }, [decoratedMedia]);
  const customFolders = useMemo(() => (organization.folders || []).map((folder) => ({
    ...folder,
    count: decoratedMedia.filter((asset) => asset.customFolderIds.includes(folder.id)).length,
  })), [decoratedMedia, organization.folders]);
  const visibleMedia = useMemo(() => {
    const query = search.trim().toLowerCase();
    const projectFilter = parseProjectFilterId(activeFolderId);
    return decoratedMedia.filter((asset) => (
      (
        activeFolderId === 'all'
        || asset.folderIds.includes(activeFolderId)
        || asset.customFolderIds.includes(activeFolderId)
        || (
          projectFilter
          && asset.projectIds?.includes(projectFilter.projectKey)
          && (!projectFilter.folderId || asset.folderIds.includes(projectFilter.folderId))
        )
      )
      && (!query || [
        asset.name,
        asset.projectName,
        asset.type,
        ...asset.customFolderLabels,
        ...asset.folderLabels,
        ...asset.usages,
        ...asset.tags,
      ].join(' ').toLowerCase().includes(query))
    ));
  }, [activeFolderId, decoratedMedia, search]);
  useEffect(() => {
    setVisibleMediaLimit(INITIAL_VISIBLE_MEDIA_LIMIT);
  }, [activeFolderId, search]);
  const limitedVisibleMedia = useMemo(
    () => visibleMedia.slice(0, visibleMediaLimit),
    [visibleMedia, visibleMediaLimit],
  );
  const hiddenMediaCount = Math.max(0, visibleMedia.length - limitedVisibleMedia.length);
  const addCustomFolder = () => {
    const label = newFolderName.trim();
    if (!label) return;
    persistOrganization((previous) => ({
      ...previous,
      folders: [
        ...(previous.folders || []),
        { id: `custom_${Date.now().toString(36)}`, label },
      ],
      assets: previous.assets || {},
    }));
    setNewFolderName('');
  };
  const deleteCustomFolder = async (folderId) => {
    const folder = customFolders.find((entry) => entry.id === folderId);
    const confirmed = await showConfirm({
      title: 'Supprimer le dossier',
      message: `Supprimer le dossier "${folder?.label || 'média'}" ? Les assets ne seront pas supprimés.`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;

    persistOrganization((previous) => ({
      ...previous,
      folders: (previous.folders || []).filter((entry) => entry.id !== folderId),
      assets: Object.fromEntries(Object.entries(previous.assets || {}).map(([assetKey, assetConfig]) => ([
        assetKey,
        {
          ...assetConfig,
          folderId: undefined,
          folderTags: (assetConfig.folderTags || []).filter((entry) => entry !== folderId),
        },
      ]))),
    }));
    if (activeFolderId === folderId) setActiveFolderId('all');
  };
  const toggleAssetCustomFolder = (asset, folderId) => {
    persistOrganization((previous) => ({
      ...previous,
      folders: previous.folders || [],
      assets: {
        ...(previous.assets || {}),
        [asset.orgKey]: {
          ...previous.assets?.[asset.orgKey],
          folderId: undefined,
          folderTags: compactList(
            (previous.assets?.[asset.orgKey]?.folderTags || [])
              .includes(folderId)
              ? (previous.assets?.[asset.orgKey]?.folderTags || []).filter((entry) => entry !== folderId)
              : [...(previous.assets?.[asset.orgKey]?.folderTags || []), folderId],
          ),
        },
      },
    }));
  };
  const assignAssetToFolder = (assetKey, folderId) => {
    if (!assetKey || !folderId) return;
    persistOrganization((previous) => ({
      ...previous,
      folders: previous.folders || [],
      assets: {
        ...(previous.assets || {}),
        [assetKey]: {
          ...previous.assets?.[assetKey],
          folderId: undefined,
          folderTags: compactList([
            ...(previous.assets?.[assetKey]?.folderTags || []),
            folderId,
          ]),
        },
      },
    }));
  };
  const handleFolderDrop = async (event, folderId) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverFolderId('');

    const droppedAssetKey = event.dataTransfer.getData('application/x-profile-media-asset') || draggedAssetKey;
    if (droppedAssetKey) {
      assignAssetToFolder(droppedAssetKey, folderId);
      setDraggedAssetKey('');
      return;
    }

    const file = event.dataTransfer.files?.[0];
    if (!file || !onImportMediaFile) return;

    setIsImportingDrop(true);
    try {
      const importedAsset = await onImportMediaFile(file);
      const importedAssetKey = importedAsset?.orgKey || makeStableMediaKey(importedAsset || {});
      assignAssetToFolder(importedAssetKey, folderId);
    } finally {
      setIsImportingDrop(false);
    }
  };
  const saveAssetTags = (asset) => {
    const tags = splitTags(tagDrafts[asset.orgKey] ?? asset.tags.join(', '));
    persistOrganization((previous) => ({
      ...previous,
      folders: previous.folders || [],
      assets: {
        ...(previous.assets || {}),
        [asset.orgKey]: {
          ...previous.assets?.[asset.orgKey],
          tags,
        },
      },
    }));
    setTagDrafts((previous) => ({ ...previous, [asset.orgKey]: tags.join(', ') }));
  };
  const toggleProjectFolderCollapsed = (projectKey) => {
    setCollapsedProjectFolders((previous) => ({
      ...previous,
      [projectKey]: !previous[projectKey],
    }));
  };
  const normalizedStorageCredits = Math.max(0, Math.round(Number(storageCreditAmount || 0)));
  const canBuyCustomStorage = normalizedStorageCredits > 0 && Number(aiCreditBalance || 0) >= normalizedStorageCredits;
  const customStorageLabel = formatCreditStorage(normalizedStorageCredits);

  return (
    <section className="panel profile-media-panel">
      <div className="panel-head">
        <div>
          <h2>Médiathèque</h2>
          <p className="small-note">Tous les médias de tes projets, rangés par dossier et dédoublonnés.</p>
        </div>
        <div className="profile-media-stats">
          {storageSummary ? (
            <span className="status-badge soft">
              {storageLabel}
            </span>
          ) : null}
          <span className="status-badge soft">
            {decoratedMedia.length} fichier{decoratedMedia.length > 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="profile-media-toolbar">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Rechercher un média"
          aria-label="Rechercher un média"
        />
      </div>

      <div className="profile-storage-upgrades" aria-label="Augmenter le stockage">
        <span className="small-note">Crédits disponibles : {aiCreditBalance} · 1 crédit = ~5 Mo</span>
        <label className="profile-storage-custom-input">
          <span>Crédits</span>
          <input
            type="number"
            min="1"
            step="1"
            value={storageCreditAmount}
            onChange={(event) => setStorageCreditAmount(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="secondary-action"
          disabled={!canBuyCustomStorage}
          onClick={() => onBuyStorage?.({
            credits: normalizedStorageCredits,
            bytes: normalizedStorageCredits * STORAGE_MB_PER_CREDIT * 1024 * 1024,
            label: customStorageLabel,
          })}
        >
          Dépenser {normalizedStorageCredits || 0} crédits · {customStorageLabel}
        </button>
      </div>

      <div className="profile-media-browser">
        <aside className="profile-media-sidebar" aria-label="Dossiers par projet">
          <div className="profile-media-sidebar-head">
            <strong>Dossiers</strong>
            <span>{projectFolders.length}</span>
          </div>
          <button
            type="button"
            className={activeFolderId === 'all' ? 'active' : ''}
            onClick={() => setActiveFolderId('all')}
          >
            Tous <span>{decoratedMedia.length}</span>
          </button>
          {projectFolders.length ? projectFolders.map((projectFolder) => (
            <div key={projectFolder.id} className="profile-media-project-folder">
              <div className="profile-media-project-row">
                <button
                  type="button"
                  className="profile-media-project-toggle"
                  aria-label={`${collapsedProjectFolders[projectFolder.projectKey] ? 'Deplier' : 'Replier'} ${projectFolder.label}`}
                  aria-expanded={!collapsedProjectFolders[projectFolder.projectKey]}
                  onClick={() => toggleProjectFolderCollapsed(projectFolder.projectKey)}
                >
                  {collapsedProjectFolders[projectFolder.projectKey] ? '+' : '-'}
                </button>
                <button
                  type="button"
                  className={activeFolderId === projectFolder.id ? 'active' : ''}
                  onClick={() => setActiveFolderId(projectFolder.id)}
                >
                  {projectFolder.label} <span>{projectFolder.count}</span>
                </button>
              </div>
              {!collapsedProjectFolders[projectFolder.projectKey] ? (
                <div className="profile-media-project-categories">
                  {projectFolder.categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={activeFolderId === category.id ? 'active' : ''}
                      onClick={() => setActiveFolderId(category.id)}
                    >
                      {category.label} <span>{category.count}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          )) : (
            <p className="small-note">Aucun projet avec média.</p>
          )}
        </aside>

        {visibleMedia.length ? (
          <div className="profile-media-results">
          <div className="profile-media-grid">
            {limitedVisibleMedia.map((asset) => (
              <article
                key={asset.id}
                className={[
                  'profile-media-card',
                  `profile-media-card--${asset.type}`,
                  draggedAssetKey === asset.orgKey ? 'is-dragging' : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={(event) => {
                  setDraggedAssetKey(asset.orgKey);
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData('application/x-profile-media-asset', asset.orgKey);
                  event.dataTransfer.setData('text/plain', asset.name);
                }}
                onDragEnd={() => {
                  setDraggedAssetKey('');
                  setDragOverFolderId('');
                }}
              >
                <div className="profile-media-preview">
                  <MediaPreview asset={asset} />
                </div>
                <div className="profile-media-meta">
                  <strong title={asset.name}>{asset.name}</strong>
                  <span>{asset.folderLabels.join(', ')}</span>
                  {asset.customFolderLabels.length ? <small>Dossiers: {asset.customFolderLabels.join(', ')}</small> : null}
                  {asset.tags.length ? <small>Tags: {asset.tags.join(', ')}</small> : null}
                  <small>{asset.type === 'image' ? formatDimensions(asset) : asset.type}</small>
                  <em title={asset.usages.join('\n')}>
                    {asset.usages.length ? `Utilise dans ${formatUsageSummary(asset)}` : 'Inactif - 0 usage'}
                  </em>
                  {customFolders.length ? (
                    <div className="profile-media-folder-tags" aria-label={`Dossiers personnalisés pour ${asset.name}`}>
                      {customFolders.map((folder) => {
                        const isSelected = asset.customFolderIds.includes(folder.id);
                        return (
                          <button
                            key={folder.id}
                            type="button"
                            className={isSelected ? 'active' : ''}
                            onClick={() => toggleAssetCustomFolder(asset, folder.id)}
                          >
                            {folder.label}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="profile-media-tags-row">
                    <input
                      type="text"
                      value={tagDrafts[asset.orgKey] ?? asset.tags.join(', ')}
                      onChange={(event) => setTagDrafts((previous) => ({
                        ...previous,
                        [asset.orgKey]: event.target.value,
                      }))}
                      placeholder="tags, separes, par virgules"
                      aria-label={`Tags pour ${asset.name}`}
                    />
                    <button type="button" className="secondary-action" onClick={() => saveAssetTags(asset)}>
                      Tags
                    </button>
                  </div>
                  <button type="button" className="danger-button profile-media-delete" onClick={() => onDeleteMedia?.(asset)}>
                    Supprimer
                  </button>
                </div>
              </article>
            ))}
          </div>
          {hiddenMediaCount ? (
            <button
              type="button"
              className="secondary-action profile-media-load-more"
              onClick={() => setVisibleMediaLimit((limit) => limit + VISIBLE_MEDIA_INCREMENT)}
            >
              Afficher {Math.min(VISIBLE_MEDIA_INCREMENT, hiddenMediaCount)} média{hiddenMediaCount > 1 ? 's' : ''} de plus
            </button>
          ) : null}
          </div>
        ) : (
          <div className="empty-state-inline">
            <div>
              <strong>Aucun média</strong>
              <p className="small-note">Les images, musiques et sons ajoutés dans tes projets apparaîtront ici.</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
