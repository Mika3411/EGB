import { useMemo, useRef, useState } from 'react';
import {
  randomRotations,
  sameColorSequence,
  shuffledIndices,
  validateMiscAnswer,
} from '../lib/gameEngine';

const DEFAULT_COLOR_SEQUENCE = [];
const DEFAULT_PLAYER_LIVES = 3;

export function usePreviewPlayer(project, { getItemById } = {}) {
  const initialScene = project.scenes.find((scene) => scene.id === project.start?.targetSceneId) || project.scenes[0] || null;
  const [playSceneId, setPlaySceneId] = useState(initialScene?.id || '');
  const [inventory, setInventory] = useState([]);
  const [playerLives, setPlayerLives] = useState(DEFAULT_PLAYER_LIVES);
  const [sceneTimerResetKey, setSceneTimerResetKey] = useState(0);
  const [dialogue, setDialogue] = useState(initialScene?.introText || '');
  const [completedHotspotIds, setCompletedHotspotIds] = useState([]);
  const [solvedEnigmaIds, setSolvedEnigmaIds] = useState([]);
  const [launchedCinematicIds, setLaunchedCinematicIds] = useState([]);
  const [completedCombinationIds, setCompletedCombinationIds] = useState([]);
  const [usedLogicRuleIds, setUsedLogicRuleIds] = useState([]);
  const [usedSceneObjectIds, setUsedSceneObjectIds] = useState([]);
  const [viewerImage, setViewerImage] = useState(null);
  const [playingCinematic, setPlayingCinematic] = useState(null);
  const [playingSlideIndex, setPlayingSlideIndex] = useState(0);
  const [selectedInventoryIds, setSelectedInventoryIds] = useState([]);
  const [draggedInventoryId, setDraggedInventoryId] = useState(null);
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
  const audioRef = useRef(null);
  const simonTimeoutsRef = useRef([]);
  const saveStorageKey = `escapeGamePlayerSave:${project?.title || 'default'}`;

  const playScene = useMemo(
    () => project.scenes.find((scene) => scene.id === playSceneId) || project.scenes[0] || null,
    [project, playSceneId],
  );

  const currentSlide = useMemo(
    () => playingCinematic?.slides?.[playingSlideIndex] || null,
    [playingCinematic, playingSlideIndex],
  );

  const getCombinationForItems = (firstId, secondId) => {
    if (!firstId || !secondId) return null;
    return (project.combinations || []).find((combo) => (
      (combo.itemAId === firstId && combo.itemBId === secondId)
      || (combo.itemAId === secondId && combo.itemBId === firstId)
    )) || null;
  };

  const getEnigmaById = (enigmaId) => (
    (project.enigmas || []).find((entry) => entry.id === enigmaId) || null
  );

  const clearSimonPlayback = () => {
    simonTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    simonTimeoutsRef.current = [];
    setSimonPlaybackIndex(-1);
  };

  const launchCinematic = (cinematicId) => {
    const cinematic = project.cinematics.find((entry) => entry.id === cinematicId);
    if (!cinematic) return;
    setLaunchedCinematicIds((prev) => (prev.includes(cinematic.id) ? prev : [...prev, cinematic.id]));
    setPlayingCinematic(cinematic);
    setPlayingSlideIndex(0);
  };


  const getStartScene = (targetSceneId = '') => {
    if (targetSceneId) {
      const explicitScene = project.scenes.find((scene) => scene.id === targetSceneId);
      if (explicitScene) return explicitScene;
    }
    return project.scenes[0] || null;
  };

  const getFirstSceneForAct = (actId) => {
    if (!actId) return null;
    const actScenes = project.scenes.filter((scene) => scene.actId === actId);
    if (!actScenes.length) return null;
    return actScenes.find((scene) => !scene.parentSceneId) || actScenes[0];
  };

  const goToScene = (sceneId, fallbackText = 'Nouvelle scène.') => {
    const nextScene = project.scenes.find((scene) => scene.id === sceneId);
    if (!nextScene) return false;
    setPlaySceneId(nextScene.id);
    setDialogue(nextScene.introText || fallbackText);
    return true;
  };

  const applySceneTimerEnd = (scene) => {
    if (!scene) return false;
    const action = scene.timerEndAction || 'none';
    const message = scene.timerEndMessage || 'Le temps est ecoule.';

    if (action === 'scene' && scene.timerTargetSceneId) {
      return goToScene(scene.timerTargetSceneId, message || 'Le temps est ecoule.');
    }

    if (action === 'restart-scene') {
      setSceneTimerResetKey((key) => key + 1);
      return goToScene(scene.id, message || scene.introText || 'La scene recommence.');
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
      setDialogue(message || `Temps ecoule: -${loss} vie${loss > 1 ? 's' : ''}.`);
      return true;
    }

    if (action === 'dialogue') {
      setDialogue(message || 'Le temps est ecoule.');
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
    if (!cinematic || !cinematic.onEndType || cinematic.onEndType === 'none') return;

    if (cinematic.onEndType === 'scene' && cinematic.targetSceneId) {
      goToScene(cinematic.targetSceneId, 'Nouvelle scène débloquée.');
      return;
    }

    if (cinematic.onEndType === 'act' && cinematic.targetActId) {
      const actScene = getFirstSceneForAct(cinematic.targetActId);
      if (actScene) goToScene(actScene.id, 'Un nouvel acte commence.');
      return;
    }

    if (cinematic.onEndType === 'item' && cinematic.rewardItemId) {
      const rewardItem = getItemById?.(cinematic.rewardItemId) || project.items.find((entry) => entry.id === cinematic.rewardItemId);
      setInventory((prev) => prev.includes(cinematic.rewardItemId) ? prev : [...prev, cinematic.rewardItemId]);
      setSelectedInventoryIds((prev) => prev.includes(cinematic.rewardItemId) ? prev : [...prev, cinematic.rewardItemId].slice(-2));
      if (rewardItem?.imageData) setViewerImage({ id: rewardItem.id, src: rewardItem.imageData, name: rewardItem.name });
      setDialogue(`Tu obtiens ${rewardItem?.name || 'un nouvel objet'}.`);
    }
  };

  const closeCinematic = () => {
    if (playingCinematic) applyCinematicEnd(playingCinematic);
    setPlayingCinematic(null);
    setPlayingSlideIndex(0);
  };

  const advanceCinematic = () => {
    if (!playingCinematic) return;
    const total = playingCinematic.slides?.length || 0;
    setPlayingSlideIndex((index) => {
      if (index + 1 >= total) {
        window.setTimeout(() => closeCinematic(), 0);
        return 0;
      }
      return index + 1;
    });
  };

  const markHotspotCompleted = (hotspotId) => {
    if (!hotspotId) return;
    setCompletedHotspotIds((prev) => (prev.includes(hotspotId) ? prev : [...prev, hotspotId]));
  };

  const markSceneObjectUsed = (sceneObjectId) => {
    if (!sceneObjectId) return;
    setUsedSceneObjectIds((prev) => (prev.includes(sceneObjectId) ? prev : [...prev, sceneObjectId]));
  };

  const markLogicRuleUsed = (ruleId) => {
    if (!ruleId) return;
    setUsedLogicRuleIds((prev) => (prev.includes(ruleId) ? prev : [...prev, ruleId]));
  };

  const resolveHotspotInteraction = (spot) => {
    if (!spot) return null;
    const usedRule = (spot.logicRules || []).find((rule) => rule.disableAfterUse && usedLogicRuleIds.includes(rule.id));
    const matchingRule = (spot.logicRules || []).find((rule) => {
      if (rule.disableAfterUse && usedLogicRuleIds.includes(rule.id)) return false;
      if (rule.conditionType === 'missing_item') return rule.itemId && !inventory.includes(rule.itemId);
      if (rule.conditionType === 'completed_hotspot') return rule.hotspotId && completedHotspotIds.includes(rule.hotspotId);
      if (rule.conditionType === 'solved_enigma') return rule.conditionEnigmaId && solvedEnigmaIds.includes(rule.conditionEnigmaId);
      if (rule.conditionType === 'launched_cinematic') return rule.cinematicId ?
         launchedCinematicIds.includes(rule.cinematicId)
        : launchedCinematicIds.length > 0;
      if (rule.conditionType === 'completed_combination') return rule.combinationId && completedCombinationIds.includes(rule.combinationId);
      if (rule.conditionType === 'second_click') return completedHotspotIds.includes(spot.id);
      return rule.itemId && inventory.includes(rule.itemId);
    });

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
        objectImageData: useDefaultAction ? spot.objectImageData || '' : matchingRule.objectImageData || '',
        objectImageName: useDefaultAction ? spot.objectImageName || '' : matchingRule.objectImageName || '',
        logicRuleId: matchingRule.id || '',
        disableAfterUse: Boolean(matchingRule.disableAfterUse),
      };
    }

    const useSecondAction = Boolean(spot.hasSecondAction && completedHotspotIds.includes(spot.id));
    if (!useSecondAction) {
      return usedRule?.conditionType === 'has_item' ? {
        ...spot,
        requiredItemId: '',
        consumeRequiredItemOnUse: false,
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
      objectImageData: spot.secondObjectImageData || '',
      objectImageName: spot.secondObjectImageName || '',
    };
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

    if (spot.objectImageData) {
      setViewerImage({
        src: spot.objectImageData,
        name: spot.name || spot.objectImageName || 'Objet',
        caption: spot.dialogue || spot.name || '',
      });
    }

    if (spot.dialogue) setDialogue(spot.dialogue);

    if (spot.rewardItemId && !inventory.includes(spot.rewardItemId)) {
      setInventory((prev) => [...prev, spot.rewardItemId]);
      setSelectedInventoryIds((prev) => (
        prev.includes(spot.rewardItemId) ? prev : [...prev, spot.rewardItemId].slice(-2)
      ));
    }

    markHotspotCompleted(sourceHotspotId || spot.id);
    if (spot.disableAfterUse && spot.logicRuleId) markLogicRuleUsed(spot.logicRuleId);
  };

  const applyHotspotAction = (spot, sourceHotspotId = spot?.id) => {
    if (!spot) return;

    applyHotspotSideEffects(spot, sourceHotspotId);

    if (spot.actionType === 'scene' && spot.targetSceneId) {
      goToScene(spot.targetSceneId, spot.dialogue || 'Nouvelle scene.');
    }

    if (spot.actionType === 'cinematic' && spot.targetCinematicId) {
      launchCinematic(spot.targetCinematicId);
    }
  };

  const applyEnigmaSuccess = (enigma, linkedHotspot) => {
    if (linkedHotspot && enigma.unlockType !== 'none') {
      applyHotspotSideEffects(linkedHotspot);
    }
    if (enigma.successMessage) setDialogue(enigma.successMessage);

    if (enigma.unlockType === 'scene' && enigma.targetSceneId) {
      goToScene(enigma.targetSceneId, enigma.successMessage || 'Nouvelle scène débloquée.');
    } else if (enigma.unlockType === 'cinematic' && enigma.targetCinematicId) {
      launchCinematic(enigma.targetCinematicId);
    } else if (linkedHotspot) {
      applyHotspotAction(linkedHotspot);
    }
  };

  const closeEnigma = () => {
    clearSimonPlayback();
    setActiveEnigma(null);
    setEnigmaCodeInput('');
    setEnigmaColorAttempt(DEFAULT_COLOR_SEQUENCE);
    setEnigmaPuzzleOrder([]);
    setEnigmaPuzzleSelectedIndex(null);
    setEnigmaDragBank([]);
    setEnigmaDragSlots([]);
    setEnigmaDraggedPiece(null);
    setEnigmaRotationAngles([]);
    setSimonPlayerTurn(false);
  };

  const solveActiveEnigma = () => {
    if (!activeEnigma?.enigma) return;
    const { enigma, hotspot } = activeEnigma;
    setSolvedEnigmaIds((prev) => (prev.includes(enigma.id) ? prev : [...prev, enigma.id]));
    closeEnigma();
    applyEnigmaSuccess(enigma, hotspot);
  };

  const failActiveEnigma = () => {
    if (!activeEnigma?.enigma) return;
    setDialogue(activeEnigma.enigma.failMessage || 'Ce n’est pas la bonne réponse.');
  };

  const startSimonPlayback = (enigma) => {
    clearSimonPlayback();
    setSimonPlayerTurn(false);
    setEnigmaColorAttempt([]);
    const sequence = enigma.solutionColors || [];
    sequence.forEach((color, index) => {
      const showId = window.setTimeout(() => setSimonPlaybackIndex(index), index * 800 + 250);
      const hideId = window.setTimeout(() => setSimonPlaybackIndex(-1), index * 800 + 700);
      simonTimeoutsRef.current.push(showId, hideId);
    });
    const endId = window.setTimeout(() => {
      setSimonPlaybackIndex(-1);
      setSimonPlayerTurn(true);
    }, sequence.length * 800 + 750);
    simonTimeoutsRef.current.push(endId);
  };

  const openEnigma = (enigma, hotspot = null) => {
    const pieceCount = Math.max(4, (Number(enigma.gridRows) || 3) * (Number(enigma.gridCols) || 3));
    setActiveEnigma({ enigma, hotspot });
    setEnigmaCodeInput('');
    setEnigmaColorAttempt([]);
    setEnigmaPuzzleSelectedIndex(null);
    setEnigmaDraggedPiece(null);
    setSimonPlayerTurn(enigma.type !== 'simon');

    if (enigma.type === 'puzzle') {
      setEnigmaPuzzleOrder(shuffledIndices(pieceCount));
    } else {
      setEnigmaPuzzleOrder([]);
    }

    if (enigma.type === 'dragdrop') {
      setEnigmaDragBank(shuffledIndices(pieceCount));
      setEnigmaDragSlots(Array.from({ length: pieceCount }, () => null));
    } else {
      setEnigmaDragBank([]);
      setEnigmaDragSlots([]);
    }

    if (enigma.type === 'rotation') {
      setEnigmaRotationAngles(randomRotations(pieceCount));
    } else {
      setEnigmaRotationAngles([]);
    }

    if (enigma.type === 'simon') {
      startSimonPlayback(enigma);
    } else {
      clearSimonPlayback();
    }
  };

  const submitEnigma = () => {
    if (!activeEnigma?.enigma) return false;

    const { enigma } = activeEnigma;
    const isSuccess = enigma.type === 'colors' ?
       sameColorSequence(enigmaColorAttempt, enigma.solutionColors || [])
      : enigma.type === 'misc' ?
         validateMiscAnswer(enigma, enigmaCodeInput)
        : (enigmaCodeInput || '').trim().toLowerCase() === (enigma.solutionText || '').trim().toLowerCase();

    if (!isSuccess) {
      failActiveEnigma();
      if (enigma.type === 'colors') setEnigmaColorAttempt(DEFAULT_COLOR_SEQUENCE);
      return false;
    }

    solveActiveEnigma();
    return true;
  };

  const pushEnigmaColor = (colorValue) => {
    if (!activeEnigma?.enigma) return;
    const expectedLength = activeEnigma.enigma.solutionColors?.length || 0;
    const next = [...enigmaColorAttempt, colorValue].slice(0, expectedLength || enigmaColorAttempt.length + 1);
    setEnigmaColorAttempt(next);

    if (activeEnigma.enigma.type === 'simon') {
      const solution = activeEnigma.enigma.solutionColors || [];
      const failed = next.some((color, index) => color !== solution[index]);
      if (failed) {
        setEnigmaColorAttempt([]);
        failActiveEnigma();
        startSimonPlayback(activeEnigma.enigma);
        return;
      }
      if (next.length === solution.length) {
        solveActiveEnigma();
      }
    }
  };

  const clickPuzzlePiece = (index) => {
    if (enigmaPuzzleSelectedIndex === null) {
      setEnigmaPuzzleSelectedIndex(index);
      return;
    }
    setEnigmaPuzzleOrder((prev) => {
      const next = [...prev];
      [next[enigmaPuzzleSelectedIndex], next[index]] = [next[index], next[enigmaPuzzleSelectedIndex]];
      if (next.every((value, pieceIndex) => value === pieceIndex)) {
        window.setTimeout(() => solveActiveEnigma(), 120);
      }
      return next;
    });
    setEnigmaPuzzleSelectedIndex(null);
  };

  const rotatePuzzlePiece = (index) => {
    setEnigmaRotationAngles((prev) => {
      const next = [...prev];
      next[index] = (((next[index] || 0) + 90) % 360);
      if (next.every((value) => value % 360 === 0)) {
        window.setTimeout(() => solveActiveEnigma(), 120);
      }
      return next;
    });
  };

  const moveDragPieceToSlot = (piece, slotIndex) => {
    if (piece === null || piece === undefined) return;
    setEnigmaDragBank((prevBank) => {
      const bankWithoutPiece = prevBank.filter((entry) => entry !== piece);
      setEnigmaDragSlots((prevSlots) => {
        const nextSlots = [...prevSlots];
        const previousSlotIndex = nextSlots.findIndex((entry) => entry === piece);
        if (previousSlotIndex >= 0) nextSlots[previousSlotIndex] = null;
        const displacedPiece = nextSlots[slotIndex];
        nextSlots[slotIndex] = piece;
        const nextBank = displacedPiece === null || displacedPiece === undefined ?
           bankWithoutPiece
          : [...bankWithoutPiece, displacedPiece];
        window.setTimeout(() => {
          setEnigmaDragBank(nextBank);
          if (nextSlots.every((entry, index) => entry === index)) solveActiveEnigma();
        }, 0);
        return nextSlots;
      });
      return bankWithoutPiece;
    });
  };

  const returnDragPieceToBank = (slotIndex) => {
    setEnigmaDragSlots((prevSlots) => {
      const nextSlots = [...prevSlots];
      const piece = nextSlots[slotIndex];
      if (piece !== null && piece !== undefined) {
        nextSlots[slotIndex] = null;
        setEnigmaDragBank((prevBank) => [...prevBank, piece]);
      }
      return nextSlots;
    });
  };

  const openInventoryItem = (itemId) => {
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (item.imageData) {
      setViewerImage({ id: item.id, src: item.imageData, name: item.name });
    }
    setSelectedInventoryIds((prev) => {
      const exists = prev.includes(itemId);
      if (exists) return prev.filter((id) => id !== itemId);
      if (prev.length >= 2) return [prev[1], itemId];
      return [...prev, itemId];
    });
  };

  const combineInventoryItems = (firstId, secondId) => {
    const combo = getCombinationForItems(firstId, secondId);
    if (!combo?.resultItemId) {
      setDialogue('Ces deux objets ne peuvent pas être combinés.');
      return false;
    }

    setInventory((prev) => {
      const remaining = [...prev];
      const removeOne = (id) => {
        const index = remaining.indexOf(id);
        if (index >= 0) remaining.splice(index, 1);
      };
      removeOne(firstId);
      removeOne(secondId);
      if (!remaining.includes(combo.resultItemId)) remaining.push(combo.resultItemId);
      return remaining;
    });

    const resultItem = getItemById?.(combo.resultItemId) || project.items.find((entry) => entry.id === combo.resultItemId);
    setCompletedCombinationIds((prev) => (prev.includes(combo.id) ? prev : [...prev, combo.id]));
    setDialogue(combo.message || `Tu obtiens ${resultItem?.name || 'un nouvel objet'}.`);
    setSelectedInventoryIds(combo.resultItemId ? [combo.resultItemId] : []);

    if (resultItem?.imageData) {
      setViewerImage({ id: resultItem.id, src: resultItem.imageData, name: resultItem.name });
    } else {
      setViewerImage(null);
    }

    return true;
  };

  const triggerHotspot = (spot) => {
    const activeSpot = resolveHotspotInteraction(spot);
    if (!activeSpot) return;

    if (activeSpot.requiredHotspotId && !completedHotspotIds.includes(activeSpot.requiredHotspotId)) {
      setDialogue(activeSpot.lockedMessage || 'Je ne peux pas faire ?a maintenant.');
      return;
    }

    if (activeSpot.requiredItemId && !inventory.includes(activeSpot.requiredItemId)) {
      const need = getItemById?.(activeSpot.requiredItemId) || project.items.find((item) => item.id === activeSpot.requiredItemId);
      setDialogue(`Il te faut ${need?.name || 'un objet'} pour faire ?a.`);
      return;
    }

    if (activeSpot.enigmaId) {
      const enigma = getEnigmaById(activeSpot.enigmaId);
      if (enigma) {
        openEnigma(enigma, activeSpot);
        return;
      }
    }

    applyHotspotAction(activeSpot, spot.id);
  };

  const initializeFromProject = (sourceProject) => {
    const start = sourceProject.start || { type: 'scene', targetSceneId: sourceProject.scenes?.[0]?.id || '', targetCinematicId: '' };
    const fallbackScene = sourceProject.scenes?.find((scene) => scene.id === start.targetSceneId) || sourceProject.scenes?.[0] || null;

    setInventory([]);
    setPlayerLives(DEFAULT_PLAYER_LIVES);
    setSceneTimerResetKey((key) => key + 1);
    setCompletedHotspotIds([]);
    setSolvedEnigmaIds([]);
    setLaunchedCinematicIds([]);
    setCompletedCombinationIds([]);
    setUsedLogicRuleIds([]);
    setUsedSceneObjectIds([]);
    setViewerImage(null);
    setPlayingCinematic(null);
    setPlayingSlideIndex(0);
    setSelectedInventoryIds([]);
    setDraggedInventoryId(null);
    closeEnigma();

    if (start.type === 'cinematic' && start.targetCinematicId) {
      const openingScene = fallbackScene || sourceProject.scenes?.[0] || null;
      setPlaySceneId(openingScene?.id || '');
      setDialogue(openingScene?.introText || '');
      const introCinematic = sourceProject.cinematics?.find((entry) => entry.id === start.targetCinematicId) || null;
      setLaunchedCinematicIds(introCinematic ? [introCinematic.id] : []);
      setPlayingCinematic(introCinematic);
      return;
    }

    setPlaySceneId(fallbackScene?.id || '');
    setDialogue(fallbackScene?.introText || '');
  };

  const resetPreview = () => {
    initializeFromProject(project);
  };

  const saveGameState = () => {
    const payload = {
      playSceneId,
      inventory,
      playerLives,
      dialogue,
      completedHotspotIds,
      solvedEnigmaIds,
      launchedCinematicIds,
      completedCombinationIds,
      usedLogicRuleIds,
      usedSceneObjectIds,
      selectedInventoryIds,
    };
    localStorage.setItem(saveStorageKey, JSON.stringify(payload));
    setDialogue('Partie sauvegardée.');
    return true;
  };

  const loadGameState = () => {
    try {
      const raw = localStorage.getItem(saveStorageKey);
      if (!raw) {
        setDialogue('Aucune sauvegarde trouvée.');
        return false;
      }
      const payload = JSON.parse(raw);
      const nextScene = project.scenes.find((scene) => scene.id === payload.playSceneId) || project.scenes[0] || null;
      setPlaySceneId(nextScene?.id || '');
      setInventory(Array.isArray(payload.inventory) ? payload.inventory : []);
      setPlayerLives(Number.isFinite(Number(payload.playerLives)) ? Math.max(0, Number(payload.playerLives)) : DEFAULT_PLAYER_LIVES);
      setDialogue(payload.dialogue || nextScene?.introText || 'Partie chargée.');
      setCompletedHotspotIds(Array.isArray(payload.completedHotspotIds) ? payload.completedHotspotIds : []);
      setSolvedEnigmaIds(Array.isArray(payload.solvedEnigmaIds) ? payload.solvedEnigmaIds : []);
      setLaunchedCinematicIds(Array.isArray(payload.launchedCinematicIds) ? payload.launchedCinematicIds : []);
      setCompletedCombinationIds(Array.isArray(payload.completedCombinationIds) ? payload.completedCombinationIds : []);
      setUsedLogicRuleIds(Array.isArray(payload.usedLogicRuleIds) ? payload.usedLogicRuleIds : []);
      setUsedSceneObjectIds(Array.isArray(payload.usedSceneObjectIds) ? payload.usedSceneObjectIds : []);
      setSelectedInventoryIds(Array.isArray(payload.selectedInventoryIds) ? payload.selectedInventoryIds : []);
      setViewerImage(null);
      setPlayingCinematic(null);
      closeEnigma();
      return true;
    } catch {
      setDialogue('Impossible de charger cette sauvegarde.');
      return false;
    }
  };

  const syncWithProject = (nextProject) => {
    initializeFromProject(nextProject);
  };

  const removeInventoryItemReferences = (itemId) => {
    setInventory((prev) => prev.filter((id) => id !== itemId));
    setSelectedInventoryIds((prev) => prev.filter((id) => id !== itemId));
    if (viewerImage?.id === itemId) setViewerImage(null);
  };

  const removeDeletedSceneReferences = (deletedSceneIds, fallbackScene) => {
    if (playSceneId && deletedSceneIds.has(playSceneId)) {
      setPlaySceneId(fallbackScene?.id || '');
      setDialogue(fallbackScene?.introText || '');
    }
  };

  return {
    playSceneId,
    setPlaySceneId,
    playScene,
    inventory,
    setInventory,
    playerLives,
    setPlayerLives,
    sceneTimerResetKey,
    completedHotspotIds,
    usedLogicRuleIds,
    usedSceneObjectIds,
    markSceneObjectUsed,
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
    enigmaCodeInput,
    setEnigmaCodeInput,
    enigmaColorAttempt,
    setEnigmaColorAttempt,
    pushEnigmaColor,
    closeEnigma,
    openEnigma,
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
    combineInventoryItems,
    launchCinematic,
    applySceneTimerEnd,
    triggerHotspot,
    resetPreview,
    saveGameState,
    loadGameState,
    syncWithProject,
    removeInventoryItemReferences,
    removeDeletedSceneReferences,
  };
}
