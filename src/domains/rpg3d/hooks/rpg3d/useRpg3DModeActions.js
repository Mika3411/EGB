import { useCallback, useEffect } from 'react';
import { getPlayableHeroId } from '../../../../shared/utils/rpg3dDomain.js';

export default function useRpg3DModeActions({
  clearInputState,
  configRef,
  mode,
  modeRef,
  resetGame,
  selected,
  setCameraTargetPickMode,
  setCameraZoomDragMode,
  setDragMode,
  setIsPaused,
  setMode,
  setMultiSelectMode,
  setPendingPlacement,
  setTool,
  setTransformTool,
  stateRef,
  workspaceTab,
}) {
  const toggleCameraTargetPickMode = useCallback(() => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraZoomDragMode(false);
    setTransformTool('');
    setPendingPlacement(null);
    setCameraTargetPickMode((current) => !current);
  }, [
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

  const handleCameraTargetPick = useCallback((entity, success) => {
    if (success && entity) setCameraTargetPickMode(false);
  }, [setCameraTargetPickMode]);

  const handleTogglePlayMode = useCallback(() => {
    const nextMode = mode === 'play' ? 'edit' : 'play';
    setMode(nextMode);
    setIsPaused(false);
    resetGame(undefined, { mode: nextMode });
  }, [mode, resetGame, setIsPaused, setMode]);

  const handlePauseOrReset = useCallback(() => (
    mode === 'play' ? setIsPaused((paused) => !paused) : resetGame()
  ), [mode, resetGame, setIsPaused]);

  useEffect(() => {
    if (mode !== 'play') return;
    const selectedHeroId = selected?.type === 'hero' ? selected.id : '';
    const controlledHeroId = getPlayableHeroId(configRef.current, selectedHeroId);
    if (!controlledHeroId) return;
    if (stateRef.current.player?.controlledHeroId === controlledHeroId) return;
    resetGame(configRef.current, { mode: 'play' });
  }, [configRef, mode, resetGame, selected?.id, selected?.type, stateRef]);

  useEffect(() => {
    if (mode === 'play') {
      setCameraTargetPickMode(false);
      setTransformTool('');
    }
  }, [mode, setCameraTargetPickMode, setTransformTool]);

  useEffect(() => {
    if (workspaceTab === 'arcade') return;
    clearInputState();
    window.getSelection?.()?.removeAllRanges?.();
    if (modeRef.current !== 'play') return;
    setMode('edit');
    setIsPaused(false);
    resetGame(configRef.current, { mode: 'edit' });
  }, [clearInputState, configRef, modeRef, resetGame, setIsPaused, setMode, workspaceTab]);

  return {
    handleCameraTargetPick,
    handlePauseOrReset,
    handleTogglePlayMode,
    toggleCameraTargetPickMode,
  };
}
