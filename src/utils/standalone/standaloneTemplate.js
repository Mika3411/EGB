import { buildStandaloneCss } from './standaloneCss.js';
import { buildStandaloneRuntimeState } from './standaloneRuntimeState.js';
import { buildStandaloneSecurityScript } from './standaloneSecurity.js';
import { standaloneConversationCore, standaloneConversationRender, standaloneConversationReply } from './standaloneConversation.js';
import { standaloneEnigmaActions, standaloneEnigmaPieceStyles, standaloneEnigmaPlayback, standaloneEnigmaRender } from './standaloneEnigmas.js';
import { standaloneHeroRuntime } from './standaloneHeroRuntime.js';
import { standaloneHeroSkillChecks } from './standaloneHeroSkillChecks.js';
import { standaloneInventoryActions, standaloneInventorySelection } from './standaloneInventory.js';
import { standaloneCinematicNavigation, standaloneNavigation, standaloneNavigationAudio } from './standaloneNavigation.js';
import { standaloneProjectLookups } from './standaloneProjectLookups.js';
import { standaloneSaveSystem } from './standaloneSaveSystem.js';
import { standaloneCinematicRender, standaloneRender } from './standaloneRender.js';
import {
  COLOR_OPTIONS,
  POPUP_OVERLAY_GRADIENTS,
  CODE_KEYPAD_KEYS,
  SHARED_GAME_ACTIONS,
  SHARED_GAME_ACTION_CREATORS,
  buildStandaloneGameEngineScript,
  escapeHtml,
  serializeForScript,
  serializeFunctionMap,
  serializeFunctionSource,
  sharedFormatTimerSeconds,
  sharedGetSceneAmbientSoundKey,
  sharedGetSceneMusicKey,
} from './standaloneRuntimeBootstrap.js';

