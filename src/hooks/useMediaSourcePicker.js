import { useCallback, useMemo, useRef, useState } from 'react';

export const acceptToMediaType = (accept = '') => {
  if (accept.includes('image')) return 'image';
  if (accept.includes('audio')) return 'audio';
  if (accept.includes('video')) return 'video';
  return '';
};

export const matchesAssetScope = (asset = {}, scope = '') => {
  if (!scope) return true;
  if (scope === 'scene-background') {
    return asset.meta?.role === 'background' || /^asset_scene_.*_background$/.test(asset.id || '');
  }
  if (scope === 'scene-music') {
    return asset.meta?.role === 'music' || /^asset_scene_.*_music$/.test(asset.id || '');
  }
  if (scope === 'scene-ambient') {
    return asset.meta?.role === 'ambientSound' || /^asset_scene_.*_ambient$/.test(asset.id || '');
  }
  return true;
};

export function useMediaSourcePicker({
  accept = '',
  assetScope = '',
  handleUpload,
  mediaLibrary = [],
  onSelect,
} = {}) {
  const inputRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const mediaType = acceptToMediaType(accept);
  const libraryItems = useMemo(() => (
    mediaLibrary.filter((asset) => (
      asset.url
      && (!mediaType || asset.type === mediaType)
      && matchesAssetScope(asset, assetScope)
    ))
  ), [assetScope, mediaLibrary, mediaType]);

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
    onSelect?.(asset.url, asset.name || asset.id || 'media');
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
