import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Decor3DTab from '../components/Decor3DTab.jsx';

vi.mock('../components/rpg3d/Decor3DPreview.jsx', () => ({
  default: ({
    armorGripMarkers = [],
    children,
    model,
    onArmorGripMarkerChange,
  }) => (
    <div
      data-testid="decor-preview"
      data-model-id={model?.id || ''}
      data-armor-markers={String(armorGripMarkers.length)}
      data-armor-marker-ids={armorGripMarkers.map((marker) => marker.id).join(',')}
    >
      <button type="button" onClick={() => onArmorGripMarkerChange?.('left-knee', { x: -0.22, y: -0.74, z: 0.11 })}>
        Move left knee
      </button>
      {children}
    </div>
  ),
}));

afterEach(() => {
  cleanup();
});

const makeLeggingsProject = () => ({
  decorModels3d: [{
    id: 'leggings-model',
    kind: 'inventory-leggings',
    name: 'Jambieres test',
    modelUrl: 'blob:leggings-model',
    modelFormat: 'glb',
    width: 0.8,
    depth: 0.45,
    height: 1.2,
  }],
});

describe('Decor3DTab', () => {
  it('shows groin, knee and foot grip markers for leggings objects', async () => {
    let currentProject = makeLeggingsProject();
    const patchProject = vi.fn((updater) => {
      const draft = structuredClone(currentProject);
      updater(draft);
      currentProject = draft;
    });

    render(
      <Decor3DTab
        project={currentProject}
        patchProject={patchProject}
        mediaLibrary={[]}
      />,
    );

    const preview = await screen.findByTestId('decor-preview');

    expect(preview.getAttribute('data-armor-markers')).toBe('6');
    expect(preview.getAttribute('data-armor-marker-ids')).toBe([
      'left-groin-fold',
      'right-groin-fold',
      'left-knee',
      'right-knee',
      'left-foot',
      'right-foot',
    ].join(','));
    expect(screen.getByText('Points de prise jambieres')).toBeTruthy();
    expect(screen.getByText('Aine gauche')).toBeTruthy();
    expect(screen.getByText('Aine droite')).toBeTruthy();
    expect(screen.getByText('Genou gauche')).toBeTruthy();
    expect(screen.getByText('Genou droit')).toBeTruthy();
    expect(screen.getByText('Pied gauche')).toBeTruthy();
    expect(screen.getByText('Pied droit')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Move left knee' }));

    expect(currentProject.decorModels3d[0]).toMatchObject({
      armorGripLeftKneeEnabled: true,
      armorGripLeftKneeX: -0.22,
      armorGripLeftKneeY: -0.74,
      armorGripLeftKneeZ: 0.11,
    });
  });
});
