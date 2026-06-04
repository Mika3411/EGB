import { useState } from 'react';

export function useSceneEditorSelection({
  dragMovedRef,
  multiSelectEnabled,
  selectedHotspotId,
  setSelectedHotspotId,
  setSelectedItemId,
}) {
  const [selectedSceneObjectId, setSelectedSceneObjectId] = useState('');
  const [selectedVisualEffectZoneId, setSelectedVisualEffectZoneId] = useState('');
  const [selectedHotspotIds, setSelectedHotspotIds] = useState([]);
  const [selectedSceneObjectIds, setSelectedSceneObjectIds] = useState([]);

  const activeHotspotIds = selectedHotspotIds.length ? selectedHotspotIds : (selectedHotspotId ? [selectedHotspotId] : []);
  const activeSceneObjectIds = selectedSceneObjectIds.length ? selectedSceneObjectIds : (selectedSceneObjectId ? [selectedSceneObjectId] : []);
  const activeVisualEffectZoneIds = selectedVisualEffectZoneId ? [selectedVisualEffectZoneId] : [];
  const activeSelectionCount = activeHotspotIds.length + activeSceneObjectIds.length + activeVisualEffectZoneIds.length;

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

  const clearSceneEditorSelection = () => {
    setSelectedHotspotId('');
    setSelectedSceneObjectId('');
    setSelectedVisualEffectZoneId('');
    setSelectedItemId('');
    setSelectedHotspotIds([]);
    setSelectedSceneObjectIds([]);
  };

  return {
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
    clearSceneEditorSelection,
    selectHotspot,
    selectSceneObject,
    selectVisualEffectZone,
    toggleHotspotSelection,
    toggleSceneObjectSelection,
  };
}
