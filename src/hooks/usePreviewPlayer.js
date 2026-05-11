import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addRewardItemToInventory,
  createGameEngine,
  createHotspotViewerImage,
  gameActions,
  getHotspotRewardItemId,
  resolveHotspotInteraction as resolveSharedHotspotInteraction,
  selectRewardInventoryItem,
} from '../lib/gameEngine';
import { resolveAssetUrl } from '../lib/assetManager';
import {
  evaluateCondition,
  evaluateReplyCondition,
} from '../lib/conditionEngine';

const DEFAULT_COLOR_SEQUENCE = [];
const DEFAULT_PLAYER_LIVES = 3;
const DEFAULT_EQUIPMENT_SLOT_LABELS = ['Casque', 'Bouclier', 'Arme', 'Armure', 'Anneau', 'Jambieres', 'Amulette', 'Sac'];
const HERO_DICE_SKIN_IDS = new Set(['classic', 'bone', 'royal', 'ember', 'mana', 'forest', 'shadow', 'divine', 'cursed']);
const DEFAULT_HERO_ADVENTURE = {
  enabled: false,
  dice: { sides: 20, label: 'd20', skin: 'classic' },
  hero: {
    name: 'Héros',
    health: 12,
    maxHealth: 12,
    mana: 6,
    maxMana: 6,
    backgroundImageData: '',
    characterImageData: '',
    setupBackgroundImageData: '',
    setupMusicData: '',
    setupMusicName: '',
    defeatSceneId: '',
    equipmentSlotCount: 6,
    equipmentSlotLabels: DEFAULT_EQUIPMENT_SLOT_LABELS,
    skills: [
      { id: 'force', name: 'Force', value: 1, manaCost: 0 },
      { id: 'ruse', name: 'Ruse', value: 1, manaCost: 0 },
      { id: 'magie', name: 'Magie', value: 1, manaCost: 1 },
    ],
  },
};
const addUnique = (items = [], item) => (item && !items.includes(item) ? [...items, item] : items);

const clampNumber = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

const normalizeHeroAdventure = (project = {}) => {
  const raw = project.heroAdventure && typeof project.heroAdventure === 'object'
    ? project.heroAdventure
    : {};
  const enabled = raw.enabled ?? project.creationMode === 'hero_adventure';
  const rawHero = raw.hero && typeof raw.hero === 'object' ? raw.hero : {};
  const maxHealth = Math.max(1, Number(rawHero.maxHealth || rawHero.health || DEFAULT_HERO_ADVENTURE.hero.maxHealth));
  const maxMana = Math.max(0, Number(rawHero.maxMana || rawHero.mana || DEFAULT_HERO_ADVENTURE.hero.maxMana));
  const skills = Array.isArray(rawHero.skills) && rawHero.skills.length
    ? rawHero.skills
    : DEFAULT_HERO_ADVENTURE.hero.skills;

  return {
    enabled: Boolean(enabled),
    dice: {
      sides: Math.max(2, Number(raw.dice?.sides || DEFAULT_HERO_ADVENTURE.dice.sides)),
      label: raw.dice?.label || `d${Math.max(2, Number(raw.dice?.sides || DEFAULT_HERO_ADVENTURE.dice.sides))}`,
      skin: HERO_DICE_SKIN_IDS.has(raw.dice?.skin) ? raw.dice.skin : DEFAULT_HERO_ADVENTURE.dice.skin,
    },
    hero: {
      name: rawHero.name || DEFAULT_HERO_ADVENTURE.hero.name,
      health: clampNumber(rawHero.health ?? maxHealth, 0, maxHealth),
      maxHealth,
      mana: clampNumber(rawHero.mana ?? maxMana, 0, maxMana),
      maxMana,
      backgroundImageData: rawHero.backgroundImageData || '',
      characterImageData: rawHero.characterImageData || '',
      setupBackgroundImageData: rawHero.setupBackgroundImageData || '',
      setupMusicData: rawHero.setupMusicData || '',
      setupMusicName: rawHero.setupMusicName || '',
      defeatSceneId: rawHero.defeatSceneId || '',
      equipmentSlotCount: Math.max(1, Math.min(8, Number(rawHero.equipmentSlotCount || DEFAULT_HERO_ADVENTURE.hero.equipmentSlotCount))),
      equipmentSlotLabels: DEFAULT_EQUIPMENT_SLOT_LABELS.map((label, index) => {
        const customLabel = Array.isArray(rawHero.equipmentSlotLabels) ? rawHero.equipmentSlotLabels[index] : '';
        return String(customLabel || label).trim() || label;
      }),
      skills: skills.map((skill, index) => ({
        id: skill.id || `skill_${index}`,
        name: skill.name || `Compétence ${index + 1}`,
        value: Number(skill.value) || 0,
        manaCost: Math.max(0, Number(skill.manaCost) || 0),
      })),
    },
  };
};

const getInitialStoryVariables = (project = {}) => Object.fromEntries(
  (project.storyVariables || [])
    .filter((variable) => variable.key)
    .map((variable) => [variable.key, variable.defaultValue])
);

