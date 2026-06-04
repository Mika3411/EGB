import { describe, expect, it } from 'vitest';
import {
  ACTION_ZONE_DEFAULT_HEIGHT,
  ACTION_ZONE_DEFAULT_MODEL_HEIGHT,
  ACTION_ZONE_DEFAULT_OPACITY,
  ACTION_ZONE_DEFAULT_WIDTH,
  ACTION_ZONE_MIN_SIZE,
  DEFAULT_ARCADE_CONFIG,
  ENTITY_Z_MAX,
  FLAT_GROUND_DEFAULT_COLOR,
  FLOOR_ZERO_Z_MAX,
  MODEL_ERASER_DEFAULT_RADIUS,
  MODEL_ERASER_MAX_RADIUS,
  MODEL_ERASER_MIN_RADIUS,
  MODEL_SCALE_MAX,
  MODEL_SCALE_MIN,
  TERRAIN_PAINT_DEFAULT_COLOR,
  TERRAIN_PAINT_DEFAULT_OPACITY,
  TERRAIN_PAINT_DEFAULT_RADIUS,
  TERRAIN_PAINT_DEFAULT_SHAPE,
  TERRAIN_PAINT_MAX_RADIUS,
  TERRAIN_PAINT_MIN_RADIUS,
  clamp,
  cloneActionZoneArray,
  cloneConfig,
  cloneTerrainPaintArray,
  createModelEraserStroke,
  createModelEraserSurfaceStroke,
  createInitialState,
  getActionZoneColor,
  getActionZoneHeight,
  getActionZoneModelHeight,
  getActionZoneOpacity,
  getActionZoneRect,
  getActionZoneTopVertices,
  getActionZoneType,
  getActionZoneVertices,
  getActionZoneWidth,
  getCharacterMaterialBrightness,
  getCharacterModelAxisScale,
  getCharacterModelScale,
  getDecorMaterialBrightness,
  getDecorModelScale,
  getFlatGroundPlateauColor,
  getFlatTileWorldBounds,
  getFlatTileWorldDimensions,
  getFloorBaseColor,
  getFloorTileWorldSize,
  getFloorZeroZ,
  getHexColor,
  getModelEraserRadius,
  getModelEraserStrokes,
  getModelEraserWorldPoint,
  getSelectionBoundsFromEntities,
  getTerrainPaintColor,
  getTerrainPaintOpacity,
  getTerrainPaintPoints,
  getTerrainPaintRadius,
  getTerrainPaintShape,
  getWorldCoverTileSize,
  isFlatGroundPlateauProp,
  isFlatTileLikeProp,
} from '../shared/utils/rpg3dDomain.js';

