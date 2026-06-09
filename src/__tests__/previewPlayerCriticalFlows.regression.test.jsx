import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { usePreviewPlayer } from '../domains/player/hooks/usePreviewPlayer';

const makeCriticalProject = () => ({
  id: 'critical-preview',
  title: 'Critical Preview',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'scene-start', targetCinematicId: '' },
  heroAdventure: {
    enabled: true,
    dice: { sides: 20, label: 'd20' },
    rules: {
      criticalSuccess: 20,
      criticalFailure: 1,
      criticalChance: 0,
      criticalMultiplier: 2,
    },
    combat: {
      turnMode: true,
      enemyAutoTurn: false,
      enemyStrength: 0,
    },
    hero: {
      name: 'Ariane',
      health: 12,
      maxHealth: 12,
      mana: 5,
      maxMana: 5,
      skills: [{ id: 'force', name: 'Force', value: 8 }],
      powers: [],
    },
  },
  acts: [{ id: 'act-1', name: 'Acte 1' }],
  items: [
    { id: 'key', name: 'Cle de cuivre', imageData: 'data:image/png;base64,a2V5' },
    { id: 'badge', name: 'Badge solaire', imageData: 'data:image/png;base64,YmFkZ2U=' },
    { id: 'watch', name: 'Montre arretee', imageId: 'asset-watch', icon: 'WATCH' },
    { id: 'note', name: 'Note froissee', icon: 'NOTE' },
  ],
  scenes: [
    {
      id: 'scene-start',
      name: 'Hall',
      actId: 'act-1',
      introText: 'Le hall attend.',
      hotspots: [
        {
          id: 'spot-key',
          name: 'Vase',
          x: 20,
          y: 50,
          width: 10,
          height: 10,
          actionType: 'dialogue_item',
          dialogue: 'Une cle tombe du vase.',
          rewardItemId: 'key',
          objectImageData: 'data:image/png;base64,dmFzZQ==',
          objectImageName: 'Vase ancien',
        },
        {
          id: 'spot-enigma-door',
          name: 'Porte codee',
          x: 70,
          y: 50,
          width: 12,
          height: 18,
          actionType: 'scene',
          requiredItemId: 'key',
          enigmaId: 'enigma-door',
          targetSceneId: 'scene-vault',
          dialogue: 'La serrure accepte la cle.',
        },
        {
          id: 'spot-cinematic',
          name: 'Projecteur',
          x: 50,
          y: 30,
          width: 12,
          height: 12,
          actionType: 'cinematic',
          targetCinematicId: 'cin-intro',
          dialogue: 'Le projecteur gronde.',
        },
        {
          id: 'spot-fight',
          name: 'Sentinelle',
          x: 45,
          y: 70,
          width: 14,
          height: 14,
          actionType: 'hero_combat',
          combatEnemyName: 'Sentinelle',
          combatEnemyMaxHealth: 2,
          combatAttackDifficulty: 5,
          combatEnemyStrength: 0,
          combatRewardItemId: 'badge',
          combatVictoryDialogue: 'La sentinelle cede.',
          combatVictoryTargetSceneId: 'scene-vault',
        },
        {
          id: 'spot-note',
          name: 'Papier froisse',
          x: 30,
          y: 70,
          width: 10,
          height: 10,
          actionType: 'dialogue_item',
          dialogue: 'Une note apparait dans votre main.',
          rewardItemId: 'note',
        },
        {
          id: 'spot-empty-scene',
          name: 'Couloir',
          x: 82,
          y: 68,
          width: 10,
          height: 10,
          actionType: 'scene',
          targetSceneId: 'scene-vault',
          dialogue: 'Vous avancez sans rien trouver.',
        },
        {
          id: 'spot-lens',
          name: 'Lentille sale',
          x: 12,
          y: 28,
          width: 10,
          height: 10,
          actionType: 'dialogue',
          dialogue: 'La lentille revele une marque.',
          objectImageData: 'data:image/png;base64,bGVucw==',
          objectImageName: 'Marque sur la lentille',
        },
        {
          id: 'spot-painting-action',
          name: 'Tableau sans prise',
          x: 18,
          y: 28,
          width: 10,
          height: 10,
          clickMode: 'action',
          actionType: 'dialogue',
          dialogue: 'Le tableau cache un symbole.',
          imageData: 'data:image/png;base64,cGFpbnRpbmc=',
        },
        {
          id: 'spot-asset-image',
          name: 'Carte murale',
          x: 40,
          y: 28,
          width: 10,
          height: 10,
          actionType: 'dialogue',
          dialogue: 'La carte montre une route cachee.',
          objectImageId: 'asset-zone-map',
          objectImageName: 'Route cachee',
        },
        {
          id: 'spot-puzzle',
          name: 'Tableau puzzle',
          x: 55,
          y: 28,
          width: 10,
          height: 10,
          actionType: 'dialogue',
          enigmaId: 'enigma-puzzle',
          dialogue: 'Le tableau se réaligne.',
        },
      ],
      sceneObjects: [],
    },
    {
      id: 'scene-vault',
      name: 'Coffre',
      actId: 'act-1',
      introText: 'Le coffre est ouvert.',
      hotspots: [],
      sceneObjects: [],
    },
  ],
  enigmas: [{
    id: 'enigma-door',
    name: 'Code de la porte',
    type: 'code',
    question: 'Entre le code.',
    solutionText: '1234',
    successMessage: 'Le code ouvre la porte.',
    failMessage: 'Le code resiste.',
    unlockType: 'scene',
    targetSceneId: 'scene-vault',
  }, {
    id: 'enigma-puzzle',
    name: 'Image fragmentée',
    type: 'puzzle',
    question: 'Recompose le tableau.',
    imageData: 'data:image/png;base64,cHV6emxl',
    gridRows: 2,
    gridCols: 2,
    successMessage: 'Le tableau est recomposé.',
    failMessage: 'Le tableau reste instable.',
    unlockType: 'none',
  }],
  cinematics: [{
    id: 'cin-intro',
    name: 'Revelation',
    cinematicType: 'slides',
    slides: [{ id: 'slide-1', narration: 'Un symbole apparait.' }],
    steps: [],
    onEndType: 'scene',
    targetSceneId: 'scene-vault',
  }],
  combinations: [],
  assets: [
    { id: 'asset-watch', type: 'image', name: 'Montre arretee.png', url: 'data:image/png;base64,d2F0Y2g=' },
    { id: 'asset-zone-map', type: 'image', name: 'Route cachee.png', url: 'data:image/png;base64,bWFw' },
  ],
  storyVariables: [],
});

