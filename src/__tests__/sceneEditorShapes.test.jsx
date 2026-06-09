import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { useSceneEditorShapes } from '../domains/scenes/studio/components/useSceneEditorShapes';

afterEach(() => cleanup());

function ShapeControlsHarness({ isBeginnerMode = true }) {
  const selectedScene = {
    id: 'scene-1',
    hotspots: [{
      id: 'spot-1',
      name: 'Zone',
      x: 50,
      y: 50,
      width: 20,
      height: 12,
      shapeType: 'rectangle',
    }],
  };
  const { renderShapeControls } = useSceneEditorShapes({
    selectedScene,
    selectedSceneId: selectedScene.id,
    patchProject: vi.fn(),
    isBeginnerMode,
  });

  return <>{renderShapeControls('hotspot', 'spot-1')}</>;
}

describe('scene editor shapes', () => {
  test('affiche le choix de forme même en mode debutant', () => {
    render(<ShapeControlsHarness isBeginnerMode />);

    expect(screen.getByText('Forme')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Rectangle' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Ronde / ovale' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Libre' })).toBeTruthy();
  });
});
