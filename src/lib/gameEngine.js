import { normalizeAnime2dLayer } from './anime2dEngine';
import { normalizeCinematic } from './cinematicEngine';
import * as cinematicEngine from './cinematicEngine';
import * as combinationEngine from './combinationEngine';
import * as enigmaEngine from './enigmaEngine';
import {
  evaluateLogicRuleCondition,
  isLogicRuleAvailable,
  isLogicRuleConfigured,
} from './conditionEngine';
import { resolveAssetUrl } from './assetManager';
export {
  isFlexibleAnswerMatch,
  normalizeAnswer,
  parseJsonValue,
  randomRotations,
  sameColorSequence,
  sameNormalizedList,
  sameNormalizedSet,
  shuffledIndices,
  usesImage,
  validateMiscAnswer,
} from './enigmaEngine';

const getArray = (value) => (Array.isArray(value) ? value : []);
const getActionType = (action = {}) => String(action.type || action.action || '').trim();
const addUnique = (items = [], item) => (item && !items.includes(item) ? [...items, item] : items);
const removeOne = (items = [], item) => {
  const next = [...items];
  const index = next.indexOf(item);
  if (index >= 0) next.splice(index, 1);
  return next;
};

export const getHotspotRewardItemId = (hotspot = {}) => {
  const linkedInventoryItemId = ['inventory', 'both'].includes(hotspot.interactionMode)
    ? hotspot.linkedItemId
    : '';
  return hotspot.rewardItemId || linkedInventoryItemId || '';
};

export const consumeInventoryItem = (items = [], itemId = '') => (
  itemId ? (() => {
    const next = [...items];
    const index = next.indexOf(itemId);
    if (index >= 0) next.splice(index, 1);
    return next;
  })() : items
);

export const addRewardItemToInventory = (items = [], itemId = '') => (
  itemId && !items.includes(itemId) ? [...items, itemId] : items
);

export const selectRewardInventoryItem = (selectedItemIds = [], itemId = '') => (
  itemId
    ? (selectedItemIds.includes(itemId) ? selectedItemIds : [...selectedItemIds, itemId]).slice(-2)
    : selectedItemIds
);

export const createHotspotViewerImage = (hotspot = {}, src = hotspot.objectImageData) => {
  if (!src) return null;
  return {
    src,
    name: hotspot.objectImageName || hotspot.name || 'Objet',
    caption: hotspot.dialogue || hotspot.name || '',
  };
};

export const createInventoryViewerImage = (project = {}, itemOrId = '') => {
  const item = typeof itemOrId === 'object' && itemOrId !== null
    ? itemOrId
    : getProjectItem(project, itemOrId);
  if (!item) return null;
  return {
    id: item.id,
    src: resolveAssetUrl(project, item.imageId, item.imageData) || '',
    name: item.name || 'Objet',
    icon: item.icon || 'Objet',
  };
};

export const applyHotspotBlockState = (state = {}, hotspot = {}, options = {}) => {
  if (hotspot.actionType !== 'block' || !hotspot.targetBlockId) return state;

  const removedKey = options.removedKey || 'usedSceneObjectIds';
  const revealedKey = options.revealedKey || 'revealedSceneObjectIds';
  const textOverridesKey = options.textOverridesKey || 'sceneObjectTextOverrides';
  const targetBlockId = hotspot.targetBlockId;
  const removedIds = Array.isArray(state[removedKey]) ? state[removedKey] : [];
  const revealedIds = Array.isArray(state[revealedKey]) ? state[revealedKey] : [];
  const addId = (items = [], itemId = '') => (itemId && !items.includes(itemId) ? [...items, itemId] : items);

  if ((hotspot.blockActionType || 'show') === 'hide') {
    return {
      ...state,
      [removedKey]: addId(removedIds, targetBlockId),
      [revealedKey]: revealedIds.filter((id) => id !== targetBlockId),
    };
  }

  if (hotspot.blockActionType === 'update_text') {
    return {
      ...state,
      [removedKey]: removedIds.filter((id) => id !== targetBlockId),
      [revealedKey]: addId(revealedIds, targetBlockId),
      [textOverridesKey]: {
        ...(state[textOverridesKey] || {}),
        [targetBlockId]: hotspot.targetBlockText || '',
      },
    };
  }

  return {
    ...state,
    [removedKey]: removedIds.filter((id) => id !== targetBlockId),
    [revealedKey]: addId(revealedIds, targetBlockId),
  };
};

export const GAME_ACTIONS = {
  INIT: 'INIT',
  RESET: 'RESET',
  SET_STATE: 'SET_STATE',
  ENTER_SCENE: 'ENTER_SCENE',
  ADD_ITEM: 'ADD_ITEM',
  REMOVE_ITEM: 'REMOVE_ITEM',
  COMBINE: 'COMBINE',
  START_ENIGMA: 'START_ENIGMA',
  UPDATE_ENIGMA: 'UPDATE_ENIGMA',
  SOLVE_ENIGMA: 'SOLVE_ENIGMA',
  CLOSE_ENIGMA: 'CLOSE_ENIGMA',
  TRIGGER_HOTSPOT: 'TRIGGER_HOTSPOT',
  START_CINEMATIC: 'START_CINEMATIC',
  ADVANCE_CINEMATIC: 'ADVANCE_CINEMATIC',
  CLOSE_CINEMATIC: 'CLOSE_CINEMATIC',
};

