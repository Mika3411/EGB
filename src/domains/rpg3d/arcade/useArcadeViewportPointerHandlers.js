import { useCallback } from 'react';
import {
  ACTION_ZONE_EDGE_DRAG_THRESHOLD,
  getActionZoneHeightDragDelta,
  getActionZoneHeightDragPoint,
  getActionZonePointForEntity,
  getHoveredActionZoneId,
} from './rpg3dViewportInteraction.js';
import {
  findSelectedPosition,
  isCameraTargetEntity,
  isDraggableEntity,
  normalizeScreenRect,
} from './rpg3dViewportPicking.js';

export default function useArcadeViewportPointerHandlers({
  actionZoneEdgeDragRef,
  actionZoneVertexDragRef,
  aimPointRef,
  applyDragPreview,
  applyPlacementPreview,
  cameraZoomDragRef,
  clickStartRef,
  configRef,
  controlsRef,
  createDragPreviewTargets,
  dragRef,
  getEntitiesInMarquee,
  getScreenPoint,
  heldMoveRef,
  hideModelEraserPreview,
  hidePaintPreview,
  invalidateRenderRef,
  latestRef,
  marqueeRef,
  modelEraserRef,
  paintRef,
  resetDragPreview,
  resolvePointer,
  resolveSelectedModelHit,
  setActionZoneCursorMode,
  setCameraTargetFromEntity,
  setMarqueeRect,
  transformControlsRef,
  transformPointerActiveRef,
  updateActionZoneCursorMode,
  updateHoveredActionZone,
  updateModelEraserPreview,
  updatePaintPreview,
}) {
  const isTransformInteractionActive = useCallback(() => Boolean(
    transformPointerActiveRef.current
    || transformControlsRef.current?.dragging
    || transformControlsRef.current?.axis,
  ), [transformControlsRef, transformPointerActiveRef]);

  const handlePointerMove = useCallback((event) => {
    if (transformControlsRef.current?.dragging) {
      event.preventDefault();
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    const cameraZoomDrag = cameraZoomDragRef.current;
    if (cameraZoomDrag && cameraZoomDrag.pointerId === event.pointerId) {
      event.preventDefault();
      const deltaY = event.clientY - cameraZoomDrag.lastY;
      cameraZoomDrag.lastY = event.clientY;
      latestRef.current.onCameraZoomDrag?.(deltaY);
      invalidateRenderRef.current({ followupFrames: 4 });
      return;
    }
    const eraserMode = latestRef.current.modelEraserMode && latestRef.current.mode !== 'play';
    const shouldPickActionZoneControl = latestRef.current.mode === 'edit'
      && !latestRef.current.placementEntity
      && !latestRef.current.paintMode
      && !latestRef.current.modelEraserMode
      && !latestRef.current.cameraTargetPickMode
      && !latestRef.current.cameraZoomDragMode
      && !dragRef.current
      && !actionZoneVertexDragRef.current
      && !actionZoneEdgeDragRef.current
      && !marqueeRef.current
      && !transformPointerActiveRef.current
      && !transformControlsRef.current?.dragging;
    const resolved = resolvePointer(event, {
      pickEntity: shouldPickActionZoneControl,
    });
    const modelHit = eraserMode ? resolveSelectedModelHit(event) : null;
    const screenPoint = resolved || modelHit || getScreenPoint(event);
    if (actionZoneVertexDragRef.current) {
      updateActionZoneCursorMode('vertex');
    } else if (actionZoneEdgeDragRef.current) {
      updateActionZoneCursorMode('edge');
    } else if (shouldPickActionZoneControl) {
      updateActionZoneCursorMode(
        resolved?.entity?.type === 'actionZoneVertex'
          ? 'vertex'
          : resolved?.entity?.type === 'actionZoneEdge'
            ? latestRef.current.actionZoneEdgeInsertMode ? 'edge-insert' : 'edge'
            : '',
      );
    } else {
      updateActionZoneCursorMode('');
    }
    if (!resolved && latestRef.current.paintMode) hidePaintPreview();
    if (eraserMode) {
      if (modelHit) updateModelEraserPreview(modelHit);
      else hideModelEraserPreview();
    }
    if (latestRef.current.mode === 'play') {
      updateHoveredActionZone(getHoveredActionZoneId(latestRef.current.config, resolved?.point));
    } else {
      updateHoveredActionZone('');
    }
    if (!resolved && !screenPoint) return;
    if (resolved) {
      aimPointRef.current = resolved.point;
      latestRef.current.onWorldPointer?.({
        x: resolved.point.x,
        y: resolved.point.y,
        screenX: resolved.screenX,
        screenY: resolved.screenY,
      });
      if (latestRef.current.placementEntity && latestRef.current.mode !== 'play') {
        applyPlacementPreview(latestRef.current.placementEntity, resolved.point);
      }
      if (latestRef.current.paintMode && latestRef.current.mode !== 'play') {
        updatePaintPreview(resolved.point);
      }
    }
    if (modelEraserRef.current) {
      event.preventDefault();
      if (modelHit) latestRef.current.onModelEraseMove?.(modelHit);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    if (paintRef.current && resolved) {
      event.preventDefault();
      latestRef.current.onWorldPaintMove?.(resolved.point);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    const heldMove = heldMoveRef.current;
    if (
      resolved
      && latestRef.current.mode === 'play'
      && heldMove
      && heldMove.pointerId === event.pointerId
    ) {
      event.preventDefault();
      latestRef.current.onWorldClick?.(resolved.point, resolved.entity, 0, { continuous: true });
      return;
    }
    if (marqueeRef.current && screenPoint) {
      event.preventDefault();
      marqueeRef.current.currentX = screenPoint.screenX;
      marqueeRef.current.currentY = screenPoint.screenY;
      setMarqueeRect(normalizeScreenRect(marqueeRef.current));
      return;
    }
    if (actionZoneEdgeDragRef.current) {
      event.preventDefault();
      const edgeDrag = actionZoneEdgeDragRef.current;
      if (!resolved && !edgeDrag.heightOnly) return;
      const movement = Math.hypot(event.clientX - edgeDrag.startX, event.clientY - edgeDrag.startY);
      if (!edgeDrag.dragging && movement >= ACTION_ZONE_EDGE_DRAG_THRESHOLD) {
        edgeDrag.dragging = true;
        latestRef.current.onActionZoneEdgeDragStart?.(edgeDrag.entity);
      }
      if (edgeDrag.dragging) {
        const delta = edgeDrag.heightOnly
          ? getActionZoneHeightDragDelta(edgeDrag.lastY, event.clientY)
          : {
            x: resolved.point.x - edgeDrag.lastPoint.x,
            y: resolved.point.y - edgeDrag.lastPoint.y,
          };
        if (!edgeDrag.heightOnly) {
          const nextZ = Number(resolved.point.z);
          const lastZ = Number(edgeDrag.lastPoint?.z);
          if (Number.isFinite(nextZ) || Number.isFinite(lastZ)) {
            delta.z = (Number.isFinite(nextZ) ? nextZ : 0) - (Number.isFinite(lastZ) ? lastZ : 0);
          }
        }
        latestRef.current.onActionZoneEdgeDrag?.(edgeDrag.entity, delta, resolved?.point || edgeDrag.lastPoint);
        edgeDrag.lastPoint = resolved?.point || edgeDrag.lastPoint;
        edgeDrag.lastY = event.clientY;
        invalidateRenderRef.current({ followupFrames: 1 });
      }
      return;
    }
    if (actionZoneVertexDragRef.current) {
      event.preventDefault();
      const vertexDrag = actionZoneVertexDragRef.current;
      const point = vertexDrag.heightOnly
        ? getActionZoneHeightDragPoint(vertexDrag.startPoint, vertexDrag.startY, event.clientY)
        : resolved?.point;
      if (!point) return;
      latestRef.current.onActionZoneVertexDrag?.(vertexDrag.entity, point);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    if (dragRef.current) {
      event.preventDefault();
      const drag = dragRef.current;
      const rawPoint = {
        x: resolved.point.x - drag.offsetX,
        y: resolved.point.y - drag.offsetY,
      };
      const point = latestRef.current.resolveWorldDragPoint?.(drag.entity, rawPoint) || rawPoint;
      applyDragPreview(drag, point);
      latestRef.current.onWorldDrag?.(drag.entity, point);
      invalidateRenderRef.current({ followupFrames: 1 });
    }
  }, [
    actionZoneEdgeDragRef,
    actionZoneVertexDragRef,
    aimPointRef,
    applyDragPreview,
    applyPlacementPreview,
    cameraZoomDragRef,
    dragRef,
    getScreenPoint,
    heldMoveRef,
    hideModelEraserPreview,
    hidePaintPreview,
    invalidateRenderRef,
    latestRef,
    marqueeRef,
    modelEraserRef,
    paintRef,
    resolvePointer,
    resolveSelectedModelHit,
    setMarqueeRect,
    transformControlsRef,
    transformPointerActiveRef,
    updateActionZoneCursorMode,
    updateHoveredActionZone,
    updateModelEraserPreview,
    updatePaintPreview,
  ]);

  const handlePointerDown = useCallback((event) => {
    if (event.button === 0 && isTransformInteractionActive()) {
      event.preventDefault();
      clickStartRef.current = null;
      return;
    }
    const eraserMode = event.button === 0 && latestRef.current.modelEraserMode && latestRef.current.mode === 'edit';
    const resolved = resolvePointer(event, { pickEntity: true });
    const modelHit = eraserMode ? resolveSelectedModelHit(event) : null;
    const screenPoint = resolved || modelHit || getScreenPoint(event);
    if (resolved) {
      aimPointRef.current = resolved.point;
      latestRef.current.onWorldPointer?.({
        x: resolved.point.x,
        y: resolved.point.y,
        screenX: resolved.screenX,
        screenY: resolved.screenY,
      });
    }
    if (event.button === 0) {
      clickStartRef.current = resolved ? {
        x: event.clientX,
        y: event.clientY,
        point: resolved.point,
        entity: resolved.entity,
      } : null;
    }
    if (event.button === 2) {
      event.preventDefault();
      latestRef.current.onShootChange?.(false);
      return;
    }
    if (event.button === 0 && latestRef.current.cameraZoomDragMode && latestRef.current.mode === 'edit') {
      event.preventDefault();
      window.getSelection?.()?.removeAllRanges?.();
      clickStartRef.current = null;
      cameraZoomDragRef.current = {
        pointerId: event.pointerId,
        startY: event.clientY,
        lastY: event.clientY,
      };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (eraserMode) {
      event.preventDefault();
      clickStartRef.current = null;
      if (!modelHit) {
        hideModelEraserPreview();
        return;
      }
      modelEraserRef.current = { pointerId: event.pointerId };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updateModelEraserPreview(modelHit);
      latestRef.current.onModelEraseStart?.(modelHit);
      return;
    }
    if (event.button !== 0 || !resolved) return;
    if (latestRef.current.mode === 'play') {
      event.preventDefault();
      window.getSelection?.()?.removeAllRanges?.();
      clickStartRef.current = null;
      heldMoveRef.current = { pointerId: event.pointerId };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      latestRef.current.onMoveHoldChange?.(true);
      latestRef.current.onWorldClick?.(resolved.point, resolved.entity, event.button, { continuous: true });
      return;
    }
    if (latestRef.current.placementEntity) {
      event.preventDefault();
      return;
    }
    if (latestRef.current.paintMode && latestRef.current.mode === 'edit') {
      event.preventDefault();
      clickStartRef.current = null;
      paintRef.current = { pointerId: event.pointerId };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      updatePaintPreview(resolved.point);
      latestRef.current.onWorldPaintStart?.(resolved.point);
      return;
    }
    if (latestRef.current.cameraTargetPickMode) {
      event.preventDefault();
      clickStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        point: resolved.point,
        entity: resolved.entity,
        cameraTargetPick: true,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }
    if (resolved.entity?.type === 'actionZoneEdge') {
      event.preventDefault();
      clickStartRef.current = null;
      if (latestRef.current.actionZoneEdgeInsertMode && !latestRef.current.actionZoneHeightMode) {
        updateActionZoneCursorMode('edge-insert');
        latestRef.current.onActionZoneEdgeInsert?.(resolved.entity, resolved.point);
        invalidateRenderRef.current({ followupFrames: 1 });
        return;
      }
      updateActionZoneCursorMode('edge');
      const startPoint = getActionZonePointForEntity(configRef.current || latestRef.current.config, resolved.entity) || resolved.point;
      actionZoneEdgeDragRef.current = {
        pointerId: event.pointerId,
        entity: resolved.entity,
        startX: event.clientX,
        startY: event.clientY,
        lastY: event.clientY,
        startPoint,
        lastPoint: startPoint,
        heightOnly: Boolean(latestRef.current.actionZoneHeightMode),
        dragging: false,
      };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    if (resolved.entity?.type === 'actionZoneVertex') {
      event.preventDefault();
      clickStartRef.current = null;
      updateActionZoneCursorMode('vertex');
      const startPoint = getActionZonePointForEntity(configRef.current || latestRef.current.config, resolved.entity) || resolved.point;
      actionZoneVertexDragRef.current = {
        pointerId: event.pointerId,
        entity: resolved.entity,
        startY: event.clientY,
        startPoint,
        heightOnly: Boolean(latestRef.current.actionZoneHeightMode),
      };
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      latestRef.current.onActionZoneVertexDragStart?.(resolved.entity, startPoint);
      latestRef.current.onActionZoneVertexDrag?.(resolved.entity, startPoint);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    if (latestRef.current.dragEnabled && isDraggableEntity(resolved.entity)) {
      event.preventDefault();
      const position = findSelectedPosition(configRef.current || latestRef.current.config, resolved.entity) || resolved.point;
      dragRef.current = {
        entity: resolved.entity,
        anchor: position,
        offsetX: resolved.point.x - position.x,
        offsetY: resolved.point.y - position.y,
        previewTargets: createDragPreviewTargets(resolved.entity),
      };
      clickStartRef.current = null;
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
      latestRef.current.onWorldDragStart?.(resolved.entity);
      return;
    }
    if (latestRef.current.multiSelectMode && latestRef.current.mode === 'edit' && screenPoint) {
      event.preventDefault();
      marqueeRef.current = {
        startX: screenPoint.screenX,
        startY: screenPoint.screenY,
        currentX: screenPoint.screenX,
        currentY: screenPoint.screenY,
      };
      setMarqueeRect(normalizeScreenRect(marqueeRef.current));
      if (controlsRef.current) controlsRef.current.enabled = false;
      event.currentTarget.setPointerCapture?.(event.pointerId);
    }
  }, [
    actionZoneEdgeDragRef,
    actionZoneVertexDragRef,
    aimPointRef,
    cameraZoomDragRef,
    clickStartRef,
    configRef,
    controlsRef,
    createDragPreviewTargets,
    dragRef,
    getScreenPoint,
    heldMoveRef,
    hideModelEraserPreview,
    invalidateRenderRef,
    isTransformInteractionActive,
    latestRef,
    marqueeRef,
    modelEraserRef,
    paintRef,
    resolvePointer,
    resolveSelectedModelHit,
    setMarqueeRect,
    updateActionZoneCursorMode,
    updateModelEraserPreview,
    updatePaintPreview,
  ]);

  const handlePointerUp = useCallback((event) => {
    const cameraZoomDrag = cameraZoomDragRef.current;
    if (event.button === 0 && cameraZoomDrag && cameraZoomDrag.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      cameraZoomDragRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      invalidateRenderRef.current({ followupFrames: 3 });
      return;
    }
    const heldMove = heldMoveRef.current;
    if (event.button === 0 && heldMove && heldMove.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      heldMoveRef.current = null;
      latestRef.current.onMoveHoldChange?.(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && isTransformInteractionActive()) {
      event.preventDefault();
      clickStartRef.current = null;
      return;
    }
    if (event.button === 0 && modelEraserRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      modelEraserRef.current = null;
      latestRef.current.onModelEraseEnd?.();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && paintRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      paintRef.current = null;
      latestRef.current.onWorldPaintEnd?.();
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && actionZoneVertexDragRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      clickStartRef.current = null;
      actionZoneVertexDragRef.current = null;
      updateActionZoneCursorMode('');
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && actionZoneEdgeDragRef.current?.pointerId === event.pointerId) {
      event.preventDefault();
      actionZoneEdgeDragRef.current = null;
      clickStartRef.current = null;
      updateActionZoneCursorMode('');
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      invalidateRenderRef.current({ followupFrames: 1 });
      return;
    }
    if (event.button === 0 && clickStartRef.current?.cameraTargetPick) {
      const start = clickStartRef.current;
      clickStartRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
      if (movement < 6 && isCameraTargetEntity(start.entity)) {
        const success = setCameraTargetFromEntity(start.entity);
        latestRef.current.onCameraTargetPick?.(start.entity, success);
      } else {
        latestRef.current.onCameraTargetPick?.(null, false);
      }
      return;
    }
    if (event.button === 0 && dragRef.current) {
      const drag = dragRef.current;
      const resolved = resolvePointer(event);
      dragRef.current = null;
      if (resolved) {
        const rawPoint = {
          x: resolved.point.x - drag.offsetX,
          y: resolved.point.y - drag.offsetY,
        };
        const point = latestRef.current.resolveWorldDragPoint?.(drag.entity, rawPoint) || rawPoint;
        latestRef.current.onWorldDrop?.(drag.entity, point);
      } else {
        resetDragPreview(drag);
      }
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      return;
    }
    if (event.button === 0 && marqueeRef.current) {
      const screenPoint = getScreenPoint(event);
      if (screenPoint) {
        marqueeRef.current.currentX = screenPoint.screenX;
        marqueeRef.current.currentY = screenPoint.screenY;
      }
      const rect = normalizeScreenRect(marqueeRef.current);
      const start = clickStartRef.current;
      const movement = Math.hypot(
        marqueeRef.current.currentX - marqueeRef.current.startX,
        marqueeRef.current.currentY - marqueeRef.current.startY,
      );
      marqueeRef.current = null;
      setMarqueeRect(null);
      clickStartRef.current = null;
      event.currentTarget.releasePointerCapture?.(event.pointerId);
      if (movement >= 6) {
        latestRef.current.onMarqueeSelect?.(getEntitiesInMarquee(rect));
      } else if (start && latestRef.current.mode !== 'play') {
        latestRef.current.onWorldClick?.(start.point, start.entity, event.button);
      }
      return;
    }
    if (event.button === 0) {
      const start = clickStartRef.current;
      clickStartRef.current = null;
      if (start) {
        const movement = Math.hypot(event.clientX - start.x, event.clientY - start.y);
        if (movement < 6) latestRef.current.onWorldClick?.(start.point, start.entity, event.button);
      }
    }
    if (event.button === 2) latestRef.current.onShootChange?.(false);
  }, [
    actionZoneEdgeDragRef,
    actionZoneVertexDragRef,
    cameraZoomDragRef,
    clickStartRef,
    dragRef,
    getEntitiesInMarquee,
    getScreenPoint,
    heldMoveRef,
    invalidateRenderRef,
    isTransformInteractionActive,
    latestRef,
    marqueeRef,
    modelEraserRef,
    paintRef,
    resetDragPreview,
    resolvePointer,
    setCameraTargetFromEntity,
    setMarqueeRect,
    updateActionZoneCursorMode,
  ]);

  return {
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    isTransformInteractionActive,
  };
}
