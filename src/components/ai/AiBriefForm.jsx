export default function AiBriefForm({
  brief,
  updateBrief,
  HelpLabel,
  FIELD_HELP,
  isChoiceAdventureAi = false,
  isBeginnerAi = false,
  isHeroAdventureAi = false,
  shouldGenerateCombinations = false,
}) {
  return (
    <>
      {isChoiceAdventureAi ? (
      <section className="ai-brief-document">
        <span className="section-kicker">Document IA</span>
        <HelpLabel help={FIELD_HELP.title}>Nom du jeu</HelpLabel>
        <input value={brief.title} onChange={(event) => updateBrief('title', event.target.value)} placeholder="Vide = titre invente par l'IA" />

        <HelpLabel help={FIELD_HELP.story}>Histoire</HelpLabel>
        <textarea value={brief.story} onChange={(event) => updateBrief('story', event.target.value)} placeholder="Vide = histoire aleatoire mais coherente avec le theme." />

        <HelpLabel help={FIELD_HELP.characters}>Personnages</HelpLabel>
        <textarea value={brief.characters} onChange={(event) => updateBrief('characters', event.target.value)} placeholder="Vide = personnages inventes par l'IA." />

        <HelpLabel help={FIELD_HELP.places}>Lieux / univers</HelpLabel>
        <textarea value={brief.places} onChange={(event) => updateBrief('places', event.target.value)} placeholder="Vide = lieux choisis par l'IA." />

        <HelpLabel help={FIELD_HELP.constraints}>Contraintes libres</HelpLabel>
        <textarea value={brief.constraints} onChange={(event) => updateBrief('constraints', event.target.value)} placeholder="Vide = choix aleatoires. Ex: familial, sans horreur, twist final, fin secrete..." />
      </section>
      ) : null}

      <HelpLabel help={FIELD_HELP.theme}>Theme</HelpLabel>
      <input value={brief.theme} onChange={(event) => updateBrief('theme', event.target.value)} />

      <HelpLabel help={FIELD_HELP.difficulty}>Difficulte</HelpLabel>
      <select value={brief.difficulty} onChange={(event) => updateBrief('difficulty', event.target.value)}>
        <option value="easy">Facile</option>
        <option value="normal">Intermediaire</option>
        <option value="hard">Difficile</option>
      </select>

      <div className="grid-two small-gap">
        {!isBeginnerAi ? (
        <div>
          <HelpLabel help={FIELD_HELP.actCount}>Actes</HelpLabel>
          <input type="number" min="1" max="6" value={brief.actCount} onChange={(event) => updateBrief('actCount', event.target.value)} required />
        </div>
        ) : null}
        <div>
          <HelpLabel help={FIELD_HELP.sceneCount}>Scenes</HelpLabel>
          <input type="number" min="1" max="24" value={brief.sceneCount} onChange={(event) => updateBrief('sceneCount', event.target.value)} required />
        </div>
        {!isBeginnerAi ? (
        <div>
          <HelpLabel help={FIELD_HELP.subsceneCount}>Sous-scenes</HelpLabel>
          <input type="number" min="0" max="24" value={brief.subsceneCount} onChange={(event) => updateBrief('subsceneCount', event.target.value)} />
        </div>
        ) : null}
        <div>
          <HelpLabel help={FIELD_HELP.itemCount}>Objets</HelpLabel>
          <input type="number" min="1" max="40" value={brief.itemCount} onChange={(event) => updateBrief('itemCount', event.target.value)} required />
        </div>
        {isHeroAdventureAi ? (
        <div>
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
        <div>
          <HelpLabel help={FIELD_HELP.enigmaCount}>Enigmes</HelpLabel>
          <input type="number" min="0" max="20" value={brief.enigmaCount} onChange={(event) => updateBrief('enigmaCount', event.target.value)} required />
        </div>
        {shouldGenerateCombinations ? (
        <div>
          <HelpLabel help={FIELD_HELP.combinationCount}>Combinaisons</HelpLabel>
          <input type="number" min="0" max="30" value={brief.combinationCount} onChange={(event) => updateBrief('combinationCount', event.target.value)} required />
        </div>
        ) : null}
        {!isBeginnerAi ? (
        <div>
          <HelpLabel help={FIELD_HELP.cinematicCount}>Cinematiques</HelpLabel>
          <input type="number" min="0" max="12" value={brief.cinematicCount} onChange={(event) => updateBrief('cinematicCount', event.target.value)} required />
        </div>
        ) : null}
      </div>

      <HelpLabel help={FIELD_HELP.tone}>Ton</HelpLabel>
      <input value={brief.tone} onChange={(event) => updateBrief('tone', event.target.value)} />

      <HelpLabel help={FIELD_HELP.duration}>Duree visee</HelpLabel>
      <input value={brief.duration} onChange={(event) => updateBrief('duration', event.target.value)} />
    </>
  );
}
