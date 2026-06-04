import { useCallback, useEffect, useState } from 'react';
import Rpg3DHelpLabel from './Rpg3DHelpLabel.jsx';

export default function Rpg3DMapNumberField({
  label,
  help,
  ariaLabel,
  value,
  min,
  max,
  step,
  onCommit,
}) {
  const [draft, setDraft] = useState(String(value ?? ''));

  useEffect(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const commitDraft = useCallback(() => {
    const nextValue = Number(String(draft).trim());
    if (!Number.isFinite(nextValue)) {
      setDraft(String(value ?? ''));
      return;
    }
    onCommit(nextValue);
  }, [draft, onCommit, value]);

  return (
    <label className="arcade-map-card-field">
      <input
        className="arcade-map-card-input"
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        data-min={min}
        data-max={max}
        data-step={step}
        value={draft}
        aria-label={ariaLabel}
        onChange={(event) => {
          if (/^\d*$/.test(event.target.value)) setDraft(event.target.value);
        }}
        onBlur={commitDraft}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') {
            setDraft(String(value ?? ''));
            event.currentTarget.blur();
          }
        }}
      />
      <Rpg3DHelpLabel className="arcade-map-card-help-label" help={help}>{label}</Rpg3DHelpLabel>
    </label>
  );
}
