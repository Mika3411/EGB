export const getVisualEffectZoneZIndex = (layer = 'behind') => {
  if (layer === 'front') return 26;
  if (layer === 'between') return 19;
  return 13;
};

export const VISUAL_EFFECT_OPTIONS = [
  { value: 'sparkles', label: 'Etoiles scintillantes' },
  { value: 'stars', label: 'Champ d etoiles' },
  { value: 'snow', label: 'Neige douce' },
  { value: 'blizzard', label: 'Tempete de neige' },
  { value: 'fog', label: 'Brume' },
  { value: 'smoke', label: 'Fumee' },
  { value: 'hearts', label: 'Coeurs flottants' },
  { value: 'glow', label: 'Halo lumineux' },
  { value: 'fireflies', label: 'Lucioles' },
  { value: 'rain', label: 'Pluie fine' },
  { value: 'storm', label: 'Orage' },
  { value: 'magic', label: 'Poussiere magique' },
  { value: 'embers', label: 'Braises' },
  { value: 'flames', label: 'Flammes' },
  { value: 'bubbles', label: 'Bulles' },
  { value: 'aurora', label: 'Aurore' },
  { value: 'vignette', label: 'Ombre dramatique' },
  { value: 'scanlines', label: 'Ecran VHS' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'confetti', label: 'Confettis' },
  { value: 'beauty-lens', label: 'Lens douceur' },
  { value: 'dream-lens', label: 'Lens reve' },
  { value: 'neon-lens', label: 'Lens neon' },
  { value: 'night-vision', label: 'Vision nocturne' },
  { value: 'thermal', label: 'Thermique' },
  { value: 'comic-lens', label: 'BD pop' },
  { value: 'noir-lens', label: 'Film noir' },
];

export const VISUAL_EFFECT_GROUPS = [
  {
    label: 'Lumiere et magie',
    options: ['sparkles', 'stars', 'glow', 'fireflies', 'magic', 'aurora'],
  },
  {
    label: 'Meteo et ambiance',
    options: ['snow', 'blizzard', 'rain', 'storm', 'fog', 'smoke'],
  },
  {
    label: 'Chaleur et feu',
    options: ['embers', 'flames'],
  },
  {
    label: 'Romantique et fete',
    options: ['hearts', 'bubbles', 'confetti'],
  },
  {
    label: 'Cinema et tension',
    options: ['vignette', 'scanlines', 'glitch'],
  },
  {
    label: 'Filtres lens',
    options: ['beauty-lens', 'dream-lens', 'neon-lens', 'night-vision', 'thermal', 'comic-lens', 'noir-lens'],
  },
];

export const VISUAL_EFFECT_INTENSITY_OPTIONS = [
  { value: 'subtle', label: 'Faible' },
  { value: 'normal', label: 'Normale' },
  { value: 'strong', label: 'Forte' },
];

export default function SceneVisualEffect({ effect, intensity = 'normal', className = '', style }) {
  if (!effect || effect === 'none') return null;
  const safeIntensity = ['subtle', 'normal', 'strong'].includes(intensity) ? intensity : 'normal';

  return (
    <div className={`scene-visual-effect scene-visual-effect--${effect} scene-visual-effect--${safeIntensity} ${className}`} style={style} aria-hidden="true" />
  );
}
