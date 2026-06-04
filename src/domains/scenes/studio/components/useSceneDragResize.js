import { createElement, useEffect, useRef, useState } from 'react';
import {
  clampPercent,
  getElementShapeCorners,
  getElementShapePoints,
  getElementShapeType,
} from '../../../../shared/services/sceneRender.js';

export function useSceneEditorDragResize({
  canvasRef,
  fullscreenCanvasRef,
  fullscreenContentRef,
  dragMovedRef,
  selectedScene,
  selectedSceneId,
  selectedHotspotIds,
  selectedSceneObjectIds,
  multiSelectEnabled,
  patchProject,
  rememberProjectState,
  snapValue,
  setSelectedHotspotId,
  setSelectedSceneObjectId,
  setSelectedVisualEffectZoneId,
  setSelectedItemId,
  setSelectedHotspotIds,
  setSelectedSceneObjectIds,
  getEditorElementByType,
  getAbsoluteShapeCorners,
  getAbsoluteShapePoints,
  applyShapePoints,
  getResizeHandleStyle,
}) {
  const draggingHotspotIdRef = useRef('');
  const draggingSceneObjectIdRef = useRef('');
  const draggingVisualEffectZoneIdRef = useRef('');
  const resizingElementRef = useRef(null);
  const dragSourceRef = useRef('main');
  const dragFrameRef = useRef(0);
  const pendingDragUpdateRef = useRef(null);
  const dragPreviewRef = useRef(null);
  const [draggingHotspotId, setDraggingHotspotId] = useState('');
  const [draggingSceneObjectId, setDraggingSceneObjectId] = useState('');
  const [draggingVisualEffectZoneId, setDraggingVisualEffectZoneId] = useState('');
  const [resizingElement, setResizingElement] = useState(null);
  const [isDragLocked, setIsDragLocked] = useState(false);

  const getCanvasPointerPosition = (clientX, clientY, source = 'main') => {
    const activeRef = source === 'fullscreen' ? (fullscreenContentRef || fullscreenCanvasRef) : canvasRef;
    if (!activeRef.current) return null;

    const rect = activeRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    return {
      x: clampPercent(snapValue(((clientX - rect.left) / rect.width) * 100)),
      y: clampPercent(snapValue(((clientY - rect.top) / rect.height) * 100)),
    };
  };

  const startDragPreview = (event, type, id, source, entry) => {
    dragPreviewRef.current = {
      type,
      id,
      source,
      element: event.currentTarget,
      latest: {
        x: Number(entry?.x) || 0,
        y: Number(entry?.y) || 0,
      },
    };
  };

  const previewDragPosition = (clientX, clientY, source = 'main') => {
    const preview = dragPreviewRef.current;
    if (!preview) return;
    const position = getCanvasPointerPosition(clientX, clientY, source);
    if (!position) return;
    dragMovedRef.current = true;
    preview.latest = position;
    if (preview.element?.style) {
      preview.element.style.left = `${Number(position.x.toFixed(2))}%`;
      preview.element.style.top = `${Number(position.y.toFixed(2))}%`;
    }
  };

  const commitDragPreview = () => {
    const preview = dragPreviewRef.current;
    dragPreviewRef.current = null;
    if (!preview?.latest || !selectedSceneId) return;
    const x = Number(preview.latest.x.toFixed(2));
    const y = Number(preview.latest.y.toFixed(2));

    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      if (!scene) return;

      if (preview.type === 'hotspot') {
        const spot = scene.hotspots?.find((h) => h.id === preview.id);
        if (!spot) return;
        const deltaX = x - spot.x;
        const deltaY = y - spot.y;
        const movedIds = multiSelectEnabled && selectedHotspotIds.includes(spot.id) ? selectedHotspotIds : [spot.id];
        scene.hotspots
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === spot.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === spot.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
        return;
      }

      if (preview.type === 'sceneObject') {
        const sceneObject = scene.sceneObjects?.find((obj) => obj.id === preview.id);
        if (!sceneObject) return;
        const deltaX = x - sceneObject.x;
        const deltaY = y - sceneObject.y;
        const movedIds = multiSelectEnabled && selectedSceneObjectIds.includes(sceneObject.id) ? selectedSceneObjectIds : [sceneObject.id];
        scene.sceneObjects
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === sceneObject.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === sceneObject.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
        return;
      }

      if (preview.type === 'visualEffectZone') {
        const visualZone = scene.visualEffectZones?.find((zone) => zone.id === preview.id);
        if (visualZone) {
          visualZone.x = x;
          visualZone.y = y;
        }
      }
    }, { rememberHistory: false });
  };

  const flushPendingDragUpdate = () => {
    if (dragFrameRef.current) {
      window.cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = 0;
    }
    const pending = pendingDragUpdateRef.current;
    pendingDragUpdateRef.current = null;
    if (!pending) return;
    if (pending.isResize) {
      updateElementSize(pending.clientX, pending.clientY);
      return;
    }
    previewDragPosition(pending.clientX, pending.clientY, pending.source);
  };

  const scheduleDragUpdate = (pending) => {
    pendingDragUpdateRef.current = pending;
    if (dragFrameRef.current) return;
    dragFrameRef.current = window.requestAnimationFrame(() => {
      dragFrameRef.current = 0;
      const nextPending = pendingDragUpdateRef.current;
      pendingDragUpdateRef.current = null;
      if (!nextPending) return;
      if (nextPending.isResize) {
        updateElementSize(nextPending.clientX, nextPending.clientY);
        return;
      }
      previewDragPosition(nextPending.clientX, nextPending.clientY, nextPending.source);
    });
  };

  const stopDragging = () => {
    flushPendingDragUpdate();
    commitDragPreview();
    draggingHotspotIdRef.current = '';
    draggingSceneObjectIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    setDraggingHotspotId('');
    setDraggingSceneObjectId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(false);
  };

  const stopResizing = () => {
    flushPendingDragUpdate();
    resizingElementRef.current = null;
    setResizingElement(null);
    setIsDragLocked(false);
  };

  const updateHotspotPosition = (clientX, clientY, source = 'main') => {
    const activeHotspotId = draggingHotspotIdRef.current || draggingHotspotId;
    const activeSceneObjectId = draggingSceneObjectIdRef.current || draggingSceneObjectId;
    const activeVisualEffectZoneId = draggingVisualEffectZoneIdRef.current || draggingVisualEffectZoneId;
    if ((!activeHotspotId && !activeSceneObjectId && !activeVisualEffectZoneId) || !selectedSceneId) return;
    dragMovedRef.current = true;

    const activeRef = source === 'fullscreen' ? (fullscreenContentRef || fullscreenCanvasRef) : canvasRef;
    if (!activeRef.current) return;

    const rect = activeRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const x = clampPercent(snapValue(((clientX - rect.left) / rect.width) * 100));
    const y = clampPercent(snapValue(((clientY - rect.top) / rect.height) * 100));

    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      const spot = scene?.hotspots?.find((h) => h.id === activeHotspotId);
      if (spot) {
        const deltaX = x - spot.x;
        const deltaY = y - spot.y;
        const movedIds = multiSelectEnabled && selectedHotspotIds.includes(spot.id) ? selectedHotspotIds : [spot.id];
        scene.hotspots
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === spot.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === spot.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
      }
      const sceneObject = scene?.sceneObjects?.find((obj) => obj.id === activeSceneObjectId);
      if (sceneObject) {
        const deltaX = x - sceneObject.x;
        const deltaY = y - sceneObject.y;
        const movedIds = multiSelectEnabled && selectedSceneObjectIds.includes(sceneObject.id) ? selectedSceneObjectIds : [sceneObject.id];
        scene.sceneObjects
          .filter((entry) => movedIds.includes(entry.id))
          .forEach((entry) => {
            entry.x = Number(clampPercent(entry.id === sceneObject.id ? x : snapValue(entry.x + deltaX)).toFixed(2));
            entry.y = Number(clampPercent(entry.id === sceneObject.id ? y : snapValue(entry.y + deltaY)).toFixed(2));
          });
      }
      const visualZone = scene?.visualEffectZones?.find((zone) => zone.id === activeVisualEffectZoneId);
      if (visualZone) {
        visualZone.x = Number(x.toFixed(2));
        visualZone.y = Number(y.toFixed(2));
      }
    }, { rememberHistory: false });
  };

  const updateElementSize = (clientX, clientY) => {
    const resizing = resizingElementRef.current;
    if (!resizing || !selectedSceneId) return;
    dragMovedRef.current = true;

    const activeRef = resizing.source === 'fullscreen' ? (fullscreenContentRef || fullscreenCanvasRef) : canvasRef;
    if (!activeRef.current) return;

    const rect = activeRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const pointerX = clampPercent(snapValue(((clientX - rect.left) / rect.width) * 100));
    const pointerY = clampPercent(snapValue(((clientY - rect.top) / rect.height) * 100));
    const minSize = 2;

    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      const entry = getEditorElementByType(scene, resizing.type, resizing.id);
      if (!entry) return;

      if (resizing.handle.startsWith('point-')) {
        const pointIndex = Number(resizing.handle.replace('point-', ''));
        const absolutePoints = resizing.start.absolutePoints.map((point) => ({ ...point }));
        if (absolutePoints[pointIndex]) {
          absolutePoints[pointIndex] = { x: pointerX, y: pointerY };
          applyShapePoints(entry, absolutePoints);
        }
        return;
      }

      if (getElementShapeType(entry) === 'free') {
        const absolutePoints = resizing.start.absolutePoints.map((point) => ({ ...point }));
        if (resizing.handle.length === 1) {
          const xs = resizing.start.absolutePoints.map((point) => point.x);
          const ys = resizing.start.absolutePoints.map((point) => point.y);
          const left = Math.min(...xs);
          const right = Math.max(...xs);
          const top = Math.min(...ys);
          const bottom = Math.max(...ys);
          absolutePoints.forEach((point) => {
            if (resizing.handle === 'e' && Math.abs(point.x - right) < 0.01) point.x = pointerX;
            if (resizing.handle === 'w' && Math.abs(point.x - left) < 0.01) point.x = pointerX;
            if (resizing.handle === 'n' && Math.abs(point.y - top) < 0.01) point.y = pointerY;
            if (resizing.handle === 's' && Math.abs(point.y - bottom) < 0.01) point.y = pointerY;
          });
        }
        applyShapePoints(entry, absolutePoints);
        return;
      }

      let left = resizing.start.x - resizing.start.width / 2;
      let right = resizing.start.x + resizing.start.width / 2;
      let top = resizing.start.y - resizing.start.height / 2;
      let bottom = resizing.start.y + resizing.start.height / 2;

      if (resizing.handle.includes('e')) right = Math.max(left + minSize, pointerX);
      if (resizing.handle.includes('w')) left = Math.min(right - minSize, pointerX);
      if (resizing.handle.includes('s')) bottom = Math.max(top + minSize, pointerY);
      if (resizing.handle.includes('n')) top = Math.min(bottom - minSize, pointerY);

      left = clampPercent(left);
      right = clampPercent(right);
      top = clampPercent(top);
      bottom = clampPercent(bottom);

      if (right - left < minSize) {
        if (resizing.handle.includes('w')) left = Math.max(0, right - minSize);
        else right = Math.min(100, left + minSize);
      }
      if (bottom - top < minSize) {
        if (resizing.handle.includes('n')) top = Math.max(0, bottom - minSize);
        else bottom = Math.min(100, top + minSize);
      }

      entry.x = Number(((left + right) / 2).toFixed(2));
      entry.y = Number(((top + bottom) / 2).toFixed(2));
      entry.width = Number((right - left).toFixed(2));
      entry.height = Number((bottom - top).toFixed(2));
      delete entry.shapeCorners;
      delete entry.shapePoints;
    }, { rememberHistory: false });
  };

  const beginResize = (event, type, id, handle, source = 'main') => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);

    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry || entry.isLocked) return;

    rememberProjectState?.();
    dragMovedRef.current = false;
    resizingElementRef.current = {
      type,
      id,
      handle,
      source,
      start: {
        x: Number(entry.x) || 0,
        y: Number(entry.y) || 0,
        width: Number(entry.width) || 2,
        height: Number(entry.height) || 2,
        shapeCorners: getElementShapeCorners(entry),
        absoluteCorners: getAbsoluteShapeCorners(entry),
        absolutePoints: getAbsoluteShapePoints(entry),
      },
    };
    setResizingElement({ type, id, handle });
    setIsDragLocked(true);
  };

  const renderResizeHandles = (type, id, isSelected, source = 'main') => {
    if (!isSelected) return null;
    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry) return null;
    return ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((handle) => (
      createElement('span', {
        key: handle,
        className: `editor-resize-handle editor-resize-handle-${handle}`,
        style: getResizeHandleStyle(entry, handle),
        'aria-hidden': 'true',
        onPointerDown: (event) => beginResize(event, type, id, handle, source),
      })
    ));
  };

  const renderShapePointHandles = (type, id, isSelected, source = 'main') => {
    if (!isSelected) return null;
    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry || getElementShapeType(entry) !== 'free') return null;
    return getElementShapePoints(entry).map((point, index) => (
      createElement('span', {
        key: `point-${index}`,
        className: 'editor-resize-handle editor-shape-point-handle',
        style: { left: `${point.x}%`, top: `${point.y}%` },
        'aria-hidden': 'true',
        onPointerDown: (event) => beginResize(event, type, id, `point-${index}`, source),
      })
    ));
  };

  const beginObjectDrag = (event, objectId, source = 'main') => {
    if (event.button !== 0) return;
    const object = selectedScene?.sceneObjects?.find((entry) => entry.id === objectId);
    if (object?.isLocked) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberProjectState?.();
    dragMovedRef.current = false;
    draggingSceneObjectIdRef.current = objectId;
    draggingHotspotIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    dragSourceRef.current = source;
    setDraggingSceneObjectId(objectId);
    setDraggingHotspotId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(true);
    setSelectedSceneObjectId(objectId);
    setSelectedHotspotId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    startDragPreview(event, 'sceneObject', objectId, source, object);
  };

  const beginVisualEffectZoneDrag = (event, zoneId, source = 'main') => {
    if (event.button !== 0) return;
    const zone = selectedScene?.visualEffectZones?.find((entry) => entry.id === zoneId);
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberProjectState?.();
    dragMovedRef.current = false;
    draggingVisualEffectZoneIdRef.current = zoneId;
    draggingHotspotIdRef.current = '';
    draggingSceneObjectIdRef.current = '';
    dragSourceRef.current = source;
    setDraggingVisualEffectZoneId(zoneId);
    setDraggingHotspotId('');
    setDraggingSceneObjectId('');
    setIsDragLocked(true);
    setSelectedVisualEffectZoneId(zoneId);
    setSelectedSceneObjectId('');
    setSelectedHotspotId('');
    setSelectedItemId('');
    setSelectedHotspotIds([]);
    setSelectedSceneObjectIds([]);
    startDragPreview(event, 'visualEffectZone', zoneId, source, zone);
  };

  const beginDrag = (event, spotId, source = 'main') => {
    if (event.button !== 0) return;
    const spot = selectedScene?.hotspots?.find((entry) => entry.id === spotId);
    if (spot?.isLocked) {
      event.stopPropagation();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    rememberProjectState?.();
    dragMovedRef.current = false;
    draggingHotspotIdRef.current = spotId;
    draggingSceneObjectIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    dragSourceRef.current = source;
    setDraggingHotspotId(spotId);
    setDraggingSceneObjectId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(true);
    setSelectedHotspotId(spotId);
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    startDragPreview(event, 'hotspot', spotId, source, spot);
  };

  useEffect(() => {
    if (!draggingHotspotId && !draggingSceneObjectId && !draggingVisualEffectZoneId && !resizingElement) return undefined;

    const handlePointerMove = (event) => {
      event.preventDefault();
      scheduleDragUpdate({
        clientX: event.clientX,
        clientY: event.clientY,
        source: dragSourceRef.current,
        isResize: Boolean(resizingElementRef.current),
      });
    };

    const handlePointerEnd = () => {
      flushPendingDragUpdate();
      if (resizingElementRef.current) stopResizing();
      else stopDragging();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      flushPendingDragUpdate();
    };
  }, [draggingHotspotId, draggingSceneObjectId, draggingVisualEffectZoneId, resizingElement]);

  return {
    draggingHotspotId,
    draggingSceneObjectId,
    draggingVisualEffectZoneId,
    isDragLocked,
    beginDrag,
    beginObjectDrag,
    beginVisualEffectZoneDrag,
    stopDragging,
    beginResize,
    stopResizing,
    updateHotspotPosition,
    updateElementSize,
    renderResizeHandles,
    renderShapePointHandles,
  };
}
