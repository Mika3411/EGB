import * as THREE from 'three';

import {
  getPropHeight,
  getPropModelHeight,
  getPropRenderMode,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  isFlatTileLikeProp,
} from '../../utils/rpg3dDomain.js';

import {
  addActionZoneSelectionOverlay,
  getActionZoneVisualSignature,
} from './rpg3dSceneActionZones.js';

import {
  addTileDuplicateHandles,
  createSelectionEdges,
  createSelectionOverlayGroup,
  createSelectionRing,
  createTileDuplicateHandle,
  DEFAULT_ENGINE,
  degreesToRadians,
  getEngine,
  getEntityKey,
  getEntityLiftHeight,
  getFlatTileSceneDimensions,
  toScenePosition,
  WORLD_SCALE,
} from './rpg3dSceneShared.js';

import {
  getObstacleVisualSignature,
  getPropVisualSignature,
  getReliefVisualSignature,
} from './rpg3dSceneSignatures.js';

const getSelectedFlatTileProps = (config = {}, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  const selectedIds = new Set(selection.filter((entry) => entry?.type === 'prop').map((entry) => entry.id));
  if (!selectedIds.size) return [];
  return (config.props || []).filter((prop) => selectedIds.has(prop.id) && isFlatTileLikeProp(prop));
};

const getFlatTileSelectionBounds = (config = {}, props = []) => {
  let bounds = null;
  props.forEach((prop) => {
    const fallbackWidth = Math.max(0.24, getPropWidth(prop) * WORLD_SCALE);
    const fallbackDepth = Math.max(0.24, getPropHeight(prop) * WORLD_SCALE);
    const size = getFlatTileSceneDimensions(prop, fallbackWidth, fallbackDepth);
    const center = toScenePosition(config, prop.x, prop.y, 0);
    const tileBounds = {
      minX: center.x - size.width / 2,
      maxX: center.x + size.width / 2,
      minZ: center.z - size.depth / 2,
      maxZ: center.z + size.depth / 2,
    };
    bounds = bounds
      ? {
        minX: Math.min(bounds.minX, tileBounds.minX),
        maxX: Math.max(bounds.maxX, tileBounds.maxX),
        minZ: Math.min(bounds.minZ, tileBounds.minZ),
        maxZ: Math.max(bounds.maxZ, tileBounds.maxZ),
      }
      : tileBounds;
  });
  return bounds;
};

const addTileSelectionDuplicateHandles = (group, config, props = []) => {
  const bounds = getFlatTileSelectionBounds(config, props);
  if (!bounds) return;
  const handleGroup = new THREE.Group();
  handleGroup.position.set((bounds.minX + bounds.maxX) / 2, 0, (bounds.minZ + bounds.maxZ) / 2);
  const width = Math.max(0.24, bounds.maxX - bounds.minX);
  const depth = Math.max(0.24, bounds.maxZ - bounds.minZ);
  ['up', 'right', 'down', 'left'].forEach((direction) => {
    handleGroup.add(createTileDuplicateHandle(direction, width, depth, 'selection'));
  });
  group.add(handleGroup);
};

const addBoxSelectionOverlay = (group, config, entity, centerX, centerY, width, depth, height, lift = 0) => {
  const overlay = createSelectionOverlayGroup(entity);
  const geometry = new THREE.BoxGeometry(
    Math.max(0.2, width * WORLD_SCALE),
    Math.max(0.05, height),
    Math.max(0.2, depth * WORLD_SCALE),
  );
  const edges = createSelectionEdges(geometry);
  edges.position.copy(toScenePosition(config, centerX, centerY, lift + Math.max(0.05, height) / 2));
  overlay.add(edges);
  group.add(overlay);
};

const addPropSelectionOverlay = (group, config, prop, options = {}) => {
  const width = Math.max(0.24, getPropWidth(prop) * WORLD_SCALE);
  const depth = Math.max(0.24, getPropHeight(prop) * WORLD_SCALE);
  const propHeight = Math.max(0.08, getPropModelHeight(prop) * WORLD_SCALE);
  const lift = getEntityLiftHeight(prop);
  const overlay = createSelectionOverlayGroup({ type: 'prop', id: prop.id });
  overlay.position.copy(toScenePosition(config, prop.x, prop.y, lift));
  overlay.rotation.y = degreesToRadians(prop.rotation || 0);

  if (isFlatTileLikeProp(prop)) {
    const tileSize = getFlatTileSceneDimensions(prop, width, depth);
    const outline = createSelectionEdges(new THREE.BoxGeometry(tileSize.width, 0.05, tileSize.depth));
    outline.position.y = 0.08;
    overlay.add(outline);
    if (options.showTileDuplicateHandles !== false) {
      addTileDuplicateHandles(overlay, prop, tileSize.width, tileSize.depth);
    }
  } else if (['box', 'house', 'glb'].includes(getPropRenderMode(prop))) {
    const edges = createSelectionEdges(new THREE.BoxGeometry(width, propHeight, depth));
    edges.position.y = propHeight / 2;
    overlay.add(edges);
  } else {
    overlay.add(createSelectionRing(Math.max(width, depth) * 0.58, '#67e8f9'));
  }

  group.add(overlay);
};

