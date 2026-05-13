export default function PreviewHeroPanel({
  compact = false,
  isHeroAdventure = false,
  heroAdventure = {},
  heroState = {},
  isHeroDefeated = false,
  heroPanelRollingSkillId = null,
  heroPanelDieFace = 1,
  lastDiceRoll = null,
  heroDiceSkin = 'classic',
  adjustHeroStat,
  startHeroPanelRoll,
  stopHeroPanelRoll,
  toggleHeroPanelRoll,
}) {
  if (!isHeroAdventure) return null;

  const healthMax = Number(heroState.maxHealth) || 1;
  const manaMax = Number(heroState.maxMana) || 1;
  const healthPercent = Math.max(0, Math.min(100, (Number(heroState.health || 0) / healthMax) * 100));
  const manaPercent = Math.max(0, Math.min(100, (Number(heroState.mana || 0) / manaMax) * 100));

  return (
    <div className={`hero-adventure-panel ${compact ? 'hero-adventure-panel--compact' : ''}`} data-tour="hero-adventure-panel">
      <div className="hero-adventure-head">
        <div>
          <span className="eyebrow">Hero Adventure</span>
          <strong>{heroState.name || 'Heros'}</strong>
        </div>
        <button
          type="button"
          className="secondary-action hero-dice-button"
          onClick={() => toggleHeroPanelRoll('')}
          disabled={isHeroDefeated}
        >
          {heroPanelRollingSkillId !== null ? 'Arreter le de' : `Lancer ${heroAdventure.dice?.label || 'de'}`}
        </button>
      </div>

      <div className="hero-stat-grid">
        <div className="hero-meter">
          <span>PV</span>
          <strong>{heroState.health}/{healthMax}</strong>
          <i style={{ width: `${healthPercent}%` }} />
        </div>
        <div className="hero-meter hero-meter--mana">
          <span>Mana</span>
          <strong>{heroState.mana}/{manaMax}</strong>
          <i style={{ width: `${manaPercent}%` }} />
        </div>
      </div>

      <div className="hero-stat-actions">
        <button type="button" onClick={() => adjustHeroStat?.('health', -1)}>- PV</button>
        <button type="button" onClick={() => adjustHeroStat?.('health', 1)}>+ PV</button>
        <button type="button" onClick={() => adjustHeroStat?.('mana', -1)}>- Mana</button>
        <button type="button" onClick={() => adjustHeroStat?.('mana', 1)}>+ Mana</button>
      </div>

      {isHeroDefeated ? <p className="hero-defeat-note">0 PV: actions joueur bloquees.</p> : null}

      <div className="hero-skill-list">
        {(heroState.skills || []).map((skill) => (
          <button
            key={skill.id}
            type="button"
            className="hero-skill-button"
            onClick={() => startHeroPanelRoll(skill.id)}
            disabled={isHeroDefeated || heroPanelRollingSkillId !== null || (skill.manaCost > 0 && Number(heroState.mana || 0) < skill.manaCost)}
          >
            <span>{skill.name}</span>
            <strong>+{skill.value}</strong>
            {skill.manaCost ? <small>{skill.manaCost} mana</small> : null}
          </button>
        ))}
      </div>

      {(lastDiceRoll || heroPanelRollingSkillId !== null) ? (
        <div className={`hero-roll-result ${heroPanelRollingSkillId !== null ? 'is-rolling' : ''}`}>
          <span>
            {heroPanelRollingSkillId !== null
              ? (heroState.skills || []).find((skill) => skill.id === heroPanelRollingSkillId)?.name || 'Jet libre'
              : lastDiceRoll.skillName || 'Jet libre'}
            {heroPanelRollingSkillId === null && typeof lastDiceRoll.success === 'boolean' ? ` - ${lastDiceRoll.success ? 'Reussi' : 'Echec'}` : ''}
          </span>
          <button
            type="button"
            className={`hero-roll-die-button ${heroPanelRollingSkillId !== null ? 'is-rolling' : ''}`}
            onClick={stopHeroPanelRoll}
            disabled={heroPanelRollingSkillId === null}
            aria-label={heroPanelRollingSkillId !== null ? 'Arreter le de' : 'Resultat du de'}
          >
            <span className={`hero-roll-die hero-die-face hero-die-face--${heroDiceSkin}`}>
              <span className="hero-roll-die-value">{heroPanelRollingSkillId !== null ? heroPanelDieFace : lastDiceRoll.raw}</span>
            </span>
          </button>
          <small>
            {heroPanelRollingSkillId !== null
              ? 'Clique le de pour l arreter.'
              : `${lastDiceRoll.die}: ${lastDiceRoll.raw}${lastDiceRoll.modifier ? ` + ${lastDiceRoll.modifier}` : ''} => ${lastDiceRoll.total}${lastDiceRoll.difficulty ? ` / difficulte ${lastDiceRoll.difficulty}` : ''}`}
          </small>
        </div>
      ) : null}
    </div>
  );
}