export const gameActions = {
  init: (project, state = {}) => ({ type: GAME_ACTIONS.INIT, project, state }),
  reset: (project, patch = {}) => ({ type: GAME_ACTIONS.RESET, project, patch }),
  setState: (patch = {}) => ({ type: GAME_ACTIONS.SET_STATE, patch }),
  enterScene: (id) => ({ type: GAME_ACTIONS.ENTER_SCENE, id }),
  addItem: (itemId) => ({ type: GAME_ACTIONS.ADD_ITEM, itemId }),
  removeItem: (itemId) => ({ type: GAME_ACTIONS.REMOVE_ITEM, itemId }),
  combine: (itemA, itemB) => ({ type: GAME_ACTIONS.COMBINE, itemA, itemB }),
  startEnigma: (id, options = {}) => ({ type: GAME_ACTIONS.START_ENIGMA, id, ...options }),
  updateEnigma: (patch = {}) => ({ type: GAME_ACTIONS.UPDATE_ENIGMA, patch }),
  solveEnigma: (id, answer) => ({ type: GAME_ACTIONS.SOLVE_ENIGMA, id, answer }),
  closeEnigma: () => ({ type: GAME_ACTIONS.CLOSE_ENIGMA }),
  triggerHotspot: (id) => ({ type: GAME_ACTIONS.TRIGGER_HOTSPOT, id }),
  startCinematic: (id) => ({ type: GAME_ACTIONS.START_CINEMATIC, id }),
  advanceCinematic: () => ({ type: GAME_ACTIONS.ADVANCE_CINEMATIC }),
  closeCinematic: () => ({ type: GAME_ACTIONS.CLOSE_CINEMATIC }),
};

const getProjectScene = (project = {}, sceneId = '') => (
  getArray(project.scenes).find((scene) => scene.id === sceneId) || null
);

const getProjectEnigma = (project = {}, enigmaId = '') => (
  getArray(project.enigmas).find((enigma) => enigma.id === enigmaId) || null
);

const getProjectCinematic = (project = {}, cinematicId = '') => (
  getArray(project.cinematics).find((cinematic) => cinematic.id === cinematicId) || null
);

const getProjectItem = (project = {}, itemId = '') => (
  getArray(project.items).find((item) => item.id === itemId) || null
);

const getProjectHotspot = (project = {}, hotspotId = '', currentSceneId = '') => {
  const scenes = currentSceneId
    ? [getProjectScene(project, currentSceneId), ...getArray(project.scenes)].filter(Boolean)
    : getArray(project.scenes);

  for (const scene of scenes) {
    const hotspot = getArray(scene.hotspots).find((entry) => entry.id === hotspotId);
    if (hotspot) return { hotspot, scene };
  }

  return { hotspot: null, scene: null };
};

const getInitialSceneId = (project = {}) => (
  project.start?.targetSceneId
  || getArray(project.scenes).find((scene) => !scene.parentSceneId)?.id
  || getArray(project.scenes)[0]?.id
  || ''
);

const createTriggeredEvent = (action = {}, result = {}) => ({
  type: getActionType(action),
  engine: result.engine || 'game',
  ok: Boolean(result.ok),
  payload: action,
  result,
});

const normalizeGameState = (state = {}) => {
  const project = state.project || {};
  const currentSceneId = state.currentSceneId || state.currentScene?.id || getInitialSceneId(project);
  const currentScene = getProjectScene(project, currentSceneId) || state.currentScene || null;
  const solvedEnigmas = getArray(state.solvedEnigmaIds ?? state.solvedEnigmas);
  const flags = {
    ...(state.flags || {}),
    completedHotspots: getArray(state.completedHotspotIds),
    completedCombinations: getArray(state.completedCombinationIds),
    launchedCinematics: getArray(state.launchedCinematicIds),
    usedLogicRules: getArray(state.usedLogicRuleIds),
    revealedSceneObjects: getArray(state.revealedSceneObjectIds),
  };

  return {
    ...state,
    project,
    currentScene,
    currentSceneId: currentScene?.id || currentSceneId,
    inventory: getArray(state.inventory),
    flags,
    solvedEnigmas,
    solvedEnigmaIds: solvedEnigmas,
    triggeredEvents: getArray(state.triggeredEvents),
    usedSceneObjectIds: getArray(state.usedSceneObjectIds),
    revealedSceneObjectIds: getArray(state.revealedSceneObjectIds),
    sceneObjectTextOverrides: state.sceneObjectTextOverrides && typeof state.sceneObjectTextOverrides === 'object'
      ? state.sceneObjectTextOverrides
      : {},
  };
};

export function createGameState(project = {}, patch = {}) {
  const currentSceneId = patch.currentSceneId ?? patch.currentScene?.id ?? getInitialSceneId(project);
  const currentScene = getProjectScene(project, currentSceneId);

  return normalizeGameState({
    project,
    currentScene,
    currentSceneId,
    inventory: [],
    flags: {},
    solvedEnigmas: [],
    triggeredEvents: [],
    selectedInventoryIds: [],
    solvedEnigmaIds: [],
    completedCombinationIds: [],
    completedHotspotIds: [],
    launchedCinematicIds: [],
    usedLogicRuleIds: [],
    usedSceneObjectIds: [],
    revealedSceneObjectIds: [],
    sceneObjectTextOverrides: {},
    activeEnigma: null,
    activeEnigmaState: {},
    playingCinematic: null,
    playingSlideIndex: 0,
    dialogue: currentScene?.introText || '',
    viewerImage: null,
    lastAction: null,
    lastResult: null,
    ...patch,
  });
}

let gameState = createGameState();

export function getGameState() {
  return gameState;
}

export function setGameState(nextState = {}) {
  gameState = normalizeGameState({
    ...gameState,
    ...nextState,
  });
  return gameState;
}

