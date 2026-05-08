import React, { useCallback, useEffect, useId, useRef, useState } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFallbackResult(kind) {
  if (kind === 'prompt') return null;
  if (kind === 'alert') return true;
  return false;
}

function DialogPanel({ request, onResolve }) {
  const titleId = useId();
  const descriptionId = useId();
  const panelRef = useRef(null);
  const inputRef = useRef(null);
  const restoreFocusRef = useRef(null);
  const [inputValue, setInputValue] = useState(request.defaultValue || '');
  const lines = String(request.message || '').split('\n');
  const isPrompt = request.kind === 'prompt';
  const isAlert = request.kind === 'alert';
  const confirmLabel = request.confirmLabel || (isAlert ? 'OK' : 'Confirmer');
  const cancelLabel = request.cancelLabel || 'Annuler';

  useEffect(() => {
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    window.setTimeout(() => {
      if (isPrompt && inputRef.current) {
        inputRef.current.focus();
        inputRef.current.select();
        return;
      }
      const focusable = panelRef.current?.querySelector(FOCUSABLE_SELECTOR);
      if (focusable instanceof HTMLElement) {
        focusable.focus();
      } else {
        panelRef.current?.focus();
      }
    }, 0);

    return () => {
      restoreFocusRef.current?.focus?.();
    };
  }, [isPrompt]);

  const resolveConfirm = () => {
    onResolve(isPrompt ? inputValue : true);
  };

  const resolveCancel = () => {
    onResolve(getFallbackResult(request.kind));
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      resolveCancel();
      return;
    }

    if (event.key === 'Enter' && isPrompt && event.target === inputRef.current) {
      event.preventDefault();
      resolveConfirm();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusableElements = Array.from(panelRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [])
      .filter((element) => element instanceof HTMLElement && !element.hasAttribute('disabled'));
    if (!focusableElements.length) {
      event.preventDefault();
      panelRef.current?.focus();
      return;
    }

    const first = focusableElements[0];
    const last = focusableElements[focusableElements.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div
      className="accessible-dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={request.message ? descriptionId : undefined}
      onKeyDown={handleKeyDown}
    >
      <section
        ref={panelRef}
        className={`accessible-dialog-panel ${request.variant === 'danger' ? 'is-danger' : ''}`}
        tabIndex={-1}
      >
        <div className="accessible-dialog-copy">
          <h2 id={titleId}>{request.title || 'Confirmation'}</h2>
          {request.message ? (
            <div id={descriptionId} className="accessible-dialog-message">
              {lines.map((line, index) => (
                <p key={`${line}-${index}`}>{line || '\u00a0'}</p>
              ))}
            </div>
          ) : null}
        </div>

        {isPrompt ? (
          <label className="accessible-dialog-field">
            <span>{request.inputLabel || request.title || 'Valeur'}</span>
            <input
              ref={inputRef}
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
            />
          </label>
        ) : null}

        <div className="accessible-dialog-actions">
          {!isAlert ? (
            <button type="button" className="secondary-action" onClick={resolveCancel}>
              {cancelLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={request.variant === 'danger' ? 'danger-button' : ''}
            onClick={resolveConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export function useAccessibleDialog() {
  const [request, setRequest] = useState(null);
  const resolverRef = useRef(null);

  const resolveCurrent = useCallback((result) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setRequest(null);
  }, []);

  const openDialog = useCallback((nextRequest) => new Promise((resolve) => {
    if (resolverRef.current && request) {
      resolverRef.current(getFallbackResult(request.kind));
    }
    resolverRef.current = resolve;
    setRequest(nextRequest);
  }), [request]);

  const confirm = useCallback((options = {}) => openDialog({
    kind: 'confirm',
    ...options,
  }), [openDialog]);

  const alert = useCallback((options = {}) => openDialog({
    kind: 'alert',
    confirmLabel: 'OK',
    ...options,
  }), [openDialog]);

  const prompt = useCallback((options = {}) => openDialog({
    kind: 'prompt',
    ...options,
  }), [openDialog]);

  const dialog = request ? (
    <DialogPanel request={request} onResolve={resolveCurrent} />
  ) : null;

  return {
    alert,
    confirm,
    dialog,
    prompt,
  };
}
