import { describe, expect, it } from 'vitest';
import {
  applyResistance,
  estimateCombatBalance,
  getCombatEnemyStats,
  getCombatSimulationStats,
  resolveCombatExchange,
  resolveCombatVictoryReward,
  resolveEnemyCombatAttack,
  resolveHeroCombatAttack,
  simulateCombat,
} from '../lib/combatEngine.js';

const makeRandom = (values) => {
  let index = 0;
  return () => values[index++] ?? values[values.length - 1] ?? 0;
};

const baseStats = {
  diceSides: 20,
  diceLabel: 'd20',
  skillName: 'Force',
  skillBonus: 4,
  heroForce: 3,
  heroPowers: [],
  heroAttackType: 'fire',
  heroHealth: 12,
  heroMaxHealth: 12,
  heroMana: 6,
  heroMaxMana: 6,
  combatManaCost: 1,
  criticalSuccess: 20,
  criticalFailure: 1,
  heroCriticalChance: 0,
  heroCriticalMultiplier: 2,
  enemyName: 'Gardien',
  enemyHealth: 10,
  enemyMaxHealth: 10,
  difficulty: 10,
  enemyStats: {
    heroAttackType: 'fire',
    strength: 2,
    maxMana: 4,
    powerName: 'Brasier',
    powerType: 'fire',
    powerManaCost: 2,
    powerDamage: 6,
    powerUsageChance: 100,
    criticalChance: 0,
    criticalMultiplier: 2,
    resistances: { water: 0, earth: 0, fire: 50, lightning: 0 },
  },
};

