import { DEFAULT_COMBAT_SETTINGS } from './combatDefaults.js';
const HERO_ATTACK_TYPES = ['physical', 'water', 'earth', 'fire', 'lightning'];
const POWER_TYPES = ['water', 'earth', 'fire', 'lightning'];
const STATUS_EFFECT_TYPES = [
  'poison',
  'burn',
  'stun',
  'bleed',
  'shield',
  'force_buff',
  'force_debuff',
  'difficulty_buff',
  'difficulty_debuff',
  'resistance_buff',
  'resistance_debuff',
  'critical_buff',
  'critical_debuff',
];
const DAMAGING_STATUS_EFFECTS = ['poison', 'burn', 'bleed'];
const BUFF_STATUS_EFFECTS = ['force_buff', 'difficulty_buff', 'resistance_buff', 'critical_buff'];
const DEBUFF_STATUS_EFFECTS = ['force_debuff', 'difficulty_debuff', 'resistance_debuff', 'critical_debuff'];
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

export const getStatusEffectLabel = (type = '') => ({
  poison: 'Poison',
  burn: 'Brûlure',
  stun: 'Étourdissement',
  bleed: 'Saignement',
  shield: 'Bouclier',
  force_buff: 'Bonus force',
  force_debuff: 'Malus force',
  difficulty_buff: 'Bonus difficulté',
  difficulty_debuff: 'Malus difficulté',
  resistance_buff: 'Bonus résistance',
  resistance_debuff: 'Malus résistance',
  critical_buff: 'Bonus critique',
  critical_debuff: 'Malus critique',
}[type] || '');

export const normalizeStatusEffectType = (value) => (
  STATUS_EFFECT_TYPES.includes(value) ? value : ''
);

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

