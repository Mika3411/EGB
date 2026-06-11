import { useEffect } from 'react';
import {
  COLOR_LOGIC_LABELS,
  COLOR_OPTIONS,
  DEPRECATED_ENIGMA_TYPES,
  FIELD_HELP,
  MISC_MODE_OPTIONS,
  POPUP_OVERLAY_GRADIENTS,
  POPUP_OVERLAY_OPTIONS,
  TYPE_LABELS,
} from '../../../shared/data/enigmaConfig';
import {
  createEnigmaEditorModel,
  ensureEnigmaTypeDefaults,
  usesColorSequence,
  usesEditorImageEnigma,
} from '../../../shared/services/enigmaEngine';
import HelpLabel from '../../../shared/ui/forms/HelpLabel';
import EnigmaList from './components/EnigmaList';
import EnigmaPreviewAside from './components/EnigmaPreviewAside';
import MediaSourcePicker from '../../../shared/ui/media/MediaSourcePicker.jsx';
import { showConfirm } from '../../../shared/ui/AccessibleDialog';
import { useEditorPanelText } from '../../../shared/i18n';
import { getProjectLinkOptions } from '../studio/components/HotspotActionFields.jsx';
import { isProfessionalAccount } from '../../../shared/services/accountPlans';
import { isProPromotionProject } from '../../../shared/services/proPromotion';

