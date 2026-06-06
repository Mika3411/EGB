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

export const SCENE_OBJECT_FONT_FAMILY_OPTIONS = [
  {
    value: 'system',
    label: 'Classique',
    family: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  {
    value: 'serif',
    label: 'Serif',
    family: 'Georgia, "Times New Roman", serif',
  },
  {
    value: 'mono',
    label: 'Machine',
    family: '"Courier New", Courier, monospace',
  },
  {
    value: 'handwritten',
    label: 'Manuscrite',
    family: '"Comic Sans MS", "Segoe Print", cursive',
  },
  {
    value: 'condensed',
    label: 'Affiche',
    family: '"Arial Narrow", "Roboto Condensed", Arial, sans-serif',
  },
  {
    value: 'elegant',
    label: 'Elegante',
    family: 'Garamond, "Times New Roman", serif',
  },
];

export const getSceneObjectFontFamilyValue = (obj) => (
  SCENE_OBJECT_FONT_FAMILY_OPTIONS.some((option) => option.value === obj?.fontFamily)
    ? obj.fontFamily
    : 'system'
);

export const getSceneObjectFontFamily = (obj) => (
  SCENE_OBJECT_FONT_FAMILY_OPTIONS.find((option) => option.value === getSceneObjectFontFamilyValue(obj))?.family
  || SCENE_OBJECT_FONT_FAMILY_OPTIONS[0].family
);

const SCENE_OBJECT_COLOR_DEFAULTS = {
  object: { text: '#f8fafc', background: '#0f172a', opacity: 82 },
  text: { text: '#f8fafc', background: '#0f172a', opacity: 82 },
  hint: { text: '#f8fafc', background: '#4338ca', opacity: 82 },
  button: { text: '#f8fafc', background: '#2563eb', opacity: 96 },
  input: { text: '#0f172a', background: '#f8fafc', opacity: 94 },
  code: { text: '#f8fafc', background: '#0f172a', opacity: 82 },
  image: { text: '#f8fafc', background: '#1e293b', opacity: 74 },
};

export const normalizeSceneObjectHexColor = (value, fallback = '') => {
  const raw = String(value || '').trim();
  if (/^#[0-9a-f]{6}$/i.test(raw)) return raw.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(raw)) {
    const [, r, g, b] = raw.toLowerCase();
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return fallback;
};

const getSceneObjectColorDefaults = (obj) => (
  SCENE_OBJECT_COLOR_DEFAULTS[getSceneObjectBlockType(obj)] || SCENE_OBJECT_COLOR_DEFAULTS.object
);

export const clampSceneObjectBackgroundOpacity = (value, fallback = 82) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return fallback;
  return Math.max(0, Math.min(100, Math.round(numericValue)));
};

export const hasSceneObjectBackgroundOpacityOverride = (value) => (
  value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
);

export const getSceneObjectTextColor = (obj) => (
  normalizeSceneObjectHexColor(obj?.textColor, getSceneObjectColorDefaults(obj).text)
);

export const getSceneObjectBackgroundColor = (obj) => (
  normalizeSceneObjectHexColor(obj?.backgroundColor, getSceneObjectColorDefaults(obj).background)
);

export const getSceneObjectBackgroundOpacity = (obj) => (
  clampSceneObjectBackgroundOpacity(obj?.backgroundOpacity, getSceneObjectColorDefaults(obj).opacity)
);

const hexToRgb = (hexColor) => {
  const color = normalizeSceneObjectHexColor(hexColor, '#0f172a').slice(1);
  return {
    r: parseInt(color.slice(0, 2), 16),
    g: parseInt(color.slice(2, 4), 16),
    b: parseInt(color.slice(4, 6), 16),
  };
};

const formatAlpha = (opacity) => {
  const alpha = (clampSceneObjectBackgroundOpacity(opacity) / 100).toFixed(2);
  return alpha.replace(/0+$/, '').replace(/\.$/, '');
};

export const getSceneObjectBackgroundCssColor = (obj) => {
  const { r, g, b } = hexToRgb(getSceneObjectBackgroundColor(obj));
  return `rgba(${r}, ${g}, ${b}, ${formatAlpha(getSceneObjectBackgroundOpacity(obj))})`;
};

export const getSceneObjectBlockStyle = (obj) => {
  const fontSize = getSceneObjectFontSize(obj);
  const style = {
    fontFamily: getSceneObjectFontFamily(obj),
    '--scene-object-font-size': `${fontSize}px`,
    fontSize: 'calc(var(--scene-object-font-size) * var(--scene-object-text-scale, 1))',
  };
  const customTextColor = normalizeSceneObjectHexColor(obj?.textColor, '');
  const customBackgroundColor = normalizeSceneObjectHexColor(obj?.backgroundColor, '');
  const hasCustomBackgroundOpacity = hasSceneObjectBackgroundOpacityOverride(obj?.backgroundOpacity);

  if (customTextColor) {
    style.color = getSceneObjectTextColor(obj);
    style['--interactive-block-muted-color'] = getSceneObjectTextColor(obj);
  }
  if (customBackgroundColor || hasCustomBackgroundOpacity) {
    style.background = getSceneObjectBackgroundCssColor(obj);
  }
  return style;
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
