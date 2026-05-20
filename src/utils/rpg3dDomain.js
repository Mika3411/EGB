export const PLAYER_RADIUS = 18;
export const PICKUP_RADIUS = 15;
export const FLOOR_TILE_OVERLAP = 0;
export const FLOOR_TILE_EDGE_SNAP_DISTANCE = 56;
export const ENTITY_Z_MIN = -900;
export const ENTITY_Z_MAX = 900;
export const DEFAULT_FLOOR_ZERO_Z = 2.5;
export const FLOOR_ZERO_Z_MIN = -120;
export const FLOOR_ZERO_Z_MAX = 120;
export const MODEL_SCALE_MIN = 0.4;
export const MODEL_SCALE_MAX = 20;
export const MATERIAL_BRIGHTNESS_MIN = 0.25;
export const MATERIAL_BRIGHTNESS_MAX = 1.4;
export const FLOOR_DECOR_MATERIAL_BRIGHTNESS = 0.55;
export const ACTION_ZONE_MIN_SIZE = 40;
export const ACTION_ZONE_DEFAULT_WIDTH = 260;
export const ACTION_ZONE_DEFAULT_HEIGHT = 180;
export const ACTION_ZONE_DEFAULT_MODEL_HEIGHT = 240;
export const ACTION_ZONE_DEFAULT_OPACITY = 0.32;
export const TERRAIN_PAINT_DEFAULT_COLOR = '#4ade80';
export const TERRAIN_PAINT_DEFAULT_RADIUS = 170;
export const TERRAIN_PAINT_MIN_RADIUS = 32;
export const TERRAIN_PAINT_MAX_RADIUS = 520;
export const TERRAIN_PAINT_DEFAULT_OPACITY = 0.58;
export const TERRAIN_PAINT_DEFAULT_SHAPE = 'round';
export const TERRAIN_PAINT_SHAPES = new Set(['round', 'square', 'triangle']);
export const MODEL_ERASER_DEFAULT_RADIUS = 28;
export const MODEL_ERASER_MIN_RADIUS = 8;
export const MODEL_ERASER_MAX_RADIUS = 520;
export const MODEL_ERASER_MAX_STROKES = 96;
export const MODEL_ERASER_RENDER_LIMIT = 48;
export const FLAT_GROUND_DEFAULT_COLOR = '#5f8f3f';

export const DECOR_IMPORT_KIND_MAP = {
  billboard: 'decor',
  crate: 'wall',
  rock: 'decor',
  tree: 'decor',
};
export const FLOOR_DECOR_KIND_IDS = new Set(['road', 'water']);

export const DEFAULT_ARCADE_CONFIG = {
  meta: {
    title: 'Mission RPG 3D',
  },
  world: {
    width: 4200,
    height: 2800,
    grid: 120,
  },
  engine: {
    defaultView: '3d',
    cameraHeight: 20,
    cameraDistance: 30,
    wallHeight: 2.4,
    reliefScale: 1,
    propHeight: 1,
    lightIntensity: 1.15,
    lightOrientation: 320,
  },
  player: {
    x: 2100,
    y: 1400,
    z: 0,
    character: 'runner',
    characterImageData: '',
    characterImageName: '',
    characterModel3dId: '',
    characterModelUrl: '',
    characterModelName: '',
    characterModelResources: [],
    characterModelAnimations: {},
    characterRenderMode: 'capsule',
    characterModelScale: 1,
    characterModelScaleX: 1,
    characterModelScaleY: 1,
    characterModelScaleZ: 1,
    characterModelScaleProportional: true,
    characterMaterialBrightness: 1,
    health: 18,
    maxHealth: 18,
    mana: 10,
    maxMana: 10,
    speed: 260,
    dashSpeed: 680,
    dashCooldown: 0.9,
    bulletSpeed: 680,
    fireRate: 0.13,
    skills: [
      { id: 'force', name: 'Force', value: 3, manaCost: 0 },
      { id: 'ruse', name: 'Ruse', value: 2, manaCost: 0 },
      { id: 'magie', name: 'Magie', value: 4, manaCost: 2 },
    ],
    powers: [
      { id: 'flamme', name: 'Flamme', type: 'fire', manaCost: 2, force: 4 },
    ],
  },
  ai: {
    visionRange: 850,
    obstacleAvoidance: 56,
    aggression: 1,
  },
  obstacles: [],
  reliefs: [],
  heroes: [],
  props: [],
  enemies: [],
  pickups: [],
  actionZones: [],
  terrainPaintStrokes: [],
};