describe('combatEngine', () => {
  it('resolves a successful hero attack', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      rawRoll: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.roll.success).toBe(true);
    expect(result.damage).toBe(3);
    expect(result.enemyHealth).toBe(7);
    expect(result.mana).toBe(5);
  });

  it('resolves a missed hero attack', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      rawRoll: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.roll.success).toBe(false);
    expect(result.damage).toBe(0);
    expect(result.enemyHealth).toBe(10);
    expect(result.mana).toBe(5);
  });

  it('applies critical hero damage', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      rawRoll: 20,
    });

    expect(result.roll.isCriticalSuccess).toBe(true);
    expect(result.critical).toBe(true);
    expect(result.rawDamage).toBe(6);
    expect(result.damage).toBe(6);
    expect(result.enemyHealth).toBe(4);
  });

  it('applies elemental resistance to damage', () => {
    expect(applyResistance(10, 30)).toBe(7);
    expect(applyResistance(10, 100)).toBe(0);
  });

  it('applies enemy resistance to hero damage', () => {
    const result = resolveHeroCombatAttack({
      stats: baseStats,
      enemyHealth: 10,
      heroMana: 6,
      power: { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 0, force: 5 },
      rawRoll: 10,
    });

    expect(result.resistance).toBe(50);
    expect(result.rawDamage).toBe(8);
    expect(result.damage).toBe(4);
    expect(result.enemyHealth).toBe(6);
  });

  it('resolves hero hit, mana, critical and enemy resistance', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroCriticalChance: 100 },
      enemyHealth: 10,
      heroMana: 6,
      power: { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 2, force: 5 },
      random: makeRandom([0.5, 0]),
    });

    expect(result.ok).toBe(true);
    expect(result.roll.success).toBe(true);
    expect(result.mana).toBe(3);
    expect(result.critical).toBe(true);
    expect(result.rawDamage).toBe(16);
    expect(result.damage).toBe(8);
    expect(result.enemyHealth).toBe(2);
  });

  it('blocks a hero attack when mana is insufficient', () => {
    const result = resolveHeroCombatAttack({
      stats: baseStats,
      enemyHealth: 10,
      heroMana: 1,
      power: { manaCost: 2, force: 5, type: 'fire' },
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not_enough_mana');
    expect(result.mana).toBe(1);
  });

  it('resolves enemy power, mana and hero resistance', () => {
    const result = resolveEnemyCombatAttack({
      stats: baseStats,
      hero: { resistanceFire: 50 },
      heroHealth: 12,
      enemyMana: 4,
      random: makeRandom([0]),
    });

    expect(result.usesPower).toBe(true);
    expect(result.enemyMana).toBe(2);
    expect(result.damage).toBe(3);
    expect(result.heroHealth).toBe(9);
  });

  it('resolves defeat when enemy damage drops hero health to zero', () => {
    const result = resolveEnemyCombatAttack({
      stats: {
        ...baseStats,
        enemyStats: {
          ...baseStats.enemyStats,
          strength: 20,
          powerUsageChance: 0,
        },
      },
      hero: {},
      heroHealth: 12,
      enemyMana: 4,
    });

    expect(result.usesPower).toBe(false);
    expect(result.damage).toBe(20);
    expect(result.heroHealth).toBe(0);
    expect(result.defeat).toBe(true);
  });

  it('normalizes enemy stats from entry values over combat defaults', () => {
    const stats = getCombatEnemyStats(
      { combatEnemyStrength: 7, combatEnemyResistanceFire: 25, combatEnemyPowerType: 'lightning' },
      { enemyStrength: 2, enemyResistanceFire: 5, enemyPowerType: 'fire' },
    );

    expect(stats.strength).toBe(7);
    expect(stats.powerType).toBe('lightning');
    expect(stats.resistances.fire).toBe(25);
  });

  it('simulates victory with deterministic rolls', () => {
    const project = {
      heroAdventure: {
        dice: { sides: 20, label: 'd20' },
        rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
        hero: {
          health: 12,
          maxHealth: 12,
          mana: 4,
          maxMana: 4,
          skills: [{ id: 'force', name: 'Force', value: 10 }],
          powers: [],
          resistanceFire: 0,
        },
      },
    };

    const result = simulateCombat(
      project,
      { combatEnemyName: 'Blob', combatEnemyMaxHealth: 2, combatAttackDifficulty: 5, combatEnemyStrength: 0 },
      {},
      { random: makeRandom([0.5]) },
    );

    expect(result.status).toBe('victory');
    expect(result.enemyHealth).toBe(0);
  });

  it('estimates win chance, duration and average damage per round', () => {
    const project = {
      heroAdventure: {
        dice: { sides: 20, label: 'd20' },
        rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
        hero: {
          health: 12,
          maxHealth: 12,
          mana: 4,
          maxMana: 4,
          skills: [{ id: 'force', name: 'Force', value: 10 }],
          powers: [],
        },
      },
    };

    const result = estimateCombatBalance(
      project,
      { combatEnemyName: 'Blob', combatEnemyMaxHealth: 2, combatAttackDifficulty: 5, combatEnemyStrength: 0 },
      {},
      {
        iterations: 10,
        randomFactory: () => makeRandom([0.5]),
      },
    );

    expect(result.winChance).toBe(100);
    expect(result.averageRounds).toBe(1);
    expect(result.averageHeroDamagePerRound).toBe(10);
    expect(result.averageEnemyDamagePerRound).toBe(0);
    expect(result.victoryCount).toBe(10);
  });

  it('resolves victory when hero damage drops enemy health to zero', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 3,
      heroMana: 6,
      rawRoll: 10,
    });

    expect(result.damage).toBe(3);
    expect(result.enemyHealth).toBe(0);
    expect(result.victory).toBe(true);
  });

  it('resolves victory reward metadata', () => {
    const reward = resolveCombatVictoryReward(
      { combatRewardItemId: 'amulet' },
      [{ id: 'amulet', name: 'Amulette solaire' }],
    );

    expect(reward).toEqual({
      itemId: 'amulet',
      itemName: 'Amulette solaire',
      message: ' Récompense : Amulette solaire.',
    });
  });

  it('simulates a combat round with the same exchange resolver as the runtime', () => {
    const project = {
      heroAdventure: {
        dice: { sides: 20, label: 'd20' },
        rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
        hero: {
          health: 12,
          maxHealth: 12,
          mana: 6,
          maxMana: 6,
          skills: [{ id: 'force', name: 'Force', value: 4 }],
          powers: [],
        },
      },
    };
    const entry = {
      combatEnemyName: 'Garde',
      combatEnemyMaxHealth: 10,
      combatAttackDifficulty: 10,
      combatEnemyStrength: 2,
      combatEnemyPowerUsageChance: 0,
    };
    const stats = getCombatSimulationStats(project, entry, {});
    const exchange = resolveCombatExchange({
      stats,
      hero: project.heroAdventure.hero,
      heroHealth: stats.heroHealth,
      heroMana: stats.heroMana,
      enemyHealth: stats.enemyHealth,
      enemyMana: stats.enemyStats.maxMana,
      random: makeRandom([0.5]),
    });
    const simulation = simulateCombat(project, entry, {}, {
      random: makeRandom([0.5]),
      maxRounds: 1,
    });

    expect(exchange.ok).toBe(true);
    expect(simulation.heroHealth).toBe(exchange.heroHealth);
    expect(simulation.heroMana).toBe(exchange.heroMana);
    expect(simulation.enemyHealth).toBe(exchange.enemyHealth);
    expect(simulation.enemyMana).toBe(exchange.enemyMana);
  });
});