export function buildStandaloneHtml(project) {
  const safeTitle = escapeHtml(project?.title || 'Escape Game');
  const serializedProject = serializeForScript(project);
  const serializedColorOptions = serializeForScript(COLOR_OPTIONS);
  const serializedPopupOverlayGradients = serializeForScript(POPUP_OVERLAY_GRADIENTS);
  const serializedCodeKeypadKeys = serializeForScript(CODE_KEYPAD_KEYS);
  const serializedGameActions = serializeForScript(SHARED_GAME_ACTIONS);
  const serializedGameActionCreators = serializeFunctionMap('gameActions', SHARED_GAME_ACTION_CREATORS);
  const serializedSceneAudioHelpers = [
    `const getSharedSceneMusicKey = ${serializeFunctionSource(sharedGetSceneMusicKey)};`,
    `const getSharedSceneAmbientSoundKey = ${serializeFunctionSource(sharedGetSceneAmbientSoundKey)};`,
    `const getSharedFormatTimerSeconds = ${serializeFunctionSource(sharedFormatTimerSeconds)};`,
  ].join('\n');
  const standaloneGameEngineScript = buildStandaloneGameEngineScript();
  const standaloneRuntimeState = buildStandaloneRuntimeState({
    serializedProject,
    serializedColorOptions,
    serializedPopupOverlayGradients,
    serializedCodeKeypadKeys,
    serializedGameActions,
    serializedGameActionCreators,
    serializedSceneAudioHelpers,
    standaloneSaveSystem,
  });

  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${safeTitle}</title>
<style>
${buildStandaloneCss()}
</style>
</head>
<body>
<div class="app-shell">
  <div class="topbar" hidden>
    <div class="brand-block">
      <div class="status-badge">🎮 Export prêt à jouer</div>
      <h1>${safeTitle}</h1>
      <p>Version standalone générée depuis le preview du builder.</p>
    </div>
    <div class="topbar-actions">
      <button class="fullscreen-toggle" type="button">Sauvegarder</button>
      <button class="fullscreen-toggle" type="button">Charger</button>
      <button class="fullscreen-toggle" type="button">Effacer sauvegarde</button>
      <button class="fullscreen-toggle" type="button">Plein écran</button>
      <span id="save-status" class="small-note" style="align-self:center"></span>
    </div>
  </div>
  <div id="game-root"></div>
</div>

<script>
${standaloneRuntimeState}

${buildStandaloneSecurityScript(standaloneGameEngineScript)}

${standaloneEnigmaPieceStyles}${standaloneProjectLookups}${standaloneNavigation}${standaloneInventorySelection}${standaloneNavigationAudio}${standaloneEnigmaPlayback}${standaloneCinematicNavigation}${standaloneConversationCore}${standaloneHeroRuntime}${standaloneHeroSkillChecks}function getHeroCombatRuntime(entry = {}, options = {}) {
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
  const enemyActionText = enemyAttack.usesPower
    ? enemyName + ' utilise ' + enemyStats.powerName + ' (' + getCombatPowerTypeLabel(enemyStats.powerType) + ').'
    : enemyName + ' riposte.';
  const criticalText = enemyAttack.critical ? ' Coup critique x' + enemyAttack.criticalMultiplier + '.' : '';
  const heroResistanceText = enemyAttack.resistance ? ' Résistance du héros: dégâts réduits.' : '';
  const heroDodgeText = enemyAttack.dodged ? ' Le héros esquive.' : '';
  const heroArmorText = enemyAttack.armorBlocked ? ' Armure héros -' + enemyAttack.armorBlocked + '.' : '';
  const heroShieldText = enemyAttack.shieldBlocked ? ' Bouclier -' + enemyAttack.shieldBlocked + '.' : '';
  const manaText = enemyAttack.usesPower ? ' Mana ' + enemyAttack.enemyMana + '/' + enemyStats.maxMana + '.' : '';
  const damageText = enemyAttack.damage > 0
    ? ' Le héros perd ' + enemyAttack.damage + ' PV.'
    : ' Le héros ne perd pas de PV.';
  const damageFormulaText = ' Dégâts: force ' + enemyAttack.forceDamage + ' + dé ' + enemyAttack.dieDamageBonus + ' (' + enemyAttack.dieDamagePercent + '%) = ' + enemyAttack.baseDamage + '.';
  const attackText = 'Jet ennemi: ' + enemyRoll.raw + '. ' + enemyActionText + damageFormulaText + damageText + criticalText + heroResistanceText + heroDodgeText + heroArmorText + heroShieldText + manaText;
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
  const recoveryText = heroAttack.recovery.healthRecovered || heroAttack.recovery.manaRecovered
    ? ' Soin: +' + heroAttack.recovery.healthRecovered + ' PV, +' + heroAttack.recovery.manaRecovered + ' mana.'
    : '';
  const statusText = heroAttack.appliedStatusEffect
    ? ' ' + getStatusEffectLabel(heroAttack.appliedStatusEffect.type) + ' appliqué (' + heroAttack.appliedStatusEffect.duration + ' tour(s)).'
    : '';
  const rollDetail = roll.modifier ? 'dé ' + roll.raw + ' + ' + roll.modifier : 'dé ' + roll.raw;
  const rollText = (roll.skillName || 'Action') + (hit ? ' réussie' : ' échouée') + ': ' + roll.total + ' contre ' + stats.difficulty + ' (' + rollDetail + ').';
  const attackText = hit
    ? heroPowerText + enemyName + ' perd ' + heroAttack.damage + ' PV.' + heroDamageFormulaText + heroCriticalText + resistanceText + dodgeText + armorText + shieldText + recoveryText + statusText
    : heroPowerText + 'Aucun dégât.' + recoveryText + statusText;
  const heroVisualEffects = [
    heroAttack.manaSpent > 0 ? makeCombatVisualEffect('hero', 'mana', '-' + heroAttack.manaSpent + ' Mana') : null,
    heroAttack.critical ? makeCombatVisualEffect('enemy', 'critical', 'CRITIQUE x' + heroAttack.criticalMultiplier) : null,
    hit && heroAttack.damage > 0
      ? makeCombatOutcomeEffect('enemy', heroAttack.victory ? 'death' : 'hit', heroAttack.victory ? 'KO' : '-' + heroAttack.damage + ' PV')
      : null,
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
    state.activeHeroCombat = {
      id: runtime.combatId,
      entry: { ...entry },
      options: { sourceHotspotId: options.sourceHotspotId || '' },
      enemyName: runtime.enemyName,
      enemyHealth: runtime.currentEnemyHealth,
      enemyMaxHealth: runtime.enemyMaxHealth,
      enemyMana: runtime.currentEnemyMana,
      enemyMaxMana: runtime.enemyMaxMana,
      round: 1,
      phase: enemyStarts ? 'enemy' : 'hero',
      initiativePending: enemyStarts,
      status: 'active',
      message: enemyStarts
? runtime.enemyName + ' a l’initiative (' + initiative.enemyInitiative + ' contre ' + initiative.heroInitiative + '). Lance le dé ennemi.'
: enemyStats.enemyAutoTurn === false
  ? 'Combat contre ' + runtime.enemyName + '. À toi de jouer, puis lance le dé ennemi.'
  : 'Combat contre ' + runtime.enemyName + '. À toi de jouer.',
      lastRoll: null,
      lastEnemyRoll: null,
      visualEffects: [],
    };
    state.selectedHeroCombatPowerId = '';
    state.dialogue = enemyStarts ? runtime.enemyName + ' a l’initiative.' : 'Combat contre ' + runtime.enemyName + '.';
    return true;
  }

  const result = resolveHeroCombatTurn(entry, options);
  return Boolean(result.ok);
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

function openEnding(reply = {}) {
  const typeLabels = {
    good: 'Bonne fin',
    bad: 'Mauvaise fin',
    secret: 'Fin secrete',
    neutral: 'Fin neutre',
  };
  const endingType = reply.endingType || 'neutral';
  state.activeEnding = {
    type: endingType,
    label: typeLabels[endingType] || 'Fin',
    title: reply.endingTitle || typeLabels[endingType] || 'Fin',
    summary: reply.endingSummary || reply.dialogue || 'Ton aventure se termine ici.',
    message: reply.dialogue || '',
  };
}

${standaloneConversationReply}${standaloneEnigmaActions}${standaloneInventoryActions}function getSceneObjectClickMode(obj) {
  if (!obj) return 'object';
  if (obj.clickMode) return obj.clickMode;
  if (obj.isClickable === false) return 'none';
  return 'object';
}

function getSceneObjectBlockType(obj) {
  const value = obj?.blockType || 'object';
  return ['object', 'text', 'image', 'button', 'input', 'code', 'hint'].includes(value) ? value : 'object';
}

function applySceneObjectTextOverride(obj, textOverride) {
  if (textOverride === undefined || textOverride === null) return obj;
  const text = String(textOverride);
  const blockType = getSceneObjectBlockType(obj);
  if (blockType === 'button') return { ...obj, buttonLabel: text };
  if (blockType === 'input') return { ...obj, placeholder: text };
  if (blockType === 'code') return { ...obj, blockLabel: text, placeholder: text };
  if (blockType === 'image') return { ...obj, blockLabel: text };
  return { ...obj, blockText: text, dialogue: text };
}

function normalizeBlockAnswer(value) {
  return String(value || '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getSceneObjectFontSize(obj) {
  const value = Number(obj?.fontSize);
  return Number.isFinite(value) ? Math.max(8, Math.min(48, value)) : 13;
}

function triggerSceneObject(objectId) {
  const scene = getPlayScene();
  const sourceObj = scene?.sceneObjects?.find((entry) => entry.id === objectId);
  if (!sourceObj || state.removedSceneObjectIds.includes(sourceObj.id)) return;
  const obj = applySceneObjectTextOverride(sourceObj, state.sceneObjectTextOverrides?.[objectId]);
  const clickMode = getSceneObjectClickMode(obj);
  if (clickMode === 'none') return;
  if (clickMode === 'action') {
    triggerHotspot(objectId);
    return;
  }
  playHotspotSound(obj);

  const blockType = getSceneObjectBlockType(obj);
  if (blockType === 'input' || blockType === 'code') {
    const answer = window.prompt(obj.placeholder || (blockType === 'code' ? 'Entre le code.' : 'Entre ta réponse.'));
    if (answer === null) return;
    const isCorrect = normalizeBlockAnswer(answer) === normalizeBlockAnswer(obj.expectedAnswer);
    state.dialogue = isCorrect
      ? (obj.successDialogue || obj.dialogue || 'Bonne réponse.')
      : (obj.failureDialogue || 'Ce n est pas la bonne réponse.');
    if (isCorrect) markHotspotCompleted(obj.id);
    if (isCorrect && (obj.logicRules || []).length) {
      triggerHotspot(obj.id);
    }
    if (isCorrect && obj.removeAfterUse && !state.removedSceneObjectIds.includes(obj.id)) {
      state.removedSceneObjectIds = [...state.removedSceneObjectIds, obj.id];
    }
    render();
    return;
  }

  if ((obj.logicRules || []).length) {
    triggerHotspot(obj.id);
    return;
  }

  const mode = obj.interactionMode || 'popup';
  const linkedItem = obj.linkedItemId ? getItemById(obj.linkedItemId) : null;
  const popupSrc = resolveAssetUrl(obj.popupImageId, obj.popupImageData || obj.popupImage)
    || resolveAssetUrl(obj.imageId, obj.imageData)
    || resolveAssetUrl(linkedItem?.imageId, linkedItem?.imageData);

  if (mode === 'popup' || mode === 'both') {
    if (popupSrc) {
      state.viewerImage = {
        id: obj.linkedItemId || obj.id,
        src: popupSrc,
        name: obj.name || linkedItem?.name || obj.popupImageName || 'Objet',
        caption: obj.dialogue || obj.name || linkedItem?.name || '',
      };
    }
  }

  if ((mode === 'inventory' || mode === 'both') && obj.linkedItemId) {
    if (!state.inventory.includes(obj.linkedItemId)) {
      state.inventory = [...state.inventory, obj.linkedItemId];
    }
    if (!state.selectedInventoryIds.includes(obj.linkedItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, obj.linkedItemId].slice(-2);
    }
    state.dialogue = obj.dialogue || ('Tu obtiens ' + (linkedItem?.name || obj.name || 'un objet') + '.');
  } else if (obj.dialogue) {
    state.dialogue = obj.dialogue;
  }

  if (obj.removeAfterUse && !state.removedSceneObjectIds.includes(obj.id)) {
    state.removedSceneObjectIds = [...state.removedSceneObjectIds, obj.id];
  }
  markHotspotCompleted(obj.id);

  render();
}

function applyTriggerHotspotAction(spotId) {
  const scene = getPlayScene();
  const spot = scene?.hotspots?.find((entry) => entry.id === spotId)
    || scene?.sceneObjects?.find((entry) => entry.id === spotId);
  if (!spot) return;
  const activeSpot = resolveHotspotInteraction(spot);
  if (!activeSpot) return;

  if (activeSpot.requiredHotspotId && !state.completedHotspotIds.includes(activeSpot.requiredHotspotId)) {
    state.dialogue = activeSpot.lockedMessage || 'Je ne peux pas faire ça maintenant.';
    render();
    return;
  }

  if (activeSpot.requiredItemId && !state.inventory.includes(activeSpot.requiredItemId)) {
    const need = getItemById(activeSpot.requiredItemId);
    state.dialogue = 'Il te faut ' + (need?.name || 'un objet') + ' pour faire ça.';
    render();
    return;
  }

  playHotspotSound(activeSpot);

  if (activeSpot.actionType === 'conversation') {
    openConversation(activeSpot);
    render();
    return;
  }

  if (activeSpot.enigmaId) {
    const enigma = getEnigmaById(activeSpot.enigmaId);
    if (enigma) {
      openEnigma(enigma, activeSpot);
      render();
      return;
    }
  }

  if (activeSpot.actionType === 'hero_combat') {
    runHeroCombatAction(activeSpot, { sourceHotspotId: activeSpot.id });
    render();
    return;
  }

  if (activeSpot.actionType === 'skill_check') {
    runSkillCheckAction(activeSpot, { sourceHotspotId: activeSpot.id });
    render();
    return;
  }

  applyHotspotAction(activeSpot, spot.id);
  render();
}

function triggerHotspot(spotId) {
  return dispatch(gameActions.triggerHotspot(spotId));
}

function applyCinematicEnd(cinematic) {
  const endType = normalizeCinematicEndAction(cinematic?.onEndType || 'none');
  if (!cinematic || endType === 'none') return;

  if (endType === 'scene' && cinematic.targetSceneId) {
goToScene(cinematic.targetSceneId, 'Nouvelle scène débloquée.');
    return;
  }

  if (endType === 'act' && cinematic.targetActId) {
    const actScene = getFirstSceneForAct(cinematic.targetActId);
    if (actScene) goToScene(actScene.id, 'Un nouvel acte commence.');
    return;
  }

  if (endType === 'item' && cinematic.rewardItemId) {
    const rewardItem = getItemById(cinematic.rewardItemId);
    if (!state.inventory.includes(cinematic.rewardItemId)) {
      state.inventory = [...state.inventory, cinematic.rewardItemId];
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemLabel(cinematic.rewardItemId),
        detail: cinematic.name || 'Cinématique',
      });
    }
    if (!state.selectedInventoryIds.includes(cinematic.rewardItemId)) {
      state.selectedInventoryIds = [...state.selectedInventoryIds, cinematic.rewardItemId].slice(-2);
    }
    const rewardItemImageUrl = resolveAssetUrl(rewardItem?.imageId, rewardItem?.imageData);
    if (rewardItemImageUrl) {
      state.viewerImage = { id: rewardItem.id, src: rewardItemImageUrl, name: rewardItem.name };
    }
    state.dialogue = 'Tu obtiens ' + (rewardItem?.name || 'un nouvel objet') + '.';
  }
}

function dispatch(action = {}) {
  return standaloneEngine.dispatch(action);
}

function closeCinematic() {
  const cinematic = getCurrentCinematic();
  state.playingCinematicId = null;
  state.playingSlideIndex = 0;
  clearAnime2dTimer();
  anime2dActiveCinematicId = '';
  anime2dStartedAt = 0;

  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }

  applyCinematicEnd(cinematic);
  render();
}

