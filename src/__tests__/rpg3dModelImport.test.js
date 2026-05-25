import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildDecorGltfObject,
  DECOR_MODEL_DIMENSION_MIN,
  disposeThreeObject,
  getAnimationEntriesForSlot,
  getCharacterBuildSignature,
  getDecorBuildSignature,
  getDecorModelDimensions,
  getPreviewAnimationOptions,
  getPreviewAnimationSlot,
  isHeavyLocalFbxAnimationAsset,
  isHeavyLocalFbxAsset,
  readCharacterModelImport,
  readDecorModelImport,
  resizeAxesProportionally,
} from '../utils/rpg3dModelImport.js';

const makeBoxObj = ({ width = 3, height = 2, depth = 4 } = {}) => [
  'o Box',
  'v 0 0 0',
  `v ${width} 0 0`,
  `v ${width} ${height} 0`,
  `v 0 ${height} 0`,
  `v 0 0 ${depth}`,
  `v ${width} 0 ${depth}`,
  `v ${width} ${height} ${depth}`,
  `v 0 ${height} ${depth}`,
  'f 1 2 3 4',
  'f 5 8 7 6',
  'f 1 5 6 2',
  'f 2 6 7 3',
  'f 3 7 8 4',
  'f 4 8 5 1',
].join('\n');

