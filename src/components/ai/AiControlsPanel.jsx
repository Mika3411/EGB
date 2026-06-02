import { ArrowDown, ArrowLeft, ArrowUp, Check, FilePlus2, GitBranch, Layers3, RefreshCw, WandSparkles } from 'lucide-react';
import {
  AiPrivacyNotice,
  HelpLabel,
  getActionEstimate,
  getLastSceneIdFromChronology,
  makeProjectStorySummary,
  makeSceneChronology,
  parseChronologyEntries,
} from './aiTabHelpers.js';

const STYLE_PREVIEW_IMAGES = {
  realistic: '/assets/ai-style-realistic.png',
  illustrated: '/assets/ai-style-anime.png',
};

const STYLE_PREVIEW_COPY = {
  realistic: {
    title: 'Réaliste',
    description: 'Rendu film, matières naturelles, profondeur et ambiance crédible.',
    detail: 'Idéal pour un escape game sombre, immersif et proche du cinéma.',
  },
  illustrated: {
    title: 'Anime / BD',
    description: 'Contours expressifs, ombres dessinées, tension visuelle stylisée.',
    detail: 'Idéal pour une aventure narrative plus graphique et dramatique.',
  },
};

const ACTION_MODE_VISUALS = {
  generate: {
    Icon: FilePlus2,
    label: 'Complet',
  },
  progressive: {
    Icon: Layers3,
    label: 'Étapes',
  },
  extend: {
    Icon: GitBranch,
    label: 'Suite',
  },
  improve: {
    Icon: WandSparkles,
    label: 'Raffiner',
  },
};

const getDefaultStepMeta = (statusValue, isLocked, doneLabel, readyLabel, lockedLabel = 'verrouillé') => {
  if (statusValue === 'running') return { icon: '...', label: 'En cours' };
  if (statusValue === 'done') return { icon: 'OK', label: doneLabel };
  if (isLocked) return { icon: 'LOCK', label: lockedLabel };
  return { icon: 'GO', label: readyLabel };
};

