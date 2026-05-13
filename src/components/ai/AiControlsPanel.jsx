import {
  AiPrivacyNotice,
  HelpLabel,
  getActionEstimate,
  getLastSceneIdFromChronology,
  makeProjectStorySummary,
  makeSceneChronology,
  parseChronologyEntries,
} from './aiTabHelpers.js';

const getDefaultStepMeta = (statusValue, isLocked, doneLabel, readyLabel, lockedLabel = 'verrouillé') => {
  if (statusValue === 'running') return { icon: '⏳', label: 'En cours' };
  if (statusValue === 'done') return { icon: '✔', label: doneLabel };
  if (isLocked) return { icon: '🔒', label: lockedLabel };
  return { icon: '→', label: readyLabel };
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
}) {
  return (
    <section className="panel side" data-tour="ai-controls">
      <div className="panel-head">
        <h2>IA</h2>
        <span className="status-badge soft">{mode === 'improve' ? 'Patch' : 'IA'}</span>
      </div>
      <div data-tour="ai-credits" className={`ai-credit-panel ${aiCredits.balance != null && aiCredits.balance < currentTextGenerationCost ? 'low' : ''}`}>
        <div>
          <span className="section-kicker">Crédits IA</span>
          <strong>{aiCredits.isLoading ? '...' : `${aiCredits.balance ?? 0}`}</strong>
        </div>
        <button type="button" className="secondary-action" onClick={refreshAiCredits} disabled={aiCredits.isLoading}>
          Actualiser
        </button>
        <p>
          {isChoiceAdventureAi ?
            `Projet: ${calculateProjectGenerationCreditCost()} crédits · Texte: ${Number(aiCredits.costs?.text ?? 2)} crédits · Chaque image: ${formatCreditCost(getAiCreditCost('image'))} · Combinaisons incluses dans le calcul`
            : <>Projet: {calculateProjectGenerationCreditCost()} crédits · Texte: {Number(aiCredits.costs?.text ?? 2)} crédits · Scène: {getAiCreditCost('image')} crédits · Objet détaillé: {formatCreditCost(getAiCreditCost('objectImage'))} · Miniature éco: {formatCreditCost(getAiCreditCost('objectThumbnail'))}</>}
        </p>
        <p className="ai-current-cost">
          Prochaine génération ({mode === 'generate' ? 'projet complet' : mode === 'progressive' ? 'step progressive' : mode === 'extend' ? 'continuer/enrichir' : 'amélioration'}): <strong>{formatCreditCost(currentTextGenerationCost)}</strong>
        </p>
        {isChoiceAdventureAi ? (
          <p className="ai-current-cost">
            Images du brief: <strong>{countCreditUnits(brief.sceneCount) + countCreditUnits(brief.itemCount) + countCreditUnits(brief.cinematicCount)} image(s) - {formatCreditCost(calculateBriefImageCreditCost())}</strong>
            {' '}si tu génères toutes les scènes, objets et cinématiques. Total texte + images: <strong>{formatCreditCost(calculateBriefTotalCreditCost())}</strong>
          </p>
        ) : null}
        {aiCredits.error ? <p className="small-note">{aiCredits.error}</p> : null}
      </div>
      <AiPrivacyNotice />
      <p className="small-note">
        Génère un projet complet ou améliore une scène existante avec un JSON partiel validé avant application.
      </p>

      <HelpLabel help="Choisis le rendu utilisé par les prochaines images IA: scènes, objets et cinématiques.">Style d'image</HelpLabel>
      <div className="segmented-control compact ai-style-choice" data-tour="ai-image-style">
        {Object.entries(imageStylePresets).map(([value, preset]) => (
          <button
            type="button"
            key={value}
            className={imageStylePreset === value ? 'active' : ''}
            onClick={() => setImageStylePreset(value)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <HelpLabel help="Style partagé par les images de scènes pour éviter que chaque pièce parte dans une direction visuelle différente.">Style visuel global</HelpLabel>
      <input data-tour="ai-visual-style" value={globalVisualStyle} onChange={(event) => setGlobalVisualStyle(event.target.value)} />

      <HelpLabel help="Ajuste automatiquement la luminosité après génération pour garder une image jouable sans trop délaver l'ambiance.">Lisibilité des images</HelpLabel>
      <select data-tour="ai-image-readability" value={imageReadabilityLevel} onChange={(event) => setImageReadabilityLevel(event.target.value)}>
        <option value="subtle">Ambiance sombre</option>
        <option value="balanced">Lisibilité renforcée</option>
        <option value="strong">Très lumineux</option>
        <option value="none">Aucune correction</option>
      </select>

      <HelpLabel help="Détails récurrents à conserver entre les pièces: portes, parquet, lumière, époque, matériaux.">Héritage visuel</HelpLabel>
      <textarea data-tour="ai-visual-inheritance" value={visualInheritance} onChange={(event) => setVisualInheritance(event.target.value)} />

      <HelpLabel help={fieldHelp.mode}>Mode</HelpLabel>
      <div className="segmented-control" data-tour="ai-mode">
        <button type="button" className={mode === 'generate' ? 'active' : ''} onClick={() => setMode('generate')}>Nouveau</button>
        {!isBeginnerAi ? (
          <>
            <button type="button" className={mode === 'progressive' ? 'active' : ''} onClick={() => setMode('progressive')}>Progressif</button>
            <button type="button" className={mode === 'extend' ? 'active' : ''} onClick={() => setMode('extend')}>Continuer</button>
          </>
        ) : null}
        <button type="button" className={mode === 'improve' ? 'active' : ''} onClick={() => setMode('improve')}>Améliorer</button>
      </div>

      <div className="ai-estimate-panel" data-tour="ai-estimate">
        <strong>Modifiera probablement :</strong>
        <b className="ai-cost-line">Coût annoncé avant lancement: {formatCreditCost(currentTextGenerationCost)}</b>
        <div className="ai-estimate-tags">
          {getActionEstimate(mode).map((line) => <span key={line}>{line}</span>)}
        </div>
      </div>

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
          <p className="small-note">Structure protégée: seules l’ambiance, les dialogues et les objets peuvent être raffinés.</p>
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
                  <span>{getProgressiveStageSummary(stage)} · {formatCreditCost(cost)}</span>
                </button>
              );
            })}
          </div>

        </>
      ) : mode === 'extend' ? (
        <>
          {briefForm}

          <HelpLabel help={fieldHelp.source}>Source</HelpLabel>
          <div className="segmented-control compact">
            <button type="button" className={extendSource === 'current' ? 'active' : ''} onClick={() => setExtendSource('current')}>Projet actuel</button>
            <button type="button" className={extendSource === 'imported' ? 'active' : ''} onClick={() => setExtendSource('imported')} disabled={!importedProject}>JSON importé</button>
          </div>

          <HelpLabel help={fieldHelp.importJson}>Importer un JSON existant</HelpLabel>
          <label className="button like secondary-action full">
            Importer un JSON existant
            <input type="file" accept="application/json,.json" hidden onChange={importExtensionJson} />
          </label>
          {importedProject ? <p className="small-note">JSON chargé: {importedProject.title || 'Projet importé'}</p> : null}

          <HelpLabel help={fieldHelp.storySummary}>Résumé de l'histoire</HelpLabel>
          <textarea
            value={storySummary}
            onChange={(event) => setStorySummary(event.target.value)}
            placeholder="Résume les événements, révélations et objectifs déjà posés."
          />
          <button type="button" className="secondary-action full" onClick={() => setStorySummary(makeProjectStorySummary(extensionSourceProject))}>
            Refaire le résumé depuis le projet
          </button>

          <HelpLabel help={fieldHelp.sceneChronology}>Chronologie des scènes</HelpLabel>
          <div className="ai-chronology-list">
            {parseChronologyEntries(sceneChronology, extensionSourceProject).map((entry, index, entries) => (
              <div className="ai-chronology-row" key={`${entry.id}:${index}`}>
                <span>{index + 1}</span>
                <strong>{entry.name || entry.raw}</strong>
                <button type="button" className="icon-button" title="Monter" disabled={index === 0} onClick={() => moveChronologyEntry(index, -1)}>↑</button>
                <button type="button" className="icon-button" title="Descendre" disabled={index === entries.length - 1} onClick={() => moveChronologyEntry(index, 1)}>↓</button>
              </div>
            ))}
          </div>
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
          <button type="button" className="secondary-action full" onClick={() => {
            const chronology = makeSceneChronology(extensionSourceProject);
            setSceneChronology(chronology);
            setContinuationSceneId(getLastSceneIdFromChronology(chronology, extensionSourceProject));
          }}>
            Reconstruire la chronologie depuis le projet
          </button>

          <HelpLabel help={fieldHelp.continuationScene}>Scène de départ détectée</HelpLabel>
          <select value={continuationScene?.id || ''} onChange={(event) => setContinuationSceneId(event.target.value)}>
            {extensionScenes.map((scene) => (
              <option key={scene.id} value={scene.id}>{getSceneLabel?.(scene.id) || scene.name}</option>
            ))}
          </select>
          <button type="button" className="secondary-action full" onClick={() => setContinuationSceneId(getLastSceneIdFromChronology(sceneChronology, extensionSourceProject))}>
            Utiliser la dernière ligne de la chronologie
          </button>

          <HelpLabel help={fieldHelp.continuationWish}>Ce que tu aimerais pour la suite</HelpLabel>
          <textarea
            value={continuationWish}
            onChange={(event) => {
              setContinuationWish(event.target.value);
              setExtendInstruction(event.target.value);
            }}
            placeholder="Vide = suite aléatoire mais cohérente. Ex: révéler une cave secrète avec une énigme mécanique."
          />
          <button type="button" className="secondary-action full" onClick={proposeIdeas}>Proposer des idées</button>
          {ideaSuggestions.length ? (
            <div className="ai-suggestion-list">
              {ideaSuggestions.map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => useSuggestion(suggestion)}>{suggestion}</button>
              ))}
            </div>
          ) : null}

          <div className="ai-progressive-steps">
            {(() => {
              const cost = getTextGenerationCreditCost('extend', 'continue_story');
              return (
                <button type="button" disabled={isGenerating || aiCredits.isLoading || !hasEnoughAiCredits('text', cost)} onClick={() => extendExistingProject('continue_story')}>
                  <strong>→ Continuer l’histoire</strong>
                  <span>suite cohérente · {formatCreditCost(cost)}</span>
                </button>
              );
            })()}
          </div>
        </>
      ) : (
        <>
          {briefForm}
        </>
      )}

      {mode !== 'progressive' && mode !== 'extend' ? (
        <button type="button" data-tour="ai-generate-button" disabled={isGenerating || !canRunTextAi || (mode === 'improve' && !targetSceneId)} onClick={generate}>
          {isGenerating ? 'Traitement...' : `${mode === 'improve' ? 'Améliorer la scène' : 'Générer le jeu complet'} · ${formatCreditCost(currentTextGenerationCost)}`}
        </button>
      ) : null}
    </section>
  );
}
