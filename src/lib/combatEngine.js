import { DEFAULT_COMBAT_SETTINGS } from './combatDefaults.js';

const HERO_ATTACK_TYPES = ['physical', 'water', 'earth', 'fire', 'lightning'];
const POWER_TYPES = ['water', 'earth', 'fire', 'lightning'];

export const COMBAT_OUTCOMES = {
  ACTIVE: 'active',
  BLOCKED: 'blocked',
  VICTORY: 'victory',
  DEFEAT: 'defeat',
  TIMEOUT: 'timeout',
};

export const numberValue = (value, fallback = 0) => {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
};

export const clampNumber = (value, fallback = 0, min = 0, max = 999) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
};

export const clampDecimal = (value, fallback = 1, min = 0, max = 99) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next * 10) / 10));
};

export const normalizeHeroAttackType = (value) => (
  HERO_ATTACK_TYPES.includes(value) ? value : 'physical'
);

export const normalizePowerType = (value) => (
  POWER_TYPES.includes(value) ? value : 'fire'
);

export const getPowerTypeLabel = (type = '') => ({
  physical: 'Physique',
  water: 'Eau',
  earth: 'Terre',
  fire: 'Feu',
  lightning: 'Foudre',
}[type] || type || 'Physique');

export const getEntryValue = (entry, key, fallback) => (
  entry?.[key] === undefined || entry?.[key] === '' || entry?.[key] === null ? fallback : entry[key]
);

export const normalizeStatKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

export const getHeroForceSkill = (skills = []) => (
  skills.find((skill) => normalizeStatKey(skill.id) === 'force' || normalizeStatKey(skill.name) === 'force')
  || skills[0]
  || null
);

export const getHeroForceValue = (hero = {}, fallbackSkillId = '') => {
  const skills = Array.isArray(hero.skills) ? hero.skills : [];
  const forceSkill = getHeroForceSkill(skills);
  const fallbackSkill = skills.find((skill) => skill.id === fallbackSkillId) || skills[0] || null;
  return Math.max(0, numberValue((forceSkill || fallbackSkill)?.value, 0));
};

export const getElementResistance = (actor = {}, type = '') => {
  const field = {
    water: 'resistanceWater',
    earth: 'resistanceEarth',
    fire: 'resistanceFire',
    lightning: 'resistanceLightning',
  }[type];
  return field ? clampNumber(actor[field], 0, 0, 100) : 0;
};

export const applyResistance = (damage, resistance = 0) => {
  const rawDamage = Math.max(0, Math.round(numberValue(damage, 0)));
  const safeResistance = clampNumber(resistance, 0, 0, 100);
  return safeResistance ? Math.max(0, Math.round(rawDamage * (100 - safeResistance) / 100)) : rawDamage;
};

export const spendMana = (currentMana = 0, cost = 0) => {
  const safeMana = Math.max(0, numberValue(currentMana, 0));
  const safeCost = Math.max(0, numberValue(cost, 0));
  return {
    ok: safeMana >= safeCost,
    spent: safeMana >= safeCost ? safeCost : 0,
    mana: safeMana >= safeCost ? Math.max(0, safeMana - safeCost) : safeMana,
  };
};

export const rollDie = ({ sides = 20, random = Math.random, raw } = {}) => {
  const safeSides = Math.max(2, numberValue(sides, 20));
  const forcedRaw = Number(raw);
  return Number.isFinite(forcedRaw)
    ? clampNumber(Math.round(forcedRaw), 1, 1, safeSides)
    : Math.floor(random() * safeSides) + 1;
};

export const resolveRollOutcome = ({
  raw = 1,
  modifier = 0,
  difficulty = 10,
  criticalSuccess = 20,
  criticalFailure = 1,
} = {}) => {
  const total = numberValue(raw, 1) + numberValue(modifier, 0);
  const isCriticalSuccess = raw === criticalSuccess;
  const isCriticalFailure = raw === criticalFailure;
  return {
    raw,
    modifier: numberValue(modifier, 0),
    total,
    difficulty: Math.max(1, numberValue(difficulty, 10)),
    isCriticalSuccess,
    isCriticalFailure,
    success: isCriticalSuccess || (!isCriticalFailure && total >= Math.max(1, numberValue(difficulty, 10))),
  };
};

