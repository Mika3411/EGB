import {
  getCombatSimulationStats,
  getPowerTypeLabel as getCombatPowerTypeLabel,
  addStatusEffect,
  getStatusEffectLabel,
  resolveCombatInitiative,
  resolveCombatVictoryReward,
  resolveEnemyCombatAttack,
  resolveHeroCombatAttack,
  resolveRollOutcome,
  rollDie,
  tickStatusEffects,
} from '../../lib/combatEngine.js';
import {
  COMBAT_EFFECT_MEDIA_TYPES,
  COMBAT_VISUAL_EFFECT_TYPES,
  DEFAULT_COMBAT_SETTINGS,
  getCombatEffectFieldBase,
} from '../../lib/combatDefaults.js';
import {
  clampNumber,
  normalizeHeroAdventure,
} from './previewPlayerDefaults.js';
export function createPreviewHeroCombatActions({
  project,
  heroAdventure,
  heroState,
  heroCombatStates,
  activeHeroCombat,
  playSceneId,
  playScene,
  askedConversationNodeIds,
  engineRef,
  getItemById,
  rollHeroDie,
  applyHeroHealthLoss,
  addInventoryItem,
  markHotspotCompleted,
  goToScene,
  closeConversation,
  blockDefeatedHeroAction,
  captureLastChoiceSnapshot,
  initializeFromProject,
  setters,
}) {
  const {
    setPlaySceneId,
    setHeroState,
    setHeroSetupComplete,
    setLastDiceRoll,
    setHeroCombatStates,
    setActiveHeroCombat,
    setAskedConversationNodeIds,
    setActiveConversation,
    setViewerImage,
    setPlayingCinematic,
    setActiveEnigma,
    setDialogue,
  } = setters;
  const setHeroCombatState = (combatId, nextCombatState) => {
    if (!combatId) return {};
    const currentStates = engineRef.current.getState().heroCombatStates || heroCombatStates || {};
    const nextStates = {
      ...currentStates,
      [combatId]: {
        ...(currentStates[combatId] || {}),
        ...nextCombatState,
      },
    };
    engineRef.current.setState({ heroCombatStates: nextStates });
    setHeroCombatStates(nextStates);
    return nextStates[combatId];
  };
  const buildHeroCombatHistory = (current = {}, nextMessage = '') => {
    const cleanMessage = String(nextMessage || '').replace(/\s+/g, ' ').trim();
    const existingHistory = Array.isArray(current.history)
      ? current.history
      : current.message
      ? [current.message]
      : [];
    const history = existingHistory
      .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    if (cleanMessage && history[history.length - 1] !== cleanMessage) history.push(cleanMessage);
    return history.slice(-8);
  };
  const runSkillCheckAction = (entry = {}, options = {}) => {
    if (blockDefeatedHeroAction()) return false;
    if (!heroAdventure.enabled) {
      setDialogue('Active le mode Hero Adventure pour utiliser un test de compétence.');
      return false;
    }
    const skillId = entry.skillCheckSkillId || heroState.skills?.[0]?.id || '';
    const difficulty = Math.max(1, Number(entry.skillCheckDifficulty) || 10);
    const roll = rollHeroDie(skillId, {
      silent: true,
      manaCost: Math.max(0, Number(entry.skillCheckManaCost) || 0),
    });
    if (!roll) return false;
    const sides = Math.max(2, Number(roll.sides) || Number(heroAdventure.dice?.sides) || 20);
    const activeRules = (engineRef.current.getState().heroState || heroState)?.rules || heroAdventure.rules || {};
    const outcomeRoll = {
      ...roll,
      ...resolveRollOutcome({
        raw: roll.raw,
        modifier: roll.modifier,
        difficulty,
        criticalSuccess: clampNumber(Number(activeRules.criticalSuccess) || sides, 1, sides),
        criticalFailure: clampNumber(Number(activeRules.criticalFailure) || 1, 1, sides),
      }),
      actionType: 'skill_check',
    };
    const success = outcomeRoll.success;
    setLastDiceRoll(outcomeRoll);
    engineRef.current.setState({ lastDiceRoll: outcomeRoll });
    const outcome = success ? 'Success' : 'Failure';
    const outcomeLabel = outcomeRoll.isCriticalSuccess ? 'Réussite critique' : outcomeRoll.isCriticalFailure ? 'Échec critique' : success ? 'Réussite' : 'Échec';
    const outcomeDialogue = entry[`skillCheck${outcome}Dialogue`] || (success ? 'Test réussi.' : 'Test raté.');
    const targetSceneId = entry[`skillCheck${outcome}TargetSceneId`] || '';
    const nextNodeId = entry[`skillCheck${outcome}NextNodeId`] || '';
    const resultMessage = `${roll.skillName ? `${roll.skillName}: ` : ''}${roll.die} = ${roll.raw}${roll.modifier ? ` + ${roll.modifier}` : ''} => ${roll.total}. ${outcomeLabel} contre ${difficulty}. ${outcomeDialogue}`.trim();
    if (!success) applyHeroHealthLoss(entry.skillCheckFailureHealthLoss);
    if (success && entry.skillCheckSuccessRewardItemId) addInventoryItem(entry.skillCheckSuccessRewardItemId);
    if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
    if (targetSceneId) {
      if (options.closeConversation) closeConversation();
      return goToScene(targetSceneId, resultMessage);
    }
    if (options.conversation && nextNodeId) {
      const nextNode = (options.conversation.nodes || []).find((node) => node.id === nextNodeId);
      if (nextNode) {
        if (nextNode.askOnce && askedConversationNodeIds.includes(nextNode.id)) {
          setDialogue(resultMessage || 'Cette question a déjà été posée.');
          if (options.closeConversation) closeConversation();
          return true;
        }
        setAskedConversationNodeIds((prev) => (prev.includes(nextNode.id) ? prev : [...prev, nextNode.id]));
        setActiveConversation((current) => ({ ...current, nodeId: nextNode.id }));
        setDialogue(resultMessage);
        return true;
      }
    }
    setDialogue(resultMessage);
    if (options.closeConversation && !nextNodeId) closeConversation();
    return true;
  };
  const getPreviewCombatStats = (entry = {}) => (
    getCombatSimulationStats({
      ...project,
      heroAdventure: {
        ...(project.heroAdventure || {}),
        ...heroAdventure,
        hero: engineRef.current.getState().heroState || heroState,
        rules: (engineRef.current.getState().heroState || heroState)?.rules || heroAdventure.rules,
      },
    }, entry, heroAdventure.combat || DEFAULT_COMBAT_SETTINGS)
  );
  const getPowerTypeLabel = (type) => getCombatPowerTypeLabel(type).toLowerCase();
  const getHeroPowerById = (powerId = '') => (
    ((engineRef.current.getState().heroState || heroState).powers || []).find((power) => power.id === powerId) || null
  );
  const getHeroSkillByKey = (key = '') => {
    const normalizedKey = String(key || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const skills = (engineRef.current.getState().heroState || heroState).skills || [];
    return skills.find((skill) => {
      const id = String(skill.id || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
      const name = String(skill.name || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
        .toLowerCase();
      return id === normalizedKey || name === normalizedKey;
    }) || null;
  };
  const createHeroCombatSurvivalRoll = (enemyStats = {}, rawRoll) => {
    const survivalSkill = getHeroSkillByKey('survie') || getHeroSkillByKey('survival');
    const modifier = Math.max(0, Number(survivalSkill?.value) || 0);
    const chaos = Math.max(1, Number(enemyStats?.chaos) || DEFAULT_COMBAT_SETTINGS.enemyChaos || 10);
    const sides = Math.max(2, Number(heroAdventure?.dice?.sides) || 20);
    const raw = rollDie({ sides, raw: rawRoll });
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
  };
  const resolveHeroCombatSurvival = (entry = {}, options = {}) => {
    const runtime = getHeroCombatRuntime(entry, options);
    const combatState = (engineRef.current.getState().heroCombatStates || heroCombatStates || {})[runtime.combatId] || {};
    if (combatState.survivalUsed) {
      return null;
    }
    const roll = createHeroCombatSurvivalRoll(runtime.enemyStats, options.rawRoll);
    setLastDiceRoll(roll);
    engineRef.current.setState({ lastDiceRoll: roll });
    if (roll.success) {
      const currentHero = engineRef.current.getState().heroState || heroState;
      const nextHero = { ...currentHero, health: 1 };
      engineRef.current.setState({ heroState: nextHero, lastDiceRoll: roll });
      setHeroState(nextHero);
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
      const message = `${roll.skillName}: ${roll.raw} + ${roll.modifier} = ${roll.total} contre chaos ${roll.difficulty}. Le héros se relève avec 1 PV.`;
      setDialogue(message);
      return {
        ok: true,
        survived: true,
        ended: false,
        enemyHealth: runtime.currentEnemyHealth,
        enemyMaxHealth: runtime.enemyMaxHealth,
        enemyMana: runtime.currentEnemyMana,
        enemyMaxMana: runtime.enemyMaxMana,
        message,
        roll,
      };
    }
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
    const endText = entry.combatEndDialogue ? ` ${entry.combatEndDialogue}` : '';
    const defeatText = ` ${entry.combatDefeatDialogue || 'Défaite.'}`;
    const message = `${roll.skillName}: ${roll.raw} + ${roll.modifier} = ${roll.total} contre chaos ${roll.difficulty}. Le héros meurt.${endText}${defeatText}`.trim();
    setDialogue(message);
    return {
      ok: true,
      survived: false,
      ended: true,
      defeat: true,
      pendingSceneId: entry.combatDefeatTargetSceneId || '',
      pendingSceneMessage: message,
      enemyHealth: runtime.currentEnemyHealth,
      enemyMaxHealth: runtime.enemyMaxHealth,
      enemyMana: runtime.currentEnemyMana,
      enemyMaxMana: runtime.enemyMaxMana,
      message,
      roll,
    };
  };
  const buildHeroCombatSurvivalPending = (entry = {}, runtime = {}, reasonMessage = '') => {
    const combatState = (engineRef.current.getState().heroCombatStates || heroCombatStates || {})[runtime.combatId] || {};
    if (combatState.survivalUsed) return null;
    const survivalSkill = getHeroSkillByKey('survie') || getHeroSkillByKey('survival');
    const chaos = Math.max(1, Number(runtime.enemyStats?.chaos) || DEFAULT_COMBAT_SETTINGS.enemyChaos || 10);
    const message = `${reasonMessage} Lance Survie (${survivalSkill?.value || 0}) contre chaos ${chaos}.`.trim();
    return {
      ok: true,
      ended: false,
      survivalPending: true,
      enemyHealth: runtime.currentEnemyHealth,
      enemyMaxHealth: runtime.enemyMaxHealth,
      enemyMana: runtime.currentEnemyMana,
      enemyMaxMana: runtime.enemyMaxMana,
      message,
    };
  };
  const getCombatEffectMedia = (target, outcome) => {
    const combatSettings = heroAdventure.combat || {};
    const base = getCombatEffectFieldBase(target, outcome);
    const mediaType = COMBAT_EFFECT_MEDIA_TYPES.has(combatSettings[`${base}MediaType`])
      ? combatSettings[`${base}MediaType`]
      : 'none';
    const visualEffect = COMBAT_VISUAL_EFFECT_TYPES.has(combatSettings[`${base}VisualEffect`])
      ? combatSettings[`${base}VisualEffect`]
      : 'none';
    const audioData = combatSettings[`${base}AudioData`] || '';
    const audioName = combatSettings[`${base}AudioName`] || '';
    const withAudio = (media) => (audioData ? { ...media, audioData, audioName } : media);
    if (mediaType === 'image' && combatSettings[`${base}ImageData`]) {
      return withAudio({
        mediaType,
        imageData: combatSettings[`${base}ImageData`],
        name: combatSettings[`${base}ImageName`] || '',
      });
    }
    if (mediaType === 'anime2d' && combatSettings[`${base}Anime2dSpec`]) {
      return withAudio({
        mediaType,
        anime2dSpec: combatSettings[`${base}Anime2dSpec`],
        name: combatSettings[`${base}Anime2dName`] || '',
      });
    }
    if (mediaType === 'video' && combatSettings[`${base}VideoData`]) {
      return withAudio({
        mediaType,
        videoData: combatSettings[`${base}VideoData`],
        name: combatSettings[`${base}VideoName`] || '',
      });
    }
    if (mediaType === 'visual' && visualEffect !== 'none') {
      return withAudio({
        mediaType,
        visualEffect,
      });
    }
    if (audioData) return { mediaType: 'none', audioData, audioName };
    return null;
  };
  const makeCombatVisualEffect = (target, type, text, media = null) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    target,
    type,
    text,
    media,
  });
  const makeCombatOutcomeEffect = (target, outcome, text) => (
    makeCombatVisualEffect(
      target,
      outcome === 'death' ? 'death' : 'damage',
      text,
      getCombatEffectMedia(target, outcome)
    )
  );
  const rollEnemyCombatDie = (enemyName = 'Ennemi', rawRoll) => {
    const sides = Math.max(2, Number(heroAdventure.dice?.sides) || 20);
    const forcedRaw = Number(rawRoll);
    const raw = Number.isFinite(forcedRaw)
      ? clampNumber(Math.round(forcedRaw), 1, sides)
      : Math.floor(Math.random() * sides) + 1;
    return {
      id: Date.now(),
      die: heroAdventure.dice?.label || `d${sides}`,
      sides,
      raw,
      modifier: 0,
      total: raw,
      actionType: 'enemy_combat',
      enemyName,
    };
  };
  const buildEnemyCombatAction = (stats, currentEnemyMana, enemyName, options = {}) => {
    const enemyStats = stats.enemyStats;
    const enemyRoll = rollEnemyCombatDie(enemyName, options.rawRoll);
    const currentHero = engineRef.current.getState().heroState || heroState;
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
      ? `${enemyName} utilise ${enemyStats.powerName} (${getPowerTypeLabel(enemyStats.powerType)}).`
      : `${enemyName} riposte.`;
    enemyRoll.damage = enemyAttack.damage;
    enemyRoll.damageTarget = 'hero';
    enemyRoll.damageBlocked = enemyAttack.armorBlocked + enemyAttack.shieldBlocked;
    enemyRoll.dodged = enemyAttack.dodged;
    enemyRoll.critical = enemyAttack.critical;
    enemyRoll.criticalPierced = enemyAttack.criticalPierced;
    const criticalText = enemyAttack.critical ? ` Coup critique x${enemyAttack.criticalMultiplier}.` : '';
    const heroResistanceText = enemyAttack.resistance ? ` Résistance du héros: dégâts réduits.` : '';
    const heroDodgeText = enemyAttack.dodged ? ` Le héros esquive.` : '';
    const heroArmorText = enemyAttack.armorBlocked ? ` Armure héros -${enemyAttack.armorBlocked}.` : '';
    const heroShieldText = enemyAttack.shieldBlocked ? ` Bouclier -${enemyAttack.shieldBlocked}.` : '';
    const criticalPierceText = enemyAttack.criticalPierced ? ` Percée critique: 1 PV traverse la défense.` : '';
    const manaText = enemyAttack.usesPower ? ` Mana ${enemyAttack.enemyMana}/${enemyStats.maxMana}.` : '';
    const damageText = enemyAttack.damage > 0
      ? ` Le héros perd ${enemyAttack.damage} PV.`
      : ` Le héros ne perd pas de PV.`;
    const damageFormulaText = ` Dégâts: force ${enemyAttack.forceDamage} + dé ${enemyAttack.dieDamageBonus} (${enemyAttack.dieDamagePercent}%) = ${enemyAttack.baseDamage}.`;
    const attackText = `Jet ennemi: ${enemyRoll.raw}. ${enemyActionText}${damageFormulaText}${damageText}${criticalText}${heroResistanceText}${heroDodgeText}${heroArmorText}${heroShieldText}${criticalPierceText}${manaText}`;
    const visualEffects = [
      enemyAttack.usesPower && enemyStats.powerManaCost > 0 ? makeCombatVisualEffect('enemy', 'mana', `-${enemyStats.powerManaCost} Mana`) : null,
      enemyAttack.critical ? makeCombatVisualEffect('hero', 'critical', `CRITIQUE x${enemyAttack.criticalMultiplier}`) : null,
    ].filter(Boolean);
    return {
      enemyRoll,
      nextEnemyMana: enemyAttack.enemyMana,
      enemyDamage: enemyAttack.damage,
      heroStatusEffects: enemyAttack.heroStatusEffects || [],
      retaliationText: attackText,
      visualEffects,
    };
  };
  const getHeroCombatRuntime = (entry = {}, options = {}) => {
    const combatId = entry.id || options.sourceHotspotId || `${playSceneId}-combat`;
    const stats = getPreviewCombatStats(entry);
    const enemyName = stats.enemyName;
    const enemyMaxHealth = stats.enemyMaxHealth;
    const enemyStats = stats.enemyStats;
    const currentCombat = (engineRef.current.getState().heroCombatStates || heroCombatStates || {})[combatId] || {};
    const currentEnemyHealth = currentCombat.defeated
      ? 0
      : clampNumber(currentCombat.enemyHealth ?? enemyMaxHealth, 0, enemyMaxHealth);
    const currentEnemyMana = clampNumber(currentCombat.enemyMana ?? enemyStats.maxMana, 0, enemyStats.maxMana);
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
  };
  const finishAlreadyDefeatedHeroCombat = (entry = {}, options = {}, runtime = getHeroCombatRuntime(entry, options)) => {
    const message = [
      `${runtime.enemyName} est déjà vaincu.`,
      entry.combatVictoryDialogue,
    ].filter(Boolean).join(' ');
    if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
    setActiveHeroCombat(null);
    if (options.closeConversation) closeConversation();
    if (entry.combatVictoryTargetSceneId) {
      const movedScene = goToScene(entry.combatVictoryTargetSceneId, message || 'La route est ouverte.');
      return {
        ok: Boolean(movedScene),
        ended: true,
        victory: true,
        movedScene: Boolean(movedScene),
        enemyHealth: 0,
        enemyMaxHealth: runtime.enemyMaxHealth,
        enemyMana: runtime.currentEnemyMana,
        enemyMaxMana: runtime.enemyMaxMana,
        message,
      };
    }
    setDialogue(message);
    return {
      ok: true,
      ended: true,
      victory: true,
      enemyHealth: 0,
      enemyMaxHealth: runtime.enemyMaxHealth,
      enemyMana: runtime.currentEnemyMana,
      enemyMaxMana: runtime.enemyMaxMana,
      message,
    };
  };
  const resolveEnemyCombatTurn = (entry = {}, options = {}) => {
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
    } = getHeroCombatRuntime(entry, options);
    if (currentEnemyHealth <= 0) {
      return finishAlreadyDefeatedHeroCombat(entry, options, {
        enemyName,
        enemyMaxHealth,
        currentEnemyMana,
        enemyMaxMana: enemyStats.maxMana,
      });
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
      const message = `${enemyName} subit ${enemyTick.damage} PV d'altération. ${entry.combatVictoryDialogue || 'Victoire.'}`.trim();
      setDialogue(message);
      return { ok: true, ended: true, victory: true, enemyHealth: 0, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana: enemyStats.maxMana, message };
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
      const message = `${enemyName} est étourdi et perd son action.`;
      setDialogue(message);
      return { ok: true, ended: false, enemyHealth: enemyTick.health, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana: enemyStats.maxMana, message };
    }
    const enemyAction = buildEnemyCombatAction(stats, currentEnemyMana, enemyName, {
      ...options,
      heroStatusEffects: currentHeroStatusEffects,
      enemyStatusEffects: enemyTick.effects,
      enemyHealth: enemyTick.health,
    });
    setLastDiceRoll(enemyAction.enemyRoll);
    engineRef.current.setState({ lastDiceRoll: enemyAction.enemyRoll });
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
        ? makeCombatOutcomeEffect('hero', defeat ? 'death' : 'hit', defeat ? 'KO' : `-${enemyAction.enemyDamage} PV`)
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
    }, `${enemyAction.retaliationText} Le héros tombe à 0 PV.`) : null;
    if (survivalPending) {
      setDialogue(survivalPending.message);
      return {
        ...survivalPending,
        enemyRoll: enemyAction.enemyRoll,
        visualEffects: [
          ...visualEffects,
          makeCombatOutcomeEffect('hero', 'hit', '0 PV'),
        ].filter(Boolean),
      };
    }
    const endText = defeat ? ` ${entry.combatEndDialogue || ''}` : '';
    const defeatText = defeat ? ` ${entry.combatDefeatDialogue || 'Défaite.'}` : '';
    const statusPrefix = enemyTick.damage > 0 ? `${enemyName} subit ${enemyTick.damage} PV d'altération. ` : '';
    const message = `${statusPrefix}${enemyAction.retaliationText}${endText}${defeatText}`.trim();
    if (defeat && entry.combatDefeatTargetSceneId) {
      const finalMessage = `${statusPrefix}${enemyAction.retaliationText}${endText}${defeatText}`.trim();
      setDialogue(finalMessage);
      return {
        ok: true,
        ended: true,
        defeat: true,
        pendingSceneId: entry.combatDefeatTargetSceneId,
        pendingSceneMessage: finalMessage,
        enemyHealth: enemyTick.health,
        enemyMaxHealth,
        enemyMana: enemyAction.nextEnemyMana,
        enemyMaxMana: enemyStats.maxMana,
        message: finalMessage,
        roll: enemyAction.enemyRoll,
        enemyRoll: enemyAction.enemyRoll,
        visualEffects,
      };
    }
    setDialogue(message);
    return {
      ok: true,
      ended: defeat,
      defeat,
      enemyHealth: enemyTick.health,
      enemyMaxHealth,
      enemyMana: enemyAction.nextEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      message,
      roll: enemyAction.enemyRoll,
      enemyRoll: enemyAction.enemyRoll,
      visualEffects,
    };
  };
  const resolveHeroCombatTurn = (entry = {}, options = {}) => {
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
    } = getHeroCombatRuntime(entry, options);
    if (currentEnemyHealth <= 0) {
      return finishAlreadyDefeatedHeroCombat(entry, options, {
        enemyName,
        enemyMaxHealth,
        currentEnemyMana,
        enemyMaxMana,
      });
    }
    const heroPower = getHeroPowerById(options.heroPowerId);
    const skillId = entry.combatSkillId || heroState.skills?.[0]?.id || '';
    const currentHero = engineRef.current.getState().heroState || heroState;
    const heroTick = tickStatusEffects(currentHeroStatusEffects, Number(currentHero.health) || 0);
    const heroAfterStatus = { ...currentHero, health: heroTick.health };
    if (heroTick.damage > 0 || heroTick.stunned) {
      setHeroState(heroAfterStatus);
      engineRef.current.setState({ heroState: heroAfterStatus });
    }
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
      }, `Le héros subit ${heroTick.damage} PV d'altération et tombe à 0 PV.`);
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
        setDialogue(survivalPending.message);
        return survivalPending;
      }
      const message = `Le héros subit ${heroTick.damage} PV d'altération. ${entry.combatDefeatDialogue || 'Défaite.'}`.trim();
      setHeroCombatState(combatId, {
        enemyHealth: currentEnemyHealth,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana,
        heroStatusEffects: heroTick.effects,
        enemyStatusEffects: currentEnemyStatusEffects,
        defeated: false,
      });
      setDialogue(message);
      return { ok: true, ended: true, defeat: true, enemyHealth: currentEnemyHealth, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana, message };
    }
    if (heroTick.stunned) {
      const message = `Le héros est étourdi et perd son action.`;
      setHeroCombatState(combatId, {
        enemyHealth: currentEnemyHealth,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana,
        heroStatusEffects: heroTick.effects,
        enemyStatusEffects: currentEnemyStatusEffects,
        defeated: false,
      });
      setDialogue(message);
      return { ok: true, ended: false, pendingEnemyTurn: true, enemyHealth: currentEnemyHealth, enemyMaxHealth, enemyMana: currentEnemyMana, enemyMaxMana, message };
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
      setDialogue(`Mana insuffisante pour ${heroPower?.name || stats.skillName || 'cette attaque'}.`);
      return { ok: false };
    }
    const roll = {
      id: Date.now(),
      die: stats.diceLabel,
      sides: stats.diceSides,
      raw: heroAttack.roll.raw,
      modifier: heroAttack.roll.modifier,
      total: heroAttack.roll.total,
      skillId,
      skillName: stats.skillName,
      isCriticalSuccess: heroAttack.roll.isCriticalSuccess,
      isCriticalFailure: heroAttack.roll.isCriticalFailure,
    };
    const outcomeRoll = {
      ...roll,
      success: heroAttack.roll.success,
      difficulty: stats.difficulty,
      actionType: 'hero_combat',
      heroPowerId: heroPower?.id || '',
      heroPowerName: heroPower?.name || '',
      heroForceDamage: stats.heroForce,
      heroDieDamageBonus: heroAttack.heroDieDamageBonus,
      heroDieDamagePercent: heroAttack.heroDieDamagePercent,
      heroPowerDamage: heroAttack.powerDamage,
      heroCritical: heroAttack.critical,
      heroCriticalChance: stats.heroCriticalChance,
      heroRandomCritical: heroAttack.randomCritical,
      heroCriticalMultiplier: heroAttack.criticalMultiplier,
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
    const nextHeroAfterMana = { ...heroAfterStatus, health: heroAttack.heroHealth, mana: heroAttack.mana };
    setHeroState(nextHeroAfterMana);
    setLastDiceRoll(outcomeRoll);
    engineRef.current.setState({ heroState: nextHeroAfterMana, lastDiceRoll: outcomeRoll });
    const hit = heroAttack.roll.success;
    const difficulty = stats.difficulty;
    const heroCritical = heroAttack.critical;
    const heroCriticalMultiplier = heroAttack.criticalMultiplier;
    const heroAttackType = heroAttack.attackType;
    const enemyResistance = heroAttack.resistance;
    const heroDamage = heroAttack.damage;
    const nextEnemyHealth = heroAttack.enemyHealth;
    const rollDetail = roll.modifier ? `dé ${roll.raw} + ${roll.modifier}` : `dé ${roll.raw}`;
    const rollText = `${roll.skillName || 'Action'} ${hit ? 'réussie' : 'échouée'}: ${roll.total} contre ${difficulty} (${rollDetail}).`;
    const heroPowerText = heroPower ? `${heroPower.name} est utilisé. ` : '';
    const heroCriticalText = heroCritical ? ` Coup critique x${heroCriticalMultiplier}.` : '';
    const heroPowerDamageText = heroAttack.powerDamage ? ` + pouvoir ${heroAttack.powerDamage}` : '';
    const heroDamageFormulaText = hit ? ` Dégâts: force ${stats.heroForce} + dé ${heroAttack.heroDieDamageBonus} (${heroAttack.heroDieDamagePercent}%)${heroPowerDamageText} = ${heroAttack.baseDamage}.` : '';
    const resistanceText = hit && enemyResistance
      ? ` Résistance ${getPowerTypeLabel(heroAttackType)}: dégâts réduits.`
      : '';
    const dodgeText = hit && heroAttack.dodged
      ? ` Esquive: l'attaque ne blesse pas.`
      : '';
    const armorText = hit && heroAttack.armorBlocked
      ? ` Armure -${heroAttack.armorBlocked}.`
      : '';
    const shieldText = hit && heroAttack.shieldBlocked
      ? ` Bouclier -${heroAttack.shieldBlocked}.`
      : '';
    const criticalPierceText = heroAttack.criticalPierced ? ` Percée critique: 1 PV traverse la défense.` : '';
    const recoveryText = heroAttack.recovery.healthRecovered || heroAttack.recovery.manaRecovered
      ? ` Soin: +${heroAttack.recovery.healthRecovered} PV, +${heroAttack.recovery.manaRecovered} mana.`
      : '';
    const statusText = heroAttack.appliedStatusEffect
      ? ` ${getStatusEffectLabel(heroAttack.appliedStatusEffect.type)} appliqué (${heroAttack.appliedStatusEffect.duration} tour(s)).`
      : '';
    const heroManaSpent = heroAttack.manaSpent;
    const heroVisualEffects = [
      heroManaSpent > 0 ? makeCombatVisualEffect('hero', 'mana', `-${heroManaSpent} Mana`) : null,
      hit && heroDamage > 0
        ? makeCombatOutcomeEffect('enemy', nextEnemyHealth <= 0 ? 'death' : 'hit', nextEnemyHealth <= 0 ? 'KO' : `-${heroDamage} PV`)
        : null,
      heroCritical ? makeCombatVisualEffect('enemy', 'critical', `CRITIQUE x${heroCriticalMultiplier}`) : null,
    ].filter(Boolean);

    if (nextEnemyHealth <= 0) {
      setHeroCombatState(combatId, {
        enemyHealth: 0,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana,
        heroStatusEffects: nextHeroStatusEffects,
        enemyStatusEffects: nextEnemyStatusEffects,
        defeated: true,
      });
      const reward = resolveCombatVictoryReward(entry, project.items, getItemById);
      if (reward.itemId) addInventoryItem(reward.itemId);
      if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
      const endText = entry.combatEndDialogue ? ` ${entry.combatEndDialogue}` : '';
      const victoryAttackText = `${heroPowerText}${enemyName} perd ${heroDamage} PV.${heroDamageFormulaText}${heroCriticalText}${resistanceText}${dodgeText}${armorText}${shieldText}${criticalPierceText}${recoveryText}${statusText}`;
      const victoryMessage = `${rollText} ${victoryAttackText} ${enemyName} est vaincu.${endText} ${entry.combatVictoryDialogue || 'Victoire.'}${reward.message}`.trim();
      if (entry.combatVictoryTargetSceneId) {
        setDialogue(victoryMessage);
        return {
          ok: true,
          ended: true,
          victory: true,
          pendingSceneId: entry.combatVictoryTargetSceneId,
          pendingSceneMessage: victoryMessage,
          enemyHealth: 0,
          enemyMaxHealth,
          enemyMana: currentEnemyMana,
          enemyMaxMana,
          message: victoryMessage,
          roll: outcomeRoll,
          visualEffects: heroVisualEffects,
        };
      }
      setDialogue(victoryMessage);
      return {
        ok: true,
        ended: true,
        victory: true,
        enemyHealth: 0,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana,
        message: victoryMessage,
        roll: outcomeRoll,
        visualEffects: heroVisualEffects,
      };
    }

    const attackText = hit
      ? `${heroPowerText}${enemyName} perd ${heroDamage} PV.${heroDamageFormulaText}${heroCriticalText}${resistanceText}${dodgeText}${armorText}${shieldText}${criticalPierceText}${recoveryText}${statusText}`
      : `${heroPowerText}Aucun dégât.${recoveryText}${statusText}`;
    const healthText = ` Il lui reste ${nextEnemyHealth}/${enemyMaxHealth} PV.`;
    if (options.allowManualEnemyTurn) {
      setHeroCombatState(combatId, {
        enemyHealth: nextEnemyHealth,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana: enemyStats.maxMana,
        heroStatusEffects: nextHeroStatusEffects,
        enemyStatusEffects: nextEnemyStatusEffects,
        defeated: false,
      });
      const message = `${rollText} ${attackText}${healthText} À l'ennemi de riposter.`.trim();
      setDialogue(message);
      return {
        ok: true,
        ended: false,
        pendingEnemyTurn: true,
        enemyHealth: nextEnemyHealth,
        enemyMaxHealth,
        enemyMana: currentEnemyMana,
        enemyMaxMana: enemyStats.maxMana,
        message,
        roll: outcomeRoll,
        visualEffects: heroVisualEffects,
      };
    }

    const enemyAction = buildEnemyCombatAction(stats, currentEnemyMana, enemyName, {
      heroStatusEffects: nextHeroStatusEffects,
      enemyStatusEffects: nextEnemyStatusEffects,
      enemyHealth: nextEnemyHealth,
    });
    setLastDiceRoll(enemyAction.enemyRoll);
    engineRef.current.setState({ lastDiceRoll: enemyAction.enemyRoll });
    setHeroCombatState(combatId, {
      enemyHealth: nextEnemyHealth,
      enemyMaxHealth,
      enemyMana: enemyAction.nextEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      heroStatusEffects: enemyAction.heroStatusEffects,
      enemyStatusEffects: nextEnemyStatusEffects,
      defeated: false,
    });
    const nextHero = applyHeroHealthLoss(enemyAction.enemyDamage, { triggerDefeatScene: false });
    const defeat = Number(nextHero.health || 0) <= 0;
    const enemyRetaliationVisualEffects = [
      ...enemyAction.visualEffects,
      enemyAction.enemyDamage > 0
        ? makeCombatOutcomeEffect('hero', defeat ? 'death' : 'hit', defeat ? 'KO' : `-${enemyAction.enemyDamage} PV`)
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
    }, `${enemyAction.retaliationText} Le héros tombe à 0 PV.`) : null;
    if (survivalPending) {
      setDialogue(survivalPending.message);
      return {
        ...survivalPending,
        roll: outcomeRoll,
        enemyRoll: enemyAction.enemyRoll,
        visualEffects: [
          ...heroVisualEffects,
          ...enemyRetaliationVisualEffects,
        ].filter(Boolean),
      };
    }
    const endText = defeat ? ` ${entry.combatEndDialogue || ''}` : '';
    const defeatText = defeat ? ` ${entry.combatDefeatDialogue || 'Défaite.'}` : '';
    const message = `${rollText} ${attackText}${healthText} ${enemyAction.retaliationText}${endText}${defeatText}`.trim();

    if (defeat && entry.combatDefeatTargetSceneId) {
      const finalMessage = `${rollText} ${attackText}${healthText} ${enemyAction.retaliationText}${endText}${defeatText}`.trim();
      setDialogue(finalMessage);
      return {
        ok: true,
        ended: true,
        defeat: true,
        pendingSceneId: entry.combatDefeatTargetSceneId,
        pendingSceneMessage: finalMessage,
        enemyHealth: nextEnemyHealth,
        enemyMaxHealth,
        enemyMana: enemyAction.nextEnemyMana,
        enemyMaxMana: enemyStats.maxMana,
        message: finalMessage,
        roll: outcomeRoll,
        enemyRoll: enemyAction.enemyRoll,
        visualEffects: [...heroVisualEffects, ...enemyRetaliationVisualEffects],
      };
    }
    setDialogue(message);
    return {
      ok: true,
      ended: defeat,
      defeat,
      enemyHealth: nextEnemyHealth,
      enemyMaxHealth,
      enemyMana: enemyAction.nextEnemyMana,
      enemyMaxMana: enemyStats.maxMana,
      message,
      roll: outcomeRoll,
      enemyRoll: enemyAction.enemyRoll,
      visualEffects: [...heroVisualEffects, ...enemyRetaliationVisualEffects],
    };
  };

  const runHeroCombatAction = (entry = {}, options = {}) => {
    if (!options.previewOnly && blockDefeatedHeroAction()) return false;
    if (!heroAdventure.enabled) {
      setDialogue('Active le mode Hero Adventure pour utiliser un combat.');
      return false;
    }
    captureLastChoiceSnapshot(entry.name || entry.combatEnemyName || 'Avant combat');

    const runtime = getHeroCombatRuntime(entry, options);
    const enemyStats = runtime.enemyStats;
    const turnMode = (entry.combatTurnMode ?? heroAdventure.combat?.turnMode ?? true) !== false;
    const initiative = resolveCombatInitiative(runtime.stats);
    const enemyStarts = initiative.firstActor === 'enemy';
    if (turnMode && !options.resolveTurn) {
      if (runtime.currentEnemyHealth <= 0) {
        return Boolean(finishAlreadyDefeatedHeroCombat(entry, options, runtime)?.ok);
      }
      if (options.closeConversation) closeConversation();
      const startMessage = entry.combatStartDialogue || (enemyStarts
        ? `${runtime.enemyName} a l'initiative (${initiative.enemyInitiative} contre ${initiative.heroInitiative}). Le dé ennemi se lance.`
        : `Combat contre ${runtime.enemyName}. À toi de jouer.`);
      setActiveHeroCombat({
        id: runtime.combatId,
        entry: { ...entry },
        options: {
          sourceHotspotId: options.sourceHotspotId || '',
        },
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
        pendingEnemyTurn: enemyStarts,
        initiativePending: enemyStarts,
        status: 'active',
        message: startMessage,
        history: buildHeroCombatHistory({}, startMessage),
        lastRoll: null,
        lastEnemyRoll: null,
        visualEffects: [],
      });
      setDialogue(entry.combatStartDialogue || (enemyStarts
        ? `${runtime.enemyName} a l'initiative.`
        : `Combat contre ${runtime.enemyName}.`));
      return true;
    }

    const result = resolveHeroCombatTurn(entry, options);
    return Boolean(result?.ok);
  };

  const attackActiveHeroCombat = (heroPowerId = '', options = {}) => {
    if (!activeHeroCombat || activeHeroCombat.status !== 'active') return false;
    if (activeHeroCombat.phase === 'enemy') {
      setDialogue('La riposte ennemie est en cours.');
      return false;
    }
    const result = resolveHeroCombatTurn(activeHeroCombat.entry, {
      ...(activeHeroCombat.options || {}),
      resolveTurn: true,
      allowManualEnemyTurn: true,
      heroPowerId,
      rawRoll: options.rawRoll,
    });
    if (!result?.ok) return false;
    setActiveHeroCombat((current) => {
      if (!current || current.id !== activeHeroCombat.id) return current;
      return {
        ...current,
        enemyHealth: result.enemyHealth,
        enemyMaxHealth: result.enemyMaxHealth,
        enemyMana: result.enemyMana,
        enemyMaxMana: result.enemyMaxMana,
        round: result.pendingEnemyTurn || result.survivalPending ? current.round : current.round + 1,
        phase: result.survivalPending ? 'survival' : result.pendingEnemyTurn ? 'enemy' : 'hero',
        pendingEnemyTurn: Boolean(result.pendingEnemyTurn),
        survivalPending: Boolean(result.survivalPending),
        status: result.victory ? 'victory' : result.defeat ? 'defeat' : 'active',
        message: result.message,
        history: buildHeroCombatHistory(current, result.message),
        pendingSceneId: result.pendingSceneId || '',
        pendingSceneMessage: result.pendingSceneMessage || '',
        lastRoll: result.roll || current.lastRoll,
        lastEnemyRoll: result.pendingEnemyTurn || result.victory ? null : result.enemyRoll || current.lastEnemyRoll,
        visualEffects: result.visualEffects || [],
      };
    });
    return true;
  };

  const rollActiveEnemyCombat = (options = {}) => {
    if (!activeHeroCombat || activeHeroCombat.status !== 'active') return false;
    if (activeHeroCombat.phase !== 'enemy') {
      setDialogue("C'est au héros de jouer.");
      return false;
    }

    const result = resolveEnemyCombatTurn(activeHeroCombat.entry, {
      ...(activeHeroCombat.options || {}),
      rawRoll: options.rawRoll,
    });
    if (!result?.ok) return false;
    setActiveHeroCombat((current) => {
      if (!current || current.id !== activeHeroCombat.id) return current;
      return {
        ...current,
        enemyHealth: result.enemyHealth,
        enemyMaxHealth: result.enemyMaxHealth,
        enemyMana: result.enemyMana,
        enemyMaxMana: result.enemyMaxMana,
        round: result.survivalPending || current.initiativePending ? current.round : current.round + 1,
        phase: result.survivalPending ? 'survival' : 'hero',
        pendingEnemyTurn: false,
        survivalPending: Boolean(result.survivalPending),
        initiativePending: false,
        status: result.defeat ? 'defeat' : 'active',
        message: result.message,
        history: buildHeroCombatHistory(current, result.message),
        pendingSceneId: result.pendingSceneId || '',
        pendingSceneMessage: result.pendingSceneMessage || '',
        lastEnemyRoll: result.enemyRoll || current.lastEnemyRoll,
        visualEffects: result.visualEffects || [],
      };
    });
    return true;
  };

  const attemptSurvivalHeroCombat = (options = {}) => {
    if (!activeHeroCombat || activeHeroCombat.status !== 'active' || activeHeroCombat.phase !== 'survival') return false;
    const result = resolveHeroCombatSurvival(activeHeroCombat.entry, {
      ...(activeHeroCombat.options || {}),
      rawRoll: options.rawRoll,
    });
    if (!result?.ok) return false;
    setActiveHeroCombat((current) => {
      if (!current || current.id !== activeHeroCombat.id) return current;
      return {
        ...current,
        enemyHealth: result.enemyHealth,
        enemyMaxHealth: result.enemyMaxHealth,
        enemyMana: result.enemyMana,
        enemyMaxMana: result.enemyMaxMana,
        phase: result.defeat ? 'ended' : 'hero',
        pendingEnemyTurn: false,
        survivalPending: false,
        survivalUsed: true,
        status: result.defeat ? 'defeat' : 'active',
        message: result.message,
        history: buildHeroCombatHistory(current, result.message),
        pendingSceneId: result.pendingSceneId || '',
        pendingSceneMessage: result.pendingSceneMessage || '',
        lastRoll: result.roll || current.lastRoll,
        visualEffects: result.defeat
          ? [makeCombatOutcomeEffect('hero', 'death', 'KO')].filter(Boolean)
          : [makeCombatVisualEffect('hero', 'heal', '1 PV')].filter(Boolean),
      };
    });
    return true;
  };

  const attemptEscapeHeroCombat = () => {
    if (!activeHeroCombat || activeHeroCombat.status !== 'active') return false;
    if (activeHeroCombat.phase === 'enemy') {
      setDialogue('La riposte ennemie est en cours.');
      return false;
    }

    const runtime = getHeroCombatRuntime(activeHeroCombat.entry, activeHeroCombat.options || {});
    const ruseSkill = getHeroSkillByKey('ruse');
    const modifier = Math.max(0, Number(ruseSkill?.value) || 0);
    const enemyCunning = Math.max(1, Number(runtime.enemyStats?.cunning) || DEFAULT_COMBAT_SETTINGS.enemyCunning || 10);
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
    setLastDiceRoll(roll);
    engineRef.current.setState({ lastDiceRoll: roll });

    if (total >= enemyCunning) {
      setDialogue(`Fuite réussie: Ruse ${raw} + ${modifier} = ${total} contre ${enemyCunning}.`);
      setActiveHeroCombat(null);
      return true;
    }

    const message = `Fuite ratée: Ruse ${raw} + ${modifier} = ${total} contre ${enemyCunning}. Le héros perd son tour.`;
    setDialogue(message);
    setActiveHeroCombat((current) => {
      if (!current || current.id !== activeHeroCombat.id) return current;
      return {
        ...current,
        phase: 'enemy',
        pendingEnemyTurn: true,
        message,
        history: buildHeroCombatHistory(current, message),
        lastRoll: roll,
        lastEnemyRoll: null,
        visualEffects: [],
      };
    });
    return false;
  };

  const closeActiveHeroCombat = () => {
    const pendingSceneId = activeHeroCombat?.pendingSceneId || '';
    const pendingSceneMessage = activeHeroCombat?.pendingSceneMessage || activeHeroCombat?.message || '';
    setActiveHeroCombat(null);
    if (pendingSceneId) {
      goToScene(pendingSceneId, pendingSceneMessage || 'Le combat est terminé.');
    }
  };

  const previewHeroCombat = (entry = {}, options = {}) => {
    if (!entry) return false;
    const sourceScene = project.scenes.find((scene) => scene.id === options.sceneId) || playScene || project.scenes[0] || null;
    const nextHeroAdventure = normalizeHeroAdventure(project);
    const previewHero = {
      ...nextHeroAdventure.hero,
      health: Math.max(1, Number(nextHeroAdventure.hero.maxHealth) || Number(nextHeroAdventure.hero.health) || 1),
      mana: Math.max(0, Number(nextHeroAdventure.hero.maxMana) || Number(nextHeroAdventure.hero.mana) || 0),
    };

    initializeFromProject(project);
    engineRef.current.setState({
      currentSceneId: sourceScene?.id || '',
      dialogue: sourceScene?.introText || '',
      heroState: previewHero,
      heroSetupComplete: true,
      heroCombatStates: {},
      viewerImage: null,
      playingCinematic: null,
      activeEnigma: null,
    });
    setPlaySceneId(sourceScene?.id || '');
    setDialogue(sourceScene?.introText || '');
    setHeroState(previewHero);
    setHeroSetupComplete(true);
    setHeroCombatStates({});
    setViewerImage(null);
    setPlayingCinematic(null);
    setActiveEnigma(null);
    setActiveHeroCombat(null);

    return runHeroCombatAction(entry, {
      sceneId: sourceScene?.id || '',
      previewOnly: true,
    });
  };


  return {
    runSkillCheckAction,
    runHeroCombatAction,
    attackActiveHeroCombat,
    rollActiveEnemyCombat,
    attemptSurvivalHeroCombat,
    attemptEscapeHeroCombat,
    closeActiveHeroCombat,
    previewHeroCombat,
  };
}
