import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ARCADE_CONFIG,
  PLAYER_RADIUS,
  cloneConfig,
  createInitialState,
} from '../utils/rpg3dDomain.js';
import {
  applyPlayerMoveTarget,
  createBullet,
  emitParticles,
  fireBullet,
  getBlockingObstacles,
  hasLineOfSight,
  resolveMapCollision,
} from '../hooks/useRpg3DGameLoop.js';

const createRuntimeConfig = () => {
  const config = cloneConfig(DEFAULT_ARCADE_CONFIG);
  config.world = { width: 300, height: 200, grid: 100 };
  config.player = {
    ...config.player,
    x: 50,
    y: 50,
    speed: 120,
    dashSpeed: 240,
  };
  config.obstacles = [];
  config.reliefs = [];
  config.props = [];
  config.enemies = [];
  config.pickups = [];
  config.actionZones = [];
  config.terrainPaintStrokes = [];
  return config;
};

describe('useRpg3DGameLoop pure helpers', () => {
  it('resolves world bounds and blocking obstacle collisions', () => {
    const config = createRuntimeConfig();
    const wall = { id: 'wall-1', x: 80, y: 80, w: 80, h: 40 };
    config.obstacles = [wall];

    expect(resolveMapCollision({ x: -10, y: 50 }, PLAYER_RADIUS, config)).toMatchObject({
      x: PLAYER_RADIUS,
      y: 50,
    });

    expect(resolveMapCollision({ x: 100, y: 100 }, PLAYER_RADIUS, config)).toMatchObject({
      x: 62,
      y: 100,
    });
  });

  it('builds blocking obstacles from walls, reliefs and props then checks line of sight', () => {
    const config = createRuntimeConfig();
    config.obstacles = [{ id: 'wall-1', x: 120, y: 80, w: 20, h: 40 }];
    config.reliefs = [{ id: 'relief-1', x: 200, y: 100, w: 40, h: 40, blocksMovement: true }];
    config.props = [{ id: 'prop-1', x: 30, y: 30, w: 20, h: 20, blocksMovement: true }];

    const obstacles = getBlockingObstacles(config);
    expect(obstacles).toHaveLength(3);
    expect(hasLineOfSight({ x: 50, y: 100 }, { x: 250, y: 100 }, obstacles)).toBe(false);
    expect(hasLineOfSight({ x: 50, y: 160 }, { x: 250, y: 160 }, obstacles)).toBe(true);
  });

  it('emits particles in-place while respecting the particle cap', () => {
    const state = {
      particles: [
        { x: 1, y: 1, life: 1 },
        { x: 2, y: 2, life: 1 },
      ],
    };

    const particles = emitParticles(state, 10, 20, '#abcdef', 4, {
      maxParticles: 3,
      random: () => 0,
    });

    expect(particles).toBe(state.particles);
    expect(state.particles).toHaveLength(3);
    expect(state.particles[2]).toMatchObject({
      x: 10,
      y: 20,
      vx: 55,
      vy: 0,
      life: 0.35,
      maxLife: 0.7,
      color: '#abcdef',
    });
  });

  it('creates and appends bullets with deterministic velocity and lifetime', () => {
    const state = { bullets: [] };
    const random = () => 0.5;
    const now = () => 42;

    const bullet = createBullet(
      'player',
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      100,
      12,
      '#8df7ff',
      0,
      { random, now },
    );

    expect(bullet).toMatchObject({
      id: 'player-42-0.5',
      owner: 'player',
      x: 0,
      y: 0,
      vx: 100,
      vy: 0,
      damage: 12,
      color: '#8df7ff',
      life: 1.2,
    });
    const enemyBullet = fireBullet(state, 'enemy', { x: 0, y: 0 }, { x: 0, y: 10 }, 80, 5, '#ff776d', 0, { random, now });
    expect(enemyBullet).toMatchObject({ owner: 'enemy', life: 1.85 });
    expect(enemyBullet.vx).toBeCloseTo(0);
    expect(enemyBullet.vy).toBeCloseTo(80);
    expect(state.bullets).toHaveLength(1);
  });

  it('applies player click movement targets and clears near targets', () => {
    const config = createRuntimeConfig();
    const state = createInitialState(config);

    expect(applyPlayerMoveTarget(state, config, { x: 200, y: 50 })).toBe(true);
    expect(state.player.moveTarget).toEqual({ x: 200, y: 50 });
    expect(state.player.vx).toBe(120);
    expect(state.player.vy).toBe(0);

    expect(applyPlayerMoveTarget(state, config, { x: 52, y: 50 })).toBe(true);
    expect(state.player.moveTarget).toBeNull();
    expect(state.player.vx).toBe(0);
    expect(state.player.vy).toBe(0);

    expect(applyPlayerMoveTarget(state, config, { x: 999, y: -50 })).toBe(true);
    expect(state.player.moveTarget).toEqual({ x: 282, y: 18 });
  });
});
