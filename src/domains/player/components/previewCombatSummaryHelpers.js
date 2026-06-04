const getCombatEntryValue = (entry, key, fallback) => (
  entry?.[key] === undefined || entry?.[key] === '' || entry?.[key] === null ? fallback : entry[key]
);

const HERO_POWER_TYPE_LABELS = {
  water: 'Eau',
  earth: 'Terre',
  fire: 'Feu',
  lightning: 'Foudre',
};

const HERO_RESISTANCE_SUMMARY_FIELDS = [
  { id: 'water', label: 'Eau', field: 'resistanceWater' },
  { id: 'earth', label: 'Terre', field: 'resistanceEarth' },
  { id: 'fire', label: 'Feu', field: 'resistanceFire' },
  { id: 'lightning', label: 'Foudre', field: 'resistanceLightning' },
];

const normalizeHeroStatKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const getHeroForceSkill = (skills = []) => (
  skills.find((skill) => (
    normalizeHeroStatKey(skill.id) === 'force'
    || normalizeHeroStatKey(skill.name) === 'force'
  )) || skills[0] || null
);

const getCombatActorMedia = (entry, combat, actor, fallbackImage = '') => {
  const entryPrefix = actor === 'hero' ? 'combatHero' : 'combatEnemy';
  const globalPrefix = actor;
  const mediaType = getCombatEntryValue(entry, `${entryPrefix}MediaType`, combat?.[`${globalPrefix}MediaType`] || 'image');
  return {
    mediaType: mediaType === 'anime2d' ? 'anime2d' : 'image',
    imageData: entry?.[`${entryPrefix}ImageData`] || combat?.[`${globalPrefix}ImageData`] || fallbackImage || '',
    anime2dSpec: entry?.[`${entryPrefix}Anime2dSpec`] || combat?.[`${globalPrefix}Anime2dSpec`] || null,
  };
};

export {
  getCombatEntryValue,
  getHeroForceSkill,
  getCombatActorMedia,
  HERO_POWER_TYPE_LABELS,
  HERO_RESISTANCE_SUMMARY_FIELDS,
};
