import { useEffect, useRef, useState } from 'react';
import {
  EditorToolbarMenus,
  HelpLabel,
  LayersPanel,
} from './scenes/SceneEditorChrome.jsx';
import Anime2DPreview from './Anime2DPreview.jsx';
import MediaSourcePicker from './MediaSourcePicker.jsx';
import SceneSidebar from './scenes/SceneSidebar.jsx';
import SceneFullscreenEditor from './scenes/SceneFullscreenEditor.jsx';
import HotspotAssetsPanel from './scenes/HotspotAssetsPanel.jsx';
import SceneObjectInspector, { SceneObjectBlockContent, getSceneObjectClickMode } from './scenes/SceneObjectInspector.jsx';
import QuickLogicModal from './scenes/QuickLogicModal.jsx';
import SceneVisualEffect, { VISUAL_EFFECT_INTENSITY_OPTIONS, getVisualEffectZoneZIndex } from './SceneVisualEffect.jsx';
import VisualEffectCascadeMenu from './VisualEffectCascadeMenu.jsx';
import { useSceneEditorCreation } from './scenes/useSceneEditorCreation.js';
import { useSceneEditorSceneState } from './scenes/useSceneEditorSceneState.js';
import { useSceneEditorShapes } from './scenes/useSceneEditorShapes.js';
import { useSceneFullscreenEditor } from './scenes/useSceneFullscreenEditor.js';
import { useSceneEditorSelection } from './scenes/useSceneEditorSelection.js';
import {
  clampFullscreenZoom,
  clampPercent,
  getElementShapeCorners,
  getElementShapePoints,
  getElementShapeStyle,
  getElementShapeType,
  getLayerZIndex,
  getSceneObjectStyle,
  gridOverlayStyle,
  shouldIgnoreEditorShortcut,
} from './scenes/sceneEditorUtils.js';

