import { useMemo, useRef, useState } from 'react';
import { createGameEngine, gameActions } from '../lib/gameEngine';
import { resolveAssetUrl } from '../lib/assetManager';

const DEFAULT_COLOR_SEQUENCE = [];
const DEFAULT_PLAYER_LIVES = 3;
const addUnique = (items = [], item) => (item && !items.includes(item) ? [...items, item] : items);

export function usePreviewPlayer(project, { getItemById } = {}) {
  const initialScene = project.scenes.find((scene) => scene.id === project.start?.targetSceneId) || project.scenes[0] || null;
  const engineRef = useRef(null);
  if (!engineRef.current || engineRef.current.getState().project !== project) {
    engineRef.current = createGameEngine(project);
  }
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
  const [revealedSceneObjectIds, setRevealedSceneObjectIds] = useState([]);
  const [sceneObjectTextOverrides, setSceneObjectTextOverrides] = useState({});
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
  const hotspotAudioRef = useRef(null);
  const simonTimeoutsRef = useRef([]);
  const saveStorageKey = `escapeGamePlayerSave:${project?.title || 'default'}`;

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

  const playScene = useMemo(
    () => project.scenes.find((scene) => scene.id === playSceneId) || project.scenes[0] || null,
    [project, playSceneId],
  );

  const currentSlide = useMemo(
    () => playingCinematic?.slides?.[playingSlideIndex] || null,
    [playingCinematic, playingSlideIndex],
  );

  const getEnigmaById = (enigmaId) => (
    (project.enigmas || []).find((entry) => entry.id === enigmaId) || null
  );

  const clearSimonPlayback = () => {
    simonTimeoutsRef.current.forEach((timeoutId) => clearTimeout(timeoutId));
    simonTimeoutsRef.current = [];
    setSimonPlaybackIndex(-1);
  };

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

  const goToScene = (sceneId, fallbackText = 'Nouvelle scene.') => {
    const result = dispatchPreview({ ...gameActions.enterScene(sceneId), dialogue: fallbackText });
    return Boolean(result?.ok);
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
    engineRef.current.setState({
      completedHotspotIds: addUnique(state.completedHotspotIds || [], hotspotId),
    });
    setCompletedHotspotIds((prev) => (prev.includes(hotspotId) ? prev : [...prev, hotspotId]));
  };

  const addInventoryItem = (itemId) => {
    if (!itemId) return false;
    const result = dispatchPreview(gameActions.addItem(itemId));
    return Boolean(result?.ok);
  };

  const removeInventoryItem = (itemId) => {
    if (!itemId) return false;
    const result = dispatchPreview(gameActions.removeItem(itemId));
    return Boolean(result?.ok);
  };

  const markSceneObjectUsed = (sceneObjectId) => {
    if (!sceneObjectId) return;
    const state = engineRef.current.getState();
    engineRef.current.setState({
      usedSceneObjectIds: addUnique(state.usedSceneObjectIds || [], sceneObjectId),
      revealedSceneObjectIds: (state.revealedSceneObjectIds || []).filter((id) => id !== sceneObjectId),
    });
    setUsedSceneObjectIds((prev) => (prev.includes(sceneObjectId) ? prev : [...prev, sceneObjectId]));
  };

  const revealSceneObject = (sceneObjectId) => {
    if (!sceneObjectId) return;
    const state = engineRef.current.getState();
    engineRef.current.setState({
      usedSceneObjectIds: (state.usedSceneObjectIds || []).filter((id) => id !== sceneObjectId),
      revealedSceneObjectIds: addUnique(state.revealedSceneObjectIds || [], sceneObjectId),
    });
    setRevealedSceneObjectIds((prev) => (prev.includes(sceneObjectId) ? prev : [...prev, sceneObjectId]));
    setUsedSceneObjectIds((prev) => prev.filter((id) => id !== sceneObjectId));
  };

  const updateSceneObjectText = (sceneObjectId, text) => {
    if (!sceneObjectId) return;
    const state = engineRef.current.getState();
    engineRef.current.setState({
      sceneObjectTextOverrides: {
        ...(state.sceneObjectTextOverrides || {}),
        [sceneObjectId]: text || '',
      },
    });
    setSceneObjectTextOverrides((prev) => ({ ...prev, [sceneObjectId]: text || '' }));
  };

  const markLogicRuleUsed = (ruleId) => {
    if (!ruleId) return;
    const state = engineRef.current.getState();
    engineRef.current.setState({
      usedLogicRuleIds: addUnique(state.usedLogicRuleIds || [], ruleId),
    });
    setUsedLogicRuleIds((prev) => (prev.includes(ruleId) ? prev : [...prev, ruleId]));
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

  const resolveHotspotInteraction = (spot) => {
    if (!spot) return null;
    const usedRule = (spot.logicRules || []).find((rule) => rule.disableAfterUse && usedLogicRuleIds.includes(rule.id));
    const isRuleAvailable = (rule) => !(rule.disableAfterUse && usedLogicRuleIds.includes(rule.id));
    const doesRuleMatch = (rule) => {
      if (!isRuleAvailable(rule)) return false;
      if (rule.conditionType === 'always') return true;
      if (rule.conditionType === 'missing_item') return rule.itemId && !inventory.includes(rule.itemId);
      if (rule.conditionType === 'completed_hotspot') return rule.hotspotId && completedHotspotIds.includes(rule.hotspotId);
      if (rule.conditionType === 'solved_enigma') return rule.conditionEnigmaId && solvedEnigmaIds.includes(rule.conditionEnigmaId);
      if (rule.conditionType === 'launched_cinematic') return rule.cinematicId ?
         launchedCinematicIds.includes(rule.cinematicId)
        : launchedCinematicIds.length > 0;
      if (rule.conditionType === 'completed_combination') return rule.combinationId && completedCombinationIds.includes(rule.combinationId);
      if (rule.conditionType === 'second_click') return completedHotspotIds.includes(spot.id);
      return rule.itemId && inventory.includes(rule.itemId);
    };
    const isRuleConfigured = (rule) => {
      if (['has_item', 'missing_item'].includes(rule.conditionType || 'has_item')) return Boolean(rule.itemId);
      if (rule.conditionType === 'always') return true;
      if (rule.conditionType === 'completed_hotspot') return Boolean(rule.hotspotId);
      if (rule.conditionType === 'solved_enigma') return Boolean(rule.conditionEnigmaId);
      if (rule.conditionType === 'completed_combination') return Boolean(rule.combinationId);
      return true;
    };
    const matchingRule = (spot.logicRules || []).find(doesRuleMatch);

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

    const unmetRule = (spot.logicRules || []).find((rule) => (
      isRuleAvailable(rule)
      && isRuleConfigured(rule)
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
      goToScene(enigma.targetSceneId, enigma.successMessage || 'Nouvelle scene débloquée.');
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
    const { enigma } = activeEnigma;
    dispatchPreview(gameActions.solveEnigma(enigma.id, {
      codeInput: enigma.solutionText || '',
      colorAttempt: enigma.solutionColors || [],
      puzzleOrder: enigmaPuzzleOrder,
      dragSlots: enigmaDragSlots,
      rotationAngles: enigmaRotationAngles,
    }));
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
    const result = dispatchPreview(gameActions.startEnigma(enigma.id, { enigma, hotspot }));
    if (!result?.ok) return;
    setEnigmaCodeInput('');
    setEnigmaColorAttempt([]);
    setEnigmaPuzzleSelectedIndex(null);
    setEnigmaDraggedPiece(null);
    setSimonPlayerTurn(enigma.type !== 'simon');

    if (enigma.type === 'simon') {
      startSimonPlayback(enigma);
    } else {
      clearSimonPlayback();
    }
  };

  const submitEnigma = () => {
    if (!activeEnigma?.enigma) return false;

    const { enigma } = activeEnigma;
    const result = dispatchPreview(gameActions.solveEnigma(enigma.id, {
      codeInput: enigmaCodeInput,
      colorAttempt: enigmaColorAttempt,
      puzzleOrder: enigmaPuzzleOrder,
      dragSlots: enigmaDragSlots,
      rotationAngles: enigmaRotationAngles,
    }));

    if (!result?.ok) {
      if (enigma.type === 'colors') setEnigmaColorAttempt(DEFAULT_COLOR_SEQUENCE);
      return false;
    }

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
    const result = dispatchPreview(gameActions.combine(firstId, secondId));
    return Boolean(result?.ok);
  };

  const triggerHotspot = (spot) => {
    if (!spot) return;
    const resolvedSpot = resolveHotspotInteraction(spot);
    if (!resolvedSpot) return;
    playHotspotSound(resolvedSpot);
    const result = dispatchPreview({
      ...gameActions.triggerHotspot(resolvedSpot.id),
      hotspot: resolvedSpot,
      scene: playScene,
    });
    const startedEnigma = engineRef.current.getState().activeEnigma?.enigma;
    if (startedEnigma?.type === 'simon' && result?.ok) startSimonPlayback(startedEnigma);
  };

  const initializeFromProject = (sourceProject) => {
    const start = sourceProject.start || { type: 'scene', targetSceneId: sourceProject.scenes?.[0]?.id || '', targetCinematicId: '' };
    const fallbackScene = sourceProject.scenes?.find((scene) => scene.id === start.targetSceneId) || sourceProject.scenes?.[0] || null;
    engineRef.current.reset(sourceProject, {
      currentSceneId: fallbackScene?.id || '',
      playerLives: DEFAULT_PLAYER_LIVES,
    });

    setInventory([]);
    setPlayerLives(DEFAULT_PLAYER_LIVES);
    setSceneTimerResetKey((key) => key + 1);
    setCompletedHotspotIds([]);
    setSolvedEnigmaIds([]);
    setLaunchedCinematicIds([]);
    setCompletedCombinationIds([]);
    setUsedLogicRuleIds([]);
    setUsedSceneObjectIds([]);
    setRevealedSceneObjectIds([]);
    setSceneObjectTextOverrides({});
    setViewerImage(null);
    setPlayingCinematic(null);
    setPlayingSlideIndex(0);
    setSelectedInventoryIds([]);
    setDraggedInventoryId(null);
    closeEnigma();

    if (start.type === 'cinematic' && start.targetCinematicId) {
      const openingScene = fallbackScene || sourceProject.scenes?.[0] || null;
      dispatchPreview(gameActions.startCinematic(start.targetCinematicId));
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
      revealedSceneObjectIds,
      sceneObjectTextOverrides,
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
      engineRef.current.setState({
        currentSceneId: nextScene?.id || '',
        inventory: Array.isArray(payload.inventory) ? payload.inventory : [],
        playerLives: Number.isFinite(Number(payload.playerLives)) ? Math.max(0, Number(payload.playerLives)) : DEFAULT_PLAYER_LIVES,
        dialogue: payload.dialogue || nextScene?.introText || 'Partie chargée.',
        completedHotspotIds: Array.isArray(payload.completedHotspotIds) ? payload.completedHotspotIds : [],
        solvedEnigmaIds: Array.isArray(payload.solvedEnigmaIds) ? payload.solvedEnigmaIds : [],
        launchedCinematicIds: Array.isArray(payload.launchedCinematicIds) ? payload.launchedCinematicIds : [],
        completedCombinationIds: Array.isArray(payload.completedCombinationIds) ? payload.completedCombinationIds : [],
        usedLogicRuleIds: Array.isArray(payload.usedLogicRuleIds) ? payload.usedLogicRuleIds : [],
        usedSceneObjectIds: Array.isArray(payload.usedSceneObjectIds) ? payload.usedSceneObjectIds : [],
        revealedSceneObjectIds: Array.isArray(payload.revealedSceneObjectIds) ? payload.revealedSceneObjectIds : [],
        sceneObjectTextOverrides: payload.sceneObjectTextOverrides && typeof payload.sceneObjectTextOverrides === 'object' ? payload.sceneObjectTextOverrides : {},
        selectedInventoryIds: Array.isArray(payload.selectedInventoryIds) ? payload.selectedInventoryIds : [],
      });
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
      setRevealedSceneObjectIds(Array.isArray(payload.revealedSceneObjectIds) ? payload.revealedSceneObjectIds : []);
      setSceneObjectTextOverrides(payload.sceneObjectTextOverrides && typeof payload.sceneObjectTextOverrides === 'object' ? payload.sceneObjectTextOverrides : {});
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
    engineRef.current.setState({
      inventory: engineRef.current.getState().inventory.filter((id) => id !== itemId),
      selectedInventoryIds: engineRef.current.getState().selectedInventoryIds.filter((id) => id !== itemId),
      viewerImage: engineRef.current.getState().viewerImage?.id === itemId ? null : engineRef.current.getState().viewerImage,
    });
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
    addInventoryItem,
    removeInventoryItem,
    playerLives,
    setPlayerLives,
    sceneTimerResetKey,
    completedHotspotIds,
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
