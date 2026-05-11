import { useEffect, useMemo, useState } from 'react';
import SceneVisualEffect, { VISUAL_EFFECT_INTENSITY_OPTIONS, getVisualEffectZoneZIndex } from './SceneVisualEffect.jsx';
import VisualEffectCascadeMenu from './VisualEffectCascadeMenu.jsx';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import { showConfirm } from './AccessibleDialog';
import { HelpLabel } from './scenes/SceneEditorChrome.jsx';
import { getElementShapeStyle, getLayerZIndex, getSceneObjectImageStyle, getSceneObjectStyle } from './scenes/sceneEditorUtils.js';
import {
  calculateImageAspectRatio,
  calculateImageDimensions,
  clearSceneAmbientSoundAsset,
  clearSceneMusicAsset,
  getSceneAspectRatio,
  getSceneMediaStatus,
  getSceneObjectAssetSource,
  resolveAssetUrl,
  setSceneAmbientSoundAsset,
  setSceneBackgroundAspectRatio,
  setSceneBackgroundAsset,
  setSceneBackgroundDimensions,
  setSceneMusicAsset,
} from '../lib/assetManager.js';

const SCENE_TRANSITION_OPTIONS = [
  { value: 'none', label: 'Aucune' },
  { value: 'fade', label: 'Fondu' },
  { value: 'blur', label: 'Flou' },
  { value: 'dissolve', label: 'Dissolution' },
  { value: 'slide-left', label: 'Glisse gauche' },
  { value: 'slide-right', label: 'Glisse droite' },
  { value: 'slide-up', label: 'Glisse haut' },
  { value: 'slide-down', label: 'Glisse bas' },
  { value: 'wipe-left', label: 'Volet gauche' },
  { value: 'wipe-right', label: 'Volet droite' },
  { value: 'wipe-up', label: 'Volet haut' },
  { value: 'wipe-down', label: 'Volet bas' },
  { value: 'zoom', label: 'Zoom' },
  { value: 'zoom-spin', label: 'Zoom rotation' },
  { value: 'iris', label: 'Iris' },
  { value: 'flip', label: 'Flip' },
  { value: 'rotate', label: 'Rotation' },
  { value: 'curtain', label: 'Rideau' },
  { value: 'split-horizontal', label: 'Split horizontal' },
  { value: 'split-vertical', label: 'Split vertical' },
  { value: 'cinematic-bars', label: 'Bandes cinema' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'pixel', label: 'Pixel' },
  { value: 'burn', label: 'Brulure lumière' },
  { value: 'flash', label: 'Flash' },
];

const SCENE_TRANSITION_DURATION_OPTIONS = [
  { value: 450, label: 'Rapide' },
  { value: 700, label: 'Normal' },
  { value: 1000, label: 'Lent' },
  { value: 1400, label: 'Très lent' },
];

const SCENE_TIMER_ACTION_OPTIONS = [
  { value: 'none', label: 'Rien' },
  { value: 'scene', label: 'Aller à une scène' },
  { value: 'restart-scene', label: 'Relancer cette scène' },
  { value: 'restart-preview', label: 'Recommencer le jeu' },
  { value: 'damage-life', label: 'Perdre des vies' },
  { value: 'dialogue', label: 'Afficher un message' },
  { value: 'cinematic', label: 'Lancer une cinématique' },
];

const formatTimerSeconds = (seconds = 0) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
};

