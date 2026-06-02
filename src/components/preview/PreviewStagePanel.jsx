import { formatTimerSeconds } from '../../lib/gameEngine';
import { resolveAssetUrl } from '../../lib/assetManager';
import Anime2DPreview from '../Anime2DPreview.jsx';
import SceneVisualEffect, { getVisualEffectZoneZIndex } from '../SceneVisualEffect';
import { getElementShapeStyle, getLayerZIndex } from '../scenes/sceneEditorUtils';
import {
  applySceneObjectTextOverride,
  SceneObjectBlockContent,
  getSceneObjectClickMode,
} from '../scenes/SceneObjectInspector.jsx';
import PreviewInventoryDrawer from './PreviewInventoryDrawer.jsx';

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
  return (
    <section className="panel player-stage-panel">
      <div className="player-topbar">
        <div>
          <span className="eyebrow">Player</span>
          <strong>{playScene ? getSceneLabel(playScene.id) : 'Aucune scène'}</strong>
        </div>
        <div className="player-actions">
          <button type="button" className="secondary-action" onClick={() => setIsPauseOpen(true)}>Pause</button>
          <button type="button" className="secondary-action player-reset-button" onClick={resetPreview}>Recommencer</button>
          <button type="button" className="secondary-action" onClick={saveGameState}>Sauvegarder</button>
          <button type="button" className="secondary-action" onClick={loadGameState}>Charger</button>
          <button type="button" className="secondary-action" onClick={() => setShowInteractionHints((value) => !value)}>
            {showInteractionHints ? 'Sans aide' : 'Aide visuelle'}
          </button>
          <button type="button" className="secondary-action" onClick={toggleFullscreen}>Plein écran</button>
        </div>
      </div>

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
            fetchPriority="high"
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
            const linkedItem = obj.linkedItemId ? project.items.find((entry) => entry.id === obj.linkedItemId) : null;
            const displayImage = resolveAssetUrl(project, obj.imageId, obj.imageData)
              || resolveAssetUrl(project, linkedItem?.imageId, linkedItem?.imageData)
              || '';
            return (
              <button
                key={obj.id}
                type="button"
                className={`player-scene-object ${obj.isInvisible ? 'player-scene-object-invisible' : ''} ${getSceneObjectClickMode(objectForRender) === 'none' ? 'player-scene-object-not-clickable' : ''}`}
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

        {(playScene?.hotspots || []).map((spot) => (
          <button
            key={spot.id}
            type="button"
            className="player-hotspot"
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
          />
        ))}

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
            <button type="button" className="inventory-discreet-button" onClick={(event) => {
              event.stopPropagation();
              setIsHeroPanelOpen(false);
              setIsObjectiveOpen?.(false);
              setIsInventoryOpen((value) => !value);
            }}>
              {isHeroAdventure ? 'Personnage' : isChoiceAdventure ? 'Carnet' : 'Inventaire'} {inventory.length ? `(${inventory.length})` : ''}
            </button>
          </div>
        </div>

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
    </section>
  );
}
