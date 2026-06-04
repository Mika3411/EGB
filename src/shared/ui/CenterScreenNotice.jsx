import React, { useEffect } from 'react';

export default function CenterScreenNotice({ message = '', durationMs = 3200, onDone }) {
  useEffect(() => {
    if (!message) return undefined;
    const timeoutId = window.setTimeout(() => {
      onDone?.();
    }, durationMs);
    return () => window.clearTimeout(timeoutId);
  }, [durationMs, message, onDone]);

  if (!message) return null;

  return (
    <div className="center-screen-notice" role="status" aria-live="polite">
      <p>{message}</p>
    </div>
  );
}
