export const COMBAT_MEDIA_TYPES = new Set(['image', 'anime2d']);
export const COMBAT_EFFECT_MEDIA_TYPES = new Set(['none', 'visual', 'image', 'anime2d', 'video']);

export const COMBAT_VISUAL_EFFECT_TYPES = new Set([
  'none',
  'shake',
  'fire',
  'lightning',
  'wave',
  'rockfall',
  'horizontal-spin',
]);

export const COMBAT_VISUAL_EFFECT_OPTIONS = [
  { id: 'none', label: 'Aucune' },
  { id: 'shake', label: 'Tremblement' },
  { id: 'fire', label: 'Feu' },
  { id: 'lightning', label: 'Foudre' },
  { id: 'wave', label: 'Vague' },
  { id: 'rockfall', label: 'Rocher qui tombe' },
  { id: 'horizontal-spin', label: "Image qui tourne à l'horizontale" },
];

export const COMBAT_EFFECT_SLOTS = [
  { actor: 'hero', outcome: 'hit' },
  { actor: 'hero', outcome: 'death' },
  { actor: 'enemy', outcome: 'hit' },
  { actor: 'enemy', outcome: 'death' },
];

export const getCombatEffectFieldBase = (actor, outcome) => (
  `${actor}${outcome === 'death' ? 'Death' : 'Hit'}Effect`
);

export const createCombatEffectDefaults = () => Object.fromEntries(
  COMBAT_EFFECT_SLOTS.flatMap(({ actor, outcome }) => {
    const base = getCombatEffectFieldBase(actor, outcome);
    return [
      [`${base}MediaType`, 'none'],
      [`${base}ImageData`, ''],
      [`${base}ImageName`, ''],
      [`${base}Anime2dSpec`, null],
      [`${base}Anime2dName`, ''],
      [`${base}VideoData`, ''],
      [`${base}VideoName`, ''],
      [`${base}VisualEffect`, 'none'],
      [`${base}AudioData`, ''],
      [`${base}AudioName`, ''],
    ];
  })
);

export const DEFAULT_COMBAT_SETTINGS = {
  turnMode: true,
  showDice: true,
  enemyAutoTurn: true,
  backgroundImageData: '',
  backgroundImageName: '',
  heroMediaType: 'image',
  heroImageData: '',
  heroImageName: '',
  heroAnime2dSpec: null,
  heroAnime2dName: '',
  enemyMediaType: 'image',
  enemyImageData: '',
  enemyImageName: '',
  enemyAnime2dSpec: null,
  enemyAnime2dName: '',
  enemyName: 'Adversaire',
  heroAttackType: 'physical',
  heroDieDamagePercent: 0,
  enemyInitiative: 0,
  enemyStrength: 2,
  enemyDieDamagePercent: 0,
  enemyCunning: 10,
  enemyChaos: 10,
  enemyArmor: 0,
  enemyDodgeChance: 0,
  enemyMaxMana: 0,
  enemyPowerName: 'Pouvoir',
  enemyPowerType: 'fire',
  enemyPowerManaCost: 3,
  enemyPowerDamage: 4,
  enemyPowerUsageChance: 25,
  enemyAiMode: 'tactical',
  enemyCriticalChance: 5,
  enemyCriticalMultiplier: 2,
  enemyResistanceWater: 0,
  enemyResistanceEarth: 0,
  enemyResistanceFire: 0,
  enemyResistanceLightning: 0,
  ...createCombatEffectDefaults(),
};