export function usePreviewPlayer(project, { getItemById } = {}) {
  const initialScene = project.scenes.find((scene) => scene.id === project.start?.targetSceneId) || project.scenes[0] || null;
  const initialHeroAdventure = normalizeHeroAdventure(project);
  const initialStoryVariables = getInitialStoryVariables(project);
  const engineRef = useRef(null);
  if (!engineRef.current || engineRef.current.getState().project !== project) {
    engineRef.current = createGameEngine(project);
  }
  const [playSceneId, setPlaySceneId] = useState(initialScene?.id || '');
  const [inventory, setInventory] = useState([]);
  const [visitedSceneIds, setVisitedSceneIds] = useState(initialScene?.id ? [initialScene.id] : []);
  const [storyVariables, setStoryVariables] = useState(initialStoryVariables);
  const [adventureJournalEntries, setAdventureJournalEntries] = useState([]);
  const [playerLives, setPlayerLives] = useState(DEFAULT_PLAYER_LIVES);
  const [heroState, setHeroState] = useState(initialHeroAdventure.hero);
  const [heroSetupComplete, setHeroSetupComplete] = useState(!initialHeroAdventure.enabled);
  const [lastDiceRoll, setLastDiceRoll] = useState(null);
  const [heroCombatStates, setHeroCombatStates] = useState({});
  const [equippedHeroItemIds, setEquippedHeroItemIds] = useState([]);
  const [equippedHeroSlotMap, setEquippedHeroSlotMap] = useState({});
  const [lastChoiceSnapshot, setLastChoiceSnapshot] = useState(null);
  const [sceneTimerResetKey, setSceneTimerResetKey] = useState(0);
  const [dialogue, setDialogue] = useState(initialScene?.introText || '');
  const [completedHotspotIds, setCompletedHotspotIds] = useState([]);
  const [solvedEnigmaIds, setSolvedEnigmaIds] = useState([]);
  const [chosenConversationReplyIds, setChosenConversationReplyIds] = useState([]);
  const [askedConversationNodeIds, setAskedConversationNodeIds] = useState([]);
  const [hiddenConversationReplyIds, setHiddenConversationReplyIds] = useState([]);
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
  const [activeConversation, setActiveConversation] = useState(null);
  const [activeEnding, setActiveEnding] = useState(null);
  const [choiceEffectNotices, setChoiceEffectNotices] = useState([]);
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
  const responseAmbienceAudioRef = useRef(null);
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
  ]);

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

  const goToScene = (sceneId, fallbackText = 'Nouvelle scène.') => {
    const result = dispatchPreview({ ...gameActions.enterScene(sceneId), dialogue: fallbackText });
    if (result?.ok && sceneId) {
      setVisitedSceneIds((prev) => (prev.includes(sceneId) ? prev : [...prev, sceneId]));
    }
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
    patchPreviewState({
      completedHotspotIds: addUnique(state.completedHotspotIds || [], hotspotId),
    });
  };

  const addInventoryItem = (itemId) => {
    if (!itemId) return false;
    const result = dispatchPreview(gameActions.addItem(itemId));
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

  const playConversationReplyAudio = (audioData = '', { ambience = false } = {}) => {
    if (!audioData) return;
    const targetRef = ambience ? responseAmbienceAudioRef : hotspotAudioRef;
    if (targetRef.current) {
      targetRef.current.pause();
      targetRef.current.currentTime = 0;
    }
    const audio = new Audio();
    audio.preload = 'auto';
    audio.src = audioData;
    audio.volume = ambience ? 0.45 : 0.85;
    audio.loop = Boolean(ambience);
    audio.play().catch(() => {});
    targetRef.current = audio;
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

    if (spot.objectImageData) {
      setViewerImage(createHotspotViewerImage(spot));
    }

    if (spot.dialogue) setDialogue(spot.dialogue);

    const rewardItemId = getHotspotRewardItemId(spot);
    if (rewardItemId && !inventory.includes(rewardItemId)) {
      setInventory((prev) => addRewardItemToInventory(prev, rewardItemId));
      setSelectedInventoryIds((prev) => (
        prev.includes(rewardItemId) ? prev : selectRewardInventoryItem(prev, rewardItemId)
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
      goToScene(spot.targetSceneId, spot.dialogue || 'Nouvelle scène.');
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

  const openConversation = (spot) => {
    const nodes = Array.isArray(spot?.conversation?.nodes) ? spot.conversation.nodes : [];
    const startNodeId = spot?.conversation?.startNodeId || nodes[0]?.id || '';
    const node = nodes.find((entry) => entry.id === startNodeId) || nodes[0] || null;
    if (!node) {
      if (spot?.dialogue) setDialogue(spot.dialogue);
      return false;
    }
    if (node.askOnce && askedConversationNodeIds.includes(node.id)) {
      setDialogue(spot?.dialogue || 'Cette question a déjà été posée.');
      return false;
    }
    setActiveConversation({
      sourceHotspotId: spot.id,
      conversation: spot.conversation,
      nodeId: node.id,
    });
    setAskedConversationNodeIds((prev) => (prev.includes(node.id) ? prev : [...prev, node.id]));
    setDialogue(node.text || spot.dialogue || '');
    return true;
  };

  const closeConversation = () => {
    setActiveConversation(null);
  };

  const closeEnding = () => {
    setActiveEnding(null);
  };

  const clearChoiceEffectNotices = () => {
    setChoiceEffectNotices([]);
  };

  const openEnding = (reply = {}) => {
    const typeLabels = {
      good: 'Bonne fin',
      bad: 'Mauvaise fin',
      secret: 'Fin secrete',
      neutral: 'Fin neutre',
    };
    setActiveEnding({
      type: reply.endingType || 'neutral',
      label: typeLabels[reply.endingType || 'neutral'] || 'Fin',
      title: reply.endingTitle || typeLabels[reply.endingType || 'neutral'] || 'Fin',
      summary: reply.endingSummary || reply.dialogue || 'Ton aventure se termine ici.',
      message: reply.dialogue || '',
    });
  };

  const isSingleConversationConditionAvailable = (condition = {}) => {
    return evaluateCondition(condition, getPreviewConditionContext());
  };

  const getSingleConversationConditionReason = (condition = {}) => {
    const conditionType = condition.type || 'none';
    if (conditionType === 'none' || isSingleConversationConditionAvailable(condition)) return '';
    if (conditionType === 'has_item') {
      const item = (getItemById?.(condition.itemId) || project.items.find((entry) => entry.id === condition.itemId));
      return `Nécessite: ${item?.name || 'objet manquant'}`;
    }
    if (conditionType === 'visited_scene') return `Nécessite une scène visitee: ${project.scenes.find((scene) => scene.id === condition.sceneId)?.name || 'scène manquante'}`;
    if (conditionType === 'completed_hotspot') {
      const hotspot = project.scenes.flatMap((scene) => scene.hotspots || []).find((entry) => entry.id === condition.hotspotId);
      return `Nécessite une action faite: ${hotspot?.name || 'zone manquante'}`;
    }
    if (conditionType === 'solved_enigma') return `Nécessite une ?nigme résolue: ${(project.enigmas || []).find((entry) => entry.id === condition.enigmaId)?.name || '?nigme manquante'}`;
    if (conditionType === 'chose_reply') return 'Nécessite un choix precedent';
    if (conditionType === 'story_variable') {
      const operatorLabels = {
        equals: '=',
        not_equals: '!=',
        greater_or_equal: '>=',
        less_or_equal: '<=',
        truthy: 'vrai',
        falsy: 'faux',
      };
      const operator = condition.operator || 'equals';
      const suffix = ['truthy', 'falsy'].includes(operator) ? operatorLabels[operator] : `${operatorLabels[operator] || '='} ${condition.value ?? ''}`;
      return `Nécessite: ${condition.variableKey || 'variable'} ${suffix}`;
    }
    return 'Condition non remplie';
  };

  const isConversationReplyAvailable = (reply = {}) => {
    if (reply.id && hiddenConversationReplyIds.includes(reply.id)) return false;
    if (reply.hideAfterChosen && reply.id && chosenConversationReplyIds.includes(reply.id)) return false;
    return evaluateReplyCondition(reply, getPreviewConditionContext());
  };

  const getConversationReplyLockReason = (reply = {}) => {
    if (isConversationReplyAvailable(reply)) return '';
    if (reply.id && hiddenConversationReplyIds.includes(reply.id)) return 'Choix masque par une autre réponse';
    if (reply.hideAfterChosen && reply.id && chosenConversationReplyIds.includes(reply.id)) return 'Choix déjà utilisé';
    if (reply.lockedLabel) return reply.lockedLabel;
    const conditionType = reply.conditionType || 'none';
    if (conditionType === 'has_item') return getSingleConversationConditionReason({ type: 'has_item', itemId: reply.conditionItemId });
    if (conditionType === 'visited_scene') return getSingleConversationConditionReason({ type: 'visited_scene', sceneId: reply.conditionSceneId });
    if (conditionType === 'completed_hotspot') return getSingleConversationConditionReason({ type: 'completed_hotspot', hotspotId: reply.conditionHotspotId });
    if (conditionType === 'solved_enigma') return getSingleConversationConditionReason({ type: 'solved_enigma', enigmaId: reply.conditionEnigmaId });
    if (conditionType === 'chose_reply') return getSingleConversationConditionReason({ type: 'chose_reply', replyId: reply.conditionReplyId });
    if (conditionType === 'story_variable') {
      return getSingleConversationConditionReason({
        type: 'story_variable',
        variableKey: reply.conditionVariableKey,
        operator: reply.conditionVariableOperator,
        value: reply.conditionVariableValue,
      });
    }
    if (conditionType === 'advanced') {
      const conditions = Array.isArray(reply.advancedConditions) ? reply.advancedConditions : [];
      if (!conditions.length) return 'Aucune condition configurée';
      const missing = conditions
        .map(getSingleConversationConditionReason)
        .filter(Boolean);
      if ((reply.advancedConditionMode || 'all') === 'any') return missing.length === conditions.length ? `Il faut au moins une condition: ${missing.slice(0, 2).join(' ou ')}` : '';
      return missing.slice(0, 3).join(' + ') || 'Condition non remplie';
    }
    return 'Condition non remplie';
  };

  const applyStoryVariableEffect = (reply = {}) => {
    if (!reply.storyVariableKey || (reply.storyVariableOperation || 'none') === 'none') return;
    setStoryVariables((prev) => {
      const key = reply.storyVariableKey.trim();
      if (!key) return prev;
      const operation = reply.storyVariableOperation || 'none';
      const rawValue = reply.storyVariableValue;
      if (operation === 'increment' || operation === 'decrement') {
        const amount = Number(rawValue) || 1;
        const current = Number(prev[key]) || 0;
        return { ...prev, [key]: operation === 'increment' ? current + amount : current - amount };
      }
      let nextValue = rawValue;
      if (rawValue === 'true') nextValue = true;
      if (rawValue === 'false') nextValue = false;
      return { ...prev, [key]: nextValue };
    });
  };

  const applyStoryVariableValue = (key, operation, rawValue) => {
    const variableKey = String(key || '').trim();
    if (!variableKey) return;
    setStoryVariables((prev) => {
      if (operation === 'increment' || operation === 'decrement') {
        const amount = Number(rawValue) || 1;
        const current = Number(prev[variableKey]) || 0;
        return { ...prev, [variableKey]: operation === 'increment' ? current + amount : current - amount };
      }
      let nextValue = rawValue;
      if (rawValue === 'true') nextValue = true;
      if (rawValue === 'false') nextValue = false;
      return { ...prev, [variableKey]: nextValue };
    });
  };

  const makeVariableEffectNotice = (key, operation, rawValue) => {
    const variableKey = String(key || '').trim();
    if (!variableKey || operation === 'none') return null;
    const label = getStoryVariableLabel(variableKey);
    if (operation === 'increment') return { type: 'variable', title: 'Variable', detail: `${label} +${Number(rawValue) || 1}` };
    if (operation === 'decrement') return { type: 'variable', title: 'Variable', detail: `${label} -${Number(rawValue) || 1}` };
    return { type: 'variable', title: 'Variable', detail: `${label} = ${String(rawValue)}` };
  };

  const applyConversationReplyEffects = (reply = {}) => {
    const effects = Array.isArray(reply.effects) ? reply.effects : [];
    const result = { messages: [], notices: [], nextNodeId: '', targetSceneId: '', targetCinematicId: '', enigmaId: '', ending: null };
    effects.forEach((effect) => {
      const type = effect.type || 'message';
      if (type === 'message' && effect.message) {
        result.messages.push(effect.message);
        result.notices.push({ type: 'message', title: 'Message', detail: effect.message });
      }
      if (type === 'add_item' && effect.itemId) {
        addInventoryItem(effect.itemId);
        const itemName = getJournalItemName(effect.itemId);
        addAdventureJournalEntry({ type: 'item', title: itemName, detail: effect.journalDetail || 'Objet obtenu.' });
        result.notices.push({ type: 'item', title: 'Objet obtenu', detail: itemName });
      }
      if (type === 'remove_item' && effect.itemId) {
        removeInventoryItem(effect.itemId);
        result.notices.push({ type: 'item', title: 'Objet retire', detail: getJournalItemName(effect.itemId) });
      }
      if (type === 'set_variable') {
        applyStoryVariableValue(effect.variableKey, 'set', effect.value);
        const notice = makeVariableEffectNotice(effect.variableKey, 'set', effect.value);
        if (notice) result.notices.push(notice);
      }
      if (type === 'increment_variable') {
        applyStoryVariableValue(effect.variableKey, 'increment', effect.value);
        const notice = makeVariableEffectNotice(effect.variableKey, 'increment', effect.value);
        if (notice) result.notices.push(notice);
      }
      if (type === 'decrement_variable') {
        applyStoryVariableValue(effect.variableKey, 'decrement', effect.value);
        const notice = makeVariableEffectNotice(effect.variableKey, 'decrement', effect.value);
        if (notice) result.notices.push(notice);
      }
      if (type === 'journal') {
        const title = effect.journalTitle || 'Note';
        const detail = effect.journalDetail || effect.message || '';
        addAdventureJournalEntry({ type: 'note', title, detail });
        result.notices.push({ type: 'journal', title: 'Journal mis a jour', detail: [title, detail].filter(Boolean).join(' - ') });
      }
      if (type === 'next_node') {
        result.nextNodeId = effect.nextNodeId || result.nextNodeId;
        const node = (activeConversation?.conversation?.nodes || []).find((entry) => entry.id === effect.nextNodeId);
        result.notices.push({ type: 'route', title: 'Suite', detail: node?.text || node?.speaker || 'Autre question' });
      }
      if (type === 'scene') {
        result.targetSceneId = effect.targetSceneId || result.targetSceneId;
        result.notices.push({ type: 'route', title: 'Nouvelle scène', detail: getTargetLabel(project.scenes || [], effect.targetSceneId, 'Scène') });
      }
      if (type === 'cinematic') {
        result.targetCinematicId = effect.targetCinematicId || result.targetCinematicId;
        result.notices.push({ type: 'media', title: 'Cinématique', detail: getTargetLabel(project.cinematics || [], effect.targetCinematicId, 'Cinématique') });
      }
      if (type === 'enigma') {
        result.enigmaId = effect.enigmaId || result.enigmaId;
        result.notices.push({ type: 'route', title: 'Enigme', detail: getTargetLabel(project.enigmas || [], effect.enigmaId, 'Enigme') });
      }
      if (type === 'ending') {
        result.ending = {
          endingType: effect.endingType || reply.endingType || 'neutral',
          endingTitle: effect.endingTitle || reply.endingTitle || '',
          endingSummary: effect.endingSummary || reply.endingSummary || '',
          dialogue: effect.message || reply.dialogue || '',
        };
        result.notices.push({ type: 'ending', title: 'Fin déclenchée', detail: effect.endingTitle || reply.endingTitle || 'Fin' });
      }
    });
    return result;
  };

  const applyHeroHealthLoss = (amount = 0) => {
    const loss = Math.max(0, Number(amount) || 0);
    if (!loss) return engineRef.current.getState().heroState || heroState;
    const currentHero = engineRef.current.getState().heroState || heroState;
    const nextHero = {
      ...currentHero,
      health: clampNumber((Number(currentHero.health) || 0) - loss, 0, Number(currentHero.maxHealth) || 0),
    };
    engineRef.current.setState({ heroState: nextHero });
    setHeroState(nextHero);
    triggerHeroDefeatScene(nextHero);
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

  const restoreLastChoiceSnapshot = () => {
    if (!lastChoiceSnapshot) {
      setDialogue('Aucun choix precedent a restaurer.');
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

  const consumeInventoryItem = (itemId) => {
    if (!itemId) return;
    const state = engineRef.current.getState();
    patchPreviewState({
      inventory: (state.inventory || []).filter((id) => id !== itemId),
      selectedInventoryIds: (state.selectedInventoryIds || []).filter((id) => id !== itemId),
      viewerImage: state.viewerImage?.id === itemId ? null : state.viewerImage,
    });
  };

  const normalizeEquippedHeroSlotMap = (value = {}) => (
    value && typeof value === 'object'
      ? Object.fromEntries(Object.entries(value).filter(([, itemId]) => itemId))
      : {}
  );

  const getNextEquippedHeroSlotMap = (itemId, slotIndex) => {
    const currentMap = normalizeEquippedHeroSlotMap(
      engineRef.current.getState().equippedHeroSlotMap || equippedHeroSlotMap
    );
    const nextMap = Object.fromEntries(Object.entries(currentMap).filter(([, id]) => id !== itemId));
    const slotCount = Math.max(1, Math.min(8, Number(heroAdventure?.hero.equipmentSlotCount || 6)));
    const requestedSlot = Number(slotIndex);
    const targetSlot = Number.isFinite(requestedSlot)
      ? Math.max(0, Math.min(slotCount - 1, Math.round(requestedSlot)))
      : Array.from({ length: slotCount }, (_, index) => index).find((index) => !nextMap[String(index)]);
    if (targetSlot !== undefined && targetSlot !== null) nextMap[String(targetSlot)] = itemId;
    return nextMap;
  };

  const removeItemFromEquippedHeroSlotMap = (itemId) => {
    const currentMap = normalizeEquippedHeroSlotMap(
      engineRef.current.getState().equippedHeroSlotMap || equippedHeroSlotMap
    );
    return Object.fromEntries(Object.entries(currentMap).filter(([, id]) => id !== itemId));
  };

  const applyHeroItem = (item, slotIndex = null) => {
    if (!item || !heroAdventure.enabled) return false;
    const itemType = item.heroItemType || 'none';
    if (itemType === 'none') return false;

    if (itemType === 'health_potion') {
      const amount = Math.max(1, Number(item.heroItemAmount) || 4);
      const nextHero = updateHeroState((current) => ({
        ...current,
        health: clampNumber((Number(current.health) || 0) + amount, 0, Number(current.maxHealth) || 0),
      }));
      if (item.heroItemConsumeOnUse ?? true) consumeInventoryItem(item.id);
      setDialogue(`${item.name || 'Potion'} utilisée: +${amount} PV (${nextHero.health}/${nextHero.maxHealth}).`);
      return true;
    }

    if (itemType === 'mana_potion') {
      const amount = Math.max(1, Number(item.heroItemAmount) || 3);
      const nextHero = updateHeroState((current) => ({
        ...current,
        mana: clampNumber((Number(current.mana) || 0) + amount, 0, Number(current.maxMana) || 0),
      }));
      if (item.heroItemConsumeOnUse ?? true) consumeInventoryItem(item.id);
      setDialogue(`${item.name || 'Potion'} utilisée: +${amount} mana (${nextHero.mana}/${nextHero.maxMana}).`);
      return true;
    }

    if (itemType === 'equipment') {
      const currentEquippedIds = engineRef.current.getState().equippedHeroItemIds || equippedHeroItemIds || [];
      if (currentEquippedIds.includes(item.id)) {
        const nextSlotMap = getNextEquippedHeroSlotMap(item.id, slotIndex);
        engineRef.current.setState({ equippedHeroSlotMap: nextSlotMap });
        setEquippedHeroSlotMap(nextSlotMap);
        setDialogue(`${item.name || 'Equipement'} deplace.`);
        return true;
      }
      const bonusTarget = item.heroItemBonusTarget || 'skill';
      const skillId = item.heroItemSkillId || heroState.skills?.[0]?.id || '';
      const bonus = Number(item.heroItemBonus) || 1;
      const nextHero = updateHeroState((current) => {
        if (bonusTarget === 'maxHealth') {
          const nextMaxHealth = Math.max(1, (Number(current.maxHealth) || 1) + bonus);
          return {
            ...current,
            maxHealth: nextMaxHealth,
            health: clampNumber((Number(current.health) || 0) + Math.max(0, bonus), 0, nextMaxHealth),
          };
        }
        if (bonusTarget === 'maxMana') {
          const nextMaxMana = Math.max(0, (Number(current.maxMana) || 0) + bonus);
          return {
            ...current,
            maxMana: nextMaxMana,
            mana: clampNumber((Number(current.mana) || 0) + Math.max(0, bonus), 0, nextMaxMana),
          };
        }
        return {
          ...current,
          skills: (current.skills || []).map((skill) => (
            skill.id === skillId ? { ...skill, value: (Number(skill.value) || 0) + bonus } : skill
          )),
        };
      });
      const nextEquipped = [...currentEquippedIds, item.id];
      const nextSlotMap = getNextEquippedHeroSlotMap(item.id, slotIndex);
      engineRef.current.setState({ equippedHeroItemIds: nextEquipped, equippedHeroSlotMap: nextSlotMap });
      setEquippedHeroItemIds(nextEquipped);
      setEquippedHeroSlotMap(nextSlotMap);
      const skill = nextHero.skills?.find((entry) => entry.id === skillId);
      const targetLabel = bonusTarget === 'maxHealth'
        ? 'PV max'
        : bonusTarget === 'maxMana'
          ? 'mana max'
          : skill?.name || 'compétence';
      setDialogue(`${item.name || '?quipement'} ?quip?: ${targetLabel} ${bonus >= 0 ? '+' : ''}${bonus}.`);
      return true;
    }

    return false;
  };

  const equipHeroItem = (itemId, slotIndex = null) => {
    if (blockDefeatedHeroAction()) return false;
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item || (item.heroItemType || 'none') !== 'equipment') return false;
    return applyHeroItem(item, slotIndex);
  };

  const unequipHeroItem = (itemId) => {
    if (blockDefeatedHeroAction()) return false;
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item || !heroAdventure.enabled || (item.heroItemType || 'none') !== 'equipment') return false;
    const currentEquippedIds = engineRef.current.getState().equippedHeroItemIds || equippedHeroItemIds || [];
    if (!currentEquippedIds.includes(itemId)) return false;

    const bonusTarget = item.heroItemBonusTarget || 'skill';
    const bonus = Number(item.heroItemBonus) || 1;
    const nextHero = updateHeroState((current) => {
      if (bonusTarget === 'maxHealth') {
        const nextMaxHealth = Math.max(1, (Number(current.maxHealth) || 1) - bonus);
        return {
          ...current,
          maxHealth: nextMaxHealth,
          health: clampNumber(Number(current.health) || 0, 0, nextMaxHealth),
        };
      }
      if (bonusTarget === 'maxMana') {
        const nextMaxMana = Math.max(0, (Number(current.maxMana) || 0) - bonus);
        return {
          ...current,
          maxMana: nextMaxMana,
          mana: clampNumber(Number(current.mana) || 0, 0, nextMaxMana),
        };
      }
      const skillId = item.heroItemSkillId || current.skills?.[0]?.id || '';
      return {
        ...current,
        skills: (current.skills || []).map((skill) => (
          skill.id === skillId ? { ...skill, value: (Number(skill.value) || 0) - bonus } : skill
        )),
      };
    });

    const nextEquipped = currentEquippedIds.filter((id) => id !== itemId);
    const nextSlotMap = removeItemFromEquippedHeroSlotMap(itemId);
    engineRef.current.setState({ equippedHeroItemIds: nextEquipped, equippedHeroSlotMap: nextSlotMap });
    setEquippedHeroItemIds(nextEquipped);
    setEquippedHeroSlotMap(nextSlotMap);
    const skill = nextHero.skills?.find((entry) => entry.id === item.heroItemSkillId);
    const targetLabel = bonusTarget === 'maxHealth'
      ? 'PV max'
      : bonusTarget === 'maxMana'
        ? 'mana max'
        : skill?.name || 'compétence';
    setDialogue(`${item.name || 'Equipement'} retire: ${targetLabel} ${bonus >= 0 ? '-' : '+'}${Math.abs(bonus)}.`);
    return true;
  };

  const setHeroCombatState = (combatId, nextCombatState) => {
    if (!combatId) return {};
    const currentStates = engineRef.current.getState().heroCombatStates || heroCombatStates || {};
    const nextStates = {
      ...currentStates,
      [combatId]: {
        ...(currentStates[combatId] || {}),
        ...nextCombatState,
      },
    };
    engineRef.current.setState({ heroCombatStates: nextStates });
    setHeroCombatStates(nextStates);
    return nextStates[combatId];
  };

  const runSkillCheckAction = (entry = {}, options = {}) => {
    if (blockDefeatedHeroAction()) return false;
    if (!heroAdventure.enabled) {
      setDialogue('Active le mode Hero Adventure pour utiliser un test de compétence.');
      return false;
    }
    const skillId = entry.skillCheckSkillId || heroState.skills?.[0]?.id || '';
    const difficulty = Math.max(1, Number(entry.skillCheckDifficulty) || 10);
    const roll = rollHeroDie(skillId, {
      silent: true,
      manaCost: Math.max(0, Number(entry.skillCheckManaCost) || 0),
    });
    if (!roll) return false;

    const success = roll.total >= difficulty;
    const outcomeRoll = { ...roll, success, difficulty, actionType: 'skill_check' };
    setLastDiceRoll(outcomeRoll);
    engineRef.current.setState({ lastDiceRoll: outcomeRoll });
    const outcome = success ? 'Success' : 'Failure';
    const outcomeLabel = success ? 'Réussite' : 'Échec';
    const outcomeDialogue = entry[`skillCheck${outcome}Dialogue`] || (success ? 'Test réussi.' : 'Test raté.');
    const targetSceneId = entry[`skillCheck${outcome}TargetSceneId`] || '';
    const nextNodeId = entry[`skillCheck${outcome}NextNodeId`] || '';
    const resultMessage = `${roll.skillName ? `${roll.skillName}: ` : ''}${roll.die} = ${roll.raw}${roll.modifier ? ` + ${roll.modifier}` : ''} => ${roll.total}. ${outcomeLabel} contre ${difficulty}. ${outcomeDialogue}`.trim();

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
        if (nextNode.askOnce && askedConversationNodeIds.includes(nextNode.id)) {
          setDialogue(resultMessage || 'Cette question a déjà été posée.');
          if (options.closeConversation) closeConversation();
          return true;
        }
        setAskedConversationNodeIds((prev) => (prev.includes(nextNode.id) ? prev : [...prev, nextNode.id]));
        setActiveConversation((current) => ({ ...current, nodeId: nextNode.id }));
        setDialogue(resultMessage);
        return true;
      }
    }

    setDialogue(resultMessage);
    if (options.closeConversation && !nextNodeId) closeConversation();
    return true;
  };

  const runHeroCombatAction = (entry = {}, options = {}) => {
    if (blockDefeatedHeroAction()) return false;
    if (!heroAdventure.enabled) {
      setDialogue('Active le mode Hero Adventure pour utiliser un combat.');
      return false;
    }
    captureLastChoiceSnapshot(entry.name || entry.combatEnemyName || 'Avant combat');

    const combatId = entry.id || options.sourceHotspotId || `${playSceneId}-combat`;
    const enemyName = entry.combatEnemyName || entry.name || 'Ennemi';
    const enemyMaxHealth = Math.max(1, Number(entry.combatEnemyMaxHealth) || 8);
    const currentCombat = (engineRef.current.getState().heroCombatStates || heroCombatStates || {})[combatId] || {};
    const currentEnemyHealth = currentCombat.defeated
      ? 0
      : clampNumber(currentCombat.enemyHealth ?? enemyMaxHealth, 0, enemyMaxHealth);

    if (currentEnemyHealth <= 0) {
      const message = `${enemyName} est déjà vaincu.`;
      setDialogue(message);
      if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
      return true;
    }

    const skillId = entry.combatSkillId || heroState.skills?.[0]?.id || '';
    const difficulty = Math.max(1, Number(entry.combatAttackDifficulty) || 10);
    const roll = rollHeroDie(skillId, {
      silent: true,
      manaCost: Math.max(0, Number(entry.combatManaCost) || 0),
    });
    if (!roll) return false;

    const hit = roll.total >= difficulty;
    const outcomeRoll = { ...roll, success: hit, difficulty, actionType: 'hero_combat' };
    setLastDiceRoll(outcomeRoll);
    engineRef.current.setState({ lastDiceRoll: outcomeRoll });
    const heroDamage = hit ? Math.max(1, Number(entry.combatDamage) || 3) : 0;
    const nextEnemyHealth = clampNumber(currentEnemyHealth - heroDamage, 0, enemyMaxHealth);
    const rollText = `${roll.skillName ? `${roll.skillName}: ` : ''}${roll.die} = ${roll.raw}${roll.modifier ? ` + ${roll.modifier}` : ''} => ${roll.total}`;

    if (nextEnemyHealth <= 0) {
      setHeroCombatState(combatId, { enemyHealth: 0, enemyMaxHealth, defeated: true });
      if (entry.combatRewardItemId) addInventoryItem(entry.combatRewardItemId);
      if (options.sourceHotspotId) markHotspotCompleted(options.sourceHotspotId);
      const reward = entry.combatRewardItemId
        ? ` R?compense : ${(getItemById?.(entry.combatRewardItemId) || project.items.find((item) => item.id === entry.combatRewardItemId))?.name || 'objet obtenu'}.`
        : '';
      const victoryMessage = `${rollText}. Touche contre ${difficulty}: -${heroDamage} PV a ${enemyName}. ${entry.combatVictoryDialogue || 'Victoire.'}${reward}`.trim();
      if (entry.combatVictoryTargetSceneId) return goToScene(entry.combatVictoryTargetSceneId, victoryMessage);
      setDialogue(victoryMessage);
      return true;
    }

    setHeroCombatState(combatId, { enemyHealth: nextEnemyHealth, enemyMaxHealth, defeated: false });
    const enemyDamage = Math.max(0, Number(entry.combatEnemyDamage) || 0);
    const nextHero = applyHeroHealthLoss(enemyDamage);
    const attackText = hit
      ? `Touche contre ${difficulty}: -${heroDamage} PV a ${enemyName}.`
      : `Rate contre ${difficulty}.`;
    const retaliationText = enemyDamage
      ? ` ${enemyName} riposte: -${enemyDamage} PV.`
      : '';
    const healthText = ` ${enemyName}: ${nextEnemyHealth}/${enemyMaxHealth} PV.`;
    const defeat = Number(nextHero.health || 0) <= 0;
    const defeatText = defeat ? ` ${entry.combatDefeatDialogue || 'Défaite.'}` : '';
    const message = `${rollText}. ${attackText}${healthText}${retaliationText}${defeatText}`.trim();

    if (defeat && entry.combatDefeatTargetSceneId) return goToScene(entry.combatDefeatTargetSceneId, message);
    setDialogue(message);
    return true;
  };

  const chooseConversationReply = (reply = {}) => {
    if (blockDefeatedHeroAction()) return false;
    if (!activeConversation?.conversation) return false;
    if (!isConversationReplyAvailable(reply)) return false;
    captureLastChoiceSnapshot(reply.label || 'Avant réponse');
    const currentNode = (activeConversation.conversation.nodes || []).find((node) => node.id === activeConversation.nodeId);
    addAdventureJournalEntry({
      type: 'choice',
      title: reply.label || 'Choix',
      detail: currentNode?.text || '',
    });
    if (reply.responseImageData) {
      setViewerImage({
        src: reply.responseImageData,
        name: reply.responseImageName || reply.label || 'Image',
        caption: reply.dialogue || reply.label || '',
      });
    }
    if (reply.responseSoundData) playConversationReplyAudio(reply.responseSoundData);
    if (reply.ambienceSoundData) playConversationReplyAudio(reply.ambienceSoundData, { ambience: true });
    applyStoryVariableEffect(reply);
    const effectResult = applyConversationReplyEffects(reply);
    if (reply.id) {
      setChosenConversationReplyIds((prev) => (prev.includes(reply.id) ? prev : [...prev, reply.id]));
    }
    const replyIdsToHide = Array.isArray(reply.hideReplyIdsAfterChosen) ? reply.hideReplyIdsAfterChosen.filter(Boolean) : [];
    if (replyIdsToHide.length) {
      setHiddenConversationReplyIds((prev) => [...new Set([...prev, ...replyIdsToHide])]);
    }
    const actionType = reply.actionType || (reply.nextNodeId ? 'node' : 'end');
    const message = applyHeroMalus(reply, reply.dialogue || reply.label || '');
    const combinedMessage = [message, ...effectResult.messages].filter(Boolean).join(' ');
    if (combinedMessage) setDialogue(combinedMessage);

    const legacyVariableNotice = makeVariableEffectNotice(
      reply.storyVariableKey,
      reply.storyVariableOperation || 'none',
      reply.storyVariableValue,
    );
    const nextChoiceNotices = [
      combinedMessage ? { type: 'message', title: 'Message affiché', detail: combinedMessage } : null,
      reply.responseImageData ? { type: 'media', title: 'Image affichée', detail: reply.responseImageName || reply.label || 'Image de réponse' } : null,
      reply.responseSoundData ? { type: 'media', title: 'Son joue', detail: 'Effet sonore' } : null,
      reply.ambienceSoundData ? { type: 'media', title: 'Ambiance lancée', detail: 'Son d’ambiance' } : null,
      legacyVariableNotice,
      ...effectResult.notices,
    ].filter(Boolean);

    if (reply.rewardItemId) {
      addInventoryItem(reply.rewardItemId);
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemName(reply.rewardItemId),
        detail: 'Indice ou objet obtenu.',
      });
      nextChoiceNotices.push({ type: 'item', title: 'Objet obtenu', detail: getJournalItemName(reply.rewardItemId) });
    }
    if (effectResult.ending) {
      setChoiceEffectNotices(nextChoiceNotices);
      markHotspotCompleted(activeConversation.sourceHotspotId);
      closeConversation();
      openEnding(effectResult.ending);
      return true;
    }
    if (actionType === 'skill_check') {
      setChoiceEffectNotices(nextChoiceNotices);
      return runSkillCheckAction(reply, {
        closeConversation: true,
        conversation: activeConversation.conversation,
        sourceHotspotId: activeConversation.sourceHotspotId,
      });
    }
    const targetSceneId = effectResult.targetSceneId || reply.targetSceneId;
    if (targetSceneId && (actionType === 'scene' || effectResult.targetSceneId)) {
      if (!effectResult.targetSceneId) {
        nextChoiceNotices.push({ type: 'route', title: 'Nouvelle scène', detail: getTargetLabel(project.scenes || [], targetSceneId, 'Scène') });
      }
      setChoiceEffectNotices(nextChoiceNotices);
      closeConversation();
      return goToScene(targetSceneId, combinedMessage || 'Nouvelle scène.');
    }
    const targetCinematicId = effectResult.targetCinematicId || reply.targetCinematicId;
    if (targetCinematicId && (actionType === 'cinematic' || effectResult.targetCinematicId)) {
      if (!effectResult.targetCinematicId) {
        nextChoiceNotices.push({ type: 'media', title: 'Cinématique', detail: getTargetLabel(project.cinematics || [], targetCinematicId, 'Cinématique') });
      }
      setChoiceEffectNotices(nextChoiceNotices);
      closeConversation();
      return launchCinematic(targetCinematicId);
    }
    const targetEnigmaId = effectResult.enigmaId || reply.enigmaId;
    if (targetEnigmaId && (actionType === 'enigma' || effectResult.enigmaId)) {
      const enigma = getEnigmaById(targetEnigmaId);
      if (enigma) {
        if (!effectResult.enigmaId) {
          nextChoiceNotices.push({ type: 'route', title: 'Enigme', detail: enigma.name || 'Enigme' });
        }
        setChoiceEffectNotices(nextChoiceNotices);
        closeConversation();
        openEnigma(enigma, null);
        return true;
      }
    }
    if (actionType === 'ending') {
      nextChoiceNotices.push({ type: 'ending', title: 'Fin déclenchée', detail: reply.endingTitle || 'Fin' });
      setChoiceEffectNotices(nextChoiceNotices);
      markHotspotCompleted(activeConversation.sourceHotspotId);
      closeConversation();
      openEnding(reply);
      return true;
    }
    if (actionType === 'end') {
      setChoiceEffectNotices(nextChoiceNotices);
      markHotspotCompleted(activeConversation.sourceHotspotId);
      closeConversation();
      return true;
    }

    const nextNodeId = effectResult.nextNodeId || reply.nextNodeId;
    const nextNode = (activeConversation.conversation.nodes || []).find((node) => node.id === nextNodeId);
    if (nextNode) {
      if (nextNode.askOnce && askedConversationNodeIds.includes(nextNode.id)) {
        setChoiceEffectNotices(nextChoiceNotices);
        setDialogue(combinedMessage || 'Cette question a déjà été posée.');
        closeConversation();
        return true;
      }
      if (!effectResult.nextNodeId) {
        nextChoiceNotices.push({ type: 'route', title: 'Suite', detail: nextNode.text || nextNode.speaker || 'Autre question' });
      }
      setChoiceEffectNotices(nextChoiceNotices);
      setAskedConversationNodeIds((prev) => (prev.includes(nextNode.id) ? prev : [...prev, nextNode.id]));
      setActiveConversation((current) => ({
        ...current,
        nodeId: nextNode.id,
        portraitData: reply.npcPortraitData || current?.portraitData || '',
        portraitName: reply.npcPortraitName || current?.portraitName || '',
      }));
      setDialogue([combinedMessage, nextNode.text].filter(Boolean).join(' '));
      return true;
    }
    setChoiceEffectNotices(nextChoiceNotices);
    closeConversation();
    return true;
  };

  const submitEnigma = () => {
    if (blockDefeatedHeroAction()) return false;
    if (!activeEnigma?.enigma) return false;
    captureLastChoiceSnapshot(activeEnigma.enigma.name || 'Avant énigme');

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
    if (blockDefeatedHeroAction()) return;
    const item = getItemById?.(itemId) || project.items.find((entry) => entry.id === itemId);
    if (!item) return;
    if (applyHeroItem(item)) return;
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
    if (blockDefeatedHeroAction()) return;
    if (!spot) return;
    const resolvedSpot = resolveHotspotInteraction(spot);
    if (!resolvedSpot) return;
    if (resolvedSpot.requiredHotspotId && !completedHotspotIds.includes(resolvedSpot.requiredHotspotId)) {
      setDialogue(resolvedSpot.lockedMessage || 'Je ne peux pas faire ca maintenant.');
      return;
    }
    if (resolvedSpot.requiredItemId && !inventory.includes(resolvedSpot.requiredItemId)) {
      const need = getItemById?.(resolvedSpot.requiredItemId) || project.items.find((entry) => entry.id === resolvedSpot.requiredItemId);
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
    }
    if (result?.ok && resolvedSpot.rewardItemId) {
      addAdventureJournalEntry({
        type: 'item',
        title: getJournalItemName(resolvedSpot.rewardItemId),
        detail: resolvedSpot.name || 'Zone exploree',
      });
    }
    const startedEnigma = engineRef.current.getState().activeEnigma?.enigma;
    if (startedEnigma?.type === 'simon' && result?.ok) startSimonPlayback(startedEnigma);
  };

  const initializeFromProject = (sourceProject) => {
    if (responseAmbienceAudioRef.current) {
      responseAmbienceAudioRef.current.pause();
      responseAmbienceAudioRef.current = null;
    }
    const nextHeroAdventure = normalizeHeroAdventure(sourceProject);
    const start = sourceProject.start || { type: 'scene', targetSceneId: sourceProject.scenes?.[0]?.id || '', targetCinematicId: '' };
    const fallbackScene = sourceProject.scenes?.find((scene) => scene.id === start.targetSceneId) || sourceProject.scenes?.[0] || null;
    engineRef.current.reset(sourceProject, {
      currentSceneId: fallbackScene?.id || '',
      playerLives: DEFAULT_PLAYER_LIVES,
      heroState: nextHeroAdventure.hero,
      heroSetupComplete: !nextHeroAdventure.enabled,
      lastDiceRoll: null,
      heroCombatStates: {},
      equippedHeroItemIds: [],
      equippedHeroSlotMap: {},
    });

    setInventory([]);
    setVisitedSceneIds(fallbackScene?.id ? [fallbackScene.id] : []);
    setStoryVariables(getInitialStoryVariables(sourceProject));
    setAdventureJournalEntries([]);
    setPlayerLives(DEFAULT_PLAYER_LIVES);
    setHeroState(nextHeroAdventure.hero);
    setHeroSetupComplete(!nextHeroAdventure.enabled);
    setLastDiceRoll(null);
    setHeroCombatStates({});
    setEquippedHeroItemIds([]);
    setEquippedHeroSlotMap({});
    setLastChoiceSnapshot(null);
    setSceneTimerResetKey((key) => key + 1);
    setCompletedHotspotIds([]);
    setSolvedEnigmaIds([]);
    setChosenConversationReplyIds([]);
    setAskedConversationNodeIds([]);
    setHiddenConversationReplyIds([]);
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
    setActiveConversation(null);
    setActiveEnding(null);
    setChoiceEffectNotices([]);
    closeEnigma();

    if (start.type === 'cinematic' && start.targetCinematicId) {
      const openingScene = fallbackScene || sourceProject.scenes?.[0] || null;
      dispatchPreview(gameActions.startCinematic(start.targetCinematicId));
      setPlaySceneId(openingScene?.id || '');
      setVisitedSceneIds(openingScene?.id ? [openingScene.id] : []);
      setDialogue(openingScene?.introText || '');
      const introCinematic = sourceProject.cinematics?.find((entry) => entry.id === start.targetCinematicId) || null;
      setLaunchedCinematicIds(introCinematic ? [introCinematic.id] : []);
      setPlayingCinematic(introCinematic);
      return;
    }

    setPlaySceneId(fallbackScene?.id || '');
    setVisitedSceneIds(fallbackScene?.id ? [fallbackScene.id] : []);
    setDialogue(fallbackScene?.introText || '');
  };

  const resetPreview = () => {
    initializeFromProject(project);
  };

  const saveGameState = () => {
    const payload = {
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
        visitedSceneIds: Array.isArray(payload.visitedSceneIds) ? payload.visitedSceneIds : [nextScene?.id || ''].filter(Boolean),
        storyVariables: { ...getInitialStoryVariables(project), ...(payload.storyVariables && typeof payload.storyVariables === 'object' ? payload.storyVariables : {}) },
        adventureJournalEntries: Array.isArray(payload.adventureJournalEntries) ? payload.adventureJournalEntries : [],
        playerLives: Number.isFinite(Number(payload.playerLives)) ? Math.max(0, Number(payload.playerLives)) : DEFAULT_PLAYER_LIVES,
        dialogue: payload.dialogue || nextScene?.introText || 'Partie chargée.',
        completedHotspotIds: Array.isArray(payload.completedHotspotIds) ? payload.completedHotspotIds : [],
        solvedEnigmaIds: Array.isArray(payload.solvedEnigmaIds) ? payload.solvedEnigmaIds : [],
        chosenConversationReplyIds: Array.isArray(payload.chosenConversationReplyIds) ? payload.chosenConversationReplyIds : [],
        askedConversationNodeIds: Array.isArray(payload.askedConversationNodeIds) ? payload.askedConversationNodeIds : [],
        hiddenConversationReplyIds: Array.isArray(payload.hiddenConversationReplyIds) ? payload.hiddenConversationReplyIds : [],
        launchedCinematicIds: Array.isArray(payload.launchedCinematicIds) ? payload.launchedCinematicIds : [],
        completedCombinationIds: Array.isArray(payload.completedCombinationIds) ? payload.completedCombinationIds : [],
        usedLogicRuleIds: Array.isArray(payload.usedLogicRuleIds) ? payload.usedLogicRuleIds : [],
        usedSceneObjectIds: Array.isArray(payload.usedSceneObjectIds) ? payload.usedSceneObjectIds : [],
        revealedSceneObjectIds: Array.isArray(payload.revealedSceneObjectIds) ? payload.revealedSceneObjectIds : [],
        sceneObjectTextOverrides: payload.sceneObjectTextOverrides && typeof payload.sceneObjectTextOverrides === 'object' ? payload.sceneObjectTextOverrides : {},
        selectedInventoryIds: Array.isArray(payload.selectedInventoryIds) ? payload.selectedInventoryIds : [],
        activeEnding: payload.activeEnding && typeof payload.activeEnding === 'object' ? payload.activeEnding : null,
        heroState: payload.heroState && typeof payload.heroState === 'object' ? payload.heroState : heroAdventure.hero,
        heroSetupComplete: Boolean(payload.heroSetupComplete || !heroAdventure.enabled),
        lastDiceRoll: payload.lastDiceRoll && typeof payload.lastDiceRoll === 'object' ? payload.lastDiceRoll : null,
        heroCombatStates: payload.heroCombatStates && typeof payload.heroCombatStates === 'object' ? payload.heroCombatStates : {},
        equippedHeroItemIds: Array.isArray(payload.equippedHeroItemIds) ? payload.equippedHeroItemIds : [],
        equippedHeroSlotMap: payload.equippedHeroSlotMap && typeof payload.equippedHeroSlotMap === 'object' ? payload.equippedHeroSlotMap : {},
      });
      setPlaySceneId(nextScene?.id || '');
      setInventory(Array.isArray(payload.inventory) ? payload.inventory : []);
      setVisitedSceneIds(Array.isArray(payload.visitedSceneIds) ? payload.visitedSceneIds : [nextScene?.id || ''].filter(Boolean));
      setStoryVariables({ ...getInitialStoryVariables(project), ...(payload.storyVariables && typeof payload.storyVariables === 'object' ? payload.storyVariables : {}) });
      setAdventureJournalEntries(Array.isArray(payload.adventureJournalEntries) ? payload.adventureJournalEntries : []);
      setPlayerLives(Number.isFinite(Number(payload.playerLives)) ? Math.max(0, Number(payload.playerLives)) : DEFAULT_PLAYER_LIVES);
      setDialogue(payload.dialogue || nextScene?.introText || 'Partie chargée.');
      setCompletedHotspotIds(Array.isArray(payload.completedHotspotIds) ? payload.completedHotspotIds : []);
      setSolvedEnigmaIds(Array.isArray(payload.solvedEnigmaIds) ? payload.solvedEnigmaIds : []);
      setChosenConversationReplyIds(Array.isArray(payload.chosenConversationReplyIds) ? payload.chosenConversationReplyIds : []);
      setAskedConversationNodeIds(Array.isArray(payload.askedConversationNodeIds) ? payload.askedConversationNodeIds : []);
      setHiddenConversationReplyIds(Array.isArray(payload.hiddenConversationReplyIds) ? payload.hiddenConversationReplyIds : []);
      setLaunchedCinematicIds(Array.isArray(payload.launchedCinematicIds) ? payload.launchedCinematicIds : []);
      setCompletedCombinationIds(Array.isArray(payload.completedCombinationIds) ? payload.completedCombinationIds : []);
      setUsedLogicRuleIds(Array.isArray(payload.usedLogicRuleIds) ? payload.usedLogicRuleIds : []);
      setUsedSceneObjectIds(Array.isArray(payload.usedSceneObjectIds) ? payload.usedSceneObjectIds : []);
      setRevealedSceneObjectIds(Array.isArray(payload.revealedSceneObjectIds) ? payload.revealedSceneObjectIds : []);
      setSceneObjectTextOverrides(payload.sceneObjectTextOverrides && typeof payload.sceneObjectTextOverrides === 'object' ? payload.sceneObjectTextOverrides : {});
      setSelectedInventoryIds(Array.isArray(payload.selectedInventoryIds) ? payload.selectedInventoryIds : []);
      setActiveEnding(payload.activeEnding && typeof payload.activeEnding === 'object' ? payload.activeEnding : null);
      setHeroState(payload.heroState && typeof payload.heroState === 'object' ? payload.heroState : heroAdventure.hero);
      setHeroSetupComplete(Boolean(payload.heroSetupComplete || !heroAdventure.enabled));
      setLastDiceRoll(payload.lastDiceRoll && typeof payload.lastDiceRoll === 'object' ? payload.lastDiceRoll : null);
      setHeroCombatStates(payload.heroCombatStates && typeof payload.heroCombatStates === 'object' ? payload.heroCombatStates : {});
      setEquippedHeroItemIds(Array.isArray(payload.equippedHeroItemIds) ? payload.equippedHeroItemIds : []);
      setEquippedHeroSlotMap(payload.equippedHeroSlotMap && typeof payload.equippedHeroSlotMap === 'object' ? payload.equippedHeroSlotMap : {});
      setLastChoiceSnapshot(null);
      setChoiceEffectNotices([]);
      setViewerImage(null);
      setPlayingCinematic(null);
      closeEnigma();
      return true;
    } catch {
      setDialogue('Impossible dé charger cette sauvegarde.');
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
      equippedHeroItemIds: (engineRef.current.getState().equippedHeroItemIds || []).filter((id) => id !== itemId),
      equippedHeroSlotMap: removeItemFromEquippedHeroSlotMap(itemId),
    });
    setInventory((prev) => prev.filter((id) => id !== itemId));
    setSelectedInventoryIds((prev) => prev.filter((id) => id !== itemId));
    setEquippedHeroItemIds((prev) => prev.filter((id) => id !== itemId));
    setEquippedHeroSlotMap((prev) => Object.fromEntries(Object.entries(prev || {}).filter(([, id]) => id !== itemId)));
    if (viewerImage?.id === itemId) setViewerImage(null);
  };

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
    const roll = {
      id: Date.now(),
      die: heroAdventure.dice.label,
      sides,
      raw,
      modifier,
      total,
      skillId: skill?.id || '',
      skillName: skill?.name || '',
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

  const rollHeroSetupSkills = (forcedRolls = []) => {
    if (!heroAdventure.enabled) return;
    setHeroState((current) => {
      const nextHero = {
        ...current,
        skills: (current.skills || []).map((skill, index) => {
          const rawRoll = Math.max(1, Math.min(6, Number(forcedRolls[index]) || Math.floor(Math.random() * 6) + 1));
          return {
            ...skill,
            value: rawRoll,
            rolledValue: rawRoll,
            rollFormula: '1d6',
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
    equippedHeroItemIds,
    equippedHeroSlotMap,
    lastChoiceSnapshot,
    setHeroState,
    adjustHeroStat,
    lastDiceRoll,
    rollHeroDie,
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
    resetPreview,
    saveGameState,
    loadGameState,
    restoreLastChoiceSnapshot,
    syncWithProject,
    removeInventoryItemReferences,
    removeDeletedSceneReferences,
  };
}
