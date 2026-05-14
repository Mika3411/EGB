import {
  COMBAT_EFFECT_MEDIA_TYPES,
  COMBAT_EFFECT_SLOTS,
  COMBAT_MEDIA_TYPES,
  DEFAULT_COMBAT_SETTINGS,
  getCombatEffectFieldBase,
} from './combatDefaults.js';

export const DEFAULT_EQUIPMENT_SLOT_LABELS = ['Casque', 'Bouclier', 'Arme', 'Armure', 'Anneau', 'Jambieres', 'Amulette', 'Sac'];
export const DEFAULT_EDITOR_EQUIPMENT_SLOT_LABELS = ['Casque', 'Bouclier', 'Arme', 'Armure', 'Anneau', 'Jambières', 'Amulette', 'Sac'];
export const HERO_DICE_SKIN_IDS = new Set(['classic', 'bone', 'royal', 'ember', 'mana', 'forest', 'shadow', 'divine', 'cursed']);
export const HERO_POWER_TYPE_IDS = new Set(['water', 'earth', 'fire', 'lightning']);
export const HERO_STATUS_EFFECT_TYPE_IDS = new Set([
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
]);

export const DEFAULT_HERO_SKILLS = [
  { id: 'force', name: 'Force', value: 1, manaCost: 0 },
  { id: 'ruse', name: 'Ruse', value: 1, manaCost: 0 },
  { id: 'survie', name: 'Survie', value: 1, manaCost: 0 },
  { id: 'magie', name: 'Magie', value: 1, manaCost: 1 },
];

export const DEFAULT_HERO_EDITOR_SKILLS = [
  { id: 'force', name: 'Force', value: 3, manaCost: 0 },
  { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
  { id: 'survie', name: 'Survie', value: 2, manaCost: 0 },
  { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
];

export const DEFAULT_HERO_ADVENTURE = {
  enabled: false,
  dice: { sides: 20, label: 'd20', skin: 'classic' },
  hero: {
    name: 'Héros',
    description: '',
    health: 12,
    maxHealth: 12,
    mana: 6,
    maxMana: 6,
    initiative: 0,
    armor: 0,
    dodgeChance: 0,
    backgroundImageData: '',
    characterImageData: '',
    setupBackgroundImageData: '',
    setupMusicData: '',
    setupMusicName: '',
    defeatSceneId: '',
    equipmentSlotCount: 6,
    equipmentSlotLabels: DEFAULT_EQUIPMENT_SLOT_LABELS,
    skills: DEFAULT_HERO_SKILLS,
    powers: [
      { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 2, force: 4 },
    ],
    resistanceWater: 0,
    resistanceEarth: 0,
    resistanceFire: 0,
    resistanceLightning: 0,
  },
  rules: {
    criticalSuccess: 20,
    criticalFailure: 1,
    criticalChance: 0,
    criticalMultiplier: 2,
  },
  combat: DEFAULT_COMBAT_SETTINGS,
};

export const DEFAULT_HERO_EDITOR_ADVENTURE = {
  enabled: true,
  dice: { sides: 20, label: 'd20', skin: 'classic' },
  hero: {
    ...DEFAULT_HERO_ADVENTURE.hero,
    name: 'Aventurier',
    health: 18,
    maxHealth: 18,
    mana: 10,
    maxMana: 10,
    equipmentSlotLabels: DEFAULT_EDITOR_EQUIPMENT_SLOT_LABELS,
    skills: DEFAULT_HERO_EDITOR_SKILLS,
  },
  rules: {
    ...DEFAULT_HERO_ADVENTURE.rules,
    allowManualAdjustments: true,
    failForward: true,
  },
  combat: DEFAULT_COMBAT_SETTINGS,
};

export const addUnique = (items = [], item) => (item && !items.includes(item) ? [...items, item] : items);

export const clampNumber = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));

export const clampCombatNumber = (value, fallback, min, max) => {
  const next = Number(value);
  return Math.max(min, Math.min(max, Number.isFinite(next) ? next : fallback));
};

export const clampEditorNumber = (value, fallback, min = 0, max = 999) => {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.round(next)));
};

export const textOrDefault = (value, fallback = '') => (
  value === undefined || value === null ? fallback : String(value)
);

export const normalizeSkillId = (name = 'competence') => (
  name
    .toString()
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    || `compétence_${Math.random().toString(36).slice(2, 7)}`
);

