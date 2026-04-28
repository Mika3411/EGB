import { useEffect, useMemo, useState } from 'react';
import SceneVisualEffect, { VISUAL_EFFECT_INTENSITY_OPTIONS, getVisualEffectZoneZIndex } from './SceneVisualEffect.jsx';
import VisualEffectCascadeMenu from './VisualEffectCascadeMenu.jsx';
import { HelpLabel } from './scenes/SceneEditorChrome.jsx';
import { getLayerZIndex, getSceneObjectImageStyle, getSceneObjectStyle } from './scenes/sceneEditorUtils.js';

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
  { value: 'burn', label: 'Brulure lumiere' },
  { value: 'flash', label: 'Flash' },
];

const SCENE_TRANSITION_DURATION_OPTIONS = [
  { value: 450, label: 'Rapide' },
  { value: 700, label: 'Normal' },
  { value: 1000, label: 'Lent' },
  { value: 1400, label: 'Tres lent' },
];

const SCENE_TIMER_ACTION_OPTIONS = [
  { value: 'none', label: 'Rien' },
  { value: 'scene', label: 'Aller a une scene' },
  { value: 'restart-scene', label: 'Relancer cette scene' },
  { value: 'restart-preview', label: 'Recommencer le jeu' },
  { value: 'damage-life', label: 'Perdre des vies' },
  { value: 'dialogue', label: 'Afficher un message' },
  { value: 'cinematic', label: 'Lancer une cinematique' },
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
  getSceneLabel,
}) {
  const sceneAspectRatio = Number(selectedScene?.backgroundAspectRatio) > 0 ? Number(selectedScene.backgroundAspectRatio) : 1.6;
  const [transitionPreviewTargetId, setTransitionPreviewTargetId] = useState('');
  const [transitionPreviewKey, setTransitionPreviewKey] = useState(0);
  const transitionPreviewTarget = useMemo(
    () => project.scenes.find((scene) => scene.id === transitionPreviewTargetId) || null,
    [project.scenes, transitionPreviewTargetId],
  );
  const transitionPreviewTargets = useMemo(
    () => project.scenes.filter((scene) => scene.id !== selectedSceneId),
    [project.scenes, selectedSceneId],
  );
  const selectedTransition = selectedScene?.sceneTransition || 'none';
  const selectedTransitionDuration = Number(selectedScene?.sceneTransitionDuration) || 700;
  const selectedTimerAction = selectedScene?.timerEndAction || 'none';

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
    if (!image?.naturalWidth || !image?.naturalHeight || !sceneId) return;
    const nextRatio = Number((image.naturalWidth / image.naturalHeight).toFixed(4));
    if (!Number.isFinite(nextRatio) || nextRatio <= 0) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === sceneId);
      if (scene) scene.backgroundAspectRatio = nextRatio;
    }, { rememberHistory: false });
  };

  const updateSceneBackground = (data, name) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (scene) {
        scene.backgroundData = data;
        scene.backgroundName = name;
        scene.backgroundAspectRatio = 1.6;
      }
    });

    const image = new Image();
    image.onload = () => rememberSceneBackgroundAspectRatio(image);
    image.src = data;
  };

  return (
    <div className="layout media-layout-pro">
      <section className="panel side panel-nav-pro">
        <div className="panel-head panel-head-stack">
          <div>
            <span className="section-kicker">Bibliotheque</span>
            <h2>Media</h2>
          </div>
        </div>
        <HelpLabel help="Choisis la scene dont tu veux regler les images, sons et effets.">Scene</HelpLabel>
        <select value={selectedSceneId || ''} onChange={(event) => {
          setSelectedSceneId(event.target.value);
          const target = project.scenes.find((scene) => scene.id === event.target.value);
          setSelectedHotspotId(target?.hotspots?.[0]?.id || '');
        }}>
          {project.scenes.map((scene) => (
            <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
          ))}
        </select>
        <p className="small-note">Centralise ici les fonds, musiques, filtres lens et effets visuels. L'editeur de scenes reste concentre sur le placement.</p>
      </section>

      <section className="panel main panel-main-pro">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Ambiance</span>
            <h2>{selectedScene?.name || 'Aucune scene'}</h2>
          </div>
        </div>

        {selectedScene ? (
          <div className="media-editor-grid">
            <div className="editor-stack">
              <div className="subpanel">
                <div className="subpanel-head"><h3>Visuels</h3></div>
                <div className="compact-form-grid">
                  <div>
                    <HelpLabel help="Image principale vue par le joueur dans cette scene.">Image de fond</HelpLabel>
                    <label className="button like full secondary-action">
                      {selectedScene.backgroundName || 'Importer une image'}
                      <input type="file" accept="image/*" hidden onChange={(event) => handleUpload(event, updateSceneBackground)} />
                    </label>
                  </div>
                  <div>
                    <HelpLabel help="Filtre ou effet applique a toute la scene.">Effet global</HelpLabel>
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
                    <HelpLabel help="Transition jouee quand le joueur quitte cette scene vers une autre scene.">Transition de sortie</HelpLabel>
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
                    <HelpLabel help="Vitesse de la transition entre les deux scenes.">Duree</HelpLabel>
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
                    <HelpLabel help="Scene utilisee uniquement pour rejouer la transition dans l'apercu Media.">Scene d'arrivee test</HelpLabel>
                    <select
                      value={transitionPreviewTargetId}
                      disabled={!transitionPreviewTargets.length}
                      onChange={(event) => setTransitionPreviewTargetId(event.target.value)}
                    >
                      {transitionPreviewTargets.length ? transitionPreviewTargets.map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                      )) : <option value="">Ajoute une autre scene</option>}
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

              <div className="subpanel">
                <div className="subpanel-head"><h3>Musique</h3></div>
                <div className="music-compact-row">
                  <label className="button like full secondary-action">
                    {selectedScene.musicName || 'Importer une musique'}
                    <input type="file" accept="audio/*" hidden onChange={(event) => handleUpload(event, (data, name) => patchProject((draft) => {
                      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                      if (scene) {
                        scene.musicData = data;
                        scene.musicName = name;
                        if (typeof scene.musicLoop !== 'boolean') scene.musicLoop = true;
                      }
                    }))} />
                  </label>
                  {selectedScene.musicData ? (
                    <>
                      <audio controls src={selectedScene.musicData} />
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
                          Boucle
                        </label>
                        <button type="button" className="danger-button" onClick={() => {
                          if (!window.confirm('Supprimer la musique de cette scène ?')) return;
                          patchProject((draft) => {
                          const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                          if (scene) {
                            scene.musicData = '';
                            scene.musicName = '';
                            scene.musicLoop = true;
                          }
                          });
                        }}>
                          Supprimer
                        </button>
                      </div>
                    </>
                  ) : <p className="small-note">Aucune musique n'est attachee a cette scene.</p>}
                </div>
              </div>

              <div className="subpanel">
                <div className="subpanel-head"><h3>Temps de scene</h3></div>
                <div className="compact-form-grid">
                  <label className="checkbox-row media-timer-toggle">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedScene.timerEnabled)}
                      onChange={(event) => patchProject((draft) => {
                        const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                        if (scene) scene.timerEnabled = event.target.checked;
                      })}
                    />
                    Activer un compte a rebours
                  </label>
                  <div>
                    <HelpLabel help="Duree disponible dans cette scene avant l'action automatique.">Duree</HelpLabel>
                    <input
                      type="number"
                      min="5"
                      max="3600"
                      step="5"
                      value={selectedScene.timerSeconds || 60}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => patchProject((draft) => {
                        const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                        if (scene) scene.timerSeconds = Math.max(5, Math.min(3600, Number(event.target.value) || 60));
                      })}
                    />
                  </div>
                  <div>
                    <HelpLabel help="Action declenchee quand le temps arrive a zero.">Fin du temps</HelpLabel>
                    <select
                      value={selectedTimerAction}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => patchProject((draft) => {
                        const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                        if (scene) scene.timerEndAction = event.target.value;
                      })}
                    >
                      {SCENE_TIMER_ACTION_OPTIONS.map((action) => (
                        <option key={action.value} value={action.value}>{action.label}</option>
                      ))}
                    </select>
                  </div>
                  {selectedTimerAction === 'scene' || selectedTimerAction === 'damage-life' ? (
                    <div>
                      <HelpLabel help="Scene ouverte a la fin du temps, ou quand les vies tombent a zero.">Scene cible</HelpLabel>
                      <select
                        value={selectedScene.timerTargetSceneId || ''}
                        disabled={!selectedScene.timerEnabled}
                        onChange={(event) => patchProject((draft) => {
                          const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                          if (scene) scene.timerTargetSceneId = event.target.value;
                        })}
                      >
                        <option value="">Aucune</option>
                        {project.scenes.map((scene) => (
                          <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {selectedTimerAction === 'cinematic' ? (
                    <div>
                      <HelpLabel help="Cinematique lancee automatiquement quand le temps arrive a zero.">Cinematique cible</HelpLabel>
                      <select
                        value={selectedScene.timerTargetCinematicId || ''}
                        disabled={!selectedScene.timerEnabled}
                        onChange={(event) => patchProject((draft) => {
                          const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                          if (scene) scene.timerTargetCinematicId = event.target.value;
                        })}
                      >
                        <option value="">Aucune</option>
                        {(project.cinematics || []).map((cinematic) => (
                          <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                  {selectedTimerAction === 'damage-life' ? (
                    <div>
                      <HelpLabel help="Nombre de vies perdues quand le temps expire. Le joueur commence avec 3 vies dans l'apercu.">Vies perdues</HelpLabel>
                      <input
                        type="number"
                        min="1"
                        max="9"
                        value={selectedScene.timerLifeLoss || 1}
                        disabled={!selectedScene.timerEnabled}
                        onChange={(event) => patchProject((draft) => {
                          const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                          if (scene) scene.timerLifeLoss = Math.max(1, Math.min(9, Number(event.target.value) || 1));
                        })}
                      />
                    </div>
                  ) : null}
                  <div className="media-timer-message-field">
                    <HelpLabel help="Texte affiche si l'action de fin a besoin d'un message.">Message de fin</HelpLabel>
                    <input
                      value={selectedScene.timerEndMessage || ''}
                      disabled={!selectedScene.timerEnabled}
                      onChange={(event) => patchProject((draft) => {
                        const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
                        if (scene) scene.timerEndMessage = event.target.value;
                      })}
                      placeholder="Le temps est ecoule."
                    />
                  </div>
                </div>
              </div>

              <div className="subpanel">
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
                ) : <div className="empty-state-inline">Aucune zone visuelle pour cette scene.</div>}
              </div>
            </div>

            <div className="subpanel media-preview-panel">
              <div className="subpanel-head"><h3>Apercu de la scene</h3></div>
              <div className="editor-canvas editor-canvas-pro media-scene-preview" style={{ aspectRatio: sceneAspectRatio }}>
                {selectedScene.backgroundData ? (
                  <img src={selectedScene.backgroundData} alt="fond" onLoad={(event) => rememberSceneBackgroundAspectRatio(event.currentTarget)} />
                ) : <div className="placeholder">Ajoute une image dans Media</div>}
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
                    }}
                  />
                ))}
                {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                  <div key={obj.id} className="editor-hotspot editor-scene-object media-preview-object" style={getSceneObjectStyle(obj)}>
                    {obj.imageData ? <img src={obj.imageData} alt={obj.name} style={getSceneObjectImageStyle()} /> : <span>{obj.name}</span>}
                  </div>
                ))}
                {(selectedScene.hotspots || []).filter((spot) => !spot.isHidden).map((spot) => (
                  <div key={spot.id} className="editor-hotspot media-preview-hotspot" style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot') }}>
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
                    {selectedScene.backgroundData ? (
                      <img src={selectedScene.backgroundData} alt="" />
                    ) : <div className="placeholder">Scene de depart</div>}
                    {transitionPreviewTarget.backgroundData ? (
                      <img src={transitionPreviewTarget.backgroundData} alt="" />
                    ) : <div className="placeholder">Scene d'arrivee</div>}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        ) : <div className="empty-state-inline">Cree une scene pour gerer ses medias.</div>}
      </section>
    </div>
  );
}