export default function EnigmaStudio({
  project,
  user,
  projectLibrary = [],
  activeProjectId = '',
  selectedEnigmaId,
  setSelectedEnigmaId,
  selectedEnigma,
  addEnigma,
  deleteEnigma,
  patchProject,
  getSceneLabel,
  handleUpload,
  mediaLibrary = [],
  previewEnigma,
}) {
  const { tx, txObject } = useEditorPanelText('enigma');
  const typeLabels = { ...TYPE_LABELS, ...txObject('typeLabels') };
  const miscModeOptions = MISC_MODE_OPTIONS.map(([value, label]) => [value, tx(`miscModes.${value}`, {}, label)]);
  const colorOptions = COLOR_OPTIONS.map(([value, label]) => [value, tx(`colors.${value}`, {}, label)]);
  const popupOverlayOptions = POPUP_OVERLAY_OPTIONS.map(([value, label]) => [value, tx(`overlays.${value}`, {}, label)]);

  const keepMobileFieldInView = (event) => {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 900px)').matches) return;
    const target = event.target;
    if (!target?.matches?.('input, select, textarea')) return;
    [80, 260, 520].forEach((delay) => {
      window.setTimeout(() => {
        target.scrollIntoView({ block: 'center', inline: 'nearest' });
      }, delay);
    });
  };

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

  const {
    solutionPreview,
    selectedCodeSkin,
    colorPreview,
    selectedColorLogic,
    selectedImagePuzzleLogic,
    selectedImageCutStyle,
    hasRightPreview,
    selectedMiscMode,
  } = createEnigmaEditorModel(selectedEnigma);
  const imagePreviewBackground = selectedEnigma?.imageData ?
     { backgroundImage: `url(${selectedEnigma.imageData})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};
  const isProPromotionMode = isProPromotionProject(project);
  const canUseProPages = isProfessionalAccount(user) || isProPromotionMode;
  const proPageOptions = getProjectLinkOptions(projectLibrary, activeProjectId, user);
  const selectedProPageOption = selectedEnigma?.targetProjectId
    && !proPageOptions.some((option) => option.id === selectedEnigma.targetProjectId)
    ? {
      id: selectedEnigma.targetProjectId,
      userId: selectedEnigma.targetProjectUserId || user?.id || '',
      title: tx('fields.targetProject', {}, 'Projet sélectionné'),
    }
    : null;
  const enigmaProPageOptions = selectedProPageOption ? [...proPageOptions, selectedProPageOption] : proPageOptions;

  return (
    <div className="layout two-cols-wide enigma-studio-layout">
      <div className="enigma-list-shell" data-tour="enigma-list">
      <EnigmaList
        enigmas={project.enigmas || []}
        selectedEnigmaId={selectedEnigmaId}
        setSelectedEnigmaId={setSelectedEnigmaId}
        addEnigma={addEnigma}
      />
      </div>

      <section className="panel main enigma-main-panel" onFocusCapture={keepMobileFieldInView}>
        <div className="panel-head">
          <h2>{tx('fields.editorTitle', {}, 'Éditeur d’énigme')}</h2>
          {selectedEnigma && (
            <div className="inline-actions end">
              <button type="button" className="secondary-action" data-tour="enigma-preview-button" onClick={() => previewEnigma?.(selectedEnigma.id)}>
                {tx('fields.preview', {}, 'Prévisualiser')}
              </button>
              <button className="danger-button" onClick={() => deleteEnigma(selectedEnigma.id)}>
                {tx('fields.delete', {}, 'Supprimer')}
              </button>
            </div>
          )}
        </div>

        {selectedEnigma ? (
          <div className="combo-card enigma-form-card">
            <div className={`enigma-editor-grid${hasRightPreview ? ' has-preview' : ''}`}>
              <div className="enigma-form-column">
            <div className="grid-two" data-tour="enigma-identity">
              <div>
                <HelpLabel help={FIELD_HELP.name}>{tx('fields.name', {}, 'Nom')}</HelpLabel>
                <input value={selectedEnigma.name} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.name = e.target.value;
                })} />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.type}>{tx('fields.type', {}, 'Type')}</HelpLabel>
                <select value={selectedEnigma.type} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.type = e.target.value;
                  ensureEnigmaTypeDefaults(enigma, e.target.value);
                })}>
                  {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>

            <HelpLabel help={FIELD_HELP.question}>{tx('fields.question', {}, 'Question / consigne')}</HelpLabel>
            <textarea data-tour="enigma-question" value={selectedEnigma.question} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
              enigma.question = e.target.value;
            })} />

            {selectedEnigma.type === 'code' ? (
              <>
                <HelpLabel help={FIELD_HELP.solution}>{tx('fields.solution', {}, 'Solution')}</HelpLabel>
                <input data-tour="enigma-solution" value={selectedEnigma.solutionText || ''} placeholder={tx('placeholders.codeSolution', {}, 'Ex : 1234 ou LUNE')} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.solutionText = e.target.value;
                })} />
              </>
            ) : null}

            {selectedEnigma.type === 'misc' ? (
              <>
                <div className="grid-two">
                  <div>
                    <HelpLabel help={FIELD_HELP.miscMode}>{tx('fields.miscMode', {}, 'Mode Divers')}</HelpLabel>
                    <select value={selectedEnigma.miscMode || 'free-answer'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.miscMode = e.target.value;
                      enigma.miscChoices = Array.isArray(enigma.miscChoices) && enigma.miscChoices.length ? enigma.miscChoices : [
                        tx('placeholders.answerA', {}, 'Réponse A'),
                        tx('placeholders.answerB', {}, 'Réponse B'),
                        tx('placeholders.answerC', {}, 'Réponse C'),
                      ];
                    })}>
                      {miscModeOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help={FIELD_HELP.solution}>{tx('fields.expectedSolution', {}, 'Solution attendue')}</HelpLabel>
                    <input value={selectedEnigma.solutionText || ''} placeholder={tx('placeholders.textSolution', {}, 'Ex : LUNE')} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.solutionText = e.target.value;
                    })} />
                  </div>
                </div>

                {['free-answer', 'fill-blank', 'accepted-answers'].includes(selectedEnigma.miscMode || 'free-answer') ? (
                  <p className="small-note">{tx('notes.flexibleValidation', {}, 'Validation souple : la réponse est acceptée même avec ou sans majuscules, et même si le joueur ajoute des mots autour.')}</p>
                ) : null}

                {['multiple-choice', 'ordering', 'multi-select', 'accepted-answers'].includes(selectedEnigma.miscMode || 'free-answer') ? (
                  <>
                    <div className="panel-head panel-head-spaced">
                      <HelpLabel className="compact-section-title" help={FIELD_HELP.miscChoices}>
                        {(selectedEnigma.miscMode || 'free-answer') === 'ordering' ?
                           tx('fields.expectedOrder', {}, 'Ordre attendu')
                          : (selectedEnigma.miscMode || 'free-answer') === 'accepted-answers' ?
                             tx('fields.acceptedAnswers', {}, 'Réponses acceptées')
                            : tx('fields.proposedChoices', {}, 'Choix proposés')}
                      </HelpLabel>
                      <button type="button" onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscChoices = [...(enigma.miscChoices || []), tx('placeholders.newChoice', {}, 'Nouvelle réponse')];
                      })}>{tx('buttons.addChoice', {}, '+ Choix')}</button>
                    </div>
                    {(selectedEnigma.miscChoices || []).map((choice, index) => (
                      <div className="row row-auto" key={`${selectedEnigma.id}-choice-${index}`}>
                        <input value={choice} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscChoices[index] = e.target.value;
                        })} />
                        <button type="button" className="danger-button" onClick={async () => {
                          const confirmed = await showConfirm({
                            title: tx('confirm.deleteChoiceTitle', {}, 'Supprimer le choix'),
                            message: tx('confirm.deleteChoiceMessage', {}, 'Supprimer ce choix ?'),
                            confirmLabel: tx('fields.delete', {}, 'Supprimer'),
                            variant: 'danger',
                          });
                          if (!confirmed) return;
                          updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscChoices = (enigma.miscChoices || []).filter((_, choiceIndex) => choiceIndex !== index);
                          });
                        }}>{tx('buttons.deleteChoice', {}, 'Supprimer')}</button>
                      </div>
                    ))}
                    {(selectedEnigma.miscMode || 'free-answer') === 'multiple-choice' ? (
                      <p className="small-note">{tx('notes.goodChoice', {}, 'Le bon choix est celui qui correspond à la solution attendue.')}</p>
                    ) : null}
                    {(selectedEnigma.miscMode || 'free-answer') === 'ordering' ? (
                      <p className="small-note">{tx('notes.ordering', {}, 'L’ordre configuré ici est l’ordre correct attendu côté joueur.')}</p>
                    ) : null}
                    {(selectedEnigma.miscMode || 'free-answer') === 'accepted-answers' ? (
                      <p className="small-note">{tx('notes.acceptedAnswers', {}, 'Le joueur valide si sa phrase contient au moins une de ces réponses.')}</p>
                    ) : null}
                  </>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'true-false' ? (
                  <p className="small-note">{tx('notes.trueFalse', {}, 'Écris vrai ou faux dans Solution attendue.')}</p>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'numeric-range' ? (
                  <div className="grid-two">
                    <div>
                      <HelpLabel help={FIELD_HELP.miscRange}>{tx('fields.acceptedMin', {}, 'Minimum accepté')}</HelpLabel>
                      <input type="number" value={selectedEnigma.miscMin ?? ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscMin = e.target.value;
                      })} />
                    </div>
                    <div>
                      <HelpLabel help={FIELD_HELP.miscRange}>{tx('fields.acceptedMax', {}, 'Maximum accepté')}</HelpLabel>
                      <input type="number" value={selectedEnigma.miscMax ?? ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscMax = e.target.value;
                      })} />
                    </div>
                  </div>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'exact-number' ? (
                  <p className="small-note">{tx('notes.exactNumber', {}, 'Écris le nombre exact attendu dans Solution attendue. Les espaces et virgules autour sont ignorés.')}</p>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'item-select' ? (
                  <div>
                    <HelpLabel help={FIELD_HELP.miscTargetItem}>{tx('fields.expectedItem', {}, 'Objet attendu')}</HelpLabel>
                    <select value={selectedEnigma.miscTargetItemId || ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.miscTargetItemId = e.target.value;
                    })}>
                      <option value="">{tx('options.none', {}, 'Aucun')}</option>
                      {(project.items || []).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                    </select>
                    <p className="small-note">{tx('notes.itemSelect', {}, 'Le joueur devra choisir cet objet dans une liste.')}</p>
                  </div>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'matching' ? (
                  <>
                    <div className="panel-head panel-head-spaced">
                      <HelpLabel className="compact-section-title" help={FIELD_HELP.miscPairs}>{tx('fields.expectedPairs', {}, 'Paires attendues')}</HelpLabel>
                      <button type="button" onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.miscPairs = [...(enigma.miscPairs || []), { left: tx('placeholders.element', {}, 'Élément'), right: tx('placeholders.newChoice', {}, 'Réponse') }];
                      })}>{tx('buttons.addPair', {}, '+ Paire')}</button>
                    </div>
                    {(selectedEnigma.miscPairs || []).map((pair, index) => (
                      <div className="row row-three" key={`${selectedEnigma.id}-pair-${index}`}>
                        <input value={pair.left || ''} placeholder={tx('placeholders.element', {}, 'Élément')} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscPairs[index] = { ...(enigma.miscPairs[index] || {}), left: e.target.value };
                        })} />
                        <input value={pair.right || ''} placeholder={tx('placeholders.association', {}, 'Association')} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscPairs[index] = { ...(enigma.miscPairs[index] || {}), right: e.target.value };
                        })} />
                        <button type="button" className="danger-button" onClick={async () => {
                          const confirmed = await showConfirm({
                            title: tx('confirm.deletePairTitle', {}, 'Supprimer la paire'),
                            message: tx('confirm.deletePairMessage', {}, 'Supprimer cette paire ?'),
                            confirmLabel: tx('fields.delete', {}, 'Supprimer'),
                            variant: 'danger',
                          });
                          if (!confirmed) return;
                          updateEnigma(selectedEnigma.id, (enigma) => {
                          enigma.miscPairs = (enigma.miscPairs || []).filter((_, pairIndex) => pairIndex !== index);
                          });
                        }}>{tx('buttons.deleteChoice', {}, 'Supprimer')}</button>
                      </div>
                    ))}
                  </>
                ) : null}

                {(selectedEnigma.miscMode || 'free-answer') === 'multi-select' ? (
                  <>
                    <HelpLabel help={FIELD_HELP.miscChoices}>{tx('fields.goodAnswers', {}, 'Bonnes réponses')}</HelpLabel>
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

            <div className="combo-card subtle-card" data-tour="enigma-popup-background">
              <div className="panel-head">
                <HelpLabel className="compact-section-title" help={FIELD_HELP.popupBackground}>{tx('fields.popupBackground', {}, 'Fond de pop-up')}</HelpLabel>
                <div className="inline-actions">
                  <MediaSourcePicker
                    className="button like"
                    accept="image/*"
                    assetScope="object-image"
                    handleUpload={handleUpload}
                    mediaLibrary={mediaLibrary}
                    onSelect={(dataUrl, fileName) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.popupBackgroundData = dataUrl;
                      enigma.popupBackgroundName = fileName;
                      enigma.popupBackgroundZoom = Number(enigma.popupBackgroundZoom) || 1;
                      enigma.popupBackgroundX = Number.isFinite(Number(enigma.popupBackgroundX)) ? Number(enigma.popupBackgroundX) : 50;
                      enigma.popupBackgroundY = Number.isFinite(Number(enigma.popupBackgroundY)) ? Number(enigma.popupBackgroundY) : 50;
                      enigma.popupBackgroundOverlay = ['light', 'medium', 'dark'].includes(enigma.popupBackgroundOverlay) ? enigma.popupBackgroundOverlay : 'dark';
                    })}
                    tourId="enigma-popup-background-button"
                  >
                    {selectedEnigma.popupBackgroundData
                      ? tx('buttons.replaceBackground', {}, 'Remplacer le fond')
                      : tx('buttons.importBackground', {}, 'Importer un fond')}
                  </MediaSourcePicker>
                  <button
                    type="button"
                    className="danger-button"
                    disabled={!selectedEnigma.popupBackgroundData}
                    onClick={async () => {
                      const confirmed = await showConfirm({
                        title: tx('confirm.deleteBackgroundTitle', {}, 'Supprimer le fond'),
                        message: tx('confirm.deleteBackgroundMessage', {}, 'Supprimer le fond de cette énigme ?'),
                        confirmLabel: tx('fields.delete', {}, 'Supprimer'),
                        variant: 'danger',
                      });
                      if (!confirmed) return;
                      updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.popupBackgroundData = '';
                      enigma.popupBackgroundName = '';
                      });
                    }}
                  >
                    {tx('buttons.deleteBackground', {}, 'Supprimer le fond')}
                  </button>
                </div>
              </div>

              {selectedEnigma.popupBackgroundData ? (
                <>
                  <div
                    data-tour="enigma-popup-background-preview"
                    className="enigma-popup-preview"
                    style={{
                      backgroundImage: `${POPUP_OVERLAY_GRADIENTS[selectedEnigma.popupBackgroundOverlay || 'dark']}, url(${selectedEnigma.popupBackgroundData})`,
                      backgroundSize: `${Math.round((Number(selectedEnigma.popupBackgroundZoom) || 1) * 100)}%`,
                      backgroundPosition: `${Number(selectedEnigma.popupBackgroundX) || 50}% ${Number(selectedEnigma.popupBackgroundY) || 50}%`,
                    }}
                  >
                    <div className="enigma-popup-writing-zone">
                      <strong>{tx('fields.writingZone', {}, 'Zone d’écriture')}</strong>
                      <p className="small-note tight">{tx('notes.adjustImage', {}, 'Ajuste l’image pour garder le texte lisible.')}</p>
                    </div>
                  </div>
                  <HelpLabel help={FIELD_HELP.popupBackgroundCrop}>{tx('fields.zoom', {}, 'Zoom')}</HelpLabel>
                  <input data-tour="enigma-popup-background-zoom" type="range" min="1" max="3" step="0.05" value={Number(selectedEnigma.popupBackgroundZoom) || 1} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.popupBackgroundZoom = Number(e.target.value);
                  })} />
                  <HelpLabel help={FIELD_HELP.popupBackgroundOverlay}>{tx('fields.readabilityOverlay', {}, 'Voile de lisibilité')}</HelpLabel>
                  <select data-tour="enigma-popup-background-overlay" value={selectedEnigma.popupBackgroundOverlay || 'dark'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.popupBackgroundOverlay = e.target.value;
                  })}>
                    {popupOverlayOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  <div className="grid-two">
                    <div>
                      <HelpLabel help={FIELD_HELP.popupBackgroundCrop}>{tx('fields.horizontal', {}, 'Horizontal')}</HelpLabel>
                      <input type="range" min="0" max="100" step="1" value={Number(selectedEnigma.popupBackgroundX) || 50} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.popupBackgroundX = Number(e.target.value);
                      })} />
                    </div>
                    <div>
                      <HelpLabel help={FIELD_HELP.popupBackgroundCrop}>{tx('fields.vertical', {}, 'Vertical')}</HelpLabel>
                      <input type="range" min="0" max="100" step="1" value={Number(selectedEnigma.popupBackgroundY) || 50} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.popupBackgroundY = Number(e.target.value);
                      })} />
                    </div>
                  </div>
                </>
              ) : (
                <p className="small-note">{tx('notes.noCustomBackground', {}, 'Aucun fond personnalisé. La pop-up utilisera le style sombre par défaut.')}</p>
              )}
            </div>

            {usesColorSequence(selectedEnigma.type) ? (
              <>
                <div className="panel-head panel-head-spaced">
                  <HelpLabel className="compact-section-title" help={FIELD_HELP.colorSequence}>{tx('fields.winningCombination', {}, 'Combinaison gagnante')}</HelpLabel>
                  <button onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                    enigma.solutionColors = [...(enigma.solutionColors || []), 'red'];
                  })}>{tx('buttons.addColor', {}, '+ Couleur')}</button>
                </div>
                {(selectedEnigma.solutionColors || []).map((color, index) => (
                  <div className="row row-auto" key={`${selectedEnigma.id}-${index}`}>
                    <select value={color} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.solutionColors[index] = e.target.value;
                    })}>
                      {colorOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                    <button className="danger-button" onClick={() => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.solutionColors = (enigma.solutionColors || []).filter((_, colorIndex) => colorIndex !== index);
                    })}>{tx('fields.delete', {}, 'Supprimer')}</button>
                  </div>
                ))}
                <p className="small-note">
                  {tx('notes.colorOrder', {}, 'Ordre important : le joueur devra reproduire cette suite de couleurs.')}
                </p>
              </>
            ) : null}

            {usesEditorImageEnigma(selectedEnigma.type) ? (
              <>
                <div className="panel-head panel-head-spaced">
                  <HelpLabel className="compact-section-title" help={FIELD_HELP.imageSource}>{tx('fields.imageSource', {}, 'Image source')}</HelpLabel>
                  <div className="inline-actions">
                    <MediaSourcePicker
                      className="button like"
                      accept="image/*"
                      assetScope="object-image"
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      onSelect={(dataUrl, fileName) => updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.imageData = dataUrl;
                        enigma.imageName = fileName;
                      })}
                    >
                      {selectedEnigma.imageData
                        ? tx('buttons.replaceImage', {}, 'Remplacer l’image')
                        : tx('buttons.importImage', {}, 'Importer une image')}
                    </MediaSourcePicker>
                    <button
                      type="button"
                      className="danger-button"
                      disabled={!selectedEnigma.imageData}
                      onClick={async () => {
                        const confirmed = await showConfirm({
                          title: tx('confirm.deleteImageTitle', {}, "Supprimer l'image"),
                          message: tx('confirm.deleteImageMessage', {}, "Supprimer l'image de cette énigme ?"),
                          confirmLabel: tx('fields.delete', {}, 'Supprimer'),
                          variant: 'danger',
                        });
                        if (!confirmed) return;
                        updateEnigma(selectedEnigma.id, (enigma) => {
                        enigma.imageData = '';
                        enigma.imageName = '';
                        });
                      }}
                    >
                      {tx('buttons.deleteImage', {}, 'Supprimer l’image')}
                    </button>
                  </div>
                </div>
                {selectedEnigma.imageData ? (
                  <img className="thumb" src={selectedEnigma.imageData} alt={selectedEnigma.imageName || selectedEnigma.name} />
                ) : (
                  <p className="small-note">{tx('notes.imageCutAuto', {}, 'L’image sera découpée automatiquement en pièces au moment du jeu.')}</p>
                )}
                <div className="grid-two">
                  <div>
                    <HelpLabel help={FIELD_HELP.gridRows}>{tx('fields.rows', {}, 'Nombre de lignes')}</HelpLabel>
                    <input type="number" min="2" max="6" value={selectedEnigma.gridRows || 3} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.gridRows = Math.max(2, Math.min(6, Number(e.target.value) || 3));
                    })} />
                  </div>
                  <div>
                    <HelpLabel help={FIELD_HELP.gridCols}>{tx('fields.cols', {}, 'Nombre de colonnes')}</HelpLabel>
                    <input type="number" min="2" max="6" value={selectedEnigma.gridCols || 3} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                      enigma.gridCols = Math.max(2, Math.min(6, Number(e.target.value) || 3));
                    })} />
                  </div>
                </div>
                <p className="small-note">
                  {tx('notes.imagePieces', {}, 'Les pièces sont mélangées automatiquement. Le joueur clique sur 2 pièces pour les échanger.')}
                </p>
              </>
            ) : null}

            <div className="grid-two" data-tour="enigma-unlock">
              <div>
                <HelpLabel help={FIELD_HELP.successMessage}>{tx('fields.successMessage', {}, 'Message de réussite')}</HelpLabel>
                <textarea value={selectedEnigma.successMessage} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.successMessage = e.target.value;
                })} />
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.failMessage}>{tx('fields.failMessage', {}, 'Message d’échec')}</HelpLabel>
                <textarea value={selectedEnigma.failMessage} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.failMessage = e.target.value;
                })} />
              </div>
            </div>

            <div className="grid-two">
              <div>
                <HelpLabel help={FIELD_HELP.unlockType}>{tx('fields.unlock', {}, 'Débloqué')}</HelpLabel>
                <select value={selectedEnigma.unlockType || 'none'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.unlockType = e.target.value;
                  if (e.target.value !== 'scene') enigma.targetSceneId = '';
                  if (e.target.value !== 'cinematic') enigma.targetCinematicId = '';
                  if (e.target.value !== 'project_link') {
                    enigma.targetProjectId = '';
                    enigma.targetProjectUserId = '';
                  }
                })}>
                  <option value="none">{tx('options.unlockNone', {}, 'Rien / juste valider')}</option>
                  <option value="scene">{tx('options.unlockScene', {}, 'Accès à une scène')}</option>
                  <option value="cinematic">{tx('options.unlockCinematic', {}, 'Lancer une cinématique')}</option>
                  {canUseProPages ? <option value="project_link">{tx('options.unlockProject', {}, 'Page pro')}</option> : null}
                </select>
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.targetScene}>{tx('fields.unlockScene', {}, 'Scène à débloquer')}</HelpLabel>
                <select value={selectedEnigma.targetSceneId || ''} disabled={(selectedEnigma.unlockType || 'none') !== 'scene'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.targetSceneId = e.target.value;
                })}>
                  <option value="">{tx('options.none', {}, 'Aucune')}</option>
                  {project.scenes.map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                </select>
              </div>
              <div>
                <HelpLabel help={FIELD_HELP.targetCinematic}>{tx('fields.launchCinematic', {}, 'Cinématique à lancer')}</HelpLabel>
                <select value={selectedEnigma.targetCinematicId || ''} disabled={(selectedEnigma.unlockType || 'none') !== 'cinematic'} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                  enigma.targetCinematicId = e.target.value;
                })}>
                  <option value="">{tx('options.none', {}, 'Aucune')}</option>
                  {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                </select>
              </div>
              {canUseProPages && (selectedEnigma.unlockType || 'none') === 'project_link' ? (
                <div>
                  <HelpLabel help="Projet ouvert dans un nouvel onglet après validation de l’énigme.">{tx('fields.targetProject', {}, 'Projet cible')}</HelpLabel>
                  <select value={selectedEnigma.targetProjectId || ''} onChange={(e) => updateEnigma(selectedEnigma.id, (enigma) => {
                    const nextProject = enigmaProPageOptions.find((option) => option.id === e.target.value);
                    enigma.targetProjectId = nextProject?.id || '';
                    enigma.targetProjectUserId = nextProject?.userId || '';
                  })}>
                    <option value="">{tx('options.chooseProject', {}, 'Choisir un projet')}</option>
                    {enigmaProPageOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.title}</option>
                    ))}
                  </select>
                </div>
              ) : null}
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
        ) : <p>{tx('notes.empty', {}, 'Sélectionne une énigme à gauche, ou crée-en une nouvelle.')}</p>}
      </section>
    </div>
  );
}
