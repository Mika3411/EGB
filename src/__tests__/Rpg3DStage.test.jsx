import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import Rpg3DStage from '../domains/rpg3d/components/Rpg3DStage.jsx';
import { DEFAULT_ARCADE_CONFIG } from '../shared/utils/rpg3dDomain.js';

vi.mock('../domains/rpg3d/arcade/ArcadeThreeViewport.jsx', () => ({
  default: () => <div data-testid="arcade-three-viewport" />,
}));

const noop = () => {};

const renderStage = (overrides = {}) => render(
  <Rpg3DStage
    activeTransformTool=""
    actionZoneEdgeInsertMode={false}
    cameraTargetPickMode={false}
    cameraToolsHidden={false}
    cameraZoomDragMode={false}
    cameraZoomPercent={100}
    canRedo={false}
    canUndo={false}
    config={DEFAULT_ARCADE_CONFIG}
    configRef={{ current: DEFAULT_ARCADE_CONFIG }}
    dragMode={false}
    loadingState={null}
    mapFullscreen={false}
    mode="play"
    modelEraserMode={false}
    modelEraserRadius={20}
    multiSelected={[]}
    multiSelectMode={false}
    paintBrushColor="#22d3ee"
    paintBrushRadius={50}
    paintBrushShape="circle"
    pendingPlacement={null}
    playMode
    quickSelectionCanResize={false}
    quickSelectionCanRotate={false}
    scaleProportionalAxes={{ x: true, y: true, z: true }}
    selected={null}
    stateRef={{ current: {} }}
    studioProject={{}}
    tool="select"
    wrapperRef={{ current: null }}
    onActionZoneEdgeDrag={noop}
    onActionZoneEdgeDragStart={noop}
    onActionZoneEdgeInsert={noop}
    onActionZoneVertexDrag={noop}
    onActionZoneVertexDragStart={noop}
    onCameraTargetPick={noop}
    onCameraZoomDrag={noop}
    onHideCameraTools={noop}
    onMarqueeSelect={noop}
    onModelEraseEnd={noop}
    onModelEraseMove={noop}
    onModelEraseStart={noop}
    onRedo={noop}
    onSelectionTransformCommit={noop}
    onShootChange={noop}
    onShowCameraTools={noop}
    onToggleCameraTargetPickMode={noop}
    onToggleCameraZoomDragMode={noop}
    onToggleDragMode={noop}
    onToggleFullscreen={noop}
    onToggleMultiSelectMode={noop}
    onToggleRotateTransform={noop}
    onToggleScaleProportionalAxis={noop}
    onToggleScaleTransform={noop}
    onUndo={noop}
    onWorldClick={noop}
    onWorldDrag={noop}
    onWorldDragStart={noop}
    onWorldDrop={noop}
    onWorldPaintEnd={noop}
    onWorldPaintMove={noop}
    onWorldPaintStart={noop}
    onWorldPointer={noop}
    resolveWorldDragPoint={(entity, point) => point}
    {...overrides}
  />,
);

describe('Rpg3DStage', () => {
  afterEach(() => cleanup());

  it('renders the action loading bar over the 3D stage', () => {
    renderStage({
      loadingState: {
        key: 'loading-1',
        tone: 'canvas',
        label: 'Chargement du canevas',
        detail: 'Salle nord',
        durationMs: 1200,
      },
    });

    const status = screen.getByText('Chargement du canevas').closest('[role="status"]');
    expect(status).toBeTruthy();
    expect(status.textContent).toContain('Chargement du canevas');
    expect(status.textContent).toContain('Salle nord');
    expect(screen.getByRole('progressbar', { name: 'Chargement en cours' })).toBeTruthy();
  });
});
