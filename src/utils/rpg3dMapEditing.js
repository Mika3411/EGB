import {
  ACTION_ZONE_MIN_SIZE,
  DEFAULT_ARCADE_CONFIG,
  MODEL_SCALE_MAX,
  MODEL_SCALE_MIN,
  PICKUP_RADIUS,
  PLAYER_RADIUS,
  clamp,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneRect,
  getActionZoneWidth,
  getCharacterModelAxisScale,
  getFlatTileEdgeSnapDistance,
  getFlatTileSnapOverlap,
  getFlatTileWorldBounds,
  getFlatTileWorldDimensions,
  getFloorTileWorldSize,
  getPropHeight,
  getPropModelHeight,
  getPropRenderMode,
  getPropWidth,
  getReliefElevation,
  getReliefHeight,
  getReliefWidth,
  getTerrainPaintShape,
  getWorldCoverTileSize,
  isFlatTileLikeProp,
  isFlatGroundPlateauProp,
  isFloorTileProp,
} from './rpg3dDomain.js';

export const MAP_ENTITY_COLLECTIONS = {
  hero: 'heroes',
  enemy: 'enemies',
  prop: 'props',
  relief: 'reliefs',
  obstacle: 'obstacles',
  pickup: 'pickups',
  actionZone: 'actionZones',
};

const RESIZABLE_ENTITY_TYPES = new Set(['hero', 'enemy', 'prop', 'relief', 'obstacle', 'actionZone']);

const createId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const clampWithFloor = (value, min, max) => clamp(value, min, Math.max(min, max));

export const getEntityKey = (entity = {}) => (entity?.type && entity?.id ? `${entity.type}:${entity.id}` : '');
export const isSameEntity = (a = {}, b = {}) => a?.type === b?.type && a?.id === b?.id;

export const normalizeTerrainPaintPoint = (point = {}, world = DEFAULT_ARCADE_CONFIG.world) => ({
  x: Math.round(clamp(Number(point.x) || 0, 0, Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width)),
  y: Math.round(clamp(Number(point.y) || 0, 0, Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height)),
});

