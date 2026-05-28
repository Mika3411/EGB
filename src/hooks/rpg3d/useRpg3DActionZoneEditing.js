import { useCallback, useEffect } from 'react';
import {
  getSelectedEntity,
  insertActionZoneVertex,
  moveActionZoneEdge,
  moveActionZoneVertex,
} from '../../utils/rpg3dMapEditing.js';
import { getDefaultPortalTargetCanvasId } from '../../utils/rpg3dStudioProject.js';

export default function useRpg3DActionZoneEditing({
  actionZoneEdgeInsertMode,
  createDefaultNpcChoices,
  createNpcChoice,
  getNpcChoiceItems,
  mode,
  modeRef,
  patchConfig,
  patchConfigWithoutHistory,
  pushHistorySnapshot,
  selected,
  selectedRef,
  setActionZoneEdgeInsertMode,
  setActiveNpcChoice,
  setCameraTargetPickMode,
  setCameraZoomDragMode,
  setDragMode,
  setGameSnapshot,
  setIsPaused,
  setMode,
  setMultiSelectMode,
  setMultiSelected,
  setPendingPlacement,
  setSelected,
  setTool,
  setTransformTool,
  stateRef,
  studioProjectRef,
}) {
  useEffect(() => {
    if (mode !== 'edit' || selected?.type !== 'actionZone') setActionZoneEdgeInsertMode(false);
  }, [mode, selected, setActionZoneEdgeInsertMode]);

  const updateSelectedNpcChoice = useCallback((choiceId, field, value) => {
    if (!selected || selected.type !== 'actionZone') return;
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.npcChoices = getNpcChoiceItems(currentZone.item).map((choice) => (
        choice.id === choiceId ? { ...choice, [field]: value } : choice
      ));
    }, false);
  }, [getNpcChoiceItems, patchConfig, selected]);

  const addSelectedNpcChoice = useCallback(() => {
    if (!selected || selected.type !== 'actionZone') return;
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.npcChoices = [
        ...getNpcChoiceItems(currentZone.item),
        createNpcChoice(`Reponse ${getNpcChoiceItems(currentZone.item).length + 1}`, ''),
      ];
    }, false);
  }, [createNpcChoice, getNpcChoiceItems, patchConfig, selected]);

  const removeSelectedNpcChoice = useCallback((choiceId) => {
    if (!selected || selected.type !== 'actionZone') return;
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      const nextChoices = getNpcChoiceItems(currentZone.item).filter((choice) => choice.id !== choiceId);
      currentZone.item.npcChoices = nextChoices.length ? nextChoices : createDefaultNpcChoices().slice(0, 1);
    }, false);
  }, [createDefaultNpcChoices, getNpcChoiceItems, patchConfig, selected]);

  const closeNpcChoice = useCallback(() => {
    setActiveNpcChoice(null);
    setIsPaused(false);
  }, [setActiveNpcChoice, setIsPaused]);

  const handleNpcChoiceSelect = useCallback((choice) => {
    const response = choice?.response || choice?.label || 'Choix pris en compte.';
    stateRef.current.actionMessage = response;
    stateRef.current.actionMessageTimer = 3;
    setGameSnapshot({ ...stateRef.current, player: { ...stateRef.current.player } });
    setActiveNpcChoice(null);
    setIsPaused(false);
  }, [setActiveNpcChoice, setGameSnapshot, setIsPaused, stateRef]);

  const handleActionZoneVertexDragStart = useCallback((entity) => {
    if (modeRef.current !== 'edit' || entity?.type !== 'actionZoneVertex' || !entity.id) return;
    pushHistorySnapshot();
    const zoneEntity = { type: 'actionZone', id: entity.id };
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setSelected(zoneEntity);
    setMultiSelected([zoneEntity]);
    setTransformTool('');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
  }, [
    modeRef,
    pushHistorySnapshot,
    setCameraTargetPickMode,
    setDragMode,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setMultiSelected,
    setSelected,
    setTool,
    setTransformTool,
  ]);

  const handleActionZoneVertexDrag = useCallback((entity, point) => {
    if (entity?.type !== 'actionZoneVertex' || !entity.id || !point) return;
    patchConfigWithoutHistory((next) => {
      moveActionZoneVertex(next, entity.id, entity.vertexIndex, point, entity.vertexLayer);
    }, false);
  }, [patchConfigWithoutHistory]);

  const handleActionZoneEdgeDragStart = useCallback((entity) => {
    if (modeRef.current !== 'edit' || entity?.type !== 'actionZoneEdge' || !entity.id) return;
    pushHistorySnapshot();
    const zoneEntity = { type: 'actionZone', id: entity.id };
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setSelected(zoneEntity);
    setMultiSelected([zoneEntity]);
    setTransformTool('');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
  }, [
    modeRef,
    pushHistorySnapshot,
    setCameraTargetPickMode,
    setDragMode,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setMultiSelected,
    setSelected,
    setTool,
    setTransformTool,
  ]);

  const handleActionZoneEdgeDrag = useCallback((entity, delta) => {
    if (entity?.type !== 'actionZoneEdge' || !entity.id || !delta) return;
    patchConfigWithoutHistory((next) => {
      moveActionZoneEdge(next, entity.id, entity.edgeIndex, delta, entity.vertexLayer);
    }, false);
  }, [patchConfigWithoutHistory]);

  const handleInsertActionZoneEdge = useCallback((zoneId, edgeIndex, point = null) => {
    const vertexIndex = Number(edgeIndex) + 1;
    if (!zoneId || !Number.isInteger(vertexIndex) || vertexIndex < 1) return null;
    let inserted = false;
    patchConfig((next) => {
      inserted = insertActionZoneVertex(next, zoneId, edgeIndex, point);
    }, false);
    if (!inserted) return null;
    const zoneEntity = { type: 'actionZone', id: zoneId };
    setSelected(zoneEntity);
    setMultiSelected([zoneEntity]);
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setTransformTool('');
    return { type: 'actionZoneVertex', id: zoneId, vertexIndex };
  }, [patchConfig, setIsPaused, setMode, setMultiSelected, setSelected, setTool, setTransformTool]);

  const handleActionZoneEdgeInsert = useCallback((entity, point) => {
    if (modeRef.current !== 'edit' || entity?.type !== 'actionZoneEdge' || !entity.id) return null;
    if (!actionZoneEdgeInsertMode) return null;
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    const inserted = handleInsertActionZoneEdge(entity.id, entity.edgeIndex, point);
    if (inserted) setActionZoneEdgeInsertMode(false);
    return inserted;
  }, [
    actionZoneEdgeInsertMode,
    handleInsertActionZoneEdge,
    modeRef,
    setActionZoneEdgeInsertMode,
    setCameraTargetPickMode,
    setDragMode,
    setMultiSelectMode,
  ]);

  const handleSelectActionZoneTool = useCallback(() => {
    setMode('edit');
    setTool('actionZone');
    setTransformTool('');
    setPendingPlacement(null);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setActionZoneEdgeInsertMode(false);
  }, [
    setActionZoneEdgeInsertMode,
    setCameraTargetPickMode,
    setMode,
    setMultiSelectMode,
    setPendingPlacement,
    setTool,
    setTransformTool,
  ]);

  const handleToggleActionZoneEdgeInsertMode = useCallback(() => {
    if (selectedRef.current?.type !== 'actionZone') return;
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setTransformTool('');
    setPendingPlacement(null);
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setCameraZoomDragMode(false);
    setActionZoneEdgeInsertMode((current) => !current);
  }, [
    selectedRef,
    setActionZoneEdgeInsertMode,
    setCameraTargetPickMode,
    setCameraZoomDragMode,
    setDragMode,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setPendingPlacement,
    setTool,
    setTransformTool,
  ]);

  const handleActionZoneTypeChange = useCallback((value) => {
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.actionType = value;
      if (value === 'portal' && !currentZone.item.targetCanvasId) {
        currentZone.item.targetCanvasId = getDefaultPortalTargetCanvasId(studioProjectRef.current);
      }
    });
  }, [patchConfig, selected, studioProjectRef]);

  const handleNpcInteractionModeChange = useCallback((value) => {
    patchConfig((next) => {
      const currentZone = getSelectedEntity(next, selected);
      if (!currentZone?.item) return;
      currentZone.item.npcInteractionMode = value;
      if (value === 'multipleChoice') {
        currentZone.item.npcQuestion = currentZone.item.npcQuestion || currentZone.item.message || 'Que veux-tu demander ?';
        currentZone.item.npcChoices = getNpcChoiceItems(currentZone.item);
      }
    });
  }, [getNpcChoiceItems, patchConfig, selected]);

  return {
    addSelectedNpcChoice,
    closeNpcChoice,
    handleActionZoneEdgeDrag,
    handleActionZoneEdgeDragStart,
    handleActionZoneEdgeInsert,
    handleActionZoneTypeChange,
    handleActionZoneVertexDrag,
    handleActionZoneVertexDragStart,
    handleNpcChoiceSelect,
    handleNpcInteractionModeChange,
    handleSelectActionZoneTool,
    handleToggleActionZoneEdgeInsertMode,
    removeSelectedNpcChoice,
    updateSelectedNpcChoice,
  };
}
