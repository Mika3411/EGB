const noop = () => {};
const fallbackFormatCreditCost = (value) => `${Number(value) || 0} crédit(s)`;
const FallbackHelpLabel = ({ children }) => <label>{children}</label>;

function AiDraftFrame({ isEmpty = false, children }) {
  return (
    <div className="ai-narrative-preview" data-tour={isEmpty ? undefined : 'ai-result-preview'}>
      {children}
    </div>
  );
}

function AiDraftEmptyState() {
  return (
    <>
      <div className="empty-state-inline">Aucun résultat narratif pour le moment.</div>
      <section className="combo-card ai-image-empty-panel" data-tour="ai-images-info">
        <span className="section-kicker">Images à la demande</span>
        <h3>Scènes et objets</h3>
        <p className="small-note">
          Génère d'abord le récit ou améliore une scène. Les boutons d'image apparaîtront ensuite sur chaque scène et chaque objet.
        </p>
        <div className="ai-disabled-actions">
          <button type="button" className="secondary-action" disabled>Générer l'image de cette scène</button>
          <button type="button" className="secondary-action" disabled>Générer l'image de cet objet</button>
          <button type="button" className="secondary-action" disabled>Régénérer uniquement cette image</button>
        </div>
      </section>
    </>
  );
}

function AiScenePreviewCard({
  scene,
  isChoiceAdventureAi,
  HelpLabel,
  FIELD_HELP,
  patchGeneratedScene,
  getSceneVisualConstraints,
  updateSceneVisualConstraints,
  generatingImageKey,
  canRunImageAi,
  generateSceneImage,
  formatCreditCost,
  getAiCreditCost,
  openImageCompare,
}) {
  const sceneImageKey = `scène:${scene.id}`;

  return (
    <article className="ai-narrative-card">
      {scene.backgroundData ? (
        <img className="ai-generated-image-preview" src={scene.backgroundData} alt={scene.name} />
      ) : null}
      <strong>{scene.name}</strong>
      {scene.introText ? <p>{scene.introText}</p> : null}
      {isChoiceAdventureAi ? (
        <>
          <HelpLabel className="ai-visual-label" help={FIELD_HELP.imagePrompt}>Prompt image scène</HelpLabel>
          <textarea
            className="ai-image-prompt"
            value={scene.imagePrompt || ''}
            onChange={(event) => patchGeneratedScene(scene.id, { imagePrompt: event.target.value })}
            placeholder="Prompt image généré par l'IA pour cette scène."
          />
        </>
      ) : null}
      <HelpLabel className="ai-visual-label" help={FIELD_HELP.visualConstraints}>Contraintes visuelles de la scène</HelpLabel>
      <textarea
        className="ai-visual-constraints"
        data-tour="ai-scene-visual-constraints"
        value={getSceneVisualConstraints(scene)}
        onChange={(event) => updateSceneVisualConstraints(scene.id, event.target.value)}
        placeholder={[
          '- une porte à droite',
          '- une table au centre',
          "- une cachette ou un support visible, sans objet d'inventaire",
          '- une fenêtre à gauche',
        ].join('\n')}
      />
      <button
        type="button"
        className="secondary-action ai-image-action"
        data-tour="ai-scene-image-button"
        disabled={generatingImageKey === sceneImageKey || !canRunImageAi}
        onClick={() => generateSceneImage(scene)}
      >
        {generatingImageKey === sceneImageKey ?
           'Génération...'
          : `${scene.backgroundData ? 'Régénérer uniquement cette image' : "Générer l'image de cette scène"} · ${formatCreditCost(getAiCreditCost('image'))}`}
      </button>
      {scene.aiImageVariants?.length > 1 ? (
        <button
          type="button"
          className="secondary-action ai-image-action"
          onClick={() => openImageCompare({
            type: 'scene',
            id: scene.id,
            title: scene.name,
            activeImageData: scene.backgroundData,
            variants: scene.aiImageVariants,
          })}
        >
          Comparer les images ({scene.aiImageVariants.length})
        </button>
      ) : null}
      {scene.backgroundData && scene.hotspots?.length ? (
        <p className="ai-placement-note">Zones préplacées automatiquement. Validation visuelle rapide dans l'éditeur après application.</p>
      ) : null}
      {scene.aiVisualElements?.length ? (
        <div className="ai-elements-list">
          {scene.aiVisualElements.slice(0, 6).map((element) => (
            <span key={element.id || element.label}>
              {element.label || element.id}: {Math.round(Number(element.x) || 0)}%, {Math.round(Number(element.y) || 0)}%
            </span>
          ))}
        </div>
      ) : null}
      {scene.hotspots?.length ? (
        <div className="ai-dialogue-list">
          {scene.hotspots.slice(0, 5).map((hotspot) => (
            <p key={hotspot.id}>
              <span>{hotspot.name || 'Zone'}</span>
              {hotspot.dialogue || 'Interaction sans dialogue.'}
            </p>
          ))}
        </div>
      ) : null}
    </article>
  );
}

