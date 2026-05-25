import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ObjectRiggingTab from '../components/ObjectRiggingTab.jsx';

vi.mock('../components/rpg3d/Decor3DPreview.jsx', () => ({
  default: ({
    armorCanvasCutEnabled,
    armorCutContours = [],
    armorCutPaintStrokes = [],
    armorPaintBrushRadius,
    armorPaintDrawEnabled,
    cameraZoomDragEnabled,
    armorCutManipulationEnabled,
    armorGripMarkers = [],
    children,
    model,
    onArmorCutContourChange,
    onArmorCutPaintChange,
    onArmorGripMarkerChange,
    onCameraZoomChange,
    onRigMeshPick,
    rigMeshPickEnabled,
  }) => (
    <div
      data-testid="decor-preview"
      data-armor-markers={armorGripMarkers.length}
      data-canvas-cut={armorCanvasCutEnabled ? 'true' : 'false'}
      data-contour-count={armorCutContours.reduce((count, entry) => count + (entry.points?.length || 0), 0)}
      data-paint-count={armorCutPaintStrokes.reduce((count, entry) => count + (entry.points?.length || 0), 0)}
      data-brush-radius={armorPaintBrushRadius}
      data-zoom-enabled={cameraZoomDragEnabled ? 'true' : 'false'}
      data-paint-enabled={armorPaintDrawEnabled ? 'true' : 'false'}
      data-manipulation-enabled={armorCutManipulationEnabled ? 'true' : 'false'}
      data-model-id={model?.id || ''}
      data-pick-enabled={rigMeshPickEnabled ? 'true' : 'false'}
    >
      <button type="button" onClick={() => onRigMeshPick?.({ path: '0:chestplate', name: 'ChestPlate' })}>Pick ChestPlate</button>
      <button type="button" onClick={() => onArmorCutContourChange?.('body', { action: 'append', point: { x: 0.1, y: 0.2, z: 0 } })}>Trace body contour</button>
      <button type="button" onClick={() => onArmorCutPaintChange?.('body', { action: 'append', point: { x: 0.1, y: 0.2, z: 0 }, radius: armorPaintBrushRadius })}>Paint body zone</button>
      <button type="button" onClick={() => onArmorCutPaintChange?.('body', { action: 'append', points: [{ x: 0.2, y: 0.1, z: 0 }, { x: 0.25, y: 0.15, z: 0 }], radius: armorPaintBrushRadius })}>Paint body batch</button>
      <button type="button" onClick={() => onCameraZoomChange?.(142)}>Report zoom</button>
      <button type="button" onClick={() => onArmorGripMarkerChange?.('left-shoulder', { x: -0.5, y: 0.6, z: 0 })}>Move left shoulder</button>
      {children}
    </div>
  ),
}));

vi.mock('../utils/threeGltfUtils', async (importOriginal) => {
  const actual = await importOriginal();
  const THREE = await import('three');
  return {
    ...actual,
    getThreeModelSource: (model = {}) => model.modelUrl || model.modelData || '',
    loadThreeModelFromSource: vi.fn((source, model, onLoad) => {
      const object = new THREE.Group();
      object.name = 'RigObject';
      const chestPlate = new THREE.Mesh(
        new THREE.BoxGeometry(1, 1, 1),
        new THREE.MeshBasicMaterial(),
      );
      chestPlate.name = 'ChestPlate';
      object.add(chestPlate);
      const leftPauldron = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.4, 0.4),
        new THREE.MeshBasicMaterial(),
      );
      leftPauldron.name = 'LeftPauldron';
      object.add(leftPauldron);
      onLoad?.({ object });
    }),
  };
});

const makeProject = () => ({
  decorModels3d: [{
    id: 'armor-model',
    kind: 'inventory-armor',
    name: 'Armure test',
    modelUrl: 'blob:armor-model',
    modelFormat: 'glb',
    width: 1,
    depth: 0.5,
    height: 1.4,
  }],
  characterModels3d: [{
    id: 'hero-model',
    name: 'Hero test',
    modelUrl: 'blob:hero-model',
    modelFormat: 'glb',
  }],
});

const makeCutProject = () => {
  const project = makeProject();
  project.decorModels3d[0].armorCanvasCutEnabled = true;
  return project;
};

afterEach(() => {
  cleanup();
});