const addStaticSelectionOverlays = (group, config, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  if (!selection.length) return;
  const selectedFlatTiles = getSelectedFlatTileProps(config, selected, multiSelected);
  const selectedFlatTileIds = new Set(selectedFlatTiles.map((prop) => prop.id));
  const showGroupedTileHandles = selectedFlatTiles.length > 1;

  selection.forEach((entity) => {
    if (!entity?.type || !entity.id) return;
    if (entity.type === 'obstacle') {
      const obstacle = (config.obstacles || []).find((item) => item.id === entity.id);
      if (!obstacle) return;
      const height = Math.max(0.4, Number(config.engine?.wallHeight) || DEFAULT_ENGINE.wallHeight);
      addBoxSelectionOverlay(
        group,
        config,
        entity,
        (Number(obstacle.x) || 0) + getPropWidth(obstacle) / 2,
        (Number(obstacle.y) || 0) + getPropHeight(obstacle) / 2,
        getPropWidth(obstacle),
        getPropHeight(obstacle),
        height,
        getEntityLiftHeight(obstacle),
      );
      return;
    }
    if (entity.type === 'relief') {
      const relief = (config.reliefs || []).find((item) => item.id === entity.id);
      if (!relief) return;
      const elevation = getReliefElevation(relief);
      const height = Math.max(0.08, Math.abs(elevation) * WORLD_SCALE * (Number(config.engine?.reliefScale) || 1));
      addBoxSelectionOverlay(
        group,
        config,
        entity,
        Number(relief.x) || 0,
        Number(relief.y) || 0,
        getReliefWidth(relief),
        getReliefHeight(relief),
        height,
        elevation >= 0 ? 0 : -height * 0.4,
      );
      return;
    }
    if (entity.type === 'actionZone') {
      const zone = (config.actionZones || []).find((item) => item.id === entity.id);
      if (!zone) return;
      addActionZoneSelectionOverlay(group, config, zone, { showVertexHandles: selection.length === 1 });
      return;
    }
    if (entity.type === 'prop') {
      const prop = (config.props || []).find((item) => item.id === entity.id);
      if (!prop) return;
      addPropSelectionOverlay(group, config, prop, {
        showTileDuplicateHandles: !(showGroupedTileHandles && selectedFlatTileIds.has(prop.id)),
      });
    }
  });

  if (showGroupedTileHandles) addTileSelectionDuplicateHandles(group, config, selectedFlatTiles);
};

const getSelectionOverlayEntitySignature = (config = {}, entity = {}) => {
  if (!entity?.type || !entity.id) return '';
  const engine = getEngine(config);
  if (entity.type === 'obstacle') {
    const obstacle = (config.obstacles || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      obstacle ? getObstacleVisualSignature(obstacle) : 'missing',
      Number(engine.wallHeight) || DEFAULT_ENGINE.wallHeight,
    ].join(':');
  }
  if (entity.type === 'relief') {
    const relief = (config.reliefs || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      relief ? getReliefVisualSignature(relief) : 'missing',
      Number(engine.reliefScale) || DEFAULT_ENGINE.reliefScale,
    ].join(':');
  }
  if (entity.type === 'prop') {
    const prop = (config.props || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      prop ? getPropVisualSignature(prop) : 'missing',
      Number(engine.propHeight) || DEFAULT_ENGINE.propHeight,
    ].join(':');
  }
  if (entity.type === 'actionZone') {
    const zone = (config.actionZones || []).find((item) => item.id === entity.id);
    return [
      getEntityKey(entity),
      zone ? getActionZoneVisualSignature(zone) : 'missing',
    ].join(':');
  }
  return '';
};

const getSelectionOverlaySignature = (config = {}, selected, multiSelected = []) => {
  const selection = multiSelected.length ? multiSelected : selected ? [selected] : [];
  return selection
    .map((entity) => getSelectionOverlayEntitySignature(config, entity))
    .filter(Boolean)
    .sort()
    .join('|');
};

export {
  getSelectedFlatTileProps,
  getFlatTileSelectionBounds,
  addTileSelectionDuplicateHandles,
  addBoxSelectionOverlay,
  addPropSelectionOverlay,
  addStaticSelectionOverlays,
  getSelectionOverlayEntitySignature,
  getSelectionOverlaySignature,
};
