import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useRpg3DProjectState, RPG3D_HISTORY_LIMIT } from '../hooks/useRpg3DProjectState.js';
import { DEFAULT_ARCADE_CONFIG } from '../utils/rpg3dDomain.js';
import { getActiveRpg3DCanvas } from '../utils/rpg3dStudioProject.js';

const renderProjectStateHook = () => {
  const selectedRef = { current: null };
  const modeRef = { current: 'edit' };
  const actionZoneTriggerRef = { current: { key: '', cooldownUntil: 0 } };
  const lastFrameRef = { current: 0 };
  return renderHook(() => useRpg3DProjectState({
    selectedRef,
    modeRef,
    actionZoneTriggerRef,
    lastFrameRef,
    setActiveNpcChoice: () => {},
  }));
};

describe('useRpg3DProjectState', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('keeps patchConfig, undo and redo synchronized with the active canvas config', () => {
    const { result } = renderProjectStateHook();
    const initialCanvasId = result.current.studioProject.rpg3dActiveCanvasId;

    act(() => {
      result.current.patchConfig((next) => {
        next.world.width = 1234;
        next.world.height = 987;
        next.obstacles = [{ id: 'wall-1', x: 10, y: 20, w: 30, h: 40 }];
      }, false);
    });

    expect(result.current.config.world).toMatchObject({ width: 1234, height: 987 });
    expect(result.current.configRef.current.world.width).toBe(1234);
    expect(result.current.studioProjectRef.current.rpg3dActiveCanvasId).toBe(initialCanvasId);
    expect(getActiveRpg3DCanvas(result.current.studioProjectRef.current).config.world.width).toBe(1234);
    expect(getActiveRpg3DCanvas(result.current.studioProjectRef.current).config.obstacles).toEqual([
      { id: 'wall-1', x: 10, y: 20, w: 30, h: 40 },
    ]);
    expect(result.current.undoStack).toHaveLength(1);
    expect(result.current.redoStack).toHaveLength(0);

    act(() => {
      result.current.undoProjectChange();
    });

    expect(result.current.config.world.width).toBe(DEFAULT_ARCADE_CONFIG.world.width);
    expect(result.current.configRef.current.world.width).toBe(DEFAULT_ARCADE_CONFIG.world.width);
    expect(result.current.studioProject.rpg3dActiveCanvasId).toBe(initialCanvasId);
    expect(getActiveRpg3DCanvas(result.current.studioProject).config.world.width).toBe(DEFAULT_ARCADE_CONFIG.world.width);
    expect(result.current.undoStack).toHaveLength(0);
    expect(result.current.redoStack).toHaveLength(1);

    act(() => {
      result.current.redoProjectChange();
    });

    expect(result.current.config.world).toMatchObject({ width: 1234, height: 987 });
    expect(result.current.configRef.current.world.width).toBe(1234);
    expect(result.current.studioProject.rpg3dActiveCanvasId).toBe(initialCanvasId);
    expect(getActiveRpg3DCanvas(result.current.studioProject).config.world.width).toBe(1234);
    expect(getActiveRpg3DCanvas(result.current.studioProject).config.obstacles).toEqual([
      { id: 'wall-1', x: 10, y: 20, w: 30, h: 40 },
    ]);
    expect(result.current.undoStack).toHaveLength(1);
    expect(result.current.redoStack).toHaveLength(0);
  });

  it('preserves the RPG 3D history limit', () => {
    const { result } = renderProjectStateHook();

    act(() => {
      for (let index = 0; index < RPG3D_HISTORY_LIMIT + 5; index += 1) {
        result.current.patchConfig((next) => {
          next.world.width = DEFAULT_ARCADE_CONFIG.world.width + index + 1;
        }, false);
      }
    });

    expect(RPG3D_HISTORY_LIMIT).toBe(60);
    expect(result.current.undoStack).toHaveLength(RPG3D_HISTORY_LIMIT);
    expect(result.current.undoStackRef.current).toHaveLength(RPG3D_HISTORY_LIMIT);
  });
});
