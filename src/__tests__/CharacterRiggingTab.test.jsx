import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CharacterRiggingTab from '../components/CharacterRiggingTab.jsx';

vi.mock('../components/rpg3d/Character3DPreview.jsx', () => ({
  default: ({
    children,
    model,
    playEmbeddedAnimations,
    onAnimationClipsLoaded,
    characterRigMarkers,
    onCharacterRigMarkerChange,
    onCharacterRigMarkerSelect,
    cameraZoomDragEnabled,
    onCameraZoomChange,
    initialCameraZoom,
    cameraView,
  }) => {
    React.useEffect(() => {
      onAnimationClipsLoaded?.(model?.id || '', model?.embeddedAnimationClips || []);
    }, [model?.id, model?.embeddedAnimationClips, onAnimationClipsLoaded]);
    return (
      <div
        data-testid="character-preview"
        data-marker-count={characterRigMarkers?.length || 0}
        data-model-id={model?.id || ''}
        data-play-embedded={String(playEmbeddedAnimations)}
        data-camera-zoom-enabled={String(cameraZoomDragEnabled)}
        data-initial-camera-zoom={String(initialCameraZoom)}
        data-camera-view={cameraView || ''}
        data-selected-marker-ids={(characterRigMarkers || []).filter((marker) => marker.selected).map((marker) => marker.id).join(',')}
      >
        {children}
        <button
          type="button"
          onClick={() => onCharacterRigMarkerChange?.('right-hand', {
            enabled: true,
            x: 0.82,
            y: 0.5,
            z: 0.7,
          })}
        >
          Move right hand
        </button>
        <button
          type="button"
          onClick={() => onCharacterRigMarkerSelect?.('left-hand')}
        >
          Select left hand
        </button>
        <button
          type="button"
          onClick={() => onCameraZoomChange?.(165)}
        >
          Report zoom
        </button>
      </div>
    );
  },
}));

const makeProject = (modelOverrides = {}) => ({
  characterModels3d: [{
    id: 'hero-model',
    name: 'Hero test',
    modelUrl: 'blob:hero-model',
    modelFormat: 'glb',
    ...modelOverrides,
  }],
});

afterEach(() => {
  cleanup();
});

