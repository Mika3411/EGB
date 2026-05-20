import { useCallback, useEffect, useRef, useState } from 'react';
import {
  createRpg3DHistorySnapshot,
  readSavedArcadeAssets,
} from '../utils/rpg3dAssetsStorage.js';
import {
  cloneConfig,
  createInitialState,
  getPlayableHeroId,
} from '../utils/rpg3dDomain.js';
import {
  cloneStudioProjectForEdit,
  createConfigFromSavedAssets,
  createDefaultStudioProject,
  createStudioProjectFromSavedAssets,
  getActiveRpg3DCanvas,
  syncStudioProjectActiveCanvasConfig,
} from '../utils/rpg3dStudioProject.js';

export const RPG3D_HISTORY_LIMIT = 60;

export function useRpg3DProjectState({
  project = null,
  selectedRef,
  modeRef,
  actionZoneTriggerRef,
  lastFrameRef,
  setActiveNpcChoice = () => {},
} = {}) {
  const fallbackSelectedRef = useRef(null);
  const fallbackModeRef = useRef('edit');
  const fallbackActionZoneTriggerRef = useRef({ key: '', cooldownUntil: 0 });
  const fallbackLastFrameRef = useRef(0);
  const currentSelectedRef = selectedRef || fallbackSelectedRef;
  const currentModeRef = modeRef || fallbackModeRef;
  const currentActionZoneTriggerRef = actionZoneTriggerRef || fallbackActionZoneTriggerRef;
  const currentLastFrameRef = lastFrameRef || fallbackLastFrameRef;

  const autosaveVersionRef = useRef(0);
  const lastSavedAutosaveVersionRef = useRef(0);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [initialArcadeAssets] = useState(() => {
    const saved = readSavedArcadeAssets();
    const studio = createStudioProjectFromSavedAssets(saved?.studioProject, saved?.config, project);
    const activeCanvas = getActiveRpg3DCanvas(studio);
    return {
      saved,
      studioProject: studio,
      config: createConfigFromSavedAssets(activeCanvas?.config || saved?.config),
    };
  });
  const [config, setConfig] = useState(() => initialArcadeAssets.config);
  const configRef = useRef(config);
  const stateRef = useRef(createInitialState(config));
  const [snapshot, setSnapshot] = useState(() => createInitialState(config));
  const [studioProject, setStudioProject] = useState(() => initialArcadeAssets.studioProject);
  const studioProjectRef = useRef(studioProject);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    studioProjectRef.current = studioProject;
  }, [studioProject]);

  const markAutosaveDirty = useCallback(() => {
    autosaveVersionRef.current += 1;
  }, []);

  const syncActiveCanvasConfigInRef = useCallback((nextConfig, options = {}) => {
    const nextStudioProject = syncStudioProjectActiveCanvasConfig(studioProjectRef.current, nextConfig);
    studioProjectRef.current = nextStudioProject;
    if (options.updateState) setStudioProject(nextStudioProject);
    return nextStudioProject;
  }, []);

  const resetGame = useCallback((nextConfig = configRef.current, options = {}) => {
    const nextMode = options.mode || currentModeRef.current;
    const selectedHeroId = currentSelectedRef.current?.type === 'hero' ? currentSelectedRef.current.id : '';
    const controlledHeroId = nextMode === 'play' ? getPlayableHeroId(nextConfig, selectedHeroId) : '';
    stateRef.current = createInitialState(nextConfig, { controlledHeroId });
    currentActionZoneTriggerRef.current = { key: '', cooldownUntil: 0 };
    currentLastFrameRef.current = 0;
    setActiveNpcChoice(null);
    setSnapshot(stateRef.current);
  }, [currentActionZoneTriggerRef, currentLastFrameRef, currentModeRef, currentSelectedRef, setActiveNpcChoice]);

  const clearHistoryStacks = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setUndoStack([]);
    setRedoStack([]);
  }, []);

  const pushHistorySnapshot = useCallback(() => {
    const historySnapshot = createRpg3DHistorySnapshot(configRef.current, studioProjectRef.current);
    const nextUndoStack = [...undoStackRef.current.slice(-(RPG3D_HISTORY_LIMIT - 1)), historySnapshot];
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = [];
    setUndoStack(nextUndoStack);
    setRedoStack([]);
  }, []);

  const restoreHistorySnapshot = useCallback((historySnapshot) => {
    if (!historySnapshot) return;
    const nextConfig = cloneConfig(historySnapshot.config);
    const nextStudioProject = syncStudioProjectActiveCanvasConfig(
      cloneStudioProjectForEdit(historySnapshot.studioProject || createDefaultStudioProject()),
      nextConfig,
    );
    configRef.current = nextConfig;
    studioProjectRef.current = nextStudioProject;
    setConfig(nextConfig);
    setStudioProject(nextStudioProject);
    resetGame(nextConfig);
    markAutosaveDirty();
  }, [markAutosaveDirty, resetGame]);

  const undoProjectChange = useCallback(() => {
    const previousUndoStack = undoStackRef.current;
    if (!previousUndoStack.length) return;
    const historySnapshot = previousUndoStack[previousUndoStack.length - 1];
    const currentSnapshot = createRpg3DHistorySnapshot(configRef.current, studioProjectRef.current);
    const nextUndoStack = previousUndoStack.slice(0, -1);
    const nextRedoStack = [...redoStackRef.current.slice(-(RPG3D_HISTORY_LIMIT - 1)), currentSnapshot];
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = nextRedoStack;
    setUndoStack(nextUndoStack);
    setRedoStack(nextRedoStack);
    restoreHistorySnapshot(historySnapshot);
  }, [restoreHistorySnapshot]);

  const redoProjectChange = useCallback(() => {
    const previousRedoStack = redoStackRef.current;
    if (!previousRedoStack.length) return;
    const historySnapshot = previousRedoStack[previousRedoStack.length - 1];
    const currentSnapshot = createRpg3DHistorySnapshot(configRef.current, studioProjectRef.current);
    const nextRedoStack = previousRedoStack.slice(0, -1);
    const nextUndoStack = [...undoStackRef.current.slice(-(RPG3D_HISTORY_LIMIT - 1)), currentSnapshot];
    undoStackRef.current = nextUndoStack;
    redoStackRef.current = nextRedoStack;
    setUndoStack(nextUndoStack);
    setRedoStack(nextRedoStack);
    restoreHistorySnapshot(historySnapshot);
  }, [restoreHistorySnapshot]);

  const patchConfig = useCallback((recipe, shouldReset = true) => {
    pushHistorySnapshot();
    const next = cloneConfig(configRef.current);
    recipe(next);
    configRef.current = next;
    syncActiveCanvasConfigInRef(next);
    if (shouldReset) resetGame(next);
    setConfig(next);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot, resetGame, syncActiveCanvasConfigInRef]);

  const patchConfigWithoutHistory = useCallback((recipe, shouldReset = false) => {
    const next = cloneConfig(configRef.current);
    recipe(next);
    configRef.current = next;
    syncActiveCanvasConfigInRef(next);
    if (shouldReset) resetGame(next);
    setConfig(next);
    markAutosaveDirty();
  }, [markAutosaveDirty, resetGame, syncActiveCanvasConfigInRef]);

  const patchStudioProject = useCallback((recipe) => {
    pushHistorySnapshot();
    const next = cloneStudioProjectForEdit(studioProjectRef.current);
    recipe(next);
    studioProjectRef.current = next;
    setStudioProject(next);
    markAutosaveDirty();
  }, [markAutosaveDirty, pushHistorySnapshot]);

  return {
    autosaveVersionRef,
    clearHistoryStacks,
    config,
    configRef,
    initialArcadeAssets,
    lastSavedAutosaveVersionRef,
    markAutosaveDirty,
    patchConfig,
    patchConfigWithoutHistory,
    patchStudioProject,
    pushHistorySnapshot,
    redoProjectChange,
    redoStack,
    redoStackRef,
    resetGame,
    restoreHistorySnapshot,
    setConfig,
    setSnapshot,
    setStudioProject,
    snapshot,
    stateRef,
    studioProject,
    studioProjectRef,
    syncActiveCanvasConfigInRef,
    undoProjectChange,
    undoStack,
    undoStackRef,
  };
}

export default useRpg3DProjectState;
