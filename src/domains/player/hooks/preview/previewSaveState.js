import { gameActions } from '../../../../shared/services/gameEngine';
import {
  DEFAULT_PLAYER_LIVES,
  normalizeHeroAdventure,
} from './previewPlayerDefaults.js';
import { normalizeHeroRuntimeSaveState } from '../../../../shared/services/heroRuntimeState.js';

export const getInitialStoryVariables = (project = {}) => Object.fromEntries(
  (project.storyVariables || [])
    .filter((variable) => variable.key)
    .map((variable) => [variable.key, variable.defaultValue])
);

const getPreviewSaveStorageKey = (project = {}) => `escapeGamePlayerSave:${project?.title || 'default'}`;

const getProjectStartScene = (sourceProject = {}) => {
  const start = sourceProject.start || {
    type: 'scene',
    targetSceneId: sourceProject.scenes?.[0]?.id || '',
    targetCinematicId: '',
  };
  const fallbackScene = sourceProject.scenes?.find((scene) => scene.id === start.targetSceneId)
    || sourceProject.scenes?.[0]
    || null;
  return { start, fallbackScene };
};

const getLoadedPreviewState = (payload = {}, project = {}, heroAdventure = {}) => {
  const nextScene = project.scenes.find((scene) => scene.id === payload.playSceneId) || project.scenes[0] || null;
  const heroRuntimeState = normalizeHeroRuntimeSaveState(payload, {
    fallbackHero: heroAdventure.hero,
    items: project.items || [],
    slotCount: heroAdventure.hero?.equipmentSlotCount,
    diceSides: heroAdventure.dice?.sides,
  });
  const loadedState = {
    playSceneId: nextScene?.id || '',
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
    heroState: heroRuntimeState.heroState,
    heroSetupComplete: Boolean(payload.heroSetupComplete || !heroAdventure.enabled),
    lastDiceRoll: heroRuntimeState.lastDiceRoll,
    heroCombatStates: heroRuntimeState.heroCombatStates,
    equippedHeroItemIds: heroRuntimeState.equippedHeroItemIds,
    equippedHeroSlotMap: heroRuntimeState.equippedHeroSlotMap,
  };

  return {
    nextScene,
    loadedState,
    engineState: {
      currentSceneId: loadedState.playSceneId,
      inventory: loadedState.inventory,
      visitedSceneIds: loadedState.visitedSceneIds,
      storyVariables: loadedState.storyVariables,
      adventureJournalEntries: loadedState.adventureJournalEntries,
      playerLives: loadedState.playerLives,
      dialogue: loadedState.dialogue,
      completedHotspotIds: loadedState.completedHotspotIds,
      solvedEnigmaIds: loadedState.solvedEnigmaIds,
      chosenConversationReplyIds: loadedState.chosenConversationReplyIds,
      askedConversationNodeIds: loadedState.askedConversationNodeIds,
      hiddenConversationReplyIds: loadedState.hiddenConversationReplyIds,
      launchedCinematicIds: loadedState.launchedCinematicIds,
      completedCombinationIds: loadedState.completedCombinationIds,
      usedLogicRuleIds: loadedState.usedLogicRuleIds,
      usedSceneObjectIds: loadedState.usedSceneObjectIds,
      revealedSceneObjectIds: loadedState.revealedSceneObjectIds,
      sceneObjectTextOverrides: loadedState.sceneObjectTextOverrides,
      selectedInventoryIds: loadedState.selectedInventoryIds,
      activeEnding: loadedState.activeEnding,
      heroState: loadedState.heroState,
      heroSetupComplete: loadedState.heroSetupComplete,
      lastDiceRoll: loadedState.lastDiceRoll,
      heroCombatStates: loadedState.heroCombatStates,
      equippedHeroItemIds: loadedState.equippedHeroItemIds,
      equippedHeroSlotMap: loadedState.equippedHeroSlotMap,
    },
  };
};

