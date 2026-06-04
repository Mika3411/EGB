import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ObjectRiggingWorkspace from '../domains/rpg3d/rigging/ObjectRiggingWorkspace.jsx';
import { loadThreeModelFromSource } from '../shared/utils/threeGltfUtils';

vi.mock('../domains/rpg3d/components/Decor3DPreview.jsx', () => ({
  default: ({
    armorCanvasCutEnabled,
    armorCutContours = [],
    armorCutPaintStrokes = [],
    armorPaintBrushRadius,
    armorPaintDrawEnabled,
    armorSectionToolEnabled,
    cameraZoomDragEnabled,
    armorCutManipulationEnabled,
    armorGripMarkers = [],
    weaponGripMarkers = [],
    shieldGripMarkers = [],
    children,
    model,
    onArmorCutContourChange,
    onArmorCutPaintChange,
    onArmorGripMarkerChange,
    onWeaponGripMarkerChange,
    onShieldGripMarkerChange,
    onCameraZoomChange,
    onRigMeshPick,
    rigMeshPickEnabled,
    showGrid,
  }) => (
    <div
      data-testid="decor-preview"
      data-armor-markers={armorGripMarkers.length}
      data-armor-marker-ids={armorGripMarkers.map((marker) => marker.id).join(',')}
      data-weapon-markers={weaponGripMarkers.length}
      data-weapon-marker-hands={weaponGripMarkers.map((marker) => marker.hand).join(',')}
      data-shield-markers={shieldGripMarkers.length}
      data-shield-marker-ids={shieldGripMarkers.map((marker) => marker.id).join(',')}
      data-canvas-cut={armorCanvasCutEnabled ? 'true' : 'false'}
      data-contour-count={armorCutContours.reduce((count, entry) => count + (entry.points?.length || 0), 0)}
      data-paint-count={armorCutPaintStrokes.reduce((count, entry) => count + (entry.points?.length || 0), 0)}
      data-brush-radius={armorPaintBrushRadius}
      data-zoom-enabled={cameraZoomDragEnabled ? 'true' : 'false'}
      data-paint-enabled={armorPaintDrawEnabled ? 'true' : 'false'}
      data-section-enabled={armorSectionToolEnabled ? 'true' : 'false'}
      data-manipulation-enabled={armorCutManipulationEnabled ? 'true' : 'false'}
      data-model-id={model?.id || ''}
      data-pick-enabled={rigMeshPickEnabled ? 'true' : 'false'}
      data-grid-visible={showGrid === false ? 'false' : 'true'}
    >
      <button type="button" onClick={() => onRigMeshPick?.({ path: '0:chestplate', name: 'ChestPlate' })}>Pick ChestPlate</button>
      <button type="button" onClick={() => onArmorCutContourChange?.('body', { action: 'append', point: { x: 0.1, y: 0.2, z: 0 } })}>Trace body contour</button>
      <button type="button" onClick={() => onArmorCutPaintChange?.('body', { action: 'append', point: { x: 0.1, y: 0.2, z: 0 }, radius: armorPaintBrushRadius })}>Paint body zone</button>
      <button type="button" onClick={() => onArmorCutPaintChange?.('body', { action: 'append', points: [{ x: 0.2, y: 0.1, z: 0 }, { x: 0.25, y: 0.15, z: 0 }], radius: armorPaintBrushRadius })}>Paint body batch</button>
      <button type="button" onClick={() => onCameraZoomChange?.(142)}>Report zoom</button>
      <button type="button" onClick={() => onArmorGripMarkerChange?.('left-shoulder', { x: -0.5, y: 0.6, z: 0 })}>Move left shoulder</button>
      <button type="button" onClick={() => onArmorGripMarkerChange?.('left-knee', { x: -0.24, y: -0.7, z: 0.08 })}>Move left knee</button>
      <button type="button" onClick={() => onWeaponGripMarkerChange?.('right', { x: 0.11, y: -0.42, z: 0.03 })}>Move right hand grip</button>
      <button type="button" onClick={() => onShieldGripMarkerChange?.('hand', { x: -0.12, y: -0.32, z: 0.04 })}>Move shield hand grip</button>
      {children}
    </div>
  ),
}));

