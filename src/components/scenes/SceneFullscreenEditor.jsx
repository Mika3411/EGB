import {
  EditorToolbarMenus,
  HelpLabel,
  MiniMap,
} from './SceneEditorChrome.jsx';
import SceneVisualEffect, { getVisualEffectZoneZIndex } from '../SceneVisualEffect.jsx';
import {
  getLayerZIndex,
  getSceneObjectImageStyle,
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
  miniMapProps,
  setSelectedItemId,
  handleUpload,
  patchProject,
  deleteItem,
  setSelectedSceneObjectId,
  getSceneLabel,
  deleteHotspot,
  setTab,
}) {
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
                          height: 'calc(100vh - 120px)',
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
                            width: `min(100%, calc((100vh - 120px) * ${sceneAspectRatio}))`,
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
                              className={`editor-hotspot editor-visual-zone ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
                              style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, zIndex: getVisualEffectZoneZIndex(zone.layer) }}
                              onPointerDown={(event) => beginVisualEffectZoneDrag(event, zone.id, 'fullscreen')}
                              onClick={() => selectVisualEffectZone(zone.id)}
                            >
                              <SceneVisualEffect effect={zone.effect} intensity={zone.intensity} />
                              <span>{zone.name}</span>
                            </button>
                          ))}
                          {snapGridEnabled ? <div style={gridOverlayStyle} /> : null}
                        {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                          <button
                            key={obj.id}
                            type="button"
                            className={`editor-hotspot editor-scene-object ${(obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id)) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                            style={getSceneObjectStyle(obj)}
                            onPointerDown={(event) => beginObjectDrag(event, obj.id, 'fullscreen')}
                            onClick={(event) => selectSceneObject(obj.id, event)}
                          >
                            {obj.imageData ? <img src={obj.imageData} alt={obj.name} style={getSceneObjectImageStyle()} /> : <span>{obj.name}</span>}
                          </button>
                        ))}
                        {selectedScene.hotspots.filter((spot) => !spot.isHidden).map((spot) => (
                          <button
                            key={spot.id}
                            type="button"
                            className={`editor-hotspot ${(spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id)) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                            style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot') }}
                            onPointerDown={(event) => beginDrag(event, spot.id, 'fullscreen')}
                            onClick={(event) => selectHotspot(spot.id, event)}
                          >
                            <span>{spot.name}</span>
                          </button>
                        ))}
                        </div>
                        <MiniMap {...miniMapProps} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0, minHeight: 0 }}>
                    <section className="panel side panel-context-pro fullscreen-context-panel" style={{ margin: 0, overflow: 'auto', flex: '1 1 auto', minHeight: 0, height: 'auto', maxHeight: 'none', position: 'relative', top: 'auto' }}>
                      <div className="panel-head panel-head-stack">
                        <div>
                          <span className="section-kicker">Contexte</span>
                          <h2>{selectedItem ? 'Objet sélectionné' : selectedSceneObject ? 'Objet visible sélectionné' : 'Zone sélectionnée'}</h2>
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
                          <label className="button like full secondary-action">
                            {selectedItem.imageName || 'Importer une image objet'}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                              const item = draft.items.find((entry) => entry.id === selectedItemId);
                              if (item) {
                                item.imageData = data;
                                item.imageName = name;
                              }
                            }))} />
                          </label>
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
                        <>
                          <HelpLabel help="Nom interne de l’objet visible. Il aide à le retrouver dans les calques et les listes de l’éditeur.">Nom</HelpLabel>
                          <input value={selectedSceneObject.name} onChange={(e) => patchProject((draft) => {
                            const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.name = e.target.value;
                          })} />
                          <div className="grid-two small-gap">
                            <div><HelpLabel help="Position horizontale du centre de l’objet, en pourcentage de la largeur de l’image. 0 est le bord gauche, 100 le bord droit.">X</HelpLabel><input type="number" value={selectedSceneObject.x} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.x = Number(e.target.value); })} /></div>
                            <div><HelpLabel help="Position verticale du centre de l’objet, en pourcentage de la hauteur de l’image. 0 est le haut, 100 le bas.">Y</HelpLabel><input type="number" value={selectedSceneObject.y} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.y = Number(e.target.value); })} /></div>
                            <div><HelpLabel help="Largeur de la zone cliquable et de l’image visible, en pourcentage de la largeur de la scène.">Largeur</HelpLabel><input type="number" value={selectedSceneObject.width} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.width = Number(e.target.value); })} /></div>
                            <div><HelpLabel help="Hauteur de la zone cliquable et de l’image visible, en pourcentage de la hauteur de la scène.">Hauteur</HelpLabel><input type="number" value={selectedSceneObject.height} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.height = Number(e.target.value); })} /></div>
                          </div>
                          <HelpLabel help="Image affichée directement dans la scène, à l’emplacement X/Y. L’objet reste cliquable même si l’image est transparente.">Image visible</HelpLabel>
                          <label className="button like full secondary-action">
                            {selectedSceneObject.imageName || 'Importer une image visible'}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                              const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) { obj.imageData = data; obj.imageName = name; }
                            }))} />
                          </label>
                          <HelpLabel help="Image montrée en grand quand l’objet visible déclenche un pop-up. Utile pour inspecter un document, un détail ou un indice.">Image pop-up</HelpLabel>
                          <label className="button like full secondary-action">
                            {selectedSceneObject.popupImageName || 'Importer une image pop-up'}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                              const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) { obj.popupImage = data; obj.popupImageName = name; }
                            }))} />
                          </label>
                          <HelpLabel help="Définit ce qui se passe au clic : montrer un pop-up, ajouter l’objet lié à l’inventaire, ou faire les deux.">Mode d’interaction</HelpLabel>
                          <select value={selectedSceneObject.interactionMode || 'popup'} onChange={(e) => patchProject((draft) => {
                            const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.interactionMode = e.target.value;
                          })}>
                            <option value="popup">Pop-up uniquement</option>
                            <option value="inventory">Inventaire uniquement</option>
                            <option value="both">Pop-up + inventaire</option>
                          </select>
                          <HelpLabel help="Objet ajouté à l’inventaire si le mode inclut l’inventaire. Sans sélection, le clic ne donne aucun objet.">Objet d’inventaire lié</HelpLabel>
                          <select value={selectedSceneObject.linkedItemId || ''} onChange={(e) => patchProject((draft) => {
                            const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.linkedItemId = e.target.value;
                          })}>
                            <option value="">Aucun</option>
                            {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                          </select>
                          <HelpLabel help="Texte affiché quand le joueur interagit avec cet objet visible. Pratique pour donner un indice sans créer une zone séparée.">Dialogue</HelpLabel>
                          <textarea value={selectedSceneObject.dialogue || ''} onChange={(e) => patchProject((draft) => {
                            const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.dialogue = e.target.value;
                          })} />
                          <label className="checkbox-row">
                            <input
                              type="checkbox"
                              checked={Boolean(selectedSceneObject.removeAfterUse)}
                              onChange={(e) => patchProject((draft) => {
                                const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.removeAfterUse = e.target.checked;
                              })}
                            />
                            Retirer l’objet visible après interaction ?
                          </label>
                          <p className="small-note help-inline-note">Quand c’est activé, l’objet disparaît de la scène après son utilisation réussie, par exemple une clé ramassée.</p>
                          <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                            if (!window.confirm(`Supprimer l'objet visible "${selectedSceneObject.name}" ?`)) return;
                            patchProject((draft) => {
                              const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                              if (!scene?.sceneObjects) return;
                              scene.sceneObjects = scene.sceneObjects.filter((entry) => entry.id !== selectedSceneObjectId);
                            });
                            setSelectedSceneObjectId('');
                          }}>Supprimer l’objet visible</button>
                        </>
                      ) : selectedHotspot ? (
                        <>
                          <HelpLabel help="Nom de la zone d’action dans l’éditeur. Choisis un nom qui décrit l’intention, par exemple “Porte verrouillée”.">Nom</HelpLabel>
                          <input value={selectedHotspot.name} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.name = e.target.value;
                          })} />
                          <div className="grid-two small-gap">
                            <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l’image.">X</HelpLabel><input type="number" value={selectedHotspot.x} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.x = Number(e.target.value); })} /></div>
                            <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l’image.">Y</HelpLabel><input type="number" value={selectedHotspot.y} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.y = Number(e.target.value); })} /></div>
                            <div><HelpLabel help="Largeur de la zone cliquable. Augmente-la si le joueur risque de manquer la cible.">Largeur</HelpLabel><input type="number" value={selectedHotspot.width} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.width = Number(e.target.value); })} /></div>
                            <div><HelpLabel help="Hauteur de la zone cliquable. Une zone trop petite peut être difficile à trouver sur mobile.">Hauteur</HelpLabel><input type="number" value={selectedHotspot.height} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.height = Number(e.target.value); })} /></div>
                          </div>
                          <HelpLabel help="Action principale déclenchée par cette zone après validation des prérequis éventuels : dialogue, objet, changement de scène ou cinématique.">Action</HelpLabel>
                          <select value={selectedHotspot.actionType} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.actionType = e.target.value;
                          })}>
                            <option value="dialogue">Dialogue</option>
                            <option value="dialogue_item">Dialogue + objet</option>
                            <option value="scene">Changer de scène</option>
                            <option value="cinematic">Lancer une cinématique</option>
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
                          <HelpLabel help="Cinématique lancée après l’interaction réussie. Elle peut servir de transition, révélation ou fin de séquence.">Cinématique cible</HelpLabel>
                          <select value={selectedHotspot.targetCinematicId} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetCinematicId = e.target.value;
                          })}>
                            <option value="">Aucune</option>
                            {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                          </select>
                          <HelpLabel help="Énigme à résoudre avant d’exécuter l’action de la zone. Si elle échoue ou reste ouverte, la suite ne se déclenche pas encore.">Énigme liée</HelpLabel>
                          <select value={selectedHotspot.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.enigmaId = e.target.value;
                          })}>
                            <option value="">Aucune</option>
                            {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                          </select>
                          <HelpLabel help="Son joué au moment où cette zone est utilisée. Garde-le court pour ne pas couvrir la musique ou les dialogues.">Son de la zone</HelpLabel>
                          <label className="button like full secondary-action">
                            {selectedHotspot.soundName || 'Importer un son unique'}
                            <input type="file" accept="audio/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                              const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                              if (spot) {
                                spot.soundData = data;
                                spot.soundName = name;
                              }
                            }))} />
                          </label>
                          {selectedHotspot.soundData && (
                            <>
                              <audio controls preload="metadata" src={selectedHotspot.soundData} style={{ width: '100%', marginTop: 10 }} />
                              <button
                                type="button"
                                className="danger-button"
                                style={{ marginTop: 12 }}
                              onClick={() => {
                                if (!window.confirm('Supprimer le son de cette zone ?')) return;
                                patchProject((draft) => {
                                  const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                                  if (spot) {
                                    spot.soundData = '';
                                    spot.soundName = '';
                                  }
                                });
                              }}
                              >
                                Supprimer le son ?
                              </button>
                            </>
                          )}
                          <HelpLabel help="Image associée à l’action principale de cette zone, souvent utilisée pour montrer un objet trouvé ou un indice visuel.">Image objet</HelpLabel>
                          <label className="button like full secondary-action">
                            {selectedHotspot.objectImageName ? 'Remplacer l’image objet' : 'Importer une image objet'}
                            <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                              const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                              if (spot) { spot.objectImageData = data; spot.objectImageName = name; }
                            }))} />
                          </label>
                          {selectedHotspot.objectImageData && (
                            <button
                              className="danger-button"
                              style={{ marginTop: 12 }}
                              onClick={() => {
                                if (!window.confirm("Supprimer l'image de cette zone ?")) return;
                                patchProject((draft) => {
                                const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                                if (spot) {
                                  spot.objectImageData = '';
                                  spot.objectImageName = '';
                                }
                                });
                              }}
                            >
                              Supprimer l’image ?
                            </button>
                          )}
                          <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                            if (!window.confirm(`Supprimer la zone "${selectedHotspot.name}" ?`)) return;
                            deleteHotspot(selectedSceneId, selectedHotspotId);
                          }}>Supprimer la zone</button>
                        </>
                      ) : (
                        <div className="placeholder small">Sélectionne une zone, un objet visible ou un objet d’inventaire.</div>
                      )}
                    </section>
                    <div className="logic-reminder-card logic-reminder-card--fullscreen">
                      <p>Besoin de conditions ? Ajoute des règles dans l’onglet Logique pour changer le comportement d’une zone selon l’inventaire, une énigme, une cinématique ou une autre action.</p>
                      <button type="button" className="secondary-action" onClick={() => setTab?.('logic')}>
                        Ouvrir l’onglet Logique
                      </button>
                    </div>
                    </div>
                  </div>
                </div>
  );
}
