import {
  EditorToolbarMenus,
  HelpLabel,
  MiniMap,
} from './SceneEditorChrome.jsx';
import Anime2DPreview from '../../../anime2d/Anime2DPreview.jsx';
import MediaSourcePicker from '../../../../shared/ui/media/MediaSourcePicker.jsx';
import SceneCanvasQuickToolbar from './SceneCanvasQuickToolbar.jsx';
import { SceneCanvasDrawerButton } from './SceneEditorDrawer.jsx';
import SceneObjectEditPanel from './SceneObjectEditPanel.jsx';
import SceneVisualEffect, { getVisualEffectZoneZIndex } from '../../../../shared/ui/scene/SceneVisualEffect.jsx';
import { SceneObjectBlockContent } from '../../../../shared/ui/scene/SceneObjectBlockContent.jsx';
import { getSceneObjectClickMode } from '../../../../shared/services/sceneObjectBlocks';
import HotspotInspectorPanel from './HotspotInspectorPanel.jsx';
import {
  getElementShapeStyle,
  getLayerZIndex,
  getSceneObjectStyle,
  gridOverlayStyle,
} from '../../../../shared/services/sceneRender.js';

const FULLSCREEN_CANVAS_ASPECT_RATIO = 16 / 10;

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
  fullscreenContentRef,
  selectActInFullscreen,
  selectSceneInFullscreen,
  getSceneDepth,
  editorToolbarProps,
  fullscreenZoom,
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
  setTab,
  openQuickLogicForTarget,
  duplicateSelectedEditorItems,
  deleteSelectedEditorItems,
  patchLayerItem,
  sendLayerToEdge,
  previewScene,
  onCanvasContextMenu,
  onCanvasBackgroundClick,
  drawerMode,
  setDrawerMode,
  conversationEditorOpen = false,
  setConversationEditorOpen,
  addConversationQuestion,
  isHeroAdventureProject = false,
  heroSkills = [],
}) {
  const getLinkedItem = (itemId) => project.items?.find((item) => item.id === itemId) || null;
  const getSceneObjectDisplayImage = (obj) => obj?.imageData || getLinkedItem(obj?.linkedItemId)?.imageData || '';
  const isBeginnerMode = project?.creationMode === 'beginner';
  const canUseQuickLogic = !isBeginnerMode && project?.creationMode !== 'intermediate';
  const isSceneObjectSelectedOnCanvas = (obj) => obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id);
  const isHotspotSelectedOnCanvas = (spot) => spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id);
  const sceneImageAspectRatio = Number(selectedScene?.backgroundAspectRatio) > 0
    ? Number(selectedScene.backgroundAspectRatio)
    : FULLSCREEN_CANVAS_ASPECT_RATIO;
  const coverScaleX = sceneImageAspectRatio > FULLSCREEN_CANVAS_ASPECT_RATIO
    ? sceneImageAspectRatio / FULLSCREEN_CANVAS_ASPECT_RATIO
    : 1;
  const coverScaleY = sceneImageAspectRatio < FULLSCREEN_CANVAS_ASPECT_RATIO
    ? FULLSCREEN_CANVAS_ASPECT_RATIO / sceneImageAspectRatio
    : 1;
  const fullscreenContentStyle = {
    position: 'absolute',
    left: `${-(coverScaleX - 1) * 50}%`,
    top: `${-(coverScaleY - 1) * 50}%`,
    width: `${coverScaleX * 100}%`,
    height: `${coverScaleY * 100}%`,
  };

  return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 20000, background: '#020617', padding: 12, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(320px,360px)', gap: 12, height: '100%', minHeight: 0, alignItems: 'stretch' }}>
                    <div style={{ minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
                          height: 'auto',
                          minHeight: 0,
                          maxWidth: '100%',
                          margin: 0,
                          aspectRatio: 'auto',
                          flex: '1 1 0',
                          background: '#020617',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          containerType: 'size',
                          overflow: 'hidden',
                          cursor: isPanningFullscreen ? 'grabbing' : 'grab',
                        }}
                        onMouseDown={beginFullscreenPan}
                        onMouseMove={moveFullscreenPan}
                        onMouseUp={stopFullscreenPan}
                        onMouseLeave={stopFullscreenPan}
                        onWheel={handleFullscreenWheel}
                        onClick={onCanvasBackgroundClick}
                      >
                        <div
                          ref={fullscreenCanvasRef}
                          className="fullscreen-scene-stage"
                          style={{
                            position: 'relative',
                            width: `min(100cqw, calc(100cqh * ${FULLSCREEN_CANVAS_ASPECT_RATIO}))`,
                            height: 'auto',
                            maxHeight: '100%',
                            aspectRatio: '16 / 10',
                            flex: '0 0 auto',
                            overflow: 'hidden',
                            borderRadius: 14,
                            containerType: 'size',
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
                          onContextMenu={(event) => onCanvasContextMenu?.(event, 'canvas', '', 'fullscreen')}
                        >
                          <SceneCanvasDrawerButton drawerMode={drawerMode} setDrawerMode={setDrawerMode} />
                          <div ref={fullscreenContentRef} className="fullscreen-scene-content" style={fullscreenContentStyle}>
                            {selectedScene.backgroundData ? (
                              <img
                                src={selectedScene.backgroundData}
                                alt="fond"
                                draggable={false}
                                style={{
                                  width: '100%',
                                  height: '100%',
                                  objectFit: 'fill',
                                  objectPosition: 'center',
                                  background: '#020617',
                                  userSelect: 'none',
                                }}
                              />
                            ) : <div className="placeholder">Ajoute une image de scène</div>}
                            <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                            {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden || zone.id === selectedVisualEffectZoneId).map((zone) => (
                              <button
                                key={zone.id}
                                type="button"
                                className={`editor-hotspot editor-visual-zone ${getShapeClassName?.(zone) || ''} ${zone.isHidden ? 'editor-hidden-on-canvas' : ''} ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
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
                          {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden || isSceneObjectSelectedOnCanvas(obj)).map((obj) => (
                            <button
                              key={obj.id}
                              type="button"
                              className={`editor-hotspot editor-scene-object ${getShapeClassName?.(obj) || ''} ${obj.isInvisible ? 'editor-scene-object-invisible' : ''} ${obj.isHidden ? 'editor-hidden-on-canvas' : ''} ${isSceneObjectSelectedOnCanvas(obj) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                              style={getSceneObjectStyle(obj)}
                              onPointerDown={(event) => beginObjectDrag(event, obj.id, 'fullscreen')}
                              onContextMenu={(event) => onCanvasContextMenu?.(event, 'sceneObject', obj.id, 'fullscreen')}
                              onClick={(event) => selectSceneObject(obj.id, event)}
                            >
                              {obj.anime2dSpec && !obj.isInvisible ? (
                                <Anime2DPreview spec={obj.anime2dSpec} />
                              ) : getSceneObjectDisplayImage(obj) && !obj.isInvisible ? (
                                <SceneObjectBlockContent object={obj} displayImage={getSceneObjectDisplayImage(obj)} linkedItem={getLinkedItem(obj.linkedItemId)} />
                              ) : !obj.isInvisible ? (
                                <SceneObjectBlockContent object={obj} displayImage="" linkedItem={getLinkedItem(obj.linkedItemId)} />
                              ) : <span>{`${obj.name || 'Objet'} (invisible)`}</span>}
                              {renderShapeOutline?.(obj, isSceneObjectSelectedOnCanvas(obj))}
                              {renderResizeHandles?.('sceneObject', obj.id, isSceneObjectSelectedOnCanvas(obj), 'fullscreen')}
                              {renderShapePointHandles?.('sceneObject', obj.id, isSceneObjectSelectedOnCanvas(obj), 'fullscreen')}
                            </button>
                          ))}
                          {selectedScene.hotspots.filter((spot) => !spot.isHidden || isHotspotSelectedOnCanvas(spot)).map((spot) => (
                            <button
                              key={spot.id}
                              type="button"
                              className={`editor-hotspot ${getShapeClassName?.(spot) || ''} ${spot.isHidden ? 'editor-hidden-on-canvas' : ''} ${isHotspotSelectedOnCanvas(spot) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                              style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot'), ...getElementShapeStyle(spot) }}
                              onPointerDown={(event) => beginDrag(event, spot.id, 'fullscreen')}
                              onContextMenu={(event) => onCanvasContextMenu?.(event, 'hotspot', spot.id, 'fullscreen')}
                              onClick={(event) => selectHotspot(spot.id, event)}
                            >
                              <span>{spot.name}</span>
                              {renderShapeOutline?.(spot, isHotspotSelectedOnCanvas(spot))}
                              {renderResizeHandles?.('hotspot', spot.id, isHotspotSelectedOnCanvas(spot), 'fullscreen')}
                              {renderShapePointHandles?.('hotspot', spot.id, isHotspotSelectedOnCanvas(spot), 'fullscreen')}
                            </button>
                          ))}
                          <SceneCanvasQuickToolbar
                            selectedScene={selectedScene}
                            selectedSceneId={selectedSceneId}
                            selectedHotspotId={selectedHotspotId}
                            selectedHotspotIds={selectedHotspotIds}
                            selectedSceneObjectId={selectedSceneObjectId}
                            selectedSceneObjectIds={selectedSceneObjectIds}
                            duplicateSelectedEditorItems={duplicateSelectedEditorItems}
                            deleteSelectedEditorItems={deleteSelectedEditorItems}
                            patchLayerItem={patchLayerItem}
                            sendLayerToEdge={sendLayerToEdge}
                            previewScene={previewScene}
                            canUseQuickLogic={canUseQuickLogic}
                            openQuickLogicForTarget={openQuickLogicForTarget}
                            isBeginnerMode={isBeginnerMode}
                            projectMode={project?.creationMode}
                            onBeforePreview={editorToolbarProps?.closeEditorFullscreen}
                          />
                          </div>
                        </div>
                        <MiniMap {...miniMapProps} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, minHeight: 0 }}>
                    <section className="panel side panel-context-pro fullscreen-context-panel" style={{ margin: 0, overflow: 'auto', flex: '1 1 auto', minHeight: 0, height: 'auto', maxHeight: 'none', position: 'relative', top: 'auto' }}>
                      <div className="panel-head panel-head-stack">
                        <div>
                          <span className="section-kicker">Contexte</span>
                          <h2>{selectedItem ? 'Objet sélectionné' : selectedSceneObject ? ((selectedSceneObject.anime2dSpec || selectedSceneObject.anime2dName || selectedSceneObject.name === 'Animation') ? 'Animation sélectionnée' : selectedSceneObject.isInvisible ? 'Objet invisible sélectionné' : (getSceneObjectClickMode(selectedSceneObject) === 'action' ? "Zone d'action sélectionnée" : 'Objet visible sélectionné')) : 'Zone sélectionnée'}</h2>
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
                            assetScope="object-image"
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
                        <SceneObjectEditPanel
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
                        <HotspotInspectorPanel
                          selectedHotspot={selectedHotspot}
                          selectedHotspotId={selectedHotspotId}
                          selectedSceneId={selectedSceneId}
                          project={project}
                          patchProject={patchProject}
                          renderShapeControls={renderShapeControls}
                          isBeginnerMode={isBeginnerMode}
                          conversationEditorOpen={conversationEditorOpen}
                          setConversationEditorOpen={setConversationEditorOpen}
                          addConversationQuestion={addConversationQuestion}
                          getSceneLabel={getSceneLabel}
                          mediaLibrary={mediaLibrary}
                          handleUpload={handleUpload}
                          isHeroAdventureProject={isHeroAdventureProject}
                          heroSkills={heroSkills}
                        />
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