export const resolveCritical = ({
  canCrit = true,
  isCriticalSuccess = false,
  chance = 0,
  multiplier = 2,
  random = Math.random,
} = {}) => {
  const safeChance = clampNumber(chance, 0, 0, 100);
  const randomCritical = !isCriticalSuccess && safeChance > 0 && random() * 100 < safeChance;
  return {
    critical: Boolean(canCrit && (isCriticalSuccess || randomCritical)),
    randomCritical,
    multiplier: Math.max(1, Math.min(20, numberValue(multiplier, 2))),
  };
};

export const getCombatEnemyStats = (entry = {}, combatSettings = DEFAULT_COMBAT_SETTINGS) => {
  const defaults = {
    ...DEFAULT_COMBAT_SETTINGS,
    ...(combatSettings && typeof combatSettings === 'object' ? combatSettings : {}),
  };
  const readValue = (entryKey, combatKey, fallback) => (
    getEntryValue(entry, entryKey, defaults[combatKey] ?? fallback)
  );
  const readNumber = (entryKey, combatKey, fallback, min, max) => (
    clampNumber(readValue(entryKey, combatKey, fallback), fallback, min, max)
  );
  const heroAttackType = readValue('combatHeroAttackType', 'heroAttackType', 'physical');
  const powerType = readValue('combatEnemyPowerType', 'enemyPowerType', 'fire');
  const enemyAutoTurnValue = readValue('combatEnemyAutoTurn', 'enemyAutoTurn', true);

  return {
    enemyAutoTurn: enemyAutoTurnValue !== false,
    heroAttackType: normalizeHeroAttackType(heroAttackType),
    strength: readNumber('combatEnemyStrength', 'enemyStrength', numberValue(entry.combatEnemyDamage, DEFAULT_COMBAT_SETTINGS.enemyStrength), 0, 999),
    maxMana: readNumber('combatEnemyMaxMana', 'enemyMaxMana', DEFAULT_COMBAT_SETTINGS.enemyMaxMana, 0, 999),
    powerName: readValue('combatEnemyPowerName', 'enemyPowerName', DEFAULT_COMBAT_SETTINGS.enemyPowerName) || DEFAULT_COMBAT_SETTINGS.enemyPowerName,
    powerType: normalizePowerType(powerType),
    powerManaCost: readNumber('combatEnemyPowerManaCost', 'enemyPowerManaCost', DEFAULT_COMBAT_SETTINGS.enemyPowerManaCost, 0, 999),
    powerDamage: readNumber('combatEnemyPowerDamage', 'enemyPowerDamage', DEFAULT_COMBAT_SETTINGS.enemyPowerDamage, 0, 999),
    powerUsageChance: readNumber('combatEnemyPowerUsageChance', 'enemyPowerUsageChance', DEFAULT_COMBAT_SETTINGS.enemyPowerUsageChance, 0, 100),
    criticalChance: readNumber('combatEnemyCriticalChance', 'enemyCriticalChance', DEFAULT_COMBAT_SETTINGS.enemyCriticalChance, 0, 100),
    criticalMultiplier: clampDecimal(readValue('combatEnemyCriticalMultiplier', 'enemyCriticalMultiplier', DEFAULT_COMBAT_SETTINGS.enemyCriticalMultiplier), DEFAULT_COMBAT_SETTINGS.enemyCriticalMultiplier, 1, 20),
    resistances: {
      water: readNumber('combatEnemyResistanceWater', 'enemyResistanceWater', DEFAULT_COMBAT_SETTINGS.enemyResistanceWater, 0, 100),
      earth: readNumber('combatEnemyResistanceEarth', 'enemyResistanceEarth', DEFAULT_COMBAT_SETTINGS.enemyResistanceEarth, 0, 100),
      fire: readNumber('combatEnemyResistanceFire', 'enemyResistanceFire', DEFAULT_COMBAT_SETTINGS.enemyResistanceFire, 0, 100),
      lightning: readNumber('combatEnemyResistanceLightning', 'enemyResistanceLightning', DEFAULT_COMBAT_SETTINGS.enemyResistanceLightning, 0, 100),
    },
  };
};