const getHeroAdventureOptions = (options = {}) => {
  const profile = options.profile || options.mode || 'preview';
  const defaults = options.defaults || (profile === 'editor' ? DEFAULT_HERO_EDITOR_ADVENTURE : DEFAULT_HERO_ADVENTURE);
  return {
    profile,
    defaults,
    isEditor: profile === 'editor',
    equipmentSlotLabels: options.equipmentSlotLabels || defaults.hero.equipmentSlotLabels || DEFAULT_EQUIPMENT_SLOT_LABELS,
  };
};

const normalizeCombatMediaType = (value) => (COMBAT_MEDIA_TYPES.has(value) ? value : 'image');
const normalizeCombatEffectMediaType = (value) => (COMBAT_EFFECT_MEDIA_TYPES.has(value) ? value : 'none');
const normalizeHeroAttackType = (value) => (['physical', 'water', 'earth', 'fire', 'lightning'].includes(value) ? value : 'physical');
const normalizePowerType = (value) => (['water', 'earth', 'fire', 'lightning'].includes(value) ? value : 'fire');

export const normalizeHeroRules = (rawRules = {}, diceSides = DEFAULT_HERO_ADVENTURE.dice.sides, options = {}) => {
  const { defaults, isEditor } = getHeroAdventureOptions(options);
  const sourceRules = rawRules && typeof rawRules === 'object' ? rawRules : {};

  if (isEditor) {
    return {
      ...defaults.rules,
      ...sourceRules,
      criticalSuccess: clampEditorNumber(sourceRules?.criticalSuccess, defaults.rules.criticalSuccess, 1, diceSides),
      criticalFailure: clampEditorNumber(sourceRules?.criticalFailure, defaults.rules.criticalFailure, 1, diceSides),
      criticalChance: clampEditorNumber(sourceRules?.criticalChance, defaults.rules.criticalChance, 0, 100),
      criticalMultiplier: clampEditorNumber(sourceRules?.criticalMultiplier, defaults.rules.criticalMultiplier, 1, 20),
    };
  }

  return {
    criticalSuccess: clampCombatNumber(sourceRules?.criticalSuccess, defaults.rules.criticalSuccess, 1, diceSides),
    criticalFailure: clampCombatNumber(sourceRules?.criticalFailure, defaults.rules.criticalFailure, 1, diceSides),
    criticalChance: clampCombatNumber(sourceRules?.criticalChance, defaults.rules.criticalChance, 0, 100),
    criticalMultiplier: Math.max(1, Math.min(20, Number(sourceRules?.criticalMultiplier) || defaults.rules.criticalMultiplier)),
  };
};

