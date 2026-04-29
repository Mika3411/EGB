import { useEffect, useRef } from 'react';
import {
  COLOR_LOGIC_LABELS,
  COLOR_OPTIONS,
  DEPRECATED_ENIGMA_TYPES,
  FIELD_HELP,
  IMAGE_CUT_STYLE_LABELS,
  IMAGE_PUZZLE_LOGIC_LABELS,
  MISC_MODE_OPTIONS,
  POPUP_OVERLAY_GRADIENTS,
  POPUP_OVERLAY_OPTIONS,
  TYPE_LABELS,
} from '../data/enigmaConfig';
import { ensureEnigmaTypeDefaults, usesColorSequence, usesEditorImageEnigma } from '../lib/enigmaDefaults';
import HelpLabel from './forms/HelpLabel';
import EnigmaList from './enigmas/EnigmaList';
import EnigmaPreviewAside from './enigmas/EnigmaPreviewAside';

export default function EnigmasTab({
  project,
  selectedEnigmaId,
  setSelectedEnigmaId,
  selectedEnigma,
  addEnigma,
  deleteEnigma,
  patchProject,
  getSceneLabel,
  handleUpload,
  previewEnigma,
}) {
  const imageInputRef = useRef(null);
  const popupBackgroundInputRef = useRef(null);

  const updateEnigma = (enigmaId, updater) => {
    patchProject((draft) => {
      const enigma = (draft.enigmas || []).find((entry) => entry.id === enigmaId);
      if (enigma) updater(enigma);
    });
  };

  useEffect(() => {
    if (!selectedEnigma || !DEPRECATED_ENIGMA_TYPES.has(selectedEnigma.type)) return;
    updateEnigma(selectedEnigma.id, (enigma) => {
      enigma.type = 'code';
      ensureEnigmaTypeDefaults(enigma, 'code');
    });
  }, [selectedEnigma?.id, selectedEnigma?.type]);

  const solutionPreview = String(selectedEnigma?.solutionText || '1990').slice(0, 8).split('');
  const selectedCodeSkin = selectedEnigma?.codeSkin || 'safe-wheels';
  const colorPreview = (selectedEnigma?.solutionColors?.length ? selectedEnigma.solutionColors : ['red', 'blue', 'yellow', 'green']).slice(0, 8);
  const selectedColorLogic = COLOR_LOGIC_LABELS[selectedEnigma?.colorLogic] ? selectedEnigma.colorLogic : 'sequence';
  const selectedImagePuzzleLogic = IMAGE_PUZZLE_LOGIC_LABELS[selectedEnigma?.imagePuzzleLogic] ?
     selectedEnigma.imagePuzzleLogic
    : 'classic-grid';
  const selectedImageCutStyle = IMAGE_CUT_STYLE_LABELS[selectedEnigma?.imageCutStyle] ? selectedEnigma.imageCutStyle : 'straight';
  const hasRightPreview = selectedEnigma?.type === 'code' || selectedEnigma?.type === 'colors' || selectedEnigma?.type === 'misc' || usesEditorImageEnigma(selectedEnigma?.type);
  const selectedMiscMode = selectedEnigma?.miscMode || 'free-answer';
  const imagePreviewBackground = selectedEnigma?.imageData ?
     { backgroundImage: `url(${selectedEnigma.imageData})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  return (
    <div className="layout two-cols-wide">
      <div data-tour="enigma-list">
      <EnigmaList
        enigmas={project.enigmas || []}
        selectedEnigmaId={selectedEnigmaId}
        setSelectedEnigmaId={setSelectedEnigmaId}
        addEnigma={addEnigma}
      />
      </div>

      <section className="panel main">
        <div className="panel-head">
          <h2>Éditeur d’énigme</h2>
          {selectedEnigma && (
            <div className="inline-actions end">
              <button type="button" className="secondary-action" onClick={() => previewEnigma?.(selectedEnigma.id)}>
                Prévisualiser ?
              </button>
              <button className="danger-button" onClick={() => deleteEnigma(selectedEnigma.id)}>
                Supprimer
              </button>
            </div>
          )}
        </div>

        {selectedEnigma ? (
          <div className="combo-card">
            <div className={`enigma-editor-grid${hasRightPreview ? ' has-preview' : ''}`}>
              <div>
            <div className="grid-two" data-tour="enigma-identity">
              <div>
                <HelpLabel help={FIELD_HELP.name}>Nom</HelpLabel>
                <input value={selectedEnigma.name} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.name = e.target.value;
                })} />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.type}>Type</HelpLabel>
                <select value={selectedEnigma.type} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.type = e.target.value;
                  ensureEnigmaTypeDefaults(enigma, e.target.value);
                })}>
                  {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <HelpLabel help={FIELD_HELP.question}>Question / consigne</HelpLabel>
            <textarea data-tour="enigma-question" value={selectedEnigma.question} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
              enigma.question = e.target.value;
            })} />

            {selectedEnigma.type === 'code' ? (
              <>
                <HelpLabel help={FIELD_HELP.solution}>Solution</HelpLabel>
                <input data-tour="enigma-solution" value={selectedEnigma.solutionText || ''} placeholder="Ex : 1234 ou LUNE" onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.solutionText = e.target.value;
                })} />
              </>
            ) : null}

            {selectedEnigma.type === 'misc' ? (
              <>
                <div className="grid-two">
                  <div>
                    <HelpLabel help={FIELD_HELP.miscMode}>Mode Divers</HelpLabel>
                    <select value={selectedEnigma.miscMode || 'free-answer'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.miscMode = e.target.value;
                      enigma.miscChoices = Array.isArray(enigma.miscChoices) && enigma.miscChoices.length ? enigma.miscChoices : ['Réponse A', 'Réponse B', 'Réponse C'];
                    })}>
                      {MISC_MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help={FIELD_HELP.solution}>Solution attendue</HelpLabel>
                    <input value={selectedEnigma.solutionText || ''} placeholder="Ex : LUNE" onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.solutionText = e.target.value;
                    })} />
                  </div>
                </div>

                {['free-answer', 'fill-blank', 'accepted-answers'].includes(selectedEnigma.miscMode || 'free-answer') ? (
                  <p className="small-note">Validation souple : la réponse est acceptée même avec ou sans majuscules, et même si le joueur ajoute des mots autour.</p>
                ) : null}

                {['multiple-choice', 'ordering', 'multi-select', 'accepted-answers'].includes(selectedEnigma.miscMode || 'free-answer') ? (
                  <>
                    <div className="panel-head panel-head-spaced">
                      <HelpLabel className="compact-section-title" help={FIELD_HELP.miscChoices}>
                        {(selectedEnigma.miscMode || 'free-answer') === 'ordering' ?
                           'Ordre attendu'
                          : (selectedEnigma.miscMode || 'free-answer') === 'accepted-answers' ?
                             'Réponses acceptées'
                            : 'Choix proposés'}
                      </HelpLabel>
                      <button type="button" onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscChoices = [...(enigma.miscChoices || []), 'Nouvelle réponse'];
                      })}>+ Choix</button>
                    </div>
                    {(selectedEnigma.miscChoices || []).map((choice, index) => (
                      <div className="row row-auto" key={`${selectedEnigma.id}-choice-${index}`}>
                        <input value={choice} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscChoices[index] = e.target.value;
                        })} />
                        <button type="button" className="danger-button" onClick={() => {
                          if (!window.confirm('Supprimer ce choix ?')) return;
                          updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscChoices = (enigma.miscChoices || []).filter((_, choiceIndex) => choiceIndex !== index);
                          });
                        }}>Supprimer</button>
                      </div>
                    ))}
                    {(selectedEnigma.miscMode || 'free-answer') === 'multiple-choice' ? (
                      <p className="small-note">Le bon choix est celui qui correspond à la solution attendue.</p>
                    ) : null}
                    {(selectedEnigma.miscMode || 'free-answer') === 'ordering' ? (
                      <p className="small-note">L’ordre configuré ici est l’ordre correct attendu côté joueur.</p>
                    ) : null}
                    {(selectedEnigma.miscMode || 'free-answer') === 'accepted-answers' ? (
                      <p className="small-note">Le joueur valide si sa phrase contient au moins une de ces réponses.</p>
                    ) : null}
                  </>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'true-false' ? (
                  <p className="small-note">Écris <code>vrai</code> ou <code>faux</code> dans Solution attendue.</p>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'numeric-range' ? (
                  <div className="grid-two">
                    <div>
                      <HelpLabel help={FIELD_HELP.miscRange}>Minimum accepté</HelpLabel>
                      <input type="number" value={selectedEnigma.miscMin ?? ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscMin = e.target.value;
                      })} />
                    </div>
                    <div>
                      <HelpLabel help={FIELD_HELP.miscRange}>Maximum accepté</HelpLabel>
                      <input type="number" value={selectedEnigma.miscMax ?? ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscMax = e.target.value;
                      })} />
                    </div>
                  </div>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'exact-number' ? (
                  <p className="small-note">Écris le nombre exact attendu dans Solution attendue. Les espaces et virgules autour sont ignorés.</p>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'item-select' ? (
                  <div>
                    <HelpLabel help={FIELD_HELP.miscTargetItem}>Objet attendu</HelpLabel>
                    <select value={selectedEnigma.miscTargetItemId || ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.miscTargetItemId = e.target.value;
                    })}>
                      <option value="">Aucun</option>
                      {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <p className="small-note">Le joueur devra choisir cet objet dans une liste.</p>
                  </div>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'matching' ? (
                  <>
                    <div className="panel-head panel-head-spaced">
                      <HelpLabel className="compact-section-title" help={FIELD_HELP.miscPairs}>Paires attendues</HelpLabel>
                      <button type="button" onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscPairs = [...(enigma.miscPairs || []), { left: 'Élément', right: 'Réponse' }];
                      })}>+ Paire</button>
                    </div>
                    {(selectedEnigma.miscPairs || []).map((pair, index) => (
                      <div className="row row-three" key={`${selectedEnigma.id}-pair-${index}`}>
                        <input value={pair.left || ''} placeholder="Élément" onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscPairs[index] = { ...(enigma.miscPairs[index] || {}), left: e.target.value };
                        })} />
                        <input value={pair.right || ''} placeholder="Association" onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscPairs[index] = { ...(enigma.miscPairs[index] || {}), right: e.target.value };
                        })} />
                        <button type="button" className="danger-button" onClick={() => {
                          if (!window.confirm('Supprimer cette paire ?')) return;
                          updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscPairs = (enigma.miscPairs || []).filter((_, pairIndex) => pairIndex !== index);
                          });
                        }}>Supprimer</button>
                      </div>
                    ))}
                  </>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'multi-select' ? (
                  <>
                    <HelpLabel help={FIELD_HELP.miscChoices}>Bonnes réponses</HelpLabel>
                    <div className="stack-8">
                      {(selectedEnigma.miscChoices || []).map((choice) => (
                        <label key={choice} className="checkbox-row">
                          <input type="checkbox" checked={(selectedEnigma.miscCorrectChoices || []).includes(choice)} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                            const current = enigma.miscCorrectChoices || [];
                            enigma.miscCorrectChoices = e.target.checked ?
                               [...new Set([...current, choice])]
                              : current.filter((entry) => entry !== choice);
                          })} />
                          {choice}
                        </label>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            ) : null}

            <div className="combo-card subtle-card">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={FIELD_HELP.popupBackground}>Fond de pop-up</HelpLabel>
                <div className="inline-actions">
                  <input
                    ref={popupBackgroundInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden-input"
                    onChange={(event) => handleUpload(event, (dataUrl, fileName) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.popupBackgroundData = dataUrl;
                      enigma.popupBackgroundName = fileName;
                      enigma.popupBackgroundZoom = Number(enigma.popupBackgroundZoom) || 1;
                      enigma.popupBackgroundX = Number.isFinite(Number(enigma.popupBackgroundX)) ? Number(enigma.popupBackgroundX) : 50;
                      enigma.popupBackgroundY = Number.isFinite(Number(enigma.popupBackgroundY)) ? Number(enigma.popupBackgroundY) : 50;
                      enigma.popupBackgroundOverlay = ['light', 'medium', 'dark'].includes(enigma.popupBackgroundOverlay) ? enigma.popupBackgroundOverlay : 'dark';
                    }))}
                  />
                  <button type="button" onClick={() => popupBackgroundInputRef.current?.click()}>
                    {selectedEnigma.popupBackgroundData ? 'Remplacer le fond' : 'Importer un fond'}
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={!selectedEnigma.popupBackgroundData}
                    onClick={() => {
                      if (!window.confirm('Supprimer le fond de cette énigme ?')) return;
                      updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.popupBackgroundData = '';
                      enigma.popupBackgroundName = '';
                      });
                    }}
                  >
                    Supprimer le fond ?
                  </button>
                </div>
              </div>

              {selectedEnigma.popupBackgroundData ? (
                <>
                  <div
                    className="enigma-popup-preview"
                    style={{
                      backgroundImage: `${POPUP_OVERLAY_GRADIENTS[selectedEnigma.popupBackgroundOverlay || 'dark']}, url(${selectedEnigma.popupBackgroundData})`,
                      backgroundSize: `${Math.round((Number(selectedEnigma.popupBackgroundZoom) || 1) * 100)}%`,
                      backgroundPosition: `${Number(selectedEnigma.popupBackgroundX) || 50}% ${Number(selectedEnigma.popupBackgroundY) || 50}%`,
                    }}
                  >
                    <div className="enigma-popup-writing-zone">
                      <strong>Zone d’écriture</strong>
                      <p className="small-note tight">Ajuste l’image pour garder le texte lisible.</p>
                    </div>
                  </div>
                  <HelpLabel help={FIELD_HELP.popupBackgroundCrop}>Zoom</HelpLabel>
                  <input type="range" min="1" max="3" step="0.05" value={Number(selectedEnigma.popupBackgroundZoom) || 1} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.popupBackgroundZoom = Number(e.target.value);
                  })} />
                  <HelpLabel help={FIELD_HELP.popupBackgroundOverlay}>Voile de lisibilité</HelpLabel>
                  <select value={selectedEnigma.popupBackgroundOverlay || 'dark'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.popupBackgroundOverlay = e.target.value;
                  })}>
                    {POPUP_OVERLAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <div className="grid-two">
                    <div>
                      <HelpLabel help={FIELD_HELP.popupBackgroundCrop}>Horizontal</HelpLabel>
                      <input type="range" min="0" max="100" step="1" value={Number(selectedEnigma.popupBackgroundX) || 50} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.popupBackgroundX = Number(e.target.value);
                      })} />
                    </div>
                    <div>
                      <HelpLabel help={FIELD_HELP.popupBackgroundCrop}>Vertical</HelpLabel>
                      <input type="range" min="0" max="100" step="1" value={Number(selectedEnigma.popupBackgroundY) || 50} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.popupBackgroundY = Number(e.target.value);
                      })} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="small-note">Aucun fond personnalisé. La pop-up utilisera le style sombre par défaut.</p>
              )}
            </div>

            {usesColorSequence(selectedEnigma.type) ? (
              <>
                <div className="panel-head panel-head-spaced">
                  <HelpLabel className="compact-section-title" help={FIELD_HELP.colorSequence}>Combinaison gagnante</HelpLabel>
                  <button onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.solutionColors = [...(enigma.solutionColors || []), 'red'];
                  })}>+ Couleur</button>
                </div>
                {(selectedEnigma.solutionColors || []).map((color, index) => (
                  <div className="row row-auto" key={`${selectedEnigma.id}-${index}`}>
                    <select value={color} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.solutionColors[index] = e.target.value;
                    })}>
                      {COLOR_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="danger-button" onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.solutionColors = (enigma.solutionColors || []).filter((_, colorIndex) => colorIndex !== index);
                    })}>Supprimer</button>
                  </div>
                ))}
                <p className="small-note">
                  Ordre important : le joueur devra reproduire cette suite de couleurs.
                </p>
              </>
            ) : null}

            {usesEditorImageEnigma(selectedEnigma.type) ? (
              <>
                <div className="panel-head panel-head-spaced">
                  <HelpLabel className="compact-section-title" help={FIELD_HELP.imageSource}>Image source</HelpLabel>
                  <div className="inline-actions">
                    <input
                      ref={imageInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden-input"
                      onChange={(event) => handleUpload(event, (dataUrl, fileName) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.imageData = dataUrl;
                        enigma.imageName = fileName;
                      }))}
                    />
                    <button type="button" onClick={() => imageInputRef.current?.click()}>
                      {selectedEnigma.imageData ? 'Remplacer l’image' : 'Importer une image'}
                    </button>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={!selectedEnigma.imageData}
                      onClick={() => {
                        if (!window.confirm("Supprimer l'image de cette énigme ?")) return;
                        updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.imageData = '';
                        enigma.imageName = '';
                        });
                      }}
                    >
                      Supprimer l’image ?
                    </button>
                  </div>
                </div>
                {selectedEnigma.imageData ? (
                  <img className="thumb" src={selectedEnigma.imageData} alt={selectedEnigma.imageName || selectedEnigma.name} />
                ) : (
                  <p className="small-note">L’image sera découpée automatiquement en pièces au moment du jeu.</p>
                )}
                <div className="grid-two">
                  <div>
                    <HelpLabel help={FIELD_HELP.gridRows}>Nombre de lignes</HelpLabel>
                    <input type="number" min="2" max="6" value={selectedEnigma.gridRows || 3} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.gridRows = Math.max(2, Math.min(6, Number(e.target.value) || 3));
                    })} />
                  </div>
                  <div>
                    <HelpLabel help={FIELD_HELP.gridCols}>Nombre de colonnes</HelpLabel>
                    <input type="number" min="2" max="6" value={selectedEnigma.gridCols || 3} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.gridCols = Math.max(2, Math.min(6, Number(e.target.value) || 3));
                    })} />
                  </div>
                </div>
                <p className="small-note">
                  Les pièces sont mélangées automatiquement. Le joueur clique sur 2 pièces pour les échanger.
                </p>
              </>
            ) : null}

            <div className="grid-two" data-tour="enigma-unlock">
              <div>
                <HelpLabel help={FIELD_HELP.successMessage}>Message de réussite</HelpLabel>
                <textarea value={selectedEnigma.successMessage} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.successMessage = e.target.value;
                })} />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.failMessage}>Message d’échec</HelpLabel>
                <textarea value={selectedEnigma.failMessage} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.failMessage = e.target.value;
                })} />
              </div>
            </div>

            <div className="grid-two">
              <div>
                <HelpLabel help={FIELD_HELP.unlockType}>Débloque</HelpLabel>
                <select value={selectedEnigma.unlockType || 'none'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.unlockType = e.target.value;
                  if (e.target.value !== 'scene') enigma.targetSceneId = '';
                  if (e.target.value !== 'cinematic') enigma.targetCinematicId = '';
                })}>
                  <option value="none">Rien / juste valider</option>
                  <option value="scene">Accès à une scène</option>
                  <option value="cinematic">Lancer une cinématique</option>
                </select>
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.targetScene}>Scène à débloquer</HelpLabel>
                <select value={selectedEnigma.targetSceneId || ''} disabled={(selectedEnigma.unlockType || 'none') !== 'scene'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.targetSceneId = e.target.value;
                })}>
                  <option value="">Aucune</option>
                  {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                </select>
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.targetCinematic}>Cinématique à lancer</HelpLabel>
                <select value={selectedEnigma.targetCinematicId || ''} disabled={(selectedEnigma.unlockType || 'none') !== 'cinematic'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.targetCinematicId = e.target.value;
                })}>
                  <option value="">Aucune</option>
                  {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                </select>
              </div>
            </div>

              </div>

              <EnigmaPreviewAside
                selectedEnigma={selectedEnigma}
                selectedCodeSkin={selectedCodeSkin}
                solutionPreview={solutionPreview}
                selectedColorLogic={selectedColorLogic}
                colorPreview={colorPreview}
                selectedMiscMode={selectedMiscMode}
                project={project}
                selectedImagePuzzleLogic={selectedImagePuzzleLogic}
                selectedImageCutStyle={selectedImageCutStyle}
                imagePreviewBackground={imagePreviewBackground}
                updateEnigma={updateEnigma}
              />
            </div>
          </div>
        ) : <p>Sélectionne une énigme à gauche, ou crée-en une nouvelle.</p>}
      </section>
    </div>
  );
}
