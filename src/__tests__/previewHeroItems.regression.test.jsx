import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, test } from 'vitest';
import { usePreviewPlayer } from '../domains/player/hooks/usePreviewPlayer';

const makeHeroItemProject = () => ({
  id: 'preview-hero-items',
  title: 'Preview Hero Items',
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
    hero: {
      id: 'hero-1',
      name: 'Ariane',
      health: 6,
      maxHealth: 10,
      mana: 2,
      maxMana: 6,
      equipmentSlotCount: 4,
      skills: [{ id: 'force', name: 'Force', value: 3 }],
      powers: [],
    },
  },
  scenes: [{
    id: 'scene-start',
    name: 'Hall',
    introText: 'Le hall attend.',
    hotspots: [],
    sceneObjects: [],
  }],
  items: [{
    id: 'health-potion',
    name: 'Soin',
    heroItemType: 'health_potion',
    heroItemAmount: 3,
  }, {
    id: 'mana-potion',
    name: 'Mana',
    heroItemType: 'mana_potion',
    heroItemAmount: 4,
  }, {
    id: 'sword',
    name: 'Epee',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'skill',
    heroItemSkillId: 'force',
    heroItemBonus: 2,
  }, {
    id: 'amulet',
    name: 'Amulette',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'maxHealth',
    heroItemBonus: 3,
  }, {
    id: 'ring',
    name: 'Anneau',
    heroItemType: 'equipment',
    heroItemBonusTarget: 'maxMana',
    heroItemBonus: 4,
  }],
  enigmas: [],
  cinematics: [],
  combinations: [],
  assets: [],
  storyVariables: [],
});

const renderPreview = () => {
  const project = makeHeroItemProject();
  return {
    project,
    ...renderHook(() => usePreviewPlayer(project, {
      getItemById: (itemId) => project.items.find((item) => item.id === itemId),
    })),
  };
};

const addItems = (result, itemIds) => {
  itemIds.forEach((itemId) => {
    act(() => {
      result.current.addInventoryItem(itemId);
    });
  });
};

afterEach(() => {
  localStorage.clear();
});

