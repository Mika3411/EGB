import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import BuilderGuide, { getTutorialTarget } from '../app/tutorial/BuilderGuide.jsx';

const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

const setViewport = (width, height) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
};

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
  if (originalScrollIntoView) {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    delete HTMLElement.prototype.scrollIntoView;
  }
});

describe('BuilderGuide ciblage et placement', () => {
  test('prefere la vraie action de la modale media quand elle est presente', () => {
    document.body.innerHTML = `
      <button data-tour="media-background-image">Importer une image</button>
      <button data-tour="media-source-computer">Mon ordinateur</button>
    `;

    const target = getTutorialTarget({
      selector: '[data-tour="media-background-image"]',
      preferredSelectors: ['[data-tour="media-source-computer"]'],
    });

    expect(target?.textContent).toBe('Mon ordinateur');
  });

  test('place la bulle a cote du bouton Mon ordinateur quand la modale media est ouverte', async () => {
    setViewport(1380, 760);
    HTMLElement.prototype.scrollIntoView = vi.fn();
    document.body.innerHTML = '<button data-tour="media-source-computer">Mon ordinateur</button>';
    const computerButton = document.querySelector('[data-tour="media-source-computer"]');
    computerButton.getBoundingClientRect = () => ({
      top: 240,
      left: 510,
      right: 805,
      bottom: 300,
      width: 295,
      height: 60,
      x: 510,
      y: 240,
      toJSON: () => {},
    });

    render(
      <BuilderGuide
        step={{
          selector: '[data-tour="media-background-image"]',
          preferredSelectors: ['[data-tour="media-source-computer"]'],
          title: 'Photo de la scene',
          body: 'Choisis une image.',
          action: 'Clique sur Mon ordinateur.',
        }}
        stepNumber={3}
        totalSteps={12}
        canPrevious
        userName=""
        project={{ scenes: [] }}
        onNext={() => {}}
        onPrevious={() => {}}
        onClose={() => {}}
      />,
    );

    await waitFor(() => {
      const bubble = document.querySelector('.tutorial-bubble');
      const highlight = document.querySelector('.tutorial-highlight');
      expect(bubble).toBeTruthy();
      expect(highlight).toBeTruthy();
      expect(Number.parseFloat(bubble.style.left) + Number.parseFloat(bubble.style.width)).toBeLessThan(
        Number.parseFloat(highlight.style.left),
      );
    });
  });
});
