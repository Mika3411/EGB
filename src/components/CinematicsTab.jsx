import { fileToDataURL } from '../utils/fileHelpers';

const FIELD_HELP = {
  addCinematic: "Crée une nouvelle cinématique. Elle peut servir d’intro, de transition, de révélation ou de récompense après une énigme.",
  startType: "Détermine le premier écran du joueur au lancement: une scène jouable ou une cinématique d’introduction.",
  startScene: "Scène ouverte au début du jeu si le démarrage est réglé sur une scène.",
  startCinematic: "Cinématique jouée au début du jeu si le démarrage est réglé sur une cinématique.",
  name: "Nom interne de la cinématique. Il apparaît dans les listes de choix et aide à retrouver les transitions.",
  type: "Choisis entre un diaporama de slides narratifs ou une vidéo importée.",
  videoFile: "Fichier vidéo joué par cette cinématique. MP4 est le format le plus fiable pour le navigateur.",
  videoAutoplay: "Lance automatiquement la vidéo quand la cinématique démarre. Selon le navigateur, le son peut demander une interaction utilisateur.",
  videoControls: "Affiche les contrôles vidéo au joueur: lecture, pause, barre de progression et volume.",
  slideImage: "Image affichée pendant ce slide. Elle peut poser une ambiance, montrer un indice ou illustrer une transition.",
  slideNarration: "Texte affiché avec le slide. Utilise-le pour raconter, guider ou révéler une information.",
  slideAudio: "Son ou voix associé à ce slide. Il se joue pendant la cinématique si le navigateur l’autorise.",
  endAction: "Action déclenchée quand la cinématique se termine: rester sur place, aller à un acte, ouvrir une scène ou donner un objet.",
  targetAct: "Acte vers lequel rediriger après la cinématique. Utile pour passer à un nouveau chapitre.",
  targetScene: "Scène ouverte après la cinématique si l’action de fin est un changement de scène.",
  rewardItem: "Objet ajouté à l’inventaire à la fin de la cinématique si l’action de fin donne une récompense.",
};

const HelpLabel = ({ children, help, className = '' }) => (
  <label className={`label-with-help${className ? ` ${className}` : ''}`}>
    <span>{children}</span>
    <span className="help-dot" data-help={help} aria-label={help} tabIndex={0}>?</span>
  </label>
);