export function resetGameState(project = gameState.project, patch = {}) {
  gameState = createGameState(project, patch);
  return gameState;
}

const withResult = (state, action, result) => ({
  ...normalizeGameState({
    ...state,
    lastAction: action,
    lastResult: result,
  }),
  triggeredEvents: [
    ...getArray(state.triggeredEvents),
    createTriggeredEvent(action, result),
  ],
});

const getCombinationContext = (state) => ({
  inventory: state.inventory,
  completedCombinationIds: state.completedCombinationIds,
  completedHotspotIds: state.completedHotspotIds,
  solvedEnigmaIds: state.solvedEnigmaIds,
  launchedCinematicIds: state.launchedCinematicIds,
  usedLogicRuleIds: state.usedLogicRuleIds,
  revealedSceneObjectIds: state.revealedSceneObjectIds,
});

const getHotspotConditionContext = (state, hotspotId = '') => ({
  inventory: state.inventory,
  visitedSceneIds: state.visitedSceneIds,
  completedHotspotIds: state.completedHotspotIds,
  solvedEnigmaIds: state.solvedEnigmaIds,
  chosenConversationReplyIds: state.chosenConversationReplyIds,
  storyVariables: state.storyVariables,
  launchedCinematicIds: state.launchedCinematicIds,
  completedCombinationIds: state.completedCombinationIds,
  usedLogicRuleIds: state.usedLogicRuleIds,
  heroState: state.heroState || {},
  lastDiceRoll: state.lastDiceRoll || {},
  heroAdventureEnabled: Boolean(state.project?.heroAdventure?.enabled || state.project?.creationMode === 'hero_adventure'),
  hotspotId,
});

function reduceEnigmaAction(state, action) {
  const type = getActionType(action).toLowerCase();
  const enigma = action.enigma || getProjectEnigma(state.project, action.enigmaId);

  if (['enigma/start', 'enigma_start', 'start_enigma'].includes(type)) {
    const requestedEnigma = enigma || getProjectEnigma(state.project, action.id);
    if (!requestedEnigma) return withResult(state, action, { ok: false, engine: 'enigma', reason: 'not_found' });
    const pieceCount = Math.max(4, (Number(requestedEnigma.gridRows) || 3) * (Number(requestedEnigma.gridCols) || 3));
    const activeEnigmaState = enigmaEngine.getEnigmaInitialState(requestedEnigma, pieceCount);
    return withResult({
      ...state,
      activeEnigma: { enigma: requestedEnigma, hotspot: action.hotspot || null },
      activeEnigmaState,
      dialogue: requestedEnigma.question || state.dialogue,
    }, action, { ok: true, engine: 'enigma', enigma: requestedEnigma, state: activeEnigmaState });
  }

  if (['enigma/update', 'enigma_update', 'update_enigma'].includes(type)) {
    const activeEnigmaState = {
      ...state.activeEnigmaState,
      ...(action.patch || action.state || {}),
    };
    return withResult({ ...state, activeEnigmaState }, action, { ok: true, engine: 'enigma', state: activeEnigmaState });
  }

  if (['enigma/submit', 'enigma_submit', 'submit_enigma', 'solve_enigma'].includes(type)) {
    const activeEnigma = enigma || getProjectEnigma(state.project, action.id) || state.activeEnigma?.enigma;
    if (!activeEnigma) return withResult(state, action, { ok: false, engine: 'enigma', reason: 'not_started' });
    const answer = action.answer || state.activeEnigmaState || {};
    const isSolved = enigmaEngine.validateEnigmaAnswer(activeEnigma, answer);
    if (!isSolved) {
      return withResult({
        ...state,
        dialogue: activeEnigma.failMessage || "Ce n'est pas la bonne réponse.",
      }, action, { ok: false, engine: 'enigma', solved: false, enigma: activeEnigma });
    }

    let nextState = {
      ...state,
      solvedEnigmaIds: addUnique(state.solvedEnigmaIds, activeEnigma.id),
      activeEnigma: null,
      activeEnigmaState: {},
      dialogue: activeEnigma.successMessage || 'Énigme résolue.',
    };

    if (state.activeEnigma?.hotspot && activeEnigma.unlockType !== 'none') {
      nextState = applyHotspotSideEffectsToState(nextState, state.activeEnigma.hotspot);
    }

    if (activeEnigma.unlockType === 'scene' && activeEnigma.targetSceneId) {
      const nextScene = getProjectScene(state.project, activeEnigma.targetSceneId);
      if (nextScene) {
        nextState = {
          ...nextState,
          currentSceneId: nextScene.id,
          dialogue: nextScene.introText || activeEnigma.successMessage || 'Nouvelle scène débloquée.',
        };
      }
    } else if (activeEnigma.unlockType === 'cinematic' && activeEnigma.targetCinematicId) {
      const cinematic = getProjectCinematic(state.project, activeEnigma.targetCinematicId);
      if (cinematic) {
        nextState = {
          ...nextState,
          playingCinematic: cinematic,
          playingSlideIndex: 0,
          launchedCinematicIds: addUnique(nextState.launchedCinematicIds, cinematic.id),
        };
      }
    } else if (state.activeEnigma?.hotspot) {
      const hotspotState = applyHotspotSideEffectsToState(nextState, state.activeEnigma.hotspot);
      nextState = {
        ...hotspotState,
      };
      if (state.activeEnigma.hotspot.actionType === 'scene' && state.activeEnigma.hotspot.targetSceneId) {
        const nextScene = getProjectScene(state.project, state.activeEnigma.hotspot.targetSceneId);
        if (nextScene) {
          nextState = {
            ...nextState,
            currentSceneId: nextScene.id,
            dialogue: nextScene.introText || state.activeEnigma.hotspot.dialogue || 'Nouvelle scène.',
          };
        }
      }
      if (state.activeEnigma.hotspot.actionType === 'cinematic' && state.activeEnigma.hotspot.targetCinematicId) {
        const cinematic = getProjectCinematic(state.project, state.activeEnigma.hotspot.targetCinematicId);
        if (cinematic) {
          nextState = {
            ...nextState,
            playingCinematic: cinematic,
            playingSlideIndex: 0,
            launchedCinematicIds: addUnique(nextState.launchedCinematicIds, cinematic.id),
          };
        }
      }
    }

    return withResult(nextState, action, { ok: true, engine: 'enigma', solved: true, enigma: activeEnigma });
  }

  if (['enigma/close', 'enigma_close', 'close_enigma'].includes(type)) {
    return withResult({
      ...state,
      activeEnigma: null,
      activeEnigmaState: {},
    }, action, { ok: true, engine: 'enigma', closed: true });
  }

  return withResult(state, action, { ok: false, engine: 'enigma', reason: 'unknown_action' });
}