describe('preview hero items', () => {
  test('uses health and mana potions from the preview inventory', () => {
    const { result } = renderPreview();
    addItems(result, ['health-potion', 'mana-potion']);

    act(() => {
      result.current.openInventoryItem('health-potion');
    });

    expect(result.current.heroState.health).toBe(9);
    expect(result.current.heroState.mana).toBe(2);
    expect(result.current.inventory).toEqual(['mana-potion']);
    expect(result.current.selectedInventoryIds).toEqual(['mana-potion']);
    expect(result.current.dialogue).toContain('+3 PV (9/10)');

    act(() => {
      result.current.openInventoryItem('mana-potion');
    });

    expect(result.current.heroState.health).toBe(9);
    expect(result.current.heroState.mana).toBe(6);
    expect(result.current.inventory).toEqual([]);
    expect(result.current.selectedInventoryIds).toEqual([]);
    expect(result.current.dialogue).toContain('+4 mana (6/6)');
  });

  test('equips and unequips preview hero equipment bonuses cleanly', () => {
    const { result } = renderPreview();
    addItems(result, ['sword', 'amulet', 'ring']);

    act(() => {
      result.current.openInventoryItem('sword');
    });
    expect(result.current.heroState.skills.find((skill) => skill.id === 'force').value).toBe(5);
    expect(result.current.equippedHeroItemIds).toEqual(['sword']);
    expect(result.current.equippedHeroSlotMap).toEqual({ 0: 'sword' });

    act(() => {
      result.current.openInventoryItem('amulet');
    });
    expect(result.current.heroState.maxHealth).toBe(13);
    expect(result.current.heroState.health).toBe(9);
    expect(result.current.equippedHeroItemIds).toEqual(['sword', 'amulet']);
    expect(result.current.equippedHeroSlotMap).toEqual({ 0: 'sword', 1: 'amulet' });

    act(() => {
      result.current.openInventoryItem('ring');
    });
    expect(result.current.heroState.maxMana).toBe(10);
    expect(result.current.heroState.mana).toBe(6);
    expect(result.current.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(result.current.equippedHeroSlotMap).toEqual({ 0: 'sword', 1: 'amulet', 2: 'ring' });

    act(() => {
      result.current.unequipHeroItem('sword');
    });
    expect(result.current.heroState.skills.find((skill) => skill.id === 'force').value).toBe(3);
    expect(result.current.equippedHeroItemIds).toEqual(['amulet', 'ring']);
    expect(result.current.equippedHeroSlotMap).toEqual({ 1: 'amulet', 2: 'ring' });

    act(() => {
      result.current.unequipHeroItem('amulet');
    });
    expect(result.current.heroState.maxHealth).toBe(10);
    expect(result.current.heroState.health).toBe(9);
    expect(result.current.equippedHeroSlotMap).toEqual({ 2: 'ring' });

    act(() => {
      result.current.unequipHeroItem('ring');
    });
    expect(result.current.heroState.maxMana).toBe(6);
    expect(result.current.heroState.mana).toBe(6);
    expect(result.current.equippedHeroItemIds).toEqual([]);
    expect(result.current.equippedHeroSlotMap).toEqual({});
  });

  test('persists equipped preview hero items through save and load', () => {
    const { result } = renderPreview();
    addItems(result, ['sword']);

    act(() => {
      result.current.openInventoryItem('sword');
    });
    act(() => {
      result.current.saveGameState();
    });
    act(() => {
      result.current.unequipHeroItem('sword');
    });

    expect(result.current.heroState.skills.find((skill) => skill.id === 'force').value).toBe(3);
    expect(result.current.equippedHeroItemIds).toEqual([]);

    act(() => {
      result.current.loadGameState();
    });

    expect(result.current.equippedHeroItemIds).toEqual(['sword']);
    expect(result.current.equippedHeroSlotMap).toEqual({ 0: 'sword' });
    expect(result.current.heroState.skills.find((skill) => skill.id === 'force').value).toBe(5);
  });

  test('normalizes preview hero runtime contracts when loading a save', () => {
    const { project, result } = renderPreview();
    localStorage.setItem(`escapeGamePlayerSave:${project.title}`, JSON.stringify({
      playSceneId: 'scene-start',
      inventory: ['sword', 'amulet', 'ring'],
      heroState: {
        ...project.heroAdventure.hero,
        health: 99,
        maxHealth: 13,
        mana: -4,
        maxMana: 10,
        skills: [{ id: 'force', name: 'Force', value: 5, baseValue: 3, rolledValue: 2, manaCost: '1' }],
      },
      lastDiceRoll: {
        raw: '30',
        sides: '20',
        modifier: '2',
        total: '32',
        success: 'yes',
        skillId: 42,
      },
      equippedHeroItemIds: ['sword', 'sword', 'ghost', 'health-potion', 'amulet', 'ring'],
      equippedHeroSlotMap: { 0: 'ghost', 1: 'amulet', 2: 'sword', 3: 'amulet', 99: 'ring' },
      heroCombatStates: {
        fight: {
          enemyHealth: '-4',
          heroStatusEffects: [
            { type: 'force_buff', amount: '2', duration: '3' },
            { type: 'unknown', amount: 9, duration: 1 },
          ],
        },
      },
    }));

    act(() => {
      result.current.loadGameState();
    });

    expect(result.current.heroState.health).toBe(13);
    expect(result.current.heroState.mana).toBe(0);
    expect(result.current.heroState.skills[0]).toMatchObject({ id: 'force', value: 5, baseValue: 3, rolledValue: 2, manaCost: 1 });
    expect(result.current.lastDiceRoll).toMatchObject({ raw: 20, sides: 20, modifier: 2, total: 32, success: true, skillId: '42' });
    expect(result.current.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(result.current.equippedHeroSlotMap).toEqual({ 0: 'ring', 1: 'amulet', 2: 'sword' });

    act(() => {
      result.current.saveGameState();
    });
    const savedState = JSON.parse(localStorage.getItem(`escapeGamePlayerSave:${project.title}`));
    expect(savedState.heroCombatStates).toEqual({
      fight: {
        enemyHealth: 0,
        heroStatusEffects: [{ type: 'force_buff', amount: 2, duration: 3 }],
      },
    });
  });
});