const renderPreview = () => {
  const project = makeCriticalProject();
  return {
    project,
    ...renderHook(() => usePreviewPlayer(project, {
      getItemById: (itemId) => project.items.find((item) => item.id === itemId),
    })),
  };
};

describe('preview player critical flows', () => {
  test('keeps the public preview player API stable for classic tabs', () => {
    const { result } = renderPreview();

    expect(Object.keys(result.current)).toEqual([
      'playSceneId',
      'setPlaySceneId',
      'playScene',
      'inventory',
      'visitedSceneIds',
      'storyVariables',
      'adventureJournalEntries',
      'setInventory',
      'addInventoryItem',
      'removeInventoryItem',
      'playerLives',
      'setPlayerLives',
      'heroAdventure',
      'heroState',
      'heroSetupComplete',
      'activeHeroCombat',
      'heroCombatStates',
      'equippedHeroItemIds',
      'equippedHeroSlotMap',
      'lastChoiceSnapshot',
      'setHeroState',
      'adjustHeroStat',
      'lastDiceRoll',
      'rollHeroDie',
      'attackActiveHeroCombat',
      'rollActiveEnemyCombat',
      'attemptSurvivalHeroCombat',
      'attemptEscapeHeroCombat',
      'closeHeroCombat',
      'selectHeroCharacter',
      'rollHeroSetupSkills',
      'completeHeroSetup',
      'sceneTimerResetKey',
      'completedHotspotIds',
      'chosenConversationReplyIds',
      'hiddenConversationReplyIds',
      'usedLogicRuleIds',
      'usedSceneObjectIds',
      'revealedSceneObjectIds',
      'sceneObjectTextOverrides',
      'markSceneObjectUsed',
      'markHotspotCompleted',
      'dialogue',
      'setDialogue',
      'viewerImage',
      'setViewerImage',
      'playingCinematic',
      'setPlayingCinematic',
      'playingSlideIndex',
      'setPlayingSlideIndex',
      'currentSlide',
      'selectedInventoryIds',
      'setSelectedInventoryIds',
      'draggedInventoryId',
      'setDraggedInventoryId',
      'audioRef',
      'activeEnigma',
      'activeConversation',
      'activeEnding',
      'choiceEffectNotices',
      'enigmaCodeInput',
      'setEnigmaCodeInput',
      'enigmaColorAttempt',
      'setEnigmaColorAttempt',
      'pushEnigmaColor',
      'closeEnigma',
      'openEnigma',
      'closeConversation',
      'closeEnding',
      'clearChoiceEffectNotices',
      'isConversationReplyAvailable',
      'getConversationReplyLockReason',
      'chooseConversationReply',
      'submitEnigma',
      'enigmaPuzzleOrder',
      'enigmaPuzzleSelectedIndex',
      'clickPuzzlePiece',
      'enigmaDragBank',
      'enigmaDragSlots',
      'enigmaDraggedPiece',
      'setEnigmaDraggedPiece',
      'moveDragPieceToSlot',
      'returnDragPieceToBank',
      'enigmaRotationAngles',
      'rotatePuzzlePiece',
      'simonPlaybackIndex',
      'simonPlayerTurn',
      'startSimonPlayback',
      'closeCinematic',
      'advanceCinematic',
      'openInventoryItem',
      'equipHeroItem',
      'unequipHeroItem',
      'combineInventoryItems',
      'launchCinematic',
      'applySceneTimerEnd',
      'triggerHotspot',
      'previewHeroCombat',
      'resetPreview',
      'saveGameState',
      'loadGameState',
      'restoreLastChoiceSnapshot',
      'syncWithProject',
      'removeInventoryItemReferences',
      'removeDeletedSceneReferences',
    ]);
  });

  test('preserves scene, hotspot, inventory, enigma and cinematic flow', () => {
    const { project, result } = renderPreview();

    expect(result.current.playSceneId).toBe('scene-start');
    expect(result.current.dialogue).toBe('Le hall attend.');

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[0]);
    });

    expect(result.current.inventory).toEqual(['key']);
    expect(result.current.selectedInventoryIds).toEqual(['key']);
    expect(result.current.completedHotspotIds).toContain('spot-key');
    expect(result.current.viewerImage).toMatchObject({
      src: 'data:image/png;base64,dmFzZQ==',
      name: 'Vase ancien',
      caption: 'Une cle tombe du vase.',
    });

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[1]);
    });
    expect(result.current.activeEnigma?.enigma.id).toBe('enigma-door');

    act(() => {
      result.current.setEnigmaCodeInput('1234');
    });
    act(() => {
      result.current.submitEnigma();
    });

    expect(result.current.activeEnigma).toBe(null);
    expect(result.current.playSceneId).toBe('scene-vault');
    expect(result.current.dialogue).toBe('Le coffre est ouvert.');

    act(() => {
      result.current.resetPreview();
    });
    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[2]);
    });

    expect(result.current.playingCinematic?.id).toBe('cin-intro');

    act(() => {
      result.current.advanceCinematic();
    });

    expect(result.current.playingCinematic).toBe(null);
    expect(result.current.playSceneId).toBe('scene-vault');
  });

  test('shows collected and clicked inventory items in the viewer', () => {
    const { result } = renderPreview();

    act(() => {
      result.current.addInventoryItem('key');
    });

    expect(result.current.inventory).toContain('key');
    expect(result.current.viewerImage).toMatchObject({
      id: 'key',
      src: 'data:image/png;base64,a2V5',
      name: 'Cle de cuivre',
    });

    act(() => {
      result.current.setViewerImage(null);
      result.current.addInventoryItem('watch');
    });

    expect(result.current.inventory).toContain('watch');
    expect(result.current.viewerImage).toMatchObject({
      id: 'watch',
      src: 'data:image/png;base64,d2F0Y2g=',
      name: 'Montre arretee',
    });

    act(() => {
      result.current.setViewerImage(null);
      result.current.openInventoryItem('watch', { previewOnly: true });
    });

    expect(result.current.viewerImage).toMatchObject({
      id: 'watch',
      src: 'data:image/png;base64,d2F0Y2g=',
      name: 'Montre arretee',
    });

    act(() => {
      result.current.setViewerImage(null);
      result.current.openInventoryItem('note');
    });

    expect(result.current.selectedInventoryIds).toContain('note');
    expect(result.current.viewerImage).toMatchObject({
      id: 'note',
      src: '',
      name: 'Note froissee',
      icon: 'NOTE',
    });
  });

  test('shows hotspot reward items even without a dedicated hotspot image', () => {
    const { project, result } = renderPreview();

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[4]);
    });

    expect(result.current.inventory).toContain('note');
    expect(result.current.viewerImage).toMatchObject({
      id: 'note',
      src: '',
      name: 'Note froissee',
      icon: 'NOTE',
    });
  });

  test('does not restore a closed item image on a later action without image', () => {
    const { project, result } = renderPreview();

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[0]);
    });
    expect(result.current.viewerImage).toMatchObject({
      src: 'data:image/png;base64,dmFzZQ==',
      name: 'Vase ancien',
    });

    act(() => {
      result.current.setViewerImage(null);
    });
    expect(result.current.viewerImage).toBe(null);

    const emptySceneHotspot = project.scenes[0].hotspots.find((spot) => spot.id === 'spot-empty-scene');
    act(() => {
      result.current.triggerHotspot(emptySceneHotspot);
    });

    expect(result.current.playSceneId).toBe('scene-vault');
    expect(result.current.viewerImage).toBe(null);
  });

  test('keeps the engine viewer image cleared after the player closes it', () => {
    const { result } = renderPreview();

    act(() => {
      result.current.addInventoryItem('key');
    });
    expect(result.current.viewerImage?.id).toBe('key');

    act(() => {
      result.current.setViewerImage(null);
    });
    act(() => {
      result.current.markHotspotCompleted('manual-action-without-image');
    });

    expect(result.current.completedHotspotIds).toContain('manual-action-without-image');
    expect(result.current.viewerImage).toBe(null);
  });

  test('shows action images even when no inventory item is rewarded', () => {
    const { project, result } = renderPreview();

    const imageOnlyHotspot = project.scenes[0].hotspots.find((spot) => spot.id === 'spot-lens');
    act(() => {
      result.current.triggerHotspot(imageOnlyHotspot);
    });

    expect(result.current.inventory).toEqual([]);
    expect(result.current.viewerImage).toMatchObject({
      src: 'data:image/png;base64,bGVucw==',
      name: 'Marque sur la lentille',
      caption: 'La lentille revele une marque.',
    });
  });

  test('falls back to the visible action image when no inventory item is rewarded', () => {
    const { project, result } = renderPreview();

    const visibleImageAction = project.scenes[0].hotspots.find((spot) => spot.id === 'spot-painting-action');
    act(() => {
      result.current.triggerHotspot(visibleImageAction);
    });

    expect(result.current.inventory).toEqual([]);
    expect(result.current.viewerImage).toMatchObject({
      src: 'data:image/png;base64,cGFpbnRpbmc=',
      name: 'Tableau sans prise',
      caption: 'Le tableau cache un symbole.',
    });
  });

  test('shows hotspot action images stored in the project asset library', () => {
    const { project, result } = renderPreview();

    const assetBackedHotspot = project.scenes[0].hotspots.find((spot) => spot.id === 'spot-asset-image');
    act(() => {
      result.current.triggerHotspot(assetBackedHotspot);
    });

    expect(result.current.inventory).toEqual([]);
    expect(result.current.viewerImage).toMatchObject({
      src: 'data:image/png;base64,bWFw',
      name: 'Route cachee',
      caption: 'La carte montre une route cachee.',
    });
  });

  test('auto-valide un puzzle image quand les pièces sont remises dans l ordre', () => {
    vi.useFakeTimers();
    try {
      const { project, result } = renderPreview();
      const puzzleHotspot = project.scenes[0].hotspots.find((spot) => spot.id === 'spot-puzzle');

      act(() => {
        result.current.triggerHotspot(puzzleHotspot);
      });

      expect(result.current.activeEnigma?.enigma.id).toBe('enigma-puzzle');
      const order = [...result.current.enigmaPuzzleOrder];
      for (let index = 0; index < order.length; index += 1) {
        if (order[index] === index) continue;
        const targetIndex = order.indexOf(index);
        act(() => {
          result.current.clickPuzzlePiece(index);
        });
        act(() => {
          result.current.clickPuzzlePiece(targetIndex);
        });
        [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
      }

      act(() => {
        vi.advanceTimersByTime(150);
      });

      expect(result.current.activeEnigma).toBe(null);
      expect(result.current.dialogue).toBe('Le tableau se réaligne.');
    } finally {
      vi.useRealTimers();
    }
  });

  test('preserves turn-based preview combat rewards and scene transition', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { project, result } = renderPreview();

    act(() => {
      result.current.completeHeroSetup();
    });
    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[3]);
    });

    expect(result.current.activeHeroCombat).toMatchObject({
      id: 'spot-fight',
      enemyName: 'Sentinelle',
      enemyHealth: 2,
      phase: 'hero',
      status: 'active',
    });

    act(() => {
      result.current.attackActiveHeroCombat('', { rawRoll: 20 });
    });

    expect(result.current.activeHeroCombat).toMatchObject({
      status: 'victory',
      enemyHealth: 0,
      pendingSceneId: 'scene-vault',
    });
    expect(result.current.inventory).toContain('badge');

    act(() => {
      result.current.closeHeroCombat();
    });

    expect(result.current.activeHeroCombat).toBe(null);
    expect(result.current.playSceneId).toBe('scene-vault');
    expect(result.current.dialogue).toContain('La sentinelle cede.');
  });
});