function reduceCombinationAction(state, action) {
  const type = getActionType(action).toLowerCase();
  if (!['combination/combine', 'combination_combine', 'combine_items', 'combine'].includes(type)) {
    return withResult(state, action, { ok: false, engine: 'combination', reason: 'unknown_action' });
  }

  const itemA = action.itemA || action.item1 || action.firstId;
  const itemB = action.itemB || action.item2 || action.secondId;
  const combination = combinationEngine.combineItems(
    itemA,
    itemB,
    state.project?.combinations,
    getCombinationContext(state),
  );

  if (combination?.blocked) {
    return withResult({
      ...state,
      dialogue: combination.failMessage || 'Les conditions ne sont pas reunies.',
    }, action, { ok: false, engine: 'combination', blocked: true, combination });
  }

  const resultItemId = combinationEngine.getCombinationResult(combination);
  if (!resultItemId) {
    return withResult({
      ...state,
      dialogue: 'Ces deux objets ne peuvent pas être combines.',
    }, action, { ok: false, engine: 'combination', combination: null });
  }

  let inventory = state.inventory;
  if (combination.consume ?? true) {
    inventory = removeOne(removeOne(inventory, itemA), itemB);
  }
  inventory = addUnique(inventory, resultItemId);
  const resultItem = getProjectItem(state.project, resultItemId);

  return withResult({
    ...state,
    inventory,
    selectedInventoryIds: [resultItemId],
    completedCombinationIds: addUnique(state.completedCombinationIds, combination.id),
    dialogue: combination.message || `Tu obtiens ${resultItem?.name || 'un nouvel objet'}.`,
    viewerImage: createInventoryViewerImage(state.project, resultItem),
  }, action, { ok: true, engine: 'combination', combination, resultItemId, resultItem });
}

function applyHotspotSideEffectsToState(state, hotspot, sourceHotspotId = hotspot?.id) {
  let nextState = { ...state };

  if (hotspot.dialogue) nextState.dialogue = hotspot.dialogue;

  const rewardItemId = getHotspotRewardItemId(hotspot);

  if (rewardItemId) {
    nextState.inventory = addRewardItemToInventory(nextState.inventory, rewardItemId);
    nextState.selectedInventoryIds = selectRewardInventoryItem(nextState.selectedInventoryIds, rewardItemId);
    const rewardItem = getProjectItem(state.project, rewardItemId);
    if (!hotspot.dialogue) nextState.dialogue = `Tu obtiens ${rewardItem?.name || hotspot.name || 'un objet'}.`;
  }

  const hotspotImageSrc = resolveAssetUrl(state.project, hotspot.objectImageId, hotspot.objectImageData);
  const rewardViewer = rewardItemId ? createInventoryViewerImage(state.project, rewardItemId) : null;
  if (hotspotImageSrc) {
    nextState.viewerImage = createHotspotViewerImage(hotspot, hotspotImageSrc);
  } else if (rewardViewer) {
    nextState.viewerImage = rewardViewer;
  }

  nextState = applyHotspotBlockState(nextState, hotspot, { removedKey: 'usedSceneObjectIds' });

  if (hotspot.consumeRequiredItemOnUse && hotspot.requiredItemId) {
    nextState.inventory = consumeInventoryItem(nextState.inventory, hotspot.requiredItemId);
    nextState.selectedInventoryIds = nextState.selectedInventoryIds.filter((itemId) => itemId !== hotspot.requiredItemId);
    if (nextState.viewerImage?.id === hotspot.requiredItemId) nextState.viewerImage = null;
  }

  if (sourceHotspotId && !hotspot.logicRuleFailed) {
    nextState.completedHotspotIds = addUnique(nextState.completedHotspotIds, sourceHotspotId);
  }
  if (hotspot.disableAfterUse && hotspot.logicRuleId) {
    nextState.usedLogicRuleIds = addUnique(nextState.usedLogicRuleIds, hotspot.logicRuleId);
  }

  return nextState;
}

