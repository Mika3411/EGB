import { describe, expect, test } from 'vitest';
import {
  normalizeEquippedHeroState,
  normalizeHeroCombatStates,
  normalizeHeroRuntimeSaveState,
  normalizeHeroRuntimeState,
  normalizeLastDiceRoll,
} from '../lib/heroRuntimeState.js';

const fallbackHero = {
  id: 'hero-1',
  name: 'Ariane',
  health: 6,
  maxHealth: 10,
  mana: 2,
  maxMana: 6,
  equipmentSlotCount: 4,
  skills: [{ id: 'force', name: 'Force', value: 3, baseValue: 3, rolledValue: 0, manaCost: 0 }],
  powers: [{ id: 'flame', name: 'Flamme', type: 'fire', manaCost: 2, force: 4 }],
  rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
};

const items = [{
  id: 'health-potion',
  heroItemType: 'health_potion',
}, {
  id: 'sword',
  heroItemType: 'equipment',
}, {
  id: 'amulet',
  heroItemType: 'equipment',
}, {
  id: 'ring',
  heroItemType: 'equipment',
}];

describe('hero runtime state contracts', () => {
  test('normalizes heroState without discarding runtime bonuses', () => {
    const hero = normalizeHeroRuntimeState({
      ...fallbackHero,
      health: 99,
      maxHealth: 13,
      mana: -10,
      maxMana: 10,
      armor: '4',
      dodgeChance: 250,
      skills: [{ id: 'force', name: 'Force', value: 5, baseValue: 3, rolledValue: 2, manaCost: '1' }],
    }, fallbackHero, { diceSides: 20 });

    expect(hero.health).toBe(13);
    expect(hero.maxHealth).toBe(13);
    expect(hero.mana).toBe(0);
    expect(hero.maxMana).toBe(10);
    expect(hero.armor).toBe(4);
    expect(hero.dodgeChance).toBe(100);
    expect(hero.skills[0]).toMatchObject({ id: 'force', value: 5, baseValue: 3, rolledValue: 2, manaCost: 1 });
  });

  test('repairs equipped item ids and slot maps against the item catalog', () => {
    const equipment = normalizeEquippedHeroState(
      ['sword', 'sword', 'ghost', 'health-potion', 'amulet', 'ring'],
      { 0: 'ghost', 1: 'amulet', 2: 'sword', 3: 'amulet', 99: 'ring', bad: 'amulet' },
      { items, slotCount: 4 },
    );

    expect(equipment.equippedHeroItemIds).toEqual(['sword', 'amulet', 'ring']);
    expect(equipment.equippedHeroSlotMap).toEqual({ 0: 'ring', 1: 'amulet', 2: 'sword' });
  });

  test('normalizes lastDiceRoll and temporary combat boosts', () => {
    const lastDiceRoll = normalizeLastDiceRoll({
      raw: '30',
      sides: '20',
      modifier: '2',
      total: '32',
      difficulty: '15',
      success: 'yes',
      isCriticalSuccess: 1,
      skillId: 42,
    }, { diceSides: 20 });
    const combatStates = normalizeHeroCombatStates({
      fight: {
        enemyHealth: '-4',
        heroStatusEffects: [
          { type: 'force_buff', amount: '2', duration: '3' },
          { type: 'unknown', amount: 9, duration: 1 },
        ],
        enemyStatusEffects: [{ statusType: 'poison', statusAmount: '4', statusDuration: '2' }],
      },
      invalid: null,
    });

    expect(lastDiceRoll).toMatchObject({
      raw: 20,
      sides: 20,
      modifier: 2,
      total: 32,
      difficulty: 15,
      success: true,
      isCriticalSuccess: true,
      skillId: '42',
    });
    expect(combatStates).toEqual({
      fight: {
        enemyHealth: 0,
        heroStatusEffects: [{ type: 'force_buff', amount: 2, duration: 3 }],
        enemyStatusEffects: [{ type: 'poison', amount: 4, duration: 2 }],
      },
    });
  });

  test('applies the full save contract in one pass', () => {
    const state = normalizeHeroRuntimeSaveState({
      heroState: { ...fallbackHero, health: -2, maxHealth: 13 },
      lastDiceRoll: { success: true, skillId: 'force' },
      equippedHeroItemIds: ['health-potion', 'sword'],
      equippedHeroSlotMap: { 0: 'health-potion', 1: 'sword' },
      heroCombatStates: { fight: { heroStatusEffects: [{ type: 'shield', amount: 5, duration: 1 }] } },
    }, {
      fallbackHero,
      items,
      slotCount: 4,
      diceSides: 20,
    });

    expect(state.heroState.health).toBe(0);
    expect(state.heroState.maxHealth).toBe(13);
    expect(state.lastDiceRoll).toEqual({ success: true, skillId: 'force' });
    expect(state.equippedHeroItemIds).toEqual(['sword']);
    expect(state.equippedHeroSlotMap).toEqual({ 1: 'sword' });
    expect(state.heroCombatStates.fight.heroStatusEffects).toEqual([{ type: 'shield', amount: 5, duration: 1 }]);
  });
});
