import { useEffect } from 'react';
import { showConfirm } from '../../../../shared/ui/AccessibleDialog';
import {
  clampPercent,
  getLayerZIndex,
  shouldIgnoreEditorShortcut,
} from '../../../../shared/services/sceneRender.js';

export function useSceneEditorCommands({
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

  const deleteSelectedEditorItems = async () => {
    if (!selectedSceneId || !activeSelectionCount) return;
    const selectionType = selectedEditorType;
    const labels = {
      sceneObject: activeSceneObjectIds.length > 1 ? `${activeSceneObjectIds.length} objets visibles` : 'cet objet visible',
      visualEffectZone: 'cette zone visuelle',
      hotspot: activeHotspotIds.length > 1 ? `${activeHotspotIds.length} zones d'action` : "cette zone d'action",
    };
    const confirmed = await showConfirm({
      title: 'Supprimer la sélection',
      message: `Supprimer ${labels[selectionType] || 'la sélection'} ?`,
      confirmLabel: 'Supprimer',
      variant: 'danger',
    });
    if (!confirmed) return;
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
    patchLayerItem,
    nudgeLayerZIndex,
    sendLayerToEdge,
  };
}
