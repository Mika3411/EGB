import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  getActionZoneCurrentViewDistance,
  getActionZoneHeightDragDelta,
  getActionZoneHeightDragPoint,
  getNesoCameraTarget,
  getNesoViewEntity,
  syncArcadeShadowMapForFrame,
} from '../components/arcade/ArcadeThreeViewport.jsx';

describe('ArcadeThreeViewport shadow map handling', () => {
  it('keeps shadow maps updating so tester-mode actor shadows follow movement', () => {
    const renderer = {
      shadowMap: {
        autoUpdate: false,
        needsUpdate: false,
      },
    };

    syncArcadeShadowMapForFrame(renderer);

    expect(renderer.shadowMap.autoUpdate).toBe(true);
    expect(renderer.shadowMap.needsUpdate).toBe(true);
  });

  it('maps action zone Z drags to height only', () => {
    expect(getActionZoneHeightDragPoint({ x: 120, y: 80, z: 240 }, 100, 70)).toEqual({
      x: 120,
      y: 80,
      z: 300,
    });
    expect(getActionZoneHeightDragPoint({ x: 120, y: 80, z: 10 }, 100, 160)).toEqual({
      x: 120,
      y: 80,
      z: 0,
    });
    expect(getActionZoneHeightDragDelta(100, 75)).toEqual({ x: 0, y: 0, z: 50 });
  });

  it('keeps the current camera zoom when switching to a NESO face view', () => {
    const camera = { position: new THREE.Vector3(0, 0, 14) };
    const controls = {
      target: new THREE.Vector3(0, 0, 2),
      minDistance: 2.6,
      maxDistance: 90,
    };

    expect(getActionZoneCurrentViewDistance(camera, controls, 30)).toBe(12);
  });

  it('supports NESO views for characters and objects', () => {
    expect(getNesoViewEntity({ type: 'prop', id: 'prop-1' })).toEqual({ type: 'prop', id: 'prop-1' });
    expect(getNesoViewEntity(null, [{ type: 'enemy', id: 'enemy-1' }])).toEqual({ type: 'enemy', id: 'enemy-1' });

    const config = {
      world: { width: 500, height: 400, grid: 50 },
      engine: { propHeight: 1 },
      heroes: [{ id: 'hero-1', x: 160, y: 120, z: 0 }],
      enemies: [],
      pickups: [{ id: 'pickup-1', x: 200, y: 160, z: 0 }],
      props: [{ id: 'prop-1', x: 220, y: 180, w: 80, h: 60, modelHeight: 120 }],
      actionZones: [],
      obstacles: [],
      reliefs: [],
    };

    expect(getNesoCameraTarget(config, { type: 'hero', id: 'hero-1' })?.isVector3).toBe(true);
    expect(getNesoCameraTarget(config, { type: 'pickup', id: 'pickup-1' })?.isVector3).toBe(true);
    expect(getNesoCameraTarget(config, { type: 'prop', id: 'prop-1' })?.y).toBeGreaterThan(0);
  });
});