export default function MediaTab({
  project,
  selectedScene,
  selectedSceneId,
  setSelectedSceneId,
  setSelectedHotspotId,
  patchProject,
  handleUpload,
  mediaLibrary = [],
  getSceneLabel,
}) {
  const sceneAspectRatio = getSceneAspectRatio(selectedScene);
  const getSceneObjectDisplayImage = (obj) => getSceneObjectAssetSource(obj, project.items || []);
  const selectedBackgroundUrl = resolveAssetUrl(project, selectedScene?.backgroundId, selectedScene?.backgroundData);
  const selectedMusicUrl = resolveAssetUrl(project, selectedScene?.musicId, selectedScene?.musicData);
  const selectedAmbientSoundUrl = resolveAssetUrl(project, selectedScene?.ambientSoundId, selectedScene?.ambientSoundData);
  const [transitionPreviewTargetId, setTransitionPreviewTargetId] = useState('');
  const [transitionPreviewKey, setTransitionPreviewKey] = useState(0);
  const transitionPreviewTarget = useMemo(
    () => project.scenes.find((scene) => scene.id === transitionPreviewTargetId) || null,
    [project.scenes, transitionPreviewTargetId],
  );
  const transitionPreviewTargetBackgroundUrl = resolveAssetUrl(
    project,
    transitionPreviewTarget?.backgroundId,
    transitionPreviewTarget?.backgroundData,
  );
  const transitionPreviewTargets = useMemo(
    () => project.scenes.filter((scene) => scene.id !== selectedSceneId),
    [project.scenes, selectedSceneId],
  );
  const selectedTransition = selectedScene?.sceneTransition || 'none';
  const selectedTransitionDuration = Number(selectedScene?.sceneTransitionDuration) || 700;
  const selectedTimerAction = selectedScene?.timerEndAction || 'none';
  const mediaStatusItems = getSceneMediaStatus(selectedScene);

  useEffect(() => {
    if (!transitionPreviewTargets.length) {
      setTransitionPreviewTargetId('');
      return;
    }
    if (!transitionPreviewTargets.some((scene) => scene.id === transitionPreviewTargetId)) {
      setTransitionPreviewTargetId(transitionPreviewTargets[0].id);
    }
  }, [transitionPreviewTargetId, transitionPreviewTargets]);

  const rememberSceneBackgroundAspectRatio = (image, sceneId = selectedSceneId) => {
    const nextRatio = calculateImageAspectRatio(image);
    const dimensions = calculateImageDimensions(image);
    if (!nextRatio || !sceneId) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === sceneId);
      setSceneBackgroundAspectRatio(scene, nextRatio);
      if (dimensions) setSceneBackgroundDimensions(scene, dimensions.width, dimensions.height, draft);
    }, { rememberHistory: false });
  };

  const updateSceneBackground = (data, name) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      setSceneBackgroundAsset(scene, data, name, draft);
    });

    const image = new Image();
    image.onload = () => rememberSceneBackgroundAspectRatio(image);
    image.src = data;
  };

  return (
    <div className="layout media-layout-pro">
      <section className="panel main panel-main-pro">
        <div className="media-topline">
          <div>
            <span className="section-kicker">Média</span>
            <h2>{selectedScene?.name || 'Aucune scène'}</h2>
          </div>
          <div className="media-scene-picker">
            <HelpLabel help="Choisis la scène dont tu veux régler les images, sons et effets.">Scène</HelpLabel>
            <select value={selectedSceneId || ''} onChange={(event) => {
              setSelectedSceneId(event.target.value);
              const target = project.scenes.find((scene) => scene.id === event.target.value);
              setSelectedHotspotId(target?.hotspots?.[0]?.id || '');
            }}>
              {project.scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
              ))}
            </select>
          </div>
          {selectedScene ? (
            <div className="media-status-strip">
              {mediaStatusItems.map((item) => (
                <span key={item.label} className={`media-status-pill ${item.ready ? 'ready' : ''}`}>
                  {item.label}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {selectedScene ? (
          <>
            <div className="media-editor-grid">
              <div className="editor-stack">
              <div className="subpanel media-visuals-card">
                <div className="subpanel-head"><h3>Visuels</h3></div>
                <div className="media-background-line">
                  <strong>{selectedScene.backgroundName || 'Aucune image de fond'}</strong>
                  <MediaSourcePicker
                    className="button like secondary-action"
                    accept="image/*"
                    assetScope="scene-background"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={updateSceneBackground}
                    tourId="media-background-image"
                  >
                    {selectedBackgroundUrl ? 'Remplacer le fond' : 'Importer une image'}
                  </MediaSourcePicker>
                </div>
                <div className="compact-form-grid">
                  <div data-tour="media-visual-effect">
                    <HelpLabel help="Filtre ou effet appliqué à toute la scène.">Effet global</HelpLabel>
                    <VisualEffectCascadeMenu
                      value={selectedScene.visualEffect || 'none'}
                      includeNone
                      onChange={(nextEffect) => patchProject((draft) => {
                        const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                        if (scene) scene.visualEffect = nextEffect;
                      })}
                    />
                  </div>
                  <div>
                    <HelpLabel help="Force du filtre ou de l'effet global.">Intensite globale</HelpLabel>
                    <select value={selectedScene.visualEffectIntensity || 'normal'} onChange={(event) => patchProject((draft) => {
                      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                      if (scene) scene.visualEffectIntensity = event.target.value;
                    })}>
                      {VISUAL_EFFECT_INTENSITY_OPTIONS.map((intensity) => (
                        <option key={intensity.value} value={intensity.value}>{intensity.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Transition jouée quand le joueur quitte cette scène vers une autre scène.">Transition de sortie</HelpLabel>
                    <select value={selectedTransition} onChange={(event) => patchProject((draft) => {
                      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                      if (scene) scene.sceneTransition = event.target.value;
                    })}>
                      {SCENE_TRANSITION_OPTIONS.map((transition) => (
                        <option key={transition.value} value={transition.value}>{transition.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Vitesse de la transition entre les deux scènes.">Durée</HelpLabel>
                    <select value={selectedTransitionDuration} onChange={(event) => patchProject((draft) => {
                      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                      if (scene) scene.sceneTransitionDuration = Number(event.target.value);
                    })}>
                      {SCENE_TRANSITION_DURATION_OPTIONS.map((duration) => (
                        <option key={duration.value} value={duration.value}>{duration.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Scène utilisée uniquement pour rejouer la transition dans l'aperçu Média.">Scène d'arrivée test</HelpLabel>
                    <select
                      value={transitionPreviewTargetId}
                      disabled={!transitionPreviewTargets.length}
                      onChange={(event) => setTransitionPreviewTargetId(event.target.value)}
                    >
                      {transitionPreviewTargets.length ? transitionPreviewTargets.map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                      )) : <option value="">Ajoute une autre scène</option>}
                    </select>
                  </div>
                  <div className="media-transition-test-action">
                    <button
                      type="button"
                      className="secondary-action full"
                      disabled={selectedTransition === 'none' || !transitionPreviewTarget}
                      onClick={() => setTransitionPreviewKey((key) => key + 1)}
                    >
                      Tester la transition
                    </button>
                  </div>
                </div>
              </div>

              <div className="subpanel media-audio-panel" data-tour="media-ambient-sound">
                <div className="subpanel-head"><h3>Musique</h3></div>
                <div className="music-compact-row media-audio-card" data-tour="media-music">
                  <MediaSourcePicker
                    className="button like full secondary-action"
                    accept="audio/*"
                    assetScope="scene-music"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={(data, name) => patchProject((draft) => {
                      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                      setSceneMusicAsset(scene, data, name, draft);
                    })}
                  >
                    {selectedScene.musicName || 'Importer une musique'}
                  </MediaSourcePicker>
                  {selectedMusicUrl ? (
                    <>
                      <audio controls preload="metadata" src={selectedMusicUrl} />
                      <div className="music-compact-actions">
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={selectedScene.musicLoop !== false}
                            onChange={(event) => patchProject((draft) => {
                              const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                              if (scene) scene.musicLoop = event.target.checked;
                            })}
                          />
                          Bouclé
                        </label>
                        <button type="button" className="danger-button" onClick={async () => {
                          const confirmed = await showConfirm({
                            title: 'Supprimer la musique',
                            message: 'Supprimer la musique de cette scène ?',
                            confirmLabel: 'Supprimer',
                            variant: 'danger',
                          });
                          if (!confirmed) return;
                          patchProject((draft) => {
                            const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                            clearSceneMusicAsset(scene, draft);
                          });
                        }}>
                          Supprimer
                        </button>
                      </div>
                    </>
                  ) : <p className="small-note">Aucune musique n'est attachée à cette scène.</p>}
                </div>
              </div>

              <div className="subpanel media-audio-panel">
                <div className="subpanel-head"><h3>Son secondaire</h3></div>
                <div className="music-compact-row media-audio-card">
                  <MediaSourcePicker
                    className="button like full secondary-action"
                    accept="audio/*"
                    assetScope="scene-ambient"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={(data, name) => patchProject((draft) => {
                      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                      setSceneAmbientSoundAsset(scene, data, name, draft);
                    })}
                  >
                    {selectedScene.ambientSoundName || 'Importer un son'}
                  </MediaSourcePicker>
                  {selectedAmbientSoundUrl ? (
                    <>
                      <audio controls preload="metadata" src={selectedAmbientSoundUrl} />
                      <div className="music-compact-actions">
                        <label className="checkbox-row">
                          <input
                            type="checkbox"
                            checked={Boolean(selectedScene.ambientSoundLoop)}
                            onChange={(event) => patchProject((draft) => {
                              const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                              if (scene) scene.ambientSoundLoop = event.target.checked;
                            })}
                          />
                          Bouclé
                        </label>
                        <button type="button" className="danger-button" onClick={async () => {
                          const confirmed = await showConfirm({
                            title: 'Supprimer le son',
                            message: 'Supprimer le son secondaire de cette scène ?',
                            confirmLabel: 'Supprimer',
                            variant: 'danger',
                          });
                          if (!confirmed) return;
                          patchProject((draft) => {
                            const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                            clearSceneAmbientSoundAsset(scene, draft);
                          });
                        }}>
                          Supprimer
                        </button>
                      </div>
                    </>
                  ) : <p className="small-note">Aucun son secondaire n'est attaché à cette scène.</p>}
                </div>
              </div>

              <div className="subpanel media-zones-panel">
                <div className="subpanel-head"><h3>Zones visuelles</h3></div>
                {(selectedScene.visualEffectZones || []).length ? (
                  <div className="media-zone-list">
                    {(selectedScene.visualEffectZones || []).map((zone) => (
                      <div key={zone.id} className="media-zone-row">
                        <strong>{zone.name}</strong>
                        <VisualEffectCascadeMenu
                          value={zone.effect || 'sparkles'}
                          onChange={(nextEffect) => patchProject((draft) => {
                            const target = draft.scenes.find((entry) => entry.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === zone.id);
                            if (target) target.effect = nextEffect;
                          })}
                        />
                        <select value={zone.intensity || 'normal'} onChange={(event) => patchProject((draft) => {
                          const target = draft.scenes.find((entry) => entry.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === zone.id);
                          if (target) target.intensity = event.target.value;
                        })}>
                          {VISUAL_EFFECT_INTENSITY_OPTIONS.map((intensity) => (
                            <option key={intensity.value} value={intensity.value}>{intensity.label}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                ) : <div className="empty-state-inline">Aucune zone visuelle pour cette scène.</div>}
              </div>
            </div>

              <div className="subpanel media-preview-panel">
              <div className="subpanel-head"><h3>Aperçu de la scène</h3></div>
              <div className="editor-canvas editor-canvas-pro media-scene-preview" data-tour="media-preview" style={{ aspectRatio: sceneAspectRatio }}>
                {selectedBackgroundUrl ? (
                  <img loading="eager" decoding="async" fetchPriority="high" src={selectedBackgroundUrl} alt="fond" onLoad={(event) => rememberSceneBackgroundAspectRatio(event.currentTarget)} />
                ) : <div className="placeholder">Ajoute une image dans Média</div>}
                <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
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
                {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                  <div key={obj.id} className={`editor-hotspot editor-scene-object media-preview-object ${obj.isInvisible ? 'editor-scene-object-invisible' : ''}`} style={getSceneObjectStyle(obj)}>
                    {getSceneObjectDisplayImage(obj) && !obj.isInvisible ? <img loading="lazy" decoding="async" src={getSceneObjectDisplayImage(obj)} alt={obj.name} style={getSceneObjectImageStyle()} /> : <span>{obj.isInvisible ? `${obj.name || 'Objet'} (invisible)` : obj.name}</span>}
                  </div>
                ))}
                {(selectedScene.hotspots || []).filter((spot) => !spot.isHidden).map((spot) => (
                  <div key={spot.id} className="editor-hotspot media-preview-hotspot" style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot'), ...getElementShapeStyle(spot) }}>
                    <span>{spot.name}</span>
                  </div>
                ))}
                {selectedScene.timerEnabled ? (
                  <div className="scene-timer-hud media-timer-hud">
                    <strong>{formatTimerSeconds(selectedScene.timerSeconds || 60)}</strong>
                    <span>{SCENE_TIMER_ACTION_OPTIONS.find((action) => action.value === selectedTimerAction)?.label || 'Fin du temps'}</span>
                  </div>
                ) : null}
                {transitionPreviewKey > 0 && selectedTransition !== 'none' && transitionPreviewTarget ? (
                  <div
                    key={transitionPreviewKey}
                    className={`scene-transition-demo scene-transition-demo--${selectedTransition}`}
                    style={{ '--scene-transition-duration': `${selectedTransitionDuration}ms` }}
                  >
                    {selectedBackgroundUrl ? (
                      <img loading="lazy" decoding="async" src={selectedBackgroundUrl} alt="" />
                    ) : <div className="placeholder">Scène de départ</div>}
                    {transitionPreviewTargetBackgroundUrl ? (
                      <img loading="lazy" decoding="async" src={transitionPreviewTargetBackgroundUrl} alt="" />
                    ) : <div className="placeholder">Scène d'arrivée</div>}
                  </div>
                ) : null}
              </div>
              </div>
            </div>
          </>
        ) : <div className="empty-state-inline">Crée une scène pour gerer ses médias.</div>}
      </section>
    </div>
  );
}