export const getHeroSkillValue = (hero = {}, keys = []) => {
  const skills = Array.isArray(hero.skills) ? hero.skills : [];
  const normalizedKeys = (Array.isArray(keys) ? keys : [keys]).map(normalizeStatKey).filter(Boolean);
  const skill = skills.find((candidate) => (
    normalizedKeys.includes(normalizeStatKey(candidate.id))
    || normalizedKeys.includes(normalizeStatKey(candidate.name))
  ));
  return Math.max(0, numberValue(skill?.value, 0));
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

export const getShieldAmount = (effects = []) => (
  (Array.isArray(effects) ? effects : [])
    .map(normalizeStatusEffect)
    .filter((effect) => effect?.type === 'shield')
    .reduce((total, effect) => total + effect.amount, 0)
);

export const hasStatusEffect = (effects = [], types = []) => {
  const typeList = Array.isArray(types) ? types : [types];
  return (Array.isArray(effects) ? effects : [])
    .map((effect) => normalizeStatusEffectType(effect?.type || effect?.statusType))
    .some((type) => typeList.includes(type));
};

export const applyResistance = (damage, resistance = 0) => {
  const rawDamage = Math.max(0, Math.round(numberValue(damage, 0)));
  const safeResistance = clampNumber(resistance, 0, 0, 100);
  return safeResistance ? Math.max(0, Math.round(rawDamage * (100 - safeResistance) / 100)) : rawDamage;
};

export const applyArmor = (damage, armor = 0) => {
  const rawDamage = Math.max(0, Math.round(numberValue(damage, 0)));
  const safeArmor = clampNumber(armor, 0, 0, 999);
  const blocked = Math.min(rawDamage, safeArmor);
  return {
    damage: Math.max(0, rawDamage - blocked),
    armor: safeArmor,
    blocked,
  };
};

export const applyRecovery = ({
  health = 0,
  maxHealth = 0,
  mana = 0,
  maxMana = 0,
  healthGain = 0,
  manaGain = 0,
} = {}) => {
  const safeMaxHealth = Math.max(0, numberValue(maxHealth, 0));
  const safeMaxMana = Math.max(0, numberValue(maxMana, 0));
  const currentHealth = Math.max(0, Math.min(safeMaxHealth, numberValue(health, 0)));
  const currentMana = Math.max(0, Math.min(safeMaxMana, numberValue(mana, 0)));
  const safeHealthGain = Math.max(0, clampNumber(healthGain, 0, 0, 999));
  const safeManaGain = Math.max(0, clampNumber(manaGain, 0, 0, 999));
  const nextHealth = Math.max(0, Math.min(safeMaxHealth, currentHealth + safeHealthGain));
  const nextMana = Math.max(0, Math.min(safeMaxMana, currentMana + safeManaGain));
  return {
    health: nextHealth,
    mana: nextMana,
    healthRecovered: nextHealth - currentHealth,
    manaRecovered: nextMana - currentMana,
    requestedHealth: safeHealthGain,
    requestedMana: safeManaGain,
  };
};

export const normalizeStatusEffect = (effect = {}) => {
  const type = normalizeStatusEffectType(effect.type || effect.statusType);
  if (!type) return null;
  const amount = type === 'stun'
    ? 0
    : clampNumber(effect.amount ?? effect.statusAmount, 0, 0, 999);
  const duration = clampNumber(effect.duration ?? effect.statusDuration, 1, 1, 99);
  return {
    type,
    amount,
    duration,
  };
};

export const createStatusEffectFromPower = (power = {}) => {
  const type = normalizeStatusEffectType(power.statusType);
  if (!type) return null;
  return normalizeStatusEffect({
    type,
    amount: type === 'stun' ? 0 : power.statusAmount,
    duration: power.statusDuration,
  });
};

export const getStatusEffectTarget = (effect = {}) => {
  const type = normalizeStatusEffectType(effect.type || effect.statusType);
  if (!type) return '';
  if (type === 'shield' || BUFF_STATUS_EFFECTS.includes(type)) return 'hero';
  return 'enemy';
};

export const getStatusModifiers = (effects = []) => (
  (Array.isArray(effects) ? effects : [])
    .map(normalizeStatusEffect)
    .filter(Boolean)
    .reduce((modifiers, effect) => {
      const sign = BUFF_STATUS_EFFECTS.includes(effect.type) ? 1 : DEBUFF_STATUS_EFFECTS.includes(effect.type) ? -1 : 0;
      if (!sign) return modifiers;
      if (effect.type.startsWith('force_')) modifiers.force += effect.amount * sign;
      if (effect.type.startsWith('difficulty_')) modifiers.difficulty += effect.amount * sign;
      if (effect.type.startsWith('resistance_')) modifiers.resistance += effect.amount * sign;
      if (effect.type.startsWith('critical_')) modifiers.criticalChance += effect.amount * sign;
      return modifiers;
    }, {
      force: 0,
      difficulty: 0,
      resistance: 0,
      criticalChance: 0,
    })
);

export const addStatusEffect = (effects = [], effect = null) => {
  const nextEffect = normalizeStatusEffect(effect);
  const currentEffects = (Array.isArray(effects) ? effects : [])
    .map(normalizeStatusEffect)
    .filter(Boolean);
  if (!nextEffect) return currentEffects;

  if (nextEffect.type === 'shield') {
    return [...currentEffects, nextEffect];
  }

  const existingIndex = currentEffects.findIndex((candidate) => candidate.type === nextEffect.type);
  if (existingIndex < 0) return [...currentEffects, nextEffect];

  return currentEffects.map((candidate, index) => (
    index === existingIndex
      ? {
          ...candidate,
          amount: Math.max(candidate.amount, nextEffect.amount),
          duration: Math.max(candidate.duration, nextEffect.duration),
        }
      : candidate
  ));
};

export const applyShield = (damage = 0, effects = []) => {
  let remainingDamage = Math.max(0, Math.round(numberValue(damage, 0)));
  let blocked = 0;
  const nextEffects = [];

  (Array.isArray(effects) ? effects : []).forEach((rawEffect) => {
    const effect = normalizeStatusEffect(rawEffect);
    if (!effect) return;
    if (effect.type !== 'shield' || remainingDamage <= 0) {
      nextEffects.push(effect);
      return;
    }

    const absorbed = Math.min(effect.amount, remainingDamage);
    blocked += absorbed;
    remainingDamage -= absorbed;
    const shieldLeft = effect.amount - absorbed;
    if (shieldLeft > 0) {
      nextEffects.push({ ...effect, amount: shieldLeft });
    }
  });

  return {
    damage: remainingDamage,
    blocked,
    effects: nextEffects,
  };
};

export const tickStatusEffects = (effects = [], health = 0) => {
  const currentHealth = Math.max(0, numberValue(health, 0));
  let damage = 0;
  let stunned = false;
  const triggered = [];
  const nextEffects = [];

  (Array.isArray(effects) ? effects : []).forEach((rawEffect) => {
    const effect = normalizeStatusEffect(rawEffect);
    if (!effect) return;

    if (DAMAGING_STATUS_EFFECTS.includes(effect.type)) {
      damage += effect.amount;
      triggered.push(effect);
    }
    if (effect.type === 'stun') {
      stunned = true;
      triggered.push(effect);
    }

    const nextDuration = effect.duration - 1;
    if (nextDuration > 0 && (effect.type !== 'shield' || effect.amount > 0)) {
      nextEffects.push({ ...effect, duration: nextDuration });
    }
  });

  return {
    health: Math.max(0, currentHealth - damage),
    damage,
    stunned,
    effects: nextEffects,
    triggered,
  };
};

export const rollDodge = (chance = 0, random = Math.random) => {
  const safeChance = clampNumber(chance, 0, 0, 100);
  return {
    chance: safeChance,
    dodged: safeChance > 0 && random() * 100 < safeChance,
  };
};

export const resolveCombatInitiative = (stats = {}) => {
  const heroInitiative = clampNumber(stats.heroInitiative, 0, -999, 999);
  const enemyInitiative = clampNumber(stats.enemyStats?.initiative, 0, -999, 999);
  return {
    heroInitiative,
    enemyInitiative,
    firstActor: enemyInitiative > heroInitiative ? 'enemy' : 'hero',
  };
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

  return {
    enemyAutoTurn: false,
    heroAttackType: normalizeHeroAttackType(heroAttackType),
    initiative: readNumber('combatEnemyInitiative', 'enemyInitiative', DEFAULT_COMBAT_SETTINGS.enemyInitiative, -999, 999),
    strength: readNumber('combatEnemyStrength', 'enemyStrength', numberValue(entry.combatEnemyDamage, DEFAULT_COMBAT_SETTINGS.enemyStrength), 0, 999),
    dieDamagePercent: readNumber('combatEnemyDieDamagePercent', 'enemyDieDamagePercent', DEFAULT_COMBAT_SETTINGS.enemyDieDamagePercent, 0, 999),
    cunning: readNumber('combatEnemyCunning', 'enemyCunning', DEFAULT_COMBAT_SETTINGS.enemyCunning, 1, 999),
    chaos: readNumber('combatEnemyChaos', 'enemyChaos', DEFAULT_COMBAT_SETTINGS.enemyChaos, 1, 999),
    armor: readNumber('combatEnemyArmor', 'enemyArmor', DEFAULT_COMBAT_SETTINGS.enemyArmor, 0, 999),
    dodgeChance: readNumber('combatEnemyDodgeChance', 'enemyDodgeChance', DEFAULT_COMBAT_SETTINGS.enemyDodgeChance, 0, 100),
    maxMana: readNumber('combatEnemyMaxMana', 'enemyMaxMana', DEFAULT_COMBAT_SETTINGS.enemyMaxMana, 0, 999),
    powerName: readValue('combatEnemyPowerName', 'enemyPowerName', DEFAULT_COMBAT_SETTINGS.enemyPowerName) || DEFAULT_COMBAT_SETTINGS.enemyPowerName,
    powerType: normalizePowerType(powerType),
    powerManaCost: readNumber('combatEnemyPowerManaCost', 'enemyPowerManaCost', DEFAULT_COMBAT_SETTINGS.enemyPowerManaCost, 0, 999),
    powerDamage: readNumber('combatEnemyPowerDamage', 'enemyPowerDamage', DEFAULT_COMBAT_SETTINGS.enemyPowerDamage, 0, 999),
    powerUsageChance: readNumber('combatEnemyPowerUsageChance', 'enemyPowerUsageChance', DEFAULT_COMBAT_SETTINGS.enemyPowerUsageChance, 0, 100),
    aiMode: readValue('combatEnemyAiMode', 'enemyAiMode', DEFAULT_COMBAT_SETTINGS.enemyAiMode) || DEFAULT_COMBAT_SETTINGS.enemyAiMode,
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
    heroDieDamagePercent: clampNumber(getEntryValue(entry, 'combatHeroDieDamagePercent', combat.heroDieDamagePercent ?? DEFAULT_COMBAT_SETTINGS.heroDieDamagePercent), DEFAULT_COMBAT_SETTINGS.heroDieDamagePercent, 0, 999),
    heroSurvival: getHeroSkillValue(hero, ['survie', 'survival']),
    heroPowers: Array.isArray(hero.powers) ? hero.powers : [],
    heroAttackType: enemyStats.heroAttackType,
    heroHealth: Math.max(0, Math.min(heroMaxHealth, numberValue(hero.health, heroMaxHealth))),
    heroMaxHealth,
    heroMana: Math.max(0, Math.min(heroMaxMana, numberValue(hero.mana, heroMaxMana))),
    heroMaxMana,
    heroInitiative: clampNumber(hero.initiative, 0, -999, 999),
    heroArmor: clampNumber(hero.armor, 0, 0, 999),
    heroDodgeChance: clampNumber(hero.dodgeChance, 0, 0, 100),
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
  heroHealth,
  heroMana,
  heroStatusEffects = [],
  enemyStatusEffects = [],
  power = null,
  random = Math.random,
  rawRoll,
} = {}) => {
  const diceSides = Math.max(2, numberValue(stats?.diceSides, 20));
  const enemyStats = stats?.enemyStats || {};
  const enemyResistances = enemyStats.resistances || {};
  const skillBonus = numberValue(stats?.skillBonus, 0);
  const heroForce = Math.max(0, numberValue(stats?.heroForce, 0));
  const heroMaxHealth = Math.max(0, numberValue(stats?.heroMaxHealth, numberValue(stats?.heroHealth, heroHealth ?? 0)));
  const heroMaxMana = Math.max(0, numberValue(stats?.heroMaxMana, numberValue(stats?.heroMana, heroMana ?? 0)));
  const criticalSuccess = clampNumber(stats?.criticalSuccess, diceSides, 1, diceSides);
  const criticalFailure = clampNumber(stats?.criticalFailure, 1, 1, diceSides);
  const heroCriticalChance = clampNumber(stats?.heroCriticalChance, 0, 0, 100);
  const heroCriticalMultiplier = Math.max(1, Math.min(20, numberValue(stats?.heroCriticalMultiplier, 2)));
  const powerManaCost = power ? Math.max(0, numberValue(power.manaCost, 0)) : 0;
  const mana = spendMana(heroMana, numberValue(stats?.combatManaCost, 0) + powerManaCost);
  if (!mana.ok) return { ok: false, reason: 'not_enough_mana', mana: heroMana };
  const recovery = applyRecovery({
    health: heroHealth ?? stats?.heroHealth,
    maxHealth: heroMaxHealth,
    mana: mana.mana,
    maxMana: heroMaxMana,
    healthGain: power?.healHealth,
    manaGain: power?.healMana,
  });

  const raw = rollDie({ sides: diceSides, random, raw: rawRoll });
  const heroModifiers = getStatusModifiers(heroStatusEffects);
  const enemyModifiers = getStatusModifiers(enemyStatusEffects);
  const difficulty = Math.max(1, numberValue(stats?.difficulty, 10) + enemyModifiers.difficulty - heroModifiers.difficulty);
  const roll = resolveRollOutcome({
    raw,
    modifier: skillBonus,
    difficulty,
    criticalSuccess,
    criticalFailure,
  });
  const powerDamage = power ? Math.max(0, numberValue(power.force, 0)) : 0;
  const heroDieDamagePercent = clampNumber(stats?.heroDieDamagePercent, DEFAULT_COMBAT_SETTINGS.heroDieDamagePercent, 0, 999);
  const heroDieDamageBonus = roll.success ? Math.max(0, Math.round(roll.raw * (heroDieDamagePercent / 100))) : 0;
  const baseDamage = roll.success ? Math.max(0, heroForce + heroModifiers.force + heroDieDamageBonus + powerDamage) : 0;
  const critical = resolveCritical({
    canCrit: roll.success && baseDamage > 0,
    isCriticalSuccess: roll.isCriticalSuccess,
    chance: clampNumber(heroCriticalChance + heroModifiers.criticalChance, heroCriticalChance, 0, 100),
    multiplier: heroCriticalMultiplier,
    random,
  });
  const rawDamage = critical.critical ? Math.round(baseDamage * critical.multiplier) : Math.round(baseDamage);
  const attackType = power?.type || normalizeHeroAttackType(stats?.heroAttackType);
  const resistance = roll.success && attackType !== 'physical'
    ? clampNumber((enemyResistances[attackType] || 0) + enemyModifiers.resistance, enemyResistances[attackType] || 0, 0, 100)
    : 0;
  const dodge = roll.success && rawDamage > 0
    ? rollDodge(enemyStats.dodgeChance, random)
    : { chance: clampNumber(enemyStats.dodgeChance, 0, 0, 100), dodged: false };
  const resistedDamage = roll.success && !dodge.dodged ? applyResistance(rawDamage, resistance) : 0;
  const armorResult = roll.success && !dodge.dodged
    ? applyArmor(resistedDamage, enemyStats.armor)
    : { damage: 0, armor: clampNumber(enemyStats.armor, 0, 0, 999), blocked: 0 };
  const shieldResult = roll.success && !dodge.dodged
    ? applyShield(armorResult.damage, enemyStatusEffects)
    : { damage: armorResult.damage, blocked: 0, effects: Array.isArray(enemyStatusEffects) ? enemyStatusEffects : [] };
  const criticalPierced = Boolean(critical.critical && roll.success && !dodge.dodged && rawDamage > 0 && shieldResult.damage <= 0);
  const damage = criticalPierced ? 1 : shieldResult.damage;
  const nextEnemyHealth = Math.max(0, numberValue(enemyHealth, stats.enemyHealth) - damage);
  const powerStatusEffect = createStatusEffectFromPower(power || {});
  const statusTarget = getStatusEffectTarget(powerStatusEffect || {});
  const appliedStatusEffect = powerStatusEffect && (statusTarget === 'hero' || roll.success)
    ? {
        ...powerStatusEffect,
        target: statusTarget,
      }
    : null;

  return {
    ok: true,
    roll,
    mana: recovery.mana,
    heroHealth: recovery.health,
    manaSpent: mana.spent,
    recovery,
    powerDamage,
    heroDieDamageBonus,
    heroDieDamagePercent,
    heroModifiers,
    enemyModifiers,
    baseDamage,
    rawDamage,
    resistedDamage,
    damage,
    attackType,
    resistance,
    armor: armorResult.armor,
    armorBlocked: armorResult.blocked,
    shieldBlocked: shieldResult.blocked,
    criticalPierced,
    enemyStatusEffects: shieldResult.effects,
    appliedStatusEffect,
    dodgeChance: dodge.chance,
    dodged: dodge.dodged,
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
  heroStatusEffects = [],
  enemyStatusEffects = [],
  enemyHealth,
  enemyMana,
  random = Math.random,
  rawRoll,
} = {}) => {
  const sourceEnemyStats = stats?.enemyStats || {};
  const enemyStats = {
    ...sourceEnemyStats,
    strength: clampNumber(sourceEnemyStats.strength, DEFAULT_COMBAT_SETTINGS.enemyStrength, 0, 999),
    dieDamagePercent: clampNumber(sourceEnemyStats.dieDamagePercent, DEFAULT_COMBAT_SETTINGS.enemyDieDamagePercent, 0, 999),
    maxMana: clampNumber(sourceEnemyStats.maxMana, DEFAULT_COMBAT_SETTINGS.enemyMaxMana, 0, 999),
    powerManaCost: clampNumber(sourceEnemyStats.powerManaCost, DEFAULT_COMBAT_SETTINGS.enemyPowerManaCost, 0, 999),
    powerDamage: clampNumber(sourceEnemyStats.powerDamage, DEFAULT_COMBAT_SETTINGS.enemyPowerDamage, 0, 999),
    powerUsageChance: clampNumber(sourceEnemyStats.powerUsageChance, DEFAULT_COMBAT_SETTINGS.enemyPowerUsageChance, 0, 100),
    powerType: normalizePowerType(sourceEnemyStats.powerType),
    criticalChance: clampNumber(sourceEnemyStats.criticalChance, DEFAULT_COMBAT_SETTINGS.enemyCriticalChance, 0, 100),
    criticalMultiplier: clampDecimal(sourceEnemyStats.criticalMultiplier, DEFAULT_COMBAT_SETTINGS.enemyCriticalMultiplier, 1, 20),
  };
  const safeStats = {
    ...(stats || {}),
    diceSides: Math.max(2, numberValue(stats?.diceSides, 20)),
    heroHealth: numberValue(stats?.heroHealth, heroHealth ?? 0),
    heroMaxHealth: Math.max(0, numberValue(stats?.heroMaxHealth, stats?.heroHealth ?? heroHealth ?? 0)),
    heroArmor: clampNumber(stats?.heroArmor, 0, 0, 999),
    heroDodgeChance: clampNumber(stats?.heroDodgeChance, 0, 0, 100),
    enemyHealth: Math.max(0, numberValue(stats?.enemyHealth, enemyHealth ?? 0)),
    enemyMaxHealth: Math.max(0, numberValue(stats?.enemyMaxHealth, stats?.enemyHealth ?? enemyHealth ?? 0)),
    enemyStats,
  };
  const heroModifiers = getStatusModifiers(heroStatusEffects);
  const enemyModifiers = getStatusModifiers(enemyStatusEffects);
  const raw = rollDie({ sides: safeStats.diceSides, random, raw: rawRoll });
  const powerDecision = resolveEnemyPowerDecision({
    stats: safeStats,
    hero,
    heroHealth,
    heroStatusEffects,
    enemyHealth,
    enemyStatusEffects,
    enemyMana,
    random,
  });
  const usesPower = powerDecision.usesPower;
  const currentEnemyMana = Math.max(0, numberValue(enemyMana, enemyStats.maxMana));
  const nextEnemyMana = usesPower ? Math.max(0, currentEnemyMana - enemyStats.powerManaCost) : currentEnemyMana;
  const forceDamage = Math.max(0, (usesPower ? enemyStats.powerDamage : enemyStats.strength) + enemyModifiers.force);
  const dieDamagePercent = enemyStats.dieDamagePercent;
  const dieDamageBonus = Math.max(0, Math.round(raw * (dieDamagePercent / 100)));
  const baseDamage = Math.max(0, forceDamage + dieDamageBonus);
  const critical = resolveCritical({
    canCrit: baseDamage > 0,
    chance: clampNumber(enemyStats.criticalChance + enemyModifiers.criticalChance, enemyStats.criticalChance, 0, 100),
    multiplier: enemyStats.criticalMultiplier,
    random,
  });
  const rawDamage = critical.critical ? Math.round(baseDamage * critical.multiplier) : Math.round(baseDamage);
  const resistance = usesPower ? clampNumber(getElementResistance(hero, enemyStats.powerType) + heroModifiers.resistance, getElementResistance(hero, enemyStats.powerType), 0, 100) : 0;
  const dodge = rawDamage > 0
    ? rollDodge(safeStats.heroDodgeChance, random)
    : { chance: safeStats.heroDodgeChance, dodged: false };
  const resistedDamage = dodge.dodged ? 0 : applyResistance(rawDamage, resistance);
  const armorResult = dodge.dodged
    ? { damage: 0, armor: safeStats.heroArmor, blocked: 0 }
    : applyArmor(resistedDamage, safeStats.heroArmor);
  const shieldResult = dodge.dodged
    ? { damage: armorResult.damage, blocked: 0, effects: Array.isArray(heroStatusEffects) ? heroStatusEffects : [] }
    : applyShield(armorResult.damage, heroStatusEffects);
  const criticalPierced = Boolean(critical.critical && !dodge.dodged && rawDamage > 0 && shieldResult.damage <= 0);
  const damage = criticalPierced ? 1 : shieldResult.damage;
  const nextHeroHealth = Math.max(0, numberValue(heroHealth, safeStats.heroHealth) - damage);

  return {
    ok: true,
    usesPower,
    powerDecision,
    roll: {
      raw,
      modifier: forceDamage,
      total: baseDamage,
      difficulty: 0,
      success: baseDamage > 0,
    },
    enemyMana: nextEnemyMana,
    baseDamage,
    forceDamage,
    dieDamageBonus,
    dieDamagePercent,
    heroModifiers,
    enemyModifiers,
    rawDamage,
    resistedDamage,
    damage,
    resistance,
    armor: armorResult.armor,
    armorBlocked: armorResult.blocked,
    shieldBlocked: shieldResult.blocked,
    criticalPierced,
    heroStatusEffects: shieldResult.effects,
    dodgeChance: dodge.chance,
    dodged: dodge.dodged,
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

export const resolveEnemyPowerDecision = ({
  stats,
  hero = {},
  heroHealth,
  heroStatusEffects = [],
  enemyHealth,
  enemyMana,
  enemyStatusEffects = [],
  random = Math.random,
} = {}) => {
  const enemyStats = stats.enemyStats || {};
  const safeEnemyMana = Math.max(0, numberValue(enemyMana, enemyStats.maxMana));
  const canUsePower = enemyStats.maxMana > 0
    && enemyStats.powerManaCost <= safeEnemyMana
    && enemyStats.powerDamage > 0
    && enemyStats.powerUsageChance > 0;
  const normalDamage = Math.max(0, numberValue(enemyStats.strength, 0) + getStatusModifiers(enemyStatusEffects).force);
  const powerResistance = getElementResistance(hero, enemyStats.powerType);
  const shieldAmount = getShieldAmount(heroStatusEffects);
  const powerDamage = applyResistance(Math.max(0, numberValue(enemyStats.powerDamage, 0) + getStatusModifiers(enemyStatusEffects).force), powerResistance);
  const currentHeroHealth = Math.max(0, numberValue(heroHealth, stats.heroHealth));
  const currentEnemyHealth = Math.max(0, numberValue(enemyHealth, stats.enemyHealth));
  const heroHealthRatio = stats.heroMaxHealth ? currentHeroHealth / stats.heroMaxHealth : 1;
  const enemyHealthRatio = stats.enemyMaxHealth ? currentEnemyHealth / stats.enemyMaxHealth : 1;
  const heroHasDamagingStatus = hasStatusEffect(heroStatusEffects, DAMAGING_STATUS_EFFECTS);
  const heroIsStunned = hasStatusEffect(heroStatusEffects, 'stun');

  if (!canUsePower) {
    return {
      usesPower: false,
      reason: 'unavailable',
      score: 0,
      roll: null,
      canUsePower,
      normalDamage,
      powerDamage,
      shieldAmount,
    };
  }

  const aiMode = enemyStats.aiMode || DEFAULT_COMBAT_SETTINGS.enemyAiMode;
  if (aiMode === 'random') {
    const roll = random() * 100;
    return {
      usesPower: roll < enemyStats.powerUsageChance,
      reason: 'random',
      score: enemyStats.powerUsageChance,
      roll,
      canUsePower,
      normalDamage,
      powerDamage,
      shieldAmount,
    };
  }

  let score = clampNumber(enemyStats.powerUsageChance, 0, 0, 100);
  let reason = 'tactical';
  if (powerDamage >= currentHeroHealth && currentHeroHealth > 0) {
    score = 100;
    reason = 'finish';
  } else {
    if (heroHealthRatio <= 0.35) score += 25;
    if (enemyHealthRatio <= 0.35) score += 20;
    if (powerDamage > normalDamage) score += Math.min(25, (powerDamage - normalDamage) * 5);
    if (safeEnemyMana >= enemyStats.powerManaCost * 2) score += 10;
    if (safeEnemyMana === enemyStats.powerManaCost) score -= 15;
    if (powerResistance >= 50) score -= 25;
    if (shieldAmount >= powerDamage && powerDamage > normalDamage) score -= 20;
    if (heroIsStunned || heroHasDamagingStatus) score -= 15;
    if (powerDamage <= normalDamage) score -= 15;
  }

  const safeScore = clampNumber(score, enemyStats.powerUsageChance, 0, 100);
  const roll = random() * 100;
  return {
    usesPower: roll < safeScore,
    reason,
    score: safeScore,
    roll,
    canUsePower,
    normalDamage,
    powerDamage,
    shieldAmount,
  };
};

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
  heroStatusEffects = [],
  enemyStatusEffects = [],
  power = null,
  random = Math.random,
  includeEnemyTurn = true,
} = {}) => {
  const heroAttack = resolveHeroCombatAttack({
    stats,
    enemyHealth,
    heroHealth,
    heroMana,
    heroStatusEffects,
    enemyStatusEffects,
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
    heroStatusEffects,
    enemyStatusEffects: heroAttack.enemyStatusEffects || enemyStatusEffects,
    victory: heroAttack.victory,
    defeat: false,
  };

  if (heroAttack.victory || !includeEnemyTurn) return afterHero;

  const enemyAttack = resolveEnemyCombatAttack({
    stats,
    hero,
    heroHealth,
    heroStatusEffects,
    enemyStatusEffects: afterHero.enemyStatusEffects,
    enemyHealth: afterHero.enemyHealth,
    enemyMana,
    random,
  });

  return {
    ...afterHero,
    enemyAttack,
    heroHealth: enemyAttack.heroHealth,
    enemyMana: enemyAttack.enemyMana,
    heroStatusEffects: enemyAttack.heroStatusEffects || heroStatusEffects,
    defeat: enemyAttack.defeat,
  };
};

export const simulateCombat = (project = {}, entry = {}, combat = DEFAULT_COMBAT_SETTINGS, options = {}) => {
  const stats = getCombatSimulationStats(project, entry, combat);
  const random = options.random || Math.random;
  const hero = project.heroAdventure?.hero || {};
  const initiative = resolveCombatInitiative(stats);
  const logs = [];
  let heroHealth = stats.heroHealth;
  let heroMana = stats.heroMana;
  let enemyHealth = stats.enemyHealth;
  let enemyMana = stats.enemyStats.maxMana;
  let heroStatusEffects = [];
  let enemyStatusEffects = [];
  let status = COMBAT_OUTCOMES.TIMEOUT;
  let rounds = 0;
  let heroDamageTotal = 0;
  let enemyDamageTotal = 0;
  let enemyOpenedCombat = false;
  let survivalUsed = false;

  const describeStatus = (effect) => {
    const label = getStatusEffectLabel(effect.type).toLowerCase();
    if (effect.type === 'stun') return `${label} (${effect.duration} tour(s))`;
    return `${label} ${effect.amount} (${effect.duration} tour(s))`;
  };

  const applyHeroStatusStart = (round) => {
    const tick = tickStatusEffects(heroStatusEffects, heroHealth);
    heroStatusEffects = tick.effects;
    heroHealth = tick.health;
    enemyDamageTotal += tick.damage;
    if (tick.damage > 0) logs.push(`Tour ${round}: le héros subit ${tick.damage} PV d'altération.`);
    if (tick.stunned) logs.push(`Tour ${round}: le héros est étourdi et perd son action.`);
    return tick;
  };

  const applyEnemyStatusStart = (round) => {
    const tick = tickStatusEffects(enemyStatusEffects, enemyHealth);
    enemyStatusEffects = tick.effects;
    enemyHealth = tick.health;
    heroDamageTotal += tick.damage;
    if (tick.damage > 0) logs.push(`Tour ${round}: ${stats.enemyName} subit ${tick.damage} PV d'altération.`);
    if (tick.stunned) logs.push(`Tour ${round}: ${stats.enemyName} est étourdi et perd son action.`);
    return tick;
  };

  const applyHeroPowerStatus = (effect, round) => {
    if (!effect) return;
    if (effect.target === 'hero') {
      heroStatusEffects = addStatusEffect(heroStatusEffects, effect);
      logs.push(`Tour ${round}: ${describeStatus(effect)} appliqué au héros.`);
      return;
    }
    enemyStatusEffects = addStatusEffect(enemyStatusEffects, effect);
    logs.push(`Tour ${round}: ${describeStatus(effect)} appliqué à ${stats.enemyName}.`);
  };

  const attemptHeroSurvival = (round, reason = 'Le héros tombe à 0 PV') => {
    if (survivalUsed) return false;
    survivalUsed = true;
    const raw = rollDie({ sides: stats.diceSides, random });
    const total = raw + stats.heroSurvival;
    const chaos = Math.max(1, numberValue(stats.enemyStats.chaos, 10));
    if (total >= chaos) {
      heroHealth = 1;
      logs.push(`Tour ${round}: ${reason}. Survie ${raw} + ${stats.heroSurvival} = ${total} contre chaos ${chaos}: le héros reste à 1 PV.`);
      return true;
    }
    logs.push(`Tour ${round}: ${reason}. Survie ${raw} + ${stats.heroSurvival} = ${total} contre chaos ${chaos}: mort.`);
    return false;
  };

  const runEnemyTurn = (round, actionText) => {
    const enemyTick = applyEnemyStatusStart(round);
    if (enemyHealth <= 0) {
      status = COMBAT_OUTCOMES.VICTORY;
      return null;
    }
    if (enemyTick.stunned) return null;

    const enemyAttack = resolveEnemyCombatAttack({
      stats,
      hero,
      heroHealth,
      heroStatusEffects,
      enemyStatusEffects,
      enemyHealth,
      enemyMana,
      random,
    });
    enemyMana = enemyAttack.enemyMana;
    heroHealth = enemyAttack.heroHealth;
    heroStatusEffects = enemyAttack.heroStatusEffects || heroStatusEffects;
    enemyDamageTotal += enemyAttack.damage;

    const enemyPowerText = enemyAttack.usesPower ? ` lance ${stats.enemyStats.powerName} (${getPowerTypeLabel(stats.enemyStats.powerType)})` : actionText;
    const enemyCriticalText = enemyAttack.critical ? ` critique x${enemyAttack.criticalMultiplier}` : '';
    const heroResistanceText = enemyAttack.resistance ? `, résistance héros ${enemyAttack.resistance}%` : '';
    const heroDodgeText = enemyAttack.dodged ? `, esquive héros ${enemyAttack.dodgeChance}%` : '';
    const heroArmorText = enemyAttack.armorBlocked ? `, armure héros -${enemyAttack.armorBlocked}` : '';
    const heroShieldText = enemyAttack.shieldBlocked ? `, bouclier -${enemyAttack.shieldBlocked}` : '';
    logs.push(`Tour ${round}: ${stats.enemyName}${enemyPowerText}${enemyCriticalText}${heroResistanceText}${heroDodgeText}${heroArmorText}${heroShieldText}: -${enemyAttack.damage} PV.`);

    if (enemyAttack.defeat && !attemptHeroSurvival(round)) status = COMBAT_OUTCOMES.DEFEAT;
    return enemyAttack;
  };

  if (initiative.firstActor === 'enemy') {
    logs.push(`Initiative: ${stats.enemyName} agit en premier (${initiative.enemyInitiative} contre ${initiative.heroInitiative}).`);
  }

  for (let round = 1; round <= (options.maxRounds || 50); round += 1) {
    rounds = round;
    let enemyOpenedThisRound = false;
    if (initiative.firstActor === 'enemy' && !enemyOpenedCombat) {
      enemyOpenedCombat = true;
      enemyOpenedThisRound = true;
      runEnemyTurn(round, " prend l'initiative");
      if (status !== COMBAT_OUTCOMES.TIMEOUT) break;
    }

    const heroTick = applyHeroStatusStart(round);
    if (heroHealth <= 0) {
      if (!attemptHeroSurvival(round, `Le héros subit ${heroTick.damage} PV d'altération et tombe à 0 PV`)) {
        status = COMBAT_OUTCOMES.DEFEAT;
        break;
      }
    }
    if (heroTick.stunned) {
      if (!enemyOpenedThisRound) runEnemyTurn(round, ' riposte');
      if (status !== COMBAT_OUTCOMES.TIMEOUT) break;
      continue;
    }

    if (stats.combatManaCost > heroMana) {
      status = COMBAT_OUTCOMES.BLOCKED;
      logs.push(`Tour ${round}: mana insuffisante pour attaquer (${heroMana}/${stats.combatManaCost}).`);
      break;
    }

    const power = selectBestAvailablePower(stats.heroPowers, heroMana, stats.combatManaCost);
    const heroAttack = resolveHeroCombatAttack({
      stats,
      enemyHealth,
      heroHealth,
      heroMana,
      heroStatusEffects,
      enemyStatusEffects,
      power,
      random,
    });
    if (!heroAttack.ok) {
      status = COMBAT_OUTCOMES.BLOCKED;
      logs.push(`Tour ${round}: mana insuffisante pour attaquer (${heroMana}/${stats.combatManaCost}).`);
      break;
    }

    heroMana = heroAttack.mana;
    heroHealth = heroAttack.heroHealth;
    enemyHealth = heroAttack.enemyHealth;
    enemyStatusEffects = heroAttack.enemyStatusEffects || enemyStatusEffects;
    heroDamageTotal += heroAttack.damage;
    applyHeroPowerStatus(heroAttack.appliedStatusEffect, round);

    const powerText = power ? ` avec ${power.name || 'pouvoir'} (${getPowerTypeLabel(heroAttack.attackType)})` : '';
    const criticalText = heroAttack.critical ? ` critique x${heroAttack.criticalMultiplier}` : '';
    const resistanceText = heroAttack.resistance ? `, résistance ${heroAttack.resistance}%` : '';
    const dodgeText = heroAttack.dodged ? `, esquive ${heroAttack.dodgeChance}%` : '';
    const armorText = heroAttack.armorBlocked ? `, armure -${heroAttack.armorBlocked}` : '';
    const shieldText = heroAttack.shieldBlocked ? `, bouclier -${heroAttack.shieldBlocked}` : '';
    const recoveryText = heroAttack.recovery.healthRecovered || heroAttack.recovery.manaRecovered
      ? ` Soin: +${heroAttack.recovery.healthRecovered} PV, +${heroAttack.recovery.manaRecovered} mana.`
      : '';
    logs.push(`Tour ${round}: ${stats.skillName} ${stats.diceLabel} ${heroAttack.roll.raw} + ${stats.skillBonus} = ${heroAttack.roll.total}${powerText}. ${heroAttack.roll.success ? `Touche${criticalText}${resistanceText}${dodgeText}${armorText}${shieldText}: -${heroAttack.damage} PV.` : 'Raté.'}${recoveryText}`);

    if (heroAttack.victory) {
      status = COMBAT_OUTCOMES.VICTORY;
      break;
    }

    if (enemyOpenedThisRound) continue;
    runEnemyTurn(round, ' riposte');
    if (status !== COMBAT_OUTCOMES.TIMEOUT) break;
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
  heroDieDamagePercent: stats.heroDieDamagePercent,
  heroSurvival: stats.heroSurvival,
  heroAttackType: stats.heroAttackType,
  heroHealth: stats.heroHealth,
  heroMana: stats.heroMana,
  heroInitiative: stats.heroInitiative,
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
    healHealth: numberValue(power.healHealth, 0),
    healMana: numberValue(power.healMana, 0),
    statusType: normalizeStatusEffectType(power.statusType),
    statusAmount: numberValue(power.statusAmount, 0),
    statusDuration: numberValue(power.statusDuration, 0),
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
  let totalHeroHealthRemaining = 0;
  let totalHeroManaRemaining = 0;
  let totalHeroManaSpent = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const result = simulateCombat(project, entry, combat, {
      maxRounds,
      random: randomFactory(iteration),
    });
    outcomes[result.status] = (outcomes[result.status] || 0) + 1;
    totalRounds += result.rounds || 0;
    totalHeroDamage += result.heroDamageTotal || 0;
    totalEnemyDamage += result.enemyDamageTotal || 0;
    totalHeroHealthRemaining += Math.max(0, numberValue(result.heroHealth, 0));
    totalHeroManaRemaining += Math.max(0, numberValue(result.heroMana, 0));
    totalHeroManaSpent += Math.max(0, numberValue(stats.heroMana, 0) - Math.max(0, numberValue(result.heroMana, 0)));
  }

  const averageRounds = totalRounds / iterations;
  const safeRounds = totalRounds || 1;
  const victoryCount = outcomes[COMBAT_OUTCOMES.VICTORY] || 0;
  const defeatCount = outcomes[COMBAT_OUTCOMES.DEFEAT] || 0;
  const blockedCount = outcomes[COMBAT_OUTCOMES.BLOCKED] || 0;
  const timeoutCount = outcomes[COMBAT_OUTCOMES.TIMEOUT] || 0;
  const winChance = (victoryCount / iterations) * 100;
  const survivalChance = ((iterations - defeatCount) / iterations) * 100;

  return {
    iterations,
    maxRounds,
    winChance,
    survivalChance,
    averageRounds,
    averageHeroDamagePerRound: totalHeroDamage / safeRounds,
    averageEnemyDamagePerRound: totalEnemyDamage / safeRounds,
    averageTotalDamagePerRound: (totalHeroDamage + totalEnemyDamage) / safeRounds,
    averageHeroDamage: totalHeroDamage / iterations,
    averageEnemyDamage: totalEnemyDamage / iterations,
    averageHeroHealthRemaining: totalHeroHealthRemaining / iterations,
    averageHeroManaRemaining: totalHeroManaRemaining / iterations,
    averageHeroManaSpent: totalHeroManaSpent / iterations,
    victoryCount,
    defeatCount,
    blockedCount,
    timeoutCount,
    outcomes,
  };
};
