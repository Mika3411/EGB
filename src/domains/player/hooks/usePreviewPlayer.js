import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  addRewardItemToInventory,
  createGameEngine,
  createHotspotViewerImage,
  gameActions,
  getHotspotRewardItemId,
  resolveHotspotInteraction as resolveSharedHotspotInteraction,
  selectRewardInventoryItem,
} from '../../../shared/services/gameEngine';
import { resolveAssetUrl } from '../../../shared/services/assetManager';
import { getHotspotLinkUrl, isHotspotLinkAction } from '../../../shared/services/hotspotLinks.js';
import {
  addUnique,
  clampNumber,
  normalizeHeroAdventure,
} from './preview/previewPlayerDefaults.js';
import { createPreviewConversationActions } from './preview/previewConversationActions.js';
import { createPreviewEnigmaActions } from './preview/previewEnigmaActions.js';
import { createPreviewHeroCombatActions } from './preview/previewHeroCombatActions.js';
import { createPreviewInventoryActions } from './preview/previewInventoryActions.js';
import {
  createPreviewSaveStateActions,
} from './preview/previewSaveState.js';
import {
  usePreviewCinematicState,
  usePreviewConversationState,
  usePreviewCoreState,
  usePreviewEnigmaState,
  usePreviewHeroCombatState,
  usePreviewInventoryState,
  usePreviewTimerState,
} from './preview/previewPlayerStateHooks.js';
import {
  getObjectiveFinalSceneBlockMessage,
  shouldBlockObjectiveFinalScene,
} from '../../../shared/services/conditionEngine.js';

