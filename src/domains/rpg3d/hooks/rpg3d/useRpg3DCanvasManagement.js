import { useCallback, useEffect, useRef } from 'react';
import { syncConfigModelReferences } from '../../../../shared/utils/rpg3dAssetsCore.js';
import { cloneConfig } from '../../../../shared/utils/rpg3dDomain.js';
import {
  DEFAULT_RPG3D_ACT_ID,
  DEFAULT_RPG3D_CANVAS_ID,
  cloneStudioProjectForEdit,
  createConfigFromSavedAssets,
  createFallbackRpg3DCanvas,
  createRpg3DCanvasDraft,
  getActiveRpg3DCanvas,
  getDefaultRpg3DActs,
  getRpg3DCanvasStructure,
  syncStudioProjectActiveCanvasConfig,
} from '../../../../shared/utils/rpg3dStudioProject.js';

const RPG3D_CANVAS_LOADING_DURATION_MS = 1250;

export function useRpg3DCanvasManagement({
  actionZoneTriggerRef,
  configRef,
  createId,
  markAutosaveDirty,
  playMode,
  pushHistorySnapshot,
  resetGame,
  setConfig,
  setIsPaused,
  setMode,
  setMultiSelected,
  setPendingPlacement,
  setSelected,
  setStudioProject,
  showRpg3DLoadingBar,
  studioProject,
  studioProjectRef,
  syncActiveCanvasConfigInRef,
  workspaceTab,
} = {}) {
  const previousActiveRpg3DCanvasIdRef = useRef('');
  const activeRpg3DCanvas = getActiveRpg3DCanvas(studioProject);
  const activeRpg3DCanvasId = activeRpg3DCanvas?.id || studioProject.rpg3dActiveCanvasId || DEFAULT_RPG3D_CANVAS_ID;
  const rpg3DCanvasOptions = studioProject.rpg3dCanvases || [];

  useEffect(() => {
    const previousCanvasId = previousActiveRpg3DCanvasIdRef.current;
    previousActiveRpg3DCanvasIdRef.current = activeRpg3DCanvasId;
    if (!previousCanvasId || previousCanvasId === activeRpg3DCanvasId || !playMode) return;
    showRpg3DLoadingBar({
      tone: 'canvas',
      label: 'Chargement du canevas',
      detail: activeRpg3DCanvas?.name || 'Nouveau canevas',
      durationMs: RPG3D_CANVAS_LOADING_DURATION_MS,
    });
  }, [activeRpg3DCanvas?.name, activeRpg3DCanvasId, playMode, showRpg3DLoadingBar]);

  const selectRpg3DCanvas = useCallback((canvasId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    if (!targetCanvas) return;
    if (syncedProject.rpg3dActiveCanvasId === targetCanvas.id) {
      setStudioProject(syncedProject);
      return;
    }
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActiveCanvasId = targetCanvas.id;
    const nextCanvas = nextProject.rpg3dCanvases.find((canvas) => canvas.id === targetCanvas.id) || targetCanvas;
    const synced = syncConfigModelReferences(createConfigFromSavedAssets(nextCanvas.config), nextProject, { preferLocalBlob: true });
    const nextConfig = synced.config;
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, targetCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    markAutosaveDirty();
  }, [
    configRef,
    markAutosaveDirty,
    pushHistorySnapshot,
    resetGame,
    setConfig,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setStudioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    workspaceTab,
  ]);

  const activateRpg3DCanvasPortal = useCallback((canvasId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    if (!targetCanvas || syncedProject.rpg3dActiveCanvasId === targetCanvas.id) return false;
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActiveCanvasId = targetCanvas.id;
    const nextCanvas = nextProject.rpg3dCanvases.find((canvas) => canvas.id === targetCanvas.id) || targetCanvas;
    const synced = syncConfigModelReferences(createConfigFromSavedAssets(nextCanvas.config), nextProject, { preferLocalBlob: true });
    const nextConfig = synced.config;
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, targetCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    actionZoneTriggerRef.current = { key: 'portal-transition', cooldownUntil: performance.now() + 950 };
    setMode('play');
    setIsPaused(false);
    return true;
  }, [
    actionZoneTriggerRef,
    configRef,
    resetGame,
    setConfig,
    setIsPaused,
    setMode,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setStudioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    workspaceTab,
  ]);

  const createRpg3DCanvas = useCallback(({ actId = '' } = {}) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    const fallbackAct = nextProject.rpg3dActs[0] || getDefaultRpg3DActs()[0];
    const targetActId = nextProject.rpg3dActs.some((act) => act.id === actId)
      ? actId
      : fallbackAct.id;
    const nextCanvas = createRpg3DCanvasDraft({
      index: nextProject.rpg3dCanvases.length,
      actId: targetActId,
    });
    nextProject.rpg3dCanvases = [...(nextProject.rpg3dCanvases || []), nextCanvas];
    nextProject.rpg3dScenes = [
      ...(nextProject.rpg3dScenes || []),
      { id: nextCanvas.id, name: nextCanvas.name, actId: targetActId, parentSceneId: '' },
    ];
    nextProject.rpg3dActiveCanvasId = nextCanvas.id;
    const nextConfig = createConfigFromSavedAssets(nextCanvas.config);
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, nextCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    markAutosaveDirty();
    return nextCanvas.id;
  }, [
    configRef,
    markAutosaveDirty,
    pushHistorySnapshot,
    resetGame,
    setConfig,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setStudioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    workspaceTab,
  ]);

  const deleteRpg3DCanvas = useCallback((canvasId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const canvases = syncedProject.rpg3dCanvases || [];
    if (canvases.length <= 1) return;
    if (!canvases.some((canvas) => canvas.id === canvasId)) return;
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    const removedCanvas = nextProject.rpg3dCanvases.find((canvas) => canvas.id === canvasId);
    const wasActive = nextProject.rpg3dActiveCanvasId === canvasId;
    nextProject.rpg3dCanvases = nextProject.rpg3dCanvases.filter((canvas) => canvas.id !== canvasId);
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).filter((scene) => (
      scene.id !== canvasId && scene.id !== removedCanvas?.sceneId
    ));
    let nextConfig = configRef.current;
    if (wasActive) {
      const nextCanvas = nextProject.rpg3dCanvases[0] || createFallbackRpg3DCanvas();
      nextProject.rpg3dActiveCanvasId = nextCanvas.id;
      nextConfig = createConfigFromSavedAssets(nextCanvas.config);
    }
    const finalProject = wasActive
      ? syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, nextProject.rpg3dActiveCanvasId)
      : nextProject;
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    if (wasActive) {
      setSelected(null);
      setMultiSelected([]);
      setPendingPlacement(null);
      resetGame(nextConfig);
    }
    markAutosaveDirty();
  }, [
    configRef,
    markAutosaveDirty,
    pushHistorySnapshot,
    resetGame,
    setConfig,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setStudioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    workspaceTab,
  ]);

  const keepOnlyActiveRpg3DCanvas = useCallback(() => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const activeCanvasId = syncedProject.rpg3dActiveCanvasId || syncedProject.rpg3dCanvases?.[0]?.id || '';
    const activeCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === activeCanvasId);
    if (!activeCanvas || (syncedProject.rpg3dCanvases || []).length <= 1) return;
    pushHistorySnapshot();
    const structure = getRpg3DCanvasStructure(syncedProject);
    const activeAct = structure.acts.find((act) => act.id === activeCanvas.actId) || {
      id: activeCanvas.actId || DEFAULT_RPG3D_ACT_ID,
      name: 'Acte I',
    };
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActs = [{ id: activeAct.id, name: activeAct.name || 'Acte I' }];
    nextProject.rpg3dScenes = [{
      id: activeCanvas.id,
      name: activeCanvas.name || 'Scene 1',
      actId: activeAct.id,
      parentSceneId: '',
    }];
    nextProject.rpg3dCanvases = [{
      ...activeCanvas,
      actId: activeAct.id,
      sceneId: activeCanvas.id,
      config: cloneConfig(configRef.current),
      updatedAt: new Date().toISOString(),
    }];
    nextProject.rpg3dActiveCanvasId = activeCanvas.id;
    const nextConfig = createConfigFromSavedAssets(nextProject.rpg3dCanvases[0].config);
    const finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, activeCanvas.id);
    configRef.current = nextConfig;
    studioProjectRef.current = finalProject;
    setConfig(nextConfig);
    setStudioProject(finalProject);
    setSelected(null);
    setMultiSelected([]);
    setPendingPlacement(null);
    resetGame(nextConfig);
    markAutosaveDirty();
  }, [
    configRef,
    markAutosaveDirty,
    pushHistorySnapshot,
    resetGame,
    setConfig,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
    setStudioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    workspaceTab,
  ]);

  const createRpg3DAct = useCallback(() => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    const nextAct = {
      id: createId('rpg3d-act'),
      name: `Acte ${nextProject.rpg3dActs.length + 1}`,
    };
    nextProject.rpg3dActs = [...(nextProject.rpg3dActs || []), nextAct];
    studioProjectRef.current = nextProject;
    setStudioProject(nextProject);
    markAutosaveDirty();
    return nextAct.id;
  }, [configRef, createId, markAutosaveDirty, pushHistorySnapshot, setStudioProject, studioProjectRef, syncActiveCanvasConfigInRef, workspaceTab]);

  const renameRpg3DAct = useCallback((actId, name) => {
    const nextName = String(name ?? '').slice(0, 80);
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const currentAct = (syncedProject.rpg3dActs || []).find((act) => act.id === actId);
    if (!currentAct || currentAct.name === nextName) return;
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActs = nextProject.rpg3dActs.map((act) => (
      act.id === actId ? { ...act, name: nextName } : act
    ));
    studioProjectRef.current = nextProject;
    setStudioProject(nextProject);
    markAutosaveDirty();
  }, [configRef, markAutosaveDirty, pushHistorySnapshot, setStudioProject, studioProjectRef, syncActiveCanvasConfigInRef, workspaceTab]);

  const deleteRpg3DAct = useCallback((actId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const acts = syncedProject.rpg3dActs || [];
    const canvases = syncedProject.rpg3dCanvases || [];
    if (acts.length <= 1) return;
    if (canvases.some((canvas) => canvas.actId === actId)) return;
    if (!acts.some((act) => act.id === actId)) return;
    pushHistorySnapshot();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dActs = nextProject.rpg3dActs.filter((act) => act.id !== actId);
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).filter((scene) => scene.actId !== actId);
    studioProjectRef.current = nextProject;
    setStudioProject(nextProject);
    markAutosaveDirty();
  }, [configRef, markAutosaveDirty, pushHistorySnapshot, setStudioProject, studioProjectRef, syncActiveCanvasConfigInRef, workspaceTab]);

  const renameRpg3DCanvas = useCallback((canvasId, name) => {
    const nextName = String(name ?? '').slice(0, 100);
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    if (!targetCanvas || targetCanvas.name === nextName) return;
    pushHistorySnapshot();
    const renamedAt = new Date().toISOString();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dCanvases = nextProject.rpg3dCanvases.map((canvas) => {
      if (canvas.id !== canvasId) return canvas;
      const nextCanvasConfig = createConfigFromSavedAssets(canvas.config);
      nextCanvasConfig.meta = {
        ...(nextCanvasConfig.meta || {}),
        title: nextName || nextCanvasConfig.meta?.title || 'Canevas',
      };
      return {
        ...canvas,
        name: nextName,
        sceneId: canvas.id,
        config: nextCanvasConfig,
        updatedAt: renamedAt,
      };
    });
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).map((scene) => (
      scene.id === targetCanvas.sceneId || scene.id === targetCanvas.id
        ? { ...scene, id: targetCanvas.id, name: nextName || scene.name }
        : scene
    ));

    let finalProject = nextProject;
    if (nextProject.rpg3dActiveCanvasId === canvasId) {
      const nextConfig = cloneConfig(configRef.current);
      nextConfig.meta = {
        ...(nextConfig.meta || {}),
        title: nextName || nextConfig.meta?.title || 'Canevas',
      };
      configRef.current = nextConfig;
      setConfig(nextConfig);
      finalProject = syncStudioProjectActiveCanvasConfig(nextProject, nextConfig, canvasId);
    }
    studioProjectRef.current = finalProject;
    setStudioProject(finalProject);
    markAutosaveDirty();
  }, [configRef, markAutosaveDirty, pushHistorySnapshot, setConfig, setStudioProject, studioProjectRef, syncActiveCanvasConfigInRef, workspaceTab]);

  const moveRpg3DCanvasToAct = useCallback((canvasId, actId) => {
    const syncedProject = syncActiveCanvasConfigInRef(configRef.current, { updateState: workspaceTab === 'canvases' });
    const targetCanvas = (syncedProject.rpg3dCanvases || []).find((canvas) => canvas.id === canvasId);
    const targetAct = (syncedProject.rpg3dActs || []).find((act) => act.id === actId);
    if (!targetCanvas || !targetAct || targetCanvas.actId === actId) return;
    pushHistorySnapshot();
    const movedAt = new Date().toISOString();
    const nextProject = cloneStudioProjectForEdit(syncedProject, null, null);
    nextProject.rpg3dCanvases = nextProject.rpg3dCanvases.map((canvas) => (
      canvas.id === canvasId
        ? { ...canvas, actId, sceneId: canvas.id, updatedAt: movedAt }
        : canvas
    ));
    nextProject.rpg3dScenes = (nextProject.rpg3dScenes || []).map((scene) => (
      scene.id === targetCanvas.sceneId || scene.id === targetCanvas.id
        ? { ...scene, id: targetCanvas.id, actId }
        : scene
    ));
    const finalProject = nextProject.rpg3dActiveCanvasId === canvasId
      ? syncStudioProjectActiveCanvasConfig(nextProject, configRef.current, canvasId)
      : nextProject;
    studioProjectRef.current = finalProject;
    setStudioProject(finalProject);
    markAutosaveDirty();
  }, [configRef, markAutosaveDirty, pushHistorySnapshot, setStudioProject, studioProjectRef, syncActiveCanvasConfigInRef, workspaceTab]);

  return {
    activeRpg3DCanvas,
    activeRpg3DCanvasId,
    activateRpg3DCanvasPortal,
    createRpg3DAct,
    createRpg3DCanvas,
    deleteRpg3DAct,
    deleteRpg3DCanvas,
    keepOnlyActiveRpg3DCanvas,
    moveRpg3DCanvasToAct,
    renameRpg3DAct,
    renameRpg3DCanvas,
    rpg3DCanvasOptions,
    selectRpg3DCanvas,
  };
}

export default useRpg3DCanvasManagement;
