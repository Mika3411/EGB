import { fileToDataURL } from '../utils/fileHelpers';
import { showAlert, showConfirm } from './AccessibleDialog';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import {
  createCinematicFromAnime2dPayload,
  deleteCinematicFromProject,
  normalizeAnime2dSpecForCinematic,
  normalizeCinematicSteps,
} from '../lib/cinematicEngine';

const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const FIELD_HELP = {
  addCinematic: "Crée une nouvelle cinematic. Elle peut servir d’intro, de transition, de révélation ou de récompense après une énigme.",
  name: "Nom interne de la cinématique. Il apparaît dans les listes de choix et aide à retrouver les transitions.",
  type: "Choisis entre un diaporama de slides narratifs ou une vidéo importée.",
  videoFile: "Fichier vidéo joué par cette cinematic. MP4 est le format le plus fiable pour le navigateur.",
  videoAutoplay: "Lance automatiquement la vidéo quand la cinématique démarre. Selon le navigateur, le son peut demander une interaction utilisateur.",
  videoControls: "Affiche les contrôles vidéo au joueur: lecture, pause, barre de progression et volume.",
  slideImage: "Image affichée pendant ce slide. Elle peut poser une ambiance, montrer un indice ou illustrer une transition.",
  slideNarration: "Texte affiché avec le slide. Utilise-le pour raconter, guider ou révéler une information.",
  slideAudio: "Son ou voix associé à ce slide. Il se joué pendant la cinématique si le navigateur l’autorise.",
  endAction: "Action déclenchée quand la cinématique se termine: rester sur place, aller à un acte, ouvrir une scène ou donner un objet.",
  targetAct: "Acte vers lequel rediriger après la cinématique. Utile pour passer à un nouveau chapitre.",
  targetScene: "Scène ouverte après la cinématique si l’action de fin est un changement de scène.",
  rewardItem: "Objet ajouté à l’inventaire à la fin de la cinématique si l’action de fin donné une récompense.",
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
      await showAlert({
        title: 'Import 2D Anime impossible',
        message: error.message || 'Import 2D Anime impossible.',
        variant: 'danger',
      });
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
      await showAlert({
        title: 'Import vidéo impossible',
        message: "Impossible d'importer cette vidéo. Essaie un autre fichier.",
        variant: 'danger',
      });
    } finally {
      event.target.value = '';
    }
  };

  const deleteSlide = async (slideId) => {
    if (!selectedCinematic) return;
    const confirmed = await showConfirm({
      title: 'Supprimer le slide',
      message: 'Supprimer ce slide ?',
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;

    patchProject((draft) => {
      const cine = draft.cinematics.find((entry) => entry.id === selectedCinematicId);
      if (!cine) return;
      cine.slides = (cine.slides || []).filter((slide) => slide.id !== slideId);
      syncCinematicSteps(cine);
    });
  };

  const deleteCinematic = async () => {
    if (!selectedCinematic) return;
    const confirmed = await showConfirm({
      title: 'Supprimer la cinématique',
      message: `Supprimer la cinématique "${selectedCinematic.name}" ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
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
          <h2>Cinématiques</h2>
          <div className="label-with-help">
            <button data-tour="cinematic-add" onClick={addCinematic}>+ Cinématique</button>
            <span className="help-dot" data-help={FIELD_HELP.addCinematic} aria-label={FIELD_HELP.addCinematic} tabIndex={0}>?</span>
          </div>
        </div>

        <label className="button like full">
          Importer 2D Anime
          <input type="file" accept="application/json,.json" hidden onChange={import2dAnimeJson} />
        </label>

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
                  : <span className="small-note">{selectedCinematic.cinematicType === 'anime2d' ? 'Mode 2D Anime actif' : 'Mode vidéo actif'}</span>}
                <button type="button" onClick={() => previewCinematic?.(selectedCinematic.id)}>Prévisualiser</button>
                <button type="button" onClick={deleteCinematic}>Supprimer la cinématique</button>
              </div>
            </div>

            <HelpLabel help={FIELD_HELP.name}>Nom de la cinématique</HelpLabel>
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
                      await showAlert({
                        title: 'Import 2D Anime impossible',
                        message: error.message || 'Import 2D Anime impossible.',
                        variant: 'danger',
                      });
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
                      assetScope="cinematic-image"
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
                      assetScope="cinematic-audio"
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
              <h3 style={{ margin: '6px 0 0' }}>À la fin de la cinématique</h3>
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
                <option value="scene">Aller à une scène</option>
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
                  <HelpLabel help={FIELD_HELP.targetScene}>Scène de destination</HelpLabel>
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
            <h2>Aucune cinématique selectionnée</h2>
            <p className="small-note">Ajoute une cinématique ou sélectionne-en une dans la liste.</p>
          </div>
        )}
      </section>
    </div>
  );
}
