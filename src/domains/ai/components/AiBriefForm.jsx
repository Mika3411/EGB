export default function AiBriefForm({
  brief,
  updateBrief,
  HelpLabel,
  FIELD_HELP,
  isChoiceAdventureAi = false,
  isBeginnerAi = false,
  isHeroAdventureAi = false,
  shouldGenerateCombinations = false,
  projectGenerationCosts = {},
  countCreditUnits = (value) => Math.max(0, Math.round(Number(value) || 0)),
  formatCreditCost = (cost) => `${cost} crédit${Number(cost) > 1 ? 's' : ''}`,
}) {
  const getFieldCreditCost = (fieldKey, costKey) => {
    const unitCost = Number(projectGenerationCosts?.[costKey] || 0);
    return countCreditUnits(brief[fieldKey]) * unitCost;
  };

  const renderCountLabel = (helpKey, label, fieldKey, costKey) => (
    <HelpLabel help={FIELD_HELP[helpKey]}>
      <span className="ai-count-label">
        <span>{label}</span>
        <span className="ai-field-credit-cost">{formatCreditCost(getFieldCreditCost(fieldKey, costKey))}</span>
      </span>
    </HelpLabel>
  );

  return (
    <>
      {isChoiceAdventureAi ? (
      <section className="ai-brief-document">
        <span className="section-kicker">Document IA</span>
        <div className="ai-brief-document-grid">
          <div className="ai-brief-field">
            <HelpLabel help={FIELD_HELP.title}>Nom du jeu</HelpLabel>
            <input value={brief.title} onChange={(event) => updateBrief('title', event.target.value)} placeholder="Vide = titre invente par l'IA" />
          </div>

          <div className="ai-brief-field">
            <HelpLabel help={FIELD_HELP.story}>Histoire</HelpLabel>
            <textarea value={brief.story} onChange={(event) => updateBrief('story', event.target.value)} placeholder="Vide = histoire aleatoire mais coherente avec le theme." />
          </div>

          <div className="ai-brief-field">
            <HelpLabel help={FIELD_HELP.characters}>Personnages</HelpLabel>
            <textarea value={brief.characters} onChange={(event) => updateBrief('characters', event.target.value)} placeholder="Vide = personnages inventes par l'IA." />
          </div>

          <div className="ai-brief-field">
            <HelpLabel help={FIELD_HELP.places}>Lieux / univers</HelpLabel>
            <textarea value={brief.places} onChange={(event) => updateBrief('places', event.target.value)} placeholder="Vide = lieux choisis par l'IA." />
          </div>

          <div className="ai-brief-field wide">
            <HelpLabel help={FIELD_HELP.constraints}>Contraintes libres</HelpLabel>
            <textarea value={brief.constraints} onChange={(event) => updateBrief('constraints', event.target.value)} placeholder="Vide = choix aleatoires. Ex: familial, sans horreur, twist final, fin secrete..." />
          </div>
        </div>
      </section>
      ) : null}

      <div className="ai-brief-compact-grid" data-tour="ai-brief-fields">
        <div className="ai-brief-field wide">
          <HelpLabel help={FIELD_HELP.theme}>Theme</HelpLabel>
          <input data-tour="ai-theme" value={brief.theme} onChange={(event) => updateBrief('theme', event.target.value)} />
        </div>

        <div className="ai-brief-field">
          <HelpLabel help={FIELD_HELP.difficulty}>Difficulté</HelpLabel>
          <select value={brief.difficulty} onChange={(event) => updateBrief('difficulty', event.target.value)}>
            <option value="easy">Facile</option>
            <option value="normal">Intermediaire</option>
            <option value="hard">Difficile</option>
          </select>
        </div>

        {!isBeginnerAi ? (
        <div className="ai-brief-field compact">
          {renderCountLabel('actCount', 'Actes', 'actCount', 'act')}
          <input type="number" min="1" max="6" value={brief.actCount} onChange={(event) => updateBrief('actCount', event.target.value)} required />
        </div>
        ) : null}
        <div className="ai-brief-field compact">
          {renderCountLabel('sceneCount', 'Scenes', 'sceneCount', 'scene')}
          <input type="number" min="1" max="24" value={brief.sceneCount} onChange={(event) => updateBrief('sceneCount', event.target.value)} required />
        </div>
        {!isBeginnerAi ? (
        <div className="ai-brief-field compact">
          {renderCountLabel('subsceneCount', 'Sous-scenes', 'subsceneCount', 'subscene')}
          <input type="number" min="0" max="24" value={brief.subsceneCount} onChange={(event) => updateBrief('subsceneCount', event.target.value)} />
        </div>
        ) : null}
        <div className="ai-brief-field compact">
          {renderCountLabel('itemCount', 'Objets', 'itemCount', 'item')}
          <input type="number" min="1" max="40" value={brief.itemCount} onChange={(event) => updateBrief('itemCount', event.target.value)} required />
        </div>
        {isHeroAdventureAi ? (
        <div className="ai-brief-field compact">
          <HelpLabel help={FIELD_HELP.heroBonusObjects}>Objets avec bonus</HelpLabel>
          <label className="checkbox-row ai-inline-check">
            <input
              type="checkbox"
              checked={brief.heroBonusObjects !== false}
              onChange={(event) => updateBrief('heroBonusObjects', event.target.checked)}
            />
            <span>Potions et equipements</span>
          </label>
        </div>
        ) : null}
        <div className="ai-brief-field compact">
          {renderCountLabel('enigmaCount', 'Enigmes', 'enigmaCount', 'enigma')}
          <input type="number" min="0" max="20" value={brief.enigmaCount} onChange={(event) => updateBrief('enigmaCount', event.target.value)} required />
        </div>
        {shouldGenerateCombinations ? (
        <div className="ai-brief-field compact">
          {renderCountLabel('combinationCount', 'Combinaisons', 'combinationCount', 'combination')}
          <input type="number" min="0" max="30" value={brief.combinationCount} onChange={(event) => updateBrief('combinationCount', event.target.value)} required />
        </div>
        ) : null}
        {!isBeginnerAi ? (
        <div className="ai-brief-field compact">
          {renderCountLabel('cinematicCount', 'Cinematiques', 'cinematicCount', 'cinematic')}
          <input type="number" min="0" max="12" value={brief.cinematicCount} onChange={(event) => updateBrief('cinematicCount', event.target.value)} required />
        </div>
        ) : null}

        <div className="ai-brief-field wide">
          <HelpLabel help={FIELD_HELP.tone}>Ton</HelpLabel>
          <input value={brief.tone} onChange={(event) => updateBrief('tone', event.target.value)} />
        </div>

        <div className="ai-brief-field">
          <HelpLabel help={FIELD_HELP.duration}>Durée visée</HelpLabel>
          <input value={brief.duration} onChange={(event) => updateBrief('duration', event.target.value)} />
        </div>
      </div>
    </>
  );
}
