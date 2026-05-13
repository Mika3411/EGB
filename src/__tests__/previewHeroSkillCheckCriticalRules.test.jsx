import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { usePreviewPlayer } from '../hooks/usePreviewPlayer';

const makePreviewSkillCheckProject = (hotspotPatch = {}, heroPatch = {}) => ({
  id: 'preview-skill-critical-project',
  title: 'Preview skill critical',
  creationMode: 'hero_adventure',
  start: { type: 'scene', targetSceneId: 'start', targetCinematicId: '' },
  heroAdventure: {
    enabled: true,
    dice: { sides: 20, label: 'd20' },
    rules: {
      criticalSuccess: 20,
      criticalFailure: 1,
      criticalChance: 0,
      criticalMultiplier: 2,
    },
    hero: {
      name: 'Ariane',
      health: 10,
      maxHealth: 10,
      mana: 4,
      maxMana: 4,
      skills: [{ id: 'agility', name: 'Agility', value: 3 }],
      powers: [],
      ...heroPatch,
    },
  },
  scenes: [
    {
      id: 'start',
      name: 'Start',
      introText: 'Start.',
      hotspots: [{
        id: 'door',
        name: 'Door',
        actionType: 'skill_check',
        x: 50,
        y: 50,
        width: 20,
        height: 20,
        skillCheckSkillId: 'agility',
        skillCheckDifficulty: 13,
        skillCheckManaCost: 0,
        skillCheckSuccessDialogue: 'Door opens.',
        skillCheckFailureDialogue: 'Door resists.',
        skillCheckFailureHealthLoss: 0,
        skillCheckSuccessTargetSceneId: 'treasure',
        ...hotspotPatch,
      }],
      sceneObjects: [],
    },
    {
      id: 'treasure',
      name: 'Treasure',
      introText: 'Treasure.',
      hotspots: [],
      sceneObjects: [],
    },
  ],
  items: [],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const renderPreview = (project) => renderHook(() => usePreviewPlayer(project, {
  getItemById: (itemId) => project.items.find((item) => item.id === itemId),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('preview hero skill check critical rules', () => {
  test('forces skill check success on critical success', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const project = makePreviewSkillCheckProject({
      skillCheckDifficulty: 30,
    }, {
      skills: [{ id: 'agility', name: 'Agility', value: 0 }],
    });
    const { result } = renderPreview(project);

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[0]);
    });

    expect(result.current.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 20,
      modifier: 0,
      total: 20,
      difficulty: 30,
      isCriticalSuccess: true,
      isCriticalFailure: false,
      success: true,
    });
    expect(result.current.playSceneId).toBe('treasure');
    expect(result.current.dialogue).toContain('Réussite critique contre 30');
    expect(result.current.dialogue).toContain('Door opens.');
  });

  test('forces skill check failure on critical failure', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const project = makePreviewSkillCheckProject({
      skillCheckDifficulty: 10,
      skillCheckFailureHealthLoss: 2,
    }, {
      skills: [{ id: 'agility', name: 'Agility', value: 30 }],
    });
    const { result } = renderPreview(project);

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[0]);
    });

    expect(result.current.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 1,
      modifier: 30,
      total: 31,
      difficulty: 10,
      isCriticalSuccess: false,
      isCriticalFailure: true,
      success: false,
    });
    expect(result.current.heroState.health).toBe(8);
    expect(result.current.playSceneId).toBe('start');
    expect(result.current.dialogue).toContain('Échec critique contre 10');
    expect(result.current.dialogue).toContain('Door resists.');
  });

  test('keeps normal skill check comparison unchanged', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.45);
    const project = makePreviewSkillCheckProject();
    const { result } = renderPreview(project);

    act(() => {
      result.current.triggerHotspot(project.scenes[0].hotspots[0]);
    });

    expect(result.current.lastDiceRoll).toMatchObject({
      actionType: 'skill_check',
      raw: 10,
      modifier: 3,
      total: 13,
      difficulty: 13,
      isCriticalSuccess: false,
      isCriticalFailure: false,
      success: true,
    });
    expect(result.current.playSceneId).toBe('treasure');
    expect(result.current.dialogue).toContain('Réussite contre 13');
    expect(result.current.dialogue).not.toContain('critique');
  });
});