describe('ObjectRiggingTab', () => {
  it('opens the selected rig object on the selected character', async () => {
    const onTestOnCharacter = vi.fn();

    render(
      <ObjectRiggingTab
        project={makeProject()}
        patchProject={vi.fn()}
        onTestOnCharacter={onTestOnCharacter}
      />,
    );

    const testButton = await screen.findByRole('button', { name: 'Tester sur personnage' });
    const preview = await screen.findByTestId('decor-preview');

    expect(preview.getAttribute('data-model-id')).toBe('armor-model');
    expect(preview.getAttribute('data-armor-markers')).toBe('5');
    expect(preview.getAttribute('data-canvas-cut')).toBe('false');
    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
    expect(screen.queryByText('Animation')).toBeNull();
    expect(screen.queryByText('Deposer ici')).toBeNull();
    fireEvent.click(testButton);

    expect(onTestOnCharacter).toHaveBeenCalledWith({
      decorModelId: 'armor-model',
      characterModelId: 'hero-model',
    });
  });

  it('assigns a clicked canvas mesh to the active armor segment', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeCutProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingTab
        project={makeCutProject()}
        patchProject={patchProject}
      />,
    );

    const leftArmPill = (await screen.findByText('Bras gauche')).closest('button');
    fireEvent.click(leftArmPill);
    fireEvent.click(screen.getByRole('button', { name: 'Pick ChestPlate' }));

    expect(patchProject).toHaveBeenCalled();
    expect(patchedProject.decorModels3d[0].armorSegmentAssignments).toEqual([{
      path: '0:chestplate',
      name: 'ChestPlate',
      segment: 'left-arm',
    }]);
  });

  it('activates the canvas cut from the cut button', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingTab
        project={makeProject()}
        patchProject={patchProject}
      />,
    );

    await screen.findByText('2 morceaux');
    fireEvent.click(screen.getByRole('button', { name: 'Decouper' }));

    expect(patchedProject.decorModels3d[0].armorCanvasCutEnabled).toBe(true);
    expect(patchedProject.decorModels3d[0].armorSegmentAssignments).toHaveLength(2);
  });

  it('updates armor pastilles from the canvas', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingTab
        project={makeProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Move left shoulder' }));

    expect(patchedProject.decorModels3d[0]).toMatchObject({
      kind: 'inventory-armor',
      armorCanvasCutEnabled: true,
      armorGripLeftShoulderEnabled: true,
      armorGripLeftShoulderX: -0.5,
      armorGripLeftShoulderY: 0.6,
      armorGripLeftShoulderZ: 0,
    });
  });

  it('adds a canvas manipulation mode after the armor is cut', async () => {
    render(
      <ObjectRiggingTab
        project={makeCutProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');
    const manipulateButton = screen.getByRole('button', { name: 'Manipuler' });

    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
    expect(preview.getAttribute('data-manipulation-enabled')).toBe('false');
    expect(preview.getAttribute('data-paint-enabled')).toBe('false');
    fireEvent.click(manipulateButton);

    expect(preview.getAttribute('data-pick-enabled')).toBe('false');
    expect(preview.getAttribute('data-manipulation-enabled')).toBe('true');
    expect(screen.getByText('Manipulation active dans le canevas')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Couper' }));

    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
    expect(preview.getAttribute('data-manipulation-enabled')).toBe('false');
  });

  it('stores painted cut points from the canvas', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeCutProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingTab
        project={makeCutProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Peindre zone' }));
    const preview = await screen.findByTestId('decor-preview');

    await waitFor(() => {
      expect(preview.getAttribute('data-paint-enabled')).toBe('true');
      expect(preview.getAttribute('data-pick-enabled')).toBe('false');
      expect(preview.getAttribute('data-brush-radius')).toBe('0.14');
    });

    fireEvent.change(screen.getByLabelText(/Taille pinceau/), { target: { value: '24' } });
    expect(preview.getAttribute('data-brush-radius')).toBe('0.24');
    fireEvent.click(screen.getByRole('button', { name: 'Paint body zone' }));

    expect(patchedProject.decorModels3d[0]).toMatchObject({
      kind: 'inventory-armor',
      armorCanvasCutEnabled: true,
      armorCutPaintStrokes: [{
        segment: 'body',
        radius: 0.24,
        points: [{ x: 0.1, y: 0.2, z: 0 }],
      }],
    });
  });

  it('stores batched paint points from a brush stroke', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeCutProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingTab
        project={makeCutProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Peindre zone' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Paint body batch' }));

    expect(patchedProject.decorModels3d[0].armorCutPaintStrokes[0].points).toEqual([
      { x: 0.2, y: 0.1, z: 0 },
      { x: 0.25, y: 0.15, z: 0 },
    ]);
  });

  it('adds a camera zoom drag mode like the RPG map', async () => {
    render(
      <ObjectRiggingTab
        project={makeCutProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');
    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
    expect(preview.getAttribute('data-zoom-enabled')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Zoom' }));
    expect(preview.getAttribute('data-pick-enabled')).toBe('false');
    expect(preview.getAttribute('data-zoom-enabled')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Report zoom' }));
    expect(screen.getByText('Zoom souris: 142%')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Couper' }));

    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
    expect(preview.getAttribute('data-zoom-enabled')).toBe('false');
  });
});