export const clonePlainObjectArray = (items = []) => (Array.isArray(items) ? items.map((item) => ({ ...(item || {}) })) : []);

export const cloneActionZoneArray = (items = []) => clonePlainObjectArray(items).map((zone) => ({
  ...zone,
  npcChoices: clonePlainObjectArray(zone.npcChoices || []),
}));

export const cloneTerrainPaintArray = (items = []) => clonePlainObjectArray(items).map((stroke) => ({
  ...stroke,
  points: clonePlainObjectArray(stroke.points || []),
}));

export const cloneModelEraserArray = (items = []) => clonePlainObjectArray(items).map((stroke) => ({
  ...stroke,
}));

export const clonePropArray = (items = []) => clonePlainObjectArray(items).map((prop) => (
  Array.isArray(prop.modelEraserStrokes)
    ? { ...prop, modelEraserStrokes: cloneModelEraserArray(prop.modelEraserStrokes) }
    : { ...prop }
));

export const clonePlayerConfig = (player = DEFAULT_ARCADE_CONFIG.player) => ({
  ...(player || {}),
  skills: clonePlainObjectArray(player?.skills || []),
  powers: clonePlainObjectArray(player?.powers || []),
});

export const cloneConfig = (config = DEFAULT_ARCADE_CONFIG) => ({
  meta: { ...(config.meta || {}) },
  world: { ...(config.world || DEFAULT_ARCADE_CONFIG.world) },
  engine: { ...(config.engine || DEFAULT_ARCADE_CONFIG.engine) },
  player: clonePlayerConfig(config.player || DEFAULT_ARCADE_CONFIG.player),
  ai: { ...(config.ai || DEFAULT_ARCADE_CONFIG.ai) },
  obstacles: clonePlainObjectArray(config.obstacles || []),
  reliefs: clonePlainObjectArray(config.reliefs || []),
  heroes: clonePlainObjectArray(config.heroes || []),
  props: clonePropArray(config.props || []),
  enemies: clonePlainObjectArray(config.enemies || []),
  pickups: clonePlainObjectArray(config.pickups || []),
  actionZones: cloneActionZoneArray(config.actionZones || []),
  terrainPaintStrokes: cloneTerrainPaintArray(config.terrainPaintStrokes || []),
});

export const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export const getHexColor = (value = '', fallback = '#ffffff') => {
  const normalized = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
};

export const normalizeDegrees = (value = 0) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return ((numeric % 360) + 360) % 360;
};

export const normalizeModelRotation = (value = 0) => {
  const normalized = normalizeDegrees(value);
  return normalized > 180 ? normalized - 360 : normalized;
};

export const getStudioDecorKindId = (kind = '') => DECOR_IMPORT_KIND_MAP[kind] || kind || 'decor';
export const isFloorDecorKind = (kind = '') => FLOOR_DECOR_KIND_IDS.has(getStudioDecorKindId(kind));

export const getFloorBaseColor = (prop = {}) => getHexColor(prop.baseColor || prop.floorColor, FLAT_GROUND_DEFAULT_COLOR);

export const getTerrainPaintColor = (stroke = {}) => getHexColor(stroke.color, TERRAIN_PAINT_DEFAULT_COLOR);

export const getTerrainPaintRadius = (stroke = {}) => {
  const value = Number(stroke.radius);
  return clamp(Number.isFinite(value) ? value : TERRAIN_PAINT_DEFAULT_RADIUS, TERRAIN_PAINT_MIN_RADIUS, TERRAIN_PAINT_MAX_RADIUS);
};

export const getTerrainPaintOpacity = (stroke = {}) => {
  const value = Number(stroke.opacity);
  return clamp(Number.isFinite(value) ? value : TERRAIN_PAINT_DEFAULT_OPACITY, 0.12, 1);
};

