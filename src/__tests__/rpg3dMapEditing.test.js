import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARCADE_CONFIG, cloneConfig } from '../utils/rpg3dDomain.js';
import {
  clampArcadeEntitiesToWorld,
  duplicateMapEntityIntoConfig,
  findEntityAt,
  getSelectedEntity,
  moveMapEntityByDelta,
  moveMapEntityToPoint,
  resolveFlatTileDragPoint,
  scaleSelectionEntity,
  snapFlatTileToNeighbors,
} from '../utils/rpg3dMapEditing.js';

const createMapConfig = () => {
  const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
  config.world = { width: 500, height: 400, grid: 100 };
  config.player = { ...config.player, x: 250, y: 200, moveTarget: { x: 300, y: 200 } };
  config.obstacles = [];
  config.reliefs = [];
  config.heroes = [];
  config.props = [];
  config.enemies = [];
  config.pickups = [];
  config.actionZones = [];
  config.terrainPaintStrokes = [];
  return config;
};

describe('rpg3d map editing helpers', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('duplicates map entities into the same config collection with bounds and labels', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const config = createMapConfig();
    config.props = [{
      id: 'prop-1',
      name: 'Caisse',
      x: 100,
      y: 120,
      w: 60,
      h: 80,
      renderMode: 'billboard',
      imageData: 'data:image/png;base64,preview',
    }];

    const duplicated = duplicateMapEntityIntoConfig(config, { type: 'prop', id: 'prop-1' }, { x: 30, y: 40 });

    expect(duplicated).toMatchObject({ type: 'prop' });
    expect(duplicated.id).toMatch(/^prop-/);
    expect(duplicated.id).not.toBe('prop-1');
    expect(config.props).toHaveLength(2);
    expect(config.props[0]).toMatchObject({ id: 'prop-1', name: 'Caisse', x: 100, y: 120 });
    expect(config.props[1]).toMatchObject({
      id: duplicated.id,
      name: 'Caisse copie',
      x: 130,
      y: 160,
      w: 60,
      h: 80,
    });
    expect(config.props[1]).not.toBe(config.props[0]);
  });

  it('moves entities by point and delta while preserving existing mutation behavior', () => {
    const config = createMapConfig();
    config.obstacles = [{ id: 'wall-1', x: 0, y: 0, w: 80, h: 40 }];

    expect(moveMapEntityToPoint(config, { type: 'obstacle', id: 'wall-1' }, { x: 20, y: 20 })).toBe(true);
    expect(config.obstacles[0]).toMatchObject({ x: 0, y: 0, w: 80, h: 40 });

    expect(moveMapEntityByDelta(config, { type: 'obstacle', id: 'wall-1' }, { x: 100, y: 50 })).toBe(true);
    expect(config.obstacles[0]).toMatchObject({ x: 100, y: 50 });
  });

  it('keeps the flat ground plateau out of map object selection and duplication', () => {
    const config = createMapConfig();
    config.props = [{
      id: 'plateau-1',
      name: 'Sol plat',
      x: 250,
      y: 200,
      w: 500,
      h: 400,
      r: 250,
      renderMode: 'floor',
      blocksMovement: false,
    }];

    expect(findEntityAt(config, { x: 250, y: 200 })).toBeNull();
    expect(getSelectedEntity(config, { type: 'prop', id: 'plateau-1' })).toBeNull();
    expect(moveMapEntityToPoint(config, { type: 'prop', id: 'plateau-1' }, { x: 100, y: 100 })).toBe(false);
    expect(duplicateMapEntityIntoConfig(config, { type: 'prop', id: 'plateau-1' })).toBeNull();
    expect(config.props).toHaveLength(1);
  });

  it('snaps flat tiles to neighboring tiles and resolves drag preview points', () => {
    const config = createMapConfig();
    const target = { id: 'tile-a', x: 100, y: 100, w: 100, h: 100, r: 50, renderMode: 'floor', blocksMovement: false };
    const moving = { id: 'tile-b', x: 205, y: 102, w: 100, h: 100, r: 50, renderMode: 'floor', blocksMovement: true };
    config.props = [target, moving];

    const preview = resolveFlatTileDragPoint(
      config,
      { anchor: { x: 205, y: 102 }, items: [{ entity: { type: 'prop', id: 'tile-b' }, start: { x: 205, y: 102 } }] },
      { type: 'prop', id: 'tile-b' },
      { x: 205, y: 102 },
      { snap: true },
    );

    expect(preview).toEqual({ x: 200, y: 50 });
    expect(snapFlatTileToNeighbors(moving, config.props, config.world)).toBe(true);
    expect(moving).toMatchObject({ x: 200, y: 100, blocksMovement: false });
  });

  it('resizes selected floor tiles and keeps them inside the world', () => {
    const config = createMapConfig();
    config.props = [{
      id: 'tile-1',
      x: 480,
      y: 300,
      w: 100,
      h: 100,
      r: 50,
      modelHeight: 18,
      renderMode: 'floor',
      blocksMovement: true,
    }];
    const entity = getSelectedEntity(config, { type: 'prop', id: 'tile-1' });

    expect(scaleSelectionEntity(config, entity, { x: 2, y: 2, z: 1.5 })).toBe(true);
    expect(config.props[0]).toMatchObject({
      x: 400,
      y: 300,
      w: 200,
      h: 200,
      r: 100,
      modelHeight: 12,
      blocksMovement: false,
    });
  });

  it('clamps action zone bounds and finds zones from their rectangle edges', () => {
    const config = createMapConfig();
    config.actionZones = [{
      id: 'zone-1',
      name: 'Portail',
      x: 0,
      y: 999,
      w: 20,
      h: 30,
      modelHeight: 40,
    }];

    clampArcadeEntitiesToWorld(config);
    expect(config.actionZones[0]).toMatchObject({ x: 250, y: 380, w: 40, h: 40 });

    expect(moveMapEntityToPoint(config, { type: 'actionZone', id: 'zone-1' }, { x: 999, y: -50 })).toBe(true);
    expect(config.actionZones[0]).toMatchObject({ x: 480, y: 20, w: 40, h: 40 });
    expect(findEntityAt(config, { x: 500, y: 40 })).toEqual({ type: 'actionZone', id: 'zone-1' });

    const zoneEntity = getSelectedEntity(config, { type: 'actionZone', id: 'zone-1' });
    expect(scaleSelectionEntity(config, zoneEntity, { x: 20, y: 0.5, z: 20 })).toBe(true);
    expect(config.actionZones[0]).toMatchObject({
      x: 250,
      y: 200,
      w: 500,
      h: 400,
      modelHeight: 60,
    });
  });
});
