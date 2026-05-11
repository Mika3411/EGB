import {
  EditorToolbarMenus,
  HelpLabel,
  MiniMap,
} from './SceneEditorChrome.jsx';
import Anime2DPreview from '../Anime2DPreview.jsx';
import NumberInput from '../forms/NumberInput.jsx';
import MediaSourcePicker from '../MediaSourcePicker.jsx';
import { showConfirm } from '../AccessibleDialog';
import SceneObjectInspector, { SceneObjectBlockContent, getSceneObjectClickMode } from './SceneObjectInspector.jsx';
import SceneVisualEffect, { getVisualEffectZoneZIndex } from '../SceneVisualEffect.jsx';
import HotspotAssetsPanel from './HotspotAssetsPanel.jsx';
import {
  getElementShapeStyle,
  getLayerZIndex,
  getSceneObjectStyle,
  gridOverlayStyle,
} from './sceneEditorUtils.js';

export default function SceneFullscreenEditor({
  selectedScene,
  selectedSceneId,
  selectedItem,
  selectedItemId,
  selectedSceneObject,
  selectedSceneObjectId,
  selectedHotspot,
  selectedHotspotId,
  project,
  fullscreenViewportRef,
  fullscreenCanvasRef,
  selectActInFullscreen,
  selectSceneInFullscreen,
  getSceneDepth,
  editorToolbarProps,
  fullscreenZoom,
  sceneAspectRatio = 1.6,
  isPanningFullscreen,
  beginFullscreenPan,
  moveFullscreenPan,
  stopFullscreenPan,
  handleFullscreenWheel,
  fullscreenPan,
  isDragLocked,
  snapGridEnabled,
  updateHotspotPosition,
  stopDragging,
  selectedSceneObjectIds,
  draggingSceneObjectId,
  beginObjectDrag,
  selectSceneObject,
  selectedHotspotIds,
  draggingHotspotId,
  beginDrag,
  selectHotspot,
  selectedVisualEffectZoneId,
  draggingVisualEffectZoneId,
  beginVisualEffectZoneDrag,
  selectVisualEffectZone,
  renderResizeHandles,
  renderShapePointHandles,
  renderShapeControls,
  renderShapeOutline,
  getShapeClassName,
  miniMapProps,
  setSelectedItemId,
  handleUpload,
  mediaLibrary = [],
  importSceneObjectAnime2d,
  patchProject,
  deleteItem,
  setSelectedSceneObjectId,
  getSceneLabel,
  deleteHotspot,
  setTab,
  openQuickLogicForTarget,
}) {
  const getLinkedItem = (itemId) => project.items?.find((item) => item.id === itemId) || null;
  const getSceneObjectDisplayImage = (obj) => obj?.imageData || getLinkedItem(obj?.linkedItemId)?.imageData || '';
  const isBeginnerMode = project?.creationMode === 'beginner';
  const canUseQuickLogic = !isBeginnerMode && project?.creationMode !== 'intermediate';
  const selectedHotspotActionType = selectedHotspot?.actionType || 'dialogue';
  const displayedHotspotActionType = isBeginnerMode && !['dialogue', 'dialogue_item', 'scene'].includes(selectedHotspotActionType)
    ? 'dialogue'
    : selectedHotspotActionType;

  return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#020617', padding: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(320px,360px)', gap: 12, height: '100%', alignItems: 'stretch' }}>
                    <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, flex: '0 0 auto', minWidth: 0 }}>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
                          <select
                            value={selectedScene.actId || ''}
                            onChange={(event) => selectActInFullscreen(event.target.value)}
                            style={{ width: 190, flex: '0 0 190px' }}
                          >
                            {project.acts.map((act) => (
                              <option key={act.id} value={act.id}>{act.name}</option>
                            ))}
                          </select>
                          <select
                            value={selectedSceneId || ''}
                            onChange={(event) => selectSceneInFullscreen(event.target.value)}
                            style={{ width: 260, flex: '0 1 260px' }}
                          >
                            {project.scenes
                              .filter((scene) => scene.actId === selectedScene.actId)
                              .map((scene) => (
                                <option key={scene.id} value={scene.id}>
                                  {getSceneDepth(scene) ? `${'— '.repeat(getSceneDepth(scene))}${scene.name}` : scene.name}
                                </option>
                              ))}
                          </select>
                          <EditorToolbarMenus {...editorToolbarProps} fullscreen />
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'nowrap', minWidth: 0 }}>
                          <span className="status-badge soft" style={{ minWidth: 58, justifyContent: 'center', flex: '0 0 auto' }}>{Math.round(fullscreenZoom * 100)}%</span>
                        </div>
                      </div>
                      <div
                        ref={fullscreenViewportRef}
                        className="editor-canvas editor-canvas-pro fullscreen-scene-canvas"
                        style={{
                          width: '100%',
                          height: selectedHotspot ? 'calc(100vh - 260px)' : 'calc(100vh - 120px)',
                          maxWidth: '100%',
                          margin: 0,
                          aspectRatio: 'auto',
                          flex: '1 1 auto',
                          background: '#020617',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isPanningFullscreen ? 'grabbing' : 'grab',
                        }}
                        onMouseDown={beginFullscreenPan}
                        onMouseMove={moveFullscreenPan}
                        onMouseUp={stopFullscreenPan}
                        onMouseLeave={stopFullscreenPan}
                        onWheel={handleFullscreenWheel}
                      >
                        <div
                          ref={fullscreenCanvasRef}
                          className="fullscreen-scene-stage"
                          style={{
                            position: 'relative',
                            width: `min(100%, calc((100vh - ${selectedHotspot ? 260 : 120}px) * ${sceneAspectRatio}))`,
                            height: 'auto',
                            aspectRatio: sceneAspectRatio,
                            flex: '0 0 auto',
                            overflow: 'hidden',
                            borderRadius: 14,
                            transform: `translate(${fullscreenPan.x}px, ${fullscreenPan.y}px) scale(${fullscreenZoom})`,
                            transformOrigin: 'center center',
                            transition: isDragLocked || isPanningFullscreen ? 'none' : 'transform .12s ease',
                            boxShadow: '0 22px 70px rgba(0,0,0,.38)',
                            cursor: fullscreenZoom > 1 ? (isPanningFullscreen ? 'grabbing' : 'grab') : 'default',
                            backgroundImage: snapGridEnabled ?
                               'linear-gradient(rgba(96,165,250,.18) 1px, transparent 1px), linear-gradient(90deg, rgba(96,165,250,.18) 1px, transparent 1px)'
                              : 'none',
                            backgroundSize: '5% 5%',
                          }}
                          onPointerUp={stopDragging}
                          onPointerCancel={stopDragging}
                        >
                          {selectedScene.backgroundData ? (
                            <img
                              src={selectedScene.backgroundData}
                              alt="fond"
                              draggable={false}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                background: '#020617',
                                userSelect: 'none',
                              }}
                            />
                          ) : <div className="placeholder">Ajoute une image de scène</div>}
                          <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                          {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
                            <button
                              key={zone.id}
                              type="button"
                              className={`editor-hotspot editor-visual-zone ${getShapeClassName?.(zone) || ''} ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
                              style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, zIndex: getVisualEffectZoneZIndex(zone.layer), ...getElementShapeStyle(zone) }}
                              onPointerDown={(event) => beginVisualEffectZoneDrag(event, zone.id, 'fullscreen')}
                              onClick={() => selectVisualEffectZone(zone.id)}
                            >
                              <SceneVisualEffect effect={zone.effect} intensity={zone.intensity} />
                              <span>{zone.name}</span>
                              {renderShapeOutline?.(zone, zone.id === selectedVisualEffectZoneId)}
                              {renderResizeHandles?.('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId, 'fullscreen')}
                              {renderShapePointHandles?.('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId, 'fullscreen')}
                            </button>
                          ))}
                          {snapGridEnabled ? <div style={gridOverlayStyle} /> : null}
                        {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                          <button
                            key={obj.id}
                            type="button"
                            className={`editor-hotspot editor-scene-object ${getShapeClassName?.(obj) || ''} ${obj.isInvisible ? 'editor-scene-object-invisible' : ''} ${(obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id)) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                            style={getSceneObjectStyle(obj)}
                            onPointerDown={(event) => beginObjectDrag(event, obj.id, 'fullscreen')}
                            onClick={(event) => selectSceneObject(obj.id, event)}
                          >
                            {obj.anime2dSpec && !obj.isInvisible ? (
                              <Anime2DPreview spec={obj.anime2dSpec} />
                            ) : getSceneObjectDisplayImage(obj) && !obj.isInvisible ? (
                              <SceneObjectBlockContent object={obj} displayImage={getSceneObjectDisplayImage(obj)} linkedItem={getLinkedItem(obj.linkedItemId)} />
                            ) : !obj.isInvisible ? (
                              <SceneObjectBlockContent object={obj} displayImage="" linkedItem={getLinkedItem(obj.linkedItemId)} />
                            ) : <span>{`${obj.name || 'Objet'} (invisible)`}</span>}
                            {renderShapeOutline?.(obj, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                            {renderResizeHandles?.('sceneObject', obj.id, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id), 'fullscreen')}
                            {renderShapePointHandles?.('sceneObject', obj.id, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id), 'fullscreen')}
                          </button>
                        ))}
                        {selectedScene.hotspots.filter((spot) => !spot.isHidden).map((spot) => (
                          <button
                            key={spot.id}
                            type="button"
                            className={`editor-hotspot ${getShapeClassName?.(spot) || ''} ${(spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id)) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                            style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot'), ...getElementShapeStyle(spot) }}
                            onPointerDown={(event) => beginDrag(event, spot.id, 'fullscreen')}
                            onClick={(event) => selectHotspot(spot.id, event)}
                          >
                            <span>{spot.name}</span>
                            {renderShapeOutline?.(spot, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                            {renderResizeHandles?.('hotspot', spot.id, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id), 'fullscreen')}
                            {renderShapePointHandles?.('hotspot', spot.id, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id), 'fullscreen')}
                          </button>
                        ))}
                        </div>
                        <MiniMap {...miniMapProps} />
                      </div>
                      {selectedHotspot ? (
                        <HotspotAssetsPanel
                          selectedHotspot={selectedHotspot}
                          selectedSceneId={selectedSceneId}
                          selectedHotspotId={selectedHotspotId}
                          patchProject={patchProject}
                          handleUpload={handleUpload}
                          mediaLibrary={mediaLibrary}
                          className="hotspot-assets-below-canvas hotspot-assets-fullscreen"
                        />
                      ) : null}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, minHeight: 0 }}>
                    <section className="panel side panel-context-pro fullscreen-context-panel" style={{ margin: 0, overflow: 'auto', flex: '1 1 auto', minHeight: 0, height: 'auto', maxHeight: 'none', position: 'relative', top: 'auto' }}>
                      <div className="panel-head panel-head-stack">
                        <div>
                          <span className="section-kicker">Contexte</span>
                          <h2>{selectedItem ? 'Objet selectionné' : selectedSceneObject ? ((selectedSceneObject.anime2dSpec || selectedSceneObject.anime2dName || selectedSceneObject.name === 'Animation') ? 'Animation selectionnée' : selectedSceneObject.isInvisible ? 'Objet invisible selectionné' : (getSceneObjectClickMode(selectedSceneObject) === 'action' ? "Zone d'action selectionnée" : 'Objet visible selectionné')) : 'Zone selectionnée'}</h2>
                        </div>
                      </div>

                      {selectedItem ? (
                        <>
                          <div className="icon-preview">{selectedItem.imageData ? <img src={selectedItem.imageData} alt={selectedItem.name} /> : <span>{selectedItem.icon || '📦'}</span>}</div>
                          <HelpLabel help="Nom de l’objet dans l’inventaire. C’est le libellé que le joueur voit lorsqu’il obtient ou consulte cet objet.">Nom de l’objet</HelpLabel>
                          <input value={selectedItem.name} onChange={(e) => patchProject((draft) => {
                            const item = draft.items.find((entry) => entry.id === selectedItemId);
                            if (item) item.name = e.target.value;
                          })} />
                          <HelpLabel help="Image utilisée comme miniature d’inventaire. Si elle est absente, l’emoji de secours est utilisé à la place.">Image de l’objet</HelpLabel>
                          <MediaSourcePicker
                            className="button like full secondary-action"
                            accept="image/*"
                            handleUpload={handleUpload}
                            mediaLibrary={mediaLibrary}
                            onSelect={(data, name) => patchProject((draft) => {
                              const item = draft.items.find((entry) => entry.id === selectedItemId);
                              if (item) {
                                item.imageData = data;
                                item.imageName = name;
                              }
                            })}
                          >
                            {selectedItem.imageName || 'Importer une image objet'}
                          </MediaSourcePicker>
                          <HelpLabel help="Symbole affiché quand aucune image d’inventaire n’est fournie, ou comme repère visuel léger dans les listes.">Emoji de secours</HelpLabel>
                          <input value={selectedItem.icon} onChange={(e) => patchProject((draft) => {
                            const item = draft.items.find((entry) => entry.id === selectedItemId);
                            if (item) item.icon = e.target.value;
                          })} />
                          <p className="small-note">Conseil : choisis une image lisible en petit format, avec un fond simple si possible.</p>
                          <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                            deleteItem(selectedItemId);
                            setSelectedItemId('');
                          }}>Supprimer l’objet</button>
                        </>
                      ) : selectedSceneObject ? (
                        <SceneObjectInspector
                          project={project}
                          selectedSceneId={selectedSceneId}
                          selectedSceneObject={selectedSceneObject}
                          selectedSceneObjectId={selectedSceneObjectId}
                          patchProject={patchProject}
                          renderShapeControls={renderShapeControls}
                          handleUpload={handleUpload}
                          mediaLibrary={mediaLibrary}
                          importSceneObjectAnime2d={importSceneObjectAnime2d}
                          getSceneLabel={getSceneLabel}
                          setSelectedSceneObjectId={setSelectedSceneObjectId}
                          onOpenLogic={() => openQuickLogicForTarget?.('sceneObject', selectedSceneObjectId)}
                        />
                      ) : selectedHotspot ? (
                        <>
                          <HelpLabel help="Nom de la zone d’action dans l’éditeur. Choisis un nom qui décrit l’intention, par exemple “Porte verrouillée”.">Nom</HelpLabel>
                          <input value={selectedHotspot.name} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.name = e.target.value;
                          })} />
                          <div className="grid-two small-gap">
                            <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l’image.">X</HelpLabel><NumberInput value={selectedHotspot.x} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.x = nextValue; })} /></div>
                            <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l’image.">Y</HelpLabel><NumberInput value={selectedHotspot.y} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.y = nextValue; })} /></div>
                            <div><HelpLabel help="Largeur de la zone cliquable. Augmente-la si le joueur risque de manquer la cible.">Largeur</HelpLabel><NumberInput value={selectedHotspot.width} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.width = nextValue; })} /></div>
                            <div><HelpLabel help="Hauteur de la zone cliquable. Une zone trop petite peut être difficile à trouvér sur mobile.">Hauteur</HelpLabel><NumberInput value={selectedHotspot.height} onValueChange={(nextValue) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.height = nextValue; })} /></div>
                          </div>
                          {renderShapeControls?.('hotspot', selectedHotspotId)}
                          {canUseQuickLogic ? (
                            <button type="button" className="secondary-action full" onClick={() => openQuickLogicForTarget?.('hotspot', selectedHotspotId)}>
                              Logique
                            </button>
                          ) : null}
                          <HelpLabel help="Action principale déclénchée par cette zone après validation des prérequis éventuels : dialogue, objet, changement de scène ou cinematic.">Action</HelpLabel>
                          <select value={displayedHotspotActionType} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.actionType = e.target.value;
                          })}>
                            <option value="dialogue">Dialogue</option>
                            <option value="dialogue_item">Dialogue + objet</option>
                            <option value="scene">Changer de scène</option>
                            {!isBeginnerMode ? <option value="cinematic">Lancer une cinématique</option> : null}
                          </select>
                          <HelpLabel help="Texte affiché lors de l’interaction principale. Il peut donner une réaction, un indice ou confirmer une action réussie.">Dialogue</HelpLabel>
                          <textarea value={selectedHotspot.dialogue} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.dialogue = e.target.value;
                          })} />
                          <HelpLabel help="Destination utilisée si l’action est “Changer de scène”. Laisse vide si la zone doit seulement parler ou donner un objet.">Scène cible</HelpLabel>
                          <select value={selectedHotspot.targetSceneId} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetSceneId = e.target.value;
                          })}>
                            <option value="">Aucune</option>
                            {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                          </select>
                          {!isBeginnerMode ? (
                            <>
                              <HelpLabel help="Cinématique lancée après l’interaction réussie. Elle peut servir de transition, révélation ou fin de sequence.">Cinématique cible</HelpLabel>
                              <select value={selectedHotspot.targetCinematicId} onChange={(e) => patchProject((draft) => {
                                const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetCinematicId = e.target.value;
                              })}>
                                <option value="">Aucune</option>
                                {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                              </select>
                            </>
                          ) : null}
                          <HelpLabel help="Énigme à résoudre avant d’exécuter l’action de la zone. Si elle échoue ou reste ouverte, la suite ne se déclénche pas encore.">Énigme liée</HelpLabel>
                          <select value={selectedHotspot.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.enigmaId = e.target.value;
                          })}>
                            <option value="">Aucune</option>
                            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                          </select>
                          <button className="danger-button" style={{ marginTop: 12 }} onClick={async () => {
                            const confirmed = await showConfirm({
                              title: 'Supprimer la zone',
                              message: `Supprimer la zone "${selectedHotspot.name}" ?`,
                              confirmLabel: 'Supprimer',
                              variant: 'danger',
                            });
                            if (!confirmed) return;
                            deleteHotspot(selectedSceneId, selectedHotspotId);
                          }}>Supprimer la zone</button>
                        </>
                      ) : (
                        <div className="placeholder small">Sélectionne une zone, un objet visible ou un objet d’inventaire.</div>
                      )}
                    </section>
                    {canUseQuickLogic ? (
                    <div className="logic-reminder-card logic-reminder-card--fullscreen">
                      <p>Besoin de conditions ? Ajoute des règles dans l’onglet Logique pour changer le comportement d’une zone selon l’inventaire, une énigme, une cinématique ou une autre action.</p>
                      <button type="button" className="secondary-action" onClick={() => setTab?.('logic')}>
                        Ouvrir l’onglet Logique
                      </button>
                    </div>
                    ) : null}
                    </div>
                  </div>
                </div>
  );
}
