import { useEffect, useRef, useState } from 'react';
import {
  doRectsOverlap,
  getFakeWindowImageOptions,
  getTutorialInputField,
  getTutorialInputValue,
  isTutorialStepComplete,
  makeTutorialFileIconDataUrl,
  makeTutorialImageDataUrl,
  personalizeTutorialText,
} from '../data/tutorialSteps';

export default function BuilderTutorial({ step, stepNumber, totalSteps, canPrevious, userName, project, fakeFileOptions, onFakeFileChosen, onNext, onPrevious, onClose }) {
  const bubbleRef = useRef(null);
  const [targetRect, setTargetRect] = useState(null);
  const [bubbleSize, setBubbleSize] = useState({ width: 340, height: 260 });
  const [interactedSteps, setInteractedSteps] = useState(() => new Set());
  const [isStepComplete, setIsStepComplete] = useState(() => isTutorialStepComplete(step, new Set(), project));
  const [fakeFileName, setFakeFileName] = useState('');
  const [isFakeWindowOpen, setIsFakeWindowOpen] = useState(false);
  const autoNextStepRef = useRef('');
  const autoNextTimerRef = useRef(null);

  useEffect(() => {
    if (!step) return undefined;
    setFakeFileName('');
    setIsFakeWindowOpen(false);
    autoNextStepRef.current = '';
    if (autoNextTimerRef.current) {
      window.clearTimeout(autoNextTimerRef.current);
      autoNextTimerRef.current = null;
    }
    let frame = 0;

    const updateTarget = () => {
      document.querySelectorAll('.tutorial-focus, .tutorial-focus-positioned').forEach((entry) => {
        entry.classList.remove('tutorial-focus', 'tutorial-focus-positioned');
      });
      const target = document.querySelector(step.selector) || (step.fallbackSelector ? document.querySelector(step.fallbackSelector) : null);
      if (!(target instanceof HTMLElement)) {
        setTargetRect(null);
        return;
      }

      target.classList.add('tutorial-focus');
      if (window.getComputedStyle(target).position === 'static') {
        target.classList.add('tutorial-focus-positioned');
      }
      target.scrollIntoView({ block: 'center', inline: 'center', behavior: 'smooth' });
      frame = requestAnimationFrame(() => {
        const rect = target.getBoundingClientRect();
        const openEffectMenu = target.querySelector('.visual-effect-cascade.open .visual-effect-cascade__menu');
        const openEffectSubmenu = target.querySelector('.visual-effect-cascade.open .visual-effect-cascade__submenu');
        const rects = [rect, openEffectMenu?.getBoundingClientRect?.(), openEffectSubmenu?.getBoundingClientRect?.()]
          .filter((entry) => entry?.width && entry?.height);
        const focusRect = rects.reduce((acc, entry) => ({
          top: Math.min(acc.top, entry.top),
          left: Math.min(acc.left, entry.left),
          right: Math.max(acc.right, entry.right),
          bottom: Math.max(acc.bottom, entry.bottom),
        }), {
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
        });
        setTargetRect({
          top: Math.max(8, focusRect.top - 8),
          left: Math.max(8, focusRect.left - 8),
          width: (focusRect.right - focusRect.left) + 16,
          height: (focusRect.bottom - focusRect.top) + 16,
        });
        if (step.completeWhen?.type === 'input-min') {
          const field = getTutorialInputField(step.completeWhen.selector);
          if (field instanceof HTMLElement) {
            field.focus({ preventScroll: true });
            if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
              field.select();
            }
          }
        }
      });
    };

    const timer = window.setTimeout(updateTarget, 80);
    const updateAfterUiChange = () => window.setTimeout(updateTarget, 80);
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    document.addEventListener('click', updateAfterUiChange, true);
    document.addEventListener('pointerdown', updateAfterUiChange, true);

    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(frame);
      document.querySelectorAll('.tutorial-focus, .tutorial-focus-positioned').forEach((entry) => {
        entry.classList.remove('tutorial-focus', 'tutorial-focus-positioned');
      });
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
      document.removeEventListener('click', updateAfterUiChange, true);
      document.removeEventListener('pointerdown', updateAfterUiChange, true);
    };
  }, [step]);

  useEffect(() => {
    if (!step) return undefined;

    const markInteracted = (event) => {
      const target = document.querySelector(step.selector) || (step.fallbackSelector ? document.querySelector(step.fallbackSelector) : null);
      if (!(target instanceof HTMLElement) || !target.contains(event.target)) return;
      if (step.preventTargetAction) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (step.completeWhen?.type === 'fake-file') {
        event.preventDefault();
        event.stopPropagation();
        setIsFakeWindowOpen(true);
      }
      setInteractedSteps((previous) => {
        const next = new Set(previous);
        next.add(step.selector);
        return next;
      });
      if (step.completeWhen?.type === 'interact') {
        window.setTimeout(onNext, 140);
      }
    };

    const updateCompletion = () => {
      const complete = isTutorialStepComplete(step, interactedSteps, project);
      setIsStepComplete(complete);
      if (complete && step.autoNext) {
        const autoKey = `${step.selector}:${step.title}`;
        if (autoNextStepRef.current !== autoKey) {
          autoNextStepRef.current = autoKey;
          autoNextTimerRef.current = window.setTimeout(onNext, 180);
        }
      }
    };

    const handleEnterToContinue = (event) => {
      if (event.key !== 'Enter' || step.completeWhen?.type !== 'input-min') return;
      const field = getTutorialInputField(step.completeWhen.selector);
      if (!(field instanceof HTMLElement) || event.target !== field) return;
      const isCompleteNow = isTutorialStepComplete(step, interactedSteps, project);
      setIsStepComplete(isCompleteNow);
      if (!isCompleteNow) return;
      event.preventDefault();
      event.stopPropagation();
      onNext();
    };

    document.addEventListener('pointerdown', markInteracted, true);
    document.addEventListener('click', markInteracted, true);
    document.addEventListener('input', updateCompletion, true);
    document.addEventListener('change', updateCompletion, true);
    document.addEventListener('keydown', handleEnterToContinue, true);
    document.addEventListener('toggle', updateCompletion, true);
    const timer = window.setInterval(updateCompletion, 250);
    updateCompletion();

    return () => {
      document.removeEventListener('pointerdown', markInteracted, true);
      document.removeEventListener('click', markInteracted, true);
      document.removeEventListener('input', updateCompletion, true);
      document.removeEventListener('change', updateCompletion, true);
      document.removeEventListener('keydown', handleEnterToContinue, true);
      document.removeEventListener('toggle', updateCompletion, true);
      window.clearInterval(timer);
      if (autoNextTimerRef.current) {
        window.clearTimeout(autoNextTimerRef.current);
        autoNextTimerRef.current = null;
      }
    };
  }, [step, interactedSteps, project, onNext]);

  useEffect(() => {
    if (!step) return undefined;
    document.body.classList.add('tutorial-active');
    return () => {
      document.body.classList.remove('tutorial-active');
    };
  }, [step]);

  useEffect(() => {
    if (!step) return undefined;
    const frame = requestAnimationFrame(() => {
      const rect = bubbleRef.current?.getBoundingClientRect?.();
      if (!rect?.width || !rect?.height) return;
      setBubbleSize({ width: rect.width, height: rect.height });
    });
    return () => cancelAnimationFrame(frame);
  }, [step, isStepComplete, isFakeWindowOpen, fakeFileName, targetRect]);

  if (!step) return null;

  const margin = 14;
  const isWritingStep = step.completeWhen?.type === 'input-min';
  const bubbleWidth = Math.min(isWritingStep ? 320 : 340, Math.max(260, window.innerWidth - 24));
  const isLastStep = stepNumber === totalSteps;
  const resultSelector = step.completeWhen?.selector;
  const currentResult = step.completeWhen?.type === 'input-min' ? getTutorialInputValue(resultSelector).trim() : '';
  const showFakeWindow = step.completeWhen?.type === 'fake-file' && isFakeWindowOpen;
  const isTabTarget = String(step.selector || '').includes('data-tour-tab');
  const isSceneCanvasTarget = step.selector === '[data-tour="scene-canvas"]';
  const isMapBoardTarget = step.selector === '[data-tour="map-board"]';
  const estimatedBubbleHeight = step.completeWhen?.type === 'fake-file'
    ? (showFakeWindow ? 620 : 430)
    : isWritingStep
      ? 360
      : 360;
  const measuredHeight = bubbleSize.height && bubbleSize.height < window.innerHeight - 80
    ? bubbleSize.height
    : estimatedBubbleHeight;
  const minimumPlacementHeight = step.completeWhen?.type === 'fake-file'
    ? (showFakeWindow ? 560 : 420)
    : 360;
  const bubbleHeight = Math.min(Math.max(measuredHeight || estimatedBubbleHeight, minimumPlacementHeight), window.innerHeight - 24);
  const clampBubbleLeft = (left) => Math.max(12, Math.min(left, window.innerWidth - bubbleWidth - 12));
  const clampBubbleTop = (top) => Math.max(12, Math.min(top, window.innerHeight - bubbleHeight - 12));
  const bubblePosition = (() => {
    if (!targetRect) {
      return {
        left: clampBubbleLeft((window.innerWidth - bubbleWidth) / 2),
        top: 120,
      };
    }

    const centerLeft = targetRect.left + (targetRect.width / 2) - (bubbleWidth / 2);
    const roomBelow = window.innerHeight - targetRect.bottom - margin - 12;
    const roomAbove = targetRect.top - margin - 12;
    const centerTop = targetRect.top + (targetRect.height / 2) - (bubbleHeight / 2);
    const roomRight = window.innerWidth - targetRect.right - margin - 12;
    const roomLeft = targetRect.left - margin - 12;
    if (isMapBoardTarget) {
      const toolsRect = document.querySelector('.route-map-tools')?.getBoundingClientRect?.();
      const preferredLeft = toolsRect ? toolsRect.left + 12 : 24;
      const preferredTop = toolsRect ? toolsRect.top + 12 : Math.max(12, targetRect.top + 16);
      return {
        left: clampBubbleLeft(preferredLeft),
        top: clampBubbleTop(preferredTop),
      };
    }
    if (isSceneCanvasTarget) {
      const sidebarRect = document.querySelector('.panel-nav-pro')?.getBoundingClientRect?.();
      const preferredLeft = sidebarRect ? sidebarRect.left + 12 : 24;
      const preferredTop = Math.max(12, targetRect.top + 16);
      return {
        left: clampBubbleLeft(preferredLeft),
        top: clampBubbleTop(preferredTop),
      };
    }
    if (isTabTarget) {
      const tabsRect = document.querySelector('.tabs')?.getBoundingClientRect?.();
      const tabAnchorBottom = tabsRect?.bottom || targetRect.bottom;
      return {
        left: clampBubbleLeft(centerLeft),
        top: Math.max(12, tabAnchorBottom + margin),
      };
    }
    if (isWritingStep && roomRight >= bubbleWidth) {
      return {
        left: targetRect.right + margin,
        top: clampBubbleTop(centerTop),
      };
    }
    if (isWritingStep && roomLeft >= bubbleWidth) {
      return {
        left: targetRect.left - bubbleWidth - margin,
        top: clampBubbleTop(centerTop),
      };
    }
    if (roomBelow >= bubbleHeight) {
      return {
        left: clampBubbleLeft(centerLeft),
        top: targetRect.bottom + margin,
      };
    }
    if (roomAbove >= bubbleHeight) {
      return {
        left: clampBubbleLeft(centerLeft),
        top: targetRect.top - bubbleHeight - margin,
      };
    }
    if (roomRight >= bubbleWidth) {
      return {
        left: targetRect.right + margin,
        top: clampBubbleTop(centerTop),
      };
    }
    if (roomLeft >= bubbleWidth) {
      return {
        left: targetRect.left - bubbleWidth - margin,
        top: clampBubbleTop(centerTop),
      };
    }
    const shouldPlaceBelow = roomBelow >= roomAbove;
    const fallback = {
      left: clampBubbleLeft(centerLeft),
      top: shouldPlaceBelow
        ? clampBubbleTop(targetRect.bottom + margin)
        : clampBubbleTop(targetRect.top - bubbleHeight - margin),
    };
    const fallbackRect = { ...fallback, width: bubbleWidth, height: bubbleHeight };
    if (!doRectsOverlap(fallbackRect, targetRect, 12)) return fallback;

    const cornerCandidates = [
      { left: 12, top: 12 },
      { left: window.innerWidth - bubbleWidth - 12, top: 12 },
      { left: 12, top: window.innerHeight - bubbleHeight - 12 },
      { left: window.innerWidth - bubbleWidth - 12, top: window.innerHeight - bubbleHeight - 12 },
    ].map((candidate) => ({
      left: clampBubbleLeft(candidate.left),
      top: clampBubbleTop(candidate.top),
    }));
    return cornerCandidates.find((candidate) => (
      !doRectsOverlap({ ...candidate, width: bubbleWidth, height: bubbleHeight }, targetRect, 12)
    )) || fallback;
  })();

  return (
    <div className="tutorial-layer" role="dialog" aria-modal="true" aria-label="Didacticiel du builder">
      {step.celebration ? (
        <div className="tutorial-confetti" aria-hidden="true">
          {Array.from({ length: 48 }).map((_, index) => (
            <span key={index} style={{
              '--confetti-left': `${(index * 17) % 100}%`,
              '--confetti-delay': `${-(index % 12) * 0.18}s`,
              '--confetti-color': ['#facc15', '#38bdf8', '#fb7185', '#4ade80', '#a78bfa', '#f97316'][index % 6],
              '--confetti-rotate': `${(index * 37) % 180}deg`,
            }} />
          ))}
        </div>
      ) : null}
      {targetRect ? (
        <>
          <div className="tutorial-blocker" style={{ top: 0, left: 0, right: 0, height: targetRect.top }} />
          <div className="tutorial-blocker" style={{ top: targetRect.top + targetRect.height, left: 0, right: 0, bottom: 0 }} />
          <div className="tutorial-blocker" style={{ top: targetRect.top, left: 0, width: targetRect.left, height: targetRect.height }} />
          <div className="tutorial-blocker" style={{ top: targetRect.top, left: targetRect.left + targetRect.width, right: 0, height: targetRect.height }} />
          <div className="tutorial-highlight" style={targetRect} aria-hidden="true" />
        </>
      ) : <div className="tutorial-blocker full" />}

      <aside
        ref={bubbleRef}
        className="tutorial-bubble"
        style={{
          left: bubblePosition.left,
          top: bubblePosition.top,
          width: bubbleWidth,
          maxHeight: `calc(100vh - ${Math.max(24, Math.round(bubblePosition.top + 12))}px)`,
        }}
      >
        <span className="section-kicker">Didacticiel {stepNumber}/{totalSteps}</span>
        <h3>{personalizeTutorialText(step.title, userName)}</h3>
        <p>{personalizeTutorialText(step.body, userName)}</p>
        {step.action ? (
          <p className={`tutorial-required-action ${isStepComplete ? 'done' : ''}`}>
            {isStepComplete ? 'Parfait, on continue.' : personalizeTutorialText(step.action, userName)}
          </p>
        ) : null}
        {isStepComplete && currentResult ? (
          <div className="tutorial-result-box">
            <span>Resultat</span>
            <strong>{currentResult}</strong>
          </div>
        ) : null}
        {step.completeWhen?.type === 'fake-file' && !isFakeWindowOpen ? (
          <p className="tutorial-click-hint">Clique sur le bouton importeÌ en surbrillance. La fausse fenÃªtre sâ€™ouvrira ensuite.</p>
        ) : null}
        {showFakeWindow ? (
          <div className="fake-windows-picker" role="group" aria-label="Fausse fenetre Windows">
            <div className="fake-windows-titlebar">
              <span>{step.completeWhen?.target === 'scene-music' ? 'Choisir une musique' : 'Choisir une image'}</span>
              <span aria-hidden="true">_ â–¡ Ã—</span>
            </div>
            <div className="fake-windows-path">
              {step.completeWhen?.target === 'scene-music' ? 'Ce PC > Musique > Exemples' : 'Ce PC > Images > Exemples'}
            </div>
            <div className="fake-windows-files">
              {(fakeFileOptions?.length ? fakeFileOptions : getFakeWindowImageOptions()).map((file) => (
                <button
                  key={file.name}
                  type="button"
                  className={fakeFileName === file.name ? 'selected' : ''}
                  onClick={() => {
                    setFakeFileName(file.name);
                    setInteractedSteps((previous) => {
                      const next = new Set(previous);
                      next.add(`fake-file:${step.selector}`);
                      return next;
                    });
                    onFakeFileChosen?.({
                      name: file.name,
                      dataUrl: file.dataUrl || makeTutorialImageDataUrl(file.label, file.color),
                      target: step.completeWhen?.target || 'object',
                    });
                  }}
                >
                  <img
                    src={step.completeWhen?.target === 'scene-music' ? makeTutorialFileIconDataUrl('Audio', '#0f766e') : (file.dataUrl || makeTutorialImageDataUrl(file.label, file.color))}
                    alt=""
                  />
                  <span>{file.name}</span>
                </button>
              ))}
            </div>
            {fakeFileName ? (
              <div className="tutorial-result-box">
                <span>Image choisie</span>
                <strong>{fakeFileName}</strong>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="tutorial-actions">
          <button type="button" className="secondary-action" onClick={onClose}>Quitter</button>
          <button type="button" className="secondary-action" onClick={onPrevious} disabled={!canPrevious}>Retour</button>
          <button type="button" onClick={onNext} disabled={!isStepComplete}>{isLastStep ? 'Terminer' : 'Suivant'}</button>
        </div>
      </aside>
    </div>
  );
}
