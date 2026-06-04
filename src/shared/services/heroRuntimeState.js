import { normalizeStatusEffect } from './combatEngine.js';

export function isPlainHeroRuntimeObject(value) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

export function heroRuntimeNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function clampHeroRuntimeNumber(value, fallback = 0, min = 0, max = 999) {
  return Math.max(min, Math.min(max, Math.round(heroRuntimeNumber(value, fallback))));
}

export function normalizeHeroRuntimeRules(rawRules = {}, fallbackRules = {}, diceSides = 20) {
  const sourceRules = isPlainHeroRuntimeObject(rawRules) ? rawRules : {};
  const baseRules = isPlainHeroRuntimeObject(fallbackRules) ? fallbackRules : {};
  const sides = clampHeroRuntimeNumber(diceSides, 20, 2, 1000);
  return {
    ...baseRules,
    ...sourceRules,
    criticalSuccess: clampHeroRuntimeNumber(sourceRules.criticalSuccess, baseRules.criticalSuccess ?? sides, 1, sides),
    criticalFailure: clampHeroRuntimeNumber(sourceRules.criticalFailure, baseRules.criticalFailure ?? 1, 1, sides),
    criticalChance: clampHeroRuntimeNumber(sourceRules.criticalChance, baseRules.criticalChance ?? 0, 0, 100),
    criticalMultiplier: clampHeroRuntimeNumber(sourceRules.criticalMultiplier, baseRules.criticalMultiplier ?? 2, 1, 20),
  };
}

export function normalizeHeroRuntimeSkill(rawSkill = {}, fallbackSkill = {}, index = 0) {
  const sourceSkill = isPlainHeroRuntimeObject(rawSkill) ? rawSkill : {};
  const baseSkill = isPlainHeroRuntimeObject(fallbackSkill) ? fallbackSkill : {};
  const value = clampHeroRuntimeNumber(sourceSkill.value, baseSkill.value ?? 0, -999, 999);
  const rolledValue = clampHeroRuntimeNumber(sourceSkill.rolledValue, baseSkill.rolledValue ?? 0, 0, 99);
  const baseValue = Number.isFinite(Number(sourceSkill.baseValue))
    ? clampHeroRuntimeNumber(sourceSkill.baseValue, 0, -999, 999)
    : Number.isFinite(Number(baseSkill.baseValue))
      ? clampHeroRuntimeNumber(baseSkill.baseValue, 0, -999, 999)
      : value - rolledValue;
  return {
    ...baseSkill,
    ...sourceSkill,
    id: String(sourceSkill.id || baseSkill.id || `skill_${index}`),
    name: String(sourceSkill.name ?? baseSkill.name ?? `Competence ${index + 1}`),
    value,
    baseValue,
    rolledValue,
    rollFormula: String(sourceSkill.rollFormula ?? baseSkill.rollFormula ?? ''),
    manaCost: clampHeroRuntimeNumber(sourceSkill.manaCost, baseSkill.manaCost ?? 0, 0, 999),
  };
}

export function normalizeHeroRuntimePower(rawPower = {}, fallbackPower = {}, index = 0) {
  const sourcePower = isPlainHeroRuntimeObject(rawPower) ? rawPower : {};
  const basePower = isPlainHeroRuntimeObject(fallbackPower) ? fallbackPower : {};
  const rawType = sourcePower.type || basePower.type || 'fire';
  const type = ['water', 'earth', 'fire', 'lightning'].includes(rawType) ? rawType : 'fire';
  const rawStatusType = sourcePower.statusType || basePower.statusType || '';
  const statusType = [
    '',
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
  ].includes(rawStatusType) ? rawStatusType : '';
  return {
    ...basePower,
    ...sourcePower,
    id: String(sourcePower.id || basePower.id || `power_${index}`),
    name: String(sourcePower.name ?? basePower.name ?? `Pouvoir ${index + 1}`),
    type,
    manaCost: clampHeroRuntimeNumber(sourcePower.manaCost, basePower.manaCost ?? 0, 0, 999),
    force: clampHeroRuntimeNumber(sourcePower.force, basePower.force ?? 1, 0, 999),
    healHealth: clampHeroRuntimeNumber(sourcePower.healHealth, basePower.healHealth ?? 0, 0, 999),
    healMana: clampHeroRuntimeNumber(sourcePower.healMana, basePower.healMana ?? 0, 0, 999),
    statusType,
    statusAmount: clampHeroRuntimeNumber(sourcePower.statusAmount, basePower.statusAmount ?? 0, 0, 999),
    statusDuration: clampHeroRuntimeNumber(sourcePower.statusDuration, basePower.statusDuration ?? 1, 1, 99),
  };
}

