import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import BuilderGuide, { getTutorialTarget } from '../app/tutorial/BuilderGuide.jsx';
import SceneCanvasQuickToolbar from '../domains/scenes/studio/components/SceneCanvasQuickToolbar.jsx';

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

  test('cible le menu Action rapide de la zone guidee', async () => {
    const patchLayerItem = vi.fn();

    render(
      <div style={{ position: 'relative', width: 720, height: 420 }}>
        <SceneCanvasQuickToolbar
          selectedScene={{
            id: 'scene-a',
            hotspots: [{
              id: 'hotspot-guide',
              x: 50,
              y: 50,
              width: 20,
              height: 20,
              actionType: 'dialogue',
            }],
            sceneObjects: [],
          }}
          selectedSceneId="scene-a"
          selectedHotspotId="hotspot-guide"
          patchLayerItem={patchLayerItem}
          duplicateSelectedEditorItems={() => {}}
          deleteSelectedEditorItems={() => {}}
          sendLayerToEdge={() => {}}
        />
      </div>,
    );

    const target = getTutorialTarget({ selector: '[data-tour="hotspot-action"]' });
    expect(target).toBeTruthy();
    expect(target?.classList.contains('scene-canvas-toolbar-select')).toBe(true);

    fireEvent.click(screen.getByTitle('Changer action'));
    const sceneOption = await screen.findByRole('option', { name: 'Changer de scène' });
    expect(document.querySelector('[data-tour="hotspot-action-menu"]')).toBeTruthy();
    fireEvent.click(sceneOption);

    expect(patchLayerItem).toHaveBeenCalledWith('hotspot', 'hotspot-guide', expect.any(Function));
    const updatedHotspot = { actionType: 'dialogue' };
    patchLayerItem.mock.calls[0][2](updatedHotspot);
    expect(updatedHotspot.actionType).toBe('scene');
  });
});
