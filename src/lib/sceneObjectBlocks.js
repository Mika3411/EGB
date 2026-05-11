export const SCENE_OBJECT_BLOCK_TYPES = [
  { value: 'object', label: 'Objet visible' },
  { value: 'text', label: 'Texte' },
  { value: 'image', label: 'Image' },
  { value: 'button', label: 'Bouton' },
  { value: 'input', label: 'Champ de saisie' },
  { value: 'code', label: 'Code' },
  { value: 'hint', label: 'Indice' },
];

export const getSceneObjectBlockType = (obj) => (
  SCENE_OBJECT_BLOCK_TYPES.some((type) => type.value === obj?.blockType) ? obj.blockType : 'object'
);

export const getSceneObjectFontSize = (obj) => {
  const value = Number(obj?.fontSize);
  return Number.isFinite(value) ? Math.max(8, Math.min(48, value)) : 13;
};

export const getSceneObjectClickMode = (obj) => {
  if (!obj) return 'object';
  if (obj.clickMode) return obj.clickMode;
  if (obj.isClickable === false) return 'none';
  return 'object';
};

export const applySceneObjectTextOverride = (object = {}, overrideText) => {
  if (overrideText === undefined || overrideText === null) return object;

  const text = String(overrideText);
  const blockType = getSceneObjectBlockType(object);

  if (blockType === 'button') return { ...object, buttonLabel: text };
  if (blockType === 'input') return { ...object, placeholder: text };
  if (blockType === 'code') return { ...object, blockLabel: text, placeholder: text };
  if (blockType === 'image') return { ...object, blockLabel: text };
  return { ...object, blockText: text, dialogue: text };
};
