export const CHARACTER_ANIMATION_SLOTS = [
  { id: 'idle', label: 'Stand-by', importedLabel: 'Animation stand-by' },
  { id: 'walk', label: 'Marche', importedLabel: 'Animation marche' },
  { id: 'attack', label: 'Attaque', importedLabel: 'Animation attaque' },
];

export const CHARACTER_ANIMATION_SLOT_ORDER = CHARACTER_ANIMATION_SLOTS.map(({ id }) => id);

const CHARACTER_ANIMATION_SLOT_IDS = new Set(CHARACTER_ANIMATION_SLOT_ORDER);

const getAnimationSlotFromText = (value = '') => {
  const text = String(value || '');
  if (CHARACTER_ANIMATION_SLOT_IDS.has(text)) return text;
  return CHARACTER_ANIMATION_SLOT_ORDER.find((slot) => text.startsWith(`${slot}__`)) || '';
};

export const getAnimationBaseSlotId = (animationKey = '', animation = {}) => {
  const metadataSlot = getAnimationSlotFromText(animation?.animationSlot)
    || getAnimationSlotFromText(animation?.slot)
    || getAnimationSlotFromText(animation?.state);
  if (metadataSlot) return metadataSlot;
  return getAnimationSlotFromText(animationKey);
};
