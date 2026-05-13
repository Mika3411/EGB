const HERO_POWER_TYPE_LABELS = {
  water: 'Eau',
  earth: 'Terre',
  fire: 'Feu',
  lightning: 'Foudre',
};

export default function PreviewCombatOverlay({
  activeHeroCombat = null,
  isHeroAdventure = false,
  heroAdventure = {},
  heroState = {},
  playSceneBackgroundUrl = '',
  lastDiceRoll = null,
  selectedHeroCombatPowerId = '',
  setSelectedHeroCombatPowerId,
  heroCombatEffectLocked = false,
  isHeroDefeated = false,
  heroCombatRolling = false,
  heroCombatDieFace = 1,
  heroDiceSkin = 'classic',
  heroCombatRollIntervalRef,
  heroCombatAutoStopTimeoutRef,
  heroCombatDieFaceRef,
  setHeroCombatDieFace,
  setHeroCombatRolling,
  attemptSurvivalHeroCombat,
  rollActiveEnemyCombat,
  attackActiveHeroCombat,
  attemptEscapeHeroCombat,
  closeHeroCombat,
  project,
  Anime2DPreviewComponent,
  getCombatEntryValue,
  getCombatActorMedia,
}) {
  if (!activeHeroCombat || !isHeroAdventure) return null;

  const renderHeroCombatEffectMedia = (effect) => {
    const media = effect?.media;
    if (!media) return null;
    const audioNode = media.audioData ? (
      <audio src={media.audioData} autoPlay preload="auto" style={{ display: 'none' }} />
    ) : null;
    if (media.mediaType === 'anime2d' && media.anime2dSpec) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--anime">
            <Anime2DPreviewComponent spec={media.anime2dSpec} project={project} />
          </span>
        </>
      );
    }
    if (media.mediaType === 'video' && media.videoData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--video">
            <video src={media.videoData} autoPlay muted playsInline />
          </span>
        </>
      );
    }
    if (media.mediaType === 'image' && media.imageData) {
      return (
        <>
          {audioNode}
          <span className="hero-combat-fx-media hero-combat-fx-media--image">
            <img src={media.imageData} alt="" />
          </span>
        </>
      );
    }
    if (media.mediaType === 'visual' && media.visualEffect && media.visualEffect !== 'none') {
      return (
        <>
          {audioNode}
          <span className={`hero-combat-fx-visual hero-combat-fx-visual--${media.visualEffect}`} aria-hidden="true" />
        </>
      );
    }
    return audioNode;
  };

  const renderHeroCombatActor = (media, label, side, vitals = {}, visualEffects = []) => {
    const maxHealth = Math.max(1, Number(vitals.maxHealth) || 1);
    const health = Math.max(0, Math.min(maxHealth, Number(vitals.health) || 0));
    const maxMana = Math.max(0, Number(vitals.maxMana) || 0);
    const mana = Math.max(0, Math.min(maxMana, Number(vitals.mana) || 0));
    const healthPercent = (health / maxHealth) * 100;
    const manaPercent = maxMana > 0 ? (mana / maxMana) * 100 : 0;
    const actorEffects = visualEffects.filter((effect) => effect.target === side);
    const actorVisualEffect = actorEffects.find((effect) => (
      effect?.media?.mediaType === 'visual'
      && effect.media.visualEffect
      && effect.media.visualEffect !== 'none'
    ))?.media?.visualEffect || '';
    const actorVisualEffectClass = actorVisualEffect ? `hero-combat-actor--visual-${actorVisualEffect}` : '';

    return (
      <div className={`hero-combat-actor hero-combat-actor--${side} ${actorVisualEffectClass} ${media.mediaType === 'anime2d' && media.anime2dSpec ? 'has-anime' : media.imageData ? 'has-image' : 'is-empty'}`}>
        <div className="hero-combat-actor-bars" aria-label={`Jauges ${label}`}>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--health">
            <span>PV</span>
            <strong>{health}/{maxHealth}</strong>
            <i style={{ width: `${healthPercent}%` }} />
          </div>
          <div className="hero-combat-actor-bar hero-combat-actor-bar--mana">
            <span>Mana</span>
            <strong>{mana}/{maxMana}</strong>
            <i style={{ width: `${manaPercent}%` }} />
          </div>
        </div>
        <div className={`hero-combat-actor-media ${actorVisualEffect ? `hero-combat-actor-media--visual-${actorVisualEffect}` : ''}`}>
          {media.mediaType === 'anime2d' && media.anime2dSpec ? (
            <Anime2DPreviewComponent spec={media.anime2dSpec} project={project} />
          ) : media.imageData ? (
            <img src={media.imageData} alt={label} />
          ) : (
            <span>{label.slice(0, 1).toUpperCase()}</span>
          )}
        </div>
        {actorEffects.length ? (
          <div className="hero-combat-actor-fx" aria-live="polite">
            {actorEffects.map((effect, index) => (
              <span
                key={effect.id}
                className={`hero-combat-fx hero-combat-fx--${effect.type || 'damage'} ${effect.media ? 'hero-combat-fx--has-media' : ''}`}
                style={{ '--fx-delay': `${index * 90}ms`, '--fx-offset': `${index * 12}px` }}
              >
                {renderHeroCombatEffectMedia(effect)}
                <span className="hero-combat-fx-text">{effect.text}</span>
              </span>
            ))}
          </div>
        ) : null}
        <strong>{label}</strong>
      </div>
    );
  };

  const entry = activeHeroCombat.entry || {};
  const combatSettings = heroAdventure.combat || {};
  const backgroundImageData = entry.combatBackgroundImageData || combatSettings.backgroundImageData || playSceneBackgroundUrl || '';
  const heroMedia = getCombatActorMedia(entry, combatSettings, 'hero', heroState?.characterImageData || '');
  const enemyMedia = getCombatActorMedia(entry, combatSettings, 'enemy');
  const heroLabel = heroState?.name || 'Heros';
  const enemyLabel = activeHeroCombat.enemyName || entry.combatEnemyName || combatSettings.enemyName || 'Ennemi';
  const enemyMaxHealth = Math.max(1, Number(activeHeroCombat.enemyMaxHealth) || Number(entry.combatEnemyMaxHealth) || 1);
  const enemyHealth = Math.max(0, Math.min(enemyMaxHealth, Number(activeHeroCombat.enemyHealth) || 0));
  const enemyMaxMana = Math.max(0, Number(activeHeroCombat.enemyMaxMana) || Number(entry.combatEnemyMaxMana) || Number(combatSettings.enemyMaxMana) || 0);
  const enemyMana = Math.max(0, Math.min(enemyMaxMana, Number(activeHeroCombat.enemyMana) || 0));
  const heroMaxHealth = Math.max(1, Number(heroState?.maxHealth) || 1);
  const heroHealth = Math.max(0, Math.min(heroMaxHealth, Number(heroState?.health) || 0));
  const heroMaxMana = Math.max(0, Number(heroState?.maxMana) || 0);
  const heroMana = Math.max(0, Math.min(heroMaxMana, Number(heroState?.mana) || 0));
  const heroPowers = Array.isArray(heroState?.powers) ? heroState.powers : [];
  const combatManaCost = Math.max(0, Number(entry.combatManaCost) || 0);
  const selectedHeroCombatPower = heroPowers.find((power) => power.id === selectedHeroCombatPowerId) || null;
  const selectedHeroCombatPowerMissing = Boolean(selectedHeroCombatPowerId && !selectedHeroCombatPower);
  const selectedHeroCombatPowerManaCost = selectedHeroCombatPower ? Math.max(0, Number(selectedHeroCombatPower.manaCost) || 0) : 0;
  const selectedHeroCombatManaCost = combatManaCost + selectedHeroCombatPowerManaCost;
  const selectedHeroCombatManaUnavailable = selectedHeroCombatManaCost > heroMana;
  const selectedHeroCombatActionLabel = selectedHeroCombatPower
    ? `Utiliser ${selectedHeroCombatPower.name || 'Pouvoir'}`
    : 'Attaque normale';
  const showDice = getCombatEntryValue(entry, 'combatShowDice', combatSettings.showDice !== false) !== false;
  const lastCombatRoll = activeHeroCombat.lastEnemyRoll
    || activeHeroCombat.lastRoll
    || (['hero_combat', 'enemy_combat', 'hero_combat_escape', 'hero_combat_survival'].includes(lastDiceRoll?.actionType) ? lastDiceRoll : null);
  const overlayStyle = backgroundImageData
    ? { backgroundImage: `linear-gradient(180deg, rgba(2,6,23,.18), rgba(2,6,23,.82)), url(${backgroundImageData})` }
    : undefined;
  const isEnded = ['victory', 'defeat'].includes(activeHeroCombat.status);
  const isEnemyTurn = activeHeroCombat.phase === 'enemy';
  const isSurvivalTurn = activeHeroCombat.phase === 'survival';
  const combatVisualEffects = Array.isArray(activeHeroCombat.visualEffects) ? activeHeroCombat.visualEffects : [];
  const isCombatEffectLocked = heroCombatEffectLocked && combatVisualEffects.length > 0;
  const canChooseHeroAction = !isEnded && !isEnemyTurn && !isSurvivalTurn && !isHeroDefeated && !isCombatEffectLocked;
  const handleCombatExit = () => {
    if (isEnded) {
      closeHeroCombat?.();
      return;
    }
    if (!isEnemyTurn && !isSurvivalTurn && !heroCombatRolling && !isCombatEffectLocked && attemptEscapeHeroCombat) {
      attemptEscapeHeroCombat();
    }
  };
  const combatActionHandler = (rawRoll) => (
    isSurvivalTurn
      ? attemptSurvivalHeroCombat?.({ rawRoll })
      : isEnemyTurn
      ? rollActiveEnemyCombat?.({ rawRoll })
      : attackActiveHeroCombat?.(selectedHeroCombatPower?.id || '', { rawRoll })
  );
  const combatActionDisabled = isEnded
    || (!isSurvivalTurn && isHeroDefeated)
    || isCombatEffectLocked
    || (isSurvivalTurn ? !attemptSurvivalHeroCombat : isEnemyTurn ? !rollActiveEnemyCombat : !attackActiveHeroCombat)
    || (!isEnemyTurn && !isSurvivalTurn && (selectedHeroCombatPowerMissing || selectedHeroCombatManaUnavailable));
  const finishHeroCombatRoll = () => {
    if (heroCombatRollIntervalRef.current) {
      window.clearInterval(heroCombatRollIntervalRef.current);
      heroCombatRollIntervalRef.current = null;
    }
    if (heroCombatAutoStopTimeoutRef.current) {
      window.clearTimeout(heroCombatAutoStopTimeoutRef.current);
      heroCombatAutoStopTimeoutRef.current = null;
    }
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const finalRaw = Math.max(1, Math.min(sides, Number(heroCombatDieFaceRef.current) || 1));
    setHeroCombatRolling(false);
    combatActionHandler(finalRaw);
  };
  const stopHeroCombatRoll = () => {
    if (!heroCombatRolling) return;
    finishHeroCombatRoll();
  };
  const startHeroCombatRoll = () => {
    if (combatActionDisabled || heroCombatRolling || isCombatEffectLocked) return;
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const initialFace = Number(lastCombatRoll?.raw) || Math.floor(Math.random() * sides) + 1;
    heroCombatDieFaceRef.current = Math.max(1, Math.min(sides, initialFace));
    setHeroCombatDieFace(heroCombatDieFaceRef.current);
    setHeroCombatRolling(true);
    if (heroCombatRollIntervalRef.current) window.clearInterval(heroCombatRollIntervalRef.current);
    heroCombatRollIntervalRef.current = window.setInterval(() => {
      const nextFace = Math.floor(Math.random() * sides) + 1;
      heroCombatDieFaceRef.current = nextFace;
      setHeroCombatDieFace(nextFace);
    }, 80);
    if (isEnemyTurn) {
      const duration = 1000 + Math.floor(Math.random() * 2001);
      heroCombatAutoStopTimeoutRef.current = window.setTimeout(() => {
        finishHeroCombatRoll();
      }, duration);
    }
  };
  const toggleHeroCombatRoll = () => {
    if (isCombatEffectLocked) return;
    if (heroCombatRolling && isEnemyTurn) return;
    if (heroCombatRolling) {
      stopHeroCombatRoll();
      return;
    }
    startHeroCombatRoll();
  };
  const displayedCombatDieFace = heroCombatRolling ? heroCombatDieFace : lastCombatRoll?.raw || '?';

  return (
    <div className={`hero-combat-overlay hero-combat-overlay--${activeHeroCombat.status || 'active'}${isEnemyTurn ? ' hero-combat-overlay--enemy-turn' : ''}`} style={overlayStyle}>
      <div className="hero-combat-topline">
        <span>{isSurvivalTurn ? 'Survie' : isEnemyTurn ? 'Tour ennemi' : `Tour ${activeHeroCombat.round || 1}`}</span>
        <strong>{enemyLabel}</strong>
        <button type="button" className="secondary-action compact" onClick={handleCombatExit} disabled={!isEnded && (isEnemyTurn || isSurvivalTurn || heroCombatRolling || isCombatEffectLocked)}>
          {isEnded ? 'Fermer' : 'Fuir'}
        </button>
      </div>

      <div className="hero-combat-stage">
        {renderHeroCombatActor(heroMedia, heroLabel, 'hero', {
          health: heroHealth,
          maxHealth: heroMaxHealth,
          mana: heroMana,
          maxMana: heroMaxMana,
        }, combatVisualEffects)}

        {showDice ? (
          <div className="hero-combat-dice-spotlight">
            <button
              type="button"
              className={`hero-combat-die-button ${heroCombatRolling ? 'is-rolling' : ''}`}
              onClick={toggleHeroCombatRoll}
              disabled={combatActionDisabled && !heroCombatRolling}
            >
              <span className={`hero-combat-die hero-die-face hero-die-face--${heroDiceSkin} ${heroCombatRolling ? 'is-rolling' : ''}`}>
                <span className="hero-roll-die-value">{displayedCombatDieFace}</span>
              </span>
            </button>
            <strong>{heroCombatRolling ? '...' : lastCombatRoll ? `${lastCombatRoll.total} total` : heroAdventure.dice?.label || 'De'}</strong>
            <small>{isEnded ? 'Combat termine' : isCombatEffectLocked ? 'Impact...' : heroCombatRolling ? (isEnemyTurn ? 'Le de ennemi tourne...' : 'Clique pour arreter') : isEnemyTurn ? 'Clique pour la riposte' : isSurvivalTurn ? 'Lance Survie' : 'Clique pour lancer'}</small>
          </div>
        ) : null}

        {renderHeroCombatActor(enemyMedia, enemyLabel, 'enemy', {
          health: enemyHealth,
          maxHealth: enemyMaxHealth,
          mana: enemyMana,
          maxMana: enemyMaxMana,
        }, combatVisualEffects)}
      </div>

      <div className="hero-combat-log">
        <p>{activeHeroCombat.message || 'Le combat commence.'}</p>
        {isSurvivalTurn && !isEnded ? (
          <div className="hero-combat-survival-card" role="status" aria-live="polite">
            <strong>Survie</strong>
            <span>Lance le de pour tenter de rester a 1 PV.</span>
          </div>
        ) : null}
        {!isEnemyTurn && !isSurvivalTurn && !isEnded ? (
          <div className="hero-combat-action-choice" aria-label="Action du heros">
            <button
              type="button"
              className={`hero-combat-action-choice-button ${!selectedHeroCombatPowerId ? 'active' : ''}`}
              onClick={() => setSelectedHeroCombatPowerId('')}
              disabled={!canChooseHeroAction || heroCombatRolling || isCombatEffectLocked}
            >
              <strong>Attaque normale</strong>
              <span>{combatManaCost} mana</span>
            </button>
            {heroPowers.map((power) => {
              const manaCost = Math.max(0, Number(power.manaCost) || 0);
              const totalManaCost = combatManaCost + manaCost;
              const disabled = !canChooseHeroAction || totalManaCost > heroMana;
              return (
                <button
                  key={power.id}
                  type="button"
                  className={`hero-combat-action-choice-button ${selectedHeroCombatPowerId === power.id ? 'active' : ''}`}
                  onClick={() => setSelectedHeroCombatPowerId(power.id)}
                  disabled={disabled || heroCombatRolling || isCombatEffectLocked}
                  title={disabled && totalManaCost > heroMana ? 'Mana insuffisante' : `${power.force || 0} force`}
                >
                  <strong>{power.name || 'Pouvoir'}</strong>
                  <span>{HERO_POWER_TYPE_LABELS[power.type] || power.type || 'Pouvoir'} - {totalManaCost} mana - {power.force || 0}</span>
                </button>
              );
            })}
          </div>
        ) : null}
        <div className="inline-actions">
          <button
            type="button"
            onClick={showDice ? toggleHeroCombatRoll : () => combatActionHandler()}
            disabled={combatActionDisabled && !heroCombatRolling}
          >
            {isEnded ? 'Combat termine' : isCombatEffectLocked ? 'Impact...' : heroCombatRolling && isEnemyTurn ? 'Le de ennemi tourne...' : isEnemyTurn ? 'Lancer le de ennemi' : heroCombatRolling ? 'Arreter le de' : isSurvivalTurn ? 'Lancer Survie' : selectedHeroCombatActionLabel}
          </button>
          <button type="button" className="secondary-action" onClick={handleCombatExit} disabled={!isEnded && (isEnemyTurn || isSurvivalTurn || heroCombatRolling || isCombatEffectLocked)}>
            {isEnded ? (activeHeroCombat.pendingSceneId ? 'Continuer' : 'Revenir a la scene') : 'Fuir'}
          </button>
        </div>
      </div>
    </div>
  );
}