export const getCombatSimulationStats = (project = {}, entry = {}, combat = DEFAULT_COMBAT_SETTINGS) => {
  const heroAdventure = project.heroAdventure || {};
  const hero = heroAdventure.hero || {};
  const diceSides = Math.max(2, numberValue(heroAdventure.dice?.sides, 20));
  const skills = Array.isArray(hero.skills) ? hero.skills : [];
  const selectedSkill = skills.find((skill) => skill.id === entry?.combatSkillId) || skills[0] || null;
  const heroMaxHealth = Math.max(1, numberValue(hero.maxHealth, numberValue(hero.health, 12)));
  const heroMaxMana = Math.max(0, numberValue(hero.maxMana, numberValue(hero.mana, 0)));
  const enemyStats = getCombatEnemyStats(entry, combat);

  return {
    diceSides,
    diceLabel: heroAdventure.dice?.label || `d${diceSides}`,
    skillName: selectedSkill?.name || 'Compétence',
    skillBonus: numberValue(selectedSkill?.value, 0),
    heroForce: getHeroForceValue(hero, selectedSkill?.id || ''),
    heroPowers: Array.isArray(hero.powers) ? hero.powers : [],
    heroAttackType: enemyStats.heroAttackType,
    heroHealth: Math.max(0, Math.min(heroMaxHealth, numberValue(hero.health, heroMaxHealth))),
    heroMaxHealth,
    heroMana: Math.max(0, Math.min(heroMaxMana, numberValue(hero.mana, heroMaxMana))),
    heroMaxMana,
    combatManaCost: Math.max(0, numberValue(entry?.combatManaCost, 0)),
    criticalSuccess: clampNumber(heroAdventure.rules?.criticalSuccess, 20, 1, diceSides),
    criticalFailure: clampNumber(heroAdventure.rules?.criticalFailure, 1, 1, diceSides),
    heroCriticalChance: clampNumber(heroAdventure.rules?.criticalChance, 0, 0, 100),
    heroCriticalMultiplier: Math.max(1, Math.min(20, numberValue(heroAdventure.rules?.criticalMultiplier, 2))),
    enemyName: entry?.combatEnemyName || entry?.name || combat.enemyName || 'Ennemi',
    enemyHealth: Math.max(1, numberValue(entry?.combatEnemyMaxHealth, 8)),
    enemyMaxHealth: Math.max(1, numberValue(entry?.combatEnemyMaxHealth, 8)),
    difficulty: Math.max(1, numberValue(entry?.combatAttackDifficulty, 10)),
    enemyStats,
  };
};

export const resolveHeroCombatAttack = ({
  stats,
  enemyHealth,
  heroMana,
  power = null,
  random = Math.random,
  rawRoll,
} = {}) => {
  const powerManaCost = power ? Math.max(0, numberValue(power.manaCost, 0)) : 0;
  const mana = spendMana(heroMana, stats.combatManaCost + powerManaCost);
  if (!mana.ok) return { ok: false, reason: 'not_enough_mana', mana: heroMana };

  const raw = rollDie({ sides: stats.diceSides, random, raw: rawRoll });
  const roll = resolveRollOutcome({
    raw,
    modifier: stats.skillBonus,
    difficulty: stats.difficulty,
    criticalSuccess: stats.criticalSuccess,
    criticalFailure: stats.criticalFailure,
  });
  const powerDamage = power ? Math.max(0, numberValue(power.force, 0)) : 0;
  const baseDamage = roll.success ? Math.max(0, stats.heroForce + powerDamage) : 0;
  const critical = resolveCritical({
    canCrit: roll.success && baseDamage > 0,
    isCriticalSuccess: roll.isCriticalSuccess,
    chance: stats.heroCriticalChance,
    multiplier: stats.heroCriticalMultiplier,
    random,
  });
  const rawDamage = critical.critical ? Math.round(baseDamage * critical.multiplier) : Math.round(baseDamage);
  const attackType = power?.type || stats.heroAttackType;
  const resistance = roll.success && attackType !== 'physical' ? stats.enemyStats.resistances[attackType] || 0 : 0;
  const damage = roll.success ? applyResistance(rawDamage, resistance) : 0;
  const nextEnemyHealth = Math.max(0, numberValue(enemyHealth, stats.enemyHealth) - damage);

  return {
    ok: true,
    roll,
    mana: mana.mana,
    manaSpent: mana.spent,
    powerDamage,
    baseDamage,
    rawDamage,
    damage,
    attackType,
    resistance,
    critical: critical.critical,
    randomCritical: critical.randomCritical,
    criticalMultiplier: critical.multiplier,
    enemyHealth: nextEnemyHealth,
    victory: nextEnemyHealth <= 0,
  };
};

