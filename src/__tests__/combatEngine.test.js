import { describe, expect, it } from 'vitest';
import {
  applyArmor,
  applyRecovery,
  applyResistance,
  addStatusEffect,
  applyShield,
  estimateCombatBalance,
  getCombatEnemyStats,
  getCombatSimulationStats,
  getStatusModifiers,
  resolveCombatInitiative,
  resolveCombatExchange,
  resolveCombatVictoryReward,
  resolveEnemyCombatAttack,
  resolveEnemyPowerDecision,
  resolveHeroCombatAttack,
  simulateCombat,
  tickStatusEffects,
} from '../shared/services/combatEngine.js';

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
    heroInitiative: 0,
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
    initiative: 0,
    strength: 2,
    maxMana: 4,
    powerName: 'Brasier',
    powerType: 'fire',
    powerManaCost: 2,
    powerDamage: 6,
    powerUsageChance: 100,
    criticalChance: 0,
    criticalMultiplier: 2,
    armor: 0,
    dodgeChance: 0,
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

  it('applies armor as flat damage reduction', () => {
    expect(applyArmor(10, 3)).toEqual({ damage: 7, armor: 3, blocked: 3 });
    expect(applyArmor(2, 5)).toEqual({ damage: 0, armor: 5, blocked: 2 });
  });

  it('caps recovery at hero health and mana maximums', () => {
    expect(applyRecovery({
      health: 8,
      maxHealth: 10,
      mana: 1,
      maxMana: 3,
      healthGain: 5,
      manaGain: 5,
    })).toMatchObject({
      health: 10,
      mana: 3,
      healthRecovered: 2,
      manaRecovered: 2,
    });
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

  it('applies enemy armor to hero damage after resistance', () => {
    const result = resolveHeroCombatAttack({
      stats: {
        ...baseStats,
        enemyStats: {
          ...baseStats.enemyStats,
          armor: 2,
          resistances: { ...baseStats.enemyStats.resistances, fire: 50 },
        },
      },
      enemyHealth: 10,
      heroMana: 6,
      power: { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 0, force: 5 },
      rawRoll: 10,
    });

    expect(result.rawDamage).toBe(8);
    expect(result.resistedDamage).toBe(4);
    expect(result.armorBlocked).toBe(2);
    expect(result.damage).toBe(2);
    expect(result.enemyHealth).toBe(8);
  });

  it('lets critical hero hits pierce full damage blocking for 1 PV', () => {
    const result = resolveHeroCombatAttack({
      stats: {
        ...baseStats,
        heroAttackType: 'physical',
        enemyStats: {
          ...baseStats.enemyStats,
          armor: 999,
          resistances: { water: 0, earth: 0, fire: 0, lightning: 0 },
        },
      },
      enemyHealth: 10,
      heroMana: 6,
      rawRoll: 20,
    });

    expect(result.critical).toBe(true);
    expect(result.criticalPierced).toBe(true);
    expect(result.damage).toBe(1);
    expect(result.enemyHealth).toBe(9);
  });

  it('lets the enemy dodge a successful hero attack', () => {
    const result = resolveHeroCombatAttack({
      stats: {
        ...baseStats,
        heroAttackType: 'physical',
        enemyStats: {
          ...baseStats.enemyStats,
          dodgeChance: 100,
        },
      },
      enemyHealth: 10,
      heroMana: 6,
      rawRoll: 10,
      random: makeRandom([0]),
    });

    expect(result.roll.success).toBe(true);
    expect(result.dodged).toBe(true);
    expect(result.damage).toBe(0);
    expect(result.enemyHealth).toBe(10);
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

  it('applies hero power recovery after mana is spent', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroHealth: 5,
      heroMana: 6,
      power: { id: 'soin', name: 'Soin', type: 'water', manaCost: 2, force: 0, healHealth: 4, healMana: 1 },
      rawRoll: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.damage).toBe(3);
    expect(result.heroHealth).toBe(9);
    expect(result.mana).toBe(4);
    expect(result.recovery.healthRecovered).toBe(4);
    expect(result.recovery.manaRecovered).toBe(1);
  });

  it('applies a poison status on a successful hero power', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      power: { id: 'venin', name: 'Venin', type: 'earth', manaCost: 1, force: 0, statusType: 'poison', statusAmount: 2, statusDuration: 3 },
      rawRoll: 10,
    });

    expect(result.ok).toBe(true);
    expect(result.appliedStatusEffect).toEqual({
      type: 'poison',
      amount: 2,
      duration: 3,
      target: 'enemy',
    });
  });

  it('ticks poison, burn and bleed as damage over time', () => {
    const result = tickStatusEffects([
      { type: 'poison', amount: 2, duration: 2 },
      { type: 'burn', amount: 3, duration: 1 },
      { type: 'bleed', amount: 1, duration: 3 },
    ], 12);

    expect(result.damage).toBe(6);
    expect(result.health).toBe(6);
    expect(result.effects).toEqual([
      { type: 'poison', amount: 2, duration: 1 },
      { type: 'bleed', amount: 1, duration: 2 },
    ]);
  });

  it('ticks stun as a skipped action', () => {
    const result = tickStatusEffects([{ type: 'stun', amount: 0, duration: 1 }], 12);

    expect(result.stunned).toBe(true);
    expect(result.damage).toBe(0);
    expect(result.effects).toEqual([]);
  });

  it('uses shield to absorb incoming damage', () => {
    const result = applyShield(5, [{ type: 'shield', amount: 3, duration: 2 }]);

    expect(result.damage).toBe(2);
    expect(result.blocked).toBe(3);
    expect(result.effects).toEqual([]);
  });

  it('adds a shield power to the hero', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      power: { id: 'garde', name: 'Garde', type: 'earth', manaCost: 1, force: 0, statusType: 'shield', statusAmount: 4, statusDuration: 2 },
      rawRoll: 2,
    });

    expect(result.ok).toBe(true);
    expect(result.roll.success).toBe(false);
    expect(result.appliedStatusEffect).toEqual({
      type: 'shield',
      amount: 4,
      duration: 2,
      target: 'hero',
    });
  });

  it('merges repeated status effects by strongest amount and longest duration', () => {
    const result = addStatusEffect(
      [{ type: 'poison', amount: 1, duration: 1 }],
      { type: 'poison', amount: 2, duration: 3 },
    );

    expect(result).toEqual([{ type: 'poison', amount: 2, duration: 3 }]);
  });

  it('applies temporary force buffs to hero damage', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      heroStatusEffects: [{ type: 'force_buff', amount: 2, duration: 2 }],
      rawRoll: 10,
    });

    expect(result.damage).toBe(5);
    expect(result.heroModifiers.force).toBe(2);
  });

  it('applies temporary difficulty debuffs to enemy defense', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, difficulty: 14, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      enemyStatusEffects: [{ type: 'difficulty_debuff', amount: 4, duration: 2 }],
      rawRoll: 6,
    });

    expect(result.roll.success).toBe(true);
    expect(result.roll.difficulty).toBe(10);
  });

  it('applies temporary resistance debuffs before damage reduction', () => {
    const result = resolveHeroCombatAttack({
      stats: baseStats,
      enemyHealth: 10,
      heroMana: 6,
      enemyStatusEffects: [{ type: 'resistance_debuff', amount: 30, duration: 2 }],
      rawRoll: 10,
    });

    expect(result.resistance).toBe(20);
    expect(result.damage).toBe(2);
  });

  it('applies temporary critical buffs to hero attacks', () => {
    const result = resolveHeroCombatAttack({
      stats: { ...baseStats, heroAttackType: 'physical' },
      enemyHealth: 10,
      heroMana: 6,
      heroStatusEffects: [{ type: 'critical_buff', amount: 100, duration: 1 }],
      rawRoll: 10,
      random: makeRandom([0]),
    });

    expect(result.critical).toBe(true);
    expect(result.rawDamage).toBe(6);
  });

  it('applies temporary force debuffs to enemy attacks', () => {
    const result = resolveEnemyCombatAttack({
      stats: {
        ...baseStats,
        enemyStats: {
          ...baseStats.enemyStats,
          powerUsageChance: 0,
        },
      },
      hero: {},
      heroHealth: 12,
      heroStatusEffects: [],
      enemyStatusEffects: [{ type: 'force_debuff', amount: 2, duration: 1 }],
      enemyMana: 0,
    });

    expect(result.baseDamage).toBe(0);
    expect(result.damage).toBe(0);
    expect(result.enemyModifiers.force).toBe(-2);
  });

  it('summarizes buff and debuff modifiers', () => {
    expect(getStatusModifiers([
      { type: 'force_buff', amount: 2, duration: 1 },
      { type: 'critical_debuff', amount: 10, duration: 1 },
    ])).toEqual({
      force: 2,
      difficulty: 0,
      resistance: 0,
      criticalChance: -10,
    });
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

  it('uses enemy power tactically to finish a vulnerable hero', () => {
    const decision = resolveEnemyPowerDecision({
      stats: baseStats,
      hero: {},
      heroHealth: 4,
      enemyHealth: 10,
      enemyMana: 4,
      random: makeRandom([0.99]),
    });

    expect(decision.usesPower).toBe(true);
    expect(decision.reason).toBe('finish');
    expect(decision.score).toBe(100);
  });

  it('conserves enemy mana when the hero is already controlled', () => {
    const decision = resolveEnemyPowerDecision({
      stats: {
        ...baseStats,
        enemyStats: {
          ...baseStats.enemyStats,
          powerUsageChance: 25,
        },
      },
      hero: {},
      heroHealth: 12,
      heroStatusEffects: [{ type: 'stun', duration: 1 }],
      enemyHealth: 10,
      enemyMana: 2,
      random: makeRandom([0.3]),
    });

    expect(decision.usesPower).toBe(false);
    expect(decision.score).toBeLessThan(30);
  });

  it('avoids resisted enemy powers when a normal attack is comparable', () => {
    const decision = resolveEnemyPowerDecision({
      stats: {
        ...baseStats,
        enemyStats: {
          ...baseStats.enemyStats,
          strength: 5,
          powerDamage: 6,
          powerUsageChance: 50,
        },
      },
      hero: { resistanceFire: 80 },
      heroHealth: 12,
      enemyHealth: 10,
      enemyMana: 4,
      random: makeRandom([0.4]),
    });

    expect(decision.usesPower).toBe(false);
    expect(decision.powerDamage).toBe(1);
  });

  it('applies hero armor to enemy damage after resistance', () => {
    const result = resolveEnemyCombatAttack({
      stats: { ...baseStats, heroArmor: 2 },
      hero: { resistanceFire: 50 },
      heroHealth: 12,
      enemyMana: 4,
      random: makeRandom([0]),
    });

    expect(result.usesPower).toBe(true);
    expect(result.rawDamage).toBe(6);
    expect(result.resistedDamage).toBe(3);
    expect(result.armorBlocked).toBe(2);
    expect(result.damage).toBe(1);
    expect(result.heroHealth).toBe(11);
  });

  it('lets the hero dodge an enemy attack', () => {
    const result = resolveEnemyCombatAttack({
      stats: { ...baseStats, heroDodgeChance: 100 },
      hero: {},
      heroHealth: 12,
      enemyMana: 4,
      random: makeRandom([0, 0]),
    });

    expect(result.usesPower).toBe(true);
    expect(result.dodged).toBe(true);
    expect(result.damage).toBe(0);
    expect(result.heroHealth).toBe(12);
  });

  it('resolves initiative with hero winning ties', () => {
    expect(resolveCombatInitiative(baseStats)).toEqual({
      heroInitiative: 0,
      enemyInitiative: 0,
      firstActor: 'hero',
    });
    expect(resolveCombatInitiative({
      ...baseStats,
      heroInitiative: 2,
      enemyStats: { ...baseStats.enemyStats, initiative: 5 },
    }).firstActor).toBe('enemy');
  });

  it('lets the enemy act first when its initiative is higher', () => {
    const project = {
      heroAdventure: {
        dice: { sides: 20, label: 'd20' },
        rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
        hero: {
          health: 12,
          maxHealth: 12,
          mana: 4,
          maxMana: 4,
          initiative: 0,
          skills: [{ id: 'force', name: 'Force', value: 10 }],
          powers: [],
        },
      },
    };

    const result = simulateCombat(
      project,
      {
        combatEnemyName: 'Vif',
        combatEnemyMaxHealth: 100,
        combatAttackDifficulty: 5,
        combatEnemyInitiative: 5,
        combatEnemyStrength: 4,
        combatEnemyPowerUsageChance: 0,
      },
      {},
      { random: makeRandom([0.5]), maxRounds: 1 },
    );

    expect(result.heroHealth).toBe(8);
    expect(result.enemyHealth).toBe(90);
    expect(result.logs[0]).toContain('agit en premier');
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
    expect(result.survivalChance).toBe(100);
    expect(result.averageHeroManaSpent).toBe(0);
    expect(result.averageHeroHealthRemaining).toBe(12);
    expect(result.victoryCount).toBe(10);
  });

  it('estimates mana spent and survival from full combat simulations', () => {
    const project = {
      heroAdventure: {
        dice: { sides: 20, label: 'd20' },
        rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
        hero: {
          health: 6,
          maxHealth: 6,
          mana: 3,
          maxMana: 3,
          skills: [{ id: 'force', name: 'Force', value: 10 }],
          powers: [],
        },
      },
    };

    const result = estimateCombatBalance(
      project,
      {
        combatEnemyName: 'Brute',
        combatEnemyMaxHealth: 20,
        combatAttackDifficulty: 5,
        combatManaCost: 1,
        combatEnemyStrength: 8,
        combatEnemyChaos: 20,
      },
      {},
      {
        iterations: 4,
        randomFactory: () => makeRandom([0.5, 0.5, 0.5, 0.5]),
      },
    );

    expect(result.survivalChance).toBe(0);
    expect(result.averageHeroManaSpent).toBeGreaterThan(0);
    expect(result.averageHeroHealthRemaining).toBe(0);
  });

  it('lets status damage win in the shared simulation', () => {
    const project = {
      heroAdventure: {
        dice: { sides: 20, label: 'd20' },
        rules: { criticalSuccess: 20, criticalFailure: 1, criticalChance: 0, criticalMultiplier: 2 },
        hero: {
          health: 12,
          maxHealth: 12,
          mana: 6,
          maxMana: 6,
          skills: [{ id: 'force', name: 'Force', value: 0 }],
          powers: [{ id: 'poison', name: 'Poison', type: 'earth', manaCost: 0, force: 0, statusType: 'poison', statusAmount: 4, statusDuration: 2 }],
        },
      },
    };
    const result = simulateCombat(project, {
      combatEnemyName: 'Garde',
      combatEnemyMaxHealth: 5,
      combatAttackDifficulty: 1,
      combatEnemyStrength: 0,
      combatEnemyPowerUsageChance: 0,
    }, {}, {
      random: makeRandom([0.5, 0.5]),
      maxRounds: 3,
    });

    expect(result.status).toBe('victory');
    expect(result.heroDamageTotal).toBeGreaterThanOrEqual(5);
    expect(result.logs.join(' ')).toContain("PV d'altération");
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
