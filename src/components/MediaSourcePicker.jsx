import React from 'react';
import { useMediaSourcePicker } from '../hooks/useMediaSourcePicker';
import MediaSourceModal from './MediaSourceModal.jsx';

export default function MediaSourcePicker({
  accept,
  assetScope = '',
  children,
  className = 'button like secondary-action',
  handleUpload,
  mediaLibrary = [],
  onSelect,
  tourId,
}) {
  const picker = useMediaSourcePicker({
    accept,
    assetScope,
    handleUpload,
    mediaLibrary,
    onSelect,
  });

  return (
    <>
      <button type="button" className={className} data-tour={tourId} onClick={picker.openPicker}>
        {children}
      </button>
      <input {...picker.inputProps} />
      {picker.isOpen ? (
        <MediaSourceModal
          isDraggingFile={picker.isDraggingFile}
          libraryItems={picker.libraryItems}
          onClose={picker.closePicker}
          onDragStateChange={picker.setIsDraggingFile}
          onDropFile={picker.importDroppedFile}
          onOpenComputer={picker.openComputer}
          onSelectLibraryAsset={picker.selectLibraryAsset}
        />
      ) : null}
    </>
  );
}
