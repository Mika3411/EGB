export const standaloneSaveSystem = `const SAVE_STORAGE_KEY = 'escapeGameSave:' + String(project?.id || project?.title || 'default');

function getHeroRuntimeFallback(sourceState = {}) {
  const heroId = sourceState?.heroState?.id || '';
  const selectedHero = getHeroChoices().find((hero) => hero.id === heroId) || null;
  return getInitialHeroState(selectedHero || undefined);
}

function getHeroRuntimeContract(sourceState = state) {
  const source = sourceState && typeof sourceState === 'object' ? sourceState : {};
  const fallbackHero = getHeroRuntimeFallback(source);
  return normalizeHeroRuntimeSaveState(source, {
    fallbackHero,
    items: project.items || [],
    slotCount: source.heroState?.equipmentSlotCount || fallbackHero.equipmentSlotCount || project?.heroAdventure?.hero?.equipmentSlotCount || 6,
    diceSides: project?.heroAdventure?.dice?.sides || 20,
  });
}

function getSerializableState() {
  const heroRuntimeState = getHeroRuntimeContract(state);
  return {
    playSceneId: state.playSceneId,
    inventory: Array.isArray(state.inventory) ? state.inventory : [],
    visitedSceneIds: Array.isArray(state.visitedSceneIds) ? state.visitedSceneIds : [],
    storyVariables: state.storyVariables && typeof state.storyVariables === 'object' ? state.storyVariables : {},
    adventureJournalEntries: Array.isArray(state.adventureJournalEntries) ? state.adventureJournalEntries : [],
    dialogue: state.dialogue || '',
    viewerImage: state.viewerImage || null,
    playerLives: Number.isFinite(Number(state.playerLives)) ? Number(state.playerLives) : 3,
    playingCinematicId: state.playingCinematicId || null,
    playingSlideIndex: Number(state.playingSlideIndex) || 0,
    selectedInventoryIds: Array.isArray(state.selectedInventoryIds) ? state.selectedInventoryIds : [],
    completedHotspotIds: Array.isArray(state.completedHotspotIds) ? state.completedHotspotIds : [],
    solvedEnigmaIds: Array.isArray(state.solvedEnigmaIds) ? state.solvedEnigmaIds : [],
    chosenConversationReplyIds: Array.isArray(state.chosenConversationReplyIds) ? state.chosenConversationReplyIds : [],
    askedConversationNodeIds: Array.isArray(state.askedConversationNodeIds) ? state.askedConversationNodeIds : [],
    hiddenConversationReplyIds: Array.isArray(state.hiddenConversationReplyIds) ? state.hiddenConversationReplyIds : [],
    launchedCinematicIds: Array.isArray(state.launchedCinematicIds) ? state.launchedCinematicIds : [],
    completedCombinationIds: Array.isArray(state.completedCombinationIds) ? state.completedCombinationIds : [],
    usedLogicRuleIds: Array.isArray(state.usedLogicRuleIds) ? state.usedLogicRuleIds : [],
    removedSceneObjectIds: Array.isArray(state.removedSceneObjectIds) ? state.removedSceneObjectIds : [],
    revealedSceneObjectIds: Array.isArray(state.revealedSceneObjectIds) ? state.revealedSceneObjectIds : [],
    sceneObjectTextOverrides: state.sceneObjectTextOverrides && typeof state.sceneObjectTextOverrides === 'object' ? state.sceneObjectTextOverrides : {},
    heroState: heroRuntimeState.heroState,
    heroSetupComplete: Boolean(state.heroSetupComplete),
    heroSetupSelectionConfirmed: Boolean(state.heroSetupSelectionConfirmed),
    heroSetupGalleryIndex: Math.max(0, Number(state.heroSetupGalleryIndex) || 0),
    lastDiceRoll: heroRuntimeState.lastDiceRoll,
    equippedHeroItemIds: heroRuntimeState.equippedHeroItemIds,
    equippedHeroSlotMap: heroRuntimeState.equippedHeroSlotMap,
    heroCombatStates: heroRuntimeState.heroCombatStates,
    selectedHeroCombatPowerId: state.selectedHeroCombatPowerId || '',
    activeEnding: state.activeEnding && typeof state.activeEnding === 'object' ? state.activeEnding : null,
    choiceEffectNotices: Array.isArray(state.choiceEffectNotices) ? state.choiceEffectNotices : [],
  };
}

function saveGame(manual = false) {
  try {
    localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(getSerializableState()));
    updateSaveStatus(manual ? 'Sauvegardé.' : '');
    if (manual) {
      state.dialogue = 'Partie sauvegardée.';
      render(false);
    }
    return true;
  } catch (error) {
    console.error('Erreur sauvegarde', error);
    updateSaveStatus('Sauvegarde impossible.');
    if (manual) {
      state.dialogue = 'Impossible de sauvegarder la partie.';
      render(false);
    }
    return false;
  }
}

function loadGame(manual = false) {
  try {
    const rawSave = localStorage.getItem(SAVE_STORAGE_KEY);
    if (!rawSave) {
      updateSaveStatus('Aucune sauvegarde.');
      if (manual) {
        state.dialogue = 'Aucune sauvegarde trouvée.';
        render(false);
      }
      return false;
    }

    const savedState = JSON.parse(rawSave);
    const defaultState = DEFAULT_STATE();
    const inventory = Array.isArray(savedState.inventory) ? savedState.inventory : [];
    const heroRuntimeState = getHeroRuntimeContract({ ...savedState, inventory });
    stopSceneTimer();
    expiredSceneTimerKey = '';
    Object.assign(state, defaultState, savedState, {
      inventory,
      visitedSceneIds: Array.isArray(savedState.visitedSceneIds) ? savedState.visitedSceneIds : [],
      storyVariables: { ...defaultState.storyVariables, ...(savedState.storyVariables && typeof savedState.storyVariables === 'object' ? savedState.storyVariables : {}) },
      adventureJournalEntries: Array.isArray(savedState.adventureJournalEntries) ? savedState.adventureJournalEntries : [],
      playerLives: Number.isFinite(Number(savedState.playerLives)) ? Math.max(0, Number(savedState.playerLives)) : 3,
      selectedInventoryIds: Array.isArray(savedState.selectedInventoryIds) ? savedState.selectedInventoryIds : [],
      completedHotspotIds: Array.isArray(savedState.completedHotspotIds) ? savedState.completedHotspotIds : [],
      solvedEnigmaIds: Array.isArray(savedState.solvedEnigmaIds) ? savedState.solvedEnigmaIds : [],
      chosenConversationReplyIds: Array.isArray(savedState.chosenConversationReplyIds) ? savedState.chosenConversationReplyIds : [],
      askedConversationNodeIds: Array.isArray(savedState.askedConversationNodeIds) ? savedState.askedConversationNodeIds : [],
      hiddenConversationReplyIds: Array.isArray(savedState.hiddenConversationReplyIds) ? savedState.hiddenConversationReplyIds : [],
      launchedCinematicIds: Array.isArray(savedState.launchedCinematicIds) ? savedState.launchedCinematicIds : [],
      completedCombinationIds: Array.isArray(savedState.completedCombinationIds) ? savedState.completedCombinationIds : [],
      usedLogicRuleIds: Array.isArray(savedState.usedLogicRuleIds) ? savedState.usedLogicRuleIds : [],
      removedSceneObjectIds: Array.isArray(savedState.removedSceneObjectIds) ? savedState.removedSceneObjectIds : [],
      revealedSceneObjectIds: Array.isArray(savedState.revealedSceneObjectIds) ? savedState.revealedSceneObjectIds : [],
      sceneObjectTextOverrides: savedState.sceneObjectTextOverrides && typeof savedState.sceneObjectTextOverrides === 'object' ? savedState.sceneObjectTextOverrides : {},
      heroState: heroRuntimeState.heroState,
      heroSetupComplete: savedState.heroSetupComplete ?? !IS_HERO_ADVENTURE,
      heroSetupSelectionConfirmed: savedState.heroSetupSelectionConfirmed ?? !IS_HERO_ADVENTURE,
      heroSetupGalleryIndex: Math.max(0, Number(savedState.heroSetupGalleryIndex) || 0),
      lastDiceRoll: heroRuntimeState.lastDiceRoll,
      equippedHeroItemIds: heroRuntimeState.equippedHeroItemIds,
      equippedHeroSlotMap: heroRuntimeState.equippedHeroSlotMap,
      heroCombatStates: heroRuntimeState.heroCombatStates,
      activeHeroCombat: null,
      selectedHeroCombatPowerId: savedState.selectedHeroCombatPowerId || '',
      inventoryDrawerOpen: false,
      activeEnigma: null,
      activeEnding: savedState.activeEnding && typeof savedState.activeEnding === 'object' ? savedState.activeEnding : null,
      choiceEffectNotices: Array.isArray(savedState.choiceEffectNotices) ? savedState.choiceEffectNotices : [],
      enigmaCodeInput: '',
      enigmaColorAttempt: [],
      enigmaPuzzleOrder: [],
      enigmaPuzzleSelectedIndex: null,
      enigmaDragBank: [],
      enigmaDragSlots: [],
      enigmaDraggedPiece: null,
      enigmaRotationAngles: [],
      sceneTimerRemaining: 0,
      simonPlaybackIndex: -1,
      simonPlayerTurn: false,
    });
    updateSaveStatus('Chargé.');

    if (manual) {
      state.dialogue = 'Sauvegarde chargée.';
    }

    beginActPreload(getPlayScene());
    render(false);
    return true;
  } catch (error) {
    console.error('Erreur chargement sauvegarde', error);
    updateSaveStatus('Chargement impossible.');
    if (manual) {
      state.dialogue = 'Impossible de charger cette sauvegarde.';
      render(false);
    }
    return false;
  }
}

function deleteSave(manual = false) {
  try {
    localStorage.removeItem(SAVE_STORAGE_KEY);
    localStorage.removeItem(SAVE_STORAGE_KEY + ':name');
    localStorage.removeItem(SAVE_STORAGE_KEY + ':lastPayload');
    updateSaveStatus(manual ? 'Sauvegarde supprimée.' : '');
    if (manual) state.dialogue = 'Sauvegarde supprimée.';
  } catch (error) {
    console.error('Erreur suppression sauvegarde', error);
    updateSaveStatus('Suppression impossible.');
    if (manual) state.dialogue = 'Impossible de supprimer la sauvegarde.';
  }
  if (manual) render(false);
}

function clearGameSave() {
  deleteSave(true);
}

function buildSavePayload(saveName = '') {
  return {
    type: 'escape-game-save',
    version: 1,
    name: String(saveName || '').trim() || 'Sauvegarde',
    projectId: String(project?.id || ''),
    projectTitle: String(project?.title || ''),
    exportedAt: new Date().toISOString(),
    state: getSerializableState(),
  };
}

function safeSaveFilename(value = 'sauvegarde') {
  return String(value || 'sauvegarde')
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'sauvegarde';
}

function downloadSaveFile(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeSaveFilename(payload.name) + '.json';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function exportSaveAsJson() {
  const defaultName = localStorage.getItem(SAVE_STORAGE_KEY + ':name') || 'Sauvegarde';
  const saveName = window.prompt('Nom de la sauvegarde · exporter :', defaultName);
  if (saveName === null) return;

  const payload = buildSavePayload(saveName);
  try {
    localStorage.setItem(SAVE_STORAGE_KEY + ':name', payload.name);
  } catch (error) {
    console.warn('Nom non enregistré localement', error);
  }

  downloadSaveFile(payload);
  state.dialogue = 'Sauvegarde exportée : ' + payload.name + '.';
  render(false);
}

function renameCurrentSave() {
  const currentName = localStorage.getItem(SAVE_STORAGE_KEY + ':name') || 'Sauvegarde';
  const nextName = window.prompt('Nouveau nom de la sauvegarde :', currentName);
  if (nextName === null) return;

  const cleanName = String(nextName).trim() || 'Sauvegarde';
  try {
    localStorage.setItem(SAVE_STORAGE_KEY + ':name', cleanName);

    const rawSave = localStorage.getItem(SAVE_STORAGE_KEY);
    if (rawSave) {
      const payload = buildSavePayload(cleanName);
      localStorage.setItem(SAVE_STORAGE_KEY + ':lastPayload', JSON.stringify(payload));
    }

    state.dialogue = 'Sauvegarde renommée : ' + cleanName + '.';
  } catch (error) {
    console.error('Erreur renommage sauvegarde', error);
    state.dialogue = 'Impossible de renommer la sauvegarde localement.';
  }
  render(false);
}

function normalizeImportedSave(data) {
  if (!data || typeof data !== 'object') return null;

  if (data.type === 'escape-game-save' && data.state && typeof data.state === 'object') {
    return {
      name: String(data.name || 'Sauvegarde importée'),
      state: data.state,
    };
  }

  if (data.playSceneId || Array.isArray(data.inventory) || Array.isArray(data.completedHotspotIds)) {
    return {
      name: 'Sauvegarde importée',
      state: data,
    };
  }

  return null;
}

function importSaveFromJsonFile(file) {
  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const data = JSON.parse(String(reader.result || '{}'));
      const imported = normalizeImportedSave(data);

      if (!imported) {
        state.dialogue = 'Ce fichier ne ressemble pas à une sauvegarde valide.';
        render(false);
        return;
      }

      const importedState = imported.state || {};
      const inventory = Array.isArray(importedState.inventory) ? importedState.inventory : [];
      const heroRuntimeState = getHeroRuntimeContract({ ...importedState, inventory });
      stopSceneTimer();
      expiredSceneTimerKey = '';
      Object.assign(state, DEFAULT_STATE(), importedState, {
        inventory,
        heroState: heroRuntimeState.heroState,
        heroSetupComplete: importedState.heroSetupComplete ?? !IS_HERO_ADVENTURE,
        heroSetupSelectionConfirmed: importedState.heroSetupSelectionConfirmed ?? !IS_HERO_ADVENTURE,
        heroSetupGalleryIndex: Math.max(0, Number(importedState.heroSetupGalleryIndex) || 0),
        lastDiceRoll: heroRuntimeState.lastDiceRoll,
        equippedHeroItemIds: heroRuntimeState.equippedHeroItemIds,
        equippedHeroSlotMap: heroRuntimeState.equippedHeroSlotMap,
        heroCombatStates: heroRuntimeState.heroCombatStates,
        activeHeroCombat: null,
      });

      try {
        localStorage.setItem(SAVE_STORAGE_KEY, JSON.stringify(getSerializableState()));
        localStorage.setItem(SAVE_STORAGE_KEY + ':name', imported.name || 'Sauvegarde importée');
      } catch (storageError) {
        console.warn('Sauvegarde locale impossible après import', storageError);
      }

      state.dialogue = 'Sauvegarde importée : ' + (imported.name || 'Sauvegarde importée') + '.';
      render(false);
    } catch (error) {
      console.error('Erreur import sauvegarde', error);
      state.dialogue = 'Impossible de lire ce fichier JSON.';
      render(false);
    }
  };

  reader.onerror = () => {
    state.dialogue = 'Impossible d’ouvrir ce fichier.';
    render(false);
  };

  reader.readAsText(file);
}
`;