describe('CharacterRiggingTab', () => {
  it('updates character rig points from preview marker movement', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <CharacterRiggingTab
        project={makeProject()}
        patchProject={patchProject}
      />,
    );

    const preview = await screen.findByTestId('character-preview');
    expect(preview.getAttribute('data-model-id')).toBe('hero-model');
    expect(preview.getAttribute('data-play-embedded')).toBe('false');
    await waitFor(() => expect(preview.getAttribute('data-marker-count')).toBe('17'));
    await waitFor(() => expect(preview.getAttribute('data-selected-marker-ids')).toBe('right-hand'));
    expect(screen.queryByLabelText('Legende des pastilles')).toBeNull();
    expect(screen.getByRole('button', { name: 'Aide pastilles' })).toBeTruthy();
    expect(screen.getByLabelText('Zoom actuel').textContent).toBe('100%');
    expect(preview.getAttribute('data-initial-camera-zoom')).toBe('1.55');
    expect(preview.getAttribute('data-camera-view')).toBe('north');
    const symmetryAxis = document.querySelector('.character-rigging-symmetry-guide');
    expect(symmetryAxis).toBeTruthy();
    expect(symmetryAxis.getAttribute('data-axis-percent')).toBe('50');
    expect(screen.getByRole('group', { name: 'Axe de symetrie' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "Deplacer l'axe de symetrie vers la gauche" })).toBeTruthy();
    const moveAxisRight = screen.getByRole('button', { name: "Deplacer l'axe de symetrie vers la droite" });
    expect(moveAxisRight).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Activer la symetrie des pastilles' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Vues NESO' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Voir de face' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Voir le cote droit' }));

    await waitFor(() => expect(preview.getAttribute('data-camera-view')).toBe('east'));
    expect(screen.getByRole('button', { name: 'Voir le cote droit' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Select left hand' }));

    await waitFor(() => expect(preview.getAttribute('data-selected-marker-ids')).toBe('left-hand'));
    expect(screen.getByRole('option', { name: /Poignet gauche/ }).className).toContain('selected');

    for (let index = 0; index < 5; index += 1) {
      fireEvent.click(moveAxisRight);
    }

    await waitFor(() => expect(symmetryAxis.getAttribute('data-axis-percent')).toBe('60'));

    fireEvent.click(screen.getByRole('button', { name: 'Activer la symetrie des pastilles' }));

    expect(screen.getByRole('button', { name: 'Desactiver la symetrie des pastilles' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Move right hand' }));

    expect(patchProject).toHaveBeenCalled();
    await waitFor(() => expect(preview.getAttribute('data-selected-marker-ids')).toBe('right-hand'));
    const rightHand = patchedProject.characterModels3d[0].characterRigPoints
      .find((point) => point.id === 'right-hand');
    expect(rightHand).toMatchObject({
      enabled: true,
      x: 0.82,
      y: 0.5,
      z: 0.7,
    });
    const leftHand = patchedProject.characterModels3d[0].characterRigPoints
      .find((point) => point.id === 'left-hand');
    expect(leftHand).toMatchObject({
      enabled: true,
      x: 0.38,
      y: 0.5,
      z: 0.7,
    });
  });

  it('adds a map-style mouse zoom control to the rig canvas', async () => {
    render(
      <CharacterRiggingTab
        project={makeProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');
    expect(preview.getAttribute('data-camera-zoom-enabled')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Activer le zoom souris' }));

    await waitFor(() => expect(preview.getAttribute('data-camera-zoom-enabled')).toBe('true'));
    expect(screen.getByRole('button', { name: 'Desactiver le zoom souris' }).getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Report zoom' }));

    expect(screen.getByLabelText('Zoom actuel').textContent).toBe('165%');
  });

  it('opens a 2D humanoid help popup with correctly placed marker examples', async () => {
    render(
      <CharacterRiggingTab
        project={makeProject()}
        patchProject={vi.fn()}
      />,
    );

    await screen.findByTestId('character-preview');

    fireEvent.click(screen.getByRole('button', { name: 'Aide pastilles' }));

    expect(screen.getByRole('dialog', { name: 'Aide pastilles' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Humanoid 2D exemple pastilles' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Mains exemple pastilles phalanges' })).toBeTruthy();
    const helpImages = [...document.querySelectorAll('.character-rigging-help-image')].map((image) => image.getAttribute('src'));
    expect(helpImages).toContain('/assets/character-rig-help-humanoid.png');
    expect(helpImages).toContain('/assets/character-rig-help-hands.png');
    expect(document.querySelectorAll('.character-rigging-help-body-marker').length).toBe(17);
    expect(document.querySelectorAll('.character-rigging-help-marker.finger').length).toBe(40);
    expect(screen.queryByRole('button', { name: 'Reinitialiser les pastilles' })).toBeNull();
    const helpLegend = screen.getByLabelText('Legende de pastilles');
    expect(helpLegend).toBeTruthy();
    expect(screen.getByText('Legende de pastilles')).toBeTruthy();
    expect(screen.getAllByText((_, element) => element?.textContent === 'POD = Poignet droit').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'POG = Poignet gauche').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'ED = Epaule droite').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'CO = Cou').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'BO = Bouche').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'BA = Bassin').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'AD = Aine droite').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'AG = Aine gauche').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'GD = Genou droit').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'GG = Genou gauche').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'CHD = Cheville droite').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'CHG = Cheville gauche').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'PD = Pied droit').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'PG = Pied gauche').length).toBeGreaterThan(0);
    expect(screen.getAllByText((_, element) => element?.textContent === 'Mains = pastilles des phalanges').length).toBeGreaterThan(0);
    expect(helpLegend.textContent).not.toContain('Arme');
    expect(helpLegend.textContent).not.toContain('Bouclier');
    expect(helpLegend.textContent).not.toContain('Armure');
    expect(helpLegend.textContent).not.toContain('Phalanges');

    fireEvent.click(screen.getByRole('button', { name: "Fermer l'aide pastilles" }));

    expect(screen.queryByRole('dialog', { name: 'Aide pastilles' })).toBeNull();
  });

  it('switches the canvas to phalange markers and back to body markers', async () => {
    render(
      <CharacterRiggingTab
        project={makeProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('character-preview');
    await waitFor(() => expect(preview.getAttribute('data-marker-count')).toBe('17'));
    expect(screen.getByText('Cou')).toBeTruthy();
    expect(screen.getByText('Bouche')).toBeTruthy();
    expect(screen.getByText('Aine droite')).toBeTruthy();
    expect(screen.getByText('Aine gauche')).toBeTruthy();
    expect(screen.getByText('Genou droit')).toBeTruthy();
    expect(screen.getByText('Genou gauche')).toBeTruthy();
    expect(screen.getByText('Cheville droite')).toBeTruthy();
    expect(screen.getByText('Cheville gauche')).toBeTruthy();
    expect(screen.getByText('Pied droit')).toBeTruthy();
    expect(screen.getByText('Pied gauche')).toBeTruthy();
    expect(document.querySelector('.character-rigging-axis-grid')).toBeNull();
    expect(document.querySelector('.character-rigging-row.weapon')).toBeTruthy();
    expect(document.querySelector('.character-rigging-row.shield')).toBeTruthy();
    expect(document.querySelector('.character-rigging-row.armor')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Phalanges' }));

    await waitFor(() => expect(preview.getAttribute('data-marker-count')).toBe('4'));
    await waitFor(() => expect(preview.getAttribute('data-selected-marker-ids')).toBe('right-phalange-index-1'));
    const phalangeSelector = screen.getByRole('group', { name: 'Selection phalanges' });
    expect(phalangeSelector).toBeTruthy();
    expect(phalangeSelector.closest('.character-rigging-list-panel')).toBeTruthy();
    expect(phalangeSelector.closest('.character-rigging-side-tools')).toBeNull();
    expect(screen.getByLabelText('Focus phalanges').textContent).toBe('Droite / Index - 1 Base - 2 Milieu - 3 Bout - 4 Pointe');
    expect(screen.getByText('Droite - Index - Base')).toBeTruthy();
    expect(screen.getByText('Droite - Index - Milieu')).toBeTruthy();
    expect(screen.getByText('Droite - Index - Bout')).toBeTruthy();
    expect(screen.getByText('Droite - Index - Pointe')).toBeTruthy();
    expect(document.querySelector('.character-rigging-row.finger')).toBeTruthy();

    fireEvent.click(screen.getByRole('option', { name: /Droite - Index - Milieu/ }));

    await waitFor(() => expect(preview.getAttribute('data-selected-marker-ids')).toBe('right-phalange-index-2'));
    expect(screen.getByRole('option', { name: /Droite - Index - Milieu/ }).className).toContain('selected');

    fireEvent.click(screen.getByRole('button', { name: 'Gauche' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pouce' }));

    await waitFor(() => expect(preview.getAttribute('data-marker-count')).toBe('4'));
    await waitFor(() => expect(preview.getAttribute('data-selected-marker-ids')).toBe('left-phalange-thumb-1'));
    expect(screen.getByLabelText('Focus phalanges').textContent).toBe('Gauche / Pouce - 1 Base - 2 Milieu - 3 Bout - 4 Pointe');
    expect(screen.getByText('Gauche - Pouce - Base')).toBeTruthy();
    expect(screen.getByText('Gauche - Pouce - Bout')).toBeTruthy();
    expect(screen.getByText('Gauche - Pouce - Pointe')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Corps' }));

    await waitFor(() => expect(preview.getAttribute('data-marker-count')).toBe('17'));
  });

  it('allows rig editing when the character has external animation files', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject({
        modelAnimations: {
          walk: { modelUrl: 'blob:walk', modelName: 'walk.fbx', modelFormat: 'fbx' },
        },
      });
      updater(draft);
      patchedProject = draft;
    });

    render(
      <CharacterRiggingTab
        project={makeProject({
          modelAnimations: {
            walk: { modelUrl: 'blob:walk', modelName: 'walk.fbx', modelFormat: 'fbx' },
          },
        })}
        patchProject={patchProject}
      />,
    );

    const preview = await screen.findByTestId('character-preview');
    expect(preview.getAttribute('data-marker-count')).toBe('17');
    expect(screen.queryByText('Modele anime bloque')).toBeNull();
    expect(screen.getByRole('button', { name: 'Activer tout' }).disabled).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Move right hand' }));

    expect(patchProject).toHaveBeenCalled();
    const rightHand = patchedProject.characterModels3d[0].characterRigPoints
      .find((point) => point.id === 'right-hand');
    expect(rightHand).toMatchObject({ enabled: true, x: 0.82, y: 0.5, z: 0.7 });
  });

  it('allows rig editing when the character GLB embeds animation clips', async () => {
    const project = makeProject({
      embeddedAnimationClips: [{ name: 'Idle', duration: 1, trackCount: 8 }],
    });
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject({
        embeddedAnimationClips: [{ name: 'Idle', duration: 1, trackCount: 8 }],
      });
      updater(draft);
      patchedProject = draft;
    });

    render(
      <CharacterRiggingTab
        project={project}
        patchProject={patchProject}
      />,
    );

    const preview = await screen.findByTestId('character-preview');
    await waitFor(() => expect(preview.getAttribute('data-marker-count')).toBe('17'));
    expect(screen.queryByText('Modele anime bloque')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Move right hand' }));

    expect(patchProject).toHaveBeenCalled();
    const rightHand = patchedProject.characterModels3d[0].characterRigPoints
      .find((point) => point.id === 'right-hand');
    expect(rightHand).toMatchObject({ enabled: true, x: 0.82, y: 0.5, z: 0.7 });
  });
});
