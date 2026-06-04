import { useCallback, useEffect, useRef, useState } from 'react';

export default function Rpg3DInspectorNumberInput({
  value,
  onCommit,
  inputMode = 'decimal',
  ...props
}) {
  const [draft, setDraft] = useState(String(value ?? ''));
  const [isEditing, setIsEditing] = useState(false);
  const lastValueRef = useRef(String(value ?? ''));

  useEffect(() => {
    const nextValue = String(value ?? '');
    if (nextValue !== lastValueRef.current) {
      lastValueRef.current = nextValue;
      if (!isEditing) setDraft(nextValue);
      return;
    }
    if (!isEditing && draft !== '') setDraft(nextValue);
  }, [draft, isEditing, value]);

  const resetDraft = useCallback(() => {
    setDraft(String(value ?? ''));
  }, [value]);

  const commitDraft = useCallback((nextDraft = draft) => {
    const trimmed = String(nextDraft).trim();
    const numericValue = Number(trimmed);
    if (trimmed === '') return;
    if (!Number.isFinite(numericValue)) {
      resetDraft();
      return;
    }
    onCommit(numericValue);
  }, [draft, onCommit, resetDraft]);

  return (
    <input
      {...props}
      type="text"
      inputMode={inputMode}
      value={draft}
      onFocus={(event) => {
        setIsEditing(true);
        props.onFocus?.(event);
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={(event) => {
        setIsEditing(false);
        commitDraft(event.currentTarget.value);
        props.onBlur?.(event);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') {
          resetDraft();
          event.currentTarget.blur();
        }
        props.onKeyDown?.(event);
      }}
    />
  );
}