function useSceneEditorDragResize({
  canvasRef,
  fullscreenCanvasRef,
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
    const activeRef = source === 'fullscreen' ? fullscreenCanvasRef : canvasRef;
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

    const activeRef = source === 'fullscreen' ? fullscreenCanvasRef : canvasRef;
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

    const activeRef = resizing.source === 'fullscreen' ? fullscreenCanvasRef : canvasRef;
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
      <span
        key={handle}
        className={`editor-resize-handle editor-resize-handle-${handle}`}
        style={getResizeHandleStyle(entry, handle)}
        aria-hidden="true"
        onPointerDown={(event) => beginResize(event, type, id, handle, source)}
      />
    ));
  };

  const renderShapePointHandles = (type, id, isSelected, source = 'main') => {
    if (!isSelected) return null;
    const entry = getEditorElementByType(selectedScene, type, id);
    if (!entry || getElementShapeType(entry) !== 'free') return null;
    return getElementShapePoints(entry).map((point, index) => (
      <span
        key={`point-${index}`}
        className="editor-resize-handle editor-shape-point-handle"
        style={{ left: `${point.x}%`, top: `${point.y}%` }}
        aria-hidden="true"
        onPointerDown={(event) => beginResize(event, type, id, `point-${index}`, source)}
      />
    ));
  };

  const beginObjectDrag = (event, objectId, source = 'main') => {
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

function useSceneEditorCommands({
  selectedSceneId,
  activeSelectionCount,
  selectedEditorType,
  activeHotspotIds,
  activeSceneObjectIds,
  selectedVisualEffectZoneId,
  setSelectedHotspotId,
  setSelectedHotspotIds,
  setSelectedSceneObjectId,
  setSelectedSceneObjectIds,
  setSelectedVisualEffectZoneId,
  patchProject,
  snapValue,
  isEditorFullscreen,
  closeEditorFullscreen,
  setClampedFullscreenZoom,
  setSnapGridEnabled,
  setMultiSelectEnabled,
  undoProjectChange,
  redoProjectChange,
}) {
  const getActiveEditorSelection = (scene) => {
    if (!scene) return { type: '', ids: [], items: [] };
    const sceneObjects = scene.sceneObjects || [];
    const objectIds = activeSceneObjectIds.filter((id) => sceneObjects.some((entry) => entry.id === id));
    if (objectIds.length) {
      return {
        type: 'sceneObject',
        ids: objectIds,
        items: sceneObjects.filter((entry) => objectIds.includes(entry.id)),
      };
    }
    const hotspotIds = activeHotspotIds.filter((id) => (scene.hotspots || []).some((entry) => entry.id === id));
    if (hotspotIds.length) {
      return {
        type: 'hotspot',
        ids: hotspotIds,
        items: (scene.hotspots || []).filter((entry) => hotspotIds.includes(entry.id)),
      };
    }
    return { type: '', ids: [], items: [] };
  };

  const duplicateSelectedEditorItems = () => {
    if (!selectedSceneId || !activeSelectionCount) return;
    const nextIds = [];
    const selectionType = selectedEditorType;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      const sourceItems = getActiveEditorSelection(scene).items;
      if (!sourceItems.length) return;
      sourceItems.forEach((entry) => {
        const nextId = `${selectionType === 'hotspot' ? 'hotspot' : 'scene-object'}-${Math.random().toString(36).slice(2, 10)}`;
        nextIds.push(nextId);
        const duplicate = {
          ...entry,
          id: nextId,
          name: `${entry.name || (selectionType === 'hotspot' ? 'Zone' : 'Objet')} copie`,
          x: Number(clampPercent((entry.x || 50) + 3).toFixed(2)),
          y: Number(clampPercent((entry.y || 50) + 3).toFixed(2)),
          isHidden: false,
          isLocked: false,
          zIndex: getLayerZIndex(entry, selectionType) + 1,
        };
        if (selectionType === 'hotspot') scene.hotspots.push(duplicate);
        else {
          if (!Array.isArray(scene.sceneObjects)) scene.sceneObjects = [];
          scene.sceneObjects.push(duplicate);
        }
      });
    });
    if (!nextIds.length) return;
    if (selectionType === 'hotspot') {
      setSelectedHotspotId(nextIds[0]);
      setSelectedHotspotIds(nextIds);
      setSelectedSceneObjectId('');
      setSelectedSceneObjectIds([]);
      return;
    }
    setSelectedSceneObjectId(nextIds[0]);
    setSelectedSceneObjectIds(nextIds);
    setSelectedHotspotId('');
    setSelectedHotspotIds([]);
  };

  const deleteSelectedEditorItems = () => {
    if (!selectedSceneId || !activeSelectionCount) return;
    const selectionType = selectedEditorType;
    const labels = {
      sceneObject: activeSceneObjectIds.length > 1 ? `${activeSceneObjectIds.length} objets visibles` : 'cet objet visible',
      visualEffectZone: 'cette zone visuelle',
      hotspot: activeHotspotIds.length > 1 ? `${activeHotspotIds.length} zones d'action` : "cette zone d'action",
    };
    if (!window.confirm(`Supprimer ${labels[selectionType] || 'la selection'} ?`)) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (selectionType === 'sceneObject') {
        scene.sceneObjects = (scene.sceneObjects || []).filter((entry) => !activeSceneObjectIds.includes(entry.id));
        return;
      }
      if (selectionType === 'visualEffectZone') {
        scene.visualEffectZones = (scene.visualEffectZones || []).filter((entry) => entry.id !== selectedVisualEffectZoneId);
        return;
      }
      if (selectionType === 'hotspot') {
        scene.hotspots = (scene.hotspots || []).filter((entry) => !activeHotspotIds.includes(entry.id));
      }
    });
    if (selectionType === 'sceneObject') {
      setSelectedSceneObjectId('');
      setSelectedSceneObjectIds([]);
      return;
    }
    if (selectionType === 'visualEffectZone') {
      setSelectedVisualEffectZoneId('');
      return;
    }
    if (selectionType === 'hotspot') {
      setSelectedHotspotId('');
      setSelectedHotspotIds([]);
    }
  };

  const patchLayerItem = (type, id, updater) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      const list = type === 'hotspot' ? scene.hotspots : (scene.sceneObjects || []);
      const item = list.find((entry) => entry.id === id);
      if (item) updater(item);
    });
  };

  const nudgeLayerZIndex = (type, id, direction) => {
    patchLayerItem(type, id, (item) => {
      item.zIndex = getLayerZIndex(item, type) + direction;
    });
  };

  const sendLayerToEdge = (type, id, edge) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      const allLayers = [
        ...(scene.sceneObjects || []).map((entry) => ({ entry, type: 'sceneObject' })),
        ...(scene.hotspots || []).map((entry) => ({ entry, type: 'hotspot' })),
      ];
      const target = allLayers.find((layer) => layer.type === type && layer.entry.id === id)?.entry;
      if (!target) return;
      const zValues = allLayers.map((layer) => getLayerZIndex(layer.entry, layer.type));
      target.zIndex = edge === 'front' ? Math.max(...zValues, 0) + 1 : Math.min(...zValues, 0) - 1;
    });
  };

  const alignSelectedEditorItems = (command) => {
    if (!selectedSceneId) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      const selection = getActiveEditorSelection(scene);
      if (selection.items.length < 2) return;

      if (command === 'same-size') {
        const reference = selection.items[0];
        selection.items.slice(1).forEach((entry) => {
          entry.width = reference.width;
          entry.height = reference.height;
        });
        return;
      }

      if (command === 'distribute-horizontal') {
        if (selection.items.length < 3) return;
        const sorted = [...selection.items].sort((a, b) => a.x - b.x);
        const firstX = sorted[0].x;
        const lastX = sorted[sorted.length - 1].x;
        const step = (lastX - firstX) / (sorted.length - 1);
        sorted.forEach((entry, index) => {
          entry.x = Number(clampPercent(snapValue(firstX + step * index)).toFixed(2));
        });
        return;
      }

      if (command === 'left') {
        const left = Math.min(...selection.items.map((entry) => entry.x - entry.width / 2));
        selection.items.forEach((entry) => {
          entry.x = Number(clampPercent(snapValue(left + entry.width / 2)).toFixed(2));
        });
        return;
      }

      if (command === 'center') {
        const center = selection.items.reduce((sum, entry) => sum + entry.x, 0) / selection.items.length;
        selection.items.forEach((entry) => {
          entry.x = Number(clampPercent(snapValue(center)).toFixed(2));
        });
        return;
      }

      if (command === 'right') {
        const right = Math.max(...selection.items.map((entry) => entry.x + entry.width / 2));
        selection.items.forEach((entry) => {
          entry.x = Number(clampPercent(snapValue(right - entry.width / 2)).toFixed(2));
        });
      }
    });
  };

  useEffect(() => {
    if (!selectedSceneId) return undefined;

    const handleEditorKeyDown = (event) => {
      if (shouldIgnoreEditorShortcut(event)) return;
      const key = event.key.toLowerCase();

      if (event.ctrlKey || event.metaKey) {
        if (key === 'd') {
          event.preventDefault();
          duplicateSelectedEditorItems();
          return;
        }
        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) redoProjectChange?.();
          else undoProjectChange?.();
          return;
        }
        if (key === 'y') {
          event.preventDefault();
          redoProjectChange?.();
          return;
        }
      }

      if (event.altKey || event.ctrlKey || event.metaKey) return;

      if (key === 'escape') {
        if (isEditorFullscreen) {
          event.preventDefault();
          closeEditorFullscreen();
        }
        return;
      }

      if (key === 'delete' || key === 'backspace') {
        if (!activeSelectionCount) return;
        event.preventDefault();
        deleteSelectedEditorItems();
        return;
      }

      if (key === 'g') {
        event.preventDefault();
        setSnapGridEnabled((value) => !value);
        return;
      }

      if (key === 'm') {
        event.preventDefault();
        setMultiSelectEnabled((value) => !value);
        return;
      }

      if ((event.key === '+' || event.key === '=' || event.key === '-') && isEditorFullscreen) {
        event.preventDefault();
        setClampedFullscreenZoom((value) => value + (event.key === '-' ? -0.1 : 0.1));
      }
    };

    window.addEventListener('keydown', handleEditorKeyDown);
    return () => window.removeEventListener('keydown', handleEditorKeyDown);
  }, [
    selectedSceneId,
    isEditorFullscreen,
    activeSelectionCount,
    selectedEditorType,
    activeHotspotIds,
    activeSceneObjectIds,
    undoProjectChange,
    redoProjectChange,
    patchProject,
  ]);

  return {
    duplicateSelectedEditorItems,
    deleteSelectedEditorItems,
    alignSelectedEditorItems,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  };
}

