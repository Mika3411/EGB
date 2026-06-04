import { useCallback } from 'react';
import {
  MAP_ENTITY_COLLECTIONS,
  duplicateMapEntityIntoConfig,
  getSelectedEntity,
  getSelectionEntities,
  snapFlatTileToNeighbors,
} from '../../../../shared/utils/rpg3dMapEditing.js';
import {
  clamp,
  getFlatTileSnapOverlap,
  getFlatTileWorldBounds,
  getFlatTileWorldDimensions,
  getFloorTileWorldSize,
  getFloorZeroZ,
  getPropRenderMode,
  isFlatTileLikeProp,
  isFloorTileProp,
} from '../../../../shared/utils/rpg3dDomain.js';

export default function useRpg3DEditingCommands({
  configRef,
  createId,
  getDeletableSelectionEntities,
  getSelectionDuplicateOffset,
  isDuplicableSelectionEntity,
  isProtectedMapEntity,
  multiSelected,
  patchConfig,
  selected,
  setIsPaused,
  setMode,
  setMultiSelected,
  setPendingPlacement,
  setSelected,
  setTool,
  setWorkspaceTab,
}) {
  const duplicateSelected = useCallback(() => {
    const liveTargets = getSelectionEntities(configRef.current, selected, multiSelected);
    if (!liveTargets.length || !liveTargets.every(isDuplicableSelectionEntity)) return;
    patchConfig((next) => {
      const targets = getSelectionEntities(next, selected, multiSelected);
      if (!targets.length || !targets.every(isDuplicableSelectionEntity)) return;
      const commonOffset = targets.length > 1
        ? getSelectionDuplicateOffset(targets, next.world)
        : null;
      const nextSelection = targets
        .map((target) => duplicateMapEntityIntoConfig(next, target, commonOffset))
        .filter(Boolean);
      setSelected(nextSelection[nextSelection.length - 1] || null);
      setMultiSelected(nextSelection);
    });
  }, [
    configRef,
    getSelectionDuplicateOffset,
    isDuplicableSelectionEntity,
    multiSelected,
    patchConfig,
    selected,
    setMultiSelected,
    setSelected,
  ]);

  const duplicateSelectedTile = useCallback((direction, sourceId = selected?.id) => {
    if (!sourceId) return;
    patchConfig((next) => {
      const collection = next.props || [];
      const selectedTileIds = new Set((multiSelected || [])
        .filter((entry) => entry?.type === 'prop')
        .map((entry) => entry.id));
      const selectedTiles = selectedTileIds.size > 1
        ? collection.filter((item) => selectedTileIds.has(item.id) && isFlatTileLikeProp(item))
        : [];
      if (selectedTiles.length > 1) {
        const bounds = getFlatTileWorldBounds(selectedTiles);
        if (!bounds) return;
        const groupWidth = Math.max(12, bounds.maxX - bounds.minX);
        const groupHeight = Math.max(12, bounds.maxY - bounds.minY);
        const overlapX = getFlatTileSnapOverlap(groupWidth);
        const overlapY = getFlatTileSnapOverlap(groupHeight);
        const offsets = {
          left: { x: -(groupWidth - overlapX), y: 0 },
          right: { x: groupWidth - overlapX, y: 0 },
          up: { x: 0, y: -(groupHeight - overlapY) },
          down: { x: 0, y: groupHeight - overlapY },
        };
        const offset = { ...(offsets[direction] || offsets.right) };
        const worldWidth = Number(next.world?.width) || groupWidth;
        const worldHeight = Number(next.world?.height) || groupHeight;
        if (bounds.minX + offset.x < 0) offset.x += -(bounds.minX + offset.x);
        if (bounds.maxX + offset.x > worldWidth) offset.x -= bounds.maxX + offset.x - worldWidth;
        if (bounds.minY + offset.y < 0) offset.y += -(bounds.minY + offset.y);
        if (bounds.maxY + offset.y > worldHeight) offset.y -= bounds.maxY + offset.y - worldHeight;
        const copies = selectedTiles.map((original) => {
          const { width: tileWidth, height: tileHeight } = getFlatTileWorldDimensions(original);
          const copy = structuredClone(original);
          copy.id = createId('prop');
          copy.name = original.name || 'Dalle sol';
          if (isFloorTileProp(copy)) {
            copy.w = tileWidth;
            copy.h = tileHeight;
            copy.r = Math.round(Math.max(tileWidth, tileHeight) / 2);
            copy.modelHeight = 12;
          }
          copy.blocksMovement = false;
          copy.x = clamp((Number(original.x) || 0) + offset.x, tileWidth / 2, worldWidth - tileWidth / 2);
          copy.y = clamp((Number(original.y) || 0) + offset.y, tileHeight / 2, worldHeight - tileHeight / 2);
          return copy;
        });
        collection.push(...copies);
        next.props = collection;
        const nextSelection = copies.map((copy) => ({ type: 'prop', id: copy.id }));
        setSelected(nextSelection[nextSelection.length - 1] || null);
        setMultiSelected(nextSelection);
        return;
      }
      const original = collection.find((item) => item.id === sourceId);
      if (!original || !isFlatTileLikeProp(original)) return;
      const { width: tileWidth, height: tileHeight } = getFlatTileWorldDimensions(original);
      const overlapX = getFlatTileSnapOverlap(tileWidth);
      const overlapY = getFlatTileSnapOverlap(tileHeight);
      const offsets = {
        left: { x: -(tileWidth - overlapX), y: 0 },
        right: { x: tileWidth - overlapX, y: 0 },
        up: { x: 0, y: -(tileHeight - overlapY) },
        down: { x: 0, y: tileHeight - overlapY },
      };
      const offset = offsets[direction] || offsets.right;
      const copy = structuredClone(original);
      copy.id = createId('prop');
      copy.name = original.name || 'Dalle sol';
      if (isFloorTileProp(copy)) {
        copy.w = tileWidth;
        copy.h = tileHeight;
        copy.r = Math.round(Math.max(tileWidth, tileHeight) / 2);
        copy.modelHeight = 12;
        copy.blocksMovement = false;
      }
      copy.blocksMovement = false;
      copy.x = clamp((Number(original.x) || 0) + offset.x, tileWidth / 2, next.world.width - tileWidth / 2);
      copy.y = clamp((Number(original.y) || 0) + offset.y, tileHeight / 2, next.world.height - tileHeight / 2);
      collection.push(copy);
      next.props = collection;
      setSelected({ type: 'prop', id: copy.id });
      setMultiSelected([{ type: 'prop', id: copy.id }]);
    }, false);
  }, [createId, multiSelected, patchConfig, selected?.id, setMultiSelected, setSelected]);

  const snapSelectedTileToNeighbor = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item || !isFloorTileProp(currentProp.item)) return;
      snapFlatTileToNeighbors(currentProp.item, next.props || [], next.world, { force: true });
    }, false);
  }, [patchConfig, selected]);

  const flattenSelectedProp = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      const prop = currentProp.item;
      const renderMode = getPropRenderMode(prop);
      prop.floorZeroZ = getFloorZeroZ(prop);
      if (renderMode === 'floor' || (renderMode === 'billboard' && prop.imageData)) {
        const tileSize = getFloorTileWorldSize(prop);
        prop.renderMode = 'floor';
        prop.w = tileSize;
        prop.h = tileSize;
        prop.r = Math.round(tileSize / 2);
        prop.modelHeight = 12;
        prop.blocksMovement = false;
        prop.modelRotationX = 0;
        prop.modelRotationY = 0;
        prop.modelRotationZ = 0;
        prop.modelCenterOnOrigin = true;
        prop.modelFlushToGround = false;
        return;
      }
      prop.modelRotationX = -90;
      prop.modelRotationY = 0;
      prop.modelRotationZ = 0;
      prop.modelCenterOnOrigin = true;
      prop.modelFlushToGround = true;
    }, false);
  }, [patchConfig, selected]);

  const resetSelectedPropOrientation = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.modelRotationX = 0;
      currentProp.item.modelRotationY = 0;
      currentProp.item.modelRotationZ = 0;
      currentProp.item.modelFlushToGround = false;
    }, false);
  }, [patchConfig, selected]);

  const centerSelectedPropModel = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.modelCenterOnOrigin = true;
    }, false);
  }, [patchConfig, selected]);

  const flushSelectedPropToGround = useCallback(() => {
    if (!selected || selected.type !== 'prop') return;
    patchConfig((next) => {
      const currentProp = getSelectedEntity(next, selected);
      if (!currentProp?.item) return;
      currentProp.item.modelFlushToGround = true;
      currentProp.item.z = 0;
    }, false);
  }, [patchConfig, selected]);

  const deleteSelected = useCallback(() => {
    const targets = getDeletableSelectionEntities(configRef.current, selected, multiSelected);
    if (!targets.length) return;
    setPendingPlacement(null);
    patchConfig((next) => {
      targets.forEach((target) => {
        const key = MAP_ENTITY_COLLECTIONS[target.type];
        if (!key) return;
        next[key] = (next[key] || []).filter((item) => item.id !== target.id);
      });
    });
    setSelected(null);
    setMultiSelected([]);
  }, [
    configRef,
    getDeletableSelectionEntities,
    multiSelected,
    patchConfig,
    selected,
    setMultiSelected,
    setPendingPlacement,
    setSelected,
  ]);

  const renameMapEntity = useCallback((type, id, name) => {
    patchConfig((next) => {
      const selectedEntity = getSelectedEntity(next, { type, id });
      if (!selectedEntity?.item) return;
      if (type === 'enemy') selectedEntity.item.combatEnemyName = name;
      else selectedEntity.item.name = name;
    }, false);
  }, [patchConfig]);

  const deleteMapEntity = useCallback((type, id) => {
    const collectionName = MAP_ENTITY_COLLECTIONS[type];
    if (!collectionName) return;
    patchConfig((next) => {
      if (isProtectedMapEntity(next, { type, id })) return;
      next[collectionName] = (next[collectionName] || []).filter((item) => item.id !== id);
    });
    setSelected((current) => (current?.type === type && current.id === id ? null : current));
    setMultiSelected((current) => current.filter((entry) => !(entry.type === type && entry.id === id)));
  }, [isProtectedMapEntity, patchConfig, setMultiSelected, setSelected]);

  const editMapEntity = useCallback((type, id) => {
    setMode('edit');
    setIsPaused(false);
    setTool('select');
    setSelected({ type, id });
    setMultiSelected([{ type, id }]);
    setWorkspaceTab('arcade');
  }, [setIsPaused, setMode, setMultiSelected, setSelected, setTool, setWorkspaceTab]);

  return {
    centerSelectedPropModel,
    deleteMapEntity,
    deleteSelected,
    duplicateSelected,
    duplicateSelectedTile,
    editMapEntity,
    flattenSelectedProp,
    flushSelectedPropToGround,
    renameMapEntity,
    resetSelectedPropOrientation,
    snapSelectedTileToNeighbor,
  };
}