export const getTerrainPaintShape = (stroke = {}) => {
  const shape = String(stroke.shape || '').toLowerCase();
  return TERRAIN_PAINT_SHAPES.has(shape) ? shape : TERRAIN_PAINT_DEFAULT_SHAPE;
};

export const getTerrainPaintPoints = (stroke = {}) => (
  Array.isArray(stroke.points)
    ? stroke.points
      .map((point) => ({ x: Number(point.x), y: Number(point.y) }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y))
    : []
);

export const getModelEraserRadius = (item = {}) => {
  const value = Number(item.modelEraserRadius ?? item.radius);
  return clamp(
    Number.isFinite(value) ? value : MODEL_ERASER_DEFAULT_RADIUS,
    MODEL_ERASER_MIN_RADIUS,
    MODEL_ERASER_MAX_RADIUS,
  );
};

export const getModelEraserStrokeRadius = (stroke = {}) => {
  const value = Number(stroke.radius);
  return clamp(
    Number.isFinite(value) ? value : MODEL_ERASER_DEFAULT_RADIUS,
    MODEL_ERASER_MIN_RADIUS,
    MODEL_ERASER_MAX_RADIUS,
  );
};

const roundModelEraserNumber = (value) => Math.round(value * 10) / 10;
const roundModelEraserSceneNumber = (value) => Math.round(value * 1000) / 1000;
const getFiniteModelEraserNumber = (value) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

export const getModelEraserStrokes = (item = {}) => (
  Array.isArray(item.modelEraserStrokes)
    ? item.modelEraserStrokes
      .map((stroke) => {
        const localX = getFiniteModelEraserNumber(stroke.localX ?? stroke.x);
        const localY = getFiniteModelEraserNumber(stroke.localY ?? stroke.y);
        const sceneX = getFiniteModelEraserNumber(stroke.sceneX);
        const sceneY = getFiniteModelEraserNumber(stroke.sceneY);
        const sceneZ = getFiniteModelEraserNumber(stroke.sceneZ);
        const localSceneX = getFiniteModelEraserNumber(stroke.localSceneX);
        const localSceneY = getFiniteModelEraserNumber(stroke.localSceneY);
        const localSceneZ = getFiniteModelEraserNumber(stroke.localSceneZ);
        const localMeshX = getFiniteModelEraserNumber(stroke.localMeshX);
        const localMeshY = getFiniteModelEraserNumber(stroke.localMeshY);
        const localMeshZ = getFiniteModelEraserNumber(stroke.localMeshZ);
        const surfaceIndex = getFiniteModelEraserNumber(stroke.surfaceIndex);
        const materialIndex = getFiniteModelEraserNumber(stroke.materialIndex);
        const uvX = getFiniteModelEraserNumber(stroke.uvX);
        const uvY = getFiniteModelEraserNumber(stroke.uvY);
        const hasLocalPoint = localX !== null && localY !== null;
        const hasScenePoint = sceneX !== null && sceneY !== null && sceneZ !== null;
        const hasLocalScenePoint = localSceneX !== null && localSceneY !== null && localSceneZ !== null;
        const hasLocalMeshPoint = localMeshX !== null && localMeshY !== null && localMeshZ !== null;
        if (!hasLocalPoint && !hasScenePoint && !hasLocalScenePoint && !hasLocalMeshPoint) return null;
        const normalized = {
          id: stroke.id || '',
          radius: getModelEraserStrokeRadius(stroke),
        };
        if (hasLocalPoint) {
          normalized.localX = localX;
          normalized.localY = localY;
        }
        if (hasScenePoint) {
          normalized.sceneX = sceneX;
          normalized.sceneY = sceneY;
          normalized.sceneZ = sceneZ;
        }
        if (hasLocalScenePoint) {
          normalized.localSceneX = localSceneX;
          normalized.localSceneY = localSceneY;
          normalized.localSceneZ = localSceneZ;
        }
        if (hasLocalMeshPoint) {
          normalized.localMeshX = localMeshX;
          normalized.localMeshY = localMeshY;
          normalized.localMeshZ = localMeshZ;
        }
        if (surfaceIndex !== null) normalized.surfaceIndex = Math.round(surfaceIndex);
        if (materialIndex !== null) normalized.materialIndex = Math.round(materialIndex);
        if (uvX !== null && uvY !== null) {
          normalized.uvX = clamp(uvX, 0, 1);
          normalized.uvY = clamp(uvY, 0, 1);
        }
        return normalized;
      })
      .filter(Boolean)
    : []
);

