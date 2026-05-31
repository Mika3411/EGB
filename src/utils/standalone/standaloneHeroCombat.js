export const standaloneHeroCombat = `
function getHeroCombatRuntime(entry = {}, options = {}) {
  const combatId = entry.id || options.sourceHotspotId || (state.playSceneId + '-combat');
  const stats = getStandaloneCombatStats(entry);
  const enemyStats = stats.enemyStats;
  const enemyName = stats.enemyName;
  const enemyMaxHealth = stats.enemyMaxHealth;
  const currentCombat = (state.heroCombatStates || {})[combatId] || {};
  const currentEnemyHealth = currentCombat.defeated
    ? 0
    : clampNumber(currentCombat.enemyHealth ?? enemyMaxHealth, enemyMaxHealth, 0, enemyMaxHealth);
  const currentEnemyMana = clampNumber(currentCombat.enemyMana ?? enemyStats.maxMana, enemyStats.maxMana, 0, enemyStats.maxMana);
  const currentHeroStatusEffects = Array.isArray(currentCombat.heroStatusEffects) ? currentCombat.heroStatusEffects : [];
  const currentEnemyStatusEffects = Array.isArray(currentCombat.enemyStatusEffects) ? currentCombat.enemyStatusEffects : [];
  return {
    combatId,
    stats,
    enemyStats,
    enemyName,
    enemyMaxHealth,
    currentEnemyHealth,
    enemyMaxMana: enemyStats.maxMana,
    currentEnemyMana,
    currentHeroStatusEffects,
    currentEnemyStatusEffects,
  };
}

function rollEnemyCombatDie(enemyName = 'Ennemi') {
  const sides = Math.max(2, Number(project?.heroAdventure?.dice?.sides) || 20);
  const raw = Math.floor(Math.random() * sides) + 1;
  return {
    id: Date.now(),
    die: project?.heroAdventure?.dice?.label || ('d' + sides),
    sides,
    raw,
    modifier: 0,
    total: raw,
    actionType: 'enemy_combat',
    enemyName,
  };
}

function buildEnemyCombatAction(stats, currentEnemyMana, enemyName, options = {}) {
  const enemyStats = stats.enemyStats;
  const enemyRoll = rollEnemyCombatDie(enemyName);
  const currentHero = state.heroState || getInitialHeroState();
  const enemyAttack = resolveEnemyCombatAttack({
    stats,
    hero: currentHero,
    heroHealth: Number(currentHero.health) || 0,
    heroStatusEffects: options.heroStatusEffects || [],
    enemyStatusEffects: options.enemyStatusEffects || [],
    enemyHealth: options.enemyHealth,
    enemyMana: currentEnemyMana,
    rawRoll: enemyRoll.raw,
  });
  enemyRoll.modifier = enemyAttack.forceDamage + enemyAttack.dieDamageBonus;
  enemyRoll.total = enemyAttack.baseDamage;
  enemyRoll.damage = enemyAttack.damage;
  enemyRoll.damageTarget = 'hero';
  enemyRoll.damageBlocked = enemyAttack.armorBlocked + enemyAttack.shieldBlocked;
  enemyRoll.dodged = enemyAttack.dodged;
  enemyRoll.critical = enemyAttack.critical;
  enemyRoll.criticalPierced = enemyAttack.criticalPierced;
  const enemyActionText = enemyAttack.usesPower
    ? enemyName + ' utilise ' + enemyStats.powerName + ' (' + getCombatPowerTypeLabel(enemyStats.powerType) + ').'
    : enemyName + ' riposte.';
  const criticalText = enemyAttack.critical ? ' Coup critique x' + enemyAttack.criticalMultiplier + '.' : '';
  const heroResistanceText = enemyAttack.resistance ? ' Résistance du héros: dégâts réduits.' : '';
  const heroDodgeText = enemyAttack.dodged ? ' Le héros esquive.' : '';
  const heroArmorText = enemyAttack.armorBlocked ? ' Armure héros -' + enemyAttack.armorBlocked + '.' : '';
  const heroShieldText = enemyAttack.shieldBlocked ? ' Bouclier -' + enemyAttack.shieldBlocked + '.' : '';
  const criticalPierceText = enemyAttack.criticalPierced ? ' Percée critique: 1 PV traverse la défense.' : '';
  const manaText = enemyAttack.usesPower ? ' Mana ' + enemyAttack.enemyMana + '/' + enemyStats.maxMana + '.' : '';
  const damageText = enemyAttack.damage > 0
    ? ' Le héros perd ' + enemyAttack.damage + ' PV.'
    : ' Le héros ne perd pas de PV.';
  const damageFormulaText = ' Dégâts: force ' + enemyAttack.forceDamage + ' + dé ' + enemyAttack.dieDamageBonus + ' (' + enemyAttack.dieDamagePercent + '%) = ' + enemyAttack.baseDamage + '.';
  const attackText = 'Jet ennemi: ' + enemyRoll.raw + '. ' + enemyActionText + damageFormulaText + damageText + criticalText + heroResistanceText + heroDodgeText + heroArmorText + heroShieldText + criticalPierceText + manaText;
  const visualEffects = [
    enemyAttack.usesPower && enemyStats.powerManaCost > 0 ? makeCombatVisualEffect('enemy', 'mana', '-' + enemyStats.powerManaCost + ' Mana') : null,
    enemyAttack.critical ? makeCombatVisualEffect('hero', 'critical', 'CRITIQUE x' + enemyAttack.criticalMultiplier) : null,
  ].filter(Boolean);
  return {
    enemyRoll,
    nextEnemyMana: enemyAttack.enemyMana,
    enemyDamage: enemyAttack.damage,
    heroStatusEffects: enemyAttack.heroStatusEffects || [],
    retaliationText: attackText,
    visualEffects,
  };
}

function resolveEnemyCombatTurn(entry = {}, options = {}) {
  const runtime = getHeroCombatRuntime(entry, options);
  const {
    combatId,
    stats,
    enemyStats,
    enemyName,
    enemyMaxHealth,
    currentEnemyHealth,
    currentEnemyMana,
    currentHeroStatusEffects,
    currentEnemyStatusEffects,
  } = runtime;

  if (currentEnemyHealth <= 0) {
    const message = enemyName + ' est déjà vaincu.';
    state.dialogue = message;
    return {
      ok: true,
      ended: true,
      victory: true,
      enemyHealth: 0,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      message,
    };
  }

  const enemyTick = tickStatusEffects(currentEnemyStatusEffects, currentEnemyHealth);
  if (enemyTick.health <= 0) {
    setHeroCombatState(combatId, {
      enemyHealth: 0,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      heroStatusEffects: currentHeroStatusEffects,
      enemyStatusEffects: enemyTick.effects,
      defeated: true,
    });
    state.dialogue = (enemyName + ' subit ' + enemyTick.damage + " PV d'altération. " + (entry.combatVictoryDialogue || 'Victoire.')).trim();
    return { ok: true, ended: true, victory: true, enemyHealth: 0, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana: enemyStats.maxMana, message: state.dialogue };
  }
  if (enemyTick.stunned) {
    setHeroCombatState(combatId, {
      enemyHealth: enemyTick.health,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      heroStatusEffects: currentHeroStatusEffects,
      enemyStatusEffects: enemyTick.effects,
      defeated: false,
    });
    state.dialogue = enemyName + ' est étourdi et perd son action.';
    return { ok: true, ended: false, enemyHealth: enemyTick.health, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana: enemyStats.maxMana, message: state.dialogue };
  }

  const enemyAction = buildEnemyCombatAction(stats, currentEnemyMana, enemyName, { heroStatusEffects: currentHeroStatusEffects, enemyStatusEffects: enemyTick.effects, enemyHealth: enemyTick.health });
  state.lastDiceRoll = enemyAction.enemyRoll;
  setHeroCombatState(combatId, {
    enemyHealth: enemyTick.health,
    enemyMaxHealth,
    enemyMana: enemyAction.nextEnemyMana,
    enemyMaxMana: enemyStats.maxMana,
    heroStatusEffects: enemyAction.heroStatusEffects,
    enemyStatusEffects: enemyTick.effects,
    defeated: false,
  });

  const nextHero = applyHeroHealthLoss(enemyAction.enemyDamage, { triggerDefeatScene: false });
  const defeat = Number(nextHero.health || 0) <= 0;
  const visualEffects = [
    ...enemyAction.visualEffects,
    enemyAction.enemyDamage > 0
      ? makeCombatOutcomeEffect('hero', defeat ? 'death' : 'hit', defeat ? 'KO' : '-' + enemyAction.enemyDamage + ' PV')
      : null,
  ].filter(Boolean);
  const survivalPending = defeat ? buildHeroCombatSurvivalPending(entry, {
    combatId,
    enemyStats,
    currentEnemyHealth: enemyTick.health,
    enemyMaxHealth,
    currentEnemyMana: enemyAction.nextEnemyMana,
    enemyMaxMana: enemyStats.maxMana,
    currentHeroStatusEffects: enemyAction.heroStatusEffects,
    currentEnemyStatusEffects: enemyTick.effects,
  }, enemyAction.retaliationText + ' Le héros tombe à 0 PV.') : null;
  if (survivalPending) {
    state.dialogue = survivalPending.message;
    return { ...survivalPending, enemyRoll: enemyAction.enemyRoll, visualEffects };
  }
  const defeatText = defeat ? ' ' + (entry.combatDefeatDialogue || 'Défaite.') : '';
  const statusPrefix = enemyTick.damage > 0 ? enemyName + " subit " + enemyTick.damage + " PV d'altération. " : '';
  const message = (statusPrefix + enemyAction.retaliationText + defeatText).trim();

  if (defeat && entry.combatDefeatTargetSceneId) {
    const movedScene = goToScene(entry.combatDefeatTargetSceneId, message);
    return {
      ok: Boolean(movedScene),
      ended: true,
      defeat: true,
      movedScene: Boolean(movedScene),
      enemyHealth: enemyTick.health,
      enemyMaxHealth,
      enemyMana: enemyAction.nextEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      message,
      enemyRoll: enemyAction.enemyRoll,
      visualEffects,
    };
  }

  state.dialogue = message;
  return {
    ok: true,
    ended: defeat,
    defeat,
    enemyHealth: enemyTick.health,
    enemyMaxHealth,
    enemyMana: enemyAction.nextEnemyMana,
    enemyMaxMana: enemyStats.maxMana,
    message,
    enemyRoll: enemyAction.enemyRoll,
    visualEffects,
  };
}

function resolveHeroCombatTurn(entry = {}, options = {}) {
  const runtime = getHeroCombatRuntime(entry, options);
  const {
    combatId,
    stats,
    enemyStats,
    enemyName,
    enemyMaxHealth,
    currentEnemyHealth,
    enemyMaxMana,
    currentEnemyMana,
    currentHeroStatusEffects,
    currentEnemyStatusEffects,
  } = runtime;

  if (currentEnemyHealth <= 0) {
    const message = enemyName + ' est déjà vaincu.';
    state.dialogue = message;
    if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
    return {
      ok: true,
      ended: true,
      victory: true,
      enemyHealth: 0,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana,
      message,
    };
  }

  const heroPower = getHeroPowerById(options.heroPowerId);
  const currentHero = state.heroState || getInitialHeroState();
  const heroTick = tickStatusEffects(currentHeroStatusEffects, Number(currentHero.health) || 0);
  const heroAfterStatus = { ...currentHero, health: heroTick.health };
  if (heroTick.damage > 0 || heroTick.stunned) state.heroState = heroAfterStatus;
  if (heroTick.health <= 0) {
    const survivalPending = buildHeroCombatSurvivalPending(entry, {
      combatId,
      enemyStats,
      currentEnemyHealth,
      enemyMaxHealth,
      currentEnemyMana,
      enemyMaxMana,
      currentHeroStatusEffects: heroTick.effects,
      currentEnemyStatusEffects,
    }, 'Le héros subit ' + heroTick.damage + " PV d'altération et tombe à 0 PV.");
    if (survivalPending) {
      setHeroCombatState(combatId, {
        enemyHealth: currentEnemyHealth,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana,
        heroStatusEffects: heroTick.effects,
        enemyStatusEffects: currentEnemyStatusEffects,
        defeated: false,
      });
      state.dialogue = survivalPending.message;
      return survivalPending;
    }
    state.dialogue = ('Le héros subit ' + heroTick.damage + " PV d'altération. " + (entry.combatDefeatDialogue || 'Défaite.')).trim();
    setHeroCombatState(combatId, {
      enemyHealth: currentEnemyHealth,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana,
      heroStatusEffects: heroTick.effects,
      enemyStatusEffects: currentEnemyStatusEffects,
      defeated: false,
    });
    return { ok: true, ended: true, defeat: true, enemyHealth: currentEnemyHealth, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana, message: state.dialogue };
  }
  if (heroTick.stunned) {
    state.dialogue = 'Le héros est étourdi et perd son action.';
    setHeroCombatState(combatId, {
      enemyHealth: currentEnemyHealth,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana,
      heroStatusEffects: heroTick.effects,
      enemyStatusEffects: currentEnemyStatusEffects,
      defeated: false,
    });
    return { ok: true, ended: false, pendingEnemyTurn: true, enemyHealth: currentEnemyHealth, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana, message: state.dialogue };
  }
  const heroAttack = resolveHeroCombatAttack({
    stats,
    enemyHealth: currentEnemyHealth,
    heroHealth: Number(heroAfterStatus.health) || 0,
    heroMana: Number(heroAfterStatus.mana) || 0,
    heroStatusEffects: heroTick.effects,
    enemyStatusEffects: currentEnemyStatusEffects,
    power: heroPower,
    rawRoll: options.rawRoll,
  });
  if (!heroAttack.ok) {
    state.dialogue = 'Mana insuffisante pour ' + (heroPower?.name || stats.skillName || 'cette attaque') + '.';
    return { ok: false, reason: heroAttack.reason, message: state.dialogue };
  }

  const skillId = entry.combatSkillId || state.heroState?.skills?.[0]?.id || '';
  const roll = {
    id: Date.now(),
    die: stats.diceLabel,
    sides: stats.diceSides,
    raw: heroAttack.roll.raw,
    modifier: heroAttack.roll.modifier,
    total: heroAttack.roll.total,
    skillId,
    skillName: stats.skillName,
    success: heroAttack.roll.success,
    difficulty: stats.difficulty,
    actionType: 'hero_combat',
    heroPowerId: heroPower?.id || '',
    heroPowerName: heroPower?.name || '',
    heroDieDamageBonus: heroAttack.heroDieDamageBonus,
    heroDieDamagePercent: heroAttack.heroDieDamagePercent,
    heroCritical: heroAttack.critical,
    rawHeroDamage: heroAttack.rawDamage,
    damage: heroAttack.damage,
    damageTarget: 'enemy',
    damageBlocked: heroAttack.armorBlocked + heroAttack.shieldBlocked,
    dodged: heroAttack.dodged,
    criticalPierced: heroAttack.criticalPierced,
  };
  let nextHeroStatusEffects = heroTick.effects;
  let nextEnemyStatusEffects = heroAttack.enemyStatusEffects || currentEnemyStatusEffects;
  if (heroAttack.appliedStatusEffect?.target === 'hero') {
    nextHeroStatusEffects = addStatusEffect(nextHeroStatusEffects, heroAttack.appliedStatusEffect);
  } else if (heroAttack.appliedStatusEffect?.target === 'enemy') {
    nextEnemyStatusEffects = addStatusEffect(nextEnemyStatusEffects, heroAttack.appliedStatusEffect);
  }
  state.heroState = { ...heroAfterStatus, health: heroAttack.heroHealth, mana: heroAttack.mana };
  state.lastDiceRoll = roll;

  const hit = heroAttack.roll.success;
  const heroPowerText = heroPower ? (heroPower.name || 'Pouvoir') + ' est utilisé. ' : '';
  const heroCriticalText = heroAttack.critical ? ' Coup critique x' + heroAttack.criticalMultiplier + '.' : '';
  const heroPowerDamageText = heroAttack.powerDamage ? ' + pouvoir ' + heroAttack.powerDamage : '';
  const heroDamageFormulaText = hit ? ' Dégâts: force ' + stats.heroForce + ' + dé ' + heroAttack.heroDieDamageBonus + ' (' + heroAttack.heroDieDamagePercent + '%)' + heroPowerDamageText + ' = ' + heroAttack.baseDamage + '.' : '';
  const resistanceText = hit && heroAttack.resistance
    ? ' Résistance ' + getCombatPowerTypeLabel(heroAttack.attackType) + ': dégâts réduits.'
    : '';
  const dodgeText = hit && heroAttack.dodged
    ? " Esquive: l'attaque ne blesse pas."
    : '';
  const armorText = hit && heroAttack.armorBlocked
    ? ' Armure -' + heroAttack.armorBlocked + '.'
    : '';
  const shieldText = hit && heroAttack.shieldBlocked
    ? ' Bouclier -' + heroAttack.shieldBlocked + '.'
    : '';
  const criticalPierceText = heroAttack.criticalPierced ? ' Percée critique: 1 PV traverse la défense.' : '';
  const recoveryText = heroAttack.recovery.healthRecovered || heroAttack.recovery.manaRecovered
    ? ' Soin: +' + heroAttack.recovery.healthRecovered + ' PV, +' + heroAttack.recovery.manaRecovered + ' mana.'
    : '';
  const statusText = heroAttack.appliedStatusEffect
    ? ' ' + getStatusEffectLabel(heroAttack.appliedStatusEffect.type) + ' appliqué (' + heroAttack.appliedStatusEffect.duration + ' tour(s)).'
    : '';
  const rollDetail = roll.modifier ? 'dé ' + roll.raw + ' + ' + roll.modifier : 'dé ' + roll.raw;
  const rollText = (roll.skillName || 'Action') + (hit ? ' réussie' : ' échouée') + ': ' + roll.total + ' contre ' + stats.difficulty + ' (' + rollDetail + ').';
  const attackText = hit
    ? heroPowerText + enemyName + ' perd ' + heroAttack.damage + ' PV.' + heroDamageFormulaText + heroCriticalText + resistanceText + dodgeText + armorText + shieldText + criticalPierceText + recoveryText + statusText
    : heroPowerText + 'Aucun dégât.' + recoveryText + statusText;
  const heroVisualEffects = [
    heroAttack.manaSpent > 0 ? makeCombatVisualEffect('hero', 'mana', '-' + heroAttack.manaSpent + ' Mana') : null,
    hit && heroAttack.damage > 0
      ? makeCombatOutcomeEffect('enemy', heroAttack.victory ? 'death' : 'hit', heroAttack.victory ? 'KO' : '-' + heroAttack.damage + ' PV')
      : null,
    heroAttack.critical ? makeCombatVisualEffect('enemy', 'critical', 'CRITIQUE x' + heroAttack.criticalMultiplier) : null,
  ].filter(Boolean);

  if (heroAttack.victory) {
    setHeroCombatState(combatId, { enemyHealth: 0, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana, heroStatusEffects: nextHeroStatusEffects, enemyStatusEffects: nextEnemyStatusEffects, defeated: true });
    const reward = resolveCombatVictoryReward(entry, project.items, getItemById);
    if (reward.itemId) {
      addInventoryItem(reward.itemId);
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemLabel(reward.itemId),
        detail: entry.name || enemyName,
      });
    }
    if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
    const victoryMessage = (rollText + ' ' + attackText + ' ' + enemyName + ' est vaincu. ' + (entry.combatVictoryDialogue || 'Victoire.') + reward.message).trim();
    if (entry.combatVictoryTargetSceneId) {
      const movedScene = goToScene(entry.combatVictoryTargetSceneId, victoryMessage);
      return {
        ok: Boolean(movedScene),
        ended: true,
        victory: true,
        movedScene: Boolean(movedScene),
        enemyHealth: 0,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana,
        message: victoryMessage,
        roll,
        visualEffects: heroVisualEffects,
      };
    }
    state.dialogue = victoryMessage;
    return {
      ok: true,
      ended: true,
      victory: true,
      enemyHealth: 0,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana,
      message: victoryMessage,
      roll,
      visualEffects: heroVisualEffects,
    };
  }

  const nextEnemyHealth = heroAttack.enemyHealth;
  const healthText = ' Il lui reste ' + nextEnemyHealth + '/' + enemyMaxHealth + ' PV.';
  if (options.allowManualEnemyTurn) {
    setHeroCombatState(combatId, { enemyHealth: nextEnemyHealth, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana: enemyStats.maxMana, heroStatusEffects: nextHeroStatusEffects, enemyStatusEffects: nextEnemyStatusEffects, defeated: false });
    const message = (rollText + ' ' + attackText + healthText + " À l'ennemi de riposter.").trim();
    state.dialogue = message;
    return {
      ok: true,
      ended: false,
      pendingEnemyTurn: true,
      enemyHealth: nextEnemyHealth,
      enemyMaxHealth,
      enemyMana: currentEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      message,
      roll,
      visualEffects: heroVisualEffects,
    };
  }

  const enemyAction = buildEnemyCombatAction(stats, currentEnemyMana, enemyName, { heroStatusEffects: nextHeroStatusEffects, enemyStatusEffects: nextEnemyStatusEffects, enemyHealth: nextEnemyHealth });
  state.lastDiceRoll = enemyAction.enemyRoll;
  setHeroCombatState(combatId, { enemyHealth: nextEnemyHealth, enemyMaxHealth, enemyMana: enemyAction.nextEnemyMana, enemyMaxMana: enemyStats.maxMana, heroStatusEffects: enemyAction.heroStatusEffects, enemyStatusEffects: nextEnemyStatusEffects, defeated: false });
  const nextHero = applyHeroHealthLoss(enemyAction.enemyDamage, { triggerDefeatScene: false });
  const defeat = Number(nextHero.health || 0) <= 0;
  const enemyRetaliationVisualEffects = [
    ...enemyAction.visualEffects,
    enemyAction.enemyDamage > 0
      ? makeCombatOutcomeEffect('hero', defeat ? 'death' : 'hit', defeat ? 'KO' : '-' + enemyAction.enemyDamage + ' PV')
      : null,
  ].filter(Boolean);
  const survivalPending = defeat ? buildHeroCombatSurvivalPending(entry, {
    combatId,
    enemyStats,
    currentEnemyHealth: nextEnemyHealth,
    enemyMaxHealth,
    currentEnemyMana: enemyAction.nextEnemyMana,
    enemyMaxMana: enemyStats.maxMana,
    currentHeroStatusEffects: enemyAction.heroStatusEffects,
    currentEnemyStatusEffects: nextEnemyStatusEffects,
  }, enemyAction.retaliationText + ' Le héros tombe à 0 PV.') : null;
  if (survivalPending) {
    state.dialogue = survivalPending.message;
    return { ...survivalPending, roll, enemyRoll: enemyAction.enemyRoll, visualEffects: [...heroVisualEffects, ...enemyRetaliationVisualEffects] };
  }
  const defeatText = defeat ? ' ' + (entry.combatDefeatDialogue || 'Défaite.') : '';
  const message = (rollText + ' ' + attackText + healthText + ' ' + enemyAction.retaliationText + defeatText).trim();

  if (defeat && entry.combatDefeatTargetSceneId) {
    const movedScene = goToScene(entry.combatDefeatTargetSceneId, message);
    return {
      ok: Boolean(movedScene),
      ended: true,
      defeat: true,
      movedScene: Boolean(movedScene),
      enemyHealth: nextEnemyHealth,
      enemyMaxHealth,
      enemyMana: enemyAction.nextEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      message,
      roll,
      enemyRoll: enemyAction.enemyRoll,
      visualEffects: [...heroVisualEffects, ...enemyRetaliationVisualEffects],
    };
  }

  state.dialogue = message;
  return {
    ok: true,
    ended: defeat,
    defeat,
    enemyHealth: nextEnemyHealth,
    enemyMaxHealth,
    enemyMana: enemyAction.nextEnemyMana,
    enemyMaxMana: enemyStats.maxMana,
    message,
    roll,
    enemyRoll: enemyAction.enemyRoll,
    visualEffects: [...heroVisualEffects, ...enemyRetaliationVisualEffects],
  };
}

function runHeroCombatAction(entry = {}, options = {}) {
  if (!IS_HERO_ADVENTURE) {
    state.dialogue = 'Active le mode Hero Adventure pour utiliser un combat.';
    return false;
  }
  const runtime = getHeroCombatRuntime(entry, options);
  const enemyStats = runtime.enemyStats;
  const turnMode = (entry.combatTurnMode ?? getStandaloneCombatSettings().turnMode ?? true) !== false;
  const initiative = resolveCombatInitiative(runtime.stats);
  const enemyStarts = initiative.firstActor === 'enemy';
  if (turnMode && !options.resolveTurn) {
    if (runtime.currentEnemyHealth <= 0) {
      state.dialogue = runtime.enemyName + ' est déjà vaincu.';
      if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
      return true;
    }
    if (options.closeConversation) closeConversation();
    const defaultStartMessage = enemyStarts
      ? runtime.enemyName + ' a l’initiative (' + initiative.enemyInitiative + ' contre ' + initiative.heroInitiative + '). Lance le dé ennemi.'
      : enemyStats.enemyAutoTurn === false
        ? 'Combat contre ' + runtime.enemyName + '. À toi de jouer, puis lance le dé ennemi.'
        : 'Combat contre ' + runtime.enemyName + '. À toi de jouer.';
    const startMessage = entry.combatStartDialogue || defaultStartMessage;
    state.activeHeroCombat = {
      id: runtime.combatId,
      entry: { ...entry },
      options: { sourceHotspotId: options.sourceHotspotId || '' },
      enemyName: runtime.enemyName,
      enemyHealth: runtime.currentEnemyHealth,
      enemyMaxHealth: runtime.enemyMaxHealth,
      enemyMana: runtime.currentEnemyMana,
      enemyMaxMana: runtime.enemyMaxMana,
      heroInitiative: initiative.heroInitiative,
      enemyInitiative: initiative.enemyInitiative,
      heroStatusEffects: runtime.currentHeroStatusEffects,
      enemyStatusEffects: runtime.currentEnemyStatusEffects,
      round: 1,
      phase: enemyStarts ? 'enemy' : 'hero',
      initiativePending: enemyStarts,
      status: 'active',
      message: startMessage,
      history: buildHeroCombatHistory({}, startMessage),
      lastRoll: null,
      lastEnemyRoll: null,
      visualEffects: [],
    };
    state.selectedHeroCombatPowerId = '';
    state.dialogue = entry.combatStartDialogue || (enemyStarts ? runtime.enemyName + ' a l’initiative.' : 'Combat contre ' + runtime.enemyName + '.');
    return true;
  }

  const result = resolveHeroCombatTurn(entry, options);
  return Boolean(result.ok);
}

function buildHeroCombatHistory(current = {}, nextMessage = '') {
  const cleanMessage = String(nextMessage || '').replace(/\s+/g, ' ').trim();
  const existingHistory = Array.isArray(current.history) ? current.history : current.message ? [current.message] : [];
  const history = existingHistory
    .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (cleanMessage && history[history.length - 1] !== cleanMessage) history.push(cleanMessage);
  return history.slice(-8);
}

function attackActiveHeroCombat(heroPowerId = '', options = {}) {
  const current = state.activeHeroCombat;
  if (!current || current.status !== 'active') return false;
  if (current.phase === 'enemy') {
    state.dialogue = 'C’est au tour ennemi.';
    render();
    return false;
  }
  const result = resolveHeroCombatTurn(current.entry, {
    ...(current.options || {}),
    allowManualEnemyTurn: true,
    resolveTurn: true,
    heroPowerId,
    rawRoll: options.rawRoll,
  });
  if (!result.ok) {
    render();
    return false;
  }
  if (result.ended) {
    state.activeHeroCombat = {
      ...current,
      status: result.victory ? 'victory' : result.defeat ? 'defeat' : 'ended',
      phase: 'ended',
      message: result.message,
      history: buildHeroCombatHistory(current, result.message),
      enemyHealth: result.enemyHealth,
      enemyMaxHealth: result.enemyMaxHealth,
      enemyMana: result.enemyMana,
      enemyMaxMana: result.enemyMaxMana,
      lastRoll: result.roll || current.lastRoll,
      lastEnemyRoll: result.enemyRoll || current.lastEnemyRoll,
      visualEffects: result.visualEffects || [],
    };
  } else {
    state.activeHeroCombat = {
      ...current,
      phase: result.survivalPending ? 'survival' : result.pendingEnemyTurn ? 'enemy' : 'hero',
      round: result.pendingEnemyTurn || result.survivalPending ? current.round : (Number(current.round) || 1) + 1,
      survivalPending: Boolean(result.survivalPending),
      message: result.message,
      history: buildHeroCombatHistory(current, result.message),
      enemyHealth: result.enemyHealth,
      enemyMaxHealth: result.enemyMaxHealth,
      enemyMana: result.enemyMana,
      enemyMaxMana: result.enemyMaxMana,
      lastRoll: result.roll || current.lastRoll,
      lastEnemyRoll: result.enemyRoll || current.lastEnemyRoll,
      visualEffects: result.visualEffects || [],
    };
  }
  render();
  return true;
}

function rollActiveEnemyCombat(options = {}) {
  const current = state.activeHeroCombat;
  if (!current || current.status !== 'active') return false;
  if (current.phase !== 'enemy') {
    state.dialogue = 'Le héros doit agir avant la riposte.';
    render();
    return false;
  }
  const result = resolveEnemyCombatTurn(current.entry, {
    ...(current.options || {}),
    rawRoll: options.rawRoll,
  });
  if (!result.ok) {
    render();
    return false;
  }
  state.activeHeroCombat = {
    ...current,
    status: result.defeat ? 'defeat' : 'active',
    phase: result.survivalPending ? 'survival' : result.defeat ? 'ended' : 'hero',
    round: result.defeat || result.survivalPending || current.initiativePending ? current.round : (Number(current.round) || 1) + 1,
    survivalPending: Boolean(result.survivalPending),
    initiativePending: false,
    message: result.message,
    history: buildHeroCombatHistory(current, result.message),
    enemyHealth: result.enemyHealth,
    enemyMaxHealth: result.enemyMaxHealth,
    enemyMana: result.enemyMana,
    enemyMaxMana: result.enemyMaxMana,
    lastEnemyRoll: result.enemyRoll || current.lastEnemyRoll,
    visualEffects: result.visualEffects || [],
  };
  render();
  return true;
}

function getHeroRuseSkill() {
  const hero = state.heroState || getInitialHeroState();
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  return (hero.skills || []).find((skill) => normalize(skill.id) === 'ruse' || normalize(skill.name) === 'ruse') || null;
}

function getHeroSkillByKey(key = '') {
  const hero = state.heroState || getInitialHeroState();
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const normalizedKey = normalize(key);
  return (hero.skills || []).find((skill) => normalize(skill.id) === normalizedKey || normalize(skill.name) === normalizedKey) || null;
}

function createHeroCombatSurvivalRoll(enemyStats = {}) {
  const survivalSkill = getHeroSkillByKey('survie') || getHeroSkillByKey('survival');
  const modifier = Math.max(0, Number(survivalSkill?.value) || 0);
  const chaos = Math.max(1, Number(enemyStats?.chaos) || Number(DEFAULT_COMBAT_SETTINGS.enemyChaos) || 10);
  const sides = Math.max(2, Number(project?.heroAdventure?.dice?.sides) || 20);
  const raw = rollDie({ sides });
  const total = raw + modifier;
  return {
    raw,
    modifier,
    total,
    difficulty: chaos,
    success: total >= chaos,
    skillId: survivalSkill?.id || 'survie',
    skillName: survivalSkill?.name || 'Survie',
    actionType: 'hero_combat_survival',
  };
}

function buildHeroCombatSurvivalPending(entry = {}, runtime = {}, reasonMessage = '') {
  const combatState = (state.heroCombatStates || {})[runtime.combatId] || {};
  if (combatState.survivalUsed) return null;
  const survivalSkill = getHeroSkillByKey('survie') || getHeroSkillByKey('survival');
  const chaos = Math.max(1, Number(runtime.enemyStats?.chaos) || Number(DEFAULT_COMBAT_SETTINGS.enemyChaos) || 10);
  return {
    ok: true,
    ended: false,
    survivalPending: true,
    enemyHealth: runtime.currentEnemyHealth,
    enemyMaxHealth: runtime.enemyMaxHealth,
    enemyMana: runtime.currentEnemyMana,
    enemyMaxMana: runtime.enemyMaxMana,
    message: (reasonMessage + ' Lance Survie (' + (survivalSkill?.value || 0) + ') contre chaos ' + chaos + '.').trim(),
  };
}

function attemptSurvivalHeroCombat() {
  const current = state.activeHeroCombat;
  if (!current || current.status !== 'active' || current.phase !== 'survival') return false;
  const runtime = getHeroCombatRuntime(current.entry, current.options || {});
  const roll = createHeroCombatSurvivalRoll(runtime.enemyStats);
  state.lastDiceRoll = roll;
  setHeroCombatState(runtime.combatId, {
    enemyHealth: runtime.currentEnemyHealth,
    enemyMaxHealth: runtime.enemyMaxHealth,
    enemyMana: runtime.currentEnemyMana,
    enemyMaxMana: runtime.enemyMaxMana,
    heroStatusEffects: runtime.currentHeroStatusEffects,
    enemyStatusEffects: runtime.currentEnemyStatusEffects,
    defeated: false,
    survivalUsed: true,
  });
  if (roll.success) {
    state.heroState = { ...(state.heroState || getInitialHeroState()), health: 1 };
    const message = roll.skillName + ': ' + roll.raw + ' + ' + roll.modifier + ' = ' + roll.total + ' contre chaos ' + roll.difficulty + '. Le héros se relève avec 1 PV.';
    state.dialogue = message;
    state.activeHeroCombat = {
      ...current,
      phase: 'hero',
      survivalPending: false,
      survivalUsed: true,
      message,
      history: buildHeroCombatHistory(current, message),
      lastRoll: roll,
    };
    render();
    return true;
  }
  const message = roll.skillName + ': ' + roll.raw + ' + ' + roll.modifier + ' = ' + roll.total + ' contre chaos ' + roll.difficulty + '. Le héros meurt. ' + (current.entry?.combatDefeatDialogue || 'Défaite.');
  state.dialogue = message;
  state.activeHeroCombat = {
    ...current,
    status: 'defeat',
    phase: 'ended',
    survivalPending: false,
    survivalUsed: true,
    message,
    history: buildHeroCombatHistory(current, message),
    lastRoll: roll,
  };
  render();
  return false;
}

function attemptEscapeHeroCombat() {
  const current = state.activeHeroCombat;
  if (!current || current.status !== 'active') return false;
  if (current.phase === 'enemy') {
    state.dialogue = 'La riposte ennemie est en cours.';
    render();
    return false;
  }
  const runtime = getHeroCombatRuntime(current.entry, current.options || {});
  const ruseSkill = getHeroRuseSkill();
  const modifier = Math.max(0, Number(ruseSkill?.value) || 0);
  const enemyCunning = Math.max(1, Number(runtime.enemyStats?.cunning) || Number(DEFAULT_COMBAT_SETTINGS.enemyCunning) || 10);
  const raw = rollDie({ sides: runtime.stats.diceSides });
  const total = raw + modifier;
  const roll = {
    raw,
    modifier,
    total,
    difficulty: enemyCunning,
    success: total >= enemyCunning,
    actionType: 'hero_combat_escape',
  };
  state.lastDiceRoll = roll;
  if (total >= enemyCunning) {
    state.dialogue = 'Fuite réussie: Ruse ' + raw + ' + ' + modifier + ' = ' + total + ' contre ' + enemyCunning + '.';
    state.activeHeroCombat = null;
    render();
    return true;
  }
  const message = 'Fuite ratée: Ruse ' + raw + ' + ' + modifier + ' = ' + total + ' contre ' + enemyCunning + '. Le héros perd son tour.';
  state.dialogue = message;
  state.activeHeroCombat = {
    ...current,
    phase: 'enemy',
    pendingEnemyTurn: true,
    message,
    history: buildHeroCombatHistory(current, message),
    lastRoll: roll,
    lastEnemyRoll: null,
  };
  render();
  return false;
}

function closeHeroCombat() {
  if (state.activeHeroCombat && state.activeHeroCombat.status === 'active') {
    return attemptEscapeHeroCombat();
  }
  state.activeHeroCombat = null;
  render();
}
`;
