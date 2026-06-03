export const buildHeroCombatHistory = (current = {}, nextMessage = '') => {
  const cleanMessage = String(nextMessage || '').replace(/\s+/g, ' ').trim();
  const existingHistory = Array.isArray(current.history)
    ? current.history
    : current.message
      ? [current.message]
      : [];
  const history = existingHistory
    .map((entry) => String(entry || '').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (cleanMessage && history[history.length - 1] !== cleanMessage) history.push(cleanMessage);
  return history.slice(-8);
};

export const normalizeHeroSkillKey = (value = '') => (
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
);

export const createPreviewHeroState = (heroAdventure = {}) => ({
  ...(heroAdventure.hero || {}),
  health: Math.max(1, Number(heroAdventure.hero?.maxHealth) || Number(heroAdventure.hero?.health) || 1),
  mana: Math.max(0, Number(heroAdventure.hero?.maxMana) || Number(heroAdventure.hero?.mana) || 0),
});