export const clampArcadeEntitiesToWorld = (config) => {
  const width = Number(config.world?.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const height = Number(config.world?.height) || DEFAULT_ARCADE_CONFIG.world.height;
  if (config.player) {
    config.player.x = clampWithFloor(Number(config.player.x) || width / 2, PLAYER_RADIUS, width - PLAYER_RADIUS);
    config.player.y = clampWithFloor(Number(config.player.y) || height / 2, PLAYER_RADIUS, height - PLAYER_RADIUS);
  }
  (config.obstacles || []).forEach((obstacle) => {
    const obstacleWidth = Math.max(0, Number(obstacle.w) || 0);
    const obstacleHeight = Math.max(0, Number(obstacle.h) || 0);
    obstacle.x = clampWithFloor(Number(obstacle.x) || 0, 0, width - obstacleWidth);
    obstacle.y = clampWithFloor(Number(obstacle.y) || 0, 0, height - obstacleHeight);
  });
  ['reliefs', 'heroes', 'props', 'enemies', 'pickups'].forEach((collectionName) => {
    (config[collectionName] || []).forEach((item) => {
      item.x = clamp(Number(item.x) || 0, 0, width);
      item.y = clamp(Number(item.y) || 0, 0, height);
    });
  });
  (config.actionZones || []).forEach((zone) => {
    const zoneWidth = getActionZoneWidth(zone);
    const zoneHeight = getActionZoneHeight(zone);
    zone.w = Math.round(zoneWidth);
    zone.h = Math.round(zoneHeight);
    zone.x = Math.round(clamp(Number(zone.x) || width / 2, zoneWidth / 2, Math.max(zoneWidth / 2, width - zoneWidth / 2)));
    zone.y = Math.round(clamp(Number(zone.y) || height / 2, zoneHeight / 2, Math.max(zoneHeight / 2, height - zoneHeight / 2)));
  });
  (config.terrainPaintStrokes || []).forEach((stroke) => {
    stroke.shape = getTerrainPaintShape(stroke);
    stroke.points = (stroke.points || []).map((point) => normalizeTerrainPaintPoint(point, config.world));
  });
};

export const isPointInActionZone = (zone, point) => {
  const rect = getActionZoneRect(zone);
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
};

export const snapFlatTileToWorldEdges = (tile, world = {}, options = {}) => {
  if (!tile || !isFlatTileLikeProp(tile)) return false;
  const { width, height } = getFlatTileWorldDimensions(tile);
  const worldWidth = Math.max(width, Number(world.width) || width);
  const worldHeight = Math.max(height, Number(world.height) || height);
  const minX = width / 2;
  const maxX = worldWidth - width / 2;
  const minY = height / 2;
  const maxY = worldHeight - height / 2;
  const snapDistance = options.force ? Infinity : getFlatTileEdgeSnapDistance(width, height);
  const currentX = Number(tile.x) || 0;
  const currentY = Number(tile.y) || 0;
  let nextX = currentX;
  let nextY = currentY;

  if (Math.abs(currentX - minX) <= snapDistance) nextX = minX;
  else if (Math.abs(currentX - maxX) <= snapDistance) nextX = maxX;
  if (Math.abs(currentY - minY) <= snapDistance) nextY = minY;
  else if (Math.abs(currentY - maxY) <= snapDistance) nextY = maxY;

  if (nextX === currentX && nextY === currentY) return false;
  tile.x = Math.round(clamp(nextX, minX, maxX));
  tile.y = Math.round(clamp(nextY, minY, maxY));
  tile.blocksMovement = false;
  return true;
};

const getFlatTileGroupEdgeSnapOffset = (config = {}, dragState = {}, delta = {}) => {
  const items = dragState.items || [];
  if (items.length <= 1) return { x: 0, y: 0 };
  const props = config.props || [];
  const projectedTiles = items.map(({ entity, start }) => {
    if (entity?.type !== 'prop' || !start) return null;
    const prop = props.find((item) => item.id === entity.id);
    if (!prop || !isFlatTileLikeProp(prop)) return null;
    return {
      ...prop,
      x: start.x + (Number(delta.x) || 0),
      y: start.y + (Number(delta.y) || 0),
    };
  }).filter(Boolean);
  if (!projectedTiles.length) return { x: 0, y: 0 };
  const bounds = getFlatTileWorldBounds(projectedTiles);
  if (!bounds) return { x: 0, y: 0 };
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  const snapDistance = getFlatTileEdgeSnapDistance(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  const offset = { x: 0, y: 0 };

  if (Math.abs(bounds.minX) <= snapDistance) offset.x = -bounds.minX;
  else if (Math.abs(worldWidth - bounds.maxX) <= snapDistance) offset.x = worldWidth - bounds.maxX;
  if (Math.abs(bounds.minY) <= snapDistance) offset.y = -bounds.minY;
  else if (Math.abs(worldHeight - bounds.maxY) <= snapDistance) offset.y = worldHeight - bounds.maxY;

  return offset;
};

const getRangeGap = (minA, maxA, minB, maxB) => {
  if (maxA < minB) return minB - maxA;
  if (maxB < minA) return minA - maxB;
  return 0;
};

const getFlatTileGroupNeighborSnapOffset = (config = {}, dragState = {}, delta = {}) => {
  const items = dragState.items || [];
  if (items.length <= 1) return { x: 0, y: 0 };
  const props = config.props || [];
  const selectedIds = new Set(items
    .filter(({ entity, start }) => entity?.type === 'prop' && start)
    .map(({ entity }) => entity.id));
  if (!selectedIds.size) return { x: 0, y: 0 };

  const projectedTiles = items.map(({ entity, start }) => {
    if (entity?.type !== 'prop' || !start) return null;
    const prop = props.find((item) => item.id === entity.id);
    if (!prop || !isFlatTileLikeProp(prop)) return null;
    return {
      ...prop,
      x: start.x + (Number(delta.x) || 0),
      y: start.y + (Number(delta.y) || 0),
    };
  }).filter(Boolean);
  if (!projectedTiles.length) return { x: 0, y: 0 };

  const bounds = getFlatTileWorldBounds(projectedTiles);
  if (!bounds) return { x: 0, y: 0 };
  const groupWidth = bounds.maxX - bounds.minX;
  const groupHeight = bounds.maxY - bounds.minY;
  const snapDistance = Math.max(48, Math.min(groupWidth, groupHeight) * 0.85);
  let best = null;

  (props || []).forEach((target) => {
    if (!target || selectedIds.has(target.id) || !isFlatTileLikeProp(target)) return;
    const targetBounds = getFlatTileWorldBounds([target]);
    if (!targetBounds) return;
    const targetWidth = targetBounds.maxX - targetBounds.minX;
    const targetHeight = targetBounds.maxY - targetBounds.minY;
    const overlapX = getFlatTileSnapOverlap(Math.min(groupWidth, targetWidth));
    const overlapY = getFlatTileSnapOverlap(Math.min(groupHeight, targetHeight));
    const verticalGap = getRangeGap(bounds.minY, bounds.maxY, targetBounds.minY, targetBounds.maxY);
    const horizontalGap = getRangeGap(bounds.minX, bounds.maxX, targetBounds.minX, targetBounds.maxX);
    const candidates = [];

    if (verticalGap <= snapDistance) {
      candidates.push(
        { x: targetBounds.minX + overlapX - bounds.maxX, y: 0 },
        { x: targetBounds.maxX - overlapX - bounds.minX, y: 0 },
      );
    }
    if (horizontalGap <= snapDistance) {
      candidates.push(
        { x: 0, y: targetBounds.minY + overlapY - bounds.maxY },
        { x: 0, y: targetBounds.maxY - overlapY - bounds.minY },
      );
    }

    candidates.forEach((candidate) => {
      const distance = Math.hypot(candidate.x, candidate.y);
      if (distance > snapDistance) return;
      if (!best || distance < best.distance) best = { ...candidate, distance };
    });
  });

  return best ? { x: best.x, y: best.y } : { x: 0, y: 0 };
};

export const snapFlatTileToNeighbors = (tile, props = [], world = {}, options = {}) => {
  if (!tile || !isFlatTileLikeProp(tile)) return false;
  const { width, height } = getFlatTileWorldDimensions(tile);
  const snapDistance = options.force ? Infinity : Math.max(48, Math.min(width, height) * 0.85);
  let best = null;
  (props || []).forEach((target) => {
    if (!target || target.id === tile.id || !isFlatTileLikeProp(target)) return;
    const targetSize = getFlatTileWorldDimensions(target);
    const overlapX = getFlatTileSnapOverlap(Math.min(width, targetSize.width));
    const overlapY = getFlatTileSnapOverlap(Math.min(height, targetSize.height));
    const candidates = [
      {
        x: (Number(target.x) || 0) - (targetSize.width + width) / 2 + overlapX,
        y: Number(target.y) || 0,
      },
      {
        x: (Number(target.x) || 0) + (targetSize.width + width) / 2 - overlapX,
        y: Number(target.y) || 0,
      },
      {
        x: Number(target.x) || 0,
        y: (Number(target.y) || 0) - (targetSize.height + height) / 2 + overlapY,
      },
      {
        x: Number(target.x) || 0,
        y: (Number(target.y) || 0) + (targetSize.height + height) / 2 - overlapY,
      },
    ];
    candidates.forEach((candidate) => {
      const distance = Math.hypot((Number(tile.x) || 0) - candidate.x, (Number(tile.y) || 0) - candidate.y);
      if (!best || distance < best.distance) best = { ...candidate, distance };
    });
  });
  if (!best || best.distance > snapDistance) return false;
  tile.x = Math.round(clamp(best.x, width / 2, (Number(world.width) || width) - width / 2));
  tile.y = Math.round(clamp(best.y, height / 2, (Number(world.height) || height) - height / 2));
  tile.blocksMovement = false;
  return true;
};

const getPropRect = (prop = {}) => ({
  x: prop.x - getPropWidth(prop) / 2,
  y: prop.y - getPropHeight(prop) / 2,
  w: getPropWidth(prop),
  h: getPropHeight(prop),
});

const isPointInProp = (prop, point) => {
  const rect = getPropRect(prop);
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
};

const getReliefRect = (relief = {}) => ({
  x: relief.x - getReliefWidth(relief) / 2,
  y: relief.y - getReliefHeight(relief) / 2,
  w: getReliefWidth(relief),
  h: getReliefHeight(relief),
});

const isPointInRelief = (relief, point) => {
  const rect = getReliefRect(relief);
  return point.x >= rect.x
    && point.x <= rect.x + rect.w
    && point.y >= rect.y
    && point.y <= rect.y + rect.h;
};

export const findEntityAt = (config, point) => {
  const obstacle = [...config.obstacles].reverse().find((item) => (
    point.x >= item.x && point.x <= item.x + item.w && point.y >= item.y && point.y <= item.y + item.h
  ));
  if (obstacle) return { type: 'obstacle', id: obstacle.id };
  const hero = [...(config.heroes || [])].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 26);
  if (hero) return { type: 'hero', id: hero.id };
  const enemy = [...config.enemies].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 26);
  if (enemy) return { type: 'enemy', id: enemy.id };
  const pickup = [...config.pickups].reverse().find((item) => Math.hypot(point.x - item.x, point.y - item.y) <= 25);
  if (pickup) return { type: 'pickup', id: pickup.id };
  const actionZone = [...(config.actionZones || [])].reverse().find((item) => isPointInActionZone(item, point));
  if (actionZone) return { type: 'actionZone', id: actionZone.id };
  const prop = [...config.props].reverse().find((item) => {
    if (isFlatGroundPlateauProp(item, config.world)) return false;
    return item.imageData || item.w || item.h
      ? isPointInProp(item, point)
      : Math.hypot(point.x - item.x, point.y - item.y) <= item.r + 8;
  });
  if (prop) return { type: 'prop', id: prop.id };
  const relief = [...(config.reliefs || [])].reverse().find((item) => isPointInRelief(item, point));
  if (relief) return { type: 'relief', id: relief.id };
  return null;
};

