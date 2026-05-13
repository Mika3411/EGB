export const standaloneHeroSkillChecks = `function rollHeroDie(skillId = '', options = {}) {
  if (blockDefeatedHeroAction()) return null;
  const currentHero = state.heroState || getInitialHeroState();
  const skill = (currentHero.skills || []).find((entry) => entry.id === skillId) || null;
  const manaCost = Math.max(0, Number(options.manaCost ?? skill?.manaCost ?? 0) || 0);
  if (manaCost && Number(currentHero.mana || 0) < manaCost) {
    state.dialogue = 'Mana insuffisante pour ' + (skill?.name || 'ce test') + '.';
    return null;
  }

  const sides = Math.max(2, Number(project?.heroAdventure?.dice?.sides) || 20);
  const forcedRaw = Number(options.raw);
  const raw = Number.isFinite(forcedRaw)
    ? clampNumber(Math.round(forcedRaw), 1, 1, sides)
    : Math.floor(Math.random() * sides) + 1;
  const modifier = Number(skill?.value) || 0;
  const total = raw + modifier;
  const activeRules = currentHero.rules || project?.heroAdventure?.rules || {};
  const criticalSuccess = clampNumber(Number(activeRules.criticalSuccess) || sides, sides, 1, sides);
  const criticalFailure = clampNumber(Number(activeRules.criticalFailure) || 1, 1, 1, sides);
  const roll = {
    id: Date.now(),
    die: project?.heroAdventure?.dice?.label || ('d' + sides),
    sides,
    raw,
    modifier,
    total,
    skillId: skill?.id || '',
    skillName: skill?.name || '',
    isCriticalSuccess: raw === criticalSuccess,
    isCriticalFailure: raw === criticalFailure,
  };
  state.heroState = manaCost
    ? { ...currentHero, mana: Math.max(0, Number(currentHero.mana || 0) - manaCost) }
    : currentHero;
  state.lastDiceRoll = roll;
  if (!options.silent) {
    state.dialogue = (skill ? skill.name + ': ' : '') + roll.die + ' = ' + raw + (modifier ? ' + ' + modifier : '') + ' => ' + total + '.';
  }
  return roll;
}

function runSkillCheckAction(entry = {}, options = {}) {
  if (blockDefeatedHeroAction()) return false;
  if (!IS_HERO_ADVENTURE) {
    state.dialogue = 'Active le mode Hero Adventure pour utiliser un test de compétence.';
    return false;
  }

  const currentHero = state.heroState || getInitialHeroState();
  const skillId = entry.skillCheckSkillId || currentHero.skills?.[0]?.id || '';
  const difficulty = Math.max(1, Number(entry.skillCheckDifficulty) || 10);
  const roll = rollHeroDie(skillId, {
    silent: true,
    manaCost: Math.max(0, Number(entry.skillCheckManaCost) || 0),
  });
  if (!roll) return false;

  const sides = Math.max(2, Number(roll.sides) || Number(project?.heroAdventure?.dice?.sides) || 20);
  const activeRules = (state.heroState || currentHero)?.rules || project?.heroAdventure?.rules || {};
  const outcomeRoll = {
    ...roll,
    ...resolveRollOutcome({
      raw: roll.raw,
      modifier: roll.modifier,
      difficulty,
      criticalSuccess: clampNumber(Number(activeRules.criticalSuccess) || sides, sides, 1, sides),
      criticalFailure: clampNumber(Number(activeRules.criticalFailure) || 1, 1, 1, sides),
    }),
    actionType: 'skill_check',
  };
  const success = outcomeRoll.success;
  state.lastDiceRoll = outcomeRoll;
  const outcome = success ? 'Success' : 'Failure';
  const outcomeLabel = outcomeRoll.isCriticalSuccess ? 'Réussite critique' : outcomeRoll.isCriticalFailure ? 'Échec critique' : success ? 'Réussite' : 'Échec';
  const outcomeDialogue = entry['skillCheck' + outcome + 'Dialogue'] || (success ? 'Test réussi.' : 'Test raté.');
  const targetSceneId = entry['skillCheck' + outcome + 'TargetSceneId'] || '';
  const nextNodeId = entry['skillCheck' + outcome + 'NextNodeId'] || '';
  const resultMessage = ((roll.skillName ? roll.skillName + ': ' : '') + roll.die + ' = ' + roll.raw + (roll.modifier ? ' + ' + roll.modifier : '') + ' => ' + roll.total + '. ' + outcomeLabel + ' contre ' + difficulty + '. ' + outcomeDialogue).trim();

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
      if (nextNode.askOnce && state.askedConversationNodeIds.includes(nextNode.id)) {
        state.dialogue = resultMessage || 'Cette question a déjà été posée.';
        if (options.closeConversation) closeConversation();
        return true;
      }
      if (!state.askedConversationNodeIds.includes(nextNode.id)) state.askedConversationNodeIds = [...state.askedConversationNodeIds, nextNode.id];
      if (state.activeConversation) state.activeConversation.nodeId = nextNode.id;
      state.dialogue = resultMessage;
      return true;
    }
  }

  state.dialogue = resultMessage;
  if (options.closeConversation && !nextNodeId) closeConversation();
  return true;
}

`;
