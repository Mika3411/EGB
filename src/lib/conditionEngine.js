export function getConditionArray(value) {
  return Array.isArray(value) ? value : [];
}

export function hasConditionValue(collection, value) {
  if (!value) return false;
  if (collection instanceof Set) return collection.has(value);
  return getConditionArray(collection).includes(value);
}

export function getConditionItemIds(context = {}) {
  return context.itemIds || context.inventory || [];
}

const getConditionCollectionSize = (collection) => {
  if (collection instanceof Set) return collection.size;
  return getConditionArray(collection).length;
};

const HERO_LOGIC_CONDITION_TYPES = new Set([
  'hero_health_below',
  'hero_mana_at_least',
  'hero_last_roll_success',
  'hero_skill_used',
]);

export function isHeroLogicCondition(conditionType = '') {
  return HERO_LOGIC_CONDITION_TYPES.has(conditionType);
}

export function isHeroAdventureEnabled(context = {}) {
  if (Object.prototype.hasOwnProperty.call(context, 'heroAdventureEnabled')) {
    return Boolean(context.heroAdventureEnabled);
  }
  return Boolean(
    context.heroAdventure?.enabled
    || context.project?.heroAdventure?.enabled
    || context.project?.creationMode === 'hero_adventure',
  );
}

export function evaluateStoryVariableCondition(condition = {}, storyVariables = {}) {
  const variableKey = condition.variableKey || condition.conditionVariableKey || '';
  const currentValue = storyVariables[variableKey];
  const expectedValue = condition.value ?? condition.conditionVariableValue;
  const operator = condition.operator || condition.conditionVariableOperator || 'equals';

  if (operator === 'truthy') return Boolean(currentValue);
  if (operator === 'falsy') return !currentValue;
  if (operator === 'not_equals') return String(currentValue ?? '') !== String(expectedValue ?? '');
  if (operator === 'greater_or_equal') return Number(currentValue) >= Number(expectedValue);
  if (operator === 'less_or_equal') return Number(currentValue) <= Number(expectedValue);
  return String(currentValue ?? '') === String(expectedValue ?? '');
}

export function evaluateCondition(condition = {}, context = {}) {
  const conditionType = condition.type || condition.conditionType || 'none';

  if (conditionType === 'none' || conditionType === 'always') return true;
  if (conditionType === 'has_item') return hasConditionValue(getConditionItemIds(context), condition.itemId || condition.conditionItemId);
  if (conditionType === 'missing_item') {
    const itemId = condition.itemId || condition.conditionItemId;
    return Boolean(itemId && !hasConditionValue(getConditionItemIds(context), itemId));
  }
  if (conditionType === 'visited_scene') return hasConditionValue(context.visitedSceneIds, condition.sceneId || condition.conditionSceneId);
  if (conditionType === 'completed_hotspot') return hasConditionValue(context.completedHotspotIds, condition.hotspotId || condition.conditionHotspotId);
  if (conditionType === 'solved_enigma') return hasConditionValue(context.solvedEnigmaIds, condition.enigmaId || condition.conditionEnigmaId);
  if (conditionType === 'chose_reply') return hasConditionValue(context.chosenConversationReplyIds, condition.replyId || condition.conditionReplyId);
  if (conditionType === 'story_variable') return evaluateStoryVariableCondition(condition, context.storyVariables || {});
  if (conditionType === 'advanced') {
    const conditions = getConditionArray(condition.advancedConditions || condition.conditions);
    if (!conditions.length) return false;
    return (condition.advancedConditionMode || condition.mode || 'all') === 'any'
      ? conditions.some((entry) => evaluateCondition(entry, context))
      : conditions.every((entry) => evaluateCondition(entry, context));
  }

  return true;
}