describe('rpg3d domain helpers', () => {
  it('keeps the default arcade config and exported constants stable', () => {
    expect(DEFAULT_ARCADE_CONFIG.meta.title).toBe('Mission RPG 3D');
    expect(DEFAULT_ARCADE_CONFIG.world).toMatchObject({ width: 4200, height: 2800, grid: 120 });
    expect(DEFAULT_ARCADE_CONFIG.engine).toMatchObject({
      defaultView: '3d',
      cameraHeight: 20,
      cameraDistance: 30,
      lightIntensity: 1.15,
      lightOrientation: 320,
    });
    expect(DEFAULT_ARCADE_CONFIG.player.skills.map((skill) => skill.id)).toEqual(['force', 'ruse', 'magie']);
    expect(DEFAULT_ARCADE_CONFIG.player.powers[0]).toMatchObject({ id: 'flamme', type: 'fire', manaCost: 2, force: 4 });
    expect(ACTION_ZONE_DEFAULT_WIDTH).toBe(260);
    expect(ACTION_ZONE_DEFAULT_HEIGHT).toBe(180);
    expect(ACTION_ZONE_DEFAULT_MODEL_HEIGHT).toBe(240);
    expect(ACTION_ZONE_DEFAULT_OPACITY).toBe(0.32);
    expect(ACTION_ZONE_MIN_SIZE).toBe(40);
    expect(TERRAIN_PAINT_DEFAULT_COLOR).toBe('#4ade80');
    expect(TERRAIN_PAINT_DEFAULT_RADIUS).toBe(170);
    expect(TERRAIN_PAINT_DEFAULT_OPACITY).toBe(0.58);
    expect(TERRAIN_PAINT_DEFAULT_SHAPE).toBe('round');
    expect(MODEL_SCALE_MIN).toBe(0.4);
    expect(MODEL_SCALE_MAX).toBe(20);
  });

  it('clones saved config arrays without sharing nested action zone or paint data', () => {
    const source = cloneConfig(DEFAULT_ARCADE_CONFIG);
    source.player.skills = [{ id: 'custom-skill', value: 7 }];
    source.player.powers = [{ id: 'custom-power', force: 3 }];
    source.actionZones = [{
      id: 'zone-1',
      vertices: [{ x: 1, y: 2 }],
      topVertices: [{ x: 3, y: 4 }],
      npcChoices: [{ id: 'choice-1', label: 'Ask', response: 'Answer' }],
    }];
    source.terrainPaintStrokes = [{
      id: 'paint-1',
      points: [{ x: 12, y: 34 }],
    }];
    source.props = [{
      id: 'prop-1',
      modelEraserStrokes: [{ id: 'erase-1', localX: 4, localY: 8, radius: 90 }],
    }];

    const configClone = cloneConfig(source);
    const zonesClone = cloneActionZoneArray(source.actionZones);
    const paintClone = cloneTerrainPaintArray(source.terrainPaintStrokes);

    configClone.player.skills[0].value = 99;
    configClone.player.powers[0].force = 9;
    configClone.actionZones[0].npcChoices[0].label = 'Changed';
    configClone.actionZones[0].vertices[0].x = 777;
    configClone.actionZones[0].topVertices[0].x = 555;
    configClone.terrainPaintStrokes[0].points[0].x = 999;
    configClone.props[0].modelEraserStrokes[0].localX = 444;
    zonesClone[0].npcChoices[0].response = 'Other';
    zonesClone[0].vertices[0].y = 666;
    zonesClone[0].topVertices[0].y = 444;
    paintClone[0].points[0].y = 888;

    expect(source.player.skills[0]).toMatchObject({ id: 'custom-skill', value: 7 });
    expect(source.player.powers[0]).toMatchObject({ id: 'custom-power', force: 3 });
    expect(source.actionZones[0].npcChoices[0]).toMatchObject({ label: 'Ask', response: 'Answer' });
    expect(source.actionZones[0].vertices[0]).toEqual({ x: 1, y: 2 });
    expect(source.actionZones[0].topVertices[0]).toEqual({ x: 3, y: 4 });
    expect(source.terrainPaintStrokes[0].points[0]).toEqual({ x: 12, y: 34 });
    expect(source.props[0].modelEraserStrokes[0]).toMatchObject({ localX: 4, localY: 8 });
  });

  it('normalizes colors, terrain paint values and model tuning values', () => {
    expect(clamp(12, 0, 10)).toBe(10);
    expect(clamp(-4, 0, 10)).toBe(0);
    expect(getHexColor(' #AabbCC ')).toBe('#AabbCC');
    expect(getHexColor('#abc', '#123456')).toBe('#123456');
    expect(getTerrainPaintColor({ color: '#00ff66' })).toBe('#00ff66');
    expect(getTerrainPaintColor({ color: 'lime' })).toBe(TERRAIN_PAINT_DEFAULT_COLOR);
    expect(getTerrainPaintRadius({ radius: 9999 })).toBe(TERRAIN_PAINT_MAX_RADIUS);
    expect(getTerrainPaintRadius({ radius: 1 })).toBe(TERRAIN_PAINT_MIN_RADIUS);
    expect(getTerrainPaintRadius({ radius: 'bad' })).toBe(TERRAIN_PAINT_DEFAULT_RADIUS);
    expect(getTerrainPaintOpacity({ opacity: 0.01 })).toBe(0.12);
    expect(getTerrainPaintOpacity({ opacity: 2 })).toBe(1);
    expect(getTerrainPaintShape({ shape: 'SQUARE' })).toBe('square');
    expect(getTerrainPaintShape({ shape: 'hex' })).toBe(TERRAIN_PAINT_DEFAULT_SHAPE);
    expect(getTerrainPaintPoints({ points: [{ x: '1', y: 2 }, { x: 'bad', y: 4 }] })).toEqual([{ x: 1, y: 2 }]);
    expect(getModelEraserRadius({ modelEraserRadius: 9999 })).toBe(MODEL_ERASER_MAX_RADIUS);
    expect(getModelEraserRadius({ modelEraserRadius: 1 })).toBe(MODEL_ERASER_MIN_RADIUS);
    expect(getModelEraserRadius({ modelEraserRadius: 'bad' })).toBe(MODEL_ERASER_DEFAULT_RADIUS);
    expect(getModelEraserStrokes({
      modelEraserStrokes: [{ localX: '1', localY: 2, radius: 9999 }, { localX: 'bad', localY: 4 }],
    })).toEqual([{ id: '', localX: 1, localY: 2, radius: MODEL_ERASER_MAX_RADIUS }]);
    expect(getCharacterModelScale({ characterModelScale: 99 })).toBe(MODEL_SCALE_MAX);
    expect(getCharacterModelAxisScale({ characterModelScale: 2, characterModelScaleX: 3, characterModelScaleZ: 4 })).toEqual({ x: 3, y: 2, z: 4 });
    expect(getCharacterMaterialBrightness({ characterMaterialBrightness: 0.1 })).toBe(0.25);
    expect(getDecorModelScale({ decorModelScale: 0.1 })).toBe(MODEL_SCALE_MIN);
    expect(getDecorMaterialBrightness({ decorKind: 'road' })).toBe(0.55);
  });

  it('stores model eraser strokes in prop-local coordinates', () => {
    const prop = { x: 100, y: 100, rotation: 90 };
    const stroke = createModelEraserStroke({ x: 100, y: 110 }, prop, 44, 'erase-1');

    expect(stroke).toEqual({ id: 'erase-1', localX: 10, localY: 0, radius: 44 });
    expect(getModelEraserWorldPoint(prop, stroke)).toEqual({ x: 100, y: 110 });
  });

  it('stores model eraser surface hits in scene coordinates', () => {
    const stroke = createModelEraserSurfaceStroke({
      sceneX: 1.23456,
      sceneY: 0.5,
      sceneZ: -2.25,
      localSceneX: 0.45678,
      localSceneY: 0.125,
      localSceneZ: -0.75,
      localMeshX: 0.1111,
      localMeshY: 0.2222,
      localMeshZ: 0.3333,
      surfaceIndex: 3,
      materialIndex: 1,
      uvX: 0.25,
      uvY: 0.75,
    }, 44, 'erase-2');

    expect(stroke).toEqual({
      id: 'erase-2',
      surfaceIndex: 3,
      materialIndex: 1,
      uvX: 0.25,
      uvY: 0.75,
      sceneX: 1.235,
      sceneY: 0.5,
      sceneZ: -2.25,
      localSceneX: 0.457,
      localSceneY: 0.125,
      localSceneZ: -0.75,
      localMeshX: 0.111,
      localMeshY: 0.222,
      localMeshZ: 0.333,
      radius: 44,
    });
    expect(getModelEraserStrokes({ modelEraserStrokes: [stroke, { sceneX: 1, sceneY: 2 }] })).toEqual([stroke]);
    expect(createModelEraserSurfaceStroke({
      sceneX: 1,
      sceneY: 2,
      sceneZ: 3,
      surfaceIndex: 1,
    }, 44, 'erase-3')).toBeNull();
    expect(createModelEraserSurfaceStroke({ x: 100, y: 110 }, 44, 'erase-3')).toBeNull();
  });

  it('reads action zone geometry, type and visual fallbacks', () => {
    expect(getActionZoneWidth({ w: 10 })).toBe(ACTION_ZONE_MIN_SIZE);
    expect(getActionZoneHeight({ h: 0 })).toBe(ACTION_ZONE_DEFAULT_HEIGHT);
    expect(getActionZoneModelHeight({ modelHeight: 20 })).toBe(60);
    expect(getActionZoneOpacity({ opacity: 0.01 })).toBe(0.05);
    expect(getActionZoneOpacity({ opacity: 2 })).toBe(0.95);
    expect(getActionZoneType({})).toBe('portal');
    expect(getActionZoneType({ actionType: 'npcAction' })).toBe('npcAction');
    expect(getActionZoneType({ actionType: 'dialogue' })).toBe('portal');
    expect(getActionZoneColor({ color: 'bad', actionType: 'portal' })).toBe('#38bdf8');
    expect(getActionZoneColor({ color: 'bad', actionType: 'npcAction' })).toBe('#facc15');
    expect(getActionZoneRect({ x: 500, y: 400, w: 120, h: 80 })).toEqual({
      x: 440,
      y: 360,
      w: 120,
      h: 80,
    });
    expect(getActionZoneVertices({ x: 100, y: 100, w: 80, h: 40 })).toEqual([
      { x: 60, y: 80 },
      { x: 140, y: 80 },
      { x: 140, y: 120 },
      { x: 60, y: 120 },
    ]);
    expect(getActionZoneTopVertices({
      vertices: [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 5, y: 5 }],
      topVertices: [{ x: 2, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 7 }],
    })).toEqual([{ x: 2, y: 2 }, { x: 7, y: 2 }, { x: 7, y: 7 }]);
    expect(getActionZoneRect({
      vertices: [
        { x: 10, y: 20 },
        { x: 110, y: 35 },
        { x: 90, y: 140 },
        { x: 30, y: 120 },
      ],
    })).toEqual({
      x: 10,
      y: 20,
      w: 100,
      h: 120,
    });
  });

  it('reads flat ground and floor tile dimensions without changing saved fields', () => {
    const floorTile = { renderMode: 'floor', x: 100, y: 150, w: 80, h: 64, floorColor: '#112233' };
    const plateau = { renderMode: 'floor', name: 'Sol plat', w: 4200, h: 2800, baseColor: '#223344' };
    const glbTile = { decorModelUrl: 'blob:model', decorKind: 'decor', modelHeight: 120, decorModelScale: 1.5 };

    expect(getFloorBaseColor(floorTile)).toBe('#112233');
    expect(getFloorBaseColor({ baseColor: 'bad', floorColor: '#abcdef' })).toBe(FLAT_GROUND_DEFAULT_COLOR);
    expect(getFloorZeroZ({ floorZeroZ: 999 })).toBe(FLOOR_ZERO_Z_MAX);
    expect(getFloorTileWorldSize({ w: 120, h: 90 })).toBe(120);
    expect(getWorldCoverTileSize({ width: 2000, height: 3000 })).toBe(3000);
    expect(isFlatGroundPlateauProp(plateau, DEFAULT_ARCADE_CONFIG.world)).toBe(true);
    expect(getFlatGroundPlateauColor({ world: DEFAULT_ARCADE_CONFIG.world, props: [plateau] })).toBe('#223344');
    expect(getFlatTileWorldDimensions(floorTile)).toEqual({ width: 80, height: 64 });
    expect(getFlatTileWorldDimensions(glbTile)).toEqual({ width: 180, height: 180 });
    expect(isFlatTileLikeProp({ decorModelUrl: 'blob:model', decorKind: 'road' })).toBe(true);
    expect(isFlatTileLikeProp({ decorModelUrl: 'blob:model', decorKind: 'decor', modelRotationX: 90 })).toBe(true);
    expect(getFlatTileWorldBounds([floorTile, { ...floorTile, x: 220, y: 160, w: 60, h: 100 }])).toEqual({
      minX: 60,
      maxX: 250,
      minY: 110,
      maxY: 210,
    });
  });

  it('computes selection bounds across entity types', () => {
    expect(getSelectionBoundsFromEntities([
      { type: 'prop', item: { renderMode: 'floor', x: 100, y: 100, w: 80, h: 60 } },
      { type: 'actionZone', item: { vertices: [{ x: 150, y: 80 }, { x: 250, y: 80 }, { x: 250, y: 130 }, { x: 150, y: 130 }] } },
      { type: 'pickup', item: { x: 10, y: 20 } },
    ])).toEqual({
      minX: -5,
      maxX: 250,
      minY: 5,
      maxY: 130,
      width: 255,
      height: 125,
      centerX: 122.5,
      centerY: 67.5,
    });
  });

  it('creates initial runtime state from pure config data', () => {
    const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
    config.heroes = [{
      id: 'hero-1',
      x: 300,
      y: 400,
      z: 9999,
      health: 5,
      maxHealth: 8,
      mana: 12,
      maxMana: 10,
      skills: [{ id: 'hero-skill', value: 4 }],
    }];
    config.enemies = [{
      id: 'enemy-1',
      role: 'brute',
      combatEnemyMaxHealth: 2,
      combatEnemyAttackSpeed: 20,
      combatEnemyCriticalChance: 999,
    }];
    config.pickups = [{ id: 'pickup-1', type: 'health' }];

    const state = createInitialState(config, { controlledHeroId: 'hero-1' });

    expect(state.player).toMatchObject({
      controlledHeroId: 'hero-1',
      x: 300,
      y: 400,
      z: ENTITY_Z_MAX,
      hp: 5,
      maxHp: 8,
      mana: 10,
      maxMana: 10,
      dash: 0,
      moveTarget: null,
    });
    expect(state.player.skills).toEqual([{ id: 'hero-skill', value: 4 }]);
    expect(state.enemies[0]).toMatchObject({
      id: 'enemy-1',
      hp: 18,
      maxHp: 18,
      attackTimer: 0,
      strafeDir: 1,
    });
    expect(state.enemies[0].mana).toBe(0);
    expect(state.pickups).toEqual([{ id: 'pickup-1', type: 'health' }]);
    expect(state.pickups[0]).not.toBe(config.pickups[0]);
    expect(state.bullets).toEqual([]);
    expect(state.particles).toEqual([]);
    expect(state.gameOver).toBe(false);
  });
});