export default function AiControlsPanel({
  mode,
  setMode,
  isGenerating,
  aiCredits,
  currentTextGenerationCost,
  refreshAiCredits,
  isChoiceAdventureAi,
  isBeginnerAi,
  calculateProjectGenerationCreditCost,
  formatCreditCost,
  getAiCreditCost,
  countCreditUnits,
  brief,
  calculateBriefImageCreditCost,
  calculateBriefTotalCreditCost,
  imageStylePreset,
  setImageStylePreset,
  imageStylePresets,
  globalVisualStyle,
  setGlobalVisualStyle,
  imageReadabilityLevel,
  setImageReadabilityLevel,
  visualInheritance,
  setVisualInheritance,
  fieldHelp,
  targetSceneId,
  setTargetSceneId,
  scenes,
  getSceneLabel,
  instruction,
  setInstruction,
  proposeIdeas,
  ideaSuggestions,
  useSuggestion,
  briefForm,
  progressiveActStages,
  progressiveStatus,
  hasEnoughAiCredits,
  getTextGenerationCreditCost,
  getStepMeta = getDefaultStepMeta,
  getProgressiveStageSummary,
  generateProgressiveStep,
  extendSource,
  setExtendSource,
  importedProject,
  importExtensionJson,
  storySummary,
  setStorySummary,
  extensionSourceProject,
  sceneChronology,
  moveChronologyEntry,
  setSceneChronology,
  setContinuationSceneId,
  continuationScene,
  extensionScenes,
  continuationWish,
  setContinuationWish,
  setExtendInstruction,
  extendExistingProject,
  canRunTextAi,
  generate,
  wizardStep = 'visual',
  setWizardStep = () => {},
  hasAiResult = false,
}) {
  const selectedStyle = STYLE_PREVIEW_COPY[imageStylePreset] || STYLE_PREVIEW_COPY.realistic;
  const modeOptions = [
    {
      value: 'generate',
      label: 'Nouveau projet',
      description: 'Créer un jeu complet avec scènes, objets et énigmes.',
    },
    ...(!isBeginnerAi ? [
      {
        value: 'progressive',
        label: 'Progressif',
        description: 'Générer acte par acte pour garder le contrôle.',
      },
      {
        value: 'extend',
        label: 'Continuer',
        description: 'Prolonger le projet actuel ou un JSON importé.',
      },
    ] : []),
    {
      value: 'improve',
      label: 'Améliorer',
      description: 'Raffiner une scène sans remplacer tout le projet.',
    },
  ];
  const selectedMode = modeOptions.find((option) => option.value === mode) || modeOptions[0];
  const selectVisualStyle = (value) => {
    setImageStylePreset(value);
    setWizardStep('action');
  };
  const selectActionMode = (value) => {
    setMode(value);
    setWizardStep('details');
  };

  const renderCreditPanel = () => (
    <div data-tour="ai-credits" className="ai-credit-panel ai-credit-summary">
      <div>
        <span className="section-kicker">Crédits IA</span>
        <strong>{aiCredits.isLoading ? '...' : `${aiCredits.balance ?? 0}`}</strong>
      </div>
      <button type="button" className="secondary-action ai-refresh-button" onClick={refreshAiCredits} disabled={aiCredits.isLoading}>
        <RefreshCw size={16} />
        Actualiser
      </button>
      {aiCredits.error ? <p className="small-note">{aiCredits.error}</p> : null}
    </div>
  );

  const renderVisualStep = () => (
    <div className="ai-wizard-step">
      <div className="ai-step-heading">
        <span className="section-kicker">Étape 1</span>
        <h3>Choisir le modèle visuel</h3>
        <p>Ce choix pilote le style des prochaines images IA: scènes, objets et cinématiques.</p>
      </div>

      <div className="ai-style-selection-layout">
        {renderCreditPanel()}
        <div className="ai-style-card-grid" data-tour="ai-image-style">
          {Object.entries(imageStylePresets).map(([value, preset]) => {
            const copy = STYLE_PREVIEW_COPY[value] || { title: preset.label, description: preset.description, detail: '' };
            const isSelected = imageStylePreset === value;
            return (
              <button
                type="button"
                key={value}
                className={`ai-style-card ${isSelected ? 'selected' : ''}`}
                onClick={() => selectVisualStyle(value)}
                aria-pressed={isSelected}
              >
                <span className="ai-style-card-image">
                  <img src={STYLE_PREVIEW_IMAGES[value]} alt={`Exemple ${copy.title}`} />
                </span>
                <span className="ai-style-card-body">
                  <span className="ai-style-card-title">
                    <strong>{preset.label || copy.title}</strong>
                    {isSelected ? <span><Check size={15} /> Sélectionné</span> : null}
                  </span>
                  <span>{copy.description}</span>
                  <small>{copy.detail}</small>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="ai-wizard-footer">
        <AiPrivacyNotice />
      </div>
    </div>
  );

  const renderVisualOptions = () => (
    <details className="ai-advanced-visual-options">
      <summary>Options visuelles</summary>
      <div className="ai-visual-tuning-grid">
        <div>
          <HelpLabel help="Style partagé par les images de scènes pour éviter que chaque pièce parte dans une direction visuelle différente.">Style visuel global</HelpLabel>
          <input data-tour="ai-visual-style" value={globalVisualStyle} onChange={(event) => setGlobalVisualStyle(event.target.value)} />
        </div>
        <div>
          <HelpLabel help="Ajuste automatiquement la luminosité après génération pour garder une image jouable sans trop délaver l'ambiance.">Lisibilité des images</HelpLabel>
          <select data-tour="ai-image-readability" value={imageReadabilityLevel} onChange={(event) => setImageReadabilityLevel(event.target.value)}>
            <option value="subtle">Ambiance sombre</option>
            <option value="balanced">Lisibilité renforcée</option>
            <option value="strong">Très lumineux</option>
            <option value="none">Aucune correction</option>
          </select>
        </div>
        <div>
          <HelpLabel help="Détails récurrents à conserver entre les pièces: portes, parquet, lumière, époque, matériaux.">Héritage visuel</HelpLabel>
          <textarea data-tour="ai-visual-inheritance" value={visualInheritance} onChange={(event) => setVisualInheritance(event.target.value)} />
        </div>
      </div>
    </details>
  );

  const renderModePicker = ({ advanceOnSelect = false } = {}) => (
    <div className="ai-wizard-section">
      <HelpLabel help={fieldHelp.mode}>Action IA</HelpLabel>
      <div className="ai-mode-card-grid" data-tour="ai-mode">
        {modeOptions.map((option) => {
          const visual = ACTION_MODE_VISUALS[option.value] || ACTION_MODE_VISUALS.generate;
          const ModeVisualIcon = visual.Icon;
          return (
            <button
              type="button"
              key={option.value}
              className={mode === option.value ? 'selected' : ''}
              onClick={() => (advanceOnSelect ? selectActionMode(option.value) : setMode(option.value))}
              aria-pressed={mode === option.value}
            >
              <span className="ai-mode-card-copy">
                <strong>{option.label}</strong>
                <span>{option.description}</span>
              </span>
              <span className={`ai-mode-card-visual ai-mode-card-visual--${option.value}`} aria-hidden="true">
                <ModeVisualIcon size={30} strokeWidth={2.2} />
                <small>{visual.label}</small>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  const renderActionStep = () => (
    <div className="ai-wizard-step ai-action-step">
      <div className="ai-action-step-header">
        <button type="button" className="secondary-action ai-back-step-button" onClick={() => setWizardStep('visual')}>
          <ArrowLeft size={16} />
          Retour
        </button>
        <span className="section-kicker">Étape 2</span>
      </div>
      {renderModePicker({ advanceOnSelect: true })}
    </div>
  );

  const renderProgressiveControls = () => (
    <>
      {briefForm}

      <div className="ai-progressive-steps">
        {progressiveActStages.map((stage, index) => {
          const actNumber = index + 1;
          const previousStage = index > 0 ? progressiveActStages[index - 1] : '';
          const statusValue = progressiveStatus[stage] || 'pending';
          const isAvailable = index === 0 || progressiveStatus[previousStage] === 'done';
          const cost = getTextGenerationCreditCost('progressive', stage);
          const meta = getStepMeta(statusValue, !isAvailable, `Acte ${actNumber} généré`, `Acte ${actNumber} disponible`);
          if (!isAvailable && statusValue !== 'running' && statusValue !== 'done') return null;
          return (
            <button type="button" key={stage} disabled={isGenerating || aiCredits.isLoading || !hasEnoughAiCredits('text', cost) || !isAvailable} onClick={() => generateProgressiveStep(stage)}>
              <strong>{meta.icon} Acte {actNumber}</strong>
              <span>{getProgressiveStageSummary(stage)} - {formatCreditCost(cost)}</span>
            </button>
          );
        })}
      </div>
    </>
  );

  const renderExtendControls = () => {
    const chronologyEntries = parseChronologyEntries(sceneChronology, extensionSourceProject);

    return (
      <>
        {briefForm}

        <div className="ai-extend-source-row">
          <div className="ai-extend-source-field">
            <HelpLabel help={fieldHelp.source}>Source</HelpLabel>
            <div className={`segmented-control compact ai-source-toggle ${importedProject ? '' : 'single-option'}`.trim()}>
              <button type="button" className={!importedProject || extendSource === 'current' ? 'active' : ''} onClick={() => setExtendSource('current')}>Projet actuel</button>
              {importedProject ? (
                <button type="button" className={extendSource === 'imported' ? 'active' : ''} onClick={() => setExtendSource('imported')}>JSON importé</button>
              ) : null}
            </div>
          </div>
          <div className="ai-extend-source-field ai-import-json-field">
            <HelpLabel help={fieldHelp.importJson}>JSON</HelpLabel>
            <label className="button like secondary-action ai-import-json-button">
              Importer un JSON
              <input type="file" accept="application/json,.json" hidden onChange={importExtensionJson} />
            </label>
          </div>
          {importedProject ? <p className="small-note ai-import-json-status">JSON chargé: {importedProject.title || 'Projet importé'}</p> : null}
        </div>

        <div className="ai-extend-layout">
          <div className="ai-extend-column">
            <section className="ai-extend-card">
              <HelpLabel help={fieldHelp.storySummary}>Résumé de l'histoire</HelpLabel>
              <textarea
                className="ai-story-summary-textarea"
                value={storySummary}
                onChange={(event) => setStorySummary(event.target.value)}
                placeholder="Résume les événements, révélations et objectifs déjà posés."
              />
              <div className="ai-extend-card-actions">
                <button type="button" className="secondary-action" onClick={() => setStorySummary(makeProjectStorySummary(extensionSourceProject))}>
                  Refaire le résumé depuis le projet
                </button>
              </div>
            </section>

            <section className="ai-extend-card">
              <HelpLabel help={fieldHelp.continuationScene}>Scène de départ détectée</HelpLabel>
              <select value={continuationScene?.id || ''} onChange={(event) => setContinuationSceneId(event.target.value)}>
                {extensionScenes.map((scene) => (
                  <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>
                ))}
              </select>
              <div className="ai-extend-card-actions">
                <button type="button" className="secondary-action" onClick={() => setContinuationSceneId(getLastSceneIdFromChronology(sceneChronology, extensionSourceProject))}>
                  Utiliser la dernière ligne
                </button>
              </div>
            </section>

            <section className="ai-extend-card">
              <HelpLabel help={fieldHelp.continuationWish}>Ce que tu aimerais pour la suite</HelpLabel>
              <textarea
                className="ai-continuation-wish-textarea"
                value={continuationWish}
                onChange={(event) => {
                  setContinuationWish(event.target.value);
                  setExtendInstruction(event.target.value);
                }}
                placeholder="Vide = suite aléatoire mais cohérente. Ex: révéler une cave secrète avec une énigme mécanique."
              />
              <div className="ai-extend-card-actions">
                <button type="button" className="secondary-action" onClick={proposeIdeas}>Proposer des idées</button>
              </div>
              {ideaSuggestions.length ? (
                <div className="ai-suggestion-list">
                  {ideaSuggestions.map((suggestion) => (
                    <button type="button" key={suggestion} onClick={() => useSuggestion(suggestion)}>{suggestion}</button>
                  ))}
                </div>
              ) : null}
            </section>

            <div className="ai-progressive-steps ai-extend-run-action">
              {(() => {
                const cost = getTextGenerationCreditCost('extend', 'continue_story');
                return (
                  <button type="button" disabled={isGenerating || aiCredits.isLoading || !hasEnoughAiCredits('text', cost)} onClick={() => extendExistingProject('continue_story')}>
                    <strong>Continuer l'histoire</strong>
                    <span>suite cohérente - {formatCreditCost(cost)}</span>
                  </button>
                );
              })()}
            </div>
          </div>

          <section className="ai-extend-card ai-chronology-card">
            <HelpLabel help={fieldHelp.sceneChronology}>Chronologie des scènes</HelpLabel>
            <div className="ai-chronology-scroll-card">
              <div className="ai-chronology-list">
                {chronologyEntries.map((entry, index, entries) => (
                  <div className="ai-chronology-row" key={`${entry.id}:${index}`}>
                    <span>{index + 1}</span>
                    <strong>{entry.name || entry.raw}</strong>
                    <button type="button" className="icon-button" title="Monter" aria-label="Monter" disabled={index === 0} onClick={() => moveChronologyEntry(index, -1)}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="icon-button" title="Descendre" aria-label="Descendre" disabled={index === entries.length - 1} onClick={() => moveChronologyEntry(index, 1)}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <details className="ai-chronology-raw">
              <summary>Édition texte</summary>
              <textarea
                value={sceneChronology}
                onChange={(event) => {
                  setSceneChronology(event.target.value);
                  setContinuationSceneId(getLastSceneIdFromChronology(event.target.value, extensionSourceProject));
                }}
                placeholder={[
                  '1. [id_scene] Première scène',
                  '2. [id_scene] Deuxième scène',
                  '3. [id_scene] Dernière scène actuelle',
                ].join('\n')}
              />
            </details>
            <div className="ai-extend-card-actions">
              <button type="button" className="secondary-action" onClick={() => {
                const chronology = makeSceneChronology(extensionSourceProject);
                setSceneChronology(chronology);
                setContinuationSceneId(getLastSceneIdFromChronology(chronology, extensionSourceProject));
              }}>
                Reconstruire depuis le projet
              </button>
            </div>
          </section>
        </div>
      </>
    );
  };

  const renderDetailsStep = () => (
    <div className="ai-wizard-step">
      <div className="ai-brief-topbar">
        <span className="section-kicker">Étape 3</span>
        <strong>Paramètres</strong>
        <span>{selectedStyle.title} - {selectedMode.label}</span>
      </div>

      <div className="ai-estimate-panel" data-tour="ai-estimate">
        <strong>Modifiera :</strong>
        <b className="ai-cost-line">Coût annoncé avant lancement: {formatCreditCost(currentTextGenerationCost)}</b>
        <div className="ai-estimate-tags">
          {getActionEstimate(mode).map((line) => <span key={line}>{line}</span>)}
        </div>
      </div>

      <div className="ai-wizard-form">
        {mode === 'improve' ? (
          <>
            <HelpLabel help={fieldHelp.improve}>Scène à améliorer</HelpLabel>
            <select value={targetSceneId} onChange={(event) => setTargetSceneId(event.target.value)}>
              {scenes.map((scene) => (
                <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene) || scene.name}</option>
              ))}
            </select>

            <HelpLabel help={fieldHelp.instruction}>Instruction</HelpLabel>
            <textarea
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
              placeholder="Ex: Améliore cette scène pour la rendre plus stressante."
            />
            <p className="small-note">Structure protégée: seules l'ambiance, les dialogues et les objets peuvent être raffinés.</p>
            <button type="button" className="secondary-action full" onClick={proposeIdeas}>Proposer des idées</button>
            {ideaSuggestions.length ? (
              <div className="ai-suggestion-list">
                {ideaSuggestions.map((suggestion) => (
                  <button type="button" key={suggestion} onClick={() => useSuggestion(suggestion)}>{suggestion}</button>
                ))}
              </div>
            ) : null}
          </>
        ) : mode === 'progressive' ? (
          renderProgressiveControls()
        ) : mode === 'extend' ? (
          renderExtendControls()
        ) : (
          briefForm
        )}
        {mode !== 'improve' ? renderVisualOptions() : null}
      </div>

      <div className="ai-wizard-footer ai-wizard-footer-actions">
        <button type="button" className="secondary-action ai-back-step-button" onClick={() => setWizardStep('action')}>
          <ArrowLeft size={16} />
          Retour
        </button>
        {hasAiResult ? (
          <button type="button" className="secondary-action" onClick={() => setWizardStep('result')}>
            Voir le résultat
          </button>
        ) : null}
        {mode !== 'progressive' && mode !== 'extend' ? (
          <button type="button" data-tour="ai-generate-button" disabled={isGenerating || !canRunTextAi || (mode === 'improve' && !targetSceneId)} onClick={generate}>
            {isGenerating ? 'Traitement...' : `${mode === 'improve' ? 'Améliorer la scène' : 'Générer le jeu complet'} - ${formatCreditCost(currentTextGenerationCost)}`}
          </button>
        ) : null}
      </div>
    </div>
  );

  if (wizardStep === 'result') return null;

  return (
    <section className="panel ai-wizard-panel" data-tour="ai-controls">
      {wizardStep === 'visual' ? renderVisualStep() : null}
      {wizardStep === 'action' ? renderActionStep() : null}
      {wizardStep === 'details' ? renderDetailsStep() : null}
    </section>
  );
}
