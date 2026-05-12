export const COMBAT_MEDIA_TYPES = new Set(['image', 'anime2d']);
export const COMBAT_EFFECT_MEDIA_TYPES = new Set(['none', 'image', 'anime2d', 'video']);

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
  enemyStrength: 2,
  enemyMaxMana: 0,
  enemyPowerName: 'Pouvoir',
  enemyPowerType: 'fire',
  enemyPowerManaCost: 3,
  enemyPowerDamage: 4,
  enemyPowerUsageChance: 25,
  enemyCriticalChance: 5,
  enemyCriticalMultiplier: 2,
  enemyResistanceWater: 0,
  enemyResistanceEarth: 0,
  enemyResistanceFire: 0,
  enemyResistanceLightning: 0,
  ...createCombatEffectDefaults(),
};
