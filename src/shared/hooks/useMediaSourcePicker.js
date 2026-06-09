import { useCallback, useMemo, useRef, useState } from 'react';
import { getAssetFolderIds } from '../services/mediaLibraryFolders';
import {
  REMOTE_URL_PATTERN,
  getKnownAssetByteSize,
  getKnownAssetDuplicateName,
  getKnownDuplicateMediaKey,
  getReferenceDuplicateMediaKey,
  getRemoteAssetDedupeKey,
  normalizeDuplicateMediaName,
} from '../utils/mediaDedupe';

export const acceptToMediaType = (accept = '') => {
  if (accept.includes('image')) return 'image';
  if (accept.includes('audio')) return 'audio';
  if (accept.includes('video')) return 'video';
  return '';
};

const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|ogg|m4a|aac|flac|opus|webm)(?:[?#].*)?$/i;
const IMAGE_EXTENSION_PATTERN = /\.(png|jpe?g|webp|gif|svg|avif)(?:[?#].*)?$/i;
const VIDEO_EXTENSION_PATTERN = /\.(mp4|webm|mov|m4v|avi)(?:[?#].*)?$/i;

const getAssetText = (asset = {}) => `${asset.url || ''} ${asset.name || ''}`;

export const assetMatchesMediaType = (asset = {}, mediaType = '') => {
  if (!mediaType) return true;
  if (asset.type === mediaType) return true;

  const text = getAssetText(asset);
  if (mediaType === 'audio') return AUDIO_EXTENSION_PATTERN.test(text) || /^data:audio\//i.test(asset.url || '');
  if (mediaType === 'image') return IMAGE_EXTENSION_PATTERN.test(text) || /^data:image\//i.test(asset.url || '');
  if (mediaType === 'video') return VIDEO_EXTENSION_PATTERN.test(text) || /^data:video\//i.test(asset.url || '');
  return false;
};

const getLibraryUrlDedupeValue = (url = '') => {
  const value = String(url || '').trim();
  return REMOTE_URL_PATTERN.test(value) ? getRemoteAssetDedupeKey(value) || value : value;
};

const getReferenceNameDedupeKey = (asset = {}, type = '') => {
  const name = getKnownAssetDuplicateName(asset);
  const isRemote = REMOTE_URL_PATTERN.test(String(asset.url || '').trim());
  if (isRemote) {
    return getReferenceDuplicateMediaKey({ mediaType: type, name });
  }
  if (type === 'audio' || type === 'video') {
    return getReferenceDuplicateMediaKey({ mediaType: type, name, requireFileName: false });
  }
  return '';
};

const getLibraryDedupeKeys = (asset = {}, mediaType = '') => {
  const type = mediaType || asset.type || 'unknown';
  const normalizedName = normalizeDuplicateMediaName(getKnownAssetDuplicateName(asset));
  const knownMediaKey = getKnownDuplicateMediaKey({
    mediaType: type,
    name: getKnownAssetDuplicateName(asset),
    byteSize: getKnownAssetByteSize(asset),
  });
  const keys = [
    `url:${type}:${getLibraryUrlDedupeValue(asset.url) || asset.id || normalizedName}`,
    knownMediaKey,
    knownMediaKey ? '' : getReferenceNameDedupeKey(asset, type),
  ].filter(Boolean);
  return keys.length ? keys : [`asset:${type}:${asset.id || normalizedName}`];
};

export const dedupeLibraryItems = (items = [], mediaType = '') => {
  const seen = new Set();
  return items.filter((asset) => {
    const keys = getLibraryDedupeKeys(asset, mediaType);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
};

export const matchesAssetScope = (asset = {}, scope = '') => {
  if (!scope) return true;
  if (scope === 'scene-background') {
    return assetMatchesMediaType(asset, 'image')
      && getAssetFolderIds(asset).includes('scene-images');
  }
  if (scope === 'scene-music') {
    return assetMatchesMediaType(asset, 'audio')
      || asset.meta?.role === 'music'
      || /^asset_scene_.*_music$/.test(asset.id || '');
  }
  if (scope === 'scene-ambient') {
    return assetMatchesMediaType(asset, 'audio')
      || asset.meta?.role === 'ambientSound'
      || /^asset_scene_.*_ambient$/.test(asset.id || '');
  }
  if (scope === 'object-image' || scope === 'enigma-image' || scope === 'decor3d-texture') {
    return assetMatchesMediaType(asset, 'image')
      && getAssetFolderIds(asset).includes('object-images');
  }
  if (scope === 'cinematic-image') {
    return assetMatchesMediaType(asset, 'image')
      && getAssetFolderIds(asset).includes('cinematic-images');
  }
  if (scope === 'animation-image') {
    return assetMatchesMediaType(asset, 'image')
      && getAssetFolderIds(asset).includes('animation-images');
  }
  if (scope === 'object-sound' || scope === 'cinematic-audio' || scope === 'logic-sound') {
    return assetMatchesMediaType(asset, 'audio');
  }
  if (scope === 'cinematic-video') {
    return assetMatchesMediaType(asset, 'video');
  }
  return true;
};

export const assetMatchesProject = (asset = {}, projectId = '') => {
  if (!projectId) return true;
  const projectIds = [
    asset.projectId,
    asset.projectKey,
    ...(Array.isArray(asset.projectIds) ? asset.projectIds : []),
  ].filter(Boolean).map(String);
  return !projectIds.length || projectIds.includes(String(projectId));
};

export const filterLibraryItems = (mediaLibrary = [], {
  assetScope = '',
  mediaType = '',
  projectId = '',
} = {}) => dedupeLibraryItems(mediaLibrary.filter((asset) => (
  asset.url
  && assetMatchesMediaType(asset, mediaType)
  && matchesAssetScope(asset, assetScope)
  && assetMatchesProject(asset, projectId)
)), mediaType);

export function useMediaSourcePicker({
  accept = '',
  assetScope = '',
  handleUpload,
  mediaLibrary = [],
  onSelect,
  projectId = '',
} = {}) {
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const mediaType = acceptToMediaType(accept);
  const libraryItems = useMemo(() => (
    filterLibraryItems(mediaLibrary, { assetScope, mediaType, projectId })
  ), [assetScope, mediaLibrary, mediaType, projectId]);

  const openPicker = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setIsDraggingFile(false);
    setIsOpen(false);
  }, []);

  const openComputer = useCallback(() => {
    closePicker();
    window.setTimeout(() => inputRef.current?.click(), 0);
  }, [closePicker]);

  const selectLibraryAsset = useCallback((asset) => {
    if (!asset?.url) return;
    onSelect?.(asset.url, asset.name || asset.id || 'media', asset);
    closePicker();
  }, [closePicker, onSelect]);

  const importDroppedFile = useCallback((file) => {
    if (!file || !inputRef.current) return;
    if (mediaType && !file.type?.startsWith(`${mediaType}/`)) {
      setIsDraggingFile(false);
      return;
    }
    handleUpload?.({ target: { files: [file], value: '' } }, onSelect);
    closePicker();
  }, [closePicker, handleUpload, mediaType, onSelect]);

  const inputProps = {
    ref: inputRef,
    type: 'file',
    accept,
    hidden: true,
    onChange: (event) => handleUpload?.(event, onSelect),
  };

  return {
    closePicker,
    importDroppedFile,
    inputProps,
    isDraggingFile,
    isOpen,
    libraryItems,
    mediaType,
    openComputer,
    openPicker,
    selectLibraryAsset,
    setIsDraggingFile,
  };
}