function advanceCinematic() {
  const cinematic = getCurrentCinematic();
  if (!cinematic) return;
  if (cinematic.cinematicType === 'anime2d') {
    closeCinematic();
    return;
  }
  const total = cinematic.slides?.length || 0;
  if (state.playingSlideIndex + 1 >= total) {
    closeCinematic();
    return;
  }
  state.playingSlideIndex += 1;
  render();
}

function resetPreview() {
  stopSceneTimer();
  clearAnime2dTimer();
  anime2dActiveCinematicId = '';
  anime2dStartedAt = 0;
  sceneAnime2dActiveSceneId = '';
  sceneAnime2dStartedAt = 0;
  expiredSceneTimerKey = '';
  Object.assign(state, DEFAULT_STATE());
  state.inventoryDrawerOpen = false;
  closeEnigma();
  if (cinematicAudio) {
    cinematicAudio.pause();
    cinematicAudio = null;
  }
  responseAmbienceAudio.pause();
  responseAmbienceAudio.removeAttribute('src');
  responseAmbienceAudio.load();
  render();
}

function getStandaloneHeroGalleryIndex() {
  const choices = getHeroChoices();
  if (!choices.length) return 0;
  return ((Number(state.heroSetupGalleryIndex) || 0) % choices.length + choices.length) % choices.length;
}

