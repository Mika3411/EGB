import { useCallback, useState } from 'react';
import { DEFAULT_ARCADE_CONFIG, clamp } from '../../../../shared/utils/rpg3dDomain.js';
import { moveMapEntityToPoint } from '../../../../shared/utils/rpg3dMapEditing.js';

export function useRpg3DPlacement({
  canMultiSelectEntity,
  configRef,
  getPlacementCameraDistance,
  patchConfigWithoutHistory,
  patchViewportEngineConfig,
  pointerRef,
  setCameraTargetPickMode,
  setDragMode,
  setIsPaused,
  setMode,
  setMultiSelectMode,
  setMultiSelected,
  setSelected,
  setTool,
} = {}) {
  const [pendingPlacement, setPendingPlacement] = useState(null);

  const getCurrentPlacementPoint = useCallback((nextConfig) => {
    const world = nextConfig.world || DEFAULT_ARCADE_CONFIG.world;
    const pointer = pointerRef.current;
    const fallbackX = Number(nextConfig.player?.x) || world.width / 2;
    const fallbackY = Number(nextConfig.player?.y) || world.height / 2;
    return {
      x: clamp(pointer.hasWorldPoint && Number.isFinite(pointer.worldX) ? pointer.worldX : fallbackX, 0, world.width),
      y: clamp(pointer.hasWorldPoint && Number.isFinite(pointer.worldY) ? pointer.worldY : fallbackY, 0, world.height),
    };
  }, [pointerRef]);

  const beginEntityPlacement = useCallback((entity) => {
    if (!entity?.type || !entity.id) return;
    const cameraDistance = getPlacementCameraDistance(configRef.current, entity);
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setDragMode(false);
    setMultiSelectMode(false);
    setCameraTargetPickMode(false);
    setPendingPlacement(entity);
    setSelected(entity);
    setMultiSelected(canMultiSelectEntity(entity) ? [entity] : []);
    if (!['hero', 'enemy'].includes(entity.type)) return;
    patchViewportEngineConfig((engine) => {
      const currentDistance = Number(engine.cameraDistance) || DEFAULT_ARCADE_CONFIG.engine.cameraDistance;
      if (Math.abs(currentDistance - cameraDistance) > 0.5) engine.cameraDistance = cameraDistance;
    });
  }, [
    canMultiSelectEntity,
    configRef,
    getPlacementCameraDistance,
    patchViewportEngineConfig,
    setCameraTargetPickMode,
    setDragMode,
    setIsPaused,
    setMode,
    setMultiSelectMode,
    setMultiSelected,
    setSelected,
    setTool,
  ]);

  const commitPendingPlacement = useCallback((point) => {
    if (!pendingPlacement || !point) return false;
    const entity = pendingPlacement;
    patchConfigWithoutHistory((next) => {
      moveMapEntityToPoint(next, entity, point, { snap: false });
    }, false);
    setPendingPlacement(null);
    setSelected(entity);
    setMultiSelected(canMultiSelectEntity(entity) ? [entity] : []);
    return true;
  }, [
    canMultiSelectEntity,
    patchConfigWithoutHistory,
    pendingPlacement,
    setMultiSelected,
    setSelected,
  ]);

  return {
    beginEntityPlacement,
    commitPendingPlacement,
    getCurrentPlacementPoint,
    pendingPlacement,
    setPendingPlacement,
  };
}

export default useRpg3DPlacement;
