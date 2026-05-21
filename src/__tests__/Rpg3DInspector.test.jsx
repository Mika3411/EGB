import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Rpg3DInspector from '../components/rpg3d/Rpg3DInspector.jsx';
import { DEFAULT_ARCADE_CONFIG } from '../utils/rpg3dDomain.js';

const renderActionZoneInspector = (overrides = {}) => {
  const zone = {
    id: 'zone-1',
    x: 200,
    y: 140,
    w: 120,
    h: 80,
    vertices: [
      { x: 140, y: 100 },
      { x: 260, y: 100 },
      { x: 260, y: 180 },
      { x: 140, y: 180 },
    ],
    ...overrides.zone,
  };
  render(
    <Rpg3DInspector
      actionZoneEdgeInsertMode={overrides.actionZoneEdgeInsertMode || false}
      actionZoneNpcTargets={[]}
      activeCanvasId="canvas-1"
      config={DEFAULT_ARCADE_CONFIG}
      fieldHelp={{}}
      getEntityRotation={() => 0}
      getModelRotationValue={() => 0}
      getNpcChoiceItems={() => []}
      getNpcInteractionMode={() => 'message'}
      getNpcQuestionText={() => ''}
      getSelectedEntityTypeLabel={() => 'ZONE'}
      hasMultiInspectorSelection={false}
      inspectorSelectionBounds={null}
      inspectorSelectionEntities={[{ type: 'actionZone', id: zone.id }]}
      mediaError=""
      modelEraserActive={false}
      modelEraserMaxRadius={100}
      modelEraserMinRadius={1}
      modelEraserRadius={10}
      multiPositionRowClassName=""
      multiSelectionAllFlatTiles={false}
      multiSelectionCanEditActions={false}
      multiSelectionCanLevitate={false}
      multiSelectionCanRotate={false}
      multiSelectionFloorZeroValue=""
      multiSelectionRotationValue=""
      multiSelectionZValue=""
      positionRowClassName="arcade-position-row"
      reliefStyleOptions={[]}
      rpg3DCanvasOptions={[]}
      selectedCanLevitate={false}
      selectedCanRotate={false}
      selectedEntity={{ type: 'actionZone', id: zone.id, item: zone }}
      selectedPropIsFlatTile={false}
      selectedPropIsFloorTile={false}
      selectedPropRenderMode=""
      selectedPropTileSize={0}
      selectedReliefStyle=""
      selectedModelEraserCount={0}
      showArcadeElementLibrary={false}
      onActionZoneTypeChange={() => {}}
      onAddSelectedNpcChoice={() => {}}
      onClearPropImage={() => {}}
      onDeleteSelected={() => {}}
      onDuplicateSelected={() => {}}
      onExportConfig={() => {}}
      onClearModelEraser={() => {}}
      onModelEraserRadiusChange={() => {}}
      onNpcInteractionModeChange={() => {}}
      onPropCollisionChange={() => {}}
      onReliefCollisionChange={() => {}}
      onRemoveSelectedNpcChoice={() => {}}
      onSelectTool={() => {}}
      onSnapSelectedTileToNeighbor={() => {}}
      onToggleActionZoneEdgeInsertMode={overrides.onToggleActionZoneEdgeInsertMode || (() => {})}
      onToggleModelEraser={() => {}}
      onUpdateEntity={() => {}}
      onUpdateSelectedNpcChoice={() => {}}
      onUpdateSelectionEntities={() => {}}
      onZoneVisibilityChange={() => {}}
    />,
  );

  return { zone };
};

describe('Rpg3DInspector', () => {
  afterEach(() => {
    cleanup();
  });

  it('keeps action zone vertex fields out of the inspector while exposing click-to-add edge mode', () => {
    const onToggleActionZoneEdgeInsertMode = vi.fn();
    renderActionZoneInspector();

    expect(screen.getByRole('textbox', { name: 'Nom zone?' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Sommet 1 X' })).toBeNull();
    expect(screen.queryByRole('button', {
      name: 'Ajouter une arete entre Sommet 1 et Sommet 2',
    })).toBeNull();

    cleanup();
    renderActionZoneInspector({ onToggleActionZoneEdgeInsertMode });
    fireEvent.click(screen.getByRole('button', { name: 'Ajouter arete au clic' }));
    expect(onToggleActionZoneEdgeInsertMode).toHaveBeenCalledTimes(1);
  });
});