export const createModelEraserStroke = (point = {}, prop = {}, radius = MODEL_ERASER_DEFAULT_RADIUS, id = '') => {
  const x = Number(point.x);
  const y = Number(point.y);
  const propX = Number(prop.x) || 0;
  const propY = Number(prop.y) || 0;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const rotation = (normalizeDegrees(prop.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const dx = x - propX;
  const dy = y - propY;
  return {
    id,
    localX: roundModelEraserNumber(dx * cos - dy * sin),
    localY: roundModelEraserNumber(dx * sin + dy * cos),
    radius: getModelEraserRadius({ modelEraserRadius: radius }),
  };
};

export const createModelEraserSurfaceStroke = (hit = {}, radius = MODEL_ERASER_DEFAULT_RADIUS, id = '') => {
  const scenePoint = hit.scenePoint || {};
  const sceneX = getFiniteModelEraserNumber(hit.sceneX ?? scenePoint.x);
  const sceneY = getFiniteModelEraserNumber(hit.sceneY ?? scenePoint.y);
  const sceneZ = getFiniteModelEraserNumber(hit.sceneZ ?? scenePoint.z);
  const localScenePoint = hit.localScenePoint || {};
  const localSceneX = getFiniteModelEraserNumber(hit.localSceneX ?? localScenePoint.x);
  const localSceneY = getFiniteModelEraserNumber(hit.localSceneY ?? localScenePoint.y);
  const localSceneZ = getFiniteModelEraserNumber(hit.localSceneZ ?? localScenePoint.z);
  const localMeshPoint = hit.localMeshPoint || {};
  const localMeshX = getFiniteModelEraserNumber(hit.localMeshX ?? localMeshPoint.x);
  const localMeshY = getFiniteModelEraserNumber(hit.localMeshY ?? localMeshPoint.y);
  const localMeshZ = getFiniteModelEraserNumber(hit.localMeshZ ?? localMeshPoint.z);
  const surfaceIndex = getFiniteModelEraserNumber(hit.surfaceIndex);
  const materialIndex = getFiniteModelEraserNumber(hit.materialIndex);
  const uvX = getFiniteModelEraserNumber(hit.uvX);
  const uvY = getFiniteModelEraserNumber(hit.uvY);
  const hasScenePoint = sceneX !== null && sceneY !== null && sceneZ !== null;
  const hasLocalScenePoint = localSceneX !== null && localSceneY !== null && localSceneZ !== null;
  const hasLocalMeshPoint = localMeshX !== null && localMeshY !== null && localMeshZ !== null;
  if (
    (!hasScenePoint && !hasLocalScenePoint && !hasLocalMeshPoint)
    || surfaceIndex === null
    || materialIndex === null
  ) return null;
  const stroke = {
    id,
    surfaceIndex: Math.round(surfaceIndex),
    materialIndex: Math.round(materialIndex),
    uvX: clamp(roundModelEraserSceneNumber(uvX), 0, 1),
    uvY: clamp(roundModelEraserSceneNumber(uvY), 0, 1),
    radius: getModelEraserRadius({ modelEraserRadius: radius }),
  };
  if (hasScenePoint) {
    stroke.sceneX = roundModelEraserSceneNumber(sceneX);
    stroke.sceneY = roundModelEraserSceneNumber(sceneY);
    stroke.sceneZ = roundModelEraserSceneNumber(sceneZ);
  }
  if (hasLocalScenePoint) {
    stroke.localSceneX = roundModelEraserSceneNumber(localSceneX);
    stroke.localSceneY = roundModelEraserSceneNumber(localSceneY);
    stroke.localSceneZ = roundModelEraserSceneNumber(localSceneZ);
  }
  if (hasLocalMeshPoint) {
    stroke.localMeshX = roundModelEraserSceneNumber(localMeshX);
    stroke.localMeshY = roundModelEraserSceneNumber(localMeshY);
    stroke.localMeshZ = roundModelEraserSceneNumber(localMeshZ);
  }
  return stroke;
};

export const getModelEraserWorldPoint = (prop = {}, stroke = {}) => {
  const localX = Number(stroke.localX ?? stroke.x);
  const localY = Number(stroke.localY ?? stroke.y);
  const propX = Number(prop.x) || 0;
  const propY = Number(prop.y) || 0;
  if (!Number.isFinite(localX) || !Number.isFinite(localY)) return null;
  const rotation = (normalizeDegrees(prop.rotation || 0) * Math.PI) / 180;
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return {
    x: roundModelEraserNumber(propX + localX * cos - localY * sin),
    y: roundModelEraserNumber(propY + localX * sin + localY * cos),
  };
};

export const getEntityZ = (item = {}) => clamp(Number(item.z) || 0, ENTITY_Z_MIN, ENTITY_Z_MAX);

export const getFloorZeroZ = (item = {}) => {
  const value = Number(item.floorZeroZ);
  return clamp(Number.isFinite(value) ? value : DEFAULT_FLOOR_ZERO_Z, FLOOR_ZERO_Z_MIN, FLOOR_ZERO_Z_MAX);
};

export const getCharacterModelScale = (actor = {}) => {
  const value = Number(actor.characterModelScaleY ?? actor.modelScaleY ?? actor.characterModelScale ?? actor.modelScale);
  return clamp(Number.isFinite(value) ? value : 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
};

export const getCharacterModelAxisScale = (actor = {}) => {
  const uniform = getCharacterModelScale(actor);
  const getAxisScale = (value) => {
    const numeric = Number(value);
    return clamp(Number.isFinite(numeric) ? numeric : uniform, MODEL_SCALE_MIN, MODEL_SCALE_MAX);
  };
  return {
    x: getAxisScale(actor.characterModelScaleX ?? actor.modelScaleX),
    y: getAxisScale(actor.characterModelScaleY ?? actor.modelScaleY),
    z: getAxisScale(actor.characterModelScaleZ ?? actor.modelScaleZ),
  };
};

export const getCharacterMaterialBrightness = (actor = {}) => {
  const value = Number(actor.characterMaterialBrightness);
  return clamp(Number.isFinite(value) ? value : 1, MATERIAL_BRIGHTNESS_MIN, MATERIAL_BRIGHTNESS_MAX);
};

export const getDecorModelScale = (prop = {}) => clamp(Number(prop.decorModelScale) || Number(prop.modelScale) || Number(prop.scale) || 1, MODEL_SCALE_MIN, MODEL_SCALE_MAX);

export const getDefaultDecorMaterialBrightness = (item = {}) => (
  isFloorDecorKind(item.decorKind || item.kind) ? FLOOR_DECOR_MATERIAL_BRIGHTNESS : 1
);

export const getDecorMaterialBrightness = (item = {}) => {
  const value = Number(item.materialBrightness);
  return clamp(
    Number.isFinite(value) ? value : getDefaultDecorMaterialBrightness(item),
    MATERIAL_BRIGHTNESS_MIN,
    MATERIAL_BRIGHTNESS_MAX,
  );
};

export const getPropWidth = (prop = {}) => Math.max(12, Number(prop.w) || (Number(prop.r) || 34) * 2);
export const getPropHeight = (prop = {}) => Math.max(12, Number(prop.h) || (Number(prop.r) || 34) * 2);
export const getPropModelHeight = (prop = {}) => Math.max(12, Number(prop.modelHeight) || getPropHeight(prop));
export const getPropModelSource = (prop = {}) => prop.decorModelUrl || prop.modelUrl || prop.modelData || '';
export const getPropRenderMode = (prop = {}) => (getPropModelSource(prop) ? 'glb' : (prop.renderMode || (prop.imageData ? 'billboard' : 'rock')));
export const isFloorTileProp = (prop = {}) => getPropRenderMode(prop) === 'floor';

export const isFlatTileLikeProp = (prop = {}) => {
  if (isFloorTileProp(prop)) return true;
  if (getPropRenderMode(prop) !== 'glb') return false;
  if (isFloorDecorKind(prop.decorKind)) return true;
  const rotationX = Math.abs(normalizeModelRotation(prop.modelRotationX || 0));
  return rotationX >= 30 && rotationX <= 150;
};

export const getFloorTileWorldSize = (prop = {}) => Math.max(12, Math.round(Math.max(getPropWidth(prop), getPropHeight(prop))));

export const getWorldCoverTileSize = (world = {}) => Math.max(
  12,
  Math.ceil(Math.max(
    Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width,
    Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height,
  )),
);

export const isFlatGroundPlateauProp = (prop = {}, world = DEFAULT_ARCADE_CONFIG.world) => {
  if (!isFloorTileProp(prop)) return false;
  const normalizedName = String(prop.name || '').trim().toLowerCase();
  if (normalizedName === 'sol plat') return true;
  const width = getPropWidth(prop);
  const height = getPropHeight(prop);
  const worldWidth = Number(world.width) || DEFAULT_ARCADE_CONFIG.world.width;
  const worldHeight = Number(world.height) || DEFAULT_ARCADE_CONFIG.world.height;
  return width >= worldWidth - 1 && height >= worldHeight - 1;
};

export const getFlatGroundPlateauColor = (config = {}, fallback = FLAT_GROUND_DEFAULT_COLOR) => {
  const plateau = (config.props || []).find((prop) => isFlatGroundPlateauProp(prop, config.world));
  return plateau ? getFloorBaseColor(plateau) : getHexColor(fallback, FLAT_GROUND_DEFAULT_COLOR);
};

export const getFlatTileWorldDimensions = (prop = {}) => {
  if (getPropRenderMode(prop) === 'glb' && !isFloorDecorKind(prop.decorKind)) {
    const footprint = Math.max(12, Math.round(getPropModelHeight(prop) * getDecorModelScale(prop)));
    return { width: footprint, height: footprint };
  }
  return {
    width: Math.max(12, Math.round(getPropWidth(prop))),
    height: Math.max(12, Math.round(getPropHeight(prop))),
  };
};

export const getFlatTileSnapOverlap = (dimension = 0) => {
  const size = Math.max(0, Number(dimension) || 0);
  return Math.min(FLOOR_TILE_OVERLAP, Math.max(0, size / 2 - 1));
};

export const getFlatTileWorldBounds = (tiles = []) => {
  let bounds = null;
  tiles.forEach((tile) => {
    if (!tile) return;
    const { width, height } = getFlatTileWorldDimensions(tile);
    const x = Number(tile.x) || 0;
    const y = Number(tile.y) || 0;
    const tileBounds = {
      minX: x - width / 2,
      maxX: x + width / 2,
      minY: y - height / 2,
      maxY: y + height / 2,
    };
    bounds = bounds
      ? {
        minX: Math.min(bounds.minX, tileBounds.minX),
        maxX: Math.max(bounds.maxX, tileBounds.maxX),
        minY: Math.min(bounds.minY, tileBounds.minY),
        maxY: Math.max(bounds.maxY, tileBounds.maxY),
      }
      : tileBounds;
  });
  return bounds;
};

export const getFlatTileEdgeSnapDistance = (width = 0, height = 0) => (
  Math.min(92, Math.max(FLOOR_TILE_EDGE_SNAP_DISTANCE, Math.min(width, height) * 0.35))
);

export const getActionZoneWidth = (zone = {}) => Math.max(ACTION_ZONE_MIN_SIZE, Number(zone.w) || ACTION_ZONE_DEFAULT_WIDTH);
export const getActionZoneHeight = (zone = {}) => Math.max(ACTION_ZONE_MIN_SIZE, Number(zone.h) || ACTION_ZONE_DEFAULT_HEIGHT);
export const getActionZoneModelHeight = (zone = {}) => Math.max(60, Number(zone.modelHeight) || ACTION_ZONE_DEFAULT_MODEL_HEIGHT);
export const getActionZoneOpacity = (zone = {}) => clamp(Number(zone.opacity) || ACTION_ZONE_DEFAULT_OPACITY, 0.05, 0.95);

export const getActionZoneType = (zone = {}) => zone.actionType || 'portal';

export const getActionZoneColor = (zone = {}) => (
  getHexColor(zone.color, getActionZoneType(zone) === 'portal' ? '#38bdf8' : '#facc15')
);

export const getActionZoneRenderMode = (zone = {}) => zone.renderMode || 'volume';

export const getActionZoneRect = (zone = {}) => ({
  x: (Number(zone.x) || 0) - getActionZoneWidth(zone) / 2,
  y: (Number(zone.y) || 0) - getActionZoneHeight(zone) / 2,
  w: getActionZoneWidth(zone),
  h: getActionZoneHeight(zone),
});

export const getReliefWidth = (relief = {}) => Math.max(40, Number(relief.w) || 300);
export const getReliefHeight = (relief = {}) => Math.max(40, Number(relief.h) || 180);

export const getReliefElevation = (relief = {}) => {
  const elevation = Number(relief.elevation);
  return clamp(Number.isFinite(elevation) ? elevation : 24, -80, 120);
};

export const getSelectionEntityBounds = ({ type, item } = {}) => {
  if (!item) return null;
  if (type === 'obstacle') {
    const width = Math.max(30, Number(item.w) || 180);
    const height = Math.max(30, Number(item.h) || 70);
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return { minX: x, maxX: x + width, minY: y, maxY: y + height };
  }
  if (type === 'relief') {
    const width = getReliefWidth(item);
    const height = getReliefHeight(item);
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
  }
  if (type === 'prop') {
    const dimensions = isFlatTileLikeProp(item)
      ? getFlatTileWorldDimensions(item)
      : { width: getPropWidth(item), height: getPropHeight(item) };
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return {
      minX: x - dimensions.width / 2,
      maxX: x + dimensions.width / 2,
      minY: y - dimensions.height / 2,
      maxY: y + dimensions.height / 2,
    };
  }
  if (type === 'actionZone') {
    const width = getActionZoneWidth(item);
    const height = getActionZoneHeight(item);
    const x = Number(item.x) || 0;
    const y = Number(item.y) || 0;
    return { minX: x - width / 2, maxX: x + width / 2, minY: y - height / 2, maxY: y + height / 2 };
  }
  const radius = type === 'pickup' ? PICKUP_RADIUS : PLAYER_RADIUS;
  const x = Number(item.x) || 0;
  const y = Number(item.y) || 0;
  return { minX: x - radius, maxX: x + radius, minY: y - radius, maxY: y + radius };
};

export const getSelectionBoundsFromEntities = (entities = []) => {
  let bounds = null;
  entities.forEach((entity) => {
    const entityBounds = getSelectionEntityBounds(entity);
    if (!entityBounds) return;
    bounds = bounds
      ? {
        minX: Math.min(bounds.minX, entityBounds.minX),
        maxX: Math.max(bounds.maxX, entityBounds.maxX),
        minY: Math.min(bounds.minY, entityBounds.minY),
        maxY: Math.max(bounds.maxY, entityBounds.maxY),
      }
      : entityBounds;
  });
  if (!bounds) return null;
  const width = Math.max(0, bounds.maxX - bounds.minX);
  const height = Math.max(0, bounds.maxY - bounds.minY);
  return {
    ...bounds,
    width,
    height,
    centerX: bounds.minX + width / 2,
    centerY: bounds.minY + height / 2,
  };
};

export const getEnemyStats = (enemy = {}) => {
  const role = enemy.role || 'rifle';
  const base = role === 'sniper'
    ? { healthScale: 7, speed: 98, range: 560, delay: 1.45, bulletSpeed: 560, spread: 0.02, score: 130 }
    : role === 'brute'
      ? { healthScale: 9, speed: 92, range: 260, delay: 0.95, bulletSpeed: 390, spread: 0.16, score: 160 }
      : { healthScale: 7, speed: 112, range: 380, delay: 0.72, bulletSpeed: 430, spread: 0.08, score: 100 };
  const maxHealth = Math.max(1, Number(enemy.combatEnemyMaxHealth) || 8);
  const strength = Math.max(0, Number(enemy.combatEnemyStrength) || 2);
  const attackSpeed = clamp(Number(enemy.combatEnemyAttackSpeed) || (1 / base.delay), 0.1, 8);
  return {
    ...base,
    speed: clamp(Number(enemy.combatEnemySpeed) || base.speed, 20, 420),
    attackSpeed,
    delay: 1 / attackSpeed,
    hp: maxHealth * base.healthScale,
    damage: Math.max(1, strength * 4),
    powerDamage: Math.max(0, Number(enemy.combatEnemyPowerDamage) || 0) * 5,
    maxMana: Math.max(0, Number(enemy.combatEnemyMaxMana) || 0),
    powerManaCost: Math.max(0, Number(enemy.combatEnemyPowerManaCost) || 3),
    powerUsageChance: Math.max(0, Math.min(100, Number(enemy.combatEnemyPowerUsageChance) || 25)),
    criticalChance: clamp(Number(enemy.combatEnemyCriticalChance) || 0, 0, 100),
    criticalMultiplier: clamp(Number(enemy.combatEnemyCriticalMultiplier) || 1.5, 1, 8),
  };
};

export const createEnemyRuntime = (enemy, index) => {
  const stats = getEnemyStats(enemy);
  return {
    ...enemy,
    vx: 0,
    vy: 0,
    hp: stats.hp,
    maxHp: stats.hp,
    mana: stats.maxMana,
    maxMana: stats.maxMana,
    shootTimer: 0.25 + (index % 4) * 0.18,
    attackTimer: 0,
    strafeTimer: 0,
    strafeDir: index % 2 === 0 ? 1 : -1,
    alert: 0,
  };
};

export const getPlayableHeroId = (config = {}, preferredHeroId = '') => {
  const heroes = config.heroes || [];
  if (preferredHeroId && heroes.some((hero) => hero.id === preferredHeroId)) return preferredHeroId;
  return heroes[0]?.id || '';
};

export const getControlledPlayerSource = (config = {}, controlledHeroId = '') => {
  const basePlayer = config.player || DEFAULT_ARCADE_CONFIG.player;
  const controlledHero = controlledHeroId
    ? (config.heroes || []).find((hero) => hero.id === controlledHeroId)
    : null;
  if (!controlledHero) return { ...basePlayer };
  return {
    ...basePlayer,
    ...controlledHero,
    controlledHeroId: controlledHero.id,
    skills: Array.isArray(controlledHero.skills) && controlledHero.skills.length
      ? controlledHero.skills
      : basePlayer.skills,
    powers: Array.isArray(controlledHero.powers) && controlledHero.powers.length
      ? controlledHero.powers
      : basePlayer.powers,
  };
};

export const getPlayerControlNumber = (source = {}, field, fallback) => {
  const value = Number(source[field]);
  return Number.isFinite(value) ? value : fallback;
};

export const createInitialState = (config, options = {}) => {
  const playerSource = getControlledPlayerSource(config, options.controlledHeroId);
  const initialHealth = getPlayerControlNumber(playerSource, 'health', DEFAULT_ARCADE_CONFIG.player.health);
  const initialMaxHealth = getPlayerControlNumber(playerSource, 'maxHealth', DEFAULT_ARCADE_CONFIG.player.maxHealth);
  const initialMana = getPlayerControlNumber(playerSource, 'mana', DEFAULT_ARCADE_CONFIG.player.mana);
  const initialMaxMana = getPlayerControlNumber(playerSource, 'maxMana', DEFAULT_ARCADE_CONFIG.player.maxMana);
  return {
    player: {
      ...playerSource,
      x: playerSource.x,
      y: playerSource.y,
      z: getEntityZ(playerSource),
      vx: 0,
      vy: 0,
      hp: clamp(initialHealth, 0, initialMaxHealth),
      maxHp: initialMaxHealth,
      mana: clamp(initialMana, 0, initialMaxMana),
      maxMana: initialMaxMana,
      dash: 0,
      attackTimer: 0,
      dashCooldown: 0,
      shootCooldown: 0,
      powerCooldown: 0,
      moveTarget: null,
    },
    bullets: [],
    enemies: config.enemies.map(createEnemyRuntime),
    pickups: config.pickups.map((pickup) => ({ ...pickup })),
    particles: [],
    score: 0,
    time: 0,
    actionMessage: '',
    actionMessageTimer: 0,
    gameOver: false,
    victory: false,
  };
};