export const getSelectedEntity = (config, selected) => {
  if (!selected) return null;
  const collectionName = MAP_ENTITY_COLLECTIONS[selected.type] || 'props';
  const item = (config[collectionName] || []).find((entry) => entry.id === selected.id);
  if (selected.type === 'prop' && isFlatGroundPlateauProp(item, config.world)) return null;
  return { type: selected.type, item };
};

export const getSelectionEntities = (config, selected, multiSelected = []) => {
  const candidates = Array.isArray(multiSelected) && multiSelected.length ? [...multiSelected] : [];
  if (selected && !candidates.some((entry) => isSameEntity(entry, selected))) candidates.push(selected);
  const seen = new Set();
  return candidates
    .map((entity) => {
      const selectedEntity = getSelectedEntity(config, entity);
      return selectedEntity?.item ? { type: entity.type, id: entity.id, item: selectedEntity.item } : null;
    })
    .filter((entity) => {
      const key = getEntityKey(entity);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
};

export const canResizeSelectionEntity = (entity = {}) => Boolean(entity?.item && RESIZABLE_ENTITY_TYPES.has(entity.type));

const getScaleFactorAxis = (factor = 1, axis = 'x') => {
  if (factor && typeof factor === 'object') {
    const value = Number(factor[axis]);
    return Number.isFinite(value) && value > 0 ? value : 1;
  }
  const value = Number(factor);
  return Number.isFinite(value) && value > 0 ? value : 1;
};

const getUniformScaleFactor = (factor = 1) => {
  if (factor && typeof factor === 'object') {
    const values = ['x', 'y', 'z']
      .map((axis) => getScaleFactorAxis(factor, axis))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? Math.max(...values) : 1;
  }
  return getScaleFactorAxis(factor, 'x');
};

const clampCenteredEntityToWorld = (item, world = {}, width = 0, height = 0, centerX = item?.x, centerY = item?.y) => {
  if (!item) return;
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  const halfWidth = Math.max(0, Number(width) || 0) / 2;
  const halfHeight = Math.max(0, Number(height) || 0) / 2;
  item.x = Math.round(clamp(Number(centerX) || halfWidth, halfWidth, Math.max(halfWidth, worldWidth - halfWidth)));
  item.y = Math.round(clamp(Number(centerY) || halfHeight, halfHeight, Math.max(halfHeight, worldHeight - halfHeight)));
};

export const scaleSelectionEntity = (config, entity, factor = 1) => {
  if (!canResizeSelectionEntity(entity)) return false;
  const scaleFactor = getUniformScaleFactor(factor);
  const scaleX = getScaleFactorAxis(factor, 'x');
  const scaleY = getScaleFactorAxis(factor, 'y');
  const scaleZ = getScaleFactorAxis(factor, 'z');
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) return false;
  const { type, item } = entity;
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;

  if (type === 'hero' || type === 'enemy') {
    const axisScale = getCharacterModelAxisScale(item);
    item.characterModelScaleX = clamp(axisScale.x * scaleX, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
    item.characterModelScaleY = clamp(axisScale.y * scaleY, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
    item.characterModelScaleZ = clamp(axisScale.z * scaleZ, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
    item.characterModelScale = item.characterModelScaleY;
    return true;
  }

  if (type === 'obstacle') {
    const width = Math.max(30, Number(item.w) || 180);
    const height = Math.max(30, Number(item.h) || 70);
    const centerX = (Number(item.x) || 0) + width / 2;
    const centerY = (Number(item.y) || 0) + height / 2;
    const nextWidth = Math.round(clamp(width * scaleX, 30, worldWidth));
    const nextHeight = Math.round(clamp(height * scaleZ, 30, worldHeight));
    item.w = nextWidth;
    item.h = nextHeight;
    item.x = Math.round(clamp(centerX - nextWidth / 2, 0, Math.max(0, worldWidth - nextWidth)));
    item.y = Math.round(clamp(centerY - nextHeight / 2, 0, Math.max(0, worldHeight - nextHeight)));
    return true;
  }

  if (type === 'relief') {
    const width = getReliefWidth(item);
    const height = getReliefHeight(item);
    const centerX = Number(item.x) || width / 2;
    const centerY = Number(item.y) || height / 2;
    const nextWidth = Math.round(clamp(width * scaleX, 40, Math.min(1400, worldWidth)));
    const nextHeight = Math.round(clamp(height * scaleZ, 40, Math.min(1000, worldHeight)));
    item.w = nextWidth;
    item.h = nextHeight;
    item.elevation = Math.round(clamp(getReliefElevation(item) * scaleY, -80, 120));
    clampCenteredEntityToWorld(item, world, nextWidth, nextHeight, centerX, centerY);
    return true;
  }

  if (type === 'actionZone') {
    const width = getActionZoneWidth(item);
    const height = getActionZoneHeight(item);
    const centerX = Number(item.x) || width / 2;
    const centerY = Number(item.y) || height / 2;
    const nextWidth = Math.round(clamp(width * scaleX, ACTION_ZONE_MIN_SIZE, worldWidth));
    const nextHeight = Math.round(clamp(height * scaleZ, ACTION_ZONE_MIN_SIZE, worldHeight));
    item.w = nextWidth;
    item.h = nextHeight;
    item.modelHeight = Math.round(clamp(getActionZoneModelHeight(item) * scaleY, 60, 900));
    clampCenteredEntityToWorld(item, world, nextWidth, nextHeight, centerX, centerY);
    return true;
  }

  if (type === 'prop') {
    const renderMode = getPropRenderMode(item);
    const isFlatTile = isFlatTileLikeProp(item);
    const isFloorTile = renderMode === 'floor';
    const maxFloorTileSize = getWorldCoverTileSize(world);
    const currentDimensions = isFlatTile ? getFlatTileWorldDimensions(item) : { width: getPropWidth(item), height: getPropHeight(item) };
    const centerX = Number(item.x) || currentDimensions.width / 2;
    const centerY = Number(item.y) || currentDimensions.height / 2;
    const nextWidth = Math.round(clamp(currentDimensions.width * scaleX, 12, isFloorTile ? maxFloorTileSize : Math.min(1400, worldWidth)));
    const nextHeight = Math.round(clamp(currentDimensions.height * scaleZ, 12, isFloorTile ? maxFloorTileSize : Math.min(1400, worldHeight)));

    if (renderMode === 'floor') {
      const tileSize = Math.round(clamp(Math.max(nextWidth, nextHeight), 12, maxFloorTileSize));
      item.w = tileSize;
      item.h = tileSize;
      item.r = Math.round(tileSize / 2);
      item.modelHeight = 12;
      item.blocksMovement = false;
      clampCenteredEntityToWorld(item, world, tileSize, tileSize, centerX, centerY);
      return true;
    }

    item.w = nextWidth;
    item.h = nextHeight;
    item.r = Math.round(Math.max(nextWidth, nextHeight) / 2);
    item.modelHeight = Math.round(clamp(getPropModelHeight(item) * scaleY, 12, 900));
    if (isFlatTile) item.blocksMovement = false;
    clampCenteredEntityToWorld(item, world, isFlatTile ? getFlatTileWorldDimensions(item).width : nextWidth, isFlatTile ? getFlatTileWorldDimensions(item).height : nextHeight, centerX, centerY);
    return true;
  }

  return false;
};

const isDuplicableSelectionEntity = (entity = {}) => Boolean(
  entity?.id && MAP_ENTITY_COLLECTIONS[entity.type],
);

export const duplicateMapEntityIntoConfig = (config, entity, offsetOverride = null) => {
  if (!isDuplicableSelectionEntity(entity)) return null;
  const collectionName = MAP_ENTITY_COLLECTIONS[entity.type];
  const collection = config[collectionName] || [];
  const original = collection.find((item) => item.id === entity.id);
  if (!original) return null;
  if (entity.type === 'prop' && isFlatGroundPlateauProp(original, config.world)) return null;
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  const isFloorTile = entity.type === 'prop' && isFloorTileProp(original);
  const hasOffsetVector = offsetOverride && typeof offsetOverride === 'object';
  const hasNumericOffset = offsetOverride !== null
    && offsetOverride !== undefined
    && Number.isFinite(Number(offsetOverride));
  const fallbackOffset = isFloorTile
    ? getFloorTileWorldSize(original)
    : Math.max(48, Number(world.grid) || DEFAULT_ARCADE_CONFIG.world.grid);
  const offsetX = hasOffsetVector
    ? Number(offsetOverride.x) || 0
    : hasNumericOffset
      ? Number(offsetOverride)
      : fallbackOffset;
  const offsetY = hasOffsetVector
    ? Number(offsetOverride.y) || 0
    : hasNumericOffset
      ? Number(offsetOverride)
      : fallbackOffset;
  const copy = structuredClone(original);
  copy.id = createId(entity.type);
  if (Number.isFinite(Number(copy.x))) copy.x = Number(copy.x) + offsetX;
  if (Number.isFinite(Number(copy.y))) copy.y = Number(copy.y) + offsetY;

  if (isFloorTile) {
    const { width, height } = getFlatTileWorldDimensions(original);
    copy.w = width;
    copy.h = height;
    copy.r = Math.round(Math.max(width, height) / 2);
    copy.modelHeight = 12;
    copy.blocksMovement = false;
  }

  if (entity.type === 'obstacle') {
    const width = Math.max(30, Number(copy.w) || 180);
    const height = Math.max(30, Number(copy.h) || 70);
    copy.x = Math.round(clamp(Number(copy.x) || 0, 0, Math.max(0, worldWidth - width)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, 0, Math.max(0, worldHeight - height)));
  } else if (entity.type === 'relief') {
    const width = getReliefWidth(copy);
    const height = getReliefHeight(copy);
    copy.x = Math.round(clamp(Number(copy.x) || 0, width / 2, Math.max(width / 2, worldWidth - width / 2)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, height / 2, Math.max(height / 2, worldHeight - height / 2)));
  } else if (entity.type === 'prop') {
    const dimensions = isFlatTileLikeProp(copy)
      ? getFlatTileWorldDimensions(copy)
      : { width: getPropWidth(copy), height: getPropHeight(copy) };
    copy.x = Math.round(clamp(Number(copy.x) || 0, dimensions.width / 2, Math.max(dimensions.width / 2, worldWidth - dimensions.width / 2)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, dimensions.height / 2, Math.max(dimensions.height / 2, worldHeight - dimensions.height / 2)));
  } else if (entity.type === 'actionZone') {
    const width = getActionZoneWidth(copy);
    const height = getActionZoneHeight(copy);
    copy.x = Math.round(clamp(Number(copy.x) || 0, width / 2, Math.max(width / 2, worldWidth - width / 2)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, height / 2, Math.max(height / 2, worldHeight - height / 2)));
  } else {
    const radius = entity.type === 'pickup' ? PICKUP_RADIUS : PLAYER_RADIUS;
    copy.x = Math.round(clamp(Number(copy.x) || 0, radius, Math.max(radius, worldWidth - radius)));
    copy.y = Math.round(clamp(Number(copy.y) || 0, radius, Math.max(radius, worldHeight - radius)));
  }

  if (entity.type === 'enemy') copy.combatEnemyName = `${copy.combatEnemyName || copy.name || 'Personnage'} copie`;
  if (entity.type === 'hero') copy.name = `${copy.name || 'Heros'} copie`;
  if (entity.type === 'prop') copy.name = `${copy.name || 'Objet'} copie`;
  if (entity.type === 'relief') copy.name = `${copy.name || 'Relief'} copie`;
  if (entity.type === 'actionZone') copy.name = `${copy.name || 'Zone'} copie`;

  collection.push(copy);
  config[collectionName] = collection;
  return { type: entity.type, id: copy.id };
};

export const moveMapEntityToPoint = (config, selected, point, options = {}) => {
  const selectedEntity = getSelectedEntity(config, selected);
  if (!selectedEntity?.item || !point) return false;
  const item = selectedEntity.item;
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const centerX = Number(point.x) || 0;
  const centerY = Number(point.y) || 0;
  if (selectedEntity.type === 'obstacle') {
    const width = Math.max(30, Number(item.w) || 180);
    const height = Math.max(30, Number(item.h) || 70);
    item.x = Math.round(clamp(centerX - width / 2, 0, Math.max(0, world.width - width)));
    item.y = Math.round(clamp(centerY - height / 2, 0, Math.max(0, world.height - height)));
    return true;
  }
  if (selectedEntity.type === 'relief') {
    const width = getReliefWidth(item);
    const height = getReliefHeight(item);
    item.x = Math.round(clamp(centerX, width / 2, Math.max(width / 2, world.width - width / 2)));
    item.y = Math.round(clamp(centerY, height / 2, Math.max(height / 2, world.height - height / 2)));
    return true;
  }
  if (selectedEntity.type === 'prop') {
    const dimensions = isFlatTileLikeProp(item)
      ? getFlatTileWorldDimensions(item)
      : { width: getPropWidth(item), height: getPropHeight(item) };
    item.x = Math.round(clamp(centerX, dimensions.width / 2, Math.max(dimensions.width / 2, world.width - dimensions.width / 2)));
    item.y = Math.round(clamp(centerY, dimensions.height / 2, Math.max(dimensions.height / 2, world.height - dimensions.height / 2)));
    if (options.snap && isFlatTileLikeProp(item)) {
      snapFlatTileToNeighbors(item, config.props || [], world, { force: false });
      snapFlatTileToWorldEdges(item, world, { force: false });
    }
    return true;
  }
  if (selectedEntity.type === 'actionZone') {
    const width = getActionZoneWidth(item);
    const height = getActionZoneHeight(item);
    item.x = Math.round(clamp(centerX, width / 2, Math.max(width / 2, world.width - width / 2)));
    item.y = Math.round(clamp(centerY, height / 2, Math.max(height / 2, world.height - height / 2)));
    return true;
  }
  const radius = selectedEntity.type === 'pickup' ? PICKUP_RADIUS : PLAYER_RADIUS;
  item.x = Math.round(clamp(centerX, radius, Math.max(radius, world.width - radius)));
  item.y = Math.round(clamp(centerY, radius, Math.max(radius, world.height - radius)));
  return true;
};

export const getEntityCenterPoint = (config, entity) => {
  const selectedEntity = getSelectedEntity(config, entity);
  if (!selectedEntity?.item) return null;
  const item = selectedEntity.item;
  if (selectedEntity.type === 'obstacle') {
    return {
      x: (Number(item.x) || 0) + (Math.max(30, Number(item.w) || 180) / 2),
      y: (Number(item.y) || 0) + (Math.max(30, Number(item.h) || 70) / 2),
    };
  }
  return { x: Number(item.x) || 0, y: Number(item.y) || 0 };
};

export const moveMapEntityByDelta = (config, entity, delta, options = {}) => {
  const point = getEntityCenterPoint(config, entity);
  if (!point) return false;
  return moveMapEntityToPoint(config, entity, {
    x: point.x + (Number(delta?.x) || 0),
    y: point.y + (Number(delta?.y) || 0),
  }, options);
};

export const applyGroupDragToConfig = (config, dragState, point, options = {}) => {
  if (!dragState || !point) return false;
  const delta = {
    x: (Number(point.x) || 0) - dragState.anchor.x,
    y: (Number(point.y) || 0) - dragState.anchor.y,
  };
  const isGroupMove = (dragState.items || []).length > 1;
  const groupNeighborOffset = options.snap && isGroupMove
    ? getFlatTileGroupNeighborSnapOffset(config, dragState, delta)
    : { x: 0, y: 0 };
  const neighborSnappedDelta = {
    x: delta.x + groupNeighborOffset.x,
    y: delta.y + groupNeighborOffset.y,
  };
  const groupEdgeOffset = options.snap && isGroupMove && groupNeighborOffset.x === 0 && groupNeighborOffset.y === 0
    ? getFlatTileGroupEdgeSnapOffset(config, dragState, neighborSnappedDelta)
    : { x: 0, y: 0 };
  const groupOffset = {
    x: groupNeighborOffset.x + groupEdgeOffset.x,
    y: groupNeighborOffset.y + groupEdgeOffset.y,
  };
  let moved = false;
  (dragState.items || []).forEach(({ entity, start }) => {
    if (!entity || !start) return;
    moved = moveMapEntityToPoint(config, entity, {
      x: start.x + delta.x + groupOffset.x,
      y: start.y + delta.y + groupOffset.y,
    }, isGroupMove ? { ...options, snap: false } : options) || moved;
  });
  return moved;
};

export const resolveFlatTileDragPoint = (config, dragState, entity, point, options = {}) => {
  if (!options.snap || !config || !dragState || !entity || !point) return point;
  const world = config.world || DEFAULT_ARCADE_CONFIG.world;
  const delta = {
    x: (Number(point.x) || 0) - dragState.anchor.x,
    y: (Number(point.y) || 0) - dragState.anchor.y,
  };
  const isGroupMove = (dragState.items || []).length > 1;

  if (isGroupMove) {
    const groupNeighborOffset = getFlatTileGroupNeighborSnapOffset(config, dragState, delta);
    const neighborSnappedDelta = {
      x: delta.x + groupNeighborOffset.x,
      y: delta.y + groupNeighborOffset.y,
    };
    const groupEdgeOffset = groupNeighborOffset.x === 0 && groupNeighborOffset.y === 0
      ? getFlatTileGroupEdgeSnapOffset(config, dragState, neighborSnappedDelta)
      : { x: 0, y: 0 };
    return {
      x: point.x + groupNeighborOffset.x + groupEdgeOffset.x,
      y: point.y + groupNeighborOffset.y + groupEdgeOffset.y,
    };
  }

  const selectedEntity = getSelectedEntity(config, entity);
  if (selectedEntity?.type !== 'prop' || !isFlatTileLikeProp(selectedEntity.item)) return point;
  const tile = { ...selectedEntity.item };
  const dimensions = getFlatTileWorldDimensions(tile);
  tile.x = Math.round(clamp(
    Number(point.x) || 0,
    dimensions.width / 2,
    Math.max(dimensions.width / 2, (Number(world.width) || dimensions.width) - dimensions.width / 2),
  ));
  tile.y = Math.round(clamp(
    Number(point.y) || 0,
    dimensions.height / 2,
    Math.max(dimensions.height / 2, (Number(world.height) || dimensions.height) - dimensions.height / 2),
  ));
  snapFlatTileToNeighbors(tile, config.props || [], world, { force: false });
  snapFlatTileToWorldEdges(tile, world, { force: false });
  return { x: tile.x, y: tile.y };
};