export function resolveHotspotInteraction(spot, context = {}) {
  if (!spot) return null;

  const logicRules = Array.isArray(spot.logicRules) ? spot.logicRules : [];
  const completedHotspotIds = Array.isArray(context.completedHotspotIds) ? context.completedHotspotIds : [];
  const usedLogicRuleIds = Array.isArray(context.usedLogicRuleIds) ? context.usedLogicRuleIds : [];
  const usedRule = logicRules.find((rule) => rule.disableAfterUse && usedLogicRuleIds.includes(rule.id));
  const ruleContext = {
    ...context,
    hotspotId: context.hotspotId || spot.id,
  };
  const doesRuleMatch = (rule) => evaluateLogicRuleCondition(rule, ruleContext);
  const matchingRule = logicRules.find(doesRuleMatch);

  if (matchingRule) {
    const useDefaultAction = matchingRule.actionType === 'default';
    return {
      ...spot,
      actionType: useDefaultAction ? spot.actionType : matchingRule.actionType || 'dialogue',
      dialogue: matchingRule.dialogue || spot.dialogue || '',
      requiredItemId: matchingRule.conditionType === 'has_item' ? matchingRule.itemId || '' : '',
      consumeRequiredItemOnUse: Boolean(matchingRule.consumeRequiredItemOnUse),
      rewardItemId: matchingRule.rewardItemId || (useDefaultAction ? spot.rewardItemId || '' : ''),
      targetSceneId: useDefaultAction ? spot.targetSceneId || '' : matchingRule.targetSceneId || '',
      targetCinematicId: useDefaultAction ? spot.targetCinematicId || '' : matchingRule.targetCinematicId || '',
      enigmaId: useDefaultAction ? spot.enigmaId || '' : matchingRule.enigmaId || '',
      blockActionType: matchingRule.blockActionType || 'show',
      targetBlockId: matchingRule.targetBlockId || '',
      targetBlockText: matchingRule.targetBlockText || '',
      objectImageData: useDefaultAction ? spot.objectImageData || '' : matchingRule.objectImageData || '',
      objectImageName: useDefaultAction ? spot.objectImageName || '' : matchingRule.objectImageName || '',
      soundId: matchingRule.successSoundId || (useDefaultAction ? spot.soundId || '' : ''),
      soundData: matchingRule.successSoundData || (useDefaultAction ? spot.soundData || '' : ''),
      soundName: matchingRule.successSoundName || (useDefaultAction ? spot.soundName || '' : ''),
      logicRuleId: matchingRule.id || '',
      disableAfterUse: Boolean(matchingRule.disableAfterUse),
    };
  }

  const unmetRule = logicRules.find((rule) => (
    isLogicRuleAvailable(rule, ruleContext)
    && isLogicRuleConfigured(rule)
    && (rule.failureDialogue || rule.failureSoundData || rule.failureSoundId)
    && !doesRuleMatch(rule)
  ));
  if (unmetRule) {
    return {
      ...spot,
      actionType: 'dialogue',
      dialogue: unmetRule.failureDialogue,
      requiredItemId: '',
      consumeRequiredItemOnUse: false,
      rewardItemId: '',
      targetSceneId: '',
      targetCinematicId: '',
      enigmaId: '',
      objectImageData: '',
      objectImageName: '',
      soundId: unmetRule.failureSoundId || '',
      soundData: unmetRule.failureSoundData || '',
      soundName: unmetRule.failureSoundName || '',
      logicRuleFailed: true,
      failedLogicRuleId: unmetRule.id || '',
    };
  }

  const useSecondAction = Boolean(spot.hasSecondAction && completedHotspotIds.includes(spot.id));
  if (!useSecondAction) {
    return usedRule?.conditionType === 'has_item' ? {
      ...spot,
      requiredItemId: '',
      consumeRequiredItemOnUse: false,
      soundId: '',
      soundData: '',
      soundName: '',
    } : spot;
  }

  return {
    ...spot,
    actionType: spot.secondActionType || 'dialogue',
    dialogue: spot.secondDialogue || '',
    requiredItemId: spot.secondRequiredItemId || '',
    consumeRequiredItemOnUse: Boolean(spot.secondConsumeRequiredItemOnUse),
    rewardItemId: spot.secondRewardItemId || '',
    targetSceneId: spot.secondTargetSceneId || '',
    targetCinematicId: spot.secondTargetCinematicId || '',
    enigmaId: spot.secondEnigmaId || '',
    objectImageId: spot.secondObjectImageId || '',
    objectImageData: spot.secondObjectImageData || '',
    objectImageName: spot.secondObjectImageName || '',
  };
}

