import React from 'react';
import { THUMBNAIL_CROPS } from '../../utils/thumbnailProcessor';

export default function ThumbnailCropper({
  thumbnailCrop,
  thumbnailCropMode,
  thumbnailZoom,
  thumbnailPan,
  isThumbnailBusy,
  onClose,
  onCropModeChange,
  onZoomChange,
  onPanChange,
  onConfirm,
}) {
  if (!thumbnailCrop) return null;

  return (
    <div className="thumbnail-crop-overlay" role="dialog" aria-modal="true" aria-label="Recadrer la miniature">
      <div className="thumbnail-crop-panel">
        <div className="panel-head">
          <div>
            <h3>Recadrer la miniature</h3>
            <p className="small-note">Choisis un format propre avant publication.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>Fermer</button>
        </div>
        <div className={`thumbnail-crop-preview ${thumbnailCropMode}`}>
          <img
            src={thumbnailCrop.src}
            alt=""
            style={{
              transform: `translate(${thumbnailPan.x / 3}%, ${thumbnailPan.y / 3}%) scale(${thumbnailZoom})`,
            }}
          />
        </div>
        <div className="thumbnail-crop-controls">
          <div className="segmented-control compact">
            {Object.entries(THUMBNAIL_CROPS).map(([value, crop]) => (
              <button
                key={value}
                type="button"
                className={thumbnailCropMode === value ? 'active' : ''}
                onClick={() => onCropModeChange(value)}
              >
                {crop.label}
              </button>
            ))}
          </div>
          <label>
            Zoom
            <input type="range" min="1" max="3" step="0.05" value={thumbnailZoom} onChange={(event) => onZoomChange(Number(event.target.value))} />
          </label>
          <div className="grid-two small-gap">
            <label>
              Horizontal
              <input type="range" min="-100" max="100" step="1" value={thumbnailPan.x} onChange={(event) => onPanChange({ ...thumbnailPan, x: Number(event.target.value) })} />
            </label>
            <label>
              Vertical
              <input type="range" min="-100" max="100" step="1" value={thumbnailPan.y} onChange={(event) => onPanChange({ ...thumbnailPan, y: Number(event.target.value) })} />
            </label>
          </div>
          <button type="button" className="profile-publish-button" onClick={onConfirm} disabled={isThumbnailBusy}>
            {isThumbnailBusy ? 'Enregistrement...' : 'Valider la miniature'}
          </button>
        </div>
      </div>
    </div>
  );
}
