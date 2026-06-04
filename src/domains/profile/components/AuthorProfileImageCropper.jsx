import React, { useRef, useState } from 'react';
import { RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { AUTHOR_MEDIA_TARGETS } from '../../../shared/utils/authorProfileMedia';

const clampPan = (value) => Number(Math.max(-100, Math.min(100, Number(value) || 0)).toFixed(2));
const clampZoom = (value) => Math.max(1, Math.min(3, Number(value) || 1));
const formatPercent = (value) => `${Number(value.toFixed(4))}%`;
const formatCalcOffset = (value) => {
  if (Math.abs(value) < 0.0001) return '50%';
  const sign = value < 0 ? '-' : '+';
  return `calc(50% ${sign} ${formatPercent(Math.abs(value))})`;
};

const getPreviewMetrics = ({ imageAspect, targetAspect, zoom }) => {
  const baseWidth = imageAspect > targetAspect ? (imageAspect / targetAspect) * 100 : 100;
  const baseHeight = imageAspect > targetAspect ? 100 : (targetAspect / imageAspect) * 100;
  const width = baseWidth * zoom;
  const height = baseHeight * zoom;
  return {
    width,
    height,
    overflowX: Math.max(0, (width - 100) / 2),
    overflowY: Math.max(0, (height - 100) / 2),
  };
};

const clampPanForMetrics = (pan, metrics) => ({
  x: metrics.overflowX > 0 ? clampPan(pan.x) : 0,
  y: metrics.overflowY > 0 ? clampPan(pan.y) : 0,
});

export default function AuthorProfileImageCropper({
  imageCrop,
  cropZoom,
  cropPan,
  isCropBusy,
  onClose,
  onZoomChange,
  onPanChange,
  onConfirm,
}) {
  const dragRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);

  if (!imageCrop) return null;

  const target = AUTHOR_MEDIA_TARGETS[imageCrop.field] || AUTHOR_MEDIA_TARGETS.avatar;
  const label = target.label || 'Image';
  const previewClass = imageCrop.field === 'banner' ? 'author-banner' : 'author-avatar';
  const imageAspect = Math.max(1, Number(imageCrop.width) || target.width) / Math.max(1, Number(imageCrop.height) || target.height);
  const safeZoom = clampZoom(cropZoom);
  const previewMetrics = getPreviewMetrics({ imageAspect, targetAspect: target.aspect, zoom: safeZoom });
  const safePan = clampPanForMetrics(cropPan, previewMetrics);
  const imageOffsetX = (safePan.x / 100) * previewMetrics.overflowX;
  const imageOffsetY = (safePan.y / 100) * previewMetrics.overflowY;

  const startDrag = (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: safePan,
      width: Math.max(1, rect.width),
      height: Math.max(1, rect.height),
      overflowX: previewMetrics.overflowX,
      overflowY: previewMetrics.overflowY,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setIsDragging(true);
    event.preventDefault();
  };

  const moveDrag = (event) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const nextX = drag.overflowX > 0
      ? drag.startPan.x + (((event.clientX - drag.startX) / drag.width) * 10000) / drag.overflowX
      : 0;
    const nextY = drag.overflowY > 0
      ? drag.startPan.y + (((event.clientY - drag.startY) / drag.height) * 10000) / drag.overflowY
      : 0;
    onPanChange({
      x: drag.overflowX > 0 ? clampPan(nextX) : 0,
      y: drag.overflowY > 0 ? clampPan(nextY) : 0,
    });
  };

  const stopDrag = (event) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    dragRef.current = null;
    setIsDragging(false);
  };

  const adjustZoom = (delta) => {
    const nextZoom = Number(clampZoom(safeZoom + delta).toFixed(2));
    const nextMetrics = getPreviewMetrics({ imageAspect, targetAspect: target.aspect, zoom: nextZoom });
    onZoomChange(nextZoom);
    onPanChange(clampPanForMetrics(safePan, nextMetrics));
  };

  const resetCrop = () => {
    onZoomChange(1);
    onPanChange({ x: 0, y: 0 });
  };

  return (
    <div className="thumbnail-crop-overlay" role="dialog" aria-modal="true" aria-label={`Recadrer ${label.toLowerCase()}`}>
      <div className="thumbnail-crop-panel author-profile-crop-panel">
        <div className="panel-head">
          <div>
            <h3>Recadrer {label.toLowerCase()}</h3>
            <p className="small-note">Ajuste le zoom et la position avant d’enregistrer l’image.</p>
          </div>
          <button type="button" className="secondary-action" onClick={onClose}>Fermer</button>
        </div>
        <div
          className={`thumbnail-crop-preview ${previewClass} is-draggable${isDragging ? ' is-dragging' : ''}`}
          role="application"
          aria-label="Faire glisser pour recadrer"
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={stopDrag}
          onPointerCancel={stopDrag}
        >
          <img
            src={imageCrop.src}
            alt=""
            style={{
              width: formatPercent(previewMetrics.width),
              height: formatPercent(previewMetrics.height),
              left: formatCalcOffset(imageOffsetX),
              top: formatCalcOffset(imageOffsetY),
              transform: 'translate(-50%, -50%)',
            }}
          />
        </div>
        <div className="thumbnail-crop-controls author-profile-crop-controls">
          <div className="author-crop-tool-buttons" aria-label="Zoom et cadrage">
            <button type="button" className="secondary-action" onClick={() => adjustZoom(-0.1)} disabled={safeZoom <= 1} aria-label="Dézoomer" title="Dézoomer">
              <ZoomOut size={17} aria-hidden="true" />
            </button>
            <button type="button" className="secondary-action" onClick={() => adjustZoom(0.1)} disabled={cropZoom >= 3} aria-label="Zoomer" title="Zoomer">
              <ZoomIn size={17} aria-hidden="true" />
            </button>
            <button type="button" className="secondary-action" onClick={resetCrop} aria-label="Réinitialiser le cadrage" title="Réinitialiser">
              <RotateCcw size={17} aria-hidden="true" />
            </button>
          </div>
          <button type="button" className="profile-publish-button" onClick={onConfirm} disabled={isCropBusy}>
            {isCropBusy ? 'Enregistrement...' : `Valider ${label.toLowerCase()}`}
          </button>
        </div>
      </div>
    </div>
  );
}
