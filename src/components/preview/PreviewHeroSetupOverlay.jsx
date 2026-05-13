import { resolveAssetUrl } from '../../lib/assetManager';

const getDiePips = (face = 1) => {
  const pipsByFace = {
    1: ['center'],
    2: ['top-left', 'bottom-right'],
    3: ['top-left', 'center', 'bottom-right'],
    4: ['top-left', 'top-right', 'bottom-left', 'bottom-right'],
    5: ['top-left', 'top-right', 'center', 'bottom-left', 'bottom-right'],
    6: ['top-left', 'top-right', 'middle-left', 'middle-right', 'bottom-left', 'bottom-right'],
  };
  return pipsByFace[Math.max(1, Math.min(6, Number(face) || 1))] || pipsByFace[1];
};

export default function PreviewHeroSetupOverlay({
  isOpen = false,
  heroAdventure = {},
  heroState = null,
  heroDiceSkin = 'classic',
  heroSetupBackgroundImageData = '',
  heroSetupSelectionConfirmed = false,
  heroSetupGalleryIndex = 0,
  heroSetupResultsRevealed = false,
  heroSetupFinalRolls = [],
  heroSetupDiceFaces = [],
  heroSetupRollingIndex = -1,
  isHeroSetupRolling = false,
  setHeroSetupGalleryIndex,
  setHeroSetupSelectionConfirmed,
  selectHeroCharacter,
  resetHeroSetupRollState,
  resetHeroSetupSkillResults,
  startHeroSetupRoll,
  stopHeroSetupRoll,
  revealHeroSetupSkills,
  completeHeroSetup,
}) {
  if (!isOpen) return null;

  const hasRolledSkills = heroSetupResultsRevealed && (heroState?.skills || []).some((skill) => skill.rolledValue);
  const skillCount = Math.max(1, (heroState?.skills || []).length);
  const allDiceRolled = heroSetupFinalRolls.length >= skillCount;
  const heroChoices = Array.isArray(heroAdventure?.heroes) && heroAdventure.heroes.length
    ? heroAdventure.heroes
    : heroState
      ? [heroState]
      : [];
  const safeGalleryIndex = heroChoices.length
    ? ((heroSetupGalleryIndex % heroChoices.length) + heroChoices.length) % heroChoices.length
    : 0;
  const activeChoice = heroChoices[safeGalleryIndex] || heroState || {};
  const activeChoiceDescription = String(activeChoice.description || '').trim();
  const activeForceSkill = (activeChoice.skills || []).find((skill) => String(skill.name || skill.id).toLowerCase().includes('force')) || activeChoice.skills?.[0];
  const activePortrait = resolveAssetUrl(activeChoice.characterImageId, activeChoice.characterImageData) || activeChoice.characterImageData || '';
  const activeSkills = (activeChoice.skills || []).slice(0, 4);
  const showCharacterGallery = !heroSetupSelectionConfirmed && !hasRolledSkills && !isHeroSetupRolling;
  const shouldShowDice = !showCharacterGallery && (isHeroSetupRolling || !hasRolledSkills || allDiceRolled);
  const setupCardStyle = heroSetupBackgroundImageData
    ? { backgroundImage: `linear-gradient(180deg, rgba(8,16,30,.38), rgba(8,16,30,.66)), url(${heroSetupBackgroundImageData})` }
    : undefined;

  return (
    <div className="hero-setup-overlay">
      <div className={`hero-setup-card ${heroSetupBackgroundImageData ? 'has-hero-setup-background' : ''}`} style={setupCardStyle}>
        <span className="eyebrow">{showCharacterGallery ? 'Choix du héros' : 'Création du héros'}</span>
        <h2>{showCharacterGallery ? 'Choisis ton personnage' : heroState?.name || 'Héros'}</h2>
        <p>
          {showCharacterGallery
            ? 'Parcours les fiches, compare le profil et valide ton héros avant de lancer les compétences.'
            : 'Lance les dés de départ. Chaque compétence garde sa base et ajoute 1d6 pour obtenir sa valeur de jeu.'}
        </p>
        {showCharacterGallery ? (
          <>
            <div className="hero-setup-gallery">
              <button
                type="button"
                className="hero-setup-gallery-arrow"
                onClick={() => setHeroSetupGalleryIndex((index) => index - 1)}
                disabled={heroChoices.length < 2}
                aria-label="Fiche précédente"
              >
                {'<'}
              </button>
              <article className="hero-setup-profile-card">
                <div className="hero-setup-profile-portrait">
                  {activePortrait ? (
                    <img src={activePortrait} alt={activeChoice.name || 'Héros'} />
                  ) : (
                    <span>{String(activeChoice.name || 'H').trim().slice(0, 1).toUpperCase()}</span>
                  )}
                </div>
                <div className="hero-setup-profile-content">
                  <span className="hero-setup-profile-count">{safeGalleryIndex + 1}/{Math.max(1, heroChoices.length)}</span>
                  <h3>{activeChoice.name || 'Héros'}</h3>
                  <p className="hero-setup-character-description">
                    {activeChoiceDescription || 'Aucun descriptif renseigné pour ce personnage.'}
                  </p>
                  <div className="hero-setup-stat-grid">
                    <span><strong>{activeChoice.health ?? activeChoice.maxHealth ?? 0}/{activeChoice.maxHealth ?? activeChoice.health ?? 0}</strong><small>PV</small></span>
                    <span><strong>{activeChoice.mana ?? activeChoice.maxMana ?? 0}/{activeChoice.maxMana ?? activeChoice.mana ?? 0}</strong><small>Mana</small></span>
                    <span><strong>{activeChoice.armor ?? 0}</strong><small>Armure</small></span>
                    <span><strong>{activeChoice.initiative ?? 0}</strong><small>Initiative</small></span>
                    <span><strong>{activeChoice.dodgeChance ?? 0}%</strong><small>Esquive</small></span>
                    <span><strong>{activeChoice.rules?.criticalChance ?? 0}%</strong><small>Critique</small></span>
                  </div>
                  <div className="hero-setup-skill-preview">
                    {activeSkills.map((skill) => (
                      <span key={skill.id || skill.name}>
                        <strong>{skill.name || 'Compétence'}</strong>
                        <small>{skill.value ?? 0}</small>
                      </span>
                    ))}
                    {!activeSkills.length ? <span><strong>Force</strong><small>{activeForceSkill?.value ?? 0}</small></span> : null}
                  </div>
                </div>
              </article>
              <button
                type="button"
                className="hero-setup-gallery-arrow"
                onClick={() => setHeroSetupGalleryIndex((index) => index + 1)}
                disabled={heroChoices.length < 2}
                aria-label="Fiche suivante"
              >
                {'>'}
              </button>
            </div>
            <div className="hero-setup-actions">
              <button
                type="button"
                onClick={() => {
                  if (activeChoice?.id) selectHeroCharacter?.(activeChoice.id);
                  resetHeroSetupRollState();
                  setHeroSetupSelectionConfirmed(true);
                }}
              >
                Sélectionner ce personnage
              </button>
            </div>
          </>
        ) : null}
        {!showCharacterGallery ? (
          <>
            {shouldShowDice ? (
              <div
                className={`hero-setup-dice-rack ${isHeroSetupRolling ? 'is-rolling' : ''}`}
              >
                {(heroState?.skills || []).map((skill, index) => {
                  const face = heroSetupDiceFaces[index] || ((index % 6) + 1);
                  const isCurrentDie = heroSetupRollingIndex === index;
                  const isFinalDie = heroSetupFinalRolls[index];
                  const isNextDie = index === heroSetupFinalRolls.length;
                  return (
                    <button
                      type="button"
                      className={`hero-setup-die-wrap ${isCurrentDie ? 'is-current' : ''} ${isFinalDie ? 'is-final' : ''} ${!isFinalDie && !isNextDie ? 'is-locked' : ''}`}
                      key={skill.id}
                      onClick={() => (isCurrentDie ? stopHeroSetupRoll() : startHeroSetupRoll(index))}
                      disabled={isFinalDie || (!isCurrentDie && (isHeroSetupRolling || !isNextDie))}
                    >
                      <span className={`hero-die-face hero-die-face--${heroDiceSkin} face-${face}`}>
                        {getDiePips(face).map((position) => <i key={position} className={`pip pip-${position}`} />)}
                      </span>
                      <small>{isFinalDie ? `${skill.name} = ${face}` : skill.name}</small>
                    </button>
                  );
                })}
                <strong>
                  {isHeroSetupRolling
                    ? heroSetupRollingIndex >= 0
                      ? `Clique encore pour arreter ${heroState?.skills?.[heroSetupRollingIndex]?.name || 'le dé'}`
                      : 'Résultats obtenus...'
                    : allDiceRolled
                      ? 'Les dés ont parlé. Découvre tes compétences.'
                      : `Clique le dé de ${heroState?.skills?.[heroSetupFinalRolls.length]?.name || 'la compétence'}`}
                </strong>
              </div>
            ) : (
              <div className="hero-setup-skill-grid">
                {(heroState?.skills || []).map((skill) => (
                  <div key={skill.id} className={skill.rolledValue ? 'is-rolled' : ''}>
                    <span>{skill.name}</span>
                    <strong>{skill.rolledValue ? `+${skill.value}` : '-'}</strong>
                    <small>{skill.rolledValue ? `Base ${skill.baseValue ?? (Number(skill.value) - Number(skill.rolledValue))} + jet ${skill.rolledValue}` : 'A tirer'}</small>
                  </div>
                ))}
              </div>
            )}
            <div className="hero-setup-actions">
              {!hasRolledSkills && !isHeroSetupRolling ? (
                <button type="button" className="secondary-action" onClick={() => {
                  resetHeroSetupRollState();
                  setHeroSetupSelectionConfirmed(false);
                }}>
                  Changer de personnage
                </button>
              ) : null}
              {shouldShowDice ? (
                <button type="button" className="secondary-action" onClick={revealHeroSetupSkills} disabled={!allDiceRolled || isHeroSetupRolling}>
                  Decouvrir mes compétences
                </button>
              ) : (
                <button type="button" className="secondary-action" onClick={resetHeroSetupSkillResults}>
                  Relancer les compétences
                </button>
              )}
              <button type="button" onClick={completeHeroSetup} disabled={!hasRolledSkills || isHeroSetupRolling || shouldShowDice}>
                Commencer l'aventure
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
