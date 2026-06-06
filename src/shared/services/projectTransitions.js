const asArray = (value) => (Array.isArray(value) ? value : []);

const getSourceName = (source = {}) => source.name || source.blockLabel || 'Zone';

export const getActStartSceneId = (project, actId) => {
  const actScenes = asArray(project.scenes).filter((scene) => scene.actId === actId);
  return actScenes.find((scene) => !scene.parentSceneId)?.id || actScenes[0]?.id || '';
};

export const getCinematicTargetSceneIds = (project, cinematicId) => {
  const cinematic = asArray(project.cinematics).find((entry) => entry.id === cinematicId);
  if (!cinematic) return [];
  if (cinematic.onEndType === 'scene' && cinematic.targetSceneId) return [cinematic.targetSceneId];
  if (cinematic.onEndType === 'act' && cinematic.targetActId) {
    const targetSceneId = getActStartSceneId(project, cinematic.targetActId);
    return targetSceneId ? [targetSceneId] : [];
  }
  return [];
};

export const getEnigmaTargetSceneIds = (project, enigmaId) => {
  const enigma = asArray(project.enigmas).find((entry) => entry.id === enigmaId);
  if (!enigma) return [];
  if (enigma.unlockType === 'scene' && enigma.targetSceneId) return [enigma.targetSceneId];
  if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) {
    return getCinematicTargetSceneIds(project, enigma.targetCinematicId);
  }
  return [];
};

export const getActionTargetSceneIds = (project, action) => {
  if (!action) return [];
  const effectTargets = asArray(action.effects).flatMap((effect) => {
    if ((effect.type || '') === 'scene' && effect.targetSceneId) return [effect.targetSceneId];
    if ((effect.type || '') === 'cinematic' && effect.targetCinematicId) {
      return getCinematicTargetSceneIds(project, effect.targetCinematicId);
    }
    if ((effect.type || '') === 'enigma' && effect.enigmaId) return getEnigmaTargetSceneIds(project, effect.enigmaId);
    return [];
  });
  if (effectTargets.length) return effectTargets;
  if (action.enigmaId) {
    const targets = getEnigmaTargetSceneIds(project, action.enigmaId);
    if (targets.length) return targets;
  }
  if (action.actionType === 'scene' && action.targetSceneId) return [action.targetSceneId];
  if (action.actionType === 'skill_check') {
    return [
      action.skillCheckSuccessTargetSceneId,
      action.skillCheckFailureTargetSceneId,
    ].filter(Boolean);
  }
  if (action.actionType === 'hero_combat') {
    return [
      action.combatVictoryTargetSceneId,
      action.combatDefeatTargetSceneId,
    ].filter(Boolean);
  }
  if (action.actionType === 'cinematic' && action.targetCinematicId) {
    return getCinematicTargetSceneIds(project, action.targetCinematicId);
  }
  return [];
};

export const getSceneActionSources = (scene = {}, { includeInactiveObjects = true } = {}) => [
  ...asArray(scene.hotspots),
  ...asArray(scene.sceneObjects).filter((object) => includeInactiveObjects || object.clickMode !== 'none'),
];

const getActionFields = (entry = {}) => ({
  actionType: entry.actionType,
  targetSceneId: entry.targetSceneId,
  targetCinematicId: entry.targetCinematicId,
  externalUrl: entry.externalUrl,
  targetProjectId: entry.targetProjectId,
  targetProjectUserId: entry.targetProjectUserId,
  enigmaId: entry.enigmaId,
  skillCheckSuccessTargetSceneId: entry.skillCheckSuccessTargetSceneId,
  skillCheckFailureTargetSceneId: entry.skillCheckFailureTargetSceneId,
  combatVictoryTargetSceneId: entry.combatVictoryTargetSceneId,
  combatDefeatTargetSceneId: entry.combatDefeatTargetSceneId,
  requiredItemId: entry.requiredItemId,
  requiredHotspotId: entry.requiredHotspotId,
  rewardItemId: entry.rewardItemId || entry.linkedItemId,
  conditionItemId: entry.conditionItemId,
  conditionType: entry.conditionType,
  conditionHotspotId: entry.conditionHotspotId,
  conditionEnigmaId: entry.conditionEnigmaId,
  conditionCinematicId: entry.conditionCinematicId,
  conditionCombinationId: entry.conditionCombinationId,
  advancedConditionMode: entry.advancedConditionMode,
  advancedConditions: entry.advancedConditions,
  storyVariableKey: entry.storyVariableKey,
  storyVariableOperation: entry.storyVariableOperation,
  storyVariableValue: entry.storyVariableValue,
  effects: asArray(entry.effects),
  responseImageData: entry.responseImageData,
  responseSoundData: entry.responseSoundData,
  ambienceSoundData: entry.ambienceSoundData,
  endingType: entry.endingType,
  endingTitle: entry.endingTitle,
  blockActionType: entry.blockActionType,
  targetBlockId: entry.targetBlockId,
});

