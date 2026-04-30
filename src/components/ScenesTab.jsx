import { useEffect, useRef, useState } from 'react';
import {
  EditorToolbarMenus,
  HelpLabel,
  LayersPanel,
} from './scenes/SceneEditorChrome.jsx';
import SceneSidebar from './scenes/SceneSidebar.jsx';
import SceneFullscreenEditor from './scenes/SceneFullscreenEditor.jsx';
import SceneVisualEffect, { VISUAL_EFFECT_INTENSITY_OPTIONS, getVisualEffectZoneZIndex } from './SceneVisualEffect.jsx';
import VisualEffectCascadeMenu from './VisualEffectCascadeMenu.jsx';
import {
  clampFullscreenZoom,
  clampPercent,
  getLayerZIndex,
  getSceneObjectImageStyle,
  getSceneObjectStyle,
  gridOverlayStyle,
  shouldIgnoreEditorShortcut,
} from './scenes/sceneEditorUtils.js';

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
  } = props;

  const canvasRef = useRef(null);
  const fullscreenViewportRef = useRef(null);
  const fullscreenCanvasRef = useRef(null);
  const dragMovedRef = useRef(false);
  const draggingHotspotIdRef = useRef('');
  const draggingSceneObjectIdRef = useRef('');
  const draggingVisualEffectZoneIdRef = useRef('');
  const dragSourceRef = useRef('main');
  const [draggingHotspotId, setDraggingHotspotId] = useState('');
  const [draggingSceneObjectId, setDraggingSceneObjectId] = useState('');
  const [draggingVisualEffectZoneId, setDraggingVisualEffectZoneId] = useState('');
  const [selectedSceneObjectId, setSelectedSceneObjectId] = useState('');
  const [selectedVisualEffectZoneId, setSelectedVisualEffectZoneId] = useState('');
  const [isEditorFullscreen, setIsEditorFullscreen] = useState(false);
  const [fullscreenZoom, setFullscreenZoom] = useState(1);
  const [fullscreenPan, setFullscreenPan] = useState({ x: 0, y: 0 });
  const [isPanningFullscreen, setIsPanningFullscreen] = useState(false);
  const [fullscreenPanStart, setFullscreenPanStart] = useState({ x: 0, y: 0, panX: 0, panY: 0 });
  const [snapGridEnabled, setSnapGridEnabled] = useState(false);
  const [multiSelectEnabled, setMultiSelectEnabled] = useState(false);
  const [selectedHotspotIds, setSelectedHotspotIds] = useState([]);
  const [selectedSceneObjectIds, setSelectedSceneObjectIds] = useState([]);
  const [isDragLocked, setIsDragLocked] = useState(false);
  const [isMiniMapCollapsed, setIsMiniMapCollapsed] = useState(false);
  const [minimapViewport, setMinimapViewport] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [collapsedSceneIds, setCollapsedSceneIds] = useState(() => new Set());

  useEffect(() => {
    if (!isEditorFullscreen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isEditorFullscreen]);

  useEffect(() => {
    const handleNativeFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsEditorFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleNativeFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleNativeFullscreenChange);
  }, []);

  useEffect(() => {
    if (!isEditorFullscreen) return undefined;

    const updateMinimapViewport = () => {
      const viewport = fullscreenViewportRef.current;
      const stage = fullscreenCanvasRef.current;
      if (!viewport || !stage) return;
      const viewportRect = viewport.getBoundingClientRect();
      const stageRect = stage.getBoundingClientRect();
      if (!viewportRect.width || !viewportRect.height || !stageRect.width || !stageRect.height) return;

      const left = clampPercent(((viewportRect.left - stageRect.left) / stageRect.width) * 100);
      const top = clampPercent(((viewportRect.top - stageRect.top) / stageRect.height) * 100);
      const right = clampPercent(((viewportRect.right - stageRect.left) / stageRect.width) * 100);
      const bottom = clampPercent(((viewportRect.bottom - stageRect.top) / stageRect.height) * 100);
      setMinimapViewport({
        x: left,
        y: top,
        width: Math.max(4, right - left),
        height: Math.max(4, bottom - top),
      });
    };

    const frame = requestAnimationFrame(updateMinimapViewport);
    window.addEventListener('resize', updateMinimapViewport);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', updateMinimapViewport);
    };
  }, [isEditorFullscreen, fullscreenZoom, fullscreenPan]);
  const selectedSceneObject = selectedScene?.sceneObjects?.find((obj) => obj.id === selectedSceneObjectId) || null;
  const selectedVisualEffectZone = selectedScene?.visualEffectZones?.find((zone) => zone.id === selectedVisualEffectZoneId) || null;
  const activeHotspotIds = selectedHotspotIds.length ? selectedHotspotIds : (selectedHotspotId ? [selectedHotspotId] : []);
  const activeSceneObjectIds = selectedSceneObjectIds.length ? selectedSceneObjectIds : (selectedSceneObjectId ? [selectedSceneObjectId] : []);
  const activeVisualEffectZoneIds = selectedVisualEffectZoneId ? [selectedVisualEffectZoneId] : [];
  const activeSelectionCount = activeHotspotIds.length + activeSceneObjectIds.length + activeVisualEffectZoneIds.length;
  const selectedEditorType = activeVisualEffectZoneIds.length ? 'visualEffectZone' : (activeSceneObjectIds.length ? 'sceneObject' : (activeHotspotIds.length ? 'hotspot' : ''));
  const snapValue = (value) => (snapGridEnabled ? Math.round(value / 5) * 5 : value);
  const sceneAspectRatio = Number(selectedScene?.backgroundAspectRatio) > 0 ? Number(selectedScene.backgroundAspectRatio) : 1.6;

  const resetFullscreenView = () => {
    setFullscreenZoom(1);
    setFullscreenPan({ x: 0, y: 0 });
  };

  const clampFullscreenPan = (pan, zoom = fullscreenZoom) => {
    const viewport = fullscreenViewportRef.current;
    const stage = fullscreenCanvasRef.current;
    if (!viewport || !stage) return pan;

    const viewportRect = viewport.getBoundingClientRect();
    const stageWidth = stage.offsetWidth || 0;
    const stageHeight = stage.offsetHeight || 0;
    if (!viewportRect.width || !viewportRect.height || !stageWidth || !stageHeight) return pan;

    const scaledWidth = stageWidth * zoom;
    const scaledHeight = stageHeight * zoom;
    const maxX = Math.max(0, (scaledWidth - viewportRect.width) / 2);
    const maxY = Math.max(0, (scaledHeight - viewportRect.height) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, pan.x)),
      y: Math.max(-maxY, Math.min(maxY, pan.y)),
    };
  };

  const setClampedFullscreenZoom = (updater) => {
    setFullscreenZoom((previous) => {
      const requested = typeof updater === 'function' ? updater(previous) : updater;
      const nextZoom = clampFullscreenZoom(requested);
      setFullscreenPan((pan) => clampFullscreenPan(pan, nextZoom));
      return nextZoom;
    });
  };

  const enterEditorFullscreen = () => {
    setIsEditorFullscreen(true);
    const root = document.documentElement;
    if (document.fullscreenElement || !root.requestFullscreen) return;
    root.requestFullscreen().catch(() => {
      // The in-app fullscreen overlay still works if the browser refuses native fullscreen.
    });
  };

  const closeEditorFullscreen = () => {
    setIsEditorFullscreen(false);
    if (!document.fullscreenElement || !document.exitFullscreen) return;
    document.exitFullscreen().catch(() => {});
  };

  const toggleHotspotSelection = (id, event) => {
    if (!multiSelectEnabled && !event?.shiftKey) {
      setSelectedHotspotIds([id]);
      setSelectedSceneObjectIds([]);
      setSelectedVisualEffectZoneId('');
      return;
    }
    setSelectedHotspotIds((previous) => (
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]
    ));
    setSelectedSceneObjectIds([]);
    setSelectedVisualEffectZoneId('');
  };

  const toggleSceneObjectSelection = (id, event) => {
    if (!multiSelectEnabled && !event?.shiftKey) {
      setSelectedSceneObjectIds([id]);
      setSelectedHotspotIds([]);
      setSelectedVisualEffectZoneId('');
      return;
    }
    setSelectedSceneObjectIds((previous) => (
      previous.includes(id) ? previous.filter((entry) => entry !== id) : [...previous, id]
    ));
    setSelectedHotspotIds([]);
    setSelectedVisualEffectZoneId('');
  };

  const handleFullscreenWheel = (event) => {
    if (!isEditorFullscreen) return;
    if (!event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    setClampedFullscreenZoom((previous) => previous + delta);
  };

  const beginFullscreenPan = (event) => {
    if (!isEditorFullscreen) return;
    const isViewportBackground = event.target === event.currentTarget;
    const isSceneCanvas = fullscreenCanvasRef.current?.contains(event.target);
    const isInteractiveSceneElement = event.target?.closest?.('.editor-hotspot, button, input, select, textarea, a');
    const canPanZoomedScene = fullscreenZoom > 1 && isSceneCanvas && !isInteractiveSceneElement;
    if (event.button !== 1 && !event.altKey && !isViewportBackground && !canPanZoomedScene) return;
    event.preventDefault();
    setIsPanningFullscreen(true);
    setFullscreenPanStart({
      x: event.clientX,
      y: event.clientY,
      panX: fullscreenPan.x,
      panY: fullscreenPan.y,
    });
  };

  const moveFullscreenPan = (event) => {
    if (!isPanningFullscreen) return;
    event.preventDefault();
    setFullscreenPan(clampFullscreenPan({
      x: fullscreenPanStart.panX + event.clientX - fullscreenPanStart.x,
      y: fullscreenPanStart.panY + event.clientY - fullscreenPanStart.y,
    }));
  };

  const stopFullscreenPan = () => {
    setIsPanningFullscreen(false);
  };

  useEffect(() => {
    if (!draggingHotspotId && !draggingSceneObjectId && !draggingVisualEffectZoneId) return undefined;

    const handlePointerMove = (event) => {
      event.preventDefault();
      updateHotspotPosition(event.clientX, event.clientY, dragSourceRef.current);
    };

    const handlePointerEnd = () => {
      stopDragging();
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
    };
  }, [draggingHotspotId, draggingSceneObjectId, draggingVisualEffectZoneId]);

  const toggleSceneChildren = (event, sceneId) => {
    event.preventDefault();
    event.stopPropagation();
    setCollapsedSceneIds((previous) => {
      const next = new Set(previous);
      if (next.has(sceneId)) next.delete(sceneId);
      else next.add(sceneId);
      return next;
    });
  };

  const selectSceneFromTree = (scene) => {
      setSelectedSceneId(scene.id);
      setSelectedHotspotId(scene.hotspots?.[0]?.id || '');
      setSelectedSceneObjectId('');
      setSelectedVisualEffectZoneId('');
      setSelectedSceneObjectIds([]);
    setSelectedHotspotIds(scene.hotspots?.[0]?.id ? [scene.hotspots[0].id] : []);
    setSelectedItemId('');
  };

  const selectSceneInFullscreen = (sceneId) => {
    const scene = project.scenes.find((entry) => entry.id === sceneId);
    if (!scene) return;
    setSelectedSceneId(scene.id);
    setSelectedHotspotId(scene.hotspots?.[0]?.id || '');
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
  };

  const selectActInFullscreen = (actId) => {
    const scene = project.scenes.find((entry) => entry.actId === actId && !entry.parentSceneId)
      || project.scenes.find((entry) => entry.actId === actId);
    if (scene) selectSceneInFullscreen(scene.id);
  };

  const stopDragging = () => {
    draggingHotspotIdRef.current = '';
    draggingSceneObjectIdRef.current = '';
    draggingVisualEffectZoneIdRef.current = '';
    setDraggingHotspotId('');
    setDraggingSceneObjectId('');
    setDraggingVisualEffectZoneId('');
    setIsDragLocked(false);
  };

  const rememberSceneBackgroundAspectRatio = (image, sceneId = selectedSceneId) => {
    if (!image?.naturalWidth || !image?.naturalHeight || !sceneId) return;
    const nextRatio = Number((image.naturalWidth / image.naturalHeight).toFixed(4));
    if (!Number.isFinite(nextRatio) || nextRatio <= 0) return;
    const currentRatio = Number(project.scenes.find((scene) => scene.id === sceneId)?.backgroundAspectRatio);
    if (Math.abs((currentRatio || 0) - nextRatio) < 0.0001) return;
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === sceneId);
      if (scene) scene.backgroundAspectRatio = nextRatio;
    }, { rememberHistory: false });
  };

  const updateSceneBackground = (data, name) => {
    patchProject((draft) => {
      const scene = draft.scenes.find((s) => s.id === selectedSceneId);
      if (scene) {
        scene.backgroundData = data;
        scene.backgroundName = name;
        scene.backgroundAspectRatio = 1.6;
      }
    });

    const image = new Image();
    image.onload = () => rememberSceneBackgroundAspectRatio(image);
    image.src = data;
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

  const addSceneObject = () => {
    if (!selectedSceneId) return;
    const nextId = `scene-object-${Math.random().toString(36).slice(2, 10)}`;
    const sourceItem = selectedItem || project.items?.find((item) => item.id === selectedItemId) || project.items?.[0];
    const isTutorialObject = Boolean(document.body.classList.contains('tutorial-active'));
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (!Array.isArray(scene.sceneObjects)) scene.sceneObjects = [];
      scene.sceneObjects.push({
        id: nextId,
        name: sourceItem?.name || 'Nouvel objet visible',
        imageData: sourceItem?.imageData || '',
        imageName: sourceItem?.imageName || '',
        popupImage: '',
        popupImageName: '',
        x: 50,
        y: 50,
        width: 14,
        height: 14,
        interactionMode: sourceItem?.id ? 'inventory' : 'popup',
        linkedItemId: sourceItem?.id || '',
        removeAfterUse: true,
        dialogue: sourceItem?.name ? `Tu as trouve ${sourceItem.name}.` : '',
        tutorialCreated: isTutorialObject,
      });
    });
    setSelectedSceneObjectId(nextId);
    setSelectedHotspotId('');
    setSelectedItemId('');
  };

  const addVisualEffectZone = () => {
    if (!selectedSceneId) return;
    const nextId = `visual-zone-${Math.random().toString(36).slice(2, 10)}`;
    const isTutorialZone = Boolean(document.body.classList.contains('tutorial-active'));
    patchProject((draft) => {
      const scene = draft.scenes.find((entry) => entry.id === selectedSceneId);
      if (!scene) return;
      if (!Array.isArray(scene.visualEffectZones)) scene.visualEffectZones = [];
      scene.visualEffectZones.push({
        id: nextId,
        name: 'Zone scintillante',
        effect: 'sparkles',
        intensity: 'normal',
        x: 50,
        y: 50,
        width: 24,
        height: 18,
        layer: 'behind',
        isHidden: false,
        tutorialCreated: isTutorialZone,
      });
    });
    setSelectedVisualEffectZoneId(nextId);
    setSelectedSceneObjectId('');
    setSelectedHotspotId('');
    setSelectedItemId('');
    setSelectedHotspotIds([]);
    setSelectedSceneObjectIds([]);
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
  };

  const beginVisualEffectZoneDrag = (event, zoneId, source = 'main') => {
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
  };

  const selectSceneObject = (objId, event) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setSelectedSceneObjectId(objId);
    setSelectedHotspotId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    toggleSceneObjectSelection(objId, event);
  };

  const selectHotspot = (spotId, event) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setSelectedHotspotId(spotId);
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    toggleHotspotSelection(spotId, event);
  };

  const selectVisualEffectZone = (zoneId) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    setSelectedVisualEffectZoneId(zoneId);
    setSelectedSceneObjectId('');
    setSelectedHotspotId('');
    setSelectedItemId('');
    setSelectedHotspotIds([]);
    setSelectedSceneObjectIds([]);
  };

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
    if (!window.confirm(`Supprimer ${labels[selectionType] || 'la sélection'} ?`)) return;
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
        collapsedSceneIds={collapsedSceneIds}
        toggleSceneChildren={toggleSceneChildren}
        selectSceneFromTree={selectSceneFromTree}
      />

      <section className="panel main panel-main-pro">
        <div className="panel-head panel-main-header">
          <div>
            <span className="section-kicker">Édition</span>
            <h2>Éditeur de scène</h2>
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
                    <HelpLabel help="Nom affiché dans la navigation de l’éditeur et dans les listes de choix. Garde-le court si plusieurs scènes se ressemblent.">Nom de la scène</HelpLabel>
                    <input value={selectedScene.name} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.name = e.target.value;
                    })} />
                  </div>
                  <div data-tour="scene-act">
                    <HelpLabel help="Regroupe la scène dans un chapitre. Changer d’acte peut retirer une scène parente qui n’appartient plus au même acte.">Acte</HelpLabel>
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
                    <HelpLabel help="Transforme cette scène en sous-scène d’une autre. Utile pour les gros plans, tiroirs, portes ou variantes d’une même pièce.">Scène parente</HelpLabel>
                    <select value={selectedScene.parentSceneId} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.parentSceneId = e.target.value;
                    })}>
                      <option value="">Scène principale</option>
                      {project.scenes.filter((scene) => scene.id !== selectedSceneId && scene.actId === selectedScene.actId).map((scene) => (
                        <option key={scene.id} value={scene.id}>{getSceneDepth(scene) ? '— '.repeat(getSceneDepth(scene)) : ''}{scene.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="scene-intro-field" data-tour="scene-intro">
                    <HelpLabel help="Texte montré à l’entrée de la scène, avant que le joueur interagisse. Sert à poser l’ambiance ou l’objectif local.">Texte d’introduction</HelpLabel>
                    <input value={selectedScene.introText} onChange={(e) => patchProject((draft) => {
                      const scene = draft.scenes.find((s) => s.id === selectedSceneId); if (scene) scene.introText = e.target.value;
                    })} />
                  </div>
                </div>
              </div>

            <div className="subpanel canvas-subpanel">
              <div className="subpanel-head">
                <div>
                  <h3>Plan de scène</h3>
                </div>
                <div className="editor-toolbar-wrap">
                  <EditorToolbarMenus {...editorToolbarProps} />
                </div>
              </div>

              <div className="preview-editor" data-tour="scene-canvas">
                <div
                  ref={canvasRef}
                  className="editor-canvas editor-canvas-pro"
                  style={{ aspectRatio: sceneAspectRatio }}
                  onPointerUp={stopDragging}
                  onPointerCancel={stopDragging}
                >
                  {selectedScene.backgroundData ? <img src={selectedScene.backgroundData} alt="fond" onLoad={(event) => rememberSceneBackgroundAspectRatio(event.currentTarget)} /> : <div className="placeholder">Ajoute une image de scène</div>}
                  <SceneVisualEffect effect={selectedScene.visualEffect} intensity={selectedScene.visualEffectIntensity} />
                  {(selectedScene.visualEffectZones || []).filter((zone) => !zone.isHidden).map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      data-tour={zone.tutorialCreated ? 'visual-zone-on-canvas' : undefined}
                      className={`editor-hotspot editor-visual-zone ${zone.id === selectedVisualEffectZoneId ? 'selected' : ''} ${zone.id === draggingVisualEffectZoneId ? 'dragging' : ''}`}
                      style={{ left: `${zone.x}%`, top: `${zone.y}%`, width: `${zone.width}%`, height: `${zone.height}%`, zIndex: getVisualEffectZoneZIndex(zone.layer) }}
                      onPointerDown={(event) => beginVisualEffectZoneDrag(event, zone.id)}
                      onClick={() => selectVisualEffectZone(zone.id)}
                    >
                      <SceneVisualEffect effect={zone.effect} intensity={zone.intensity} />
                      <span>{zone.name}</span>
                    </button>
                  ))}
                  {snapGridEnabled ? <div style={gridOverlayStyle} /> : null}
                  {(selectedScene.sceneObjects || []).filter((obj) => !obj.isHidden).map((obj) => (
                    <button
                      key={obj.id}
                      type="button"
                      data-tour={obj.tutorialCreated ? 'scene-object-on-canvas' : undefined}
                      className={`editor-hotspot editor-scene-object ${(obj.id === selectedSceneObjectId || selectedSceneObjectIds.includes(obj.id)) ? 'selected' : ''} ${obj.id === draggingSceneObjectId ? 'dragging' : ''}`}
                      style={getSceneObjectStyle(obj)}
                      onPointerDown={(event) => beginObjectDrag(event, obj.id)}
                      onClick={(event) => selectSceneObject(obj.id, event)}
                    >
                      {obj.imageData ? <img src={obj.imageData} alt={obj.name} style={getSceneObjectImageStyle()} /> : <span>{obj.name}</span>}
                    </button>
                  ))}
                  {selectedScene.hotspots.filter((spot) => !spot.isHidden).map((spot) => (
                    <button
                      key={spot.id}
                      type="button"
                      data-tour={spot.tutorialCreated ? 'hotspot-on-canvas' : undefined}
                      className={`editor-hotspot ${(spot.id === selectedHotspotId || selectedHotspotIds.includes(spot.id)) ? 'selected' : ''} ${spot.id === draggingHotspotId ? 'dragging' : ''}`}
                      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.width}%`, height: `${spot.height}%`, zIndex: getLayerZIndex(spot, 'hotspot') }}
                      onPointerDown={(event) => beginDrag(event, spot.id)}
                      onClick={(event) => selectHotspot(spot.id, event)}
                    >
                      <span>{spot.name}</span>
                    </button>
                  ))}
                </div>
                <section className="panel side panel-context-pro side-editor side-editor-pro" data-tour="selected-zone-panel" style={{ margin: 0, overflow: 'auto' }}>
                  <div className="panel-head panel-head-stack">
                    <div>
                      <span className="section-kicker">Contexte</span>
                      <h2>{selectedItem ? 'Objet sélectionné' : selectedSceneObject ? 'Objet visible sélectionné' : selectedVisualEffectZone ? 'Zone visuelle sélectionnée' : 'Zone sélectionnée'}</h2>
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
                      <label className="button like full secondary-action" data-tour="object-image">
                        {selectedItem.imageName || 'Importer une image objet'}
                        <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                          const item = draft.items.find((entry) => entry.id === selectedItemId);
                          if (item) {
                            item.imageData = data;
                            item.imageName = name;
                          }
                        }))} />
                      </label>
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
                    <>
                      <HelpLabel help="Nom interne de l’objet visible. Il aide à le retrouver dans les calques et les listes de l’éditeur.">Nom</HelpLabel>
                      <input value={selectedSceneObject.name} onChange={(e) => patchProject((draft) => {
                        const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.name = e.target.value;
                      })} />
                      <div className="grid-two small-gap">
                        <div><HelpLabel help="Position horizontale du centre de l’objet, en pourcentage de la largeur de l’image. 0 est le bord gauche, 100 le bord droit.">X</HelpLabel><input type="number" value={selectedSceneObject.x} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.x = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Position verticale du centre de l’objet, en pourcentage de la hauteur de l’image. 0 est le haut, 100 le bas.">Y</HelpLabel><input type="number" value={selectedSceneObject.y} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.y = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Largeur de la zone cliquable et de l’image visible, en pourcentage de la largeur de la scène.">Largeur</HelpLabel><input type="number" value={selectedSceneObject.width} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.width = Number(e.target.value); })} /></div>
                        <div><HelpLabel help="Hauteur de la zone cliquable et de l’image visible, en pourcentage de la hauteur de la scène.">Hauteur</HelpLabel><input type="number" value={selectedSceneObject.height} onChange={(e) => patchProject((draft) => { const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.height = Number(e.target.value); })} /></div>
                      </div>
                      <HelpLabel help="Image affichée directement dans la scène, à l’emplacement X/Y. L’objet reste cliquable même si l’image est transparente.">Image visible</HelpLabel>
                      <label className="button like full secondary-action">
                        {selectedSceneObject.imageName || 'Importer une image visible'}
                        <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                          const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) { obj.imageData = data; obj.imageName = name; }
                        }))} />
                      </label>
                      <HelpLabel help="Image montrée en grand quand l’objet visible déclenche un pop-up. Utile pour inspecter un document, un détail ou un indice.">Image pop-up</HelpLabel>
                      <label className="button like full secondary-action">
                        {selectedSceneObject.popupImageName || 'Importer une image pop-up'}
                        <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                          const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) { obj.popupImage = data; obj.popupImageName = name; }
                        }))} />
                      </label>
                      <HelpLabel help="Définit ce qui se passe au clic : montrer un pop-up, ajouter l’objet lié à l’inventaire, ou faire les deux.">Mode d’interaction</HelpLabel>
                      <select value={selectedSceneObject.interactionMode || 'popup'} onChange={(e) => patchProject((draft) => {
                        const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.interactionMode = e.target.value;
                      })}>
                        <option value="popup">Pop-up uniquement</option>
                        <option value="inventory">Inventaire uniquement</option>
                        <option value="both">Pop-up + inventaire</option>
                      </select>
                      <HelpLabel help="Objet ajouté à l’inventaire si le mode inclut l’inventaire. Sans sélection, le clic ne donne aucun objet.">Objet d’inventaire lié</HelpLabel>
                      <select value={selectedSceneObject.linkedItemId || ''} onChange={(e) => patchProject((draft) => {
                        const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.linkedItemId = e.target.value;
                      })}>
                        <option value="">Aucun</option>
                        {project.items.map((item) => <option key={item.id} value={item.id}>{item.icon} {item.name}</option>)}
                      </select>
                      <HelpLabel help="Texte affiché quand le joueur interagit avec cet objet visible. Pratique pour donner un indice sans créer une zone séparée.">Dialogue</HelpLabel>
                      <textarea value={selectedSceneObject.dialogue || ''} onChange={(e) => patchProject((draft) => {
                        const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.dialogue = e.target.value;
                      })} />
                      <label className="checkbox-row">
                        <input
                          type="checkbox"
                          checked={Boolean(selectedSceneObject.removeAfterUse)}
                          onChange={(e) => patchProject((draft) => {
                            const obj = draft.scenes.find((s) => s.id === selectedSceneId)?.sceneObjects?.find((entry) => entry.id === selectedSceneObjectId); if (obj) obj.removeAfterUse = e.target.checked;
                          })}
                        />
                        Retirer l’objet visible après interaction ?
                      </label>
                      <p className="small-note help-inline-note">Quand c’est activé, l’objet disparaît de la scène après son utilisation réussie, par exemple une clé ramassée.</p>
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        if (!window.confirm(`Supprimer l'objet visible "${selectedSceneObject.name}" ?`)) return;
                        patchProject((draft) => {
                          const scene = draft.scenes.find((s) => s.id === selectedSceneId);
                          if (!scene?.sceneObjects) return;
                          scene.sceneObjects = scene.sceneObjects.filter((entry) => entry.id !== selectedSceneObjectId);
                        });
                        setSelectedSceneObjectId('');
                      }}>Supprimer l’objet visible</button>
                    </>
                  ) : selectedVisualEffectZone ? (
                    <>
                      <HelpLabel help="Nom interne de la zone visuelle. Il aide a la retrouver dans les calques et dans l'editeur.">Nom</HelpLabel>
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
                      <HelpLabel help="Effet visuel applique uniquement dans cette zone. Ce menu reprend les memes familles que l'onglet Media.">Effet de zone</HelpLabel>
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
                        <div><HelpLabel help="Hauteur de la zone cliquable. Une zone trop petite peut être difficile à trouver sur mobile.">Hauteur</HelpLabel><input type="number" value={selectedHotspot.height} onChange={(e) => patchProject((draft) => { const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.height = Number(e.target.value); })} /></div>
                      </div>
                      <HelpLabel help="Action principale déclenchée par cette zone après validation des prérequis éventuels : dialogue, objet, changement de scène ou cinématique.">Action</HelpLabel>
                      <select data-tour="hotspot-action" value={selectedHotspot.actionType} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.actionType = e.target.value;
                      })}>
                        <option value="dialogue">Dialogue</option>
                        <option value="dialogue_item">Dialogue + objet</option>
                        <option value="scene">Changer de scène</option>
                        <option value="cinematic">Lancer une cinématique</option>
                      </select>
                      <HelpLabel help="Texte affiché lors de l’interaction principale. Il peut donner une réaction, un indice ou confirmer une action réussie.">Dialogue</HelpLabel>
                      <textarea data-tour="hotspot-dialogue" value={selectedHotspot.dialogue} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.dialogue = e.target.value;
                      })} />
                      <HelpLabel help="Destination utilisée si l’action est “Changer de scène”. Laisse vide si la zone doit seulement parler ou donner un objet.">Scène cible</HelpLabel>
                      <select data-tour="hotspot-target-scene" value={selectedHotspot.targetSceneId} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetSceneId = e.target.value;
                      })}>
                        <option value="">Aucune</option>
                        {project.scenes.filter((scene) => scene.id !== selectedSceneId).map((scene) => <option key={scene.id} value={scene.id}>{getSceneLabel(scene.id)}</option>)}
                      </select>
                      <HelpLabel help="Cinématique lancée après l’interaction réussie. Elle peut servir de transition, révélation ou fin de séquence.">Cinématique cible</HelpLabel>
                      <select data-tour="hotspot-target-cinematic" value={selectedHotspot.targetCinematicId} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.targetCinematicId = e.target.value;
                      })}>
                        <option value="">Aucune</option>
                        {project.cinematics.map((cinematic) => <option key={cinematic.id} value={cinematic.id}>{cinematic.name}</option>)}
                      </select>
                      <HelpLabel help="Énigme à résoudre avant d’exécuter l’action de la zone. Si elle échoue ou reste ouverte, la suite ne se déclenche pas encore.">Énigme liée</HelpLabel>
                      <select data-tour="hotspot-linked-enigma" value={selectedHotspot.enigmaId || ''} onChange={(e) => patchProject((draft) => {
                        const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId); if (spot) spot.enigmaId = e.target.value;
                      })}>
                        <option value="">Aucune</option>
                        {(project.enigmas || []).map((enigma) => <option key={enigma.id} value={enigma.id}>{enigma.name}</option>)}
                      </select>
                      <HelpLabel help="Son joué au moment où cette zone est utilisée. Garde-le court pour ne pas couvrir la musique ou les dialogues.">Son de la zone</HelpLabel>
                      <label className="button like full secondary-action" data-tour="hotspot-sound">
                        {selectedHotspot.soundName || 'Importer un son unique'}
                        <input type="file" accept="audio/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                          const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                          if (spot) {
                            spot.soundData = data;
                            spot.soundName = name;
                          }
                        }))} />
                      </label>
                      {selectedHotspot.soundData && (
                        <>
                          <audio controls preload="metadata" src={selectedHotspot.soundData} style={{ width: '100%', marginTop: 10 }} />
                          <button
                            type="button"
                            className="danger-button"
                            style={{ marginTop: 12 }}
                          onClick={() => {
                            if (!window.confirm('Supprimer le son de cette zone ?')) return;
                            patchProject((draft) => {
                              const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                              if (spot) {
                                spot.soundData = '';
                                spot.soundName = '';
                              }
                            });
                          }}
                          >
                            Supprimer le son ?
                          </button>
                        </>
                      )}
                      <HelpLabel help="Image associée à l’action principale de cette zone, souvent utilisée pour montrer un objet trouvé ou un indice visuel.">Image objet</HelpLabel>
                      <label className="button like full secondary-action" data-tour="hotspot-object-image">
                        {selectedHotspot.objectImageName ? 'Remplacer l’image objet' : 'Importer une image objet'}
                        <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, (data, name) => patchProject((draft) => {
                          const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                          if (spot) { spot.objectImageData = data; spot.objectImageName = name; }
                        }))} />
                      </label>
                      {selectedHotspot.objectImageData && (
                        <button
                          className="danger-button"
                          style={{ marginTop: 12 }}
                          onClick={() => {
                            if (!window.confirm("Supprimer l'image de cette zone ?")) return;
                            patchProject((draft) => {
                            const spot = draft.scenes.find((s) => s.id === selectedSceneId)?.hotspots.find((h) => h.id === selectedHotspotId);
                            if (spot) {
                              spot.objectImageData = '';
                              spot.objectImageName = '';
                            }
                            });
                          }}
                        >
                          Supprimer l’image ?
                        </button>
                      )}
                      <button className="danger-button" style={{ marginTop: 12 }} onClick={() => {
                        if (!window.confirm(`Supprimer la zone "${selectedHotspot.name}" ?`)) return;
                        deleteHotspot(selectedSceneId, selectedHotspotId);
                      }}>Supprimer la zone</button>
                    </>
                  ) : (
                    <div className="placeholder small">Sélectionne une zone, un objet visible ou un objet d’inventaire.</div>
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
                  miniMapProps={miniMapProps}
                  setSelectedItemId={setSelectedItemId}
                  handleUpload={handleUpload}
                  patchProject={patchProject}
                  deleteItem={deleteItem}
                  setSelectedSceneObjectId={setSelectedSceneObjectId}
                  getSceneLabel={getSceneLabel}
                  deleteHotspot={deleteHotspot}
                  setTab={setTab}
                />
              ) : null}
            </div>
          </div>
        ) : <div className="empty-state-inline">Sélectionne une scène dans la colonne de gauche pour commencer.</div>}
      </section>

    </div>
  );
}