function reduceHotspotAction(state, action) {
  const type = getActionType(action).toLowerCase();
  if (!['hotspot/trigger', 'hotspot_trigger', 'trigger_hotspot'].includes(type)) {
    return withResult(state, action, { ok: false, engine: 'hotspot', reason: 'unknown_action' });
  }

  const { hotspot: sourceHotspot, scene } = action.hotspot
    ? { hotspot: action.hotspot, scene: action.scene || getProjectScene(state.project, state.currentSceneId) }
    : getProjectHotspot(state.project, action.id || action.hotspotId, state.currentSceneId);

  if (!sourceHotspot) return withResult(state, action, { ok: false, engine: 'hotspot', reason: 'not_found' });

  const hotspot = action.hotspot
    ? sourceHotspot
    : resolveHotspotInteraction(
      sourceHotspot,
      getHotspotConditionContext(state, sourceHotspot.id),
    ) || sourceHotspot;

  if (hotspot.requiredHotspotId && !state.completedHotspotIds.includes(hotspot.requiredHotspotId)) {
    return withResult({
      ...state,
      dialogue: hotspot.lockedMessage || 'Je ne peux pas faire ca maintenant.',
    }, action, { ok: false, engine: 'hotspot', locked: true, hotspot, scene });
  }

  if (hotspot.requiredItemId && !state.inventory.includes(hotspot.requiredItemId)) {
    const item = getProjectItem(state.project, hotspot.requiredItemId);
    return withResult({
      ...state,
      dialogue: `Il te faut ${item?.name || 'un objet'} pour faire ca.`,
    }, action, { ok: false, engine: 'hotspot', missingItem: hotspot.requiredItemId, hotspot, scene });
  }

  if (hotspot.enigmaId) {
    const enigma = getProjectEnigma(state.project, hotspot.enigmaId);
    if (enigma) {
      return reduceEnigmaAction(state, {
        ...action,
        type: 'enigma/start',
        enigma,
        hotspot,
      });
    }
  }

  let nextState = applyHotspotSideEffectsToState(state, hotspot, hotspot.id);

  if (hotspot.actionType === 'scene' && hotspot.targetSceneId) {
    const nextScene = getProjectScene(state.project, hotspot.targetSceneId);
    if (nextScene) {
      nextState = {
        ...nextState,
        currentSceneId: nextScene.id,
        dialogue: nextScene.introText || hotspot.dialogue || 'Nouvelle scène.',
      };
    }
  }

  if (hotspot.actionType === 'cinematic' && hotspot.targetCinematicId) {
    const cinematic = getProjectCinematic(state.project, hotspot.targetCinematicId);
    if (cinematic) {
      nextState = {
        ...nextState,
        playingCinematic: cinematic,
        playingSlideIndex: 0,
        launchedCinematicIds: addUnique(nextState.launchedCinematicIds, cinematic.id),
      };
    }
  }

  return withResult(nextState, action, {
    ok: !hotspot.logicRuleFailed,
    engine: 'hotspot',
    hotspot,
    scene,
    logicRuleFailed: Boolean(hotspot.logicRuleFailed),
    failedLogicRuleId: hotspot.failedLogicRuleId || '',
  });
}

function applyCinematicEndToState(state, cinematic) {
  const endEvent = cinematicEngine.resolveCinematicEnd(cinematic, state.project, {
    getItemById: (itemId) => getProjectItem(state.project, itemId),
  });

  if (endEvent.type === 'scene' && endEvent.sceneId) {
    return {
      ...state,
      currentSceneId: endEvent.sceneId,
      dialogue: endEvent.dialogue || getProjectScene(state.project, endEvent.sceneId)?.introText || state.dialogue,
    };
  }

  if (endEvent.type === 'act' && endEvent.sceneId) {
    return {
      ...state,
      currentSceneId: endEvent.sceneId,
      dialogue: endEvent.dialogue || state.dialogue,
    };
  }

  if (endEvent.type === 'item' && endEvent.itemId) {
    const rewardItem = endEvent.rewardItem || getProjectItem(state.project, endEvent.itemId);
    return {
      ...state,
      inventory: addUnique(state.inventory, endEvent.itemId),
      selectedInventoryIds: addUnique(state.selectedInventoryIds, endEvent.itemId).slice(-2),
      dialogue: endEvent.dialogue || `Tu obtiens ${rewardItem?.name || 'un nouvel objet'}.`,
      viewerImage: createInventoryViewerImage(state.project, rewardItem) || state.viewerImage,
    };
  }

  return state;
}

function reduceCinematicAction(state, action) {
  const type = getActionType(action).toLowerCase();
  const cinematic = action.cinematic || getProjectCinematic(state.project, action.cinematicId || action.id);

  if (['cinematic/start', 'cinematic_start', 'start_cinematic'].includes(type)) {
    if (!cinematic) return withResult(state, action, { ok: false, engine: 'cinematic', reason: 'not_found' });
    return withResult({
      ...state,
      playingCinematic: cinematic,
      playingSlideIndex: 0,
      launchedCinematicIds: addUnique(state.launchedCinematicIds, cinematic.id),
    }, action, { ok: true, engine: 'cinematic', cinematic });
  }

  if (['cinematic/advance', 'cinematic_advance', 'advance_cinematic'].includes(type)) {
    const playingCinematic = cinematic || state.playingCinematic;
    if (!playingCinematic) return withResult(state, action, { ok: false, engine: 'cinematic', reason: 'not_started' });
    const nextIndex = cinematicEngine.getNextCinematicSlideIndex(playingCinematic, state.playingSlideIndex);
    if (nextIndex !== null) {
      return withResult({
        ...state,
        playingSlideIndex: nextIndex,
      }, action, { ok: true, engine: 'cinematic', advanced: true, slideIndex: nextIndex });
    }

    const endedState = applyCinematicEndToState(state, playingCinematic);
    return withResult({
      ...endedState,
      playingCinematic: null,
      playingSlideIndex: 0,
    }, action, { ok: true, engine: 'cinematic', ended: true, cinematic: playingCinematic });
  }

  if (['cinematic/close', 'cinematic_close', 'close_cinematic'].includes(type)) {
    const playingCinematic = cinematic || state.playingCinematic;
    const endedState = playingCinematic ? applyCinematicEndToState(state, playingCinematic) : state;
    return withResult({
      ...endedState,
      playingCinematic: null,
      playingSlideIndex: 0,
    }, action, { ok: true, engine: 'cinematic', closed: true, cinematic: playingCinematic || null });
  }

  return withResult(state, action, { ok: false, engine: 'cinematic', reason: 'unknown_action' });
}

