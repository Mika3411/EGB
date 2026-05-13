export default function AiImageWorkbench({
  imagePreview = null,
  imageCompare = null,
  onClosePreview,
  onCloseCompare,
  onOpenPreview,
  onDownloadImage,
  onSelectImageVariant,
}) {
  return (
    <>
      {imagePreview ? (
        <div className="ai-image-preview-overlay" role="dialog" aria-modal="true" onClick={onClosePreview}>
          <div className="ai-image-preview-modal" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="secondary-action" onClick={onClosePreview}>Fermer</button>
            <img src={imagePreview.src} alt={imagePreview.name || 'Apercu'} />
            <strong>{imagePreview.name || 'Apercu'}</strong>
            <button type="button" className="secondary-action" onClick={() => onDownloadImage(imagePreview.src, imagePreview.name || 'image.png')}>Telecharger</button>
          </div>
        </div>
      ) : null}
      {imageCompare ? (
        <div className="ai-image-preview-overlay" role="dialog" aria-modal="true" onClick={onCloseCompare}>
          <div className="ai-image-compare-modal" onClick={(event) => event.stopPropagation()}>
            <div className="ai-compare-head">
              <strong>{imageCompare.title}</strong>
              <button type="button" className="secondary-action" onClick={onCloseCompare}>Fermer</button>
            </div>
            <div className="ai-compare-grid">
              {imageCompare.variants.map((variant, index) => {
                const selected = variant.imageData === imageCompare.activeImageData;
                return (
                  <article key={variant.id || variant.imageData} className={selected ? 'selected' : ''}>
                    <button type="button" className="ai-compare-image-button" onClick={() => {
                      onCloseCompare();
                      onOpenPreview({ src: variant.imageData, name: variant.imageName || imageCompare.title });
                    }}>
                      <img src={variant.imageData} alt={variant.label || `Image ${index + 1}`} />
                    </button>
                    <span>{variant.label || `Image ${index + 1}`}</span>
                    <div>
                      <button type="button" className="secondary-action" disabled={selected} onClick={() => onSelectImageVariant(variant)}>
                        {selected ? 'Selectionnee' : 'Choisir'}
                      </button>
                      <button type="button" className="secondary-action" onClick={() => onDownloadImage(variant.imageData, variant.imageName || `${imageCompare.title}-${index + 1}.png`)}>
                        Telecharger
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
