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

export function getConditionCollectionSize(collection) {
  if (collection instanceof Set) return collection.size;
  return getConditionArray(collection).length;
}

export function isHeroLogicCondition(conditionType = '') {
  return [
    'hero_health_below',
    'hero_mana_at_least',
    'hero_last_roll_success',
    'hero_skill_used',
  ].includes(conditionType);
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

export function getConditionType(condition = {}) {
  return condition.type || condition.conditionType || 'none';
}

export function getConditionItemId(condition = {}) {
  return condition.itemId || condition.conditionItemId || '';
}

export function getConditionSceneId(condition = {}) {
  return condition.sceneId || condition.conditionSceneId || '';
}

export function getConditionHotspotId(condition = {}) {
  return condition.hotspotId || condition.conditionHotspotId || '';
}

export function getConditionEnigmaId(condition = {}) {
  return condition.enigmaId || condition.conditionEnigmaId || '';
}

export function getConditionReplyId(condition = {}) {
  return condition.replyId || condition.conditionReplyId || '';
}

export function getConditionVariableKey(condition = {}) {
  return condition.variableKey || condition.conditionVariableKey || '';
}

export function getProjectEntry(collection = [], id = '') {
  return getConditionArray(collection).find((entry) => entry?.id === id) || null;
}

export function getConditionItemLabel(condition = {}, context = {}) {
  const itemId = getConditionItemId(condition);
  if (!itemId) return 'objet non renseigne';
  const item = context.getItemById?.(itemId) || getProjectEntry(context.project?.items, itemId);
  return item?.name || item?.title || itemId;
}

export function getConditionStoryVariableLabel(condition = {}, context = {}) {
  const variableKey = getConditionVariableKey(condition);
  if (!variableKey) return 'variable non renseignee';
  const variable = getConditionArray(context.project?.storyVariables).find((entry) => entry?.key === variableKey);
  return context.getStoryVariableLabel?.(variableKey) || variable?.journalLabel || variable?.name || variableKey;
}

export function getConditionOperatorLabel(operator = 'equals') {
  const labels = {
    equals: '=',
    not_equals: '!=',
    greater_or_equal: '>=',
    less_or_equal: '<=',
    truthy: 'vrai',
    falsy: 'faux',
  };
  return labels[operator] || '=';
}

export function hasOwn(object = {}, key = '') {
  return Object.prototype.hasOwnProperty.call(object || {}, key);
}

export function getConditionRequirementLabel(condition = {}, context = {}, options = {}) {
  if (condition.label) return condition.label;

  const conditionType = getConditionType(condition);
  if (conditionType === 'none' || conditionType === 'always') return 'Toujours disponible';

  if (conditionType === 'has_item') {
    const itemId = getConditionItemId(condition);
    return itemId ? getConditionItemLabel(condition, context) : "condition d'objet non configuree";
  }

  if (conditionType === 'missing_item') {
    const itemId = getConditionItemId(condition);
    return itemId ? `Ne pas avoir: ${getConditionItemLabel(condition, context)}` : "condition d'objet non configuree";
  }

  if (conditionType === 'visited_scene') {
    const sceneId = getConditionSceneId(condition);
    const scene = getProjectEntry(context.project?.scenes, sceneId);
    return sceneId ? `Scene visitee: ${scene?.name || scene?.title || sceneId}` : 'scene non renseignee';
  }

  if (conditionType === 'completed_hotspot') {
    const hotspotId = getConditionHotspotId(condition);
    const hotspots = getConditionArray(context.project?.scenes).flatMap((scene) => scene.hotspots || []);
    const hotspot = getProjectEntry(hotspots, hotspotId);
    return hotspotId ? `Action faite: ${hotspot?.name || hotspot?.title || hotspotId}` : 'action non renseignee';
  }

  if (conditionType === 'solved_enigma') {
    const enigmaId = getConditionEnigmaId(condition);
    const enigma = getProjectEntry(context.project?.enigmas, enigmaId);
    return enigmaId ? `Enigme resolue: ${enigma?.name || enigma?.title || enigmaId}` : 'enigme non renseignee';
  }

  if (conditionType === 'chose_reply') {
    return getConditionReplyId(condition) ? 'Choix precedent effectue' : 'choix precedent non renseigne';
  }

  if (conditionType === 'story_variable') {
    const variableKey = getConditionVariableKey(condition);
    if (!variableKey) return 'condition de variable non configuree';
    const operator = condition.operator || condition.conditionVariableOperator || 'equals';
    const operatorLabel = getConditionOperatorLabel(operator);
    const expectedValue = condition.value ?? condition.conditionVariableValue;
    const valueText = ['truthy', 'falsy'].includes(operator) ? operatorLabel : `${operatorLabel} ${expectedValue ?? ''}`.trim();
    const current = context.storyVariables?.[variableKey];
    const currentText = options.includeCurrent && hasOwn(context.storyVariables, variableKey)
      ? ` (actuel ${current})`
      : '';
    return `${getConditionStoryVariableLabel(condition, context)} ${valueText}${currentText}`.trim();
  }

  return 'Condition non remplie';
}

export function getConditionFailureReasons(condition = {}, context = {}, options = {}) {
  const conditionType = getConditionType(condition);
  if (conditionType === 'none' || conditionType === 'always' || evaluateCondition(condition, context)) return [];

  if (conditionType === 'advanced') {
    const conditions = getConditionArray(condition.advancedConditions || condition.conditions);
    if (!conditions.length) return ['Aucune condition configuree'];
    const missing = conditions.flatMap((entry) => getConditionFailureReasons(entry, context, options));
    if ((condition.advancedConditionMode || condition.mode || 'all') === 'any') {
      return missing.length === conditions.length
        ? [`Il faut au moins une condition: ${missing.slice(0, 3).join(' ou ')}`]
        : [];
    }
    return missing;
  }

  const label = getConditionRequirementLabel(condition, context, options);
  return options.includePrefix === false ? [label] : [`Necessite: ${label}`];
}

export function getReplyConditionFailureReasons(reply = {}, context = {}, options = {}) {
  return getConditionFailureReasons(getReplyCondition(reply), context, options);
}

export function getReplyConditionFailureSummary(reply = {}, context = {}, options = {}) {
  return getReplyConditionFailureReasons(reply, context, options).join(' + ');
}

export function getReplyConditionLockReason(reply = {}, context = {}, options = {}) {
  const missingSummary = getReplyConditionFailureSummary(reply, context, {
    ...options,
    includePrefix: false,
    includeCurrent: true,
  });
  if (reply.lockedLabel) {
    return missingSummary
      ? `${reply.lockedLabel} Prerequis manquants: ${missingSummary}.`
      : reply.lockedLabel;
  }
  return getReplyConditionFailureSummary(reply, context, {
    ...options,
    includePrefix: true,
    includeCurrent: true,
  }) || 'Condition non remplie';
}

export function getObjectiveChecklist(context = {}) {
  const checklist = context.objectiveChecklist || context.heroAdventure?.objectiveChecklist || context.project?.heroAdventure?.objectiveChecklist;
  return checklist && typeof checklist === 'object' ? checklist : null;
}

export function getObjectiveRouteStatuses(context = {}) {
  const checklist = getObjectiveChecklist(context);
  const routes = getConditionArray(checklist?.routes);
  return routes.map((route, routeIndex) => {
    const conditions = getConditionArray(route.conditions);
    const checks = conditions.map((condition, conditionIndex) => ({
      id: condition.id || `${route.id || routeIndex}-${conditionIndex}`,
      label: condition.label || getConditionRequirementLabel(condition, context, { includeCurrent: true }),
      ready: evaluateCondition(condition, context),
    }));
    return {
      id: route.id || `route-${routeIndex}`,
      label: route.label || `Voie ${routeIndex + 1}`,
      successText: route.successText || '',
      checks,
      ready: checks.length > 0 && checks.every((check) => check.ready),
      missingLabels: checks.filter((check) => !check.ready).map((check) => check.label),
    };
  });
}

export function hasReadyObjectiveRoute(context = {}) {
  return getObjectiveRouteStatuses(context).some((route) => route.ready);
}

export function shouldBlockObjectiveFinalScene(sceneId = '', context = {}) {
  const checklist = getObjectiveChecklist(context);
  if (!checklist?.blockFinalSceneUntilRouteReady || !checklist.finalSceneId || sceneId !== checklist.finalSceneId) return false;
  const routes = getObjectiveRouteStatuses(context);
  return routes.length > 0 && !routes.some((route) => route.ready);
}

export function getObjectiveFinalSceneBlockMessage(context = {}, options = {}) {
  if (!shouldBlockObjectiveFinalScene(options.sceneId || context.sceneId || '', context)) return '';
  const routes = getObjectiveRouteStatuses(context);
  const routeDetails = routes
    .map((route) => `${route.label}: ${route.missingLabels.slice(0, 3).join(', ') || 'a completer'}`)
    .join(' | ');
  const prefix = options.prefix || "Tu n'as pas encore de prise suffisante sur Morholt.";
  return routeDetails
    ? `${prefix} Ouvre le tiroir Objectif et valide au moins une voie: ${routeDetails}.`
    : `${prefix} Ouvre le tiroir Objectif et valide au moins une voie.`;
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

export function getReplyTargetSceneId(reply = {}) {
  if (!reply || typeof reply !== 'object') return '';
  const effectScene = getConditionArray(reply.effects)
    .find((effect) => effect?.type === 'scene' && effect.targetSceneId)?.targetSceneId || '';
  return effectScene
    || reply.targetSceneId
    || reply.skillCheckSuccessTargetSceneId
    || reply.combatVictoryTargetSceneId
    || '';
}

export function normalizeUnvisitedReturnLabel(label = '') {
  const text = String(label || '');
  return text
    .replace(/^Revenir\b/i, 'Aller')
    .replace(/^Retourner\b/i, 'Aller');
}

export function getVisitedAwareReplyLabel(reply = {}, context = {}) {
  const label = reply.label || '';
  const targetSceneId = getReplyTargetSceneId(reply);
  if (!label || !targetSceneId || hasConditionValue(context.visitedSceneIds, targetSceneId)) return label;
  return normalizeUnvisitedReturnLabel(label);
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