export function normalizeHeroRuntimeState(rawHero = {}, fallbackHero = {}, options = {}) {
  const sourceHero = isPlainHeroRuntimeObject(rawHero) ? rawHero : {};
  const baseHero = isPlainHeroRuntimeObject(fallbackHero) ? fallbackHero : {};
  const mergedHero = { ...baseHero, ...sourceHero };
  const maxHealth = clampHeroRuntimeNumber(mergedHero.maxHealth, baseHero.maxHealth ?? baseHero.health ?? 12, 1, 9999);
  const maxMana = clampHeroRuntimeNumber(mergedHero.maxMana, baseHero.maxMana ?? baseHero.mana ?? 0, 0, 9999);
  const sourceSkills = Array.isArray(sourceHero.skills) ? sourceHero.skills : Array.isArray(baseHero.skills) ? baseHero.skills : [];
  const baseSkills = Array.isArray(baseHero.skills) ? baseHero.skills : [];
  const sourcePowers = Array.isArray(sourceHero.powers) ? sourceHero.powers : Array.isArray(baseHero.powers) ? baseHero.powers : [];
  const basePowers = Array.isArray(baseHero.powers) ? baseHero.powers : [];
  const slotLabels = Array.isArray(mergedHero.equipmentSlotLabels) ? mergedHero.equipmentSlotLabels : [];
  const diceSides = options.diceSides ?? mergedHero.rules?.diceSides ?? baseHero.rules?.diceSides ?? 20;

  return {
    ...mergedHero,
    id: String(mergedHero.id || 'hero_1'),
    name: String(mergedHero.name ?? 'Heros'),
    health: clampHeroRuntimeNumber(mergedHero.health, baseHero.health ?? maxHealth, 0, maxHealth),
    maxHealth,
    mana: clampHeroRuntimeNumber(mergedHero.mana, baseHero.mana ?? maxMana, 0, maxMana),
    maxMana,
    initiative: clampHeroRuntimeNumber(mergedHero.initiative, baseHero.initiative ?? 0, -999, 999),
    armor: clampHeroRuntimeNumber(mergedHero.armor, baseHero.armor ?? 0, 0, 999),
    dodgeChance: clampHeroRuntimeNumber(mergedHero.dodgeChance, baseHero.dodgeChance ?? 0, 0, 100),
    equipmentSlotCount: clampHeroRuntimeNumber(mergedHero.equipmentSlotCount, baseHero.equipmentSlotCount ?? 6, 1, 8),
    equipmentSlotLabels: slotLabels.map((label) => String(label ?? '')),
    skills: sourceSkills.map((skill, index) => normalizeHeroRuntimeSkill(skill, baseSkills[index], index)),
    powers: sourcePowers.map((power, index) => normalizeHeroRuntimePower(power, basePowers[index], index)),
    resistanceWater: clampHeroRuntimeNumber(mergedHero.resistanceWater, baseHero.resistanceWater ?? 0, 0, 100),
    resistanceEarth: clampHeroRuntimeNumber(mergedHero.resistanceEarth, baseHero.resistanceEarth ?? 0, 0, 100),
    resistanceFire: clampHeroRuntimeNumber(mergedHero.resistanceFire, baseHero.resistanceFire ?? 0, 0, 100),
    resistanceLightning: clampHeroRuntimeNumber(mergedHero.resistanceLightning, baseHero.resistanceLightning ?? 0, 0, 100),
    rules: normalizeHeroRuntimeRules(sourceHero.rules || mergedHero.rules, baseHero.rules, diceSides),
  };
}

