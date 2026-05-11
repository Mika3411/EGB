import { useEffect, useState } from 'react';

export default function NumberInput({ value, onValueChange, ...props }) {
  const [draftValue, setDraftValue] = useState(String(value ?? ''));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (!isEditing) setDraftValue(String(value ?? ''));
  }, [isEditing, value]);

  const handleChange = (event) => {
    const nextValue = event.target.value;
    setDraftValue(nextValue);
    if (nextValue === '') return;
    const numericValue = Number(nextValue);
    if (Number.isFinite(numericValue)) onValueChange?.(numericValue);
  };

  const handleBlur = (event) => {
    setIsEditing(false);
    if (draftValue === '' || !Number.isFinite(Number(draftValue))) {
      setDraftValue(String(value ?? ''));
    }
    props.onBlur?.(event);
  };

  return (
    <input
      {...props}
      type="number"
      value={draftValue}
      onFocus={(event) => {
        setIsEditing(true);
        props.onFocus?.(event);
      }}
      onChange={handleChange}
      onBlur={handleBlur}
    />
  );
}