export default function CinematicsTab({
  project,
  selectedCinematicId,
  setSelectedCinematicId,
  selectedCinematic,
  addCinematic,
  addSlide,
  patchProject,
  handleUpload,
}) {
  const rootSceneOptions = project.scenes.filter((scene) => !scene.parentSceneId);

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
    });
  };

  const deleteCinematic = () => {
    if (!selectedCinematic) return;
    const confirmed = window.confirm(`Supprimer la cinématique \"${selectedCinematic.name}\" ?`);
    if (!confirmed) return;

    let nextSelectedCinematicId = '';
    patchProject((draft) => {
      draft.cinematics = (draft.cinematics || []).filter((cine) => cine.id !== selectedCinematicId);
      nextSelectedCinematicId = draft.cinematics[0]?.id || '';

      if (!draft.start) {
        draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
      }

      if (draft.start.targetCinematicId === selectedCinematicId) {
        draft.start.targetCinematicId = nextSelectedCinematicId;
        if (!nextSelectedCinematicId && draft.start.type === 'cinematic') {
          draft.start.type = 'scene';
          const draftRootScenes = (draft.scenes || []).filter((scene) => !scene.parentSceneId);
          draft.start.targetSceneId = draft.start.targetSceneId || draftRootScenes[0]?.id || draft.scenes?.[0]?.id || '';
        }
      }
    });

    setSelectedCinematicId(nextSelectedCinematicId);
  };

  return (
    <div className="layout two-cols-wide">
      <section className="panel side">
        <div className="panel-head">
          <h2>Cinématiques</h2>
          <div className="label-with-help">
            <button onClick={addCinematic}>+ Cinématique</button>
            <span className="help-dot" data-help={FIELD_HELP.addCinematic} aria-label={FIELD_HELP.addCinematic} tabIndex={0}>?</span>
          </div>
        </div>

        <div className="stack" style={{ marginBottom: 18 }}>
          <h3 style={{ margin: '6px 0 0' }}>Démarrage du jeu</h3>
          <HelpLabel help={FIELD_HELP.startType}>Le jeu commence par</HelpLabel>
          <select
            value={project.start?.type || 'scene'}
            onChange={(e) => patchProject((draft) => {
              if (!draft.start) {
                draft.start = { type: 'scene', targetSceneId: '', targetCinematicId: '' };
              }

              draft.start.type = e.target.value;

              if (e.target.value === 'cinematic' && !draft.start.targetCinematicId) {
                draft.start.targetCinematicId = draft.cinematics?.[0]?.id || '';
              }

              if (e.target.value === 'scene' && !draft.start.targetSceneId) {
                const draftRootScenes = (draft.scenes || []).filter((scene) => !scene.parentSceneId);
                draft.start.targetSceneId = draftRootScenes[0]?.id || draft.scenes?.[0]?.id || '';
              }
            })}
          >
            <option value="scene">Une scène</option>
            <option value="cinematic">Une cinématique</option>
          </select>

          {(project.start?.type || 'scene') === 'scene' ? (
            <>
              <HelpLabel help={FIELD_HELP.startScene}>Scène de départ</HelpLabel>
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
              <HelpLabel help={FIELD_HELP.startCinematic}>Cinématique de départ</HelpLabel>
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

        {project.cinematics.map((cine) => (
          <button key={cine.id} className={`list-card ${cine.id === selectedCinematicId ? 'selected' : ''}`} onClick={() => setSelectedCinematicId(cine.id)}>
            <strong>{cine.name}</strong>
            <span>{(cine.cinematicType || 'slides') === 'video' ? 'Vidéo' : `${cine.slides.length} slide(s)`}</span>
          </button>
        ))}
      </section>

      <section className="panel main">
        {selectedCinematic ? (
          <>
            <div className="panel-head">
              <h2>Éditeur de cinématique</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(selectedCinematic.cinematicType || 'slides') === 'slides' ?
                   <button onClick={addSlide}>+ Slide</button>
                  : <span className="small-note">Mode vidéo actif</span>}
                <button type="button" onClick={deleteCinematic}>Supprimer la cinématique</button>
              </div>
            </div>

            <HelpLabel help={FIELD_HELP.name}>Nom de la cinématique</HelpLabel>
            <input value={selectedCinematic.name} onChange={(e) => patchProject((draft) => {
              const cine = draft.cinematics.find((c) => c.id === selectedCinematicId); if (cine) cine.name = e.target.value;
            })} />

            <HelpLabel help={FIELD_HELP.type}>Type de cinématique</HelpLabel>
            <select
              value={selectedCinematic.cinematicType || 'slides'}
              onChange={(e) => patchProject((draft) => {
                const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                if (cine) cine.cinematicType = e.target.value === 'video' ? 'video' : 'slides';
              })}
            >
              <option value="slides">Diaporama</option>
              <option value="video">Vidéo importée</option>
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
                  if (cine) cine.videoAutoplay = e.target.checked;
                })} />Lecture auto<span className="help-dot" data-help={FIELD_HELP.videoAutoplay} aria-label={FIELD_HELP.videoAutoplay} tabIndex={0}>?</span></label>
                <label className="checkbox-row"><input type="checkbox" checked={selectedCinematic.videoControls !== false} onChange={(e) => patchProject((draft) => {
                  const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                  if (cine) cine.videoControls = e.target.checked;
                })} />Afficher les contrôles<span className="help-dot" data-help={FIELD_HELP.videoControls} aria-label={FIELD_HELP.videoControls} tabIndex={0}>?</span></label>
              </div>
            ) : (
              <div className="slides-grid">
                {selectedCinematic.slides.map((slide, index) => (
                  <div className="slide-card" key={slide.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <h3 style={{ margin: 0 }}>Slide {index + 1}</h3>
                      <button type="button" onClick={() => deleteSlide(slide.id)}>Supprimer le slide</button>
                    </div>
                    <HelpLabel help={FIELD_HELP.slideImage}>Image</HelpLabel>
                    <label className="button like full">
                      {slide.imageName || 'Importer image'}
                      <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                        const target = draft.cinematics.find((c) => c.id === selectedCinematicId)?.slides.find((s) => s.id === slide.id);
                        if (target) { target.imageData = data; target.imageName = name; }
                      }))} />
                    </label>
                    {slide.imageData && <img className="thumb" loading="lazy" decoding="async" src={slide.imageData} alt="slide" />}
                    <HelpLabel help={FIELD_HELP.slideNarration}>Narration</HelpLabel>
                    <textarea value={slide.narration} onChange={(e) => patchProject((draft) => {
                      const target = draft.cinematics.find((c) => c.id === selectedCinematicId)?.slides.find((s) => s.id === slide.id);
                      if (target) target.narration = e.target.value;
                    })} />
                    <HelpLabel help={FIELD_HELP.slideAudio}>Son</HelpLabel>
                    <label className="button like full">
                      {slide.audioName || 'Importer son'}
                      <input type="file" accept="audio/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                        const target = draft.cinematics.find((c) => c.id === selectedCinematicId)?.slides.find((s) => s.id === slide.id);
                        if (target) { target.audioData = data; target.audioName = name; }
                      }))} />
                    </label>
                    {slide.audioData && <audio controls preload="metadata" src={slide.audioData} style={{ width: '100%' }} />}
                  </div>
                ))}
              </div>
            )}

            <div className="stack" style={{ marginBottom: 18 }}>
              <h3 style={{ margin: '6px 0 0' }}>À la fin de la cinématique</h3>
              <HelpLabel help={FIELD_HELP.endAction}>Action de fin</HelpLabel>
              <select
                value={selectedCinematic.onEndType || 'none'}
                onChange={(e) => patchProject((draft) => {
                  const cine = draft.cinematics.find((c) => c.id === selectedCinematicId);
                  if (cine) cine.onEndType = e.target.value;
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
                      if (cine) cine.targetActId = e.target.value;
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
                      if (cine) cine.targetSceneId = e.target.value;
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
                      if (cine) cine.rewardItemId = e.target.value;
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
            <h2>Aucune cinématique sélectionnée</h2>
            <p className="small-note">Ajoute une cinématique ou sélectionne-en une dans la liste.</p>
          </div>
        )}
      </section>
    </div>
  );
}