describe('rpg3d model import', () => {
  it('keeps imported decor model bounds as the initial object size', async () => {
    const file = new File([makeBoxObj()], 'cailloux.obj', { type: 'model/obj' });

    const result = await readDecorModelImport(file);

    expect(result.modelDimensions).toMatchObject({
      width: expect.closeTo(3, 5),
      height: expect.closeTo(2, 5),
      depth: expect.closeTo(4, 5),
    });
  });

  it('keeps imported GLB files untouched by default', async () => {
    const file = new File(['original-glb-data'], 'epee.glb', { type: 'model/gltf-binary' });

    const result = await readCharacterModelImport(file);

    expect(result.optimizedFile.size).toBe(file.size);
    expect(result.optimization).toMatchObject({
      optimized: false,
      originalSize: file.size,
      optimizedSize: file.size,
      skipped: true,
      skipReason: 'preserve-original',
    });
  });

  it('builds imported inventory weapon GLB objects for preview rendering', () => {
    const object = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 2, 0.05),
      new THREE.MeshStandardMaterial({ color: '#d8dee9' }),
    );

    const decor = buildDecorGltfObject(object, {
      id: 'weapon-model',
      kind: 'inventory-weapon',
      modelFormat: 'glb',
      width: 1,
      height: 4.15,
      depth: 0.1,
      materialBrightness: 1,
    });

    expect(decor.userData.decorModelObject).toBe(object);
    expect(decor.userData.decorOrientationObject).toBeInstanceOf(THREE.Group);
    disposeThreeObject(decor);
  });

  it('keeps inventory object proportions in the object preview builder', () => {
    const object = new THREE.Mesh(
      new THREE.BoxGeometry(0.48, 2, 0.05),
      new THREE.MeshStandardMaterial({ color: '#d8dee9' }),
    );

    const decor = buildDecorGltfObject(object, {
      id: 'shield-model',
      kind: 'inventory-shield',
      modelFormat: 'glb',
      width: 6,
      height: 4,
      depth: 0.1,
      materialBrightness: 1,
    });
    object.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(object, true).getSize(new THREE.Vector3());

    expect(size.x / size.y).toBeCloseTo(0.24, 3);
    expect(size.z / size.y).toBeCloseTo(0.025, 3);
    disposeThreeObject(decor);
  });

  it('can render inventory objects at a 0.001 target size', () => {
    const object = new THREE.Mesh(
      new THREE.BoxGeometry(3, 2, 4),
      new THREE.MeshStandardMaterial({ color: '#d8dee9' }),
    );

    const decor = buildDecorGltfObject(object, {
      id: 'tiny-shield-model',
      kind: 'inventory-shield',
      modelFormat: 'glb',
      width: 0.001,
      height: 0.001,
      depth: 0.001,
      materialBrightness: 1,
    });
    object.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(object, true).getSize(new THREE.Vector3());

    expect(Math.max(size.x, size.y, size.z)).toBeCloseTo(0.001, 6);
    disposeThreeObject(decor);
  });

  it('resizes proportional axes by keeping their current ratio', () => {
    const resized = resizeAxesProportionally({ x: 2, y: 4, z: 8 }, 'x', 5, 0.05, 120);

    expect(resized).toEqual({
      x: 5,
      y: 10,
      z: 20,
    });
  });

  it('allows decor dimensions down to 0.001', () => {
    expect(DECOR_MODEL_DIMENSION_MIN).toBe(0.001);
    expect(getDecorModelDimensions({
      width: 0.0001,
      height: 0.0001,
      depth: 0.0001,
    })).toEqual({ x: 0.001, y: 0.001, z: 0.001 });

    const resized = resizeAxesProportionally(
      { x: 0.01, y: 0.02, z: 0.03 },
      'x',
      0.001,
      DECOR_MODEL_DIMENSION_MIN,
      120,
    );
    expect(resized.x).toBe(0.001);
    expect(resized.y).toBe(0.002);
    expect(resized.z).toBe(0.003);
  });

  it('keeps character preview build stable when only map brightness changes', () => {
    const model = {
      id: 'hero-model',
      shape: 'glb',
      modelUrl: 'hero.glb',
      materialBrightness: 1,
    };
    const signature = getCharacterBuildSignature(model);

    model.materialBrightness = 0.55;

    expect(getCharacterBuildSignature(model)).toBe(signature);
  });

  it('does not replace an explicitly requested attack preview with the walk animation', () => {
    const model = {
      modelAnimations: {
        walk: { modelUrl: 'walk.glb' },
        attack: { modelName: 'att.fbx' },
      },
    };

    expect(getPreviewAnimationSlot(model, 'attack')).toBe('');
    expect(getPreviewAnimationSlot(model, '')).toBe('walk');
  });

  it('uses the classic idle animation as the automatic preview when it exists', () => {
    const model = {
      modelAnimations: {
        idle: { modelUrl: 'idle.glb' },
        walk: { modelUrl: 'walk.glb' },
        attack: { modelUrl: 'attack.glb' },
      },
    };

    expect(getPreviewAnimationSlot(model, '')).toBe('idle');
    expect(getPreviewAnimationSlot(model, 'walk')).toBe('walk');
  });

  it('keeps extra animation variants inside their base preview family', () => {
    const model = {
      modelAnimations: {
        walk__first: { animationSlot: 'walk', modelUrl: 'walk-a.glb' },
        walk__second: { animationSlot: 'walk', modelUrl: 'walk-b.glb' },
        attack__first: { animationSlot: 'attack', modelUrl: 'attack-a.glb' },
      },
    };

    expect(getPreviewAnimationSlot(model, 'walk')).toBe('walk__first');
    expect(getPreviewAnimationSlot(model, 'walk__second')).toBe('walk__second');
    expect(getPreviewAnimationSlot(model, 'attack')).toBe('attack__first');
    expect(getAnimationEntriesForSlot(model.modelAnimations, 'walk').map((entry) => entry.key)).toEqual([
      'walk__first',
      'walk__second',
    ]);
    expect(getPreviewAnimationOptions('walk__second').preferredNames).toContain('walk');
  });

  it('blocks heavy local FBX character previews while allowing animation imports', () => {
    const fbxAsset = {
      modelFormat: 'fbx',
      modelUrl: 'blob:http://localhost/attack',
      modelFileSize: 128 * 1024 * 1024,
    };
    const oversizedFbxAsset = {
      ...fbxAsset,
      modelFileSize: 256 * 1024 * 1024,
    };

    expect(isHeavyLocalFbxAsset(fbxAsset)).toBe(true);
    expect(isHeavyLocalFbxAnimationAsset(fbxAsset)).toBe(false);
    expect(isHeavyLocalFbxAsset(oversizedFbxAsset)).toBe(true);
    expect(isHeavyLocalFbxAnimationAsset(oversizedFbxAsset)).toBe(true);
  });

  it('keeps decor preview build stable when only rotation or map brightness changes', () => {
    const model = {
      id: 'decor-model',
      kind: 'decor',
      modelUrl: 'statue.glb',
      materialBrightness: 1,
      modelRotationX: 0,
      modelRotationY: 0,
      modelRotationZ: 0,
    };
    const signature = getDecorBuildSignature(model);

    Object.assign(model, {
      materialBrightness: 0.55,
      modelRotationX: -90,
      modelRotationY: 45,
      modelRotationZ: 10,
    });

    expect(getDecorBuildSignature(model)).toBe(signature);
  });
});