export default function ScenesTab(props) {
  const {
    project,
    actsWithScenes,
    addAct,
    deleteAct,
    addScene,
    addItem,
    selectedItemId,
    setSelectedItemId,
    selectedItem,
    selectedScene,
    selectedSceneId,
    setSelectedSceneId,
    setTab,
    deleteScene,
    previewScene,
    patchProject,
    rememberProjectState,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange,
    canRedoProjectChange,
    selectedHotspotId,
    setSelectedHotspotId,
    handleUpload,
    mediaLibrary = [],
    getActById,
    getSceneById,
    getSceneDepth,
    addSubsceneToSelectedScene,
    childScenes,
    addHotspot,
    selectedHotspot,
    deleteItem,
    deleteHotspot,
    getSceneLabel,
    collapsedNavigationActIds,
    setNavigationActCollapsed,
    collapsedNavigationSceneIds,
    toggleNavigationSceneCollapsed,
  } = props;

  const canvasRef = useRef(null);
  const fullscreenViewportRef = useRef(null);
  const fullscreenCanvasRef = useRef(null);
  const dragMovedRef = useRef(false);
  const [snapGridEnabled, setSnapGridEnabled] = useState(false);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [isMiniMapCollapsed, setIsMiniMapCollapsed] = useState(false);
  const {
    isEditorFullscreen,
    fullscreenZoom,
    fullscreenPan,
    minimapViewport,
    isPanningFullscreen,
    setClampedFullscreenZoom,
    enterEditorFullscreen,
    closeEditorFullscreen,
    resetFullscreenView,
    handleFullscreenWheel,
    beginFullscreenPan,
    moveFullscreenPan,
    stopFullscreenPan,
  } = useSceneFullscreenEditor({
    fullscreenViewportRef,
    fullscreenCanvasRef,
  });
  const {
    selectedSceneObjectId,
    setSelectedSceneObjectId,
    selectedVisualEffectZoneId,
    setSelectedVisualEffectZoneId,
    selectedHotspotIds,
    setSelectedHotspotIds,
    selectedSceneObjectIds,
    setSelectedSceneObjectIds,
    activeHotspotIds,
    activeSceneObjectIds,
    activeVisualEffectZoneIds,
    activeSelectionCount,
    selectHotspot,
    selectSceneObject,
    selectVisualEffectZone,
  } = useSceneEditorSelection({
    dragMovedRef,
    multiSelectEnabled,
    selectedHotspotId,
    setSelectedHotspotId,
    setSelectedItemId,
  });

  const selectedEditorType = activeVisualEffectZoneIds.length ? 'visualEffectZone' : (activeSceneObjectIds.length ? 'sceneObject' : (activeHotspotIds.length ? 'hotspot' : ''));
  const snapValue = (value) => (snapGridEnabled ? Math.round(value / 5) * 5 : value);
  const {
    quickLogicTarget,
    setQuickLogicTarget,
    selectedSceneObject,
    selectedVisualEffectZone,
    sceneAspectRatio,
    getLinkedItem,
    getSceneObjectDisplayImage,
    openQuickLogicForTarget,
    importSceneObjectAnime2d,
    toggleSceneChildren,
    selectSceneFromTree,
    selectSceneInFullscreen,
    selectActInFullscreen,
    rememberSceneBackgroundAspectRatio,
    updateSceneBackground,
  } = useSceneEditorSceneState({
    project,
    selectedScene,
    selectedSceneId,
    selectedSceneObjectId,
    selectedVisualEffectZoneId,
    selectedHotspotId,
    setSelectedSceneId,
    setSelectedHotspotId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    setSelectedItemId,
    patchProject,
    toggleNavigationSceneCollapsed,
  });

  const {
    getEditorElementByType,
    getAbsoluteShapeCorners,
    getAbsoluteShapePoints,
    applyShapePoints,
    renderShapeOutline,
    getShapeClassName,
    getResizeHandleStyle,
    renderShapeControls,
  } = useSceneEditorShapes({
    selectedScene,
    selectedSceneId,
    patchProject,
  });

  const {
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
  } = useSceneEditorDragResize({
    canvasRef,
    fullscreenCanvasRef,
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
  });

  const {
    addSceneObject,
    addInvisibleSceneObject,
    addAnimationObject,
    addInteractiveBlock,
    addVisualEffectZone,
  } = useSceneEditorCreation({
    project,
    selectedSceneId,
    selectedItem,
    selectedItemId,
    setSelectedSceneObjectId,
    setSelectedVisualEffectZoneId,
    setSelectedHotspotId,
    setSelectedItemId,
    setSelectedHotspotIds,
    setSelectedSceneObjectIds,
    patchProject,
  });

  const {
    duplicateSelectedEditorItems,
    deleteSelectedEditorItems,
    alignSelectedEditorItems,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  } = useSceneEditorCommands({
    selectedSceneId,
    activeSelectionCount,
    selectedEditorType,
    activeHotspotIds,
    activeSceneObjectIds,
    selectedVisualEffectZoneId,
    setSelectedHotspotId,
    setSelectedHotspotIds,
    setSelectedSceneObjectId,
    setSelectedSceneObjectIds,
    setSelectedVisualEffectZoneId,
    patchProject,
    snapValue,
    isEditorFullscreen,
    closeEditorFullscreen,
    setClampedFullscreenZoom,
    setSnapGridEnabled,
    setMultiSelectEnabled,
    undoProjectChange,
    redoProjectChange,
  });

  const editorToolbarProps = {
    selectedSceneId,
    previewScene,
    deleteScene,
    closeEditorFullscreen,
    undoProjectChange,
    redoProjectChange,
    canUndoProjectChange,
    canRedoProjectChange,
    duplicateSelectedEditorItems,
    activeSelectionCount,
    multiSelectEnabled,
    setMultiSelectEnabled,
    deleteSelectedEditorItems,
    alignSelectedEditorItems,
    enterEditorFullscreen,
    setFullscreenZoom: setClampedFullscreenZoom,
    clampFullscreenZoom,
    resetFullscreenView,
    snapGridEnabled,
    setSnapGridEnabled,
    addHotspot,
    addSceneObject,
    addAnimationObject,
    addInvisibleSceneObject,
    addInteractiveBlock,
    addVisualEffectZone,
  };

  const layersPanelProps = {
    selectedScene,
    activeSceneObjectIds,
    activeHotspotIds,
    setSelectedSceneObjectId,
    setSelectedSceneObjectIds,
    setSelectedHotspotId,
    setSelectedHotspotIds,
    setSelectedItemId,
    getLayerZIndex,
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  };

  const miniMapProps = {
    selectedScene,
    activeSceneObjectIds,
    activeHotspotIds,
    minimapViewport,
    clampPercent,
    isCollapsed: isMiniMapCollapsed,
    setIsCollapsed: setIsMiniMapCollapsed,
  };

  return (
    <div className="layout scenes-layout-pro ultra-editor">
      <SceneSidebar
        project={project}
        actsWithScenes={actsWithScenes}
        addAct={addAct}
        deleteAct={deleteAct}
        addScene={addScene}
        addItem={addItem}
        selectedItemId={selectedItemId}
        setSelectedItemId={setSelectedItemId}
        selectedItem={selectedItem}
        selectedSceneId={selectedSceneId}
        collapsedActIds={collapsedNavigationActIds}
        setActCollapsed={setNavigationActCollapsed}
        collapsedSceneIds={collapsedNavigationSceneIds}
        toggleSceneChildren={toggleSceneChildren}
        selectSceneFromTree={selectSceneFromTree}
      />

      <section className="panel main panel-main-pro">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Édition</span>
            <h2>Éditeur de scene</h2>
          </div>
          {selectedScene ? <span className="status-badge soft">{getActById(selectedScene.actId)?.name || 'Sans acte'}</span> : null}
        </div>

        {selectedScene ? (
          <div className="editor-stack">
            <div className="subpanel scene-compact-card">
                <div className="subpanel-head">
                  <h3>Général & structure</h3>
                  <div className="inline-actions end">
                    <button type="button" className="secondary-action" data-tour="scene-preview-button" onClick={() => previewScene?.(selectedSceneId)}>
                      Prévisualiser
                    </button>
                    <button type="button" className="danger-button" onClick={() => deleteScene(selectedSceneId)}>
                      Supprimer
                    </button>
                  </div>
                </div>
                <div className="scene-compact-grid">
                  <div data-tour="scene-name">
                    <HelpLabel help="Nom affiché dans la navigation de l’éditeur et dans les listes de choix. Garde-le court si plusieurs scenes se ressemblent.">Nom de la scene</HelpLabel>
                    <input value={selectedScene.name} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.name = e.target.value;
                    })} />
                  </div>
                  <div data-tour="scene-act">
                    <HelpLabel help="Regroupe la scene dans un chapitre. Changer d’acte peut retirer une scene parente qui n’appartient plus au même acte.">Acte</HelpLabel>
                    <select value={selectedScene.actId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                      if (scene) {
                        scene.actId = e.target.value;
                        if (scene.parentSceneId) {
                          const parent = draft.scenes.find((s) => s.id === scene.parentSceneId);
                          if (parent && parent.actId !== e.target.value) scene.parentSceneId = '';
                        }
                      }
                    })}>
                      {project.acts.map((act) => <option key={act.id} value={act.id}>{act.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <HelpLabel help="Transforme cette scene en sous-scene d’une autre. Utile pour les gros plans, tiroirs, portes ou variantes d’une même piece.">Scene parente</HelpLabel>
                    <select value={selectedScene.parentSceneId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.parentSceneId = e.target.value;
                    })}>
                      <option value="">Scene principale</option>
                      {project.scenes.filter((scene) => scene.id !== selectedSceneId && scene.actId === selectedScene.actId).map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneDepth(scene) ? '— '.repeat(getSceneDepth(scene)) : ''}{scene.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="scene-intro-field" data-tour="scene-intro">
                    <HelpLabel help="Texte montré à l’entrée de la scene, avant que le joueur interagisse. Sert à poser l’ambiance ou l’objectif local.">Texte d’introduction</HelpLabel>
                    <input value={selectedScene.introText} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.introText = e.target.value;
                    })} />
                  </div>
                </div>
              </div>

            <div className="subpanel canvas-subpanel">
              <div className="subpanel-head">
                <div>
                  <h3>Plan de scene</h3>
                </div>
                <div className="editor-toolbar-wrap">
                  <EditorToolbarMenus {...editorToolbarProps} />
                </div>
              </div>

              <div className="preview-editor" data-tour="scene-canvas">
                <div className="scene-canvas-column">
                  <div
                    ref={canvasRef}
                    className="editor-canvas editor-canvas-pro"
                    style={{ aspectRatio: sceneAspectRatio }}
                    onPointerUp={stopDragging}
                    onPointerCancel={stopDragging}
                  >
                  {selectedScene.backgroundData ? <img src={selectedScene.backgroundData} alt="fond" onLoad={(event) => rememberSceneBackgroundAspectRatio(event.currentTarget)} /> : <div className="placeholder">Ajoute une image de scene</div>}
                  <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                  {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      data-tour={zone.tutorialCreated ? 'visual-zone-on-canvas' : undefined}
                      className={`editor-hotspot editor-visual-zone ${getShapeClassName(zone)} ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
                      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, zIndex: getVisualEffectZoneZIndex(zone.layer), ...getElementShapeStyle(zone) }}
                      onPointerDown={(event) => beginVisualEffectZoneDrag(event, zone.id)}
                      onClick={() => selectVisualEffectZone(zone.id)}
                    >
                      <SceneVisualEffect effect={zone.effect} intensity={zone.intensity} />
                      <span>{zone.name}</span>
                      {renderShapeOutline(zone, zone.id === selectedVisualEffectZoneId)}
                      {renderResizeHandles('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId)}
                      {renderShapePointHandles('visualEffectZone', zone.id, zone.id === selectedVisualEffectZoneId)}
                    </button>
                  ))}
                  {snapGridEnabled ? <div style={gridOverlayStyle} /> : null}
                  {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      data-tour={obj.tutorialCreated ? 'scene-object-on-canvas' : undefined}
                      className={`editor-hotspot editor-scene-object ${getShapeClassName(obj)} ${obj.isInvisible ? 'editor-scene-object-invisible' : ''} ${(obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id)) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                      style={getSceneObjectStyle(obj)}
                      onPointerDown={(event) => beginObjectDrag(event, obj.id)}
                      onClick={(event) => selectSceneObject(obj.id, event)}
                    >
                      {obj.anime2dSpec && !obj.isInvisible ? (
                        <Anime2DPreview spec={obj.anime2dSpec} />
                      ) : !obj.isInvisible ? (
                        <SceneObjectBlockContent object={obj} displayImage={getSceneObjectDisplayImage(obj)} linkedItem={getLinkedItem(obj.linkedItemId)} />
                      ) : <span>{`${obj.name || 'Objet'} (invisible)`}</span>}
                      {renderShapeOutline(obj, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                      {renderResizeHandles('sceneObject', obj.id, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                      {renderShapePointHandles('sceneObject', obj.id, obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id))}
                    </button>
                  ))}
                  {selectedScene.hotspots.filter((spot) => !spot.isHidden).map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      data-tour={spot.tutorialCreated ? 'hotspot-on-canvas' : undefined}
                      className={`editor-hotspot ${getShapeClassName(spot)} ${(spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id)) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot'), ...getElementShapeStyle(spot) }}
                      onPointerDown={(event) => beginDrag(event, spot.id)}
                      onClick={(event) => selectHotspot(spot.id, event)}
                    >
                      <span>{spot.name}</span>
                      {renderShapeOutline(spot, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                      {renderResizeHandles('hotspot', spot.id, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                      {renderShapePointHandles('hotspot', spot.id, spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id))}
                    </button>
                  ))}
                  </div>
                  {selectedHotspot ? (
                    <HotspotAssetsPanel
                      selectedHotspot={selectedHotspot}
                      selectedSceneId={selectedSceneId}
                      selectedHotspotId={selectedHotspotId}
                      patchProject={patchProject}
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      className="hotspot-assets-below-canvas"
                    />
                  ) : null}
                </div>
                <section className="panel side panel-context-pro side-editor side-editor-pro" data-tour="selected-zone-panel" style={{ margin: 0, overflow: 'auto' }}>
                  <div className="panel-head panel-head-stack">
                    <div>
                      <span className="section-kicker">Contexte</span>
                      <h2>{selectedItem ? 'Objet selectionné' : selectedSceneObject ? ((selectedSceneObject.anime2dSpec || selectedSceneObject.anime2dName || selectedSceneObject.name === 'Animation') ? 'Animation selectionnée' : selectedSceneObject.isInvisible ? 'Objet invisible selectionné' : (getSceneObjectClickMode(selectedSceneObject) === 'action' ? "Zone d'action selectionnée" : 'Objet visible selectionné')) : selectedVisualEffectZone ? 'Zone visuelle selectionnée' : 'Zone selectionnée'}</h2>
                    </div>
                  </div>

                  {selectedItem ? (
                    <>
                      <div className="icon-preview inventory-object-preview">{selectedItem.imageData ? <img src={selectedItem.imageData} alt={selectedItem.name} /> : <span>{selectedItem.icon || '📦'}</span>}</div>
                      <HelpLabel help="Nom de l’objet dans l’inventaire. C’est le libellé que le joueur voit lorsqu’il obtient ou consulte cet objet.">Nom de l’objet</HelpLabel>
                      <input data-tour="object-name" value={selectedItem.name} onChange={(e) => patchProject((draft) => {
                        const item = draft.items.find((entry) => entry.id === selectedItemId);
                        if (item) item.name = e.target.value;
                      })} />
                      <HelpLabel help="Image utilisée comme miniature d’inventaire. Si elle est absente, l’emoji de secours est utilisé à la place.">Image de l’objet</HelpLabel>
                      <MediaSourcePicker
                        className="button like full secondary-action"
                        accept="image/*"
                        handleUpload={handleUpload}
                        mediaLibrary={mediaLibrary}
                        onSelect={(data, name) => patchProject((draft) => {
                          const item = draft.items.find((entry) => entry.id === selectedItemId);
                          if (item) {
                            item.imageData = data;
                            item.imageName = name;
                          }
                        })}
                        tourId="object-image"
                      >
                        {selectedItem.imageName || 'Importer une image objet'}
                      </MediaSourcePicker>
                      <HelpLabel help="Symbole affiché quand aucune image d’inventaire n’est fournie, ou comme repère visuel léger dans les listes.">Emoji de secours</HelpLabel>
                      <input value={selectedItem.icon} onChange={(e) => patchProject((draft) => {
                        const item = draft.items.find((entry) => entry.id === selectedItemId);
                        if (item) item.icon = e.target.value;
                      })} />
                      <p className="small-note">Conseil : choisis une image lisible en petit format, avec un fond simple si possible.</p>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        deleteItem(selectedItemId);
                        setSelectedItemId('');
                      }}>Supprimer l’objet</button>
                    </>
                  ) : selectedSceneObject ? (
                    <SceneObjectInspector
                      project={project}
                      selectedSceneId={selectedSceneId}
                      selectedSceneObject={selectedSceneObject}
                      selectedSceneObjectId={selectedSceneObjectId}
                      patchProject={patchProject}
                      renderShapeControls={renderShapeControls}
                      handleUpload={handleUpload}
                      mediaLibrary={mediaLibrary}
                      importSceneObjectAnime2d={importSceneObjectAnime2d}
                      getSceneLabel={getSceneLabel}
                      setSelectedSceneObjectId={setSelectedSceneObjectId}
                      onOpenLogic={() => openQuickLogicForTarget('sceneObject', selectedSceneObjectId)}
                    />
                  ) : selectedVisualEffectZone ? (
                    <>
                      <HelpLabel help="Nom interne de la zone visuelle. Il aide à la retrouver dans les calques et dans l'éditeur.">Nom</HelpLabel>
                      <input value={selectedVisualEffectZone.name} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.name = e.target.value;
                      })} />
                      <div className="grid-two small-gap">
                        <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l'image.">X</HelpLabel><input type="number" value={selectedVisualEffectZone.x} onChange={(e) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.x = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l'image.">Y</HelpLabel><input type="number" value={selectedVisualEffectZone.y} onChange={(e) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.y = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Largeur de la zone d'effet, en pourcentage de la largeur de la scene.">Largeur</HelpLabel><input type="number" value={selectedVisualEffectZone.width} onChange={(e) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.width = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Hauteur de la zone d'effet, en pourcentage de la hauteur de la scene.">Hauteur</HelpLabel><input type="number" value={selectedVisualEffectZone.height} onChange={(e) => patchProject((draft) => { const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId); if (zone) zone.height = Number(e.target.value); })} /></div>
                      </div>
                      {renderShapeControls('visualEffectZone', selectedVisualEffectZoneId)}
                      <HelpLabel help="Effet visuel applique uniquement dans cette zone. Ce menu reprend les mêmes familles que l'onglet Média.">Effet de zone</HelpLabel>
                      <div className="scene-zone-effect-picker" data-tour="visual-zone-effect">
                        <VisualEffectCascadeMenu
                          value={selectedVisualEffectZone.effect || 'sparkles'}
                          onChange={(nextEffect) => patchProject((draft) => {
                            const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                            if (zone) zone.effect = nextEffect;
                          })}
                        />
                      </div>
                      <HelpLabel help="Force de l'effet dans cette zone.">Intensite</HelpLabel>
                      <select value={selectedVisualEffectZone.intensity || 'normal'} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.intensity = e.target.value;
                      })}>
                        {VISUAL_EFFECT_INTENSITY_OPTIONS.map((intensity) => (
                          <option key={intensity.value} value={intensity.value}>{intensity.label}</option>
                        ))}
                      </select>
                      <HelpLabel help="Plan d'affichage de l'effet par rapport aux autres elements de la scene.">Calque</HelpLabel>
                      <select value={selectedVisualEffectZone.layer || 'behind'} onChange={(e) => patchProject((draft) => {
                        const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                        if (zone) zone.layer = e.target.value;
                      })}>
                        <option value="behind">Arriere-plan</option>
                        <option value="between">Entre objets et zones</option>
                        <option value="front">Premier plan</option>
                      </select>
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedVisualEffectZone.isHidden)}
                          onChange={(e) => patchProject((draft) => {
                            const zone = draft.scenes.find((s) => s.id === selectedSceneId)?.visualEffectZones?.find((entry) => entry.id === selectedVisualEffectZoneId);
                            if (zone) zone.isHidden = e.target.checked;
                          })}
                        />
                        Masquer cette zone
                      </label>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        if (!window.confirm(`Supprimer la zone visuelle "${selectedVisualEffectZone.name}" ?`)) return;
                        patchProject((draft) => {
                          const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                          if (!scene?.visualEffectZones) return;
                          scene.visualEffectZones = scene.visualEffectZones.filter((entry) => entry.id !== selectedVisualEffectZoneId);
                        });
                        setSelectedVisualEffectZoneId('');
                      }}>Supprimer la zone visuelle</button>
                    </>
                  ) : selectedHotspot ? (
                    <>
                      <HelpLabel help="Nom de la zone d’action dans l’éditeur. Choisis un nom qui décrit l’intention, par exemple “Porte verrouillée”.">Nom</HelpLabel>
                      <input data-tour="hotspot-name" value={selectedHotspot.name} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.name = e.target.value;
                      })} />
                      <div className="grid-two small-gap" data-tour="hotspot-geometry">
                        <div><HelpLabel help="Position horizontale du centre de la zone, en pourcentage de la largeur de l’image.">X</HelpLabel><input type="number" value={selectedHotspot.x} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.x = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Position verticale du centre de la zone, en pourcentage de la hauteur de l’image.">Y</HelpLabel><input type="number" value={selectedHotspot.y} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.y = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Largeur de la zone cliquable. Augmente-la si le joueur risque de manquer la cible.">Largeur</HelpLabel><input type="number" value={selectedHotspot.width} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.width = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Hauteur de la zone cliquable. Une zone trop petite peut être difficile à trouvér sur mobile.">Hauteur</HelpLabel><input type="number" value={selectedHotspot.height} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.height = Number(e.target.value); })} /></div>
                      </div>
                      {renderShapeControls('hotspot', selectedHotspotId)}
                      <button type="button" className="secondary-action full" onClick={() => openQuickLogicForTarget('hotspot', selectedHotspotId)}>
                        Logique
                      </button>
                      <HelpLabel help="Action principale déclénchée par cette zone après validation des prérequis éventuels : dialogue, objet, changement de scene ou cinematic.">Action</HelpLabel>
                      <select data-tour="hotspot-action" value={selectedHotspot.actionType} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.actionType = e.target.value;
                      })}>
                        <option value="dialogue">Dialogue</option>
                        <option value="dialogue_item">Dialogue + objet</option>
                        <option value="scene">Changer de scene</option>
                        <option value="cinematic">Lancer une cinematic</option>
                      </select>
                      <HelpLabel help="Texte affiché lors de l’interaction principale. Il peut donner une réaction, un indice ou confirmer une action réussie.">Dialogue</HelpLabel>
                      <textarea data-tour="hotspot-dialogue" value={selectedHotspot.dialogue} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.dialogue = e.target.value;
                      })} />
                      <HelpLabel help="Destination utilisée si l’action est “Changer de scene”. Laisse vide si la zone doit seulement parler ou donner un objet.">Scene cible</HelpLabel>
                      <select data-tour="hotspot-target-scene" value={selectedHotspot.targetSceneId} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetSceneId = e.target.value;
                      })}>
                        <option value="">Aucune</option>
                        {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                      </select>
                      <HelpLabel help="Cinematic lancée après l’interaction réussie. Elle peut servir de transition, révélation ou fin de sequence.">Cinematic cible</HelpLabel>
                      <select data-tour="hotspot-target-cinematic" value={selectedHotspot.targetCinematicId} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetCinematicId = e.target.value;
                      })}>
                        <option value="">Aucune</option>
                        {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                      </select>
                      <HelpLabel help="Enigme à résoudre avant d’exécuter l’action de la zone. Si elle échoue ou reste ouverte, la suite ne se déclénche pas encore.">Enigme liée</HelpLabel>
                      <select data-tour="hotspot-linked-enigma" value={selectedHotspot.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.enigmaId = e.target.value;
                      })}>
                        <option value="">Aucune</option>
                        {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                      </select>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        if (!window.confirm(`Supprimer la zone "${selectedHotspot.name}" ?`)) return;
                        deleteHotspot(selectedSceneId, selectedHotspotId);
                      }}>Supprimer la zone</button>
                    </>
                  ) : (
                    <div className="placeholder small">Selectionne une zone, un objet visible ou un objet d’inventaire.</div>
                  )}
                </section>
              </div>

              {isEditorFullscreen ? (
                <SceneFullscreenEditor
                  selectedScene={selectedScene}
                  selectedSceneId={selectedSceneId}
                  selectedItem={selectedItem}
                  selectedItemId={selectedItemId}
                  selectedSceneObject={selectedSceneObject}
                  selectedSceneObjectId={selectedSceneObjectId}
                  selectedHotspot={selectedHotspot}
                  selectedHotspotId={selectedHotspotId}
                  project={project}
                  fullscreenViewportRef={fullscreenViewportRef}
                  fullscreenCanvasRef={fullscreenCanvasRef}
                  selectActInFullscreen={selectActInFullscreen}
                  selectSceneInFullscreen={selectSceneInFullscreen}
                  getSceneDepth={getSceneDepth}
                  editorToolbarProps={editorToolbarProps}
                  fullscreenZoom={fullscreenZoom}
                  sceneAspectRatio={sceneAspectRatio}
                  isPanningFullscreen={isPanningFullscreen}
                  beginFullscreenPan={beginFullscreenPan}
                  moveFullscreenPan={moveFullscreenPan}
                  stopFullscreenPan={stopFullscreenPan}
                  handleFullscreenWheel={handleFullscreenWheel}
                  fullscreenPan={fullscreenPan}
                  isDragLocked={isDragLocked}
                  snapGridEnabled={snapGridEnabled}
                  updateHotspotPosition={updateHotspotPosition}
                  stopDragging={stopDragging}
                  selectedSceneObjectIds={selectedSceneObjectIds}
                  draggingSceneObjectId={draggingSceneObjectId}
                  beginObjectDrag={beginObjectDrag}
                  selectSceneObject={selectSceneObject}
                  selectedHotspotIds={selectedHotspotIds}
                  draggingHotspotId={draggingHotspotId}
                  beginDrag={beginDrag}
                  selectHotspot={selectHotspot}
                  selectedVisualEffectZoneId={selectedVisualEffectZoneId}
                  draggingVisualEffectZoneId={draggingVisualEffectZoneId}
                  beginVisualEffectZoneDrag={beginVisualEffectZoneDrag}
                  selectVisualEffectZone={selectVisualEffectZone}
                  renderResizeHandles={renderResizeHandles}
                  renderShapePointHandles={renderShapePointHandles}
                  renderShapeControls={renderShapeControls}
                  renderShapeOutline={renderShapeOutline}
                  getShapeClassName={getShapeClassName}
                  miniMapProps={miniMapProps}
                  setSelectedItemId={setSelectedItemId}
                  handleUpload={handleUpload}
                  mediaLibrary={mediaLibrary}
                  importSceneObjectAnime2d={importSceneObjectAnime2d}
                  patchProject={patchProject}
                  deleteItem={deleteItem}
                  setSelectedSceneObjectId={setSelectedSceneObjectId}
                  getSceneLabel={getSceneLabel}
                  deleteHotspot={deleteHotspot}
                  setTab={setTab}
                  openQuickLogicForTarget={openQuickLogicForTarget}
                />
              ) : null}
              <QuickLogicModal
                project={project}
                selectedSceneId={selectedSceneId}
                targetRef={quickLogicTarget}
                patchProject={patchProject}
                handleUpload={handleUpload}
                mediaLibrary={mediaLibrary}
                onClose={() => setQuickLogicTarget(null)}
                getSceneLabel={getSceneLabel}
              />
            </div>
          </div>
        ) : <div className="empty-state-inline">Selectionne une scene dans la colonne de gauche pour commencer.</div>}
      </section>

    </div>
  );
}
