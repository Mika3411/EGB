import React, { useEffect, useId, useRef } from 'react';
import { Image as ImageIcon, Upload, X } from 'lucide-react';

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
        <div className="media-source-head">
          <div className="media-source-title">
            <h3 id={titleId}>Importer depuis</h3>
            <p className="small-note">Choisis un média déjà présent ou ajoute un fichier depuis ton ordinateur.</p>
          </div>
          <button type="button" className="media-source-close" onClick={onClose} aria-label="Fermer l'import">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="media-source-actions" aria-label="Sources d'import">
          <button type="button" className="media-source-choice is-primary" onClick={onOpenComputer}>
            <span className="media-source-choice-icon"><Upload size={20} aria-hidden="true" /></span>
            <span>
              <strong>Mon ordinateur</strong>
              <small>Importer un fichier local</small>
            </span>
          </button>
          <div className={`media-source-choice ${libraryItems.length ? '' : 'is-disabled'}`} aria-disabled={!libraryItems.length}>
            <span className="media-source-choice-icon"><ImageIcon size={20} aria-hidden="true" /></span>
            <span>
              <strong>Médiathèque</strong>
              <small>{libraryItems.length ? `${libraryItems.length} média disponible${libraryItems.length > 1 ? 's' : ''}` : 'Aucun média disponible'}</small>
            </span>
          </div>
        </div>
        <div className="media-source-dropzone">
          <Upload size={22} aria-hidden="true" />
          <strong>{isDraggingFile ? 'Relâche pour importer' : 'Dépose un fichier ici'}</strong>
          <span>Glisse un média dans cette fenêtre.</span>
        </div>
        {libraryItems.length ? (
          <>
            <div className="media-source-library-head">
              <strong>Médiathèque</strong>
              <span>{libraryItems.length} élément{libraryItems.length > 1 ? 's' : ''}</span>
            </div>
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
          </>
        ) : (
          <div className="empty-state-inline">Aucun média compatible dans la médiathèque.</div>
        )}
      </div>
    </div>
  );
}
