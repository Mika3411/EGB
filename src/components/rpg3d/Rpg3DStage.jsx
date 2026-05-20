import {
  Eye,
  EyeOff,
  Hand,
  Maximize2,
  Minimize2,
  MousePointerClick,
  Orbit,
  Redo2,
  RotateCcw,
  Undo2,
  ZoomIn,
} from 'lucide-react';
import ArcadeThreeViewport from '../arcade/ArcadeThreeViewport.jsx';

export default function Rpg3DStage({
  activeTransformTool,
  cameraTargetPickMode,
  cameraToolsHidden,
  cameraZoomDragMode,
  cameraZoomPercent,
  config,
  configRef,
  dragMode,
  mapFullscreen,
  mode,
  modelEraserMode,
  modelEraserRadius,
  multiSelectMode,
  multiSelected,
  paintBrushColor,
  paintBrushRadius,
  paintBrushShape,
  pendingPlacement,
  playMode,
  quickSelectionCanResize,
  quickSelectionCanRotate,
  selected,
  stateRef,
  studioProject,
  tool,
  wrapperRef,
  canRedo,
  canUndo,
  onCameraTargetPick,
  onCameraZoomDrag,
  onHideCameraTools,
  onMarqueeSelect,
  onRedo,
  onSelectionTransformCommit,
  onShootChange,
  onShowCameraTools,
  onToggleCameraTargetPickMode,
  onToggleCameraZoomDragMode,
  onToggleDragMode,
  onToggleFullscreen,
  onToggleMultiSelectMode,
  onToggleRotateTransform,
  onToggleScaleTransform,
  onUndo,
  onWorldClick,
  onWorldDrag,
  onWorldDragStart,
  onWorldDrop,
  onModelEraseEnd,
  onModelEraseMove,
  onModelEraseStart,
  onWorldPaintEnd,
  onWorldPaintMove,
  onWorldPaintStart,
  onWorldPointer,
  resolveWorldDragPoint,
}) {
  return (
    <section className="arcade-stage" ref={wrapperRef}>
      {cameraToolsHidden ? (
        <button
          type="button"
          className="arcade-stage-tools-toggle"
          title="Afficher les outils camera"
          aria-label="Afficher les outils camera"
          onClick={onShowCameraTools}
        >
          <Eye size={16} />
        </button>
      ) : null}
      {!cameraToolsHidden ? (
        <div className="arcade-stage-zoom-control" role="group" aria-label="Outils camera">
          <button
            type="button"
            className="arcade-stage-tools-hide"
            title="Masquer les outils camera"
            aria-label="Masquer les outils camera"
            onClick={onHideCameraTools}
          >
            <EyeOff size={16} />
          </button>
          <button
            type="button"
            className={dragMode ? 'active' : ''}
            title={dragMode ? 'Main active: glisser les objets' : 'Activer la main pour glisser les objets'}
            aria-label={dragMode ? 'Desactiver le glisser-deposer' : 'Activer le glisser-deposer'}
            aria-pressed={dragMode}
            onClick={onToggleDragMode}
          >
            <Hand size={17} />
          </button>
          <button
            type="button"
            className={multiSelectMode ? 'active' : ''}
            title={multiSelectMode ? 'Selection multiple active' : 'Selectionner plusieurs objets'}
            aria-label={multiSelectMode ? 'Desactiver la selection multiple' : 'Activer la selection multiple'}
            aria-pressed={multiSelectMode}
            onClick={onToggleMultiSelectMode}
          >
            <MousePointerClick size={17} />
          </button>
          <button
            type="button"
            className={cameraTargetPickMode ? 'active' : ''}
            title={cameraTargetPickMode ? 'Clique un objet pour centrer l orbite camera' : 'Choisir le centre de rotation camera'}
            aria-label={cameraTargetPickMode ? 'Annuler le choix du centre de rotation camera' : 'Choisir le centre de rotation camera'}
            aria-pressed={cameraTargetPickMode}
            onClick={onToggleCameraTargetPickMode}
            disabled={playMode}
          >
            <Orbit size={17} />
          </button>
          <button
            type="button"
            title="Annuler"
            aria-label="Annuler"
            onClick={onUndo}
            disabled={!canUndo}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            title="Retablir"
            aria-label="Retablir"
            onClick={onRedo}
            disabled={!canRedo}
          >
            <Redo2 size={17} />
          </button>
          <button
            type="button"
            title={mapFullscreen ? 'Quitter le plein ecran' : 'Plein ecran'}
            aria-label={mapFullscreen ? 'Quitter le plein ecran' : 'Activer le plein ecran'}
            aria-pressed={mapFullscreen}
            onClick={onToggleFullscreen}
          >
            {mapFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
          </button>
          <button
            type="button"
            className={cameraZoomDragMode ? 'active' : ''}
            title={cameraZoomDragMode ? 'Zoom souris actif: maintiens clic gauche et glisse haut/bas' : 'Activer le zoom souris'}
            aria-label={cameraZoomDragMode ? 'Desactiver le zoom souris' : 'Activer le zoom souris'}
            aria-pressed={cameraZoomDragMode}
            disabled={playMode}
            onClick={onToggleCameraZoomDragMode}
          >
            <ZoomIn size={17} />
          </button>
          <output aria-label="Zoom actuel">{cameraZoomPercent}%</output>
        </div>
      ) : null}
      {mode === 'edit' ? (
        <div className="arcade-stage-transform-toolbar" role="group" aria-label="Transformation rapide de la selection">
          <button
            type="button"
            className={activeTransformTool === 'rotate' ? 'active' : ''}
            title="Afficher le gizmo de rotation"
            aria-label="Afficher le gizmo de rotation"
            aria-pressed={activeTransformTool === 'rotate'}
            disabled={!quickSelectionCanRotate}
            onClick={onToggleRotateTransform}
          >
            <RotateCcw size={17} />
          </button>
          <span className="arcade-stage-transform-divider" aria-hidden="true" />
          <button
            type="button"
            className={activeTransformTool === 'scale' ? 'active' : ''}
            title="Afficher le gizmo de redimensionnement"
            aria-label="Afficher le gizmo de redimensionnement"
            aria-pressed={activeTransformTool === 'scale'}
            disabled={!quickSelectionCanResize}
            onClick={onToggleScaleTransform}
          >
            <Maximize2 size={17} />
          </button>
        </div>
      ) : null}
      <ArcadeThreeViewport
        config={config}
        configRef={configRef}
        studioProject={studioProject}
        stateRef={stateRef}
        mode={mode}
        selected={selected}
        multiSelected={multiSelected}
        multiSelectMode={multiSelectMode}
        cameraTargetPickMode={cameraTargetPickMode && mode === 'edit'}
        cameraZoomDragMode={cameraZoomDragMode && mode === 'edit'}
        transformMode={activeTransformTool}
        placementEntity={pendingPlacement}
        dragEnabled={dragMode && mode === 'edit'}
        paintMode={tool === 'terrainPaint' && mode === 'edit'}
        paintBrushColor={paintBrushColor}
        paintBrushRadius={paintBrushRadius}
        paintBrushShape={paintBrushShape}
        modelEraserMode={modelEraserMode && mode === 'edit'}
        modelEraserRadius={modelEraserRadius}
        onWorldPointer={onWorldPointer}
        onWorldClick={onWorldClick}
        onWorldPaintStart={onWorldPaintStart}
        onWorldPaintMove={onWorldPaintMove}
        onWorldPaintEnd={onWorldPaintEnd}
        onModelEraseStart={onModelEraseStart}
        onModelEraseMove={onModelEraseMove}
        onModelEraseEnd={onModelEraseEnd}
        onCameraTargetPick={onCameraTargetPick}
        onCameraZoomDrag={onCameraZoomDrag}
        onSelectionTransformCommit={onSelectionTransformCommit}
        resolveWorldDragPoint={resolveWorldDragPoint}
        onWorldDragStart={onWorldDragStart}
        onWorldDrag={onWorldDrag}
        onWorldDrop={onWorldDrop}
        onMarqueeSelect={onMarqueeSelect}
        onShootChange={onShootChange}
      />
    </section>
  );
}