export const normalizeHeroSheet = (
  rawHero = {},
  index = 0,
  diceSides = DEFAULT_HERO_ADVENTURE.dice.sides,
  fallbackRules = {},
  options = {},
) => {
  const { defaults, isEditor, equipmentSlotLabels } = getHeroAdventureOptions(options);
  const sourceHero = rawHero && typeof rawHero === 'object' ? rawHero : {};
  const defaultHero = defaults.hero;
  const maxHealth = isEditor
    ? clampEditorNumber(sourceHero.maxHealth, defaultHero.maxHealth, 1, 999)
    : Math.max(1, Number(sourceHero.maxHealth || sourceHero.health || defaultHero.maxHealth));
  const maxMana = isEditor
    ? clampEditorNumber(sourceHero.maxMana, defaultHero.maxMana, 0, 999)
    : Math.max(0, Number(sourceHero.maxMana || sourceHero.mana || defaultHero.maxMana));
  const skills = Array.isArray(sourceHero.skills) && sourceHero.skills.length ? sourceHero.skills : defaultHero.skills;
  const powers = Array.isArray(sourceHero.powers) && sourceHero.powers.length ? sourceHero.powers : defaultHero.powers;
  const skillFallbackId = (skill, skillIndex) => (
    isEditor ? normalizeSkillId(skill.name || `competence_${skillIndex + 1}`) : `skill_${skillIndex}`
  );
  const powerFallbackId = (power, powerIndex) => (
    isEditor ? normalizeSkillId(power.name || `pouvoir_${powerIndex + 1}`) : `power_${powerIndex}`
  );

  return {
    id: sourceHero.id || `hero_${index + 1}`,
    name: textOrDefault(sourceHero.name, defaultHero.name),
    description: textOrDefault(sourceHero.description, defaultHero.description),
    health: isEditor
      ? clampEditorNumber(sourceHero.health, maxHealth, 0, maxHealth)
      : clampNumber(sourceHero.health ?? maxHealth, 0, maxHealth),
    maxHealth,
    mana: isEditor
      ? clampEditorNumber(sourceHero.mana, maxMana, 0, maxMana)
      : clampNumber(sourceHero.mana ?? maxMana, 0, maxMana),
    maxMana,
    initiative: isEditor
      ? clampEditorNumber(sourceHero.initiative, defaultHero.initiative, -999, 999)
      : clampCombatNumber(sourceHero.initiative, defaultHero.initiative, -999, 999),
    armor: isEditor
      ? clampEditorNumber(sourceHero.armor, defaultHero.armor, 0, 999)
      : clampCombatNumber(sourceHero.armor, defaultHero.armor, 0, 999),
    dodgeChance: isEditor
      ? clampEditorNumber(sourceHero.dodgeChance, defaultHero.dodgeChance, 0, 100)
      : clampCombatNumber(sourceHero.dodgeChance, defaultHero.dodgeChance, 0, 100),
    backgroundImageData: sourceHero.backgroundImageData || '',
    characterImageData: sourceHero.characterImageData || '',
    setupBackgroundImageData: sourceHero.setupBackgroundImageData || '',
    setupMusicData: sourceHero.setupMusicData || '',
    setupMusicName: sourceHero.setupMusicName || '',
    defeatSceneId: sourceHero.defeatSceneId || '',
    equipmentSlotCount: isEditor
      ? clampEditorNumber(sourceHero.equipmentSlotCount, defaultHero.equipmentSlotCount, 1, 8)
      : Math.max(1, Math.min(8, Number(sourceHero.equipmentSlotCount || defaultHero.equipmentSlotCount))),
    equipmentSlotLabels: equipmentSlotLabels.map((label, slotIndex) => {
      const customLabel = Array.isArray(sourceHero.equipmentSlotLabels) ? sourceHero.equipmentSlotLabels[slotIndex] : undefined;
      return textOrDefault(customLabel, label);
    }),
    skills: skills.map((skill, skillIndex) => ({
      id: skill.id || skillFallbackId(skill, skillIndex),
      name: textOrDefault(skill.name, `Competence ${skillIndex + 1}`),
      value: isEditor ? clampEditorNumber(skill.value, 0, -20, 50) : Number(skill.value) || 0,
      baseValue: Number.isFinite(Number(skill.baseValue))
        ? (isEditor ? clampEditorNumber(skill.baseValue, 0, -20, 50) : Number(skill.baseValue))
        : (isEditor
          ? clampEditorNumber((Number(skill.value) || 0) - (Number(skill.rolledValue) || 0), 0, -20, 50)
          : (Number(skill.value) || 0) - (Number(skill.rolledValue) || 0)),
      rolledValue: isEditor
        ? (skill.rolledValue ? clampEditorNumber(skill.rolledValue, 0, 1, 6) : 0)
        : Number(skill.rolledValue) || 0,
      rollFormula: skill.rollFormula || '',
      manaCost: isEditor ? clampEditorNumber(skill.manaCost, 0, 0, 99) : Math.max(0, Number(skill.manaCost) || 0),
    })),
    powers: powers.map((power, powerIndex) => ({
      id: power.id || powerFallbackId(power, powerIndex),
      name: textOrDefault(power.name, `Pouvoir ${powerIndex + 1}`),
      type: HERO_POWER_TYPE_IDS.has(power.type) ? power.type : 'fire',
      manaCost: isEditor ? clampEditorNumber(power.manaCost, 0, 0, 999) : clampCombatNumber(power.manaCost, 0, 0, 999),
      force: isEditor ? clampEditorNumber(power.force, 1, 0, 999) : clampCombatNumber(power.force, 1, 0, 999),
      healHealth: isEditor ? clampEditorNumber(power.healHealth, 0, 0, 999) : clampCombatNumber(power.healHealth, 0, 0, 999),
      healMana: isEditor ? clampEditorNumber(power.healMana, 0, 0, 999) : clampCombatNumber(power.healMana, 0, 0, 999),
      statusType: HERO_STATUS_EFFECT_TYPE_IDS.has(power.statusType) ? power.statusType : '',
      statusAmount: isEditor ? clampEditorNumber(power.statusAmount, 0, 0, 999) : clampCombatNumber(power.statusAmount, 0, 0, 999),
      statusDuration: isEditor ? clampEditorNumber(power.statusDuration, 1, 1, 99) : clampCombatNumber(power.statusDuration, 1, 1, 99),
    })),
    resistanceWater: isEditor ? clampEditorNumber(sourceHero.resistanceWater, 0, 0, 100) : clampCombatNumber(sourceHero.resistanceWater, 0, 0, 100),
    resistanceEarth: isEditor ? clampEditorNumber(sourceHero.resistanceEarth, 0, 0, 100) : clampCombatNumber(sourceHero.resistanceEarth, 0, 0, 100),
    resistanceFire: isEditor ? clampEditorNumber(sourceHero.resistanceFire, 0, 0, 100) : clampCombatNumber(sourceHero.resistanceFire, 0, 0, 100),
    resistanceLightning: isEditor ? clampEditorNumber(sourceHero.resistanceLightning, 0, 0, 100) : clampCombatNumber(sourceHero.resistanceLightning, 0, 0, 100),
    rules: normalizeHeroRules(sourceHero.rules || fallbackRules, diceSides, options),
  };
};

