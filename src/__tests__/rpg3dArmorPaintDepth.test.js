import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  classifyArmorPaintSegment,
} from '../domains/rpg3d/arcade/rpg3dActorRigging.js';

describe('armor paint depth guard', () => {
  it('keeps painted armor cuts on the painted surface depth', () => {
    const item = {
      armorCutPaintStrokes: [{
        segment: 'left-arm',
        radius: 0.2,
        points: [{ x: 0, y: 0, z: 0.05 }],
      }],
    };

    expect(classifyArmorPaintSegment(new THREE.Vector3(0.04, 0.03, 0.055), item, 1)).toBe('left');
    expect(classifyArmorPaintSegment(new THREE.Vector3(0.04, 0.03, 0.18), item, 1)).toBe('');
  });

  it('uses interpolated stroke depth while dragging between paint points', () => {
    const item = {
      armorCutPaintStrokes: [{
        segment: 'right-arm',
        radius: 0.18,
        points: [
          { x: -0.1, y: 0, z: 0.02 },
          { x: 0.1, y: 0, z: 0.06 },
        ],
      }],
    };

    expect(classifyArmorPaintSegment(new THREE.Vector3(0, 0.04, 0.04), item, 1)).toBe('right');
    expect(classifyArmorPaintSegment(new THREE.Vector3(0, 0.04, 0.16), item, 1)).toBe('');
  });

  it('rejects a detached surface even when it sits inside the brush circle', () => {
    const item = {
      armorCutPaintStrokes: [{
        segment: 'body',
        radius: 0.2,
        points: [{ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1 }],
      }],
    };

    expect(classifyArmorPaintSegment(new THREE.Vector3(0.11, 0.03, 0.01), item, 1)).toBe('body');
    expect(classifyArmorPaintSegment(new THREE.Vector3(0.03, 0.03, 0.04), item, 1)).toBe('');
  });

  it('uses the painted surface normal instead of the global z axis', () => {
    const item = {
      armorCutPaintStrokes: [{
        segment: 'left-arm',
        radius: 0.18,
        points: [{ x: 0, y: 0, z: 0, nx: 1, ny: 0, nz: 0 }],
      }],
    };

    expect(classifyArmorPaintSegment(new THREE.Vector3(0.01, 0.11, 0.08), item, 1)).toBe('left');
    expect(classifyArmorPaintSegment(new THREE.Vector3(0.04, 0.04, 0.02), item, 1)).toBe('');
  });

  it('keeps section-view paint on the selected visible side', () => {
    const item = {
      armorCutPaintStrokes: [{
        segment: 'body',
        radius: 0.18,
        points: [{ x: 0, y: 0, z: 0, nx: 0, ny: 0, nz: 1, cx: 1, cy: 0, cz: 0, cw: 0 }],
      }],
    };

    expect(classifyArmorPaintSegment(new THREE.Vector3(0.04, 0.04, 0.01), item, 1)).toBe('body');
    expect(classifyArmorPaintSegment(new THREE.Vector3(-0.04, 0.04, 0.01), item, 1)).toBe('');
  });

});
