import { useState } from 'react';
import {
  DEFAULT_COLOR_SEQUENCE,
  DEFAULT_PLAYER_LIVES,
} from './previewPlayerDefaults.js';
import { getInitialStoryVariables } from './previewSaveState.js';

export function usePreviewCoreState(project, initialScene) {
  const [playSceneId, setPlaySceneId] = useState(initialScene?.id || '');
  const [visitedSceneIds, setVisitedSceneIds] = useState(initialScene?.id ? [initialScene.id] : []);
  const [storyVariables, setStoryVariables] = useState(() => getInitialStoryVariables(project));
  const [adventureJournalEntries, setAdventureJournalEntries] = useState([]);
  const [dialogue, setDialogue] = useState(initialScene?.introText || '');
  const [completedHotspotIds, setCompletedHotspotIds] = useState([]);
  const [solvedEnigmaIds, setSolvedEnigmaIds] = useState([]);
  const [launchedCinematicIds, setLaunchedCinematicIds] = useState([]);
  const [completedCombinationIds, setCompletedCombinationIds] = useState([]);
  const [usedLogicRuleIds, setUsedLogicRuleIds] = useState([]);
  const [usedSceneObjectIds, setUsedSceneObjectIds] = useState([]);
  const [revealedSceneObjectIds, setRevealedSceneObjectIds] = useState([]);
  const [sceneObjectTextOverrides, setSceneObjectTextOverrides] = useState({});
  const [viewerImage, setViewerImage] = useState(null);
  const [lastChoiceSnapshot, setLastChoiceSnapshot] = useState(null);

  return {
    playSceneId,
    setPlaySceneId,
    visitedSceneIds,
    setVisitedSceneIds,
    storyVariables,
    setStoryVariables,
    adventureJournalEntries,
    setAdventureJournalEntries,
    dialogue,
    setDialogue,
    completedHotspotIds,
    setCompletedHotspotIds,
    solvedEnigmaIds,
    setSolvedEnigmaIds,
    launchedCinematicIds,
    setLaunchedCinematicIds,
    completedCombinationIds,
    setCompletedCombinationIds,
    usedLogicRuleIds,
    setUsedLogicRuleIds,
    usedSceneObjectIds,
    setUsedSceneObjectIds,
    revealedSceneObjectIds,
    setRevealedSceneObjectIds,
    sceneObjectTextOverrides,
    setSceneObjectTextOverrides,
    viewerImage,
    setViewerImage,
    lastChoiceSnapshot,
    setLastChoiceSnapshot,
  };
}

export function usePreviewInventoryState() {
  const [inventory, setInventory] = useState([]);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);
  const [draggedInventoryId, setDraggedInventoryId] = useState(null);

  return {
    inventory,
    setInventory,
    selectedInventoryIds,
    setSelectedInventoryIds,
    draggedInventoryId,
    setDraggedInventoryId,
  };
}

export function usePreviewCinematicState() {
  const [playingCinematic, setPlayingCinematic] = useState(null);
  const [playingSlideIndex, setPlayingSlideIndex] = useState(0);

  return {
    playingCinematic,
    setPlayingCinematic,
    playingSlideIndex,
    setPlayingSlideIndex,
  };
}

export function usePreviewConversationState() {
  const [chosenConversationReplyIds, setChosenConversationReplyIds] = useState([]);
  const [askedConversationNodeIds, setAskedConversationNodeIds] = useState([]);
  const [hiddenConversationReplyIds, setHiddenConversationReplyIds] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeEnding, setActiveEnding] = useState(null);
  const [choiceEffectNotices, setChoiceEffectNotices] = useState([]);

  return {
    chosenConversationReplyIds,
    setChosenConversationReplyIds,
    askedConversationNodeIds,
    setAskedConversationNodeIds,
    hiddenConversationReplyIds,
    setHiddenConversationReplyIds,
    activeConversation,
    setActiveConversation,
    activeEnding,
    setActiveEnding,
    choiceEffectNotices,
    setChoiceEffectNotices,
  };
}

export function usePreviewEnigmaState() {
  const [activeEnigma, setActiveEnigma] = useState(null);
  const [enigmaCodeInput, setEnigmaCodeInput] = useState('');
  const [enigmaColorAttempt, setEnigmaColorAttempt] = useState(DEFAULT_COLOR_SEQUENCE);
  const [enigmaPuzzleOrder, setEnigmaPuzzleOrder] = useState([]);
  const [enigmaPuzzleSelectedIndex, setEnigmaPuzzleSelectedIndex] = useState(null);
  const [enigmaDragBank, setEnigmaDragBank] = useState([]);
  const [enigmaDragSlots, setEnigmaDragSlots] = useState([]);
  const [enigmaDraggedPiece, setEnigmaDraggedPiece] = useState(null);
  const [enigmaRotationAngles, setEnigmaRotationAngles] = useState([]);
  const [simonPlaybackIndex, setSimonPlaybackIndex] = useState(-1);
  const [simonPlayerTurn, setSimonPlayerTurn] = useState(false);

  return {
    activeEnigma,
    setActiveEnigma,
    enigmaCodeInput,
    setEnigmaCodeInput,
    enigmaColorAttempt,
    setEnigmaColorAttempt,
    enigmaPuzzleOrder,
    setEnigmaPuzzleOrder,
    enigmaPuzzleSelectedIndex,
    setEnigmaPuzzleSelectedIndex,
    enigmaDragBank,
    setEnigmaDragBank,
    enigmaDragSlots,
    setEnigmaDragSlots,
    enigmaDraggedPiece,
    setEnigmaDraggedPiece,
    enigmaRotationAngles,
    setEnigmaRotationAngles,
    simonPlaybackIndex,
    setSimonPlaybackIndex,
    simonPlayerTurn,
    setSimonPlayerTurn,
  };
}

export function usePreviewHeroCombatState(initialHeroAdventure) {
  const [heroState, setHeroState] = useState(initialHeroAdventure.hero);
  const [heroSetupComplete, setHeroSetupComplete] = useState(!initialHeroAdventure.enabled);
  const [lastDiceRoll, setLastDiceRoll] = useState(null);
  const [heroCombatStates, setHeroCombatStates] = useState({});
  const [activeHeroCombat, setActiveHeroCombat] = useState(null);
  const [equippedHeroItemIds, setEquippedHeroItemIds] = useState([]);
  const [equippedHeroSlotMap, setEquippedHeroSlotMap] = useState({});

  return {
    heroState,
    setHeroState,
    heroSetupComplete,
    setHeroSetupComplete,
    lastDiceRoll,
    setLastDiceRoll,
    heroCombatStates,
    setHeroCombatStates,
    activeHeroCombat,
    setActiveHeroCombat,
    equippedHeroItemIds,
    setEquippedHeroItemIds,
    equippedHeroSlotMap,
    setEquippedHeroSlotMap,
  };
}

export function usePreviewTimerState() {
  const [playerLives, setPlayerLives] = useState(DEFAULT_PLAYER_LIVES);
  const [sceneTimerResetKey, setSceneTimerResetKey] = useState(0);

  return {
    playerLives,
    setPlayerLives,
    sceneTimerResetKey,
    setSceneTimerResetKey,
  };
}