export function normalizeEquippedHeroState(rawItemIds = [], rawSlotMap = {}, options = {}) {
  const itemCatalog = Array.isArray(options.items) ? options.items : [];
  const hasCatalog = itemCatalog.length > 0;
  const equipmentItemIds = new Set(
    itemCatalog
      .filter((item) => item && (item.heroItemType || 'none') === 'equipment')
      .map((item) => String(item.id || ''))
      .filter(Boolean),
  );
  const isValidEquipmentId = (itemId) => {
    const id = String(itemId || '');
    return Boolean(id && (!hasCatalog || equipmentItemIds.has(id)));
  };
  const sourceMap = isPlainHeroRuntimeObject(rawSlotMap) ? rawSlotMap : {};
  const slotCount = clampHeroRuntimeNumber(options.slotCount, 6, 1, 8);
  const rawIds = Array.isArray(rawItemIds) ? rawItemIds : [];
  const requestedIds = [...rawIds, ...Object.values(sourceMap)]
    .map((itemId) => String(itemId || ''))
    .filter(isValidEquipmentId);
  const equippedHeroItemIds = [...new Set(requestedIds)];
  const equippedSet = new Set(equippedHeroItemIds);
  const mappedIds = new Set();
  const equippedHeroSlotMap = {};

  Object.entries(sourceMap)
    .map(([slot, itemId]) => [Number(slot), String(itemId || '')])
    .filter(([slot, itemId]) => (
      Number.isInteger(slot)
      && slot >= 0
      && slot < slotCount
      && equippedSet.has(itemId)
      && !mappedIds.has(itemId)
    ))
    .sort(([slotA], [slotB]) => slotA - slotB)
    .forEach(([slot, itemId]) => {
      if (mappedIds.has(itemId)) return;
      if (equippedHeroSlotMap[String(slot)]) return;
      equippedHeroSlotMap[String(slot)] = itemId;
      mappedIds.add(itemId);
    });

  equippedHeroItemIds
    .filter((itemId) => !mappedIds.has(itemId))
    .forEach((itemId) => {
      const openSlot = Array.from({ length: slotCount }, (_, index) => index)
        .find((slot) => !equippedHeroSlotMap[String(slot)]);
      if (openSlot === undefined) return;
      equippedHeroSlotMap[String(openSlot)] = itemId;
      mappedIds.add(itemId);
    });

  return {
    equippedHeroItemIds,
    equippedHeroSlotMap,
  };
}

export function normalizeLastDiceRoll(rawRoll = null, options = {}) {
  if (!isPlainHeroRuntimeObject(rawRoll)) return null;
  const hasRollMeaning = [
    'raw',
    'total',
    'success',
    'skillId',
    'actionType',
    'isCriticalSuccess',
    'isCriticalFailure',
  ].some((key) => rawRoll[key] !== undefined && rawRoll[key] !== null && rawRoll[key] !== '');
  if (!hasRollMeaning) return null;

  const nextRoll = { ...rawRoll };
  const sides = clampHeroRuntimeNumber(rawRoll.sides, options.diceSides ?? 20, 2, 1000);
  if (rawRoll.sides !== undefined || rawRoll.raw !== undefined) nextRoll.sides = sides;
  if (rawRoll.raw !== undefined) nextRoll.raw = clampHeroRuntimeNumber(rawRoll.raw, 1, 1, sides);
  if (rawRoll.modifier !== undefined) nextRoll.modifier = clampHeroRuntimeNumber(rawRoll.modifier, 0, -999, 999);
  if (rawRoll.total !== undefined) {
    nextRoll.total = clampHeroRuntimeNumber(rawRoll.total, nextRoll.raw ?? 0, -999, 9999);
  } else if (rawRoll.raw !== undefined) {
    nextRoll.total = (nextRoll.raw || 0) + (nextRoll.modifier || 0);
  }
  if (rawRoll.difficulty !== undefined) nextRoll.difficulty = clampHeroRuntimeNumber(rawRoll.difficulty, 0, 0, 9999);
  if (rawRoll.success !== undefined) nextRoll.success = Boolean(rawRoll.success);
  if (rawRoll.isCriticalSuccess !== undefined) nextRoll.isCriticalSuccess = Boolean(rawRoll.isCriticalSuccess);
  if (rawRoll.isCriticalFailure !== undefined) nextRoll.isCriticalFailure = Boolean(rawRoll.isCriticalFailure);
  if (rawRoll.skillId !== undefined) nextRoll.skillId = String(rawRoll.skillId || '');
  if (rawRoll.skillName !== undefined) nextRoll.skillName = String(rawRoll.skillName || '');
  if (rawRoll.die !== undefined) nextRoll.die = String(rawRoll.die || '');
  if (rawRoll.actionType !== undefined) nextRoll.actionType = String(rawRoll.actionType || '');
  return nextRoll;
}