function AiItemPreviewCard({
  item,
  isChoiceAdventureAi,
  isHeroAdventureAi,
  HelpLabel,
  FIELD_HELP,
  getItemFallbackIcon,
  isTechnicalItemName,
  getHeroItemPreviewLabel,
  patchGeneratedItem,
  renameGeneratedItem,
  generatingImageKey,
  canRunObjectImageAi,
  canRunObjectThumbnailAi,
  generateItemImage,
  formatCreditCost,
  getAiCreditCost,
  openImageCompare,
  onOpenImagePreview,
}) {
  const fullImageKey = `item:full:${item.id}`;
  const thumbnailImageKey = `item:thumbnail:${item.id}`;

  return (
    <article className="ai-object-card">
      {item.imageData ? (
        <button
          type="button"
          className="ai-object-preview-button"
          onClick={() => onOpenImagePreview({ src: item.imageData, name: item.name })}
          title="Aperçu de l'image"
        >
          <img src={item.imageData} alt={item.name} />
        </button>
      ) : (
        <span>{getItemFallbackIcon(item)}</span>
      )}
      <input
        className="ai-object-name-input"
        value={isTechnicalItemName(item.name) ? '' : item.name}
        onChange={(event) => patchGeneratedItem(item.id, { name: event.target.value })}
        onBlur={(event) => renameGeneratedItem(item.id, event.target.value)}
        placeholder="Nom de l'objet"
      />
      {isHeroAdventureAi && getHeroItemPreviewLabel(item) ? (
        <small className="inventory-item-badge">{getHeroItemPreviewLabel(item)}</small>
      ) : null}
      {isChoiceAdventureAi ? (
        <>
          <HelpLabel className="ai-visual-label" help={FIELD_HELP.imagePrompt}>Prompt image objet</HelpLabel>
          <textarea
            className="ai-image-prompt"
            value={item.imagePrompt || ''}
            onChange={(event) => patchGeneratedItem(item.id, { imagePrompt: event.target.value })}
            placeholder="Prompt image généré par l'IA pour cet objet."
          />
        </>
      ) : null}
      <button
        type="button"
        className="secondary-action ai-image-action"
        disabled={generatingImageKey === fullImageKey || !canRunObjectImageAi}
        onClick={() => generateItemImage(item)}
      >
        {generatingImageKey === fullImageKey ?
           'Génération...'
          : `${item.imageData ? "Régénérer l'image détaillée" : 'Générer image détaillée'} · ${formatCreditCost(getAiCreditCost('objectImage'))}`}
      </button>
      <button
        type="button"
        className="secondary-action ai-image-action"
        disabled={generatingImageKey === thumbnailImageKey || !canRunObjectThumbnailAi}
        onClick={() => generateItemImage(item, 'thumbnail')}
      >
        {generatingImageKey === thumbnailImageKey ?
           'Génération...'
          : `${item.imageData ? (isChoiceAdventureAi ? 'Régénérer miniature' : 'Régénérer miniature économique') : (isChoiceAdventureAi ? 'Générer miniature' : 'Générer miniature économique')} · ${formatCreditCost(getAiCreditCost('objectThumbnail'))}`}
      </button>
      {item.aiImageVariants?.length > 1 ? (
        <button
          type="button"
          className="secondary-action ai-image-action"
          onClick={() => openImageCompare({
            type: 'item',
            id: item.id,
            title: item.name,
            activeImageData: item.imageData,
            variants: item.aiImageVariants,
          })}
        >
          Comparer les images ({item.aiImageVariants.length})
        </button>
      ) : null}
    </article>
  );
}

