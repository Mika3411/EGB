import { describe, expect, test } from 'vitest';
import {
  getSceneDragSnapPosition,
  getSceneResizeSnapPosition,
} from '../shared/services/sceneAlignmentSnapping.js';

describe('scene alignment snapping', () => {
  test("aligne le centre d'une zone avec le centre de l'image", () => {
    const scene = {
      hotspots: [
        { id: 'spot-1', x: 30, y: 42, width: 12, height: 8 },
      ],
      sceneObjects: [],
      visualEffectZones: [],
    };

    const snapped = getSceneDragSnapPosition({
      scene,
      type: 'hotspot',
      id: 'spot-1',
      x: 49.3,
      y: 42,
    });

    expect(snapped.x).toBe(50);
    expect(snapped.guides.vertical.position).toBe(50);
  });

  test("aligne le bord d'une zone avec le bord d'une autre zone", () => {
    const scene = {
      hotspots: [
        { id: 'moving', x: 30, y: 30, width: 10, height: 10 },
        { id: 'target', x: 60, y: 30, width: 20, height: 10 },
      ],
      sceneObjects: [],
      visualEffectZones: [],
    };

    const snapped = getSceneDragSnapPosition({
      scene,
      type: 'hotspot',
      id: 'moving',
      x: 46.2,
      y: 30,
    });

    expect(snapped.x).toBe(45);
    expect(snapped.guides.vertical.position).toBe(50);
  });

  test('ignore les autres zones de la selection en mouvement', () => {
    const scene = {
      hotspots: [
        { id: 'moving', x: 30, y: 30, width: 10, height: 10 },
        { id: 'selected-too', x: 80, y: 30, width: 10, height: 10 },
      ],
      sceneObjects: [],
      visualEffectZones: [],
    };

    const snapped = getSceneDragSnapPosition({
      scene,
      type: 'hotspot',
      id: 'moving',
      x: 68.8,
      y: 30,
      movedIds: ['moving', 'selected-too'],
    });

    expect(snapped.x).toBe(68.8);
    expect(snapped.guides.vertical).toBeNull();
  });

  test("aimante une poignée de redimensionnement sur le bord d'une autre zone", () => {
    const scene = {
      hotspots: [
        { id: 'moving', x: 30, y: 30, width: 10, height: 10 },
        { id: 'target', x: 60, y: 30, width: 20, height: 10 },
      ],
      sceneObjects: [],
      visualEffectZones: [],
    };

    const snapped = getSceneResizeSnapPosition({
      scene,
      type: 'hotspot',
      id: 'moving',
      x: 49.2,
      y: 30,
      axes: { x: true, y: false },
    });

    expect(snapped.x).toBe(50);
    expect(snapped.y).toBe(30);
    expect(snapped.guides.vertical.position).toBe(50);
    expect(snapped.guides.horizontal).toBeNull();
  });

  test("aimante une poignée d'angle sur le centre de l'image", () => {
    const scene = {
      hotspots: [
        { id: 'moving', x: 30, y: 30, width: 10, height: 10 },
      ],
      sceneObjects: [],
      visualEffectZones: [],
    };

    const snapped = getSceneResizeSnapPosition({
      scene,
      type: 'hotspot',
      id: 'moving',
      x: 49.4,
      y: 50.7,
      axes: { x: true, y: true },
    });

    expect(snapped.x).toBe(50);
    expect(snapped.y).toBe(50);
    expect(snapped.guides.vertical.position).toBe(50);
    expect(snapped.guides.horizontal.position).toBe(50);
  });
});
