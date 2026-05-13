import { act, renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { usePreviewPlayer } from '../hooks/usePreviewPlayer';

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
  assets: [],
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