const getPrimaryAction = (source) => ({
  ...getActionFields(source),
  actionKind: 'primary',
  sourceId: source.id,
  hotspotId: source.id,
  sourceName: getSourceName(source),
  rewardItemId: source.rewardItemId || source.linkedItemId,
  interceptRules: asArray(source.logicRules).filter((rule) => rule.actionType && rule.actionType !== 'default'),
});

const getSecondaryAction = (source) => (source?.hasSecondAction ? {
  ...getActionFields({
    actionType: source.secondActionType,
    targetSceneId: source.secondTargetSceneId,
    targetCinematicId: source.secondTargetCinematicId,
    externalUrl: source.secondExternalUrl,
    targetProjectId: source.secondTargetProjectId,
    targetProjectUserId: source.secondTargetProjectUserId,
    enigmaId: source.secondEnigmaId,
    requiredItemId: source.secondRequiredItemId,
    rewardItemId: source.secondRewardItemId,
  }),
  actionKind: 'secondary',
  sourceId: source.id,
  hotspotId: source.id,
  sourceName: getSourceName(source),
} : null);

const getLogicAction = (source, rule = {}) => {
  const defaultAction = rule.actionType === 'default';
  return {
    ...getActionFields(defaultAction ? source : rule),
    actionKind: 'logic',
    sourceId: source.id,
    hotspotId: source.id,
    sourceName: getSourceName(source),
    ruleName: rule.name || '',
    targetSceneId: defaultAction ? source.targetSceneId : rule.targetSceneId,
    targetCinematicId: defaultAction ? source.targetCinematicId : rule.targetCinematicId,
    enigmaId: defaultAction ? source.enigmaId : rule.enigmaId,
    requiredItemId: defaultAction
      ? (rule.conditionType === 'has_item' ? (rule.itemId || source.requiredItemId) : source.requiredItemId)
      : (rule.conditionType === 'has_item' ? rule.itemId : ''),
    conditionItemId: rule.itemId,
    conditionType: rule.conditionType,
    conditionHotspotId: rule.hotspotId,
    conditionEnigmaId: rule.conditionEnigmaId,
    conditionCinematicId: rule.cinematicId || rule.conditionCinematicId,
    conditionCombinationId: rule.combinationId || rule.conditionCombinationId,
    rewardItemId: rule.rewardItemId || (defaultAction ? (source.rewardItemId || source.linkedItemId) : ''),
    blockActionType: rule.blockActionType,
    targetBlockId: rule.targetBlockId,
  };
};

const getConversationReplyActions = (source = {}) => {
  if (source.actionType !== 'conversation') return [];
  return asArray(source.conversation?.nodes).flatMap((node) => (
    asArray(node.replies).map((reply) => ({
      ...getActionFields(reply),
      actionKind: 'conversation_reply',
      sourceId: source.id,
      hotspotId: source.id,
      sourceName: getSourceName(source),
      nodeId: node.id,
      nodeSpeaker: node.speaker,
      nodeText: node.text,
      replyId: reply.id,
      replyLabel: reply.label,
      conditionSceneId: reply.conditionSceneId,
      conditionHotspotId: reply.conditionHotspotId,
      conditionEnigmaId: reply.conditionEnigmaId,
      conditionCinematicId: reply.conditionCinematicId,
      conditionReplyId: reply.conditionReplyId,
      conditionVariableKey: reply.conditionVariableKey,
      conditionVariableOperator: reply.conditionVariableOperator,
      conditionVariableValue: reply.conditionVariableValue,
    }))
  ));
};

export const getEntryActions = (source) => [
  getPrimaryAction(source),
  getSecondaryAction(source),
  ...asArray(source?.logicRules).map((rule) => getLogicAction(source, rule)),
  ...getConversationReplyActions(source),
].filter(Boolean);

export const getSceneTransitions = (project = {}, { includeInactiveObjects = false } = {}) => (
  asArray(project.scenes).flatMap((scene) => {
    const interactiveEntries = getSceneActionSources(scene, { includeInactiveObjects });
    return interactiveEntries.flatMap((entry) => (
      getEntryActions(entry).flatMap((action) => (
        getActionTargetSceneIds(project, action)
          .filter((targetSceneId) => targetSceneId && targetSceneId !== scene.id)
          .map((targetSceneId) => ({
            ...action,
            fromSceneId: scene.id,
            toSceneId: targetSceneId,
            interceptRules: action.interceptRules || [],
            effects: action.effects || [],
          }))
      ))
    ));
  })
);