export const resolveEnemyCombatAttack = ({
  stats,
  hero = {},
  heroHealth,
  enemyMana,
  random = Math.random,
} = {}) => {
  const enemyStats = stats.enemyStats;
  const usesPower = enemyStats.maxMana > 0
    && enemyStats.powerManaCost <= enemyMana
    && enemyStats.powerUsageChance > 0
    && random() * 100 < enemyStats.powerUsageChance;
  const nextEnemyMana = usesPower ? Math.max(0, enemyMana - enemyStats.powerManaCost) : enemyMana;
  const baseDamage = usesPower ? enemyStats.powerDamage : enemyStats.strength;
  const critical = resolveCritical({
    canCrit: baseDamage > 0,
    chance: enemyStats.criticalChance,
    multiplier: enemyStats.criticalMultiplier,
    random,
  });
  const rawDamage = critical.critical ? Math.round(baseDamage * critical.multiplier) : Math.round(baseDamage);
  const resistance = usesPower ? getElementResistance(hero, enemyStats.powerType) : 0;
  const damage = applyResistance(rawDamage, resistance);
  const nextHeroHealth = Math.max(0, numberValue(heroHealth, stats.heroHealth) - damage);

  return {
    ok: true,
    usesPower,
    enemyMana: nextEnemyMana,
    baseDamage,
    rawDamage,
    damage,
    resistance,
    critical: critical.critical,
    criticalMultiplier: critical.multiplier,
    heroHealth: nextHeroHealth,
    defeat: nextHeroHealth <= 0,
  };
};

export const selectBestAvailablePower = (powers = [], heroMana = 0, baseManaCost = 0) => (
  [...powers]
    .filter((power) => heroMana >= baseManaCost + Math.max(0, numberValue(power.manaCost, 0)))
    .sort((a, b) => numberValue(b.force, 0) - numberValue(a.force, 0))[0] || null
);

