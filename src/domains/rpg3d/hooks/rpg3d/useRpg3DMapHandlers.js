import { useCallback } from 'react';
import {
  applyGroupDragToConfig,
  findEntityAt,
  getEntityCenterPoint,
  isSameEntity,
  moveMapEntityToPoint,
  resolveFlatTileDragPoint,
} from '../../../../shared/utils/rpg3dMapEditing.js';
import {
  ACTION_ZONE_DEFAULT_HEIGHT,
  ACTION_ZONE_DEFAULT_MODEL_HEIGHT,
  ACTION_ZONE_DEFAULT_OPACITY,
  ACTION_ZONE_DEFAULT_WIDTH,
} from '../../../../shared/utils/rpg3dDomain.js';
import { getDefaultPortalTargetCanvasId } from '../../../../shared/utils/rpg3dStudioProject.js';

export default function useRpg3DMapHandlers({
  canMultiSelectEntity,
  commitPendingPlacement,
  configRef,
  createDefaultNpcChoices,
  createId,
  duplicateSelectedTile,
  mode,
  multiDragRef,
  multiSelected,
  multiSelectMode,
  patchConfig,
  pendingPlacement,
  selectSingleEntity,
  setIsPaused,
  setMode,
  setMultiSelected,
  setPlayerMoveTarget,
  setSelected,
  setTool,
  studioProjectRef,
  toggleMultiSelectedEntity,
  tool,
}) {
  const handleWorldDragStart = useCallback((entity) => {
    if (!entity || entity.type === 'tileDuplicate') return;
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setSelected({ type: entity.type, id: entity.id });
    const liveConfig = configRef.current;
    const activeEntity = { type: entity.type, id: entity.id };
    const group = multiSelected.some((entry) => isSameEntity(entry, activeEntity))
      ? multiSelected
      : [activeEntity];
    const anchor = getEntityCenterPoint(liveConfig, activeEntity);
    multiDragRef.current = anchor ? {
      anchor,
      items: group
        .filter(canMultiSelectEntity)
        .map((entry) => ({ entity: entry, start: getEntityCenterPoint(liveConfig, entry) }))
        .filter((entry) => entry.start),
    } : null;
    if (!multiSelected.some((entry) => isSameEntity(entry, activeEntity))) {
      setMultiSelected([activeEntity]);
    }
  }, [
    canMultiSelectEntity,
    configRef,
    multiDragRef,
    multiSelected,
    setIsPaused,
    setMode,
    setMultiSelected,
    setSelected,
    setTool,
  ]);

  const handleWorldDrag = useCallback((entity, point) => {
    if (!entity || entity.type === 'tileDuplicate') return;
    if (multiDragRef.current) multiDragRef.current.latestPoint = point;
  }, [multiDragRef]);

  const resolveWorldDragPoint = useCallback((entity, point) => {
    if (!entity || entity.type === 'tileDuplicate' || !multiDragRef.current) return point;
    return resolveFlatTileDragPoint(configRef.current, multiDragRef.current, entity, point, { snap: true });
  }, [configRef, multiDragRef]);

  const handleWorldDrop = useCallback((entity, point) => {
    if (!entity || entity.type === 'tileDuplicate') return;
    patchConfig((next) => {
      if (multiDragRef.current?.items?.length) {
        applyGroupDragToConfig(next, multiDragRef.current, point, { snap: true });
      } else {
        moveMapEntityToPoint(next, entity, point, { snap: true });
      }
    }, false);
    multiDragRef.current = null;
  }, [multiDragRef, patchConfig]);

  const handleWorldClick = useCallback((point, entity = null, button = 0, options = {}) => {
    if (mode === 'play') {
      if (button === 0) {
        setPlayerMoveTarget(point, { continuous: Boolean(options.continuous) });
      }
      return;
    }
    if (mode !== 'edit') return;
    if (pendingPlacement && button === 0) {
      commitPendingPlacement(point);
      return;
    }
    if (entity?.type === 'tileDuplicate') {
      duplicateSelectedTile(entity.direction, entity.id);
      return;
    }
    if (tool === 'select') {
      const target = entity || findEntityAt(configRef.current, point);
      if (multiSelectMode) {
        if (canMultiSelectEntity(target)) toggleMultiSelectedEntity(target);
        else {
          setSelected(null);
          setMultiSelected([]);
        }
        return;
      }
      selectSingleEntity(target);
      return;
    }
    patchConfig((next) => {
      if (tool === 'obstacle') {
        const item = { id: createId('wall'), x: Math.round(point.x - 90), y: Math.round(point.y - 35), z: 0, w: 180, h: 70 };
        next.obstacles.push(item);
        setSelected({ type: 'obstacle', id: item.id });
      }
      if (tool === 'enemy') {
        const item = {
          id: createId('enemy'),
          x: Math.round(point.x),
          y: Math.round(point.y),
          z: 0,
          rotation: 0,
          role: 'rifle',
          character: 'guard',
          characterImageData: '',
          characterImageName: '',
          characterModel3dId: '',
          characterModelUrl: '',
          characterModelName: '',
          characterModelResources: [],
          characterModelAnimations: {},
          characterRenderMode: 'capsule',
          characterModelScale: 1,
          characterMaterialBrightness: 1,
          combatEnemyName: 'Ennemi',
          combatEnemyMaxHealth: 8,
          combatEnemyStrength: 2,
          combatEnemyMaxMana: 0,
          combatEnemyPowerManaCost: 3,
          combatEnemyPowerDamage: 0,
          combatEnemyPowerUsageChance: 25,
        };
        next.enemies.push(item);
        setSelected({ type: 'enemy', id: item.id });
      }
      if (tool === 'pickup') {
        const item = { id: createId('pickup'), x: Math.round(point.x), y: Math.round(point.y), z: 0, type: 'health' };
        next.pickups.push(item);
        setSelected({ type: 'pickup', id: item.id });
      }
      if (tool === 'actionZone') {
        const item = {
          id: createId('zone'),
          name: 'Zone transparente',
          x: Math.round(point.x),
          y: Math.round(point.y),
          rotation: 0,
          w: ACTION_ZONE_DEFAULT_WIDTH,
          h: ACTION_ZONE_DEFAULT_HEIGHT,
          modelHeight: ACTION_ZONE_DEFAULT_MODEL_HEIGHT,
          renderMode: 'volume',
          color: '#38bdf8',
          opacity: ACTION_ZONE_DEFAULT_OPACITY,
          actionType: 'portal',
          targetCanvasId: getDefaultPortalTargetCanvasId(studioProjectRef.current),
          targetNpcId: '',
          npcAction: 'talk',
          npcInteractionMode: 'message',
          npcQuestion: 'Que veux-tu demander ?',
          npcChoices: createDefaultNpcChoices(),
          message: '',
          triggerMode: 'enter',
          visibleInPlay: false,
        };
        next.actionZones = Array.isArray(next.actionZones) ? next.actionZones : [];
        next.actionZones.push(item);
        setSelected({ type: 'actionZone', id: item.id });
      }
      if (tool === 'relief') {
        const item = {
          id: createId('relief'),
          name: 'Relief',
          x: Math.round(point.x),
          y: Math.round(point.y),
          w: 300,
          h: 180,
          elevation: 28,
          style: 'plateau',
          blocksMovement: false,
        };
        next.reliefs = Array.isArray(next.reliefs) ? next.reliefs : [];
        next.reliefs.push(item);
        setSelected({ type: 'relief', id: item.id });
      }
      if (tool === 'prop') {
        const item = {
          id: createId('prop'),
          name: 'Decor',
          x: Math.round(point.x),
          y: Math.round(point.y),
          z: 0,
          rotation: 0,
          modelRotationX: 0,
          modelRotationY: 0,
          modelRotationZ: 0,
          modelCenterOnOrigin: false,
          modelFlushToGround: false,
          r: 34,
          w: 68,
          h: 68,
          modelHeight: 68,
          renderMode: 'rock',
          blocksMovement: true,
          imageData: '',
          imageName: '',
        };
        next.props.push(item);
        setSelected({ type: 'prop', id: item.id });
      }
    });
    if (tool === 'actionZone') setTool('select');
  }, [
    canMultiSelectEntity,
    commitPendingPlacement,
    configRef,
    createDefaultNpcChoices,
    createId,
    duplicateSelectedTile,
    mode,
    multiSelectMode,
    patchConfig,
    pendingPlacement,
    selectSingleEntity,
    setMultiSelected,
    setPlayerMoveTarget,
    setSelected,
    setTool,
    studioProjectRef,
    toggleMultiSelectedEntity,
    tool,
  ]);

  const handleMoveHoldChange = useCallback((held) => {
    if (!held) setPlayerMoveTarget(null);
  }, [setPlayerMoveTarget]);

  return {
    handleMoveHoldChange,
    handleWorldClick,
    handleWorldDrag,
    handleWorldDragStart,
    handleWorldDrop,
    resolveWorldDragPoint,
  };
}