const normalizeCombatEffectMedia = (rawCombat, actor, outcome) => {
  const base = getCombatEffectFieldBase(actor, outcome);
  return {
    [`${base}MediaType`]: normalizeCombatEffectMediaType(rawCombat[`${base}MediaType`]),
    [`${base}ImageData`]: rawCombat[`${base}ImageData`] || '',
    [`${base}ImageName`]: rawCombat[`${base}ImageName`] || '',
    [`${base}Anime2dSpec`]: rawCombat[`${base}Anime2dSpec`] && typeof rawCombat[`${base}Anime2dSpec`] === 'object'
      ? rawCombat[`${base}Anime2dSpec`]
      : null,
    [`${base}Anime2dName`]: rawCombat[`${base}Anime2dName`] || '',
    [`${base}VideoData`]: rawCombat[`${base}VideoData`] || '',
    [`${base}VideoName`]: rawCombat[`${base}VideoName`] || '',
    [`${base}AudioData`]: rawCombat[`${base}AudioData`] || '',
    [`${base}AudioName`]: rawCombat[`${base}AudioName`] || '',
  };
};

export const normalizeHeroCombatSettings = (rawCombat = {}, options = {}) => {
  const { isEditor } = getHeroAdventureOptions(options);
  const sourceCombat = rawCombat && typeof rawCombat === 'object' ? rawCombat : {};
  const numberClamp = isEditor ? clampEditorNumber : clampCombatNumber;

  return {
    ...DEFAULT_COMBAT_SETTINGS,
    ...sourceCombat,
    turnMode: sourceCombat.turnMode !== false,
    showDice: sourceCombat.showDice !== false,
    enemyAutoTurn: false,
    heroMediaType: normalizeCombatMediaType(sourceCombat.heroMediaType),
    enemyMediaType: normalizeCombatMediaType(sourceCombat.enemyMediaType),
    heroAnime2dSpec: sourceCombat.heroAnime2dSpec && typeof sourceCombat.heroAnime2dSpec === 'object' ? sourceCombat.heroAnime2dSpec : null,
    enemyAnime2dSpec: sourceCombat.enemyAnime2dSpec && typeof sourceCombat.enemyAnime2dSpec === 'object' ? sourceCombat.enemyAnime2dSpec : null,
    heroAttackType: normalizeHeroAttackType(sourceCombat.heroAttackType),
    ...(isEditor ? {} : {
      heroDieDamagePercent: clampCombatNumber(sourceCombat.heroDieDamagePercent, DEFAULT_COMBAT_SETTINGS.heroDieDamagePercent, 0, 999),
    }),
    enemyPowerType: normalizePowerType(sourceCombat.enemyPowerType),
    enemyInitiative: numberClamp(sourceCombat.enemyInitiative, DEFAULT_COMBAT_SETTINGS.enemyInitiative, -999, 999),
    enemyStrength: numberClamp(sourceCombat.enemyStrength, DEFAULT_COMBAT_SETTINGS.enemyStrength, 0, 999),
    ...(isEditor ? {} : {
      enemyCunning: clampCombatNumber(sourceCombat.enemyCunning, DEFAULT_COMBAT_SETTINGS.enemyCunning, 1, 999),
      enemyChaos: clampCombatNumber(sourceCombat.enemyChaos, DEFAULT_COMBAT_SETTINGS.enemyChaos, 1, 999),
    }),
    enemyArmor: numberClamp(sourceCombat.enemyArmor, DEFAULT_COMBAT_SETTINGS.enemyArmor, 0, 999),
    enemyDodgeChance: numberClamp(sourceCombat.enemyDodgeChance, DEFAULT_COMBAT_SETTINGS.enemyDodgeChance, 0, 100),
    enemyMaxMana: numberClamp(sourceCombat.enemyMaxMana, DEFAULT_COMBAT_SETTINGS.enemyMaxMana, 0, 999),
    enemyPowerManaCost: numberClamp(sourceCombat.enemyPowerManaCost, DEFAULT_COMBAT_SETTINGS.enemyPowerManaCost, 0, 999),
    enemyPowerDamage: numberClamp(sourceCombat.enemyPowerDamage, DEFAULT_COMBAT_SETTINGS.enemyPowerDamage, 0, 999),
    enemyPowerUsageChance: numberClamp(sourceCombat.enemyPowerUsageChance, DEFAULT_COMBAT_SETTINGS.enemyPowerUsageChance, 0, 100),
    enemyAiMode: sourceCombat.enemyAiMode === 'random' ? 'random' : DEFAULT_COMBAT_SETTINGS.enemyAiMode,
    enemyCriticalChance: numberClamp(sourceCombat.enemyCriticalChance, DEFAULT_COMBAT_SETTINGS.enemyCriticalChance, 0, 100),
    enemyCriticalMultiplier: Math.max(1, Math.min(20, Number(sourceCombat.enemyCriticalMultiplier) || DEFAULT_COMBAT_SETTINGS.enemyCriticalMultiplier)),
    enemyResistanceWater: numberClamp(sourceCombat.enemyResistanceWater, 0, 0, 100),
    enemyResistanceEarth: numberClamp(sourceCombat.enemyResistanceEarth, 0, 0, 100),
    enemyResistanceFire: numberClamp(sourceCombat.enemyResistanceFire, 0, 0, 100),
    enemyResistanceLightning: numberClamp(sourceCombat.enemyResistanceLightning, 0, 0, 100),
    ...(isEditor ? {} : COMBAT_EFFECT_SLOTS.reduce((settings, slot) => ({
      ...settings,
      ...normalizeCombatEffectMedia(sourceCombat, slot.actor, slot.outcome),
    }), {})),
  };
};