export const createSeededRandom = (seed = 'combat-balance') => {
  let state = 2166136261;
  const text = String(seed || 'combat-balance');
  for (let index = 0; index < text.length; index += 1) {
    state ^= text.charCodeAt(index);
    state = Math.imul(state, 16777619);
  }

  return () => {
    state += 0x6D2B79F5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

export const resolveCombatVictoryReward = (entry = {}, items = [], getItemById = null) => {
  const itemId = entry?.combatRewardItemId || '';
  if (!itemId) return { itemId: '', itemName: '', message: '' };
  const item = getItemById?.(itemId) || (Array.isArray(items) ? items.find((candidate) => candidate.id === itemId) : null);
  const itemName = item?.name || 'objet obtenu';
  return {
    itemId,
    itemName,
    message: ` Récompense : ${itemName}.`,
  };
};

export const resolveCombatExchange = ({
  stats,
  hero = {},
  heroHealth,
  heroMana,
  enemyHealth,
  enemyMana,
  power = null,
  random = Math.random,
  includeEnemyTurn = true,
} = {}) => {
  const heroAttack = resolveHeroCombatAttack({
    stats,
    enemyHealth,
    heroMana,
    power,
    random,
  });
  if (!heroAttack.ok) {
    return {
      ok: false,
      reason: heroAttack.reason,
      heroAttack,
      heroHealth,
      heroMana,
      enemyHealth,
      enemyMana,
    };
  }

  const afterHero = {
    ok: true,
    heroAttack,
    heroHealth,
    heroMana: heroAttack.mana,
    enemyHealth: heroAttack.enemyHealth,
    enemyMana,
    victory: heroAttack.victory,
    defeat: false,
  };

  if (heroAttack.victory || !includeEnemyTurn) return afterHero;

  const enemyAttack = resolveEnemyCombatAttack({
    stats,
    hero,
    heroHealth,
    enemyMana,
    random,
  });

  return {
    ...afterHero,
    enemyAttack,
    heroHealth: enemyAttack.heroHealth,
    enemyMana: enemyAttack.enemyMana,
    defeat: enemyAttack.defeat,
  };
};

export const simulateCombat = (project = {}, entry = {}, combat = DEFAULT_COMBAT_SETTINGS, options = {}) => {
  const stats = getCombatSimulationStats(project, entry, combat);
  const random = options.random || Math.random;
  const hero = project.heroAdventure?.hero || {};
  const logs = [];
  let heroHealth = stats.heroHealth;
  let heroMana = stats.heroMana;
  let enemyHealth = stats.enemyHealth;
  let enemyMana = stats.enemyStats.maxMana;
  let status = COMBAT_OUTCOMES.TIMEOUT;
  let rounds = 0;
  let heroDamageTotal = 0;
  let enemyDamageTotal = 0;

  for (let round = 1; round <= (options.maxRounds || 50); round += 1) {
    rounds = round;
    if (stats.combatManaCost > heroMana) {
      status = COMBAT_OUTCOMES.BLOCKED;
      logs.push(`Tour ${round}: mana insuffisante pour attaquer (${heroMana}/${stats.combatManaCost}).`);
      break;
    }

    const power = selectBestAvailablePower(stats.heroPowers, heroMana, stats.combatManaCost);
    const exchange = resolveCombatExchange({
      stats,
      hero,
      heroHealth,
      heroMana,
      enemyHealth,
      enemyMana,
      power,
      random,
    });
    if (!exchange.ok) {
      status = COMBAT_OUTCOMES.BLOCKED;
      logs.push(`Tour ${round}: mana insuffisante pour attaquer (${heroMana}/${stats.combatManaCost}).`);
      break;
    }
    const { heroAttack } = exchange;
    heroMana = heroAttack.mana;
    enemyHealth = heroAttack.enemyHealth;
    heroDamageTotal += heroAttack.damage;

    const powerText = power ? ` avec ${power.name || 'pouvoir'} (${getPowerTypeLabel(heroAttack.attackType)})` : '';
    const criticalText = heroAttack.critical ? ` critique x${heroAttack.criticalMultiplier}` : '';
    const resistanceText = heroAttack.resistance ? `, résistance ${heroAttack.resistance}%` : '';
    logs.push(`Tour ${round}: ${stats.skillName} ${stats.diceLabel} ${heroAttack.roll.raw} + ${stats.skillBonus} = ${heroAttack.roll.total}${powerText}. ${heroAttack.roll.success ? `Touche${criticalText}${resistanceText}: -${heroAttack.damage} PV.` : 'Raté.'}`);

    if (heroAttack.victory) {
      status = COMBAT_OUTCOMES.VICTORY;
      break;
    }

    const { enemyAttack } = exchange;
    enemyMana = enemyAttack.enemyMana;
    heroHealth = enemyAttack.heroHealth;
    enemyDamageTotal += enemyAttack.damage;

    const enemyPowerText = enemyAttack.usesPower ? ` lance ${stats.enemyStats.powerName} (${getPowerTypeLabel(stats.enemyStats.powerType)})` : ' riposte';
    const enemyCriticalText = enemyAttack.critical ? ` critique x${enemyAttack.criticalMultiplier}` : '';
    const heroResistanceText = enemyAttack.resistance ? `, résistance héros ${enemyAttack.resistance}%` : '';
    logs.push(`Tour ${round}: ${stats.enemyName}${enemyPowerText}${enemyCriticalText}${heroResistanceText}: -${enemyAttack.damage} PV.`);

    if (enemyAttack.defeat) {
      status = COMBAT_OUTCOMES.DEFEAT;
      break;
    }
  }

  const title = {
    [COMBAT_OUTCOMES.VICTORY]: `Victoire en ${logs.filter((line) => line.includes(`${stats.skillName} `)).length} tour(s)`,
    [COMBAT_OUTCOMES.DEFEAT]: `Défaite contre ${stats.enemyName}`,
    [COMBAT_OUTCOMES.BLOCKED]: 'Simulation bloquée',
    [COMBAT_OUTCOMES.TIMEOUT]: 'Combat très long',
  }[status];

  return {
    status,
    title,
    heroHealth,
    heroMaxHealth: stats.heroMaxHealth,
    heroMana,
    heroMaxMana: stats.heroMaxMana,
    enemyHealth,
    enemyMaxHealth: stats.enemyMaxHealth,
    enemyMana,
    enemyMaxMana: stats.enemyStats.maxMana,
    rounds,
    heroDamageTotal,
    enemyDamageTotal,
    totalDamage: heroDamageTotal + enemyDamageTotal,
    heroDamagePerRound: rounds ? heroDamageTotal / rounds : 0,
    enemyDamagePerRound: rounds ? enemyDamageTotal / rounds : 0,
    totalDamagePerRound: rounds ? (heroDamageTotal + enemyDamageTotal) / rounds : 0,
    logs: logs.slice(-12),
  };
};

const makeCombatBalanceSeed = (stats = {}) => JSON.stringify({
  diceSides: stats.diceSides,
  skillBonus: stats.skillBonus,
  heroForce: stats.heroForce,
  heroAttackType: stats.heroAttackType,
  heroHealth: stats.heroHealth,
  heroMana: stats.heroMana,
  combatManaCost: stats.combatManaCost,
  criticalSuccess: stats.criticalSuccess,
  criticalFailure: stats.criticalFailure,
  heroCriticalChance: stats.heroCriticalChance,
  heroCriticalMultiplier: stats.heroCriticalMultiplier,
  enemyHealth: stats.enemyHealth,
  difficulty: stats.difficulty,
  enemyStats: stats.enemyStats,
  heroPowers: (stats.heroPowers || []).map((power) => ({
    id: power.id,
    force: numberValue(power.force, 0),
    manaCost: numberValue(power.manaCost, 0),
    type: power.type,
  })),
});

export const estimateCombatBalance = (project = {}, entry = {}, combat = DEFAULT_COMBAT_SETTINGS, options = {}) => {
  const stats = getCombatSimulationStats(project, entry, combat);
  const iterations = clampNumber(options.iterations, 300, 1, 5000);
  const maxRounds = clampNumber(options.maxRounds, 50, 1, 500);
  const randomFactory = options.randomFactory || ((iteration) => createSeededRandom(`${options.seed || makeCombatBalanceSeed(stats)}:${iteration}`));
  const outcomes = {
    [COMBAT_OUTCOMES.VICTORY]: 0,
    [COMBAT_OUTCOMES.DEFEAT]: 0,
    [COMBAT_OUTCOMES.BLOCKED]: 0,
    [COMBAT_OUTCOMES.TIMEOUT]: 0,
  };
  let totalRounds = 0;
  let totalHeroDamage = 0;
  let totalEnemyDamage = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const result = simulateCombat(project, entry, combat, {
      maxRounds,
      random: randomFactory(iteration),
    });
    outcomes[result.status] = (outcomes[result.status] || 0) + 1;
    totalRounds += result.rounds || 0;
    totalHeroDamage += result.heroDamageTotal || 0;
    totalEnemyDamage += result.enemyDamageTotal || 0;
  }

  const averageRounds = totalRounds / iterations;
  const safeRounds = totalRounds || 1;
  const victoryCount = outcomes[COMBAT_OUTCOMES.VICTORY] || 0;
  const defeatCount = outcomes[COMBAT_OUTCOMES.DEFEAT] || 0;
  const blockedCount = outcomes[COMBAT_OUTCOMES.BLOCKED] || 0;
  const timeoutCount = outcomes[COMBAT_OUTCOMES.TIMEOUT] || 0;
  const winChance = (victoryCount / iterations) * 100;

  return {
    iterations,
    maxRounds,
    winChance,
    averageRounds,
    averageHeroDamagePerRound: totalHeroDamage / safeRounds,
    averageEnemyDamagePerRound: totalEnemyDamage / safeRounds,
    averageTotalDamagePerRound: (totalHeroDamage + totalEnemyDamage) / safeRounds,
    averageHeroDamage: totalHeroDamage / iterations,
    averageEnemyDamage: totalEnemyDamage / iterations,
    victoryCount,
    defeatCount,
    blockedCount,
    timeoutCount,
    outcomes,
  };
};