export function getReplyCondition(reply = {}) {
  const conditionType = reply.conditionType || 'none';
  if (conditionType === 'has_item') return { type: 'has_item', itemId: reply.conditionItemId };
  if (conditionType === 'visited_scene') return { type: 'visited_scene', sceneId: reply.conditionSceneId };
  if (conditionType === 'completed_hotspot') return { type: 'completed_hotspot', hotspotId: reply.conditionHotspotId };
  if (conditionType === 'solved_enigma') return { type: 'solved_enigma', enigmaId: reply.conditionEnigmaId };
  if (conditionType === 'chose_reply') return { type: 'chose_reply', replyId: reply.conditionReplyId };
  if (conditionType === 'story_variable') {
    return {
      type: 'story_variable',
      variableKey: reply.conditionVariableKey,
      operator: reply.conditionVariableOperator,
      value: reply.conditionVariableValue,
    };
  }
  if (conditionType === 'advanced') {
    return {
      type: 'advanced',
      advancedConditionMode: reply.advancedConditionMode,
      advancedConditions: reply.advancedConditions,
    };
  }
  return { type: conditionType };
}

export function evaluateReplyCondition(reply = {}, context = {}) {
  return evaluateCondition(getReplyCondition(reply), context);
}

export function isLogicRuleAvailable(rule = {}, context = {}) {
  if (isHeroLogicCondition(rule.conditionType || '') && !isHeroAdventureEnabled(context)) return false;
  return !(rule.disableAfterUse && hasConditionValue(context.usedLogicRuleIds, rule.id));
}

export function isLogicRuleConfigured(rule = {}) {
  const conditionType = rule.conditionType || 'has_item';
  if (['has_item', 'missing_item'].includes(conditionType)) return Boolean(rule.itemId);
  if (conditionType === 'always') return true;
  if (conditionType === 'visited_scene') return Boolean(rule.conditionSceneId || rule.sceneId);
  if (conditionType === 'completed_hotspot') return Boolean(rule.hotspotId);
  if (conditionType === 'solved_enigma') return Boolean(rule.conditionEnigmaId || rule.enigmaId);
  if (conditionType === 'chose_reply') return Boolean(rule.conditionReplyId || rule.replyId);
  if (conditionType === 'story_variable') return Boolean(rule.conditionVariableKey || rule.variableKey);
  if (conditionType === 'advanced') return getConditionArray(rule.advancedConditions || rule.conditions).length > 0;
  if (conditionType === 'completed_combination') return Boolean(rule.combinationId);
  if (conditionType === 'hero_health_below') return true;
  if (conditionType === 'hero_mana_at_least') return true;
  if (conditionType === 'hero_last_roll_success') return true;
  if (conditionType === 'hero_skill_used') return Boolean(rule.heroSkillId);
  return true;
}

export function evaluateLogicRuleCondition(rule = {}, context = {}) {
  if (!isLogicRuleAvailable(rule, context)) return false;

  const conditionType = rule.conditionType || 'has_item';
  const currentHero = context.heroState || {};
  const currentRoll = context.lastDiceRoll || {};

  if (conditionType === 'always') return true;
  if (['has_item', 'missing_item', 'visited_scene', 'completed_hotspot', 'solved_enigma', 'chose_reply', 'story_variable', 'advanced'].includes(conditionType)) {
    return evaluateCondition({ ...rule, conditionType }, context);
  }
  if (conditionType === 'launched_cinematic') {
    return rule.cinematicId
      ? hasConditionValue(context.launchedCinematicIds, rule.cinematicId)
      : getConditionCollectionSize(context.launchedCinematicIds) > 0;
  }
  if (conditionType === 'completed_combination') {
    return Boolean(rule.combinationId && hasConditionValue(context.completedCombinationIds, rule.combinationId));
  }
  if (conditionType === 'second_click') return hasConditionValue(context.completedHotspotIds, context.hotspotId);
  if (conditionType === 'hero_health_below') return Number(currentHero.health || 0) < Math.max(0, Number(rule.heroHealthThreshold) || 0);
  if (conditionType === 'hero_mana_at_least') return Number(currentHero.mana || 0) >= Math.max(0, Number(rule.heroManaThreshold) || 0);
  if (conditionType === 'hero_last_roll_success') return currentRoll?.success === true;
  if (conditionType === 'hero_skill_used') return Boolean(rule.heroSkillId && currentRoll?.skillId === rule.heroSkillId);
  return evaluateCondition({ type: 'has_item', itemId: rule.itemId }, context);
}