function reduceGameAction(state, action) {
  const type = getActionType(action).toLowerCase();

  if (['game/init', 'game_init', 'init_game', 'init'].includes(type)) {
    return withResult(createGameState(action.project || state.project, action.state || action.patch || {}), action, { ok: true, engine: 'game' });
  }

  if (['game/reset', 'game_reset', 'reset_game', 'reset'].includes(type)) {
    return withResult(createGameState(action.project || state.project, action.patch || {}), action, { ok: true, engine: 'game' });
  }

  if (['game/set_state', 'game/setstate', 'set_game_state', 'set_state'].includes(type)) {
    return withResult({ ...state, ...(action.state || action.patch || {}) }, action, { ok: true, engine: 'game' });
  }

  if (['game/set_scene', 'game_set_scene', 'set_scene', 'enter_scene'].includes(type)) {
    const currentSceneId = action.sceneId || action.currentSceneId || action.id || '';
    const scene = getProjectScene(state.project, currentSceneId);
    return withResult({
      ...state,
      currentSceneId,
      dialogue: action.dialogue ?? scene?.introText ?? state.dialogue,
    }, action, { ok: Boolean(scene), engine: 'game', scene });
  }

  if (['inventory/add', 'inventory_add', 'add_item'].includes(type)) {
    return withResult({
      ...state,
      inventory: addUnique(state.inventory, action.itemId),
      selectedInventoryIds: addUnique(state.selectedInventoryIds, action.itemId).slice(-2),
      viewerImage: createInventoryViewerImage(state.project, action.itemId) || state.viewerImage,
    }, action, { ok: true, engine: 'game', itemId: action.itemId });
  }

  if (['inventory/remove', 'inventory_remove', 'remove_item'].includes(type)) {
    return withResult({
      ...state,
      inventory: state.inventory.filter((itemId) => itemId !== action.itemId),
      selectedInventoryIds: state.selectedInventoryIds.filter((itemId) => itemId !== action.itemId),
    }, action, { ok: true, engine: 'game', itemId: action.itemId });
  }

  return withResult(state, action, { ok: false, engine: 'game', reason: 'unknown_action' });
}

function routeAction(state, action) {
  const type = getActionType(action).toLowerCase();
  if (type.startsWith('enigma') || type.includes('_enigma')) return reduceEnigmaAction(state, action);
  if (type.startsWith('combination') || type.includes('_combination') || type === 'combine_items') return reduceCombinationAction(state, action);
  if (type.startsWith('cinematic') || type.includes('_cinematic')) return reduceCinematicAction(state, action);
  if (type.startsWith('hotspot') || type.includes('_hotspot')) return reduceHotspotAction(state, action);
  if (type === 'combine') return reduceCombinationAction(state, action);
  return reduceGameAction(state, action);
}

export function dispatch(action = {}) {
  gameState = normalizeGameState(routeAction(normalizeGameState(gameState), action));
  return gameState;
}

export function createGameEngine(project = {}, patch = {}) {
  let state = createGameState(project, patch);
  return {
    getState: () => state,
    setState: (nextState = {}) => {
      state = normalizeGameState({ ...state, ...nextState });
      return state;
    },
    reset: (nextProject = state.project, nextPatch = {}) => {
      state = createGameState(nextProject, nextPatch);
      return state;
    },
    dispatch: (action = {}) => {
      state = normalizeGameState(routeAction(normalizeGameState(state), action));
      return state;
    },
  };
}