function AiCinematicPreviewCard({
  cinematic,
  isChoiceAdventureAi,
  HelpLabel,
  FIELD_HELP,
  patchGeneratedCinematicSlide,
  generatingImageKey,
  canRunImageAi,
  generateCinematicImage,
  formatCreditCost,
  getAiCreditCost,
  openImageCompare,
  onOpenImagePreview,
}) {
  const slides = cinematic.slides?.length ? cinematic.slides : [{ id: `${cinematic.id}-slide-1`, narration: 'Cinématique sans narration.' }];

  return (
    <article className="ai-cinematic-card">
      <strong>{cinematic.name}</strong>
      <div className="ai-cinematic-slide-list">
        {slides.map((slide, index) => {
          const imageKey = `cinematic:${cinematic.id}:${slide.id}`;
          return (
            <div key={slide.id || index} className="ai-cinematic-slide-card">
              {slide.imageData ? (
                <button
                  type="button"
                  className="ai-cinematic-preview-button"
                  onClick={() => onOpenImagePreview({ src: slide.imageData, name: `${cinematic.name} - image ${index + 1}` })}
                  title="Aperçu de l'image"
                >
                  <img src={slide.imageData} alt={`${cinematic.name} - image ${index + 1}`} />
                </button>
              ) : (
                <span>Image {index + 1}</span>
              )}
              <p>{slide.narration || `Prompt cinématique ${index + 1}`}</p>
              {isChoiceAdventureAi ? (
                <>
                  <HelpLabel className="ai-visual-label" help={FIELD_HELP.imagePrompt}>Prompt image cinématique</HelpLabel>
                  <textarea
                    className="ai-image-prompt"
                    value={slide.imagePrompt || ''}
                    onChange={(event) => patchGeneratedCinematicSlide(cinematic.id, slide.id, { imagePrompt: event.target.value })}
                    placeholder="Prompt image généré par l'IA pour cette image de cinématique."
                  />
                </>
              ) : null}
              <button
                type="button"
                className="secondary-action ai-image-action"
                disabled={!slide || generatingImageKey === imageKey || !canRunImageAi}
                onClick={() => generateCinematicImage(cinematic, slide)}
              >
                {generatingImageKey === imageKey ?
                   'Génération...'
                  : `${slide.imageData ? 'Régénérer cette image' : 'Générer cette image'} · ${formatCreditCost(getAiCreditCost('image'))}`}
              </button>
              {slide.aiImageVariants?.length > 1 ? (
                <button
                  type="button"
                  className="secondary-action ai-image-action"
                  onClick={() => openImageCompare({
                    type: 'cinematicSlide',
                    id: cinematic.id,
                    slideId: slide.id,
                    title: `${cinematic.name} - image ${index + 1}`,
                    activeImageData: slide.imageData,
                    variants: slide.aiImageVariants,
                  })}
                >
                  Comparer les images ({slide.aiImageVariants.length})
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </article>
  );
}

export default function AiDraftPreview({
  isEmpty = false,
  children,
  narrativePreview = null,
  isPatch = false,
  isChoiceAdventureAi = false,
  isHeroAdventureAi = false,
  HelpLabel = FallbackHelpLabel,
  FIELD_HELP = {},
  patchGeneratedScene = noop,
  patchGeneratedItem = noop,
  patchGeneratedCinematicSlide = noop,
  renameGeneratedItem = noop,
  getSceneVisualConstraints = () => '',
  updateSceneVisualConstraints = noop,
  getItemFallbackIcon = () => '',
  isTechnicalItemName = () => false,
  getHeroItemPreviewLabel = () => '',
  generatingImageKey = '',
  canRunImageAi = false,
  canRunObjectImageAi = false,
  canRunObjectThumbnailAi = false,
  generateSceneImage = noop,
  generateItemImage = noop,
  generateCinematicImage = noop,
  formatCreditCost = fallbackFormatCreditCost,
  getAiCreditCost = () => 0,
  openImageCompare = noop,
  onOpenImagePreview = noop,
}) {
  if (children) {
    return <AiDraftFrame isEmpty={isEmpty}>{children}</AiDraftFrame>;
  }

  if (isEmpty || !narrativePreview) {
    return <AiDraftFrame isEmpty><AiDraftEmptyState /></AiDraftFrame>;
  }

  return (
    <AiDraftFrame>
      <section className="combo-card">
        <span className="section-kicker">{isPatch ? 'Résultat narratif' : 'Projet proposé'}</span>
        <h3>{narrativePreview.title}</h3>
        <p className="small-note">{narrativePreview.subtitle}</p>
      </section>

      <section className="combo-card">
        <h3>Scènes</h3>
        <div className="ai-narrative-list">
          {narrativePreview.scenes.map((scene) => (
            <AiScenePreviewCard
              key={scene.id}
              scene={scene}
              isChoiceAdventureAi={isChoiceAdventureAi}
              HelpLabel={HelpLabel}
              FIELD_HELP={FIELD_HELP}
              patchGeneratedScene={patchGeneratedScene}
              getSceneVisualConstraints={getSceneVisualConstraints}
              updateSceneVisualConstraints={updateSceneVisualConstraints}
              generatingImageKey={generatingImageKey}
              canRunImageAi={canRunImageAi}
              generateSceneImage={generateSceneImage}
              formatCreditCost={formatCreditCost}
              getAiCreditCost={getAiCreditCost}
              openImageCompare={openImageCompare}
            />
          ))}
        </div>
      </section>

      {!isPatch ? (
        <section className="combo-card ai-narrative-columns">
          <div>
            <h3>Objets</h3>
            {narrativePreview.items.length ? (
              <div className="ai-object-grid">
                {narrativePreview.items.map((item) => (
                  <AiItemPreviewCard
                    key={item.id}
                    item={item}
                    isChoiceAdventureAi={isChoiceAdventureAi}
                    isHeroAdventureAi={isHeroAdventureAi}
                    HelpLabel={HelpLabel}
                    FIELD_HELP={FIELD_HELP}
                    getItemFallbackIcon={getItemFallbackIcon}
                    isTechnicalItemName={isTechnicalItemName}
                    getHeroItemPreviewLabel={getHeroItemPreviewLabel}
                    patchGeneratedItem={patchGeneratedItem}
                    renameGeneratedItem={renameGeneratedItem}
                    generatingImageKey={generatingImageKey}
                    canRunObjectImageAi={canRunObjectImageAi}
                    canRunObjectThumbnailAi={canRunObjectThumbnailAi}
                    generateItemImage={generateItemImage}
                    formatCreditCost={formatCreditCost}
                    getAiCreditCost={getAiCreditCost}
                    openImageCompare={openImageCompare}
                    onOpenImagePreview={onOpenImagePreview}
                  />
                ))}
              </div>
            ) : <p>Aucun objet.</p>}
          </div>
          <div>
            <h3>Énigmes</h3>
            <p>{narrativePreview.enigmas.map((enigma) => enigma.name).join(', ') || 'Aucune énigme.'}</p>
          </div>
          <div>
            <h3>Cinématiques</h3>
            {narrativePreview.cinematics.length ? (
              <div className="ai-cinematic-list">
                {narrativePreview.cinematics.map((cinematic) => (
                  <AiCinematicPreviewCard
                    key={cinematic.id}
                    cinematic={cinematic}
                    isChoiceAdventureAi={isChoiceAdventureAi}
                    HelpLabel={HelpLabel}
                    FIELD_HELP={FIELD_HELP}
                    patchGeneratedCinematicSlide={patchGeneratedCinematicSlide}
                    generatingImageKey={generatingImageKey}
                    canRunImageAi={canRunImageAi}
                    generateCinematicImage={generateCinematicImage}
                    formatCreditCost={formatCreditCost}
                    getAiCreditCost={getAiCreditCost}
                    openImageCompare={openImageCompare}
                    onOpenImagePreview={onOpenImagePreview}
                  />
                ))}
              </div>
            ) : <p>Aucune cinématique.</p>}
          </div>
        </section>
      ) : null}
    </AiDraftFrame>
  );
}
