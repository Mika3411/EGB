import { getSceneObjectBlockType } from './sceneObjectBlocks';

const toIdSet = (entries = []) => new Set(
  entries.map((entry) => entry?.id).filter(Boolean),
);

const requireTarget = (issues, refs, refKey, value, missingLabel, missingMessage = `${missingLabel} manquante`) => {
  if (!value) {
    issues.push(missingMessage);
    return;
  }
  if (refs?.[refKey] && !refs[refKey].has(value)) {
    issues.push(`${missingLabel} introuvable`);
  }
};

const getConversationReplyIds = (hotspot = {}) => (
  (hotspot.conversation?.nodes || []).flatMap((node) => (
    (node.replies || []).map((reply) => reply.id).filter(Boolean)
  ))
);

export function buildLogicCompletionRefs(project = {}) {
  const scenes = project.scenes || [];
  const actionTargets = scenes.flatMap((scene) => [
    ...(scene.hotspots || []),
    ...(scene.sceneObjects || []),
  ]);
  const blockTargets = scenes.flatMap((scene) => (
    (scene.sceneObjects || []).filter((object) => getSceneObjectBlockType(object) !== 'object')
  ));
  const replyIds = scenes.flatMap((scene) => (
    (scene.hotspots || []).flatMap(getConversationReplyIds)
  ));

  return {
    itemIds: toIdSet(project.items || []),
    sceneIds: toIdSet(scenes),
    cinematicIds: toIdSet(project.cinematics || []),
    enigmaIds: toIdSet(project.enigmas || []),
    actionTargetIds: toIdSet(actionTargets),
    blockTargetIds: toIdSet(blockTargets),
    combinationIds: toIdSet(project.combinations || []),
    replyIds: new Set(replyIds),
    heroSkillIds: toIdSet(project.heroAdventure?.hero?.skills || []),
  };
}

export function getLogicConditionCompletionIssues(rule = {}, refs = {}) {
  const issues = [];
  const conditionType = rule.conditionType || 'always';

  if (['has_item', 'missing_item'].includes(conditionType)) {
    requireTarget(issues, refs, 'itemIds', rule.itemId, 'Objet testé', 'Objet testé manquant');
  } else if (conditionType === 'visited_scene') {
    requireTarget(issues, refs, 'sceneIds', rule.conditionSceneId || rule.sceneId, 'Scène visitée', 'Scène visitée manquante');
  } else if (conditionType === 'completed_hotspot') {
    requireTarget(issues, refs, 'actionTargetIds', rule.hotspotId, 'Zone ou bloc requis', 'Zone ou bloc requis manquant');
  } else if (conditionType === 'solved_enigma') {
    requireTarget(issues, refs, 'enigmaIds', rule.conditionEnigmaId || rule.enigmaId, 'Énigme réussie', 'Énigme réussie manquante');
  } else if (conditionType === 'completed_combination') {
    requireTarget(issues, refs, 'combinationIds', rule.combinationId, 'Combinaison requise', 'Combinaison requise manquante');
  } else if (conditionType === 'chose_reply') {
    requireTarget(issues, refs, 'replyIds', rule.conditionReplyId || rule.replyId, 'Réponse choisie', 'Réponse choisie manquante');
  } else if (conditionType === 'story_variable' && !(rule.conditionVariableKey || rule.variableKey)) {
    issues.push('Variable narrative manquante');
  } else if (conditionType === 'advanced') {
    const conditions = Array.isArray(rule.advancedConditions || rule.conditions)
      ? rule.advancedConditions || rule.conditions
      : [];
    if (!conditions.length) {
      issues.push('Condition avancée manquante');
    } else {
      conditions.forEach((condition, index) => {
        getAdvancedConditionCompletionIssues(condition, refs).forEach((issue) => {
          issues.push(`Condition avancée ${index + 1}: ${issue}`);
        });
      });
    }
  } else if (conditionType === 'hero_skill_used') {
    requireTarget(issues, refs, 'heroSkillIds', rule.heroSkillId, 'Compétence héros', 'Compétence héros manquante');
  }

  return issues.map((issue) => `Condition: ${issue}`);
}

export function getAdvancedConditionCompletionIssues(condition = {}, refs = {}) {
  const issues = [];
  const conditionType = condition.type || condition.conditionType || 'has_item';

  if (conditionType === 'has_item') {
    requireTarget(issues, refs, 'itemIds', condition.itemId || condition.conditionItemId, 'Objet testé', 'Objet testé manquant');
  } else if (conditionType === 'visited_scene') {
    requireTarget(issues, refs, 'sceneIds', condition.sceneId || condition.conditionSceneId, 'Scène visitée', 'Scène visitée manquante');
  } else if (conditionType === 'completed_hotspot') {
    requireTarget(issues, refs, 'actionTargetIds', condition.hotspotId || condition.conditionHotspotId, 'Zone ou bloc requis', 'Zone ou bloc requis manquant');
  } else if (conditionType === 'solved_enigma') {
    requireTarget(issues, refs, 'enigmaIds', condition.enigmaId || condition.conditionEnigmaId, 'Énigme réussie', 'Énigme réussie manquante');
  } else if (conditionType === 'chose_reply') {
    requireTarget(issues, refs, 'replyIds', condition.replyId || condition.conditionReplyId, 'Réponse choisie', 'Réponse choisie manquante');
  } else if (conditionType === 'story_variable' && !(condition.variableKey || condition.conditionVariableKey)) {
    issues.push('Variable narrative manquante');
  }

  return issues;
}

export function getLogicActionCompletionIssues(action = {}, refs = {}) {
  const issues = [];
  const actionType = action.actionType || 'dialogue';

  if (actionType === 'scene') {
    requireTarget(issues, refs, 'sceneIds', action.targetSceneId, 'Scène cible', 'Scène cible manquante');
  } else if (actionType === 'cinematic') {
    requireTarget(issues, refs, 'cinematicIds', action.targetCinematicId, 'Cinématique cible', 'Cinématique cible manquante');
  } else if (actionType === 'block') {
    requireTarget(issues, refs, 'blockTargetIds', action.targetBlockId, 'Bloc cible', 'Bloc cible manquant');
  } else if (actionType === 'dialogue_item') {
    requireTarget(issues, refs, 'itemIds', action.rewardItemId, 'Objet donné', 'Objet donné manquant');
  }

  return issues.map((issue) => `Action: ${issue}`);
}

export function getLogicRuleCompletionIssues(rule = {}, refs = {}) {
  return [
    ...getLogicConditionCompletionIssues(rule, refs),
    ...getLogicActionCompletionIssues(rule, refs),
  ];
}

export function getSceneTimerCompletionIssues(scene = {}, refs = {}) {
  if (!scene.timerEnabled) return [];

  const issues = [];
  const actionType = scene.timerEndAction || 'none';

  if (['scene', 'damage-life'].includes(actionType)) {
    requireTarget(issues, refs, 'sceneIds', scene.timerTargetSceneId, 'Scène cible du timer', 'Scène cible du timer manquante');
  } else if (actionType === 'cinematic') {
    requireTarget(issues, refs, 'cinematicIds', scene.timerTargetCinematicId, 'Cinématique cible du timer', 'Cinématique cible du timer manquante');
  }

  return issues;
}
