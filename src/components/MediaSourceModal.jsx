import React, { useEffect, useId, useRef } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function MediaSourceModal({
  isDraggingFile = false,
  libraryItems = [],
  onClose,
  onDragStateChange,
  onDropFile,
  onOpenComputer,
  onSelectLibraryAsset,
}) {
  const titleId = useId();
  const panelRef = useRef(null);
  const restoreFocusRef = useRef(null);

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusable = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
    if (focusable instanceof HTMLElement) {
      focusable.focus();
    } else {
      panelRef.current?.focus();
    }
    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose?.();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
      .filter((element) => element instanceof HTMLElement && !element.hasAttribute('disabled'));
    if (!focusableElements.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="media-source-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={panelRef}
        className={`media-source-panel ${isDraggingFile ? 'is-dragging-file' : ''}`}
        tabIndex={-1}
        onDragEnter={(event) => {
          event.preventDefault();
          if (event.dataTransfer?.types?.includes('Files')) onDragStateChange?.(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) onDragStateChange?.(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          onDropFile?.(event.dataTransfer.files?.[0]);
        }}
      >
        <div className="panel-head">
          <div>
            <h3 id={titleId}>Importer depuis</h3>
            <p className="small-note">Choisis un média déjà présent ou ajoute un fichier depuis ton ordinateur.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>Fermer</button>
        </div>
        <div className="media-source-actions">
          <button type="button" onClick={onOpenComputer}>Mon ordinateur</button>
          <button type="button" className="secondary-action" disabled={!libraryItems.length}>
            Médiathèque
          </button>
        </div>
        <div className="media-source-dropzone">
          Depose un fichier ici
        </div>
        {libraryItems.length ? (
          <div className="media-source-grid">
            {libraryItems.map((asset) => (
              <button key={asset.id || asset.url} type="button" onClick={() => onSelectLibraryAsset?.(asset)}>
                <span className="media-source-thumb">
                  {asset.type === 'image' ? <img src={asset.url} alt="" /> : <strong>{asset.type}</strong>}
                </span>
                <span title={asset.name || asset.id}>{asset.name || asset.id || 'Média'}</span>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state-inline">Aucun média compatible dans la médiathèque.</div>
        )}
      </div>
    </div>
  );
}