export const normalizeHeroAdventure = (project = {}, options = {}) => {
  const { defaults, isEditor } = getHeroAdventureOptions(options);
  const raw = project.heroAdventure && typeof project.heroAdventure === 'object'
    ? project.heroAdventure
    : {};
  const rawHero = raw.hero && typeof raw.hero === 'object' ? raw.hero : {};
  const rawDice = raw.dice && typeof raw.dice === 'object' ? raw.dice : {};
  const enabled = raw.enabled ?? project.creationMode === 'hero_adventure';
  const diceSides = isEditor
    ? clampEditorNumber(rawDice.sides, defaults.dice.sides, 2, 100)
    : Math.max(2, Number(rawDice.sides) || defaults.dice.sides);
  const sourceHeroes = Array.isArray(raw.heroes) && raw.heroes.length ? raw.heroes : [rawHero];
  const heroes = sourceHeroes.map((entry, index) => normalizeHeroSheet(entry, index, diceSides, raw.rules, options));
  const fallbackHero = normalizeHeroSheet(rawHero, 0, diceSides, raw.rules, options);
  const selectedHeroId = raw.selectedHeroId || fallbackHero.id || heroes[0]?.id || 'hero_1';
  const selectedHero = heroes.find((entry) => entry.id === selectedHeroId) || heroes[0] || fallbackHero;
  const selectedRules = normalizeHeroRules(selectedHero.rules || raw.rules, diceSides, options);
  const rawCombat = raw.combat && typeof raw.combat === 'object' ? raw.combat : {};

  return {
    enabled: isEditor ? enabled : Boolean(enabled),
    dice: {
      sides: diceSides,
      label: rawDice.label || `d${diceSides}`,
      skin: HERO_DICE_SKIN_IDS.has(rawDice.skin) ? rawDice.skin : defaults.dice.skin,
    },
    hero: { ...selectedHero, rules: selectedRules },
    rules: selectedRules,
    selectedHeroId: selectedHero.id,
    heroes,
    combat: normalizeHeroCombatSettings(rawCombat, options),
  };
};