vi.mock('../shared/utils/threeGltfUtils', async (importOriginal) => {
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

const makeLeggingsProject = () => ({
  decorModels3d: [{
    id: 'leggings-model',
    kind: 'inventory-leggings',
    name: 'Nouveau jambiere',
    modelUrl: 'blob:leggings-model',
    modelFormat: 'glb',
    width: 0.8,
    depth: 0.4,
    height: 1.1,
  }],
  characterModels3d: [{
    id: 'hero-model',
    name: 'Hero test',
    modelUrl: 'blob:hero-model',
    modelFormat: 'glb',
  }],
});

const makeWeaponProject = () => ({
  decorModels3d: [{
    id: 'weapon-model',
    kind: 'inventory-weapon',
    name: 'epee',
    modelUrl: 'blob:weapon-model',
    modelFormat: 'glb',
    width: 0.2,
    depth: 0.1,
    height: 1.2,
  }],
  characterModels3d: [{
    id: 'hero-model',
    name: 'Hero test',
    modelUrl: 'blob:hero-model',
    modelFormat: 'glb',
  }],
});

const makeShieldProject = () => ({
  decorModels3d: [{
    id: 'shield-model',
    kind: 'inventory-shield',
    name: 'Bouclier test',
    modelUrl: 'blob:shield-model',
    modelFormat: 'glb',
    width: 0.7,
    depth: 0.2,
    height: 0.9,
  }],
  characterModels3d: [{
    id: 'hero-model',
    name: 'Hero test',
    modelUrl: 'blob:hero-model',
    modelFormat: 'glb',
  }],
});

afterEach(() => {
  cleanup();
});

describe('ObjectRiggingWorkspace', () => {
  it('opens the selected rig object on the selected character', async () => {
    const onTestOnCharacter = vi.fn();

    render(
      <ObjectRiggingWorkspace
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
    expect(preview.getAttribute('data-grid-visible')).toBe('true');
    expect(screen.queryByText('Animation')).toBeNull();
    expect(screen.queryByText('Deposer ici')).toBeNull();
    fireEvent.click(testButton);

    expect(onTestOnCharacter).toHaveBeenCalledWith({
      decorModelId: 'armor-model',
      characterModelId: 'hero-model',
    });
  });

  it('uses leggings labels and leg grip points for leggings rig objects', async () => {
    render(
      <ObjectRiggingWorkspace
        project={makeLeggingsProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');

    expect(screen.getAllByText('Jambieres').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jambe gauche').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Jambe droite').length).toBeGreaterThan(0);
    expect(screen.queryByText('Plastron')).toBeNull();
    expect(screen.queryByText('Bras gauche')).toBeNull();
    expect(screen.queryByText('Bras droit')).toBeNull();
    expect(preview.getAttribute('data-armor-markers')).toBe('6');
    expect(preview.getAttribute('data-armor-marker-ids')).toBe('left-groin-fold,right-groin-fold,left-knee,right-knee,left-foot,right-foot');
  });

  it('uses weapon labels and hand grip points for weapon rig objects', async () => {
    render(
      <ObjectRiggingWorkspace
        project={makeWeaponProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');

    expect(screen.getAllByText('Arme').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Points arme' })).toBeTruthy();
    expect(screen.queryByText('Plastron')).toBeNull();
    expect(screen.queryByText('Bras gauche')).toBeNull();
    expect(screen.queryByText('Os personnage')).toBeNull();
    expect(preview.getAttribute('data-armor-markers')).toBe('0');
    expect(preview.getAttribute('data-weapon-markers')).toBe('2');
    expect(preview.getAttribute('data-weapon-marker-hands')).toBe('right,left');
  });

  it('keeps weapons as weapons when updating a hand rig marker', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeWeaponProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingWorkspace
        project={makeWeaponProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Move right hand grip' }));

    expect(patchedProject.decorModels3d[0]).toMatchObject({
      kind: 'inventory-weapon',
      weaponGripRightEnabled: true,
      weaponGripRightX: 0.11,
      weaponGripRightY: -0.42,
      weaponGripRightZ: 0.03,
    });
  });

  it('uses shield labels and shield grip points for shield rig objects', async () => {
    render(
      <ObjectRiggingWorkspace
        project={makeShieldProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');

    expect(screen.getAllByText('Bouclier').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Points bouclier' })).toBeTruthy();
    expect(screen.queryByText('Plastron')).toBeNull();
    expect(screen.queryByText('Bras droit')).toBeNull();
    expect(screen.queryByText('Os personnage')).toBeNull();
    expect(preview.getAttribute('data-armor-markers')).toBe('0');
    expect(preview.getAttribute('data-shield-markers')).toBe('2');
    expect(preview.getAttribute('data-shield-marker-ids')).toBe('hand,elbow');
  });

  it('keeps shields as shields when updating a shield rig marker', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeShieldProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingWorkspace
        project={makeShieldProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Move shield hand grip' }));

    expect(patchedProject.decorModels3d[0]).toMatchObject({
      kind: 'inventory-shield',
      shieldGripHandEnabled: true,
      shieldGripHandX: -0.12,
      shieldGripHandY: -0.32,
      shieldGripHandZ: 0.04,
    });
  });

  it('keeps leggings as leggings when updating a leg rig marker', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeLeggingsProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingWorkspace
        project={makeLeggingsProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Move left knee' }));

    expect(patchedProject.decorModels3d[0]).toMatchObject({
      kind: 'inventory-leggings',
      armorCanvasCutEnabled: true,
      armorGripLeftKneeEnabled: true,
      armorGripLeftKneeX: -0.24,
      armorGripLeftKneeY: -0.7,
      armorGripLeftKneeZ: 0.08,
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
      <ObjectRiggingWorkspace
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
      <ObjectRiggingWorkspace
        project={makeProject()}
        patchProject={patchProject}
      />,
    );

    await screen.findByText('2 morceaux');
    fireEvent.click(screen.getByRole('button', { name: 'Decouper' }));

    expect(patchedProject.decorModels3d[0].armorCanvasCutEnabled).toBe(true);
    expect(patchedProject.decorModels3d[0].armorSegmentAssignments).toHaveLength(2);
  });

  it('creates named pieces from the canvas cut and keeps renamed pieces on assignments', async () => {
    let currentProject = makeProject();
    const patchProject = vi.fn((updater) => {
      const draft = structuredClone(currentProject);
      updater(draft);
      currentProject = draft;
    });

    const { rerender } = render(
      <ObjectRiggingWorkspace
        project={currentProject}
        patchProject={patchProject}
      />,
    );

    await screen.findByText('2 morceaux');
    fireEvent.click(screen.getByRole('button', { name: 'Decouper' }));

    expect(currentProject.decorModels3d[0].armorCustomPieces).toHaveLength(2);
    expect(currentProject.decorModels3d[0].armorCustomPieces[0]).toMatchObject({
      name: 'ChestPlate',
      segment: 'body',
      rigPointId: 'lower-belly',
    });
    expect(currentProject.decorModels3d[0].armorSegmentAssignments[0]).toMatchObject({
      path: '0:chestplate',
      pieceName: 'ChestPlate',
      rigPointId: 'lower-belly',
    });

    rerender(
      <ObjectRiggingWorkspace
        project={currentProject}
        patchProject={patchProject}
      />,
    );

    fireEvent.change(await screen.findByLabelText('Nom du morceau ChestPlate'), {
      target: { value: 'Torse metal' },
    });

    expect(currentProject.decorModels3d[0].armorCustomPieces[0].name).toBe('Torse metal');
    expect(currentProject.decorModels3d[0].armorSegmentAssignments[0].pieceName).toBe('Torse metal');

    rerender(
      <ObjectRiggingWorkspace
        project={currentProject}
        patchProject={patchProject}
      />,
    );

    fireEvent.change(await screen.findByLabelText('Os cible Torse metal'), {
      target: { value: 'right-hand' },
    });

    expect(currentProject.decorModels3d[0].armorCustomPieces[0].rigPointId).toBe('right-hand');
    expect(currentProject.decorModels3d[0].armorSegmentAssignments[0].rigPointId).toBe('right-hand');
  });

  it('assigns a picked mesh to the selected custom piece', async () => {
    let currentProject = makeCutProject();
    currentProject.decorModels3d[0].armorCustomPieces = [{
      id: 'piece-torse',
      name: 'Torse',
      segment: 'body',
    }];
    const patchProject = vi.fn((updater) => {
      const draft = structuredClone(currentProject);
      updater(draft);
      currentProject = draft;
    });

    render(
      <ObjectRiggingWorkspace
        project={currentProject}
        patchProject={patchProject}
      />,
    );

    await screen.findByLabelText('Nom du morceau Torse');
    fireEvent.click(screen.getByRole('button', { name: 'Selectionner Torse' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick ChestPlate' }));

    expect(currentProject.decorModels3d[0].armorSegmentAssignments).toEqual([{
      path: '0:chestplate',
      name: 'ChestPlate',
      segment: 'body',
      pieceId: 'piece-torse',
      pieceName: 'Torse',
      rigPointId: 'lower-belly',
    }]);
  });

  it('can expose every character rig bone as object armor grip points', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject();
      updater(draft);
      patchedProject = draft;
    });

    const { rerender } = render(
      <ObjectRiggingWorkspace
        project={makeProject()}
        patchProject={patchProject}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');
    expect(preview.getAttribute('data-armor-markers')).toBe('5');

    fireEvent.click(screen.getByRole('button', { name: 'Os personnage' }));

    expect(patchedProject.decorModels3d[0].armorFullCharacterRigEnabled).toBe(true);
    expect(patchedProject.decorModels3d[0].armorGripRightHandEnabled).toBe(true);
    expect(patchedProject.decorModels3d[0].armorGripRightPhalangeIndex1Enabled).toBe(true);
    rerender(
      <ObjectRiggingWorkspace
        project={patchedProject}
        patchProject={patchProject}
      />,
    );
    await waitFor(() => expect(preview.getAttribute('data-armor-markers')).toBe('57'));
  });

  it('updates armor pastilles from the canvas', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeProject();
      updater(draft);
      patchedProject = draft;
    });

    render(
      <ObjectRiggingWorkspace
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
      <ObjectRiggingWorkspace
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
      <ObjectRiggingWorkspace
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
    patchProject.mockClear();
    patchedProject = null;

    fireEvent.change(screen.getByLabelText(/Taille pinceau/), { target: { value: '24' } });
    expect(preview.getAttribute('data-brush-radius')).toBe('0.24');
    fireEvent.click(screen.getByRole('button', { name: 'Paint body zone' }));

    expect(patchProject).not.toHaveBeenCalled();
    expect(patchedProject).toBeNull();
    await waitFor(() => expect(screen.getByText('Peinture active: 1 touche')).toBeTruthy());

    fireEvent.click(screen.getByRole('button', { name: 'Couper' }));

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
      <ObjectRiggingWorkspace
        project={makeCutProject()}
        patchProject={patchProject}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Peindre zone' }));
    patchProject.mockClear();
    patchedProject = null;
    fireEvent.click(await screen.findByRole('button', { name: 'Paint body batch' }));

    expect(patchProject).not.toHaveBeenCalled();
    expect(patchedProject).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Couper' }));

    expect(patchedProject.decorModels3d[0].armorCutPaintStrokes[0].points).toEqual([
      { x: 0.2, y: 0.1, z: 0 },
      { x: 0.25, y: 0.15, z: 0 },
    ]);
  });

  it('commits pending paint before saving assets', async () => {
    let patchedProject = null;
    const patchProject = vi.fn((updater) => {
      const draft = makeCutProject();
      updater(draft);
      patchedProject = draft;
    });
    const onSaveAssets = vi.fn();

    render(
      <ObjectRiggingWorkspace
        project={makeCutProject()}
        patchProject={patchProject}
        onSaveAssets={onSaveAssets}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Peindre zone' }));
    patchProject.mockClear();
    patchedProject = null;
    fireEvent.click(await screen.findByRole('button', { name: 'Paint body zone' }));

    expect(patchProject).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Sauver' }));

    expect(patchedProject.decorModels3d[0].armorCutPaintStrokes[0].points).toEqual([
      { x: 0.1, y: 0.2, z: 0 },
    ]);
    expect(onSaveAssets).toHaveBeenCalledTimes(1);
  });

  it('does not reload mesh nodes when only paint strokes change', async () => {
    vi.mocked(loadThreeModelFromSource).mockClear();
    const initialProject = makeCutProject();
    const { rerender } = render(
      <ObjectRiggingWorkspace
        project={initialProject}
        patchProject={vi.fn()}
      />,
    );

    await waitFor(() => expect(loadThreeModelFromSource).toHaveBeenCalledTimes(1));

    const paintedProject = makeCutProject();
    paintedProject.decorModels3d[0].armorCutPaintStrokes = [{
      segment: 'body',
      radius: 0.2,
      points: [{ x: 0.1, y: 0.2, z: 0 }],
    }];
    rerender(
      <ObjectRiggingWorkspace
        project={paintedProject}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');
    await waitFor(() => expect(preview.getAttribute('data-paint-count')).toBe('1'));
    expect(loadThreeModelFromSource).toHaveBeenCalledTimes(1);
  });

  it('adds a camera zoom drag mode like the RPG map', async () => {
    render(
      <ObjectRiggingWorkspace
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

  it('adds a section-view mode that disables mesh picking while drawing the cut', async () => {
    render(
      <ObjectRiggingWorkspace
        project={makeCutProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');
    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
    expect(preview.getAttribute('data-section-enabled')).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Vue coupe' }));
    expect(preview.getAttribute('data-section-enabled')).toBe('true');
    expect(preview.getAttribute('data-pick-enabled')).toBe('false');
    expect(screen.getByText('Vue coupe: trace une ligne puis clique la face visible')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Vue coupe' }));
    expect(preview.getAttribute('data-section-enabled')).toBe('false');
    expect(preview.getAttribute('data-pick-enabled')).toBe('true');
  });

  it('toggles the object preview grid without changing rig picking', async () => {
    render(
      <ObjectRiggingWorkspace
        project={makeCutProject()}
        patchProject={vi.fn()}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');
    expect(preview.getAttribute('data-grid-visible')).toBe('true');
    expect(preview.getAttribute('data-pick-enabled')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Grille' }));

    expect(preview.getAttribute('data-grid-visible')).toBe('false');
    expect(preview.getAttribute('data-pick-enabled')).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Grille' }));

    expect(preview.getAttribute('data-grid-visible')).toBe('true');
  });
});
