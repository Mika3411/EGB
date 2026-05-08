import { useState } from 'react';
import { fileToDataURL } from '../utils/fileHelpers';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import {
  applyProjectStartType,
  createCinematicStep,
  createCinematicFromAnime2dPayload,
  createCinematicTimeline,
  deleteCinematicFromProject,
  getCinematicDebugState,
  normalizeAnime2dSpecForCinematic,
  normalizeCinematicSteps,
} from '../lib/cinematicEngine';

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const FIELD_HELP = {
  addCinematic: "Crée une nouvelle cinematic. Elle peut servir d’intro, de transition, de révélation ou de récompense après une enigme.",
  startType: "Détermine le premier écran du joueur au lancement: une scene jouable ou une cinematic d’introduction.",
  startScene: "Scene ouverte au début du jeu si le démarrage est réglé sur une scene.",
  startCinematic: "Cinematic jouée au début du jeu si le démarrage est réglé sur une cinematic.",
  name: "Nom interne de la cinematic. Il apparaît dans les listes de choix et aide à retrouver les transitions.",
  type: "Choisis entre un diaporama de slides narratifs ou une vidéo importée.",
  videoFile: "Fichier vidéo joué par cette cinematic. MP4 est le format le plus fiable pour le navigateur.",
  videoAutoplay: "Lance automatiquement la vidéo quand la cinematic démarre. Selon le navigateur, le son peut demander une interaction utilisateur.",
  videoControls: "Affiche les contrôles vidéo au joueur: lecture, pause, barre de progression et volume.",
  slideImage: "Image affichée pendant ce slide. Elle peut poser une ambiance, montrer un indice ou illustrer une transition.",
  slideNarration: "Texte affiché avec le slide. Utilise-le pour raconter, guider ou révéler une information.",
  slideAudio: "Son ou voix associé à ce slide. Il se joué pendant la cinematic si le navigateur l’autorise.",
  endAction: "Action déclénchée quand la cinematic se terminé: rester sur place, aller à un acte, ouvrir une scene ou donner un objet.",
  targetAct: "Acte vers lequel rediriger après la cinematic. Utile pour passer à un nouveau chapitre.",
  targetScene: "Scene ouverte après la cinematic si l’action de fin est un changement de scene.",
  rewardItem: "Objet ajouté à l’inventaire à la fin de la cinematic si l’action de fin donné une récompense.",
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

const syncCinematicSteps = (cinematic) => {
  if (!cinematic) return;
  cinematic.steps = normalizeCinematicSteps([], cinematic);
};

const getStepLabel = (step = {}) => {
  if (step.type === 'text') return step.content || 'Texte';
  if (step.type === 'image') return step.name || 'Image';
  if (step.type === 'audio') return step.name || 'Audio';
  if (step.type === 'video') return step.name || 'Video';
  if (step.type === 'animation') return `${step.target || 'cible'}:${step.action || 'action'}`;
  if (step.type === 'wait') return `${Math.round((Number(step.duration) || 0) / 1000)}s`;
  if (step.type === 'transition') return step.toScene || step.toAct || step.rewardItem || 'Transition';
  if (step.type === 'anime2d') return step.name || '2D Anime';
  return step.type || 'Step';
};

const formatMs = (ms = 0) => `${(Math.max(0, Number(ms) || 0) / 1000).toFixed(1)}s`;

export default function CinematicsTab({
  project,
  selectedCinematicId,
  setSelectedCinematicId,
  selectedCinematic,
  addCinematic,
  addSlide,
  patchProject,
  handleUpload,
  mediaLibrary = [],
  previewCinematic,
}) {
  const rootSceneOptions = project.scenes.filter((scene) => !scene.parentSceneId);
  const selectedTimeline = selectedCinematic ? createCinematicTimeline(selectedCinematic) : null;
  const [selectedStepId, setSelectedStepId] = useState('');
  const [draggedStepId, setDraggedStepId] = useState('');

  const patchSelectedCinematic = (callback) => {
    patchProject((draft) => {
      const cine = draft.cinematics.find((entry) => entry.id === selectedCinematicId);
      if (!cine) return;
      if (!Array.isArray(cine.steps) || !cine.steps.length) cine.steps = normalizeCinematicSteps(cine.steps, cine);
      callback(cine);
    });
  };

  const addTimelineStep = (type) => {
    const step = createCinematicStep(type, {
      id: makeId(`step-${type}`),
      content: type === 'text' ? 'Nouveau texte' : '',
      target: type === 'animation' ? 'character' : '',
      action: type === 'animation' ? 'fadeIn' : '',
      duration: type === 'wait' ? 2000 : 450,
    });
    patchSelectedCinematic((cine) => {
      cine.steps.push(step);
    });
    setSelectedStepId(step.id);
  };

  const moveTimelineStep = (fromStepId, toStepId) => {
    if (!fromStepId || !toStepId || fromStepId === toStepId) return;
    patchSelectedCinematic((cine) => {
      const fromIndex = cine.steps.findIndex((step) => step.id === fromStepId);
      const toIndex = cine.steps.findIndex((step) => step.id === toStepId);
      if (fromIndex < 0 || toIndex < 0) return;
      const [moved] = cine.steps.splice(fromIndex, 1);
      cine.steps.splice(toIndex, 0, moved);
    });
  };

  const updateTimelineStep = (stepId, patch) => {
    patchSelectedCinematic((cine) => {
      const step = cine.steps.find((entry) => entry.id === stepId);
      if (step) Object.assign(step, patch);
    });
  };

  const deleteTimelineStep = (stepId) => {
    patchSelectedCinematic((cine) => {
      cine.steps = cine.steps.filter((step) => step.id !== stepId);
    });
    if (selectedStepId === stepId) setSelectedStepId('');
  };

  const timelineSteps = selectedCinematic ? normalizeCinematicSteps(selectedCinematic.steps, selectedCinematic) : [];
  const selectedStep = timelineSteps.find((step) => step.id === selectedStepId) || timelineSteps[0] || null;
  const selectedTrack = selectedStep ? selectedTimeline?.tracks.find((track) => track.id === selectedStep.id) : null;
  const cinematicDebug = selectedCinematic ? getCinematicDebugState(selectedCinematic, selectedTrack?.startMs || 0) : null;

  const import2dAnimeJson = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const payload = JSON.parse(await file.text());
      const cinematic = createCinematicFromAnime2dPayload(payload, {
        fileName: file.name,
        idFactory: makeId,
      });

      patchProject((draft) => {
        if (!Array.isArray(draft.cinematics)) draft.cinematics = [];
        draft.cinematics.push(cinematic);
      }, { rememberHistory: false });
      setSelectedCinematicId(cinematic.id);
    } catch (error) {
      alert(error.message || 'Import 2D Anime impossible.');
    }
  };

  const handleVideoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const data = await fileToDataURL(file);
      patchProject((draft) => {
        const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
        if (cine) {
          cine.videoData = data;
          cine.videoName = file.name;
          syncCinematicSteps(cine);
        }
      });
    } catch (error) {
      console.error('Erreur import vidéo', error);
      alert("Impossible d'importer cette vidéo. Essaie un autre fichier.");
    } finally {
      event.target.value = '';
    }
  };

  const deleteSlide = (slideId) => {
    if (!selectedCinematic) return;
    const confirmed = window.confirm('Supprimer ce slide ?');
    if (!confirmed) return;

    patchProject((draft) => {
      const cine = draft.cinematics.find((entry) => entry.id === selectedCinematicId);
      if (!cine) return;
      cine.slides = (cine.slides || []).filter((slide) => slide.id !== slideId);
      syncCinematicSteps(cine);
    });
  };

  const deleteCinematic = () => {
    if (!selectedCinematic) return;
    const confirmed = window.confirm(`Supprimer la cinematic \"${selectedCinematic.name}\" ?`);
    if (!confirmed) return;

    let nextSelectedCinematicId = '';
    patchProject((draft) => {
      nextSelectedCinematicId = deleteCinematicFromProject(draft, selectedCinematicId);
    });

    setSelectedCinematicId(nextSelectedCinematicId);
  };

  return (
    <div className="layout two-cols-wide">
      <section className="panel side" data-tour="cinematic-sidebar">
        <div className="panel-head">
          <h2>Cinematics</h2>
          <div className="label-with-help">
            <button data-tour="cinematic-add" onClick={addCinematic}>+ Cinematic</button>
            <span className="help-dot" data-help={FIELD_HELP.addCinematic} aria-label={FIELD_HELP.addCinematic} tabIndex={0}>?</span>
          </div>
        </div>

        <label className="button like full">
          Importer 2D Anime
          <input type="file" accept="application/json,.json" hidden onChange={import2dAnimeJson} />
        </label>

        <div className="stack" data-tour="cinematic-start-settings" style={{ marginBottom: 18 }}>
          <h3 style={{ margin: '6px 0 0' }}>Démarrage du jeu</h3>
          <HelpLabel help={FIELD_HELP.startType}>Le jeu commence par</HelpLabel>
          <select
            value={project.start?.type || 'scene'}
            onChange={(e) => patchProject((draft) => {
              applyProjectStartType(draft, e.target.value);
            })}
          >
            <option value="scene">Une scene</option>
            <option value="cinematic">Une cinematic</option>
          </select>

          {(project.start?.type || 'scene') === 'scene' ? (
            <>
              <HelpLabel help={FIELD_HELP.startScene}>Scene de départ</HelpLabel>
              <select
                value={project.start?.targetSceneId || rootSceneOptions[0]?.id || ''}
                onChange={(e) => patchProject((draft) => {
                  if (!draft.start) {
                    draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
                  }
                  draft.start.targetSceneId = e.target.value;
                })}
              >
                {rootSceneOptions.map((scene) => (
                  <option key={scene.id} value={scene.id}>{scene.name}</option>
                ))}
              </select>
            </>
          ) : (
            <>
              <HelpLabel help={FIELD_HELP.startCinematic}>Cinematic de départ</HelpLabel>
              <select
                value={project.start?.targetCinematicId || project.cinematics[0]?.id || ''}
                onChange={(e) => patchProject((draft) => {
                  if (!draft.start) {
                    draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
                  }
                  draft.start.targetCinematicId = e.target.value;
                })}
              >
                {project.cinematics.map((cine) => (
                  <option key={cine.id} value={cine.id}>{cine.name}</option>
                ))}
              </select>
            </>
          )}
        </div>

        <div data-tour="cinematic-list">
          {project.cinematics.map((cine) => (
            <button key={cine.id} className={`list-card ${cine.id === selectedCinematicId ? 'selected' : ''}`} onClick={() => setSelectedCinematicId(cine.id)}>
              <strong>{cine.name}</strong>
              <span>{(cine.cinematicType || 'slides') === 'video' ? 'Video' : (cine.cinematicType === 'anime2d' ? '2D Anime' : `${cine.slides.length} slide(s)`)}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel main" data-tour="cinematic-editor">
        {selectedCinematic ? (
          <>
            <div className="panel-head">
              <h2>Éditeur de cinematic</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(selectedCinematic.cinematicType || 'slides') === 'slides' ?
                   <button data-tour="cinematic-add-slide" onClick={addSlide}>+ Slide</button>
                  : <span className="small-note">{selectedCinematic.cinematicType === 'anime2d' ? 'Mode 2D Anime actif' : 'Mode video actif'}</span>}
                <button type="button" onClick={() => previewCinematic?.(selectedCinematic.id)}>Previsualiser</button>
                <button type="button" onClick={deleteCinematic}>Supprimer la cinematic</button>
              </div>
            </div>

            <HelpLabel help={FIELD_HELP.name}>Nom de la cinematic</HelpLabel>
            <input data-tour="cinematic-name" value={selectedCinematic.name} onChange={(e) => patchProject((draft) => {
              const cine = draft.cinematics.find((c) => c.id === selectedCinematicId); if (cine) cine.name = e.target.value;
            })} />

            <HelpLabel help={FIELD_HELP.type}>Type de cinematic</HelpLabel>
            <select
              data-tour="cinematic-type"
              value={selectedCinematic.cinematicType || 'slides'}
              onChange={(e) => patchProject((draft) => {
                const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                if (cine) {
                  cine.cinematicType = ['video', 'anime2d'].includes(e.target.value) ? e.target.value : 'slides';
                  syncCinematicSteps(cine);
                }
              })}
            >
              <option value="slides">Diaporama</option>
              <option value="video">Video importee</option>
              <option value="anime2d">2D Anime</option>
            </select>
            {selectedTimeline ? (
              <p className="small-note">
                Timeline: {selectedTimeline.tracks.length} piste(s), {selectedTimeline.events.length} evenement(s),
                {' '}{(selectedTimeline.durationMs / 1000).toFixed(1)}s.
              </p>
            ) : null}

            <div className="cinematic-timeline-panel">
              <div className="cinematic-timeline-head">
                <div>
                  <h3>Timeline</h3>
                  <p className="small-note">Blocs glissables, lus de gauche a droite par le cinematic engine.</p>
                </div>
                <div className="cinematic-step-tools">
                  <button type="button" onClick={() => addTimelineStep('text')}>+ Texte</button>
                  <button type="button" onClick={() => addTimelineStep('animation')}>+ Anim</button>
                  <button type="button" onClick={() => addTimelineStep('wait')}>+ Wait</button>
                  <button type="button" onClick={() => addTimelineStep('transition')}>+ Transition</button>
                </div>
              </div>

              <div className="cinematic-timeline-rail" role="list" aria-label="Timeline cinematic">
                {timelineSteps.map((step, index) => {
                  const track = selectedTimeline?.tracks.find((entry) => entry.id === step.id);
                  const isDebugCurrent = cinematicDebug?.currentStepId === step.id;
                  return (
                    <button
                      type="button"
                      key={step.id}
                      role="listitem"
                      draggable
                      aria-current={isDebugCurrent ? 'step' : undefined}
                      className={`cinematic-step-block cinematic-step-block--${step.type} ${selectedStep?.id === step.id ? 'selected' : ''} ${isDebugCurrent ? 'debug-current' : ''}`}
                      onClick={() => setSelectedStepId(step.id)}
                      onDragStart={() => setDraggedStepId(step.id)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        moveTimelineStep(draggedStepId, step.id);
                        setDraggedStepId('');
                      }}
                      onDragEnd={() => setDraggedStepId('')}
                    >
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>{step.type}</strong>
                      <small>{getStepLabel(step)}</small>
                      {track ? <em>{formatMs(track.startMs)} - {formatMs(track.endMs)}</em> : null}
                    </button>
                  );
                })}
              </div>

              {cinematicDebug ? (
                <div className="cinematic-debug-panel" aria-label="Debug cinematic">
                  <div className="cinematic-debug-cell">
                    <span>Etat</span>
                    <strong>{cinematicDebug.state}</strong>
                    <small>{Math.round(cinematicDebug.progress * 100)}% timeline</small>
                  </div>
                  <div className="cinematic-debug-cell">
                    <span>Step actuel</span>
                    <strong>{cinematicDebug.currentStep?.type || 'aucun'}</strong>
                    <small>{getStepLabel(cinematicDebug.currentStep || {})}</small>
                  </div>
                  <div className="cinematic-debug-cell">
                    <span>Duree</span>
                    <strong>{formatMs(cinematicDebug.timeMs)} / {formatMs(cinematicDebug.durationMs)}</strong>
                    <small>{cinematicDebug.trackCount} piste(s)</small>
                  </div>
                  <div className="cinematic-debug-cell">
                    <span>Prochain event</span>
                    <strong>{cinematicDebug.nextEvent?.type || 'fin'}</strong>
                    <small>{cinematicDebug.nextEvent ? formatMs(cinematicDebug.nextEvent.atMs) : `${cinematicDebug.eventCount} event(s)`}</small>
                  </div>
                </div>
              ) : null}

            </div>

            {(selectedCinematic.cinematicType || 'slides') === 'video' ? (
              <div className="stack" style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '6px 0 0' }}>Vidéo</h3>
                <HelpLabel help={FIELD_HELP.videoFile}>Fichier vidéo</HelpLabel>
                <label className="button like full">
                  {selectedCinematic.videoName || 'Importer une vidéo'}
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/ogg,video/quicktime,.mp4,.webm,.mov"
                    hidden
                    onChange={handleVideoUpload}
                  />
                </label>
                {selectedCinematic.videoData ? (
                  <video className="thumb" src={selectedCinematic.videoData} controls preload="metadata" style={{ width: '100%', maxHeight: 320, background: '#020617' }} />
                ) : (
                  <p className="small-note">MP4 conseillé. WebM et MOV peuvent marcher selon le navigateur.</p>
                )}
                <label className="checkbox-row"><input type="checkbox" checked={selectedCinematic.videoAutoplay !== false} onChange={(e) => patchProject((draft) => {
                  const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                  if (cine) {
                    cine.videoAutoplay = e.target.checked;
                    syncCinematicSteps(cine);
                  }
                })} />Lecture auto<span className="help-dot" data-help={FIELD_HELP.videoAutoplay} aria-label={FIELD_HELP.videoAutoplay} tabIndex={0}>?</span></label>
                <label className="checkbox-row"><input type="checkbox" checked={selectedCinematic.videoControls !== false} onChange={(e) => patchProject((draft) => {
                  const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                  if (cine) {
                    cine.videoControls = e.target.checked;
                    syncCinematicSteps(cine);
                  }
                })} />Afficher les contrôles<span className="help-dot" data-help={FIELD_HELP.videoControls} aria-label={FIELD_HELP.videoControls} tabIndex={0}>?</span></label>
              </div>
            ) : selectedCinematic.cinematicType === 'anime2d' ? (
              <div className="stack" style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '6px 0 0' }}>2D Anime</h3>
                <label className="button like full">
                  Remplacer le JSON 2D Anime
                  <input type="file" accept="application/json,.json" hidden onChange={async (event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    try {
                      const payload = JSON.parse(await file.text());
                      if (payload?.kind !== 'escape-game-builder-2d-animation') throw new Error('JSON 2D Anime invalide.');
                      const anime2dSpec = normalizeAnime2dSpecForCinematic(payload);
                      patchProject((draft) => {
                        const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                        if (cine) {
                          cine.anime2dSpec = anime2dSpec;
                          cine.anime2dName = file.name;
                          cine.name = cine.name || anime2dSpec.sceneName || '2D Anime';
                          syncCinematicSteps(cine);
                        }
                      }, { rememberHistory: false });
                    } catch (error) {
                      alert(error.message || 'Import 2D Anime impossible.');
                    }
                  }} />
                </label>
                <p className="small-note">{selectedCinematic.anime2dName || 'Aucun JSON 2D Anime importe.'}</p>
              </div>
            ) : (
              <div className="slides-grid" data-tour="cinematic-slides">
                {selectedCinematic.slides.map((slide, index) => (
                  <div className="slide-card" data-tour={index === 0 ? 'cinematic-slide-card' : undefined} key={slide.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>Slide {index + 1}</h3>
                      <button type="button" onClick={() => deleteSlide(slide.id)}>Supprimer le slide</button>
                    </div>
                    <HelpLabel help={FIELD_HELP.slideImage}>Image</HelpLabel>
                    <MediaSourcePicker
                      className="button like full"
                      accept="image/*"
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      onSelect={(data, name) => patchProject((draft) => {
                        const target = draft.cinematics.find((c) => c.id === selectedCinematicId)?.slides.find((s) => s.id === slide.id);
                        const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                        if (target) { target.imageData = data; target.imageName = name; }
                        syncCinematicSteps(cine);
                      })}
                      tourId={index === 0 ? 'cinematic-slide-image' : undefined}
                    >
                      {slide.imageName || 'Importer image'}
                    </MediaSourcePicker>
                    {slide.imageData && <img className="thumb" loading="lazy" decoding="async" src={slide.imageData} alt="slide" />}
                    <HelpLabel help={FIELD_HELP.slideNarration}>Narration</HelpLabel>
                    <textarea data-tour={index === 0 ? 'cinematic-slide-narration' : undefined} value={slide.narration} onChange={(e) => patchProject((draft) => {
                      const target = draft.cinematics.find((c) => c.id === selectedCinematicId)?.slides.find((s) => s.id === slide.id);
                      const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                      if (target) target.narration = e.target.value;
                      syncCinematicSteps(cine);
                    })} />
                    <HelpLabel help={FIELD_HELP.slideAudio}>Son</HelpLabel>
                    <MediaSourcePicker
                      className="button like full"
                      accept="audio/*"
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      onSelect={(data, name) => patchProject((draft) => {
                        const target = draft.cinematics.find((c) => c.id === selectedCinematicId)?.slides.find((s) => s.id === slide.id);
                        const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                        if (target) { target.audioData = data; target.audioName = name; }
                        syncCinematicSteps(cine);
                      })}
                      tourId={index === 0 ? 'cinematic-slide-audio' : undefined}
                    >
                      {slide.audioName || 'Importer son'}
                    </MediaSourcePicker>
                    {slide.audioData && <audio controls preload="metadata" src={slide.audioData} style={{ width: '100%' }} />}
                  </div>
                ))}
              </div>
            )}

            <div className="stack" data-tour="cinematic-end-settings" style={{ marginBottom: 18 }}>
              <h3 style={{ margin: '6px 0 0' }}>À la fin de la cinematic</h3>
              <HelpLabel help={FIELD_HELP.endAction}>Action de fin</HelpLabel>
              <select
                data-tour="cinematic-end-action"
                value={selectedCinematic.onEndType || 'none'}
                onChange={(e) => patchProject((draft) => {
                  const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                  if (cine) {
                    cine.onEndType = e.target.value;
                    syncCinematicSteps(cine);
                  }
                })}
              >
                <option value="none">Ne rien faire</option>
                <option value="act">Aller à un acte</option>
                <option value="scene">Aller à une scene</option>
                <option value="item">Donner un objet</option>
              </select>

              {(selectedCinematic.onEndType || 'none') === 'act' && (
                <>
                  <HelpLabel help={FIELD_HELP.targetAct}>Acte de destination</HelpLabel>
                  <select
                    value={selectedCinematic.targetActId || project.acts[0]?.id || ''}
                    onChange={(e) => patchProject((draft) => {
                      const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                      if (cine) {
                        cine.targetActId = e.target.value;
                        syncCinematicSteps(cine);
                      }
                    })}
                  >
                    {project.acts.map((act) => (
                      <option key={act.id} value={act.id}>{act.name}</option>
                    ))}
                  </select>
                </>
              )}

              {(selectedCinematic.onEndType || 'none') === 'scene' && (
                <>
                  <HelpLabel help={FIELD_HELP.targetScene}>Scene de destination</HelpLabel>
                  <select
                    value={selectedCinematic.targetSceneId || project.scenes[0]?.id || ''}
                    onChange={(e) => patchProject((draft) => {
                      const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                      if (cine) {
                        cine.targetSceneId = e.target.value;
                        syncCinematicSteps(cine);
                      }
                    })}
                  >
                    {project.scenes.map((scene) => (
                      <option key={scene.id} value={scene.id}>{scene.name}</option>
                    ))}
                  </select>
                </>
              )}

              {(selectedCinematic.onEndType || 'none') === 'item' && (
                <>
                  <HelpLabel help={FIELD_HELP.rewardItem}>Objet donné</HelpLabel>
                  <select
                    value={selectedCinematic.rewardItemId || ''}
                    onChange={(e) => patchProject((draft) => {
                      const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                      if (cine) {
                        cine.rewardItemId = e.target.value;
                        syncCinematicSteps(cine);
                      }
                    })}
                  >
                    <option value="">Aucun</option>
                    {project.items.map((item) => (
                      <option key={item.id} value={item.id}>{item.icon || '📦'} {item.name}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          </>
        ) : (
          <div className="stack">
            <h2>Aucune cinematic selectionnée</h2>
            <p className="small-note">Ajoute une cinematic ou selectionne-en une dans la liste.</p>
          </div>
        )}
      </section>
    </div>
  );
}
