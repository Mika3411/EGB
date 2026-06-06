import { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, Pause as PauseIcon } from 'lucide-react';
import { formatTimerSeconds } from '../../../shared/services/gameEngine';
import { resolveAssetUrl } from '../../../shared/services/assetManager';
import Anime2DPreview from '../../anime2d/Anime2DPreview.jsx';
import SceneVisualEffect, { getVisualEffectZoneZIndex } from '../../../shared/ui/scene/SceneVisualEffect';
import { getElementShapeStyle, getLayerZIndex } from '../../../shared/services/sceneRender';
import {
  applySceneObjectTextOverride,
  getSceneObjectClickMode,
} from '../../../shared/services/sceneObjectBlocks';
import { SceneObjectBlockContent } from '../../../shared/ui/scene/SceneObjectBlockContent.jsx';
import PreviewInventoryDrawer from './PreviewInventoryDrawer.jsx';

const BUILDER_CREDIT_URL = 'https://escape-game-studio.netlify.app/';

export default function PreviewStagePanel({
  playScene = null,
  project = {},
  getSceneLabel,
  setIsPauseOpen,
  resetPreview,
  saveGameState,
  loadGameState,
  showInteractionHints = false,
  setShowInteractionHints,
  toggleFullscreen,
  sceneAspectRatio = 1.6,
  isDenseMobileScene = false,
  viewerImage = null,
  setViewerImage,
  heroSetupOverlay = null,
  heroRewardNotice = null,
  heroCombatOverlay = null,
  playSceneBackgroundUrl = '',
  setLoadedSceneAspectRatio,
  usedSceneObjectIds = [],
  revealedSceneObjectIds = [],
  sceneObjectTextOverrides = {},
  getSceneObjectStyle,
  handleSceneObjectClick,
  handleHotspotClick,
  actPreloadStatus = {},
  sceneTransitionOverlay = null,
  transitionPreviousBackgroundUrl = '',
  sceneTimerRemaining = 0,
  playerLives = 0,
  isNarrationCollapsed = false,
  setIsNarrationCollapsed,
  dialogue = '',
  isHeroAdventure = false,
  isChoiceAdventure = false,
  showInventoryToggle = true,
  isHeroPanelOpen = false,
  isInventoryOpen = false,
  isObjectiveOpen = false,
  usesImmersiveAdventurePlayer = false,
  currentGameTitle = '',
  inventory = [],
  selectedInventoryIds = [],
  debugInventoryItemId = '',
  sharedPlayerMode = false,
  draggedInventoryId = null,
  setIsHeroPanelOpen,
  setIsInventoryOpen,
  setIsObjectiveOpen,
  setDebugInventoryItemId,
  setDialogue,
  setDraggedInventoryId,
  addDebugInventoryItem,
  removeDebugInventoryItem,
  combineInventoryItems,
  openInventoryItem,
  renderHeroAdventurePanel,
  renderHeroCharacterPage,
  renderAdventureInventoryContent,
  objectiveChecklistContent = null,
  choiceEffectOverlay = null,
}) {
  const stageViewportRef = useRef(null);
  const topbarRef = useRef(null);
  const [isMobileActionsOpen, setIsMobileActionsOpen] = useState(false);
  const mobileActionsMenuId = 'player-mobile-actions-menu';

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const viewport = stageViewportRef.current;
    if (!viewport) return undefined;
    const isMobilePortrait = typeof window.matchMedia === 'function'
      ? window.matchMedia('(max-width: 720px) and (orientation: portrait)').matches
      : window.innerWidth <= 720 && window.innerHeight >= window.innerWidth;
    if (!isMobilePortrait) return undefined;

    const requestFrame = window.requestAnimationFrame || ((callback) => window.setTimeout(callback, 0));
    const cancelFrame = window.cancelAnimationFrame || window.clearTimeout;
    const frameId = requestFrame(() => {
      const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
      viewport.scrollLeft = isDenseMobileScene
        ? 0
        : Math.round(maxScrollLeft / 2);
      viewport.scrollTop = 0;
    });

    return () => cancelFrame(frameId);
  }, [isDenseMobileScene, playScene?.id, playSceneBackgroundUrl, sceneAspectRatio]);

  useEffect(() => {
    if (typeof window === 'undefined' || !isMobileActionsOpen) return undefined;

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      setIsMobileActionsOpen(false);
      topbarRef.current?.querySelector('.player-mobile-more-button')?.focus();
    };
    const handlePointerDown = (event) => {
      if (topbarRef.current && !topbarRef.current.contains(event.target)) {
        setIsMobileActionsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isMobileActionsOpen]);

  const runMobileAction = (action) => {
    setIsMobileActionsOpen(false);
    action?.();
  };

  return (
    <section className="panel player-stage-panel">
      <div className={`player-topbar ${isMobileActionsOpen ? 'is-mobile-actions-open' : ''}`} ref={topbarRef}>
        <div className="player-topbar-title">
          <span className="eyebrow">Player</span>
          <strong>{playScene ? getSceneLabel(playScene.id) : 'Aucune scène'}</strong>
        </div>
        <div className="player-actions player-actions-desktop" aria-label="Actions du player">
          <button type="button" className="secondary-action" onClick={() => setIsPauseOpen(true)}>Pause</button>
          <button type="button" className="secondary-action player-reset-button" onClick={resetPreview}>Recommencer</button>
          <button type="button" className="secondary-action" onClick={saveGameState}>Sauvegarder</button>
          <button type="button" className="secondary-action" onClick={loadGameState}>Charger</button>
          <button type="button" className="secondary-action" onClick={() => setShowInteractionHints((value) => !value)}>
            {showInteractionHints ? 'Sans aide' : 'Aide visuelle'}
          </button>
          <button type="button" className="secondary-action" onClick={toggleFullscreen}>Plein écran</button>
        </div>
        <div className="player-mobile-actions" aria-label="Actions rapides du player">
          <button type="button" className="secondary-action player-mobile-primary-action" onClick={() => setIsPauseOpen(true)}>
            <PauseIcon size={16} aria-hidden="true" />
            <span>Pause</span>
          </button>
          <button
            type="button"
            className="secondary-action player-mobile-more-button"
            aria-label="Actions du player"
            aria-expanded={isMobileActionsOpen}
            aria-controls={mobileActionsMenuId}
            onClick={() => setIsMobileActionsOpen((value) => !value)}
          >
            <MoreHorizontal size={17} aria-hidden="true" />
            <span>Plus</span>
          </button>
        </div>
        <div
          id={mobileActionsMenuId}
          className={`player-mobile-action-menu ${isMobileActionsOpen ? 'is-open' : ''}`}
          aria-label="Actions secondaires du player"
          hidden={!isMobileActionsOpen}
        >
          <button type="button" className="secondary-action player-reset-button" onClick={() => runMobileAction(resetPreview)}>Recommencer</button>
          <button type="button" className="secondary-action" onClick={() => runMobileAction(saveGameState)}>Sauvegarder</button>
          <button type="button" className="secondary-action" onClick={() => runMobileAction(loadGameState)}>Charger</button>
          <button type="button" className="secondary-action" onClick={() => runMobileAction(() => setShowInteractionHints((value) => !value))}>
            {showInteractionHints ? 'Sans aide' : 'Aide visuelle'}
          </button>
          <button type="button" className="secondary-action" onClick={() => runMobileAction(toggleFullscreen)}>Plein écran</button>
        </div>
      </div>

      <div
        className="player-stage-viewport"
        data-testid="preview-stage-viewport"
        role="region"
        ref={stageViewportRef}
        style={{ '--scene-aspect': sceneAspectRatio }}
        tabIndex={0}
        aria-label="Zone de scène"
      >
        <div className="scene-player" style={{ aspectRatio: sceneAspectRatio, '--scene-aspect': sceneAspectRatio }} onClick={() => viewerImage && setViewerImage(null)}>
        {heroSetupOverlay}
        {heroRewardNotice}
        {heroCombatOverlay}
        {choiceEffectOverlay ? (
          <div className="choice-effect-floating">
            {choiceEffectOverlay}
          </div>
        ) : null}

        {playSceneBackgroundUrl ? (
          <img
            className="scene-background"
            src={playSceneBackgroundUrl}
            alt={playScene.name}
            loading="eager"
            decoding="async"
            fetchpriority="high"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight) {
                setLoadedSceneAspectRatio(Number((image.naturalWidth / image.naturalHeight).toFixed(4)));
              }
            }}
          />
        ) : (
          <div className="placeholder">Ajoute un fond pour jouer la scène.</div>
        )}
        <SceneVisualEffect effect={playScene?.visualEffect} intensity={playScene?.visualEffectIntensity} />
        {(playScene?.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
          <SceneVisualEffect
            key={zone.id}
            effect={zone.effect}
            intensity={zone.intensity}
            className="scene-visual-effect-zone"
            style={{
              left: `${zone.x}%`,
              top: `${zone.y}%`,
              width: `${zone.width}%`,
              height: `${zone.height}%`,
              zIndex: getVisualEffectZoneZIndex(zone.layer),
              ...getElementShapeStyle(zone),
            }}
          />
        ))}

        {(playScene?.sceneObjects || [])
          .filter((obj) => !usedSceneObjectIds.includes(obj.id) && (!obj.isHidden || revealedSceneObjectIds.includes(obj.id)))
          .map((obj) => {
            const objectForRender = applySceneObjectTextOverride(obj, sceneObjectTextOverrides[obj.id]);
            const clickMode = getSceneObjectClickMode(objectForRender);
            const linkedItem = obj.linkedItemId ? project.items.find((entry) => entry.id === obj.linkedItemId) : null;
            const displayImage = resolveAssetUrl(project, obj.imageId, obj.imageData)
              || resolveAssetUrl(project, linkedItem?.imageId, linkedItem?.imageData)
              || '';
            return (
              <button
                key={obj.id}
                type="button"
                className={`player-scene-object ${obj.isInvisible ? 'player-scene-object-invisible' : ''} ${clickMode === 'none' ? 'player-scene-object-not-clickable' : 'player-scene-object-clickable'}`}
                data-scene-object-id={obj.id}
                style={getSceneObjectStyle(obj)}
                onClick={(event) => handleSceneObjectClick(event, objectForRender)}
                title={objectForRender.name}
                aria-label={objectForRender.name || 'Objet invisible'}
              >
                {!objectForRender.isInvisible && objectForRender.anime2dSpec ? (
                  <Anime2DPreview spec={objectForRender.anime2dSpec} project={project} />
                ) : !obj.isInvisible && displayImage ? (
                  <SceneObjectBlockContent object={objectForRender} displayImage={displayImage} linkedItem={linkedItem} />
                ) : !objectForRender.isInvisible ? (
                  <SceneObjectBlockContent object={objectForRender} displayImage="" linkedItem={linkedItem} />
                ) : null}
              </button>
            );
          })}

        {(playScene?.hotspots || []).map((spot) => {
          const hotspotImageSrc = resolveAssetUrl(project, spot.objectImageId, spot.objectImageData);
          return (
            <button
              key={spot.id}
              type="button"
              className={`player-hotspot ${hotspotImageSrc ? 'player-hotspot-with-image' : ''}`}
              style={{
                left: `${spot.x}%`,
                top: `${spot.y}%`,
                width: `${spot.width}%`,
                height: `${spot.height}%`,
                zIndex: getLayerZIndex(spot, 'hotspot'),
                ...getElementShapeStyle(spot),
              }}
              onClick={(event) => handleHotspotClick(event, spot)}
              title={spot.name}
              aria-label={spot.name || 'Zone'}
            >
              {hotspotImageSrc ? (
                <img className="player-hotspot-image" src={hotspotImageSrc} alt="" aria-hidden="true" />
              ) : null}
            </button>
          );
        })}

        {viewerImage && (
          <div className="scene-inline-viewer">
            <div className="scene-inline-viewer__backdrop" />
            <div className="scene-inline-viewer__card">
              {viewerImage.src ? (
                <img className="scene-inline-viewer__image" src={viewerImage.src} alt={viewerImage.name || 'Objet'} />
              ) : (
                <div className="scene-inline-viewer__fallback" role="img" aria-label={viewerImage.name || 'Objet'}>
                  <span>{viewerImage.icon || 'Objet'}</span>
                </div>
              )}
              <div className="scene-inline-viewer__name">{viewerImage.caption || viewerImage.name || 'Objet'}</div>
            </div>
          </div>
        )}

        {actPreloadStatus.isLoading ? (
          <div className="act-preload-overlay" role="status" aria-live="polite">
            <div className="act-preload-card">
              <span className="eyebrow">Chargement</span>
              <strong>{actPreloadStatus.label}</strong>
              <div className="act-preload-bar" aria-label={`Chargement ${actPreloadStatus.progress}%`}>
                <span style={{ width: `${actPreloadStatus.progress}%` }} />
              </div>
              <small>{actPreloadStatus.progress}% des médias de l'acte sont prêts</small>
            </div>
          </div>
        ) : null}

        {sceneTransitionOverlay ? (
          <div
            key={sceneTransitionOverlay.key}
            className={`scene-transition-overlay scene-transition-overlay--${sceneTransitionOverlay.type}`}
            style={{ '--scene-transition-duration': `${sceneTransitionOverlay.duration}ms` }}
          >
            {transitionPreviousBackgroundUrl ? (
              <img
                src={transitionPreviousBackgroundUrl}
                alt=""
              />
            ) : <div className="placeholder">Scène précédente</div>}
          </div>
        ) : null}

        {playScene?.timerEnabled ? (
          <div className="scene-timer-hud player-scene-timer">
            <strong>{formatTimerSeconds(sceneTimerRemaining)}</strong>
            {playScene.timerEndAction === 'damage-life' ? <span>Vies: {playerLives}</span> : null}
          </div>
        ) : null}

        <div className={`player-narration-bar ${isNarrationCollapsed ? 'is-collapsed' : ''}`}>
          {isNarrationCollapsed ? (
            <button
              type="button"
              className="narration-discreet-button"
              onClick={(event) => {
                event.stopPropagation();
                setIsNarrationCollapsed(false);
              }}
            >
              Texte
            </button>
          ) : (
            <p
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                setIsNarrationCollapsed(true);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setIsNarrationCollapsed(true);
                }
              }}
            >
              {dialogue || 'Aucun message.'}
            </p>
          )}
          <div className="player-drawer-actions">
            {isHeroAdventure ? (
              <button type="button" className="inventory-discreet-button hero-panel-discreet-button" onClick={(event) => {
                event.stopPropagation();
                setIsInventoryOpen(false);
                setIsObjectiveOpen?.(false);
                setIsHeroPanelOpen((value) => !value);
              }}>
                Hero Adventure
              </button>
            ) : null}
            {objectiveChecklistContent ? (
              <button type="button" className="inventory-discreet-button objective-discreet-button" onClick={(event) => {
                event.stopPropagation();
                setIsHeroPanelOpen(false);
                setIsInventoryOpen(false);
                setIsObjectiveOpen?.((value) => !value);
              }}>
                Objectif
              </button>
            ) : null}
            {showInventoryToggle ? (
              <button type="button" className="inventory-discreet-button" onClick={(event) => {
                event.stopPropagation();
                setIsHeroPanelOpen(false);
                setIsObjectiveOpen?.(false);
                setIsInventoryOpen((value) => !value);
              }}>
                {isHeroAdventure ? 'Personnage' : isChoiceAdventure ? 'Carnet' : 'Inventaire'} {inventory.length ? `(${inventory.length})` : ''}
              </button>
            ) : null}
          </div>
        </div>

        <a
          className="player-builder-credit"
          href={BUILDER_CREDIT_URL}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          Créé avec Escape Game Studio
        </a>

        <PreviewInventoryDrawer
          isHeroPanelOpen={isHeroPanelOpen}
          isInventoryOpen={isInventoryOpen}
          usesImmersiveAdventurePlayer={usesImmersiveAdventurePlayer}
          isHeroAdventure={isHeroAdventure}
          isChoiceAdventure={isChoiceAdventure}
          currentGameTitle={currentGameTitle}
          inventory={inventory}
          selectedInventoryIds={selectedInventoryIds}
          project={project}
          debugInventoryItemId={debugInventoryItemId}
          sharedPlayerMode={sharedPlayerMode}
          draggedInventoryId={draggedInventoryId}
          setIsHeroPanelOpen={setIsHeroPanelOpen}
          setIsInventoryOpen={setIsInventoryOpen}
          setDebugInventoryItemId={setDebugInventoryItemId}
          setDialogue={setDialogue}
          setDraggedInventoryId={setDraggedInventoryId}
          addDebugInventoryItem={addDebugInventoryItem}
          removeDebugInventoryItem={removeDebugInventoryItem}
          combineInventoryItems={combineInventoryItems}
          openInventoryItem={openInventoryItem}
          renderHeroAdventurePanel={renderHeroAdventurePanel}
          renderHeroCharacterPage={renderHeroCharacterPage}
          renderAdventureInventoryContent={renderAdventureInventoryContent}
        />
        {isObjectiveOpen && objectiveChecklistContent ? (
          <>
            <button
              type="button"
              className="player-inventory-backdrop"
              aria-label="Fermer les objectifs"
              onClick={() => setIsObjectiveOpen?.(false)}
            />
            <div className="player-inventory-drawer player-inventory-drawer--objective" onClick={(event) => event.stopPropagation()}>
              <div className="panel-head">
                <h3>Objectif</h3>
                <button type="button" className="secondary-button" onClick={() => setIsObjectiveOpen?.(false)}>Fermer</button>
              </div>
              {objectiveChecklistContent}
            </div>
          </>
        ) : null}
        </div>
      </div>
    </section>
  );
}
