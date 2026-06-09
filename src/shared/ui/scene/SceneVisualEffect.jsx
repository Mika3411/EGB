export const getVisualEffectZoneZIndex = (layer = 'behind') => {
  if (layer === 'front') return 26;
  if (layer === 'between') return 19;
  return 13;
};

export const VISUAL_EFFECT_OPTIONS = [
  { value: 'sparkles', label: 'Étoiles scintillantes' },
  { value: 'stars', label: "Champ d'étoiles" },
  { value: 'snow', label: 'Neige douce' },
  { value: 'blizzard', label: 'Tempête de neige' },
  { value: 'fog', label: 'Brume' },
  { value: 'smoke', label: 'Fumée' },
  { value: 'hearts', label: 'Cœurs flottants' },
  { value: 'glow', label: 'Halo lumineux' },
  { value: 'fireflies', label: 'Lucioles' },
  { value: 'rain', label: 'Pluie fine' },
  { value: 'storm', label: 'Orage' },
  { value: 'magic', label: 'Poussière magique' },
  { value: 'embers', label: 'Braises' },
  { value: 'flames', label: 'Flammes' },
  { value: 'bubbles', label: 'Bulles' },
  { value: 'aurora', label: 'Aurore' },
  { value: 'vignette', label: 'Ombre dramatique' },
  { value: 'scanlines', label: 'Écran VHS' },
  { value: 'glitch', label: 'Glitch' },
  { value: 'confetti', label: 'Confettis' },
  { value: 'beauty-lens', label: 'Filtre douceur' },
  { value: 'dream-lens', label: 'Filtre rêve' },
  { value: 'neon-lens', label: 'Filtre néon' },
  { value: 'night-vision', label: 'Vision nocturne' },
  { value: 'thermal', label: 'Thermique' },
  { value: 'comic-lens', label: 'BD pop' },
  { value: 'noir-lens', label: 'Film noir' },
];

export const VISUAL_EFFECT_GROUPS = [
  {
    label: 'Lumière et magie',
    options: ['sparkles', 'stars', 'glow', 'fireflies', 'magic', 'aurora'],
  },
  {
    label: 'Météo et ambiance',
    options: ['snow', 'blizzard', 'rain', 'storm', 'fog', 'smoke'],
  },
  {
    label: 'Chaleur et feu',
    options: ['embers', 'flames'],
  },
  {
    label: 'Romantique et fête',
    options: ['hearts', 'bubbles', 'confetti'],
  },
  {
    label: 'Cinéma et tension',
    options: ['vignette', 'scanlines', 'glitch'],
  },
  {
    label: 'Filtres',
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