export function normalizeHeroStatusEffects(effects = []) {
  return (Array.isArray(effects) ? effects : [])
    .map(normalizeStatusEffect)
    .filter(Boolean);
}

export function normalizeHeroCombatStates(rawStates = {}, options = {}) {
  if (!isPlainHeroRuntimeObject(rawStates)) return {};
  return Object.fromEntries(
    Object.entries(rawStates)
      .filter(([combatId, combatState]) => combatId && isPlainHeroRuntimeObject(combatState))
      .map(([combatId, combatState]) => {
        const nextCombatState = { ...combatState };
        if (combatState.enemyHealth !== undefined) {
          nextCombatState.enemyHealth = clampHeroRuntimeNumber(combatState.enemyHealth, 0, 0, 99999);
        }
        if (combatState.enemyMaxHealth !== undefined) {
          nextCombatState.enemyMaxHealth = clampHeroRuntimeNumber(combatState.enemyMaxHealth, 0, 0, 99999);
        }
        if (combatState.enemyMana !== undefined) {
          nextCombatState.enemyMana = clampHeroRuntimeNumber(combatState.enemyMana, 0, 0, 99999);
        }
        if (combatState.enemyMaxMana !== undefined) {
          nextCombatState.enemyMaxMana = clampHeroRuntimeNumber(combatState.enemyMaxMana, 0, 0, 99999);
        }
        if (combatState.defeated !== undefined) nextCombatState.defeated = Boolean(combatState.defeated);
        if (combatState.heroStatusEffects !== undefined) {
          nextCombatState.heroStatusEffects = normalizeHeroStatusEffects(combatState.heroStatusEffects);
        }
        if (combatState.enemyStatusEffects !== undefined) {
          nextCombatState.enemyStatusEffects = normalizeHeroStatusEffects(combatState.enemyStatusEffects);
        }
        if (combatState.lastRoll !== undefined) {
          nextCombatState.lastRoll = normalizeLastDiceRoll(combatState.lastRoll, options);
        }
        if (combatState.lastHeroRoll !== undefined) {
          nextCombatState.lastHeroRoll = normalizeLastDiceRoll(combatState.lastHeroRoll, options);
        }
        if (combatState.lastEnemyRoll !== undefined) {
          nextCombatState.lastEnemyRoll = normalizeLastDiceRoll(combatState.lastEnemyRoll, options);
        }
        return [String(combatId), nextCombatState];
      }),
  );
}

export function normalizeHeroRuntimeSaveState(sourceState = {}, options = {}) {
  const source = isPlainHeroRuntimeObject(sourceState) ? sourceState : {};
  const fallbackHero = options.fallbackHero && typeof options.fallbackHero === 'object' ? options.fallbackHero : {};
  const heroState = normalizeHeroRuntimeState(source.heroState, fallbackHero, options);
  const equipment = normalizeEquippedHeroState(source.equippedHeroItemIds, source.equippedHeroSlotMap, {
    items: options.items,
    slotCount: options.slotCount ?? heroState.equipmentSlotCount,
  });
  return {
    heroState,
    lastDiceRoll: normalizeLastDiceRoll(source.lastDiceRoll, options),
    heroCombatStates: normalizeHeroCombatStates(source.heroCombatStates, options),
    equippedHeroItemIds: equipment.equippedHeroItemIds,
    equippedHeroSlotMap: equipment.equippedHeroSlotMap,
  };
}