function moveStandaloneHeroGallery(delta = 0) {
  const choices = getHeroChoices();
  if (choices.length < 2) return;
  state.heroSetupGalleryIndex = getStandaloneHeroGalleryIndex() + Number(delta || 0);
  render();
}

function selectStandaloneHero(heroId = '') {
  const choices = getHeroChoices();
  const selected = choices.find((hero) => hero.id === heroId) || choices[getStandaloneHeroGalleryIndex()] || choices[0];
  if (!selected) return;
  state.heroState = getInitialHeroState(selected);
  state.heroSetupSelectionConfirmed = true;
  state.lastDiceRoll = null;
  state.dialogue = (state.heroState.name || 'Héros') + ' choisi. Lance les compétences pour commencer.';
  render();
}

function changeStandaloneHeroSelection() {
  state.heroSetupSelectionConfirmed = false;
  state.heroState = getInitialHeroState(getHeroChoices()[getStandaloneHeroGalleryIndex()] || state.heroState);
  state.lastDiceRoll = null;
  render();
}

function rollStandaloneHeroSetupSkills() {
  if (!IS_HERO_ADVENTURE || state.heroSetupComplete) return;
  if (!state.heroSetupSelectionConfirmed) {
    state.dialogue = 'Choisis ton personnage avant de lancer les compétences.';
    render();
    return;
  }
  const rolls = [];
  state.heroState = {
    ...(state.heroState || getInitialHeroState()),
    skills: ((state.heroState || getInitialHeroState()).skills || []).map((skill) => {
      const rawRoll = Math.floor(Math.random() * 6) + 1;
      const baseValue = Number.isFinite(Number(skill.baseValue))
        ? Number(skill.baseValue)
        : (Number(skill.value) || 0) - (Number(skill.rolledValue) || 0);
      rolls.push(rawRoll);
      return {
        ...skill,
        baseValue,
        value: baseValue + rawRoll,
        rolledValue: rawRoll,
        rollFormula: baseValue + ' + 1d6',
      };
    }),
  };
  state.lastDiceRoll = null;
  state.dialogue = 'Compétences tirées. Tu peux commencer l’aventure.';
  render();
}

