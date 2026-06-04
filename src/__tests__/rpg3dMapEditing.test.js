import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_ARCADE_CONFIG, cloneConfig, getActionZoneTopVertices } from '../shared/utils/rpg3dDomain.js';
import {
  clampArcadeEntitiesToWorld,
  duplicateMapEntityIntoConfig,
  findEntityAt,
  getSelectedEntity,
  insertActionZoneVertex,
  isPointInActionZone,
  moveActionZoneEdge,
  moveActionZoneVertex,
  moveMapEntityByDelta,
  moveMapEntityToPoint,
  resolveFlatTileDragPoint,
  resolveProportionalScaleDelta,
  scaleSelectionEntity,
  snapFlatTileToNeighbors,
} from '../shared/utils/rpg3dMapEditing.js';

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

  it('links selected resize axes proportionally', () => {
    expect(resolveProportionalScaleDelta(
      { x: 1.6, y: 1, z: 1 },
      { x: true, y: true, z: false },
    )).toEqual({ x: 1.6, y: 1.6, z: 1 });
    expect(resolveProportionalScaleDelta(
      { x: 1, y: 0.75, z: 1 },
      { x: false, y: true, z: true },
    )).toEqual({ x: 1, y: 0.75, z: 0.75 });
  });

  it('scales only the checked proportional axes together', () => {
    const config = createMapConfig();
    config.props = [{
      id: 'crate-1',
      x: 250,
      y: 200,
      w: 80,
      h: 60,
      modelHeight: 100,
      renderMode: 'billboard',
    }];
    const entity = getSelectedEntity(config, { type: 'prop', id: 'crate-1' });

    expect(scaleSelectionEntity(
      config,
      entity,
      { x: 2, y: 1, z: 1 },
      { proportionalAxes: { x: true, y: true, z: false } },
    )).toBe(true);
    expect(config.props[0]).toMatchObject({
      w: 160,
      h: 60,
      modelHeight: 200,
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

  it('checks action zone polygon containment directly and treats edges as inside', () => {
    const zone = {
      id: 'zone-1',
      vertices: [
        { x: 100, y: 100 },
        { x: 260, y: 100 },
        { x: 260, y: 160 },
        { x: 180, y: 160 },
        { x: 180, y: 260 },
        { x: 100, y: 260 },
      ],
    };

    expect(isPointInActionZone(zone, { x: 130, y: 130 })).toBe(true);
    expect(isPointInActionZone(zone, { x: 140, y: 220 })).toBe(true);
    expect(isPointInActionZone(zone, { x: 220, y: 220 })).toBe(false);
    expect(isPointInActionZone(zone, { x: 180, y: 210 })).toBe(true);
    expect(isPointInActionZone(zone, null)).toBe(false);
  });

  it('edits action zone vertices and uses the polygon for picking and movement', () => {
    const config = createMapConfig();
    config.actionZones = [{
      id: 'zone-1',
      name: 'Zone libre',
      x: 200,
      y: 200,
      w: 120,
      h: 120,
      vertices: [
        { x: 160, y: 160 },
        { x: 300, y: 180 },
        { x: 250, y: 280 },
        { x: 170, y: 260 },
      ],
    }];

    expect(findEntityAt(config, { x: 210, y: 220 })).toEqual({ type: 'actionZone', id: 'zone-1' });
    expect(findEntityAt(config, { x: 295, y: 270 })).toBeNull();

    expect(moveActionZoneVertex(config, 'zone-1', 1, { x: 330, y: 160 })).toBe(true);
    expect(config.actionZones[0].vertices[1]).toEqual({ x: 330, y: 160 });
    expect(config.actionZones[0].topVertices).toBeUndefined();
    expect(getActionZoneTopVertices(config.actionZones[0])[1]).toEqual({ x: 330, y: 160, z: 240 });
    expect(config.actionZones[0]).toMatchObject({ x: 245, y: 220, w: 170, h: 120 });

    expect(moveActionZoneEdge(config, 'zone-1', 1, { x: -40, y: 20 })).toBe(true);
    expect(config.actionZones[0].vertices[1]).toEqual({ x: 290, y: 180 });
    expect(config.actionZones[0].vertices[2]).toEqual({ x: 210, y: 300 });
    expect(config.actionZones[0].topVertices).toBeUndefined();
    expect(getActionZoneTopVertices(config.actionZones[0])[1]).toEqual({ x: 290, y: 180, z: 240 });
    expect(config.actionZones[0]).toMatchObject({ x: 225, y: 230, w: 130, h: 140 });

    expect(moveActionZoneEdge(config, 'zone-1', 1, { x: 15, y: -10 }, 'top')).toBe(true);
    expect(config.actionZones[0].vertices[1]).toEqual({ x: 290, y: 180 });
    expect(config.actionZones[0].vertices[2]).toEqual({ x: 210, y: 300 });
    expect(config.actionZones[0].topVertices[1]).toEqual({ x: 305, y: 170, z: 240 });
    expect(config.actionZones[0].topVertices[2]).toEqual({ x: 225, y: 290, z: 240 });

    expect(moveActionZoneVertex(config, 'zone-1', 2, { x: 340, y: 310, z: 315 }, 'top')).toBe(true);
    expect(config.actionZones[0].vertices[2]).toEqual({ x: 210, y: 300 });
    expect(config.actionZones[0].topVertices[2]).toEqual({ x: 340, y: 310, z: 315 });

    expect(moveMapEntityByDelta(config, { type: 'actionZone', id: 'zone-1' }, { x: 20, y: -10 })).toBe(true);
    expect(config.actionZones[0].vertices[1]).toEqual({ x: 310, y: 170 });
    expect(config.actionZones[0].topVertices[2]).toEqual({ x: 360, y: 300, z: 315 });
    expect(config.actionZones[0]).toMatchObject({ x: 245, y: 220 });

    expect(insertActionZoneVertex(config, 'zone-1', 1)).toBe(true);
    expect(config.actionZones[0].vertices).toHaveLength(5);
    expect(config.actionZones[0].topVertices).toHaveLength(5);
    expect(config.actionZones[0].vertices[2]).toEqual({ x: 270, y: 230 });
    expect(config.actionZones[0].topVertices[2]).toEqual({ x: 343, y: 230, z: 278 });
    expect(moveActionZoneEdge(config, 'zone-1', 1, { x: 0, y: 0, z: -18 }, 'top')).toBe(true);
    expect(config.actionZones[0].topVertices[1]).toEqual({ x: 325, y: 160, z: 222 });
    expect(config.actionZones[0].topVertices[2]).toEqual({ x: 343, y: 230, z: 260 });
    expect(findEntityAt(config, { x: 270, y: 230 })).toEqual({ type: 'actionZone', id: 'zone-1' });
  });

  it('keeps an explicitly edited action zone top layer independent from footprint edits', () => {
    const config = createMapConfig();
    config.actionZones = [{
      id: 'zone-1',
      x: 200,
      y: 200,
      w: 120,
      h: 120,
      vertices: [
        { x: 160, y: 160 },
        { x: 280, y: 160 },
        { x: 280, y: 280 },
        { x: 160, y: 280 },
      ],
      topVertices: [
        { x: 170, y: 150, z: 220 },
        { x: 290, y: 150, z: 260 },
        { x: 300, y: 290, z: 300 },
        { x: 150, y: 290, z: 240 },
      ],
    }];

    expect(moveActionZoneVertex(config, 'zone-1', 0, { x: 120, y: 140 })).toBe(true);
    expect(config.actionZones[0].vertices[0]).toEqual({ x: 120, y: 140 });
    expect(config.actionZones[0].topVertices[0]).toEqual({ x: 170, y: 150, z: 220 });

    expect(moveActionZoneEdge(config, 'zone-1', 0, { x: 20, y: 10 })).toBe(true);
    expect(config.actionZones[0].vertices[0]).toEqual({ x: 140, y: 150 });
    expect(config.actionZones[0].vertices[1]).toEqual({ x: 300, y: 170 });
    expect(config.actionZones[0].topVertices[0]).toEqual({ x: 170, y: 150, z: 220 });
    expect(config.actionZones[0].topVertices[1]).toEqual({ x: 290, y: 150, z: 260 });
  });
});
