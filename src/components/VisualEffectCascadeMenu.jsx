import { useState } from 'react';
import { VISUAL_EFFECT_GROUPS, VISUAL_EFFECT_OPTIONS } from './SceneVisualEffect.jsx';

export default function VisualEffectCascadeMenu({ value, includeNone = false, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeGroupLabel, setActiveGroupLabel] = useState(VISUAL_EFFECT_GROUPS[0]?.label || '');
  const effectByValue = new Map(VISUAL_EFFECT_OPTIONS.map((effect) => [effect.value, effect]));
  const selectedEffect = value && value !== 'none' ? effectByValue.get(value) : null;
  const label = selectedEffect?.label || 'Aucun';
  const activeGroup = VISUAL_EFFECT_GROUPS.find((group) => group.label === activeGroupLabel) || VISUAL_EFFECT_GROUPS[0];

  const selectEffect = (nextEffect) => {
    onChange(nextEffect);
    setIsOpen(false);
  };

  return (
    <div className={`visual-effect-cascade ${isOpen ? 'open' : ''}`}>
      <button
        type="button"
        className="visual-effect-cascade__trigger"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{label}</span>
        <span aria-hidden="true">›</span>
      </button>
      <div className="visual-effect-cascade__menu">
        {includeNone ? (
          <button
            type="button"
            className={`visual-effect-cascade__item ${value === 'none' || !value ? 'selected' : ''}`}
            onClick={() => selectEffect('none')}
          >
            Aucun
          </button>
        ) : null}
        {VISUAL_EFFECT_GROUPS.map((group) => (
          <button
            key={group.label}
            type="button"
            className={`visual-effect-cascade__item visual-effect-cascade__parent ${activeGroup?.label === group.label ? 'active' : ''}`}
            onClick={() => setActiveGroupLabel(group.label)}
          >
            <span>{group.label}</span>
            <span aria-hidden="true">›</span>
          </button>
        ))}
        {activeGroup ? (
          <div className="visual-effect-cascade__submenu">
            {activeGroup.options.map((effectValue) => {
              const effect = effectByValue.get(effectValue);
              if (!effect) return null;
              return (
                <button
                  key={effect.value}
                  type="button"
                  className={`visual-effect-cascade__item ${value === effect.value ? 'selected' : ''}`}
                  onClick={() => selectEffect(effect.value)}
                >
                  {effect.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
