import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  __decor3dPreviewRigTestUtils,
} from '../domains/rpg3d/components/Decor3DPreviewRuntime.js';

const {
  classifyArmorCutPoint,
  getArmorCutMarkerOffsets,
  getArmorManipulationLines,
  getGripTraySlotNdc,
  isCanvasPointInGripTray,
} = __decor3dPreviewRigTestUtils;

const leggingsMarkers = [
  { id: 'left-groin-fold', x: -0.24, y: -0.34, z: 0.04, enabled: true },
  { id: 'right-groin-fold', x: 0.24, y: -0.34, z: 0.04, enabled: true },
  { id: 'left-knee', x: -0.25, y: -0.72, z: 0.04, enabled: true },
  { id: 'right-knee', x: 0.25, y: -0.72, z: 0.04, enabled: true },
  { id: 'left-foot', x: -0.22, y: -1.05, z: 0.1, enabled: true },
  { id: 'right-foot', x: 0.22, y: -1.05, z: 0.1, enabled: true },
];

describe('Decor3DPreview rig profiles', () => {
  it('uses leg lines for leggings manipulation instead of shoulder and elbow lines', () => {
    const lines = getArmorManipulationLines(leggingsMarkers);

    expect(lines).toMatchObject([
      {
        segment: 'left-arm',
        shoulderId: 'left-groin-fold',
        elbowId: 'left-foot',
      },
      {
        segment: 'right-arm',
        shoulderId: 'right-groin-fold',
        elbowId: 'right-foot',
      },
    ]);
  });

  it('classifies leggings geometry around the leg markers', () => {
    const markerOffsets = getArmorCutMarkerOffsets(leggingsMarkers);

    expect(markerOffsets.isLeggingsRig).toBe(true);
    expect(classifyArmorCutPoint(new THREE.Vector3(-0.24, -0.78, 0.06), markerOffsets)).toBe('left-arm');
    expect(classifyArmorCutPoint(new THREE.Vector3(0.24, -0.78, 0.06), markerOffsets)).toBe('right-arm');
  });

  it('keeps inactive grip markers inside the right tray bounds', () => {
    const firstSlot = getGripTraySlotNdc(0, 6);
    const lastSlot = getGripTraySlotNdc(5, 6);

    expect(firstSlot.x).toBeGreaterThan(0.6);
    expect(lastSlot.x).toBeLessThan(1);
    expect(isCanvasPointInGripTray({ x: 930, y: 300, width: 1000, height: 600 })).toBe(true);
    expect(isCanvasPointInGripTray({ x: 700, y: 300, width: 1000, height: 600 })).toBe(false);
  });
});