export function usePreviewPlayer(project, { getItemById } = {}) {
  const initialScene = project.scenes.find((scene) => scene.id === project.start?.targetSceneId) || project.scenes[0] || null;
  const initialHeroAdventure = normalizeHeroAdventure(project);
  const engineRef = useRef(null);
  if (!engineRef.current || engineRef.current.getState().project !== project) {
    engineRef.current = createGameEngine(project);
  }
  const coreState = usePreviewCoreState(project, initialScene);
  const inventoryState = usePreviewInventoryState();
  const cinematicState = usePreviewCinematicState();
  const conversationState = usePreviewConversationState();
  const enigmaState = usePreviewEnigmaState();
  const heroCombatState = usePreviewHeroCombatState(initialHeroAdventure);
  const timerState = usePreviewTimerState();
  const {
    playSceneId, setPlaySceneId, visitedSceneIds, setVisitedSceneIds, storyVariables, setStoryVariables,
    adventureJournalEntries, setAdventureJournalEntries, dialogue, setDialogue, completedHotspotIds,
    setCompletedHotspotIds, solvedEnigmaIds, setSolvedEnigmaIds, launchedCinematicIds, setLaunchedCinematicIds,
    completedCombinationIds, setCompletedCombinationIds, usedLogicRuleIds, setUsedLogicRuleIds,
    usedSceneObjectIds, setUsedSceneObjectIds, revealedSceneObjectIds, setRevealedSceneObjectIds,
    sceneObjectTextOverrides, setSceneObjectTextOverrides, viewerImage, setViewerImage: setViewerImageState,
    lastChoiceSnapshot, setLastChoiceSnapshot,
  } = coreState;
  const setViewerImage = useCallback((nextViewerImage) => {
    const currentViewerImage = engineRef.current?.getState().viewerImage || null;
    const resolvedViewerImage = (
      typeof nextViewerImage === 'function'
        ? nextViewerImage(currentViewerImage)
        : nextViewerImage
    ) || null;
    engineRef.current?.setState({ viewerImage: resolvedViewerImage });
    setViewerImageState(resolvedViewerImage);
  }, [setViewerImageState]);
  const { inventory, setInventory, selectedInventoryIds, setSelectedInventoryIds, draggedInventoryId, setDraggedInventoryId } = inventoryState;
  const { playingCinematic, setPlayingCinematic, playingSlideIndex, setPlayingSlideIndex } = cinematicState;
  const {
    chosenConversationReplyIds, setChosenConversationReplyIds, askedConversationNodeIds, setAskedConversationNodeIds,
    hiddenConversationReplyIds, setHiddenConversationReplyIds, activeConversation, setActiveConversation,
    activeEnding, setActiveEnding, choiceEffectNotices, setChoiceEffectNotices,
  } = conversationState;
  const {
    activeEnigma, setActiveEnigma, enigmaCodeInput, setEnigmaCodeInput, enigmaColorAttempt, setEnigmaColorAttempt,
    enigmaPuzzleOrder, setEnigmaPuzzleOrder, enigmaPuzzleSelectedIndex, setEnigmaPuzzleSelectedIndex,
    enigmaDragBank, setEnigmaDragBank, enigmaDragSlots, setEnigmaDragSlots, enigmaDraggedPiece,
    setEnigmaDraggedPiece, enigmaRotationAngles, setEnigmaRotationAngles, simonPlaybackIndex,
    setSimonPlaybackIndex, simonPlayerTurn, setSimonPlayerTurn,
  } = enigmaState;
  const {
    heroState, setHeroState, heroSetupComplete, setHeroSetupComplete, lastDiceRoll, setLastDiceRoll,
    heroCombatStates, setHeroCombatStates, activeHeroCombat, setActiveHeroCombat, equippedHeroItemIds,
    setEquippedHeroItemIds, equippedHeroSlotMap, setEquippedHeroSlotMap,
  } = heroCombatState;
  const { playerLives, setPlayerLives, sceneTimerResetKey, setSceneTimerResetKey } = timerState;
  const audioRef = useRef(null);
  const hotspotAudioRef = useRef(null);
  const responseAmbienceAudioRef = useRef(null);
  const simonTimeoutsRef = useRef([]);

  const syncFromGameEngine = (nextState = engineRef.current.getState()) => {
    setPlaySceneId(nextState.currentScene?.id || nextState.currentSceneId || '');
    setInventory(nextState.inventory || []);
    setDialogue(nextState.dialogue || '');
    setCompletedHotspotIds(nextState.completedHotspotIds || nextState.flags?.completedHotspots || []);
    setSolvedEnigmaIds(nextState.solvedEnigmas || nextState.solvedEnigmaIds || []);
    setLaunchedCinematicIds(nextState.launchedCinematicIds || nextState.flags?.launchedCinematics || []);
    setCompletedCombinationIds(nextState.completedCombinationIds || nextState.flags?.completedCombinations || []);
    setUsedLogicRuleIds(nextState.usedLogicRuleIds || nextState.flags?.usedLogicRules || []);
    setUsedSceneObjectIds(nextState.usedSceneObjectIds || []);
    setRevealedSceneObjectIds(nextState.revealedSceneObjectIds || nextState.flags?.revealedSceneObjects || []);
    setSceneObjectTextOverrides(nextState.sceneObjectTextOverrides || {});
    setViewerImage(nextState.viewerImage || null);
    setPlayingCinematic(nextState.playingCinematic || null);
    setPlayingSlideIndex(nextState.playingSlideIndex || 0);
    setSelectedInventoryIds(nextState.selectedInventoryIds || []);
    setActiveEnigma(nextState.activeEnigma || null);
    if (nextState.heroState) setHeroState(nextState.heroState);
    if (nextState.lastDiceRoll) setLastDiceRoll(nextState.lastDiceRoll);
    if (nextState.heroCombatStates) setHeroCombatStates(nextState.heroCombatStates);
    if (nextState.equippedHeroItemIds) setEquippedHeroItemIds(nextState.equippedHeroItemIds);
    if (nextState.equippedHeroSlotMap) setEquippedHeroSlotMap(nextState.equippedHeroSlotMap);

    const enigmaState = nextState.activeEnigmaState || {};
    if ('codeInput' in enigmaState) setEnigmaCodeInput(enigmaState.codeInput || '');
    if ('colorAttempt' in enigmaState) setEnigmaColorAttempt(enigmaState.colorAttempt || []);
    setEnigmaPuzzleOrder(enigmaState.puzzleOrder || []);
    setEnigmaDragBank(enigmaState.dragBank || []);
    setEnigmaDragSlots(enigmaState.dragSlots || []);
    setEnigmaRotationAngles(enigmaState.rotationAngles || []);
  };

  const dispatchPreview = (action) => {
    const nextState = engineRef.current.dispatch(action);
    syncFromGameEngine(nextState);
    return nextState.lastResult;
  };

  const patchPreviewState = (patch = {}) => (
    dispatchPreview(gameActions.setState(patch))
  );

  const playScene = useMemo(
    () => project.scenes.find((scene) => scene.id === playSceneId) || project.scenes[0] || null,
    [project, playSceneId],
  );

  const currentSlide = useMemo(
    () => playingCinematic?.slides?.[playingSlideIndex] || null,
    [playingCinematic, playingSlideIndex],
  );
  const heroAdventure = useMemo(() => normalizeHeroAdventure(project), [project]);

  useEffect(() => {
    if (!heroAdventure.enabled) return;
    setHeroState((current) => {
      const nextHero = {
        ...current,
        name: heroAdventure.hero.name,
        backgroundImageData: heroAdventure.hero.backgroundImageData || '',
        characterImageData: heroAdventure.hero.characterImageData || '',
        setupBackgroundImageData: heroAdventure.hero.setupBackgroundImageData || '',
        setupMusicData: heroAdventure.hero.setupMusicData || '',
        setupMusicName: heroAdventure.hero.setupMusicName || '',
        defeatSceneId: heroAdventure.hero.defeatSceneId || '',
        powers: heroAdventure.hero.powers || [],
        resistanceWater: heroAdventure.hero.resistanceWater || 0,
        resistanceEarth: heroAdventure.hero.resistanceEarth || 0,
        resistanceFire: heroAdventure.hero.resistanceFire || 0,
        resistanceLightning: heroAdventure.hero.resistanceLightning || 0,
      };
      engineRef.current.setState({ heroState: nextHero });
      return nextHero;
    });
  }, [
    heroAdventure.enabled,
    heroAdventure.hero.name,
    heroAdventure.hero.backgroundImageData,
    heroAdventure.hero.characterImageData,
    heroAdventure.hero.setupBackgroundImageData,
    heroAdventure.hero.setupMusicData,
    heroAdventure.hero.setupMusicName,
    heroAdventure.hero.defeatSceneId,
    heroAdventure.hero.powers,
    heroAdventure.hero.resistanceWater,
    heroAdventure.hero.resistanceEarth,
    heroAdventure.hero.resistanceFire,
    heroAdventure.hero.resistanceLightning,
  ]);

  const launchCinematic = (cinematicId) => {
    const result = dispatchPreview(gameActions.startCinematic(cinematicId));
    return Boolean(result?.ok);
  };


  const getStartScene = (targetSceneId = '') => {
    if (targetSceneId) {
      const explicitScene = project.scenes.find((scene) => scene.id === targetSceneId);
      if (explicitScene) return explicitScene;
    }
    return project.scenes[0] || null;
  };

  const goToScene = (sceneId, fallbackText = 'Nouvelle scène.') => {
    const currentState = engineRef.current.getState();
    const objectiveContext = {
      inventory: currentState.inventory || [],
      visitedSceneIds: currentState.visitedSceneIds || [],
      completedHotspotIds: currentState.completedHotspotIds || [],
      solvedEnigmaIds: currentState.solvedEnigmaIds || [],
      chosenConversationReplyIds: currentState.chosenConversationReplyIds || [],
      storyVariables: currentState.storyVariables || {},
      project,
      getItemById: (itemId) => getItemById?.(itemId) || (project.items || []).find((item) => item.id === itemId),
    };
    if (shouldBlockObjectiveFinalScene(sceneId, objectiveContext)) {
      const blockMessage = getObjectiveFinalSceneBlockMessage(objectiveContext, { sceneId });
      setViewerImage(null);
      setDialogue([fallbackText, blockMessage].filter(Boolean).join(' '));
      return false;
    }
    const result = dispatchPreview({ ...gameActions.enterScene(sceneId), dialogue: fallbackText });
    if (result?.ok && sceneId) {
      setVisitedSceneIds((prev) => (prev.includes(sceneId) ? prev : [...prev, sceneId]));
    }
    return Boolean(result?.ok);
  };

  const applySceneTimerEnd = (scene) => {
    if (!scene) return false;
    const action = scene.timerEndAction || 'none';
    const message = scene.timerEndMessage || 'Le temps est écoulé.';

    if (action === 'scene' && scene.timerTargetSceneId) {
      return goToScene(scene.timerTargetSceneId, message || 'Le temps est écoulé.');
    }

    if (action === 'restart-scene') {
      setSceneTimerResetKey((key) => key + 1);
      return goToScene(scene.id, message || scene.introText || 'La scène recommence.');
    }

    if (action === 'restart-preview') {
      initializeFromProject(project);
      setDialogue(message || 'Le jeu recommence.');
      return true;
    }

    if (action === 'damage-life') {
      const loss = Math.max(1, Number(scene.timerLifeLoss) || 1);
      setPlayerLives((currentLives) => {
        const nextLives = Math.max(0, currentLives - loss);
        if (nextLives <= 0 && scene.timerTargetSceneId) {
          window.setTimeout(() => goToScene(scene.timerTargetSceneId, message || "Tu n'as plus de vies."), 0);
        }
        return nextLives;
      });
      if (heroAdventure.enabled) {
        const currentHero = engineRef.current.getState().heroState || heroState;
        const nextHero = {
          ...currentHero,
          health: Math.max(0, Number(currentHero.health || 0) - loss),
        };
        engineRef.current.setState({ heroState: nextHero });
        setHeroState(nextHero);
        triggerHeroDefeatScene(nextHero);
      }
      setDialogue(message || `Temps écoulé: -${loss} vie${loss > 1 ? 's' : ''}.`);
      return true;
    }

    if (action === 'dialogue') {
      setDialogue(message || 'Le temps est écoulé.');
      return true;
    }

    if (action === 'cinematic' && scene.timerTargetCinematicId) {
      if (message) setDialogue(message);
      launchCinematic(scene.timerTargetCinematicId);
      return true;
    }

    if (message) setDialogue(message);
    return false;
  };

  const applyCinematicEnd = (cinematic) => {
    if (!cinematic) return;
    dispatchPreview({ type: 'CLOSE_CINEMATIC', cinematic });
  };

  const closeCinematic = () => {
    dispatchPreview(gameActions.closeCinematic());
  };

  const advanceCinematic = () => {
    dispatchPreview(gameActions.advanceCinematic());
  };

  const markHotspotCompleted = (hotspotId) => {
    if (!hotspotId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      completedHotspotIds: addUnique(state.completedHotspotIds || [], hotspotId),
    });
  };

  const addInventoryItem = (itemId) => {
    if (!itemId) return false;
    const result = dispatchPreview(gameActions.addItem(itemId));
    if (result?.ok) {
      const viewer = createInventoryViewerImage(itemId);
      if (viewer) setViewerImage(viewer);
    }
    return Boolean(result?.ok);
  };

  const addAdventureJournalEntry = (entry = {}) => {
    if (!entry.title && !entry.detail) return;
    setAdventureJournalEntries((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        type: entry.type || 'note',
        title: entry.title || '',
        detail: entry.detail || '',
      },
      ...prev,
    ].slice(0, 60));
  };

  const getJournalItemName = (itemId) => (
    (getItemById?.(itemId) || project.items.find((item) => item.id === itemId))?.name || 'Objet obtenu'
  );

  const getStoryVariableLabel = (key) => (
    (project.storyVariables || []).find((variable) => variable.key === key)?.journalLabel
    || (project.storyVariables || []).find((variable) => variable.key === key)?.name
    || key
  );

  const getTargetLabel = (collection = [], id = '', fallback = 'Cible') => (
    collection.find((entry) => entry.id === id)?.name
    || collection.find((entry) => entry.id === id)?.title
    || fallback
  );

  const removeInventoryItem = (itemId) => {
    if (!itemId) return false;
    const result = dispatchPreview(gameActions.removeItem(itemId));
    return Boolean(result?.ok);
  };

  const createInventoryViewerImage = (itemId) => {
    const item = getItemById?.(itemId) || (project.items || []).find((entry) => entry.id === itemId);
    if (!item) return null;
    return {
      id: item.id,
      src: resolveAssetUrl(project, item.imageId, item.imageData) || '',
      name: item.name || 'Objet',
      icon: item.icon || 'Objet',
    };
  };

  const markSceneObjectUsed = (sceneObjectId) => {
    if (!sceneObjectId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      usedSceneObjectIds: addUnique(state.usedSceneObjectIds || [], sceneObjectId),
      revealedSceneObjectIds: (state.revealedSceneObjectIds || []).filter((id) => id !== sceneObjectId),
    });
  };

  const revealSceneObject = (sceneObjectId) => {
    if (!sceneObjectId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      usedSceneObjectIds: (state.usedSceneObjectIds || []).filter((id) => id !== sceneObjectId),
      revealedSceneObjectIds: addUnique(state.revealedSceneObjectIds || [], sceneObjectId),
    });
  };

  const updateSceneObjectText = (sceneObjectId, text) => {
    if (!sceneObjectId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      sceneObjectTextOverrides: {
        ...(state.sceneObjectTextOverrides || {}),
        [sceneObjectId]: text || '',
      },
    });
  };

  const markLogicRuleUsed = (ruleId) => {
    if (!ruleId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      usedLogicRuleIds: addUnique(state.usedLogicRuleIds || [], ruleId),
    });
  };

  const playHotspotSound = (spot) => {
    const soundUrl = resolveAssetUrl(project, spot?.soundId, spot?.soundData);
    if (!soundUrl) return;
    if (hotspotAudioRef.current) {
      hotspotAudioRef.current.pause();
      hotspotAudioRef.current.currentTime = 0;
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = soundUrl;
    audio.volume = typeof spot.soundVolume === 'number' ? spot.soundVolume : 0.8;
    audio.play().catch(() => {});
    hotspotAudioRef.current = audio;
  };

  const getPreviewConditionContext = () => ({
    inventory,
    visitedSceneIds,
    completedHotspotIds,
    solvedEnigmaIds,
    chosenConversationReplyIds,
    storyVariables,
    heroAdventureEnabled: Boolean(heroAdventure.enabled),
  });

  const resolveHotspotInteraction = (spot) => {
    if (!spot) return null;
    const currentState = engineRef.current.getState();
    return resolveSharedHotspotInteraction(spot, {
      ...getPreviewConditionContext(),
      usedLogicRuleIds,
      launchedCinematicIds,
      completedCombinationIds,
      heroState: currentState.heroState || heroState,
      lastDiceRoll: currentState.lastDiceRoll || lastDiceRoll,
      heroAdventureEnabled: Boolean(heroAdventure.enabled),
      completedHotspotIds,
      hotspotId: spot.id,
    });
  };

  const applyHotspotSideEffects = (spot, sourceHotspotId = spot?.id) => {
    if (!spot) return;

    if (spot.consumeRequiredItemOnUse && spot.requiredItemId) {
      setInventory((prev) => {
        const next = [...prev];
        const usedIndex = next.indexOf(spot.requiredItemId);
        if (usedIndex >= 0) next.splice(usedIndex, 1);
        return next;
      });
      setSelectedInventoryIds((prev) => prev.filter((id) => id !== spot.requiredItemId));
      if (viewerImage?.id === spot.requiredItemId) {
        setViewerImage(null);
      }
    }

    const hotspotImageSrc = resolveAssetUrl(project, spot.objectImageId, spot.objectImageData)
      || resolveAssetUrl(project, spot.popupImageId, spot.popupImageData || spot.popupImage)
      || (spot.clickMode === 'action' ? resolveAssetUrl(project, spot.imageId, spot.imageData) : '');
    if (hotspotImageSrc) {
      setViewerImage(createHotspotViewerImage(spot, hotspotImageSrc));
    }

    if (spot.dialogue) setDialogue(spot.dialogue);

    const rewardItemId = getHotspotRewardItemId(spot);
    if (rewardItemId && !inventory.includes(rewardItemId)) {
      setInventory((prev) => addRewardItemToInventory(prev, rewardItemId));
      setSelectedInventoryIds((prev) => (
        prev.includes(rewardItemId) ? prev : selectRewardInventoryItem(prev, rewardItemId)
      ));
      if (!hotspotImageSrc) {
        const rewardViewer = createInventoryViewerImage(rewardItemId);
        if (rewardViewer) setViewerImage(rewardViewer);
      }
    }

    if (spot.actionType === 'block' && spot.targetBlockId) {
      if ((spot.blockActionType || 'show') === 'hide') {
        markSceneObjectUsed(spot.targetBlockId);
      } else if (spot.blockActionType === 'update_text') {
        revealSceneObject(spot.targetBlockId);
        updateSceneObjectText(spot.targetBlockId, spot.targetBlockText);
      } else {
        revealSceneObject(spot.targetBlockId);
      }
    }

    markHotspotCompleted(sourceHotspotId || spot.id);
    if (spot.disableAfterUse && spot.logicRuleId) markLogicRuleUsed(spot.logicRuleId);
  };

  const applyHotspotAction = (spot, sourceHotspotId = spot?.id) => {
    if (!spot) return;

    applyHotspotSideEffects(spot, sourceHotspotId);

    if (spot.actionType === 'scene' && spot.targetSceneId) {
      goToScene(spot.targetSceneId, spot.dialogue || 'Nouvelle scène.');
    }

    if (spot.actionType === 'cinematic' && spot.targetCinematicId) {
      launchCinematic(spot.targetCinematicId);
    }

    openHotspotLink(spot);
  };

  const openHotspotLink = (spot) => {
    if (!isHotspotLinkAction(spot?.actionType)) return false;
    const linkUrl = getHotspotLinkUrl(spot);
    if (!linkUrl) {
      setViewerImage(null);
      setDialogue(spot.actionType === 'project_link'
        ? 'Choisis un projet cible pour cette zone.'
        : 'Ajoute un lien externe pour cette zone.');
      return false;
    }
    if (typeof window === 'undefined' || typeof window.open !== 'function') return false;
    const openedWindow = window.open(linkUrl, '_blank', 'noopener,noreferrer');
    if (openedWindow) openedWindow.opener = null;
    return true;
  };

  const applyHeroHealthLoss = (amount = 0, options = {}) => {
    const loss = Math.max(0, Number(amount) || 0);
    if (!loss) return engineRef.current.getState().heroState || heroState;
    const currentHero = engineRef.current.getState().heroState || heroState;
    const nextHero = {
      ...currentHero,
      health: clampNumber((Number(currentHero.health) || 0) - loss, 0, Number(currentHero.maxHealth) || 0),
    };
    engineRef.current.setState({ heroState: nextHero });
    setHeroState(nextHero);
    if (options.triggerDefeatScene !== false) triggerHeroDefeatScene(nextHero);
    return nextHero;
  };

  const updateHeroState = (updater) => {
    const currentHero = engineRef.current.getState().heroState || heroState;
    const nextHero = updater(currentHero);
    engineRef.current.setState({ heroState: nextHero });
    setHeroState(nextHero);
    return nextHero;
  };

  const isHeroDefeated = () => (
    Boolean(heroAdventure.enabled && Number((engineRef.current.getState().heroState || heroState)?.health || 0) <= 0)
  );

  function triggerHeroDefeatScene(nextHero = engineRef.current.getState().heroState || heroState) {
    const defeatSceneId = heroAdventure?.hero.defeatSceneId || '';
    if (!heroAdventure.enabled || !defeatSceneId || Number(nextHero.health || 0) > 0) return false;
    const currentSceneId = engineRef.current.getState().currentScene?.id || engineRef.current.getState().currentSceneId || playSceneId;
    if (currentSceneId === defeatSceneId) return false;
    return goToScene(defeatSceneId, 'Le héros tombe à 0 PV.');
  }

  const blockDefeatedHeroAction = () => {
    if (!isHeroDefeated()) return false;
    setDialogue('Le héros est à 0 PV. Les actions sont bloquées.');
    return true;
  };

  const captureLastChoiceSnapshot = (label = 'Dernier choix') => {
    if (!heroAdventure.enabled || isHeroDefeated()) return;
    const engineState = engineRef.current.getState();
    setLastChoiceSnapshot({
      label,
      playSceneId,
      inventory: [...inventory],
      visitedSceneIds: [...visitedSceneIds],
      storyVariables: { ...storyVariables },
      adventureJournalEntries: [...adventureJournalEntries],
      playerLives,
      dialogue,
      completedHotspotIds: [...completedHotspotIds],
      solvedEnigmaIds: [...solvedEnigmaIds],
      chosenConversationReplyIds: [...chosenConversationReplyIds],
      askedConversationNodeIds: [...askedConversationNodeIds],
      hiddenConversationReplyIds: [...hiddenConversationReplyIds],
      launchedCinematicIds: [...launchedCinematicIds],
      completedCombinationIds: [...completedCombinationIds],
      usedLogicRuleIds: [...usedLogicRuleIds],
      usedSceneObjectIds: [...usedSceneObjectIds],
      revealedSceneObjectIds: [...revealedSceneObjectIds],
      sceneObjectTextOverrides: { ...sceneObjectTextOverrides },
      selectedInventoryIds: [...selectedInventoryIds],
      heroState: { ...(engineState.heroState || heroState) },
      heroSetupComplete,
      lastDiceRoll: engineState.lastDiceRoll || lastDiceRoll,
      heroCombatStates: { ...(engineState.heroCombatStates || heroCombatStates) },
      equippedHeroItemIds: [...(engineState.equippedHeroItemIds || equippedHeroItemIds || [])],
      equippedHeroSlotMap: { ...(engineState.equippedHeroSlotMap || equippedHeroSlotMap || {}) },
      activeConversation,
      activeEnigma,
      enigmaCodeInput,
      enigmaColorAttempt: [...enigmaColorAttempt],
      enigmaPuzzleOrder: [...enigmaPuzzleOrder],
      enigmaPuzzleSelectedIndex,
      enigmaDragBank: [...enigmaDragBank],
      enigmaDragSlots: [...enigmaDragSlots],
      enigmaRotationAngles: [...enigmaRotationAngles],
    });
  };

  const {
    getEnigmaById,
    closeEnigma,
    startSimonPlayback,
    openEnigma,
    submitEnigma,
    pushEnigmaColor,
    clickPuzzlePiece,
    rotatePuzzlePiece,
    moveDragPieceToSlot,
    returnDragPieceToBank,
  } = createPreviewEnigmaActions({
    project,
    activeEnigma,
    enigmaCodeInput,
    enigmaColorAttempt,
    enigmaPuzzleOrder,
    enigmaPuzzleSelectedIndex,
    enigmaDragSlots,
    enigmaRotationAngles,
    simonTimeoutsRef,
    dispatchPreview,
    openHotspotLink,
    blockDefeatedHeroAction,
    captureLastChoiceSnapshot,
    setters: {
      setActiveEnigma,
      setEnigmaCodeInput,
      setEnigmaColorAttempt,
      setEnigmaPuzzleOrder,
      setEnigmaPuzzleSelectedIndex,
      setEnigmaDragBank,
      setEnigmaDragSlots,
      setEnigmaDraggedPiece,
      setEnigmaRotationAngles,
      setSimonPlaybackIndex,
      setSimonPlayerTurn,
      setDialogue,
    },
  });

  const restoreLastChoiceSnapshot = () => {
    if (!lastChoiceSnapshot) {
      setDialogue('Aucun choix précédent à restaurer.');
      return false;
    }
    const snapshot = lastChoiceSnapshot;
    const nextScene = project.scenes.find((scene) => scene.id === snapshot.playSceneId) || project.scenes[0] || null;
    engineRef.current.setState({
      currentSceneId: nextScene?.id || '',
      inventory: snapshot.inventory || [],
      visitedSceneIds: snapshot.visitedSceneIds || [],
      storyVariables: snapshot.storyVariables || {},
      adventureJournalEntries: snapshot.adventureJournalEntries || [],
      playerLives: snapshot.playerLives,
      dialogue: snapshot.dialogue || nextScene?.introText || '',
      completedHotspotIds: snapshot.completedHotspotIds || [],
      solvedEnigmaIds: snapshot.solvedEnigmaIds || [],
      chosenConversationReplyIds: snapshot.chosenConversationReplyIds || [],
      askedConversationNodeIds: snapshot.askedConversationNodeIds || [],
      hiddenConversationReplyIds: snapshot.hiddenConversationReplyIds || [],
      launchedCinematicIds: snapshot.launchedCinematicIds || [],
      completedCombinationIds: snapshot.completedCombinationIds || [],
      usedLogicRuleIds: snapshot.usedLogicRuleIds || [],
      usedSceneObjectIds: snapshot.usedSceneObjectIds || [],
      revealedSceneObjectIds: snapshot.revealedSceneObjectIds || [],
      sceneObjectTextOverrides: snapshot.sceneObjectTextOverrides || {},
      selectedInventoryIds: snapshot.selectedInventoryIds || [],
      heroState: snapshot.heroState || heroAdventure.hero,
      heroSetupComplete: snapshot.heroSetupComplete,
      lastDiceRoll: snapshot.lastDiceRoll || null,
      heroCombatStates: snapshot.heroCombatStates || {},
      equippedHeroItemIds: snapshot.equippedHeroItemIds || [],
      equippedHeroSlotMap: snapshot.equippedHeroSlotMap || {},
    });
    setPlaySceneId(nextScene?.id || '');
    setInventory(snapshot.inventory || []);
    setVisitedSceneIds(snapshot.visitedSceneIds || []);
    setStoryVariables(snapshot.storyVariables || {});
    setAdventureJournalEntries(snapshot.adventureJournalEntries || []);
    setPlayerLives(snapshot.playerLives);
    setDialogue(snapshot.dialogue || nextScene?.introText || 'Retour au dernier choix.');
    setCompletedHotspotIds(snapshot.completedHotspotIds || []);
    setSolvedEnigmaIds(snapshot.solvedEnigmaIds || []);
    setChosenConversationReplyIds(snapshot.chosenConversationReplyIds || []);
    setAskedConversationNodeIds(snapshot.askedConversationNodeIds || []);
    setHiddenConversationReplyIds(snapshot.hiddenConversationReplyIds || []);
    setLaunchedCinematicIds(snapshot.launchedCinematicIds || []);
    setCompletedCombinationIds(snapshot.completedCombinationIds || []);
    setUsedLogicRuleIds(snapshot.usedLogicRuleIds || []);
    setUsedSceneObjectIds(snapshot.usedSceneObjectIds || []);
    setRevealedSceneObjectIds(snapshot.revealedSceneObjectIds || []);
    setSceneObjectTextOverrides(snapshot.sceneObjectTextOverrides || {});
    setSelectedInventoryIds(snapshot.selectedInventoryIds || []);
    setHeroState(snapshot.heroState || heroAdventure.hero);
    setHeroSetupComplete(snapshot.heroSetupComplete);
    setLastDiceRoll(snapshot.lastDiceRoll || null);
    setHeroCombatStates(snapshot.heroCombatStates || {});
    setEquippedHeroItemIds(snapshot.equippedHeroItemIds || []);
    setEquippedHeroSlotMap(snapshot.equippedHeroSlotMap || {});
    setActiveConversation(snapshot.activeConversation || null);
    setActiveEnigma(snapshot.activeEnigma || null);
    setActiveEnding(null);
    setChoiceEffectNotices([]);
    setViewerImage(null);
    setPlayingCinematic(null);
    setPlayingSlideIndex(0);
    setEnigmaCodeInput(snapshot.enigmaCodeInput || '');
    setEnigmaColorAttempt(snapshot.enigmaColorAttempt || []);
    setEnigmaPuzzleOrder(snapshot.enigmaPuzzleOrder || []);
    setEnigmaPuzzleSelectedIndex(snapshot.enigmaPuzzleSelectedIndex ?? null);
    setEnigmaDragBank(snapshot.enigmaDragBank || []);
    setEnigmaDragSlots(snapshot.enigmaDragSlots || []);
    setEnigmaRotationAngles(snapshot.enigmaRotationAngles || []);
    setLastChoiceSnapshot(null);
    return true;
  };

  const applyHeroMalus = (entry = {}, baseMessage = '') => {
    if (!heroAdventure.enabled) return baseMessage;
    const healthLoss = Math.max(0, Number(entry.heroMalusHealthLoss) || 0);
    const manaLoss = Math.max(0, Number(entry.heroMalusManaLoss) || 0);
    if (!healthLoss && !manaLoss) return baseMessage;

    const nextHero = updateHeroState((current) => ({
      ...current,
      health: clampNumber((Number(current.health) || 0) - healthLoss, 0, Number(current.maxHealth) || 0),
      mana: clampNumber((Number(current.mana) || 0) - manaLoss, 0, Number(current.maxMana) || 0),
    }));
    triggerHeroDefeatScene(nextHero);
    const lossParts = [
      healthLoss ? `-${healthLoss} PV` : '',
      manaLoss ? `-${manaLoss} mana` : '',
    ].filter(Boolean);
    const malusMessage = entry.heroMalusMessage || `Mauvais chemin: ${lossParts.join(', ')}.`;
    const statusMessage = `Hero: ${nextHero.health}/${nextHero.maxHealth} PV, ${nextHero.mana}/${nextHero.maxMana} mana.`;
    return [baseMessage, malusMessage, statusMessage].filter(Boolean).join(' ');
  };

  const {
    equipHeroItem,
    unequipHeroItem,
    openInventoryItem,
    removeInventoryItemReferences,
  } = createPreviewInventoryActions({
    project,
    heroAdventure,
    heroState,
    equippedHeroItemIds,
    equippedHeroSlotMap,
    viewerImage,
    engineRef,
    getItemById,
    createInventoryViewerImage,
    patchPreviewState,
    blockDefeatedHeroAction,
    updateHeroState,
    setters: {
      setDialogue,
      setInventory,
      setSelectedInventoryIds,
      setViewerImage,
      setEquippedHeroItemIds,
      setEquippedHeroSlotMap,
    },
  });

  const {
    openConversation,
    closeConversation,
    closeEnding,
    clearChoiceEffectNotices,
    isConversationReplyAvailable,
    getConversationReplyLockReason,
    chooseConversationReply,
  } = createPreviewConversationActions({
    project,
    activeConversation,
    askedConversationNodeIds,
    hiddenConversationReplyIds,
    chosenConversationReplyIds,
    heroState,
    engineRef,
    hotspotAudioRef,
    responseAmbienceAudioRef,
    getItemById,
    getPreviewConditionContext,
    addInventoryItem,
    removeInventoryItem,
    addAdventureJournalEntry,
    getJournalItemName,
    getStoryVariableLabel,
    getTargetLabel,
    applyHeroMalus,
    blockDefeatedHeroAction,
    captureLastChoiceSnapshot,
    markHotspotCompleted,
    goToScene,
    launchCinematic,
    getEnigmaById,
    openEnigma,
    runSkillCheckAction: (...args) => runSkillCheckAction(...args),
    runHeroCombatAction: (...args) => runHeroCombatAction(...args),
    setters: {
      setActiveConversation,
      setActiveEnding,
      setChoiceEffectNotices,
      setDialogue,
      setStoryVariables,
      setViewerImage,
      setChosenConversationReplyIds,
      setAskedConversationNodeIds,
      setHiddenConversationReplyIds,
      setHeroState,
    },
  });

  const combineInventoryItems = (firstId, secondId) => {
    const result = dispatchPreview(gameActions.combine(firstId, secondId));
    return Boolean(result?.ok);
  };

  const triggerHotspot = (spot) => {
    if (blockDefeatedHeroAction()) return;
    if (!spot) return;
    const resolvedSpot = resolveHotspotInteraction(spot);
    if (!resolvedSpot) return;
    if (resolvedSpot.actionType === 'none') return;
    if (resolvedSpot.requiredHotspotId && !completedHotspotIds.includes(resolvedSpot.requiredHotspotId)) {
      setViewerImage(null);
      setDialogue(resolvedSpot.lockedMessage || 'Je ne peux pas faire ca maintenant.');
      return;
    }
    if (resolvedSpot.requiredItemId && !inventory.includes(resolvedSpot.requiredItemId)) {
      const need = getItemById?.(resolvedSpot.requiredItemId) || project.items.find((entry) => entry.id === resolvedSpot.requiredItemId);
      setViewerImage(null);
      setDialogue(`Il te faut ${need?.name || 'un objet'} pour faire ca.`);
      return;
    }
    captureLastChoiceSnapshot(resolvedSpot.name || 'Avant action');
    playHotspotSound(resolvedSpot);
    if (resolvedSpot.actionType === 'conversation') {
      openConversation(resolvedSpot);
      return;
    }
    if (resolvedSpot.actionType === 'skill_check') {
      runSkillCheckAction(resolvedSpot, { sourceHotspotId: resolvedSpot.id });
      return;
    }
    if (resolvedSpot.actionType === 'hero_combat') {
      runHeroCombatAction(resolvedSpot, { sourceHotspotId: resolvedSpot.id });
      return;
    }
    const result = dispatchPreview({
      ...gameActions.triggerHotspot(resolvedSpot.id),
      hotspot: resolvedSpot,
      scene: playScene,
    });
    if (result?.ok) {
      const currentMessage = engineRef.current.getState().dialogue || resolvedSpot.dialogue || '';
      const messageWithMalus = applyHeroMalus(resolvedSpot, currentMessage);
      if (messageWithMalus !== currentMessage) {
        patchPreviewState({ dialogue: messageWithMalus });
      }
      openHotspotLink(resolvedSpot);
    }
    if (result?.ok && resolvedSpot.rewardItemId) {
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemName(resolvedSpot.rewardItemId),
        detail: resolvedSpot.name || 'Zone explorée',
      });
    }
    const startedEnigma = engineRef.current.getState().activeEnigma?.enigma;
    if (startedEnigma?.type === 'simon' && result?.ok) startSimonPlayback(startedEnigma);
  };

  const {
    initializeFromProject,
    resetPreview,
    saveGameState,
    loadGameState,
    syncWithProject,
  } = createPreviewSaveStateActions({
    project,
    heroAdventure,
    engineRef,
    responseAmbienceAudioRef,
    dispatchPreview,
    closeEnigma,
    current: {
      playSceneId,
      inventory,
      visitedSceneIds,
      storyVariables,
      adventureJournalEntries,
      playerLives,
      dialogue,
      completedHotspotIds,
      solvedEnigmaIds,
      chosenConversationReplyIds,
      askedConversationNodeIds,
      hiddenConversationReplyIds,
      launchedCinematicIds,
      completedCombinationIds,
      usedLogicRuleIds,
      usedSceneObjectIds,
      revealedSceneObjectIds,
      sceneObjectTextOverrides,
      selectedInventoryIds,
      activeEnding,
      heroState,
      heroSetupComplete,
      lastDiceRoll,
      heroCombatStates,
      equippedHeroItemIds,
      equippedHeroSlotMap,
    },
    setters: {
      setPlaySceneId,
      setInventory,
      setVisitedSceneIds,
      setStoryVariables,
      setAdventureJournalEntries,
      setPlayerLives,
      setHeroState,
      setHeroSetupComplete,
      setLastDiceRoll,
      setHeroCombatStates,
      setActiveHeroCombat,
      setEquippedHeroItemIds,
      setEquippedHeroSlotMap,
      setLastChoiceSnapshot,
      setSceneTimerResetKey,
      setCompletedHotspotIds,
      setSolvedEnigmaIds,
      setChosenConversationReplyIds,
      setAskedConversationNodeIds,
      setHiddenConversationReplyIds,
      setLaunchedCinematicIds,
      setCompletedCombinationIds,
      setUsedLogicRuleIds,
      setUsedSceneObjectIds,
      setRevealedSceneObjectIds,
      setSceneObjectTextOverrides,
      setViewerImage,
      setPlayingCinematic,
      setPlayingSlideIndex,
      setSelectedInventoryIds,
      setDraggedInventoryId,
      setActiveConversation,
      setActiveEnding,
      setChoiceEffectNotices,
      setDialogue,
    },
  });

  const {
    runSkillCheckAction,
    runHeroCombatAction,
    attackActiveHeroCombat,
    rollActiveEnemyCombat,
    attemptSurvivalHeroCombat,
    attemptEscapeHeroCombat,
    closeActiveHeroCombat,
    previewHeroCombat,
  } = createPreviewHeroCombatActions({
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
    setters: {
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
    },
  });

  const removeDeletedSceneReferences = (deletedSceneIds, fallbackScene) => {
    if (playSceneId && deletedSceneIds.has(playSceneId)) {
      setPlaySceneId(fallbackScene?.id || '');
      setDialogue(fallbackScene?.introText || '');
    }
  };

  const adjustHeroStat = (stat, delta) => {
    if (!['health', 'mana'].includes(stat)) return;
    const current = engineRef.current.getState().heroState || heroState;
    const maxKey = stat === 'health' ? 'maxHealth' : 'maxMana';
    const next = {
      ...current,
      [stat]: clampNumber((Number(current[stat]) || 0) + delta, 0, Number(current[maxKey]) || 0),
    };
    engineRef.current.setState({ heroState: next });
    setHeroState(next);
    if (stat === 'health') triggerHeroDefeatScene(next);
  };

  function rollHeroDie(skillId = '', options = {}) {
    if (blockDefeatedHeroAction()) return null;
    const skill = heroState.skills?.find((entry) => entry.id === skillId) || null;
    const manaCost = Math.max(0, Number(options.manaCost ?? skill?.manaCost ?? 0) || 0);
    if (manaCost && Number(heroState.mana || 0) < manaCost) {
      setDialogue(`Mana insuffisante pour ${skill?.name || 'ce test'}.`);
      return null;
    }

    const sides = heroAdventure.dice.sides;
    const forcedRaw = Number(options.raw);
    const raw = Number.isFinite(forcedRaw)
      ? clampNumber(Math.round(forcedRaw), 1, sides)
      : Math.floor(Math.random() * sides) + 1;
    const modifier = Number(skill?.value) || 0;
    const total = raw + modifier;
    const activeRules = (engineRef.current.getState().heroState || heroState)?.rules || heroAdventure.rules || {};
    const criticalSuccess = clampNumber(Number(activeRules.criticalSuccess) || sides, 1, sides);
    const criticalFailure = clampNumber(Number(activeRules.criticalFailure) || 1, 1, sides);
    const roll = {
      id: Date.now(),
      die: heroAdventure.dice.label,
      sides,
      raw,
      modifier,
      total,
      skillId: skill?.id || '',
      skillName: skill?.name || '',
      isCriticalSuccess: raw === criticalSuccess,
      isCriticalFailure: raw === criticalFailure,
    };
    const nextHeroState = manaCost
      ? { ...heroState, mana: Math.max(0, Number(heroState.mana || 0) - manaCost) }
      : heroState;
    setHeroState(nextHeroState);
    setLastDiceRoll(roll);
    engineRef.current.setState({ heroState: nextHeroState, lastDiceRoll: roll });
    if (!options.silent) {
      setDialogue(`${skill ? `${skill.name}: ` : ''}${roll.die} = ${raw}${modifier ? ` + ${modifier}` : ''} => ${total}.`);
    }
    return roll;
  }

  const selectHeroCharacter = (heroId) => {
    const selected = (heroAdventure.heroes || []).find((entry) => entry.id === heroId);
    if (!selected) return false;
    const nextHero = {
      ...selected,
      health: Number(selected.health ?? selected.maxHealth) || 0,
      mana: Number(selected.mana ?? selected.maxMana) || 0,
      skills: (selected.skills || []).map((skill) => ({
        ...skill,
        value: Number.isFinite(Number(skill.baseValue)) ? Number(skill.baseValue) : Number(skill.value) || 0,
        rolledValue: 0,
        rollFormula: '',
      })),
    };
    setHeroState(nextHero);
    setLastDiceRoll(null);
    engineRef.current.setState({ heroState: nextHero, lastDiceRoll: null });
    setDialogue(`${nextHero.name || 'Héros'} choisi. Lance les compétences pour commencer.`);
    return true;
  };

  const rollHeroSetupSkills = (forcedRolls = []) => {
    if (!heroAdventure.enabled) return;
    setHeroState((current) => {
      const nextHero = {
        ...current,
        skills: (current.skills || []).map((skill, index) => {
          const rawRoll = Math.max(1, Math.min(6, Number(forcedRolls[index]) || Math.floor(Math.random() * 6) + 1));
          const previousRoll = Number(skill.rolledValue) || 0;
          const baseValue = Number.isFinite(Number(skill.baseValue))
            ? Number(skill.baseValue)
            : (Number(skill.value) || 0) - previousRoll;
          return {
            ...skill,
            baseValue,
            value: baseValue + rawRoll,
            rolledValue: rawRoll,
            rollFormula: `${baseValue} + 1d6`,
          };
        }),
      };
      engineRef.current.setState({ heroState: nextHero });
      return nextHero;
    });
    setLastDiceRoll(null);
    setDialogue('Compétences tirées. Tu peux commencer l’aventure.');
  };

  const completeHeroSetup = () => {
    setHeroSetupComplete(true);
    engineRef.current.setState({ heroSetupComplete: true });
    setDialogue(playScene?.introText || 'L aventure commence.');
  };

  return {
    playSceneId,
    setPlaySceneId,
    playScene,
    inventory,
    visitedSceneIds,
    storyVariables,
    adventureJournalEntries,
    setInventory,
    addInventoryItem,
    removeInventoryItem,
    playerLives,
    setPlayerLives,
    heroAdventure,
    heroState,
    heroSetupComplete,
    activeHeroCombat,
    heroCombatStates,
    equippedHeroItemIds,
    equippedHeroSlotMap,
    lastChoiceSnapshot,
    setHeroState,
    adjustHeroStat,
    lastDiceRoll,
    rollHeroDie,
    attackActiveHeroCombat,
    rollActiveEnemyCombat,
    attemptSurvivalHeroCombat,
    attemptEscapeHeroCombat,
    closeHeroCombat: closeActiveHeroCombat,
    selectHeroCharacter,
    rollHeroSetupSkills,
    completeHeroSetup,
    sceneTimerResetKey,
    completedHotspotIds,
    chosenConversationReplyIds,
    hiddenConversationReplyIds,
    usedLogicRuleIds,
    usedSceneObjectIds,
    revealedSceneObjectIds,
    sceneObjectTextOverrides,
    markSceneObjectUsed,
    markHotspotCompleted,
    dialogue,
    setDialogue,
    viewerImage,
    setViewerImage,
    playingCinematic,
    setPlayingCinematic,
    playingSlideIndex,
    setPlayingSlideIndex,
    currentSlide,
    selectedInventoryIds,
    setSelectedInventoryIds,
    draggedInventoryId,
    setDraggedInventoryId,
    audioRef,
    activeEnigma,
    activeConversation,
    activeEnding,
    choiceEffectNotices,
    enigmaCodeInput,
    setEnigmaCodeInput,
    enigmaColorAttempt,
    setEnigmaColorAttempt,
    pushEnigmaColor,
    closeEnigma,
    openEnigma,
    closeConversation,
    closeEnding,
    clearChoiceEffectNotices,
    isConversationReplyAvailable,
    getConversationReplyLockReason,
    chooseConversationReply,
    submitEnigma,
    enigmaPuzzleOrder,
    enigmaPuzzleSelectedIndex,
    clickPuzzlePiece,
    enigmaDragBank,
    enigmaDragSlots,
    enigmaDraggedPiece,
    setEnigmaDraggedPiece,
    moveDragPieceToSlot,
    returnDragPieceToBank,
    enigmaRotationAngles,
    rotatePuzzlePiece,
    simonPlaybackIndex,
    simonPlayerTurn,
    startSimonPlayback,
    closeCinematic,
    advanceCinematic,
    openInventoryItem,
    equipHeroItem,
    unequipHeroItem,
    combineInventoryItems,
    launchCinematic,
    applySceneTimerEnd,
    triggerHotspot,
    previewHeroCombat,
    resetPreview,
    saveGameState,
    loadGameState,
    restoreLastChoiceSnapshot,
    syncWithProject,
    removeInventoryItemReferences,
    removeDeletedSceneReferences,
  };
}