export function formatTimerSeconds(seconds = 0) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remaining = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`;
}

export const isPreloadableUrl = (value) => typeof value === 'string' && value.trim() && !value.startsWith('#');

export const addMediaUrl = (set, value) => {
  if (isPreloadableUrl(value)) set.add(value);
};

export function collectSceneMediaUrls(scene, imageUrls, audioUrls) {
  if (!scene) return;
  addMediaUrl(imageUrls, scene.backgroundData);
  addMediaUrl(audioUrls, scene.musicData);
  addMediaUrl(audioUrls, scene.ambientSoundData);
  (scene.sceneObjects || []).forEach((object) => {
    addMediaUrl(imageUrls, object.imageData);
    addMediaUrl(imageUrls, object.popupImageData || object.popupImage);
    addMediaUrl(imageUrls, object.objectImageData);
    addMediaUrl(audioUrls, object.soundData);
    (object.logicRules || []).forEach((rule) => {
      addMediaUrl(audioUrls, rule.successSoundData);
      addMediaUrl(audioUrls, rule.failureSoundData);
    });
    (object.anime2dSpec?.layers || []).forEach((layer) => addMediaUrl(imageUrls, normalizeAnime2dLayer(layer).src));
  });
  (scene.hotspots || []).forEach((spot) => {
    addMediaUrl(imageUrls, spot.objectImageData);
    addMediaUrl(imageUrls, spot.secondObjectImageData);
    addMediaUrl(audioUrls, spot.soundData);
    (spot.logicRules || []).forEach((rule) => {
      addMediaUrl(audioUrls, rule.successSoundData);
      addMediaUrl(audioUrls, rule.failureSoundData);
    });
  });
}

export function getSceneBackgroundUrl(project = {}, scene = {}) {
  return resolveAssetUrl(project, scene?.backgroundId, scene?.backgroundData);
}

export function getSceneMusicUrl(project = {}, scene = {}) {
  return resolveAssetUrl(project, scene?.musicId, scene?.musicData);
}

export function getSceneAmbientSoundUrl(project = {}, scene = {}) {
  return resolveAssetUrl(project, scene?.ambientSoundId, scene?.ambientSoundData);
}

export function collectCinematicMediaUrls(cinematic, imageUrls, audioUrls, videoUrls) {
  if (!cinematic) return;
  const normalized = normalizeCinematic(cinematic);
  addMediaUrl(videoUrls, normalized.videoData);
  if (normalized.cinematicType === 'anime2d') {
    (normalized.anime2dSpec?.layers || []).forEach((layer) => addMediaUrl(imageUrls, normalizeAnime2dLayer(layer).src));
  }
  normalized.slides.forEach((slide) => {
    addMediaUrl(imageUrls, slide.imageData);
    addMediaUrl(audioUrls, slide.audioData);
  });
  normalized.steps.forEach((step) => {
    if (step.type === 'image') addMediaUrl(imageUrls, step.src);
    if (step.type === 'audio') addMediaUrl(audioUrls, step.src);
    if (step.type === 'video') addMediaUrl(videoUrls, step.src);
    if (step.type === 'anime2d') {
      (step.spec?.layers || []).forEach((layer) => addMediaUrl(imageUrls, normalizeAnime2dLayer(layer).src));
    }
  });
}

export function collectActMediaUrls(project, actId) {
  const imageUrls = new Set();
  const audioUrls = new Set();
  const videoUrls = new Set();
  const enigmaIds = new Set();
  const cinematicIds = new Set();
  const itemIds = new Set();
  const scenes = (project.scenes || []).filter((scene) => (scene.actId || '') === (actId || ''));

  scenes.forEach((scene) => {
    collectSceneMediaUrls(scene, imageUrls, audioUrls);
    if (scene.timerTargetCinematicId) cinematicIds.add(scene.timerTargetCinematicId);
    (scene.sceneObjects || []).forEach((object) => {
      if (object.linkedItemId) itemIds.add(object.linkedItemId);
    });
    (scene.hotspots || []).forEach((spot) => {
      if (spot.enigmaId) enigmaIds.add(spot.enigmaId);
      if (spot.targetCinematicId) cinematicIds.add(spot.targetCinematicId);
      if (spot.secondEnigmaId) enigmaIds.add(spot.secondEnigmaId);
      if (spot.secondTargetCinematicId) cinematicIds.add(spot.secondTargetCinematicId);
      if (spot.rewardItemId) itemIds.add(spot.rewardItemId);
      if (spot.secondRewardItemId) itemIds.add(spot.secondRewardItemId);
      (spot.logicRules || []).forEach((rule) => {
        if (rule.enigmaId) enigmaIds.add(rule.enigmaId);
        if (rule.targetCinematicId) cinematicIds.add(rule.targetCinematicId);
        if (rule.rewardItemId) itemIds.add(rule.rewardItemId);
      });
    });
  });

  (project.enigmas || []).forEach((enigma) => {
    if (!enigmaIds.has(enigma.id)) return;
    addMediaUrl(imageUrls, enigma.imageData);
    addMediaUrl(imageUrls, enigma.popupBackgroundData);
    if (enigma.targetCinematicId) cinematicIds.add(enigma.targetCinematicId);
  });

  (project.cinematics || []).forEach((cinematic) => {
    if (cinematicIds.has(cinematic.id)) collectCinematicMediaUrls(cinematic, imageUrls, audioUrls, videoUrls);
  });

  (project.items || []).forEach((item) => {
    if (itemIds.has(item.id) || scenes.length === 0) addMediaUrl(imageUrls, item.imageData);
  });

  return {
    imageUrls: Array.from(imageUrls),
    audioUrls: Array.from(audioUrls),
    videoUrls: Array.from(videoUrls),
  };
}

export function collectNearbySceneMediaUrls(project, playScene) {
  const imageUrls = new Set();
  const audioUrls = new Set();
  if (!playScene) return { imageUrls: [], audioUrls: [] };

  const scenesById = new Map((project.scenes || []).map((scene) => [scene.id, scene]));
  const nearbySceneIds = new Set([
    playScene.id,
    playScene.timerTargetSceneId,
    ...(playScene.hotspots || []).flatMap((spot) => [
      spot.targetSceneId,
      spot.secondTargetSceneId,
    ]),
  ].filter(Boolean));

  nearbySceneIds.forEach((sceneId) => collectSceneMediaUrls(scenesById.get(sceneId), imageUrls, audioUrls));
  collectSceneMediaUrls(playScene, imageUrls, audioUrls);

  return {
    imageUrls: Array.from(imageUrls),
    audioUrls: Array.from(audioUrls),
  };
}

export function getSceneMusicKey(scene) {
  if (!scene?.musicId && !scene?.musicName && !scene?.musicData) return '';
  return scene.musicName || scene.musicId || scene.musicData;
}

export function getSceneAmbientSoundKey(scene) {
  if (!scene?.ambientSoundId && !scene?.ambientSoundName && !scene?.ambientSoundData) return '';
  return scene.ambientSoundName || scene.ambientSoundId || scene.ambientSoundData;
}

export function getSceneTimerConfig(scene) {
  const timerSeconds = Number(scene?.timerSeconds) || 0;
  const isEnabled = Boolean(scene?.timerEnabled && timerSeconds > 0);
  return {
    isEnabled,
    seconds: timerSeconds,
    key: isEnabled
      ? `${scene.id}:${timerSeconds}:${scene.timerEndAction || 'none'}:${scene.timerTargetSceneId || ''}:${scene.timerTargetCinematicId || ''}`
      : '',
  };
}

export function createSceneTransitionOverlay(previousScene, nextScene, now = Date.now()) {
  if (!previousScene?.id || !nextScene?.id || previousScene.id === nextScene.id) return null;
  const transition = previousScene.sceneTransition || 'none';
  if (transition === 'none') return null;
  const duration = Number(previousScene.sceneTransitionDuration) || 700;
  return {
    key: `${previousScene.id}-${nextScene.id}-${now}`,
    type: transition,
    duration,
    previousScene,
  };
}