export function createPreviewSaveStateActions({
  project,
  heroAdventure,
  engineRef,
  responseAmbienceAudioRef,
  dispatchPreview,
  closeEnigma,
  current,
  setters,
}) {
  const initializeFromProject = (sourceProject) => {
    if (responseAmbienceAudioRef.current) {
      responseAmbienceAudioRef.current.pause();
      responseAmbienceAudioRef.current = null;
    }
    const nextHeroAdventure = normalizeHeroAdventure(sourceProject);
    const { start, fallbackScene } = getProjectStartScene(sourceProject);
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

    setters.setInventory([]);
    setters.setVisitedSceneIds(fallbackScene?.id ? [fallbackScene.id] : []);
    setters.setStoryVariables(getInitialStoryVariables(sourceProject));
    setters.setAdventureJournalEntries([]);
    setters.setPlayerLives(DEFAULT_PLAYER_LIVES);
    setters.setHeroState(nextHeroAdventure.hero);
    setters.setHeroSetupComplete(!nextHeroAdventure.enabled);
    setters.setLastDiceRoll(null);
    setters.setHeroCombatStates({});
    setters.setActiveHeroCombat(null);
    setters.setEquippedHeroItemIds([]);
    setters.setEquippedHeroSlotMap({});
    setters.setLastChoiceSnapshot(null);
    setters.setSceneTimerResetKey((key) => key + 1);
    setters.setCompletedHotspotIds([]);
    setters.setSolvedEnigmaIds([]);
    setters.setChosenConversationReplyIds([]);
    setters.setAskedConversationNodeIds([]);
    setters.setHiddenConversationReplyIds([]);
    setters.setLaunchedCinematicIds([]);
    setters.setCompletedCombinationIds([]);
    setters.setUsedLogicRuleIds([]);
    setters.setUsedSceneObjectIds([]);
    setters.setRevealedSceneObjectIds([]);
    setters.setSceneObjectTextOverrides({});
    setters.setViewerImage(null);
    setters.setPlayingCinematic(null);
    setters.setPlayingSlideIndex(0);
    setters.setSelectedInventoryIds([]);
    setters.setDraggedInventoryId(null);
    setters.setActiveConversation(null);
    setters.setActiveEnding(null);
    setters.setChoiceEffectNotices([]);
    closeEnigma();

    if (start.type === 'cinematic' && start.targetCinematicId) {
      const openingScene = fallbackScene || sourceProject.scenes?.[0] || null;
      dispatchPreview(gameActions.startCinematic(start.targetCinematicId));
      setters.setPlaySceneId(openingScene?.id || '');
      setters.setVisitedSceneIds(openingScene?.id ? [openingScene.id] : []);
      setters.setDialogue(openingScene?.introText || '');
      const introCinematic = sourceProject.cinematics?.find((entry) => entry.id === start.targetCinematicId) || null;
      setters.setLaunchedCinematicIds(introCinematic ? [introCinematic.id] : []);
      setters.setPlayingCinematic(introCinematic);
      return;
    }

    setters.setPlaySceneId(fallbackScene?.id || '');
    setters.setVisitedSceneIds(fallbackScene?.id ? [fallbackScene.id] : []);
    setters.setDialogue(fallbackScene?.introText || '');
  };

  const resetPreview = () => {
    initializeFromProject(project);
  };

  const saveGameState = () => {
    const engineState = engineRef.current.getState();
    const heroRuntimeState = normalizeHeroRuntimeSaveState({
      ...current,
      heroState: engineState.heroState ?? current.heroState,
      lastDiceRoll: engineState.lastDiceRoll ?? current.lastDiceRoll,
      heroCombatStates: engineState.heroCombatStates ?? current.heroCombatStates,
      equippedHeroItemIds: engineState.equippedHeroItemIds ?? current.equippedHeroItemIds,
      equippedHeroSlotMap: engineState.equippedHeroSlotMap ?? current.equippedHeroSlotMap,
    }, {
      fallbackHero: heroAdventure.hero,
      items: project.items || [],
      slotCount: heroAdventure.hero?.equipmentSlotCount,
      diceSides: heroAdventure.dice?.sides,
    });
    localStorage.setItem(getPreviewSaveStorageKey(project), JSON.stringify({
      ...current,
      ...heroRuntimeState,
    }));
    setters.setDialogue('Partie sauvegardée.');
    return true;
  };

  const loadGameState = () => {
    try {
      const raw = localStorage.getItem(getPreviewSaveStorageKey(project));
      if (!raw) {
        setters.setDialogue('Aucune sauvegarde trouvée.');
        return false;
      }
      const payload = JSON.parse(raw);
      const { loadedState, engineState } = getLoadedPreviewState(payload, project, heroAdventure);
      engineRef.current.setState(engineState);
      setters.setPlaySceneId(loadedState.playSceneId);
      setters.setInventory(loadedState.inventory);
      setters.setVisitedSceneIds(loadedState.visitedSceneIds);
      setters.setStoryVariables(loadedState.storyVariables);
      setters.setAdventureJournalEntries(loadedState.adventureJournalEntries);
      setters.setPlayerLives(loadedState.playerLives);
      setters.setDialogue(loadedState.dialogue);
      setters.setCompletedHotspotIds(loadedState.completedHotspotIds);
      setters.setSolvedEnigmaIds(loadedState.solvedEnigmaIds);
      setters.setChosenConversationReplyIds(loadedState.chosenConversationReplyIds);
      setters.setAskedConversationNodeIds(loadedState.askedConversationNodeIds);
      setters.setHiddenConversationReplyIds(loadedState.hiddenConversationReplyIds);
      setters.setLaunchedCinematicIds(loadedState.launchedCinematicIds);
      setters.setCompletedCombinationIds(loadedState.completedCombinationIds);
      setters.setUsedLogicRuleIds(loadedState.usedLogicRuleIds);
      setters.setUsedSceneObjectIds(loadedState.usedSceneObjectIds);
      setters.setRevealedSceneObjectIds(loadedState.revealedSceneObjectIds);
      setters.setSceneObjectTextOverrides(loadedState.sceneObjectTextOverrides);
      setters.setSelectedInventoryIds(loadedState.selectedInventoryIds);
      setters.setActiveEnding(loadedState.activeEnding);
      setters.setHeroState(loadedState.heroState);
      setters.setHeroSetupComplete(loadedState.heroSetupComplete);
      setters.setLastDiceRoll(loadedState.lastDiceRoll);
      setters.setHeroCombatStates(loadedState.heroCombatStates);
      setters.setActiveHeroCombat(null);
      setters.setEquippedHeroItemIds(loadedState.equippedHeroItemIds);
      setters.setEquippedHeroSlotMap(loadedState.equippedHeroSlotMap);
      setters.setLastChoiceSnapshot(null);
      setters.setChoiceEffectNotices([]);
      setters.setViewerImage(null);
      setters.setPlayingCinematic(null);
      closeEnigma();
      return true;
    } catch {
      setters.setDialogue('Impossible dé charger cette sauvegarde.');
      return false;
    }
  };

  const syncWithProject = (nextProject) => {
    initializeFromProject(nextProject);
  };

  return {
    initializeFromProject,
    resetPreview,
    saveGameState,
    loadGameState,
    syncWithProject,
  };
}