function completeStandaloneHeroSetup() {
  if (!IS_HERO_ADVENTURE) return;
  const hasRolledSkills = ((state.heroState || {}).skills || []).some((skill) => Number(skill.rolledValue) > 0);
  if (!hasRolledSkills) {
    state.dialogue = 'Lance les compétences avant de commencer.';
    render();
    return;
  }
  state.heroSetupComplete = true;
  state.dialogue = getPlayScene()?.introText || 'L’aventure commence.';
  render();
}

function clearControlsTimer() {
  if (controlsTimer) {
    clearTimeout(controlsTimer);
    controlsTimer = null;
  }
}

function revealControls(autoHide = true) {
  state.controlsVisible = true;
  clearControlsTimer();
  if (autoHide) {
    controlsTimer = setTimeout(() => {
      state.controlsVisible = false;
      render(false);
    }, 3000);
  }
  render(false);
}

function bindEvents() {
  root.querySelector('#fullscreen-toggle')?.addEventListener('click', toggleFullscreen);
  root.querySelector('#save-game')?.addEventListener('click', () => saveGame(true));
  root.querySelector('#load-game')?.addEventListener('click', () => loadGame(true));
  document.getElementById('delete-save')?.addEventListener('click', () => deleteSave(true));
  document.getElementById('export-save-json')?.addEventListener('click', exportSaveAsJson);
  document.getElementById('import-save-json')?.addEventListener('click', () => document.getElementById('import-save-file')?.click());
  document.getElementById('import-save-file')?.addEventListener('change', (event) => {
    importSaveFromJsonFile(event.target.files?.[0]);
    event.target.value = '';
  });
  document.getElementById('rename-save')?.addEventListener('click', renameCurrentSave);
  document.getElementById('clear-save')?.addEventListener('click', clearGameSave);
  root.querySelectorAll('[data-hero-select]').forEach((button) => {
    button.addEventListener('click', () => selectStandaloneHero(button.dataset.heroSelect || ''));
  });
  root.querySelectorAll('[data-hero-gallery-shift]').forEach((button) => {
    button.addEventListener('click', () => moveStandaloneHeroGallery(Number(button.dataset.heroGalleryShift) || 0));
  });
  root.querySelector('#hero-setup-change-character')?.addEventListener('click', changeStandaloneHeroSelection);
  root.querySelector('#hero-setup-roll')?.addEventListener('click', rollStandaloneHeroSetupSkills);
  root.querySelector('#hero-setup-start')?.addEventListener('click', completeStandaloneHeroSetup);
  root.querySelector('.player-shell')?.addEventListener('mousemove', (event) => {
    if (event.clientY <= 8) {
      if (!state.controlsVisible) revealControls(false);
    } else if (event.clientY > 96 && state.controlsVisible) {
      state.controlsVisible = false;
      clearControlsTimer();
      render(false);
    }
  });
  root.querySelector('#open-inventory-drawer')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = true;
    render();
  });
  root.querySelector('#close-inventory-drawer')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  });
  root.querySelector('#collapse-narration')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.narrationCollapsed = true;
    render();
  });
  root.querySelector('#open-narration')?.addEventListener('click', (event) => {
    event.stopPropagation();
    state.narrationCollapsed = false;
    render();
  });
  root.querySelector('#pause-game')?.addEventListener('click', () => {
    state.pauseOpen = true;
    render(false);
  });
  root.querySelector('#resume-game')?.addEventListener('click', () => {
    state.pauseOpen = false;
    render(false);
  });
  root.querySelector('#toggle-hints')?.addEventListener('click', () => {
    state.showInteractionHints = !state.showInteractionHints;
    render();
  });
  root.querySelector('#pause-toggle-hints')?.addEventListener('click', () => {
    state.showInteractionHints = !state.showInteractionHints;
    state.pauseOpen = false;
    render();
  });
  root.querySelector('#close-conversation')?.addEventListener('click', () => {
    closeConversation();
    render();
  });
  root.querySelector('#close-choice-effects')?.addEventListener('click', () => {
    state.choiceEffectNotices = [];
    render();
  });
  root.querySelector('#close-ending')?.addEventListener('click', () => {
    state.activeEnding = null;
    render();
  });
  root.querySelector('#restart-ending')?.addEventListener('click', resetPreview);
  root.querySelectorAll('#close-hero-combat').forEach((button) => button.addEventListener('click', closeHeroCombat));
  root.querySelectorAll('[data-hero-combat-power]').forEach((button) => {
    button.addEventListener('click', () => {
      state.selectedHeroCombatPowerId = button.dataset.heroCombatPower || '';
      render();
    });
  });
  root.querySelectorAll('[data-hero-unequip-id]').forEach((button) => {
    button.addEventListener('click', () => {
      unequipHeroItem(button.dataset.heroUnequipId || '');
      render();
    });
  });
  root.querySelectorAll('#hero-combat-action').forEach((button) => button.addEventListener('click', () => {
    if (state.activeHeroCombat?.phase === 'survival') {
      attemptSurvivalHeroCombat();
    } else if (state.activeHeroCombat?.phase === 'enemy') {
      rollActiveEnemyCombat();
    } else {
      attackActiveHeroCombat(state.selectedHeroCombatPowerId || '');
    }
  }));
  root.querySelectorAll('[data-conversation-reply]').forEach((button) => {
    button.addEventListener('click', () => {
      const node = state.activeConversation?.conversation?.nodes?.find((entry) => entry.id === state.activeConversation.nodeId);
      const reply = node?.replies?.find((entry) => entry.id === button.dataset.conversationReply);
      chooseConversationReply(reply);
      render();
    });
  });
  root.querySelector('#pause-save-game')?.addEventListener('click', () => {
    saveGame(true);
    state.pauseOpen = false;
    render(false);
  });
  root.querySelector('#pause-load-game')?.addEventListener('click', () => {
    loadGame(true);
    state.pauseOpen = false;
    render(false);
  });
  root.querySelector('#pause-reset-preview')?.addEventListener('click', resetPreview);
  root.querySelector('#inventory-drawer-backdrop')?.addEventListener('click', () => {
    state.inventoryDrawerOpen = false;
    render();
  });
  root.querySelector('#scene-layer')?.addEventListener('click', () => {
    if (state.viewerImage) {
      state.viewerImage = null;
      render();
    }
  });

  root.querySelectorAll('#reset-preview').forEach((button) => button.addEventListener('click', resetPreview));

  root.querySelectorAll('[data-hotspot-id]').forEach((button) => {
    button.addEventListener('click', (event) => {
      const scene = getPlayScene();
      const spot = scene?.hotspots?.find((entry) => entry.id === button.dataset.hotspotId);
      if (spot && !isPointerInsideElementShape(event, spot, button)) return;
      event.preventDefault();
      event.stopPropagation();
      triggerHotspot(button.dataset.hotspotId);
    });
  });

  root.querySelectorAll('[data-scene-object-id]').forEach((el) => {
    el.addEventListener('click', (event) => {
      const scene = getPlayScene();
      const obj = scene?.sceneObjects?.find((entry) => entry.id === el.dataset.sceneObjectId);
      if (obj && !isPointerInsideElementShape(event, obj, el)) return;
      event.preventDefault();
      event.stopPropagation();
      triggerSceneObject(el.dataset.sceneObjectId);
    });
  });

  root.querySelectorAll('[data-item-id]').forEach((button) => {
    button.setAttribute('draggable', 'true');

    button.addEventListener('click', () => openInventoryItem(button.dataset.itemId));
    button.addEventListener('dragstart', () => {
      state.draggedInventoryId = button.dataset.itemId;
    });
    button.addEventListener('dragend', () => {
      state.draggedInventoryId = null;
    });
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      if (state.draggedInventoryId && state.draggedInventoryId !== button.dataset.itemId) {
        combineInventoryItems(state.draggedInventoryId, button.dataset.itemId);
      }
      state.draggedInventoryId = null;
    });
  });

  root.querySelectorAll('#combine-items').forEach((button) => {
    button.addEventListener('click', () => {
      if (state.selectedInventoryIds.length !== 2) {
        state.dialogue = 'Selectionne 2 objets à combiner.';
        render();
        return;
      }
      combineInventoryItems(state.selectedInventoryIds[0], state.selectedInventoryIds[1]);
    });
  });

  root.querySelector('#close-cinematic')?.addEventListener('click', closeCinematic);
  root.querySelector('#advance-cinematic')?.addEventListener('click', advanceCinematic);
  root.querySelector('#prev-cinematic')?.addEventListener('click', () => {
    state.playingSlideIndex = Math.max(0, state.playingSlideIndex - 1);
    render();
  });

  root.querySelector('#cinematic-overlay')?.addEventListener('click', (event) => {
    if (event.target.id === 'cinematic-overlay') closeCinematic();
  });

  root.querySelector('#cinematic-video')?.addEventListener('ended', closeCinematic);

  root.querySelector('#close-enigma')?.addEventListener('click', () => {
    closeEnigma();
    render();
  });

  root.querySelector('#submit-enigma')?.addEventListener('click', submitEnigma);

  root.querySelector('#enigma-input')?.addEventListener('input', (event) => {
    state.enigmaCodeInput = event.target.value;
  });

  root.querySelector('#enigma-input')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') submitEnigma();
  });

  root.querySelectorAll('[data-code-index]').forEach((input) => {
    input.addEventListener('input', (event) => {
      const index = Number(input.dataset.codeIndex);
      const length = Number(input.dataset.codeLength) || 4;
      const chars = Array.from({ length }, (_, charIndex) => state.enigmaCodeInput[charIndex] || '');
      chars[index] = event.target.value.slice(-1).toUpperCase();
      state.enigmaCodeInput = chars.join('').trimEnd();
      render();
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submitEnigma();
    });
  });

  root.querySelectorAll('[data-code-key]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.codeKey;
      const length = Number(button.dataset.codeLength) || 4;
      if (key === '?' || key === '?') {
        state.enigmaCodeInput = state.enigmaCodeInput.slice(0, -1);
      } else {
        state.enigmaCodeInput = (state.enigmaCodeInput + key).slice(0, length);
      }
      render();
    });
  });

  root.querySelector('#clear-code')?.addEventListener('click', () => {
    state.enigmaCodeInput = '';
    render();
  });

  root.querySelectorAll('[data-misc-choice]').forEach((button) => {
    button.addEventListener('click', () => {
      state.enigmaCodeInput = button.dataset.miscChoice || '';
      render();
    });
  });

  root.querySelectorAll('[data-misc-order]').forEach((button) => {
    button.addEventListener('click', () => {
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify([...current, button.dataset.miscOrder || '']);
      render();
    });
  });

  root.querySelectorAll('[data-misc-order-remove]').forEach((button) => {
    button.addEventListener('click', () => {
      const removeIndex = Number(button.dataset.miscOrderRemove);
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify(current.filter((_, index) => index !== removeIndex));
      render();
    });
  });

  root.querySelectorAll('[data-misc-match-left]').forEach((select) => {
    select.addEventListener('change', () => {
      const current = parseJsonValue(state.enigmaCodeInput, {});
      state.enigmaCodeInput = JSON.stringify({ ...current, [select.dataset.miscMatchLeft]: select.value });
      render();
    });
  });

  root.querySelectorAll('[data-misc-toggle]').forEach((button) => {
    button.addEventListener('click', () => {
      const choice = button.dataset.miscToggle || '';
      const current = parseJsonValue(state.enigmaCodeInput, []);
      state.enigmaCodeInput = JSON.stringify(current.includes(choice) ?
         current.filter((entry) => entry !== choice)
        : [...current, choice]);
      render();
    });
  });

  root.querySelector('#clear-colors')?.addEventListener('click', () => {
    state.enigmaColorAttempt = [];
    render();
  });

  root.querySelectorAll('[data-enigma-color]').forEach((button) => {
    button.addEventListener('click', () => pushEnigmaColor(button.dataset.enigmaColor));
  });

  root.querySelectorAll('[data-puzzle-index]').forEach((button) => {
    button.addEventListener('click', () => clickPuzzlePiece(Number(button.dataset.puzzleIndex)));
  });

  root.querySelectorAll('[data-rotation-index]').forEach((button) => {
    button.addEventListener('click', () => rotatePuzzlePiece(Number(button.dataset.rotationIndex)));
  });

  root.querySelectorAll('[data-simon-color]').forEach((button) => {
    button.addEventListener('click', () => {
      if (!state.simonPlayerTurn) return;
      pushEnigmaColor(button.dataset.simonColor);
    });
  });

  root.querySelector('#replay-simon')?.addEventListener('click', () => {
    if (state.activeEnigma?.enigma) startSimonPlayback(state.activeEnigma.enigma);
  });

  root.querySelectorAll('[data-slot-index]').forEach((button) => {
    button.addEventListener('click', () => returnDragPieceToBank(Number(button.dataset.slotIndex)));
    button.addEventListener('dragover', (event) => event.preventDefault());
    button.addEventListener('drop', (event) => {
      event.preventDefault();
      moveDragPieceToSlot(state.enigmaDraggedPiece, Number(button.dataset.slotIndex));
      state.enigmaDraggedPiece = null;
    });
  });

  root.querySelectorAll('[data-bank-piece]').forEach((button) => {
    button.setAttribute('draggable', 'true');
    button.addEventListener('dragstart', () => {
      state.enigmaDraggedPiece = Number(button.dataset.bankPiece);
    });
    button.addEventListener('dragend', () => {
      state.enigmaDraggedPiece = null;
    });
  });
}

${standaloneCinematicRender}${standaloneEnigmaRender}${standaloneConversationRender}${standaloneRender}
if (!loadGame(false)) {
  render(false);
}
</script>
</body>
</html>`;
}

export function buildStandaloneModuleFiles(project) {
  const html = buildStandaloneHtml(project);
  const scriptStart = html.indexOf('<script>');
  const scriptEnd = html.lastIndexOf('</script>');

  if (scriptStart < 0 || scriptEnd < scriptStart) {
    return {
      indexHtml: html,
      engineJs: '',
    };
  }

  const scriptOpenEnd = scriptStart + '<script>'.length;
  const engineJs = `${html.slice(scriptOpenEnd, scriptEnd).trim()}\n`;
  const indexHtml = `${html.slice(0, scriptStart)}<script src="./engine.js"></script>${html.slice(scriptEnd + '</script>'.length)}`;

  return {
    indexHtml,
    engineJs,
  };
}
